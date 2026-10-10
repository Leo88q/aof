use anchor_lang::prelude::*;
use crate::constants::*;
use crate::ResourceKind;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,          // 32
    pub treasury: Pubkey,           // 32
    pub data_mint: Pubkey,          // 32
    pub circuit_mint: Pubkey,          // 32
    pub silicon_mint: Pubkey,         // 32
    pub neuron_mint: Pubkey,         // 32 [НОВОЕ]
    pub power_mint: Pubkey,         // 32 [НОВОЕ]
    pub mind_mint: Pubkey,        // 32 Historical ABI name: internal MIND resource, NOT external MIND
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
    // ===== [SECURITY_CHECKLIST_REVIEW F-C] Config v2: role separation =====
    // Appended fields only: a v1 account is a strict prefix of this layout and
    // `migrate_config_v2` grows it in place. `authority` is the admin (meant to
    // be a Squads multisig with a time lock): configuration, limits, rotation.
    /// Hot backend key for routine, budget-bounded operations only (craft
    /// co-sign, rewards within IssuanceCap, vault payouts within VaultGuard,
    /// tool mints, season XP). It cannot change any rule or limit.
    pub operator: Pubkey,           // 32
    /// Emergency key: may only switch the pause / cash-out freeze ON.
    pub guardian: Pubkey,           // 32
    /// Cash-out freeze: gameplay continues, but value cannot leave the game
    /// economy (trades paying SOL out, vault payouts). Guardian or admin set it,
    /// only the admin clears it.
    pub cashout_frozen: bool,       // 1
    /// Room for future fields without another migration.
    pub reserved: [u8; 32],         // 32
}

/// The five accepted ToolData kinds. Historical names are intentionally rejected.
pub const TOOL_KINDS: [&str; 5] = [
    "plasma_cutter",
    "silicon_extractor",
    "data_harvester",
    "quantum_transmitter",
    "neural_seeder",
];

pub fn is_valid_tool_type(tool_type: &str) -> bool {
    canonical_tool_type(tool_type).is_some()
}

/// Normalise letter case for the five current ids; reject historical names.
pub fn canonical_tool_type(tool_type: &str) -> Option<&'static str> {
    TOOL_KINDS.iter().copied().find(|kind| tool_type.eq_ignore_ascii_case(kind))
}

impl Config {
    pub fn is_resource_mint(&self, materials: &MaterialMints, mint: &Pubkey) -> bool {
        let m = mint;
        *m == self.data_mint
            || *m == self.circuit_mint
            || *m == self.silicon_mint
            || *m == self.neuron_mint
            || *m == self.power_mint
            || *m == self.mind_mint
            || *m == materials.neuron
            || *m == materials.synapse
            || *m == materials.signal
            || *m == materials.model
            || *m == materials.power
            || *m == materials.compute
            || *m == materials.dataset
            || *m == materials.blue_core
            || *m == materials.purple_core
            || *m == materials.red_core
            || *m == materials.clear_quartz
            || *m == materials.rose_quartz
            || *m == materials.amber_quartz
            || *m == materials.quantum_bit
            || *m == materials.neural_chip
            || *m == materials.photon_bit
            || *m == materials.bio_chip
            || *m == materials.cryo_fluid
            || *m == materials.volt_fluid
            || *m == materials.bio_fluid
            || *m == materials.nano_fluid
            || *m == materials.quantum_fluid
            || *m == materials.soul_core
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

/// Immutable after freeze: maps TOOL_KINDS-major, Rarity-minor order to the
/// 25 distinct public HTTPS JSON URIs used by every tool issuance path.
#[account]
#[derive(InitSpace)]
pub struct ToolMetadataRegistry {
    pub authority: Pubkey,
    pub initialized: bool,
    pub frozen: bool,
    pub populated_mask: u32,
    pub seller_fee_basis_points: u16,
    pub bump: u8,
    #[max_len(25, 80)]
    pub metadata_uris: Vec<String>,
}

impl ToolMetadataRegistry {
    pub fn metadata_uri(&self, tool_type: &str, rarity: Rarity) -> Result<&str> {
        require!(
            self.initialized && self.frozen,
            crate::AofError::ToolMetadataRegistryNotFrozen
        );
        require!(
            self.metadata_uris.len() == TOOL_METADATA_URI_COUNT,
            crate::AofError::InvalidToolMetadataRegistry
        );
        let kind_index = TOOL_KINDS
            .iter()
            .position(|kind| *kind == tool_type)
            .ok_or(crate::AofError::InvalidToolMetadataRegistry)?;
        let index = kind_index * 5 + rarity.to_u8() as usize;
        require!(
            index < self.metadata_uris.len()
                && self.populated_mask & (1u32 << index) != 0,
            crate::AofError::InvalidToolMetadataRegistry
        );
        Ok(self.metadata_uris[index].as_str())
    }
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

    /// Стоимость ремонта (Silicon за 1 юнит прочности) — тот же паттерн,
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

    pub fn repair_silicon_cost_per_unit(&self) -> u64 {
        match self {
            Rarity::Common => REPAIR_SILICON_COMMON,
            Rarity::Uncommon => REPAIR_SILICON_UNCOMMON,
            Rarity::Rare => REPAIR_SILICON_RARE,
            Rarity::Epic => REPAIR_SILICON_EPIC,
            Rarity::Legendary => REPAIR_SILICON_LEGENDARY,
        }
    }
    
    pub fn repair_circuit_cost_per_unit(&self) -> u64 {
        match self {
            Rarity::Common => REPAIR_CIRCUIT_COMMON,
            Rarity::Uncommon => REPAIR_CIRCUIT_UNCOMMON,
            Rarity::Rare => REPAIR_CIRCUIT_RARE,
            Rarity::Epic => REPAIR_CIRCUIT_EPIC,
            Rarity::Legendary => REPAIR_CIRCUIT_LEGENDARY,
        }
    }
}

// ===== [НОВОЕ] Два новых аккаунта =====
// Оба вынесены ОТДЕЛЬНО от Config, чтобы не менять CONFIG_SPACE и не
// трогать layout уже описанного вами аккаунта Config.

/// Глобальный счётчик заминченных инструментов по редкости — bonding-curve
/// эскалация цены крафта. [ФАКТ, из аудита index.js реального Ronin-бэкенда]:
/// там цена крафта росла как `cost.circuit + mintedCount * mult`; в присланных
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
    pub circuit_base: [u64; 4],
    pub silicon_base: [u64; 4],
    pub data_base: [u64; 4],      // [НОВОЕ]
    pub neuron_base: [u64; 4],     // [НОВОЕ]
    pub power_base: [u64; 4],     // [НОВОЕ]
    pub mind_base: [u64; 4],    // [НОВОЕ]
    pub circuit_mult: [u64; 4],
    pub silicon_mult: [u64; 4],
    pub data_mult: [u64; 4],      // [НОВОЕ]
    pub neuron_mult: [u64; 4],     // [НОВОЕ]
    pub power_mult: [u64; 4],     // [НОВОЕ]
    pub mind_mult: [u64; 4],    // [НОВОЕ]
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

/// A paid pack opening waiting for its Switchboard reveal.
/// seeds = [PACK_COMMIT_SEED, user, nonce_le]. The tool NFT is minted at the
/// PDA [PACK_MINT_SEED, this account] by the settling reveal.
#[account]
#[derive(InitSpace)]
pub struct PackCommit {
    pub user: Pubkey,
    /// Client-chosen, lets one wallet hold several pending openings.
    pub nonce: u64,
    pub pack_type: u8,
    /// Odds snapshot taken at commit: a later `set_pack_config` cannot change
    /// the table an already-paid opening is settled with.
    pub odds_bps: [u16; 5],
    /// Pack price, escrowed on this PDA until the outcome is known: reveal ->
    /// treasury, refund -> user. Never paid out earlier.
    pub paid_lamports: u64,
    /// Rent the settler fronts for the NFT mint, its ATA and ToolData,
    /// prepaid by the user so that ANY cranker (backend, player, third party)
    /// is made whole by the reveal. Returned to the user on refund.
    pub deposit_lamports: u64,
    /// Pool randomness account locked by this commit and its seed slot.
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    pub bump: u8,
}

// ----- Reroll (честный, RNG) -----

#[account]
#[derive(InitSpace)]
pub struct RerollConfig {
    pub odds_bps: [u16; 5],
    pub bump: u8,
}

/// seeds = [REROLL_COMMIT_SEED, user, nonce_le]. The burned tool is recorded
/// so that a refund (oracle never revealed) can restore an equivalent tool.
#[account]
#[derive(InitSpace)]
pub struct RerollCommit {
    pub user: Pubkey,
    pub nonce: u64,
    pub burn_mint: Pubkey,
    #[max_len(32)]
    pub burned_tool_type: String,
    pub burned_rarity: Rarity,
    pub burned_durability: u8,
    /// Odds snapshot taken at commit (see PackCommit::odds_bps).
    pub odds_bps: [u16; 5],
    /// Reroll fee moved out of the gas tank into this escrow (lamports).
    pub fee_lamports: u64,
    /// Prepaid rent for the settlement NFT (mint + ATA + ToolData).
    pub deposit_lamports: u64,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    pub bump: u8,
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

/// seeds = [EXPLORATION_COMMIT_SEED, tool_mint].
#[account]
#[derive(InitSpace)]
pub struct ExplorationCommit {
    pub user: Pubkey,
    pub tool_mint: Pubkey,
    /// Tier snapshot taken at commit: upgrading while the trip is pending
    /// must not change its odds.
    pub tier: u8,
    /// Resources burned at commit, re-minted on refund.
    pub data_burned: u64,
    pub circuit_burned: u64,
    pub silicon_burned: u64,
    pub dataset_burned: u64,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    pub bump: u8,
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
    /// Enchant level at commit; the reveal settles exactly this upgrade step.
    pub level_before: u8,
    pub use_protector: bool,
    /// SOL fee (+protector) escrowed on this PDA until reveal (-> treasury)
    /// or refund (-> user).
    pub paid_lamports: u64,
    /// Resources burned at commit; re-minted to the user on refund.
    pub circuit_burned: u64,
    pub silicon_burned: u64,
    pub randomness: Pubkey,
    pub seed_slot: u64,
    pub commit_slot: u64,
    pub bump: u8,
}

// ----- Лотерея -----

#[account]
#[derive(InitSpace)]
pub struct LotteryRound {
    pub round_id: u64,
    /// Escrowed ticket money: every ticket price until the draw, then the
    /// prize (the draw moves LOTTERY_DEV_BPS to the treasury).
    pub pool_lamports: u64,
    pub tickets_sold: u64,
    /// Switchboard seed slot of the draw commit. Byte-compatible with the old
    /// `draw_slot` field (same type and position), so existing rounds decode.
    pub seed_slot: u64,
    pub drawn: bool,
    pub winning_ticket: u64,
    pub claimed: bool,
    pub bump: u8,
    /// [AUDIT F-23] Round creation time; starts the sales window and the
    /// refund timeout.
    pub created_at: i64,
    /// A draw is in flight: ticket sales are closed.
    pub draw_committed: bool,
    pub draw_commit_slot: u64,
    /// Pool randomness account of the draw. Byte-compatible with the old
    /// 32-byte `draw_commit_hash`.
    pub randomness: Pubkey,
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

/// [F-06] One Switchboard randomness account of the program-owned pool.
/// seeds = [VRF_SLOT_SEED, randomness]. `lock` names the commit PDA that is
/// waiting for this account's reveal; a slot serves one commit at a time.
#[account]
#[derive(InitSpace)]
pub struct VrfSlot {
    /// Switchboard randomness account (PDA [VRF_RANDOMNESS_SEED, index_le] of
    /// this program, authority = PDA [VRF_AUTHORITY_SEED]).
    pub randomness: Pubkey,
    pub index: u32,
    /// Commit PDA holding the slot; Pubkey::default() when free.
    pub lock: Pubkey,
    pub locked_at_slot: u64,
    /// Operator switch for a misbehaving account; only a free slot retires.
    pub retired: bool,
    pub commits: u64,
    pub reveals: u64,
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

/// [AUDIT orderbook price unit] v2 order: the price is quoted for a WHOLE
/// resource (`amount_remaining` stays in atomic SPL units) and every lamport
/// amount is rounded up, so the escrow matches the quote the player signed.
/// Buy orders additionally track `escrow_lamports` — the lamports still held
/// for this order — so a cancel returns exactly what is left instead of
/// recomputing a rounded amount.
#[account]
#[derive(InitSpace)]
pub struct ResourceOrderV2 {
    pub maker: Pubkey,
    pub kind: u8, // ResourceKind as u8
    pub is_buy: bool,
    /// Lamports per one whole resource unit (10^9 atoms), not per atom.
    pub price_lamports_per_whole: u64,
    pub amount_remaining: u64,
    pub mint: Pubkey,
    /// Lamports escrowed for this buy order (0 for sell orders).
    pub escrow_lamports: u64,
    pub bump: u8,
}

// ----- Крафт под заказ -----

#[account]
#[derive(InitSpace)]
pub struct CraftOrder {
    pub creator: Pubkey,
    pub circuit_needed: u64,
    pub silicon_needed: u64,
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
    /// Free-track claims only. Premium claims have an independent ledger below.
    pub claimed_bitmap: u64, // до 42 уровней — влезает в u64 битовую маску
}

/// Premium-track reward claims are stored separately so upgrading a pass never
/// consumes (or blocks) the same level on the free track. Created atomically
/// with the paid purchase; the player funds the account rent.
#[account]
#[derive(InitSpace)]
pub struct SeasonPremiumClaims {
    pub owner: Pubkey,
    pub season_id: u32,
    pub claimed_bitmap: u64,
    pub bump: u8,
}

/// One durable claim cursor per player and season. It prevents replay without
/// allocating a permanent PDA for each frequent XP entitlement. The player
/// funds this account on their first XP claim for the season.
#[account]
#[derive(InitSpace)]
pub struct SeasonXpClaimCursor {
    pub owner: Pubkey,
    pub season_id: u32,
    pub next_nonce: u32,
    pub bump: u8,
}

/// The laboratory ending. The player pays the rent. Each seal burns one full
/// set of components and mints one Soul Core; the count is the kept proof.
#[account]
#[derive(InitSpace)]
pub struct LaboratoryFinale {
    pub owner: Pubkey,
    pub seals: u32,
    pub bump: u8,
}

// =====================================================================
// [БЛОК L] Хлебная экономика: новые аккаунты
// =====================================================================

/// MaterialMints — singleton PDA, хранит адреса всех 23 минтов ресурсов
#[account]
#[derive(InitSpace)]
pub struct MaterialMints {
    pub neuron: Pubkey,
    pub synapse: Pubkey,
    pub signal: Pubkey,
    pub model: Pubkey,
    pub power: Pubkey,
    pub compute: Pubkey,
    pub dataset: Pubkey,
    pub blue_core: Pubkey,
    pub purple_core: Pubkey,
    pub red_core: Pubkey,
    pub clear_quartz: Pubkey,
    pub rose_quartz: Pubkey,
    pub amber_quartz: Pubkey,
    pub quantum_bit: Pubkey,
    pub neural_chip: Pubkey,
    pub photon_bit: Pubkey,
    pub bio_chip: Pubkey,
    pub cryo_fluid: Pubkey,
    pub volt_fluid: Pubkey,
    pub bio_fluid: Pubkey,
    pub nano_fluid: Pubkey,
    pub quantum_fluid: Pubkey,
    pub soul_core: Pubkey,
    pub bump: u8,
    /// [AUDIT F-03] Hard ceiling on cumulative lifetime mint emissions per
    /// ResourceKind, indexed by `ResourceKind as u8`. Unlike an SPL mint's
    /// outstanding supply, this monotonic allowance is never restored by burns.
    /// `SUPPLY_CAP_UNLIMITED` (u64::MAX) is the explicit no-cap sentinel; the
    /// authority sets finite values with `set_supply_cap` before mining opens.
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
        ResourceKind::Data => config.data_mint,
        ResourceKind::Circuit => config.circuit_mint,
        ResourceKind::Silicon => config.silicon_mint,
        // [БЛОК L] Новые ресурсы из MaterialMints
        ResourceKind::Neuron => material_mints.neuron,
        ResourceKind::Synapse => material_mints.synapse,
        ResourceKind::Signal => material_mints.signal,
        ResourceKind::Model => material_mints.model,
        ResourceKind::Power => material_mints.power,
        ResourceKind::Compute => material_mints.compute,
        ResourceKind::Dataset => material_mints.dataset,
        ResourceKind::BlueCore => material_mints.blue_core,
        ResourceKind::PurpleCore => material_mints.purple_core,
        ResourceKind::RedCore => material_mints.red_core,
        ResourceKind::ClearQuartz => material_mints.clear_quartz,
        ResourceKind::RoseQuartz => material_mints.rose_quartz,
        ResourceKind::AmberQuartz => material_mints.amber_quartz,
        ResourceKind::QuantumBit => material_mints.quantum_bit,
        ResourceKind::NeuralChip => material_mints.neural_chip,
        ResourceKind::PhotonBit => material_mints.photon_bit,
        ResourceKind::BioChip => material_mints.bio_chip,
        ResourceKind::CryoFluid => material_mints.cryo_fluid,
        ResourceKind::VoltFluid => material_mints.volt_fluid,
        ResourceKind::BioFluid => material_mints.bio_fluid,
        ResourceKind::NanoFluid => material_mints.nano_fluid,
        ResourceKind::QuantumFluid => material_mints.quantum_fluid,
        ResourceKind::SoulCore => material_mints.soul_core,
        ResourceKind::Mind => config.mind_mint,
    }
}

/// Record cumulative lifetime issuance before a resource mint CPI. The
/// counter lives in the per-kind IssuanceCap PDA; burns never restore allowance.
pub fn check_supply_cap(
    material_mints: &MaterialMints,
    issuance_cap: &mut IssuanceCap,
    kind: ResourceKind,
    amount: u64,
) -> core::result::Result<(), crate::errors::AofError> {
    let lifetime_cap = material_mints.max_supply[kind as usize];
    issuance_cap.record_lifetime_mint(kind as u8, amount, lifetime_cap)
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
    // [AUDIT AOF-M2] init/set_vault_guard reject 0: the per-transaction
    // ceiling is mandatory. Legacy accounts written before that hardening
    // keep 0 = "no per-tx ceiling" at the state level (charge() below), but
    // no new account can be configured without a ceiling.
    pub max_per_tx: u64,
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

/// [AUDIT F-01][SECURITY_CHECKLIST_REVIEW F-E] The three brakes every authority
/// withdrawal from the staking vault has to pass, BEFORE any token CPI:
///  1. only a registered **resource** mint may leave the vault (staked tool
///     NFTs are never in the resource registry, so they cannot be pulled out);
///  2. the per-mint `VaultGuard` must belong to exactly that mint;
///  3. the amount is charged against the guard's per-tx / per-epoch budget.
///
/// Shared by `pay_out` and `pay_out_with_referral`. The referral variant was
/// documented as having "the same three brakes as PayOut" and even loaded
/// `material_mints` + `vault_guard`, but its handler never used them, so a
/// leaked authority key could drain any vault mint without a ceiling. Keeping
/// the checks in one function makes that kind of drift impossible to repeat.
pub fn charge_vault_withdrawal(
    config: &Config,
    material_mints: &MaterialMints,
    guard: &mut VaultGuard,
    mint: &Pubkey,
    amount: u64,
    slot: u64,
) -> core::result::Result<(), crate::errors::AofError> {
    use crate::errors::AofError;
    if !config.is_resource_mint(material_mints, mint) {
        return Err(AofError::NotAResourceMint);
    }
    if guard.mint != *mint {
        return Err(AofError::InvalidMint);
    }
    guard.charge(amount, slot)
}

/// [SECURITY_CHECKLIST #33] `token` is the canonical associated token account
/// of (owner, mint). Enforced where a third party — a permissionless settler,
/// matcher or fulfiller — picks the destination of someone else's tokens, so a
/// winner's NFT or a buyer's resources cannot be parked in a non-canonical
/// account that wallets never show.
pub fn is_canonical_ata(token: &Pubkey, owner: &Pubkey, mint: &Pubkey) -> bool {
    *token == anchor_spl::associated_token::get_associated_token_address(owner, mint)
}

/// [SECURITY_CHECKLIST_REVIEW F-D] Weather is a pure function of the UTC day, so
/// the weather of any past day can be recomputed exactly. `weather_crank` only
/// caches today's value in `WeatherState` for UIs.
pub fn weather_for_day(day_id: u32) -> u8 {
    let hash_val = (day_id as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_shr(32);
    // 10% blackout, 50% nominal, 30% surge, 10% frenzy
    match hash_val % 100 {
        0..=9 => WEATHER_BLACKOUT,
        10..=59 => WEATHER_NOMINAL,
        60..=89 => WEATHER_SURGE,
        _ => WEATHER_FRENZY,
    }
}

pub fn grid_rate_per_hour(weather: u8) -> u64 {
    match weather {
        WEATHER_BLACKOUT => GRID_RATE_BLACKOUT,
        WEATHER_NOMINAL => GRID_RATE_NOMINAL,
        WEATHER_SURGE => GRID_RATE_SURGE,
        WEATHER_FRENZY => GRID_RATE_FRENZY,
        _ => GRID_RATE_NOMINAL,
    }
}

/// [SECURITY_CHECKLIST_REVIEW F-D] Power accrued between `last` and `now`
/// (unix seconds): only the most recent `GRID_MAX_ACCRUAL_SECONDS` count, and
/// every second is priced at the weather of its own day. The grid station used to apply
/// the *cached* weather to the whole window, so collecting only on frenzy days
/// (or never cranking a stale frenzy) paid up to 20/h instead of the fair ~9/h.
/// A 24 h window spans at most two days, so the loop runs at most twice.
pub fn grid_accrual(last: i64, now: i64) -> core::result::Result<u64, crate::errors::AofError> {
    use crate::errors::AofError;
    if now <= last {
        return Ok(0);
    }
    let mut t = core::cmp::max(last, now.saturating_sub(GRID_MAX_ACCRUAL_SECONDS as i64));
    let mut rate_seconds: u128 = 0;
    while t < now {
        let day = t.div_euclid(86_400);
        let segment_end = core::cmp::min(day.saturating_add(1).saturating_mul(86_400), now);
        let seconds = (segment_end - t) as u128;
        rate_seconds += seconds * grid_rate_per_hour(weather_for_day(day as u32)) as u128;
        t = segment_end;
    }
    u64::try_from(rate_seconds / 3600).map_err(|_| AofError::MathOverflow)
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

/// LabTile — состояние лабораторной ячейки синтеза Neuron → Synapse (пусто/активно/готово)
#[account]
#[derive(InitSpace)]
pub struct LabTile {
    pub owner: Pubkey,
    pub state: u8, // 0=empty, 1=growing, 2=ready
    pub started_at: i64,
    pub ready_at: i64,
    pub neuron_amount: u64,
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

/// GridState — сетевой аккумулятор Power игрока
#[account]
#[derive(InitSpace)]
pub struct GridState {
    pub owner: Pubkey,
    pub power_buffer: u64,
    pub last_collected_at: i64,
    pub bump: u8,
}

/// SignalState — обработчик сигналов игрока (одна активная партия одновременно)
#[account]
#[derive(InitSpace)]
pub struct SignalState {
    pub owner: Pubkey,
    pub in_progress: bool,
    pub ready_at: i64,
    pub output_signal: u64,
    pub bump: u8,
}

/// ModelState — обучение модели игрока (одна активная задача одновременно)
#[account]
#[derive(InitSpace)]
pub struct ModelState {
    pub owner: Pubkey,
    pub in_progress: bool,
    pub ready_at: i64,
    pub output_model: u64,
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

    /// Raise a historical gross-issuance baseline. It is intentionally
    /// monotonic: an admin may conservatively add missed historical emissions,
    /// but can never reset allowance by lowering the counter.
    pub fn raise_lifetime_baseline(
        &mut self,
        total_minted: u128,
    ) -> core::result::Result<(), crate::errors::AofError> {
        use crate::errors::AofError;
        if total_minted < self.lifetime_minted {
            return Err(AofError::InvalidIssuanceCapParams);
        }
        self.lifetime_minted = total_minted;
        Ok(())
    }

    /// Record cumulative resource issuance against `MaterialMints.max_supply`.
    /// The cap is checked against the monotonic counter, never SPL Mint.supply,
    /// so burns cannot create new lifetime allowance.
    pub fn record_lifetime_mint(
        &mut self,
        kind: u8,
        amount: u64,
        max_lifetime_minted: u64,
    ) -> core::result::Result<(), crate::errors::AofError> {
        use crate::errors::AofError;
        if self.kind != kind { return Err(AofError::InvalidResourceKind); }
        let lifetime = self.lifetime_minted
            .checked_add(amount as u128)
            .ok_or(AofError::MathOverflow)?;
        if max_lifetime_minted != SUPPLY_CAP_UNLIMITED && lifetime > max_lifetime_minted as u128 {
            return Err(AofError::SupplyCapExceeded);
        }
        self.lifetime_minted = lifetime;
        Ok(())
    }

    /// Reserve `amount` from the current epoch budget only. The global
    /// cumulative amount has already been recorded by `check_supply_cap`.
    pub fn charge_epoch(
        &mut self,
        kind: u8,
        amount: u64,
        slot: u64,
    ) -> core::result::Result<(), crate::errors::AofError> {
        use crate::errors::AofError;
        if self.kind != kind { return Err(AofError::InvalidResourceKind); }
        if self.cap_per_epoch == 0 || self.epoch_slots == 0 { return Err(AofError::IssuanceCapNotConfigured); }
        self.roll_epoch(slot);
        let next = self.minted_in_epoch.checked_add(amount).ok_or(AofError::MathOverflow)?;
        if next > self.cap_per_epoch { return Err(AofError::IssuanceCapExceeded); }
        self.minted_in_epoch = next;
        Ok(())
    }

    /// Reserve both the current epoch budget and the monotonic counter. This
    /// remains useful to state-level tests and callers without MaterialMints.
    pub fn charge(&mut self, kind: u8, amount: u64, slot: u64) -> core::result::Result<(), crate::errors::AofError> {
        use crate::errors::AofError;
        if self.kind != kind { return Err(AofError::InvalidResourceKind); }
        if self.cap_per_epoch == 0 || self.epoch_slots == 0 { return Err(AofError::IssuanceCapNotConfigured); }
        let lifetime = self.lifetime_minted.checked_add(amount as u128).ok_or(AofError::MathOverflow)?;
        self.roll_epoch(slot);
        let next = self.minted_in_epoch.checked_add(amount).ok_or(AofError::MathOverflow)?;
        if next > self.cap_per_epoch { return Err(AofError::IssuanceCapExceeded); }
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
    fn historical_lifetime_baseline_is_monotonic() {
        let mut c = cap(100, 50);
        c.lifetime_minted = 40;
        c.raise_lifetime_baseline(100).unwrap();
        assert_eq!(c.lifetime_minted, 100);
        assert!(matches!(c.raise_lifetime_baseline(99), Err(AofError::InvalidIssuanceCapParams)));
        assert_eq!(c.lifetime_minted, 100, "a rejected lowering must preserve the counter");
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

/// Shared fixtures for the unit/property suites below. `MaterialMints` has no
/// `Default`, so the 25-field literal lives here exactly once.
#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use crate::constants::{RESOURCE_KIND_COUNT, SUPPLY_CAP_UNLIMITED};

    pub fn material_mints() -> MaterialMints {
        MaterialMints {
            neuron: Pubkey::default(),
            synapse: Pubkey::default(),
            signal: Pubkey::default(),
            model: Pubkey::default(),
            power: Pubkey::default(),
            compute: Pubkey::default(),
            dataset: Pubkey::default(),
            blue_core: Pubkey::default(),
            purple_core: Pubkey::default(),
            red_core: Pubkey::default(),
            clear_quartz: Pubkey::default(),
            rose_quartz: Pubkey::default(),
            amber_quartz: Pubkey::default(),
            quantum_bit: Pubkey::default(),
            neural_chip: Pubkey::default(),
            photon_bit: Pubkey::default(),
            bio_chip: Pubkey::default(),
            cryo_fluid: Pubkey::default(),
            volt_fluid: Pubkey::default(),
            bio_fluid: Pubkey::default(),
            nano_fluid: Pubkey::default(),
            quantum_fluid: Pubkey::default(),
            soul_core: Pubkey::default(),
            bump: 0,
            max_supply: [SUPPLY_CAP_UNLIMITED; RESOURCE_KIND_COUNT],
        }
    }

    pub fn with_supply_cap(kind: ResourceKind, cap: u64) -> MaterialMints {
        let mut m = material_mints();
        m.max_supply[kind as usize] = cap;
        m
    }

    pub fn issuance_cap(kind: ResourceKind, lifetime_minted: u128) -> IssuanceCap {
        IssuanceCap {
            kind: kind as u8,
            epoch_slots: 100,
            cap_per_epoch: 1_000,
            epoch_start_slot: 1_000,
            minted_in_epoch: 0,
            lifetime_minted,
            bump: 0,
        }
    }

    pub fn vault_guard(epoch_slots: u64, cap_per_epoch: u64, max_per_tx: u64) -> VaultGuard {
        VaultGuard {
            mint: Pubkey::default(),
            epoch_slots,
            cap_per_epoch,
            max_per_tx,
            epoch_start_slot: 1_000,
            withdrawn_in_epoch: 0,
            lifetime_withdrawn: 0,
            bump: 0,
        }
    }
}

/// [AUDIT F-03 / F-01 / F-17] Unit tests for the pure helpers the audit's
/// findings turned into. They need no validator: `cargo test -p aof-core` runs
/// them. `tests/aof_core.ts` covers the wiring; these cover the arithmetic and
/// the boundary conditions that decide whether funds move at all.
#[cfg(test)]
mod state_tests {
    use super::test_support::{issuance_cap, with_supply_cap};
    use super::*;
    use crate::constants::{RESOURCE_KIND_COUNT, SUPPLY_CAP_UNLIMITED};
    use crate::errors::AofError;

    fn mm(cap: u64) -> MaterialMints {
        with_supply_cap(ResourceKind::Circuit, cap)
    }

    #[test]
    fn lifetime_supply_cap_is_inclusive_monotonic_and_unlimited_is_open() {
        let capped = mm(1_000);
        let mut cap = issuance_cap(ResourceKind::Circuit, 999);
        assert!(check_supply_cap(&capped, &mut cap, ResourceKind::Circuit, 1).is_ok());
        assert_eq!(cap.lifetime_minted, 1_000);
        assert!(matches!(
            check_supply_cap(&capped, &mut cap, ResourceKind::Circuit, 1).unwrap_err(),
            AofError::SupplyCapExceeded
        ));
        assert_eq!(cap.lifetime_minted, 1_000, "rejected emission must not advance the monotonic counter");

        // Burns are not represented by this counter: a subsequent emission
        // still compares against 1,000 even if the SPL outstanding supply fell.
        let mut after_burn = issuance_cap(ResourceKind::Circuit, 1_000);
        assert!(check_supply_cap(&capped, &mut after_burn, ResourceKind::Circuit, 1).is_err());
        assert_eq!(after_burn.lifetime_minted, 1_000);

        // Unlimited kinds still increment the audit counter, but never block.
        let mut unlimited = issuance_cap(ResourceKind::Power, u128::MAX - 1);
        assert!(check_supply_cap(&capped, &mut unlimited, ResourceKind::Power, 1).is_ok());
        assert_eq!(unlimited.lifetime_minted, u128::MAX);
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
        assert_eq!(canonical_tool_type("Data_Harvester"), Some("data_harvester"));
        for old in ["axe", "pick", "spear", "bow", "reaper"] {
            assert_eq!(canonical_tool_type(old), None);
        }
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
        init_tool_data(&mut tool, mint, owner, "plasma_cutter".to_string(), Rarity::Common);
        assert_eq!(tool.mint, mint);
        assert_eq!(tool.owner, owner);
        assert_eq!(tool.operator, owner, "operator must follow the owner");
        assert_eq!(tool.tool_type, "plasma_cutter");
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
            data_mint: Pubkey::new_unique(),
            circuit_mint: Pubkey::new_unique(),
            silicon_mint: Pubkey::new_unique(),
            neuron_mint: Pubkey::default(),
            power_mint: Pubkey::default(),
            mind_mint: Pubkey::default(),
            craft_fee: 0,
            unstake_fee: 0,
            paused: false,
            bump: 0,
            mining_enabled: true,
            pending_authority: Pubkey::default(),
            authority_updated_at: 0,
            operator: Pubkey::default(),
            guardian: Pubkey::default(),
            cashout_frozen: false,
            reserved: [0u8; 32],
        };
        let mut mints = mm(SUPPLY_CAP_UNLIMITED);
        for kind in [
            ResourceKind::Data,
            ResourceKind::Circuit,
            ResourceKind::Silicon,
            ResourceKind::Neuron,
            ResourceKind::Power,
            ResourceKind::Mind,
        ] {
            let idx = kind as usize;
            assert!(idx < RESOURCE_KIND_COUNT, "{kind:?} index {idx} is outside max_supply");
            // Distinct mints must not silently collapse onto one registry slot.
            mints.max_supply[idx] = idx as u64 + 1;
            let mut cap = issuance_cap(kind, 0);
            assert_eq!(
                check_supply_cap(&mints, &mut cap, kind, idx as u64 + 1).is_ok(),
                true,
                "{kind:?} cap lookup reads the wrong slot"
            );
            assert_eq!(cap.lifetime_minted, (idx as u64 + 1) as u128);
        }
        assert_eq!(mint_for_kind(&cfg, &mints, &ResourceKind::Circuit), cfg.circuit_mint);
        assert_eq!(mint_for_kind(&cfg, &mints, &ResourceKind::Silicon), cfg.silicon_mint);
        assert_eq!(mint_for_kind(&cfg, &mints, &ResourceKind::Data), cfg.data_mint);
    }
}

// ---------------------------------------------------------------------------
// [AUDIT F-33] Property tests.
//
// The suite was example-based only. These drive the same pure helpers with a
// seeded generator so that the INVARIANT is asserted instead of a handful of
// hand-picked inputs - the audit asked for fuzzing of the money-moving
// arithmetic. `proptest` would mean a new dev-dependency plus a Cargo.lock
// edit that CI (`cargo test --locked`) could not be re-verified from an
// environment without cargo, so the generator is 20 lines of xorshift64*:
// deterministic, dependency-free and reproducible from the failing input.
// ---------------------------------------------------------------------------
#[cfg(test)]
mod property_tests {
    use super::test_support::{issuance_cap, vault_guard, with_supply_cap};
    use super::*;
    use crate::constants::SUPPLY_CAP_UNLIMITED;
    use crate::errors::AofError;
    use crate::randomness::weighted_pick;

    struct Rng(u64);

    impl Rng {
        fn new(seed: u64) -> Self { Self(seed | 1) }
        fn next_u64(&mut self) -> u64 {
            let mut x = self.0;
            x ^= x >> 12;
            x ^= x << 25;
            x ^= x >> 27;
            self.0 = x;
            x.wrapping_mul(0x2545_F491_4F6C_DD1D)
        }
        fn below(&mut self, n: u64) -> u64 { if n == 0 { 0 } else { self.next_u64() % n } }
        /// Biased towards what an attacker actually sends: 0, 1, u64::MAX and
        /// small numbers, not just a uniform spread.
        fn extreme(&mut self) -> u64 {
            match self.below(8) {
                0 => 0,
                1 => 1,
                2 => u64::MAX,
                3 => u64::MAX - 1,
                4 => self.next_u64() & 0xffff,
                _ => self.next_u64(),
            }
        }
    }

    /// [F-03] The cap predicate is exactly `lifetime_minted + amount <= cap`
    /// for every input; any burn is intentionally absent from the arithmetic.
    #[test]
    fn lifetime_supply_cap_is_exactly_the_arithmetic_predicate() {
        let mut rng = Rng::new(0xA0F_2026);
        for _ in 0..20_000 {
            let cap = rng.extreme();
            let lifetime = rng.extreme() as u128;
            let amount = rng.extreme();
            let mints = with_supply_cap(ResourceKind::Circuit, cap);
            let next = lifetime.checked_add(amount as u128);
            let expected = next.is_some_and(|n| cap == SUPPLY_CAP_UNLIMITED || n <= cap as u128);
            let mut issuance = issuance_cap(ResourceKind::Circuit, lifetime);
            let got = check_supply_cap(&mints, &mut issuance, ResourceKind::Circuit, amount);
            assert_eq!(got.is_ok(), expected, "cap={cap} lifetime={lifetime} amount={amount}");
            if expected {
                assert_eq!(issuance.lifetime_minted, lifetime + amount as u128);
            } else {
                assert_eq!(issuance.lifetime_minted, lifetime, "rejected emission changed the counter");
                match next {
                    None => assert!(matches!(got.unwrap_err(), AofError::MathOverflow)),
                    Some(_) => assert!(matches!(got.unwrap_err(), AofError::SupplyCapExceeded)),
                }
            }
        }
    }

    /// [F-01] A stolen authority key is bounded by the guard, so the guard must
    /// never let the epoch budget or the per-transaction ceiling slip.
    #[test]
    fn vault_guard_never_releases_more_than_its_budget() {
        let mut rng = Rng::new(0xF01_2026);
        for _ in 0..2_000 {
            let epoch = 1 + rng.below(100_000);
            let cap = rng.extreme();
            let max_tx = rng.extreme();
            if cap == 0 { continue; } // "halted": covered by the unit tests
            let mut guard = vault_guard(epoch, cap, max_tx);
            for _ in 0..8 {
                let amount = rng.extreme();
                let slot = 1_000 + rng.below(epoch);
                let before = guard.withdrawn_in_epoch;
                let lifetime = guard.lifetime_withdrawn;
                match guard.charge(amount, slot) {
                    Ok(()) => {
                        assert!(max_tx == 0 || amount <= max_tx, "per-tx ceiling ignored: {amount} > {max_tx}");
                        assert_eq!(guard.withdrawn_in_epoch, before + amount, "cumulative accounting drifted");
                        assert!(guard.withdrawn_in_epoch <= cap, "epoch budget exceeded");
                        assert_eq!(guard.lifetime_withdrawn, lifetime + amount as u128);
                    }
                    Err(AofError::VaultGuardLimitExceeded) => {
                        let over_tx = max_tx > 0 && amount > max_tx;
                        let over_epoch = before.checked_add(amount).map_or(false, |n| n > cap);
                        assert!(over_tx || over_epoch,
                            "rejected without a reason: amount={amount} before={before} cap={cap} max_tx={max_tx}");
                        assert_eq!(guard.withdrawn_in_epoch, before, "a rejected charge moved the counter");
                    }
                    Err(AofError::MathOverflow) => {
                        assert!(before.checked_add(amount).is_none(), "overflow reported for a bounded sum");
                    }
                    Err(other) => panic!("unexpected error {other:?}"),
                }
            }
            // A later epoch restores exactly one budget - never two.
            guard.charge(0, 1_000 + epoch).unwrap();
            assert_eq!(guard.withdrawn_in_epoch, 0, "the epoch roll did not reset the budget");
        }
    }

    /// [F-03] Same invariant for the per-epoch issuance budget.
    #[test]
    fn issuance_cap_never_releases_more_than_its_budget() {
        let mut rng = Rng::new(0x103_2026);
        for _ in 0..2_000 {
            let epoch = 1 + rng.below(100_000);
            let cap = rng.extreme();
            if cap == 0 { continue; }
            let mut c = IssuanceCap {
                kind: 3,
                epoch_slots: epoch,
                cap_per_epoch: cap,
                epoch_start_slot: 1_000,
                minted_in_epoch: 0,
                lifetime_minted: 0,
                bump: 0,
            };
            for _ in 0..8 {
                let amount = rng.extreme();
                let slot = 1_000 + rng.below(epoch);
                let before = c.minted_in_epoch;
                match c.charge(3, amount, slot) {
                    Ok(()) => {
                        assert_eq!(c.minted_in_epoch, before + amount);
                        assert!(c.minted_in_epoch <= cap, "epoch budget exceeded");
                    }
                    Err(AofError::IssuanceCapExceeded) => {
                        assert!(before.checked_add(amount).map_or(false, |n| n > cap),
                            "rejected without a reason: amount={amount} before={before} cap={cap}");
                        assert_eq!(c.minted_in_epoch, before, "a rejected charge moved the counter");
                    }
                    Err(AofError::MathOverflow) => {
                        assert!(before.checked_add(amount).is_none(), "overflow reported for a bounded sum");
                    }
                    Err(other) => panic!("unexpected error {other:?}"),
                }
            }
        }
    }

    /// [F-13] The drum/pack/forge odds tables all funnel through
    /// `weighted_pick`; a bucket that does not contain the roll would silently
    /// re-price every prize.
    #[test]
    fn weighted_pick_returns_the_bucket_that_contains_the_roll() {
        let mut rng = Rng::new(0x0D5_2026);
        for _ in 0..2_000 {
            let mut weights = [0u16; 5];
            let mut used = 0u32;
            // 4 x < 2_000 keeps `10_000 - used` positive: the release profile
            // runs with overflow-checks on, so a subtraction wrap would panic.
            for w in weights.iter_mut().take(4) {
                *w = rng.below(2_000) as u16;
                used += *w as u32;
            }
            weights[4] = (10_000 - used) as u16;
            for _ in 0..25 {
                let roll = rng.next_u64();
                let idx = weighted_pick(roll, &weights);
                // u32 on both sides: `weighted_pick` reduces the roll modulo
                // 10_000 and the bucket sums are accumulated as u32.
                let r = (roll % 10_000) as u32;
                let inclusive: u32 = weights[..=idx].iter().map(|w| *w as u32).sum();
                let exclusive: u32 = weights[..idx].iter().map(|w| *w as u32).sum();
                assert!(idx < weights.len(), "index {idx} out of range");
                assert!(inclusive > r, "bucket {idx} does not contain roll {r} (weights {weights:?})");
                assert!(idx == 0 || exclusive <= r, "bucket {idx} starts after roll {r}");
            }
        }
    }

    /// [F-17] Case-insensitive canonicalisation must be total (no junk
    /// canonicalises to a tool) and idempotent, and historical names must not be accepted.
    #[test]
    fn tool_type_canonicalisation_is_total_and_idempotent() {
        let mut rng = Rng::new(0x117_2026);
        for kind in TOOL_KINDS {
            for variant in [kind.to_string(), kind.to_uppercase(), kind.to_lowercase()] {
                let c = canonical_tool_type(&variant).unwrap_or_else(|| panic!("{variant:?} must canonicalise"));
                // `kind` is already a `&str` (arrays iterate by value here);
                // `*kind` would be an unsized `str`.
                assert_eq!(c, kind, "case changed the canonical value of {variant:?}");
                assert!(is_valid_tool_type(c));
                assert_eq!(canonical_tool_type(c), Some(kind), "canonicalisation is not idempotent");
            }
        }
        const ALPHABET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_- ";
        for _ in 0..5_000 {
            let len = 1 + rng.below(12) as usize;
            let junk: String = (0..len)
                .map(|_| ALPHABET[rng.below(ALPHABET.len() as u64) as usize] as char)
                .collect();
            if let Some(c) = canonical_tool_type(&junk) {
                assert!(TOOL_KINDS.contains(&c), "junk {junk:?} canonicalised to {c:?}");
                assert!(junk.eq_ignore_ascii_case(c), "{junk:?} does not match {c:?} case-insensitively");
            }
            assert_eq!(is_valid_tool_type(&junk), canonical_tool_type(&junk).is_some());
        }
    }
}
