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
mod slot_hash_tests {
    use super::*;
    use anchor_lang::solana_program::account_info::AccountInfo;

    // [AUDIT G-07] This is the second copy of `get_slot_hash` (the first is
    // `aof-core/src/randomness.rs`). The crates are independent, so the code
    // cannot be shared without introducing a new workspace crate; instead both
    // copies are pinned with the SAME golden fixture. Keep the two test modules
    // in sync - the fixtures are the contract.

    // Built at runtime (not `static Pubkey = ...`) so the test does not depend
    // on whether `Pubkey::new_from_array` is a `const fn` in this toolchain.
    static KEY: std::sync::OnceLock<Pubkey> = std::sync::OnceLock::new();
    static OWNER: std::sync::OnceLock<Pubkey> = std::sync::OnceLock::new();
    fn key() -> &'static Pubkey { KEY.get_or_init(|| Pubkey::new_from_array([1u8; 32])) }
    fn owner() -> &'static Pubkey { OWNER.get_or_init(|| Pubkey::new_from_array([2u8; 32])) }

    /// Sysvar layout: `u64` entry count, then `(u64 slot, [u8; 32] hash)` pairs
    /// ordered from the newest slot to the oldest.
    fn fixture() -> (Vec<u8>, [u8; 32], [u8; 32]) {
        let hash_newest = [0x11u8; 32];
        let hash_oldest = [0x22u8; 32];
        let mut data = Vec::new();
        data.extend_from_slice(&2u64.to_le_bytes());
        data.extend_from_slice(&1_000u64.to_le_bytes());
        data.extend_from_slice(&hash_newest);
        data.extend_from_slice(&999u64.to_le_bytes());
        data.extend_from_slice(&hash_oldest);
        (data, hash_newest, hash_oldest)
    }

    fn sysvar<'a>(lamports: &'a mut u64, data: &'a mut [u8]) -> AccountInfo<'a> {
        AccountInfo::new(key(), false, false, lamports, data, owner(), false, 0)
    }

    #[test]
    fn reads_the_hash_of_a_slot_inside_the_window() {
        let (mut data, hash_newest, hash_oldest) = fixture();
        let mut lamports = 0u64;
        let info = sysvar(&mut lamports, &mut data);
        assert_eq!(get_slot_hash(&info, 1_000).unwrap(), hash_newest);
        assert_eq!(get_slot_hash(&info, 999).unwrap(), hash_oldest);
    }

    #[test]
    fn rejects_a_slot_outside_the_window() {
        let (mut data, _, _) = fixture();
        let mut lamports = 0u64;
        let info = sysvar(&mut lamports, &mut data);
        assert!(get_slot_hash(&info, 998).is_err());
        assert!(get_slot_hash(&info, 1_001).is_err());
        assert!(get_slot_hash(&info, 0).is_err());
    }

    #[test]
    fn malformed_sysvar_data_errors_instead_of_panicking() {
        let mut short = Vec::new();
        let mut lamports = 0u64;
        let info = sysvar(&mut lamports, &mut short);
        assert!(get_slot_hash(&info, 1_000).is_err());

        let mut truncated = Vec::new();
        truncated.extend_from_slice(&3u64.to_le_bytes());
        truncated.extend_from_slice(&1_000u64.to_le_bytes());
        truncated.extend_from_slice(&[0x11u8; 32]);
        let mut lamports = 0u64;
        let info = sysvar(&mut lamports, &mut truncated);
        assert!(get_slot_hash(&info, 1_000).is_ok());
        assert!(get_slot_hash(&info, 999).is_err());
    }
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
