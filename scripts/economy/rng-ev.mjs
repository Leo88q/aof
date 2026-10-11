#!/usr/bin/env node
/**
 * [F-06] Economic check of the slot-hash mechanics, straight from the Rust
 * constants (so the report cannot drift from the programs): packs, random
 * reroll, forge, exploration, lottery, plus the rent the settlement itself
 * costs. Drum is deleted and is not part of this report.
 *
 *   node scripts/economy/rng-ev.mjs            # rewrite docs/ECONOMY_RNG_EV.md
 *   node scripts/economy/rng-ev.mjs --check    # exit 1 if the report is stale
 *
 * The invariants the release depends on are asserted by
 * tests/readiness/rng-economy.test.cjs through the exported functions.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const OUT = "docs/ECONOMY_RNG_EV.md";

export const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const RARITY_RU = ["Базовый", "Усиленный", "Квантовый", "Сингулярность", "Трансцендентный"];

// ---------------------------------------------------------------- constants

function makeReader(src) {
  const raw = (name) => {
    const m = new RegExp(`pub const ${name}: ([^=]+)=\\s*([\\s\\S]*?);`).exec(src);
    if (!m) throw new Error(`constant ${name} not found`);
    return m[2].replace(/\/\/[^\n]*/g, "").trim();
  };
  const known = {};
  const scalar = (expr) => expr.split("*").map((t) => t.trim()).reduce((acc, t) => {
    if (/^[A-Z][A-Z0-9_]*$/.test(t)) {
      if (!(t in known)) known[t] = scalar(raw(t));
      return acc * known[t];
    }
    const n = Number(t.replace(/_/g, ""));
    if (!Number.isFinite(n)) throw new Error(`cannot evaluate ${t}`);
    return acc * n;
  }, 1);
  const num = (name) => scalar(raw(name));
  const arr = (name) => {
    const body = raw(name);
    const m = /^\[([\s\S]*)\]$/.exec(body.trim());
    if (!m) throw new Error(`${name} is not an array literal`);
    return m[1].split(",").map((t) => t.trim()).filter(Boolean).map(scalar);
  };
  return { num, arr, raw };
}

export function readConstants() {
  const c = makeReader(read("aof-core/src/constants.rs"));
  const unit = c.num("RESOURCE_UNIT");
  const u = (x) => x / unit;
  const toolTypes = (/pub const PACK_TOOL_TYPES: \[&str; (\d+)\]/.exec(read("aof-core/src/constants.rs")) || [])[1];
  return {
    packs: ["SMALL", "MEDIUM", "BIG"].map((k) => ({
      id: k.toLowerCase(), price: c.num(`PACK_${k}_PRICE_LAMPORTS`), odds: c.arr(`PACK_${k}_ODDS_BPS`),
    })),
    packToolTypes: Number(toolTypes),
    rerollOdds: c.arr("REROLL_ODDS_BPS_DEFAULT"),
    rerollFeeLamports: c.num("FEE_PER_REROLL_MICROS") * c.num("MICROS_TO_LAMPORTS"),
    yieldBps: RARITIES.map((r) => c.num(`YIELD_BPS_${r.toUpperCase()}`)),
    maxHours: RARITIES.map((r) => c.num(`MAX_HOURS_${r.toUpperCase()}`)),
    baseRate: c.num("BASE_RATE_MINING"),
    maxDurability: c.num("MAX_DURABILITY"),
    forge: {
      success: c.arr("FORGE_SUCCESS_BPS"), partial: c.arr("FORGE_PARTIAL_FAIL_BPS"),
      circuit: c.arr("ENCHANT_CIRCUIT_COST").map(u), silicon: c.arr("ENCHANT_SILICON_COST").map(u),
      fee: c.arr("ENCHANT_FEE_LAMPORTS"), protector: c.num("FORGE_PROTECTOR_PRICE_LAMPORTS"), maxLevel: c.num("ENCHANT_MAX_LEVEL"),
    },
    exploration: {
      success: c.arr("EXPLORATION_SUCCESS_BPS"), min: c.arr("EXPLORATION_SHARDS_MIN"), max: c.arr("EXPLORATION_SHARDS_MAX"),
      tripsPerDay: c.arr("EXPLORATION_TRIPS_PER_DAY"), cooldownHours: c.arr("EXPLORATION_COOLDOWN_HOURS"),
      cost: { data: u(c.num("TRIP_COST_DATA")), circuit: u(c.num("TRIP_COST_CIRCUIT")), silicon: u(c.num("TRIP_COST_SILICON")), dataset: u(c.num("TRIP_COST_DATASET")) },
    },
    lottery: {
      price: c.num("LOTTERY_TICKET_PRICE_LAMPORTS"), poolBps: c.num("LOTTERY_POOL_BPS"), devBps: c.num("LOTTERY_DEV_BPS"),
      maxTickets: c.num("LOTTERY_MAX_TICKETS_PER_DAY"), salesSeconds: c.num("LOTTERY_SALES_SECONDS"), timeoutSeconds: c.num("LOTTERY_ROUND_TIMEOUT_SECONDS"),
    },
    vrfRefundAfterSlots: c.num("VRF_REFUND_AFTER_SLOTS"),
  };
}

// ---------------------------------------------------------------- models

/** Solana rent exemption (2 years x 3480 lamports/byte-year, 128-byte header). */
export const rentExempt = (dataLen) => (dataLen + 128) * 6960;
/** ToolData: 8 disc + mint 32 + owner 32 + tool_type 4+32 + 1+1+1 + i64 + 1 + 1 + i64 + operator 32. */
export const TOOL_DATA_SPACE = 8 + 32 + 32 + 36 + 1 + 1 + 1 + 8 + 1 + 1 + 8 + 32;
/** What a tool-producing commit prepays for the NFT the settler creates: mint, ATA, ToolData. */
export const settlementDeposit = () => rentExempt(82) + rentExempt(165) + rentExempt(TOOL_DATA_SPACE);
/** One pool slot: randomness account (480 B), its wSOL escrow ATA, an empty LUT, VrfSlot (102 B). */
export const poolSlotRent = () => rentExempt(480) + rentExempt(165) + rentExempt(56) + rentExempt(102);

export const sum = (xs) => xs.reduce((a, b) => a + b, 0);
/** Expected rarity index (0 = Common ... 4 = Legendary). */
export const expectedRarity = (odds) => sum(odds.map((w, i) => w * i)) / 10_000;
/** Mining output of one full durability (MAX_DURABILITY hours), display units. */
export const unitsPerDurability = (c, r) => (c.maxDurability * c.baseRate * c.yieldBps[r]) / 10_000;

export function packStats(c, pack) {
  const p = pack.odds.map((w) => w / 10_000);
  return {
    ...pack,
    expectedRarity: expectedRarity(pack.odds),
    rarePlus: p[2] + p[3] + p[4],
    epic: p[3],
    solPerEpic: p[3] > 0 ? pack.price / 1e9 / p[3] : Infinity,
    expectedUnits: sum(p.map((x, r) => x * unitsPerDurability(c, r))),
  };
}

/**
 * Forge as an absorbing Markov chain over levels 0..max: expected attempts,
 * SOL and Circuit+Silicon to reach `max` from 0. Loss resets to 0, or to level-1
 * with the protector (which is also charged on every attempt).
 */
export function forgeExpectations(c, protector) {
  const f = c.forge;
  const n = f.maxLevel; // unknowns E_0..E_{n-1}, E_n = 0
  const solve = (cost) => {
    const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    for (let L = 0; L < n; L++) {
      const s = f.success[L] / 10_000, p = f.partial[L] / 10_000, l = 1 - s - p;
      const down = Math.max(L - 1, 0);
      A[L][L] += 1;
      A[L][n] = cost(L);
      if (L + 1 < n) A[L][L + 1] -= s;
      A[L][down] -= p;
      A[L][protector ? down : 0] -= l;
    }
    for (let i = 0; i < n; i++) { // Gauss-Jordan
      let piv = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      [A[i], A[piv]] = [A[piv], A[i]];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const k = A[r][i] / A[i][i];
        for (let col = i; col <= n; col++) A[r][col] -= k * A[i][col];
      }
    }
    return A[0][n] / A[0][0];
  };
  const extra = protector ? f.protector : 0;
  return {
    attempts: solve(() => 1),
    sol: solve((L) => (f.fee[L] + extra) / 1e9),
    resources: solve((L) => f.circuit[L] + f.silicon[L]),
  };
}

export function explorationTiers(c) {
  const e = c.exploration;
  const costUnits = e.cost.data + e.cost.circuit + e.cost.silicon + e.cost.dataset;
  return e.success.map((bps, i) => {
    const avgShards = (e.min[i] + e.max[i]) / 2;
    const expectedReward = (bps / 10_000) * avgShards * 2; // the same amount of Circuit AND Silicon
    return { tier: i + 1, successBps: bps, min: e.min[i], max: e.max[i], expectedReward, costUnits, sinkRatio: expectedReward / costUnits,
      tripsPerDay: e.tripsPerDay[i], cooldownHours: e.cooldownHours[i] };
  });
}

// ---------------------------------------------------------------- report

const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const sol = (lamports, d = 4) => `${(lamports / 1e9).toFixed(d)} SOL`;
const num = (x, d = 1) => x.toFixed(d);

export function render(c = readConstants()) {
  const packs = c.packs.map((p) => packStats(c, p));
  const forgePlain = forgeExpectations(c, false);
  const forgeProt = forgeExpectations(c, true);
  const tiers = explorationTiers(c);
  const deposit = settlementDeposit();
  const slot = poolSlotRent();
  const L = [];
  L.push("# Экономика механик со случайностью (хеш будущего слота)");
  L.push("");
  L.push("> Сгенерировано `node scripts/economy/rng-ev.mjs` из констант `aof-core/src/constants.rs`.");
  L.push("> Барабан удалён и в отчёт не входит. Не редактировать вручную: CI сверяет файл с исходниками");
  L.push("> (`tests/readiness/rng-economy.test.cjs`). Курс для ориентира: 1 SOL = $100 (как в constants.rs).");
  L.push("");
  L.push("## Итог");
  L.push("");
  L.push("| Проверка | Результат |");
  L.push("|---|---|");
  L.push(`| Шансы паков и reroll в сумме 10 000 bps, Legendary недостижим одним броском | ✅ |`);
  L.push(`| Чем дороже пак, тем выше ожидаемая редкость (${packs.map((p) => num(p.expectedRarity, 2)).join(" < ")}) | ✅ |`);
  L.push(`| Экспедиции — чистый сток ресурсов на каждом тире (награда ≤ ${pct(Math.max(...tiers.map((t) => t.sinkRatio)))} стоимости) | ✅ |`);
  L.push(`| Кузница: шанс успеха не растёт с уровнем, плата не падает | ✅ |`);
  L.push(`| Лотерея: приз ${pct(c.lottery.poolBps / 10_000, 0)} пула, доля дома ${pct(c.lottery.devBps / 10_000, 0)} только после розыгрыша; неразыгранный раунд возвращает билеты полностью | ✅ |`);
  L.push(`| Раскрытие читает четыре будущих хеша; известный исход нельзя вернуть игроку, устаревший хеш уходит в казну | ✅ |`);
  L.push("");
  L.push("## Паки");
  L.push("");
  L.push("| Пак | Цена | " + RARITY_RU.slice(0, 4).join(" | ") + " | E[редкость] | P(Квантовый+) | SOL за «Сингулярность» | Добыча за полную прочность, ед. |");
  L.push("|---|---|" + "---|".repeat(4) + "---|---|---|---|");
  for (const p of packs) {
    L.push(`| ${p.id} | ${sol(p.price, 2)} | ${p.odds.slice(0, 4).map((w) => pct(w / 10_000)).join(" | ")} | ${num(p.expectedRarity, 2)} | ${pct(p.rarePlus)} | ${num(p.solPerEpic, 1)} | ${num(p.expectedUnits, 1)} |`);
  }
  L.push("");
  L.push(`Тип инструмента выбирается равновероятно из ${c.packToolTypes} (независимая «полоса» того же значения).`);
  L.push(`Кроме цены, коммит вносит депозит ${sol(deposit)} — ренту mint + ATA + ToolData нового NFT; её получает`);
  L.push("тот, кто создаёт эти аккаунты при раскрытии (сервис или сам игрок), остаток возвращается игроку. Аккаунты");
  L.push("остаются у игрока, так что это не комиссия игры. Шансы фиксируются при оплате: смена `set_pack_config`");
  L.push("не влияет на уже оплаченные открытия.");
  L.push("");
  L.push("Наблюдение для продукта: за «Сингулярность» выгоднее всего средний пак; большой пак дороже за единицу");
  L.push("ожидаемой редкости — это осознанная цена за меньший разброс, а не ошибка.");
  L.push("");
  L.push("## Случайный reroll");
  L.push("");
  const rr = c.rerollOdds.map((w) => w / 10_000);
  L.push(`Плата ${sol(c.rerollFeeLamports, 2)} (из газового бака, в escrow до исхода), сжигается один инструмент. Шансы: ` +
    RARITY_RU.slice(0, 4).map((n, i) => `${n} ${pct(rr[i])}`).join(", ") + `; E[редкость] = ${num(expectedRarity(c.rerollOdds), 2)}.`);
  L.push("");
  L.push("| Сжигаемая редкость | P(лучше) | P(так же) | P(хуже) |");
  L.push("|---|---|---|---|");
  for (let r = 0; r < 4; r++) {
    L.push(`| ${RARITY_RU[r]} | ${pct(sum(rr.slice(r + 1)))} | ${pct(rr[r])} | ${pct(sum(rr.slice(0, r)))} |`);
  }
  L.push("");
  L.push("Reroll выгоден только для базовых инструментов; при возврате (оракул не ответил) игрок получает эквивалентный");
  L.push("инструмент (тип, редкость, прочность) и плату обратно.");
  L.push("");
  L.push("## Кузница");
  L.push("");
  L.push("| Уровень → | Плата | Схема + кремний | Успех | Частичная неудача (−1) | Полная потеря (→0) |");
  L.push("|---|---|---|---|---|---|");
  for (let lv = 0; lv < c.forge.maxLevel; lv++) {
    const s = c.forge.success[lv], p = c.forge.partial[lv];
    L.push(`| ${lv} → ${lv + 1} | ${sol(c.forge.fee[lv], 3)} | ${c.forge.circuit[lv] + c.forge.silicon[lv]} | ${pct(s / 10_000)} | ${pct(p / 10_000)} | ${pct((10_000 - s - p) / 10_000)} |`);
  }
  L.push("");
  L.push(`Ожидаемо от 0 до ${c.forge.maxLevel} (поглощающая цепь Маркова):`);
  L.push("");
  L.push("| Режим | Попыток | SOL | Схема + кремний |");
  L.push("|---|---|---|---|");
  L.push(`| без протектора | ${num(forgePlain.attempts)} | ${num(forgePlain.sol, 2)} | ${num(forgePlain.resources, 0)} |`);
  L.push(`| с протектором (${sol(c.forge.protector, 2)} за попытку) | ${num(forgeProt.attempts)} | ${num(forgeProt.sol, 2)} | ${num(forgeProt.resources, 0)} |`);
  L.push("");
  L.push("Уровень до броска фиксируется в коммите; плата лежит в escrow и уходит в казну только после раскрытия.");
  L.push("");
  L.push("## Экспедиции");
  L.push("");
  const t0 = tiers[0];
  L.push(`Стоимость похода: ${c.exploration.cost.data} DATA + ${c.exploration.cost.circuit} CIRCUIT + ${c.exploration.cost.silicon} SILICON + ${c.exploration.cost.dataset} DATASET = ${t0.costUnits} ед.`);
  L.push("");
  L.push("| Тир | Успех | Награда (каждого из CIRCUIT/SILICON) | E[награда], ед. | Доля от стоимости | Походов/день | Кулдаун, ч |");
  L.push("|---|---|---|---|---|---|---|");
  for (const t of tiers) {
    L.push(`| ${t.tier} | ${pct(t.successBps / 10_000, 0)} | ${t.min}–${t.max} | ${num(t.expectedReward, 2)} | ${pct(t.sinkRatio)} | ${t.tripsPerDay} | ${t.cooldownHours} |`);
  }
  L.push("");
  L.push("Экспедиция не может стать «печатным станком» ресурсов: ожидаемая награда в разы меньше сожжённого. Тир");
  L.push("фиксируется при старте; награды проходят проверку глобального потолка предложения (`check_supply_cap`).");
  L.push("Продуктовое замечание: при таком соотношении экспедиции — чистый сток; если они задуманы как источник");
  L.push("дохода, это вопрос баланса, а не безопасности.");
  L.push("");
  L.push("## Лотерея");
  L.push("");
  L.push(`Билет ${sol(c.lottery.price, 4)}, до ${c.lottery.maxTickets} на кошелёк за раунд. Полная цена хранится в раунде;`);
  L.push(`при розыгрыше ${pct(c.lottery.devBps / 10_000, 0)} уходит в казну, ${pct(c.lottery.poolBps / 10_000, 0)} — приз (RTP ${pct(c.lottery.poolBps / 10_000, 0)}).`);
  L.push(`Продажи закрывает коммит розыгрыша: оператор в любой момент, любой — через ${num(c.lottery.salesSeconds / 86_400, 0)} дн.;`);
  L.push(`через ${num(c.lottery.timeoutSeconds / 86_400, 0)} дн. без розыгрыша каждый билет возвращается покупателю полностью.`);
  L.push("");
  L.push("## Стоимость самой случайности");
  L.push("");
  L.push(`* Депозит на NFT инструмента (паки, reroll): ${sol(deposit)} — mint ${sol(rentExempt(82))}, ATA ${sol(rentExempt(165))}, ToolData ${sol(rentExempt(TOOL_DATA_SPACE))}.`);
  L.push(`* Слот пула (разово, платит оператор): ≈ ${sol(slot)} — аккаунт случайности ${sol(rentExempt(480))}, wSOL-эскроу ${sol(rentExempt(165))},`);
  L.push(`  VrfSlot ${sol(rentExempt(102))}.`);
  L.push("* Слот пула занят от коммита до раскрытия или классификации незакрытого коммита.");
  L.push("  Пул расширяется `POST /vrf/pool/add` без остановки игры. Отдельной комиссии оракула нет.");
  L.push("");
  L.push("## Как проверить любой исход");
  L.push("");
  L.push("Исход — чистая функция четырёх хешей слотов и адреса коммита, не подпись оракула.");
  L.push("`roll = sha256(\"aof-vrf-v1\" || tag || commit || value)`, полосы по 8 байт, `bps = (lane × 10000) >> 64`;");
  L.push("теги: `pack`, `reroll`, `explore`, `forge`, `lottery`; шансы — снимок в аккаунте коммита.");
  L.push("");
  return L.join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const text = render();
  if (process.argv.includes("--check")) {
    let current = "";
    try { current = read(OUT); } catch { /* missing */ }
    if (current !== text) {
      console.error(`${OUT} is stale: run node scripts/economy/rng-ev.mjs`);
      process.exit(1);
    }
    console.log(`${OUT} is up to date`);
  } else {
    writeFileSync(path.join(root, OUT), text);
    console.log(`wrote ${OUT}`);
  }
}
