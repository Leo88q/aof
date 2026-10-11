//! Production randomness: four future slot hashes, settled by this program.
//!
//! A commit locks a free pool slot and binds the roll to slots
//! `commit + 32/64/96/128`. None of those slots exist yet, so the hashes
//! cannot be known when the stake is locked. One leader produces four
//! consecutive slots, not slots 32 apart, so one leader cannot grind every
//! input. The last leader can still try a few blockhashes; that residual
//! bias is not a refund option.
//!
//! Reveal is permissionless once every required hash is in SlotHashes.
//! A player who can already compute the roll cannot take a refund. Refund
//! to the player happens only when a required slot was skipped and that
//! absence is still visible in SlotHashes, so there was never a complete
//! outcome. If a hash ages out of the sysvar before reveal, the stake goes
//! to the treasury: withholding a known roll does not pay the player.
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use crate::errors::AofError;
use crate::state::VrfSlot;

pub const SLOT_HASHES_ID: Pubkey = anchor_lang::solana_program::sysvar::slot_hashes::ID;

/// Ignored argument. Older clients still pass an oracle signature. The program
/// never reads it: the roll is the four slot hashes.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VrfRevealParams {
    pub signature: [u8; 64],
    pub recovery_id: u8,
    pub value: [u8; 32],
}

/// Offsets from the commit slot. 32 slots is eight leader windows apart.
pub const SEED_OFFSETS: [u64; 4] = [32, 64, 96, 128];
/// First offset. Stored on the commit as `seed_slot`.
pub const SLOT_HASH_DELAY: u64 = SEED_OFFSETS[0];
/// SlotHashes keeps about 512 entries. A missing hash inside this distance
/// was skipped. Beyond it, the hash may have been seen and then aged out.
pub const SLOT_HASH_RETENTION: u64 = 512;
/// Kept so older call sites that named the reveal length still compile.
/// Reveal stays open for as long as every required hash is readable.
pub const SLOT_HASH_REVEAL_SLOTS: u64 = SLOT_HASH_RETENTION - SEED_OFFSETS[3];

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Unsettled {
    /// A required slot was skipped. No complete roll exists. Pay the player.
    PlayerRefund,
    /// A required hash is no longer readable. The roll may already have been
    /// seen. Pay the treasury, never the player.
    TreasuryForfeit,
}

pub fn seed_slots(commit_slot: u64) -> Result<[u64; 4]> {
    let mut out = [0u64; 4];
    for (i, offset) in SEED_OFFSETS.iter().enumerate() {
        out[i] = commit_slot.checked_add(*offset).ok_or(error!(AofError::RandomnessNotFresh))?;
    }
    Ok(out)
}

pub fn parse_slot_hash(data: &[u8], slot: u64) -> Option<[u8; 32]> {
    if data.len() < 8 {
        return None;
    }
    let declared = u64::from_le_bytes(data[0..8].try_into().ok()?) as usize;
    let available = data.len().saturating_sub(8) / 40;
    let n = declared.min(available).min(512);
    for i in 0..n {
        let start = 8 + i * 40;
        let entry_slot = u64::from_le_bytes(data[start..start + 8].try_into().ok()?);
        if entry_slot == slot {
            let mut hash = [0u8; 32];
            hash.copy_from_slice(&data[start + 8..start + 40]);
            return Some(hash);
        }
    }
    None
}

fn slot_hash_at(account: &AccountInfo, slot: u64) -> Result<Option<[u8; 32]>> {
    require_keys_eq!(*account.key, SLOT_HASHES_ID, AofError::InvalidRandomnessAccount);
    let data = account.try_borrow_data().map_err(|_| error!(AofError::RandomnessNotRevealed))?;
    Ok(parse_slot_hash(&data, slot))
}

/// Mix every required hash with the commit address. One hash is not the roll.
pub fn mix_hashes(hashes: &[[u8; 32]; 4], seeds: &[u64; 4], holder: &Pubkey) -> [u8; 32] {
    hashv(&[
        b"aof-slot-hash-v2",
        holder.as_ref(),
        &seeds[0].to_le_bytes(),
        hashes[0].as_ref(),
        &seeds[1].to_le_bytes(),
        hashes[1].as_ref(),
        &seeds[2].to_le_bytes(),
        hashes[2].as_ref(),
        &seeds[3].to_le_bytes(),
        hashes[3].as_ref(),
    ])
    .to_bytes()
}

pub fn commit(slot: &mut VrfSlot, holder: Pubkey, clock_slot: u64) -> Result<u64> {
    require!(!slot.retired, AofError::VrfSlotRetired);
    require_keys_eq!(slot.lock, Pubkey::default(), AofError::VrfSlotBusy);
    let seeds = seed_slots(clock_slot)?;
    slot.lock = holder;
    slot.locked_at_slot = clock_slot;
    slot.commits = slot.commits.saturating_add(1);
    Ok(seeds[0])
}

pub fn reveal(
    slot: &mut VrfSlot,
    holder: &Pubkey,
    committed_seed_slot: u64,
    commit_slot: u64,
    slothashes: &AccountInfo,
    clock_slot: u64,
) -> Result<[u8; 32]> {
    require_keys_eq!(slot.lock, *holder, AofError::VrfSlotNotHeld);
    require!(
        committed_seed_slot == commit_slot.saturating_add(SLOT_HASH_DELAY),
        AofError::RandomnessNotFresh
    );
    let seeds = seed_slots(commit_slot)?;
    require!(clock_slot > seeds[3], AofError::RevealWindowClosed);
    let mut hashes = [[0u8; 32]; 4];
    for (i, seed) in seeds.iter().enumerate() {
        hashes[i] = slot_hash_at(slothashes, *seed)?.ok_or(error!(AofError::RandomnessNotRevealed))?;
    }
    let value = mix_hashes(&hashes, &seeds, holder);
    slot.lock = Pubkey::default();
    slot.reveals = slot.reveals.saturating_add(1);
    Ok(value)
}

/// What an unsettled commit may do. A knowable roll is not in this enum:
/// that path is reveal, and calling this then returns `RandomnessNotFresh`.
pub fn unsettled(slothashes: &AccountInfo, commit_slot: u64, clock_slot: u64) -> Result<Unsettled> {
    let seeds = seed_slots(commit_slot)?;
    require!(clock_slot > seeds[3], AofError::CommitNotExpired);
    let mut skipped = false;
    let mut aged = false;
    for seed in seeds {
        match slot_hash_at(slothashes, seed)? {
            Some(_) => return err!(AofError::RandomnessNotFresh),
            None if clock_slot < seed.saturating_add(SLOT_HASH_RETENTION) => skipped = true,
            None => aged = true,
        }
    }
    if aged {
        Ok(Unsettled::TreasuryForfeit)
    } else if skipped {
        Ok(Unsettled::PlayerRefund)
    } else {
        err!(AofError::RandomnessNotFresh)
    }
}

pub fn release_lock(slot: &mut VrfSlot, holder: &Pubkey) -> Result<()> {
    require_keys_eq!(slot.lock, *holder, AofError::VrfSlotNotHeld);
    slot.lock = Pubkey::default();
    Ok(())
}

pub fn derive_roll(value: &[u8; 32], tag: &[u8], context: &[u8]) -> [u8; 32] {
    hashv(&[b"aof-vrf-v1".as_ref(), tag, context, value.as_ref()]).to_bytes()
}

pub fn lane(roll: &[u8; 32], lane: usize) -> u64 {
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&roll[lane * 8..lane * 8 + 8]);
    u64::from_le_bytes(bytes)
}

pub fn below(x: u64, n: u64) -> u64 {
    (((x as u128) * (n as u128)) >> 64) as u64
}

pub fn bps(x: u64) -> u64 {
    below(x, 10_000)
}

pub fn tool_settlement_rent(rent: &Rent) -> u64 {
    rent.minimum_balance(anchor_spl::token::Mint::LEN)
        .saturating_add(rent.minimum_balance(anchor_spl::token::TokenAccount::LEN))
        .saturating_add(rent.minimum_balance(crate::constants::TOOL_DATA_SPACE))
        .saturating_add(rent.minimum_balance(crate::constants::TOOL_METADATA_ACCOUNT_MAX_SPACE))
        .saturating_add(crate::constants::TOOL_METADATA_CREATION_FEE_LAMPORTS)
}

/// Move `amount` lamports from a PDA to `to`. The caller has already decided
/// the amount is the escrow, not the rent that Anchor `close` returns.
pub fn transfer_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let mut from_lamports = from.try_borrow_mut_lamports()?;
    let mut to_lamports = to.try_borrow_mut_lamports()?;
    let left = from_lamports.checked_sub(amount).ok_or(error!(AofError::MathOverflow))?;
    **from_lamports = left;
    **to_lamports = to_lamports.checked_add(amount).ok_or(error!(AofError::MathOverflow))?;
    Ok(())
}
