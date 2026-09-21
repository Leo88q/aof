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

#[cfg(test)]
mod slot_hash_tests {
    use super::*;
    use anchor_lang::solana_program::account_info::AccountInfo;

    // [AUDIT G-07] `get_slot_hash` is duplicated verbatim in
    // `programs/aof-quests/src/instructions/drum/drum_reveal.rs` (different
    // crates, so the code cannot be shared without a new crate). Both copies
    // are pinned with the SAME golden fixture below; if either parsing rule
    // ever drifts, its test fails. Keep the two test modules in sync.

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
        // Older than the 512-slot window and never-yet-confirmed slots both
        // mean "the commitment cannot be settled" -> CommitExpired.
        assert!(get_slot_hash(&info, 998).is_err());
        assert!(get_slot_hash(&info, 1_001).is_err());
        assert!(get_slot_hash(&info, 0).is_err());
    }

    #[test]
    fn malformed_sysvar_data_errors_instead_of_panicking() {
        // Not even a length prefix.
        let mut short = Vec::new();
        let mut lamports = 0u64;
        let info = sysvar(&mut lamports, &mut short);
        assert!(get_slot_hash(&info, 1_000).is_err());

        // Claims 3 entries but carries 1: the loop must stop at the buffer end
        // rather than read out of bounds.
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
