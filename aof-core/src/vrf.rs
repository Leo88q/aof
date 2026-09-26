//! [SECURITY_CHECKLIST #36/#37, review item 10] Switchboard On-Demand
//! randomness, verified without an extra crate: the workspace builds with
//! `--locked` on solana-program 1.18, and the randomness account is a fixed
//! `#[repr(C)]` layout (switchboard-xyz/solana-sdk,
//! src/on_demand/accounts/randomness.rs and instructions/randomness_commit.rs).
//!
//! Security model every randomness-driven mechanic must follow:
//!  1. commit — the game commit sits in the SAME transaction as, and after,
//!     Switchboard's `randomness_commit` for that account, which must be seeded
//!     on the previous slot and not yet revealed. `seed_slot == slot - 1` alone
//!     is not enough: a player could commit the randomness in one transaction,
//!     obtain the oracle's value off-chain and send the game commit in the same
//!     slot only when the outcome is favourable;
//!  2. reveal — the committed account and seed slot, revealed in this slot;
//!  3. one shot — the game's commit PDA is consumed by the reveal (no retries).
//!
//! No mechanic is wired to this module yet: they stay behind their
//! FeatureDisabled / RandomnessDisabled gates until each one is migrated (see
//! SECURITY_OPEN_ISSUES_PROPOSALS_2026-09-26.md, package 4).
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_lang::solana_program::sysvar::instructions::{load_current_index_checked, load_instruction_at_checked};
use crate::errors::AofError;

/// SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv
pub const SWITCHBOARD_ON_DEMAND_MAINNET: Pubkey = Pubkey::new_from_array([
    6, 115, 189, 70, 242, 228, 126, 4, 241, 43, 217, 47, 183, 49, 150, 142, 205, 157, 151, 87, 194, 116, 218,
    135, 71, 111, 70, 92, 4, 12, 101, 115,
]);
/// Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2
pub const SWITCHBOARD_ON_DEMAND_DEVNET: Pubkey = Pubkey::new_from_array([
    144, 110, 20, 100, 197, 248, 183, 99, 60, 192, 90, 66, 76, 221, 179, 174, 205, 109, 171, 184, 174, 199, 71,
    188, 79, 62, 17, 48, 30, 64, 99, 203,
]);

/// The only Switchboard program this build trusts (`--features devnet` for devnet).
#[cfg(feature = "devnet")]
pub const SWITCHBOARD_PROGRAM_ID: Pubkey = SWITCHBOARD_ON_DEMAND_DEVNET;
#[cfg(not(feature = "devnet"))]
pub const SWITCHBOARD_PROGRAM_ID: Pubkey = SWITCHBOARD_ON_DEMAND_MAINNET;

/// `RandomnessAccountData` discriminator.
pub const RANDOMNESS_ACCOUNT_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
/// `randomness_commit` instruction discriminator (sha256("global:randomness_commit")[..8]).
pub const RANDOMNESS_COMMIT_IX_DISCRIMINATOR: [u8; 8] = [52, 170, 152, 201, 179, 133, 242, 141];
/// 8-byte discriminator + 400-byte `RandomnessAccountData`.
pub const RANDOMNESS_ACCOUNT_LEN: usize = 408;
// Offsets inside the account data: authority, queue, seed_slothash precede
// seed_slot; oracle precedes reveal_slot; value follows reveal_slot.
const SEED_SLOT_AT: usize = 8 + 32 + 32 + 32;
const REVEAL_SLOT_AT: usize = SEED_SLOT_AT + 8 + 32;
const VALUE_AT: usize = REVEAL_SLOT_AT + 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Randomness {
    pub seed_slot: u64,
    pub reveal_slot: u64,
    pub value: [u8; 32],
}

fn read_u64(data: &[u8], at: usize) -> u64 {
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&data[at..at + 8]);
    u64::from_le_bytes(bytes)
}

/// Decode randomness account bytes (discriminator and size checked).
pub fn parse_randomness(data: &[u8]) -> Result<Randomness> {
    require!(data.len() >= RANDOMNESS_ACCOUNT_LEN, AofError::InvalidRandomnessAccount);
    require!(data[..8] == RANDOMNESS_ACCOUNT_DISCRIMINATOR, AofError::InvalidRandomnessAccount);
    let mut value = [0u8; 32];
    value.copy_from_slice(&data[VALUE_AT..VALUE_AT + 32]);
    Ok(Randomness {
        seed_slot: read_u64(data, SEED_SLOT_AT),
        reveal_slot: read_u64(data, REVEAL_SLOT_AT),
        value,
    })
}

/// Load a randomness account owned by the trusted Switchboard program.
pub fn load_randomness(account: &AccountInfo) -> Result<Randomness> {
    require_keys_eq!(*account.owner, SWITCHBOARD_PROGRAM_ID, AofError::InvalidRandomnessAccount);
    let data = account.try_borrow_data()?;
    parse_randomness(&data)
}

/// Commit time: seeded on the previous slot and not revealed for that seed.
/// Returns the seed slot the game commit must store.
pub fn check_fresh_commit(randomness: &Randomness, clock_slot: u64) -> Result<u64> {
    require!(
        clock_slot > 0 && randomness.seed_slot == clock_slot - 1,
        AofError::RandomnessNotFresh
    );
    require!(randomness.reveal_slot < randomness.seed_slot, AofError::RandomnessNotFresh);
    Ok(randomness.seed_slot)
}

/// Reveal time: the committed account and seed slot, revealed in this slot.
pub fn check_reveal(
    randomness: &Randomness,
    account: &Pubkey,
    committed_account: &Pubkey,
    committed_seed_slot: u64,
    clock_slot: u64,
) -> Result<[u8; 32]> {
    require_keys_eq!(*account, *committed_account, AofError::InvalidRandomnessAccount);
    require!(randomness.seed_slot == committed_seed_slot, AofError::RandomnessNotFresh);
    require!(randomness.reveal_slot == clock_slot, AofError::RandomnessNotRevealed);
    Ok(randomness.value)
}

/// The Switchboard `randomness_commit` for `randomness` must precede the current
/// instruction in the same transaction. Uses the address-checked sysvar loaders.
pub fn require_commit_in_same_tx(instructions: &AccountInfo, randomness: &Pubkey) -> Result<()> {
    let current = load_current_index_checked(instructions)? as usize;
    for index in 0..current {
        let ix = load_instruction_at_checked(index, instructions)?;
        let is_commit = ix.program_id == SWITCHBOARD_PROGRAM_ID
            && ix.data.len() >= 8
            && ix.data[..8] == RANDOMNESS_COMMIT_IX_DISCRIMINATOR;
        if is_commit && ix.accounts.first().map(|meta| meta.pubkey == *randomness).unwrap_or(false) {
            return Ok(());
        }
    }
    err!(AofError::RandomnessCommitMissing)
}

/// Domain-separated roll: one oracle value never drives two mechanics or two
/// commits the same way.
pub fn derive_roll(value: &[u8; 32], tag: &[u8], context: &[u8]) -> [u8; 32] {
    hashv(&[b"aof-vrf-v1".as_ref(), tag, context, value.as_ref()]).to_bytes()
}
