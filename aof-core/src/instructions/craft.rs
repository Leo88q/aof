use anchor_lang::prelude::*;
use anchor_spl::token;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::state::{canonical_tool_type, init_tool_data, Rarity};
use crate::Craft;

pub fn handler(ctx: Context<Craft>, tool_type: String, rarity: Rarity) -> Result<()> {
    require!(tool_type.len() <= 32, AofError::ToolTypeTooLong);
    let tool_type = canonical_tool_type(&tool_type)
        .ok_or(AofError::InvalidToolType)?
        .to_string();
    require!(rarity != Rarity::Common, AofError::InvalidRarityForCraft);

    let idx = rarity.craft_index().ok_or(AofError::InvalidRarityForCraft)?;
    require!(
        ctx.accounts.rarity_counter.rarity == rarity.to_u8(),
        AofError::RarityCounterMismatch
    );

    let minted = ctx.accounts.rarity_counter.minted_count;
    let econ = &*ctx.accounts.craft_economy;

    let wood_cost = crate::economics::linear_cost(econ.wood_base[idx], econ.wood_mult[idx], minted)?;
    let stone_cost = crate::economics::linear_cost(econ.stone_base[idx], econ.stone_mult[idx], minted)?;
    let food_cost = crate::economics::linear_cost(econ.food_base[idx], econ.food_mult[idx], minted)?;
    let seeds_cost = crate::economics::linear_cost(econ.seeds_base[idx], econ.seeds_mult[idx], minted)?;
    let water_cost = crate::economics::linear_cost(econ.water_base[idx], econ.water_mult[idx], minted)?;
    // SKR's canonical mint is not stored in Config/MaterialMints yet. Do not
    // accept an arbitrary caller-supplied mint as proof of eligibility: that
    // would let anyone manufacture the discount. The account remains in the
    // context for IDL compatibility, but the discount is fail-closed until a
    // canonical mint is configured.
    let potato_cost = crate::economics::linear_cost(econ.potato_base[idx], econ.potato_mult[idx], minted)?;

    require!(
        ctx.accounts.gastank.balance_micros >= ctx.accounts.config.craft_fee,
        AofError::InsufficientBalance
    );
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_sub(ctx.accounts.config.craft_fee)
        .ok_or(AofError::MathOverflow)?;

    // Сжигаем WOOD
    require!(ctx.accounts.user_wood.amount >= wood_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.wood_mint.to_account_info(),
                from: ctx.accounts.user_wood.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        wood_cost,
    )?;

    // Сжигаем STONE
    require!(ctx.accounts.user_stone.amount >= stone_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.stone_mint.to_account_info(),
                from: ctx.accounts.user_stone.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        stone_cost,
    )?;

    // Сжигаем FOOD [НОВОЕ]
    require!(ctx.accounts.user_food.amount >= food_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.food_mint.to_account_info(),
                from: ctx.accounts.user_food.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        food_cost,
    )?;

    // Сжигаем SEEDS [НОВОЕ]
    require!(ctx.accounts.user_seeds.amount >= seeds_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.seeds_mint.to_account_info(),
                from: ctx.accounts.user_seeds.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        seeds_cost,
    )?;

    // Сжигаем WATER [НОВОЕ]
    require!(ctx.accounts.user_water.amount >= water_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.water_mint.to_account_info(),
                from: ctx.accounts.user_water.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        water_cost,
    )?;

    // Сжигаем POTATO [НОВОЕ]
    require!(ctx.accounts.user_potato.amount >= potato_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.potato_mint.to_account_info(),
                from: ctx.accounts.user_potato.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        potato_cost,
    )?;

    // Сжигаем предыдущий инструмент
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.prev_mint.to_account_info(),
                from: ctx.accounts.prev_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1,
    )?;

    token::close_account(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        token::CloseAccount {
            account: ctx.accounts.prev_token.to_account_info(),
            destination: ctx.accounts.user.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    ))?;

    // Минтим новый инструмент
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.new_mint.to_account_info(),
                to: ctx.accounts.new_token.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    // `init_if_needed` does not populate ToolData. Persist the canonical
    // ownership/operator state in the same transaction as the NFT mint.
    init_tool_data(
        &mut ctx.accounts.new_tool_data,
        ctx.accounts.new_mint.key(),
        ctx.accounts.user.key(),
        tool_type.clone(),
        rarity,
    );

    ctx.accounts.rarity_counter.minted_count =
        minted.checked_add(1).ok_or(AofError::MathOverflow)?;

    emit!(CraftEvent {
        user: ctx.accounts.user.key(),
        tool_type,
        rarity: rarity.to_u8(),
        wood_cost,
        stone_cost,
        food_cost,
        seeds_cost,
        water_cost,
        potato_cost,
    });

    Ok(())
}
