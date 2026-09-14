use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{DrumCommit, QuestConfig};
use crate::errors::QuestError;
use crate::events::DrumRevealed;

/// [ФИКС] Таблица шансов барабана: (вес в bps, сумма маскотов).
/// Сумма весов строго = 10000. Редкие крупные призы с малым весом.
pub const DRUM_PRIZES: [(u16, u64); 5] = [
    (4000, 10),   // 40% -> 10 маскотов
    (3000, 25),   // 30% -> 25
    (2000, 50),   // 20% -> 50
    (900,  150),  //  9% -> 150
    (100,  500),  //  1% -> 500 (джекпот)
];

#[derive(Accounts)]
pub struct DrumReveal<'info> {
    #[account(
        mut,
        seeds = [b"drum_commit", user.key().as_ref()],
        bump = drum_commit.bump,
        close = user,
        constraint = drum_commit.user == user.key() @ QuestError::Unauthorized
    )]
    pub drum_commit: Account<'info, DrumCommit>,

    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        has_one = authority @ QuestError::Unauthorized,
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,

    /// CHECK: authority проверяет секрет офчейн, здесь только верификация хеша
    pub authority: Signer<'info>,

    /// CHECK: пользователь-получатель награды, личность через seeds в drum_commit
    #[account(mut)]
    pub user: UncheckedAccount<'info>,

    /// CHECK: validated against the canonical SlotHashes sysvar address.
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: UncheckedAccount<'info>,

    #[account(
        mut,
        address = quest_config.treasury_mascot @ QuestError::Unauthorized
    )]
    pub treasury_mascot: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = quest_config.mascot_mint,
        associated_token::authority = user
    )]
    pub user_mascot: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

fn get_slot_hash(info: &AccountInfo, target_slot: u64) -> Result<[u8; 32]> {
    let data = info.try_borrow_data()?;
    require!(data.len() >= 8, QuestError::CommitExpired);
    let entries = u64::from_le_bytes(data[0..8].try_into().unwrap()) as usize;
    let mut offset = 8usize;
    for _ in 0..entries {
        if offset + 40 > data.len() {
            break;
        }
        let slot = u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap());
        if slot == target_slot {
            let mut hash = [0u8; 32];
            hash.copy_from_slice(&data[offset + 8..offset + 40]);
            return Ok(hash);
        }
        offset += 40;
    }
    Err(QuestError::CommitExpired.into())
}

pub fn handler(ctx: Context<DrumReveal>, secret: Vec<u8>) -> Result<()> {
    let commit = &ctx.accounts.drum_commit;

    // Проверка что коммит не протух (10 минут) и его slot hash ещё доступен.
    let now = Clock::get()?.unix_timestamp;
    require!(now.saturating_sub(commit.created_at) < 600, QuestError::CommitExpired);

    // Верификация коммит-секрета: sha256(secret) == hash.
    let committed_hash = anchor_lang::solana_program::hash::hash(&secret);
    require!(
        committed_hash.to_bytes() == commit.hash,
        QuestError::InvalidHash
    );
    let slot_hash = get_slot_hash(
        &ctx.accounts.slot_hashes.to_account_info(),
        commit.commit_slot,
    )?;

    // Таблица шансов использует secret + blockhash from the commit slot. A
    // server can no longer grind a winning secret before publishing the commit.
    let entropy = hashv(&[&secret, &slot_hash]);
    let hash_bytes = entropy.to_bytes();
    let roll = u64::from_le_bytes(hash_bytes[0..8].try_into().unwrap()) % 10_000;
    let mut acc: u64 = 0;
    let mut prize_amount: u64 = 0;
    for (weight, amount) in DRUM_PRIZES.iter() {
        acc += *weight as u64;
        if roll < acc {
            prize_amount = *amount;
            break;
        }
    }

    // [ФИКС] Выдача приза из казны пользователю.
    // Казна принадлежит quest_config-PDA и подписывает перевод через signer_seeds
    // (в отличие от quest_claim_reward, где authority=user — там латентный баг).
    let config_bump = ctx.accounts.quest_config.bump;
    let bump_bytes = [config_bump];
    let config_seeds: &[&[u8]] = &[b"quest_config", &bump_bytes];
    let signer_seeds: &[&[&[u8]]] = &[config_seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury_mascot.to_account_info(),
                to: ctx.accounts.user_mascot.to_account_info(),
                authority: ctx.accounts.quest_config.to_account_info(),
            },
            signer_seeds,
        ),
        prize_amount,
    )?;

    emit!(DrumRevealed {
        user: ctx.accounts.user.key(),
    });

    Ok(())
}
