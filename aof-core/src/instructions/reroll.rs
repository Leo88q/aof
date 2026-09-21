use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn, MintTo};
use crate::constants::*;
use crate::Reroll;
use crate::errors::*;
use crate::events::*;
use crate::state::Rarity;

/// [ПРИМЕЧАНИЕ]: несмотря на название, это детерминированная механика
/// "сжечь 2 инструмента одной редкости → получить 1 следующей", без RNG.
/// В присланном коде она была ещё и бесплатной — добавляю FEE_PER_REROLL_MICROS.
///
/// [AUDIT F-09] The gas fee alone let a player reach Legendary for 16 Common
/// tools + 0.90 SOL with no resource sink at all, while the craft track for the
/// same upgrade burns 2 750 WOOD / 2 120 STONE / 1 430 FOOD / 710 SEEDS /
/// 540 WATER / 630 POTATO and gets more expensive with every craft. Reroll now
/// pays the craft bundle for the target rarity (same `CraftEconomy` table, same
/// bonding-curve escalation) and increments `rarity_counter`, so the two
/// progression tracks cannot be arbitraged against each other any more.
pub fn handler(ctx: Context<Reroll>, new_type: String) -> Result<()> {
    require!(new_type.len() <= 32, AofError::ToolTypeTooLong);
    let new_type = canonical_tool_type(&new_type)
        .ok_or(AofError::InvalidToolType)?
        .to_string();

    require!(
        ctx.accounts.gastank.balance_micros >= FEE_PER_REROLL_MICROS,
        AofError::InsufficientBalance
    );
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_sub(FEE_PER_REROLL_MICROS)
        .ok_or(AofError::MathOverflow)?;

    let new_rarity = Rarity::from_u8(
        ctx.accounts.tool_a.rarity.to_u8().checked_add(1).ok_or(AofError::MathOverflow)?
    ).ok_or(AofError::MathOverflow)?;

    // Charge the craft bundle for the target rarity, using the same counter the
    // craft path uses: the price of the Nth Legendary is identical either way.
    let idx = new_rarity.craft_index().ok_or(AofError::InvalidRarityForCraft)?;
    require!(
        ctx.accounts.rarity_counter.rarity == new_rarity.to_u8(),
        AofError::RarityCounterMismatch
    );
    let minted = ctx.accounts.rarity_counter.minted_count;
    let econ = &*ctx.accounts.craft_economy;
    let wood_cost = econ.wood_base[idx]
        .checked_add(minted.checked_mul(econ.wood_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let stone_cost = econ.stone_base[idx]
        .checked_add(minted.checked_mul(econ.stone_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let food_cost = econ.food_base[idx]
        .checked_add(minted.checked_mul(econ.food_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let seeds_cost = econ.seeds_base[idx]
        .checked_add(minted.checked_mul(econ.seeds_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let water_cost = econ.water_base[idx]
        .checked_add(minted.checked_mul(econ.water_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let potato_cost = econ.potato_base[idx]
        .checked_add(minted.checked_mul(econ.potato_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;

    for (mint, token_acc, cost) in [
        (&*ctx.accounts.wood_mint, &*ctx.accounts.user_wood, wood_cost),
        (&*ctx.accounts.stone_mint, &*ctx.accounts.user_stone, stone_cost),
        (&*ctx.accounts.food_mint, &*ctx.accounts.user_food, food_cost),
        (&*ctx.accounts.seeds_mint, &*ctx.accounts.user_seeds, seeds_cost),
        (&*ctx.accounts.water_mint, &*ctx.accounts.user_water, water_cost),
        (&*ctx.accounts.potato_mint, &*ctx.accounts.user_potato, potato_cost),
    ] {
        if cost == 0 {
            continue;
        }
        require!(token_acc.amount >= cost, AofError::InsufficientBalance);
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint.to_account_info(),
                    from: token_acc.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    for (mint, token_acc) in [
        (&*ctx.accounts.mint_a, &*ctx.accounts.token_a),
        (&*ctx.accounts.mint_b, &*ctx.accounts.token_b),
    ] {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint.to_account_info(),
                    from: token_acc.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            1,
        )?;
    }

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.new_mint.to_account_info(),
                to: ctx.accounts.new_token.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    ctx.accounts.tool_a.durability = 0;
    ctx.accounts.tool_b.durability = 0;

    init_tool_data(
        &mut ctx.accounts.new_tool_data,
        ctx.accounts.new_mint.key(),
        ctx.accounts.user.key(),
        new_type.clone(),
        new_rarity,
    );

    ctx.accounts.rarity_counter.minted_count = minted
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;

    emit!(ToolMinted {
        to: ctx.accounts.user.key(),
        mint: ctx.accounts.new_mint.key(),
        tool_type: new_type,
        rarity: new_rarity,
    });
    Ok(())
}
