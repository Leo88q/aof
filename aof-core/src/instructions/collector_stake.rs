use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use crate::constants::*;
use crate::{CollectorStake, RegisterCollectorMint, RevokeCollectorMint};
use crate::state::CollectorKind;
use crate::errors::*;
use crate::events::*;
use crate::state::CollectorAllowEntry;

/// [НОВОЕ, по факту из index.js]: на Ronin коллекционеры хранились на
/// EOA-адресе `COLLECTOR_VAULT_ADDRESS` — единая точка отказа (утеря/компрометация
/// ключа = потеря всех застейканных NFT игроков). Здесь — vault PDA, как и
/// для обычного стейка инструментов в этой же программе; у PDA нет
/// приватного ключа в принципе.
pub fn handler(ctx: Context<CollectorStake>, kind: CollectorKind) -> Result<()> {
    // [AUDIT F-16] The perk used to be unreachable: the handler opened with
    // `require!(false, CollectorNotConfigured)`, so `historian_count` /
    // `medallion_count` were always 0 and the mint-fee discounts and the
    // referral bonus caps (5 -> 30) were dead constants while the site kept
    // advertising them. Eligibility is now decided by the allowlist entry that
    // the Accounts struct requires and that `register_collector_mint` creates.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token.to_account_info(),
                to: ctx.accounts.vault_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let unlock_at = now
        .checked_add(COLLECTORS_LOCK_SECONDS)
        .ok_or(AofError::MathOverflow)?;

    let sc = &mut ctx.accounts.staked_collector;
    sc.owner = ctx.accounts.user.key();
    sc.mint = ctx.accounts.mint.key();
    sc.kind = kind;
    sc.unlock_at = unlock_at;

    let player = &mut ctx.accounts.player;
    if player.owner == Pubkey::default() {
        player.owner = ctx.accounts.user.key();
        player.villagers = DEFAULT_VILLAGERS;
        player.villagers_available = DEFAULT_VILLAGERS;
        player.has_tent = false;
        player.cooldown_until = 0;
    }
    match kind {
        CollectorKind::Historian => {
            player.historian_count = player.historian_count.saturating_add(1)
        }
        CollectorKind::Medallion => {
            player.medallion_count = player.medallion_count.saturating_add(1)
        }
    }

    emit!(CollectorStaked {
        user: ctx.accounts.user.key(),
        mint: ctx.accounts.mint.key(),
        kind,
        unlock_at,
    });
    Ok(())
}

/// [AUDIT F-16] Register an NFT mint as a Historian/Medallion collectible.
///
/// There is no on-chain collection registry for these NFTs and the program does
/// not depend on mpl-token-metadata, so "is this mint a Historian?" cannot be
/// derived on-chain. Rather than trusting a caller-supplied mint, the authority
/// registers each eligible mint explicitly and the PDA is the proof.
pub fn register_handler(ctx: Context<RegisterCollectorMint>, kind: CollectorKind) -> Result<()> {
    let entry = &mut ctx.accounts.entry;
    entry.mint = ctx.accounts.mint.key();
    entry.kind = kind;
    entry.bump = ctx.bumps.entry;
    emit!(CollectorMintRegistered {
        mint: entry.mint,
        kind: kind as u8,
        registered: true,
    });
    Ok(())
}

/// [AUDIT F-16] Withdraw eligibility. Staked collectors keep their unlock
/// timing; only future stakes are affected.
pub fn revoke_handler(ctx: Context<RevokeCollectorMint>) -> Result<()> {
    let entry = &ctx.accounts.entry;
    emit!(CollectorMintRegistered {
        mint: entry.mint,
        kind: entry.kind as u8,
        registered: false,
    });
    Ok(())
}
