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
pub fn handler(ctx: Context<Reroll>, new_type: String) -> Result<()> {
    require!(new_type.len() <= 32, AofError::ToolTypeTooLong);

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

    let td = &mut ctx.accounts.new_tool_data;
    td.mint = ctx.accounts.new_mint.key();
    td.owner = ctx.accounts.user.key();
    td.tool_type = new_type.clone();
    td.rarity = new_rarity;
    td.durability = MAX_DURABILITY;
    td.is_mining = false;
    td.mining_end = 0;
    td.staked = false;
    td.unlock_at = 0;
    td.last_mined_hours = 0;
    td.operator = ctx.accounts.user.key();

    emit!(ToolMinted {
        to: ctx.accounts.user.key(),
        mint: ctx.accounts.new_mint.key(),
        tool_type: new_type,
        rarity: new_rarity,
    });
    Ok(())
}
