#!/usr/bin/env python3
"""Self-test for `scripts/devnet-bringup.sh`.

`devnet-bringup.sh` — единственная команда, которой владелец поднимает игру на
девнете целиком (деплой → Config → минты → капы → добыча → коллекционеры).
Такой скрипт опасен в двух направлениях: он может «включить» на mainnet или
включить добычу до выплатных минтов (тогда прочность инструмента сгорает без
выплаты). Поэтому self-test прогоняет настоящий shell-скрипт с моками CLI и
пинит каждое из этих поведений:

  * не devnet                                  -> отказ, ни одной команды
  * нет ключа оператора                        -> отказ
  * нет .so и SKIP=build                       -> отказ
  * нет ADMIN_TOKEN, а шаги backend нужны      -> отказ до единой транзакции
  * сухой прогон                               -> ничего не деплоит и не POST-ит
  * --apply                                    -> шаги идут в безопасном порядке
  * сборка, когда .so нет, а anchor есть       -> build, затем deploy
  * preflight BLOCKED                          -> добыча не включается
  * неизвестный вид коллекционера              -> отказ
  * SKIP убирает backend-шаги                  -> backend не требуется
  * bootstrap-preflight (10 сценариев): backend не запущен / чужой HTTP-сервис / неверный
    токен / read-only / чужой authority / чужой program ID / программ и Config нет /
    программы есть, Config нет / Config инициализирован / повторный запуск; плюс mainnet-RPC

Run: python3 scripts/test-devnet-bringup.py
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import devnet_mock_rpc as mockrpc  # noqa: E402

REPO = HERE.parent
SCRIPT = HERE / "devnet-bringup.sh"
REGISTRY = json.loads((REPO / "watchtower" / "addresses.json").read_text(encoding="utf-8"))
PROGRAMS = [(p["name"], p["address"]) for p in REGISTRY["programs"]]
CORE_ADDRESS = dict(PROGRAMS)["aof_core"]
COLLECTOR_MINT = CORE_ADDRESS

MOCK_SOLANA = """#!/usr/bin/env bash
printf 'solana %s\\n' "$*" >> "$MOCK_CALLS"
case "$1" in
  address) cat "$3";;
  balance) echo "${MOCK_BALANCE:-3} SOL";;
  --version) echo "solana-cli 4.2.1 (src:mock; feat:0, client:Agave)";;
  account)
    [ -f "$MOCK_CHAIN/$2.json" ] && exit 0
    exit ${MOCK_ACCOUNT_CODE:-1};;
  *) [ "$1" = "program" ] && [ "$2" = "deploy" ] || exit 1
     echo "@@deploy $*" >> "$MOCK_CALLS"
     shift 2; maxlen=""; progid=""; payer=""; so=""
     while [ $# -gt 0 ]; do
       case "$1" in
         --url) shift 2;;
         --keypair) payer="$(cat "$2")"; shift 2;;
         --program-id) progid="$(cat "$2")"; shift 2;;
         --max-len) maxlen="$2"; shift 2;;
         *) so="$1"; shift;;
       esac
     done
     # как настоящий CLI: без --max-len ёмкость равна размеру .so
     [ -n "$maxlen" ] || maxlen="$(wc -c < "$so" | tr -d ' ')"
     printf '{"max_len": %s, "so": "%s", "authority": "%s", "corrupt": false}\\n' "$maxlen" "$so" "$payer" > "$MOCK_CHAIN/$progid.json"
     exit 0;;
esac
"""

MOCK_ANCHOR = """#!/usr/bin/env bash
printf 'anchor %s\\n' "$*" >> "$MOCK_CALLS"
[ "${1:-}" = "build" ] || exit 1
for name in aof_core aof_market aof_session_keys; do
  cp "$MOCK_BUILT/$name.so" "$MOCK_ARTIFACTS/$name.so" 2>/dev/null || true
done
"""

MOCK_NPX = """#!/usr/bin/env bash
printf 'npx %s\\n' "$*" >> "$MOCK_CALLS"
# initConfig.ts создаёт Config: поддельный backend читает этот маркер, чтобы повторный запуск видел последствия первого.
case "$*" in *scripts/initConfig.ts*) [ -n "${MOCK_CONFIG_MARKER:-}" ] && : > "$MOCK_CONFIG_MARKER";; esac
exit 0
"""

MOCK_NPM = """#!/usr/bin/env bash
printf 'npm %s\\n' "$*" >> "$MOCK_CALLS"
[ "${1:-}" = "run" ] || exit 0
if [ "${2:-}" = "preflight:mining-devnet" ] && [ -n "${MINING_PREFLIGHT_REPORT:-}" ]; then
  if [ "${MOCK_PREFLIGHT_BLOCKED:-0}" = "1" ]; then
    printf 'status: BLOCKED\\nblockers: [mock]\\n' > "$MINING_PREFLIGHT_REPORT"
    exit 1
  fi
  printf 'status: READ_ONLY_PREFLIGHT_PASSED_BYTECODE_AND_SMOKE_REQUIRED\\n' > "$MINING_PREFLIGHT_REPORT"
fi
exit 0
"""

MOCK_CURL = """#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "$MOCK_CALLS"
# Маршрут bootstrap-preflight идёт настоящим curl к настоящему HTTP-серверу теста: коды выхода curl
# (connection refused), HTTP-статусы и флаги проверяются как есть, а не в моём пересказе. Остальные тесты зовут
# условный http://mock-backend: только этот запрос curl-прокладка перенаправляет на поддельный backend теста
# (FAKE_BACKEND_URL); пусто — идём по URL как есть (сценарии с собственным сервером или с мёртвым портом).
for arg in "$@"; do case "$arg" in http*/admin/config/bootstrap-preflight)
  real_args=()
  for a in "$@"; do case "$a" in
    http*/admin/config/bootstrap-preflight) real_args+=("${FAKE_BACKEND_URL:-${a%/admin/config/bootstrap-preflight}}/admin/config/bootstrap-preflight");;
    *) real_args+=("$a");;
  esac; done
  exec "${REAL_CURL:?REAL_CURL не задан}" "${real_args[@]}";;
esac; done
# -w %{http_code} без тела: скрипты читают только код.
if printf '%s' "$*" | grep -q -- '-w %{http_code}'; then echo 200; exit 0; fi
url=""
for arg in "$@"; do case "$arg" in http*) url="$arg";; esac; done
case "$url" in
  */admin/config/mining)
    if printf '%s' "$*" | grep -q -- '-X POST'; then
      : > "${MOCK_MINING_STATE:-/dev/null}"
      echo '{"sig":"mock-mining-sig"}'
    elif [ -f "${MOCK_MINING_STATE:-/nonexistent}" ]; then
      echo '{"miningEnabled":true}'
    else
      echo '{"miningEnabled":false}'
    fi;;
  */admin/config/collector-mint) echo '{"sig":"mock-collector-sig"}';;
  */query/config) echo "{\\"circuitMint\\":\\"$MOCK_MINT\\",\\"siliconMint\\":\\"$MOCK_MINT\\",\\"mindMint\\":\\"$MOCK_MINT\\",\\"treasury\\":\\"$MOCK_MINT\\"}";;
  */query/material-mints) echo "{\\"initialized\\":true,\\"mints\\":{\\"dataset\\":\\"$MOCK_MINT\\",\\"neuron\\":\\"$MOCK_MINT\\",\\"QUANTUM_BIT\\":\\"$MOCK_MINT\\"}}";;
  */query/hot-market-config)
    if [ -f "${MOCK_MARKET_STATE:-/nonexistent}" ]; then
      printf '{"coreMint":"%s","gemMint":"%s"}\n' "$MOCK_MINT" "$MOCK_MINT"
    else
      echo '{"error":"Market config not initialized"}'
    fi;;
  */query/hot-market-pool/*)
    rarity="${url##*/}"
    if [ -f "${MOCK_POOL_STATE:-/nonexistent}/$rarity" ]; then echo '{"targetPriceCore":1000000000}'; else echo '{"error":"Pool not initialized"}'; fi;;
  */query/craft-economy)
    if [ -f "${MOCK_CRAFT_STATE:-/nonexistent}" ]; then echo '{"circuitBase":["100000000000","1","2","3"]}'; else echo 'null'; fi;;
  */query/rarity-counter/*)
    rarity="${url##*/}"
    if [ -f "${MOCK_CRAFT_STATE:-/nonexistent}.rarity$rarity" ]; then
      printf '{"rarity":%s,"mintedCount":"0"}\n' "$rarity"
    else
      echo 'null'
    fi;;
  */admin/craft-economy/init)
    [ "${MOCK_CRAFT_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    : > "${MOCK_CRAFT_STATE:-/dev/null}"
    echo '{"sig":"mock-craft-sig"}';;
  */admin/rarity-counter/init)
    [ "${MOCK_CRAFT_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    rarity=""
    for arg in "$@"; do
      case "$arg" in '{"rarityIdx":'*) rarity="$(printf '%s' "$arg" | sed -e 's/^{"rarityIdx"://' -e 's/}.*//')";; esac
    done
    [ -n "$rarity" ] && : > "${MOCK_CRAFT_STATE:-/dev/null}.rarity$rarity"
    echo '{"sig":"mock-rarity-sig"}';;
  */packs/configs)
    printf '{"packs":['
    first=1
    for entry in "0:small" "1:medium" "2:big"; do
      index="${entry%%:*}"
      if [ -f "${MOCK_MECHANICS_STATE:-/nonexistent}.pack$index" ]; then
        [ "$first" = 1 ] || printf ','
        printf '{"packType":"%s","priceLamports":"1","oddsBps":[1,1,1,1,0]}' "${entry#*:}"
        first=0
      fi
    done
    printf ']}\n';;
  */query/reroll-config)
    if [ -f "${MOCK_MECHANICS_STATE:-/nonexistent}.reroll" ]; then echo '{"oddsBps":[5500,3000,1100,400,0]}'; else echo 'null'; fi;;
  */query/lottery/*)
    if [ -f "${MOCK_MECHANICS_STATE:-/nonexistent}.lottery" ]; then echo '{"roundId":"1"}'; else echo 'null'; fi;;
  */query/season/*)
    if [ -f "${MOCK_MECHANICS_STATE:-/nonexistent}.season" ]; then echo '{"seasonId":1}'; else echo 'null'; fi;;
  */packs/config/init)
    [ "${MOCK_MECHANICS_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    index=""
    for arg in "$@"; do case "$arg" in
      *'"packType":'*) index="$(printf '%s' "$arg" | sed -e 's/^.*"packType"://' -e 's/,.*//')";;
    esac; done
    [ -n "$index" ] && : > "${MOCK_MECHANICS_STATE:-/dev/null}.pack$index"
    echo '{"sig":"mock-pack-sig"}';;
  */reroll/config/init)
    [ "${MOCK_MECHANICS_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    : > "${MOCK_MECHANICS_STATE:-/dev/null}.reroll"
    echo '{"sig":"mock-reroll-sig"}';;
  */lottery/round/init)
    [ "${MOCK_MECHANICS_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    : > "${MOCK_MECHANICS_STATE:-/dev/null}.lottery"
    echo '{"sig":"mock-lottery-sig"}';;
  */season/init)
    [ "${MOCK_MECHANICS_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    : > "${MOCK_MECHANICS_STATE:-/dev/null}.season"
    echo '{"sig":"mock-season-sig"}';;
  */hot-market/config/init)
    [ "${MOCK_MARKET_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    : > "${MOCK_MARKET_STATE:-/dev/null}"
    echo '{"sig":"mock-market-sig"}';;
  */hot-market/pool/init)
    [ "${MOCK_MARKET_FAIL:-0}" = "1" ] && { echo '{"error":"mock failure"}'; exit 0; }
    rarity=""
    for arg in "$@"; do
      case "$arg" in '{"rarity":'*) rarity="$(printf '%s' "$arg" | sed -e 's/^{"rarity"://' -e 's/,.*//')";; esac
    done
    [ -n "$rarity" ] && : > "${MOCK_POOL_STATE:-/dev/null}/$rarity"
    echo '{"sig":"mock-pool-sig"}';;
  *) echo '{"ok":true}';;
esac
exit 0
"""


REAL_CURL = shutil.which("curl")


class BringupBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        self.artifacts = self.dir / "deploy"
        self.artifacts.mkdir()
        self.built = self.dir / "built"
        self.built.mkdir()
        self.bin = self.dir / "bin"
        self.bin.mkdir()
        for name, body in (("solana", MOCK_SOLANA), ("anchor", MOCK_ANCHOR),
                           ("npx", MOCK_NPX), ("npm", MOCK_NPM), ("curl", MOCK_CURL)):
            path = self.bin / name
            path.write_text(body, encoding="utf-8")
            path.chmod(0o755)
        for name, address in PROGRAMS:
            # Полный локальный build кладёт .so всех программ; ограничивать
            # нельзя — deploy-devnet.sh деплоит каждую отсутствующую.
            (self.built / f"{name}.so").write_bytes(self.elf(address))
            (self.artifacts / f"{name}.so").write_bytes(self.elf(address))
            (self.artifacts / f"{name}-keypair.json").write_text(address, encoding="utf-8")
        (self.dir / "keypair.json").write_text(CORE_ADDRESS, encoding="utf-8")
        self.chain = self.dir / "chain"
        self.chain.mkdir()
        self.config_marker = self.dir / "config-initialized"
        rpc = mockrpc.MockRpc(balances={CORE_ADDRESS: 50 * 1_000_000_000}, chain_dir=self.chain)
        self.rpc = rpc.__enter__()
        self.addCleanup(rpc.__exit__, None, None, None)
        # backend по умолчанию — для тестов, которым нужен «исправный» backend: preflight отвечает как настоящий
        default_backend = FakeBackend(self.chain, self.config_marker)
        self.default_backend = default_backend.__enter__()
        self.addCleanup(default_backend.__exit__, None, None, None)
        self.probe = self.dir / "probe.py"
        self.probe.write_text(
            "import sys\nprint('ЗОНД: программы проверены')\n", encoding="utf-8")
        (self.dir / "pools").mkdir()
        self.calls = self.dir / "calls.log"

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def elf(address: str) -> bytes:
        alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        value = 0
        for char in address:
            value = value * 58 + alphabet.index(char)
        return b"\x7fELF" + value.to_bytes(32, "big") + b"\x00" * 16

    def run_script(self, *extra: str, env_overrides: dict | None = None):
        env = dict(os.environ)
        env.update({
            "PATH": f"{self.bin}:{env['PATH']}",
            "AOF_DEPLOY_TARGET": "devnet",
            "AUTHORITY_KEYPAIR": str(self.dir / "keypair.json"),
            "ARTIFACTS": str(self.artifacts),
            "BACKEND_URL": "http://mock-backend",
            "ADMIN_TOKEN": "mock-token",
            "MOCK_CALLS": str(self.calls),
            "MOCK_BUILT": str(self.built),
            "MOCK_ARTIFACTS": str(self.artifacts),
            "MOCK_MINT": CORE_ADDRESS,
            "MOCK_MINING_STATE": str(self.dir / "mining-on"),
            "MOCK_MARKET_STATE": str(self.dir / "market-on"),
            "MOCK_CRAFT_STATE": str(self.dir / "craft-on"),
            "MOCK_MECHANICS_STATE": str(self.dir / "mechanics-on"),
            "MOCK_POOL_STATE": str(self.dir / "pools"),
            "PROBE": str(self.probe),
            "SKIP": "",
            "RPC_URL": self.rpc.url,
            "MOCK_CHAIN": str(self.chain),
            "MOCK_CONFIG_MARKER": str(self.config_marker),
            "REAL_CURL": REAL_CURL or "",
            "FAKE_BACKEND_URL": self.default_backend.url,
            "PROGRAM_MAX_LEN_POLICY": "exact",
        })
        env.pop("PROGRAM_MAX_LEN_HEADROOM_PERCENT", None)
        env.update(env_overrides or {})
        for key in ("AOF_DEPLOY_TARGET", "ADMIN_TOKEN", "SKIP", "COLLECTOR_MINTS", "PROGRAM_MAX_LEN_POLICY"):
            if env.get(key) == "":
                env.pop(key, None)
        return subprocess.run(["bash", str(SCRIPT), *extra], capture_output=True, text=True,
                              env=env, cwd=str(REPO))

    def log(self) -> list[str]:
        return self.calls.read_text(encoding="utf-8").splitlines() if self.calls.exists() else []

    def deploys(self) -> list[str]:
        return [line for line in self.log() if line.startswith("@@deploy")]

    def posts(self) -> list[str]:
        return [line for line in self.log()
                if "curl" in line and "-X POST" in line and "/admin/config" in line]

    def craft_posts(self) -> list[str]:
        return [line for line in self.log()
                if "curl" in line and "-X POST" in line and "/admin/craft-economy" in line
                or "curl" in line and "-X POST" in line and "/admin/rarity-counter" in line]

    def mechanics_posts(self) -> list[str]:
        return [line for line in self.log()
                if "curl" in line and "-X POST" in line
                and ("/packs/config" in line or "/reroll/config" in line
                     or "/lottery/round" in line or "/season/init" in line)]

    def market_posts(self) -> list[str]:
        return [line for line in self.log()
                if "curl" in line and "-X POST" in line and "/hot-market/" in line]


class BringupScript(BringupBase):
    def test_wrong_target_refuses_before_any_command(self):
        done = self.run_script(env_overrides={"AOF_DEPLOY_TARGET": "mainnet"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("devnet", done.stderr)
        self.assertEqual(self.log(), [])

    def test_missing_max_len_policy_refuses_before_any_command(self):
        done = self.run_script("--apply", env_overrides={"PROGRAM_MAX_LEN_POLICY": ""})
        self.assertEqual(done.returncode, 3)
        self.assertIn("PROGRAM_MAX_LEN_POLICY", done.stderr)
        self.assertEqual(self.log(), [], "политика проверяется раньше любой команды")
        self.assertEqual(self.rpc.requests, [], "и раньше любого обращения к RPC")

    def test_policy_reaches_every_deploy_as_max_len(self):
        done = self.run_script("--apply", env_overrides={
            "COLLECTOR_MINTS": "",
            "PROGRAM_MAX_LEN_POLICY": "headroom",
            "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "25",
        })
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        deploys = self.deploys()
        self.assertEqual(len(deploys), len(PROGRAMS))
        for line in deploys:
            self.assertRegex(line, r" --max-len 65 ", line)  # ceil(52 * 1.25) для 52-байтной фикстуры

    def test_skip_deploy_does_not_need_a_policy(self):
        done = self.run_script("--apply", env_overrides={
            "PROGRAM_MAX_LEN_POLICY": "", "SKIP": "deploy", "COLLECTOR_MINTS": ""})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.deploys(), [])

    def test_missing_operator_key_refuses(self):
        done = self.run_script(env_overrides={"AUTHORITY_KEYPAIR": str(self.dir / "nope.json")})
        self.assertEqual(done.returncode, 3)
        self.assertIn("ключ", done.stderr)

    def test_missing_so_with_skip_build_refuses(self):
        for name in ("aof_core", "aof_market", "aof_session_keys"):
            (self.artifacts / f"{name}.so").unlink()
        done = self.run_script("--apply", env_overrides={"SKIP": "build"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("SKIP=build", done.stderr)
        self.assertEqual(self.deploys(), [])

    def test_backend_steps_need_admin_token(self):
        done = self.run_script("--apply", env_overrides={"ADMIN_TOKEN": ""})
        self.assertEqual(done.returncode, 3)
        self.assertIn("ADMIN_TOKEN", done.stderr)
        self.assertEqual(self.deploys(), [])

    def test_the_refusal_names_a_skip_list_that_actually_works(self):
        # Раньше сообщение предлагало SKIP=mints,caps,mining,collectors, но с ним
        # market/craft/mechanics оставались включёнными и всё равно требовали
        # ADMIN_TOKEN: совет не работал. Теперь в отказе есть SKIP=backend, и он
        # обязан действительно снимать требование.
        done = self.run_script("--apply", env_overrides={"ADMIN_TOKEN": ""})
        self.assertIn("SKIP=backend", done.stderr)
        again = self.run_script("--apply", env_overrides={"ADMIN_TOKEN": "", "SKIP": "backend"})
        self.assertEqual(again.returncode, 0, again.stderr + again.stdout)
        self.assertIn("ADMIN_TOKEN не нужен", again.stdout)

    def test_skip_backend_deploys_without_a_backend_and_without_posting(self):
        for path in self.chain.glob("*.json"):
            path.unlink()
        done = self.run_script("--apply", env_overrides={"ADMIN_TOKEN": "", "SKIP": "backend"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(len(self.deploys()), len(PROGRAMS), "деплой обязан остаться в силе")
        self.assertEqual(self.posts(), [])
        self.assertEqual(self.craft_posts(), [])
        self.assertEqual(self.mechanics_posts(), [])
        self.assertFalse([l for l in self.log() if l.startswith("npx")], self.log())

    def test_skip_backend_dry_run_needs_no_backend(self):
        done = self.run_script(env_overrides={"ADMIN_TOKEN": "", "SKIP": "backend"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.deploys(), [])
        self.assertIn("сухой прогон", done.stdout)

    def test_dry_run_changes_nothing(self):
        done = self.run_script()
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(self.deploys(), [])
        self.assertEqual(self.posts(), [])
        self.assertFalse([l for l in self.log() if l.startswith("npx")], self.log())
        self.assertIn("сухой прогон", done.stdout)

    def test_apply_runs_steps_in_safe_order(self):
        done = self.run_script("--apply", env_overrides={
            "COLLECTOR_MINTS": f"{COLLECTOR_MINT}:historian",
        })
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        log = "\n".join(self.log())
        positions = {
            "deploy": log.find("@@deploy"),
            "config": log.find("scripts/initConfig.ts"),
            "mints": log.find("scripts/initMintsV2.ts"),
            "caps": log.find("run caps:init"),
            "packs": log.find("/packs/config/init"),
            "reroll": log.find("/reroll/config/init"),
            "lottery": log.find("/lottery/round/init"),
            "season": log.find("/season/init"),
            "marketconfig": log.find("/hot-market/config/init"),
            "marketpool": log.find("/hot-market/pool/init"),
            "preflight": log.find("preflight:mining-devnet"),
            "mining": log.find("-X POST http://mock-backend/admin/config/mining"),
            "collector": log.find("/admin/config/collector-mint"),
        }
        for name, index in positions.items():
            self.assertGreaterEqual(index, 0, f"{name} не вызван: {log}")
        self.assertEqual(sorted(positions.values()), list(positions.values()),
                         f"нарушен порядок шагов: {positions}")
        self.assertIn("historian", log)

    def test_build_runs_when_so_missing_and_anchor_present(self):
        for name in ("aof_core", "aof_market", "aof_session_keys"):
            (self.artifacts / f"{name}.so").unlink()
        done = self.run_script("--apply", env_overrides={
            "COLLECTOR_MINTS": f"{COLLECTOR_MINT}:medallion",
        })
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        log = "\n".join(self.log())
        self.assertIn("anchor build", log)
        self.assertLess(log.find("anchor build"), log.find("@@deploy"))
        self.assertTrue((self.artifacts / "aof_core.so").exists())

    def test_preflight_blocked_never_turns_mining_on(self):
        done = self.run_script("--apply", env_overrides={"MOCK_PREFLIGHT_BLOCKED": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("BLOCKED", done.stderr)
        self.assertEqual(
            [line for line in self.posts() if "-X POST" in line and "/mining" in line], [])

    def test_unknown_collector_kind_refuses(self):
        done = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": f"{COLLECTOR_MINT}:bogus"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("historian", done.stderr)

    def test_market_step_is_idempotent_and_needs_real_mints(self):
        # Первый прогон: MarketConfig и пулы редкостей создаются.
        first = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(first.returncode, 0, first.stderr + first.stdout)
        self.assertEqual(len([l for l in self.market_posts() if "config/init" in l]), 1)
        self.assertEqual(len([l for l in self.market_posts() if "pool/init" in l]), 4,
                         "по умолчанию включаются четыре редкости пула")
        # Второй прогон: существующие аккаунты не пересоздаются (init упал бы).
        before = len(self.log())
        second = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(second.returncode, 0, second.stderr + second.stdout)
        fresh = [line for line in self.log()[before:]
                 if "curl" in line and "-X POST" in line and "/hot-market/" in line]
        self.assertEqual(fresh, [], "повторный прогон не должен создавать аккаунты заново")

    def test_craft_step_creates_economy_and_rarity_counters(self):
        done = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        craft = self.craft_posts()
        self.assertEqual(len([l for l in craft if "craft-economy/init" in l]), 1,
                         "CraftEconomy создаётся один раз")
        self.assertEqual(len([l for l in craft if "rarity-counter/init" in l]), 4,
                         "по умолчанию создаются счётчики редкостей 1..4")
        for rarity in ("1", "2", "3", "4"):
            self.assertIn(f'{{\"rarityIdx\":{rarity}}}', "\n".join(craft))
        # Крафт включается до тумблера добычи и до allowlist коллекционеров.
        log = "\n".join(self.log())
        self.assertLess(log.find("/admin/craft-economy/init"), log.find("preflight:mining-devnet"))
        self.assertLess(log.find("/admin/craft-economy/init"),
                        log.find("-X POST http://mock-backend/admin/config/mining"),
                        "крафт включается до тумблера добычи")

    def test_craft_step_is_idempotent(self):
        first = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(first.returncode, 0, first.stderr + first.stdout)
        before = len(self.log())
        second = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(second.returncode, 0, second.stderr + second.stdout)
        fresh = [line for line in self.log()[before:]
                 if "curl" in line and "-X POST" in line and "craft" in line]
        self.assertEqual(fresh, [], "повторный прогон не должен пересоздавать CraftEconomy и счётчики")
        self.assertIn("CraftEconomy уже инициализирован", second.stdout)

    def test_craft_failure_refuses(self):
        done = self.run_script("--apply", env_overrides={"MOCK_CRAFT_FAIL": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("CraftEconomy", done.stderr)

    def test_craft_rarity_out_of_range_refuses(self):
        done = self.run_script("--apply", env_overrides={"CRAFT_RARITY_COUNTERS": "5"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("1..4", done.stderr)

    def test_skip_craft_leaves_craft_closed(self):
        done = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": "", "SKIP": "craft"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.craft_posts(), [])
        self.assertIn("SKIP=craft", done.stdout)

    def test_mechanics_step_configures_packs_lottery_season_reroll(self):
        done = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        posts = self.mechanics_posts()
        self.assertEqual(len([l for l in posts if "/packs/config/init" in l]), 3,
                         "три типа паков: small/medium/big")
        self.assertEqual(len([l for l in posts if "/reroll/config/init" in l]), 1)
        self.assertEqual(len([l for l in posts if "/lottery/round/init" in l]), 1)
        self.assertEqual(len([l for l in posts if "/season/init" in l]), 1)
        log = "\n".join(posts)
        # Цены и шансы — канонические, из aof-core/src/constants.rs.
        for expected in ('"priceLamports":"100000000"', '"priceLamports":"300000000"',
                         '"priceLamports":"1000000000"', "[6000,3200,700,100,0]",
                         "[5000,3500,1000,500,0]", "[3500,4000,1500,1000,0]",
                         "[5500,3000,1100,400,0]", '\"roundId\":\"1\"'):
            self.assertIn(expected, log)
        whole = "\n".join(self.log())
        self.assertLess(whole.find("/packs/config/init"),
                        whole.find("-X POST http://mock-backend/admin/config/mining"),
                        "конфиги механик включаются до тумблера добычи")
        self.assertLess(whole.find("/season/init"), whole.find("/hot-market/config/init"),
                        "шаг 6 идёт до рынка (шаг 7)")

    def test_mechanics_step_is_idempotent(self):
        first = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(first.returncode, 0, first.stderr + first.stdout)
        before = len(self.log())
        second = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": ""})
        self.assertEqual(second.returncode, 0, second.stderr + second.stdout)
        fresh = [line for line in self.log()[before:] if "curl" in line and "-X POST" in line
                 and ("/packs/config" in line or "/reroll/config" in line
                      or "/lottery/round" in line or "/season/init" in line)]
        self.assertEqual(fresh, [], "повторный прогон не пересоздаёт конфиги механик")
        for message in ("пак small уже настроен", "конфиг реролла уже есть",
                        "раунд лотереи 1 уже создан", "сезон 1 уже создан"):
            self.assertIn(message, second.stdout)

    def test_mechanics_failure_refuses(self):
        done = self.run_script("--apply", env_overrides={"MOCK_MECHANICS_FAIL": "1"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("не настроен", done.stderr)

    def test_skip_mechanics_leaves_configs_unset(self):
        done = self.run_script("--apply", env_overrides={"COLLECTOR_MINTS": "", "SKIP": "mechanics"})
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(self.mechanics_posts(), [])
        self.assertIn("SKIP=mechanics", done.stdout)

    def test_market_refuses_without_currency_addresses(self):
        # Валюты пула необратимы: без явных адресов шаг отказывает, а не угадывает.
        done = self.run_script("--apply", env_overrides={
            "COLLECTOR_MINTS": "",
            "MARKET_CORE_MINT": "11111111111111111111111111111111",
        })
        self.assertEqual(done.returncode, 3)
        self.assertIn("валют", done.stderr.lower())
        self.assertEqual(self.market_posts(), [])

    def test_skip_backend_steps_needs_no_token(self):
        # SKIP=backend — сокращение: раньше приходилось перечислять имена, и легко
        # было забыть craft/mechanics/market, которые тоже ходят в backend.
        done = self.run_script("--apply", env_overrides={
            "ADMIN_TOKEN": "",
            "SKIP": "backend,report",
        })
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(len(self.deploys()), len(PROGRAMS), self.log())
        self.assertEqual(self.posts(), [])


DEVNET_GENESIS = mockrpc.DEVNET_GENESIS


class FakeBackend:
    """Настоящий HTTP-сервер на 127.0.0.1 в роли backend'а (только маршрут bootstrap-preflight).

    behavior:
      aof          — как настоящий backend: ops-токен, JSON по контракту aof.bootstrap-preflight v1;
      foreign-404  — посторонний сервис: на любой путь 404 «404 page not found»;
      old-backend  — старая сборка без маршрута: Express-подобный 404 «Cannot GET …»;
      foreign-json — посторонний сервис отвечает 200 JSON чужого формата;
      foreign-html — 200 HTML;
      legacy-400   — 400 с JSON-ошибкой (то, что раньше возвращал GET /mining до деплоя);
      rpc-down     — 502 BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE: backend жив, но сам не читает сеть
                     (реальный случай: в .env остался публичный/старый RPC_URL).
    Состояние берётся из файлов, которые пишут моки solana/npx: после первого --apply повторный
    запуск видит развёрнутые программы и созданный Config.
    """

    def __init__(self, chain_dir, config_marker, *, token="mock-token", behavior="aof", mode="hot", can_sign=True,
                 authority=CORE_ADDRESS, genesis=DEVNET_GENESIS, program_ids=None):
        self.chain_dir, self.config_marker = chain_dir, config_marker
        self.token, self.behavior, self.mode, self.can_sign = token, behavior, mode, can_sign
        self.authority, self.genesis, self.program_ids = authority, genesis, dict(program_ids or {})
        self.requests = []
        self._server = None

    def payload(self):
        programs = {}
        for name, address in PROGRAMS:
            programs[name] = {"programId": self.program_ids.get(name, address),
                              "deployed": (self.chain_dir / f"{address}.json").exists(), "anomaly": None}
        return {"kind": "aof.bootstrap-preflight", "schemaVersion": 1, "service": "aof-backend",
                "authority": {"pubkey": self.authority, "mode": self.mode, "canSign": self.can_sign},
                "rpc": {"genesisHash": self.genesis, "expectedGenesisHash": None, "genesisMatchesExpected": None},
                "programs": programs,
                "config": {"pda": "ConfigPda11111111111111111111111111111111111", "exists": self.config_marker.exists(),
                           "anomaly": None}}

    def __enter__(self):
        backend = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                return

            def _reply(self, status, body, content_type="application/json"):
                data = body if isinstance(body, bytes) else json.dumps(body).encode()
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def _handle(self, method):
                backend.requests.append({"method": method, "path": self.path,
                                         "auth": self.headers.get("Authorization", "")})
                if backend.behavior == "foreign-404":
                    return self._reply(404, b"404 page not found\n", "text/plain")
                if backend.behavior == "old-backend" and self.path.startswith("/admin/config/bootstrap-preflight"):
                    return self._reply(404, f"<pre>Cannot {method} {self.path}</pre>".encode(), "text/html")
                if backend.behavior == "foreign-json":
                    return self._reply(200, {"hello": "world"})
                if backend.behavior == "foreign-html":
                    return self._reply(200, b"<html><body>It works!</body></html>", "text/html")
                if backend.behavior == "legacy-400":
                    return self._reply(400, {"error": "Account does not exist or has no data"})
                if backend.behavior == "rpc-down" and self.path.startswith("/admin/config/bootstrap-preflight"):
                    return self._reply(502, {"error": "BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE"})
                if method != "GET" or self.path != "/admin/config/bootstrap-preflight":
                    return self._reply(404, {"error": "Not found"})
                if self.headers.get("Authorization", "") != f"Bearer {backend.token}":
                    return self._reply(401, {"error": "Admin authentication required"})
                return self._reply(200, backend.payload())

            def do_GET(self):  # noqa: N802
                self._handle("GET")

            def do_POST(self):  # noqa: N802
                self._handle("POST")

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self._server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True).start()
        return self

    @property
    def url(self):
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def __exit__(self, *_exc):
        self._server.shutdown()
        self._server.server_close()


class BootstrapPreflight(BringupBase):
    """Первый запуск с нуля: до деплоя Config нет, и это не причина отказа, но любая подмена — причина."""

    def backend(self, **kwargs):
        backend = FakeBackend(self.chain, self.config_marker, **kwargs)
        self.addCleanup(backend.__exit__, None, None, None)
        return backend.__enter__()

    def run_with(self, backend_url, *extra, **env):
        overrides = {"BACKEND_URL": backend_url, "COLLECTOR_MINTS": "", "FAKE_BACKEND_URL": ""}
        overrides.update(env)
        return self.run_script(*extra, env_overrides=overrides)

    def assert_refused_before_any_transaction(self, done, needle):
        self.assertEqual(done.returncode, 3, done.stdout + done.stderr)
        self.assertIn(needle, done.stderr)
        self.assertEqual(self.deploys(), [], "отказ обязан случиться до деплоя")
        self.assertEqual([l for l in self.log() if l.startswith("npx") or "-X POST" in l], [],
                         "ни одной транзакции и ни одного POST")

    # 1. backend не запущен
    def test_backend_offline_refuses(self):
        with FakeBackend(self.chain, self.config_marker) as dead:
            url = dead.url
        done = self.run_with(url, "--apply")
        self.assert_refused_before_any_transaction(done, "backend недоступен")
        self.assertIn("curl завершился с кодом", done.stderr)

    # 2. на порту посторонний HTTP-сервис — в том числе такой, что отвечает «успехом» или «400, как раньше»
    def test_foreign_http_service_refuses(self):
        expectations = {
            "foreign-404": "нет /admin/config/bootstrap-preflight",
            "old-backend": "нет /admin/config/bootstrap-preflight",
            "foreign-json": "не похож на bootstrap-preflight",
            "foreign-html": "не похож на bootstrap-preflight",
            "legacy-400": "HTTP 400",
        }
        for behavior, needle in expectations.items():
            backend = self.backend(behavior=behavior)
            done = self.run_with(backend.url, "--apply")
            self.assert_refused_before_any_transaction(done, needle)

    def test_backend_with_a_dead_rpc_names_how_to_check_it(self):
        # 502 BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE значит «backend жив, но сам не читает сеть».
        # Сообщение обязано вести к /ready и к тому, что dotenv не перезаписывает
        # уже заданные переменные окружения (backend не перезапускался после правки .env).
        backend = self.backend(behavior="rpc-down")
        done = self.run_with(backend.url, "--apply")
        self.assert_refused_before_any_transaction(done, "BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE")
        self.assertIn("/ready", done.stderr)
        self.assertIn("dotenv", done.stderr)
        self.assertIn("rpcEndpoint", done.stderr)
        self.assertIn("dev-local.sh up", done.stderr)

    def test_http_400_is_never_accepted_as_ready(self):
        # Корень исходной проблемы: «принять любой 400» пропустило бы и чужой сервис, и неверный токен.
        backend = self.backend(behavior="legacy-400")
        done = self.run_with(backend.url)
        self.assertEqual(done.returncode, 3, done.stdout)
        self.assertNotIn("backend проверен", done.stdout)

    # 3. неверный токен
    def test_wrong_token_refuses(self):
        backend = self.backend(token="the-real-token")
        done = self.run_with(backend.url, "--apply", ADMIN_TOKEN="a-different-token")
        self.assert_refused_before_any_transaction(done, "backend отклонил ADMIN_TOKEN (HTTP 401)")
        self.assertNotIn("a-different-token", done.stdout + done.stderr, "токен не печатается")

    # 4. backend в read-only режиме
    def test_read_only_backend_refuses(self):
        backend = self.backend(mode="read-only", can_sign=False)
        done = self.run_with(backend.url, "--apply")
        self.assert_refused_before_any_transaction(done, "не в hot-режиме подписи")
        self.assertIn("mode=read-only", done.stderr)

    # 5. authority backend'а не равна ключу оператора
    def test_wrong_authority_refuses(self):
        backend = self.backend(authority=dict(PROGRAMS)["aof_market"])
        done = self.run_with(backend.url, "--apply")
        self.assert_refused_before_any_transaction(done, "не совпадает с ключом оператора")
        self.assertIn(CORE_ADDRESS, done.stderr)

    # 6. program ID backend'а расходится с реестром
    def test_wrong_program_id_refuses(self):
        for name in ("aof_core", "aof_session_keys"):
            backend = self.backend(program_ids={name: "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T"})
            done = self.run_with(backend.url, "--apply")
            self.assert_refused_before_any_transaction(done, "а в реестре")
            self.assertIn(name, done.stderr)

    # mainnet: и RPC самого скрипта, и RPC backend'а
    def test_mainnet_rpc_of_the_script_refuses_before_the_backend_is_asked(self):
        backend = self.backend()
        self.rpc.genesis = mockrpc.MAINNET_GENESIS
        done = self.run_with(backend.url, "--apply")
        self.assert_refused_before_any_transaction(done, "не подтверждён как devnet")
        self.assertEqual(backend.requests, [], "до backend'а дело не дошло")

    def test_mainnet_rpc_of_the_backend_refuses(self):
        backend = self.backend(genesis=mockrpc.MAINNET_GENESIS)
        done = self.run_with(backend.url, "--apply")
        self.assert_refused_before_any_transaction(done, "не devnet")

    # 7. программ и Config нет — именно здесь старая проверка (строгий 200 на /mining) упиралась в замкнутый круг
    def test_fresh_network_without_programs_and_config_proceeds(self):
        backend = self.backend()
        dry = self.run_with(backend.url)
        self.assertEqual(dry.returncode, 0, dry.stdout + dry.stderr)
        self.assertIn("в сети программ: 0 из 6", dry.stdout)
        self.assertIn("Config: ещё нет", dry.stdout)
        self.assertEqual(self.deploys(), [])
        applied = self.run_with(backend.url, "--apply")
        self.assertEqual(applied.returncode, 0, applied.stdout + applied.stderr)
        self.assertEqual(len(self.deploys()), len(PROGRAMS))
        self.assertTrue(any("scripts/initConfig.ts" in l for l in self.log()))
        # старая проверка не вернулась: GET /admin/config/mining раньше первого деплоя больше не нужен
        log = "\n".join(self.log())
        before_deploy = log[:log.index("@@deploy")]
        self.assertNotIn("/admin/config/mining", before_deploy)
        self.assertEqual([r["method"] for r in backend.requests], ["GET", "GET"], "только чтение preflight")
        self.assertTrue(all(r["path"] == "/admin/config/bootstrap-preflight" for r in backend.requests))

    # 8. программы уже есть, Config нет
    def test_programs_deployed_but_no_config_proceeds_to_initialize(self):
        for _, address in PROGRAMS:
            (self.chain / f"{address}.json").write_text("{}", encoding="utf-8")
        backend = self.backend()
        done = self.run_with(backend.url, "--apply")
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("в сети программ: 6 из 6", done.stdout)
        self.assertIn("Config: ещё нет", done.stdout)
        self.assertEqual(self.deploys(), [], "развёрнутые программы не передеплоиваются")
        self.assertEqual(len([l for l in self.log() if "scripts/initConfig.ts" in l]), 1)

    # 9. Config уже инициализирован
    def test_initialized_config_is_not_recreated(self):
        for _, address in PROGRAMS:
            (self.chain / f"{address}.json").write_text("{}", encoding="utf-8")
        self.config_marker.write_text("", encoding="utf-8")
        backend = self.backend()
        done = self.run_with(backend.url, "--apply")
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("Config: есть", done.stdout)
        self.assertIn("Config уже инициализирован", done.stdout)
        self.assertEqual([l for l in self.log() if "scripts/initConfig.ts" in l], [])
        self.assertEqual(self.deploys(), [])

    # 10. повторный запуск идемпотентен
    def test_repeated_run_is_idempotent(self):
        backend = self.backend()
        first = self.run_with(backend.url, "--apply")
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        self.assertEqual(len(self.deploys()), len(PROGRAMS))
        self.assertTrue(self.config_marker.exists(), "первый запуск создал Config")
        made = len(self.log())
        second = self.run_with(backend.url, "--apply")
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        fresh = self.log()[made:]
        self.assertEqual([l for l in fresh if l.startswith("@@deploy")], [], "программы не передеплоены")
        self.assertEqual([l for l in fresh if "scripts/initConfig.ts" in l], [], "Config не пересоздаётся")
        self.assertEqual([l for l in fresh if "-X POST" in l and "/admin/config/mining" not in l
                          and "/admin/config/collector-mint" not in l], [],
                         "никаких повторных POST шагов 5–7 (их состояние уже есть)")
        self.assertIn("в сети программ: 6 из 6", second.stdout)
        self.assertIn("Config: есть", second.stdout)
        self.assertIn("деплоить нечего", second.stdout)
        self.assertEqual([r["method"] for r in backend.requests], ["GET", "GET"])

    def test_skip_backend_steps_never_calls_the_preflight(self):
        backend = self.backend()
        done = self.run_script("--apply", env_overrides={
            "BACKEND_URL": backend.url, "ADMIN_TOKEN": "", "FAKE_BACKEND_URL": "",
            "SKIP": "backend,report"})
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertEqual(backend.requests, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
