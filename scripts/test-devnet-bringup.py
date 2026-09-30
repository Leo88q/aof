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

Run: python3 scripts/test-devnet-bringup.py
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
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
  account) exit ${MOCK_ACCOUNT_CODE:-1};;
  *) [ "$1" = "program" ] && [ "$2" = "deploy" ] || exit 1
     echo "@@deploy $*" >> "$MOCK_CALLS"
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
  */query/config) echo "{\\"woodMint\\":\\"$MOCK_MINT\\",\\"stoneMint\\":\\"$MOCK_MINT\\"}";;
  */query/material-mints) echo "{\\"mints\\":{\\"meat\\":\\"$MOCK_MINT\\",\\"seeds\\":\\"$MOCK_MINT\\"}}";;
  *) echo '{"ok":true}';;
esac
exit 0
"""


class BringupScript(unittest.TestCase):
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
        self.probe = self.dir / "probe.py"
        self.probe.write_text(
            "import sys\nprint('ЗОНД: программы проверены')\n", encoding="utf-8")
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
            "PROBE": str(self.probe),
            "SKIP": "",
        })
        env.update(env_overrides or {})
        for key in ("AOF_DEPLOY_TARGET", "ADMIN_TOKEN", "SKIP", "COLLECTOR_MINTS"):
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

    def test_wrong_target_refuses_before_any_command(self):
        done = self.run_script(env_overrides={"AOF_DEPLOY_TARGET": "mainnet"})
        self.assertEqual(done.returncode, 3)
        self.assertIn("devnet", done.stderr)
        self.assertEqual(self.log(), [])

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

    def test_skip_backend_steps_needs_no_token(self):
        done = self.run_script("--apply", env_overrides={
            "ADMIN_TOKEN": "",
            "SKIP": "config,mints,caps,mining,collectors,report",
        })
        self.assertEqual(done.returncode, 0, done.stderr + done.stdout)
        self.assertEqual(len(self.deploys()), len(PROGRAMS), self.log())
        self.assertEqual(self.posts(), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
