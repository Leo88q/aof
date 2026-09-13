use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::SetPaused;

pub fn handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}