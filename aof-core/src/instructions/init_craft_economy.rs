use anchor_lang::prelude::*;
use crate::constants::*;
use crate::InitCraftEconomy;

pub fn handler(ctx: Context<InitCraftEconomy>) -> Result<()> {
    let craft_economy = &mut ctx.accounts.craft_economy;

    craft_economy.wood_base = CRAFT_CIRCUIT_BASE;
    craft_economy.stone_base = CRAFT_SILICON_BASE;
    craft_economy.food_base = CRAFT_DATA_BASE;
    craft_economy.seeds_base = CRAFT_NEURON_BASE;
    craft_economy.water_base = CRAFT_POWER_BASE;
    craft_economy.potato_base = CRAFT_MIND_BASE;

    craft_economy.wood_mult = CRAFT_CIRCUIT_MULT;
    craft_economy.stone_mult = CRAFT_SILICON_MULT;
    craft_economy.food_mult = CRAFT_DATA_MULT;
    craft_economy.seeds_mult = CRAFT_NEURON_MULT;
    craft_economy.water_mult = CRAFT_POWER_MULT;
    craft_economy.potato_mult = CRAFT_MIND_MULT;

    craft_economy.bump = ctx.bumps.craft_economy;

    Ok(())
}
