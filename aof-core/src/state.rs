use anchor_lang::prelude::*;
use crate::constants::*;
use crate::ResourceKind;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,          // 32
    pub treasury: Pubkey,           // 32
    pub food_mint: Pubkey,          // 32
    pub wood_mint: Pubkey,          // 32
    pub stone_mint: Pubkey,         // 32
    pub seeds_mint: Pubkey,         // 32 [НОВОЕ]
    pub water_mint: Pubkey,         // 32 [НОВОЕ]
    pub potato_mint: Pubkey,        // 32 [НОВОЕ] Основной утилити-токен
    pub craft_fee: u64,             // 8
    pub unstake_fee: u64,           // 8
    pub paused: bool,               // 1
    pub bump: u8,                   // 1
    // ===== [AUDIT F-27] on-chain kill-switch for mining =====
    // MINING_ENABLED previously lived only in the backend env
    // (`config.ts: MINING_ENABLED = !isProduction && ...`). Anybody could
    // bypass it by calling `start_mining`/`collect_mining` straight through
    // RPC. The flag now lives on-chain and is enforced by both instructions.
    pub mining_enabled: bool,       // 1
    // ===== [AUDIT F-02] two-step authority rotation =====
    // `set_pending_authority` (current authority) -> `accept_authority`
    // (new authority). `pending_authority == Pubkey::default()` means "no
    // rotation in flight". Without this pair the deployed Config.authority
    // was frozen forever at the value captured during the first initialize().
    pub pending_authority: Pubkey,  // 32
    pub authority_updated_at: i64,  // 8
}

/// [AUDIT F-17] Canonical tool kinds. `ToolData.tool_type` is a free-form
/// String, and `mint_tool` accepted any string up to 32 bytes. A tool minted as
/// "Spear" (capital S) or "sword" produced nothing while mining (the mapping was
/// case-sensitive in exploration and simply missing for spear) and could not be
/// repaired. Every entry point now normalises to this set.
pub const TOOL_KINDS: [&str; 5] = ["axe", "pick", "bow", "spear", "reaper"];

pub fn is_valid_tool_type(tool_type: &str) -> bool {
    TOOL_KINDS.iter().any(|k| tool_type.eq_ignore_ascii_case(k))
}

/// Lower-case canonical spelling, so "Axe" and "AXE" produce the same stored
/// value and every comparison downstream is unambiguous.
pub fn canonical_tool_type(tool_type: &str) -> Option<&'static str> {
    TOOL_KINDS.iter().copied().find(|k| tool_type.eq_ignore_ascii_case(k))
}

impl Config {
    pub fn is_resource_mint(&self, materials: &MaterialMints, mint: &Pubkey) -> bool {
        let m = mint;
        *m == self.food_mint
            || *m == self.wood_mint
            || *m == self.stone_mint
            || *m == self.seeds_mint
            || *m == self.water_mint
            || *m == self.potato_mint
            || *m == materials.seeds
            || *m == materials.wheat
            || *m == materials.flour
            || *m == materials.bread
            || *m == materials.water
            || *m == materials.coal
            || *m == materials.meat
            || *m == materials.stone_blue
            || *m == materials.stone_purple
            || *m == materials.stone_red
            || *m == materials.sand_white
            || *m == materials.sand_pink
            || *m == materials.sand_yellow
            || *m == materials.gem_blue
            || *m == materials.gem_orange
            || *m == materials.gem_white
            || *m == materials.gem_green
            || *m == materials.flask_blue
            || *m == materials.flask_yellow
            || *m == materials.flask_green
            || *m == materials.flask_pink
            || *m == materials.flask_purple
            || *m == materials.love_heart
    }
}

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub owner: Pubkey,              // 32
    pub cooldown_until: i64,        // 8
    pub has_tent: bool,             // 1
    pub villagers: u32,             // 4
    pub villagers_available: u32,   // 4
    // ===== [НОВОЕ] =====
    // [ФАКТ, из аудита index.js]: перки читаются из счётчиков
    // has_historian/has_medallion (maxHoursByPerks, скидки на штраф,
    // капы рефералов 25/5, exploration +5%/+2%). Раньше эти перки жили
    // только в Firestore на Ronin-бэкенде; теперь единственный источник
    // истины — этот PDA, сервер читает его напрямую вместо отдельного
    // офчейн-зеркала. Счётчик, не bool — застейкать можно больше одного
    // экземпляра коллекции.
    pub historian_count: u8,        // 1
    pub medallion_count: u8,        // 1
}

impl Player {
    pub fn has_historian(&self) -> bool {
        self.historian_count > 0
    }
    pub fn has_medallion(&self) -> bool {
        self.medallion_count > 0
    }
}

#[account]
#[derive(InitSpace)]
pub struct ToolData {
    pub mint: Pubkey,               // 32
    pub owner: Pubkey,              // 32 (set post-migration)
    #[max_len(32)]
    pub tool_type: String,          // 4 + len (max 32)
    pub rarity: Rarity,             // 1
    pub durability: u8,             // 1 (0..20)
    pub is_mining: bool,            // 1
    pub mining_end: i64,            // 8
    pub last_mined_hours: u8,       // 1 (hours for last mining session)
    pub staked: bool,               // 1
    pub unlock_at: i64,             // 8
    // [НОВОЕ]: кто сейчас имеет право майнить/чинить этим инструментом.
    // По умолчанию == owner; на время аренды (rental) временно == renter,
    // владение (owner) при этом не меняется — см. instructions::rental_*.
    pub operator: Pubkey,           // 32
}

#[account]
#[derive(InitSpace)]
pub struct GasTank {
    pub owner: Pubkey,              // 32
    pub balance_micros: u64,        // 8 (SOL-micros, 1e6 per SOL)
    pub cooldown_until: i64,        // 8
    /// [AUDIT F-20] Lamports that arrived but do not yet add up to a whole
    /// micro (1 micro = 1000 lamports). `deposit_gas` used to floor every
    /// deposit, so anything below 1000 lamports was credited as zero and could
    /// never be withdrawn. The remainder is now carried over to the next
    /// deposit instead of being swallowed by the PDA.
    pub dust_lamports: u64,         // 8
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
}

impl Rarity {
    pub fn to_u8(&self) -> u8 {
        match self {
            Rarity::Common => 0,
            Rarity::Uncommon => 1,
            Rarity::Rare => 2,
            Rarity::Epic => 3,
            Rarity::Legendary => 4,
        }
    }

    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Rarity::Common),
            1 => Some(Rarity::Uncommon),
            2 => Some(Rarity::Rare),
            3 => Some(Rarity::Epic),
            4 => Some(Rarity::Legendary),
            _ => None,
        }
    }

    pub fn max_hours(&self) -> u8 {
        match self {
            Rarity::Common => MAX_HOURS_COMMON,
            Rarity::Uncommon => MAX_HOURS_UNCOMMON,
            Rarity::Rare => MAX_HOURS_RARE,
            Rarity::Epic => MAX_HOURS_EPIC,
            Rarity::Legendary => MAX_HOURS_LEGENDARY,
        }
    }

    // ===== [НОВОЕ] =====

    /// Индекс в craft/craft-economy таблицах (только крафтящиеся редкости,
    /// Common не крафтится — выдаётся паками/mint_tool).
    pub fn craft_index(&self) -> Option<usize> {
        match self {
            Rarity::Common => None,
            Rarity::Uncommon => Some(0),
            Rarity::Rare => Some(1),
            Rarity::Epic => Some(2),
            Rarity::Legendary => Some(3),
        }
    }

    /// Стоимость ремонта (STONE за 1 юнит прочности) — тот же паттерн,
    /// что max_hours()/income_multiplier(), константы см. constants.rs.
    /// Yield multiplier in bps for mining. Single source of truth: it used to
    /// be duplicated between `constants::YIELD_BPS_*` and a private
    /// `yield_bps()` inside `collect_mining.rs`, and the two could drift.
    pub fn yield_bps(&self) -> u64 {
        match self {
            Rarity::Common => YIELD_BPS_COMMON as u64,
            Rarity::Uncommon => YIELD_BPS_UNCOMMON as u64,
            Rarity::Rare => YIELD_BPS_RARE as u64,
            Rarity::Epic => YIELD_BPS_EPIC as u64,
            Rarity::Legendary => YIELD_BPS_LEGENDARY as u64,
        }
    }

    pub fn repair_stone_cost_per_unit(&self) -> u64 {
        match self {
            Rarity::Common => REPAIR_STONE_COMMON,
            Rarity::Uncommon => REPAIR_STONE_UNCOMMON,
            Rarity::Rare => REPAIR_STONE_RARE,
            Rarity::Epic => REPAIR_STONE_EPIC,
            Rarity::Legendary => REPAIR_STONE_LEGENDARY,
        }
    }
    
    pub fn repair_wood_cost_per_unit(&self) -> u64 {
        match self {
            Rarity::Common => REPAIR_WOOD_COMMON,
            Rarity::Uncommon => REPAIR_WOOD_UNCOMMON,
            Rarity::Rare => REPAIR_WOOD_RARE,
            Rarity::Epic => REPAIR_WOOD_EPIC,
            Rarity::Legendary => REPAIR_WOOD_LEGENDARY,
        }
    }
}

// ===== [НОВОЕ] Два новых аккаунта =====
// Оба вынесены ОТДЕЛЬНО от Config, чтобы не менять CONFIG_SPACE и не
// трогать layout уже описанного вами аккаунта Config.

/// Глобальный счётчик заминченных инструментов по редкости — bonding-curve
/// эскалация цены крафта. [ФАКТ, из аудита index.js реального Ronin-бэкенда]:
/// там цена крафта росла как `cost.wood + mintedCount * mult`; в присланных
/// файлах этой механики не было вовсе (craft ничего не тратил, кроме
/// фикс. SOL-комиссии) — восстанавливаю на Solana.
#[account]
#[derive(InitSpace)]
pub struct RarityCounter {
    pub rarity: u8,
    pub minted_count: u64,
}

/// Настраиваемые параметры bonding-curve крафта (базы и множители по
/// редкости), меняются владельцем через set_craft_economy без редеплоя.
#[account]
#[derive(InitSpace)]
pub struct CraftEconomy {
    pub wood_base: [u64; 4],
    pub stone_base: [u64; 4],
    pub food_base: [u64; 4],      // [НОВОЕ]
    pub seeds_base: [u64; 4],     // [НОВОЕ]
    pub water_base: [u64; 4],     // [НОВОЕ]
    pub potato_base: [u64; 4],    // [НОВОЕ]
    pub wood_mult: [u64; 4],
    pub stone_mult: [u64; 4],
    pub food_mult: [u64; 4],      // [НОВОЕ]
    pub seeds_mult: [u64; 4],     // [НОВОЕ]
    pub water_mult: [u64; 4],     // [НОВОЕ]
    pub potato_mult: [u64; 4],    // [НОВОЕ]
    pub bump: u8,
}

// ===== [НОВОЕ] Коллекционеры (Historian / Researcher-Medallion) =====
//
// [ФАКТ, из аудита index.js]: на Ronin коллекционеры НЕ on-chain —
// `stakeCollectors` просто ждёт Transfer-лог ERC721 на EOA-адрес
// `COLLECTOR_VAULT_ADDRESS`, пишет запись в Firestore с unlockAt =
// now + 3 дня, инкрементит has_historian/has_medallion. Анстейк —
// `requestUnstakeCollectors`, только после unlockAt, fee 0.01 RON.
//
// На Solana переношу тем же паттерном, что уже используется для
// ToolData.stake/unstake в этой программе — vault PDA вместо EOA
// (без единой точки отказа, в отличие от Ronin-версии).

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CollectorKind {
    Historian,
    Medallion,
}

#[account]
#[derive(InitSpace)]
pub struct StakedCollector {
    pub owner: Pubkey,     // 32
    pub mint: Pubkey,      // 32
    pub kind: CollectorKind, // 1
    pub unlock_at: i64,    // 8
}

/// [AUDIT F-16] Allowlist entry for the Historian/Medallion perks.
///
/// `collector_stake` used to start with `require!(false, CollectorNotConfigured)`,
/// which made the perks — and therefore `MINT_FEE_MEDALLION_*`,
/// `REFERRAL_MEDALLION_BONUS_CAP`/`REFERRAL_HISTORIAN_BONUS_CAP` — permanently
/// unreachable while the site kept advertising them. There is no canonical
/// collection mint registry on-chain, so instead of trusting a caller-supplied
/// mint the authority registers each eligible NFT mint explicitly here
/// (`register_collector_mint`) and `collector_stake` requires the entry to
/// exist and to carry the declared `CollectorKind`.
#[account]
#[derive(InitSpace)]
pub struct CollectorAllowEntry {
    pub mint: Pubkey,
    pub kind: CollectorKind,
    pub bump: u8,
}

// =====================================================================
// [НОВОЕ] Полная реализация TOR v4 — см. AUDIT_V4_FULL_IMPLEMENTATION.md
// =====================================================================

// ----- Паки -----

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PackType {
    Small,
    Medium,
    Big,
}
impl PackType {
    pub fn to_u8(&self) -> u8 {
        match self {
            PackType::Small => 0,
            PackType::Medium => 1,
            PackType::Big => 2,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct PackConfig {
    pub pack_type: u8,
    pub price_lamports: u64,
    pub odds_bps: [u16; 5], // Common,Uncommon,Rare,Epic,Legendary
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PackCommit {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub pack_type: u8,
    pub commit_hash: [u8; 32],
    pub commit_slot: u64,
    pub revealed: bool,
    /// Pack price held in escrow on this PDA until reveal (then forwarded to
    /// the treasury) or expiry (then refunded to `user`). Never paid out
    /// before the outcome is known, so a lost secret cannot cost the player.
    pub paid_lamports: u64,
}

// ----- Reroll (честный, RNG) -----

#[account]
#[derive(InitSpace)]
pub struct RerollConfig {
    pub odds_bps: [u16; 5],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RerollCommit {
    pub user: Pubkey,
    pub burn_mint: Pubkey,
    pub new_mint: Pubkey,
    pub commit_hash: [u8; 32],
    pub commit_slot: u64,
}

// ----- Exploration -----

#[account]
#[derive(InitSpace)]
pub struct ExplorationState {
    pub owner: Pubkey,
    pub tier: u8,           // 1..=MAX_EXPLORATION_TIER
    pub last_trip_at: i64,
    pub trips_today: u8,
    pub day_start: i64,
}

#[account]
#[derive(InitSpace)]
pub struct ExplorationCommit {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub commit_hash: [u8; 32],
    pub commit_slot: u64,
}

// ----- Рефералы -----

#[account]
#[derive(InitSpace)]
pub struct ReferralLink {
    pub referred: Pubkey,
    pub referrer: Pubkey,
    pub tier: u8, // 0..=6
    pub bound_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct ReferrerStats {
    pub referrer: Pubkey,
    pub active_count: u32,
}

// ----- Кузница риска (Enchant) -----

#[account]
#[derive(InitSpace)]
pub struct EnchantSlot {
    pub tool_mint: Pubkey,
    pub slot_type: u8, // 0=Speed, 1=Durability, 2=EnergyEfficiency
    pub level: u8,      // 0..=ENCHANT_MAX_LEVEL
}

#[account]
#[derive(InitSpace)]
pub struct ForgeCommit {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    pub slot_type: u8,
    pub commit_hash: [u8; 32],
    pub commit_slot: u64,
    pub use_protector: bool,
    /// SOL fee (+protector) escrowed on this PDA until reveal (-> treasury)
    /// or expiry (-> user).
    pub paid_lamports: u64,
    /// Resources burned at commit; re-minted to the user on expiry.
    pub wood_burned: u64,
    pub stone_burned: u64,
}

// ----- Лотерея -----

#[account]
#[derive(InitSpace)]
pub struct LotteryRound {
    pub round_id: u64,
    pub pool_lamports: u64,
    pub tickets_sold: u64,
    pub draw_slot: u64,
    pub drawn: bool,
    pub winning_ticket: u64,
    pub claimed: bool,
    pub bump: u8,
    /// [AUDIT F-23] Round creation time; starts the refund timeout that stops
    /// an unrevealed round from stranding its pool forever.
    pub created_at: i64,
    // [ФИКС] commit-reveal поля для розыгрыша (закрывают вектор гриферства)
    pub draw_committed: bool,
    pub draw_commit_slot: u64,
    pub draw_commit_hash: [u8; 32],
}

#[account]
#[derive(InitSpace)]
pub struct LotteryTicket {
    pub round_id: u64,
    pub ticket_number: u64,
    pub buyer: Pubkey,
}

/// [AUDIT] Per-wallet, per-round ticket counter. `LOTTERY_MAX_TICKETS_PER_DAY`
/// existed as a constant but was never enforced anywhere; the backend limit was
/// trivially bypassed by calling the program directly. The PDA is derived from
/// (round, buyer) so the counter cannot be shared or reset.
#[account]
#[derive(InitSpace)]
pub struct LotteryTicketCounter {
    pub buyer: Pubkey,
    pub round_id: u64,
    pub count: u8,
    pub bump: u8,
}

// ----- Рынок -----

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Auction {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub min_bid: u64,
    pub current_bid: u64,
    pub current_bidder: Pubkey,
    pub end_time: i64,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub buyer: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
    pub active: bool,
}

#[account]
#[derive(InitSpace)]
pub struct RentalListing {
    pub owner: Pubkey,
    pub mint: Pubkey,
    /// [ФИКС] Доля владельца от платы за аренду (0..=10000 bps), читается в start_handler
    pub owner_split_bps: u16,
    pub min_duration: i64,
    pub max_duration: i64,
    pub active: bool,
    /// [ФИКС] Цена аренды за час в lamports (раньше аренда была бесплатной)
    pub price_per_hour_lamports: u64,
}

#[account]
#[derive(InitSpace)]
pub struct RentalAgreement {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub renter: Pubkey,
    pub start: i64,
    pub end: i64,
    pub revoke_requested_at: i64, // 0 = не запрошено
}

// ----- Ордербук ресурсов -----

#[account]
#[derive(InitSpace)]
pub struct ResourceOrder {
    pub maker: Pubkey,
    pub kind: u8, // ResourceKind as u8
    pub is_buy: bool,
    pub price_lamports_per_unit: u64,
    pub amount_remaining: u64,
    pub mint: Pubkey,
}

// ----- Крафт под заказ -----

#[account]
#[derive(InitSpace)]
pub struct CraftOrder {
    pub creator: Pubkey,
    pub wood_needed: u64,
    pub stone_needed: u64,
    pub premium_lamports: u64,
    pub active: bool,
}

// ----- Сезонный пасс -----

#[account]
#[derive(InitSpace)]
pub struct Season {
    pub season_id: u32,
    pub start_time: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SeasonPass {
    pub owner: Pubkey,
    pub season_id: u32,
    pub xp: u32,
    pub premium: bool,
    pub claimed_bitmap: u64, // до 42 уровней — влезает в u64 битовую маску
}

// =====================================================================
// [БЛОК L] Хлебная экономика: новые аккаунты
// =====================================================================

/// MaterialMints — singleton PDA, хранит адреса всех 23 минтов ресурсов
#[account]
#[derive(InitSpace)]
pub struct MaterialMints {
    pub seeds: Pubkey,
    pub wheat: Pubkey,
    pub flour: Pubkey,
    pub bread: Pubkey,
    pub water: Pubkey,
    pub coal: Pubkey,
    pub meat: Pubkey,
    pub stone_blue: Pubkey,
    pub stone_purple: Pubkey,
    pub stone_red: Pubkey,
    pub sand_white: Pubkey,
    pub sand_pink: Pubkey,
    pub sand_yellow: Pubkey,
    pub gem_blue: Pubkey,
    pub gem_orange: Pubkey,
    pub gem_white: Pubkey,
    pub gem_green: Pubkey,
    pub flask_blue: Pubkey,
    pub flask_yellow: Pubkey,
    pub flask_green: Pubkey,
    pub flask_pink: Pubkey,
    pub flask_purple: Pubkey,
    pub love_heart: Pubkey,
    pub bump: u8,
    /// [AUDIT F-03] Hard ceiling on the total supply of every resource,
    /// indexed by `ResourceKind as u8` (see `RESOURCE_KIND_COUNT`).
    ///
    /// `IssuanceCap` only ever guarded `mint_resource`/`mint_resource_once`,
    /// so `collect_mining`, `collect_flour`, `collect_bread`,
    /// `collect_well_water`, `explore_reveal`, `craft_recipe` and
    /// `claim_season_reward` could emit without any bound. This array is
    /// checked by every minting path, whatever the caller, because the check
    /// is a pure function of the mint account supply.
    ///
    /// `SUPPLY_CAP_UNLIMITED` (u64::MAX) means "no ceiling configured"; the
    /// authority is expected to lower the interesting kinds right after
    /// `init_material_mints`, and can tighten them at any time with
    /// `set_supply_cap`. Lowering below the current supply halts that kind.
    pub max_supply: [u64; RESOURCE_KIND_COUNT],
}

/// One canonical mapping ResourceKind -> mint. Previously duplicated in
/// `mint_resource.rs` and `burn_resource.rs`, where the two copies could
/// silently diverge ([AUDIT G-06]).
/// [AUDIT G-08] `craft`, `reroll` and `mint_tool` each wrote the same nine
/// fields of a freshly minted tool. Hand-copied initialisers drift: `reroll`
/// already set them in a different order from `craft`, and a tenth field added
/// to `ToolData` would have had to be remembered three times. One function,
/// three call sites.
pub fn init_tool_data(
    tool: &mut ToolData,
    mint: Pubkey,
    owner: Pubkey,
    tool_type: String,
    rarity: Rarity,
) {
    tool.mint = mint;
    tool.owner = owner;
    tool.operator = owner;
    tool.tool_type = tool_type;
    tool.rarity = rarity;
    tool.durability = MAX_DURABILITY;
    tool.is_mining = false;
    tool.mining_end = 0;
    tool.last_mined_hours = 0;
    tool.staked = false;
    tool.unlock_at = 0;
}

pub fn mint_for_kind(config: &Config, material_mints: &MaterialMints, kind: &ResourceKind) -> Pubkey {
    match kind {
        // Старые ресурсы из Config
        ResourceKind::Food => config.food_mint,
        ResourceKind::Wood => config.wood_mint,
        ResourceKind::Stone => config.stone_mint,
        // [БЛОК L] Новые ресурсы из MaterialMints
        ResourceKind::Seeds => material_mints.seeds,
        ResourceKind::Wheat => material_mints.wheat,
        ResourceKind::Flour => material_mints.flour,
        ResourceKind::Bread => material_mints.bread,
        ResourceKind::Water => material_mints.water,
        ResourceKind::Coal => material_mints.coal,
        ResourceKind::Meat => material_mints.meat,
        ResourceKind::StoneBlue => material_mints.stone_blue,
        ResourceKind::StonePurple => material_mints.stone_purple,
        ResourceKind::StoneRed => material_mints.stone_red,
        ResourceKind::SandWhite => material_mints.sand_white,
        ResourceKind::SandPink => material_mints.sand_pink,
        ResourceKind::SandYellow => material_mints.sand_yellow,
        ResourceKind::GemBlue => material_mints.gem_blue,
        ResourceKind::GemOrange => material_mints.gem_orange,
        ResourceKind::GemWhite => material_mints.gem_white,
        ResourceKind::GemGreen => material_mints.gem_green,
        ResourceKind::FlaskBlue => material_mints.flask_blue,
        ResourceKind::FlaskYellow => material_mints.flask_yellow,
        ResourceKind::FlaskGreen => material_mints.flask_green,
        ResourceKind::FlaskPink => material_mints.flask_pink,
        ResourceKind::FlaskPurple => material_mints.flask_purple,
        ResourceKind::LoveHeart => material_mints.love_heart,
        ResourceKind::Potato => config.potato_mint,
    }
}

/// Check the global supply ceiling for `kind` BEFORE the mint CPI runs, so a
/// rejected mint leaves no state change behind. `u64::MAX` means unlimited.
pub fn check_supply_cap(
    material_mints: &MaterialMints,
    kind: ResourceKind,
    current_supply: u64,
    amount: u64,
) -> core::result::Result<(), crate::errors::AofError> {
    use crate::errors::AofError;
    let cap = material_mints.max_supply[kind as usize];
    if cap == SUPPLY_CAP_UNLIMITED {
        return Ok(());
    }
    let next = current_supply
        .checked_add(amount)
        .ok_or(AofError::MathOverflow)?;
    if next > cap {
        return Err(AofError::SupplyCapExceeded);
    }
    Ok(())
}

/// Per-mint rate limiter for authority withdrawals from the staking vault
/// ([AUDIT F-01]). `pay_out` used to be an unbounded "move any amount of any
/// mint to any wallet" primitive, so a single leaked hot key meant total loss
/// of everything the vault held. The guard is a required account: a missing
/// guard PDA fails account resolution, i.e. an un-configured mint cannot be
/// withdrawn at all.
#[account]
#[derive(InitSpace)]
pub struct VaultGuard {
    pub mint: Pubkey,
    pub epoch_slots: u64,
    pub cap_per_epoch: u64,      // 0 = withdrawals of this mint halted
    pub max_per_tx: u64,         // 0 = no per-transaction ceiling
    pub epoch_start_slot: u64,
    pub withdrawn_in_epoch: u64,
    pub lifetime_withdrawn: u128,
    pub bump: u8,
}

impl VaultGuard {
    pub fn roll_epoch(&mut self, slot: u64) {
        if self.epoch_slots == 0 {
            return;
        }
        let end = self.epoch_start_slot.saturating_add(self.epoch_slots);
        if slot < end {
            return;
        }
        let elapsed = slot - self.epoch_start_slot;
        let full = elapsed / self.epoch_slots;
        self.epoch_start_slot = self
            .epoch_start_slot
            .saturating_add(full.saturating_mul(self.epoch_slots));
        self.withdrawn_in_epoch = 0;
    }

    pub fn charge(
        &mut self,
        amount: u64,
        slot: u64,
    ) -> core::result::Result<(), crate::errors::AofError> {
        use crate::errors::AofError;
        if self.cap_per_epoch == 0 || self.epoch_slots == 0 {
            return Err(AofError::VaultGuardNotConfigured);
        }
        if self.max_per_tx > 0 && amount > self.max_per_tx {
            return Err(AofError::VaultGuardLimitExceeded);
        }
        self.roll_epoch(slot);
        let next = self
            .withdrawn_in_epoch
            .checked_add(amount)
            .ok_or(AofError::MathOverflow)?;
        if next > self.cap_per_epoch {
            return Err(AofError::VaultGuardLimitExceeded);
        }
        self.withdrawn_in_epoch = next;
        self.lifetime_withdrawn = self
            .lifetime_withdrawn
            .checked_add(amount as u128)
            .ok_or(AofError::MathOverflow)?;
        Ok(())
    }
}

/// EnergyAccount — ленивая энергия игрока (реген +1 за 30 мин до капа 20)
#[account]
#[derive(InitSpace)]
pub struct EnergyAccount {
    pub owner: Pubkey,
    pub current: u8,
    pub last_regen_at: i64,
    pub cap: u8,
    pub bump: u8,
}

impl EnergyAccount {
    /// Clamp before narrowing to u8; long absences must not wrap at 256 ticks.
    /// Preserve fractional intervals while below cap, but never bank regen
    /// while full and spend it a second time after the next energy debit.
    pub fn regenerate(&mut self, now: i64) {
        if now <= self.last_regen_at { return; }
        if self.current >= self.cap {
            self.current = self.cap;
            self.last_regen_at = now;
            return;
        }
        let ticks = now.saturating_sub(self.last_regen_at) / crate::constants::ENERGY_REGEN_SECONDS;
        let missing = (self.cap - self.current) as i64;
        self.current += ticks.min(missing) as u8;
        if self.current == self.cap {
            self.last_regen_at = now;
        } else {
            self.last_regen_at = self.last_regen_at.saturating_add(ticks * crate::constants::ENERGY_REGEN_SECONDS);
        }
    }
}

#[cfg(test)]
mod energy_tests {
    use super::*;
    fn energy(current: u8) -> EnergyAccount {
        EnergyAccount { owner: Pubkey::default(), current, last_regen_at: 100, cap: 10, bump: 0 }
    }
    #[test]
    fn long_absence_and_full_cap_do_not_wrap_or_bank() {
        let tick = crate::constants::ENERGY_REGEN_SECONDS;
        let mut e = energy(0);
        e.regenerate(100 + tick * 256);
        assert_eq!(e.current, 10);
        e.regenerate(100 + tick * 300);
        e.current -= 2;
        e.regenerate(100 + tick * 300);
        assert_eq!(e.current, 8);
    }
    #[test]
    fn fractional_time_and_clock_rollback() {
        let tick = crate::constants::ENERGY_REGEN_SECONDS;
        let mut e = energy(0);
        e.regenerate(100 + tick + tick / 2);
        assert_eq!(e.current, 1);
        assert_eq!(e.last_regen_at, 100 + tick);
        e.regenerate(0);
        assert_eq!(e.current, 1);
        e.regenerate(100 + tick * 2);
        assert_eq!(e.current, 2);
    }
}

/// FarmTile — состояние полевого тайла (пусто/растёт/готово)
#[account]
#[derive(InitSpace)]
pub struct FarmTile {
    pub owner: Pubkey,
    pub state: u8, // 0=empty, 1=growing, 2=ready
    pub planted_at: i64,
    pub ready_at: i64,
    pub seeds_amount: u64,
    pub bump: u8,
}

/// WeatherState — глобальная погода (обновляется permissionless-кранком раз в сутки)
#[account]
#[derive(InitSpace)]
pub struct WeatherState {
    pub day_id: u32,
    pub weather: u8,
    pub updated_at: i64,
    pub bump: u8,
}

/// WellState — колодец игрока (копит воду из погоды)
#[account]
#[derive(InitSpace)]
pub struct WellState {
    pub owner: Pubkey,
    pub water_buffer: u64,
    pub last_collected_at: i64,
    pub bump: u8,
}

/// MillState — мельница игрока (одна активная партия одновременно)
#[account]
#[derive(InitSpace)]
pub struct MillState {
    pub owner: Pubkey,
    pub in_progress: bool,
    pub ready_at: i64,
    pub output_flour: u64,
    pub bump: u8,
}

/// OvenState — печь игрока (одна активная партия одновременно)
#[account]
#[derive(InitSpace)]
pub struct OvenState {
    pub owner: Pubkey,
    pub in_progress: bool,
    pub ready_at: i64,
    pub output_bread: u64,
    pub fuel_kind: u8, // 0=дрова, 1=уголь
    pub bump: u8,
}

/// Per-ResourceKind issuance budget. Lives outside Config so the deployed
/// Config layout is untouched. Epochs are measured in slots, not wall time.
///
/// Invariants enforced by `charge`:
///  * an epoch that has fully elapsed resets `minted_in_epoch` to zero and
///    snaps `epoch_start_slot` forward on the fixed grid — skipped epochs do
///    NOT accumulate unused budget;
///  * `cap_per_epoch == 0` means "not configured" and rejects every mint
///    (fail-closed), it is not "unlimited";
///  * changing the cap never resets `minted_in_epoch` (see set_issuance_cap).
#[account]
#[derive(InitSpace)]
pub struct IssuanceCap {
    pub kind: u8,               // ResourceKind as u8
    pub epoch_slots: u64,
    pub cap_per_epoch: u64,     // gross units (before fee split)
    pub epoch_start_slot: u64,
    pub minted_in_epoch: u64,
    pub lifetime_minted: u128,  // monotonic, for audit/indexer cross-checks
    pub bump: u8,
}

impl IssuanceCap {
    /// Roll the epoch window forward if `slot` is past the current one.
    /// Safe to call repeatedly; does nothing inside the current epoch.
    pub fn roll_epoch(&mut self, slot: u64) {
        if self.epoch_slots == 0 { return; }
        let end = self.epoch_start_slot.saturating_add(self.epoch_slots);
        if slot < end { return; }
        let elapsed = slot - self.epoch_start_slot;
        let full = elapsed / self.epoch_slots;
        self.epoch_start_slot = self.epoch_start_slot.saturating_add(full.saturating_mul(self.epoch_slots));
        self.minted_in_epoch = 0;
    }

    /// Reserve `amount` from the current epoch budget. Errors leave state
    /// unchanged except for the (idempotent) epoch roll.
    pub fn charge(&mut self, kind: u8, amount: u64, slot: u64) -> core::result::Result<(), crate::errors::AofError> {
        use crate::errors::AofError;
        if self.kind != kind { return Err(AofError::InvalidResourceKind); }
        if self.cap_per_epoch == 0 || self.epoch_slots == 0 { return Err(AofError::IssuanceCapNotConfigured); }
        self.roll_epoch(slot);
        let next = self.minted_in_epoch.checked_add(amount).ok_or(AofError::MathOverflow)?;
        if next > self.cap_per_epoch { return Err(AofError::IssuanceCapExceeded); }
        let lifetime = self.lifetime_minted.checked_add(amount as u128).ok_or(AofError::MathOverflow)?;
        self.minted_in_epoch = next;
        self.lifetime_minted = lifetime;
        Ok(())
    }
}

#[cfg(test)]
mod issuance_cap_tests {
    use super::*;
    use crate::errors::AofError;
    fn cap(epoch: u64, limit: u64) -> IssuanceCap {
        IssuanceCap { kind: 3, epoch_slots: epoch, cap_per_epoch: limit, epoch_start_slot: 1_000, minted_in_epoch: 0, lifetime_minted: 0, bump: 0 }
    }
    #[test]
    fn exact_cap_passes_and_one_more_fails_without_moving_counter() {
        let mut c = cap(100, 50);
        assert!(c.charge(3, 30, 1_000).is_ok());
        assert!(c.charge(3, 20, 1_050).is_ok());
        assert_eq!(c.minted_in_epoch, 50);
        assert!(matches!(c.charge(3, 1, 1_099), Err(AofError::IssuanceCapExceeded)));
        assert_eq!(c.minted_in_epoch, 50);
        assert_eq!(c.lifetime_minted, 50);
    }
    #[test]
    fn epoch_roll_snaps_to_grid_and_does_not_bank_skipped_epochs() {
        let mut c = cap(100, 50);
        c.charge(3, 50, 1_000).unwrap();
        // 1 epoch later: budget resets, window starts at 1_100
        c.charge(3, 50, 1_100).unwrap();
        assert_eq!(c.epoch_start_slot, 1_100);
        // 2.5 epochs later (slot 1_350): window is [1_300, 1_400), budget is 50 not 150
        c.charge(3, 50, 1_350).unwrap();
        assert_eq!(c.epoch_start_slot, 1_300);
        assert!(matches!(c.charge(3, 1, 1_399), Err(AofError::IssuanceCapExceeded)));
        // 1000 epochs later still exactly one budget
        c.charge(3, 50, 1_300 + 100 * 1000).unwrap();
        assert_eq!(c.epoch_start_slot, 101_300);
        assert!(matches!(c.charge(3, 1, 101_300), Err(AofError::IssuanceCapExceeded)));
        assert_eq!(c.lifetime_minted, 200);
    }
    #[test]
    fn unconfigured_wrong_kind_and_overflow_are_rejected() {
        let mut c = cap(100, 0);
        assert!(matches!(c.charge(3, 1, 1_000), Err(AofError::IssuanceCapNotConfigured)));
        let mut c = cap(0, 10);
        assert!(matches!(c.charge(3, 1, 1_000), Err(AofError::IssuanceCapNotConfigured)));
        let mut c = cap(100, 10);
        assert!(matches!(c.charge(4, 1, 1_000), Err(AofError::InvalidResourceKind)));
        let mut c = cap(100, u64::MAX);
        c.minted_in_epoch = u64::MAX - 1;
        assert!(matches!(c.charge(3, 2, 1_000), Err(AofError::MathOverflow)));
        assert_eq!(c.minted_in_epoch, u64::MAX - 1);
        // slot before epoch start (clock skew / stale slot) does not roll or panic
        let mut c = cap(100, 10);
        c.charge(3, 5, 500).unwrap();
        assert_eq!(c.epoch_start_slot, 1_000);
        assert_eq!(c.minted_in_epoch, 5);
    }
}

/// Permanent replay tombstone. Never close/recycle this PDA: rent recovery would
/// restore the ability to mint the same logical reward after a DB rollback.
#[account]
#[derive(InitSpace)]
pub struct RewardReceipt {
    pub reward_id: [u8; 32],
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub gross_amount: u64,
    pub claimed_slot: u64,
    pub bump: u8,
}

/// [AUDIT F-03 / F-01 / F-17] Unit tests for the pure helpers the audit's
/// findings turned into. They need no validator: `cargo test -p aof-core` runs
/// them. `tests/aof_core.ts` covers the wiring; these cover the arithmetic and
/// the boundary conditions that decide whether funds move at all.
#[cfg(test)]
mod state_tests {
    use super::*;
    use crate::constants::{RESOURCE_KIND_COUNT, SUPPLY_CAP_UNLIMITED};
    use crate::errors::AofError;

    fn mm(cap: u64) -> MaterialMints {
        let mut m = MaterialMints {
            seeds: Pubkey::default(),
            wheat: Pubkey::default(),
            flour: Pubkey::default(),
            bread: Pubkey::default(),
            water: Pubkey::default(),
            coal: Pubkey::default(),
            meat: Pubkey::default(),
            stone_blue: Pubkey::default(),
            stone_purple: Pubkey::default(),
            stone_red: Pubkey::default(),
            sand_white: Pubkey::default(),
            sand_pink: Pubkey::default(),
            sand_yellow: Pubkey::default(),
            gem_blue: Pubkey::default(),
            gem_orange: Pubkey::default(),
            gem_white: Pubkey::default(),
            gem_green: Pubkey::default(),
            flask_blue: Pubkey::default(),
            flask_yellow: Pubkey::default(),
            flask_green: Pubkey::default(),
            flask_pink: Pubkey::default(),
            flask_purple: Pubkey::default(),
            love_heart: Pubkey::default(),
            bump: 0,
            max_supply: [SUPPLY_CAP_UNLIMITED; RESOURCE_KIND_COUNT],
        };
        m.max_supply[ResourceKind::Wood as usize] = cap;
        m
    }

    #[test]
    fn supply_cap_is_inclusive_and_unlimited_is_open() {
        let capped = mm(1_000);
        assert!(check_supply_cap(&capped, ResourceKind::Wood, 999, 1).is_ok(), "exactly at the cap must pass");
        assert!(check_supply_cap(&capped, ResourceKind::Wood, 1_000, 1).is_err(), "one unit over the cap must fail");
        assert!(matches!(
            check_supply_cap(&capped, ResourceKind::Wood, 0, 1_001).unwrap_err(),
            AofError::SupplyCapExceeded
        ));
        // Unlimited kinds never block, whatever the supply.
        assert!(check_supply_cap(&capped, ResourceKind::Water, u64::MAX - 1, 1).is_ok());
        // Overflowing supply+amount is an error, not a panic.
        assert!(check_supply_cap(&capped, ResourceKind::Water, u64::MAX, u64::MAX).is_err());
    }

    fn guard(cap: u64, max_tx: u64) -> VaultGuard {
        VaultGuard {
            mint: Pubkey::default(),
            epoch_slots: 100,
            cap_per_epoch: cap,
            max_per_tx: max_tx,
            epoch_start_slot: 0,
            withdrawn_in_epoch: 0,
            lifetime_withdrawn: 0,
            bump: 0,
        }
    }

    #[test]
    fn vault_guard_enforces_per_tx_then_per_epoch() {
        let mut g = guard(1_000, 400);
        assert!(g.charge(400, 10).is_ok());
        assert!(matches!(g.charge(401, 11).unwrap_err(), AofError::VaultGuardLimitExceeded), "per-tx ceiling");
        assert!(g.charge(300, 12).is_ok());
        assert!(g.charge(300, 13).is_ok());
        assert!(matches!(g.charge(1, 14).unwrap_err(), AofError::VaultGuardLimitExceeded), "epoch budget is cumulative");
        // The epoch resets, so the guard is a rate limiter, not a permanent ban.
        assert!(g.charge(400, 200).is_ok(), "a new epoch restores the budget");
        assert_eq!(g.lifetime_withdrawn, 1_400);
    }

    #[test]
    fn vault_guard_fails_closed_when_unconfigured() {
        let mut g = guard(0, 0);
        assert!(matches!(g.charge(1, 5).unwrap_err(), AofError::VaultGuardNotConfigured));
        let mut no_slots = guard(1_000, 10);
        no_slots.epoch_slots = 0;
        assert!(matches!(no_slots.charge(1, 5).unwrap_err(), AofError::VaultGuardNotConfigured));
    }

    #[test]
    fn tool_kinds_are_canonicalised() {
        for kind in TOOL_KINDS {
            assert!(is_valid_tool_type(kind));
            assert_eq!(canonical_tool_type(kind), Some(kind));
            assert!(is_valid_tool_type(&kind.to_uppercase()), "case must not matter");
            assert!(is_valid_tool_type(&kind.to_uppercase()));
        }
        assert!(!is_valid_tool_type("sword"));
        assert!(!is_valid_tool_type(""));
        assert_eq!(canonical_tool_type("Spear"), Some("spear"));
    }

    #[test]
    fn init_tool_data_writes_every_field() {
        let mint = Pubkey::new_unique();
        let owner = Pubkey::new_unique();
        let mut tool = ToolData {
            mint: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            tool_type: "stale".to_string(),
            rarity: Rarity::Legendary,
            durability: 0,
            is_mining: true,
            mining_end: 999,
            last_mined_hours: 7,
            staked: true,
            unlock_at: 42,
            operator: Pubkey::new_unique(),
        };
        init_tool_data(&mut tool, mint, owner, "axe".to_string(), Rarity::Common);
        assert_eq!(tool.mint, mint);
        assert_eq!(tool.owner, owner);
        assert_eq!(tool.operator, owner, "operator must follow the owner");
        assert_eq!(tool.tool_type, "axe");
        assert_eq!(tool.rarity, Rarity::Common);
        assert_eq!(tool.durability, crate::constants::MAX_DURABILITY);
        assert!(!tool.is_mining && !tool.staked);
        assert_eq!((tool.mining_end, tool.last_mined_hours, tool.unlock_at), (0, 0, 0));
    }

    /// The registry is indexed by `kind as u8` in `MaterialMints::max_supply`,
    /// so every variant must sit inside the array the constant sizes.
    #[test]
    fn every_resource_kind_fits_the_registry() {
        assert!(
            RESOURCE_KIND_COUNT >= 27,
            "RESOURCE_KIND_COUNT ({RESOURCE_KIND_COUNT}) is smaller than the ResourceKind enum"
        );
        // Spot-check both ends of the enum against the mapping (no transmute:
        // an invalid discriminant would be UB and would hide the very bug this
        // test is looking for).
        let cfg = Config {
            authority: Pubkey::default(),
            treasury: Pubkey::default(),
            food_mint: Pubkey::new_unique(),
            wood_mint: Pubkey::new_unique(),
            stone_mint: Pubkey::new_unique(),
            seeds_mint: Pubkey::default(),
            water_mint: Pubkey::default(),
            potato_mint: Pubkey::default(),
            craft_fee: 0,
            unstake_fee: 0,
            paused: false,
            bump: 0,
            mining_enabled: true,
            pending_authority: Pubkey::default(),
            authority_updated_at: 0,
        };
        let mut mints = mm(SUPPLY_CAP_UNLIMITED);
        for kind in [
            ResourceKind::Food,
            ResourceKind::Wood,
            ResourceKind::Stone,
            ResourceKind::Seeds,
            ResourceKind::Water,
            ResourceKind::Potato,
        ] {
            let idx = kind as usize;
            assert!(idx < RESOURCE_KIND_COUNT, "{kind:?} index {idx} is outside max_supply");
            // Distinct mints must not silently collapse onto one registry slot.
            mints.max_supply[idx] = idx as u64 + 1;
            assert_eq!(
                check_supply_cap(&mints, kind, 0, idx as u64 + 1).is_ok(),
                true,
                "{kind:?} cap lookup reads the wrong slot"
            );
        }
        assert_eq!(mint_for_kind(&cfg, &mints, &ResourceKind::Wood), cfg.wood_mint);
        assert_eq!(mint_for_kind(&cfg, &mints, &ResourceKind::Stone), cfg.stone_mint);
        assert_eq!(mint_for_kind(&cfg, &mints, &ResourceKind::Food), cfg.food_mint);
    }
}
