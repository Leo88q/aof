use anchor_lang::prelude::*;
use crate::events::CraftEconomyUpdated;
use crate::SetCraftEconomy;

pub fn handler(
    ctx: Context<SetCraftEconomy>,
    wood_base: [u64; 4],
    stone_base: [u64; 4],
    wood_mult: [u64; 4],
    stone_mult: [u64; 4],
) -> Result<()> {
    let e = &mut ctx.accounts.craft_economy;
    e.wood_base = wood_base;
    e.stone_base = stone_base;
    e.wood_mult = wood_mult;
    e.stone_mult = stone_mult;
    emit!(CraftEconomyUpdated { wood_base, stone_base, wood_mult, stone_mult, authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
