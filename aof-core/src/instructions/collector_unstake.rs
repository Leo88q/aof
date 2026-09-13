use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use crate::constants::*;
use crate::CollectorUnstake;
use crate::state::CollectorKind;
use crate::errors::*;
use crate::events::*;

/// [ФАКТ, из index.js]: `requestUnstakeCollectors` проверяет unlockAt (lock
/// 3 дня), возвращает NFT, декрементит счётчики перка, берёт fee 0.01 RON
/// за трансфер. Здесь — тот же fee (FEE_PER_NFT_MICROS, уже используется
/// для обычного unstake инструментов), тот же lock через on-chain unlock_at.
pub fn handler(ctx: Context<CollectorUnstake>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= ctx.accounts.staked_collector.unlock_at,
        AofError::LockNotExpired
    );

    require!(
        ctx.accounts.gastank.balance_micros >= FEE_PER_NFT_MICROS,
        AofError::InsufficientBalance
    );
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_sub(FEE_PER_NFT_MICROS)
        .ok_or(AofError::MathOverflow)?;

    let vault_bump = ctx.bumps.vault;
    let seeds: &[&[u8]] = &[VAULT_SEED, &[vault_bump]];
    let signer = &[seeds];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        ),
        1,
    )?;

    let kind = ctx.accounts.staked_collector.kind;
    let player = &mut ctx.accounts.player;
    match kind {
        CollectorKind::Historian => {
            player.historian_count = player.historian_count.saturating_sub(1)
        }
        CollectorKind::Medallion => {
            player.medallion_count = player.medallion_count.saturating_sub(1)
        }
    }

    emit!(CollectorUnstaked {
        user: ctx.accounts.user.key(),
        mint: ctx.accounts.mint.key(),
        kind,
    });
    Ok(())
}
