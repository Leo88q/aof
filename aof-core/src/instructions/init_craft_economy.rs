use anchor_lang::prelude::*;
use crate::constants::*;
use crate::InitCraftEconomy;

pub fn handler(ctx: Context<InitCraftEconomy>) -> Result<()> {
    let craft_economy = &mut ctx.accounts.craft_economy;

    craft_economy.wood_base = CRAFT_WOOD_BASE;
    craft_economy.stone_base = CRAFT_STONE_BASE;
    craft_economy.food_base = CRAFT_FOOD_BASE;
    craft_economy.seeds_base = CRAFT_SEEDS_BASE;
    craft_economy.water_base = CRAFT_WATER_BASE;
    craft_economy.potato_base = CRAFT_POTATO_BASE;

    craft_economy.wood_mult = CRAFT_WOOD_MULT;
    craft_economy.stone_mult = CRAFT_STONE_MULT;
    craft_economy.food_mult = CRAFT_FOOD_MULT;
    craft_economy.seeds_mult = CRAFT_SEEDS_MULT;
    craft_economy.water_mult = CRAFT_WATER_MULT;
    craft_economy.potato_mult = CRAFT_POTATO_MULT;

    craft_economy.bump = ctx.bumps.craft_economy;

    Ok(())
}
