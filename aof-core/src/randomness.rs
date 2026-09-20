use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::sysvar::slot_hashes::SlotHashes;
use crate::errors::AofError;

/// LEGACY randomness, NOT a VRF and NOT manipulation-resistant for paid games.
/// Slot hashes are public and secret holders can withhold unfavorable reveals.
/// A refundable expiry restores liveness but creates a free-option bias. New
/// economic commitments using this module must remain disabled until replaced
/// by request-bound, authenticated randomness and mandatory settlement.
/// Retained to settle historical commitments only.

pub fn hash_secret(secret: &[u8; 32]) -> [u8; 32] {
    hashv(&[secret]).to_bytes()
}

pub fn get_slot_hash(slot_hashes_info: &AccountInfo, target_slot: u64) -> Result<[u8; 32]> {
    let data = slot_hashes_info.try_borrow_data()?;
    // SlotHashes sysvar layout: u64 num_entries, затем entries (slot: u64, hash: [u8;32]),
    // отсортированные по убыванию слота.
    require!(data.len() >= 8, AofError::CommitExpired);
    let num_entries = u64::from_le_bytes(data[0..8].try_into().unwrap()) as usize;
    let mut offset = 8usize;
    for _ in 0..num_entries {
        if offset + 40 > data.len() {
            break;
        }
        let slot = u64::from_le_bytes(data[offset..offset + 8].try_into().unwrap());
        if slot == target_slot {
            let mut h = [0u8; 32];
            h.copy_from_slice(&data[offset + 8..offset + 40]);
            return Ok(h);
        }
        offset += 40;
    }
    // слот старше окна SlotHashes (~512 слотов) или ещё не подтверждён
    Err(AofError::CommitExpired.into())
}

/// Финальная энтропия операции: sha256(secret || slot_hash || tag).
pub fn derive_entropy(secret: &[u8; 32], slot_hash: &[u8; 32], tag: &[u8]) -> [u8; 32] {
    hashv(&[secret, slot_hash, tag]).to_bytes()
}

/// Первые 8 байт энтропии как u64, для последующего `% modulus`.
pub fn entropy_u64(entropy: &[u8; 32]) -> u64 {
    u64::from_le_bytes(entropy[0..8].try_into().unwrap())
}

/// Взвешенный выбор индекса 0..N по массиву весов в basis points (сумма
/// весов должна быть == 10_000; вызывающий код это гарантирует). Возвращает
/// индекс первой корзины, в которую попал ролл.
pub fn weighted_pick(roll_bps: u64, weights_bps: &[u16]) -> usize {
    let mut acc: u64 = 0;
    let r = roll_bps % 10_000;
    for (i, w) in weights_bps.iter().enumerate() {
        acc += *w as u64;
        if r < acc {
            return i;
        }
    }
    weights_bps.len() - 1
}

/// Верифицирует raw SlotHashes sysvar-аккаунт (используется в Accounts-структурах
/// как `UncheckedAccount` с address-констрейнтом на публичный ключ сисвара).
pub const SLOT_HASHES_ID: Pubkey = anchor_lang::solana_program::sysvar::slot_hashes::ID;
