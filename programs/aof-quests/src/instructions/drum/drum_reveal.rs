use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{DrumCommit, QuestConfig};
use crate::errors::QuestError;
use crate::events::DrumRevealed;

/// Таблица шансов барабана: (вес в bps, сумма маскотов).
/// Сумма весов строго = 10000. Редкие крупные призы с малым весом.
///
/// [AUDIT F-13] The old table paid an expected **40** mascots per spin against
/// a spin price of 5 (0.4*10 + 0.3*25 + 0.2*50 + 0.09*150 + 0.01*500), i.e. the
/// treasury lost 8x the price on every spin — a ready-made printing press the
/// moment `drum_commit` was switched on. The table below is calibrated to an
/// expected value of 4.75 against the same price of 5 (95% RTP). The invariants
/// (weights sum to 10000, EV <= price) are now asserted by `drum_odds_tests`.
pub const DRUM_PRIZES: [(u16, u64); 5] = [
    (6000, 2),    // 60% -> 2 маскота
    (2500, 5),    // 25% -> 5  (ровно стоимость спина)
    (1000, 10),   // 10% -> 10
    (400, 20),    //  4% -> 20
    (100, 50),    //  1% -> 50 (джекпот)
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

#[cfg(test)]
mod drum_odds_tests {
    use super::*;

    #[test]
    fn weights_sum_to_ten_thousand() {
        let sum: u32 = DRUM_PRIZES.iter().map(|(w, _)| *w as u32).sum();
        assert_eq!(sum, 10_000, "drum weights must form a full probability space");
    }

    #[test]
    fn expected_payout_does_not_exceed_the_spin_price() {
        const SPIN_COST: u128 = 5;
        let ev: u128 = DRUM_PRIZES
            .iter()
            .map(|(w, amount)| (*w as u128) * (*amount as u128) / 10_000)
            .sum();
        assert!(
            ev <= SPIN_COST,
            "drum EV {ev} exceeds the spin price {SPIN_COST}: the treasury would bleed on every spin"
        );
    }
}
