use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn, MintTo};
use crate::constants::*;
use crate::Reroll;
use crate::errors::*;
use crate::events::*;
use crate::state::{canonical_tool_type, init_tool_data, Rarity};

/// [ПРИМЕЧАНИЕ]: несмотря на название, это детерминированная механика
/// "сжечь 2 инструмента одной редкости → получить 1 следующей", без RNG.
/// В присланном коде она была ещё и бесплатной — добавляю FEE_PER_REROLL_MICROS.
///
/// [AUDIT F-09] The gas fee alone let a player reach Legendary for 16 Common
/// tools + 0.90 SOL with no resource sink at all, while the craft track for the
/// same upgrade burns 2 750 CIRCUIT / 2 120 SILICON / 1 430 DATA / 710 NEURON /
/// 540 POWER / 630 MIND and gets more expensive with every craft. Reroll now
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
    let circuit_cost = econ.circuit_base[idx]
        .checked_add(minted.checked_mul(econ.circuit_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let silicon_cost = econ.silicon_base[idx]
        .checked_add(minted.checked_mul(econ.silicon_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let data_cost = econ.data_base[idx]
        .checked_add(minted.checked_mul(econ.data_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let neuron_cost = econ.neuron_base[idx]
        .checked_add(minted.checked_mul(econ.neuron_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let power_cost = econ.power_base[idx]
        .checked_add(minted.checked_mul(econ.power_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;
    let mind_cost = econ.mind_base[idx]
        .checked_add(minted.checked_mul(econ.mind_mult[idx]).ok_or(AofError::MathOverflow)?)
        .ok_or(AofError::MathOverflow)?;

    for (mint, token_acc, cost) in [
        (&*ctx.accounts.circuit_mint, &*ctx.accounts.user_circuit, circuit_cost),
        (&*ctx.accounts.silicon_mint, &*ctx.accounts.user_silicon, silicon_cost),
        (&*ctx.accounts.data_mint, &*ctx.accounts.user_data, data_cost),
        (&*ctx.accounts.neuron_mint, &*ctx.accounts.user_neuron, neuron_cost),
        (&*ctx.accounts.power_mint, &*ctx.accounts.user_power, power_cost),
        (&*ctx.accounts.mind_mint, &*ctx.accounts.user_mind, mind_cost),
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
