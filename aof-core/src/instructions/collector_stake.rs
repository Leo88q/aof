use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};
use crate::constants::*;
use crate::CollectorStake;
use crate::state::CollectorKind;
use crate::errors::*;
use crate::events::*;

/// [НОВОЕ, по факту из index.js]: на Ronin коллекционеры хранились на
/// EOA-адресе `COLLECTOR_VAULT_ADDRESS` — единая точка отказа (утеря/компрометация
/// ключа = потеря всех застейканных NFT игроков). Здесь — vault PDA, как и
/// для обычного стейка инструментов в этой же программе; у PDA нет
/// приватного ключа в принципе.
pub fn handler(ctx: Context<CollectorStake>, kind: CollectorKind) -> Result<()> {
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
