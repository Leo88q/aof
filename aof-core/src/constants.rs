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
pub const TOOL_METADATA_REGISTRY_SEED: &[u8] = b"tool_metadata_registry";

/// Maximum bytes to reserve for the Metaplex Metadata account before a tool is minted.
/// VRF settlement returns only the rent for the actual `data_len()` value.
pub const TOOL_METADATA_ACCOUNT_MAX_SPACE: usize = 679;
pub const TOOL_METADATA_URI_COUNT: usize = 25;
pub const TOOL_METADATA_URI_MAX_LEN: usize = 80;
pub const TOOL_METADATA_URI_BATCH_MAX: usize = 8;
pub const TOOL_METADATA_COMPLETE_MASK: u32 = (1u32 << TOOL_METADATA_URI_COUNT) - 1;
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
pub const SKR_CRAFT_DISCOUNT_BPS: u16 = 1500; // 15% скидка на MIND
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

/// [AUDIT F-23] A lottery round that is never drawn must not strand its pool.
/// After this timeout (and with no draw in flight) every ticket can be
/// refunded to its buyer in full (`refund_lottery_ticket`); the pool no longer
/// goes to the treasury, which would have rewarded never drawing.
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

// [НОВОЕ] Стоимость ремонта (SILICON за 1 юнит прочности), по редкости —
// используется через Rarity::repair_stone_cost_per_unit() в state.rs,
// тем же паттерном, что MAX_HOURS_* + Rarity::max_hours().
// =====================================================================
// [AUDIT F-08] Кривая ремонта пересчитана.
//
// Было: yield растёт 10 -> 18 (x1.8), а ремонт 3 -> 70 CIRCUIT (x23.3) и
// 2 -> 45 SILICON (x22.5). Портфель 3 plasma cutters + 3 silicon extractors по 20 ч/сутки убыточен
// по обоим ресурсам уже с Rare (-900/-300), а с Uncommon — по CIRCUIT.
// Условие безубыточности портфеля: `yield_per_hour > 2 * repair_per_unit`
// (3 добывающих инструмента кормят ремонт всех 6).
//
// Стало: ремонт растёт вдвое медленнее добычи (x1.67 CIRCUIT, x1.75 SILICON
// против x1.8 у yield), поэтому нетто-маржа строго растёт с редкостью:
//   Common    +12.0 CIRCUIT/ч  +18.0 SILICON/ч
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

// Стоимость ремонта в CIRCUIT за единицу прочности
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
/// [AUDIT orderbook price unit] v2 orders are derived from a different seed so
/// every old escrow stays cancellable through the old instruction set while new
/// orders use a price that a wallet can verify (see `RESOURCE_ORDER_V2_SEED`).
pub const RESOURCE_ORDER_V2_SEED: &[u8] = b"resource_order_v2";
pub const CRAFT_ORDER_SEED: &[u8] = b"craft_order";
pub const SEASON_SEED: &[u8] = b"season";
pub const SEASON_PASS_SEED: &[u8] = b"season_pass";
pub const SEASON_PREMIUM_CLAIMS_SEED: &[u8] = b"season_premium_claims";
pub const SEASON_XP_CLAIM_CURSOR_SEED: &[u8] = b"season_xp_claim_cursor";

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
// Capsules issue the first three canonical tool types; transmitter/seeder are obtained elsewhere.
pub const PACK_TOOL_TYPES: [&str; 3] = ["plasma_cutter", "silicon_extractor", "data_harvester"];

// ----- Reroll (честный, RNG) — своя таблица шансов, настраиваемая отдельно -----
pub const REROLL_ODDS_BPS_DEFAULT: [u16; 5] = [5_500, 3_000, 1_100, 400, 0];

// ----- Exploration: 10 тиров -----
// Exploration costs are denominated in canonical Data, Circuit, and Silicon.
pub const TRIP_COST_DATA: u64 = 75 * RESOURCE_UNIT;
pub const TRIP_COST_CIRCUIT: u64 = 35 * RESOURCE_UNIT;
pub const TRIP_COST_SILICON: u64 = 35 * RESOURCE_UNIT;
pub const TRIP_COST_DATASET: u64 = 50 * RESOURCE_UNIT; // [НОВОЕ] Мясо для исследования
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
// выдаёт бонусные CIRCUIT/SILICON вместо шардов — тем же диапазоном "штук".

// ----- Рефералы: 7 тиров -----
pub const REFERRAL_PCT_BPS: [u16; 7] = [10, 50, 100, 170, 250, 350, 500]; // 0.1%..5.0%
pub const REFERRAL_UPGRADE_CIRCUIT: [u64; 7] = [0, 1_000 * RESOURCE_UNIT, 3_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 12_000 * RESOURCE_UNIT, 20_000 * RESOURCE_UNIT, 50_000 * RESOURCE_UNIT];
pub const REFERRAL_UPGRADE_SILICON: [u64; 7] = [0, 1_000 * RESOURCE_UNIT, 3_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 12_000 * RESOURCE_UNIT, 20_000 * RESOURCE_UNIT, 50_000 * RESOURCE_UNIT];
pub const REFERRAL_UPGRADE_DATA: [u64; 7] = [0, 500 * RESOURCE_UNIT, 2_000 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT, 7_000 * RESOURCE_UNIT, 13_000 * RESOURCE_UNIT, 25_000 * RESOURCE_UNIT];
pub const REFERRAL_BASE_CAP: u32 = 5;
pub const REFERRAL_MEDALLION_BONUS_CAP: u32 = 5;
pub const REFERRAL_HISTORIAN_BONUS_CAP: u32 = 25;

// ----- Кузница риска (Enchant) -----
pub const ENCHANT_MAX_LEVEL: u8 = 5;
// индекс = level-1 (апгрейд level->level+1), для level 1..5
pub const FORGE_SUCCESS_BPS: [u16; 5] = [10_000, 9_000, 7_500, 5_500, 3_500];
pub const FORGE_PARTIAL_FAIL_BPS: [u16; 5] = [0, 800, 2_000, 3_500, 4_500];
// остальное — полная потеря (сброс уровня в 0)
pub const ENCHANT_CIRCUIT_COST: [u64; 5] = [200 * RESOURCE_UNIT, 500 * RESOURCE_UNIT, 1_200 * RESOURCE_UNIT, 2_400 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT];
pub const ENCHANT_SILICON_COST: [u64; 5] = [200 * RESOURCE_UNIT, 500 * RESOURCE_UNIT, 1_200 * RESOURCE_UNIT, 2_400 * RESOURCE_UNIT, 4_000 * RESOURCE_UNIT];
pub const ENCHANT_FEE_LAMPORTS: [u64; 5] = [
    33_000_000, 66_000_000, 133_000_000, 266_000_000, 800_000_000,
]; // ~$1/$2/$4/$8/$24 на референс-курсе 1 SOL=$100 (см. TOR v4 §5a.1)
pub const FORGE_PROTECTOR_PRICE_LAMPORTS: u64 = 20_000_000; // ~$2

// ----- Лотерея -----
/// Ticket price in lamports. 800_000 lamports = 0.0008 SOL (the old comment's
/// "~$0.8" arithmetic was wrong: at the 1 SOL = $100 reference rate used
/// throughout this file, 0.0008 SOL is $0.08). Funding model: the pool is
/// player-funded only. The full price is escrowed on the round until the draw;
/// the draw sends LOTTERY_DEV_BPS to the treasury and the rest is the prize
/// (return-to-player 70%). An undrawn round refunds every ticket in full.
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
// ===== [SECURITY_CHECKLIST_REVIEW F-G / F-H] trading limits =====
/// First-bid floor and minimum outbid step. Both exceed the rent-exempt minimum
/// of an empty wallet (890 880 lamports), so refunding an outbid wallet that was
/// drained to zero can no longer fail and freeze the auction.
pub const AUCTION_MIN_BID_LAMPORTS: u64 = 1_000_000; // 0.001 SOL
/// Every outbid must add at least 5% (1-lamport outbids kept re-arming the
/// anti-snipe extension forever).
pub const AUCTION_MIN_INCREMENT_BPS: u16 = 500;
pub const AUCTION_MAX_DURATION_SECONDS: i64 = 14 * 86_400;
/// The platform keeps at least RENTAL_FEE_BPS of every rental fee.
pub const RENTAL_MAX_OWNER_SPLIT_BPS: u16 = 10_000 - RENTAL_FEE_BPS;

// ----- Ордербук ресурсов -----
pub const ORDERBOOK_MAKER_FEE_BPS: u16 = 10;  // 0.1%
pub const ORDERBOOK_TAKER_FEE_BPS: u16 = 40;  // 0.4%
/// One whole resource unit in atomic SPL units (all resource mints use 9
/// decimals). v2 prices are quoted **per whole resource** and every lamport
/// amount is rounded UP, so a price like 0.001 SOL per resource is expressible
/// and the escrow can never be a billion times the displayed total.
pub const RESOURCE_ATOMS_PER_UNIT: u128 = 1_000_000_000;

/// [§3.4] Сколько пар `(mint, token_account)` перерождение может сжечь за одну
/// транзакцию. Предел держит и размер транзакции (1232 байта), и бюджет
/// вычислений (каждый burn — отдельный CPI): игрок с большим складом сначала
/// сжигает излишки обычным `burn_resource`, а затем завершает перерождение.
pub const REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS: usize = 16;

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

// Resource-specific PDA seed bytes
pub const MATERIAL_MINTS_SEED: &[u8] = b"material_mints";
pub const ENERGY_ACCOUNT_SEED: &[u8] = b"energy_account";
pub const LAB_TILE_SEED: &[u8] = b"lab_tile";
pub const WEATHER_STATE_SEED: &[u8] = b"weather_state";
pub const GRID_STATE_SEED: &[u8] = b"grid_state";
pub const SIGNAL_STATE_SEED: &[u8] = b"signal_state";
pub const MODEL_STATE_SEED: &[u8] = b"model_state";

// Space для новых аккаунтов

// Базовые ставки добычи (ресурс/час на common)
pub const BASE_RATE_MINING: u64 = 10;
pub const YIELD_BPS_COMMON: u16 = 10000;
pub const YIELD_BPS_UNCOMMON: u16 = 11500;
pub const YIELD_BPS_RARE: u16 = 13000;
pub const YIELD_BPS_EPIC: u16 = 15000;
pub const YIELD_BPS_LEGENDARY: u16 = 18000;

// Laboratory cell: Neuron-to-Synapse synthesis duration
pub const SYNAPSE_SYNTHESIS_DURATION: i64 = 6 * 3600; // 6 часов
pub const SYNAPSE_YIELD_MULT_BPS: u16 = 15000; // ×1.5 от посева

// Signal processing duration by batch size (seconds)
pub const SIGNAL_PROCESSING_TIME_SMALL: i64 = 1 * 3600;   // 1 час
pub const SIGNAL_PROCESSING_TIME_MEDIUM: i64 = 3 * 3600;  // 3 часа
pub const SIGNAL_PROCESSING_TIME_LARGE: i64 = 6 * 3600;   // 6 часов

// Model training duration by batch size
pub const MODEL_TRAINING_TIME_SMALL: i64 = 2 * 3600;   // 2 часа
pub const MODEL_TRAINING_TIME_MEDIUM: i64 = 5 * 3600;  // 5 часов
pub const MODEL_TRAINING_TIME_LARGE: i64 = 10 * 3600;  // 10 часов

// Энергия
pub const ENERGY_CAP: u8 = 20;
pub const ENERGY_REGEN_SECONDS: i64 = 30 * 60; // +1 за 30 минут
pub const ENERGY_COST_SYNTHESIS: u8 = 1;
pub const ENERGY_COST_COLLECTION: u8 = 1;
pub const ENERGY_COST_SIGNAL_PROCESSING: u8 = 2;
pub const ENERGY_COST_MODEL_TRAINING: u8 = 2;

/// Сколько атомов DATA сжигается за одну единицу энергии в
/// `exchange_data_energy`. 1 целый DATA (10^9 атомов) → 1 энергия.
///
/// Это единственный источник энергии, кроме времени (1 за 30 минут), поэтому
/// цена задана константой, а не полем `Config`: иначе оператор мог бы в одиночку
/// переоценить топливо для всей лабораторной цепочки. Сжигание уменьшает
/// `mint.supply`, значит потолок выпуска освобождается — отдельного учёта нет.
pub const DATA_ATOMS_PER_ENERGY: u64 = RESOURCE_UNIT;

/// Сколько энергии возвращает одна фляга, по тирам
/// `[CryoFluid, VoltFluid, BioFluid, NanoFluid, QuantumFluid]`
/// (индекс — `flask_kind - 1` в `use_flask`). Лестница строго неубывающая, а
/// верхний тир закрывает бак целиком: `ENERGY_CAP`. Значения — тоже константы,
/// а не конфиг, по той же причине, что и выше: применение расходника нельзя
/// переоценить одним админ-вызовом.
pub const FLASK_ENERGY_GAIN: [u8; 5] = [5, 5, 8, 10, ENERGY_CAP];

/// Тип флакона в `use_flask`: 1..=5 → (ResourceKind, энергия).
/// Вынесено сюда, чтобы и проверка типа, и таблица наград были в одном месте
/// и проверялись тестами без валидатора.
pub fn flask_kind_reward(flask_kind: u8) -> Option<(crate::ResourceKind, u8)> {
    use crate::ResourceKind;
    let kind = match flask_kind {
        1 => ResourceKind::CryoFluid,
        2 => ResourceKind::VoltFluid,
        3 => ResourceKind::BioFluid,
        4 => ResourceKind::NanoFluid,
        5 => ResourceKind::QuantumFluid,
        _ => return None,
    };
    Some((kind, FLASK_ENERGY_GAIN[(flask_kind - 1) as usize]))
}

#[cfg(test)]
mod energy_exchange_constants_tests {
    use super::*;

    #[test]
    fn flask_ladder_is_defined_for_every_tier_and_never_zero() {
        for kind in 1..=5u8 {
            let (_, gain) = flask_kind_reward(kind).expect("все пять тиров обязаны быть заданы");
            assert!(gain > 0, "фляга обязана возвращать хотя бы одну энергию");
            assert!(gain <= ENERGY_CAP, "награда выше потолка энергии невозможна");
        }
        assert_eq!(flask_kind_reward(5).unwrap().1, ENERGY_CAP);
    }

    #[test]
    fn flask_ladder_does_not_decrease_with_tier() {
        let gains: Vec<u8> = (1..=5u8).map(|k| flask_kind_reward(k).unwrap().1).collect();
        assert!(gains.windows(2).all(|w| w[0] <= w[1]), "лестница тиров не должна падать: {gains:?}");
    }

    #[test]
    fn unknown_flask_kinds_are_rejected() {
        assert!(flask_kind_reward(0).is_none());
        assert!(flask_kind_reward(6).is_none());
        assert!(flask_kind_reward(u8::MAX).is_none());
    }

    #[test]
    fn one_energy_costs_exactly_one_whole_data() {
        assert_eq!(DATA_ATOMS_PER_ENERGY, 1_000_000_000);
        assert_eq!(DATA_ATOMS_PER_ENERGY, RESOURCE_UNIT);
    }
}

// Погода (enum значения)
pub const WEATHER_BLACKOUT: u8 = 0;
pub const WEATHER_NOMINAL: u8 = 1;
pub const WEATHER_SURGE: u8 = 2;
pub const WEATHER_FRENZY: u8 = 3;

// Grid Station accrual rates (Power/hour by network load)
pub const GRID_RATE_BLACKOUT: u64 = 0;
pub const GRID_RATE_NOMINAL: u64 = 5 * RESOURCE_UNIT;
pub const GRID_RATE_SURGE: u64 = 15 * RESOURCE_UNIT;
pub const GRID_RATE_FRENZY: u64 = 20 * RESOURCE_UNIT;
/// Maximum accrual window per collection. Excess elapsed time is discarded,
/// preventing an account from minting an unbounded backlog after a long absence.
pub const GRID_MAX_ACCRUAL_SECONDS: u64 = 24 * 60 * 60;

// ===== [НОВОЕ] Инструкции #11 из аудита =====

// Конверсия DATA → энергия (1 DATA = 10 энергии, максимум 100)

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
pub const RESOURCE_ORDER_V2_SPACE: usize = 8 + ResourceOrderV2::INIT_SPACE;
pub const CRAFT_ORDER_SPACE: usize = 8 + CraftOrder::INIT_SPACE;
pub const SEASON_SPACE: usize = 8 + Season::INIT_SPACE;
pub const SEASON_PASS_SPACE: usize = 8 + SeasonPass::INIT_SPACE;
pub const SEASON_PREMIUM_CLAIMS_SPACE: usize = 8 + SeasonPremiumClaims::INIT_SPACE;
pub const SEASON_XP_CLAIM_CURSOR_SPACE: usize = 8 + SeasonXpClaimCursor::INIT_SPACE;
pub const MAX_SEASON_XP_ENTITLEMENT_AMOUNT: u32 = 100_000;
/// An XP authorization is short-lived; the backend caps it to the same window.
pub const MAX_SEASON_XP_ENTITLEMENT_TTL_SLOTS: u64 = 150_000;
pub const MATERIAL_MINTS_SPACE: usize = 8 + MaterialMints::INIT_SPACE;
pub const ENERGY_ACCOUNT_SPACE: usize = 8 + EnergyAccount::INIT_SPACE;
pub const LAB_TILE_SPACE: usize = 8 + LabTile::INIT_SPACE;
pub const WEATHER_STATE_SPACE: usize = 8 + WeatherState::INIT_SPACE;
pub const GRID_STATE_SPACE: usize = 8 + GridState::INIT_SPACE;
pub const SIGNAL_STATE_SPACE: usize = 8 + SignalState::INIT_SPACE;
pub const MODEL_STATE_SPACE: usize = 8 + ModelState::INIT_SPACE;
pub const VAULT_GUARD_SPACE: usize = 8 + VaultGuard::INIT_SPACE;
pub const COLLECTOR_ALLOW_SPACE: usize = 8 + CollectorAllowEntry::INIT_SPACE;

pub const VRF_SLOT_SPACE: usize = 8 + VrfSlot::INIT_SPACE;

// ===== [F-06 / #36 #37] Switchboard On-Demand randomness (see vrf.rs) =====
/// PDA that is the Switchboard `authority` of every pool randomness account.
/// Switchboard lets only the authority commit or reveal, so only this program
/// (signing with this seed) can ever re-seed or reveal a pool account.
pub const VRF_AUTHORITY_SEED: &[u8] = b"vrf_authority";
/// Pool bookkeeping: seeds = [VRF_SLOT_SEED, randomness.key()].
pub const VRF_SLOT_SEED: &[u8] = b"vrf_slot";
/// Address of pool randomness account #index: seeds = [VRF_RANDOMNESS_SEED, index_le].
pub const VRF_RANDOMNESS_SEED: &[u8] = b"vrf_randomness";
/// Tool NFTs produced by a VRF settlement are PDAs of their commit, created in
/// the settling instruction: nobody can pre-create, pre-mint or squat them
/// between commit and reveal. seeds = [PACK_MINT_SEED, pack_commit.key()].
pub const PACK_MINT_SEED: &[u8] = b"pack_mint";
/// seeds = [REROLL_MINT_SEED, reroll_commit.key()] (reveal OR refund, never both).
pub const REROLL_MINT_SEED: &[u8] = b"reroll_mint";
/// Reveal window and refund threshold of every VRF commit, in slots
/// (~2 h at 400 ms). Switchboard stops honouring a reveal about one hour after
/// the commit, so this is strictly longer than the oracle's own window. A
/// reveal is accepted only BEFORE `commit_slot + VRF_REFUND_AFTER_SLOTS` and a
/// refund only FROM that slot on: the two paths are never open at the same
/// time, so no one can pick "reveal if good, refund if bad".
pub const VRF_REFUND_AFTER_SLOTS: u64 = 18_000;
/// Ticket sales window of a lottery round. After it anyone (not only the
/// operator) may close sales by committing the draw, so a round cannot be
/// kept open indefinitely.
pub const LOTTERY_SALES_SECONDS: i64 = 7 * 86_400;

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

    /// Net ATOMIC units per hour for a portfolio of 3 plasma cutters and
    /// 3 silicon extractors: only the cutters produce Circuit, while all six consume it.
    fn net_per_hour(r: Rarity) -> (i128, i128) {
        let y = yield_atomic_per_hour(r);
        let circuit = AXES * y - TOOLS * (r.repair_circuit_cost_per_unit() as i128);
        let silicon = PICKS * y - TOOLS * (r.repair_silicon_cost_per_unit() as i128);
        (circuit, silicon)
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
        let mut prev_circuit = 0i128;
        let mut prev_silicon = 0i128;
        for r in ladder {
            let (circuit, silicon) = net_per_hour(r);
            assert!(circuit > 0, "{:?}: net CIRCUIT/hour = {} must be positive", r, circuit);
            assert!(silicon > 0, "{:?}: net SILICON/hour = {} must be positive", r, silicon);
            assert!(
                circuit > prev_circuit,
                "{:?}: upgrading must strictly improve net CIRCUIT ({} <= {})",
                r, circuit, prev_circuit
            );
            assert!(
                silicon > prev_silicon,
                "{:?}: upgrading must strictly improve net SILICON ({} <= {})",
                r, silicon, prev_silicon
            );
            prev_circuit = circuit;
            prev_silicon = silicon;
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
                2 * (r.repair_circuit_cost_per_unit() as i128) < y,
                "{:?}: 2 x CIRCUIT repair >= yield",
                r
            );
            assert!(
                2 * (r.repair_silicon_cost_per_unit() as i128) < y,
                "{:?}: 2 x SILICON repair >= yield",
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
            let lifetime_repair = (r.repair_circuit_cost_per_unit() as i128
                + r.repair_silicon_cost_per_unit() as i128)
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
