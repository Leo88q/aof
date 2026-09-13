use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::sysvar::slot_hashes::SlotHashes;
use crate::errors::AofError;

/// [НОВОЕ] Общий commit-reveal модуль для честного on-chain рандома.
///
/// Ни в присланном Ronin-бэкенде (index.js, `makeRng(seedHex)`), ни в
/// первой версии этой Anchor-программы честного, проверяемого on-chain
/// рандома не было вообще — вся рандомизация считалась офчейн, сервер
/// технически мог подобрать выгодный себе исход, если seed фиксировался
/// до того, как игрок терял возможность отменить операцию (см. AUDIT_V1).
///
/// Схема здесь:
/// 1. `commit`: authority (сервер) заранее вычисляет `secret: [u8;32]`
///    офчейн и присылает on-chain только `sha256(secret)`. Ни сервер, ни
///    игрок не могут в этот момент повлиять на будущий исход, потому что
///    финальная энтропия домешивает ещё и ончейн-данные, которых на
///    момент коммита ещё не существует (см. п.2).
/// 2. `reveal`: сервер публикует `secret`. Программа проверяет
///    `sha256(secret) == commit_hash`, затем берёт хэш слота, в котором
///    был сделан commit (`SlotHashes` sysvar — тот самый способ,
///    которым на Solana исторически делали дешёвый ончейн-рандом до
///    массового распространения VRF), которого на момент commit ещё не
///    существовало → ни сервер, ни игрок не могли предугадать итоговую
///    энтропию заранее. Комбинация `secret ⊕ slot_hash ⊕ tag` — финальная
///    энтропия конкретной операции.
///
/// `SlotHashes` хранит только последние ~512 слотов — если reveal не
/// сделан вовремя, коммит "протухает" (`CommitExpired`). Это осознанный
/// компромисс: без интеграции полноценного VRF (Switchboard и т.п.,
/// отдельная внешняя интеграция, не делаю её здесь вслепую без доступа
/// к их SDK/programID в этой среде) это самый честный рандом, который
/// можно реализовать полностью внутри одной программы.

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
