//! Test double of Switchboard On-Demand for the local validator.
//!
//! CI loads this program at the Switchboard program id through
//! `[[test.genesis]]`, which only exists on the throwaway validator of the
//! "Anchor test" job. It lets tests/aof_vrf_localnet.ts run aof-core's real
//! commit -> reveal -> settlement path: the same instruction discriminators,
//! account order and signer/writable flags as the published sb_on_demand IDL
//! (docs/vendor/switchboard_on_demand_randomness.json), the same randomness
//! account layout, and the state transitions aof-core relies on:
//!
//! - `randomness_init` creates the 480-byte account owned by this program and
//!   records the authority, the queue and the LUT slot;
//! - `randomness_commit` requires the stored authority to sign and seeds the
//!   account with the newest SlotHashes entry (the previous slot), records the
//!   oracle and clears any earlier reveal;
//! - `randomness_reveal` requires the authority to sign, the committed oracle,
//!   a commit and no earlier reveal; it stores the value, sets the reveal slot
//!   to the current slot and zeroes the oracle field (as Switchboard does).
//!
//! What it deliberately does NOT do: verify the oracle's enclave signature
//! (an oracle cannot sign for a local chain), create the LUT or the reward
//! escrow. Switchboard's own verification is exercised against the real
//! devnet queue by aof_backend/scripts/vrfDevnetProbe.ts.
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::{slot_hashes, Sysvar},
};

entrypoint!(process_instruction);

/// Anchor discriminators of sb_on_demand (pinned in aof-core/src/vrf.rs).
const ACCOUNT_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
const INIT: [u8; 8] = [9, 9, 204, 33, 50, 116, 113, 15];
const COMMIT: [u8; 8] = [52, 170, 152, 201, 179, 133, 242, 141];
const REVEAL: [u8; 8] = [197, 181, 187, 10, 30, 58, 20, 73];

/// RandomnessAccountData layout (offsets include the discriminator).
const ACCOUNT_LEN: usize = 480;
const AUTHORITY_AT: usize = 8;
const QUEUE_AT: usize = 40;
const SEED_SLOTHASH_AT: usize = 72;
const SEED_SLOT_AT: usize = 104;
const ORACLE_AT: usize = 112;
const REVEAL_SLOT_AT: usize = 144;
const VALUE_AT: usize = 152;
const LUT_SLOT_AT: usize = 184;

/// Custom error codes (distinct so a failing test names the broken rule).
#[repr(u32)]
enum MockError {
    NotRandomnessAccount = 1,
    WrongAuthority = 2,
    WrongQueue = 3,
    WrongOracle = 4,
    NotCommitted = 5,
    AlreadyRevealed = 6,
    NotSlotHashes = 7,
}

fn fail(error: MockError) -> ProgramError {
    ProgramError::Custom(error as u32)
}

pub fn process_instruction(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let (tag, args) = data.split_at(8);
    if tag == INIT {
        init(program_id, accounts, args)
    } else if tag == COMMIT {
        commit(program_id, accounts)
    } else if tag == REVEAL {
        reveal(program_id, accounts, args)
    } else {
        Err(ProgramError::InvalidInstructionData)
    }
}

fn read_key(data: &[u8], at: usize) -> Pubkey {
    let mut key = [0u8; 32];
    key.copy_from_slice(&data[at..at + 32]);
    Pubkey::new_from_array(key)
}

fn read_u64(data: &[u8], at: usize) -> u64 {
    let mut raw = [0u8; 8];
    raw.copy_from_slice(&data[at..at + 8]);
    u64::from_le_bytes(raw)
}

fn check_randomness(program_id: &Pubkey, randomness: &AccountInfo) -> ProgramResult {
    let data = randomness.try_borrow_data()?;
    if randomness.owner != program_id || data.len() < ACCOUNT_LEN || data[..8] != ACCOUNT_DISCRIMINATOR {
        return Err(fail(MockError::NotRandomnessAccount));
    }
    Ok(())
}

fn check_authority(randomness: &AccountInfo, authority: &AccountInfo) -> ProgramResult {
    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if read_key(&randomness.try_borrow_data()?, AUTHORITY_AT) != *authority.key {
        return Err(fail(MockError::WrongAuthority));
    }
    Ok(())
}

/// randomness(W,S), reward_escrow(W), authority(S), queue(W), payer(W,S),
/// system_program, token_program, associated_token_program, wrapped_sol_mint,
/// program_state, lut_signer, lut(W), address_lookup_table_program.
fn init(program_id: &Pubkey, accounts: &[AccountInfo], args: &[u8]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let randomness = next_account_info(iter)?;
    let _reward_escrow = next_account_info(iter)?;
    let authority = next_account_info(iter)?;
    let queue = next_account_info(iter)?;
    let payer = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;
    if !randomness.is_signer || !authority.is_signer || !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if args.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let recent_slot = read_u64(args, 0);
    invoke(
        &system_instruction::create_account(
            payer.key,
            randomness.key,
            Rent::get()?.minimum_balance(ACCOUNT_LEN),
            ACCOUNT_LEN as u64,
            program_id,
        ),
        &[payer.clone(), randomness.clone(), system_program.clone()],
    )?;
    let mut data = randomness.try_borrow_mut_data()?;
    data[..8].copy_from_slice(&ACCOUNT_DISCRIMINATOR);
    data[AUTHORITY_AT..AUTHORITY_AT + 32].copy_from_slice(authority.key.as_ref());
    data[QUEUE_AT..QUEUE_AT + 32].copy_from_slice(queue.key.as_ref());
    data[LUT_SLOT_AT..LUT_SLOT_AT + 8].copy_from_slice(&recent_slot.to_le_bytes());
    msg!("mock randomness_init");
    Ok(())
}

/// randomness(W), queue, oracle(W), recent_slothashes, authority(S).
fn commit(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let randomness = next_account_info(iter)?;
    let queue = next_account_info(iter)?;
    let oracle = next_account_info(iter)?;
    let slothashes = next_account_info(iter)?;
    let authority = next_account_info(iter)?;
    check_randomness(program_id, randomness)?;
    check_authority(randomness, authority)?;
    if *slothashes.key != slot_hashes::ID {
        return Err(fail(MockError::NotSlotHashes));
    }
    // SlotHashes: u64 length, then (slot u64, hash [u8; 32]) newest first.
    let hashes = slothashes.try_borrow_data()?;
    if hashes.len() < 8 + 40 || read_u64(&hashes, 0) == 0 {
        return Err(fail(MockError::NotSlotHashes));
    }
    let seed_slot = read_u64(&hashes, 8);
    let mut data = randomness.try_borrow_mut_data()?;
    if read_key(&data, QUEUE_AT) != *queue.key {
        return Err(fail(MockError::WrongQueue));
    }
    data[SEED_SLOTHASH_AT..SEED_SLOTHASH_AT + 32].copy_from_slice(&hashes[16..48]);
    data[SEED_SLOT_AT..SEED_SLOT_AT + 8].copy_from_slice(&seed_slot.to_le_bytes());
    data[ORACLE_AT..ORACLE_AT + 32].copy_from_slice(oracle.key.as_ref());
    data[REVEAL_SLOT_AT..REVEAL_SLOT_AT + 8].fill(0);
    data[VALUE_AT..VALUE_AT + 32].fill(0);
    msg!("mock randomness_commit seed_slot={}", seed_slot);
    Ok(())
}

/// randomness(W), oracle, queue, stats(W), authority(S), payer(W,S),
/// recent_slothashes, system_program, reward_escrow(W), token_program,
/// wrapped_sol_mint, program_state. Args: signature [u8; 64], recovery_id u8,
/// value [u8; 32].
fn reveal(program_id: &Pubkey, accounts: &[AccountInfo], args: &[u8]) -> ProgramResult {
    let iter = &mut accounts.iter();
    let randomness = next_account_info(iter)?;
    let oracle = next_account_info(iter)?;
    let queue = next_account_info(iter)?;
    let _stats = next_account_info(iter)?;
    let authority = next_account_info(iter)?;
    let payer = next_account_info(iter)?;
    check_randomness(program_id, randomness)?;
    check_authority(randomness, authority)?;
    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if args.len() < 64 + 1 + 32 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let mut data = randomness.try_borrow_mut_data()?;
    if read_key(&data, QUEUE_AT) != *queue.key {
        return Err(fail(MockError::WrongQueue));
    }
    if read_key(&data, ORACLE_AT) != *oracle.key {
        return Err(fail(MockError::WrongOracle));
    }
    if read_u64(&data, SEED_SLOT_AT) == 0 {
        return Err(fail(MockError::NotCommitted));
    }
    if read_u64(&data, REVEAL_SLOT_AT) != 0 {
        return Err(fail(MockError::AlreadyRevealed));
    }
    let slot = Clock::get()?.slot;
    data[VALUE_AT..VALUE_AT + 32].copy_from_slice(&args[65..97]);
    data[REVEAL_SLOT_AT..REVEAL_SLOT_AT + 8].copy_from_slice(&slot.to_le_bytes());
    data[ORACLE_AT..ORACLE_AT + 32].fill(0);
    msg!("mock randomness_reveal slot={}", slot);
    Ok(())
}
