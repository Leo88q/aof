use anchor_lang::prelude::*;
use crate::InitMaterialMints;
use crate::constants::*;

/// [БЛОК L] Инициализация PDA MaterialMints с адресами всех 23 минтов
/// Вызывается один раз админом при деплое.
pub fn handler(
    ctx: Context<InitMaterialMints>,
    seeds: Pubkey,
    wheat: Pubkey,
    flour: Pubkey,
    bread: Pubkey,
    water: Pubkey,
    coal: Pubkey,
    meat: Pubkey,
    stone_blue: Pubkey,
    stone_purple: Pubkey,
    stone_red: Pubkey,
    sand_white: Pubkey,
    sand_pink: Pubkey,
    sand_yellow: Pubkey,
    gem_blue: Pubkey,
    gem_orange: Pubkey,
    gem_white: Pubkey,
    gem_green: Pubkey,
    flask_blue: Pubkey,
    flask_yellow: Pubkey,
    flask_green: Pubkey,
    flask_pink: Pubkey,
    flask_purple: Pubkey,
    love_heart: Pubkey,
) -> Result<()> {
    let mm = &mut ctx.accounts.material_mints;
    mm.seeds = seeds;
    mm.wheat = wheat;
    mm.flour = flour;
    mm.bread = bread;
    mm.water = water;
    mm.coal = coal;
    mm.meat = meat;
    mm.stone_blue = stone_blue;
    mm.stone_purple = stone_purple;
    mm.stone_red = stone_red;
    mm.sand_white = sand_white;
    mm.sand_pink = sand_pink;
    mm.sand_yellow = sand_yellow;
    mm.gem_blue = gem_blue;
    mm.gem_orange = gem_orange;
    mm.gem_white = gem_white;
    mm.gem_green = gem_green;
    mm.flask_blue = flask_blue;
    mm.flask_yellow = flask_yellow;
    mm.flask_green = flask_green;
    mm.flask_pink = flask_pink;
    mm.flask_purple = flask_purple;
    mm.love_heart = love_heart;
    mm.bump = ctx.bumps.material_mints;
    Ok(())
}
