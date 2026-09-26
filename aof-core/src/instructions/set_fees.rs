use anchor_lang::prelude::*;
use crate::events::FeesUpdated;
use crate::SetFees;
use crate::constants::{MAX_CRAFT_FEE_MICROS, MAX_UNSTAKE_FEE_MICROS};
use crate::errors::AofError;

pub fn handler(ctx: Context<SetFees>, craft_fee: u64, unstake_fee: u64) -> Result<()> {
    require!(
        craft_fee <= MAX_CRAFT_FEE_MICROS && unstake_fee <= MAX_UNSTAKE_FEE_MICROS,
        AofError::FeeTooHigh
    );
    let cfg = &mut ctx.accounts.config;
    cfg.craft_fee = craft_fee;
    cfg.unstake_fee = unstake_fee;
    emit!(FeesUpdated { craft_fee, unstake_fee, authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
