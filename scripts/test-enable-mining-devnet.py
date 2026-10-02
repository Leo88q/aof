#!/usr/bin/env python3
"""Self-test for `scripts/enable-mining-devnet.sh`.

The script is the only path that flips `Config.mining_enabled` for the game, and
the failure mode it exists to prevent is silent: enabling mining before the
payout mints exist burns tool durability with no payout. A runbook that is never
exercised against a known-bad fixture is just another unverified claim, so this
file drives the real shell script against a local mock of the admin API and pins
both directions:

  * healthy devnet state            -> dry-run prints the steps, makes no POST
  * healthy state + --apply         -> exactly one POST {"enabled": true}
  * already enabled                 -> no POST at all (idempotent)
  * placeholder circuitMint            -> refuse, no POST
  * MaterialMints not canonical 503 -> refuse, no POST
  * PREFLIGHT_OK not set            -> refuse, no POST
  * target is not devnet            -> refuse, no POST
  * admin token missing             -> refuse, no POST

Run: python3 scripts/test-enable-mining-devnet.py
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = HERE / "enable-mining-devnet.sh"
PLACEHOLDER = "11111111111111111111111111111111"

HEALTHY_CONFIG = {
    "circuitMint": "WooD1111111111111111111111111111111111111",
    "siliconMint": "StoNe111111111111111111111111111111111111",
}
HEALTHY_MATERIALS = {"dataset": "MeaT1111111111111111111111111111111111111",
                     "neuron": "SeeDs111111111111111111111111111111111111"}


class MockAdminApi:
    """Minimal stand-in for /admin/config/mining, /query/config, /query/material-mints."""

    def __init__(self, *, mining=False, config=None, materials=None,
                 materials_code=200, require_token=True):
        self.state = {
            "mining": mining,
            "config": dict(config if config is not None else HEALTHY_CONFIG),
            "materials": dict(materials if materials is not None else HEALTHY_MATERIALS),
            "materials_code": materials_code,
            "require_token": require_token,
        }
        self.posts: list[dict] = []
        outer = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, *_args):  # keep the test output clean
                pass

            def _send(self, code: int, payload: dict) -> None:
                body = json.dumps(payload).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def _authorised(self) -> bool:
                if not outer.state["require_token"]:
                    return True
                return self.headers.get("Authorization", "").startswith("Bearer ")

            def do_GET(self):  # noqa: N802
                if not self._authorised():
                    return self._send(401, {"error": "admin token required"})
                if self.path == "/admin/config/mining":
                    return self._send(200, {"miningEnabled": outer.state["mining"]})
                if self.path == "/query/config":
                    return self._send(200, outer.state["config"])
                if self.path == "/query/material-mints":
                    code = outer.state["materials_code"]
                    if code != 200:
                        return self._send(code, {"error": "RESOURCE_MINT_REGISTRY_UNAVAILABLE_OR_INVALID"})
                    return self._send(200, {"initialized": True, "mints": outer.state["materials"]})
                return self._send(404, {"error": "not found"})

            def do_POST(self):  # noqa: N802
                if not self._authorised():
                    return self._send(401, {"error": "admin token required"})
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b"{}"
                try:
                    body = json.loads(raw or b"{}")
                except json.JSONDecodeError:
                    return self._send(400, {"error": "bad json"})
                if self.path != "/admin/config/mining":
                    return self._send(404, {"error": "not found"})
                if not isinstance(body.get("enabled"), bool):
                    return self._send(400, {"error": "enabled must be a JSON boolean"})
                outer.posts.append(body)
                outer.state["mining"] = body["enabled"]
                return self._send(200, {"sig": "MOCKSIG", "enabled": body["enabled"]})

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_exc):
        self.server.shutdown()
        self.server.server_close()


def run_script(port: int, *extra: str, env_overrides: dict | None = None):
    env = dict(os.environ)
    env.update({
        "BASE_URL": f"http://127.0.0.1:{port}",
        "ADMIN_TOKEN": "test-token",
        "AOF_ENABLE_TARGET": "devnet",
        "PREFLIGHT_OK": "1",
    })
    env.update(env_overrides or {})
    return subprocess.run(["bash", str(SCRIPT), *extra], capture_output=True, text=True, env=env)


class EnableMiningScript(unittest.TestCase):
    def assert_no_posts(self, api: MockAdminApi) -> None:
        self.assertEqual(api.posts, [], "скрипт не должен отправлять POST при отказе")

    def test_healthy_dry_run_makes_no_changes(self):
        with MockAdminApi() as api:
            done = run_script(api.port)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assert_no_posts(api)
        self.assertIn("сухой прогон", done.stdout)
        self.assertIn("Config.circuitMint", done.stdout)
        self.assertIn("MaterialMints.neuron", done.stdout)

    def test_apply_enables_only_after_checks(self):
        with MockAdminApi() as api:
            done = run_script(api.port, "--apply")
            posts = list(api.posts)
            enabled = api.state["mining"]
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(posts, [{"enabled": True}], "ровно один POST на включение")
        self.assertTrue(enabled)
        self.assertIn("miningEnabled=true", done.stdout)
        # Порядок в выводе: проверка выплат идёт до включения.
        self.assertLess(done.stdout.index("Config.circuitMint"), done.stdout.index("5/6"))

    def test_already_enabled_is_idempotent(self):
        with MockAdminApi(mining=True) as api:
            done = run_script(api.port, "--apply")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assert_no_posts(api)
        self.assertIn("уже включена", done.stdout)

    def test_missing_payout_mint_blocks_switch(self):
        config = dict(HEALTHY_CONFIG, circuitMint=PLACEHOLDER)
        with MockAdminApi(config=config) as api:
            done = run_script(api.port, "--apply")
        self.assertEqual(done.returncode, 3, done.stderr)
        self.assert_no_posts(api)
        self.assertIn("circuitMint", done.stdout + done.stderr)

    def test_uninitialised_material_mints_block_switch(self):
        with MockAdminApi(materials_code=503) as api:
            done = run_script(api.port, "--apply")
        self.assertEqual(done.returncode, 3, done.stderr)
        self.assert_no_posts(api)
        self.assertIn("MaterialMints", done.stdout + done.stderr)

    def test_requires_preflight_confirmation(self):
        with MockAdminApi() as api:
            done = run_script(api.port, "--apply", env_overrides={"PREFLIGHT_OK": ""})
        self.assertEqual(done.returncode, 3)
        self.assert_no_posts(api)
        self.assertIn("PREFLIGHT_OK", done.stderr)

    def test_refuses_non_devnet_target(self):
        with MockAdminApi() as api:
            done = run_script(api.port, "--apply", env_overrides={"AOF_ENABLE_TARGET": "mainnet-beta"})
        self.assertEqual(done.returncode, 3)
        self.assert_no_posts(api)
        self.assertIn("devnet", done.stderr)

    def test_missing_admin_token_blocks_switch(self):
        with MockAdminApi() as api:
            done = run_script(api.port, "--apply", env_overrides={"ADMIN_TOKEN": ""})
        self.assertEqual(done.returncode, 3)
        self.assert_no_posts(api)
        self.assertIn("ADMIN_TOKEN", done.stderr)

    def test_rejects_unknown_argument(self):
        with MockAdminApi() as api:
            done = run_script(api.port, "--force")
        self.assertEqual(done.returncode, 2)
        self.assert_no_posts(api)


if __name__ == "__main__":
    unittest.main(verbosity=2)
