use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CraftRecipe;

/// [БЛОК L] Универсальный мгновенный крафт гемов/баночек.
/// recipe_id: 0-7 (см. таблицу рецептов)
pub fn handler(ctx: Context<CraftRecipe>, recipe_id: u8) -> Result<()> {
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    // Макрос для burn одного входа
    macro_rules! burn_in {
        ($mint:expr, $acc:expr, $amt:expr) => {
            require!($acc.amount >= $amt, AofError::InsufficientBalance);
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: $mint.to_account_info(),
                        from: $acc.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                $amt,
            )?;
        };
    }

    // Макрос для mint выхода
    macro_rules! mint_out {
        ($mint:expr, $acc:expr, $amt:expr) => {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: $mint.to_account_info(),
                        to: $acc.to_account_info(),
                        authority: ctx.accounts.auth.to_account_info(),
                    },
                    signer_seeds,
                ),
                $amt,
            )?;
        };
    }

    let mm = &*ctx.accounts.material_mints;
    let cfg = &*ctx.accounts.config;

    match recipe_id {
        // 0 = GemBlue: 1 StoneBlue → 1 GemBlue
        0 => {
            require!(ctx.accounts.input_1_mint.key() == mm.stone_blue, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.gem_blue, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 1 = GemOrange: 1 StoneRed → 1 GemOrange
        1 => {
            require!(ctx.accounts.input_1_mint.key() == mm.stone_red, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.gem_orange, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 2 = GemWhite: 1 SandWhite → 1 GemWhite
        2 => {
            require!(ctx.accounts.input_1_mint.key() == mm.sand_white, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.gem_white, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 3 = FlaskBlue: 2 GemBlue + 5 FOOD → 1
        3 => {
            require!(ctx.accounts.input_1_mint.key() == mm.gem_blue, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.food_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.flask_blue, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 2);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 5);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 4 = FlaskYellow: 2 GemOrange + 3 STONE → 1
        4 => {
            require!(ctx.accounts.input_1_mint.key() == mm.gem_orange, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.stone_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.flask_yellow, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 2);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 3);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 5 = FlaskGreen: 5 WOOD + 5 Seeds → 1
        5 => {
            require!(ctx.accounts.input_1_mint.key() == cfg.wood_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.seeds, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.flask_green, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 5);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 5);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 6 = FlaskPink: 3 SandPink + 5 FOOD → 1
        6 => {
            require!(ctx.accounts.input_1_mint.key() == mm.sand_pink, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == cfg.food_mint, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.flask_pink, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 3);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 5);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        // 7 = FlaskPurple: 1 StonePurple + 1 GemGreen → 1
        7 => {
            require!(ctx.accounts.input_1_mint.key() == mm.stone_purple, AofError::MaterialNotRegistered);
            require!(ctx.accounts.input_2_mint.key() == mm.gem_green, AofError::MaterialNotRegistered);
            require!(ctx.accounts.output_mint.key() == mm.flask_purple, AofError::MaterialNotRegistered);
            burn_in!(ctx.accounts.input_1_mint, ctx.accounts.input_1_acc, 1);
            burn_in!(ctx.accounts.input_2_mint, ctx.accounts.input_2_acc, 1);
            mint_out!(ctx.accounts.output_mint, ctx.accounts.output_acc, 1);
        }
        _ => return Err(AofError::RecipeNotFound.into()),
    }

    Ok(())
}
