use anchor_lang::prelude::*;
use crate::events::CraftEconomyUpdated;
use crate::SetCraftEconomy;

pub fn handler(
    ctx: Context<SetCraftEconomy>,
    circuit_base: [u64; 4],
    silicon_base: [u64; 4],
    circuit_mult: [u64; 4],
    silicon_mult: [u64; 4],
) -> Result<()> {
    let e = &mut ctx.accounts.craft_economy;
    e.circuit_base = circuit_base;
    e.silicon_base = silicon_base;
    e.circuit_mult = circuit_mult;
    e.silicon_mult = silicon_mult;
    emit!(CraftEconomyUpdated { circuit_base, silicon_base, circuit_mult, silicon_mult, authority: ctx.accounts.authority.key(), slot: Clock::get()?.slot });
    Ok(())
}
