#!/usr/bin/env python3
"""Оценщик стоимости и проверок деплоя программ AOF на devnet.

Зачем. Раньше стоимость деплоя считалась одноразовым фрагментом Python: он не
лежал в репозитории, не проверялся тестами и молча предполагал, что CLI
выделяет 2× от размера программы. Исходники Agave (тег v4.2.1, `cli/src/
program.rs`, строки 1414–1423) говорят обратное: без `--max-len` CLI берёт
ровно длину программы. Поэтому здесь `max_len` — явная политика, а стоимость
считается только по живому RPC.

Что делает (всё — read-only RPC, ни одной транзакции, ключей не читает):

    plan          таблица стоимости + агрегатная проверка баланса ДО первой tx
    compare       та же таблица для политик 1.00× / 1.10× / 1.15× / 1.25× / 2.00×
    max-len       max_len для одного .so по политике (без сети)
    check-policy  проверка политики из окружения (без сети)
    cluster       genesis-hash RPC: devnet или нет
    buffers       «осиротевшие» buffer-аккаунты оператора (ничего не закрывает)
    verify-layout размеры метаданных Program/ProgramData/Buffer на живом RPC
    verify-deployed  что реально лежит в сети после деплоя
    upgrade-state    нужен ли upgrade уже развёрнутой программы: same | different
    analyze-history  ТОЛЬКО локальный валидатор: измеренный пик/итог оттока плательщика и сверка с моделью

Модель стоимости (проверена по исходникам, см. docs/DEVNET_DEPLOY_COSTS.md):

  * rent берётся ТОЛЬКО из `getMinimumBalanceForRentExemption`; ни одной ставки
    за байт в коде нет (ставка меняется: SIMD-0437 снижает её ступенями);
  * Program = 36 байт, ProgramData = 45 + max_len, Buffer = 37 + размер .so;
  * CLI создаёт Buffer, финансируя его rent'ом ProgramData(max_len), а в
    финальной транзакции создаёт Program (rent 36 байт); загрузчик возвращает
    lamports буфера плательщику ДО оплаты ProgramData, поэтому буфер не
    «накладывается» поверх постоянной ренты — это проверяет симуляция событий;
  * при последовательном деплое уже заблокированная рента прошлых программ
    остаётся заблокированной: пик считается по накопленному оттоку плательщика,
    а не по самой большой программе и не суммой всех буферов.

Коды выхода: 0 — готово; 2 — неверный ввод/политика; 4 — не хватает баланса;
5 — RPC недоступен или ответил неправильно; 6 — не тот кластер;
7 — проверка после деплоя не сошлась.

Python 3.9+ (macOS system python): только стандартная библиотека.
"""
# Без `from __future__ import annotations`: @dataclass тогда читает sys.modules[__module__],
# а тесты и соседние скрипты грузят этот файл через importlib без регистрации модуля.
import argparse
import base64
import hashlib
import json
import os
import pathlib
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- сеть -------------------------------------------------------------------
LOADER = "BPFLoaderUpgradeab1e11111111111111111111111"
SYSTEM_PROGRAM = "11111111111111111111111111111111"
# Тот же genesis, что в aof_backend/scripts/miningDevnetPreflight.ts и
# scripts/verify-address-registry.cjs (его сверяет tests/readiness).
DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
DEFAULT_RPC = "https://api.devnet.solana.com"
# Публичные кластеры, на которых эксперимент с жизненным циклом запрещён: он только для локального валидатора.
PUBLIC_GENESIS = {
    "devnet": DEVNET_GENESIS,
    "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    "testnet": "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
}
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")
LAMPORTS_PER_SOL = 1_000_000_000

# --- раскладка аккаунтов upgradeable-загрузчика ------------------------------
# Источник: solana-loader-v3-interface/src/state.rs (size_of_*: 36 / 45 / 37) и
# cli/src/program.rs v4.2.1 (ACCOUNT_TYPE_SIZE/SLOT_SIZE/OPTION_SIZE/PUBKEY_LEN).
# Размеры метаданных считаются фиксированными по раскладке bincode С Some(authority):
# у аккаунта с authority=None сериализованное состояние короче, но загрузчик
# резервирует те же 45/37 байт, а ELF лежит строго после них.
ACCOUNT_TYPE_SIZE = 4   # u32: вариант enum UpgradeableLoaderState
SLOT_SIZE = 8           # u64
OPTION_TAG_SIZE = 1     # Option<Pubkey>: тег 0/1
PUBKEY_SIZE = 32
PROGRAM_SIZE = ACCOUNT_TYPE_SIZE + PUBKEY_SIZE                                         # 36
BUFFER_METADATA_SIZE = ACCOUNT_TYPE_SIZE + OPTION_TAG_SIZE + PUBKEY_SIZE               # 37
PROGRAMDATA_METADATA_SIZE = ACCOUNT_TYPE_SIZE + SLOT_SIZE + OPTION_TAG_SIZE + PUBKEY_SIZE  # 45
STATE_BUFFER = 1
STATE_PROGRAM = 2
STATE_PROGRAMDATA = 3
ELF_MAGIC = b"\x7fELF"
# solana_system_interface::MAX_PERMITTED_DATA_LENGTH: загрузчик отказывает, если
# size_of_programdata(max_len) больше (programs/bpf_loader/src/lib.rs:274).
MAX_PERMITTED_DATA_LENGTH = 10 * 1024 * 1024
PACKET_DATA_SIZE = 1232

# Подписи транзакций деплоя при payer == upgrade authority == buffer authority
# (так зовёт CLI скрипт deploy-devnet.sh: один --keypair):
SIGNATURES_CREATE_BUFFER = 2   # плательщик + keypair буфера
SIGNATURES_WRITE = 1           # плательщик (он же authority буфера)
SIGNATURES_DEPLOY = 2          # плательщик + keypair программы

POLICIES = ("exact", "headroom", "legacy-2x")
COMPARE_VARIANTS: Tuple[Tuple[str, int], ...] = (
    ("exact", 0), ("headroom", 10), ("headroom", 15), ("headroom", 25), ("legacy-2x", 100),
)

EXIT_OK, EXIT_USAGE, EXIT_INSUFFICIENT, EXIT_RPC, EXIT_CLUSTER, EXIT_VERIFY = 0, 2, 4, 5, 6, 7

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


class EstimatorError(Exception):
    """Ошибка с кодом выхода; сообщение — для человека, без секретов."""

    def __init__(self, message: str, code: int = EXIT_USAGE) -> None:
        super().__init__(message)
        self.code = code


# --- base58 ------------------------------------------------------------------
def b58encode(raw: bytes) -> str:
    number = int.from_bytes(raw, "big")
    out = ""
    while number:
        number, remainder = divmod(number, 58)
        out = BASE58_ALPHABET[remainder] + out
    return "1" * (len(raw) - len(raw.lstrip(b"\x00"))) + out


def b58decode(text: str) -> bytes:
    number = 0
    for char in text:
        index = BASE58_ALPHABET.find(char)
        if index < 0:
            raise EstimatorError(f"не base58: {text!r}")
        number = number * 58 + index
    body = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\x00" * (len(text) - len(text.lstrip("1"))) + body


def pubkey_bytes(address: str) -> bytes:
    raw = b58decode(address)
    if len(raw) != 32:
        raise EstimatorError(f"адрес {address!r} — не 32 байта")
    return raw


# --- lamports / SOL (без float) ---------------------------------------------
def parse_sol(text: str, what: str = "значение") -> int:
    """«0.1» → 100_000_000. Точная арифметика, не больше 9 знаков, не отрицательно."""
    try:
        value = Decimal(str(text).strip())
    except InvalidOperation:
        raise EstimatorError(f"{what}: '{text}' — не число (ожидается SOL, например 0.1)")
    if not value.is_finite() or value < 0:
        raise EstimatorError(f"{what}: '{text}' должно быть неотрицательным числом")
    lamports = value * LAMPORTS_PER_SOL
    if lamports != lamports.to_integral_value():
        raise EstimatorError(f"{what}: '{text}' точнее одного лампорта (максимум 9 знаков)")
    return int(lamports)


def fmt_sol(lamports: int, places: int = 6) -> str:
    sign = "-" if lamports < 0 else ""
    value = Decimal(abs(lamports)) / Decimal(LAMPORTS_PER_SOL)
    return f"{sign}{value:.{places}f}"


# --- политика max_len --------------------------------------------------------
@dataclass(frozen=True)
class Policy:
    name: str
    headroom_percent: int  # запас сверх размера .so, в процентах

    @property
    def multiplier(self) -> str:
        return f"{(100 + self.headroom_percent) / 100:.2f}×"

    def max_len(self, size: int) -> int:
        # целочисленно, округление вверх: запас никогда не меньше обещанного
        return size + (size * self.headroom_percent + 99) // 100

    def label(self) -> str:
        return f"{self.name} ({self.multiplier})"


POLICY_HELP = (
    "допустимо: exact (1.00×, без запаса); "
    "headroom + PROGRAM_MAX_LEN_HEADROOM_PERCENT=1..99 (например 10, 15 или 25); "
    "legacy-2x (2.00×, только как явное решение владельца)"
)


def resolve_policy(name: Optional[str], headroom_percent: Optional[str]) -> Policy:
    """Fail-closed: отсутствие или мусор — отказ, молчаливого значения по умолчанию нет."""
    if name is None or str(name).strip() == "":
        raise EstimatorError(
            "не задана политика max_len (PROGRAM_MAX_LEN_POLICY). CLI без --max-len берёт ровно "
            "размер .so, то есть неявный выбор «без запаса» — здесь он запрещён: решение должно быть "
            f"явным. {POLICY_HELP}")
    name = str(name).strip()
    if name not in POLICIES:
        raise EstimatorError(f"неизвестная политика max_len '{name}'; {POLICY_HELP}")
    raw = None if headroom_percent is None else str(headroom_percent).strip()
    if name == "headroom":
        if not raw:
            raise EstimatorError("политика headroom требует PROGRAM_MAX_LEN_HEADROOM_PERCENT (целое 1..99)")
        if not raw.isdigit():
            raise EstimatorError(f"PROGRAM_MAX_LEN_HEADROOM_PERCENT='{raw}' — нужно целое число 1..99")
        percent = int(raw)
        if not 1 <= percent <= 99:
            raise EstimatorError(
                f"PROGRAM_MAX_LEN_HEADROOM_PERCENT={percent} вне 1..99 (2.00× — это явная политика legacy-2x)")
        return Policy("headroom", percent)
    if raw not in (None, "", "0") and name == "exact":
        raise EstimatorError("политика exact не принимает PROGRAM_MAX_LEN_HEADROOM_PERCENT — уберите его или выберите headroom")
    if raw not in (None, "") and name == "legacy-2x":
        raise EstimatorError("политика legacy-2x не принимает PROGRAM_MAX_LEN_HEADROOM_PERCENT")
    return Policy("exact", 0) if name == "exact" else Policy("legacy-2x", 100)


def check_capacity(name: str, size: int, max_len: int) -> None:
    """max_len должен вмещать программу и сетевой предел аккаунта."""
    if not isinstance(max_len, int) or isinstance(max_len, bool):
        raise EstimatorError(f"{name}: max_len должен быть целым числом")
    if size <= 0:
        raise EstimatorError(f"{name}: пустая программа ({size} байт)")
    if max_len < size:
        raise EstimatorError(f"{name}: max_len={max_len} меньше размера программы {size}: CLI откажет "
                             "(\"Max length specified not large enough\"), загрузчик — тоже")
    if PROGRAMDATA_METADATA_SIZE + max_len > MAX_PERMITTED_DATA_LENGTH:
        raise EstimatorError(
            f"{name}: ProgramData {PROGRAMDATA_METADATA_SIZE + max_len} байт больше сетевого предела "
            f"{MAX_PERMITTED_DATA_LENGTH} (загрузчик: \"Max data length is too large\"); уменьшите запас")


# --- сообщения (только для оценки комиссии и размера чанка) ------------------
def shortvec(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def build_legacy_message(signers: Sequence[bytes], writable: Sequence[bytes], readonly: Sequence[bytes],
                         blockhash: bytes, instructions: Sequence[Tuple[int, Sequence[int], bytes]]) -> bytes:
    """Legacy-сообщение: ключи уже упорядочены (подписанты, затем writable, затем readonly)."""
    keys = list(signers) + list(writable) + list(readonly)
    out = bytearray([len(signers), 0, len(readonly)])
    out += shortvec(len(keys))
    for key in keys:
        out += key
    out += blockhash
    out += shortvec(len(instructions))
    for program_index, accounts, data in instructions:
        out.append(program_index)
        out += shortvec(len(accounts))
        out += bytes(accounts)
        out += shortvec(len(data))
        out += data
    return bytes(out)


def _dummy_key(tag: int) -> bytes:
    return bytes([tag]) * 32


def fee_probe_message(signatures: int, blockhash: bytes, payer: bytes) -> bytes:
    """Сообщение с нужным числом подписей: комиссия зависит от их числа, а не от смысла."""
    if signatures < 1:
        raise EstimatorError("нужна хотя бы одна подпись")
    signers = [payer] + [_dummy_key(0xA0 + i) for i in range(signatures - 1)]
    recipient = _dummy_key(0xB0)
    system = pubkey_bytes(SYSTEM_PROGRAM)
    transfer = struct.pack("<IQ", 2, 1)  # SystemInstruction::Transfer { lamports: 1 }
    return build_legacy_message(signers, [recipient], [system], blockhash,
                                [(len(signers) + 1, [0, len(signers)], transfer)])


def write_chunk_size() -> int:
    """Так же, как cli/src/program.rs `calculate_max_chunk_size` для Write при payer == authority.

    Без `--with-compute-unit-price` CLI не добавляет compute-budget инструкции
    (cli/src/compute_budget.rs), поэтому сообщение — одна инструкция загрузчика.
    """
    payer, buffer, loader = _dummy_key(1), _dummy_key(2), pubkey_bytes(LOADER)
    write = struct.pack("<IIQ", 1, 0, 0)  # Write { offset: 0, bytes: [] }: вариант, offset, длина вектора
    message = build_legacy_message([payer], [buffer], [loader], b"\x00" * 32, [(2, [1, 0], write)])
    transaction = len(shortvec(1)) + 64 + len(message)
    return PACKET_DATA_SIZE - transaction - 1


# --- RPC ---------------------------------------------------------------------
def redact_url(url: str) -> str:
    """В отчётах только схема и хост: в пути/query провайдера бывает API-ключ."""
    parts = urllib.parse.urlsplit(url)
    return f"{parts.scheme}://{parts.netloc.rsplit('@', 1)[-1]}" if parts.netloc else "<rpc>"


class Rpc:
    """Минимальный JSON-RPC клиент. Любая неисправность — EstimatorError(EXIT_RPC)."""

    def __init__(self, url: str, timeout: float = 20.0) -> None:
        # Разбор адреса — до сети и до Request(): пустой URL или строка без схемы
        # иначе вылетают голым traceback'ом ValueError, из которого неясно, что
        # именно не так с RPC_URL.
        parts = urllib.parse.urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            raise EstimatorError(
                f"RPC URL негодный ({redact_url(url)}): нужен адрес вида http(s)://хост. "
                "У провайдеров ключ стоит в query — подставьте настоящий: "
                "RPC_URL='https://devnet.helius-rpc.com/?api-key=…'", EXIT_USAGE)
        self.url = url
        self.timeout = timeout
        self.audit: List[Dict[str, Any]] = []

    def call(self, method: str, params: Optional[list] = None) -> Any:
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}).encode()
        request = urllib.request.Request(self.url, data=body, headers={"Content-Type": "application/json"})
        where = redact_url(self.url)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            hint = ""
            if exc.code in (401, 403):
                hint = " — провайдер отклонил доступ: проверьте ключ в RPC_URL (?api-key=…)"
            elif exc.code == 429:
                hint = " — слишком много запросов: публичный api.devnet.solana.com не выдерживает прогон, возьмите RPC с ключом провайдера"
            raise EstimatorError(f"RPC {where} ответил HTTP {exc.code} на {method}{hint}", EXIT_RPC)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            reason = getattr(exc, "reason", exc)
            detail = str(reason)[:160] or type(reason).__name__
            # Частая ошибка: в URL остался плейсхолдер («ВАШ_КЛЮЧ», «<key>»). urllib
            # падает на первом же не-ASCII символе и отдаёт причину строкой, поэтому
            # без этой проверки отказ читается как «недоступен (str)» и не помогает.
            if any(ord(ch) > 127 for ch in self.url):
                raise EstimatorError(
                    f"RPC {where} ({detail}): в адресе есть не-ASCII символы — похоже, вместо api-key остался плейсхолдер. "
                    "Подставьте настоящий ключ провайдера (ключ в чат не присылайте)", EXIT_RPC)
            raise EstimatorError(f"RPC {where} недоступен на {method}: {detail}", EXIT_RPC)
        try:
            payload = json.loads(raw)
        except ValueError:
            raise EstimatorError(f"RPC {where} вернул не JSON на {method}", EXIT_RPC)
        if not isinstance(payload, dict):
            raise EstimatorError(f"RPC {where} вернул неожиданный JSON на {method}", EXIT_RPC)
        if payload.get("error"):
            message = payload["error"].get("message") if isinstance(payload["error"], dict) else payload["error"]
            raise EstimatorError(f"RPC {where}: {method} отклонён: {str(message)[:160]}", EXIT_RPC)
        if "result" not in payload:
            raise EstimatorError(f"RPC {where}: в ответе на {method} нет поля result", EXIT_RPC)
        result = payload["result"]
        self.audit.append({"method": method, "params": _trim(params or []), "result": _trim(result)})
        return result


def _trim(value: Any, limit: int = 160) -> Any:
    """Для журнала: длинные строки (base64 программ, сообщения) режем."""
    if isinstance(value, str):
        return value if len(value) <= limit else f"{value[:limit]}…[{len(value)} симв.]"
    if isinstance(value, list):
        return [_trim(v, limit) for v in value]
    if isinstance(value, dict):
        return {k: _trim(v, limit) for k, v in value.items()}
    return value


def _as_lamports(value: Any, what: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise EstimatorError(f"RPC вернул {what} = {value!r}: ожидалось неотрицательное целое", EXIT_RPC)
    return value


class RpcQuotes:
    """Ставки и комиссии строго из RPC, с кэшем на один запуск."""

    def __init__(self, rpc: Any, commitment: str = "confirmed") -> None:
        self.rpc = rpc
        self.commitment = commitment
        self._rent: Dict[int, int] = {}
        self._fee: Dict[int, int] = {}
        self._blockhash: Optional[bytes] = None

    def rent(self, data_len: int) -> int:
        if data_len not in self._rent:
            value = self.rpc.call("getMinimumBalanceForRentExemption", [data_len])
            self._rent[data_len] = _as_lamports(value, f"rent для {data_len} байт")
        return self._rent[data_len]

    def fee(self, signatures: int) -> int:
        if signatures not in self._fee:
            if self._blockhash is None:
                result = self.rpc.call("getLatestBlockhash", [{"commitment": self.commitment}])
                try:
                    self._blockhash = b58decode(result["value"]["blockhash"])
                except (KeyError, TypeError):
                    raise EstimatorError("RPC вернул getLatestBlockhash без blockhash", EXIT_RPC)
                if len(self._blockhash) != 32:
                    raise EstimatorError("RPC вернул blockhash не из 32 байт", EXIT_RPC)
            message = fee_probe_message(signatures, self._blockhash, _dummy_key(0xC0))
            result = self.rpc.call("getFeeForMessage",
                                   [base64.b64encode(message).decode(), {"commitment": self.commitment}])
            value = result.get("value") if isinstance(result, dict) else None
            if value is None:
                raise EstimatorError("RPC не смог оценить комиссию (getFeeForMessage вернул null: "
                                     "blockhash устарел или узел не принял сообщение)", EXIT_RPC)
            self._fee[signatures] = _as_lamports(value, f"комиссия за {signatures} подп.")
        return self._fee[signatures]

    def sanity(self) -> List[str]:
        """Проверки правдоподобия ответа RPC; возвращает предупреждения, ошибка — при абсурде."""
        warnings: List[str] = []
        points = sorted(self._rent.items())
        for (len_a, rent_a), (len_b, rent_b) in zip(points, points[1:]):
            if rent_b <= rent_a:
                raise EstimatorError(
                    f"RPC вернул неубывающую-по-размеру ренту: {len_a} байт → {rent_a}, {len_b} байт → {rent_b}; "
                    "для devnet это невозможно, расчёту доверять нельзя", EXIT_RPC)
        rates = {(rb - ra) / (lb - la) for (la, ra), (lb, rb) in zip(points, points[1:])}
        if len(rates) > 1 and max(rates) - min(rates) > 1e-6:
            warnings.append("rent нелинейна по размеру аккаунта — расчёт всё равно использует ответы RPC, "
                            "но проверьте узел и версию протокола")
        return warnings

    def derived_lamports_per_byte(self) -> Optional[float]:
        """Справочная величина (разность двух ответов RPC). В расчётах НЕ участвует."""
        points = sorted(self._rent.items())
        if len(points) < 2:
            return None
        (la, ra), (lb, rb) = points[0], points[-1]
        return (rb - ra) / (lb - la)


# --- план --------------------------------------------------------------------
@dataclass(frozen=True)
class ProgramSpec:
    name: str
    address: str
    so_path: str
    size: int


@dataclass
class ProgramPlan:
    spec: ProgramSpec
    max_len: int
    headroom_bytes: int
    programdata_len: int
    program_rent: int
    programdata_rent: int
    buffer_len: int
    buffer_funding: int
    write_transactions: int
    fee_create: int
    fee_write: int
    fee_deploy: int

    @property
    def permanent(self) -> int:
        return self.program_rent + self.programdata_rent

    @property
    def fees(self) -> int:
        return self.fee_create + self.write_transactions * self.fee_write + self.fee_deploy

    def events(self) -> List[Tuple[str, int]]:
        """Изменения ОТТОКА плательщика (положительное — платит, отрицательное — возврат), по порядку.

        Порядок внутри финальной транзакции — как в загрузчике Agave v4.2.1
        (programs/bpf_loader/src/lib.rs): Program создаётся до DeployWithMaxDataLen;
        загрузчик возвращает lamports буфера плательщику ДО create_account для ProgramData.
        """
        name = self.spec.name
        return [
            (f"{name}: комиссия create_buffer", self.fee_create),
            (f"{name}: создание Buffer (финансируется rent'ом ProgramData)", self.buffer_funding),
            (f"{name}: комиссии {self.write_transactions} Write", self.write_transactions * self.fee_write),
            (f"{name}: комиссия deploy", self.fee_deploy),
            (f"{name}: создание Program", self.program_rent),
            (f"{name}: загрузчик возвращает Buffer плательщику", -self.buffer_funding),
            (f"{name}: создание ProgramData", self.programdata_rent),
        ]


@dataclass
class Simulation:
    peak_outflow: int
    final_outflow: int
    timeline: List[Tuple[str, int, int]] = field(default_factory=list)

    @property
    def transient_peak(self) -> int:
        """Сколько пик превышает итоговый отток (то, что временно лежит сверх постоянного)."""
        return self.peak_outflow - self.final_outflow


def simulate_outflow(plans: Sequence[ProgramPlan]) -> Simulation:
    """Накопленный отток плательщика по всем программам подряд.

    Нельзя брать «самую большую программу» (рента прошлых остаётся заблокированной)
    и нельзя складывать все буферы поверх постоянной ренты (буфер возвращается в
    той же транзакции, где платится ProgramData) — поэтому считается по событиям.
    """
    cumulative = 0
    peak = 0
    timeline: List[Tuple[str, int, int]] = []
    for plan in plans:
        for label, delta in plan.events():
            cumulative += delta
            peak = max(peak, cumulative)
            timeline.append((label, delta, cumulative))
    return Simulation(peak_outflow=peak, final_outflow=cumulative, timeline=timeline)


def plan_program(spec: ProgramSpec, policy: Policy, quotes: Any, chunk: int) -> ProgramPlan:
    max_len = policy.max_len(spec.size)
    check_capacity(spec.name, spec.size, max_len)
    programdata_len = PROGRAMDATA_METADATA_SIZE + max_len
    programdata_rent = quotes.rent(programdata_len)
    program_rent = quotes.rent(PROGRAM_SIZE)
    return ProgramPlan(
        spec=spec,
        max_len=max_len,
        headroom_bytes=max_len - spec.size,
        programdata_len=programdata_len,
        program_rent=program_rent,
        programdata_rent=programdata_rent,
        buffer_len=BUFFER_METADATA_SIZE + spec.size,
        # cli/src/program.rs v4.2.1: create_buffer(.., min_rent_exempt_program_data_balance, program_len)
        buffer_funding=programdata_rent,
        write_transactions=-(-spec.size // chunk),
        fee_create=quotes.fee(SIGNATURES_CREATE_BUFFER),
        fee_write=quotes.fee(SIGNATURES_WRITE),
        fee_deploy=quotes.fee(SIGNATURES_DEPLOY),
    )


@dataclass
class Totals:
    permanent: int
    expected_fees: int
    transient_peak: int
    peak_outflow: int
    fee_reserve: int
    operator_reserve: int
    min_start_balance: int


def compute_totals(plans: Sequence[ProgramPlan], fee_reserve: int, operator_reserve: int) -> Tuple[Totals, Simulation]:
    simulation = simulate_outflow(plans)
    permanent = sum(p.permanent for p in plans)
    fees = sum(p.fees for p in plans)
    totals = Totals(
        permanent=permanent,
        expected_fees=fees,
        transient_peak=simulation.transient_peak,
        peak_outflow=simulation.peak_outflow,
        fee_reserve=fee_reserve,
        operator_reserve=operator_reserve,
        min_start_balance=simulation.peak_outflow + fee_reserve + operator_reserve,
    )
    return totals, simulation


# --- чтение входных данных ---------------------------------------------------
def parse_program_arg(text: str) -> ProgramSpec:
    parts = text.split(":", 2)
    if len(parts) != 3 or not all(parts):
        raise EstimatorError(f"--program ожидает ИМЯ:АДРЕС:ПУТЬ_К_SO, получено '{text}'")
    name, address, path = parts
    pubkey_bytes(address)
    try:
        size = os.path.getsize(path)
    except OSError:
        raise EstimatorError(f"{name}: нет файла программы {path} (соберите 'anchor build --no-idl')")
    if size <= 0:
        raise EstimatorError(f"{name}: пустой файл программы {path}")
    return ProgramSpec(name=name, address=address, so_path=path, size=size)


def specs_from_registry(artifacts: str, only: Optional[str]) -> List[ProgramSpec]:
    registry = json.loads((ROOT / "watchtower" / "addresses.json").read_text(encoding="utf-8"))
    wanted = {s for s in (only or "").split(",") if s}
    specs = []
    for entry in registry["programs"]:
        if wanted and entry["name"] not in wanted:
            continue
        specs.append(parse_program_arg(f"{entry['name']}:{entry['address']}:{artifacts}/{entry['name']}.so"))
    if not specs:
        raise EstimatorError("в реестре нет программ под этот фильтр")
    return specs


# --- вывод -------------------------------------------------------------------
def render_plan(plans: Sequence[ProgramPlan], totals: Totals, policy: Policy, quotes: Any,
                balance: Optional[int], payer: Optional[str], cluster: Optional[str],
                rpc_label: str, warnings: Sequence[str], chunk: int) -> str:
    lines: List[str] = []
    rate = quotes.derived_lamports_per_byte() if hasattr(quotes, "derived_lamports_per_byte") else None
    lines.append(f"RPC: {rpc_label}; кластер: {cluster or 'не проверялся'}")
    lines.append(f"Политика max_len: {policy.label()}")
    lines.append(f"Метаданные: Program {PROGRAM_SIZE} Б, ProgramData {PROGRAMDATA_METADATA_SIZE} Б + max_len, "
                 f"Buffer {BUFFER_METADATA_SIZE} Б + размер .so (источник: solana-loader-v3-interface)")
    if rate is not None:
        lines.append(f"Ставка из RPC (производная, справочно): {rate:.2f} lamports/байт — в расчёте не используется")
    lines.append(f"Чанк записи: {chunk} Б (cli/src/program.rs: calculate_max_chunk_size)")
    lines.append("")
    header = ["программа", ".so, Б", "max_len, Б", "запас, Б", "rent Program", "rent ProgramData",
              "Buffer (врем.)", "заблокировано", "Write tx", "комиссии"]
    rows = [header]
    for p in plans:
        rows.append([p.spec.name, str(p.spec.size), str(p.max_len), str(p.headroom_bytes),
                     fmt_sol(p.program_rent), fmt_sol(p.programdata_rent), fmt_sol(p.buffer_funding),
                     fmt_sol(p.permanent), str(p.write_transactions), fmt_sol(p.fees)])
    widths = [max(len(r[i]) for r in rows) for i in range(len(header))]
    for index, row in enumerate(rows):
        lines.append("  ".join(cell.ljust(widths[i]) if i == 0 else cell.rjust(widths[i]) for i, cell in enumerate(row)))
        if index == 0:
            lines.append("  ".join("-" * w for w in widths))
    lines.append("Buffer (врем.) — lamports, которыми CLI финансирует буфер; загрузчик возвращает их плательщику в")
    lines.append("транзакции deploy ДО оплаты ProgramData, поэтому к «заблокировано» они не прибавляются.")
    lines.append("")

    def money(label: str, lamports: int) -> None:
        lines.append(f"{label:<58} {fmt_sol(lamports, 9):>16} SOL")

    money("Постоянно заблокировано (Program + ProgramData всех программ)", totals.permanent)
    money("Пик временной потребности сверх постоянной (Buffer)", totals.transient_peak)
    money("Ожидаемые комиссии сети", totals.expected_fees)
    money("Резерв на повторы и сбои комиссий (явный)", totals.fee_reserve)
    money("Резерв оператора после деплоя (явный)", totals.operator_reserve)
    lines.append("-" * 76)
    money("МИНИМАЛЬНЫЙ СТАРТОВЫЙ БАЛАНС", totals.min_start_balance)
    if balance is not None:
        money(f"Баланс {payer}", balance)
        deficit = totals.min_start_balance - balance
        if deficit > 0:
            money("ДЕФИЦИТ", deficit)
        else:
            money("Запас сверх минимума", -deficit)
    for warning in warnings:
        lines.append(f"! {warning}")
    return "\n".join(lines)


def plan_to_json(plans: Sequence[ProgramPlan], totals: Totals, policy: Policy, quotes: Any, balance: Optional[int],
                 payer: Optional[str], genesis: Optional[str], rpc_label: str, chunk: int,
                 audit: Sequence[Dict[str, Any]], warnings: Sequence[str]) -> Dict[str, Any]:
    deficit = None if balance is None else max(0, totals.min_start_balance - balance)
    return {
        "tool": "devnet-deploy-estimator",
        "schema": 1,
        "rpc": {"endpoint": rpc_label, "genesisHash": genesis, "cluster": cluster_name(genesis)},
        "policy": {"name": policy.name, "headroomPercent": policy.headroom_percent, "multiplier": policy.multiplier},
        "metadata": {"program": PROGRAM_SIZE, "programData": PROGRAMDATA_METADATA_SIZE, "buffer": BUFFER_METADATA_SIZE,
                     "source": "solana-loader-v3-interface/src/state.rs; agave v4.2.1 cli/src/program.rs"},
        "writeChunkBytes": chunk,
        "derivedLamportsPerByte": quotes.derived_lamports_per_byte() if hasattr(quotes, "derived_lamports_per_byte") else None,
        "programs": [{
            "name": p.spec.name, "address": p.spec.address, "soBytes": p.spec.size, "maxLen": p.max_len,
            "headroomBytes": p.headroom_bytes, "programDataLen": p.programdata_len, "bufferLen": p.buffer_len,
            "programRentLamports": p.program_rent, "programDataRentLamports": p.programdata_rent,
            "bufferFundingLamports": p.buffer_funding, "permanentLamports": p.permanent,
            "writeTransactions": p.write_transactions, "feeLamports": p.fees,
        } for p in plans],
        "totals": {
            "permanentLamports": totals.permanent, "transientPeakLamports": totals.transient_peak,
            "peakOutflowLamports": totals.peak_outflow, "expectedFeesLamports": totals.expected_fees,
            "feeReserveLamports": totals.fee_reserve, "operatorReserveLamports": totals.operator_reserve,
            "minStartBalanceLamports": totals.min_start_balance,
        },
        "payer": None if payer is None else {
            "address": payer, "balanceLamports": balance, "deficitLamports": deficit,
            "sufficient": deficit == 0,
        },
        "warnings": list(warnings),
        "rpcAudit": list(audit),
    }


def cluster_name(genesis: Optional[str]) -> str:
    if genesis is None:
        return "unchecked"
    return "devnet" if genesis == DEVNET_GENESIS else "other"


# --- команды -----------------------------------------------------------------
def _policy_from_args(args: argparse.Namespace) -> Policy:
    name = args.policy if args.policy is not None else os.environ.get("PROGRAM_MAX_LEN_POLICY")
    percent = args.headroom_percent if args.headroom_percent is not None else os.environ.get("PROGRAM_MAX_LEN_HEADROOM_PERCENT")
    return resolve_policy(name, percent)


def _specs_from_args(args: argparse.Namespace) -> List[ProgramSpec]:
    if args.program:
        return [parse_program_arg(p) for p in args.program]
    if args.from_registry:
        return specs_from_registry(args.artifacts, args.only)
    raise EstimatorError("укажите программы: --program ИМЯ:АДРЕС:SO (можно несколько) или --from-registry")


def _reserves(args: argparse.Namespace, rent_zero: Callable[[], int]) -> Tuple[int, int]:
    fee_text = args.fee_reserve_sol if args.fee_reserve_sol is not None else os.environ.get("DEPLOY_FEE_RESERVE_SOL", "0.1")
    operator_text = args.operator_reserve_sol if args.operator_reserve_sol is not None else os.environ.get("OPERATOR_RESERVE_SOL", "1")
    fee_reserve = parse_sol(fee_text, "резерв комиссий")
    operator_reserve = parse_sol(operator_text, "резерв оператора")
    floor = rent_zero()
    if operator_reserve < floor:
        raise EstimatorError(
            f"резерв оператора {fmt_sol(operator_reserve, 9)} SOL меньше rent-exempt минимума системного аккаунта "
            f"({fmt_sol(floor, 9)} SOL по RPC): после деплоя ключ окажется ниже минимума и сеть отклонит транзакции")
    return fee_reserve, operator_reserve


def _genesis(rpc: Any, expect: Optional[str]) -> Optional[str]:
    genesis = rpc.call("getGenesisHash", [])
    if not isinstance(genesis, str):
        raise EstimatorError("RPC вернул getGenesisHash не строкой", EXIT_RPC)
    if expect is not None and genesis != expect:
        raise EstimatorError(
            f"RPC отвечает с genesis {genesis}, а ожидался {expect}: это не devnet "
            "(возможно, mainnet или чужой кластер) — ни одна транзакция не отправляется", EXIT_CLUSTER)
    return genesis


def _balance(rpc: Any, address: str, commitment: str) -> int:
    pubkey_bytes(address)
    result = rpc.call("getBalance", [address, {"commitment": commitment}])
    value = result.get("value") if isinstance(result, dict) else result
    return _as_lamports(value, "баланс")


def cmd_plan(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any, err: Any) -> int:
    specs = _specs_from_args(args)
    policy = _policy_from_args(args)
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    expect = None if args.no_genesis_check else args.expect_genesis
    genesis = _genesis(rpc, expect)
    quotes = RpcQuotes(rpc, args.commitment)
    chunk = args.write_chunk_bytes or write_chunk_size()
    plans = [plan_program(spec, policy, quotes, chunk) for spec in specs]
    fee_reserve, operator_reserve = _reserves(args, lambda: quotes.rent(0))
    warnings = quotes.sanity()
    totals, _ = compute_totals(plans, fee_reserve, operator_reserve)
    balance = _balance(rpc, args.payer, args.commitment) if args.payer else None
    label = redact_url(args.rpc)
    if args.json:
        out.write(json.dumps(plan_to_json(plans, totals, policy, quotes, balance, args.payer, genesis, label,
                                          chunk, getattr(rpc, "audit", []), warnings), ensure_ascii=False, indent=2) + "\n")
    else:
        out.write(render_plan(plans, totals, policy, quotes, balance, args.payer, cluster_name(genesis), label,
                              warnings, chunk) + "\n")
    if balance is not None and balance < totals.min_start_balance:
        deficit = totals.min_start_balance - balance
        err.write(
            f"\nОТКАЗ: на {args.payer} не хватает {fmt_sol(deficit, 9)} SOL до минимального стартового баланса "
            f"{fmt_sol(totals.min_start_balance, 9)} SOL. Ни одной транзакции не отправлено.\n"
            "Пополните ключ (devnet airdrop/faucet) или выберите политику с меньшим запасом max_len "
            "(PROGRAM_MAX_LEN_POLICY=exact); резервы задаются OPERATOR_RESERVE_SOL и DEPLOY_FEE_RESERVE_SOL.\n")
        return EXIT_INSUFFICIENT
    return EXIT_OK


def cmd_compare(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    specs = _specs_from_args(args)
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    genesis = _genesis(rpc, None if args.no_genesis_check else args.expect_genesis)
    quotes = RpcQuotes(rpc, args.commitment)
    chunk = args.write_chunk_bytes or write_chunk_size()
    fee_reserve, operator_reserve = _reserves(args, lambda: quotes.rent(0))
    rows = []
    for name, percent in COMPARE_VARIANTS:
        policy = Policy(name, percent)
        plans = [plan_program(spec, policy, quotes, chunk) for spec in specs]
        totals, _ = compute_totals(plans, fee_reserve, operator_reserve)
        rows.append((policy, sum(p.max_len for p in plans), totals))
    warnings = quotes.sanity()
    base = rows[0][2]
    if args.json:
        out.write(json.dumps({
            "tool": "devnet-deploy-estimator", "schema": 1, "command": "compare",
            "rpc": {"endpoint": redact_url(args.rpc), "genesisHash": genesis, "cluster": cluster_name(genesis)},
            "derivedLamportsPerByte": quotes.derived_lamports_per_byte(),
            "variants": [{"policy": p.name, "headroomPercent": p.headroom_percent, "multiplier": p.multiplier,
                          "totalMaxLen": total_len, "permanentLamports": t.permanent,
                          "minStartBalanceLamports": t.min_start_balance,
                          "extraVsExactLamports": t.permanent - base.permanent} for p, total_len, t in rows],
            "warnings": warnings, "rpcAudit": getattr(rpc, "audit", []),
        }, ensure_ascii=False, indent=2) + "\n")
        return EXIT_OK
    rate = quotes.derived_lamports_per_byte()
    out.write(f"RPC: {redact_url(args.rpc)}; кластер: {cluster_name(genesis)}; программ: {len(specs)}, "
              f"сумма .so: {sum(s.size for s in specs)} Б\n")
    if rate is not None:
        out.write(f"Ставка из RPC (производная, справочно): {rate:.2f} lamports/байт\n")
    out.write(f"Резервы: комиссии {fmt_sol(fee_reserve, 3)} SOL, оператор {fmt_sol(operator_reserve, 3)} SOL "
              "(одинаковы во всех строках)\n\n")
    table = [["политика", "Σ max_len, Б", "заблокировано, SOL", "+к exact, SOL", "мин. старт. баланс, SOL"]]
    for policy, total_len, totals in rows:
        table.append([policy.label() if policy.name != "headroom" else f"headroom {policy.headroom_percent}% ({policy.multiplier})",
                      str(total_len), fmt_sol(totals.permanent), fmt_sol(totals.permanent - base.permanent),
                      fmt_sol(totals.min_start_balance)])
    widths = [max(len(r[i]) for r in table) for i in range(len(table[0]))]
    for index, row in enumerate(table):
        out.write("  ".join(c.ljust(widths[i]) if i == 0 else c.rjust(widths[i]) for i, c in enumerate(row)) + "\n")
        if index == 0:
            out.write("  ".join("-" * w for w in widths) + "\n")
    for warning in warnings:
        out.write(f"! {warning}\n")
    return EXIT_OK


def cmd_max_len(args: argparse.Namespace, out: Any) -> int:
    policy = _policy_from_args(args)
    size = os.path.getsize(args.so) if args.so and os.path.exists(args.so) else None
    if size is None:
        raise EstimatorError(f"нет файла программы {args.so}")
    max_len = policy.max_len(size)
    check_capacity(pathlib.Path(args.so).stem, size, max_len)
    out.write(f"{max_len}\n")
    return EXIT_OK


def cmd_check_policy(args: argparse.Namespace, out: Any) -> int:
    policy = _policy_from_args(args)
    out.write(f"{policy.label()}\n")
    return EXIT_OK


def cmd_cluster(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    genesis = _genesis(rpc, args.expect_genesis)
    out.write(f"{genesis} {cluster_name(genesis)}\n")
    return EXIT_OK


def stray_buffers(rpc: Any, authority: str) -> List[Tuple[str, int]]:
    """Buffer-аккаунты с этим authority — тот же фильтр, что у `solana program show --buffers`."""
    pubkey_bytes(authority)
    filters = [
        {"memcmp": {"offset": 0, "bytes": b58encode(struct.pack("<I", STATE_BUFFER))}},
        {"memcmp": {"offset": ACCOUNT_TYPE_SIZE, "bytes": b58encode(b"\x01")}},
        {"memcmp": {"offset": ACCOUNT_TYPE_SIZE + OPTION_TAG_SIZE, "bytes": authority}},
    ]
    result = rpc.call("getProgramAccounts", [LOADER, {"encoding": "base64", "filters": filters,
                                                       "dataSlice": {"offset": 0, "length": 0}}])
    if not isinstance(result, list):
        raise EstimatorError("RPC вернул getProgramAccounts не списком", EXIT_RPC)
    found = []
    for row in result:
        try:
            found.append((row["pubkey"], _as_lamports(row["account"]["lamports"], "lamports буфера")))
        except (KeyError, TypeError):
            raise EstimatorError("RPC вернул строку getProgramAccounts неожиданной формы", EXIT_RPC)
    return found


def cmd_buffers(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    found = stray_buffers(rpc, args.authority)
    if args.json:
        out.write(json.dumps({"authority": args.authority,
                              "buffers": [{"address": a, "lamports": l} for a, l in found]}, indent=2) + "\n")
        return EXIT_OK
    if not found:
        out.write("Buffer-аккаунтов оператора нет: незавершённых деплоев не видно.\n")
        return EXIT_OK
    total = sum(l for _, l in found)
    out.write(f"Найдено buffer-аккаунтов оператора: {len(found)}, в них заперто {fmt_sol(total, 9)} SOL "
              "(в баланс для расчёта НЕ засчитываются).\n")
    for address, lamports in found:
        out.write(f"  {address}  {fmt_sol(lamports, 9)} SOL\n")
    out.write("Скрипт их НЕ закрывает. Решение принимает владелец после проверки:\n"
              "  * продолжить прерванный деплой нужно keypair'ом буфера (seed phrase показывает CLI при сбое): "
              "solana program deploy --buffer <keypair>\n"
              "  * вернуть SOL, если деплой не нужен: solana program close <АДРЕС> --url <RPC> --keypair <ключ оператора>\n")
    return EXIT_OK


def _account_info(rpc: Any, address: str, commitment: str, data_slice: Optional[Dict[str, int]] = None) -> Optional[Dict[str, Any]]:
    config: Dict[str, Any] = {"encoding": "base64", "commitment": commitment}
    if data_slice is not None:
        config["dataSlice"] = data_slice
    result = rpc.call("getAccountInfo", [address, config])
    value = result.get("value") if isinstance(result, dict) else None
    return value if isinstance(value, dict) else None


def _account_bytes(info: Dict[str, Any]) -> bytes:
    data = info.get("data")
    if not (isinstance(data, list) and data and isinstance(data[0], str)):
        raise EstimatorError("RPC вернул аккаунт без base64-данных", EXIT_RPC)
    return base64.b64decode(data[0])


def check_state_header(data: bytes, expected_state: int, label: str) -> None:
    if len(data) < ACCOUNT_TYPE_SIZE or struct.unpack("<I", data[:ACCOUNT_TYPE_SIZE])[0] != expected_state:
        raise EstimatorError(f"{label}: тип состояния не {expected_state} (ожидался вариант загрузчика)", EXIT_VERIFY)


def verify_layout(rpc: Any, program: Optional[str], buffer: Optional[str], commitment: str) -> List[str]:
    """Доказывает 36/45/37 на живом RPC: длина Program и позиция ELF в ProgramData/Buffer."""
    report: List[str] = []
    if program:
        info = _account_info(rpc, program, commitment)
        if info is None:
            raise EstimatorError(f"Program {program} не найден в сети", EXIT_VERIFY)
        if info.get("owner") != LOADER:
            raise EstimatorError(f"Program {program} принадлежит {info.get('owner')}, а не upgradeable-загрузчику", EXIT_VERIFY)
        data = _account_bytes(info)
        check_state_header(data, STATE_PROGRAM, "Program")
        if len(data) != PROGRAM_SIZE:
            raise EstimatorError(f"длина Program-аккаунта {len(data)} Б, ожидалось {PROGRAM_SIZE}", EXIT_VERIFY)
        report.append(f"Program: {len(data)} Б (ожидалось {PROGRAM_SIZE}) ✓")
        programdata = b58encode(data[ACCOUNT_TYPE_SIZE:PROGRAM_SIZE])
        head = _account_info(rpc, programdata, commitment, {"offset": 0, "length": PROGRAMDATA_METADATA_SIZE + len(ELF_MAGIC)})
        if head is None:
            raise EstimatorError(f"ProgramData {programdata} не найден (программа закрыта?)", EXIT_VERIFY)
        raw = _account_bytes(head)
        check_state_header(raw, STATE_PROGRAMDATA, "ProgramData")
        if raw[PROGRAMDATA_METADATA_SIZE:PROGRAMDATA_METADATA_SIZE + len(ELF_MAGIC)] != ELF_MAGIC:
            raise EstimatorError(f"ELF в ProgramData не со смещения {PROGRAMDATA_METADATA_SIZE}", EXIT_VERIFY)
        report.append(f"ProgramData: ELF-магия на смещении {PROGRAMDATA_METADATA_SIZE} ✓")
    if buffer:
        head = _account_info(rpc, buffer, commitment, {"offset": 0, "length": BUFFER_METADATA_SIZE + len(ELF_MAGIC)})
        if head is None:
            raise EstimatorError(f"Buffer {buffer} не найден", EXIT_VERIFY)
        raw = _account_bytes(head)
        check_state_header(raw, STATE_BUFFER, "Buffer")
        if raw[BUFFER_METADATA_SIZE:BUFFER_METADATA_SIZE + len(ELF_MAGIC)] != ELF_MAGIC:
            raise EstimatorError(f"ELF в Buffer не со смещения {BUFFER_METADATA_SIZE}", EXIT_VERIFY)
        report.append(f"Buffer: ELF-магия на смещении {BUFFER_METADATA_SIZE} ✓")
    if not report:
        raise EstimatorError("укажите --program и/или --buffer")
    return report


def cmd_verify_layout(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    for line in verify_layout(rpc, args.program_id, args.buffer, args.commitment):
        out.write(line + "\n")
    return EXIT_OK


def verify_deployed(rpc: Any, spec: ProgramSpec, max_len: int, authority: str, commitment: str,
                    wait_seconds: float = 0.0, sleep: Callable[[float], None] = time.sleep) -> List[str]:
    """После деплоя: аккаунт есть, исполняемый, владелец — загрузчик, authority и ёмкость ожидаемые,
    байткод в сети равен локальному артефакту."""
    deadline = time.monotonic() + wait_seconds
    info = _account_info(rpc, spec.address, commitment)
    while info is None and time.monotonic() < deadline:
        sleep(2.0)
        info = _account_info(rpc, spec.address, commitment)
    if info is None:
        raise EstimatorError(f"{spec.name}: аккаунт {spec.address} не найден после деплоя", EXIT_VERIFY)
    if info.get("owner") != LOADER:
        raise EstimatorError(f"{spec.name}: владелец {info.get('owner')} — не upgradeable-загрузчик", EXIT_VERIFY)
    if info.get("executable") is not True:
        raise EstimatorError(f"{spec.name}: аккаунт не помечен исполняемым", EXIT_VERIFY)
    data = _account_bytes(info)
    check_state_header(data, STATE_PROGRAM, f"{spec.name}: Program")
    if len(data) != PROGRAM_SIZE:
        raise EstimatorError(f"{spec.name}: Program-аккаунт {len(data)} Б вместо {PROGRAM_SIZE}", EXIT_VERIFY)
    programdata = b58encode(data[ACCOUNT_TYPE_SIZE:PROGRAM_SIZE])
    head = _account_info(rpc, programdata, commitment, {"offset": 0, "length": PROGRAMDATA_METADATA_SIZE})
    if head is None:
        raise EstimatorError(f"{spec.name}: ProgramData {programdata} не найден", EXIT_VERIFY)
    raw = _account_bytes(head)
    check_state_header(raw, STATE_PROGRAMDATA, f"{spec.name}: ProgramData")
    option_tag = raw[ACCOUNT_TYPE_SIZE + SLOT_SIZE]
    actual_authority = b58encode(raw[ACCOUNT_TYPE_SIZE + SLOT_SIZE + OPTION_TAG_SIZE:PROGRAMDATA_METADATA_SIZE]) if option_tag == 1 else "none"
    if actual_authority != authority:
        raise EstimatorError(f"{spec.name}: upgrade authority {actual_authority}, ожидался {authority}", EXIT_VERIFY)
    space = head.get("space")
    if not isinstance(space, int) or isinstance(space, bool):
        raise EstimatorError(f"{spec.name}: RPC не вернул размер ProgramData (space) — ёмкость не проверить", EXIT_VERIFY)
    if space != PROGRAMDATA_METADATA_SIZE + max_len:
        raise EstimatorError(f"{spec.name}: ёмкость ProgramData {space - PROGRAMDATA_METADATA_SIZE} Б, ожидалось max_len={max_len}", EXIT_VERIFY)
    body = _account_info(rpc, programdata, commitment, {"offset": PROGRAMDATA_METADATA_SIZE, "length": spec.size})
    if body is None:
        raise EstimatorError(f"{spec.name}: не удалось прочитать байткод из ProgramData", EXIT_VERIFY)
    on_chain = _account_bytes(body)
    local = pathlib.Path(spec.so_path).read_bytes()
    if hashlib.sha256(on_chain).hexdigest() != hashlib.sha256(local).hexdigest():
        raise EstimatorError(f"{spec.name}: байткод в сети НЕ совпадает с {spec.so_path}", EXIT_VERIFY)
    return [f"{spec.name}: исполняемый, владелец — upgradeable-загрузчик, authority {authority}",
            f"{spec.name}: ёмкость {max_len} Б = max_len, ProgramData {programdata}",
            f"{spec.name}: sha256 байткода {hashlib.sha256(local).hexdigest()[:16]}… совпал с локальным .so"]


def cmd_verify_deployed(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    spec = parse_program_arg(args.program[0])
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    pubkey_bytes(args.authority)
    for line in verify_deployed(rpc, spec, args.max_len, args.authority, args.commitment, args.wait_seconds):
        out.write(f"   ✓ {line}\n")
    return EXIT_OK


def upgrade_state(rpc: Any, spec: ProgramSpec, commitment: str) -> Tuple[str, int, str]:
    """Чем байткод в сети отличается от локальной сборки: `same` или `different`.

    Зачем отдельная команда. `verify-deployed` строго требует, чтобы ёмкость
    ProgramData совпала с `--max-len`. Для уже развёрнутой программы это неверно:
    ёмкость уменьшить нельзя (у загрузчика есть только ExtendProgram), а CLI при
    upgrade сам расширяет ProgramData, если новая сборка не помещается
    (`cli/src/program.rs` v4.2.1, `auto_extend`; минимум расширения — 10 KiB,
    SIMD-0431). Поэтому здесь сверяется то, что действительно решает, нужен ли
    upgrade: исполняемый аккаунт, upgradeable-загрузчик, читаемая authority,
    валидный заголовок ProgramData и sha256 байткода против локального .so.
    """
    info = _account_info(rpc, spec.address, commitment)
    if info is None:
        raise EstimatorError(f"{spec.name}: аккаунт {spec.address} не найден в сети", EXIT_VERIFY)
    if info.get("owner") != LOADER:
        raise EstimatorError(f"{spec.name}: владелец {info.get('owner')} — не upgradeable-загрузчик", EXIT_VERIFY)
    if info.get("executable") is not True:
        raise EstimatorError(f"{spec.name}: аккаунт не помечен исполняемым", EXIT_VERIFY)
    data = _account_bytes(info)
    check_state_header(data, STATE_PROGRAM, f"{spec.name}: Program")
    if len(data) != PROGRAM_SIZE:
        raise EstimatorError(f"{spec.name}: Program-аккаунт {len(data)} Б вместо {PROGRAM_SIZE}", EXIT_VERIFY)
    programdata = b58encode(data[ACCOUNT_TYPE_SIZE:PROGRAM_SIZE])
    head = _account_info(rpc, programdata, commitment, {"offset": 0, "length": PROGRAMDATA_METADATA_SIZE})
    if head is None:
        raise EstimatorError(f"{spec.name}: ProgramData {programdata} не найден", EXIT_VERIFY)
    raw = _account_bytes(head)
    check_state_header(raw, STATE_PROGRAMDATA, f"{spec.name}: ProgramData")
    option_tag = raw[ACCOUNT_TYPE_SIZE + SLOT_SIZE]
    authority = b58encode(raw[ACCOUNT_TYPE_SIZE + SLOT_SIZE + OPTION_TAG_SIZE:PROGRAMDATA_METADATA_SIZE]) if option_tag == 1 else "none"
    if authority == "none":
        raise EstimatorError(f"{spec.name}: upgrade authority снята (--final) — обновить программу нельзя", EXIT_VERIFY)
    space = head.get("space")
    if not isinstance(space, int) or isinstance(space, bool) or space < PROGRAMDATA_METADATA_SIZE:
        raise EstimatorError(f"{spec.name}: RPC не вернул размер ProgramData (space) — ёмкость не прочитать", EXIT_VERIFY)
    body = _account_info(rpc, programdata, commitment, {"offset": PROGRAMDATA_METADATA_SIZE, "length": spec.size})
    if body is None:
        raise EstimatorError(f"{spec.name}: не удалось прочитать байткод из ProgramData", EXIT_VERIFY)
    on_chain = _account_bytes(body)
    local = pathlib.Path(spec.so_path).read_bytes()
    state = "same" if hashlib.sha256(on_chain).hexdigest() == hashlib.sha256(local).hexdigest() else "different"
    return state, space - PROGRAMDATA_METADATA_SIZE, authority


def cmd_upgrade_state(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    spec = parse_program_arg(args.program[0])
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    state, capacity, authority = upgrade_state(rpc, spec, args.commitment)
    out.write(f"state: {state}\n")
    out.write(f"capacity: {capacity}\n")
    out.write(f"authority: {authority}\n")
    out.write(f"so: {spec.so_path}\n")
    return EXIT_OK


# --- измерение на локальном валидаторе ----------------------------------------
def require_local_validator(rpc: Any, url: str) -> str:
    """Эксперимент с жизненным циклом — только на локальном валидаторе: по адресу И по genesis."""
    host = urllib.parse.urlsplit(url).hostname
    if host not in LOCAL_HOSTS:
        raise EstimatorError(f"analyze-history работает только с локальным валидатором (127.0.0.1/localhost), а не с {redact_url(url)}: "
                             "эксперимент с буферами не выполняется на публичных сетях", EXIT_CLUSTER)
    genesis = rpc.call("getGenesisHash", [])
    for name, known in PUBLIC_GENESIS.items():
        if genesis == known:
            raise EstimatorError(f"RPC на локальном адресе отвечает genesis публичной сети {name} (проброшенный порт/прокси?): "
                                 "ни одного чтения истории", EXIT_CLUSTER)
    return str(genesis)


@dataclass
class HistoryTx:
    signature: str
    slot: int
    fee: int
    pre: int    # баланс плательщика до транзакции
    post: int   # после


@dataclass
class HistoryReport:
    start_balance: int
    transactions: List[HistoryTx]
    peak_outflow: int
    peak_signature: str
    final_outflow: int
    fees: int

    @property
    def transient_peak(self) -> int:
        return self.peak_outflow - self.final_outflow

    @property
    def locked(self) -> int:
        """Отток минус комиссии: то, что действительно лежит в созданных аккаунтах."""
        return self.final_outflow - self.fees


def fetch_history(rpc: Any, payer: str, commitment: str, after_signature: Optional[str] = None,
                  limit: int = 1000) -> List[HistoryTx]:
    """Транзакции, ОПЛАЧЕННЫЕ плательщиком (он — первый ключ), по порядку выполнения. Airdrop платит фаусет — не попадает."""
    rows = rpc.call("getSignaturesForAddress", [payer, {"limit": limit, "commitment": commitment}])
    if not isinstance(rows, list):
        raise EstimatorError("RPC вернул getSignaturesForAddress не списком", EXIT_RPC)
    ordered = [r for r in reversed(rows) if isinstance(r, dict) and r.get("err") is None]
    if after_signature is not None:
        known = [r["signature"] for r in ordered]
        if after_signature not in known:
            raise EstimatorError(f"подпись {after_signature} не найдена в истории плательщика", EXIT_USAGE)
        ordered = ordered[known.index(after_signature) + 1:]
    result: List[HistoryTx] = []
    for row in ordered:
        tx = rpc.call("getTransaction", [row["signature"], {"encoding": "json", "commitment": commitment, "maxSupportedTransactionVersion": 0}])
        if not isinstance(tx, dict) or not isinstance(tx.get("meta"), dict):
            raise EstimatorError(f"RPC не вернул транзакцию {row['signature']}", EXIT_RPC)
        keys = tx["transaction"]["message"]["accountKeys"]
        if not keys or keys[0] != payer:
            continue  # плательщик участвовал, но не платил (airdrop, входящий перевод)
        meta = tx["meta"]
        result.append(HistoryTx(signature=row["signature"], slot=int(row["slot"]), fee=_as_lamports(meta["fee"], "комиссия"),
                                pre=_as_lamports(meta["preBalances"][0], "баланс до"), post=_as_lamports(meta["postBalances"][0], "баланс после")))
    return result


def analyze_outflow(txs: Sequence[HistoryTx]) -> HistoryReport:
    """Накопленный отток по границам транзакций: пик, итог, комиссии. Внутри транзакции баланс виден только по итогу."""
    if not txs:
        raise EstimatorError("в истории плательщика нет оплаченных им транзакций — нечего измерять", EXIT_USAGE)
    start = txs[0].pre
    peak, peak_sig = 0, txs[0].signature
    for tx in txs:
        outflow = start - tx.post
        if outflow > peak:
            peak, peak_sig = outflow, tx.signature
    return HistoryReport(start_balance=start, transactions=list(txs), peak_outflow=peak, peak_signature=peak_sig,
                         final_outflow=start - txs[-1].post, fees=sum(t.fee for t in txs))


def compare_with_model(report: HistoryReport, plans: Sequence[ProgramPlan]) -> List[Tuple[str, bool, bool, str]]:
    """Сверка измерения с моделью: (проверка, совпало, критична ли, пояснение).

    Критичны только две: сколько действительно заблокировано и нет ли переходного пика. Комиссии справочные:
    они зависят от размера чанка записи и повторных отправок, то есть от версии CLI, и их расхождение не опровергает модель rent.
    """
    permanent = sum(p.permanent for p in plans)
    modelled_fees = sum(p.fees for p in plans)
    modelled_txs = sum(p.write_transactions + 2 for p in plans)  # create_buffer + Write×N + deploy
    return [
        ("заблокировано в аккаунтах (итоговый отток − комиссии) = rent(Program)+rent(ProgramData) всех программ",
         report.locked == permanent, True, f"измерено {report.locked}, модель {permanent} lamports"),
        ("переходный пик сверх итога = 0 (буфер возвращается плательщику до оплаты ProgramData)",
         report.transient_peak == 0, True, f"измерено {report.transient_peak} lamports"),
        ("комиссии равны модели (справочно: зависят от чанка записи/повторов)",
         report.fees == modelled_fees, False,
         f"измерено {report.fees}, модель {modelled_fees} lamports; транзакций {len(report.transactions)}, в модели {modelled_txs}"),
    ]


def cmd_analyze_history(args: argparse.Namespace, rpc_factory: Callable[..., Any], out: Any) -> int:
    rpc = rpc_factory(args.rpc, timeout=args.timeout)
    genesis = require_local_validator(rpc, args.rpc)
    pubkey_bytes(args.payer)
    report = analyze_outflow(fetch_history(rpc, args.payer, args.commitment, args.after_signature, args.max_transactions))
    out.write(f"Локальный валидатор (genesis {genesis[:12]}…); плательщик {args.payer}; оплаченных транзакций: {len(report.transactions)}\n")
    out.write(f"Баланс на старте окна: {fmt_sol(report.start_balance, 9)} SOL\n\n")
    out.write(f"{'подпись':<14} {'слот':>8} {'комиссия':>10} {'баланс после, SOL':>20} {'накопл. отток, SOL':>20}\n")
    for tx in report.transactions:
        out.write(f"{tx.signature[:12]:<14} {tx.slot:>8} {tx.fee:>10} {fmt_sol(tx.post, 9):>20} {fmt_sol(report.start_balance - tx.post, 9):>20}\n")
    out.write(f"\nПик накопленного оттока: {fmt_sol(report.peak_outflow, 9)} SOL (транзакция {report.peak_signature[:12]})\n")
    out.write(f"Итоговый отток:          {fmt_sol(report.final_outflow, 9)} SOL, из них комиссии {fmt_sol(report.fees, 9)} SOL\n")
    out.write(f"Переходный пик сверх итога: {fmt_sol(report.transient_peak, 9)} SOL; заблокировано в аккаунтах: {fmt_sol(report.locked, 9)} SOL\n")
    out.write("Пик виден только по границам транзакций: внутри одной транзакции (например, deploy) баланс известен лишь по итогу.\n")
    if not args.program:
        return EXIT_OK
    quotes = RpcQuotes(rpc, args.commitment)
    chunk = args.write_chunk_bytes or write_chunk_size()
    plans = []
    for text in args.program:
        spec = parse_program_arg(text)
        plans.append(_plan_with_max_len(spec, args.max_len or spec.size, quotes, chunk))
    out.write("\nСверка с моделью (rent и комиссии — по ответам ЭТОГО локального валидатора):\n")
    verdict = True
    for name, passed, critical, detail in compare_with_model(report, plans):
        verdict = verdict and (passed or not critical)
        mark = "✓" if passed else ("✗" if critical else "⚠")
        out.write(f"  {mark} {name}: {detail}\n")
    out.write("\nМОДЕЛЬ ПОДТВЕРЖДЕНА на этом валидаторе.\n" if verdict
              else "\nМОДЕЛЬ НЕ ПОДТВЕРЖДЕНА: расхождение выше — не доверяйте таблице оценщика, пока причина не найдена.\n")
    return EXIT_OK if verdict else EXIT_VERIFY


def _plan_with_max_len(spec: ProgramSpec, max_len: int, quotes: Any, chunk: int) -> ProgramPlan:
    check_capacity(spec.name, spec.size, max_len)
    programdata_len = PROGRAMDATA_METADATA_SIZE + max_len
    programdata_rent = quotes.rent(programdata_len)
    return ProgramPlan(spec=spec, max_len=max_len, headroom_bytes=max_len - spec.size, programdata_len=programdata_len,
                       program_rent=quotes.rent(PROGRAM_SIZE), programdata_rent=programdata_rent,
                       buffer_len=BUFFER_METADATA_SIZE + spec.size, buffer_funding=programdata_rent,
                       write_transactions=-(-spec.size // chunk), fee_create=quotes.fee(SIGNATURES_CREATE_BUFFER),
                       fee_write=quotes.fee(SIGNATURES_WRITE), fee_deploy=quotes.fee(SIGNATURES_DEPLOY))


# --- CLI ---------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p: argparse.ArgumentParser, network: bool = True) -> None:
        if network:
            p.add_argument("--rpc", default=os.environ.get("RPC_URL", DEFAULT_RPC), help="RPC URL (по умолчанию RPC_URL или devnet)")
            p.add_argument("--timeout", type=float, default=float(os.environ.get("AOF_RPC_TIMEOUT", "20")))
            p.add_argument("--commitment", default="confirmed", choices=["processed", "confirmed", "finalized"])

    def programs(p: argparse.ArgumentParser) -> None:
        p.add_argument("--program", action="append", metavar="ИМЯ:АДРЕС:SO", help="программа к деплою (повторяемый)")
        p.add_argument("--from-registry", action="store_true", help="взять программы из watchtower/addresses.json")
        p.add_argument("--artifacts", default="target/deploy", help="каталог .so для --from-registry")
        p.add_argument("--only", help="имена через запятую для --from-registry")
        p.add_argument("--write-chunk-bytes", type=int, default=0, help="переопределить размер чанка записи")
        p.add_argument("--fee-reserve-sol", help="явный резерв комиссий в SOL (env DEPLOY_FEE_RESERVE_SOL, по умолчанию 0.1)")
        p.add_argument("--operator-reserve-sol", help="явный резерв оператора в SOL (env OPERATOR_RESERVE_SOL, по умолчанию 1)")
        p.add_argument("--expect-genesis", default=DEVNET_GENESIS, help="ожидаемый genesis (по умолчанию devnet)")
        p.add_argument("--no-genesis-check", action="store_true", help="не сверять genesis (только для локального валидатора)")
        p.add_argument("--json", action="store_true", help="машиночитаемый вывод с журналом RPC")

    def policy_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--policy", choices=None, help="exact | headroom | legacy-2x (env PROGRAM_MAX_LEN_POLICY)")
        p.add_argument("--headroom-percent", help="1..99 для headroom (env PROGRAM_MAX_LEN_HEADROOM_PERCENT)")

    p_plan = sub.add_parser("plan", help="таблица стоимости и проверка баланса")
    common(p_plan); programs(p_plan); policy_args(p_plan)
    p_plan.add_argument("--payer", help="адрес плательщика: включает проверку баланса")

    p_compare = sub.add_parser("compare", help="сравнить политики max_len")
    common(p_compare); programs(p_compare)

    p_maxlen = sub.add_parser("max-len", help="max_len для одного .so (без сети)")
    policy_args(p_maxlen)
    p_maxlen.add_argument("--so", required=True)

    p_policy = sub.add_parser("check-policy", help="проверить политику (без сети)")
    policy_args(p_policy)

    p_cluster = sub.add_parser("cluster", help="genesis-hash RPC")
    common(p_cluster)
    p_cluster.add_argument("--expect-genesis", default=DEVNET_GENESIS)

    p_buffers = sub.add_parser("buffers", help="buffer-аккаунты оператора (read-only)")
    common(p_buffers)
    p_buffers.add_argument("--authority", required=True)
    p_buffers.add_argument("--json", action="store_true")

    p_layout = sub.add_parser("verify-layout", help="доказать размеры 36/45/37 на живом RPC")
    common(p_layout)
    p_layout.add_argument("--program-id", help="адрес существующей upgradeable-программы")
    p_layout.add_argument("--buffer", help="адрес существующего Buffer")

    p_history = sub.add_parser("analyze-history", help="измерение на ЛОКАЛЬНОМ валидаторе: пик/итог оттока и сверка с моделью")
    common(p_history)
    p_history.add_argument("--payer", required=True, help="адрес плательщика (throwaway-ключ локального эксперимента)")
    p_history.add_argument("--after-signature", help="начать окно после этой подписи (исключая её)")
    p_history.add_argument("--max-transactions", type=int, default=1000)
    p_history.add_argument("--program", action="append", metavar="ИМЯ:АДРЕС:SO", help="сверить окно с моделью для этих программ")
    p_history.add_argument("--max-len", type=int, default=0, help="max_len, с которым программы деплоились (по умолчанию размер .so)")
    p_history.add_argument("--write-chunk-bytes", type=int, default=0)

    p_deployed = sub.add_parser("verify-deployed", help="проверка после деплоя")
    common(p_deployed)
    p_deployed.add_argument("--program", action="append", required=True, metavar="ИМЯ:АДРЕС:SO")
    p_deployed.add_argument("--max-len", type=int, required=True)
    p_deployed.add_argument("--authority", required=True)
    p_deployed.add_argument("--wait-seconds", type=float, default=30.0)

    p_upgrade = sub.add_parser("upgrade-state", help="нужен ли upgrade уже развёрнутой программы (read-only)")
    common(p_upgrade)
    p_upgrade.add_argument("--program", action="append", required=True, metavar="ИМЯ:АДРЕС:SO")
    return parser


def main(argv: Optional[Sequence[str]] = None, rpc_factory: Callable[..., Any] = Rpc,
         out: Any = None, err: Any = None) -> int:
    out = out or sys.stdout
    err = err or sys.stderr
    args = build_parser().parse_args(argv)
    try:
        if args.command == "plan":
            return cmd_plan(args, rpc_factory, out, err)
        if args.command == "compare":
            return cmd_compare(args, rpc_factory, out)
        if args.command == "max-len":
            return cmd_max_len(args, out)
        if args.command == "check-policy":
            return cmd_check_policy(args, out)
        if args.command == "cluster":
            return cmd_cluster(args, rpc_factory, out)
        if args.command == "buffers":
            return cmd_buffers(args, rpc_factory, out)
        if args.command == "verify-layout":
            return cmd_verify_layout(args, rpc_factory, out)
        if args.command == "verify-deployed":
            return cmd_verify_deployed(args, rpc_factory, out)
        if args.command == "upgrade-state":
            return cmd_upgrade_state(args, rpc_factory, out)
        if args.command == "analyze-history":
            return cmd_analyze_history(args, rpc_factory, out)
    except EstimatorError as exc:
        err.write(f"ОТКАЗ: {exc}\n")
        return exc.code
    return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main())
