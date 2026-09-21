use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod randomness;

pub use state::*;
pub use constants::*;
pub use errors::*;

declare_id!("HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum ResourceKind {
    // Базовые ресурсы (существующие)
    Food,
    Wood,
    Stone,
    // [НОВОЕ] Блок L: хлебная цепочка
    Seeds,
    Wheat,
    Flour,
    Bread,
    Water,
    Coal,
    Meat,
    // Камни
    StoneBlue,
    StonePurple,
    StoneRed,
    // Песок
    SandWhite,
    SandPink,
    SandYellow,
    // Гемы
    GemBlue,
    GemOrange,
    GemWhite,
    GemGreen,
    // Баночки (флаконы)
    FlaskBlue,
    FlaskYellow,
    FlaskGreen,
    FlaskPink,
    FlaskPurple,
    // Особое
    LoveHeart,
    // Utility resource configured in Config (kept last to preserve existing enum discriminants).
    Potato,
}

// =====================================================================
// [КРИТИЧЕСКИЙ ФИКС — см. AUDIT_AND_CHANGES.md]
//
// В присланном коде `Config` создавался как обычный `init`-аккаунт БЕЗ
// `seeds` — то есть НЕ singleton PDA, а произвольный аккаунт от любого
// нового keypair. При этом ни в одной инструкции `config: Account<Config>`
// не проверялся `seeds`-constraint, а `initialize()` можно было вызывать
// сколько угодно раз (ошибка `AlreadyInitialized` в errors.rs объявлена,
// но нигде не проверяется).
//
// Эксплойт: атакующий вызывает initialize() ещё раз со своим кошельком →
// получает СВОЙ собственный Config, где сам является authority. Дальше
// вызывает set_resource_mints (тоже проверяет только has_one=authority на
// ПЕРЕДАННЫЙ config, а не "тот самый" config) на своём config, указывая
// РЕАЛЬНЫЕ адреса FOOD/WOOD/STONE мintов. Затем вызывает mint_resource со
// своим config + своей подписью authority — has_one=authority проходит
// (сам себе авторитет), а CPI mint_to подписывается ГЛОБАЛЬНЫМ `auth` PDA
// (seeds=[AUTH_SEED], НЕ привязан к конкретному config) — то есть
// атакующий получает возможность минтить неограниченное количество
// настоящих игровых ресурсов/инструментов, если mint authority токенов
// изначально указывает на этот `auth` PDA.
//
// Фикс: Config — singleton PDA на seeds=[CONFIG_SEED]. `init` на такой
// seed физически может успешно отработать только один раз (аккаунт уже
// существует при повторном вызове → ошибка). Все инструкции ниже, где
// раньше было `pub config: Account<'info, Config>,` без seeds, теперь
// используют `seeds = [CONFIG_SEED], bump = config.bump` (для mut) или
// `seeds = [CONFIG_SEED], bump` (для читающих без записи, до этого bump
// ещё не обязательно известен клиенту, Anchor пересчитает и сверит).
// =====================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = CONFIG_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: auth PDA, mint authority for resources/tools
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    /// CHECK: vault PDA, holds staked SPL
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    /// Canonical upgradeable-loader ProgramData account for this program. It is
    /// read during the one-time bootstrap to bind Config authority to the actual
    /// deploy/upgrade authority instead of an attacker-chosen signer.
    #[account(
        address = Pubkey::find_program_address(
            &[crate::ID.as_ref()],
            &anchor_lang::solana_program::bpf_loader_upgradeable::id()
        ).0
    )]
    pub program_data: Account<'info, anchor_lang::ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetFees<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetResourceMints<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

// =====================================================================
// [AUDIT F-02] Authority rotation
//
// Not one of the six programs shipped an instruction that changes
// `Config.authority`, so the value captured by the very first `initialize()`
// was permanent: rotating the hot key (or moving to a Squads vault, as
// docs/ISSUANCE_CAPS_DESIGN.md §5 proposes) was impossible without redeploying
// the program and migrating every account. The rotation is deliberately
// two-step — the current authority proposes, the new authority accepts — so a
// typo in the new pubkey cannot lock the program out, and a key that is no
// longer controlled cannot be "rotated into".
// =====================================================================

#[derive(Accounts)]
pub struct SetPendingAuthority<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        constraint = config.pending_authority == new_authority.key() @ AofError::NotPendingAuthority
    )]
    pub config: Account<'info, Config>,
    pub new_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CancelPendingAuthority<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

/// [AUDIT F-27] Mining kill-switch: `MINING_ENABLED` used to exist only as a
/// backend env var, which any player could bypass with a direct RPC call.
#[derive(Accounts)]
pub struct SetMiningEnabled<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
}

// =====================================================================
// [AUDIT F-01] Vault withdrawal guards
// =====================================================================

#[derive(Accounts)]
pub struct InitVaultGuard<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = VAULT_GUARD_SPACE,
        seeds = [VAULT_GUARD_SEED, mint.key().as_ref()],
        bump
    )]
    pub vault_guard: Account<'info, VaultGuard>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetVaultGuard<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [VAULT_GUARD_SEED, mint.key().as_ref()],
        bump = vault_guard.bump
    )]
    pub vault_guard: Account<'info, VaultGuard>,
}

// =====================================================================
// [AUDIT F-03] Global supply ceilings (MaterialMints::max_supply)
// =====================================================================

#[derive(Accounts)]
pub struct SetSupplyCap<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
}

// =====================================================================
// [AUDIT F-16] Collector perk allowlist
// =====================================================================

#[derive(Accounts)]
#[instruction(kind: CollectorKind)]
pub struct RegisterCollectorMint<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = COLLECTOR_ALLOW_SPACE,
        seeds = [COLLECTOR_ALLOW_SEED, mint.key().as_ref()],
        bump
    )]
    pub entry: Account<'info, CollectorAllowEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeCollectorMint<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = authority,
        seeds = [COLLECTOR_ALLOW_SEED, mint.key().as_ref()],
        bump = entry.bump
    )]
    pub entry: Account<'info, CollectorAllowEntry>,
}

// =====================================================================
// [AUDIT F-23] Lottery round recovery
// =====================================================================

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct RefundLotteryRound<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        close = treasury,
        seeds = [LOTTERY_ROUND_SEED, &round_id.to_le_bytes()],
        bump = round.bump
    )]
    pub round: Account<'info, LotteryRound>,
    /// CHECK: configured treasury, receives the stranded pool and the rent.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SetCraftEconomy<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [CRAFT_ECONOMY_SEED], bump = craft_economy.bump)]
    pub craft_economy: Account<'info, CraftEconomy>,
}

#[derive(Accounts)]
pub struct InitCraftEconomy<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = CRAFT_ECONOMY_SPACE,
        seeds = [CRAFT_ECONOMY_SEED],
        bump
    )]
    pub craft_economy: Account<'info, CraftEconomy>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(rarity: Rarity)]
pub struct InitRarityCounter<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = RARITY_COUNTER_SPACE,
        seeds = [RARITY_COUNTER_SEED, &[rarity.to_u8()]],
        bump
    )]
    pub rarity_counter: Account<'info, RarityCounter>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DepositGas<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init_if_needed,
        payer = user,
        space = GASTANK_SPACE,
        seeds = [GASTANK_SEED, user.key().as_ref()],
        bump
    )]
    pub gastank: Account<'info, GasTank>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct WithdrawGas<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [GASTANK_SEED, user.key().as_ref()],
        bump,
        constraint = gastank.owner == user.key() @ AofError::Unauthorized
    )]
    pub gastank: Account<'info, GasTank>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SweepGasFees<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [GASTANK_SEED, gastank.owner.as_ref()], bump)]
    pub gastank: Account<'info, GasTank>,
    /// CHECK: получатель излишка — казна из config.treasury
    #[account(mut, address = config.treasury @ AofError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(kind: ResourceKind, epoch_slots: u64, cap_per_epoch: u64)]
pub struct InitIssuanceCap<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    // `init`, never init_if_needed: re-initialising would reset the counter.
    #[account(
        init,
        payer = authority,
        space = 8 + IssuanceCap::INIT_SPACE,
        seeds = [ISSUANCE_CAP_SEED, &[kind as u8]],
        bump
    )]
    pub issuance_cap: Account<'info, IssuanceCap>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(kind: ResourceKind, epoch_slots: u64, cap_per_epoch: u64)]
pub struct SetIssuanceCap<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [ISSUANCE_CAP_SEED, &[kind as u8]], bump = issuance_cap.bump)]
    pub issuance_cap: Account<'info, IssuanceCap>,
}

#[derive(Accounts)]
#[instruction(kind: ResourceKind, amount: u64)]
pub struct MintResource<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized,
        constraint = !config.paused @ AofError::Paused
    )]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: [БЛОК L] MaterialMints PDA для новых ресурсов (Box — stack overflow fix)
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ AofError::InvalidMint
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    // [НОВОЕ]: withdraw-fee bps по перкам (см. instructions::mint_resource,
    // перенос `pickFeeBps` из Ronin index.js на materialization ресурсов).
    #[account(mut, constraint = treasury_token.mint == mint.key(), constraint = treasury_token.owner == config.treasury)]
    pub treasury_token: Box<Account<'info, TokenAccount>>,
    /// CHECK: если Player ещё не создан (новый игрок, ни разу не майнил),
    /// создаём с нулевыми перками — mint_resource не должен блокироваться
    /// отсутствием профиля.
    #[account(
        init_if_needed, payer = authority, space = PLAYER_SPACE,
        seeds = [PLAYER_SEED, token_account.owner.as_ref()], bump
    )]
    pub player: Box<Account<'info, Player>>,
    /// Per-kind issuance budget. Required: a missing PDA fails account
    /// resolution, so an un-initialised cap can never mean "unlimited".
    #[account(mut, seeds = [ISSUANCE_CAP_SEED, &[kind as u8]], bump = issuance_cap.bump)]
    pub issuance_cap: Box<Account<'info, IssuanceCap>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(kind: ResourceKind, amount: u64, reward_id: [u8; 32])]
pub struct MintResourceOnce<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized,
        constraint = !config.paused @ AofError::Paused
    )]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: [БЛОК L] MaterialMints PDA для новых ресурсов (Box — stack overflow fix)
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ AofError::InvalidMint
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    // [НОВОЕ]: withdraw-fee bps по перкам (см. instructions::mint_resource,
    // перенос `pickFeeBps` из Ronin index.js на materialization ресурсов).
    #[account(mut, constraint = treasury_token.mint == mint.key(), constraint = treasury_token.owner == config.treasury)]
    pub treasury_token: Box<Account<'info, TokenAccount>>,
    /// CHECK: если Player ещё не создан (новый игрок, ни разу не майнил),
    /// создаём с нулевыми перками — mint_resource не должен блокироваться
    /// отсутствием профиля.
    #[account(
        init_if_needed, payer = authority, space = PLAYER_SPACE,
        seeds = [PLAYER_SEED, token_account.owner.as_ref()], bump
    )]
    pub player: Box<Account<'info, Player>>,
    /// Per-kind issuance budget (see MintResource).
    #[account(mut, seeds = [ISSUANCE_CAP_SEED, &[kind as u8]], bump = issuance_cap.bump)]
    pub issuance_cap: Box<Account<'info, IssuanceCap>>,
    pub token_program: Program<'info, Token>,
    #[account(init, payer = authority, space = 8 + RewardReceipt::INIT_SPACE,
        seeds = [b"reward_receipt", reward_id.as_ref()], bump)]
    pub reward_receipt: Box<Account<'info, RewardReceipt>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(kind: ResourceKind, amount: u64)]
pub struct BurnResource<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    /// CHECK: [БЛОК L] MaterialMints PDA для новых ресурсов (Box — stack overflow fix)
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = token_account.mint == mint.key(),
        constraint = token_account.owner == user.key()
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// [AUDIT F-22] `token_account` used to be validated only by `mint` and
/// `amount == 0`; its owner became `ToolData.owner`/`operator`. The intended
/// recipient is now an explicit account and has to own the destination ATA, so
/// the authority can no longer hand a tool to an arbitrary wallet.
#[derive(Accounts)]
#[instruction(tool_type: String, rarity: Rarity)]
pub struct MintTool<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized,
        constraint = !config.paused @ AofError::Paused
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = mint.decimals == 0 @ AofError::InvalidMint,
        constraint = mint.supply == 0 @ AofError::InvalidMint,
        constraint = mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = token_account.mint == mint.key(), constraint = token_account.amount == 0, constraint = token_account.owner == recipient.key() @ AofError::Unauthorized)]
    pub token_account: Account<'info, TokenAccount>,
    /// CHECK: explicit recipient of the minted tool; must own `token_account`.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        space = TOOL_DATA_SPACE,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump
    )]
    pub tool_data: Account<'info, ToolData>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnTool<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = token_account.mint == mint.key(),
        constraint = token_account.owner == user.key(),
        constraint = token_account.amount == 1
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = user,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool_data.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool_data.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool_data.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool_data.staked @ AofError::AlreadyStaked,
        constraint = !tool_data.is_mining @ AofError::AlreadyMining
    )]
    pub tool_data: Account<'info, ToolData>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(tool_type: String, rarity: Rarity, durability: u8)]
pub struct MigrateTool<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    /// Migration signer is the configured core authority. Keeping this
    /// relation in the account constraints avoids a stale hardcoded key.
    #[account(mut, constraint = migration_authority.key() == config.authority @ AofError::InvalidMigrationAuthority)]
    pub migration_authority: Signer<'info>,
    pub authority: Signer<'info>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    /// CHECK: vault PDA
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = mint.decimals == 0 @ AofError::InvalidMint,
        constraint = mint.supply == 0 @ AofError::InvalidMint,
        constraint = mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = vault_token_account.mint == mint.key(), constraint = vault_token_account.owner == vault.key(), constraint = vault_token_account.amount == 0)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = migration_authority,
        space = TOOL_DATA_SPACE,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump
    )]
    pub tool_data: Account<'info, ToolData>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tool_type: String, rarity: Rarity)]
pub struct Craft<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized,
        constraint = !config.paused @ AofError::Paused
    )]
    pub config: Box<Account<'info, Config>>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [GASTANK_SEED, user.key().as_ref()],
        bump,
        constraint = gastank.owner == user.key() @ AofError::Unauthorized,
    )]
    pub gastank: Box<Account<'info, GasTank>>,
    #[account(
        mut,
        seeds = [TOOL_SEED, prev_mint.key().as_ref()],
        bump,
        constraint = prev_tool.mint == prev_mint.key() @ AofError::InvalidMint,
        constraint = prev_tool.owner == user.key() @ AofError::NotToolOwner,
        constraint = prev_tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = !prev_tool.staked @ AofError::NotActive,
        constraint = !prev_tool.is_mining @ AofError::NotActive,
        constraint = prev_tool.rarity.to_u8() == rarity.to_u8().checked_sub(1).ok_or(AofError::InvalidRarityForCraft)? @ AofError::InvalidRarityForCraft,
    )]
    pub prev_tool: Box<Account<'info, ToolData>>,
    #[account(mut)]
    pub prev_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = prev_token.mint == prev_mint.key(), constraint = prev_token.owner == user.key(), constraint = prev_token.amount == 1)]
    pub prev_token: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = new_mint.decimals == 0 @ AofError::InvalidMint,
        constraint = new_mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint,
        constraint = new_mint.supply == 0 @ AofError::InvalidMint
    )]
    pub new_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = new_token.mint == new_mint.key(), constraint = new_token.owner == user.key(), constraint = new_token.amount == 0)]
    pub new_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = TOOL_DATA_SPACE,
        seeds = [TOOL_SEED, new_mint.key().as_ref()],
        bump,
    )]
    pub new_tool_data: Box<Account<'info, ToolData>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    #[account(mut, seeds = [RARITY_COUNTER_SEED, &[rarity.to_u8()]], bump)]
    pub rarity_counter: Box<Account<'info, RarityCounter>>,
    #[account(seeds = [CRAFT_ECONOMY_SEED], bump = craft_economy.bump)]
    pub craft_economy: Box<Account<'info, CraftEconomy>>,
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Box<Account<'info, TokenAccount>>,
    // ===== [НОВОЕ] FOOD / SEEDS / WATER / POTATO =====
    #[account(mut, address = config.food_mint)]
    pub food_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_food.mint == food_mint.key(), constraint = user_food.owner == user.key())]
    pub user_food: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.seeds_mint)]
    pub seeds_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_seeds.mint == seeds_mint.key(), constraint = user_seeds.owner == user.key())]
    pub user_seeds: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.water_mint)]
    pub water_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_water.mint == water_mint.key(), constraint = user_water.owner == user.key())]
    pub user_water: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.potato_mint)]
    pub potato_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_potato.mint == potato_mint.key(), constraint = user_potato.owner == user.key())]
    pub user_potato: Box<Account<'info, TokenAccount>>,
    // ===== [НОВОЕ] SKR для скидки 15% на POTATO =====
    #[account(mut)]
    pub skr_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_skr.mint == skr_mint.key(), constraint = user_skr.owner == user.key())]
    pub user_skr: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// [AUDIT F-09] `reroll` (burn 2 tools of rarity R -> mint 1 of R+1) cost only
/// 0.06 SOL of gas: no resources, no `rarity_counter` movement. Sixteen Common
/// tools and 0.90 SOL therefore produced a Legendary, while the craft path for
/// the same result costs 2 750 WOOD / 2 120 STONE / 1 430 FOOD / 710 SEEDS /
/// 540 WATER / 630 POTATO (and grows with every craft). Reroll now burns the
/// same bundle the craft curve charges for the target rarity and increments the
/// rarity counter, so the two progression tracks finally share one sink.
#[derive(Accounts)]
#[instruction(new_type: String)]
pub struct Reroll<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [GASTANK_SEED, user.key().as_ref()],
        bump,
        constraint = gastank.owner == user.key() @ AofError::Unauthorized,
    )]
    pub gastank: Box<Account<'info, GasTank>>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint_a.key().as_ref()],
        bump,
        constraint = tool_a.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool_a.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool_a.staked @ AofError::AlreadyStaked,
        constraint = !tool_a.is_mining @ AofError::AlreadyMining,
        constraint = tool_a.rarity != Rarity::Legendary @ AofError::CannotRerollLegendary,
    )]
    pub tool_a: Box<Account<'info, ToolData>>,
    #[account(mut)]
    pub mint_a: Box<Account<'info, Mint>>,
    #[account(mut, constraint = token_a.mint == mint_a.key(), constraint = token_a.owner == user.key(), constraint = token_a.amount == 1)]
    pub token_a: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint_b.key().as_ref()],
        bump,
        constraint = tool_b.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool_b.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool_b.staked @ AofError::AlreadyStaked,
        constraint = !tool_b.is_mining @ AofError::AlreadyMining,
        constraint = tool_b.rarity == tool_a.rarity @ AofError::RerollMismatchedRarity,
    )]
    pub tool_b: Box<Account<'info, ToolData>>,
    #[account(mut)]
    pub mint_b: Box<Account<'info, Mint>>,
    #[account(mut, constraint = token_b.mint == mint_b.key(), constraint = token_b.owner == user.key(), constraint = token_b.amount == 1)]
    pub token_b: Box<Account<'info, TokenAccount>>,
    // [AUDIT F-22] `Craft` and `MintTool` both require decimals == 0 here; the
    // reroll path did not, so a reroll onto a 9-decimal mint would create a
    // ToolData claiming ownership of 1 atomic unit of a fungible token.
    #[account(
        mut,
        constraint = new_mint.decimals == 0 @ AofError::InvalidMint,
        constraint = new_mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint,
        constraint = new_mint.supply == 0 @ AofError::InvalidMint
    )]
    pub new_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = new_token.mint == new_mint.key(), constraint = new_token.owner == user.key(), constraint = new_token.amount == 0)]
    pub new_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = TOOL_DATA_SPACE,
        seeds = [TOOL_SEED, new_mint.key().as_ref()],
        bump,
    )]
    pub new_tool_data: Box<Account<'info, ToolData>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    // ===== [AUDIT F-09] resource sink + bonding curve counter =====
    #[account(
        mut,
        seeds = [RARITY_COUNTER_SEED, &[tool_a.rarity.to_u8().saturating_add(1)]],
        bump
    )]
    pub rarity_counter: Box<Account<'info, RarityCounter>>,
    #[account(seeds = [CRAFT_ECONOMY_SEED], bump = craft_economy.bump)]
    pub craft_economy: Box<Account<'info, CraftEconomy>>,
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.food_mint)]
    pub food_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_food.mint == food_mint.key(), constraint = user_food.owner == user.key())]
    pub user_food: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.seeds_mint)]
    pub seeds_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_seeds.mint == seeds_mint.key(), constraint = user_seeds.owner == user.key())]
    pub user_seeds: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.water_mint)]
    pub water_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_water.mint == water_mint.key(), constraint = user_water.owner == user.key())]
    pub user_water: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.potato_mint)]
    pub potato_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_potato.mint == potato_mint.key(), constraint = user_potato.owner == user.key())]
    pub user_potato: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lock_seconds: i64)]
pub struct Stake<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool.staked @ AofError::AlreadyStaked,
        constraint = !tool.is_mining @ AofError::AlreadyMining,
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = user_token.mint == mint.key(),
        constraint = user_token.owner == user.key(),
        constraint = user_token.amount == 1
    )]
    pub user_token: Account<'info, TokenAccount>,
    /// CHECK: vault PDA
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut, constraint = vault_token.owner == vault.key(), constraint = vault_token.mint == mint.key())]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = tool.staked @ AofError::NotStaked,
        constraint = !tool.is_mining @ AofError::AlreadyMining,
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = user_token.mint == mint.key(), constraint = user_token.owner == user.key())]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [GASTANK_SEED, user.key().as_ref()],
        bump,
        constraint = gastank.owner == user.key() @ AofError::Unauthorized
    )]
    pub gastank: Account<'info, GasTank>,
    /// CHECK: vault PDA
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut, constraint = vault_token.owner == vault.key(), constraint = vault_token.mint == mint.key())]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// [РАСШИРЕНО] добавлен player (см. instructions::start_mining — впервые
/// подключает уже объявленный, но нигде не использовавшийся тип Player)
#[derive(Accounts)]
#[instruction(hours: u8)]
pub struct StartMining<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool.is_mining @ AofError::AlreadyMining,
        constraint = tool.staked @ AofError::InvalidStakeState,
    )]
    pub tool: Account<'info, ToolData>,
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        space = PLAYER_SPACE,
        seeds = [PLAYER_SEED, user.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CollectMining<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = tool.is_mining @ AofError::NotMining,
        constraint = tool.staked @ AofError::InvalidStakeState,
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, user.key().as_ref()],
        bump,
        constraint = player.owner == user.key() @ AofError::Unauthorized,
    )]
    pub player: Account<'info, Player>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    /// CHECK: auth PDA, canonical mint authority for resource emissions.
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    #[account(mut)]
    pub payout_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = payout_token.mint == payout_mint.key(),
        constraint = payout_token.owner == user.key()
    )]
    pub payout_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u8)]
pub struct Repair<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Account<'info, TokenAccount>,
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnNft<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = user,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool.staked @ AofError::AlreadyStaked,
        constraint = !tool.is_mining @ AofError::AlreadyMining,
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut, constraint = token_account.mint == mint.key(), constraint = token_account.owner == user.key(), constraint = token_account.amount == 1)]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// [AUDIT F-01] `pay_out` used to be "move `amount` of `mint` from the vault to
/// any token account", with the recipient validated only by
/// `user_token.mint == mint`. A leaked authority key — the backend holds it in
/// process, see F-02 — could therefore sweep the whole vault, staked NFTs
/// included, and `ToolData.staked` would still say the tool was staked, so the
/// real owner could neither unstake nor prove the theft.
///
/// Three independent brakes now apply, all fail-closed:
///  1. the mint must be a configured *resource* mint, so no staked tool NFT can
///     ever leave the vault through this path;
///  2. the recipient must be an existing `Player` PDA, which only the authority
///     can create — a thief cannot drain to a freshly generated wallet;
///  3. the amount is charged against a per-mint `VaultGuard` budget
///     (per-transaction ceiling + per-epoch cap), so even a fully compromised
///     key is bounded by the guard instead of by the vault balance.
#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct PayOut<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized,
        constraint = !config.paused @ AofError::Paused
    )]
    pub config: Box<Account<'info, Config>>,
    pub authority: Signer<'info>,
    /// CHECK: vault PDA
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = vault_token.mint == mint.key(), constraint = vault_token.owner == vault.key())]
    pub vault_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = user_token.mint == mint.key())]
    pub user_token: Box<Account<'info, TokenAccount>>,
    /// Recipient must be a known player: blocks withdrawals to throwaway wallets.
    #[account(
        seeds = [PLAYER_SEED, user_token.owner.as_ref()], bump,
        constraint = player.owner == user_token.owner @ AofError::Unauthorized
    )]
    pub player: Box<Account<'info, Player>>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut, seeds = [VAULT_GUARD_SEED, mint.key().as_ref()], bump = vault_guard.bump)]
    pub vault_guard: Box<Account<'info, VaultGuard>>,
    pub token_program: Program<'info, Token>,
}

// =====================================================================
// [НОВОЕ] Коллекционеры (Historian/Medallion) и палатка — см. AUDIT_V3.md
// =====================================================================

#[derive(Accounts)]
#[instruction(kind: CollectorKind)]
pub struct CollectorStake<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = user_token.mint == mint.key(),
        constraint = user_token.owner == user.key(),
        constraint = user_token.amount == 1
    )]
    pub user_token: Account<'info, TokenAccount>,
    /// CHECK: vault PDA (общий с обычным стейком инструментов)
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut, constraint = vault_token.owner == vault.key(), constraint = vault_token.mint == mint.key())]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = user,
        space = STAKED_COLLECTOR_SPACE,
        seeds = [COLLECTOR_SEED, mint.key().as_ref()],
        bump
    )]
    pub staked_collector: Account<'info, StakedCollector>,
    /// [AUDIT F-16] Allowlist entry created by `register_collector_mint`. The
    /// perk is granted only for mints the authority explicitly registered, and
    /// the entry carries the `CollectorKind`, so the caller cannot claim
    /// Historian perks with a Medallion NFT.
    #[account(
        seeds = [COLLECTOR_ALLOW_SEED, mint.key().as_ref()],
        bump = collector_allow.bump,
        constraint = collector_allow.kind == kind @ AofError::CollectorMintNotAllowed
    )]
    pub collector_allow: Account<'info, CollectorAllowEntry>,
    #[account(
        init_if_needed,
        payer = user,
        space = PLAYER_SPACE,
        seeds = [PLAYER_SEED, user.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CollectorUnstake<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = user_token.mint == mint.key(), constraint = user_token.owner == user.key())]
    pub user_token: Account<'info, TokenAccount>,
    /// CHECK: vault PDA
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut, constraint = vault_token.owner == vault.key(), constraint = vault_token.mint == mint.key())]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = user,
        seeds = [COLLECTOR_SEED, mint.key().as_ref()],
        bump,
        constraint = staked_collector.owner == user.key() @ AofError::NotCollectorOwner,
    )]
    pub staked_collector: Account<'info, StakedCollector>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, user.key().as_ref()],
        bump,
        constraint = player.owner == user.key() @ AofError::Unauthorized,
    )]
    pub player: Account<'info, Player>,
    #[account(
        mut,
        seeds = [GASTANK_SEED, user.key().as_ref()],
        bump,
        constraint = gastank.owner == user.key() @ AofError::Unauthorized
    )]
    pub gastank: Account<'info, GasTank>,
    pub token_program: Program<'info, Token>,
}

/// [НОВОЕ] Authority-only ручка для Player.villagers/has_tent — сами
/// slots/boost остаются в конфиге бэкенда (см. AUDIT_V3.md).
#[derive(Accounts)]
pub struct AdjustPlayerCapacity<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, player.owner.as_ref()],
        bump,
    )]
    pub player: Account<'info, Player>,
}


// =====================================================================
// [НОВОЕ] Полная реализация TOR v4 — Accounts-структуры.
// SLOT_HASHES: сисвар для честного commit-reveal (см. randomness.rs).
// =====================================================================

use crate::randomness::SLOT_HASHES_ID;

// ----- Паки -----

#[derive(Accounts)]
#[instruction(pack_type: u8)]
pub struct InitPackConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init, payer = authority, space = PACK_CONFIG_SPACE,
        seeds = [PACK_CONFIG_SEED, &[pack_type]], bump
    )]
    pub pack_config: Account<'info, PackConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetPackConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PACK_CONFIG_SEED, &[pack_config.pack_type]], bump = pack_config.bump)]
    pub pack_config: Account<'info, PackConfig>,
}

#[derive(Accounts)]
#[instruction(pack_type: PackType, commit_hash: [u8;32])]
pub struct PackOpenCommit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [PACK_CONFIG_SEED, &[pack_type.to_u8()]], bump = pack_config.bump)]
    pub pack_config: Account<'info, PackConfig>,
    /// CHECK: auth PDA is the only supported mint authority for tools.
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    /// Mint is created by the caller but must be an unused zero-decimal tool mint
    /// controlled by the program authority PDA.
    #[account(
        constraint = mint.decimals == 0 @ AofError::InvalidMint,
        constraint = mint.supply == 0 @ AofError::InvalidMint,
        constraint = mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init, payer = user, space = PACK_COMMIT_SPACE,
        seeds = [PACK_COMMIT_SEED, mint.key().as_ref()], bump
    )]
    pub pack_commit: Account<'info, PackCommit>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PackOpenReveal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        close = user,
        seeds = [PACK_COMMIT_SEED, mint.key().as_ref()],
        bump,
        constraint = pack_commit.mint == mint.key() @ AofError::InvalidMint
    )]
    pub pack_commit: Account<'info, PackCommit>,
    /// CHECK: получатель — тот же user, что делал commit; закрываем ренту ему
    #[account(mut, address = pack_commit.user)]
    pub user: UncheckedAccount<'info>,
    /// CHECK: казна получает escrow только здесь, когда исход уже известен.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(seeds = [PACK_CONFIG_SEED, &[pack_commit.pack_type]], bump = pack_config.bump)]
    pub pack_config: Account<'info, PackConfig>,
    #[account(
        mut,
        constraint = mint.decimals == 0 @ AofError::InvalidMint,
        constraint = mint.supply == 0 @ AofError::InvalidMint,
        constraint = mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = user_token.mint == mint.key(),
        constraint = user_token.owner == user.key(),
        constraint = user_token.amount == 0
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        init, payer = authority, space = TOOL_DATA_SPACE,
        seeds = [TOOL_SEED, mint.key().as_ref()], bump
    )]
    pub tool_data: Account<'info, ToolData>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    /// CHECK: sysvar SlotHashes
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Возврат просроченного pack-коммита. Permissionless: любой может вызвать,
/// деньги всегда идут только `pack_commit.user`. Разрешён строго после того,
/// как хэш слота коммита гарантированно выпал из SlotHashes, поэтому
/// `reveal` и `expire` для одного коммита взаимоисключающи.
#[derive(Accounts)]
pub struct PackOpenExpire<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        close = user,
        seeds = [PACK_COMMIT_SEED, mint.key().as_ref()],
        bump,
        constraint = pack_commit.mint == mint.key() @ AofError::InvalidMint,
        constraint = !pack_commit.revealed @ AofError::CommitMismatch
    )]
    pub pack_commit: Account<'info, PackCommit>,
    /// CHECK: получатель escrow + ренты — тот же user, что делал commit.
    #[account(mut, address = pack_commit.user)]
    pub user: UncheckedAccount<'info>,
    /// CHECK: только как seed pack_commit; supply/authority не важны для возврата.
    pub mint: UncheckedAccount<'info>,
}

// ----- Reroll (честный) -----

#[derive(Accounts)]
pub struct InitRerollConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = REROLL_CONFIG_SPACE, seeds = [REROLL_CONFIG_SEED], bump)]
    pub reroll_config: Account<'info, RerollConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetRerollConfig<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [REROLL_CONFIG_SEED], bump = reroll_config.bump)]
    pub reroll_config: Account<'info, RerollConfig>,
}

#[derive(Accounts)]
#[instruction(commit_hash: [u8;32])]
pub struct RerollRandomCommit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [GASTANK_SEED, user.key().as_ref()], bump, constraint = gastank.owner == user.key() @ AofError::Unauthorized)]
    pub gastank: Account<'info, GasTank>,
    #[account(
        mut, seeds = [TOOL_SEED, burn_mint.key().as_ref()], bump,
        close = user,
        constraint = burn_tool.owner == user.key() @ AofError::NotToolOwner,
        constraint = burn_tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = !burn_tool.staked @ AofError::AlreadyStaked,
        constraint = !burn_tool.is_mining @ AofError::AlreadyMining,
    )]
    pub burn_tool: Account<'info, ToolData>,
    #[account(mut)]
    pub burn_mint: Account<'info, Mint>,
    #[account(mut, constraint = burn_token.mint == burn_mint.key(), constraint = burn_token.owner == user.key(), constraint = burn_token.amount == 1)]
    pub burn_token: Account<'info, TokenAccount>,
    /// CHECK: mint будущего инструмента, создаётся клиентом заранее
    pub new_mint: Account<'info, Mint>,
    #[account(
        init, payer = user, space = REROLL_COMMIT_SPACE,
        seeds = [REROLL_COMMIT_SEED, new_mint.key().as_ref()], bump
    )]
    pub reroll_commit: Account<'info, RerollCommit>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RerollRandomReveal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [REROLL_CONFIG_SEED], bump = reroll_config.bump)]
    pub reroll_config: Account<'info, RerollConfig>,
    #[account(mut, close = payer, seeds = [REROLL_COMMIT_SEED, new_mint.key().as_ref()], bump)]
    pub reroll_commit: Account<'info, RerollCommit>,
    /// CHECK: получатель закрытой ренты коммита — тот же user
    #[account(mut, address = reroll_commit.user)]
    pub payer: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = new_mint.decimals == 0 @ AofError::InvalidMint,
        constraint = new_mint.mint_authority == anchor_lang::solana_program::program_option::COption::Some(auth.key()) @ AofError::InvalidMint,
        constraint = new_mint.supply == 0 @ AofError::InvalidMint
    )]
    pub new_mint: Account<'info, Mint>,
    #[account(mut, constraint = new_token.mint == new_mint.key(), constraint = new_token.owner == payer.key(), constraint = new_token.amount == 0)]
    pub new_token: Account<'info, TokenAccount>,
    #[account(init, payer = authority, space = TOOL_DATA_SPACE, seeds = [TOOL_SEED, new_mint.key().as_ref()], bump)]
    pub new_tool_data: Account<'info, ToolData>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    /// CHECK: sysvar SlotHashes
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ----- Exploration -----

// SBPF ограничивает стековый кадр 4096 байтами; Anchor-сгенерированная
// `try_accounts` десериализует каждый типизированный аккаунт в стек, и верификатор
// отклонял программу целиком (CI run 34908007614):
//   Function <aof_core::StartExplorationCommit as Accounts<..>>::try_accounts overflows the maximum
//   allowed frame space ... Estimated function frame size: 5824 bytes.
// `Box<..>` уводит данные аккаунтов в кучу (в стеке остаётся 8-байтный указатель),
// что уже используется в этом файле для других инструкций. Состав аккаунтов, их
// порядок, ограничения и IDL не меняются.
#[derive(Accounts)]
#[instruction(commit_hash: [u8;32])]
pub struct StartExplorationCommit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init_if_needed, payer = user, space = EXPLORATION_STATE_SPACE,
        seeds = [EXPLORATION_STATE_SEED, user.key().as_ref()], bump,
        constraint = (exploration_state.owner == Pubkey::default() || exploration_state.owner == user.key()) @ AofError::Unauthorized
    )]
    pub exploration_state: Box<Account<'info, ExplorationState>>,
    pub tool_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [TOOL_SEED, tool_mint.key().as_ref()], bump,
        constraint = tool.owner == user.key() @ AofError::NotToolOwner,
        constraint = tool.operator == user.key() @ AofError::NotToolOperator,
        constraint = tool.tool_type == "Bow" @ AofError::InvalidToolType,
        constraint = !tool.is_mining @ AofError::ToolBusy
    )]
    pub tool: Box<Account<'info, ToolData>>,
    #[account(
        init, payer = user, space = EXPLORATION_COMMIT_SPACE,
        seeds = [EXPLORATION_COMMIT_SEED, tool_mint.key().as_ref()], bump
    )]
    pub exploration_commit: Box<Account<'info, ExplorationCommit>>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.food_mint)]
    pub food_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_food.mint == food_mint.key(), constraint = user_food.owner == user.key())]
    pub user_food: Box<Account<'info, TokenAccount>>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Box<Account<'info, TokenAccount>>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Box<Account<'info, TokenAccount>>,
    // [НОВОЕ] MEAT для исследования — только официальный MaterialMints mint.
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.meat)]
    pub meat_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_meat.mint == meat_mint.key(), constraint = user_meat.owner == user.key())]
    pub user_meat: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExploreReveal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [EXPLORATION_STATE_SEED, exploration_commit.user.as_ref()],
        bump,
        constraint = exploration_state.owner == exploration_commit.user @ AofError::Unauthorized
    )]
    pub exploration_state: Account<'info, ExplorationState>,
    #[account(mut, close = payer, seeds = [EXPLORATION_COMMIT_SEED, exploration_commit.tool_mint.as_ref()], bump)]
    pub exploration_commit: Account<'info, ExplorationCommit>,
    /// CHECK: получатель ренты — user, делавший commit
    #[account(mut, address = exploration_commit.user)]
    pub payer: UncheckedAccount<'info>,
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == payer.key())]
    pub user_wood: Account<'info, TokenAccount>,
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == payer.key())]
    pub user_stone: Account<'info, TokenAccount>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    /// CHECK: sysvar SlotHashes
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpgradeExplorationTier<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [EXPLORATION_STATE_SEED, user.key().as_ref()], bump, constraint = exploration_state.owner == user.key() @ AofError::Unauthorized)]
    pub exploration_state: Account<'info, ExplorationState>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Account<'info, TokenAccount>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Account<'info, TokenAccount>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.food_mint)]
    pub food_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_food.mint == food_mint.key(), constraint = user_food.owner == user.key())]
    pub user_food: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ----- Рефералы -----

#[derive(Accounts)]
pub struct ReferralBindCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub referred: Signer<'info>,
    /// CHECK: реферер — просто получатель ссылки, не подписывает
    #[account(constraint = referrer.key() != referred.key() @ AofError::InvalidReferral)]
    pub referrer: UncheckedAccount<'info>,
    #[account(seeds = [PLAYER_SEED, referrer.key().as_ref()], bump)]
    pub referrer_player: Account<'info, Player>,
    #[account(
        init_if_needed, payer = referred, space = REFERRER_STATS_SPACE,
        seeds = [REFERRER_STATS_SEED, referrer.key().as_ref()], bump
    )]
    pub referrer_stats: Account<'info, ReferrerStats>,
    #[account(
        init, payer = referred, space = REFERRAL_LINK_SPACE,
        seeds = [REFERRAL_LINK_SEED, referred.key().as_ref()], bump
    )]
    pub referral_link: Account<'info, ReferralLink>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReferralUpgradeCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [REFERRAL_LINK_SEED, user.key().as_ref()], bump, constraint = referral_link.referred == user.key() @ AofError::Unauthorized)]
    pub referral_link: Account<'info, ReferralLink>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Account<'info, TokenAccount>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Account<'info, TokenAccount>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.food_mint)]
    pub food_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_food.mint == food_mint.key(), constraint = user_food.owner == user.key())]
    pub user_food: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// [AUDIT F-01] Same three brakes as `PayOut`. The referral split is a split of
/// one authority-decided `amount`, not extra issuance (see referral.rs), but it
/// still moved vault funds, so it gets the identical guard.
#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct PayOutWithReferral<'info> {
    #[account(
        seeds = [CONFIG_SEED], bump = config.bump,
        has_one = authority @ AofError::Unauthorized,
        constraint = !config.paused @ AofError::Paused
    )]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    /// CHECK: vault PDA
    #[account(seeds = [VAULT_SEED], bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = vault_token.mint == mint.key(), constraint = vault_token.owner == vault.key())]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(mut, constraint = user_token.mint == mint.key(), constraint = user_token.owner == referral_link.referred @ AofError::Unauthorized)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(seeds = [REFERRAL_LINK_SEED, referral_link.referred.as_ref()], bump)]
    pub referral_link: Account<'info, ReferralLink>,
    #[account(mut, constraint = referrer_token.mint == mint.key(), constraint = referrer_token.owner == referral_link.referrer)]
    pub referrer_token: Account<'info, TokenAccount>,
    #[account(
        seeds = [PLAYER_SEED, referral_link.referred.as_ref()], bump,
        constraint = player.owner == referral_link.referred @ AofError::Unauthorized
    )]
    pub player: Account<'info, Player>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut, seeds = [VAULT_GUARD_SEED, mint.key().as_ref()], bump = vault_guard.bump)]
    pub vault_guard: Account<'info, VaultGuard>,
    pub token_program: Program<'info, Token>,
}

// ----- Кузница риска (Enchant) -----

// SBPF ограничивает стековый кадр 4096 байтами; Anchor-сгенерированная
// `try_accounts` десериализует каждый типизированный аккаунт в стек, и верификатор
// отклонял программу целиком (CI run 34908007614):
//   Function <aof_core::ForgeAttemptCommit as Accounts<..>>::try_accounts overflows the maximum
//   allowed frame space ... Estimated function frame size: 4544 bytes.
// `Box<..>` уводит данные аккаунтов в кучу (в стеке остаётся 8-байтный указатель),
// что уже используется в этом файле для других инструкций. Состав аккаунтов, их
// порядок, ограничения и IDL не меняются.
#[derive(Accounts)]
#[instruction(slot_type: u8, commit_hash: [u8;32])]
pub struct ForgeAttemptCommit<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [TOOL_SEED, tool_mint.key().as_ref()], bump, constraint = tool.owner == user.key() @ AofError::NotToolOwner)]
    pub tool: Box<Account<'info, ToolData>>,
    pub tool_mint: Box<Account<'info, Mint>>,
    #[account(
        init_if_needed, payer = user, space = ENCHANT_SLOT_SPACE,
        seeds = [ENCHANT_SLOT_SEED, tool_mint.key().as_ref(), &[slot_type]], bump
    )]
    pub enchant_slot: Box<Account<'info, EnchantSlot>>,
    #[account(
        init, payer = user, space = FORGE_COMMIT_SPACE,
        seeds = [FORGE_COMMIT_SEED, tool_mint.key().as_ref(), &[slot_type]], bump
    )]
    pub forge_commit: Box<Account<'info, ForgeCommit>>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Box<Account<'info, TokenAccount>>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ForgeAttemptReveal<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [ENCHANT_SLOT_SEED, forge_commit.tool_mint.as_ref(), &[forge_commit.slot_type]], bump)]
    pub enchant_slot: Account<'info, EnchantSlot>,
    #[account(mut, close = payer, seeds = [FORGE_COMMIT_SEED, forge_commit.tool_mint.as_ref(), &[forge_commit.slot_type]], bump)]
    pub forge_commit: Account<'info, ForgeCommit>,
    /// CHECK: получатель ренты — user, делавший commit
    #[account(mut, address = forge_commit.user)]
    pub payer: UncheckedAccount<'info>,
    /// CHECK: казна получает escrow-fee только здесь, когда исход известен.
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: sysvar SlotHashes
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

/// Возврат просроченного forge-коммита: сожжённые wood/stone минтятся обратно
/// (auth PDA — mint authority ресурсов), SOL-fee из escrow и рента идут user.
/// Permissionless; разрешён только после окна SlotHashes, так что не может
/// сработать параллельно с валидным reveal.
#[derive(Accounts)]
pub struct ForgeAttemptExpire<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(
        mut,
        close = user,
        seeds = [FORGE_COMMIT_SEED, forge_commit.tool_mint.as_ref(), &[forge_commit.slot_type]],
        bump
    )]
    pub forge_commit: Box<Account<'info, ForgeCommit>>,
    /// CHECK: получатель escrow + ренты — тот же user, что делал commit.
    #[account(mut, address = forge_commit.user)]
    pub user: UncheckedAccount<'info>,
    /// CHECK: auth PDA — mint authority ресурсов.
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == forge_commit.user @ AofError::Unauthorized)]
    pub user_wood: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == forge_commit.user @ AofError::Unauthorized)]
    pub user_stone: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

// ----- Лотерея -----

#[derive(Accounts)]
#[instruction(round_id: u64)]
pub struct InitLotteryRound<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = LOTTERY_ROUND_SPACE, seeds = [LOTTERY_ROUND_SEED, &round_id.to_le_bytes()], bump)]
    pub lottery_round: Account<'info, LotteryRound>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyLotteryTicket<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: казна (30% с билета)
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, seeds = [LOTTERY_ROUND_SEED, &lottery_round.round_id.to_le_bytes()], bump = lottery_round.bump)]
    pub lottery_round: Account<'info, LotteryRound>,
    #[account(
        init, payer = buyer, space = LOTTERY_TICKET_SPACE,
        seeds = [LOTTERY_TICKET_SEED, &lottery_round.round_id.to_le_bytes(), &lottery_round.tickets_sold.to_le_bytes()],
        bump
    )]
    pub lottery_ticket: Account<'info, LotteryTicket>,
    /// [AUDIT] Per-wallet ticket counter enforcing `LOTTERY_MAX_TICKETS_PER_DAY`
    /// on-chain instead of trusting the backend's off-chain limit.
    #[account(
        init_if_needed,
        payer = buyer,
        space = LOTTERY_TICKET_COUNTER_SPACE,
        seeds = [LOTTERY_TICKET_SEED, b"count", &lottery_round.round_id.to_le_bytes(), buyer.key().as_ref()],
        bump
    )]
    pub ticket_counter: Account<'info, LotteryTicketCounter>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DrawLottery<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [LOTTERY_ROUND_SEED, &lottery_round.round_id.to_le_bytes()], bump = lottery_round.bump)]
    pub lottery_round: Account<'info, LotteryRound>,
    /// CHECK: sysvar SlotHashes
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CommitLotteryDraw<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(mut, seeds = [LOTTERY_ROUND_SEED, &lottery_round.round_id.to_le_bytes()], bump = lottery_round.bump)]
    pub lottery_round: Account<'info, LotteryRound>,
}

#[derive(Accounts)]
pub struct ClaimLotteryPrize<'info> {
    /// [AUDIT F-19] the emergency pause must also stop prize payouts.
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [LOTTERY_ROUND_SEED, &lottery_round.round_id.to_le_bytes()], bump = lottery_round.bump)]
    pub lottery_round: Account<'info, LotteryRound>,
    #[account(
        seeds = [LOTTERY_TICKET_SEED, &lottery_round.round_id.to_le_bytes(), &lottery_ticket.ticket_number.to_le_bytes()],
        bump,
        constraint = lottery_ticket.buyer == winner.key() @ AofError::Unauthorized
    )]
    pub lottery_ticket: Account<'info, LotteryTicket>,
    #[account(mut)]
    pub winner: Signer<'info>,
}

// ----- Рынок: фикс-листинг -----

#[derive(Accounts)]
#[instruction(price_lamports: u64)]
pub struct MarketplaceList<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.owner == seller.key() @ AofError::NotToolOwner,
        constraint = tool.operator == seller.key() @ AofError::NotToolOperator,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut, constraint = seller_token.mint == mint.key(), constraint = seller_token.owner == seller.key(), constraint = seller_token.amount == 1)]
    pub seller_token: Account<'info, TokenAccount>,
    #[account(
        init, payer = seller, space = LISTING_SPACE,
        seeds = [LISTING_SEED, mint.key().as_ref()], bump
    )]
    pub listing: Account<'info, Listing>,
    #[account(mut, constraint = listing_vault.owner == listing.key(), constraint = listing_vault.mint == mint.key())]
    pub listing_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarketplaceBuy<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: продавец, получатель оплаты
    #[account(mut, address = listing.seller)]
    pub seller: UncheckedAccount<'info>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == tool.owner @ AofError::NotActive,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    /// [AUDIT F-24] The listing PDA and its escrow ATA are closed on sale, so
    /// the rent comes back and the NFT can be listed again by its new owner.
    #[account(
        mut,
        close = seller,
        seeds = [LISTING_SEED, mint.key().as_ref()],
        bump,
        constraint = listing.mint == mint.key() @ AofError::InvalidMint
    )]
    pub listing: Account<'info, Listing>,
    #[account(mut, constraint = listing_vault.owner == listing.key(), constraint = listing_vault.mint == mint.key())]
    pub listing_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = buyer_token.mint == mint.key(), constraint = buyer_token.owner == buyer.key())]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarketplaceCancel<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// [AUDIT F-10/F-24] Closing here is what makes relisting possible.
    #[account(mut, close = seller, seeds = [LISTING_SEED, mint.key().as_ref()], bump, constraint = listing.seller == seller.key() @ AofError::Unauthorized)]
    pub listing: Account<'info, Listing>,
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut, constraint = listing_vault.owner == listing.key(), constraint = listing_vault.mint == mint.key())]
    pub listing_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = seller_token.mint == mint.key(), constraint = seller_token.owner == seller.key())]
    pub seller_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ----- Аукцион -----

#[derive(Accounts)]
#[instruction(min_bid: u64, duration_seconds: i64)]
pub struct AuctionCreateCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.owner == seller.key() @ AofError::NotToolOwner,
        constraint = tool.operator == seller.key() @ AofError::NotToolOperator,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    #[account(mut, constraint = seller_token.mint == mint.key(), constraint = seller_token.owner == seller.key(), constraint = seller_token.amount == 1)]
    pub seller_token: Account<'info, TokenAccount>,
    /// [AUDIT F-10] Same one-shot bug as the marketplace listing: `init` on
    /// `[AUCTION_SEED, mint]` plus a PDA that was never closed meant one auction
    /// per NFT for its whole lifetime.
    #[account(
        init_if_needed,
        payer = seller,
        space = AUCTION_SPACE,
        seeds = [AUCTION_SEED, mint.key().as_ref()],
        bump,
        constraint = !auction.active @ AofError::StillActive
    )]
    pub auction: Account<'info, Auction>,
    #[account(mut, constraint = auction_vault.owner == auction.key(), constraint = auction_vault.mint == mint.key())]
    pub auction_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct AuctionBidCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [AUCTION_SEED, mint.key().as_ref()], bump)]
    pub auction: Account<'info, Auction>,
    /// CHECK: предыдущий ставивший (для возврата) — адрес читается из auction.current_bidder
    #[account(mut, address = auction.current_bidder)]
    pub previous_bidder: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuctionSettleCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// [AUDIT F-24] Settling returns the auction rent (and the escrow ATA rent)
    /// to the seller and lets the NFT be auctioned again.
    #[account(mut, close = seller, seeds = [AUCTION_SEED, mint.key().as_ref()], bump)]
    pub auction: Account<'info, Auction>,
    /// CHECK: продавец, получатель оплаты
    #[account(mut, address = auction.seller)]
    pub seller: UncheckedAccount<'info>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, constraint = auction_vault.owner == auction.key(), constraint = auction_vault.mint == mint.key())]
    pub auction_vault: Account<'info, TokenAccount>,
    /// победитель (или продавец, если ставок не было) — получатель NFT
    #[account(mut, constraint = winner_token.mint == mint.key(),
    constraint = winner_token.owner == (if auction.current_bid > 0 { auction.current_bidder } else { auction.seller }) @ AofError::Unauthorized)]
    pub winner_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == tool.owner @ AofError::NotActive,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    pub token_program: Program<'info, Token>,
}

// ----- Оффер -----

#[derive(Accounts)]
#[instruction(price_lamports: u64)]
pub struct OfferCreateCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(init, payer = buyer, space = OFFER_SPACE, seeds = [OFFER_SEED, mint.key().as_ref(), buyer.key().as_ref()], bump)]
    pub offer: Account<'info, Offer>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OfferAcceptCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.owner == seller.key() @ AofError::NotToolOwner,
        constraint = tool.operator == seller.key() @ AofError::NotToolOperator,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    #[account(
        mut,
        close = buyer_refund,
        seeds = [OFFER_SEED, mint.key().as_ref(), offer.buyer.as_ref()],
        bump,
        constraint = offer.mint == mint.key() @ AofError::InvalidMint
    )]
    pub offer: Account<'info, Offer>,
    /// CHECK: offer escrow rent recipient is fixed to the offer buyer.
    #[account(mut, address = offer.buyer)]
    pub buyer_refund: UncheckedAccount<'info>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, constraint = seller_token.mint == mint.key(), constraint = seller_token.owner == seller.key())]
    pub seller_token: Account<'info, TokenAccount>,
    #[account(mut, constraint = buyer_token.mint == mint.key(), constraint = buyer_token.owner == offer.buyer)]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OfferCancelCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = buyer,
        seeds = [OFFER_SEED, mint.key().as_ref(), buyer.key().as_ref()],
        bump,
        constraint = offer.buyer == buyer.key() @ AofError::Unauthorized,
        constraint = offer.mint == mint.key() @ AofError::InvalidMint
    )]
    pub offer: Account<'info, Offer>,
    #[account(mut)]
    pub buyer: Signer<'info>,
}

// ----- Аренда -----

#[derive(Accounts)]
#[instruction(owner_split_bps: u16, min_duration: i64, max_duration: i64)]
pub struct RentalListCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.owner == owner.key() @ AofError::NotToolOwner,
        constraint = tool.operator == owner.key() @ AofError::NotToolOperator,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    #[account(init, payer = owner, space = RENTAL_LISTING_SPACE, seeds = [RENTAL_LISTING_SEED, mint.key().as_ref()], bump)]
    pub rental_listing: Account<'info, RentalListing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(duration_seconds: i64)]
pub struct RentalStartCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub renter: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = !tool.staked @ AofError::NotActive,
        constraint = !tool.is_mining @ AofError::NotActive
    )]
    pub tool: Account<'info, ToolData>,
    #[account(
        mut,
        seeds = [RENTAL_LISTING_SEED, mint.key().as_ref()],
        bump,
        constraint = rental_listing.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.owner == rental_listing.owner @ AofError::NotToolOwner
    )]
    pub rental_listing: Account<'info, RentalListing>,
    /// CHECK: владелец инструмента, получает свою долю платы за аренду
    #[account(mut, address = rental_listing.owner @ AofError::NotToolOwner)]
    pub owner: UncheckedAccount<'info>,
    /// CHECK: казна, получает долю платформы с аренды
    #[account(mut, address = config.treasury @ AofError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,
    #[account(init, payer = renter, space = RENTAL_AGREEMENT_SPACE, seeds = [RENTAL_AGREEMENT_SEED, mint.key().as_ref()], bump)]
    pub rental_agreement: Account<'info, RentalAgreement>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RentalEndCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    pub caller: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [TOOL_SEED, mint.key().as_ref()],
        bump,
        constraint = tool.mint == mint.key() @ AofError::InvalidMint
    )]
    pub tool: Account<'info, ToolData>,
    #[account(
        mut,
        close = renter_refund,
        seeds = [RENTAL_AGREEMENT_SEED, mint.key().as_ref()],
        bump,
        constraint = rental_agreement.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == rental_agreement.renter @ AofError::NotToolOperator
    )]
    pub rental_agreement: Account<'info, RentalAgreement>,
    /// CHECK: получатель ренты закрытого аккаунта — рентер
    #[account(mut, address = rental_agreement.renter)]
    pub renter_refund: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RentalRevokeCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [TOOL_SEED, mint.key().as_ref()], bump, constraint = tool.owner == owner.key() @ AofError::NotToolOwner)]
    pub tool: Account<'info, ToolData>,
    #[account(
        mut,
        seeds = [RENTAL_AGREEMENT_SEED, mint.key().as_ref()],
        bump,
        constraint = rental_agreement.mint == mint.key() @ AofError::InvalidMint,
        constraint = tool.operator == rental_agreement.renter @ AofError::NotToolOperator
    )]
    pub rental_agreement: Account<'info, RentalAgreement>,
    /// CHECK: rent refund recipient is fixed to the agreement renter.
    #[account(mut, address = rental_agreement.renter)]
    pub renter_refund: UncheckedAccount<'info>,
}

// [БЛОК L] Инициализация MaterialMints PDA
// SBPF: кадр функции ограничен 4096 байтами, а `MaterialMints` — это 23 pubkey
// (737 байт), которые Anchor-сгенерированная `try_accounts` десериализует в стек.
// Для init_material_mints верификатор отклонял программу целиком (кадр обёртки
// 4672 байта, CI run 34909636940): обёртка инлайнит `try_accounts`, поэтому
// стоимость аккаунтов попадает в её кадр, а не в отдельный. `Box<..>` уводит
// данные в кучу. Состав аккаунтов, ограничения и IDL не меняются; обращения вида
// `&ctx.accounts.material_mints` продолжают работать через deref-coercion.
#[derive(Accounts)]
pub struct InitMaterialMints<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = MATERIAL_MINTS_SPACE,
        seeds = [MATERIAL_MINTS_SEED],
        bump
    )]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Посадка семян на полевой тайл
#[derive(Accounts)]
#[instruction(tile_index: u8)]
pub struct PlantSeeds<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        init_if_needed,
        payer = user,
        space = ENERGY_ACCOUNT_SPACE,
        seeds = [ENERGY_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub energy_account: Box<Account<'info, EnergyAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = FARM_TILE_SPACE,
        seeds = [FARM_TILE_SEED, user.key().as_ref(), &[tile_index]],
        bump
    )]
    pub farm_tile: Box<Account<'info, FarmTile>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.seeds)]
    pub seeds_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = user_seeds.mint == seeds_mint.key(),
        constraint = user_seeds.owner == user.key()
    )]
    pub user_seeds: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Сбор пшеницы с готового тайла
#[derive(Accounts)]
#[instruction(tile_index: u8)]
pub struct HarvestWheat<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        init_if_needed,
        payer = user,
        space = ENERGY_ACCOUNT_SPACE,
        seeds = [ENERGY_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub energy_account: Box<Account<'info, EnergyAccount>>,
    #[account(
        mut,
        seeds = [FARM_TILE_SEED, user.key().as_ref(), &[tile_index]],
        bump = farm_tile.bump
    )]
    pub farm_tile: Box<Account<'info, FarmTile>>,
    #[account(
        mut,
        seeds = [TOOL_SEED, tool_data.mint.as_ref()],
        bump,
        constraint = tool_data.operator == user.key() @ AofError::NotToolOperator,
        constraint = !tool_data.is_mining @ AofError::ToolBusy
    )]
    pub tool_data: Box<Account<'info, ToolData>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.wheat)]
    pub wheat_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = user_wheat.mint == wheat_mint.key(),
        constraint = user_wheat.owner == user.key()
    )]
    pub user_wheat: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Запуск партии помола
#[derive(Accounts)]
pub struct StartMilling<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        init_if_needed,
        payer = user,
        space = ENERGY_ACCOUNT_SPACE,
        seeds = [ENERGY_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub energy_account: Box<Account<'info, EnergyAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = MILL_STATE_SPACE,
        seeds = [MILL_STATE_SEED, user.key().as_ref()],
        bump
    )]
    pub mill_state: Box<Account<'info, MillState>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.wheat)]
    pub wheat_mint: Box<Account<'info, Mint>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = config.stone_mint)]
    pub stone_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_wheat.mint == wheat_mint.key(), constraint = user_wheat.owner == user.key())]
    pub user_wheat: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = user_stone.mint == stone_mint.key(), constraint = user_stone.owner == user.key())]
    pub user_stone: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Сбор готовой муки
#[derive(Accounts)]
pub struct CollectFlour<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        mut,
        seeds = [MILL_STATE_SEED, user.key().as_ref()],
        bump = mill_state.bump,
        constraint = mill_state.owner == user.key() @ AofError::Unauthorized
    )]
    pub mill_state: Box<Account<'info, MillState>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.flour)]
    pub flour_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_flour.mint == flour_mint.key(), constraint = user_flour.owner == user.key())]
    pub user_flour: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

// [БЛОК L] Запуск партии выпечки в печи
#[derive(Accounts)]
pub struct StartBaking<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        init_if_needed,
        payer = user,
        space = ENERGY_ACCOUNT_SPACE,
        seeds = [ENERGY_ACCOUNT_SEED, user.key().as_ref()],
        bump
    )]
    pub energy_account: Box<Account<'info, EnergyAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = OVEN_STATE_SPACE,
        seeds = [OVEN_STATE_SEED, user.key().as_ref()],
        bump
    )]
    pub oven_state: Box<Account<'info, OvenState>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.flour)]
    pub flour_mint: Box<Account<'info, Mint>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.water)]
    pub water_mint: Box<Account<'info, Mint>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Box<Account<'info, Mint>>,
    // `mut`: token::burn decreases the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.coal)]
    pub coal_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_flour.mint == flour_mint.key(), constraint = user_flour.owner == user.key())]
    pub user_flour: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = user_water.mint == water_mint.key(), constraint = user_water.owner == user.key())]
    pub user_water: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == user.key())]
    pub user_wood: Box<Account<'info, TokenAccount>>,
    #[account(mut, constraint = user_coal.mint == coal_mint.key(), constraint = user_coal.owner == user.key())]
    pub user_coal: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Сбор готового хлеба с печи
#[derive(Accounts)]
pub struct CollectBread<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        mut,
        seeds = [OVEN_STATE_SEED, user.key().as_ref()],
        bump = oven_state.bump,
        constraint = oven_state.owner == user.key() @ AofError::Unauthorized
    )]
    pub oven_state: Box<Account<'info, OvenState>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.bread)]
    pub bread_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_bread.mint == bread_mint.key(), constraint = user_bread.owner == user.key())]
    pub user_bread: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

// [БЛОК L] Обновление погоды (permissionless)
#[derive(Accounts)]
pub struct WeatherCrank<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub cranker: Signer<'info>,
    #[account(
        init_if_needed,
        payer = cranker,
        space = WEATHER_STATE_SPACE,
        seeds = [WEATHER_STATE_SEED],
        bump
    )]
    pub weather_state: Box<Account<'info, WeatherState>>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Сбор воды из колодца
#[derive(Accounts)]
pub struct CollectWellWater<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// [AUDIT F-11] The wallet must already be a player (villagers > 0). A
    /// Player PDA is only created by the authority's resource mint, or by
    /// starting a mining session with a real tool NFT, so the well is no longer
    /// a faucet for freshly generated sybil wallets.
    #[account(
        seeds = [PLAYER_SEED, user.key().as_ref()], bump,
        constraint = player.owner == user.key() @ AofError::Unauthorized
    )]
    pub player: Box<Account<'info, Player>>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(
        init_if_needed,
        payer = user,
        space = WELL_STATE_SPACE,
        seeds = [WELL_STATE_SEED, user.key().as_ref()],
        bump
    )]
    pub well_state: Box<Account<'info, WellState>>,
    #[account(seeds = [WEATHER_STATE_SEED], bump = weather_state.bump)]
    pub weather_state: Box<Account<'info, WeatherState>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = material_mints.water)]
    pub water_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = user_water.mint == water_mint.key(), constraint = user_water.owner == user.key())]
    pub user_water: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// [БЛОК L] Универсальный мгновенный крафт (гемы/баночки)
#[derive(Accounts)]
pub struct CraftRecipe<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    // `mut` on ALL THREE mints [AUDIT F-04]: SPL Token rewrites `mint.supply`
    // on every mint_to/burn, so a read-only mint account makes the runtime
    // reject the instruction with "writable privilege escalated". All eight
    // recipes were dead on arrival; scripts/check-mint-writable.py missed it
    // because the CPI is generated inside a `macro_rules!` (see F-05).
    #[account(mut)]
    pub input_1_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = input_1_acc.mint == input_1_mint.key(), constraint = input_1_acc.owner == user.key())]
    pub input_1_acc: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub input_2_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = input_2_acc.mint == input_2_mint.key(), constraint = input_2_acc.owner == user.key())]
    pub input_2_acc: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub output_mint: Box<Account<'info, Mint>>,
    #[account(mut, constraint = output_acc.mint == output_mint.key(), constraint = output_acc.owner == user.key())]
    pub output_acc: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

// ----- Ордербук ресурсов -----

#[derive(Accounts)]
#[instruction(kind: u8, price_lamports_per_unit: u64, amount: u64)]
pub struct PlaceBuyOrder<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub maker: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(init, payer = maker, space = RESOURCE_ORDER_SPACE, seeds = [RESOURCE_ORDER_SEED, maker.key().as_ref(), mint.key().as_ref()], bump)]
    pub order: Account<'info, ResourceOrder>,
    pub system_program: Program<'info, System>,
}

// SBPF ограничивает стековый кадр 4096 байтами; Anchor-сгенерированная
// `try_accounts` десериализует каждый типизированный аккаунт в стек, и верификатор
// отклонял программу целиком (CI run 34908007614):
//   Function <aof_core::PlaceSellOrder as Accounts<..>>::try_accounts overflows the maximum
//   allowed frame space ... Estimated function frame size: 4160 bytes.
// `Box<..>` уводит данные аккаунтов в кучу (в стеке остаётся 8-байтный указатель),
// что уже используется в этом файле для других инструкций. Состав аккаунтов, их
// порядок, ограничения и IDL не меняются.
#[derive(Accounts)]
#[instruction(kind: u8, price_lamports_per_unit: u64, amount: u64)]
pub struct PlaceSellOrder<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub maker: Signer<'info>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(mut, constraint = maker_token.mint == mint.key(), constraint = maker_token.owner == maker.key())]
    pub maker_token: Box<Account<'info, TokenAccount>>,
    #[account(init, payer = maker, space = RESOURCE_ORDER_SPACE, seeds = [RESOURCE_ORDER_SEED, maker.key().as_ref(), mint.key().as_ref()], bump)]
    pub order: Box<Account<'info, ResourceOrder>>,
    #[account(mut, constraint = order_vault.owner == order.key(), constraint = order_vault.mint == mint.key())]
    pub order_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelBuyOrder<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub maker: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = maker,
        seeds = [RESOURCE_ORDER_SEED, maker.key().as_ref(), mint.key().as_ref()],
        bump,
        constraint = order.maker == maker.key() @ AofError::Unauthorized,
        constraint = order.mint == mint.key() @ AofError::InvalidMint,
        // [AUDIT F-21] Without this, a maker could call `cancel_buy_order` on a
        // SELL order: the handler would compute `price * amount_remaining` out
        // of the order's lamports and then close the account, leaving the
        // escrowed tokens in `order_vault` with nobody able to sign for them.
        constraint = order.is_buy @ AofError::InvalidAmount
    )]
    pub order: Account<'info, ResourceOrder>,
}

#[derive(Accounts)]
pub struct CancelSellOrder<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub maker: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        close = maker,
        seeds = [RESOURCE_ORDER_SEED, maker.key().as_ref(), mint.key().as_ref()],
        bump,
        constraint = order.maker == maker.key() @ AofError::Unauthorized,
        constraint = order.mint == mint.key() @ AofError::InvalidMint,
        // [AUDIT F-21] mirror of the check in CancelBuyOrder.
        constraint = !order.is_buy @ AofError::InvalidAmount
    )]
    pub order: Account<'info, ResourceOrder>,
    #[account(mut, constraint = order_vault.owner == order.key(), constraint = order_vault.mint == mint.key())]
    pub order_vault: Account<'info, TokenAccount>,
    #[account(mut, constraint = maker_token.mint == mint.key(), constraint = maker_token.owner == maker.key())]
    pub maker_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MatchResourceOrders<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    pub mint: Account<'info, Mint>,
    #[account(mut, seeds = [RESOURCE_ORDER_SEED, buy_order.maker.as_ref(), mint.key().as_ref()], bump, constraint = buy_order.mint == mint.key() @ AofError::OrdersDoNotCross)]
    pub buy_order: Account<'info, ResourceOrder>,
    #[account(
        mut,
        seeds = [RESOURCE_ORDER_SEED, sell_order.maker.as_ref(), mint.key().as_ref()],
        bump,
        constraint = sell_order.mint == mint.key() @ AofError::OrdersDoNotCross
    )]
    pub sell_order: Account<'info, ResourceOrder>,
    /// CHECK: продавец, получатель SOL
    #[account(mut, address = sell_order.maker)]
    pub seller: UncheckedAccount<'info>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(mut, constraint = sell_vault.owner == sell_order.key(), constraint = sell_vault.mint == mint.key())]
    pub sell_vault: Account<'info, TokenAccount>,
    /// покупатель — владелец buy_order, получает ресурс
    #[account(mut, constraint = buyer_token.mint == mint.key(), constraint = buyer_token.owner == buy_order.maker)]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

// ----- Крафт под заказ -----

#[derive(Accounts)]
#[instruction(wood_needed: u64, stone_needed: u64, premium_lamports: u64)]
pub struct CraftOrderCreateCtx<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(init, payer = creator, space = CRAFT_ORDER_SPACE, seeds = [CRAFT_ORDER_SEED, creator.key().as_ref()], bump)]
    pub craft_order: Account<'info, CraftOrder>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CraftOrderFulfillCtx<'info> {
    /// [AUDIT F-19] the pause must also stop premium payouts.
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub fulfiller: Signer<'info>,
    #[account(
        mut,
        close = creator_refund,
        seeds = [CRAFT_ORDER_SEED, craft_order.creator.as_ref()],
        bump
    )]
    pub craft_order: Account<'info, CraftOrder>,
    /// CHECK: escrow rent recipient; it is fixed to the order creator.
    #[account(mut, address = craft_order.creator)]
    pub creator_refund: UncheckedAccount<'info>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(address = config.wood_mint)]
    pub wood_mint: Account<'info, Mint>,
    #[account(mut, constraint = fulfiller_wood.mint == wood_mint.key(), constraint = fulfiller_wood.owner == fulfiller.key())]
    pub fulfiller_wood: Account<'info, TokenAccount>,
    #[account(mut, constraint = creator_wood.mint == wood_mint.key(), constraint = creator_wood.owner == craft_order.creator)]
    pub creator_wood: Account<'info, TokenAccount>,
    #[account(address = config.stone_mint)]
    pub stone_mint: Account<'info, Mint>,
    #[account(mut, constraint = fulfiller_stone.mint == stone_mint.key(), constraint = fulfiller_stone.owner == fulfiller.key())]
    pub fulfiller_stone: Account<'info, TokenAccount>,
    #[account(mut, constraint = creator_stone.mint == stone_mint.key(), constraint = creator_stone.owner == craft_order.creator)]
    pub creator_stone: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CraftOrderCancelCtx<'info> {
    /// [AUDIT F-19] cancelling returns escrowed SOL, so it honours the pause.
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        close = creator,
        seeds = [CRAFT_ORDER_SEED, creator.key().as_ref()],
        bump,
        constraint = craft_order.creator == creator.key() @ AofError::Unauthorized
    )]
    pub craft_order: Account<'info, CraftOrder>,
}

// ----- Сезонный пасс -----

#[derive(Accounts)]
#[instruction(season_id: u32)]
pub struct InitSeason<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = SEASON_SPACE, seeds = [SEASON_SEED, &season_id.to_le_bytes()], bump)]
    pub season: Account<'info, Season>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchaseSeasonPass<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, constraint = !config.paused @ AofError::Paused)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: казна
    #[account(mut, address = config.treasury)]
    pub treasury: UncheckedAccount<'info>,
    #[account(seeds = [SEASON_SEED, &season.season_id.to_le_bytes()], bump = season.bump)]
    pub season: Account<'info, Season>,
    #[account(
        init_if_needed, payer = user, space = SEASON_PASS_SPACE,
        seeds = [SEASON_PASS_SEED, user.key().as_ref(), &season.season_id.to_le_bytes()], bump
    )]
    pub season_pass: Account<'info, SeasonPass>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GrantSeasonXp<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: игрок, которому начисляется XP
    pub user: UncheckedAccount<'info>,
    #[account(seeds = [SEASON_SEED, &season.season_id.to_le_bytes()], bump = season.bump)]
    pub season: Account<'info, Season>,
    #[account(
        init_if_needed, payer = authority, space = SEASON_PASS_SPACE,
        seeds = [SEASON_PASS_SEED, user.key().as_ref(), &season.season_id.to_le_bytes()], bump
    )]
    pub season_pass: Account<'info, SeasonPass>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(level: u8, premium_track: bool)]
pub struct ClaimSeasonReward<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority @ AofError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub authority: Signer<'info>,
    #[account(seeds = [MATERIAL_MINTS_SEED], bump = material_mints.bump)]
    pub material_mints: Box<Account<'info, MaterialMints>>,
    #[account(seeds = [SEASON_SEED, &season.season_id.to_le_bytes()], bump = season.bump)]
    pub season: Account<'info, Season>,
    #[account(mut, seeds = [SEASON_PASS_SEED, season_pass.owner.as_ref(), &season.season_id.to_le_bytes()], bump)]
    pub season_pass: Account<'info, SeasonPass>,
    // `mut`: SPL Token mint_to/burn changes the mint supply, so the mint must be writable.
    #[account(mut, address = config.wood_mint)]
    pub wood_mint: Account<'info, Mint>,
    #[account(mut, constraint = user_wood.mint == wood_mint.key(), constraint = user_wood.owner == season_pass.owner)]
    pub user_wood: Account<'info, TokenAccount>,
    /// CHECK: auth PDA
    #[account(seeds = [AUTH_SEED], bump)]
    pub auth: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[program]
pub mod aof_core {
    use super::*;
    use crate::instructions;

    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        instructions::initialize::handler(ctx, treasury)
    }

    pub fn set_fees(ctx: Context<SetFees>, craft_fee: u64, unstake_fee: u64) -> Result<()> {
        instructions::set_fees::handler(ctx, craft_fee, unstake_fee)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused::handler(ctx, paused)
    }

    pub fn set_resource_mints(
        ctx: Context<SetResourceMints>,
        food_mint: Pubkey,
        wood_mint: Pubkey,
        stone_mint: Pubkey,
        seeds_mint: Pubkey,
        water_mint: Pubkey,
        potato_mint: Pubkey,
    ) -> Result<()> {
        instructions::set_resource_mints::handler(ctx, food_mint, wood_mint, stone_mint, seeds_mint, water_mint, potato_mint)
    }

    pub fn init_craft_economy(ctx: Context<InitCraftEconomy>) -> Result<()> {
        instructions::init_craft_economy::handler(ctx)
    }

    // =================================================================
    // [AUDIT F-02] Authority rotation (two-step: propose -> accept)
    // =================================================================
    pub fn set_pending_authority(ctx: Context<SetPendingAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_pending_authority(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::accept_authority(ctx)
    }

    pub fn cancel_pending_authority(ctx: Context<CancelPendingAuthority>) -> Result<()> {
        instructions::cancel_pending_authority(ctx)
    }

    // =================================================================
    // [AUDIT F-27] On-chain mining kill-switch
    // =================================================================
    pub fn set_mining_enabled(ctx: Context<SetMiningEnabled>, enabled: bool) -> Result<()> {
        instructions::set_mining_enabled(ctx, enabled)
    }

    // =================================================================
    // [AUDIT F-01] Vault withdrawal guards
    // =================================================================
    pub fn init_vault_guard(
        ctx: Context<InitVaultGuard>,
        epoch_slots: u64,
        cap_per_epoch: u64,
        max_per_tx: u64,
    ) -> Result<()> {
        instructions::pay_out::init_vault_guard_handler(ctx, epoch_slots, cap_per_epoch, max_per_tx)
    }

    pub fn set_vault_guard(
        ctx: Context<SetVaultGuard>,
        epoch_slots: u64,
        cap_per_epoch: u64,
        max_per_tx: u64,
    ) -> Result<()> {
        instructions::pay_out::set_vault_guard_handler(ctx, epoch_slots, cap_per_epoch, max_per_tx)
    }

    // =================================================================
    // [AUDIT F-03] Global supply ceilings
    // =================================================================
    pub fn set_supply_cap(ctx: Context<SetSupplyCap>, kind: ResourceKind, max_supply: u64) -> Result<()> {
        instructions::set_supply_cap(ctx, kind, max_supply)
    }

    // =================================================================
    // [AUDIT F-16] Collector perk allowlist
    // =================================================================
    pub fn register_collector_mint(ctx: Context<RegisterCollectorMint>, kind: CollectorKind) -> Result<()> {
        instructions::collector_stake::register_handler(ctx, kind)
    }

    pub fn revoke_collector_mint(ctx: Context<RevokeCollectorMint>) -> Result<()> {
        instructions::collector_stake::revoke_handler(ctx)
    }

    // =================================================================
    // [AUDIT F-23] Lottery round recovery
    // =================================================================
    pub fn refund_lottery_round(ctx: Context<RefundLotteryRound>, round_id: u64) -> Result<()> {
        instructions::lottery::refund_round_handler(ctx, round_id)
    }

    pub fn set_craft_economy(
        ctx: Context<SetCraftEconomy>,
        wood_base: [u64; 4],
        stone_base: [u64; 4],
        wood_mult: [u64; 4],
        stone_mult: [u64; 4],
    ) -> Result<()> {
        instructions::set_craft_economy::handler(ctx, wood_base, stone_base, wood_mult, stone_mult)
    }

    pub fn init_rarity_counter(ctx: Context<InitRarityCounter>, rarity: Rarity) -> Result<()> {
        instructions::init_rarity_counter::handler(ctx, rarity)
    }

    /// [БЛОК L] Инициализация MaterialMints PDA с адресами 23 минтов
    pub fn init_material_mints(
        ctx: Context<InitMaterialMints>,
        seeds: Pubkey,
        wheat: Pubkey,
        flour: Pubkey,
        bread: Pubkey,
        water: Pubkey,
        coal: Pubkey,
        meat: Pubkey,
        stone_blue: Pubkey,
        stone_purple: Pubkey,
        stone_red: Pubkey,
        sand_white: Pubkey,
        sand_pink: Pubkey,
        sand_yellow: Pubkey,
        gem_blue: Pubkey,
        gem_orange: Pubkey,
        gem_white: Pubkey,
        gem_green: Pubkey,
        flask_blue: Pubkey,
        flask_yellow: Pubkey,
        flask_green: Pubkey,
        flask_pink: Pubkey,
        flask_purple: Pubkey,
        love_heart: Pubkey,
    ) -> Result<()> {
        instructions::init_material_mints::handler(
            ctx, seeds, wheat, flour, bread, water, coal, meat,
            stone_blue, stone_purple, stone_red, sand_white, sand_pink, sand_yellow,
            gem_blue, gem_orange, gem_white, gem_green,
            flask_blue, flask_yellow, flask_green, flask_pink, flask_purple, love_heart,
        )
    }

    /// [БЛОК L] Посадка семян на полевой тайл
    pub fn plant_seeds(ctx: Context<PlantSeeds>, tile_index: u8, amount: u64) -> Result<()> {
        instructions::plant_seeds::handler(ctx, tile_index, amount)
    }

    /// [БЛОК L] Сбор пшеницы с готового тайла
    pub fn harvest_wheat(ctx: Context<HarvestWheat>, tile_index: u8) -> Result<()> {
        instructions::harvest_wheat::handler(ctx, tile_index)
    }

    /// [БЛОК L] Запуск партии помола на мельнице
    pub fn start_milling(ctx: Context<StartMilling>, batch_size: u8) -> Result<()> {
        instructions::start_milling::handler(ctx, batch_size)
    }

    /// [БЛОК L] Сбор готовой муки с мельницы
    pub fn collect_flour(ctx: Context<CollectFlour>) -> Result<()> {
        instructions::collect_flour::handler(ctx)
    }

    /// [БЛОК L] Запуск партии выпечки в печи (0=дрова, 1=уголь)
    pub fn start_baking(ctx: Context<StartBaking>, batch_size: u8, fuel_kind: u8) -> Result<()> {
        instructions::start_baking::handler(ctx, batch_size, fuel_kind)
    }

    /// [БЛОК L] Сбор готового хлеба с печи
    pub fn collect_bread(ctx: Context<CollectBread>) -> Result<()> {
        instructions::collect_bread::handler(ctx)
    }

    /// [БЛОК L] Обновление погоды (permissionless, раз в сутки)
    pub fn weather_crank(ctx: Context<WeatherCrank>) -> Result<()> {
        instructions::weather_crank::handler(ctx)
    }

    /// [БЛОК L] Сбор воды из колодца
    pub fn collect_well_water(ctx: Context<CollectWellWater>) -> Result<()> {
        instructions::collect_well_water::handler(ctx)
    }

    /// [БЛОК L] Мгновенный крафт гемов/баночек (recipe_id 0-7)
    pub fn craft_recipe(ctx: Context<CraftRecipe>, recipe_id: u8) -> Result<()> {
        instructions::craft_recipe::handler(ctx, recipe_id)
    }

    pub fn deposit_gas(ctx: Context<DepositGas>, amount: u64) -> Result<()> {
        instructions::deposit_gas::handler(ctx, amount)
    }

    pub fn withdraw_gas(ctx: Context<WithdrawGas>, amount: u64) -> Result<()> {
        instructions::withdraw_gas::handler(ctx, amount)
    }

    pub fn sweep_gas_fees(ctx: Context<SweepGasFees>) -> Result<()> {
        instructions::sweep_gas_fees::handler(ctx)
    }

    /// Create the per-kind issuance budget. Must be called for every kind
    /// before that kind can be minted (fail-closed).
    pub fn init_issuance_cap(ctx: Context<InitIssuanceCap>, kind: ResourceKind, epoch_slots: u64, cap_per_epoch: u64) -> Result<()> {
        instructions::issuance_cap::init_handler(ctx, kind, epoch_slots, cap_per_epoch)
    }

    /// Change the budget. Never resets the current epoch's counter.
    pub fn set_issuance_cap(ctx: Context<SetIssuanceCap>, kind: ResourceKind, epoch_slots: u64, cap_per_epoch: u64) -> Result<()> {
        instructions::issuance_cap::set_handler(ctx, kind, epoch_slots, cap_per_epoch)
    }

    pub fn mint_resource(ctx: Context<MintResource>, kind: ResourceKind, amount: u64) -> Result<()> {
        instructions::mint_resource::handler(ctx, kind, amount)
    }

    pub fn mint_resource_once(ctx: Context<MintResourceOnce>, kind: ResourceKind, amount: u64, reward_id: [u8; 32]) -> Result<()> {
        instructions::mint_resource_once::handler(ctx, kind, amount, reward_id)
    }


    pub fn burn_resource(ctx: Context<BurnResource>, kind: ResourceKind, amount: u64) -> Result<()> {
        instructions::burn_resource::handler(ctx, kind, amount)
    }

    pub fn mint_tool(ctx: Context<MintTool>, tool_type: String, rarity: Rarity) -> Result<()> {
        instructions::mint_tool::handler(ctx, tool_type, rarity)
    }

    pub fn burn_tool(ctx: Context<BurnTool>) -> Result<()> {
        instructions::burn_tool::handler(ctx)
    }

    pub fn migrate_tool(ctx: Context<MigrateTool>, tool_type: String, rarity: Rarity, durability: u8) -> Result<()> {
        instructions::migrate_tool::handler(ctx, tool_type, rarity, durability)
    }

    pub fn craft(ctx: Context<Craft>, tool_type: String, rarity: Rarity) -> Result<()> {
        instructions::craft::handler(ctx, tool_type, rarity)
    }

    pub fn reroll(ctx: Context<Reroll>, new_type: String) -> Result<()> {
        instructions::reroll::handler(ctx, new_type)
    }

    pub fn stake(ctx: Context<Stake>, lock_seconds: i64) -> Result<()> {
        instructions::stake::handler(ctx, lock_seconds)
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        instructions::unstake::handler(ctx)
    }

    pub fn start_mining(ctx: Context<StartMining>, hours: u8) -> Result<()> {
        instructions::start_mining::handler(ctx, hours)
    }

    pub fn collect_mining(ctx: Context<CollectMining>) -> Result<()> {
        instructions::collect_mining::handler(ctx)
    }

    pub fn repair(ctx: Context<Repair>, amount: u8) -> Result<()> {
        instructions::repair::handler(ctx, amount)
    }

    pub fn burn_nft(ctx: Context<BurnNft>) -> Result<()> {
        instructions::burn_nft::handler(ctx)
    }

    pub fn pay_out(ctx: Context<PayOut>, amount: u64) -> Result<()> {
        instructions::pay_out::handler(ctx, amount)
    }

    pub fn collector_stake(ctx: Context<CollectorStake>, kind: CollectorKind) -> Result<()> {
        instructions::collector_stake::handler(ctx, kind)
    }

    pub fn collector_unstake(ctx: Context<CollectorUnstake>) -> Result<()> {
        instructions::collector_unstake::handler(ctx)
    }

    pub fn adjust_player_capacity(
        ctx: Context<AdjustPlayerCapacity>,
        delta: i32,
        has_tent: bool,
    ) -> Result<()> {
        instructions::adjust_player_capacity::handler(ctx, delta, has_tent)
    }

    // ===== [НОВОЕ] полная реализация TOR v4 =====

    // --- Паки ---
    pub fn init_pack_config(ctx: Context<InitPackConfig>, pack_type: u8, price_lamports: u64, odds_bps: [u16;5]) -> Result<()> {
        instructions::pack_config::init_handler(ctx, pack_type, price_lamports, odds_bps)
    }
    pub fn set_pack_config(ctx: Context<SetPackConfig>, price_lamports: u64, odds_bps: [u16;5]) -> Result<()> {
        instructions::pack_config::set_handler(ctx, price_lamports, odds_bps)
    }
    pub fn pack_open_commit(ctx: Context<PackOpenCommit>, pack_type: PackType, commit_hash: [u8;32]) -> Result<()> {
        instructions::pack_open_commit::handler(ctx, pack_type, commit_hash)
    }
    pub fn pack_open_reveal(ctx: Context<PackOpenReveal>, secret: [u8;32]) -> Result<()> {
        instructions::pack_open_reveal::handler(ctx, secret)
    }
    /// Refund an expired pack commit (escrow + rent back to the player).
    pub fn pack_open_expire(ctx: Context<PackOpenExpire>) -> Result<()> {
        instructions::pack_open_expire::handler(ctx)
    }

    // --- Честный reroll ---
    pub fn init_reroll_config(ctx: Context<InitRerollConfig>, odds_bps: [u16;5]) -> Result<()> {
        instructions::reroll_random::init_config_handler(ctx, odds_bps)
    }
    pub fn set_reroll_config(ctx: Context<SetRerollConfig>, odds_bps: [u16;5]) -> Result<()> {
        instructions::reroll_random::set_config_handler(ctx, odds_bps)
    }
    pub fn reroll_random_commit(ctx: Context<RerollRandomCommit>, commit_hash: [u8;32]) -> Result<()> {
        instructions::reroll_random::commit_handler(ctx, commit_hash)
    }
    pub fn reroll_random_reveal(ctx: Context<RerollRandomReveal>, secret: [u8;32]) -> Result<()> {
        instructions::reroll_random::reveal_handler(ctx, secret)
    }

    // --- Exploration ---
    pub fn start_exploration_commit(ctx: Context<StartExplorationCommit>, commit_hash: [u8;32]) -> Result<()> {
        instructions::exploration::start_commit_handler(ctx, commit_hash)
    }
    pub fn explore_reveal(ctx: Context<ExploreReveal>, secret: [u8;32]) -> Result<()> {
        instructions::exploration::reveal_handler(ctx, secret)
    }
    pub fn upgrade_exploration_tier(ctx: Context<UpgradeExplorationTier>) -> Result<()> {
        instructions::exploration::upgrade_tier_handler(ctx)
    }

    // --- Рефералы ---
    pub fn referral_bind(ctx: Context<ReferralBindCtx>) -> Result<()> {
        instructions::referral::bind_handler(ctx)
    }
    pub fn referral_upgrade(ctx: Context<ReferralUpgradeCtx>) -> Result<()> {
        instructions::referral::upgrade_handler(ctx)
    }
    pub fn pay_out_with_referral(ctx: Context<PayOutWithReferral>, amount: u64) -> Result<()> {
        instructions::referral::pay_out_with_referral_handler(ctx, amount)
    }

    // --- Кузница риска ---
    pub fn forge_attempt_commit(ctx: Context<ForgeAttemptCommit>, slot_type: u8, commit_hash: [u8;32], use_protector: bool) -> Result<()> {
        instructions::forge::commit_handler(ctx, slot_type, commit_hash, use_protector)
    }
    pub fn forge_attempt_reveal(ctx: Context<ForgeAttemptReveal>, secret: [u8;32]) -> Result<()> {
        instructions::forge::reveal_handler(ctx, secret)
    }
    /// Refund an expired forge commit (re-mint burned wood/stone, return escrowed fee + rent).
    pub fn forge_attempt_expire(ctx: Context<ForgeAttemptExpire>) -> Result<()> {
        instructions::forge::expire_handler(ctx)
    }

    // --- Лотерея ---
    pub fn init_lottery_round(ctx: Context<InitLotteryRound>, round_id: u64) -> Result<()> {
        instructions::lottery::init_round_handler(ctx, round_id)
    }
    pub fn buy_lottery_ticket(ctx: Context<BuyLotteryTicket>) -> Result<()> {
        instructions::lottery::buy_ticket_handler(ctx)
    }
    pub fn draw_lottery(ctx: Context<DrawLottery>, secret: [u8; 32]) -> Result<()> {
        instructions::lottery::draw_handler(ctx, secret)
    }
    pub fn commit_lottery_draw(ctx: Context<CommitLotteryDraw>, commit_hash: [u8; 32]) -> Result<()> {
        instructions::lottery::commit_draw_handler(ctx, commit_hash)
    }
    pub fn claim_lottery_prize(ctx: Context<ClaimLotteryPrize>) -> Result<()> {
        instructions::lottery::claim_prize_handler(ctx)
    }

    // --- Рынок ---
    pub fn marketplace_list(ctx: Context<MarketplaceList>, price_lamports: u64) -> Result<()> {
        instructions::marketplace::list_handler(ctx, price_lamports)
    }
    // Keep the old discriminator fail-closed. A new discriminator is essential:
    // an older deployed binary may ignore trailing args on the unbounded call.
    pub fn marketplace_buy(ctx: Context<MarketplaceBuy>) -> Result<()> {
        err!(AofError::FeatureDisabled)
    }
    pub fn marketplace_buy_bounded(ctx: Context<MarketplaceBuy>, max_price_lamports: u64, expires_at: i64) -> Result<()> {
        instructions::marketplace::buy_handler(ctx, max_price_lamports, expires_at)
    }
    pub fn marketplace_cancel(ctx: Context<MarketplaceCancel>) -> Result<()> {
        instructions::marketplace::cancel_handler(ctx)
    }

    // --- Аукцион ---
    pub fn auction_create(ctx: Context<AuctionCreateCtx>, min_bid: u64, duration_seconds: i64) -> Result<()> {
        instructions::auction::create_handler(ctx, min_bid, duration_seconds)
    }
    pub fn auction_bid(ctx: Context<AuctionBidCtx>, amount: u64) -> Result<()> {
        instructions::auction::bid_handler(ctx, amount)
    }
    pub fn auction_settle(ctx: Context<AuctionSettleCtx>) -> Result<()> {
        instructions::auction::settle_handler(ctx)
    }

    // --- Оффер ---
    pub fn offer_create(ctx: Context<OfferCreateCtx>, price_lamports: u64) -> Result<()> {
        instructions::offer::create_handler(ctx, price_lamports)
    }
    pub fn offer_accept(ctx: Context<OfferAcceptCtx>) -> Result<()> {
        instructions::offer::accept_handler(ctx)
    }
    pub fn offer_cancel(ctx: Context<OfferCancelCtx>) -> Result<()> {
        instructions::offer::cancel_handler(ctx)
    }

    // --- Аренда ---
    pub fn rental_list(ctx: Context<RentalListCtx>, owner_split_bps: u16, min_duration: i64, max_duration: i64, price_per_hour_lamports: u64) -> Result<()> {
        instructions::rental::list_handler(ctx, owner_split_bps, min_duration, max_duration, price_per_hour_lamports)
    }
    pub fn rental_start(ctx: Context<RentalStartCtx>, duration_seconds: i64) -> Result<()> {
        instructions::rental::start_handler(ctx, duration_seconds)
    }
    pub fn rental_end(ctx: Context<RentalEndCtx>) -> Result<()> {
        instructions::rental::end_handler(ctx)
    }
    pub fn rental_revoke(ctx: Context<RentalRevokeCtx>) -> Result<()> {
        instructions::rental::revoke_handler(ctx)
    }

    // --- Ордербук ресурсов ---
    pub fn place_buy_order(ctx: Context<PlaceBuyOrder>, kind: u8, price_lamports_per_unit: u64, amount: u64) -> Result<()> {
        instructions::orderbook::place_buy_handler(ctx, kind, price_lamports_per_unit, amount)
    }
    pub fn place_sell_order(ctx: Context<PlaceSellOrder>, kind: u8, price_lamports_per_unit: u64, amount: u64) -> Result<()> {
        instructions::orderbook::place_sell_handler(ctx, kind, price_lamports_per_unit, amount)
    }
    pub fn cancel_buy_order(ctx: Context<CancelBuyOrder>) -> Result<()> {
        instructions::orderbook::cancel_buy_handler(ctx)
    }
    pub fn cancel_sell_order(ctx: Context<CancelSellOrder>) -> Result<()> {
        instructions::orderbook::cancel_sell_handler(ctx)
    }
    pub fn match_resource_orders(ctx: Context<MatchResourceOrders>) -> Result<()> {
        instructions::orderbook::match_handler(ctx)
    }

    // --- Крафт под заказ ---
    pub fn craft_order_create(ctx: Context<CraftOrderCreateCtx>, wood_needed: u64, stone_needed: u64, premium_lamports: u64) -> Result<()> {
        instructions::craft_order::create_handler(ctx, wood_needed, stone_needed, premium_lamports)
    }
    pub fn craft_order_fulfill(ctx: Context<CraftOrderFulfillCtx>) -> Result<()> {
        instructions::craft_order::fulfill_handler(ctx)
    }
    pub fn craft_order_cancel(ctx: Context<CraftOrderCancelCtx>) -> Result<()> {
        instructions::craft_order::cancel_handler(ctx)
    }

    // --- Сезонный пасс ---
    pub fn init_season(ctx: Context<InitSeason>, season_id: u32) -> Result<()> {
        instructions::season::init_season_handler(ctx, season_id)
    }
    pub fn purchase_season_pass(ctx: Context<PurchaseSeasonPass>) -> Result<()> {
        instructions::season::purchase_pass_handler(ctx)
    }
    pub fn grant_season_xp(ctx: Context<GrantSeasonXp>, amount: u32) -> Result<()> {
        instructions::season::grant_xp_handler(ctx, amount)
    }
    pub fn claim_season_reward(ctx: Context<ClaimSeasonReward>, level: u8, premium_track: bool) -> Result<()> {
        instructions::season::claim_reward_handler(ctx, level, premium_track)
    }


}
