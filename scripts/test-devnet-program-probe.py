#!/usr/bin/env python3
"""Офлайн-проверка читающего зонда `scripts/devnet-program-probe.py`.

Зонд — это то место, откуда берутся утверждения о состоянии сети, поэтому он сам
должен быть проверяемым без сети. Здесь поддельный RPC: он отдаёт ровно те
аккаунты, что описаны в сценарии, и применяет к ним те же фильтры и срезы, что
настоящий узел.

Сценарии:
  1. ничего не задеплоено — зонд обязан это сказать, а не выдумать «включено»;
  2. программы есть, Config есть, но адреса ресурсов не заданы и тумблер добычи
     выключен — «Ремонт» и «Добыча» обязаны быть «выключено» с причиной;
  3. всё включено — те же строки обязаны стать «включено», а механики, закрытые
     в коде (пул горячего рынка, сессионные ключи), — остаться «выключено».

Плюс проверяется, что base58-фильтр по дискриминатору Anchor действительно
содержит sha256("account:<Имя>")[:8]: без этого RPC вернул бы чужие аккаунты.

Запуск: python3 scripts/test-devnet-program-probe.py
"""
from __future__ import annotations

import base64
import hashlib
import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROBE = ROOT / "scripts" / "devnet-program-probe.py"

spec = importlib.util.spec_from_file_location("devnet_probe", PROBE)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

ALPHABET = probe.BASE58_ALPHABET
LOADER = probe.LOADER


def b58_decode(text: str) -> bytes:
    number = 0
    for char in text:
        number = number * 58 + ALPHABET.index(char)
    raw = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\x00" * (len(text) - len(text.lstrip("1"))) + raw


def b58_encode(raw: bytes) -> str:
    return probe.b58(raw)


PROGRAMS = {
    "aof_core": "Core111111111111111111111111111111111111111",
    "aof_market": "Market11111111111111111111111111111111111111",
    "aof_session_keys": "Session1111111111111111111111111111111111111",
    "aof_rebirth": "Rebirth111111111111111111111111111111111111",
    "aof_quests": "Quests1111111111111111111111111111111111111",
    "aof_liquidity": "Liquidity1111111111111111111111111111111111",
}
REGISTRY = {
    "network": "devnet-test",
    "programs": [{"name": name, "address": address} for name, address in PROGRAMS.items()],
}

CONFIG_LEN = 8 + 412
CONFIG_DEFAULTS = "11111111111111111111111111111111"


def account_blob(account_name: str, size: int = 64) -> bytes:
    return probe.discriminator(account_name) + bytes(size)


def config_blob(*, mining: bool, wood: str = CONFIG_DEFAULTS, stone: str = CONFIG_DEFAULTS,
                paused: bool = False) -> bytes:
    data = bytearray(account_blob("Config", CONFIG_LEN - 8))
    data[probe.CONFIG_PAUSED_OFFSET] = 1 if paused else 0
    data[probe.CONFIG_MINING_OFFSET] = 1 if mining else 0
    for offset, address in ((probe.CONFIG_WOOD_MINT_OFFSET, wood), (probe.CONFIG_STONE_MINT_OFFSET, stone)):
        raw = b58_decode(address)
        data[offset:offset + len(raw)] = raw
    return bytes(data)


class FakeRpc:
    """Поддельный узел: отдаёт аккаунты сценария и уважает filters/dataSlice."""

    def __init__(self, accounts: dict[str, list[bytes]], *, programs_deployed: bool = True):
        # accounts: {program_name: [raw_data, ...]}
        self.accounts = accounts
        self.programs_deployed = programs_deployed
        self.calls: list[tuple[str, list]] = []

    def __call__(self, rpc: str, method: str, params: list) -> dict:
        self.calls.append((method, params))
        if method == "getGenesisHash":
            return {"result": "genesis-test"}
        if method == "getAccountInfo":
            address = params[0]
            if not self.programs_deployed:
                return {"result": {"value": None}}
            if address not in PROGRAMS.values():
                return {"result": {"value": None}}
            return {"result": {"value": {"executable": True, "owner": LOADER,
                                         "data": [base64.b64encode(b"\x02\x00\x00\x00").decode(), "base64"]}}}
        if method == "getProgramAccounts":
            address, config = params[0], params[1]
            name = next((n for n, a in PROGRAMS.items() if a == address), None)
            rows = self.accounts.get(name, []) if self.programs_deployed else []
            match = []
            for blob in rows:
                ok = True
                for flt in config.get("filters", []):
                    expected = flt["memcmp"]
                    offset = expected["offset"]
                    want = b58_decode(expected["bytes"])
                    if blob[offset:offset + len(want)] != want:
                        ok = False
                        break
                if ok:
                    match.append(blob)
            out = []
            for index, blob in enumerate(match):
                chunk = blob
                if "dataSlice" in config:
                    offset = config["dataSlice"]["offset"]
                    length = config["dataSlice"]["length"]
                    chunk = blob[offset:offset + length]
                out.append({
                    "pubkey": b58_encode(hashlib.sha256(b"key%d" % index).digest()),
                    "account": {"data": [base64.b64encode(chunk).decode(), "base64"], "owner": address},
                })
            return {"result": out}
        return {"error": {"message": f"unsupported method {method}"}}


def rows_for(fake: FakeRpc) -> dict[str, dict]:
    return {row["name"]: row for row in probe.mechanics("fake://", REGISTRY, call_fn=fake)}


def check(condition: bool, message: str) -> None:
    if not condition:
        print(f"  ✗ {message}")
        failures.append(message)


failures: list[str] = []


def scenario_empty() -> None:
    print("1. ничего не задеплоено")
    fake = FakeRpc({}, programs_deployed=False)
    rows = rows_for(fake)
    check(rows["Добыча инструментов"]["state"] == "выключено", "добыча без Config — выключено")
    check(rows["Ремонт инструментов"]["state"] == "выключено", "ремонт без Config — выключено")
    check(rows["Ресурсы и крафт"]["state"] == "выключено", "MaterialMints без программы — выключено")
    check(all(row["state"] != "включено" for row in rows.values()),
          "без программ ни одна механика не может быть «включено»")


def scenario_configured_partially() -> None:
    print("2. программы есть, конфиг пустой")
    fake = FakeRpc({"aof_core": [config_blob(mining=False)]})
    rows = rows_for(fake)
    check(rows["Добыча инструментов"]["state"] == "выключено", "тумблер добычи выключен в Config")
    check("mining_enabled=False" in rows["Добыча инструментов"]["evidence"],
          "причина выключенной добычи берётся из Config, а не из общего текста")
    check("bringup" in rows["Добыча инструментов"]["action"], "у выключенной добычи есть действие включения")
    check(rows["Ремонт инструментов"]["state"] == "выключено", "без адресов wood/stone ремонта нет")
    check("11111111" in rows["Ремонт инструментов"]["evidence"], "в доказательстве видны реальные адреса")
    check(rows["Ресурсы и крафт"]["state"] == "выключено", "нет ни одного MaterialMints")
    check(rows["Коллекционеры (allowlist)"]["state"] == "выключено", "allowlist пуст")

    paused = rows_for(FakeRpc({"aof_core": [config_blob(mining=True, paused=True)]}))
    check(paused["Общая пауза контракта"]["state"] == "выключено",
          "paused=true показывается отдельной строкой")
    check(paused["Добыча инструментов"]["state"] == "включено",
          "тумблер добычи читается независимо от паузы")


def scenario_everything_on() -> None:
    print("3. всё включено")
    wood = "Wood11111111111111111111111111111111111111"
    stone = "Stone1111111111111111111111111111111111"
    accounts = {
        "aof_core": [
            config_blob(mining=True, wood=wood, stone=stone),
            account_blob("MaterialMints"),
            account_blob("CraftEconomy"),
            account_blob("PackConfig"),
            account_blob("RerollConfig"),
            account_blob("Season"),
            account_blob("LotteryRound"),
            account_blob("CollectorAllowEntry"),
            account_blob("VaultGuard"),
            account_blob("Listing", size=73 + 8),
        ],
        "aof_market": [account_blob("MarketConfig"), account_blob("HotMarketPool")],
        "aof_session_keys": [account_blob("SkConfig")],
        "aof_rebirth": [account_blob("RebirthConfig")],
    }
    # Погашенный листинг: active=0 — фильтр по active=1 его не должен пропустить.
    inactive = bytearray(account_blob("Listing", size=80))
    inactive[probe.LISTING_ACTIVE_OFFSET] = 0
    accounts["aof_core"].append(bytes(inactive))
    active = bytearray(account_blob("Listing", size=80))
    active[probe.LISTING_ACTIVE_OFFSET] = 1
    accounts["aof_core"].append(bytes(active))

    rows = rows_for(FakeRpc(accounts))
    for title in ("Добыча инструментов", "Ремонт инструментов", "Ресурсы и крафт", "Экономика крафта",
                  "Капсулы дропа (паки)", "Реролл инструментов", "Сезоны и сезонный пропуск",
                  "Лотерея", "Коллекционеры (allowlist)", "Страж казны (VaultGuard)",
                  "Рынок инструментов (листинги)", "Перерождение"):
        check(rows[title]["state"] == "включено", f"{title}: должен быть включён")
    check("активных Listing: 1" in rows["Рынок инструментов (листинги)"]["evidence"],
          "в листингах считается только active=1")
    check(rows["Добыча инструментов"]["action"] == "", "у включённого нет подсказки «как включить»")

    # Закрытое в коде остаётся закрытым, даже когда конфиги на месте.
    check(rows["Сессионные ключи"]["state"] == "выключено",
          "сессионные ключи не могут стать «включено» до работы по контракту §3.3")
    check("AtomicBindingRequired" in rows["Сессионные ключи"]["evidence"]
          or "атомарной привязки" in rows["Сессионные ключи"]["evidence"],
          "у сессионных ключей названа настоящая причина")
    check(rows["Горячий рынок (пул)"]["state"] == "включено частично",
          "пул горячего рынка не выдаётся за рабочую торговлю")
    check("TradingDisabled" in rows["Горячий рынок (пул)"]["evidence"],
          "у горячего рынка названа причина: инструкции закрыты в коде")

    total = len(rows)
    on = sum(1 for row in rows.values() if row["state"] == "включено")
    check(on >= 12 and total >= 14, f"включено {on} из {total}: сводка не должна терять строки")


def check_filters_and_encoding() -> None:
    print("4. формат запросов к RPC")
    fake = FakeRpc({"aof_core": [config_blob(mining=True)]})
    probe.mechanics("fake://", REGISTRY, call_fn=fake)
    program_calls = [p for m, p in fake.calls if m == "getProgramAccounts"]
    check(program_calls, "зонд спрашивает аккаунты через getProgramAccounts")
    first = program_calls[0][1]["filters"][0]["memcmp"]
    check(b58_decode(first["bytes"]) == probe.discriminator("Config"),
          "фильтр по дискриминатору содержит sha256('account:Config')[:8] в base58")
    check(b58_decode("11111111111111111111111111111111") == bytes(32),
          "base58 → bytes: default-адрес разбирается в 32 нуля")
    check(probe.discriminator("Config") == hashlib.sha256(b"account:Config").digest()[:8],
          "дискриминатор Anchor считается по имени структуры")
    check(probe.LISTING_ACTIVE_OFFSET == 80, "смещение active в Listing = 80 (проверено по struct в state.rs)")


if __name__ == "__main__":
    scenario_empty()
    scenario_configured_partially()
    scenario_everything_on()
    check_filters_and_encoding()
    if failures:
        print(f"\nПРОВАЛ: {len(failures)} проверк(и)")
        for message in failures:
            print(f"  - {message}")
        sys.exit(1)
    print("\nOK: зонд читает состояние сети, а не предполагает его")
