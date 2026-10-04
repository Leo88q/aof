#!/usr/bin/env python3
"""Читающий зонд: что задеплоено и какие механики реально включены.

Зачем. Владелец видит в игре «сеть не настроена», а понять, чего именно нет —
программ, минтов, конфига или тумблера — было нечем: из песочницы агента RPC
недоступен, а preflight печатает отчёт только в CI. Зонд отвечает на два
вопроса сразу:

1. задеплоены ли шесть программ и кто их владелец-загрузчик;
2. какие механики включены ПРЯМО СЕЙЧАС — по состоянию аккаунтов в сети, а не по
   предположению: `Config.mining_enabled`, адреса ресурсов для ремонта,
   `MaterialMints`, паки, реролл, сезоны, лотерея, allowlist коллекционеров,
   листинги рынка, конфиги aof-market/aof-session-keys/aof-rebirth.

Ничего не подписывает и не отправляет транзакций — только `getAccountInfo`,
`getProgramAccounts` и `getGenesisHash`. Поэтому запускать можно и в CI, и
локально, и после каждого `--apply`:

    python3 scripts/devnet-program-probe.py [RPC_URL] [--json]

Утверждения о сети берутся отсюда и только отсюда: «включено» без строки в этом
отчёте — не факт.

Код возврата 0 даже при отсутствии программ: это отчёт, а не гейт. Логика
разбора проверяется офлайн: `python3 scripts/test-devnet-program-probe.py`.
"""
from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "watchtower" / "addresses.json"
DEFAULT_RPC = "https://api.devnet.solana.com"
LOADER = "BPFLoaderUpgradeab1e11111111111111111111111"
# Pubkey::default(): так выглядит «адрес не задан».
DEFAULT_PUBKEY = "11111111111111111111111111111111"

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

# Смещения полей в данных аккаунта ВКЛЮЧАЮТ 8-байтный дискриминатор Anchor, то
# есть считаются от начала данных, как их отдаёт RPC.
CONFIG_PAUSED_OFFSET = 8 + 272
CONFIG_MINING_OFFSET = 8 + 274
CONFIG_CIRCUIT_MINT_OFFSET = 8 + 96
CONFIG_SILICON_MINT_OFFSET = 8 + 128
LISTING_ACTIVE_OFFSET = 8 + 72


def b58(raw: bytes) -> str:
    """base58 — формат, который Solana RPC ждёт в memcmp-фильтрах.

    Ведущие нулевые байты кодируются ведущими '1'; их число считается по сырым
    байтам, и лишняя '1' за число не добавляется — иначе default-адрес
    (32 нулевых байта) выходил бы 33 символами и не совпадал ни с чем.
    """
    number = int.from_bytes(raw, "big")
    out = ""
    while number:
        number, remainder = divmod(number, 58)
        out = BASE58_ALPHABET[remainder] + out
    return "1" * (len(raw) - len(raw.lstrip(b"\x00"))) + out


def discriminator(account_name: str) -> bytes:
    """Anchor: первые 8 байт sha256("account:<ИмяСтруктуры>")."""
    return hashlib.sha256(f"account:{account_name}".encode()).digest()[:8]


def call(rpc: str, method: str, params: list) -> dict:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    request = urllib.request.Request(rpc, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def account_count(rpc: str, program_id: str, account_name: str, *, call_fn=call,
                  extra_filters: list | None = None, data_slice: dict | None = None) -> int:
    """Сколько аккаунтов этого типа есть у программы. Ошибка чтения = 0."""
    filters = [{"memcmp": {"offset": 0, "bytes": b58(discriminator(account_name))}}]
    filters.extend(extra_filters or [])
    # Для подсчёта хватает одного байта: фильтры узел применяет до среза, а
    # полные аккаунты (например, все листинги) в ответ не нужны.
    config: dict = {"encoding": "base64", "filters": filters,
                    "dataSlice": data_slice or {"offset": 0, "length": 1}}
    result = call_fn(rpc, "getProgramAccounts", [program_id, config])
    if "error" in result:
        raise RuntimeError(str(result["error"].get("message", result["error"]))[:120])
    return len(result.get("result") or [])


def first_account_data(rpc: str, program_id: str, account_name: str, *, call_fn=call,
                       data_slice: dict | None = None) -> bytes | None:
    """Данные первого аккаунта этого типа (или None, если его нет)."""
    filters = [{"memcmp": {"offset": 0, "bytes": b58(discriminator(account_name))}}]
    config: dict = {"encoding": "base64", "filters": filters}
    if data_slice:
        config["dataSlice"] = data_slice
    result = call_fn(rpc, "getProgramAccounts", [program_id, config])
    if "error" in result:
        raise RuntimeError(str(result["error"].get("message", result["error"]))[:120])
    rows = result.get("result") or []
    if not rows:
        return None
    raw = rows[0]["account"]["data"][0]
    return base64.b64decode(raw)


def pubkey_at(data: bytes, offset: int) -> str:
    return b58(data[offset:offset + 32])


def program_ids(registry: dict) -> dict:
    return {entry["name"]: entry["address"] for entry in registry.get("programs", [])}


def repo_instruction_names(program: str) -> set[str] | None:
    """Инструкции программы из IDL репозитория (source of truth для «есть ли путь»).

    Зачем: часть механик закрыта не конфигом, а отсутствием инструкции в
    программе. Такое состояние нельзя прочитать из сети — ни один аккаунт не
    скажет «инструкции нет». Поэтому берём IDL, лежащий рядом со скриптом, и
    честно называем источник: строки «нет инструкции» проверяются по репозиторию,
    а не по RPC, и сами станут «включено», когда инструкция появится.
    """
    path = pathlib.Path(__file__).resolve().parent.parent / "aof_backend" / "src" / "idl" / f"{program}.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return {ix.get("name", "") for ix in data.get("instructions", [])}


def mechanics(rpc: str, registry: dict, *, call_fn=call) -> list[dict]:
    """Таблица «механика → включена или нет» с доказательством из сети.

    Каждая строка: name, state ("включено" / "ждёт деплоя" / "выключено" /
    "нет данных"),
    evidence (что именно прочитано) и action (что сделать, если включить
    нельзя). «Ждёт деплоя» — код в репозитории есть, а версия байткода в сети
    не подтверждена; строки «включено» из IDL не выводятся.
    """
    ids = program_ids(registry)
    core = ids.get("aof_core", "")
    market = ids.get("aof_market", "")
    session = ids.get("aof_session_keys", "")
    rebirth = ids.get("aof_rebirth", "")
    rows: list[dict] = []

    def row(name: str, state: str, evidence: str, action: str = "") -> None:
        rows.append({"name": name, "state": state, "evidence": evidence, "action": action})

    # Программа без аккаунта в сети не может держать ни одного аккаунта данных,
    # поэтому «включено» запрещено, пока деплоя нет: иначе отчёт выглядел бы
    # бодрее реальности (например, «листинги: 0» вместо «программы нет»).
    deployed: dict[str, bool] = {}
    for name in ("aof_core", "aof_market", "aof_session_keys", "aof_rebirth"):
        address = ids.get(name, "")
        if not address:
            deployed[name] = False
            continue
        try:
            value = call_fn(rpc, "getAccountInfo", [address, {"encoding": "base64"}]).get("result", {}).get("value")
            deployed[name] = value is not None
        except Exception:
            deployed[name] = False

    def missing_program(program: str) -> tuple[str, str]:
        return (f"программы {program} нет в сети (адрес {ids.get(program, '—')})",
                "scripts/devnet-bringup.sh --apply (сборка с своими ключами и деплой)")

    # --- aof_core: Config и то, что зависит от него напрямую -----------------
    config_state = "нет данных"
    config_evidence = "программа не задеплоена"
    mining_on = False
    pause_on = False
    repair_mints = ("", "")
    if not deployed.get("aof_core"):
        config_evidence, config_action = missing_program("aof_core")
    try:
        sliced = first_account_data(
            rpc, core, "Config", call_fn=call_fn,
            data_slice={"offset": CONFIG_PAUSED_OFFSET, "length": 3},
        )
        if sliced is None:
            config_evidence = "аккаунта Config нет (скрипт initConfig.ts не проходил)"
        elif len(sliced) < 3:
            config_evidence = f"Config короче ожидаемого (картина: {len(sliced)} байт тут)"
        else:
            pause_on = bool(sliced[0])
            mining_on = bool(sliced[2])
            config_state = "прочитан"
            config_evidence = ("Config есть: paused=%s, mining_enabled=%s"
                               % (pause_on, mining_on))
    except Exception as exc:
        config_evidence = f"ошибка чтения Config: {exc}"

    mining_action = ("" if mining_on
                     else (config_action if not deployed.get("aof_core")
                           else "scripts/devnet-bringup.sh --apply (шаг 8/10: тумблер добычи после preflight)"))
    row(
        "Добыча инструментов",
        "включено" if mining_on else "выключено",
        config_evidence,
        mining_action,
    )
    if pause_on:
        row("Общая пауза контракта", "выключено", "Config.paused = true: денежные действия отклоняются",
            "POST /admin/config/set-paused {paused:false} ключом authority")

    # Ремонт использует Circuit/Silicon из Config: без них /tools/repair отвечает 503.
    try:
        mints = first_account_data(
            rpc, core, "Config", call_fn=call_fn,
            data_slice={"offset": CONFIG_CIRCUIT_MINT_OFFSET, "length": 64},
        )
        if mints is None:
            repair_mints = ("", "")
        elif len(mints) < 64:
            repair_mints = ("", "")
        else:
            repair_mints = (pubkey_at(mints, 0), pubkey_at(mints, 32))
    except Exception:
        repair_mints = ("", "")
    repair_on = deployed.get("aof_core", False) and all(m and m != DEFAULT_PUBKEY for m in repair_mints)
    row(
        "Ремонт инструментов",
        "включено" if repair_on else "выключено",
        (f"Config.circuit_mint={repair_mints[0] or '—'}, silicon_mint={repair_mints[1] or '—'}"
         if deployed.get("aof_core") else config_evidence),
        ("" if repair_on else (config_action if not deployed.get("aof_core")
                               else "scripts/devnet-bringup.sh --apply (шаг 5/10: initMintsV2.ts задаёт адреса ресурсов)")),
    )

    # Механики, которым нужен НОВЫЙ код программы. Такую вещь нельзя прочитать
    # из сети: ни один аккаунт не скажет «инструкции нет», а наличие аккаунта
    # программы не доказывает, что байткод собран из этого репозитория. Поэтому
    # строка честно разделяет два состояния:
    #   * инструкции нет в IDL репозитория  -> «выключено»      (нужна работа по контракту);
    #   * инструкция есть в IDL репозитория -> «ждёт деплоя»    (нужна сборка и деплой,
    #     а версию байткода в сети подтверждает только verify-programs.sh).
    # Третьего состояния «включено» здесь не будет: его нельзя доказать.
    core_instructions = repo_instruction_names("aof_core")
    contract_blocked = [
        ("Фляги: применение", ("use_flask",), "/tools/use-flask"),
        ("Обмен ресурсов на энергию", ("exchange_data_energy",), "/resources/exchange-energy"),
    ]
    for title, instructions, route in contract_blocked:
        if core_instructions is None:
            row(title, "нет данных", "IDL репозитория не читается — нечем проверить наличие инструкции",
                "проверьте aof_backend/src/idl/aof_core.json")
            continue
        present = [name for name in instructions if name in core_instructions]
        if present:
            row(title, "ждёт деплоя",
                f"инструкция {'/'.join(present)} есть в IDL репозитория, маршрут {route} собирает транзакцию; "
                "сеть не подтверждает версию байткода",
                "собрать и доставить новый байткод: UPGRADE=aof_core "
                "PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply "
                "(уже развёрнутую программу деплой пропускает — нужен upgrade), затем "
                "scripts/verify-programs.sh devnet <authority> target/deploy --require-bytecode")
        else:
            row(title, "выключено",
                f"в IDL aof_core нет инструкции {'/'.join(instructions)}: маршрут {route} отвечает 503",
                "работа по контракту (docs/CONTRACT_WORK_QUEUE.md §3.8): дописать инструкцию, собрать и задеплоить")

    # Платный трек сезонного пропуска: инструкция purchase_season_pass в
    # программе уже есть, закрыт не она — нужны раздельные треки, детерминированный
    # XP и проверяемые VIP-льготы, иначе игрок платит за трек, которого нет.
    row("Платный трек сезонного пропуска", "выключено",
        "маршрут /season/pass/purchase отвечает 503 SEASON_PASS_PAID_TRACK_NOT_READY: "
        "покупка закрыта до раздельных треков и проверяемых льгот (инструкция покупки в программе есть)",
        "работа по контракту (docs/CONTRACT_WORK_QUEUE.md §3.6): раздельные треки, идемпотентные начисления, потолки")

    # Остальные account-типы: есть ли хоть один аккаунт этого вида.
    others = [
        ("Ресурсы и крафт", "MaterialMints", core, "шаг 5/10: initMintsV2.ts (23 минта материалов)"),
        # Подсказки называют настоящие роуты (сверено с aof_backend/src/routes):
        # выдуманный «/admin/...» путь хуже отсутствия подсказки — владелец
        # ищет его и не находит.
        ("Экономика крафта", "CraftEconomy", core, "POST /admin/craft-economy/init (шаг 5/10)"),
        ("Счётчики редкости", "RarityCounter", core, "POST /admin/rarity-counter/init {\"rarityIdx\":1..4} (шаг 5/10)"),
        ("Капсулы дропа (паки)", "PackConfig", core, "POST /packs/config/init (шаг 6/10: три типа с каноническими ценой и шансами)"),
        ("Реролл инструментов", "RerollConfig", core, "POST /reroll/config/init (шаг 6/10, шансы REROLL_ODDS_BPS_DEFAULT)"),
        ("Сезоны и сезонный пропуск", "Season", core,
         "POST /season/init {\"seasonId\":1} (шаг 6/10); для /season/current владелец задаёт ACTIVE_SEASON_ID и EXPECTED_GENESIS_HASH"),
        ("Лотерея", "LotteryRound", core, "POST /lottery/round/init {\"roundId\":\"1\"} (шаг 6/10)"),
        ("Коллекционеры (allowlist)", "CollectorAllowEntry", core,
         "COLLECTOR_MINTS=\"<mint>:historian,<mint>:medallion\" scripts/devnet-bringup.sh --apply (шаг 9/10)"),
        ("Страж казны (VaultGuard)", "VaultGuard", core, "POST /admin/vault-guard/init"),
    ]
    for title, account, program, action in others:
        if not program:
            row(title, "нет данных", "нет адреса программы в реестре", action)
            continue
        if not deployed.get("aof_core"):
            reason, deploy_action = missing_program("aof_core")
            row(title, "выключено", reason, deploy_action)
            continue
        try:
            count = account_count(rpc, program, account, call_fn=call_fn)
        except Exception as exc:
            row(title, "нет данных", f"{account}: {exc}", action)
            continue
        row(title,
            "включено" if count else "выключено",
            f"аккаунтов {account}: {count}" + (" (нужен хотя бы один)" if not count else ""),
            "" if count else action)

    # --- Рынок инструментов: листинги aof_core + конфиг aof-market -----------
    if core and not deployed.get("aof_core"):
        reason, deploy_action = missing_program("aof_core")
        row("Рынок инструментов (листинги)", "выключено", reason, deploy_action)
    elif core:
        try:
            active = account_count(
                rpc, core, "Listing", call_fn=call_fn,
                extra_filters=[{"memcmp": {"offset": LISTING_ACTIVE_OFFSET, "bytes": b58(b"\x01")}}],
            )
            row("Рынок инструментов (листинги)", "включено",
                f"активных Listing: {active}" + (" — витрина пуста" if active == 0 else ""))
        except Exception as exc:
            row("Рынок инструментов (листинги)", "нет данных", f"Listing: {exc}")
    if market and not deployed.get("aof_market"):
        reason, deploy_action = missing_program("aof_market")
        row("Горячий рынок (пул)", "выключено", reason, deploy_action)
    elif market:
        try:
            pools = account_count(rpc, market, "HotMarketPool", call_fn=call_fn)
            configured = account_count(rpc, market, "MarketConfig", call_fn=call_fn)
            ready = bool(pools and configured)
            row("Горячий рынок (пул)", "включено" if ready else "выключено",
                f"MarketConfig: {configured}, пулов редкостей: {pools}; "
                + ("hot_market_buy/hot_market_sell_into_queue принимают только канонический "
                   "инструмент (PDA tool+mint) и меняют владение CPI aof_core::transfer_tool"
                   if ready else "торговле нужен хотя бы один пул редкости"),
                "" if ready else
                "задеплоено; инициализируйте пул: POST /hot-market/pool/init "
                "(и /hot-market/config/init, если MarketConfig = 0)")
        except Exception as exc:
            row("Горячий рынок (пул)", "нет данных", f"aof-market: {exc}")
    if session and not deployed.get("aof_session_keys"):
        reason, deploy_action = missing_program("aof_session_keys")
        row("Сессионные ключи", "выключено", reason, deploy_action)
    elif session:
        try:
            cfg = account_count(rpc, session, "SkConfig", call_fn=call_fn)
            row("Сессионные ключи", "выключено",
                f"SkConfig: {cfg}; session_create/session_check_and_spend в коде требуют "
                "атомарной привязки к целевой инструкции",
                "работа по контракту (docs/CONTRACT_WORK_QUEUE.md §3.3): привязка резерва к целевому CPI")
        except Exception as exc:
            row("Сессионные ключи", "нет данных", f"aof-session-keys: {exc}")
    if rebirth and not deployed.get("aof_rebirth"):
        reason, deploy_action = missing_program("aof_rebirth")
        row("Перерождение", "выключено", reason, deploy_action)
    elif rebirth:
        try:
            cfg = account_count(rpc, rebirth, "RebirthConfig", call_fn=call_fn)
            row("Перерождение", "включено" if cfg else "выключено",
                f"RebirthConfig: {cfg}",
                "" if cfg else "POST /rebirth/config/init после деплоя aof_rebirth")
        except Exception as exc:
            row("Перерождение", "нет данных", f"aof-rebirth: {exc}")

    return rows


def main(argv: list[str]) -> int:
    as_json = "--json" in argv
    positional = [a for a in argv[1:] if not a.startswith("-")]
    rpc = positional[0] if positional else DEFAULT_RPC
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))

    report: dict = {"rpc": rpc, "network": registry.get("network"), "programs": [], "mechanics": []}

    def say(text: str = "") -> None:
        if not as_json:
            print(text)

    say(f"RPC: {rpc}")
    say(f"Реестр: network={registry.get('network')} (в репозитории это только адреса, не доказательство деплоя)")
    try:
        genesis = call(rpc, "getGenesisHash", []).get("result")
        say(f"genesis: {genesis}")
        report["genesis"] = genesis
    except Exception as exc:  # сеть недоступна — это тоже ответ
        say(f"genesis: не прочитан ({exc})")
        if as_json:
            report["error"] = f"rpc unavailable: {exc}"
            print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0

    deployed = 0
    for entry in registry.get("programs", []):
        address = entry["address"]
        line = {"name": entry["name"], "address": address}
        try:
            value = call(rpc, "getAccountInfo", [address, {"encoding": "base64"}]).get("result", {}).get("value")
        except Exception as exc:
            say(f"{entry['name']:16} {address}  -> ошибка чтения: {exc}")
            line["error"] = str(exc)[:120]
            report["programs"].append(line)
            continue
        if value is None:
            say(f"{entry['name']:16} {address}  -> НЕТ АККАУНТА (программа не задеплоена)")
            line["deployed"] = False
            report["programs"].append(line)
            continue
        deployed += 1
        owner = value.get("owner")
        loader = "loader совпадает" if owner == LOADER else "чужой владелец"
        if value.get("executable"):
            # У аккаунта программы данные — это 36 байт состояния (ProgramState),
            # а байткод лежит в отдельном аккаунте programdata. Печатать 36 как
            # «размер программы» значило бы вводить в заблуждение, поэтому здесь
            # только факт исполняемости, а хеш байткода проверяет verify-programs.sh.
            say(f"{entry['name']:16} {address}  -> исполняемая ({loader}); "
                f"хеш байткода: scripts/verify-programs.sh --require-bytecode")
        else:
            size = len(value.get("data", [""])[0]) * 3 // 4
            say(f"{entry['name']:16} {address}  -> НЕ исполняемая: данные {size} Б ({loader})")
        line.update({"deployed": True, "executable": bool(value.get("executable")), "owner": owner})
        report["programs"].append(line)

    say()
    say(f"Итог: задеплоено {deployed} из {len(registry.get('programs', []))}.")
    say("Наличие аккаунта не доказывает, что байткод собран из этого репозитория:")
    say("для релиза нужен scripts/verify-programs.sh --require-bytecode и смоук-прогон.")

    say()
    say("Механики по состоянию сети (читается из аккаунтов, не из предположений):")
    rows = mechanics(rpc, registry)
    report["mechanics"] = rows
    width = max((len(r["name"]) for r in rows), default=10)
    counters = {"включено": 0, "ждёт деплоя": 0, "выключено": 0, "нет данных": 0}
    for item in rows:
        counters[item["state"]] = counters.get(item["state"], 0) + 1
        marker = {"включено": "ВКЛ ", "ждёт деплоя": "ДЕПЛ", "выключено": "выкл",
                  "нет данных": "??  "}.get(item["state"], "??  ")
        say(f"  [{marker}] {item['name']:<{width}}  {item['evidence']}")
        if item["action"]:
            say(f"          ↳ {item['action']}")
    say()
    say(f"Включено механизмов: {counters['включено']} из {len(rows)}. «Выключено» — это либо не пройденный шаг"
        " включения, либо работа по контракту; причина и действие напечатаны рядом.")
    if counters["ждёт деплоя"]:
        say(f"Ждут деплоя: {counters['ждёт деплоя']} — инструкция есть в IDL репозитория,"
            " но версия байткода в сети не подтверждена (scripts/verify-programs.sh).")

    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
