use anchor_lang::prelude::*;
use crate::errors::AofError;
use crate::Initialize;

/// [ФИКС]: Config теперь настоящий singleton PDA (seeds=[CONFIG_SEED]) — см.
/// AUDIT_AND_CHANGES.md, критическая находка. bump сохраняется в аккаунт,
/// как и предполагало наличие поля `Config.bump` в присланном state.rs
/// (оно было объявлено, но никогда не заполнялось).
pub fn handler(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
    // Config is a singleton, so `init` prevents a second initialization. That
    // alone is not enough: without this check, any wallet could win the first
    // transaction and permanently become Config.authority. During bootstrap,
    // only the upgrade authority recorded in the canonical ProgramData account
    // may create Config. Because Config.authority is set to this signer, a
    // deployment must retain this key (or add an explicit authority-rotation
    // instruction before transferring upgrade authority).
    let upgrade_authority = ctx
        .accounts
        .program_data
        .upgrade_authority_address
        .ok_or(AofError::InvalidProgramData)?;
    require_keys_eq!(
        upgrade_authority,
        ctx.accounts.authority.key(),
        AofError::Unauthorized
    );

    let cfg = &mut ctx.accounts.config;
    cfg.authority = ctx.accounts.authority.key();
    cfg.treasury = treasury;
    cfg.food_mint = Pubkey::default();
    cfg.wood_mint = Pubkey::default();
    cfg.stone_mint = Pubkey::default();
    cfg.craft_fee = crate::constants::FEE_PER_CRAFT_MICROS;
    cfg.unstake_fee = crate::constants::FEE_PER_NFT_MICROS;
    cfg.paused = false;
    cfg.bump = ctx.bumps.config;
    // [AUDIT F-27] Mining starts enabled to preserve the previous behaviour;
    // `set_mining_enabled` is the emergency brake.
    cfg.mining_enabled = true;
    // [AUDIT F-02] No rotation pending at bootstrap.
    cfg.pending_authority = Pubkey::default();
    cfg.authority_updated_at = Clock::get()?.unix_timestamp;
    // [SECURITY_CHECKLIST_REVIEW F-C] Single-key bootstrap; the admin splits the
    // roles with `set_roles` and then rotates itself to the multisig.
    cfg.operator = cfg.authority;
    cfg.guardian = cfg.authority;
    cfg.cashout_frozen = false;
    Ok(())
}
