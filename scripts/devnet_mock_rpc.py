#!/usr/bin/env python3
"""Поддельный JSON-RPC узел Solana ТОЛЬКО для офлайн-тестов (не для запуска владельцем).

Нужен трём наборам тестов — оценщику стоимости, `deploy-devnet.sh` и
`devnet-bringup.sh`: все они ходят в RPC, а тесты не должны зависеть от сети и
не должны подменять сам оценщик. Поэтому здесь настоящий HTTP-сервер на
127.0.0.1, который отвечает ровно теми же методами и формами, что узел:

    getMinimumBalanceForRentExemption  (128 + длина) * ставка — ставка задаётся тестом
    getBalance, getLatestBlockhash, getGenesisHash
    getFeeForMessage                   РАЗБИРАЕТ legacy-сообщение; битое — null
    getAccountInfo                     аккаунты теста + программы из chain_dir
    getProgramAccounts                 buffer-аккаунты с фильтрами memcmp

Ставка за байт здесь — параметр теста, а не знание оценщика: оценщик обязан
получать её из ответов, поэтому тесты гоняют его с 6960, 5080 и 696.
"""
from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import struct
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Dict, List, Optional

LOADER = "BPFLoaderUpgradeab1e11111111111111111111111"
DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
TESTNET_GENESIS = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY"
LOCAL_GENESIS = "LocalValidatorGenesis1111111111111111111111111"
ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(raw: bytes) -> str:
    number = int.from_bytes(raw, "big")
    out = ""
    while number:
        number, remainder = divmod(number, 58)
        out = ALPHABET[remainder] + out
    return "1" * (len(raw) - len(raw.lstrip(b"\x00"))) + out


def b58decode(text: str) -> bytes:
    number = 0
    for char in text:
        number = number * 58 + ALPHABET.index(char)
    body = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\x00" * (len(text) - len(text.lstrip("1"))) + body


def fake_so(address: str, size: int = 4096) -> bytes:
    """Файл, похожий на собранную программу: ELF-магия + зашитый адрес + заполнение."""
    body = b"\x7fELF" + b58decode(address).rjust(32, b"\x00")
    if size < len(body):
        raise ValueError("слишком мал для фикстуры")
    return body + b"\x00" * (size - len(body))


def read_shortvec(raw: bytes, pos: int):
    value = 0
    shift = 0
    while True:
        if pos >= len(raw):
            return None
        byte = raw[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7
        if shift > 14:
            return None


def parse_legacy_message(raw: bytes) -> Optional[int]:
    """Число обязательных подписей, если сообщение разобралось ровно до конца, иначе None."""
    if len(raw) < 3:
        return None
    n_sigs, n_ro_signed, _n_ro_unsigned = raw[0], raw[1], raw[2]
    parsed = read_shortvec(raw, 3)
    if not parsed:
        return None
    n_keys, pos = parsed
    pos += 32 * n_keys + 32  # ключи и blockhash
    if n_sigs < 1 or n_sigs > n_keys or n_ro_signed >= n_sigs or pos > len(raw):
        return None
    parsed = read_shortvec(raw, pos)
    if not parsed:
        return None
    n_ix, pos = parsed
    for _ in range(n_ix):
        if pos >= len(raw):
            return None
        program_index = raw[pos]
        pos += 1
        if program_index >= n_keys:
            return None
        parsed = read_shortvec(raw, pos)
        if not parsed:
            return None
        n_accounts, pos = parsed
        if pos + n_accounts > len(raw) or any(i >= n_keys for i in raw[pos:pos + n_accounts]):
            return None
        pos += n_accounts
        parsed = read_shortvec(raw, pos)
        if not parsed:
            return None
        n_data, pos = parsed
        pos += n_data
        if pos > len(raw):
            return None
    return n_sigs if pos == len(raw) else None


class MockRpc:
    """Запуск: `with MockRpc(...) as rpc:`; `rpc.url`, `rpc.requests`, `rpc.methods()`."""

    def __init__(self, *, lamports_per_byte: int = 5080, lamports_per_signature: int = 5000,
                 genesis: str = DEVNET_GENESIS, balances: Optional[Dict[str, int]] = None,
                 accounts: Optional[Dict[str, Dict[str, Any]]] = None,
                 chain_dir: Optional[pathlib.Path] = None,
                 buffers: Optional[List[Dict[str, Any]]] = None,
                 history: Optional[List[Dict[str, Any]]] = None,
                 rent_fn: Optional[Callable[[int], int]] = None,
                 broken: Optional[Dict[str, str]] = None) -> None:
        self.lamports_per_byte = lamports_per_byte
        self.lamports_per_signature = lamports_per_signature
        self.genesis = genesis
        self.balances = dict(balances or {})
        self.accounts = dict(accounts or {})
        self.chain_dir = chain_dir
        self.buffers = list(buffers or [])
        # история транзакций плательщика (локальный валидатор): [{signature, slot, fee, accountKeys, pre, post, err}], старые первыми
        self.history = list(history or [])
        self.rent_fn = rent_fn
        self.broken = dict(broken or {})  # метод -> http500 | badjson | error | noresult | null
        self.requests: List[Dict[str, Any]] = []
        self._server: Optional[ThreadingHTTPServer] = None

    # --- состояние цепочки из chain_dir (его пишет поддельный `solana program deploy`) ---
    @staticmethod
    def programdata_address(program: str) -> str:
        return b58encode(hashlib.sha256(b"programdata:" + program.encode()).digest())

    def _deployed(self) -> Dict[str, Dict[str, Any]]:
        found: Dict[str, Dict[str, Any]] = {}
        if self.chain_dir and self.chain_dir.exists():
            for path in self.chain_dir.glob("*.json"):
                found[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        return found

    def _account(self, address: str) -> Optional[Dict[str, Any]]:
        if address in self.accounts:
            return self.accounts[address]
        for program, state in self._deployed().items():
            programdata = self.programdata_address(program)
            if address == program:
                return {"lamports": 1_000_000, "owner": LOADER, "executable": True,
                        "data": struct.pack("<I", 2) + b58decode(programdata).rjust(32, b"\x00")}
            if address == programdata:
                elf = pathlib.Path(state["so"]).read_bytes()
                if state.get("corrupt"):
                    elf = b"\x00" + elf[1:]
                authority = b58decode(state["authority"]).rjust(32, b"\x00")
                body = elf + b"\x00" * (state["max_len"] - len(elf))
                return {"lamports": 5_000_000, "owner": LOADER, "executable": False,
                        "data": struct.pack("<IQB", 3, 7, 1) + authority + body}
        return None

    # --- обработка запросов ---
    def handle(self, method: str, params: list) -> Any:
        mode = self.broken.get(method)
        if mode == "error":
            return {"__error__": {"code": -32000, "message": "mock: узел отклонил запрос"}}
        if mode == "noresult":
            return {"__noresult__": True}
        if mode == "null":
            return {"context": {"slot": 1}, "value": None}
        if method == "getMinimumBalanceForRentExemption":
            length = int(params[0])
            return self.rent_fn(length) if self.rent_fn else (128 + length) * self.lamports_per_byte
        if method == "getBalance":
            return {"context": {"slot": 1}, "value": self.balances.get(params[0], 0)}
        if method == "getLatestBlockhash":
            return {"context": {"slot": 1}, "value": {"blockhash": b58encode(bytes(range(32))), "lastValidBlockHeight": 150}}
        if method == "getGenesisHash":
            return self.genesis
        if method == "getFeeForMessage":
            signatures = parse_legacy_message(base64.b64decode(params[0]))
            return {"context": {"slot": 1}, "value": None if signatures is None else signatures * self.lamports_per_signature}
        if method == "getAccountInfo":
            info = self._account(params[0])
            if info is None:
                return {"context": {"slot": 1}, "value": None}
            data = info["data"]
            config = params[1] if len(params) > 1 and isinstance(params[1], dict) else {}
            window = config.get("dataSlice")
            sliced = data[window["offset"]:window["offset"] + window["length"]] if window else data
            return {"context": {"slot": 1}, "value": {
                "lamports": info["lamports"], "owner": info["owner"], "executable": info["executable"],
                "rentEpoch": 0, "space": len(data), "data": [base64.b64encode(sliced).decode(), "base64"]}}
        if method == "getSignaturesForAddress":
            rows = [{"signature": t["signature"], "slot": t["slot"], "err": t.get("err"), "memo": None, "blockTime": None}
                    for t in reversed(self.history)]  # RPC отдаёт новые первыми
            return rows
        if method == "getTransaction":
            for t in self.history:
                if t["signature"] == params[0]:
                    return {"slot": t["slot"], "blockTime": None,
                            "transaction": {"signatures": [t["signature"]], "message": {"accountKeys": t["accountKeys"]}},
                            "meta": {"err": t.get("err"), "fee": t["fee"], "preBalances": t["pre"], "postBalances": t["post"]}}
            return None
        if method == "getProgramAccounts":
            config = params[1] if len(params) > 1 else {}
            authority = None
            for flt in config.get("filters", []):
                memcmp = flt.get("memcmp", {})
                if memcmp.get("offset") == 5:
                    authority = memcmp.get("bytes")
            return [{"pubkey": b["address"], "account": {"lamports": b["lamports"], "owner": LOADER,
                                                         "executable": False, "rentEpoch": 0,
                                                         "data": ["", "base64"], "space": 0}}
                    for b in self.buffers if authority is None or b["authority"] == authority]
        return {"__error__": {"code": -32601, "message": f"mock: метод {method} не поддерживается"}}

    def methods(self) -> List[str]:
        return [r["method"] for r in self.requests]

    # --- сервер ---
    def __enter__(self) -> "MockRpc":
        mock = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args: Any) -> None:  # тишина в выводе тестов
                return

            def do_POST(self) -> None:  # noqa: N802 (имя задано http.server)
                length = int(self.headers.get("Content-Length", "0"))
                request = json.loads(self.rfile.read(length) or b"{}")
                mock.requests.append({"method": request.get("method"), "params": request.get("params")})
                method = request.get("method", "")
                mode = mock.broken.get(method)
                # http500 / http401 / http403 / http429 … — сколько провайдеры реально отдают
                if mode and mode.startswith("http") and mode[4:].isdigit():
                    self.send_response(int(mode[4:]))
                    self.end_headers()
                    return
                if mode == "badjson":
                    self._send(b"<html>not json</html>")
                    return
                result = mock.handle(method, request.get("params") or [])
                if isinstance(result, dict) and "__error__" in result:
                    body = {"jsonrpc": "2.0", "id": request.get("id"), "error": result["__error__"]}
                elif isinstance(result, dict) and "__noresult__" in result:
                    body = {"jsonrpc": "2.0", "id": request.get("id")}
                else:
                    body = {"jsonrpc": "2.0", "id": request.get("id"), "result": result}
                self._send(json.dumps(body).encode())

            def _send(self, payload: bytes) -> None:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self._server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True).start()
        return self

    @property
    def url(self) -> str:
        assert self._server is not None
        return f"http://127.0.0.1:{self._server.server_address[1]}"

    def __exit__(self, *_exc: Any) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
