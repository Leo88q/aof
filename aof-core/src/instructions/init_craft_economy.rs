use anchor_lang::prelude::*;
use crate::constants::*;
use crate::InitCraftEconomy;

pub fn handler(ctx: Context<InitCraftEconomy>) -> Result<()> {
    let craft_economy = &mut ctx.accounts.craft_economy;

    craft_economy.circuit_base = CRAFT_CIRCUIT_BASE;
    craft_economy.silicon_base = CRAFT_SILICON_BASE;
    craft_economy.data_base = CRAFT_DATA_BASE;
    craft_economy.neuron_base = CRAFT_NEURON_BASE;
    craft_economy.power_base = CRAFT_POWER_BASE;
    craft_economy.mind_base = CRAFT_MIND_BASE;

    craft_economy.circuit_mult = CRAFT_CIRCUIT_MULT;
    craft_economy.silicon_mult = CRAFT_SILICON_MULT;
    craft_economy.data_mult = CRAFT_DATA_MULT;
    craft_economy.neuron_mult = CRAFT_NEURON_MULT;
    craft_economy.power_mult = CRAFT_POWER_MULT;
    craft_economy.mind_mult = CRAFT_MIND_MULT;

    craft_economy.bump = ctx.bumps.craft_economy;

    Ok(())
}
