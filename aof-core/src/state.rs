use anchor_lang::prelude::*;
use crate::constants::*;

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

    pub fn income_multiplier(&self) -> u64 {
        match self {
            Rarity::Common => 1,
            Rarity::Uncommon => 2,
            Rarity::Rare => 4,
            Rarity::Epic => 8,
            Rarity::Legendary => 16,
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum EnchantSlotType {
    Speed,
    Durability,
    EnergyEfficiency,
}

#[account]
#[derive(InitSpace)]
pub struct EnchantSlot {
    pub tool_mint: Pubkey,
    pub slot_type: u8, // EnchantSlotType as u8
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
        EnergyAccount { owner: Pubkey::default(), current, last_regen_at: 100, cap: 10, bump: 0, buff_expires_at: 0, buff_type: 0 }
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
}

/// WeatherState — глобальная погода (обновляется permissionless-кранком раз в сутки)
#[account]
#[derive(InitSpace)]
pub struct WeatherState {
    pub day_id: u32,
    pub weather: u8,
    pub updated_at: i64,
    pub bump: u8,
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
}

/// WellState — колодец игрока (копит воду из погоды)
#[account]
#[derive(InitSpace)]
pub struct WellState {
    pub owner: Pubkey,
    pub water_buffer: u64,
    pub last_collected_at: i64,
    pub bump: u8,
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
}

/// LoveProgress — прогресс сердец любви игрока
#[account]
#[derive(InitSpace)]
pub struct LoveProgress {
    pub owner: Pubkey,
    pub hearts: u64,
    pub bump: u8,
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
}

/// FortuneBoost — активный буст удачи (для forge)
#[account]
#[derive(InitSpace)]
pub struct FortuneBoost {
    pub owner: Pubkey,
    pub expires_at: i64,
    pub bump: u8,
    pub buff_expires_at: i64,    // [НОВОЕ] Время окончания бафта от флакона
    pub buff_type: u8,           // [НОВОЕ] 1=Wood/Stone boost, 2=Craft speed, 3=Food yield
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
