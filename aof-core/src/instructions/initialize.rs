use anchor_lang::prelude::*;
use crate::Initialize;

/// [ФИКС]: Config теперь настоящий singleton PDA (seeds=[CONFIG_SEED]) — см.
/// AUDIT_AND_CHANGES.md, критическая находка. bump сохраняется в аккаунт,
/// как и предполагало наличие поля `Config.bump` в присланном state.rs
/// (оно было объявлено, но никогда не заполнялось).
pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.authority = ctx.accounts.authority.key();
    cfg.treasury = ctx.accounts.authority.key();
    cfg.food_mint = Pubkey::default();
    cfg.wood_mint = Pubkey::default();
    cfg.stone_mint = Pubkey::default();
    cfg.craft_fee = crate::constants::FEE_PER_CRAFT_MICROS;
    cfg.unstake_fee = crate::constants::FEE_PER_NFT_MICROS;
    cfg.paused = false;
    cfg.bump = ctx.bumps.config;
    Ok(())
}
