use anchor_lang::prelude::*;
use anchor_spl::token;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::state::{canonical_tool_type, init_tool_data, Rarity};
use crate::instructions::settlement;
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

    let circuit_cost = crate::economics::linear_cost(econ.circuit_base[idx], econ.circuit_mult[idx], minted)?;
    let silicon_cost = crate::economics::linear_cost(econ.silicon_base[idx], econ.silicon_mult[idx], minted)?;
    let data_cost = crate::economics::linear_cost(econ.data_base[idx], econ.data_mult[idx], minted)?;
    let neuron_cost = crate::economics::linear_cost(econ.neuron_base[idx], econ.neuron_mult[idx], minted)?;
    let power_cost = crate::economics::linear_cost(econ.power_base[idx], econ.power_mult[idx], minted)?;
    // SKR's canonical mint is not stored in Config/MaterialMints yet. Do not
    // accept an arbitrary caller-supplied mint as proof of eligibility: that
    // would let anyone manufacture the discount. The account remains in the
    // context for IDL compatibility, but the discount is fail-closed until a
    // canonical mint is configured.
    let mind_cost = crate::economics::linear_cost(econ.mind_base[idx], econ.mind_mult[idx], minted)?;

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

    // Сжигаем CIRCUIT
    require!(ctx.accounts.user_circuit.amount >= circuit_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.circuit_mint.to_account_info(),
                from: ctx.accounts.user_circuit.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        circuit_cost,
    )?;

    // Сжигаем SILICON
    require!(ctx.accounts.user_silicon.amount >= silicon_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.silicon_mint.to_account_info(),
                from: ctx.accounts.user_silicon.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        silicon_cost,
    )?;

    // Сжигаем DATA [НОВОЕ]
    require!(ctx.accounts.user_data.amount >= data_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.data_mint.to_account_info(),
                from: ctx.accounts.user_data.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        data_cost,
    )?;

    // Сжигаем NEURON [НОВОЕ]
    require!(ctx.accounts.user_neuron.amount >= neuron_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.neuron_mint.to_account_info(),
                from: ctx.accounts.user_neuron.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        neuron_cost,
    )?;

    // Сжигаем POWER [НОВОЕ]
    require!(ctx.accounts.user_power.amount >= power_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.power_mint.to_account_info(),
                from: ctx.accounts.user_power.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        power_cost,
    )?;

    // Сжигаем MIND [НОВОЕ]
    require!(ctx.accounts.user_mind.amount >= mind_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.mind_mint.to_account_info(),
                from: ctx.accounts.user_mind.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        mind_cost,
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

    // Mint the NFT and its immutable Metaplex metadata.
    settlement::mint_tool_nft(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.new_mint.to_account_info(),
        &ctx.accounts.new_token.to_account_info(),
        &ctx.accounts.auth.to_account_info(),
        ctx.bumps.auth,
        &ctx.accounts.metadata.to_account_info(),
        &ctx.accounts.token_metadata_program.to_account_info(),
        &ctx.accounts.user.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.tool_metadata_registry,
        &tool_type,
        rarity,
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
        circuit_cost,
        silicon_cost,
        data_cost,
        neuron_cost,
        power_cost,
        mind_cost,
    });

    Ok(())
}
