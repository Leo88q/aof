#!/usr/bin/env python3
"""Self-test for `scripts/deploy-devnet.sh`.

The script is the only path that puts the missing programs on devnet, and the
failure it must prevent is unrecoverable in the wrong direction: deploying a
program into someone else's address, or deploying to mainnet by accident. A
runbook that is never exercised against a known-bad fixture is just another
unverified claim, so this drives the real shell script with a mocked `solana`
CLI and pins every refusal:

  * wrong target (mainnet)            -> refuse, no transactions
  * missing authority key             -> refuse, no transactions
  * zero balance                      -> refuse, no transactions
  * missing .so                       -> refuse, no transactions
  * program keypair != declared id    -> refuse, no transactions
  * program already on devnet         -> nothing to do, no transactions
  * dry run with everything present   -> prints the command, sends nothing
  * --apply with everything present   -> exactly one deploy, correct arguments

Run: python3 scripts/test-deploy-devnet.py
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
SCRIPT = HERE / "deploy-devnet.sh"
REGISTRY = json.loads((REPO / "watchtower" / "addresses.json").read_text(encoding="utf-8"))
CORE = next(p for p in REGISTRY["programs"] if p["name"] == "aof_core")
CORE_ID = CORE["address"]
OTHER_ID = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T"

MOCK_SOLANA = """#!/usr/bin/env bash
# Мок CLI: единственное, что здесь есть, — те команды, которые зовёт скрипт.
printf '%s\\n' "$*" >> "$MOCK_CALLS"
case "$1" in
  address) cat "$3";;
  balance) echo "${MOCK_BALANCE:-3} SOL";;
  account)
    for id in ${MOCK_PRESENT:-}; do [ "$id" = "$2" ] && exit 0; done
    exit 1;;
  *) [ "$1" = "program" ] && [ "$2" = "deploy" ] || exit 1
     echo "$*" >> "$MOCK_DEPLOY_LOG"
     [ "${MOCK_DEPLOY_FAIL:-0}" = "1" ] && exit 1
     exit 0;;
esac
"""


class DeployScript(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self.tmp.name)
        self.artifacts = self.dir / "deploy"
        self.artifacts.mkdir()
        (self.dir / "bin").mkdir()
        mock = self.dir / "bin" / "solana"
        mock.write_text(MOCK_SOLANA, encoding="utf-8")
        mock.chmod(0o755)
        (self.dir / "keypair.json").write_text(CORE_ID, encoding="utf-8")
        (self.artifacts / "aof_core.so").write_bytes(self.elf(CORE_ID))
        (self.artifacts / "aof_core-keypair.json").write_text(CORE_ID, encoding="utf-8")
        probe = self.dir / "probe.py"
        probe.write_text("import sys; print('ЗОНД: программы проверены')\n", encoding="utf-8")
        self.probe = probe
        self.calls = self.dir / "calls.log"
        self.deploys = self.dir / "deploys.log"

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def elf(address: str) -> bytes:
        """Минимальная «программа»: байты адреса там, где их ждёт declare_id!."""
        alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        value = 0
        for char in address:
            value = value * 58 + alphabet.index(char)
        return b"\x7fELF" + value.to_bytes(32, "big") + b"\x00" * 16

    def run_script(self, *extra: str, env_overrides: dict | None = None):
        env = dict(os.environ)
        env.update({
            "PATH": f"{self.dir / 'bin'}:{env['PATH']}",
            "AOF_DEPLOY_TARGET": "devnet",
            "AUTHORITY_KEYPAIR": str(self.dir / "keypair.json"),
            "ARTIFACTS": str(self.artifacts),
            "ONLY": "aof_core",
            "PROBE": str(self.probe),
            "MOCK_CALLS": str(self.calls),
            "MOCK_DEPLOY_LOG": str(self.deploys),
        })
        env.update(env_overrides or {})
        return subprocess.run(["bash", str(SCRIPT), *extra], capture_output=True, text=True,
                              env=env, cwd=str(REPO))

    def deploys_made(self) -> list[str]:
        return self.deploys.read_text(encoding="utf-8").splitlines() if self.deploys.exists() else []

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
