use anchor_lang::prelude::*;
use crate::events::PausedToggled;
use crate::SetPaused;

pub fn handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    emit!(PausedToggled { paused, authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
