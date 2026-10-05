#!/usr/bin/env python3
"""Self-test for `scripts/deploy-devnet.sh`.

The script is the only path that puts the missing programs on devnet, and the
failure it must prevent is unrecoverable in the wrong direction: deploying a
program into someone else's address, or deploying to mainnet by accident. A
runbook that is never exercised against a known-bad fixture is just another
unverified claim, so this drives the real shell script with a mocked `solana`
CLI (and a real local JSON-RPC mock for the estimator) and pins every refusal:

  * wrong target (mainnet)            -> refuse, no transactions
  * missing authority key             -> refuse, no transactions
  * zero balance                      -> refuse, no transactions
  * missing .so                       -> refuse, no transactions
  * program keypair != declared id    -> refuse, no transactions
  * program already on devnet         -> nothing to do, no transactions
  * dry run with everything present   -> prints the command, sends nothing
  * --apply with everything present   -> exactly one deploy, correct arguments
  * no explicit max_len policy        -> refuse BEFORE any network call
  * every deploy carries --max-len    -> exact / headroom / legacy-2x, never implicit
  * balance below the sum of ALL      -> refuse before the first deploy, even when
    programs' locked rent + fees +       the largest program alone would be affordable
    explicit reserves
  * wrong cluster (not devnet)        -> refuse, even with AOF_DEPLOY_TARGET=devnet
  * stray buffers                     -> shown, never closed
  * after each deploy                 -> owner/authority/capacity/bytecode verified in the network
  * rerun after success or after a partial failure -> idempotent, resumable

Run: python3 scripts/test-deploy-devnet.py
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import devnet_mock_rpc as mockrpc  # noqa: E402

REPO = HERE.parent
SCRIPT = HERE / "deploy-devnet.sh"
REGISTRY = json.loads((REPO / "watchtower" / "addresses.json").read_text(encoding="utf-8"))
ALL_PROGRAMS = [(p["name"], p["address"]) for p in REGISTRY["programs"]]
CORE = next(p for p in REGISTRY["programs"] if p["name"] == "aof_core")
CORE_ID = CORE["address"]
OTHER_ID = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T"
SOL = 1_000_000_000
RATE, FEE = 5080, 5000  # параметры поддельного узла: оценщик обязан следовать им, а не знать их

MOCK_SOLANA = """#!/usr/bin/env bash
# Мок CLI: единственное, что здесь есть, — те команды, которые зовёт скрипт.
printf '%s\\n' "$*" >> "$MOCK_CALLS"
case "$1" in
  address) cat "$3";;
  balance) echo "${MOCK_BALANCE:-3} SOL";;
  --version) echo "solana-cli 4.2.1 (src:mock; feat:0, client:Agave)";;
  account)
    for id in ${MOCK_PRESENT:-}; do [ "$id" = "$2" ] && exit 0; done
    [ -f "$MOCK_CHAIN/$2.json" ] && exit 0
    exit 1;;
  *) [ "$1" = "program" ] && [ "$2" = "deploy" ] || exit 1
     echo "$*" >> "$MOCK_DEPLOY_LOG"
     [ "${MOCK_DEPLOY_FAIL:-0}" = "1" ] && exit 1
     shift 2
     maxlen=""; progid=""; payer=""; so=""
     while [ $# -gt 0 ]; do
       case "$1" in
         --url) shift 2;;
         --keypair) payer="$(cat "$2")"; shift 2;;
         --program-id) progid="$(cat "$2" 2>/dev/null || echo "$2")"; shift 2;;
         --max-len) maxlen="$2"; shift 2;;
         *) so="$1"; shift;;
       esac
     done
     [ -n "${MOCK_DEPLOY_FAIL_ADDR:-}" ] && [ "$MOCK_DEPLOY_FAIL_ADDR" = "$progid" ] && exit 1
     # как настоящий CLI: без --max-len ёмкость равна размеру .so
     [ -n "$maxlen" ] || maxlen="$(wc -c < "$so" | tr -d ' ')"
     corrupt=false; [ "${MOCK_DEPLOY_CORRUPT:-0}" = "1" ] && corrupt=true
     printf '{"max_len": %s, "so": "%s", "authority": "%s", "corrupt": %s}\\n' "$maxlen" "$so" "$payer" "$corrupt" > "$MOCK_CHAIN/$progid.json"
     exit 0;;
esac
"""


def expected_minimum(sizes, headroom_percent=0, fee_reserve=SOL // 10, operator=SOL):
    """Независимая от оценщика формула: Σ(rent Program + rent ProgramData) + комиссии + явные резервы."""
    total = 0
    for size in sizes:
        max_len = size + (size * headroom_percent + 99) // 100
        total += (128 + 36) * RATE + (128 + 45 + max_len) * RATE
        total += (2 + -(-size // 1012) + 2) * FEE
    return total + fee_reserve + operator


class DeployBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = pathlib.Path(self.tmp.name)
        self.artifacts = self.dir / "deploy"
        self.artifacts.mkdir()
        self.chain = self.dir / "chain"
        self.chain.mkdir()
        (self.dir / "bin").mkdir()
        mock = self.dir / "bin" / "solana"
        mock.write_text(MOCK_SOLANA, encoding="utf-8")
        mock.chmod(0o755)
        (self.dir / "keypair.json").write_text(CORE_ID, encoding="utf-8")
        self.add_program("aof_core", CORE_ID, 52)
        probe = self.dir / "probe.py"
        probe.write_text("import sys; print('ЗОНД: программы проверены')\n", encoding="utf-8")
        self.probe = probe
        self.calls = self.dir / "calls.log"
        self.deploys = self.dir / "deploys.log"
        rpc = mockrpc.MockRpc(lamports_per_byte=RATE, lamports_per_signature=FEE,
                              balances={CORE_ID: 50 * SOL}, chain_dir=self.chain)
        self.rpc = rpc.__enter__()
        self.addCleanup(rpc.__exit__, None, None, None)

    @staticmethod
    def elf(address: str, size: int = 52) -> bytes:
        """Минимальная «программа»: байты адреса там, где их ждёт declare_id!."""
        return mockrpc.fake_so(address, size)

    def add_program(self, name: str, address: str, size: int):
        (self.artifacts / f"{name}.so").write_bytes(self.elf(address, size))
        (self.artifacts / f"{name}-keypair.json").write_text(address, encoding="utf-8")

    def add_all_programs(self, size: int):
        for name, address in ALL_PROGRAMS:
            self.add_program(name, address, size)

    def run_script(self, *extra: str, env_overrides: dict | None = None, policy: bool = True):
        env = dict(os.environ)
        for key in ("PROGRAM_MAX_LEN_POLICY", "PROGRAM_MAX_LEN_HEADROOM_PERCENT", "OPERATOR_RESERVE_SOL",
                    "DEPLOY_FEE_RESERVE_SOL", "MIN_SOL"):
            env.pop(key, None)
        env.update({
            "PATH": f"{self.dir / 'bin'}:{env['PATH']}",
            "AOF_DEPLOY_TARGET": "devnet",
            "AUTHORITY_KEYPAIR": str(self.dir / "keypair.json"),
            "ARTIFACTS": str(self.artifacts),
            "ONLY": "aof_core",
            "PROBE": str(self.probe),
            "RPC_URL": self.rpc.url,
            "MOCK_CALLS": str(self.calls),
            "MOCK_DEPLOY_LOG": str(self.deploys),
            "MOCK_CHAIN": str(self.chain),
            "OPERATOR_RESERVE_SOL": "1",
            "DEPLOY_FEE_RESERVE_SOL": "0.1",
        })
        if policy:
            env["PROGRAM_MAX_LEN_POLICY"] = "exact"
        env.update(env_overrides or {})
        return subprocess.run(["bash", str(SCRIPT), *extra], capture_output=True, text=True,
                              env=env, cwd=str(REPO))

    def seed_chain(self, address: str, so_path: pathlib.Path, max_len: int, authority: str, corrupt: bool = False):
        """Состояние «программа уже в сети»: его читает и зондирует оценщик."""
        (self.chain / f"{address}.json").write_text(json.dumps(
            {"max_len": max_len, "so": str(so_path), "authority": authority, "corrupt": corrupt}),
            encoding="utf-8")

    def deploys_made(self) -> list[str]:
        return self.deploys.read_text(encoding="utf-8").splitlines() if self.deploys.exists() else []

    def cli_calls(self) -> list[str]:
        return self.calls.read_text(encoding="utf-8").splitlines() if self.calls.exists() else []


class DeployScript(DeployBase):
    def test_dry_run_deploys_nothing(self):
        done = self.run_script()
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("aof_core", done.stdout)
        self.assertIn("--program-id", done.stdout)
        self.assertIn("сухой прогон", done.stdout)

    def test_apply_deploys_once_with_the_declared_id(self):
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 0, done.stderr)
        deploys = self.deploys_made()
        self.assertEqual(len(deploys), 1, deploys)
        self.assertIn("--program-id " + str(self.artifacts / "aof_core-keypair.json"), deploys[0])
        self.assertIn(str(self.artifacts / "aof_core.so"), deploys[0])
        self.assertIn("ЗОНД", done.stdout)

    def test_refuses_mainnet_target(self):
        done = self.run_script("--apply", env_overrides={"AOF_DEPLOY_TARGET": "mainnet-beta"})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("devnet", done.stderr)
        self.assertEqual(self.rpc.requests, [], "отказ по цели обязан случиться до любых обращений к сети")

    def test_refuses_without_authority_key(self):
        done = self.run_script("--apply", env_overrides={"AUTHORITY_KEYPAIR": str(self.dir / "nope.json")})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])

    def test_refuses_with_zero_balance(self):
        done = self.run_script("--apply", env_overrides={"MOCK_BALANCE": "0"})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("airdrop", done.stderr)

    def test_refuses_without_built_program(self):
        (self.artifacts / "aof_core.so").unlink()
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("anchor build", done.stderr)

    def test_refuses_foreign_program_keypair(self):
        (self.artifacts / "aof_core-keypair.json").write_text(OTHER_ID, encoding="utf-8")
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("чужой адрес", done.stderr)

    def test_refuses_without_program_keypair_at_all(self):
        (self.artifacts / "aof_core-keypair.json").unlink()
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("declare_id!", done.stderr)

    def test_already_deployed_is_a_no_op(self):
        done = self.run_script("--apply", env_overrides={"MOCK_PRESENT": CORE_ID})
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("деплоить нечего", done.stdout)

    def test_failed_deploy_is_reported(self):
        done = self.run_script("--apply", env_overrides={"MOCK_DEPLOY_FAIL": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("деплой aof_core не прошёл", done.stderr)

    def test_refuses_binary_built_for_another_program_id(self):
        # Так выглядит .so из CI-артефакта: declare_id! там переписан на
        # временный ключ раннера, и Anchor отверг бы каждый вызов.
        (self.artifacts / "aof_core.so").write_bytes(self.elf(OTHER_ID))
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("DeclaredProgramIdMismatch", done.stderr)

    def test_refuses_binary_that_is_not_a_program(self):
        (self.artifacts / "aof_core.so").write_text("not-a-program", encoding="utf-8")
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])


class Upgrade(DeployBase):
    """UPGRADE=... — обновление уже живущего адреса: скрипт сам сверяет байткод.

    Без этого шага новый код в уже развёрнутой программе не доехал бы до сети:
    шаг 3 считает существующий аккаунт доказательством и пропускает его.
    """

    def setUp(self):
        super().setUp()
        self.old_so = self.dir / "old-aof-core.so"
        old = bytearray(self.elf(CORE_ID, 60))           # прошлая сборка: те же 36 байт заголовка,
        old[40] = 0xAA                                   # но другие байты тела — байткод отличается
        self.old_so.write_bytes(bytes(old))
        self.seed_chain(CORE_ID, self.old_so, 60, CORE_ID)

    def test_upgrade_of_a_present_program_replaces_the_bytecode(self):
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        deploys = self.deploys_made()
        self.assertEqual(len(deploys), 1, deploys)
        self.assertIn("upgrade", done.stdout)
        state = json.loads((self.chain / f"{CORE_ID}.json").read_text(encoding="utf-8"))
        self.assertEqual(pathlib.Path(state["so"]).read_bytes(), (self.artifacts / "aof_core.so").read_bytes())
        self.assertEqual(state["max_len"], 52, "exact-политика: ёмкость обязана быть равна новой сборке")

    def test_matching_bytecode_is_left_alone(self):
        self.seed_chain(CORE_ID, self.artifacts / "aof_core.so", 52, CORE_ID)
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("upgrade не нужен", done.stdout)

    def test_all_upgrades_everything_that_differs(self):
        done = self.run_script("--apply", env_overrides={"UPGRADE": "all"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(len(self.deploys_made()), 1)

    def test_aof_market_mismatch_is_replaced_by_upgrade_all(self):
        market_id = next(address for name, address in ALL_PROGRAMS if name == "aof_market")
        market_so = self.dir / "aof-market-old.so"
        old = bytearray(self.elf(market_id, 60))
        old[40] = 0xAA
        market_so.write_bytes(bytes(old))
        self.add_program("aof_market", market_id, 52)
        self.seed_chain(market_id, market_so, 60, CORE_ID)

        done = self.run_script("--apply", env_overrides={
            "UPGRADE": "all", "ONLY": "aof_market",
        })
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        deploys = self.deploys_made()
        self.assertEqual(len(deploys), 1, deploys)
        self.assertIn("aof_market", deploys[0])
        state = json.loads((self.chain / f"{market_id}.json").read_text(encoding="utf-8"))
        self.assertEqual(pathlib.Path(state["so"]).read_bytes(),
                         (self.artifacts / "aof_market.so").read_bytes())

    def test_upgrade_refuses_without_a_local_build(self):
        (self.artifacts / "aof_core.so").unlink()
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("anchor build", done.stderr)

    def test_unknown_upgrade_name_refuses(self):
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_nope"})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("нет в реестре", done.stderr)

    def test_upgrade_without_the_program_keypair_uses_the_address(self):
        (self.artifacts / "aof_core-keypair.json").unlink()
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        deploys = self.deploys_made()
        self.assertEqual(len(deploys), 1, deploys)
        self.assertIn("--program-id " + CORE_ID, deploys[0])
        self.assertNotIn("--program-id " + str(self.artifacts / "aof_core-keypair.json"), deploys[0])

    def test_upgrade_that_lands_the_wrong_bytecode_is_caught(self):
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core", "MOCK_DEPLOY_CORRUPT": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("не совпадает", done.stderr)

    def test_upgrade_refuses_when_the_operator_is_not_the_authority(self):
        # CLI сначала фиксирует SOL в буфере и только потом отправляет upgrade:
        # чужая authority обнаружилась бы после траты. Проверка — read-only, до.
        self.seed_chain(CORE_ID, self.old_so, 60, OTHER_ID)
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("upgrade authority", done.stderr)
        self.assertIn(OTHER_ID, done.stderr)

    def test_matching_bytecode_with_a_foreign_authority_is_not_an_error(self):
        # Байткод совпал — обновлять нечего, значит и authority не важна.
        self.seed_chain(CORE_ID, self.artifacts / "aof_core.so", 52, OTHER_ID)
        done = self.run_script("--apply", env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("upgrade не нужен", done.stdout)

    def test_dry_run_shows_the_upgrade_and_sends_nothing(self):
        done = self.run_script(env_overrides={"UPGRADE": "aof_core"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("upgrade", done.stdout)
        self.assertIn("--max-len 52", done.stdout)


class MaxLenPolicy(DeployBase):
    """Ёмкость программы — явное решение владельца, а не умолчание CLI."""

    def setUp(self):
        super().setUp()
        self.add_program("aof_core", CORE_ID, 100_000)

    def deploy_line(self, **kwargs):
        done = self.run_script("--apply", **kwargs)
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        deploys = self.deploys_made()
        self.assertEqual(len(deploys), 1, deploys)
        return deploys[0]

    def test_missing_policy_refuses_before_any_network_call(self):
        for extra in ((), ("--apply",)):
            self.rpc.requests.clear()
            done = self.run_script(*extra, policy=False)
            self.assertEqual(done.returncode, 3, done.stdout)
            self.assertIn("PROGRAM_MAX_LEN_POLICY", done.stderr)
            self.assertIn("exact", done.stderr)
            self.assertEqual(self.deploys_made(), [])
            self.assertEqual(self.rpc.requests, [], "без политики ни одного запроса к RPC")
            self.assertEqual(self.cli_calls(), [], "и ни одного вызова CLI")

    def test_invalid_policies_refuse(self):
        cases = [
            {"PROGRAM_MAX_LEN_POLICY": "double"},
            {"PROGRAM_MAX_LEN_POLICY": "headroom"},
            {"PROGRAM_MAX_LEN_POLICY": "headroom", "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "100"},
            {"PROGRAM_MAX_LEN_POLICY": "headroom", "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "abc"},
            {"PROGRAM_MAX_LEN_POLICY": "exact", "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "15"},
        ]
        for env in cases:
            done = self.run_script("--apply", env_overrides=env)
            self.assertEqual(done.returncode, 3, f"{env}: {done.stdout}")
            self.assertEqual(self.deploys_made(), [], env)

    def test_exact_passes_the_binary_size(self):
        line = self.deploy_line()
        self.assertIn("--max-len 100000 ", line)

    def test_headroom_passes_the_rounded_up_size(self):
        line = self.deploy_line(env_overrides={"PROGRAM_MAX_LEN_POLICY": "headroom",
                                               "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "15"})
        self.assertIn("--max-len 115000 ", line)

    def test_legacy_2x_only_when_explicitly_chosen(self):
        line = self.deploy_line(env_overrides={"PROGRAM_MAX_LEN_POLICY": "legacy-2x"})
        self.assertIn("--max-len 200000 ", line)

    def test_every_deploy_command_carries_max_len(self):
        for env in ({}, {"PROGRAM_MAX_LEN_POLICY": "headroom", "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "25"},
                    {"PROGRAM_MAX_LEN_POLICY": "legacy-2x"}):
            for path in self.chain.glob("*.json"):
                path.unlink()
            if self.deploys.exists():
                self.deploys.unlink()
            done = self.run_script("--apply", env_overrides=env)
            self.assertEqual(done.returncode, 0, done.stderr)
            for line in self.deploys_made():
                self.assertRegex(line, r" --max-len [0-9]+ ", line)

    def test_dry_run_shows_the_max_len_it_would_use(self):
        done = self.run_script(env_overrides={"PROGRAM_MAX_LEN_POLICY": "headroom",
                                              "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "10"})
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("--max-len 110000", done.stdout)
        self.assertEqual(self.deploys_made(), [])
        self.assertIn("headroom (1.10×)", done.stdout)

    def test_the_chosen_capacity_really_lands_in_the_network(self):
        self.deploy_line(env_overrides={"PROGRAM_MAX_LEN_POLICY": "headroom", "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "25"})
        state = json.loads((self.chain / f"{CORE_ID}.json").read_text(encoding="utf-8"))
        self.assertEqual(state["max_len"], 125_000)

    def test_a_binary_larger_than_max_len_can_never_be_requested(self):
        # max_len ниже размера .so запретила бы и CLI, и загрузчик; оценщик не даёт такого посчитать.
        estimator = REPO / "scripts" / "devnet-deploy-estimator.py"
        done = subprocess.run([sys.executable, str(estimator), "max-len", "--so", str(self.artifacts / "aof_core.so"),
                               "--policy", "exact"], capture_output=True, text=True)
        self.assertEqual(done.stdout.strip(), "100000")


class AggregateBalance(DeployBase):
    """Баланс проверяется по ВСЕМ программам сразу и ДО первой транзакции."""

    SIZE = 300_000

    def setUp(self):
        super().setUp()
        self.add_all_programs(self.SIZE)
        self.sizes = [self.SIZE] * len(ALL_PROGRAMS)

    def run_all(self, *extra, **kwargs):
        env = {"ONLY": ""}
        env.update(kwargs.pop("env_overrides", {}) or {})
        return self.run_script(*extra, env_overrides=env, **kwargs)

    def test_balance_for_the_largest_program_alone_is_not_enough(self):
        one = expected_minimum([self.SIZE])
        everything = expected_minimum(self.sizes)
        self.assertGreater(everything, one * 2)
        self.rpc.balances[CORE_ID] = one + SOL  # хватает на самую большую программу, но не на сумму
        done = self.run_all("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [], "ни одного деплоя: отказ раньше первой транзакции")
        self.assertIn("не хватает", done.stderr)
        self.assertIn("ДЕФИЦИТ", done.stdout)
        self.assertIn("расчёт стоимости не пройден", done.stderr)
        self.assertIn("ни одной транзакции не отправлено", done.stderr)

    def test_boundary_one_lamport(self):
        minimum = expected_minimum(self.sizes)
        self.rpc.balances[CORE_ID] = minimum - 1
        done = self.run_all("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])
        self.rpc.balances[CORE_ID] = minimum
        done = self.run_all("--apply")
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(len(self.deploys_made()), len(ALL_PROGRAMS))

    def test_min_sol_alone_is_not_a_sufficient_balance(self):
        # Старый скрипт печатал «нужно минимум 1 SOL» и пропускал любой ненулевой баланс.
        self.rpc.balances[CORE_ID] = 2 * SOL
        done = self.run_all("--apply", env_overrides={"MIN_SOL": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertEqual(self.deploys_made(), [])

    def test_dry_run_gates_on_balance_too(self):
        self.rpc.balances[CORE_ID] = 2 * SOL
        done = self.run_all()
        self.assertEqual(done.returncode, 3)
        self.assertNotIn("сухой прогон, транзакций не будет", done.stdout)

    def test_table_and_reserves_are_printed_before_the_first_deploy(self):
        done = self.run_all("--apply", env_overrides={"OPERATOR_RESERVE_SOL": "2", "DEPLOY_FEE_RESERVE_SOL": "0.25"})
        self.assertEqual(done.returncode, 0, done.stderr)
        for fragment in ("Резерв оператора после деплоя (явный)", "Резерв на повторы и сбои комиссий (явный)",
                         "МИНИМАЛЬНЫЙ СТАРТОВЫЙ БАЛАНС", "Постоянно заблокировано", "aof_session_keys"):
            self.assertIn(fragment, done.stdout)
        self.assertLess(done.stdout.index("МИНИМАЛЬНЫЙ СТАРТОВЫЙ БАЛАНС"), done.stdout.index("деплой aof_core"))
        self.assertIn("2.000000000 SOL", done.stdout)
        self.assertIn("0.250000000 SOL", done.stdout)

    def test_min_sol_is_the_default_operator_reserve(self):
        env = {"OPERATOR_RESERVE_SOL": "", "MIN_SOL": "3"}
        done = self.run_script("--apply", env_overrides={"ONLY": "", **env})
        # пустая строка не считается заданной: резерв берётся из MIN_SOL
        self.assertIn("3.000000000 SOL", done.stdout)

    def test_only_missing_programs_are_priced(self):
        present = [address for name, address in ALL_PROGRAMS if name in ("aof_quests", "aof_rebirth", "aof_liquidity")]
        self.rpc.balances[CORE_ID] = expected_minimum([self.SIZE] * 3)  # ровно на три недостающие
        done = self.run_all("--apply", env_overrides={"MOCK_PRESENT": " ".join(present)})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(len(self.deploys_made()), 3)

    def test_policy_changes_the_requirement(self):
        exact = expected_minimum(self.sizes, 0)
        double = expected_minimum(self.sizes, 100)
        self.assertGreater(double, exact)
        self.rpc.balances[CORE_ID] = exact
        self.assertEqual(self.run_all("--apply").returncode, 0)
        for path in self.chain.glob("*.json"):
            path.unlink()
        self.deploys.unlink()
        done = self.run_all("--apply", env_overrides={"PROGRAM_MAX_LEN_POLICY": "legacy-2x"})
        self.assertEqual(done.returncode, 3, "тот же баланс не хватает при 2.00×")
        self.assertEqual(self.deploys_made(), [])


class NetworkSafety(DeployBase):
    def test_wrong_cluster_refuses_even_with_devnet_target(self):
        self.rpc.genesis = mockrpc.MAINNET_GENESIS
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 3)
        self.assertIn("не подтверждён как devnet", done.stderr)
        self.assertEqual(self.deploys_made(), [])
        self.assertEqual(self.rpc.methods(), ["getGenesisHash"], "дальше genesis скрипт не идёт")

    def test_unreachable_rpc_refuses(self):
        with mockrpc.MockRpc() as dead:
            url = dead.url
        done = self.run_script("--apply", env_overrides={"RPC_URL": url})
        self.assertEqual(done.returncode, 3)
        self.assertIn("RPC", done.stderr)
        self.assertEqual(self.deploys_made(), [])

    def test_stray_buffers_are_shown_and_never_closed(self):
        self.rpc.buffers = [{"address": "BufferZzz111111111111111111111111111111111", "authority": CORE_ID,
                             "lamports": 7 * SOL}]
        done = self.run_script("--apply")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("BufferZzz", done.stdout)
        self.assertIn("7.000000000", done.stdout)
        self.assertIn("НЕ закрывает", done.stdout)
        for line in self.cli_calls():
            self.assertNotIn("close", line)
        # найденный буфер не засчитывается как доступные средства
        self.assertNotIn("getTransaction", self.rpc.methods())

    def test_no_stray_buffers_is_reported_calmly(self):
        done = self.run_script()
        self.assertIn("незавершённых деплоев не видно", done.stdout)

    def test_script_has_no_path_that_creates_keys_or_closes_accounts(self):
        source = SCRIPT.read_text(encoding="utf-8")
        for forbidden in ("solana-keygen", "program close", "program extend", "--final",
                          "set-upgrade-authority", "airdrop --"):
            self.assertNotIn(forbidden, source.replace("попросите airdrop", ""), forbidden)
        # Смена адреса упомянута только в тексте подсказки человеку (die ... "или напрямую: ..."), но не исполняется.
        for line in source.splitlines():
            if "rotate-program-ids" in line:
                self.assertTrue(line.lstrip().startswith("#") or "или напрямую:" in line, line)

    def test_program_keypairs_and_registry_are_untouched(self):
        watched = [self.artifacts / "aof_core-keypair.json", self.dir / "keypair.json",
                   REPO / "watchtower" / "addresses.json", REPO / "security" / "program-registry.json"]
        before = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in watched}
        self.assertEqual(self.run_script("--apply").returncode, 0)
        after = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in watched}
        self.assertEqual(before, after)


class PostDeployVerification(DeployBase):
    def test_every_deployed_program_is_verified_in_the_network(self):
        self.add_all_programs(5_000)
        done = self.run_script("--apply", env_overrides={"ONLY": ""})
        self.assertEqual(done.returncode, 0, done.stderr)
        looked_up = {r["params"][0] for r in self.rpc.requests if r["method"] == "getAccountInfo"}
        for _, address in ALL_PROGRAMS:
            self.assertIn(address, looked_up)
        self.assertEqual(done.stdout.count("sha256 байткода"), len(ALL_PROGRAMS))
        self.assertIn("ёмкость 5000 Б = max_len", done.stdout)

    def test_a_mismatch_in_the_network_stops_the_run(self):
        self.add_all_programs(5_000)
        done = self.run_script("--apply", env_overrides={"ONLY": "", "MOCK_DEPLOY_CORRUPT": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("состояние в сети не сошлось", done.stderr)
        self.assertIn("НЕ совпадает", done.stderr)
        self.assertEqual(len(self.deploys_made()), 1, "после первой же расходящейся программы дальше не идём")

    def test_rerun_after_success_is_a_no_op(self):
        self.add_all_programs(5_000)
        first = self.run_script("--apply", env_overrides={"ONLY": ""})
        self.assertEqual(first.returncode, 0, first.stderr)
        made = len(self.deploys_made())
        second = self.run_script("--apply", env_overrides={"ONLY": ""})
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(len(self.deploys_made()), made, "повторный запуск ничего не деплоит")
        self.assertIn("деплоить нечего", second.stdout)

    def test_resume_after_a_partial_failure_deploys_only_what_is_missing(self):
        self.add_all_programs(5_000)
        market = dict(ALL_PROGRAMS)["aof_market"]
        first = self.run_script("--apply", env_overrides={"ONLY": "", "MOCK_DEPLOY_FAIL_ADDR": market})
        self.assertEqual(first.returncode, 3)
        self.assertIn("деплой aof_market не прошёл", first.stderr)
        self.assertIn("Повторный запуск безопасен", first.stderr)
        deployed_first = [line for line in self.deploys_made()]
        self.assertGreaterEqual(len(deployed_first), 1)
        self.assertTrue((self.chain / f"{CORE_ID}.json").exists(), "core успел задеплоиться до сбоя")
        self.assertFalse((self.chain / f"{market}.json").exists())
        second = self.run_script("--apply", env_overrides={"ONLY": ""})
        self.assertEqual(second.returncode, 0, second.stderr + second.stdout)
        new_lines = self.deploys_made()[len(deployed_first):]
        self.assertEqual(len(new_lines), len(ALL_PROGRAMS) - 1, "core не передеплоен, остальные — да")
        self.assertFalse([l for l in new_lines if str(self.artifacts / "aof_core-keypair.json") in l])


if __name__ == "__main__":
    unittest.main(verbosity=2)
