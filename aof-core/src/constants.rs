use crate::state::*;
use crate::ResourceKind;

use anchor_lang::prelude::*;

/// Seeds for PDAs
pub const CONFIG_SEED: &[u8] = b"config";
pub const AUTH_SEED: &[u8] = b"auth";
pub const VAULT_SEED: &[u8] = b"vault";
pub const PLAYER_SEED: &[u8] = b"player";
pub const GASTANK_SEED: &[u8] = b"gastank";
pub const TOOL_SEED: &[u8] = b"tool";
// [НОВОЕ] seeds для добавленных PDA (см. AUDIT_AND_CHANGES.md / AUDIT_V2 / AUDIT_V3)
pub const RARITY_COUNTER_SEED: &[u8] = b"rarity_counter";
/// Per-ResourceKind issuance cap PDA: seeds = [ISSUANCE_CAP_SEED, &[kind as u8]].
pub const ISSUANCE_CAP_SEED: &[u8] = b"issuance_cap";
/// [AUDIT F-01] Per-mint withdrawal rate limiter for `pay_out`:
/// seeds = [VAULT_GUARD_SEED, mint.key()].
pub const VAULT_GUARD_SEED: &[u8] = b"vault_guard";
/// [AUDIT F-16] Allowlist entry marking an NFT mint as a Historian/Medallion
/// collectible: seeds = [COLLECTOR_ALLOW_SEED, mint.key()].
pub const COLLECTOR_ALLOW_SEED: &[u8] = b"collector_allow";
/// Upper bound for an epoch (~30 days at 400ms slots) so a typo cannot
/// silently create a near-permanent window.
pub const ISSUANCE_EPOCH_MAX_SLOTS: u64 = 6_480_000;
/// Lower bound (~10 minutes) so an epoch cannot be made short enough to
/// render the cap meaningless.
pub const ISSUANCE_EPOCH_MIN_SLOTS: u64 = 1_500;
pub const CRAFT_ECONOMY_SEED: &[u8] = b"craft_economy";
pub const COLLECTOR_SEED: &[u8] = b"collector";

/// Account space allocations
// [ИЗМЕНЕНО]: +2 байта (historian_count:u8, medallion_count:u8) относительно
// присланного PLAYER_SPACE — см. state::Player, комментарий у новых полей.
// [НОВОЕ]
// ===== [НОВОЕ] SKR-привилегия =====
pub const SKR_MIN_BALANCE: u64 = 3_000_000_000_000; // 3000 SKR (с 9 decimals)
pub const SKR_CRAFT_DISCOUNT_BPS: u16 = 1500; // 15% скидка на POTATO
 // 6 ресурсов // 4 массива по 4 x u64 + bump

/// Fee constants (in micros, 1 SOL = 1e6 micros)
pub const FEE_PER_CRAFT_MICROS: u64 = 100_000;
pub const FEE_PER_NFT_MICROS: u64 = 10_000;
pub const FEE_PER_PACK_MICROS: u64 = 10_000;
// [НОВОЕ]: в присланных файлах отдельной комиссии за reroll не было вообще
// (ни константы, ни поля в Config) — reroll был бесплатным. Добавляю константой
// по аналогии с остальными FEE_PER_*, а не полем Config — чтобы не менять
// CONFIG_SPACE и не трогать layout уже описанного вами аккаунта.
pub const FEE_PER_REROLL_MICROS: u64 = 60_000;

// [SECURITY_CHECKLIST_REVIEW F-C] Hard ceilings for `set_fees` (10x the defaults).
// `unstake` requires `gastank.balance_micros >= unstake_fee`, so an unbounded
// fee (e.g. u64::MAX) would have held every staked NFT hostage.
pub const MAX_CRAFT_FEE_MICROS: u64 = 1_000_000; // 1 SOL
pub const MAX_UNSTAKE_FEE_MICROS: u64 = 100_000; // 0.1 SOL

/// Max mining hours by rarity
pub const MAX_HOURS_COMMON: u8 = 8;
pub const MAX_HOURS_UNCOMMON: u8 = 12;
pub const MAX_HOURS_RARE: u8 = 14;
pub const MAX_HOURS_EPIC: u8 = 20;
pub const MAX_HOURS_LEGENDARY: u8 = 20;

/// Gas tank cooldown (12 hours in seconds)
pub const GASTANK_COOLDOWN_SECONDS: i64 = 12 * 3600;
/// [AUDIT F-20] Withdrawals up to this size do not arm the 12h cooldown, so
/// small balances are never trapped behind it. Anything above it is
/// rate-limited exactly as before.
pub const GASTANK_INSTANT_WITHDRAW_MICROS: u64 = 200_000; // 0.2 SOL

/// Max durability
pub const MAX_DURABILITY: u8 = 20;

/// [AUDIT F-15] Largest single `adjust_player_capacity` step. The instruction
/// is authority-only but unbounded, so a bogus/compromised server call could
/// zero a player's villagers and permanently brick their mining.
pub const MAX_CAPACITY_DELTA: u32 = 6;

/// [AUDIT F-23] A lottery round that is never revealed strands its pool.
/// After this timeout anyone may sweep the lamports back to the treasury and
/// close the round instead of leaving them locked forever.
pub const LOTTERY_ROUND_TIMEOUT_SECONDS: i64 = 14 * 86400;

/// Collectors lock seconds (3 days)
pub const COLLECTORS_LOCK_SECONDS: i64 = 3 * 86400;

/// Conversion: micros -> lamports (1e9 / 1e6 = 1000)
pub const MICROS_TO_LAMPORTS: u64 = 1000;

// [НОВОЕ] Стартовое число жителей — [ФАКТ, подтверждено в index.js]:
// `villagers_available: 6, villagers: 6` при создании пользователя.
pub const DEFAULT_VILLAGERS: u32 = 6;

// Resource mints are deployed with 9 decimals. Keep all on-chain economy
// amounts in atomic units; UI/backend divide by this scale for display.
pub const RESOURCE_UNIT: u64 = 1_000_000_000;

/// Number of `ResourceKind` variants. Kept in sync by
/// `state::resource_kind_count_is_complete` (cargo test).
pub const RESOURCE_KIND_COUNT: usize = 27;
/// Sentinel for `MaterialMints::max_supply`: no ceiling configured.
pub const SUPPLY_CAP_UNLIMITED: u64 = u64::MAX;

// [НОВОЕ] Стоимость ремонта (STONE за 1 юнит прочности), по редкости —
// используется через Rarity::repair_stone_cost_per_unit() в state.rs,
// тем же паттерном, что MAX_HOURS_* + Rarity::max_hours().
// =====================================================================
// [AUDIT F-08] Кривая ремонта пересчитана.
//
// Было: yield растёт 10 -> 18 (x1.8), а ремонт 3 -> 70 WOOD (x23.3) и
// 2 -> 45 STONE (x22.5). Портфель 3 axe + 3 pick по 20 ч/сутки убыточен
// по обоим ресурсам уже с Rare (-900/-300), а с Uncommon — по WOOD.
// Условие безубыточности портфеля: `yield_per_hour > 2 * repair_per_unit`
// (3 добывающих инструмента кормят ремонт всех 6).
//
// Стало: ремонт растёт вдвое медленнее добычи (x1.67 WOOD, x1.75 STONE
// против x1.8 у yield), поэтому нетто-маржа строго растёт с редкостью:
//   Common    +12.0 WOOD/ч  +18.0 STONE/ч
//   Uncommon  +13.5         +19.5
//   Rare      +15.0         +21.0
//   Epic      +18.0         +27.0
//   Legendary +24.0         +33.0
// Инвариант проверяется юнит-тестом `economy_tests::mining_pnl_is_positive_and_monotonic`.
// =====================================================================
const HALF_UNIT: u64 = RESOURCE_UNIT / 2;

pub const REPAIR_SILICON_COMMON: u64 = 2 * RESOURCE_UNIT;
pub const REPAIR_SILICON_UNCOMMON: u64 = 2 * RESOURCE_UNIT + HALF_UNIT;
pub const REPAIR_SILICON_RARE: u64 = 2 * RESOURCE_UNIT + HALF_UNIT;
pub const REPAIR_SILICON_EPIC: u64 = 3 * RESOURCE_UNIT;
pub const REPAIR_SILICON_LEGENDARY: u64 = 3 * RESOURCE_UNIT + HALF_UNIT;

// Стоимость ремонта в WOOD за единицу прочности
pub const REPAIR_CIRCUIT_COMMON: u64 = 3 * RESOURCE_UNIT;
pub const REPAIR_CIRCUIT_UNCOMMON: u64 = 3 * RESOURCE_UNIT + HALF_UNIT;
pub const REPAIR_CIRCUIT_RARE: u64 = 4 * RESOURCE_UNIT;
pub const REPAIR_CIRCUIT_EPIC: u64 = 4 * RESOURCE_UNIT + HALF_UNIT;
pub const REPAIR_CIRCUIT_LEGENDARY: u64 = 5 * RESOURCE_UNIT;

// [НОВОЕ] Дефолты bonding-curve цены крафта (см. CraftEconomy в state.rs).
// Индекс массива = rarity.craft_index() (Uncommon=0..Legendary=3).
// Задаются здесь только как значения при первой инициализации CraftEconomy —
// далее меняются владельцем через set_craft_economy, без редеплоя программы.

// =====================================================================
// [НОВОЕ] Полная реализация TOR v4 — паки, честный reroll, exploration,
// рефералы, кузница риска, лотерея, рынок, ордербук, крафт-под-заказ,
// сезонный пасс. См. AUDIT_V4_FULL_IMPLEMENTATION.md.
// =====================================================================

// ----- Seeds -----
// ===== [НОВОЕ] Сбалансированная экономика крафта (6 ресурсов) =====
// Индексы: [0=Uncommon, 1=Rare, 2=Epic, 3=Legendary]
// Base = ~1 час гринда, Mult = рост цены при массовом крафте

pub const CRAFT_CIRCUIT_BASE: [u64; 4] = [100 * RESOURCE_UNIT, 150 * RESOURCE_UNIT, 500 * RESOURCE_UNIT, 2_000 * RESOURCE_UNIT];
pub const CRAFT_SILICON_BASE: [u64; 4] = [100 * RESOURCE_UNIT, 120 * RESOURCE_UNIT, 400 * RESOURCE_UNIT, 1_500 * RESOURCE_UNIT];
pub const CRAFT_DATA_BASE: [u64; 4] = [50 * RESOURCE_UNIT, 80 * RESOURCE_UNIT, 300 * RESOURCE_UNIT, 1_000 * RESOURCE_UNIT];
pub const CRAFT_NEURON_BASE: [u64; 4] = [20 * RESOURCE_UNIT, 40 * RESOURCE_UNIT, 150 * RESOURCE_UNIT, 500 * RESOURCE_UNIT];
pub const CRAFT_POWER_BASE: [u64; 4] = [10 * RESOURCE_UNIT, 30 * RESOURCE_UNIT, 100 * RESOURCE_UNIT, 400 * RESOURCE_UNIT];
pub const CRAFT_MIND_BASE: [u64; 4] = [10 * RESOURCE_UNIT, 20 * RESOURCE_UNIT, 100 * RESOURCE_UNIT, 500 * RESOURCE_UNIT];

pub const CRAFT_CIRCUIT_MULT: [u64; 4] = [1 * RESOURCE_UNIT, 2 * RESOURCE_UNIT, 10 * RESOURCE_UNIT, 50 * RESOURCE_UNIT];
pub const CRAFT_SILICON_MULT: [u64; 4] = [1 * RESOURCE_UNIT, 2 * RESOURCE_UNIT, 10 * RESOURCE_UNIT, 50 * RESOURCE_UNIT];
pub const CRAFT_DATA_MULT: [u64; 4] = [0, 0, 0, 0]; // Стабильный спрос
pub const CRAFT_NEURON_MULT: [u64; 4] = [0, 0, 0, 0]; // Стабильный спрос
pub const CRAFT_POWER_MULT: [u64; 4] = [0, 0, 0, 0]; // Стабильный спрос
pub const CRAFT_MIND_MULT: [u64; 4] = [0, 0, 0, 0]; // Стабильная утилити-валюта
pub const PACK_CONFIG_SEED: &[u8] = b"pack_config";
pub const PACK_COMMIT_SEED: &[u8] = b"pack_commit";
pub const REROLL_CONFIG_SEED: &[u8] = b"reroll_config";
pub const REROLL_COMMIT_SEED: &[u8] = b"reroll_commit";
pub const EXPLORATION_STATE_SEED: &[u8] = b"exploration_state";
pub const EXPLORATION_COMMIT_SEED: &[u8] = b"exploration_commit";
pub const REFERRAL_LINK_SEED: &[u8] = b"referral_link";
pub const REFERRER_STATS_SEED: &[u8] = b"referrer_stats";
pub const ENCHANT_SLOT_SEED: &[u8] = b"enchant_slot";
pub const FORGE_COMMIT_SEED: &[u8] = b"forge_commit";
pub const LOTTERY_ROUND_SEED: &[u8] = b"lottery_round";
pub const LOTTERY_TICKET_SEED: &[u8] = b"lottery_ticket";
pub const LISTING_SEED: &[u8] = b"listing";
pub const AUCTION_SEED: &[u8] = b"auction";
pub const OFFER_SEED: &[u8] = b"offer";
pub const RENTAL_LISTING_SEED: &[u8] = b"rental_listing";
pub const RENTAL_AGREEMENT_SEED: &[u8] = b"rental_agreement";
pub const RESOURCE_ORDER_SEED: &[u8] = b"resource_order";
pub const CRAFT_ORDER_SEED: &[u8] = b"craft_order";
pub const SEASON_SEED: &[u8] = b"season";
pub const SEASON_PASS_SEED: &[u8] = b"season_pass";

// ----- Паки: цена (в lamports, реальные деньги) и дефолтные шансы (bps, сумма=10000) -----
// [ФАКТ, из аудита реального Ronin index.js]: 3 пака, 4 редкости в луте
// (Legendary из паков не выпадает никогда — только крафтом). Цены — новое
// продуктовое решение из TOR v4 §5.1 (1 SOL = $100, опорная точка).
pub const PACK_SMALL_PRICE_LAMPORTS: u64 = 100_000_000;    // 0.1 SOL
pub const PACK_MEDIUM_PRICE_LAMPORTS: u64 = 300_000_000;   // 0.3 SOL
pub const PACK_BIG_PRICE_LAMPORTS: u64 = 1_000_000_000;    // 1.0 SOL
// [Common, Uncommon, Rare, Epic, Legendary] bps
pub const PACK_SMALL_ODDS_BPS: [u16; 5] = [6_000, 3_200, 700, 100, 0];
pub const PACK_MEDIUM_ODDS_BPS: [u16; 5] = [5_000, 3_500, 1_000, 500, 0];
pub const PACK_BIG_ODDS_BPS: [u16; 5] = [3_500, 4_000, 1_500, 1_000, 0];
// [ФАКТ]: из паков выпадают только Axe/Pick/Spear (3 типа, без Bow).
pub const PACK_TOOL_TYPES: [&str; 3] = ["plasma_cutter", "silicon_extractor", "data_harvester"]; // [REBRAND] ex axe/pick/spear

// ----- Reroll (честный, RNG) — своя таблица шансов, настраиваемая отдельно -----
pub const REROLL_ODDS_BPS_DEFAULT: [u16; 5] = [5_500, 3_000, 1_100, 400, 0];

// ----- Exploration: 10 тиров -----
// [ФАКТ, из аудита index.js]: EXP_TIERS, TRIP_COST = {food:75, wood:35, stone:35}
pub const TRIP_COST_FOOD: u64 = 75 * RESOURCE_UNIT;
pub const TRIP_COST_WOOD: u64 = 35 * RESOURCE_UNIT;
pub const TRIP_COST_STONE: u64 = 35 * RESOURCE_UNIT;
pub const TRIP_COST_MEAT: u64 = 50 * RESOURCE_UNIT; // [НОВОЕ] Мясо для исследования
pub const EXPLORATION_COOLDOWN_HOURS: [u8; 10] = [24, 22, 20, 18, 16, 14, 12, 10, 9, 8];
pub const EXPLORATION_SUCCESS_BPS: [u16; 10] =
    [3_000, 4_000, 5_000, 5_500, 6_000, 6_000, 6_500, 7_000, 7_500, 8_000];
pub const EXPLORATION_SHARDS_MIN: [u8; 10] = [2, 2, 3, 3, 4, 4, 4, 5, 5, 6];
pub const EXPLORATION_SHARDS_MAX: [u8; 10] = [3, 3, 4, 5, 5, 5, 6, 6, 7, 8];
pub const EXPLORATION_TRIPS_PER_DAY: [u8; 10] = [1, 1, 1, 1, 1, 2, 2, 2, 2, 3];
pub const EXPLORATION_UPGRADE_COST_PER_TIER: [u64; 10] =
    [1_000 * RESOURCE_UNIT, 2_000 * RESOURCE_UNIT, 3_000 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT, 5_000 * RESOURCE_UNIT, 6_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 8_000 * RESOURCE_UNIT, 9_000 * RESOURCE_UNIT, 10_000 * RESOURCE_UNIT];
pub const MAX_EXPLORATION_TIER: u8 = 10;
// [ДИЗАЙН-РЕШЕНИЕ, задокументировано]: в отличие от Ronin, где exploration
// давал отдельные "шарды" (сырьё для отдельной Foundry-плавки), в этой
// программе крафт устроен иначе — сжигает целый инструмент N-1, шардов
// как отдельной сущности craft не использует (см. AUDIT_V4). Чтобы не
// city вводить параллельную неиспользуемую экономику, exploration здесь
// выдаёт бонусные WOOD/STONE вместо шардов — тем же диапазоном "штук".

// ----- Рефералы: 7 тиров -----
pub const REFERRAL_PCT_BPS: [u16; 7] = [10, 50, 100, 170, 250, 350, 500]; // 0.1%..5.0%
pub const REFERRAL_UPGRADE_WOOD: [u64; 7] = [0, 1_000 * RESOURCE_UNIT, 3_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 12_000 * RESOURCE_UNIT, 20_000 * RESOURCE_UNIT, 50_000 * RESOURCE_UNIT];
pub const REFERRAL_UPGRADE_STONE: [u64; 7] = [0, 1_000 * RESOURCE_UNIT, 3_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 12_000 * RESOURCE_UNIT, 20_000 * RESOURCE_UNIT, 50_000 * RESOURCE_UNIT];
pub const REFERRAL_UPGRADE_FOOD: [u64; 7] = [0, 500 * RESOURCE_UNIT, 2_000 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 13_000 * RESOURCE_UNIT, 25_000 * RESOURCE_UNIT];
pub const REFERRAL_BASE_CAP: u32 = 5;
pub const REFERRAL_MEDALLION_BONUS_CAP: u32 = 5;
pub const REFERRAL_HISTORIAN_BONUS_CAP: u32 = 25;

// ----- Кузница риска (Enchant) -----
pub const ENCHANT_MAX_LEVEL: u8 = 5;
// индекс = level-1 (апгрейд level->level+1), для level 1..5
pub const FORGE_SUCCESS_BPS: [u16; 5] = [10_000, 9_000, 7_500, 5_500, 3_500];
pub const FORGE_PARTIAL_FAIL_BPS: [u16; 5] = [0, 800, 2_000, 3_500, 4_500];
// остальное — полная потеря (сброс уровня в 0)
pub const ENCHANT_WOOD_COST: [u64; 5] = [200 * RESOURCE_UNIT, 500 * RESOURCE_UNIT, 1_200 * RESOURCE_UNIT, 2_400 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT];
pub const ENCHANT_STONE_COST: [u64; 5] = [200 * RESOURCE_UNIT, 500 * RESOURCE_UNIT, 1_200 * RESOURCE_UNIT, 2_400 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT];
pub const ENCHANT_FEE_LAMPORTS: [u64; 5] = [
    33_000_000, 66_000_000, 133_000_000, 266_000_000, 800_000_000,
]; // ~$1/$2/$4/$8/$24 на референс-курсе 1 SOL=$100 (см. TOR v4 §5a.1)
pub const FORGE_PROTECTOR_PRICE_LAMPORTS: u64 = 20_000_000; // ~$2

// ----- Лотерея -----
/// Ticket price in lamports. 800_000 lamports = 0.0008 SOL (the old comment's
/// "~$0.8" arithmetic was wrong: at the 1 SOL = $100 reference rate used
/// throughout this file, 0.0008 SOL is $0.0008, i.e. well under a cent. Ticket
/// sales stay disabled (`buy_lottery_ticket` reverts) until the prize funding
/// model is decided; see F-06/F-23 in AUDIT_FULL_2026-09-21.md.
pub const LOTTERY_TICKET_PRICE_LAMPORTS: u64 = 800_000;
pub const LOTTERY_POOL_BPS: u16 = 7_000;   // 70% в пул
pub const LOTTERY_DEV_BPS: u16 = 3_000;    // 30% разработчику
pub const LOTTERY_MAX_TICKETS_PER_DAY: u8 = 10;

// ----- Рынок -----
pub const MARKETPLACE_FEE_BPS: u16 = 300;   // 3%
pub const AUCTION_FEE_BPS: u16 = 400;       // 3% + 1%
pub const OFFER_FEE_BPS: u16 = 250;         // 2.5%
pub const RENTAL_FEE_BPS: u16 = 500;        // 5%
pub const AUCTION_ANTI_SNIPE_WINDOW_SECONDS: i64 = 5 * 60;
pub const AUCTION_ANTI_SNIPE_EXTENSION_SECONDS: i64 = 5 * 60;
pub const RENTAL_MIN_DURATION_SECONDS: i64 = 24 * 3600;
pub const RENTAL_MAX_DURATION_SECONDS: i64 = 30 * 86400;
pub const RENTAL_REVOKE_GRACE_SECONDS: i64 = 12 * 3600;

// ----- Ордербук ресурсов -----
pub const ORDERBOOK_MAKER_FEE_BPS: u16 = 10;  // 0.1%
pub const ORDERBOOK_TAKER_FEE_BPS: u16 = 40;  // 0.4%

// ----- Крафт под заказ -----
pub const CRAFT_ORDER_FEE_BPS: u16 = 200; // 2%

// ----- Сезонный пасс -----
pub const SEASON_LENGTH_SECONDS: i64 = 42 * 86400; // 42 дня
pub const SEASON_PASS_PREMIUM_PRICE_LAMPORTS: u64 = 150_000_000; // 0.15 SOL
pub const SEASON_PASS_MAX_LEVEL: u8 = 42;
pub const SEASON_XP_PER_LEVEL: u32 = 1_000;
/// [AUDIT F-14] Season reward per level, in display units (multiplied by
/// RESOURCE_UNIT at payout). Was effectively zero: the old code paid
/// `level * 100` atomic units.
pub const SEASON_REWARD_UNITS_PER_LEVEL: u64 = 100;

// ----- Withdraw-fee (bps) на mint_resource, по перкам — [ФАКТ]-паттерн из
// index.js `pickFeeBps` перенесён на materialization ресурсов on-chain -----
pub const MINT_FEE_BASE_MIN_BPS: u16 = 700;
pub const MINT_FEE_BASE_MAX_BPS: u16 = 1_000;
pub const MINT_FEE_MEDALLION_MIN_BPS: u16 = 500;
pub const MINT_FEE_MEDALLION_MAX_BPS: u16 = 800;
pub const MINT_FEE_HISTORIAN_MIN_BPS: u16 = 300;
pub const MINT_FEE_HISTORIAN_MAX_BPS: u16 = 600;
pub const MINT_FEE_BOTH_MIN_BPS: u16 = 100;
pub const MINT_FEE_BOTH_MAX_BPS: u16 = 300;

// ----- Account space (manual, с +8 дискриминатором — тот же паттерн, что
// уже используется в CONFIG_SPACE/PLAYER_SPACE и т.д.) -----

// =====================================================================
// [БЛОК L] Хлебная экономика: семена, space, базовые ставки
// =====================================================================

// Seeds для новых PDA
pub const MATERIAL_MINTS_SEED: &[u8] = b"material_mints";
pub const ENERGY_ACCOUNT_SEED: &[u8] = b"energy_account";
pub const FARM_TILE_SEED: &[u8] = b"farm_tile";
pub const WEATHER_STATE_SEED: &[u8] = b"weather_state";
pub const WELL_STATE_SEED: &[u8] = b"well_state";
pub const MILL_STATE_SEED: &[u8] = b"mill_state";
pub const OVEN_STATE_SEED: &[u8] = b"oven_state";

// Space для новых аккаунтов

// Базовые ставки добычи (ресурс/час на common)
pub const BASE_RATE_MINING: u64 = 10;
pub const YIELD_BPS_COMMON: u16 = 10000;
pub const YIELD_BPS_UNCOMMON: u16 = 11500;
pub const YIELD_BPS_RARE: u16 = 13000;
pub const YIELD_BPS_EPIC: u16 = 15000;
pub const YIELD_BPS_LEGENDARY: u16 = 18000;

// Ферма: рост пшеницы
pub const WHEAT_GROW_DURATION: i64 = 6 * 3600; // 6 часов
pub const SYNAPSE_YIELD_MULT_BPS: u16 = 15000; // ×1.5 от посева

// Мельница: время помола по партиям (в секундах)
pub const MILL_TIME_SMALL: i64 = 1 * 3600;   // 1 час
pub const MILL_TIME_MEDIUM: i64 = 3 * 3600;  // 3 часа
pub const MILL_TIME_LARGE: i64 = 6 * 3600;   // 6 часов

// Печь: время выпечки по партиям
pub const OVEN_TIME_SMALL: i64 = 2 * 3600;   // 2 часа
pub const OVEN_TIME_MEDIUM: i64 = 5 * 3600;  // 5 часов
pub const OVEN_TIME_LARGE: i64 = 10 * 3600;  // 10 часов

// Энергия
pub const ENERGY_CAP: u8 = 20;
pub const ENERGY_REGEN_SECONDS: i64 = 30 * 60; // +1 за 30 минут
pub const ENERGY_COST_PLANT: u8 = 1;
pub const ENERGY_COST_HARVEST: u8 = 1;
pub const ENERGY_COST_MILL: u8 = 2;
pub const ENERGY_COST_OVEN: u8 = 2;

// Погода (enum значения)
pub const WEATHER_BLACKOUT: u8 = 0;
pub const WEATHER_NOMINAL: u8 = 1;
pub const WEATHER_SURGE: u8 = 2;
pub const WEATHER_FRENZY: u8 = 3;

// Ставки колодца (Water/час по погоде)
pub const WELL_RATE_BLACKOUT: u64 = 0;
pub const WELL_RATE_NOMINAL: u64 = 5 * RESOURCE_UNIT;
pub const WELL_RATE_SURGE: u64 = 15 * RESOURCE_UNIT;
pub const WELL_RATE_FRENZY: u64 = 20 * RESOURCE_UNIT;
/// Maximum accrual window per collection. Excess elapsed time is discarded,
/// preventing an account from minting an unbounded backlog after a long absence.
pub const WELL_MAX_ACCRUAL_SECONDS: u64 = 24 * 60 * 60;

// ===== [НОВОЕ] Инструкции #11 из аудита =====

// Конверсия FOOD → энергия (1 FOOD = 10 энергии, максимум 100)

// Эффекты фляг (энергия за тип)

pub const GASTANK_SPACE: usize = 8 + GasTank::INIT_SPACE;

// ===== Размеры аккаунтов (auto-generated from InitSpace) =====
pub const CONFIG_SPACE: usize = 8 + Config::INIT_SPACE;
/// [SECURITY_CHECKLIST_REVIEW F-C] Bytes appended by Config v2 (operator,
/// guardian, cashout_frozen, reserved) and the size of a v1 account.
pub const CONFIG_V2_EXTENSION: usize = 32 + 32 + 1 + 32;
pub const CONFIG_V1_SPACE: usize = CONFIG_SPACE - CONFIG_V2_EXTENSION;
pub const PLAYER_SPACE: usize = 8 + Player::INIT_SPACE;
pub const TOOL_DATA_SPACE: usize = 8 + ToolData::INIT_SPACE;
pub const GAS_TANK_SPACE: usize = 8 + GasTank::INIT_SPACE;
pub const RARITY_COUNTER_SPACE: usize = 8 + RarityCounter::INIT_SPACE;
pub const CRAFT_ECONOMY_SPACE: usize = 8 + CraftEconomy::INIT_SPACE;
pub const STAKED_COLLECTOR_SPACE: usize = 8 + StakedCollector::INIT_SPACE;
pub const PACK_CONFIG_SPACE: usize = 8 + PackConfig::INIT_SPACE;
pub const PACK_COMMIT_SPACE: usize = 8 + PackCommit::INIT_SPACE;
pub const REROLL_CONFIG_SPACE: usize = 8 + RerollConfig::INIT_SPACE;
pub const REROLL_COMMIT_SPACE: usize = 8 + RerollCommit::INIT_SPACE;
pub const EXPLORATION_STATE_SPACE: usize = 8 + ExplorationState::INIT_SPACE;
pub const EXPLORATION_COMMIT_SPACE: usize = 8 + ExplorationCommit::INIT_SPACE;
pub const REFERRAL_LINK_SPACE: usize = 8 + ReferralLink::INIT_SPACE;
pub const REFERRER_STATS_SPACE: usize = 8 + ReferrerStats::INIT_SPACE;
pub const ENCHANT_SLOT_SPACE: usize = 8 + EnchantSlot::INIT_SPACE;
pub const FORGE_COMMIT_SPACE: usize = 8 + ForgeCommit::INIT_SPACE;
pub const LOTTERY_ROUND_SPACE: usize = 8 + LotteryRound::INIT_SPACE;
pub const LOTTERY_TICKET_SPACE: usize = 8 + LotteryTicket::INIT_SPACE;
pub const LOTTERY_TICKET_COUNTER_SPACE: usize = 8 + LotteryTicketCounter::INIT_SPACE;
pub const LISTING_SPACE: usize = 8 + Listing::INIT_SPACE;
pub const AUCTION_SPACE: usize = 8 + Auction::INIT_SPACE;
pub const OFFER_SPACE: usize = 8 + Offer::INIT_SPACE;
pub const RENTAL_LISTING_SPACE: usize = 8 + RentalListing::INIT_SPACE;
pub const RENTAL_AGREEMENT_SPACE: usize = 8 + RentalAgreement::INIT_SPACE;
pub const RESOURCE_ORDER_SPACE: usize = 8 + ResourceOrder::INIT_SPACE;
pub const CRAFT_ORDER_SPACE: usize = 8 + CraftOrder::INIT_SPACE;
pub const SEASON_SPACE: usize = 8 + Season::INIT_SPACE;
pub const SEASON_PASS_SPACE: usize = 8 + SeasonPass::INIT_SPACE;
pub const MATERIAL_MINTS_SPACE: usize = 8 + MaterialMints::INIT_SPACE;
pub const ENERGY_ACCOUNT_SPACE: usize = 8 + EnergyAccount::INIT_SPACE;
pub const FARM_TILE_SPACE: usize = 8 + FarmTile::INIT_SPACE;
pub const WEATHER_STATE_SPACE: usize = 8 + WeatherState::INIT_SPACE;
pub const WELL_STATE_SPACE: usize = 8 + WellState::INIT_SPACE;
pub const MILL_STATE_SPACE: usize = 8 + MillState::INIT_SPACE;
pub const OVEN_STATE_SPACE: usize = 8 + OvenState::INIT_SPACE;
pub const VAULT_GUARD_SPACE: usize = 8 + VaultGuard::INIT_SPACE;
pub const COLLECTOR_ALLOW_SPACE: usize = 8 + CollectorAllowEntry::INIT_SPACE;

/// Commit-reveal expiry. SlotHashes keeps ~512 recent slots, so a reveal
/// older than that fails with CommitExpired. Expiry is allowed only after the
/// slot hash is guaranteed gone, so `expire` and `reveal` can never both
/// succeed for the same commit (reveal needs the hash, expire needs it gone).
pub const COMMIT_EXPIRY_SLOTS: u64 = 600;

// =====================================================================
// [AUDIT F-08 / F-33] Economy invariants as executable tests.
//
// The 2026-09-21 audit found the old repair curve made a 6-tool portfolio
// loss-making from Rare upwards. These tests pin the corrected relationship
// (net P&L > 0 and strictly increasing with rarity) so the next constant
// tweak cannot silently re-introduce it.
// =====================================================================
#[cfg(test)]
mod economy_tests {
    use super::*;

    const AXES: i128 = 3;
    const PICKS: i128 = 3;
    const TOOLS: i128 = AXES + PICKS;

    /// ATOMIC units mined per hour by ONE tool (1 display unit = RESOURCE_UNIT).
    fn yield_atomic_per_hour(r: Rarity) -> i128 {
        (BASE_RATE_MINING as i128) * (RESOURCE_UNIT as i128) * (r.yield_bps() as i128) / 10_000
    }

    /// Net ATOMIC units per hour for a 3 axe + 3 pick portfolio that repairs to
    /// full: only the axes bring WOOD in, but all six tools consume it.
    fn net_per_hour(r: Rarity) -> (i128, i128) {
        let y = yield_atomic_per_hour(r);
        let wood = AXES * y - TOOLS * (r.repair_wood_cost_per_unit() as i128);
        let stone = PICKS * y - TOOLS * (r.repair_stone_cost_per_unit() as i128);
        (wood, stone)
    }

    #[test]
    fn resource_kind_count_matches_enum() {
        assert_eq!(
            ResourceKind::Mind as usize + 1,
            RESOURCE_KIND_COUNT,
            "RESOURCE_KIND_COUNT is stale - MaterialMints::max_supply would be mis-sized"
        );
    }

    #[test]
    fn mining_pnl_is_positive_and_monotonic() {
        let ladder = [
            Rarity::Common,
            Rarity::Uncommon,
            Rarity::Rare,
            Rarity::Epic,
            Rarity::Legendary,
        ];
        let mut prev_wood = 0i128;
        let mut prev_stone = 0i128;
        for r in ladder {
            let (wood, stone) = net_per_hour(r);
            assert!(wood > 0, "{:?}: net WOOD/hour = {} must be positive", r, wood);
            assert!(stone > 0, "{:?}: net STONE/hour = {} must be positive", r, stone);
            assert!(
                wood > prev_wood,
                "{:?}: upgrading must strictly improve net WOOD ({} <= {})",
                r, wood, prev_wood
            );
            assert!(
                stone > prev_stone,
                "{:?}: upgrading must strictly improve net STONE ({} <= {})",
                r, stone, prev_stone
            );
            prev_wood = wood;
            prev_stone = stone;
        }
    }

    /// The break-even condition from the audit, in atomic units:
    /// `yield_per_hour > 2 * repair_per_unit` for a 50/50 portfolio.
    #[test]
    fn repair_cost_stays_below_half_of_yield() {
        for r in [
            Rarity::Common,
            Rarity::Uncommon,
            Rarity::Rare,
            Rarity::Epic,
            Rarity::Legendary,
        ] {
            let y = yield_atomic_per_hour(r);
            assert!(
                2 * (r.repair_wood_cost_per_unit() as i128) < y,
                "{:?}: 2 x WOOD repair >= yield",
                r
            );
            assert!(
                2 * (r.repair_stone_cost_per_unit() as i128) < y,
                "{:?}: 2 x STONE repair >= yield",
                r
            );
        }
    }

    /// One tool must also pay for itself over its full MAX_DURABILITY lifetime.
    #[test]
    fn lifetime_pnl_is_positive() {
        for r in [
            Rarity::Common,
            Rarity::Uncommon,
            Rarity::Rare,
            Rarity::Epic,
            Rarity::Legendary,
        ] {
            let lifetime_yield = yield_atomic_per_hour(r) * MAX_DURABILITY as i128;
            let lifetime_repair = (r.repair_wood_cost_per_unit() as i128
                + r.repair_stone_cost_per_unit() as i128)
                * MAX_DURABILITY as i128;
            assert!(
                lifetime_yield > lifetime_repair,
                "{:?}: lifetime {} yield vs {} repair",
                r,
                lifetime_yield,
                lifetime_repair
            );
        }
    }
}
