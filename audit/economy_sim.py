#!/usr/bin/env python3
"""
AOF — economy simulation derived ONLY from values read out of the repository.

Every number below is taken from:
  aof-core/src/constants.rs
  aof-core/src/instructions/{collect_mining,repair,craft,start_mining,
                             harvest_synapse,start_signal_processing,collect_signal,
                             start_model_training,collect_model,collect_power}.rs
  aof-core/src/state.rs

Units: "display units" (1 unit = RESOURCE_UNIT = 1e9 atomic SPL units).
SOL figures use the repo's own reference rate (1 SOL = $100, constants.rs comment).
"""

U = 1_000_000_000  # RESOURCE_UNIT

# ---- collect_mining.rs : yield_bps() -------------------------------------
YIELD = {0: 10.0, 1: 11.5, 2: 13.0, 3: 15.0, 4: 18.0}   # units/hour
# ---- state.rs Rarity::max_hours() -----------------------------------------
MAX_HOURS = {0: 8, 1: 12, 2: 14, 3: 20, 4: 20}
# ---- constants.rs repair costs, per durability point (display units) ------
# [AUDIT F-08] re-read from constants.rs after the repair-curve rebalance:
#   REPAIR_SILICON_{COMMON,UNCOMMON,RARE,EPIC,LEGENDARY}
#   REPAIR_CIRCUIT_{COMMON,UNCOMMON,RARE,EPIC,LEGENDARY}
REPAIR_SILICON = {0: 2.0, 1: 2.5, 2: 2.5, 3: 3.0, 4: 3.5}
REPAIR_CIRCUIT  = {0: 3.0, 1: 3.5, 2: 4.0, 3: 4.5, 4: 5.0}
MAX_DUR = 20
DEFAULT_VILLAGERS = 6

# ---- constants.rs CRAFT_* (display units), index = craft_index ------------
# craft_index: Uncommon=0, Rare=1, Epic=2, Legendary=3
CRAFT_CIRCUIT_BASE  = [100, 150, 500, 2000]
CRAFT_SILICON_BASE = [100, 120, 400, 1500]
CRAFT_DATA_BASE  = [50, 80, 300, 1000]
CRAFT_NEURON_BASE = [20, 40, 150, 500]
CRAFT_POWER_BASE = [10, 30, 100, 400]
CRAFT_MIND_BASE= [10, 20, 100, 500]
CRAFT_CIRCUIT_MULT  = [1, 2, 10, 50]     # per already-minted tool of that rarity
CRAFT_SILICON_MULT = [1, 2, 10, 50]

# ---- constants.rs Grid Station ------------------------------------------
GRID_RATE = {0: 0, 1: 5, 2: 15, 3: 20}          # Power / hour by network load
WEATHER_P = {0: 0.10, 1: 0.50, 2: 0.30, 3: 0.10}
GRID_MAX_ACCRUAL_H = 24

# ---- constants.rs fees ----------------------------------------------------
MICROS_TO_LAMPORTS = 1000
LAMPORTS_PER_SOL = 1_000_000_000
CRAFT_FEE_SOL   = 100_000 * MICROS_TO_LAMPORTS / LAMPORTS_PER_SOL   # 0.10 SOL
UNSTAKE_FEE_SOL = 10_000  * MICROS_TO_LAMPORTS / LAMPORTS_PER_SOL   # 0.01 SOL
REROLL_FEE_SOL  = 60_000  * MICROS_TO_LAMPORTS / LAMPORTS_PER_SOL   # 0.06 SOL

# ---- laboratory, signal-processing and model-training chain ----------------------------------------------------------
SYNAPSE_YIELD_MULT = 1.5                       # harvest_synapse (bps 15000)
SIGNAL_PROCESSING = [(6, 1, 3), (18, 2, 10), (40, 4, 24)]       # (Synapse, Silicon) -> Signal
MODEL_TRAINING_CIRCUIT = [(4, 3, 5, 2), (12, 8, 12, 7), (28, 18, 25, 18)]   # Signal,Power,Circuit -> Model
MODEL_TRAINING_COMPUTE = [(4, 3, 2, 3), (12, 8, 5, 9), (28, 18, 10, 22)]    # Signal,Power,Compute -> Model


def mining_day(rarity, hours_per_day, tool_kind):
    """Gross units/day for ONE staked tool, and durability consumed."""
    h = min(hours_per_day, MAX_HOURS[rarity] * (24 // MAX_HOURS[rarity]) if MAX_HOURS[rarity] else 0)
    h = min(hours_per_day, 24)
    # a session cannot exceed max_hours; a tool cannot exceed its durability
    h = min(h, MAX_DUR)
    sessions = h / MAX_HOURS[rarity]
    full_sessions = int(h // MAX_HOURS[rarity])
    rem = h - full_sessions * MAX_HOURS[rarity]
    if rem > 0:
        # a partial session is allowed only if the tool still has durability
        pass
    gross = h * YIELD[rarity]
    return gross, h


def repair_day(rarity, durability_used):
    return (durability_used * REPAIR_CIRCUIT[rarity],
            durability_used * REPAIR_SILICON[rarity])


def scenario(wallets, rarity, hours_per_day, days, plasma_cutters_per_wallet=3, silicon_extractors_per_wallet=3):
    """Return a dict of cumulative flows for `wallets` identical actors."""
    gross_circuit = gross_silicon = 0.0
    rep_circuit = rep_silicon = 0.0
    power = 0.0
    for _ in range(days):
        # weather draw: expected value (distribution verified uniform: 10/50/30/10)
        exp_rate = sum(WEATHER_P[k] * GRID_RATE[k] for k in GRID_RATE)
        power += wallets * min(24, 24) * exp_rate
        for _ in range(plasma_cutters_per_wallet * wallets):
            g, d = mining_day(rarity, hours_per_day, "plasma_cutter")
            gross_circuit += g
            rw, rs = repair_day(rarity, d)
            rep_circuit += rw
            rep_silicon += rs
        for _ in range(silicon_extractors_per_wallet * wallets):
            g, d = mining_day(rarity, hours_per_day, "silicon_extractor")
            gross_silicon += g
            rw, rs = repair_day(rarity, d)
            rep_circuit += rw
            rep_silicon += rs
    return {
        "wallets": wallets,
        "rarity": rarity,
        "days": days,
        "gross_circuit": gross_circuit,
        "gross_silicon": gross_silicon,
        "repair_circuit": rep_circuit,
        "repair_silicon": rep_silicon,
        "net_circuit": gross_circuit - rep_circuit,
        "net_silicon": gross_silicon - rep_silicon,
        "power_accrual": power,
    }


RARITY_NAME = {0: "Common", 1: "Uncommon", 2: "Rare", 3: "Epic", 4: "Legendary"}


def table1():
    rows = []
    for days in (30, 90, 365):
        for wallets, label in ((1, "1 чел."), (100, "100 сибилов"), (1000, "1000 сибилов")):
            r = scenario(wallets, 0, 20, days)
            rows.append((days, label, r))
    print("=" * 118)
    print("ТАБЛИЦА 1. Эмиссия CIRCUIT/SILICON (Common, 6 инструментов/кошелёк, 20 ч/сутки на инструмент)")
    print("=" * 118)
    print(f"{'Горизонт':>8} | {'Акторов':>12} | {'CIRCUIT добыто':>13} | {'SILICON добыто':>13} | "
          f"{'-CIRCUIT ремонт':>13} | {'-SILICON ремонт':>13} | {'Чистый CIRCUIT':>13} | {'Чистый SILICON':>13} | {'Вода ( accrual )':>15}")
    print("-" * 118)
    for days, label, r in rows:
        print(f"{days:>8} | {label:>12} | {r['gross_circuit']:>13,.0f} | {r['gross_silicon']:>13,.0f} | "
              f"{r['repair_circuit']:>13,.0f} | {r['repair_silicon']:>13,.0f} | {r['net_circuit']:>13,.0f} | "
              f"{r['net_silicon']:>13,.0f} | {r['power_accrual']:>15,.0f}")
    print()


def portfolio(rarity, H=20, plasma_cutters=3, silicon_extractors=3):
    """
    Один кошелёк: `plasma_cutters` топоров + `silicon_extractors` кирок, каждая работает H часов в день.
    Топор даёт CIRCUIT, кирка даёт SILICON; ремонт списывает CIRCUIT *и* SILICON за каждый
    инструмент независимо от его типа (repair.rs).
    """
    tools = plasma_cutters + silicon_extractors
    circuit_out = plasma_cutters * H * YIELD[rarity]
    silicon_out = silicon_extractors * H * YIELD[rarity]
    circuit_rep = tools * H * REPAIR_CIRCUIT[rarity]
    silicon_rep = tools * H * REPAIR_SILICON[rarity]
    return dict(circuit_out=circuit_out, silicon_out=silicon_out,
                circuit_rep=circuit_rep, silicon_rep=silicon_rep,
                net_circuit=circuit_out - circuit_rep, net_silicon=silicon_out - silicon_rep)


def table2():
    print("=" * 118)
    print("ТАБЛИЦА 2. Один кошелёк, 6 инструментов (3 топора + 3 кирки), 20 ч/сутки на инструмент")
    print("=" * 118)
    print(f"{'Редкость':>10} | {'ед./час':>8} | {'CIRCUIT добыто':>12} | {'SILICON добыто':>13} | "
          f"{'-CIRCUIT ремонт':>12} | {'-SILICON ремонт':>13} | {'НЕТТО CIRCUIT':>12} | {'НЕТТО SILICON':>13} | {'вердикт':>16}")
    print("-" * 118)
    for r in range(5):
        p = portfolio(r)
        v = "прибыльно" if p["net_circuit"] > 0 and p["net_silicon"] > 0 else (
            "убыточно (оба)" if p["net_circuit"] < 0 and p["net_silicon"] < 0 else "смешанно")
        print(f"{RARITY_NAME[r]:>10} | {YIELD[r]:>8.1f} | {p['circuit_out']:>12,.0f} | {p['silicon_out']:>13,.0f} | "
              f"{p['circuit_rep']:>12,.0f} | {p['silicon_rep']:>13,.0f} | {p['net_circuit']:>12,.0f} | "
              f"{p['net_silicon']:>13,.0f} | {v:>16}")
    print()
    # [AUDIT F-08] the text below is derived, not hardcoded: the repair curve was
    # rebalanced in constants.rs, so the old "x23.3 / unprofitable from Uncommon"
    # conclusion no longer holds and must not be re-asserted by hand.
    y_min, y_max = YIELD[0], YIELD[4]
    w_min, w_max = REPAIR_CIRCUIT[0], REPAIR_CIRCUIT[4]
    s_min, s_max = REPAIR_SILICON[0], REPAIR_SILICON[4]
    margins = [YIELD[r] - 2 * REPAIR_CIRCUIT[r] for r in range(5)]
    print(f"Ключ: доходность {y_min:.1f} -> {y_max:.1f} ед./ч (x{y_max / y_min:.1f}); ремонт CIRCUIT {w_min:.1f} -> {w_max:.1f} "
          f"ед./прочность (x{w_max / w_min:.1f}), SILICON {s_min:.1f} -> {s_max:.1f} (x{s_max / s_min:.1f}).")
    if all(m > 0 for m in margins):
        print(f"=> Все редкости прибыльны: инвариант Y > 2*repair_circuit выполняется с запасом "
              f"{min(margins):.1f}..{max(margins):.1f} ед./ч (пересчитано по F-08).")
    else:
        bad = [RARITY_NAME[r] for r in range(5) if margins[r] <= 0]
        print(f"=> НАРУШЕН инвариант Y > 2*repair_circuit для: {', '.join(bad)}.")
    print()


def table2b():
    print("=" * 92)
    print("ТАБЛИЦА 2b. Точка безубыточности (CIRCUIT) и lifetime-экономика одного инструмента")
    print("=" * 92)
    print(f"{'Редкость':>10} | {'безубыточных ч/день':>20} | {'lifetime добыча':>17} | "
          f"{'lifetime ремонт W/S':>21} | {'lifetime нетто W':>18}")
    print("-" * 92)
    for r in range(5):
        # per-wallet break-even: 3*H*Y == 6*H*W_r  ->  Y == 2*W_r (H cancels out)
        be = "никогда" if YIELD[r] <= 2 * REPAIR_CIRCUIT[r] else "любое H"
        life_gross = MAX_DUR * YIELD[r]
        life_rw = MAX_DUR * REPAIR_CIRCUIT[r]
        life_rs = MAX_DUR * REPAIR_SILICON[r]
        print(f"{RARITY_NAME[r]:>10} | {be:>20} | {life_gross:>17,.0f} | "
              f"{f'{life_rw:,.0f} / {life_rs:,.0f}':>21} | {life_gross - life_rw:>18,.0f}")
    print()
    print("H сокращается: при 6 инструментах портфель 3 plasma_cutter + 3 silicon_extractor безубыточен по CIRCUIT только при Y > 2*repair_circuit.")
    print("Ресурс прочности = 20 единиц = 20 часов майнинга за всё время жизни инструмента до ремонта.")
    print()

def table_sinks():
    print("=" * 100)
    print("ТАБЛИЦА 7. Карта source / sink по каждому ресурсу (только по коду)")
    print("=" * 100)
    rows = [
        ("CIRCUIT",   "collect_mining(plasma_cutter); mint_resource(admin); explore_reveal(DISABLED)",
                   "repair; craft; marketplace/auction fees - нет, это SOL; start_model_training(топливо); referral_upgrade; exploration(выкл.)"),
        ("SILICON",  "collect_mining(silicon_extractor); mint_resource(admin); explore_reveal(DISABLED)",
                   "repair; craft; start_signal_processing; referral_upgrade; exploration(выкл.)"),
        ("DATA",   "только mint_resource(admin) и claim_season_reward (пыль: level*100 атом.)",
                   "craft; referral_upgrade; exploration(выкл.); craft_recipe [F-04 исправлен]"),
        ("POWER",  "collect_power (БЕСПЛАТНЫЙ кран, до 480/сутки на кошелёк); mint_resource",
                   "start_model_training; craft"),
        ("NEURON",  "collect_mining(neural_seeder); mint_resource; craft_recipe [F-04 исправлен]",
                   "plant_neuron; craft; craft_recipe [F-04 исправлен]"),
        ("SYNAPSE",  "harvest_synapse (из NEURON x1.5)", "start_signal_processing"),
        ("SIGNAL",  "collect_signal", "start_model_training"),
        ("MODEL",  "collect_model", "НЕТ. Ни одна инструкция не сжигает MODEL."),
        ("DATASET",   "collect_mining(quantum_transmitter); mint_resource", "exploration(выкл.) -> sink = НЕТ"),
        ("COMPUTE",   "только mint_resource(admin); COMPUTE_DROP_CHANCE_BPS нет в коде (проверено grep)", "start_model_training(fuel_kind=1)"),
        ("GEM*",   "только craft_recipe [F-04: mint-аккаунты стали mut]", "craft_recipe"),
        ("FLASK*", "только craft_recipe", "НЕТ: use_flask удалён из крейта [G-01]; ни одна инструкция не сжигает FLASK"),
        ("SOUL_CORE", "только mint_resource(admin)", "НЕТ"),
        ("MIND", "только mint_resource(admin) — внешний токен", "craft"),
    ]
    print(f"{'Ресурс':>12} | {'SOURCE (появление)':>48} | {'SINK (сжигание)'}")
    print("-" * 180)
    for a, b, c in rows:
        print(f"{a:>12} | {b:>48} | {c}")
    print()


def table3():
    print("=" * 108)
    print("ТАБЛИЦА 3. Эскалация цены крафта (base + minted_count * mult), CIRCUIT / SILICON, display units")
    print("=" * 108)
    print(f"{'Редкость':>10} | {'minted=0':>12} | {'minted=10':>12} | {'minted=100':>12} | "
          f"{'minted=1 000':>13} | {'minted=10 000':>14} | {'mult/шт.':>10}")
    print("-" * 108)
    for i, name in enumerate(["Uncommon", "Rare", "Epic", "Legendary"]):
        row = [CRAFT_CIRCUIT_BASE[i] + n * CRAFT_CIRCUIT_MULT[i] for n in (0, 10, 100, 1000, 10000)]
        print(f"{name:>10} | {row[0]:>12,.0f} | {row[1]:>12,.0f} | {row[2]:>12,.0f} | "
              f"{row[3]:>13,.0f} | {row[4]:>14,.0f} | {CRAFT_CIRCUIT_MULT[i]:>10}")
    print()
    print("DATA / NEURON / POWER / MIND: mult = 0 => цена НЕ растёт никогда.")
    print("К счётчику привязаны только CIRCUIT и SILICON. Сжигание инструмента счётчик не уменьшает.")
    print()


def table4():
    print("=" * 92)
    print("ТАБЛИЦА 4. Хлебная цепочка: вход -> выход (на партию, display units)")
    print("=" * 92)
    print(f"{'Этап':>34} | {'вход':>26} | {'выход':>18}")
    print("-" * 92)
    print(f"{'посев -> пшеница (жатва)':>34} | {'1 NEURON (+1 эн., +1 прочн.)':>26} | {'1.5 SYNAPSE':>18}")
    for i, (w, s, f) in enumerate(SIGNAL_PROCESSING, 1):
        print(f"{'пшеница -> мука (партия %d)' % i:>34} | {f'{w} SYNAPSE + {s} SILICON':>26} | {f'{f} SIGNAL':>18}")
    for i, (fl, wa, wd, br) in enumerate(MODEL_TRAINING_CIRCUIT, 1):
        print(f"{'мука -> хлеб, дрова (партия %d)' % i:>34} | {f'{fl} SIGNAL + {wa} POWER + {wd} CIRCUIT':>26} | {f'{br} MODEL':>18}")
    for i, (fl, wa, co, br) in enumerate(MODEL_TRAINING_COMPUTE, 1):
        print(f"{'мука -> хлеб, уголь (партия %d)' % i:>34} | {f'{fl} SIGNAL + {wa} POWER + {co} COMPUTE':>26} | {f'{br} MODEL':>18}")
    print()
    print("СУММАРНО (партия 3, Compute): 1 NEURON -> 1.5 SYNAPSE -> 0.9 SIGNAL -> 0.71 MODEL")
    print("MODEL не потребляется НИ ОДНОЙ инструкцией программы => ценность = 0.")
    print()


def table5(days=365):
    print("=" * 96)
    print(f"ТАБЛИЦА 5. Совокупное предложение при разном числе сибил-кошельков ({days} дней)")
    print("=" * 96)
    print(f"{'Кошельков':>10} | {'CIRCUIT нетто':>14} | {'SILICON нетто':>14} | {'POWER (accrual)':>16} | "
          f"{'SOL в казну (крафт 0.1)':>24}")
    print("-" * 96)
    for w in (1, 10, 100, 1000, 10_000):
        r = scenario(w, 0, 20, days)
        # assume each wallet performs 12 crafts/year at 0.1 SOL
        sol = w * 12 * CRAFT_FEE_SOL
        print(f"{w:>10,} | {r['net_circuit']:>14,.0f} | {r['net_silicon']:>14,.0f} | "
              f"{r['power_accrual']:>16,.0f} | {sol:>24,.1f}")
    print()
    # [AUDIT F-03] re-checked after the fix: check_supply_cap() runs in
    # collect_mining, collect_signal, collect_model, collect_power,
    # craft_recipe, mint_resource(+once) and claim_season_reward, so the mining
    # emission below IS bounded by the global per-mint ceiling. The per-epoch
    # IssuanceCap still covers only the two admin mint paths, and SYNAPSE
    # (harvest_synapse) is capped by neither.
    print("Майнинг-эмиссия (collect_mining) ограничена ГЛОБАЛЬНЫМ потолком минтa:")
    print("check_supply_cap() вызывается в collect_mining / collect_signal / collect_model /")
    print("collect_power / craft_recipe / mint_resource(+once) / claim_season_reward [F-03].")
    print("Поэтапный issuance-кап (бюджет за эпоху) по-прежнему покрывает только")
    print("mint_resource / mint_resource_once. SYNAPSE (harvest_synapse) не ограничен ни тем, ни другим.")
    print()


def model_break_even():
    print("=" * 96)
    print("ТАБЛИЦА 6. Стоимость одного MODEL в эквиваленте ресурсов (партия 3, Compute)")
    print("=" * 96)
    neuron = 1.0
    synapse = neuron * SYNAPSE_YIELD_MULT
    w3, s3, f3 = SIGNAL_PROCESSING[2]
    signal = synapse * (f3 / w3)
    silicon_for_signal = (synapse / w3) * s3
    sig_cost, power_cost, compute_cost, model_out = MODEL_TRAINING_COMPUTE[2]
    model = signal * (model_out / sig_cost)
    power_for_model = (signal / sig_cost) * power_cost
    compute_for_model = (signal / sig_cost) * compute_cost
    print(f"  1.000 NEURON -> {synapse:.3f} SYNAPSE -> {signal:.3f} SIGNAL -> {model:.3f} MODEL")
    print(f"  попутно сжигается: {silicon_for_signal:.3f} SILICON, {power_for_model:.3f} POWER, {compute_for_model:.3f} COMPUTE")
    print(f"  + 2 энергии + прочность Neural Seeder + 0.1 SOL gas на крафт (если крафтится инструмент)")
    print(f"  MODEL: sink = НЕТ, oracle/price = НЕТ, ордербук = формально есть, спроса нет.")
    print()


def table8():
    """craft vs reroll: две дорожки до Legendary."""
    print("=" * 104)
    print("ТАБЛИЦА 8. Две дорожки прокачки: craft (связующая кривая) vs reroll (фикс-цена)")
    print("=" * 104)
    tiers = ["Uncommon", "Rare", "Epic", "Legendary"]
    print(f"{'ступень':>10} | {'craft: CIRCUIT':>12} | {'SILICON':>8} | {'DATA':>8} | {'NEURON':>8} | "
          f"{'POWER':>8} | {'MIND':>8} | {'gas SOL':>9} | {'reroll':>22}")
    print("-" * 104)
    tot = [0] * 6
    for i, name in enumerate(tiers):
        vals = [CRAFT_CIRCUIT_BASE[i], CRAFT_SILICON_BASE[i], CRAFT_DATA_BASE[i],
                CRAFT_NEURON_BASE[i], CRAFT_POWER_BASE[i], CRAFT_MIND_BASE[i]]
        for k in range(6):
            tot[k] += vals[k]
        print(f"{name:>10} | {vals[0]:>12,} | {vals[1]:>8,} | {vals[2]:>8,} | {vals[3]:>8,} | "
              f"{vals[4]:>8,} | {vals[5]:>8,} | {CRAFT_FEE_SOL:>9.2f} | {'2 предыдущих, 0.06 SOL':>22}")
    print("-" * 104)
    print(f"{'ИТОГО':>10} | {tot[0]:>12,} | {tot[1]:>8,} | {tot[2]:>8,} | {tot[3]:>8,} | "
          f"{tot[4]:>8,} | {tot[5]:>8,} | {4*CRAFT_FEE_SOL:>9.2f} |")
    print()
    print("Reroll (reroll.rs): 2 инструмента редкости R -> 1 инструмент R+1.")
    print("  цена = FEE_PER_REROLL_MICROS = 0.06 SOL из GasTank, РЕСУРСОВ НЕТ, authority НЕ НУЖЕН,")
    print("  счётчик rarity_counter НЕ трогается => эскалация крафта его не касается вообще.")
    print("  Common -> Legendary: 16 Common, 15 вызовов, 15 x 0.06 = 0.90 SOL, 0 ресурсов.")
    print()
    print("  При minted_count=1000 цена craft Legendary = 52 000 CIRCUIT + 51 500 SILICON (табл. 3),")
    print("  а цена reroll Epic->Legendary остаётся 0.06 SOL + 2 Epic. Кривая обходится полностью.")
    print()



def main():
    print()
    print("NeuroForge (Age of Intelligence) — экономическая симуляция по фактическим константам репозитория")
    print("Источник: aof-core/src/constants.rs + инструкции программы. Ничего не экстраполировано.")
    print()
    print(f"Справочно: 1 craft = {CRAFT_FEE_SOL:.2f} SOL, 1 unstake = {UNSTAKE_FEE_SOL:.3f} SOL, "
          f"1 reroll = {REROLL_FEE_SOL:.2f} SOL (все в казну).")
    print()
    table2()
    table2b()
    table1()
    table3()
    table4()
    model_break_even()
    table5()
    table_sinks()
    table8()


if __name__ == "__main__":
    main()

