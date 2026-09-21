use anchor_lang::prelude::*;
use crate::events::FeesUpdated;
use crate::SetFees;

pub fn handler(ctx: Context<SetFees>, craft_fee: u64, unstake_fee: u64) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.craft_fee = craft_fee;
    cfg.unstake_fee = unstake_fee;
    emit!(FeesUpdated { craft_fee, unstake_fee, authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
