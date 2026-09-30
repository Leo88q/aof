#!/usr/bin/env python3
"""Читающий зонд: что реально лежит на девнете по адресам из реестра.

Зачем. Владелец видит в игре «сеть не настроена», а понять, чего именно нет —
программы, минтов или конфига, — было нечем: из песочницы агента RPC недоступен,
а preflight печатает отчёт только в CI. Этот зонд отвечает на первый вопрос:
задеплоены ли шесть программ и кто их владелец-загрузчик.

Ничего не подписывает и не отправляет транзакций — только `getAccountInfo` и
`getGenesisHash`. Можно запускать и в CI, и локально:

    python3 scripts/devnet-program-probe.py [RPC_URL]

Код возврата 0 даже при отсутствии программ: это отчёт, а не гейт.
"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "watchtower" / "addresses.json"
DEFAULT_RPC = "https://api.devnet.solana.com"
LOADER = "BPFLoaderUpgradeab1e11111111111111111111111"


def call(rpc: str, method: str, params: list) -> dict:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    request = urllib.request.Request(rpc, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def main() -> int:
    rpc = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RPC
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))

    print(f"RPC: {rpc}")
    print(f"Реестр: network={registry.get('network')} (в репозитории это только адреса, не доказательство деплоя)")
    try:
        genesis = call(rpc, "getGenesisHash", []).get("result")
        print(f"genesis: {genesis}")
    except Exception as exc:  # сеть недоступна — это тоже ответ
        print(f"genesis: не прочитан ({exc})")
        return 0

    deployed = 0
    for entry in registry.get("programs", []):
        address = entry["address"]
        try:
            value = call(rpc, "getAccountInfo", [address, {"encoding": "base64"}]).get("result", {}).get("value")
        except Exception as exc:
            print(f"{entry['name']:16} {address}  -> ошибка чтения: {exc}")
            continue
        if value is None:
            print(f"{entry['name']:16} {address}  -> НЕТ АККАУНТА (программа не задеплоена)")
            continue
        deployed += 1
        owner = value.get("owner")
        size = len(value.get("data", [""])[0]) * 3 // 4
        note = "исполняемая" if value.get("executable") else "не исполняемая (данные, не программа)"
        loader = "loader совпадает" if owner == LOADER else "чужой владелец"
        print(f"{entry['name']:16} {address}  -> executable={value.get('executable')} owner={owner} "
              f"bytes={size} ({note}, {loader})")

    print()
    print(f"Итог: задеплоено {deployed} из {len(registry.get('programs', []))}.")
    print("Наличие аккаунта не доказывает, что байткод собран из этого репозитория:")
    print("для релиза нужен scripts/verify-programs.sh --require-bytecode и смоук-прогон.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
