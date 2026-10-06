#!/usr/bin/env python3
"""Офлайн-тесты `scripts/devnet-deploy-estimator.py` (оценщик стоимости деплоя).

Оценщик решает, хватит ли SOL на деплой, ещё ДО первой транзакции. Ошибка здесь
значит либо деплой, который встанет на середине и оставит заблокированные
buffer-аккаунты, либо необоснованный отказ. Поэтому тесты пинят то, что
раньше жило в одноразовом фрагменте и в чьей-то голове:

  * rent и комиссии берутся только из ответов RPC (ставка в тестах 6960, 5080 и
    696 — расчёт обязан следовать за ней; в исходнике нет ни одной ставки);
  * размеры метаданных Program/ProgramData/Buffer = 36/45/37 и чанк записи;
  * политика max_len явная: пустая/неизвестная/вне диапазона — отказ;
  * баланс считается по накопленному оттоку ВСЕХ программ, а не по самой
    большой и не суммой всех буферов поверх постоянной ренты;
  * резервы — отдельными строками; дефицит — отказ с кодом 4;
  * не тот кластер, мёртвый RPC, мусор в ответе — отказ, а не «оценка наугад»;
  * оценщик только читает: ни одного метода, меняющего состояние.

Запуск: python3 scripts/test-devnet-deploy-estimator.py
"""
import contextlib
import importlib.util
import io
import json
import os
import pathlib
import re
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import devnet_mock_rpc as mockrpc  # noqa: E402

SCRIPT = HERE / "devnet-deploy-estimator.py"
spec = importlib.util.spec_from_file_location("devnet_deploy_estimator", SCRIPT)
est = importlib.util.module_from_spec(spec)
spec.loader.exec_module(est)

PAYER = "FHQd3FrsR73ieA9KcR87ULrbkPgKBPJEvNkXKm8oF4nF"
# Offline estimator fixtures use unrelated deterministic ids. Never embed the
# live Program IDs here: rotate-program-ids checks the entire tree for stale calls.
ADDRESSES = {
    "aof_core": "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi",
    "aof_market": "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
    "aof_quests": "CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8",
    "aof_liquidity": "GgBaCs3NCBuZN12kCJgAW63ydqohFkHEdfdEXBPzLHq",
    "aof_sessions": "LbUiWL3xVV8hTFYBVdbTNrpDo41NKS6o3LHHuDzjfcY",
}
SOL = 1_000_000_000
# Независимая от оценщика формула rent: проверяем, что он её не подсовывает сам.
rent_of = lambda rate, length: (128 + length) * rate  # noqa: E731


class FakeQuotes:
    """Котировки без сети: оценщик получает их через тот же интерфейс, что и от RPC."""

    def __init__(self, rate=5080, overhead=128, fee=5000):
        self.rate, self.overhead, self.fee_per_signature = rate, overhead, fee
        self.rent_calls = []

    def rent(self, length):
        self.rent_calls.append(length)
        return (self.overhead + length) * self.rate

    def fee(self, signatures):
        return signatures * self.fee_per_signature


def make_specs(directory, sizes):
    specs = []
    for index, (name, size) in enumerate(sizes.items()):
        address = list(ADDRESSES.values())[index % len(ADDRESSES)]
        path = pathlib.Path(directory) / f"{name}.so"
        path.write_bytes(mockrpc.fake_so(address, size))
        specs.append(est.ProgramSpec(name=name, address=address, so_path=str(path), size=size))
    return specs


def run_main(argv, rpc_url=None, env=None):
    out, err = io.StringIO(), io.StringIO()
    argv = list(argv)
    if rpc_url:
        argv += ["--rpc", rpc_url]
    clean = {k: v for k, v in os.environ.items() if k not in (
        "PROGRAM_MAX_LEN_POLICY", "PROGRAM_MAX_LEN_HEADROOM_PERCENT", "OPERATOR_RESERVE_SOL",
        "DEPLOY_FEE_RESERVE_SOL", "RPC_URL")}
    clean.update(env or {})
    with mock.patch.dict(os.environ, clean, clear=True):
        code = est.main(argv, out=out, err=err)
    return code, out.getvalue(), err.getvalue()


class LayoutAndSource(unittest.TestCase):
    def test_metadata_sizes_match_the_sdk_constants(self):
        # solana-loader-v3-interface/src/state.rs: size_of_program 36, programdata_metadata 45, buffer_metadata 37
        self.assertEqual(est.PROGRAM_SIZE, 36)
        self.assertEqual(est.PROGRAMDATA_METADATA_SIZE, 45)
        self.assertEqual(est.BUFFER_METADATA_SIZE, 37)

    def test_write_chunk_matches_cli_calculation(self):
        # PACKET_DATA_SIZE 1232 - (65 подпись + 154 сообщение) - 1 = 1012; считается построением сообщения, не константой
        self.assertEqual(est.write_chunk_size(), 1012)

    def test_source_has_no_hardcoded_rent_rate(self):
        source = SCRIPT.read_text(encoding="utf-8")
        for rate in ("6960", "6333", "5080", "3480", "2575", "1322", "696"):
            self.assertIsNone(re.search(r"(?<![0-9A-Za-z])" + rate + r"(?![0-9A-Za-z])", source),
                              f"в оценщике зашита ставка {rate}: rent обязан приходить только из RPC")

    def test_source_never_sends_or_closes_anything(self):
        source = SCRIPT.read_text(encoding="utf-8")
        for forbidden in ("sendTransaction", "requestAirdrop", "simulateTransaction", "solana program close",
                          "subprocess", "os.system", "keypair.json"):
            self.assertNotIn(forbidden, source.replace("solana program close <АДРЕС>", ""),
                             f"оценщик не должен содержать {forbidden}")


class PolicyTests(unittest.TestCase):
    def test_missing_policy_is_refused_not_defaulted(self):
        for value in (None, "", "   "):
            with self.assertRaises(est.EstimatorError) as caught:
                est.resolve_policy(value, None)
            self.assertIn("PROGRAM_MAX_LEN_POLICY", str(caught.exception))
            self.assertIn("exact", str(caught.exception))

    def test_unknown_policy_is_refused(self):
        for value in ("double", "2x", "EXACT", "max", "legacy"):
            with self.assertRaises(est.EstimatorError):
                est.resolve_policy(value, None)

    def test_the_four_policies(self):
        self.assertEqual(est.resolve_policy("exact", None).headroom_percent, 0)
        self.assertEqual(est.resolve_policy("headroom", "10").headroom_percent, 10)
        self.assertEqual(est.resolve_policy("headroom", "15").headroom_percent, 15)
        self.assertEqual(est.resolve_policy("headroom", "25").headroom_percent, 25)
        self.assertEqual(est.resolve_policy("legacy-2x", None).headroom_percent, 100)

    def test_headroom_needs_a_valid_percent(self):
        for value in (None, "", "0", "100", "150", "-5", "1.5", "abc", "15%"):
            with self.assertRaises(est.EstimatorError, msg=f"percent={value!r}"):
                est.resolve_policy("headroom", value)

    def test_percent_with_exact_or_legacy_is_a_contradiction(self):
        with self.assertRaises(est.EstimatorError):
            est.resolve_policy("exact", "15")
        with self.assertRaises(est.EstimatorError):
            est.resolve_policy("legacy-2x", "15")

    def test_max_len_is_integer_and_rounds_up(self):
        self.assertEqual(est.Policy("exact", 0).max_len(123_457), 123_457)
        self.assertEqual(est.Policy("headroom", 10).max_len(1000), 1100)
        self.assertEqual(est.Policy("headroom", 15).max_len(1001), 1152)  # 1001*0.15 = 150.15 -> 151
        self.assertEqual(est.Policy("headroom", 25).max_len(2_400_000), 3_000_000)
        self.assertEqual(est.Policy("legacy-2x", 100).max_len(777), 1554)
        for policy in (est.Policy("headroom", 15), est.Policy("headroom", 1)):
            for size in (1, 7, 99, 100_003):
                self.assertGreaterEqual(policy.max_len(size) * 100, size * (100 + policy.headroom_percent))

    def test_capacity_checks(self):
        est.check_capacity("p", 1000, 1000)
        with self.assertRaises(est.EstimatorError) as caught:
            est.check_capacity("p", 1000, 999)
        self.assertIn("меньше размера", str(caught.exception))
        with self.assertRaises(est.EstimatorError):
            est.check_capacity("p", 0, 10)
        with self.assertRaises(est.EstimatorError):
            est.check_capacity("p", 10, "100")
        with self.assertRaises(est.EstimatorError):
            est.check_capacity("p", 10, True)
        # 45 + max_len не больше 10 MiB: ровно на границе проходит, на байт больше — нет
        edge = est.MAX_PERMITTED_DATA_LENGTH - est.PROGRAMDATA_METADATA_SIZE
        est.check_capacity("p", edge, edge)
        with self.assertRaises(est.EstimatorError) as caught:
            est.check_capacity("p", edge, edge + 1)
        self.assertIn("сетевого предела", str(caught.exception))


class MoneyTests(unittest.TestCase):
    def test_parse_sol_is_exact(self):
        self.assertEqual(est.parse_sol("0.1"), 100_000_000)
        self.assertEqual(est.parse_sol("1"), SOL)
        self.assertEqual(est.parse_sol("0.000000001"), 1)
        self.assertEqual(est.parse_sol("45.557"), 45_557_000_000)

    def test_parse_sol_rejects_garbage(self):
        for text in ("-1", "abc", "", "NaN", "Infinity", "0.0000000001", "1e-10"):
            with self.assertRaises(est.EstimatorError, msg=text):
                est.parse_sol(text)

    def test_fmt_sol(self):
        self.assertEqual(est.fmt_sol(1_500_000_000, 3), "1.500")
        self.assertEqual(est.fmt_sol(1, 9), "0.000000001")
        self.assertEqual(est.fmt_sol(-250_000_000, 2), "-0.25")


class PlanMath(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def plans(self, sizes, policy=None, quotes=None):
        quotes = quotes or FakeQuotes()
        policy = policy or est.Policy("exact", 0)
        return [est.plan_program(s, policy, quotes, 1012) for s in make_specs(self.tmp.name, sizes)], quotes

    def test_single_program_row_matches_independent_formula(self):
        (plan,), _ = self.plans({"aof_rebirth": 100_000})
        rate = 5080
        self.assertEqual(plan.max_len, 100_000)
        self.assertEqual(plan.programdata_len, 100_045)
        self.assertEqual(plan.buffer_len, 100_037)
        self.assertEqual(plan.programdata_rent, rent_of(rate, 100_045))
        self.assertEqual(plan.program_rent, rent_of(rate, 36))
        self.assertEqual(plan.permanent, rent_of(rate, 100_045) + rent_of(rate, 36))
        self.assertEqual(plan.write_transactions, 99)  # ceil(100000 / 1012)
        self.assertEqual(plan.fees, (2 + 99 + 2) * 5000)

    def test_rate_comes_from_the_quotes_not_from_the_code(self):
        results = {}
        for rate in (6960, 5080, 696):
            (plan,), _ = self.plans({"p": 50_000}, quotes=FakeQuotes(rate=rate))
            results[rate] = plan.permanent
            self.assertEqual(plan.permanent, rent_of(rate, 50_045) + rent_of(rate, 36))
        self.assertLess(results[696], results[5080])
        self.assertLess(results[5080], results[6960])

    def test_no_second_128_byte_overhead_is_added(self):
        # RPC, у которого вообще нет 128-байтной надбавки: оценщик обязан взять ответ как есть.
        quotes = FakeQuotes(rate=1000, overhead=0)
        (plan,), _ = self.plans({"p": 10_000}, quotes=quotes)
        self.assertEqual(plan.programdata_rent, 10_045 * 1000)
        self.assertEqual(plan.program_rent, 36 * 1000)
        self.assertEqual(sorted(set(quotes.rent_calls)), [36, 10_045])

    def test_policies_change_only_max_len_and_rent(self):
        base = {"p": 1_000_000}
        totals = {}
        for name, percent in est.COMPARE_VARIANTS:
            (plan,), _ = self.plans(base, policy=est.Policy(name, percent))
            totals[(name, percent)] = plan.permanent
            self.assertEqual(plan.spec.size, 1_000_000)
            self.assertEqual(plan.write_transactions, 989)  # запись не зависит от запаса
        ordered = [totals[v] for v in est.COMPARE_VARIANTS]
        self.assertEqual(ordered, sorted(ordered))
        self.assertEqual(len(set(ordered)), 5)

    def test_aggregate_is_permanent_of_all_programs_not_the_largest(self):
        sizes = {"aof_core": 2_000_000, "aof_market": 400_000, "aof_quests": 600_000,
                 "aof_liquidity": 300_000, "aof_session_keys": 280_000}
        plans, _ = self.plans(sizes)
        totals, simulation = est.compute_totals(plans, fee_reserve=0, operator_reserve=0)
        largest = max(p.permanent for p in plans)
        self.assertEqual(totals.permanent, sum(p.permanent for p in plans))
        self.assertGreater(totals.permanent, largest * 1.5)
        # деплой последовательный: рента прошлых программ остаётся заблокированной
        self.assertEqual(totals.peak_outflow, totals.permanent + totals.expected_fees)

    def test_buffers_are_not_stacked_on_top_of_permanent_rent(self):
        plans, _ = self.plans({"a": 500_000, "b": 500_000, "c": 500_000})
        totals, _ = est.compute_totals(plans, 0, 0)
        stacked = totals.permanent + sum(p.buffer_funding for p in plans) + totals.expected_fees
        self.assertLess(totals.min_start_balance, stacked)
        # загрузчик возвращает буфер плательщику ДО оплаты ProgramData -> пик равен итогу, сверх ничего
        self.assertEqual(totals.transient_peak, 0)

    def test_transient_peak_appears_only_if_the_buffer_were_returned_late(self):
        plans, _ = self.plans({"a": 300_000, "b": 200_000})

        class PayFirst(est.ProgramPlan):
            def events(self):  # гипотетический порядок: сначала платим ProgramData, потом возвращаем буфер
                name = self.spec.name
                return [(f"{name}: fee", self.fee_create + self.write_transactions * self.fee_write + self.fee_deploy),
                        (f"{name}: buffer", self.buffer_funding), (f"{name}: program", self.program_rent),
                        (f"{name}: programdata", self.programdata_rent), (f"{name}: drain", -self.buffer_funding)]

        for plan in plans:
            plan.__class__ = PayFirst
        simulation = est.simulate_outflow(plans)
        self.assertGreater(simulation.transient_peak, 0)
        self.assertEqual(simulation.transient_peak, plans[-1].buffer_funding)

    def test_events_order_follows_the_loader(self):
        (plan,), _ = self.plans({"p": 10_000})
        labels = [label for label, _ in plan.events()]
        joined = " | ".join(labels)
        self.assertLess(labels.index(next(l for l in labels if "создание Program" in l)),
                        labels.index(next(l for l in labels if "возвращает Buffer" in l)))
        self.assertLess(labels.index(next(l for l in labels if "возвращает Buffer" in l)),
                        labels.index(next(l for l in labels if "создание ProgramData" in l)), joined)

    def test_reserves_are_added_on_top_and_kept_separate(self):
        plans, _ = self.plans({"p": 100_000})
        totals, _ = est.compute_totals(plans, fee_reserve=100_000_000, operator_reserve=SOL)
        self.assertEqual(totals.min_start_balance, totals.peak_outflow + 100_000_000 + SOL)
        self.assertEqual(totals.fee_reserve, 100_000_000)
        self.assertEqual(totals.operator_reserve, SOL)

    def test_reconciles_the_previous_one_off_estimate(self):
        """45.557 SOL из прошлого расчёта = размеры из задачи × 2 × ставка devnet ~5080 (SIMD-0437-2), а не 6960."""
        mib = 1024 * 1024
        quoted = {"aof_core": 2.38, "aof_liquidity": 0.33, "aof_market": 0.42,
                  "aof_quests": 0.59, "aof_rebirth": 0.28, "aof_session_keys": 0.28}
        sizes = {name: round(value * mib) for name, value in quoted.items()}
        plans, _ = self.plans(sizes, policy=est.Policy("legacy-2x", 100), quotes=FakeQuotes(rate=5080))
        totals, _ = est.compute_totals(plans, 0, 0)
        self.assertAlmostEqual(totals.permanent / SOL, 45.6, delta=0.1)
        legacy_rate, _ = self.plans(sizes, policy=est.Policy("legacy-2x", 100), quotes=FakeQuotes(rate=6960))
        self.assertGreater(est.compute_totals(legacy_rate, 0, 0)[0].permanent / SOL, 62)
        exact, _ = self.plans(sizes, policy=est.Policy("exact", 0), quotes=FakeQuotes(rate=5080))
        self.assertAlmostEqual(est.compute_totals(exact, 0, 0)[0].permanent / SOL, 22.8, delta=0.1)


class WithMockRpc(unittest.TestCase):
    """Оценщик целиком: настоящий HTTP до поддельного узла, настоящий разбор ответов."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = pathlib.Path(self.tmp.name)
        self.sizes = {"aof_core": 300_000, "aof_market": 120_000}
        self.specs = make_specs(self.dir, self.sizes)
        self.args = ["plan", "--policy", "exact", "--payer", PAYER]
        for spec in self.specs:
            self.args += ["--program", f"{spec.name}:{spec.address}:{spec.so_path}"]

    def plan(self, rpc, extra=(), env=None):
        return run_main(self.args + list(extra), rpc.url, env)

    def expected_min(self, rate=5080, fee=5000, fee_reserve=100_000_000, operator=SOL):
        permanent = fees = 0
        for spec in self.specs:
            permanent += rent_of(rate, 45 + spec.size) + rent_of(rate, 36)
            fees += (2 + -(-spec.size // 1012) + 2) * fee
        return permanent + fees + fee_reserve + operator, permanent, fees

    def test_table_has_every_required_column_and_separate_reserve_lines(self):
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            code, out, err = self.plan(rpc)
        self.assertEqual(code, 0, err)
        for column in ("программа", ".so, Б", "max_len, Б", "запас, Б", "rent Program", "rent ProgramData",
                       "Buffer (врем.)", "заблокировано", "комиссии"):
            self.assertIn(column, out)
        for line in ("Постоянно заблокировано", "Пик временной потребности сверх постоянной", "Ожидаемые комиссии сети",
                     "Резерв на повторы и сбои комиссий (явный)", "Резерв оператора после деплоя (явный)",
                     "МИНИМАЛЬНЫЙ СТАРТОВЫЙ БАЛАНС"):
            self.assertIn(line, out)
        self.assertIn("Политика max_len: exact (1.00×)", out)
        self.assertIn("кластер: devnet", out)

    def test_totals_follow_the_rpc_for_several_rates(self):
        for rate in (6960, 5080, 696):
            with mockrpc.MockRpc(lamports_per_byte=rate, balances={PAYER: 100 * SOL}) as rpc:
                code, out, err = self.plan(rpc, ["--json"])
            self.assertEqual(code, 0, err)
            data = json.loads(out)
            minimum, permanent, fees = self.expected_min(rate=rate)
            self.assertEqual(data["totals"]["permanentLamports"], permanent, f"ставка {rate}")
            self.assertEqual(data["totals"]["expectedFeesLamports"], fees)
            self.assertEqual(data["totals"]["transientPeakLamports"], 0)
            self.assertEqual(data["totals"]["minStartBalanceLamports"], minimum)
            self.assertAlmostEqual(data["derivedLamportsPerByte"], rate, places=3)

    def test_rent_and_fees_are_requested_from_the_rpc(self):
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            code, out, _ = self.plan(rpc, ["--json"])
            requested = rpc.requests
        self.assertEqual(code, 0)
        rent_calls = [r["params"][0] for r in requested if r["method"] == "getMinimumBalanceForRentExemption"]
        for spec in self.specs:
            self.assertIn(45 + spec.size, rent_calls)  # ProgramData
        self.assertIn(36, rent_calls)                    # Program
        self.assertIn(0, rent_calls)                     # порог rent-exempt системного аккаунта для резерва
        self.assertIn("getFeeForMessage", [r["method"] for r in requested])
        audit = json.loads(out)["rpcAudit"]
        self.assertTrue(any(a["method"] == "getMinimumBalanceForRentExemption" for a in audit))

    def test_fees_scale_with_the_rpc_fee(self):
        with mockrpc.MockRpc(lamports_per_signature=7500, balances={PAYER: 100 * SOL}) as rpc:
            code, out, err = self.plan(rpc, ["--json"])
        self.assertEqual(code, 0, err)
        self.assertEqual(json.loads(out)["totals"]["expectedFeesLamports"], self.expected_min(fee=7500)[2])

    def test_only_read_only_rpc_methods_are_used(self):
        allowed = {"getMinimumBalanceForRentExemption", "getBalance", "getLatestBlockhash", "getFeeForMessage",
                   "getGenesisHash"}
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            self.plan(rpc)
            self.assertTrue(set(rpc.methods()) <= allowed, set(rpc.methods()) - allowed)

    def test_balance_exactly_at_minimum_passes_and_one_lamport_less_refuses(self):
        minimum = self.expected_min()[0]
        with mockrpc.MockRpc(balances={PAYER: minimum}) as rpc:
            code, out, err = self.plan(rpc)
        self.assertEqual(code, 0, err)
        self.assertIn("Запас сверх минимума", out)
        with mockrpc.MockRpc(balances={PAYER: minimum - 1}) as rpc:
            code, out, err = self.plan(rpc)
        self.assertEqual(code, est.EXIT_INSUFFICIENT)
        self.assertIn("ДЕФИЦИТ", out)
        self.assertIn("0.000000001", err)
        self.assertIn("Ни одной транзакции не отправлено", err)

    def test_deficit_is_reported_in_json(self):
        minimum = self.expected_min()[0]
        with mockrpc.MockRpc(balances={PAYER: minimum - SOL // 2}) as rpc:
            code, out, _ = self.plan(rpc, ["--json"])
        self.assertEqual(code, est.EXIT_INSUFFICIENT)
        payer = json.loads(out)["payer"]
        self.assertEqual(payer["deficitLamports"], SOL // 2)
        self.assertFalse(payer["sufficient"])

    def test_reserves_come_from_flags_or_env_and_are_validated(self):
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            code, out, _ = self.plan(rpc, ["--json", "--operator-reserve-sol", "2.5", "--fee-reserve-sol", "0.25"])
            data = json.loads(out)
            self.assertEqual(data["totals"]["operatorReserveLamports"], 2_500_000_000)
            self.assertEqual(data["totals"]["feeReserveLamports"], 250_000_000)
            code, out, _ = self.plan(rpc, ["--json"], env={"OPERATOR_RESERVE_SOL": "3", "DEPLOY_FEE_RESERVE_SOL": "0.5"})
            data = json.loads(out)
            self.assertEqual(data["totals"]["operatorReserveLamports"], 3 * SOL)
            self.assertEqual(data["totals"]["feeReserveLamports"], 500_000_000)
            # резерв оператора ниже rent-exempt минимума системного аккаунта — отказ
            code, _, err = self.plan(rpc, ["--operator-reserve-sol", "0.0001"])
            self.assertEqual(code, est.EXIT_USAGE)
            self.assertIn("rent-exempt", err)
            code, _, err = self.plan(rpc, ["--operator-reserve-sol", "oops"])
            self.assertEqual(code, est.EXIT_USAGE)

    def test_missing_policy_refuses_before_any_network_call(self):
        args = [a for a in self.args if a not in ("--policy", "exact")]
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            code, out, err = run_main(args, rpc.url)
            self.assertEqual(code, est.EXIT_USAGE)
            self.assertIn("PROGRAM_MAX_LEN_POLICY", err)
            self.assertEqual(rpc.requests, [])

    def test_policy_from_environment(self):
        args = [a for a in self.args if a not in ("--policy", "exact")]
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            code, out, err = run_main(args + ["--json"], rpc.url,
                                      {"PROGRAM_MAX_LEN_POLICY": "headroom", "PROGRAM_MAX_LEN_HEADROOM_PERCENT": "15"})
        self.assertEqual(code, 0, err)
        data = json.loads(out)
        self.assertEqual(data["policy"], {"name": "headroom", "headroomPercent": 15, "multiplier": "1.15×"})
        self.assertEqual(data["programs"][0]["maxLen"], est.Policy("headroom", 15).max_len(300_000))

    def test_wrong_cluster_is_refused_with_its_own_code(self):
        with mockrpc.MockRpc(genesis=mockrpc.MAINNET_GENESIS, balances={PAYER: 100 * SOL}) as rpc:
            code, out, err = self.plan(rpc)
            self.assertEqual(code, est.EXIT_CLUSTER)
            self.assertIn("не devnet", err)
            self.assertEqual(out, "")
            # проверка кластера идёт раньше любых расчётов
            self.assertNotIn("getMinimumBalanceForRentExemption", rpc.methods())
            code, _, _ = self.plan(rpc, ["--no-genesis-check"])
            self.assertEqual(code, 0)

    def test_rpc_secret_in_url_is_never_printed(self):
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}) as rpc:
            code, out, err = run_main(self.args + ["--json"], rpc.url + "/?api-key=SUPERSECRET")
            self.assertEqual(code, 0, err)
        self.assertNotIn("SUPERSECRET", out + err)
        self.assertEqual(json.loads(out)["rpc"]["endpoint"], rpc.url)

    def test_compare_lists_five_variants_in_increasing_cost(self):
        args = ["compare"] + [a for a in self.args[self.args.index("--program"):]]
        with mockrpc.MockRpc() as rpc:
            code, out, err = run_main(args + ["--json"], rpc.url)
        self.assertEqual(code, 0, err)
        variants = json.loads(out)["variants"]
        self.assertEqual([(v["policy"], v["headroomPercent"]) for v in variants], list(est.COMPARE_VARIANTS))
        locked = [v["permanentLamports"] for v in variants]
        self.assertEqual(locked, sorted(locked))
        self.assertEqual(variants[0]["extraVsExactLamports"], 0)
        with mockrpc.MockRpc() as rpc:
            code, out, _ = run_main(args, rpc.url)
        self.assertEqual(code, 0)
        for label in ("exact (1.00×)", "headroom 10% (1.10×)", "headroom 15% (1.15×)", "headroom 25% (1.25×)", "legacy-2x (2.00×)"):
            self.assertIn(label, out)

    def test_missing_program_file_is_refused(self):
        args = ["plan", "--policy", "exact", "--program", f"x:{ADDRESSES['aof_core']}:{self.dir}/nope.so"]
        with mockrpc.MockRpc() as rpc:
            code, _, err = run_main(args, rpc.url)
        self.assertEqual(code, est.EXIT_USAGE)
        self.assertIn("нет файла программы", err)

    def test_no_payer_prints_the_table_without_a_balance_check(self):
        args = [a for a in self.args if a not in ("--payer", PAYER)]
        with mockrpc.MockRpc() as rpc:
            code, out, err = run_main(args, rpc.url)
            self.assertEqual(code, 0, err)
            self.assertNotIn("getBalance", rpc.methods())
        self.assertNotIn("ДЕФИЦИТ", out)

    def test_max_len_command_is_offline_and_prints_one_integer(self):
        so = self.specs[0].so_path
        code, out, err = run_main(["max-len", "--so", so, "--policy", "headroom", "--headroom-percent", "25"])
        self.assertEqual(code, 0, err)
        self.assertEqual(out.strip(), str(est.Policy("headroom", 25).max_len(300_000)))
        code, out, err = run_main(["max-len", "--so", so])
        self.assertEqual(code, est.EXIT_USAGE)
        self.assertIn("PROGRAM_MAX_LEN_POLICY", err)

    def test_check_policy_command(self):
        code, out, _ = run_main(["check-policy"], env={"PROGRAM_MAX_LEN_POLICY": "exact"})
        self.assertEqual((code, out.strip()), (0, "exact (1.00×)"))
        code, _, err = run_main(["check-policy"])
        self.assertEqual(code, est.EXIT_USAGE)
        self.assertIn("PROGRAM_MAX_LEN_POLICY", err)


class RpcFailures(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        spec = make_specs(self.tmp.name, {"aof_core": 50_000})[0]
        self.args = ["plan", "--policy", "exact", "--payer", PAYER, "--program", f"{spec.name}:{spec.address}:{spec.so_path}"]

    def run_with(self, **kwargs):
        with mockrpc.MockRpc(balances={PAYER: 100 * SOL}, **kwargs) as rpc:
            return run_main(self.args, rpc.url)

    def test_each_broken_answer_is_a_refusal_not_an_estimate(self):
        cases = {
            "http500": ("getMinimumBalanceForRentExemption", "HTTP 500"),
            "badjson": ("getMinimumBalanceForRentExemption", "не JSON"),
            "error": ("getMinimumBalanceForRentExemption", "отклонён"),
            "noresult": ("getMinimumBalanceForRentExemption", "нет поля result"),
        }
        for mode, (method, text) in cases.items():
            code, out, err = self.run_with(broken={method: mode})
            self.assertEqual(code, est.EXIT_RPC, f"{mode}: {err}")
            self.assertIn(text, err)
            self.assertNotIn("МИНИМАЛЬНЫЙ", out)

    def test_null_fee_is_a_refusal(self):
        code, out, err = self.run_with(broken={"getFeeForMessage": "null"})
        self.assertEqual(code, est.EXIT_RPC)
        self.assertIn("getFeeForMessage вернул null", err)

    def test_garbage_balance_is_a_refusal(self):
        code, _, err = self.run_with(broken={"getBalance": "null"})
        self.assertEqual(code, est.EXIT_RPC)

    def test_unreachable_rpc_is_a_refusal(self):
        with mockrpc.MockRpc() as rpc:
            dead = rpc.url
        code, out, err = run_main(self.args, dead)
        self.assertEqual(code, est.EXIT_RPC)
        self.assertIn("недоступен", err)
        self.assertEqual(out, "")

    def test_provider_rejecting_the_key_is_named(self):
        # Реальный случай: ключ провайдера неверен/не подставлен — 401/403.
        for status in ("http401", "http403"):
            code, out, err = self.run_with(broken={"getMinimumBalanceForRentExemption": status})
            self.assertEqual(code, est.EXIT_RPC, err)
            self.assertIn(f"HTTP {status[4:]}", err)
            self.assertIn("ключ", err)
            self.assertNotIn("RPC_URL?", err)  # ключ никогда не печатается
            self.assertEqual(out, "")

    def test_rate_limited_public_rpc_gets_the_provider_hint(self):
        code, _, err = self.run_with(broken={"getMinimumBalanceForRentExemption": "http429"})
        self.assertEqual(code, est.EXIT_RPC)
        self.assertIn("HTTP 429", err)
        self.assertIn("RPC с ключом провайдера", err)

    def test_a_placeholder_left_in_the_url_is_named_as_such(self):
        # Именно так выглядел отказ на macOS: https://…/?api-key=ВАШ_КЛЮЧ →
        # «недоступен (str)», из чего причина не читалась.
        code, out, err = run_main(self.args, "https://devnet.helius-rpc.com/?api-key=ВАШ_КЛЮЧ")
        self.assertEqual(code, est.EXIT_RPC, err)
        self.assertIn("не-ASCII", err)
        self.assertIn("плейсхолдер", err)
        self.assertEqual(out, "")

    def test_wrong_scheme_is_a_refusal(self):
        code, _, err = run_main(self.args, "ftp://example.invalid")
        self.assertEqual(code, est.EXIT_USAGE)

    def test_a_url_that_is_not_a_url_is_refused_without_a_traceback(self):
        # Пустой RPC_URL и строка без схемы раньше падали голым ValueError из
        # Request(): «unknown url type: ''» — по такому выводу нельзя понять,
        # что не так с адресом. Теперь это отказ с названной причиной.
        for bad in ("", "   ", "devnet.helius-rpc.com/?api-key=x", "/tmp/socket", "http://"):
            # пустую строку helper пропускает как «нет override» — передаём явно
            argv = list(self.args) + ["--rpc", bad] if bad == "" else self.args
            code, out, err = run_main(argv, None if bad == "" else bad)
            self.assertEqual(code, est.EXIT_USAGE, f"{bad!r}: {err}")
            self.assertIn("негодный", err)
            self.assertIn("api-key", err, "подсказка обязана показывать форму записи с ключом")
            self.assertEqual(out, "", f"{bad!r}: отчёта быть не должно")
            self.assertNotIn("Traceback", err, f"{bad!r}: traceback недопустим")

    def test_non_monotonic_rent_is_not_trusted(self):
        code, out, err = self.run_with(rent_fn=lambda length: 1_000_000)
        self.assertEqual(code, est.EXIT_RPC)
        self.assertIn("доверять нельзя", err)

    def test_nonlinear_rent_only_warns(self):
        code, out, err = self.run_with(rent_fn=lambda length: 1_000_000 + length * length)
        self.assertEqual(code, 0, err)
        self.assertIn("нелинейна", out)


class Verification(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = pathlib.Path(self.tmp.name)
        self.chain = self.dir / "chain"
        self.chain.mkdir()
        self.program = ADDRESSES["aof_core"]
        self.elf = mockrpc.fake_so(self.program, 20_000)
        self.so = self.dir / "aof_core.so"
        self.so.write_bytes(self.elf)
        self.arg = f"aof_core:{self.program}:{self.so}"

    def deploy_state(self, **override):
        state = {"max_len": 20_000, "so": str(self.so), "authority": PAYER}
        state.update(override)
        (self.chain / f"{self.program}.json").write_text(json.dumps(state), encoding="utf-8")

    def verify(self, rpc, max_len=20_000, authority=PAYER):
        return run_main(["verify-deployed", "--program", self.arg, "--max-len", str(max_len),
                         "--authority", authority, "--wait-seconds", "0"], rpc.url)

    def test_verify_deployed_accepts_a_correct_deploy(self):
        self.deploy_state()
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, out, err = self.verify(rpc)
        self.assertEqual(code, 0, err)
        for fragment in ("исполняемый", "upgradeable-загрузчик", f"authority {PAYER}", "ёмкость 20000", "sha256 байткода"):
            self.assertIn(fragment, out)

    def test_verify_deployed_refusals(self):
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, _, err = self.verify(rpc)
            self.assertEqual(code, est.EXIT_VERIFY)
            self.assertIn("не найден после деплоя", err)

            self.deploy_state(authority=ADDRESSES["aof_market"])
            code, _, err = self.verify(rpc)
            self.assertEqual(code, est.EXIT_VERIFY)
            self.assertIn("upgrade authority", err)

            self.deploy_state()
            code, _, err = self.verify(rpc, max_len=19_999)
            self.assertEqual(code, est.EXIT_VERIFY)
            self.assertIn("ёмкость ProgramData", err)

            self.deploy_state(corrupt=True)
            code, _, err = self.verify(rpc)
            self.assertEqual(code, est.EXIT_VERIFY)
            self.assertIn("НЕ совпадает", err)

    def upgrade_state(self, rpc):
        return run_main(["upgrade-state", "--program", self.arg], rpc.url)

    def test_upgrade_state_reports_same_and_different(self):
        self.deploy_state()
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, out, err = self.upgrade_state(rpc)
            self.assertEqual(code, 0, err)
            self.assertIn("state: same", out)
            self.assertIn("capacity: 20000", out)
            self.assertIn(f"authority: {PAYER}", out)
        self.deploy_state(corrupt=True)
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, out, err = self.upgrade_state(rpc)
            self.assertEqual(code, 0, err)
            self.assertIn("state: different", out)

    def test_upgrade_state_ignores_a_larger_capacity_but_reports_the_authority(self):
        # уменьшить ProgramData нельзя, а CLI при upgrade расширяет её сам (минимум 10 KiB):
        # «ёмкость больше policy» — не повод отказывать, а вот чужая authority — повод.
        self.deploy_state(max_len=40_000)
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, out, err = self.upgrade_state(rpc)
        self.assertEqual(code, 0, err)
        self.assertIn("state: same", out)
        self.assertIn("capacity: 40000", out)
        self.deploy_state(authority=ADDRESSES["aof_market"])
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, out, err = self.upgrade_state(rpc)
        self.assertEqual(code, 0, err)
        self.assertIn(f"authority: {ADDRESSES['aof_market']}", out)

    def test_upgrade_state_refuses_when_there_is_nothing_to_upgrade(self):
        with mockrpc.MockRpc(chain_dir=self.chain) as rpc:
            code, _, err = self.upgrade_state(rpc)
            self.assertEqual(code, est.EXIT_VERIFY)
            self.assertIn("не найден", err)

    def test_verify_deployed_rejects_a_foreign_owner_and_non_executable(self):
        info = {"lamports": 1, "owner": ADDRESSES["aof_market"], "executable": True,
                "data": struct.pack("<I", 2) + b"\x01" * 32}
        with mockrpc.MockRpc(accounts={self.program: info}) as rpc:
            code, _, err = self.verify(rpc)
        self.assertEqual(code, est.EXIT_VERIFY)
        self.assertIn("не upgradeable-загрузчик", err)
        info = dict(info, owner=mockrpc.LOADER, executable=False)
        with mockrpc.MockRpc(accounts={self.program: info}) as rpc:
            code, _, err = self.verify(rpc)
        self.assertEqual(code, est.EXIT_VERIFY)
        self.assertIn("не помечен исполняемым", err)

    def accounts_for_layout(self, elf_offset_programdata=45, program_len=36, elf_offset_buffer=37):
        programdata = mockrpc.b58encode(b"\x09" * 32)
        buffer = mockrpc.b58encode(b"\x0a" * 32)
        authority = mockrpc.b58decode(PAYER)
        # метаданные ровно 45/37 байт; чтобы сдвинуть ELF, их обрезают (меньше) или добивают нулями (больше)
        pd_meta = struct.pack("<IQB", 3, 1, 1) + authority
        buf_meta = struct.pack("<IB", 1, 1) + authority
        pd_data = bytearray(pd_meta[:elf_offset_programdata].ljust(elf_offset_programdata, b"\x00") + self.elf)
        buf_data = bytearray(buf_meta[:elf_offset_buffer].ljust(elf_offset_buffer, b"\x00") + self.elf)
        program = (struct.pack("<I", 2) + mockrpc.b58decode(programdata)).ljust(program_len, b"\x00")[:program_len]
        return {
            self.program: {"lamports": 1, "owner": mockrpc.LOADER, "executable": True, "data": bytes(program)},
            programdata: {"lamports": 1, "owner": mockrpc.LOADER, "executable": False, "data": bytes(pd_data)},
            buffer: {"lamports": 1, "owner": mockrpc.LOADER, "executable": False, "data": bytes(buf_data)},
        }, buffer

    def test_verify_layout_proves_36_45_37_on_live_accounts(self):
        accounts, buffer = self.accounts_for_layout()
        with mockrpc.MockRpc(accounts=accounts) as rpc:
            code, out, err = run_main(["verify-layout", "--program-id", self.program, "--buffer", buffer], rpc.url)
        self.assertEqual(code, 0, err)
        self.assertIn("Program: 36 Б (ожидалось 36)", out)
        self.assertIn("ELF-магия на смещении 45", out)
        self.assertIn("ELF-магия на смещении 37", out)

    def test_verify_layout_catches_every_wrong_size(self):
        for kwargs, text in (({"program_len": 40}, "36"), ({"elf_offset_programdata": 44}, "45"),
                             ({"elf_offset_buffer": 38}, "37")):
            accounts, buffer = self.accounts_for_layout(**kwargs)
            with mockrpc.MockRpc(accounts=accounts) as rpc:
                code, _, err = run_main(["verify-layout", "--program-id", self.program, "--buffer", buffer], rpc.url)
            self.assertEqual(code, est.EXIT_VERIFY, f"{kwargs}: {err}")
            self.assertIn(text, err)

    def test_stray_buffers_are_listed_and_never_touched(self):
        other = ADDRESSES["aof_market"]
        buffers = [{"address": "BufferAaa111111111111111111111111111111111", "authority": PAYER, "lamports": 3 * SOL},
                   {"address": "BufferBbb111111111111111111111111111111111", "authority": other, "lamports": 9 * SOL}]
        with mockrpc.MockRpc(buffers=buffers) as rpc:
            code, out, err = run_main(["buffers", "--authority", PAYER], rpc.url)
            self.assertEqual(rpc.methods(), ["getProgramAccounts"])
            filters = rpc.requests[0]["params"][1]["filters"]
        self.assertEqual(code, 0, err)
        self.assertIn("BufferAaa", out)
        self.assertNotIn("BufferBbb", out)  # чужой authority
        self.assertIn("3.000000000", out)
        self.assertIn("НЕ закрывает", out)
        self.assertIn("НЕ засчитываются", out)
        self.assertEqual(filters[0]["memcmp"], {"offset": 0, "bytes": est.b58encode(b"\x01\x00\x00\x00")})
        self.assertEqual(filters[2]["memcmp"], {"offset": 5, "bytes": PAYER})
        with mockrpc.MockRpc() as rpc:
            code, out, _ = run_main(["buffers", "--authority", PAYER], rpc.url)
        self.assertIn("нет", out)


class LocalHistory(unittest.TestCase):
    """analyze-history: измерение на локальном валидаторе и сверка с моделью (на синтетической истории по модели)."""

    RATE, FEE = 6960, 5000

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.size = 30_000
        self.spec = make_specs(self.tmp.name, {"aof_rebirth": self.size})[0]
        self.arg = f"{self.spec.name}:{self.spec.address}:{self.spec.so_path}"
        self.start = 100 * SOL

    def model_history(self, max_len=None, extra_dip=0, drop_return=False):
        """Транзакции плательщика ровно по модели: create_buffer, Write×N, deploy с возвратом буфера."""
        max_len = max_len or self.size
        rent = lambda n: (128 + n) * self.RATE  # noqa: E731
        buffer_funding = rent(45 + max_len)
        writes = -(-self.size // 1012)
        balance = self.start
        txs = []

        def add(label, fee, delta):
            nonlocal balance
            pre = balance
            balance = balance - fee - delta
            txs.append({"signature": f"{label}{len(txs):04d}".ljust(20, "x"), "slot": 10 + len(txs), "fee": fee,
                        "accountKeys": [PAYER, "OtherAccount111111111111111111111111111111"], "pre": [pre, 0], "post": [balance, delta]})

        # airdrop: платит фаусет (первый ключ — не плательщик): в измерение не попадает
        txs.append({"signature": "airdrop".ljust(20, "x"), "slot": 1, "fee": 0, "accountKeys": ["Faucet11111111111111111111111111111111111", PAYER],
                    "pre": [10**12, 0], "post": [10**12 - self.start, self.start]})
        add("createbuf", 2 * self.FEE, buffer_funding + extra_dip)
        for _ in range(writes):
            add("write", self.FEE, 0)
        if extra_dip:
            add("giveback", self.FEE, -extra_dip)
        returned = 0 if drop_return else buffer_funding
        add("deploy", 2 * self.FEE, rent(36) + rent(45 + max_len) - returned)
        return txs

    def run_analysis(self, rpc, *extra, program=True):
        argv = ["analyze-history", "--payer", PAYER] + (["--program", self.arg] if program else []) + list(extra)
        return run_main(argv, rpc.url)

    def test_model_is_confirmed_on_a_faithful_history(self):
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, lamports_per_signature=self.FEE, genesis=mockrpc.LOCAL_GENESIS,
                             history=self.model_history()) as rpc:
            code, out, err = self.run_analysis(rpc)
        self.assertEqual(code, 0, err + out)
        self.assertIn("МОДЕЛЬ ПОДТВЕРЖДЕНА", out)
        self.assertIn("Переходный пик сверх итога: 0.000000000 SOL", out)
        self.assertNotIn("airdrop", out, "airdrop платит фаусет — в окно плательщика не входит")
        expected_locked = (128 + 36) * self.RATE + (128 + 45 + self.size) * self.RATE
        self.assertIn(f"измерено {expected_locked}, модель {expected_locked}", out)
        self.assertIn("✓ переходный пик сверх итога = 0", out)

    def test_headroom_max_len_is_compared_against_the_matching_rent(self):
        history = self.model_history(max_len=int(self.size * 1.25))
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, lamports_per_signature=self.FEE, genesis=mockrpc.LOCAL_GENESIS, history=history) as rpc:
            code, out, _ = self.run_analysis(rpc, "--max-len", str(int(self.size * 1.25)))
            self.assertEqual(code, 0, out)
            code, out, _ = self.run_analysis(rpc)  # а с max_len по умолчанию (= размер) эта же история обязана НЕ сойтись
        self.assertEqual(code, est.EXIT_VERIFY, out)
        self.assertIn("МОДЕЛЬ НЕ ПОДТВЕРЖДЕНА", out)

    def test_a_transient_dip_above_the_final_outflow_is_detected(self):
        history = self.model_history(extra_dip=3 * SOL)
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, lamports_per_signature=self.FEE, genesis=mockrpc.LOCAL_GENESIS, history=history) as rpc:
            code, out, _ = self.run_analysis(rpc)
        self.assertEqual(code, est.EXIT_VERIFY, out)
        self.assertIn("✗ переходный пик сверх итога = 0", out)
        measured = int(re.search(r"буфер возвращается плательщику до оплаты ProgramData\): измерено (\d+) lamports", out).group(1))
        # пик превышает итог на ~3 SOL (за вычетом платежей, сделанных уже после пика), а не на ноль
        self.assertGreater(measured, 2_990_000_000)
        self.assertLess(measured, 3_000_000_000)

    def test_a_buffer_that_is_not_returned_shows_up_as_extra_locked_lamports(self):
        history = self.model_history(drop_return=True)
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, lamports_per_signature=self.FEE, genesis=mockrpc.LOCAL_GENESIS, history=history) as rpc:
            code, out, _ = self.run_analysis(rpc)
        self.assertEqual(code, est.EXIT_VERIFY, out)
        self.assertIn("✗ заблокировано в аккаунтах", out)

    def test_fee_difference_is_informational_only(self):
        # модель считает комиссию 7000/подпись, а на «цепочке» были 5000: rent сошёлся, значит вердикт — «подтверждена»
        history = self.model_history()
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, lamports_per_signature=7000, genesis=mockrpc.LOCAL_GENESIS, history=history) as rpc:
            code, out, _ = self.run_analysis(rpc)
        self.assertEqual(code, 0, out)
        self.assertIn("⚠ комиссии равны модели", out)
        self.assertIn("МОДЕЛЬ ПОДТВЕРЖДЕНА", out)

    def test_only_a_local_validator_is_accepted(self):
        code, _, err = run_main(["analyze-history", "--payer", PAYER], "https://api.devnet.solana.com")
        self.assertEqual(code, est.EXIT_CLUSTER)
        self.assertIn("только с локальным валидатором", err)
        for genesis in (mockrpc.DEVNET_GENESIS, mockrpc.MAINNET_GENESIS, mockrpc.TESTNET_GENESIS):
            with mockrpc.MockRpc(genesis=genesis, history=self.model_history()) as rpc:  # локальный адрес, публичный genesis: проброшенный порт
                code, _, err = self.run_analysis(rpc, program=False)
                self.assertEqual(code, est.EXIT_CLUSTER, genesis)
                self.assertIn("публичной сети", err)
                self.assertEqual(rpc.methods(), ["getGenesisHash"], "до проверки genesis история не читается")

    def test_window_can_start_after_a_signature_and_empty_history_is_refused(self):
        history = self.model_history()
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, genesis=mockrpc.LOCAL_GENESIS, history=history) as rpc:
            first_paid = history[1]["signature"]
            code, out, _ = self.run_analysis(rpc, "--after-signature", first_paid, program=False)
            self.assertEqual(code, 0)
            self.assertNotIn(first_paid[:12], out)
            code, _, err = self.run_analysis(rpc, "--after-signature", "no-such-signature", program=False)
            self.assertEqual(code, est.EXIT_USAGE)
        with mockrpc.MockRpc(genesis=mockrpc.LOCAL_GENESIS, history=[]) as rpc:
            code, _, err = self.run_analysis(rpc, program=False)
        self.assertEqual(code, est.EXIT_USAGE)
        self.assertIn("нечего измерять", err)

    def test_the_command_only_reads(self):
        with mockrpc.MockRpc(lamports_per_byte=self.RATE, genesis=mockrpc.LOCAL_GENESIS, history=self.model_history()) as rpc:
            self.run_analysis(rpc)
            used = set(rpc.methods())
        self.assertTrue(used <= {"getGenesisHash", "getSignaturesForAddress", "getTransaction", "getMinimumBalanceForRentExemption",
                                 "getLatestBlockhash", "getFeeForMessage"}, used)


class CommandLine(unittest.TestCase):
    """Скрипт как процесс: именно так его зовёт deploy-devnet.sh."""

    def run_script(self, *argv, env=None):
        clean = {k: v for k, v in os.environ.items() if not k.startswith("PROGRAM_MAX_LEN")}
        clean.update(env or {})
        return subprocess.run([sys.executable, str(SCRIPT), *argv], capture_output=True, text=True, env=clean, timeout=60)

    def test_exit_codes_and_streams(self):
        done = self.run_script("check-policy")
        self.assertEqual(done.returncode, 2)
        self.assertIn("ОТКАЗ", done.stderr)
        done = self.run_script("check-policy", env={"PROGRAM_MAX_LEN_POLICY": "legacy-2x"})
        self.assertEqual((done.returncode, done.stdout.strip()), (0, "legacy-2x (2.00×)"))
        with tempfile.TemporaryDirectory() as tmp:
            so = pathlib.Path(tmp) / "a.so"
            so.write_bytes(mockrpc.fake_so(ADDRESSES["aof_core"], 10_000))
            done = self.run_script("max-len", "--so", str(so), "--policy", "exact")
            self.assertEqual((done.returncode, done.stdout.strip()), (0, "10000"))
            with mockrpc.MockRpc(balances={PAYER: 1 * SOL}) as rpc:
                done = self.run_script("plan", "--policy", "exact", "--payer", PAYER, "--rpc", rpc.url,
                                       "--program", f"a:{ADDRESSES['aof_core']}:{so}")
            self.assertEqual(done.returncode, 4, done.stderr)
            self.assertIn("МИНИМАЛЬНЫЙ СТАРТОВЫЙ БАЛАНС", done.stdout)
            self.assertIn("ОТКАЗ", done.stderr)

    def test_from_registry_reads_names_and_addresses_from_the_repo(self):
        registry = json.loads((HERE.parent / "watchtower" / "addresses.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            for entry in registry["programs"]:
                pathlib.Path(tmp, f"{entry['name']}.so").write_bytes(mockrpc.fake_so(entry["address"], 5_000))
            with mockrpc.MockRpc() as rpc:
                done = self.run_script("plan", "--policy", "exact", "--from-registry", "--artifacts", tmp,
                                       "--only", "aof_core,aof_market", "--rpc", rpc.url, "--json")
        self.assertEqual(done.returncode, 0, done.stderr)
        names = [p["name"] for p in json.loads(done.stdout)["programs"]]
        self.assertEqual(names, ["aof_core", "aof_market"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
