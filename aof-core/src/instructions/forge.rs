use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Burn};
use crate::constants::*;
use crate::{ForgeAttemptCommit, ForgeAttemptReveal};
use crate::errors::*;
use crate::events::*;
use crate::randomness::*;

pub fn commit_handler(
    ctx: Context<ForgeAttemptCommit>,
    slot_type: u8,
    commit_hash: [u8; 32],
    use_protector: bool,
) -> Result<()> {
    let slot = &ctx.accounts.enchant_slot;
    require!(slot.level < ENCHANT_MAX_LEVEL, AofError::EnchantMaxLevel);
    let idx = slot.level as usize; // level->level+1, индекс = текущий уровень

    for (mint, from, cost) in [
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood, ENCHANT_WOOD_COST[idx]),
        (&ctx.accounts.stone_mint, &ctx.accounts.user_stone, ENCHANT_STONE_COST[idx]),
    ] {
        require!(from.amount >= cost, AofError::InsufficientBalance);
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint.to_account_info(),
                    from: from.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    let mut fee = ENCHANT_FEE_LAMPORTS[idx];
    if use_protector {
        fee = fee.checked_add(FORGE_PROTECTOR_PRICE_LAMPORTS).ok_or(AofError::MathOverflow)?;
    }
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        fee,
    )?;

    let slot_num = Clock::get()?.slot;
    let fc = &mut ctx.accounts.forge_commit;
    fc.user = ctx.accounts.user.key();
    fc.tool_mint = ctx.accounts.tool_mint.key();
    fc.slot_type = slot_type;
    fc.commit_hash = commit_hash;
    fc.commit_slot = slot_num;
    fc.use_protector = use_protector;
    Ok(())
}

pub fn reveal_handler(ctx: Context<ForgeAttemptReveal>, secret: [u8; 32]) -> Result<()> {
    require!(
        hash_secret(&secret) == ctx.accounts.forge_commit.commit_hash,
        AofError::CommitMismatch
    );
    let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, ctx.accounts.forge_commit.commit_slot)?;
    let entropy = derive_entropy(&secret, &slot_hash, b"forge");
    let roll = entropy_u64(&entropy) % 10_000;

    let slot = &mut ctx.accounts.enchant_slot;
    let idx = slot.level as usize;
    let level_before = slot.level;

    let outcome: u8;
    if roll < FORGE_SUCCESS_BPS[idx] as u64 {
        slot.level += 1;
        outcome = 0;
    } else if roll < (FORGE_SUCCESS_BPS[idx] as u64 + FORGE_PARTIAL_FAIL_BPS[idx] as u64) {
        slot.level = slot.level.saturating_sub(1);
        outcome = 1;
    } else {
        // полная потеря — протектор превращает её в частичную неудачу
        if ctx.accounts.forge_commit.use_protector {
            slot.level = slot.level.saturating_sub(1);
            outcome = 1;
        } else {
            slot.level = 0;
            outcome = 2;
        }
    }

    emit!(ForgeAttempted {
        user: ctx.accounts.forge_commit.user,
        tool_mint: ctx.accounts.forge_commit.tool_mint,
        slot_type: ctx.accounts.forge_commit.slot_type,
        level_before,
        level_after: slot.level,
        outcome,
    });
    Ok(())
}
