use anchor_lang::prelude::*;
use crate::InitRarityCounter;
use crate::state::Rarity;

pub fn handler(ctx: Context<InitRarityCounter>, rarity: Rarity) -> Result<()> {
    ctx.accounts.rarity_counter.rarity = rarity.to_u8();
    ctx.accounts.rarity_counter.minted_count = 0;
    Ok(())
}
