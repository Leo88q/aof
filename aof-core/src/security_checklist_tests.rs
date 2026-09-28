//! Host-side security regression suite for the 30-item Anchor checklist
//! reviewed in `SECURITY_CHECKLIST_REVIEW_2026-09-25.md` (items are cited as
//! `#N`, findings of that review as `F-X`).
//!
//! Everything exercised here is the REAL program code: Anchor's generated
//! `try_accounts` for the instruction contexts, and the REAL instruction
//! handlers. The parts of the Solana runtime a host test cannot have are
//! replaced by small syscall stubs:
//!   * the `Clock` / `Rent` sysvars come from fixed test values;
//!   * a CPI (`invoke_signed`) is *recorded* (counted), never executed.
//! These tests therefore prove what an instruction validates and mutates
//! BEFORE it hands control to another program, and whether it does so at all.
//! Token balances moved by the SPL Token CPI itself are out of scope (that
//! needs a validator / bankrun); lamports the program moves directly ARE in
//! scope and are asserted to the lamport.
//!
//! `AccountsExit::exit` is deliberately never called: Anchor's `close` ends in
//! `AccountInfo::realloc`, which writes in front of the data buffer and is only
//! sound on the runtime's serialized input, not on host allocations.

use super::*;
use std::cell::Cell;
use std::collections::BTreeSet;
use std::sync::Once;

use anchor_lang::solana_program::bpf_loader_upgradeable;
use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program_option::COption;
use anchor_lang::solana_program::program_pack::Pack;
use anchor_lang::solana_program::program_stubs::{set_syscall_stubs, SyscallStubs};
use anchor_spl::token::spl_token;
use anchor_lang::AccountsExit;

// ======================================================================
// Host runtime: sysvars + CPI recorder
// ======================================================================

const NOW_TS: i64 = 1_760_000_000;
const SLOT_NOW: u64 = 100_000;
const WALLET_LAMPORTS: u64 = 5_000_000_000;

thread_local! {
    static CPI_CALLS: Cell<usize> = Cell::new(0);
    static LAST_CPI_DATA: std::cell::RefCell<Vec<u8>> = std::cell::RefCell::new(Vec::new());
    /// Every CPI of the current test: (program, metas, data, signer seed sets).
    static CPI_LOG: std::cell::RefCell<Vec<RecordedCpi>> = std::cell::RefCell::new(Vec::new());
    /// Switchboard emulation mode (see `emulate_switchboard`).
    static SB_MODE: Cell<u8> = Cell::new(SB_HONEST);
}

#[derive(Clone, Debug)]
struct RecordedCpi {
    program_id: Pubkey,
    accounts: Vec<anchor_lang::solana_program::instruction::AccountMeta>,
    data: Vec<u8>,
    signer_seeds: Vec<Vec<Vec<u8>>>,
}

/// Switchboard behaves as documented.
const SB_HONEST: u8 = 0;
/// `randomness_commit` "succeeds" but leaves the old seed in place.
const SB_STALE_COMMIT: u8 = 1;
/// `randomness_reveal` writes a value other than the one it was given.
const SB_SWAPPED_VALUE: u8 = 2;

/// What the real Switchboard program does to the randomness account, for the
/// three instructions this program CPIs. Keeps handler tests honest end to end:
/// the handler must read the seed and the value back from the account.
fn emulate_switchboard(ix: &Instruction, infos: &[AccountInfo]) {
    use crate::vrf::*;
    let Some(first) = ix.accounts.first() else { return };
    let Some(acc) = infos.iter().find(|i| *i.key == first.pubkey) else { return };
    let mut data = acc.try_borrow_mut_data().unwrap();
    if data.len() < RANDOMNESS_ACCOUNT_LEN || ix.data.len() < 8 {
        return;
    }
    let mode = SB_MODE.with(|m| m.get());
    let disc = &ix.data[..8];
    if disc == RANDOMNESS_COMMIT_IX_DISCRIMINATOR {
        if mode != SB_STALE_COMMIT {
            data[104..112].copy_from_slice(&(SLOT_NOW - 1).to_le_bytes());
            // The oracle chosen at commit is recorded on the account.
            data[112..144].copy_from_slice(ix.accounts[2].pubkey.as_ref());
            // Measured on devnet: a (re)commit, also over an unrevealed commit,
            // resets reveal_slot and value.
            data[144..184].fill(0);
        }
    } else if disc == RANDOMNESS_REVEAL_IX_DISCRIMINATOR {
        data[144..152].copy_from_slice(&SLOT_NOW.to_le_bytes());
        let mut value = [0u8; 32];
        value.copy_from_slice(&ix.data[73..105]);
        if mode == SB_SWAPPED_VALUE {
            value[0] ^= 0xff;
        }
        data[152..184].copy_from_slice(&value);
        // Measured on devnet: the real program zeroes the oracle field when it
        // records a reveal, so no check may read the oracle after this CPI
        // (the reveal contexts bind it before, via `assigned_oracle_is`).
        data[112..144].fill(0);
    } else if disc == RANDOMNESS_INIT_IX_DISCRIMINATOR {
        data[..8].copy_from_slice(&RANDOMNESS_ACCOUNT_DISCRIMINATOR);
        data[8..40].copy_from_slice(ix.accounts[2].pubkey.as_ref());
        data[40..72].copy_from_slice(ix.accounts[3].pubkey.as_ref());
    }
}

struct HostRuntime;

impl SyscallStubs for HostRuntime {
    fn sol_get_clock_sysvar(&self, var_addr: *mut u8) -> u64 {
        let clock = Clock {
            slot: SLOT_NOW,
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: NOW_TS,
        };
        // SAFETY: `Sysvar::get` passes a pointer to its own, aligned `Clock`.
        unsafe { *(var_addr as *mut Clock) = clock };
        0
    }

    fn sol_get_rent_sysvar(&self, var_addr: *mut u8) -> u64 {
        // SAFETY: as above, for `Rent`.
        unsafe { *(var_addr as *mut Rent) = Rent::default() };
        0
    }

    fn sol_invoke_signed(
        &self,
        instruction: &Instruction,
        account_infos: &[AccountInfo],
        signers_seeds: &[&[&[u8]]],
    ) -> ProgramResult {
        CPI_CALLS.with(|calls| calls.set(calls.get() + 1));
        LAST_CPI_DATA.with(|data| *data.borrow_mut() = instruction.data.clone());
        CPI_LOG.with(|log| {
            log.borrow_mut().push(RecordedCpi {
                program_id: instruction.program_id,
                accounts: instruction.accounts.clone(),
                data: instruction.data.clone(),
                signer_seeds: signers_seeds
                    .iter()
                    .map(|set| set.iter().map(|seed| seed.to_vec()).collect())
                    .collect(),
            })
        });
        if instruction.program_id == crate::vrf::SWITCHBOARD_PROGRAM_ID {
            emulate_switchboard(instruction, account_infos);
        }
        Ok(())
    }
}

static INSTALL: Once = Once::new();

/// Install the stubs (once per test binary) and reset this thread's CPI log.
fn runtime() {
    INSTALL.call_once(|| {
        let _default_stubs = set_syscall_stubs(Box::new(HostRuntime));
    });
    CPI_CALLS.with(|calls| calls.set(0));
    LAST_CPI_DATA.with(|data| data.borrow_mut().clear());
    CPI_LOG.with(|log| log.borrow_mut().clear());
    SB_MODE.with(|m| m.set(SB_HONEST));
}

fn cpi_log() -> Vec<RecordedCpi> {
    CPI_LOG.with(|log| log.borrow().clone())
}

fn switchboard_cpis() -> Vec<RecordedCpi> {
    cpi_log().into_iter().filter(|c| c.program_id == crate::vrf::SWITCHBOARD_PROGRAM_ID).collect()
}

fn cpi_calls() -> usize {
    CPI_CALLS.with(|calls| calls.get())
}

/// Lamports of the last recorded System Program `Transfer` CPI (tag 2u32 LE).
fn last_system_transfer_lamports() -> u64 {
    LAST_CPI_DATA.with(|data| {
        let data = data.borrow();
        assert_eq!(data.get(..4), Some(&[2u8, 0, 0, 0][..]), "the last CPI was not a System transfer");
        u64::from_le_bytes(data[4..12].try_into().unwrap())
    })
}

/// Amount of the last recorded SPL Token `MintTo` CPI (tag 7, u64 LE amount).
fn last_minted_amount() -> u64 {
    LAST_CPI_DATA.with(|data| {
        let data = data.borrow();
        assert_eq!(data.first(), Some(&7u8), "the last CPI was not an SPL MintTo");
        u64::from_le_bytes(data[1..9].try_into().unwrap())
    })
}

// ======================================================================
// Account fixtures
// ======================================================================

fn info(
    key: Pubkey,
    signer: bool,
    lamports: u64,
    data: Vec<u8>,
    owner: Pubkey,
    executable: bool,
) -> AccountInfo<'static> {
    AccountInfo::new(
        Box::leak(Box::new(key)),
        signer,
        true,
        Box::leak(Box::new(lamports)),
        Box::leak(data.into_boxed_slice()),
        Box::leak(Box::new(owner)),
        executable,
        0,
    )
}

fn rent_exempt(len: usize) -> u64 {
    Rent::default().minimum_balance(len)
}

fn set_lamports(account: &AccountInfo<'static>, lamports: u64) {
    **account.try_borrow_mut_lamports().unwrap() = lamports;
}

fn wallet(key: Pubkey, signer: bool) -> AccountInfo<'static> {
    info(key, signer, WALLET_LAMPORTS, Vec::new(), anchor_lang::solana_program::system_program::ID, false)
}

fn serialized<T: AccountSerialize>(value: &T, space: usize) -> Vec<u8> {
    let mut data = Vec::new();
    value.try_serialize(&mut data).unwrap();
    assert!(data.len() <= space, "fixture of {} bytes exceeds its space {}", data.len(), space);
    data.resize(space, 0);
    data
}

fn serialized_len<T: AccountSerialize>(value: &T) -> usize {
    let mut data = Vec::new();
    value.try_serialize(&mut data).unwrap();
    data.len()
}

/// A rent-exempt account of this program holding `value`, padded to `space`.
fn program_account<T: AccountSerialize>(key: Pubkey, value: &T, space: usize) -> AccountInfo<'static> {
    info(key, false, rent_exempt(space), serialized(value, space), crate::ID, false)
}

fn executable_program(id: Pubkey) -> AccountInfo<'static> {
    info(id, false, 1, Vec::new(), bpf_loader_upgradeable::ID, true)
}

fn system_program_info() -> AccountInfo<'static> {
    executable_program(anchor_lang::solana_program::system_program::ID)
}

fn token_program_info() -> AccountInfo<'static> {
    executable_program(anchor_spl::token::ID)
}

fn token_2022_id() -> Pubkey {
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb".parse().unwrap()
}

fn mint_owned_by(
    token_program: Pubkey,
    key: Pubkey,
    supply: u64,
    mint_authority: Option<Pubkey>,
    freeze_authority: Option<Pubkey>,
) -> AccountInfo<'static> {
    let mut data = vec![0u8; spl_token::state::Mint::LEN];
    spl_token::state::Mint::pack(
        spl_token::state::Mint {
            mint_authority: mint_authority.map_or(COption::None, COption::Some),
            supply,
            decimals: 0,
            is_initialized: true,
            freeze_authority: freeze_authority.map_or(COption::None, COption::Some),
        },
        &mut data,
    )
    .unwrap();
    info(key, false, rent_exempt(spl_token::state::Mint::LEN), data, token_program, false)
}

fn spl_mint(
    key: Pubkey,
    supply: u64,
    mint_authority: Option<Pubkey>,
    freeze_authority: Option<Pubkey>,
) -> AccountInfo<'static> {
    mint_owned_by(anchor_spl::token::ID, key, supply, mint_authority, freeze_authority)
}

fn token_account(key: Pubkey, mint: Pubkey, owner: Pubkey, amount: u64) -> AccountInfo<'static> {
    let mut data = vec![0u8; spl_token::state::Account::LEN];
    spl_token::state::Account::pack(
        spl_token::state::Account {
            mint,
            owner,
            amount,
            delegate: COption::None,
            state: spl_token::state::AccountState::Initialized,
            is_native: COption::None,
            delegated_amount: 0,
            close_authority: COption::None,
        },
        &mut data,
    )
    .unwrap();
    info(key, false, rent_exempt(spl_token::state::Account::LEN), data, anchor_spl::token::ID, false)
}

fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    anchor_spl::associated_token::get_associated_token_address(owner, mint)
}

/// Deterministic xorshift for the randomized invariant tests (no new crates).
struct XorShift(u64);

impl XorShift {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: u64) -> u64 {
        if n == 0 { 0 } else { self.next() % n }
    }
}

fn pda(seeds: &[&[u8]]) -> (Pubkey, u8) {
    Pubkey::find_program_address(seeds, &crate::ID)
}

fn gas_tank(owner: Pubkey, balance_micros: u64, dust_lamports: u64, cooldown_until: i64) -> GasTank {
    GasTank { owner, balance_micros, cooldown_until, dust_lamports }
}

fn player(owner: Pubkey) -> Player {
    Player {
        owner,
        cooldown_until: 0,
        has_tent: false,
        villagers: 0,
        villagers_available: 0,
        historian_count: 0,
        medallion_count: 0,
    }
}

fn tool(mint: Pubkey, owner: Pubkey, operator: Pubkey, tool_type: &str) -> ToolData {
    ToolData {
        mint,
        owner,
        tool_type: tool_type.to_string(),
        rarity: Rarity::Common,
        durability: 10,
        is_mining: false,
        mining_end: 0,
        last_mined_hours: 0,
        staked: false,
        unlock_at: 0,
        operator,
    }
}

fn resource_order(maker: Pubkey, is_buy: bool, price: u64, amount: u64, mint: Pubkey) -> ResourceOrder {
    ResourceOrder {
        maker,
        kind: ResourceKind::Data as u8,
        is_buy,
        price_lamports_per_unit: price,
        amount_remaining: amount,
        mint,
    }
}

/// The two singletons nearly every instruction loads, with distinct mints.
struct World {
    authority: Pubkey,
    operator: Pubkey,
    guardian: Pubkey,
    treasury: Pubkey,
    config_key: Pubkey,
    config: Config,
    mm_key: Pubkey,
    mm: MaterialMints,
    auth_key: Pubkey,
}

impl World {
    fn new() -> Self {
        let (config_key, config_bump) = pda(&[CONFIG_SEED]);
        let (mm_key, mm_bump) = pda(&[MATERIAL_MINTS_SEED]);
        let authority = Pubkey::new_unique();
        let operator = Pubkey::new_unique();
        let guardian = Pubkey::new_unique();
        let treasury = Pubkey::new_unique();
        let k = Pubkey::new_unique;
        let config = Config {
            authority,
            treasury,
            food_mint: k(),
            wood_mint: k(),
            stone_mint: k(),
            seeds_mint: k(),
            water_mint: k(),
            potato_mint: k(),
            craft_fee: 0,
            unstake_fee: 0,
            paused: false,
            bump: config_bump,
            mining_enabled: false,
            pending_authority: Pubkey::default(),
            authority_updated_at: 0,
            operator,
            guardian,
            cashout_frozen: false,
            reserved: [0u8; 32],
        };
        let mm = MaterialMints {
            seeds: k(),
            wheat: k(),
            flour: k(),
            bread: k(),
            water: k(),
            coal: k(),
            meat: k(),
            stone_blue: k(),
            stone_purple: k(),
            stone_red: k(),
            sand_white: k(),
            sand_pink: k(),
            sand_yellow: k(),
            gem_blue: k(),
            gem_orange: k(),
            gem_white: k(),
            gem_green: k(),
            flask_blue: k(),
            flask_yellow: k(),
            flask_green: k(),
            flask_pink: k(),
            flask_purple: k(),
            love_heart: k(),
            bump: mm_bump,
            max_supply: [SUPPLY_CAP_UNLIMITED; RESOURCE_KIND_COUNT],
        };
        World {
            authority,
            operator,
            guardian,
            treasury,
            config_key,
            config,
            mm_key,
            mm,
            auth_key: pda(&[AUTH_SEED]).0,
        }
    }

    fn config_info(&self) -> AccountInfo<'static> {
        program_account(self.config_key, &self.config, CONFIG_SPACE)
    }

    fn mm_info(&self) -> AccountInfo<'static> {
        program_account(self.mm_key, &self.mm, MATERIAL_MINTS_SPACE)
    }

    fn auth_info(&self) -> AccountInfo<'static> {
        info(self.auth_key, false, 0, Vec::new(), anchor_lang::solana_program::system_program::ID, false)
    }
}

// ======================================================================
// Driving Anchor's generated account validation
// ======================================================================

type BumpsOf<T> = <T as anchor_lang::Bumps>::Bumps;

/// Run the generated `try_accounts` exactly as the program entrypoint does.
fn parse<T>(infos: Vec<AccountInfo<'static>>, ix_data: &[u8]) -> Result<(T, BumpsOf<T>)>
where
    T: anchor_lang::Bumps + anchor_lang::Accounts<'static, BumpsOf<T>>,
    BumpsOf<T>: Default,
{
    let mut remaining: &'static [AccountInfo<'static>] = Box::leak(infos.into_boxed_slice());
    let mut bumps = <BumpsOf<T> as Default>::default();
    let parsed = T::try_accounts(&crate::ID, &mut remaining, ix_data, &mut bumps, &mut BTreeSet::new())?;
    assert!(remaining.is_empty(), "fixture passes more accounts than the context declares");
    Ok((parsed, bumps))
}

fn validate<T>(infos: Vec<AccountInfo<'static>>, ix_data: &[u8]) -> Result<()>
where
    T: anchor_lang::Bumps + anchor_lang::Accounts<'static, BumpsOf<T>>,
    BumpsOf<T>: Default,
{
    parse::<T>(infos, ix_data).map(|_| ())
}

/// Assert the exact error name (Anchor `ErrorCode` or `AofError`) and return
/// the full error text for account-name assertions.
fn rejected(result: Result<()>, expected: &str) -> String {
    let err = match result {
        Ok(()) => panic!("expected {expected}, but the instruction was accepted"),
        Err(e) => e.to_string(),
    };
    assert!(err.contains(&format!("error_name: \"{expected}\"")), "expected {expected}, got: {err}");
    err
}

/// Which account the error is attributed to.
fn blames(err: &str, account: &str) -> bool {
    err.contains(&format!("AccountName(\"{account}\")"))
}

// ======================================================================
// A. Account validation  (#1 #2 #3 #4 #6 #12 #16 #22 #25 #28)
// ======================================================================

/// #3 signer check, #2/#20 `has_one`: admin instructions accept exactly the
/// stored authority's signature, and the handler then really writes state.
#[test]
fn admin_instruction_requires_the_stored_authority_signature() {
    runtime();
    let w = World::new();

    let err = rejected(
        validate::<SetFees>(vec![w.config_info(), wallet(w.authority, false)], &[]),
        "AccountNotSigner",
    );
    assert!(blames(&err, "authority"), "{err}");

    let err = rejected(
        validate::<SetFees>(vec![w.config_info(), wallet(Pubkey::new_unique(), true)], &[]),
        "Unauthorized",
    );
    assert!(blames(&err, "config"), "has_one lives on `config`: {err}");

    let (mut accounts, bumps) =
        parse::<SetFees>(vec![w.config_info(), wallet(w.authority, true)], &[]).unwrap();
    crate::instructions::set_fees::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), 7, 9)
        .unwrap();
    assert_eq!((accounts.config.craft_fee, accounts.config.unstake_fee), (7, 9));
}

/// #1 canonical PDA, #25 discriminator / type confusion, #6 uninitialized,
/// zero-filled and foreign-owned accounts in the `Config` slot.
#[test]
fn config_must_be_the_initialized_canonical_pda_of_this_program() {
    runtime();
    let w = World::new();
    let with_config = |config: AccountInfo<'static>| {
        validate::<SetFees>(vec![config, wallet(w.authority, true)], &[])
    };

    // #1: byte-identical Config, but at a keypair address instead of the PDA.
    let err = rejected(
        with_config(program_account(Pubkey::new_unique(), &w.config, CONFIG_SPACE)),
        "ConstraintSeeds",
    );
    assert!(blames(&err, "config"), "{err}");

    // #25: another account type of this very program where Config is expected.
    rejected(
        with_config(program_account(w.config_key, &player(w.authority), CONFIG_SPACE)),
        "AccountDiscriminatorMismatch",
    );

    // #6: never created / zero-filled / owned by another program.
    rejected(
        with_config(info(w.config_key, false, 0, Vec::new(), anchor_lang::solana_program::system_program::ID, false)),
        "AccountNotInitialized",
    );
    rejected(
        with_config(info(w.config_key, false, rent_exempt(CONFIG_SPACE), vec![0; CONFIG_SPACE], crate::ID, false)),
        "AccountDiscriminatorMismatch",
    );
    rejected(
        with_config(info(
            w.config_key,
            false,
            rent_exempt(CONFIG_SPACE),
            serialized(&w.config, CONFIG_SPACE),
            Pubkey::new_unique(),
            false,
        )),
        "AccountOwnedByWrongProgram",
    );
}

/// #4 program accounts are type-checked, #22 and nothing is created (no CPI)
/// before that check: account deserialization precedes every `init` block.
#[test]
fn fake_system_program_is_rejected_before_any_init_or_cpi() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let amount = 1_000_000u64.to_le_bytes();

    let fresh_tank = info(tank_key, false, 0, Vec::new(), anchor_lang::solana_program::system_program::ID, false);
    let impostor = executable_program(Pubkey::new_unique());
    let err = rejected(
        validate::<DepositGas>(vec![w.config_info(), wallet(user, true), fresh_tank, impostor], &amount),
        "InvalidProgramId",
    );
    assert!(blames(&err, "system_program"), "{err}");
    assert_eq!(cpi_calls(), 0, "create_account must not be attempted");

    // Control: the genuine System Program passes (existing tank, no create).
    let tank = program_account(tank_key, &gas_tank(user, 0, 0, 0), GASTANK_SPACE);
    validate::<DepositGas>(vec![w.config_info(), wallet(user, true), tank, system_program_info()], &amount)
        .unwrap();
}

/// #2 mint / token-account / PDA binding and #12 Token-2022 rejection on a
/// user-callable minting instruction.
#[test]
fn collect_flour_binds_mint_token_account_and_mill_to_the_signer() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let run = |signer: Pubkey,
               mill_owner: Pubkey,
               flour_mint: AccountInfo<'static>,
               user_flour: AccountInfo<'static>,
               token_program: AccountInfo<'static>| {
        let (mill_key, mill_bump) = pda(&[MILL_STATE_SEED, mill_owner.as_ref()]);
        let mill = MillState {
            owner: mill_owner,
            in_progress: true,
            ready_at: NOW_TS - 1,
            output_flour: 50,
            bump: mill_bump,
        };
        validate::<CollectFlour>(
            vec![
                w.config_info(),
                wallet(signer, true),
                w.mm_info(),
                program_account(mill_key, &mill, MILL_STATE_SPACE),
                w.auth_info(),
                flour_mint,
                user_flour,
                token_program,
            ],
            &[],
        )
    };
    let flour = || spl_mint(w.mm.flour, 0, Some(w.auth_key), None);
    let users_flour = || token_account(Pubkey::new_unique(), w.mm.flour, user, 0);

    run(user, user, flour(), users_flour(), token_program_info()).unwrap();

    let foreign_mint = spl_mint(Pubkey::new_unique(), 0, Some(w.auth_key), None);
    let err = rejected(run(user, user, foreign_mint, users_flour(), token_program_info()), "ConstraintAddress");
    assert!(blames(&err, "flour_mint"), "{err}");

    let someone_elses = token_account(Pubkey::new_unique(), w.mm.flour, Pubkey::new_unique(), 0);
    let err = rejected(run(user, user, flour(), someone_elses, token_program_info()), "ConstraintRaw");
    assert!(blames(&err, "user_flour"), "{err}");

    let other_token = token_account(Pubkey::new_unique(), w.mm.wheat, user, 0);
    let err = rejected(run(user, user, flour(), other_token, token_program_info()), "ConstraintRaw");
    assert!(blames(&err, "user_flour"), "{err}");

    // Another player's mill cannot be collected by a different signer.
    let victim = Pubkey::new_unique();
    let err = rejected(run(user, victim, flour(), users_flour(), token_program_info()), "ConstraintSeeds");
    assert!(blames(&err, "mill_state"), "{err}");

    // #12: Token-2022 mints (transfer-fee / non-transferable extensions) and
    // the Token-2022 program are refused outright.
    let t22_mint = mint_owned_by(token_2022_id(), w.mm.flour, 0, Some(w.auth_key), None);
    let err = rejected(run(user, user, t22_mint, users_flour(), token_program_info()), "AccountOwnedByWrongProgram");
    assert!(blames(&err, "flour_mint"), "{err}");
    let err = rejected(
        run(user, user, flour(), users_flour(), executable_program(token_2022_id())),
        "InvalidProgramId",
    );
    assert!(blames(&err, "token_program"), "{err}");
}

/// #28 the rent of a closed agreement is refunded to the renter who paid it,
/// never to whoever calls `rental_end`.
#[test]
fn rental_close_refund_is_bound_to_the_renter() {
    runtime();
    let w = World::new();
    let (owner, renter, stranger) = (Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique());
    let mint = Pubkey::new_unique();
    let tool_key = pda(&[TOOL_SEED, mint.as_ref()]).0;
    let agreement_key = pda(&[RENTAL_AGREEMENT_SEED, mint.as_ref()]).0;
    let rented = tool(mint, owner, renter, "neural_seeder");
    let agreement = RentalAgreement {
        mint,
        owner,
        renter,
        start: NOW_TS - 100,
        end: NOW_TS - 1,
        revoke_requested_at: 0,
    };
    let infos = |refund: Pubkey| {
        vec![
            w.config_info(),
            wallet(stranger, true),
            spl_mint(mint, 1, None, None),
            program_account(tool_key, &rented, TOOL_DATA_SPACE),
            program_account(agreement_key, &agreement, RENTAL_AGREEMENT_SPACE),
            wallet(refund, false),
        ]
    };

    let err = rejected(validate::<RentalEndCtx>(infos(stranger), &[]), "ConstraintAddress");
    assert!(blames(&err, "renter_refund"), "{err}");

    let (mut accounts, bumps) = parse::<RentalEndCtx>(infos(renter), &[]).unwrap();
    crate::instructions::rental::end_handler(Context::new(&crate::ID, &mut accounts, &[], bumps)).unwrap();
    assert_eq!(accounts.tool.operator, owner, "the operator right returns to the owner");
}

/// #11 / F-I: a tool NFT whose mint keeps a freeze authority can later be
/// frozen in a buyer's wallet or inside an auction escrow (which blocks the
/// settlement and locks the bidder's SOL). New tool mints must be unfreezable.
#[test]
fn tool_nft_mint_with_a_freeze_authority_is_rejected() {
    runtime();
    let w = World::new();
    let recipient = Pubkey::new_unique();
    let mint = Pubkey::new_unique();
    let tool_key = pda(&[TOOL_SEED, mint.as_ref()]).0;
    let blank = tool(mint, Pubkey::default(), Pubkey::default(), "");
    let mut ix = (b"plasma_cutter".len() as u32).to_le_bytes().to_vec();
    ix.extend_from_slice(b"plasma_cutter");
    ix.push(0); // Rarity::Common
    let with_freeze = |freeze_authority: Option<Pubkey>| {
        validate::<MintTool>(
            vec![
                w.config_info(),
                wallet(w.operator, true),
                w.auth_info(),
                spl_mint(mint, 0, Some(w.auth_key), freeze_authority),
                token_account(Pubkey::new_unique(), mint, recipient, 0),
                wallet(recipient, false),
                program_account(tool_key, &blank, TOOL_DATA_SPACE),
                token_program_info(),
                system_program_info(),
            ],
            &ix,
        )
    };

    with_freeze(None).unwrap();
    let err = rejected(with_freeze(Some(Pubkey::new_unique())), "InvalidMint");
    assert!(blames(&err, "mint"), "{err}");
}

/// #16 the gas-fee sweep can only pay the configured treasury, only on the
/// authority's signature.
#[test]
fn sweep_cannot_redirect_the_treasury() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let tank = || program_account(tank_key, &gas_tank(user, 0, 0, 0), GASTANK_SPACE);

    let err = rejected(
        validate::<SweepGasFees>(
            vec![w.config_info(), wallet(w.operator, true), tank(), wallet(Pubkey::new_unique(), false), system_program_info()],
            &[],
        ),
        "Unauthorized",
    );
    assert!(blames(&err, "treasury"), "{err}");

    let err = rejected(
        validate::<SweepGasFees>(
            vec![w.config_info(), wallet(Pubkey::new_unique(), true), tank(), wallet(w.treasury, false), system_program_info()],
            &[],
        ),
        "Unauthorized",
    );
    assert!(blames(&err, "config"), "{err}");
}

/// #2 a gas tank is bound to its owner through the PDA seeds.
#[test]
fn a_gas_tank_can_only_be_withdrawn_by_its_owner() {
    runtime();
    let w = World::new();
    let (victim, thief) = (Pubkey::new_unique(), Pubkey::new_unique());
    let tank_key = pda(&[GASTANK_SEED, victim.as_ref()]).0;
    let tank = program_account(tank_key, &gas_tank(victim, 10_000, 0, 0), GASTANK_SPACE);
    let err = rejected(
        validate::<WithdrawGas>(vec![w.config_info(), wallet(thief, true), tank, system_program_info()], &1u64.to_le_bytes()),
        "ConstraintSeeds",
    );
    assert!(blames(&err, "gastank"), "{err}");
}

// ======================================================================
// B. Vault brakes  (#16 #20, F-E)
// ======================================================================

const GUARD_CAP_PER_EPOCH: u64 = 100_000;
const VAULT_BALANCE: u64 = 1_000_000;

struct PayoutCase {
    amount: u64,
    /// Pay out a mint that is NOT a registered resource (e.g. a staked tool NFT).
    non_resource_mint: bool,
    /// The guard account belongs to another mint.
    guard_for_other_mint: bool,
    max_per_tx: u64,
    withdrawn_in_epoch: u64,
    /// The admin instead of the operator signs (roles are separated).
    admin_signs: bool,
    /// The cash-out freeze is on.
    cashout_frozen: bool,
}

impl Default for PayoutCase {
    fn default() -> Self {
        PayoutCase {
            amount: 10_000,
            non_resource_mint: false,
            guard_for_other_mint: false,
            max_per_tx: 50_000,
            withdrawn_in_epoch: 0,
            admin_signs: false,
            cashout_frozen: false,
        }
    }
}

/// Run the REAL `pay_out_with_referral` handler; returns (result, CPIs, guard).
fn referral_payout(case: PayoutCase) -> (Result<()>, usize, VaultGuard) {
    runtime();
    let mut w = World::new();
    w.config.cashout_frozen = case.cashout_frozen;
    let (referred, referrer) = (Pubkey::new_unique(), Pubkey::new_unique());
    let mint = if case.non_resource_mint { Pubkey::new_unique() } else { w.config.food_mint };
    let vault = pda(&[VAULT_SEED]).0;
    let (guard_key, guard_bump) = pda(&[VAULT_GUARD_SEED, mint.as_ref()]);
    let guard = VaultGuard {
        mint: if case.guard_for_other_mint { w.mm.wheat } else { mint },
        epoch_slots: 1_000,
        cap_per_epoch: GUARD_CAP_PER_EPOCH,
        max_per_tx: case.max_per_tx,
        epoch_start_slot: SLOT_NOW,
        withdrawn_in_epoch: case.withdrawn_in_epoch,
        lifetime_withdrawn: case.withdrawn_in_epoch as u128,
        bump: guard_bump,
    };
    let link = ReferralLink { referred, referrer, tier: 2, bound_at: 0 };
    let infos = vec![
        w.config_info(),
        wallet(if case.admin_signs { w.authority } else { w.operator }, true),
        info(vault, false, 0, Vec::new(), anchor_lang::solana_program::system_program::ID, false),
        spl_mint(mint, 10_000_000, Some(w.auth_key), None),
        token_account(Pubkey::new_unique(), mint, vault, VAULT_BALANCE),
        token_account(Pubkey::new_unique(), mint, referred, 0),
        program_account(pda(&[REFERRAL_LINK_SEED, referred.as_ref()]).0, &link, REFERRAL_LINK_SPACE),
        token_account(Pubkey::new_unique(), mint, referrer, 0),
        program_account(pda(&[PLAYER_SEED, referred.as_ref()]).0, &player(referred), PLAYER_SPACE),
        w.mm_info(),
        program_account(guard_key, &guard, VAULT_GUARD_SPACE),
        token_program_info(),
    ];
    let (mut accounts, bumps) = match parse::<PayOutWithReferral>(infos, &case.amount.to_le_bytes()) {
        Ok(parsed) => parsed,
        Err(e) => return (Err(e), cpi_calls(), guard),
    };
    let result = crate::instructions::referral::pay_out_with_referral_handler(
        Context::new(&crate::ID, &mut accounts, &[], bumps),
        case.amount,
    );
    (result, cpi_calls(), VaultGuard::clone(&accounts.vault_guard))
}

#[test]
fn referral_payout_cannot_move_a_non_resource_mint() {
    let (result, cpis, guard) = referral_payout(PayoutCase { non_resource_mint: true, ..PayoutCase::default() });
    rejected(result, "NotAResourceMint");
    assert_eq!(cpis, 0, "nothing may leave the vault");
    assert_eq!(guard.withdrawn_in_epoch, 0);
}

#[test]
fn referral_payout_rejects_a_guard_configured_for_another_mint() {
    let (result, cpis, _) = referral_payout(PayoutCase { guard_for_other_mint: true, ..PayoutCase::default() });
    rejected(result, "InvalidMint");
    assert_eq!(cpis, 0);
}

#[test]
fn referral_payout_is_bounded_by_the_vault_guard() {
    let (result, cpis, _) = referral_payout(PayoutCase { amount: 50_001, ..PayoutCase::default() });
    rejected(result, "VaultGuardLimitExceeded");
    assert_eq!(cpis, 0, "per-transaction ceiling");

    let (result, cpis, _) = referral_payout(PayoutCase { withdrawn_in_epoch: 95_000, ..PayoutCase::default() });
    rejected(result, "VaultGuardLimitExceeded");
    assert_eq!(cpis, 0, "per-epoch cap");

    let (result, cpis, _) =
        referral_payout(PayoutCase { amount: VAULT_BALANCE + 1, max_per_tx: u64::MAX, ..PayoutCase::default() });
    rejected(result, "VaultInsufficient");
    assert_eq!(cpis, 0);
}

#[test]
fn referral_payout_within_budget_charges_the_guard_before_transferring() {
    let (result, cpis, guard) = referral_payout(PayoutCase::default());
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(cpis, 2, "the user share and the referrer share");
    assert_eq!(guard.withdrawn_in_epoch, 10_000);
    assert_eq!(guard.lifetime_withdrawn, 10_000);
}

/// The brakes live in one function shared by `pay_out` and the referral
/// payout, so the two can no longer drift apart.
#[test]
fn vault_brakes_are_one_shared_gate() {
    let w = World::new();
    let resource = w.config.food_mint;
    let guard_for = |mint: Pubkey| VaultGuard {
        mint,
        epoch_slots: 1_000,
        cap_per_epoch: 3_000,
        max_per_tx: 1_000,
        epoch_start_slot: 0,
        withdrawn_in_epoch: 0,
        lifetime_withdrawn: 0,
        bump: 0,
    };

    let mut guard = guard_for(resource);
    let nft = Pubkey::new_unique();
    assert!(matches!(
        charge_vault_withdrawal(&w.config, &w.mm, &mut guard, &nft, 1, 10),
        Err(AofError::NotAResourceMint)
    ));
    let mut foreign = guard_for(w.mm.wheat);
    assert!(matches!(
        charge_vault_withdrawal(&w.config, &w.mm, &mut foreign, &resource, 1, 10),
        Err(AofError::InvalidMint)
    ));
    assert!(matches!(
        charge_vault_withdrawal(&w.config, &w.mm, &mut guard, &resource, 1_001, 10),
        Err(AofError::VaultGuardLimitExceeded)
    ));
    assert_eq!(guard.withdrawn_in_epoch, 0, "a rejected withdrawal consumes no budget");

    for _ in 0..3 {
        assert!(charge_vault_withdrawal(&w.config, &w.mm, &mut guard, &resource, 1_000, 10).is_ok());
    }
    assert!(matches!(
        charge_vault_withdrawal(&w.config, &w.mm, &mut guard, &resource, 1, 10),
        Err(AofError::VaultGuardLimitExceeded)
    ));

    for mint in [w.mm.wheat, w.mm.love_heart, w.config.potato_mint] {
        let mut g = guard_for(mint);
        assert!(charge_vault_withdrawal(&w.config, &w.mm, &mut g, &mint, 1, 10).is_ok());
    }
}

// ======================================================================
// C. Emission caps  (#11, F-F)
// ======================================================================

const TILE: u8 = 3;

struct HarvestOutcome {
    result: Result<()>,
    cpis: usize,
    durability: u8,
    energy: u8,
    tile_state: u8,
}

/// Run the REAL `harvest_wheat` handler: a Common neural_seeder on a ready
/// tile with 100 seeds yields 100 x 1.5 = 150 Synapse.
fn run_harvest(wheat_supply: u64, synapse_cap: u64) -> HarvestOutcome {
    run_harvest_with(wheat_supply, synapse_cap, false)
}

fn run_harvest_with(wheat_supply: u64, synapse_cap: u64, cashout_frozen: bool) -> HarvestOutcome {
    runtime();
    let mut w = World::new();
    w.config.cashout_frozen = cashout_frozen;
    w.mm.max_supply[ResourceKind::Synapse as usize] = synapse_cap;
    let user = Pubkey::new_unique();
    let tool_mint = Pubkey::new_unique();
    let (energy_key, energy_bump) = pda(&[ENERGY_ACCOUNT_SEED, user.as_ref()]);
    let (tile_key, tile_bump) = pda(&[FARM_TILE_SEED, user.as_ref(), &[TILE]]);
    let energy = EnergyAccount {
        owner: user,
        current: ENERGY_CAP,
        last_regen_at: NOW_TS,
        cap: ENERGY_CAP,
        bump: energy_bump,
    };
    let tile = FarmTile {
        owner: user,
        state: 2,
        planted_at: NOW_TS - 7_200,
        ready_at: NOW_TS - 1,
        seeds_amount: 100,
        bump: tile_bump,
    };
    let seeder = tool(tool_mint, user, user, "neural_seeder");
    let infos = vec![
        w.config_info(),
        wallet(user, true),
        w.mm_info(),
        program_account(energy_key, &energy, ENERGY_ACCOUNT_SPACE),
        program_account(tile_key, &tile, FARM_TILE_SPACE),
        program_account(pda(&[TOOL_SEED, tool_mint.as_ref()]).0, &seeder, TOOL_DATA_SPACE),
        w.auth_info(),
        spl_mint(w.mm.wheat, wheat_supply, Some(w.auth_key), None),
        token_account(Pubkey::new_unique(), w.mm.wheat, user, 0),
        token_program_info(),
        system_program_info(),
    ];
    let (mut accounts, bumps) = parse::<HarvestWheat>(infos, &[TILE]).unwrap();
    let result =
        crate::instructions::harvest_wheat::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), TILE);
    HarvestOutcome {
        result,
        cpis: cpi_calls(),
        durability: accounts.tool_data.durability,
        energy: accounts.energy_account.current,
        tile_state: accounts.farm_tile.state,
    }
}

#[test]
fn harvest_is_bounded_by_the_synapse_supply_cap() {
    let over = run_harvest(1_000, 1_149);
    rejected(over.result, "SupplyCapExceeded");
    assert_eq!(over.cpis, 0, "rejected before the mint CPI");
    assert_eq!((over.durability, over.energy, over.tile_state), (10, ENERGY_CAP, 2));

    let exact = run_harvest(1_000, 1_150);
    assert!(exact.result.is_ok(), "{:?}", exact.result);
    assert_eq!(exact.cpis, 1, "one mint CPI");
    assert_eq!((exact.durability, exact.energy, exact.tile_state), (9, ENERGY_CAP - 1, 0));

    let unlimited = run_harvest(1_000, SUPPLY_CAP_UNLIMITED);
    assert!(unlimited.result.is_ok(), "{:?}", unlimited.result);
}

// ======================================================================
// D. Lamport accounting  (#5 #13 #14 #15, F-A)
// ======================================================================

/// F-A: the sweep used a System Program transfer out of a data-carrying PDA,
/// which the runtime always refuses. It now moves exactly the fees and keeps
/// the user's balance, the user's sub-micro dust and the rent in the tank.
#[test]
fn sweep_moves_exactly_the_fees_and_never_user_funds() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let rent = rent_exempt(GASTANK_SPACE);
    let owed: u64 = 5_000 * MICROS_TO_LAMPORTS;
    let dust: u64 = 777;
    let fees: u64 = 123_456;
    let tank = program_account(tank_key, &gas_tank(user, 5_000, dust, 0), GASTANK_SPACE);
    set_lamports(&tank, rent + owed + dust + fees);
    let treasury = wallet(w.treasury, false);
    let sweep = |tank: &AccountInfo<'static>, treasury: &AccountInfo<'static>| {
        let (mut accounts, bumps) = parse::<SweepGasFees>(
            vec![w.config_info(), wallet(w.operator, true), tank.clone(), treasury.clone(), system_program_info()],
            &[],
        )
        .unwrap();
        crate::instructions::sweep_gas_fees::handler(Context::new(&crate::ID, &mut accounts, &[], bumps))
    };

    let result = sweep(&tank, &treasury);
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(tank.lamports(), rent + owed + dust, "balance, dust and rent stay with the user");
    assert_eq!(treasury.lamports(), WALLET_LAMPORTS + fees);
    assert_eq!(cpi_calls(), 0, "direct debit of a program-owned account, no System CPI");

    rejected(sweep(&tank, &treasury), "NoExcessToSweep");
    assert_eq!(tank.lamports(), rent + owed + dust);
}

struct Withdrawal {
    result: Result<()>,
    tank_lamports: u64,
    user_lamports: u64,
    tank: GasTank,
}

fn withdraw(balance_micros: u64, cooldown_until: i64, lamports_above_rent: u64, amount: u64) -> Withdrawal {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let tank = program_account(tank_key, &gas_tank(user, balance_micros, 0, cooldown_until), GASTANK_SPACE);
    set_lamports(&tank, rent_exempt(GASTANK_SPACE) + lamports_above_rent);
    let user_info = wallet(user, true);
    let (mut accounts, bumps) = parse::<WithdrawGas>(
        vec![w.config_info(), user_info.clone(), tank.clone(), system_program_info()],
        &amount.to_le_bytes(),
    )
    .unwrap();
    let result =
        crate::instructions::withdraw_gas::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), amount);
    Withdrawal {
        result,
        tank_lamports: tank.lamports(),
        user_lamports: user_info.lamports(),
        tank: GasTank::clone(&accounts.gastank),
    }
}

/// #5 rent exemption, #13/#14 checked arithmetic and conservation.
#[test]
fn withdraw_gas_conserves_lamports_and_keeps_the_tank_rent_exempt() {
    let rent = rent_exempt(GASTANK_SPACE);
    let micro = MICROS_TO_LAMPORTS;

    let ok = withdraw(10_000, 0, 10_000 * micro, 4_000);
    assert!(ok.result.is_ok(), "{:?}", ok.result);
    assert_eq!(ok.tank_lamports, rent + 6_000 * micro);
    assert_eq!(ok.user_lamports, WALLET_LAMPORTS + 4_000 * micro);
    assert_eq!(ok.tank.balance_micros, 6_000);
    assert_eq!(ok.tank.cooldown_until, 0, "small withdrawals stay instant");

    let over = withdraw(10_000, 0, 10_000 * micro, 10_001);
    rejected(over.result, "InsufficientBalance");
    assert_eq!(over.tank_lamports, rent + 10_000 * micro);

    // Logical balance larger than the lamports held: rent is still protected.
    let short = withdraw(10_000, 0, 5_000 * micro, 6_000);
    rejected(short.result, "RentExemptionFailed");
    assert_eq!(short.tank_lamports, rent + 5_000 * micro);

    let big = withdraw(300_000, 0, 300_000 * micro, 250_000);
    assert!(big.result.is_ok(), "{:?}", big.result);
    assert_eq!(big.tank.cooldown_until, NOW_TS + GASTANK_COOLDOWN_SECONDS);

    rejected(withdraw(10_000, NOW_TS + 60, 10_000 * micro, 1).result, "CooldownNotExpired");
    rejected(withdraw(10_000, 0, 10_000 * micro, 0).result, "ZeroAmount");
}

/// #13/#14/#15: a match conserves every lamport, fees round down and never
/// exceed the trade, and the buy escrow stays rent-exempt.
#[test]
fn order_matching_conserves_lamports_and_fees_stay_below_the_trade() {
    runtime();
    let w = World::new();
    let (buyer, seller) = (Pubkey::new_unique(), Pubkey::new_unique());
    let mint = w.config.food_mint; // canonical mint of ResourceKind::Data
    let buy_key = pda(&[RESOURCE_ORDER_SEED, buyer.as_ref(), mint.as_ref()]).0;
    let sell_key = pda(&[RESOURCE_ORDER_SEED, seller.as_ref(), mint.as_ref()]).0;
    let order_rent = rent_exempt(RESOURCE_ORDER_SPACE);
    let escrow: u64 = 10 * 1_000 + 10 * 1_000 * ORDERBOOK_TAKER_FEE_BPS as u64 / 10_000 + 1;

    let buy = program_account(buy_key, &resource_order(buyer, true, 1_000, 10, mint), RESOURCE_ORDER_SPACE);
    set_lamports(&buy, order_rent + escrow);
    let sell = program_account(sell_key, &resource_order(seller, false, 900, 4, mint), RESOURCE_ORDER_SPACE);
    let seller_wallet = wallet(seller, false);
    let treasury = wallet(w.treasury, false);
    let total_before = buy.lamports() + seller_wallet.lamports() + treasury.lamports();

    let (mut accounts, bumps) = parse::<MatchResourceOrders>(
        vec![
            w.config_info(),
            w.mm_info(),
            spl_mint(mint, 1_000, Some(w.auth_key), None),
            buy.clone(),
            sell.clone(),
            seller_wallet.clone(),
            treasury.clone(),
            token_account(Pubkey::new_unique(), mint, sell_key, 4),
            token_account(ata(&buyer, &mint), mint, buyer, 0),
            token_program_info(),
        ],
        &[],
    )
    .unwrap();
    let result = crate::instructions::orderbook::match_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    assert!(result.is_ok(), "{result:?}");

    let gross: u64 = 4 * 900; // executes at the resting sell price
    let taker = gross * ORDERBOOK_TAKER_FEE_BPS as u64 / 10_000;
    let maker = gross * ORDERBOOK_MAKER_FEE_BPS as u64 / 10_000;
    assert!(taker + maker <= gross, "fees never exceed the trade");
    assert_eq!(buy.lamports(), order_rent + escrow - gross - taker);
    assert_eq!(seller_wallet.lamports(), WALLET_LAMPORTS + gross - maker);
    assert_eq!(treasury.lamports(), WALLET_LAMPORTS + taker + maker);
    assert_eq!(
        buy.lamports() + seller_wallet.lamports() + treasury.lamports(),
        total_before,
        "no lamport created or destroyed"
    );
    assert!(buy.lamports() >= order_rent, "the buy escrow stays rent-exempt");
    assert_eq!((accounts.buy_order.amount_remaining, accounts.sell_order.amount_remaining), (6, 0));
    assert_eq!(cpi_calls(), 1, "one SPL transfer out of the sell escrow");
}

// ======================================================================
// E. Runtime  (#21 #29)
// ======================================================================

/// #29 the same order passed as both sides of a match is refused and moves
/// nothing (whether it is a buy or a sell order).
#[test]
fn an_order_cannot_be_matched_against_itself() {
    runtime();
    let w = World::new();
    let maker = Pubkey::new_unique();
    let mint = w.config.food_mint;
    let order_key = pda(&[RESOURCE_ORDER_SEED, maker.as_ref(), mint.as_ref()]).0;
    let funded = rent_exempt(RESOURCE_ORDER_SPACE) + 50_000;
    for is_buy in [true, false] {
        let same = program_account(order_key, &resource_order(maker, is_buy, 1_000, 10, mint), RESOURCE_ORDER_SPACE);
        set_lamports(&same, funded);
        let (mut accounts, bumps) = parse::<MatchResourceOrders>(
            vec![
                w.config_info(),
                w.mm_info(),
                spl_mint(mint, 1_000, Some(w.auth_key), None),
                same.clone(),
                same.clone(),
                wallet(maker, false),
                wallet(w.treasury, false),
                token_account(Pubkey::new_unique(), mint, order_key, 10),
                token_account(ata(&maker, &mint), mint, maker, 0),
                token_program_info(),
            ],
            &[],
        )
        .unwrap();
        let result = crate::instructions::orderbook::match_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
        rejected(result, "OrdersDoNotCross");
        assert_eq!(same.lamports(), funded);
        assert_eq!(cpi_calls(), 0);
    }
}

/// #21 every `*_SPACE` constant equals the serialized layout; the variable
/// sized `ToolData` fits its longest permitted `tool_type`.
#[test]
fn declared_account_space_matches_the_serialized_layout() {
    let w = World::new();
    let k = Pubkey::new_unique();
    assert_eq!(serialized_len(&w.config), CONFIG_SPACE);
    assert_eq!(serialized_len(&w.mm), MATERIAL_MINTS_SPACE);
    assert_eq!(serialized_len(&gas_tank(k, 1, 1, 1)), GASTANK_SPACE);
    assert_eq!(serialized_len(&player(k)), PLAYER_SPACE);
    assert_eq!(serialized_len(&resource_order(k, true, 1, 1, k)), RESOURCE_ORDER_SPACE);
    assert_eq!(
        serialized_len(&ReferralLink { referred: k, referrer: k, tier: 6, bound_at: 1 }),
        REFERRAL_LINK_SPACE
    );
    assert_eq!(
        serialized_len(&VaultGuard {
            mint: k,
            epoch_slots: 1,
            cap_per_epoch: 1,
            max_per_tx: 1,
            epoch_start_slot: 1,
            withdrawn_in_epoch: 1,
            lifetime_withdrawn: 1,
            bump: 1,
        }),
        VAULT_GUARD_SPACE
    );
    assert_eq!(serialized_len(&tool(k, k, k, &"x".repeat(32))), TOOL_DATA_SPACE);
    assert!(TOOL_KINDS.iter().all(|kind| kind.len() <= 32));
}

// ======================================================================
// F. Pause, fees, season pass, weather  (F-C, F-D, F-I follow-ups)
// ======================================================================

/// F-C: a pause stops new activity but never locks players out of their own
/// deposits — `withdraw_gas` is one of the exit paths that stay open.
#[test]
fn exits_stay_open_while_the_game_is_paused() {
    runtime();
    let mut w = World::new();
    w.config.paused = true;
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let rent = rent_exempt(GASTANK_SPACE);
    let tank = program_account(tank_key, &gas_tank(user, 10_000, 0, 0), GASTANK_SPACE);
    set_lamports(&tank, rent + 10_000 * MICROS_TO_LAMPORTS);
    let user_info = wallet(user, true);
    let (mut accounts, bumps) = parse::<WithdrawGas>(
        vec![w.config_info(), user_info.clone(), tank.clone(), system_program_info()],
        &4_000u64.to_le_bytes(),
    )
    .unwrap();
    crate::instructions::withdraw_gas::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), 4_000)
        .unwrap();
    assert_eq!(user_info.lamports(), WALLET_LAMPORTS + 4_000 * MICROS_TO_LAMPORTS);
    assert_eq!(tank.lamports(), rent + 6_000 * MICROS_TO_LAMPORTS);

    // ...while an entry such as a new deposit is still stopped.
    let err = rejected(
        validate::<DepositGas>(
            vec![w.config_info(), wallet(user, true), tank.clone(), system_program_info()],
            &1_000u64.to_le_bytes(),
        ),
        "Paused",
    );
    assert!(blames(&err, "config"), "{err}");
}

fn offer_accept_accounts(w: &World, freeze_authority: Option<Pubkey>) -> Vec<AccountInfo<'static>> {
    let (seller, buyer, mint) = (Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique());
    let offer = Offer { buyer, mint, price_lamports: 2_000_000, active: true };
    vec![
        w.config_info(),
        wallet(seller, true),
        spl_mint(mint, 1, None, freeze_authority),
        program_account(pda(&[TOOL_SEED, mint.as_ref()]).0, &tool(mint, seller, seller, "plasma_cutter"), TOOL_DATA_SPACE),
        program_account(pda(&[OFFER_SEED, mint.as_ref(), buyer.as_ref()]).0, &offer, OFFER_SPACE),
        wallet(buyer, false),
        wallet(w.treasury, false),
        token_account(Pubkey::new_unique(), mint, seller, 1),
        token_account(Pubkey::new_unique(), mint, buyer, 0),
        token_program_info(),
    ]
}

/// F-C / F-I: accepting an offer is a trade entry — it was the only trade path
/// a pause did not stop — and a freezable NFT is never traded.
#[test]
fn offer_accept_honours_the_pause_and_refuses_freezable_nfts() {
    runtime();
    let mut w = World::new();
    validate::<OfferAcceptCtx>(offer_accept_accounts(&w, None), &[]).unwrap();
    let err = rejected(
        validate::<OfferAcceptCtx>(offer_accept_accounts(&w, Some(Pubkey::new_unique())), &[]),
        "InvalidMint",
    );
    assert!(blames(&err, "mint"), "{err}");
    w.config.paused = true;
    let err = rejected(validate::<OfferAcceptCtx>(offer_accept_accounts(&w, None), &[]), "Paused");
    assert!(blames(&err, "config"), "{err}");
}

/// F-C: `set_fees` has hard ceilings; `unstake_fee = u64::MAX` used to make
/// every staked NFT impossible to unstake.
#[test]
fn set_fees_is_capped() {
    runtime();
    let w = World::new();
    let run = |craft_fee: u64, unstake_fee: u64| {
        let (mut accounts, bumps) =
            parse::<SetFees>(vec![w.config_info(), wallet(w.authority, true)], &[]).unwrap();
        crate::instructions::set_fees::handler(
            Context::new(&crate::ID, &mut accounts, &[], bumps),
            craft_fee,
            unstake_fee,
        )
    };
    assert!(run(MAX_CRAFT_FEE_MICROS, MAX_UNSTAKE_FEE_MICROS).is_ok());
    rejected(run(MAX_CRAFT_FEE_MICROS + 1, 0), "FeeTooHigh");
    rejected(run(0, MAX_UNSTAKE_FEE_MICROS + 1), "FeeTooHigh");
    rejected(run(0, u64::MAX), "FeeTooHigh");
}

const SEASON_ID: u32 = 7;

/// Run the REAL `purchase_season_pass` handler; returns (result, CPIs, premium).
fn season_pass_purchase(start_time: i64, already_premium: bool) -> (Result<()>, usize, bool) {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let id = SEASON_ID.to_le_bytes();
    let (season_key, season_bump) = pda(&[SEASON_SEED, &id]);
    let season = Season { season_id: SEASON_ID, start_time, bump: season_bump };
    let pass = SeasonPass { owner: user, season_id: SEASON_ID, xp: 0, premium: already_premium, claimed_bitmap: 0 };
    let infos = vec![
        w.config_info(),
        wallet(user, true),
        wallet(w.treasury, false),
        program_account(season_key, &season, SEASON_SPACE),
        program_account(pda(&[SEASON_PASS_SEED, user.as_ref(), &id]).0, &pass, SEASON_PASS_SPACE),
        system_program_info(),
    ];
    let (mut accounts, bumps) = parse::<PurchaseSeasonPass>(infos, &[]).unwrap();
    let result =
        crate::instructions::season::purchase_pass_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    (result, cpi_calls(), accounts.season_pass.premium)
}

/// A pass is charged once, and only while its season runs.
#[test]
fn season_pass_is_sold_once_and_only_during_its_season() {
    let (ok, cpis, premium) = season_pass_purchase(NOW_TS - 86_400, false);
    assert!(ok.is_ok(), "{ok:?}");
    assert_eq!((cpis, premium), (1, true), "one payment, flag set");

    let (again, cpis, _) = season_pass_purchase(NOW_TS - 86_400, true);
    rejected(again, "SeasonPassAlreadyPremium");
    assert_eq!(cpis, 0, "no second charge");

    rejected(season_pass_purchase(NOW_TS + 60, false).0, "SeasonNotStarted");
    rejected(season_pass_purchase(NOW_TS - SEASON_LENGTH_SECONDS, false).0, "SeasonEnded");
}

fn accrual(last: i64, now: i64) -> u64 {
    well_accrual(last, now).ok().expect("accrual overflow")
}

/// F-D: every second of the window is priced at the weather of its own day.
#[test]
fn well_accrual_prices_each_second_at_its_own_days_weather() {
    let day = (20_000u32..30_000)
        .find(|&d| weather_for_day(d) == WEATHER_FRENZY && weather_for_day(d - 1) == WEATHER_NOMINAL)
        .expect("a nominal day followed by a frenzy day");
    let boundary = day as i64 * 86_400;
    let half = 12 * 3_600;
    let fair = accrual(boundary - half, boundary + half);
    assert_eq!(fair, 12 * WELL_RATE_NOMINAL + 12 * WELL_RATE_FRENZY);
    assert!(fair < 24 * WELL_RATE_FRENZY, "the old rule paid frenzy for the whole window");

    assert_eq!(accrual(boundary - 5 * 86_400, boundary), accrual(boundary - 86_400, boundary), "24 h cap");
    assert_eq!(accrual(boundary, boundary), 0);
    assert_eq!(accrual(boundary + 1, boundary), 0);
}

/// The documented odds (10/50/30/10 %) hold, i.e. the fair rate is ~9/h.
#[test]
fn weather_distribution_matches_the_documented_odds() {
    let mut counts = [0u32; 4];
    for day in 0..20_000u32 {
        counts[weather_for_day(day) as usize] += 1;
    }
    // Expected 2 000 / 10 000 / 6 000 / 2 000 of 20 000 days, within 1 point.
    for (count, expected) in counts.iter().zip([2_000u32, 10_000, 6_000, 2_000]) {
        assert!(count.abs_diff(expected) <= 200, "{counts:?}");
    }
}

/// F-D end to end: a stale FRENZY cached in `weather_state` no longer decides
/// what the well pays; the REAL handler mints exactly `well_accrual`.
#[test]
fn collect_well_water_ignores_a_stale_cached_weather() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let last = NOW_TS - 10 * 3_600;
    let (well_key, well_bump) = pda(&[WELL_STATE_SEED, user.as_ref()]);
    let (weather_key, weather_bump) = pda(&[WEATHER_STATE_SEED]);
    let well = WellState { owner: user, water_buffer: 0, last_collected_at: last, bump: well_bump };
    let stale = WeatherState { day_id: 1, weather: WEATHER_FRENZY, updated_at: 86_400, bump: weather_bump };
    let mut villager = player(user);
    villager.villagers = 1;
    let infos = vec![
        w.config_info(),
        wallet(user, true),
        program_account(pda(&[PLAYER_SEED, user.as_ref()]).0, &villager, PLAYER_SPACE),
        w.mm_info(),
        program_account(well_key, &well, WELL_STATE_SPACE),
        program_account(weather_key, &stale, WEATHER_STATE_SPACE),
        w.auth_info(),
        spl_mint(w.mm.water, 0, Some(w.auth_key), None),
        token_account(Pubkey::new_unique(), w.mm.water, user, 0),
        token_program_info(),
        system_program_info(),
    ];
    let (mut accounts, bumps) = parse::<CollectWellWater>(infos, &[]).unwrap();
    let result =
        crate::instructions::collect_well_water::handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    assert!(result.is_ok(), "{result:?}");
    let expected = accrual(last, NOW_TS);
    assert_eq!(last_minted_amount(), expected);
    let today = (NOW_TS / 86_400) as u32;
    if weather_for_day(today) != WEATHER_FRENZY || weather_for_day(today - 1) != WEATHER_FRENZY {
        assert!(expected < 10 * WELL_RATE_FRENZY, "the stale frenzy rate was not applied");
    }
    assert_eq!(accounts.well_state.last_collected_at, NOW_TS);
}

// ======================================================================
// G. Roles, emergency switches, cash-out freeze, Config v2 migration  (F-C)
// ======================================================================

/// The operator runs routine operations only; the admin changes rules only.
#[test]
fn operator_and_admin_roles_are_separated() {
    runtime();
    let w = World::new();
    // The hot operator key cannot change a rule...
    let err = rejected(
        validate::<SetFees>(vec![w.config_info(), wallet(w.operator, true)], &[]),
        "Unauthorized",
    );
    assert!(blames(&err, "config"), "{err}");
    // ...and the admin no longer co-signs routine vault payouts.
    let (result, cpis, _) = referral_payout(PayoutCase { admin_signs: true, ..PayoutCase::default() });
    let err = rejected(result, "Unauthorized");
    assert!(blames(&err, "config"), "{err}");
    assert_eq!(cpis, 0);
    let (result, _, _) = referral_payout(PayoutCase::default());
    assert!(result.is_ok(), "{result:?}");
}

fn emergency(w: &World, caller: Pubkey, pause_game: bool, freeze_cashout: bool) -> (Result<()>, bool, bool) {
    let (mut accounts, bumps) = match parse::<EmergencyStop>(vec![w.config_info(), wallet(caller, true)], &[]) {
        Ok(parsed) => parsed,
        Err(e) => return (Err(e), false, false),
    };
    let result = crate::instructions::roles::emergency_stop_handler(
        Context::new(&crate::ID, &mut accounts, &[], bumps),
        pause_game,
        freeze_cashout,
    );
    (result, accounts.config.paused, accounts.config.cashout_frozen)
}

/// The guardian can only switch stops ON; clearing them is admin-only.
#[test]
fn guardian_can_only_switch_emergency_stops_on() {
    runtime();
    let w = World::new();
    let (ok, paused, frozen) = emergency(&w, w.guardian, false, true);
    assert!(ok.is_ok(), "{ok:?}");
    assert_eq!((paused, frozen), (false, true), "freeze cash-out, keep the game running");
    let (ok, paused, frozen) = emergency(&w, w.authority, true, false);
    assert!(ok.is_ok(), "{ok:?}");
    assert_eq!((paused, frozen), (true, false));
    rejected(emergency(&w, w.guardian, false, false).0, "InvalidAmount");
    let err = rejected(emergency(&w, w.operator, true, true).0, "Unauthorized");
    assert!(blames(&err, "config"), "{err}");

    // Clearing the freeze and assigning roles are admin-only.
    let mut frozen_world = World::new();
    frozen_world.config.cashout_frozen = true;
    let clear = |signer: Pubkey| -> Result<bool> {
        let (mut accounts, bumps) =
            parse::<SetCashoutFrozen>(vec![frozen_world.config_info(), wallet(signer, true)], &[])?;
        crate::instructions::roles::set_cashout_frozen_handler(
            Context::new(&crate::ID, &mut accounts, &[], bumps),
            false,
        )?;
        Ok(accounts.config.cashout_frozen)
    };
    let err = match clear(frozen_world.guardian) {
        Ok(_) => panic!("the guardian must not clear the freeze"),
        Err(e) => e.to_string(),
    };
    assert!(err.contains("error_name: \"Unauthorized\""), "{err}");
    assert_eq!(clear(frozen_world.authority).ok(), Some(false));

    let set_roles = |signer: Pubkey, operator: Pubkey, guardian: Pubkey| -> Result<(Pubkey, Pubkey)> {
        let (mut accounts, bumps) = parse::<SetRoles>(vec![w.config_info(), wallet(signer, true)], &[])?;
        crate::instructions::roles::set_roles_handler(
            Context::new(&crate::ID, &mut accounts, &[], bumps),
            operator,
            guardian,
        )?;
        Ok((accounts.config.operator, accounts.config.guardian))
    };
    let (new_op, new_guard) = (Pubkey::new_unique(), Pubkey::new_unique());
    assert!(set_roles(w.operator, new_op, new_guard).is_err(), "the operator cannot promote itself");
    assert!(set_roles(w.authority, Pubkey::default(), new_guard).is_err(), "roles must be set");
    assert_eq!(set_roles(w.authority, new_op, new_guard).ok(), Some((new_op, new_guard)));
}

/// "Fraudsters with an inflated balance must not withdraw it, but the game must
/// not suffer": the freeze blocks value leaving the game, not gameplay and not
/// the players' own exits.
#[test]
fn cashout_freeze_blocks_withdrawals_of_value_but_not_gameplay() {
    // Vault payouts and trades paying SOL out are frozen...
    let (result, cpis, _) = referral_payout(PayoutCase { cashout_frozen: true, ..PayoutCase::default() });
    rejected(result, "CashoutFrozen");
    assert_eq!(cpis, 0);
    runtime();
    let mut w = World::new();
    w.config.cashout_frozen = true;
    let err = rejected(validate::<OfferAcceptCtx>(offer_accept_accounts(&w, None), &[]), "CashoutFrozen");
    assert!(blames(&err, "config"), "{err}");

    // ...gameplay keeps running (harvest mints in-game resources)...
    let harvest = run_harvest_with(1_000, SUPPLY_CAP_UNLIMITED, true);
    assert!(harvest.result.is_ok(), "{:?}", harvest.result);

    // ...and a player can still take back their own gas deposit.
    runtime();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let tank = program_account(tank_key, &gas_tank(user, 10_000, 0, 0), GASTANK_SPACE);
    set_lamports(&tank, rent_exempt(GASTANK_SPACE) + 10_000 * MICROS_TO_LAMPORTS);
    let (mut accounts, bumps) = parse::<WithdrawGas>(
        vec![w.config_info(), wallet(user, true), tank, system_program_info()],
        &1_000u64.to_le_bytes(),
    )
    .unwrap();
    crate::instructions::withdraw_gas::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), 1_000)
        .unwrap();
}

/// Key preceded by the original data length, as in the runtime's serialized
/// input (`AccountInfo::original_data_len` reads the 4 bytes before the key).
#[repr(C)]
struct KeyWithLen {
    _pad: u32,
    original_len: u32,
    key: Pubkey,
}

/// An AccountInfo laid out like the runtime's input so that
/// `AccountInfo::realloc` is sound on the host: the current length sits in the
/// 8 bytes before the data and the buffer has room to grow.
fn runtime_like_info(key: Pubkey, signer: bool, lamports: u64, data: &[u8], owner: Pubkey, capacity: usize) -> AccountInfo<'static> {
    assert!(capacity >= data.len());
    let key_box: &'static KeyWithLen =
        Box::leak(Box::new(KeyWithLen { _pad: 0, original_len: data.len() as u32, key }));
    let words: &'static mut [u64] = Box::leak(vec![0u64; 1 + (capacity + 7) / 8].into_boxed_slice());
    words[0] = data.len() as u64;
    // SAFETY: the byte view starts right after the 8-byte length header and
    // stays inside the leaked, 8-byte-aligned allocation.
    let bytes: &'static mut [u8] = unsafe { std::slice::from_raw_parts_mut(words.as_mut_ptr().add(1) as *mut u8, capacity) };
    bytes[..data.len()].copy_from_slice(data);
    let (head, _room_to_grow) = bytes.split_at_mut(data.len());
    AccountInfo::new(&key_box.key, signer, true, Box::leak(Box::new(lamports)), head, Box::leak(Box::new(owner)), false, 0)
}

/// Config v2: the v1 account (a strict prefix) grows in place, every field is
/// preserved, both roles start as the current authority, and it runs once.
#[test]
fn migrate_config_v2_grows_a_v1_config_in_place() {
    runtime();
    let mut w = World::new();
    w.config.craft_fee = 123;
    w.config.unstake_fee = 45;
    w.config.mining_enabled = true;
    let v1_bytes = serialized(&w.config, CONFIG_SPACE)[..CONFIG_V1_SPACE].to_vec();
    let v1 = |signer: Pubkey| {
        let config = runtime_like_info(w.config_key, false, rent_exempt(CONFIG_V1_SPACE), &v1_bytes, crate::ID, CONFIG_SPACE + 64);
        (config.clone(), vec![config, wallet(signer, true), system_program_info()])
    };

    let (config, infos) = v1(w.authority);
    let (mut accounts, bumps) = parse::<MigrateConfigV2>(infos, &[]).unwrap();
    let result = crate::instructions::roles::migrate_config_v2_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(config.data_len(), CONFIG_SPACE);
    assert_eq!(cpi_calls(), 1, "rent top-up for the larger account");
    // AccountInfo is invariant in its lifetime, so Account::try_from needs a
    // `&'static AccountInfo<'static>` here: leak the (shared) handle.
    let config_ref: &'static AccountInfo<'static> = Box::leak(Box::new(config.clone()));
    let migrated: Account<Config> = Account::try_from(config_ref).unwrap();
    assert_eq!((migrated.operator, migrated.guardian, migrated.cashout_frozen), (w.authority, w.authority, false));
    assert_eq!((migrated.authority, migrated.treasury, migrated.craft_fee, migrated.unstake_fee), (w.authority, w.treasury, 123, 45));
    assert_eq!((migrated.food_mint, migrated.bump, migrated.mining_enabled), (w.config.food_mint, w.config.bump, true));

    // It cannot run twice...
    let (mut again, bumps) = parse::<MigrateConfigV2>(vec![config.clone(), wallet(w.authority, true), system_program_info()], &[]).unwrap();
    rejected(
        crate::instructions::roles::migrate_config_v2_handler(Context::new(&crate::ID, &mut again, &[], bumps)),
        "AlreadyInitialized",
    );
    // ...and only the stored authority may run it.
    let (_, infos) = v1(w.operator);
    let (mut stranger, bumps) = parse::<MigrateConfigV2>(infos, &[]).unwrap();
    rejected(
        crate::instructions::roles::migrate_config_v2_handler(Context::new(&crate::ID, &mut stranger, &[], bumps)),
        "Unauthorized",
    );
}

/// The v1 size is the historical on-chain layout.
#[test]
fn config_v1_space_is_the_historical_layout() {
    assert_eq!(CONFIG_V1_SPACE, 323);
    assert_eq!(CONFIG_SPACE, CONFIG_V1_SPACE + CONFIG_V2_EXTENSION);
}

// ======================================================================
// H. Auction limits and rental escrow  (F-G, F-H)
// ======================================================================

use crate::instructions::auction::next_min_bid;
use crate::instructions::rental::{rental_fee_split, rental_refund};

fn min_bid(current: u64, floor: u64) -> Option<u64> {
    next_min_bid(current, floor).ok()
}

/// F-G: every refund is >= 0.001 SOL (above an empty wallet's rent-exempt
/// minimum) and an outbid adds at least 5%.
#[test]
fn auction_bids_have_a_floor_and_a_real_increment() {
    assert!(AUCTION_MIN_BID_LAMPORTS > Rent::default().minimum_balance(0));
    assert_eq!(min_bid(0, 1), Some(AUCTION_MIN_BID_LAMPORTS), "legacy tiny minimums are floored");
    assert_eq!(min_bid(0, 5_000_000), Some(5_000_000));
    assert_eq!(min_bid(1_000_000, 1), Some(2_000_000), "step is at least 0.001 SOL");
    assert_eq!(min_bid(100_000_000, 1), Some(105_000_000), "step is at least 5%");
    assert_eq!(min_bid(u64::MAX - 1, 1), None, "no overflow");
}

fn auction_cancel_accounts(w: &World, current_bid: u64, signer_is_seller: bool) -> Vec<AccountInfo<'static>> {
    let (seller, mint) = (Pubkey::new_unique(), Pubkey::new_unique());
    let auction_key = pda(&[AUCTION_SEED, mint.as_ref()]).0;
    let auction = Auction {
        seller,
        mint,
        min_bid: AUCTION_MIN_BID_LAMPORTS,
        current_bid,
        current_bidder: if current_bid > 0 { Pubkey::new_unique() } else { seller },
        end_time: NOW_TS + 3_600,
        active: true,
    };
    let signer = if signer_is_seller { seller } else { Pubkey::new_unique() };
    vec![
        w.config_info(),
        wallet(signer, true),
        spl_mint(mint, 1, None, None),
        program_account(auction_key, &auction, AUCTION_SPACE),
        token_account(Pubkey::new_unique(), mint, auction_key, 1),
        token_account(Pubkey::new_unique(), mint, signer, 0),
        token_program_info(),
    ]
}

/// F-G: a seller can withdraw an auction nobody bid on (also during a pause:
/// it only returns their own NFT), never one that has a bid.
#[test]
fn auction_cancel_works_only_without_bids() {
    runtime();
    let mut w = World::new();
    let err = rejected(validate::<AuctionCancelCtx>(auction_cancel_accounts(&w, 2_000_000, true), &[]), "StillActive");
    assert!(blames(&err, "auction"), "{err}");
    rejected(validate::<AuctionCancelCtx>(auction_cancel_accounts(&w, 0, false), &[]), "Unauthorized");

    w.config.paused = true;
    let (mut accounts, bumps) = parse::<AuctionCancelCtx>(auction_cancel_accounts(&w, 0, true), &[]).unwrap();
    let result = crate::instructions::auction::cancel_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(cpi_calls(), 2, "NFT back to the seller, escrow closed");
    assert!(!accounts.auction.active);
}

/// F-H: the platform keeps >= 5% of every rental (legacy 100% splits
/// included) and an early revocation refunds the unused part pro rata.
#[test]
fn rental_fee_split_keeps_the_platform_share_and_refunds_pro_rata() {
    let split = |price: u64, secs: i64, bps: u16| rental_fee_split(price, secs, bps).ok();
    assert_eq!(split(3_600, 3_600, 10_000), Some((3_420, 180)), "100% owner split clamped to 95%");
    assert_eq!(split(3_600, 3_600, 8_000), Some((2_880, 720)));
    assert_eq!(split(3_600, 0, 8_000), None);
    assert_eq!(rental_refund(3_420, 0, 100, 25), 2_565);
    assert_eq!(rental_refund(3_420, 0, 100, 100), 0);
    assert_eq!(rental_refund(3_420, 100, 200, 50), 3_420, "not started yet: everything back");
}

const RENT_PRICE_PER_HOUR: u64 = 3_600;

fn rental_listing_value(owner: Pubkey, mint: Pubkey, owner_split_bps: u16) -> RentalListing {
    RentalListing {
        owner,
        mint,
        owner_split_bps,
        min_duration: RENTAL_MIN_DURATION_SECONDS,
        max_duration: RENTAL_MAX_DURATION_SECONDS,
        active: true,
        price_per_hour_lamports: RENT_PRICE_PER_HOUR,
    }
}

/// F-H: listing moves the NFT into the listing's escrow.
#[test]
fn rental_listing_escrows_the_nft() {
    runtime();
    let w = World::new();
    let (owner, mint) = (Pubkey::new_unique(), Pubkey::new_unique());
    let listing_key = pda(&[RENTAL_LISTING_SEED, mint.as_ref()]).0;
    let list = |owner_split_bps: u16| {
        let infos = vec![
            w.config_info(),
            wallet(owner, true),
            spl_mint(mint, 1, None, None),
            program_account(pda(&[TOOL_SEED, mint.as_ref()]).0, &tool(mint, owner, owner, "neural_seeder"), TOOL_DATA_SPACE),
            // Pre-created so the host `init` path can load it (the stubbed CPI creates nothing).
            program_account(listing_key, &rental_listing_value(Pubkey::default(), Pubkey::default(), 0), RENTAL_LISTING_SPACE),
            token_account(Pubkey::new_unique(), mint, owner, 1),
            token_account(Pubkey::new_unique(), mint, listing_key, 0),
            token_program_info(),
            system_program_info(),
        ];
        let mut ix = owner_split_bps.to_le_bytes().to_vec();
        ix.extend_from_slice(&RENTAL_MIN_DURATION_SECONDS.to_le_bytes());
        ix.extend_from_slice(&RENTAL_MAX_DURATION_SECONDS.to_le_bytes());
        let (mut accounts, bumps) = parse::<RentalListCtx>(infos, &ix).unwrap();
        let before = cpi_calls();
        let result = crate::instructions::rental::list_handler(
            Context::new(&crate::ID, &mut accounts, &[], bumps),
            owner_split_bps,
            RENTAL_MIN_DURATION_SECONDS,
            RENTAL_MAX_DURATION_SECONDS,
            RENT_PRICE_PER_HOUR,
        );
        (result, cpi_calls() - before, accounts.rental_listing.owner)
    };
    let (ok, cpis, listed_owner) = list(RENTAL_MAX_OWNER_SPLIT_BPS);
    assert!(ok.is_ok(), "{ok:?}");
    assert_eq!((cpis, listed_owner), (1, owner), "one SPL transfer into escrow");
    let (too_greedy, cpis, _) = list(RENTAL_MAX_OWNER_SPLIT_BPS + 1);
    rejected(too_greedy, "InvalidAmount");
    assert_eq!(cpis, 0);
}

fn rental_start_infos(w: &World, vault_amount: u64) -> (Vec<AccountInfo<'static>>, Pubkey, Pubkey) {
    let (owner, renter, mint) = (Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique());
    let listing_key = pda(&[RENTAL_LISTING_SEED, mint.as_ref()]).0;
    let infos = vec![
        w.config_info(),
        wallet(renter, true),
        spl_mint(mint, 1, None, None),
        program_account(pda(&[TOOL_SEED, mint.as_ref()]).0, &tool(mint, owner, owner, "neural_seeder"), TOOL_DATA_SPACE),
        // A legacy 100% owner split: the platform share must still be charged.
        program_account(listing_key, &rental_listing_value(owner, mint, 10_000), RENTAL_LISTING_SPACE),
        wallet(owner, false),
        wallet(w.treasury, false),
        program_account(
            pda(&[RENTAL_AGREEMENT_SEED, mint.as_ref()]).0,
            &RentalAgreement { mint, owner, renter, start: 0, end: 0, revoke_requested_at: 0 },
            RENTAL_AGREEMENT_SPACE,
        ),
        token_account(Pubkey::new_unique(), mint, listing_key, vault_amount),
        system_program_info(),
    ];
    (infos, owner, renter)
}

/// F-H: only an escrowed NFT can be rented, the renter's fee ceiling holds and
/// the platform share is charged even on a legacy 100% listing.
#[test]
fn only_escrowed_tools_can_be_rented_within_the_signed_fee() {
    runtime();
    let w = World::new();
    let day = 86_400i64;
    let (infos, _, _) = rental_start_infos(&w, 0);
    let err = rejected(validate::<RentalStartCtx>(infos, &day.to_le_bytes()), "NotActive");
    assert!(blames(&err, "rental_vault"), "{err}");

    let total = RENT_PRICE_PER_HOUR * 24; // 1 day at 3 600 lamports/h
    let start = |max_total_fee: u64| {
        let (infos, _, renter) = rental_start_infos(&w, 1);
        let (mut accounts, bumps) = parse::<RentalStartCtx>(infos, &day.to_le_bytes()).unwrap();
        let before = cpi_calls();
        let result = crate::instructions::rental::start_handler(
            Context::new(&crate::ID, &mut accounts, &[], bumps),
            day,
            max_total_fee,
        );
        (result, cpi_calls() - before, accounts.tool.operator == renter)
    };
    let (too_expensive, cpis, _) = start(total - 1);
    rejected(too_expensive, "PriceLimitExceeded");
    assert_eq!(cpis, 0);
    let (ok, cpis, rented) = start(total);
    assert!(ok.is_ok(), "{ok:?}");
    assert_eq!((cpis, rented), (2, true), "owner share + platform share, operator = renter");
    assert_eq!(last_system_transfer_lamports(), total * RENTAL_FEE_BPS as u64 / 10_000, "platform keeps 5%");
}

/// F-H: a listing can be withdrawn when it is not rented out; the escrowed NFT
/// returns to the tool's owner.
#[test]
fn a_rental_listing_can_be_withdrawn_when_not_rented() {
    runtime();
    let w = World::new();
    let delist = |rented: bool, caller_is_owner: bool| -> Result<()> {
        let (owner, mint) = (Pubkey::new_unique(), Pubkey::new_unique());
        let listing_key = pda(&[RENTAL_LISTING_SEED, mint.as_ref()]).0;
        let operator = if rented { Pubkey::new_unique() } else { owner };
        let caller = if caller_is_owner { owner } else { Pubkey::new_unique() };
        let infos = vec![
            w.config_info(),
            wallet(caller, true),
            spl_mint(mint, 1, None, None),
            program_account(pda(&[TOOL_SEED, mint.as_ref()]).0, &tool(mint, owner, operator, "neural_seeder"), TOOL_DATA_SPACE),
            program_account(listing_key, &rental_listing_value(owner, mint, 9_000), RENTAL_LISTING_SPACE),
            wallet(owner, false),
            token_account(Pubkey::new_unique(), mint, listing_key, 1),
            token_account(Pubkey::new_unique(), mint, owner, 0),
            token_program_info(),
        ];
        let (mut accounts, bumps) = parse::<RentalDelistCtx>(infos, &[])?;
        crate::instructions::rental::delist_handler(Context::new(&crate::ID, &mut accounts, &[], bumps))
    };
    let err = rejected(delist(true, true), "StillActive");
    assert!(blames(&err, "tool"), "{err}");
    rejected(delist(false, false), "Unauthorized");
    let before = cpi_calls();
    assert!(delist(false, true).is_ok());
    assert_eq!(cpi_calls() - before, 2, "NFT back to the owner, escrow closed");
}

/// F-H: revoking after the grace period refunds the owner's share of the
/// unused time and closes the agreement to the renter.
#[test]
fn early_revocation_refunds_the_unused_time() {
    runtime();
    let w = World::new();
    let (owner, renter, mint) = (Pubkey::new_unique(), Pubkey::new_unique(), Pubkey::new_unique());
    let (start, end) = (NOW_TS - 86_400, NOW_TS + 86_400);
    let agreement = RentalAgreement { mint, owner, renter, start, end, revoke_requested_at: NOW_TS - RENTAL_REVOKE_GRACE_SECONDS - 1 };
    let agreement_key = pda(&[RENTAL_AGREEMENT_SEED, mint.as_ref()]).0;
    // The handler closes the agreement itself (AccountInfo::realloc): use a
    // runtime-like buffer.
    let agreement_info = runtime_like_info(
        agreement_key, false, rent_exempt(RENTAL_AGREEMENT_SPACE),
        &serialized(&agreement, RENTAL_AGREEMENT_SPACE), crate::ID, RENTAL_AGREEMENT_SPACE,
    );
    let renter_info = wallet(renter, false);
    let infos = vec![
        w.config_info(),
        wallet(owner, true),
        spl_mint(mint, 1, None, None),
        program_account(pda(&[TOOL_SEED, mint.as_ref()]).0, &tool(mint, owner, renter, "neural_seeder"), TOOL_DATA_SPACE),
        agreement_info.clone(),
        renter_info.clone(),
        program_account(pda(&[RENTAL_LISTING_SEED, mint.as_ref()]).0, &rental_listing_value(owner, mint, 9_000), RENTAL_LISTING_SPACE),
        system_program_info(),
    ];
    let (mut accounts, bumps) = parse::<RentalRevokeCtx>(infos, &[]).unwrap();
    let result = crate::instructions::rental::revoke_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    assert!(result.is_ok(), "{result:?}");
    let (owner_share, _) = rental_fee_split(RENT_PRICE_PER_HOUR, end - start, 9_000).ok().unwrap();
    assert_eq!(last_system_transfer_lamports(), owner_share / 2, "half the rental was unused");
    assert_eq!(accounts.tool.operator, owner);
    assert_eq!(agreement_info.lamports(), 0, "agreement closed");
    assert_eq!(renter_info.lamports(), WALLET_LAMPORTS + rent_exempt(RENTAL_AGREEMENT_SPACE), "its rent went to the renter");
}

// ======================================================================
// I. Second checklist (items 31-70): ATA, VRF, duplication, invariants
// ======================================================================

/// #33: the canonical ATA is exactly the ATA program's PDA of (owner, token
/// program, mint); anything else is refused where a third party picks the
/// destination.
#[test]
fn canonical_ata_matches_the_associated_token_program_derivation() {
    let (owner, mint) = (Pubkey::new_unique(), Pubkey::new_unique());
    let expected = Pubkey::find_program_address(
        &[owner.as_ref(), anchor_spl::token::ID.as_ref(), mint.as_ref()],
        &anchor_spl::associated_token::ID,
    )
    .0;
    assert!(is_canonical_ata(&expected, &owner, &mint));
    assert!(!is_canonical_ata(&Pubkey::new_unique(), &owner, &mint));
    assert!(!is_canonical_ata(&expected, &Pubkey::new_unique(), &mint), "another owner's ATA");
}

/// #33: a permissionless matcher can no longer park the buyer's resources in a
/// non-canonical token account.
#[test]
fn order_matching_requires_the_buyers_canonical_ata() {
    runtime();
    let w = World::new();
    let (buyer, seller) = (Pubkey::new_unique(), Pubkey::new_unique());
    let mint = w.config.food_mint;
    let buy_key = pda(&[RESOURCE_ORDER_SEED, buyer.as_ref(), mint.as_ref()]).0;
    let sell_key = pda(&[RESOURCE_ORDER_SEED, seller.as_ref(), mint.as_ref()]).0;
    let infos = |buyer_token: Pubkey| {
        vec![
            w.config_info(),
            w.mm_info(),
            spl_mint(mint, 1_000, Some(w.auth_key), None),
            program_account(buy_key, &resource_order(buyer, true, 1_000, 10, mint), RESOURCE_ORDER_SPACE),
            program_account(sell_key, &resource_order(seller, false, 900, 4, mint), RESOURCE_ORDER_SPACE),
            wallet(seller, false),
            wallet(w.treasury, false),
            token_account(Pubkey::new_unique(), mint, sell_key, 4),
            token_account(buyer_token, mint, buyer, 0),
            token_program_info(),
        ]
    };
    let err = rejected(validate::<MatchResourceOrders>(infos(Pubkey::new_unique()), &[]), "NonCanonicalTokenAccount");
    assert!(blames(&err, "buyer_token"), "{err}");
    validate::<MatchResourceOrders>(infos(ata(&buyer, &mint)), &[]).unwrap();
}

// ---------------------------------------------------------------- VRF (#36/#37, F-06)

use crate::vrf::{
    self as vrfmod, derive_roll, load_randomness, parse_randomness, Randomness, VrfRevealParams,
    RANDOMNESS_ACCOUNT_DISCRIMINATOR, RANDOMNESS_ACCOUNT_LEN, RANDOMNESS_COMMIT_IX_DISCRIMINATOR,
    RANDOMNESS_INIT_IX_DISCRIMINATOR, RANDOMNESS_REVEAL_IX_DISCRIMINATOR, SWITCHBOARD_PROGRAM_ID, SWITCHBOARD_QUEUE,
};

const SB_ACCOUNT_SPACE: usize = 480;

/// Oracle every fixture randomness account is assigned to.
const ORACLE: Pubkey = Pubkey::new_from_array([0xab; 32]);

fn randomness_bytes(authority: Pubkey, queue: Pubkey, seed_slot: u64, reveal_slot: u64, value: [u8; 32]) -> Vec<u8> {
    let mut data = vec![0u8; SB_ACCOUNT_SPACE];
    data[..8].copy_from_slice(&RANDOMNESS_ACCOUNT_DISCRIMINATOR);
    data[8..40].copy_from_slice(authority.as_ref());
    data[40..72].copy_from_slice(queue.as_ref());
    data[104..112].copy_from_slice(&seed_slot.to_le_bytes());
    data[112..144].copy_from_slice(ORACLE.as_ref());
    data[144..152].copy_from_slice(&reveal_slot.to_le_bytes());
    data[152..184].copy_from_slice(&value);
    data
}

fn vrf_authority_key() -> Pubkey {
    pda(&[VRF_AUTHORITY_SEED]).0
}

/// A pool randomness account as `vrf_pool_add` leaves it (plus a previous round).
fn pool_randomness(key: Pubkey, seed_slot: u64, reveal_slot: u64) -> AccountInfo<'static> {
    info(
        key,
        false,
        rent_exempt(SB_ACCOUNT_SPACE),
        randomness_bytes(vrf_authority_key(), SWITCHBOARD_QUEUE, seed_slot, reveal_slot, [0; 32]),
        SWITCHBOARD_PROGRAM_ID,
        false,
    )
}

fn vrf_slot_state(randomness: Pubkey, lock: Pubkey) -> (Pubkey, VrfSlot) {
    let (key, bump) = pda(&[VRF_SLOT_SEED, randomness.as_ref()]);
    (key, VrfSlot { randomness, index: 0, lock, locked_at_slot: 0, retired: false, commits: 0, reveals: 0, bump })
}

fn sb_program() -> AccountInfo<'static> {
    executable_program(SWITCHBOARD_PROGRAM_ID)
}

fn plain(key: Pubkey) -> AccountInfo<'static> {
    info(key, false, 1, Vec::new(), Pubkey::new_unique(), false)
}

fn params_with(value: [u8; 32]) -> VrfRevealParams {
    VrfRevealParams { signature: [7u8; 64], recovery_id: 1, value }
}

/// Layout, owner and discriminator checks of the Switchboard account.
#[test]
fn switchboard_randomness_accounts_are_verified_before_use() {
    let value = [7u8; 32];
    let authority = Pubkey::new_unique();
    let parsed = parse_randomness(&randomness_bytes(authority, SWITCHBOARD_QUEUE, 100, 101, value)).ok();
    assert_eq!(parsed.map(|r| (r.authority, r.queue, r.seed_slot, r.reveal_slot, r.value)),
        Some((authority, SWITCHBOARD_QUEUE, 100, 101, value)));
    let mut wrong_disc = randomness_bytes(authority, SWITCHBOARD_QUEUE, 100, 101, value);
    wrong_disc[0] ^= 1;
    assert!(parse_randomness(&wrong_disc).is_err());
    assert!(parse_randomness(&randomness_bytes(authority, SWITCHBOARD_QUEUE, 100, 101, value)[..RANDOMNESS_ACCOUNT_LEN - 1]).is_err(), "short data");
    // The legacy 408-byte layout still parses (the prefix is shared).
    assert!(parse_randomness(&randomness_bytes(authority, SWITCHBOARD_QUEUE, 1, 2, value)[..RANDOMNESS_ACCOUNT_LEN]).is_ok());

    let key = Pubkey::new_unique();
    let genuine = info(key, false, 1, randomness_bytes(authority, SWITCHBOARD_QUEUE, 5, 0, value), SWITCHBOARD_PROGRAM_ID, false);
    assert_eq!(load_randomness(&genuine).ok().map(|r: Randomness| r.seed_slot), Some(5));
    let forged = info(key, false, 1, randomness_bytes(authority, SWITCHBOARD_QUEUE, 5, 0, value), Pubkey::new_unique(), false);
    assert!(load_randomness(&forged).is_err(), "same bytes, wrong owner");
}

/// The three Switchboard CPIs are byte-for-byte the published sb_on_demand
/// interface: program, account order, signer/writable flags, data layout.
#[test]
fn switchboard_cpi_encoding_matches_the_pinned_idl() {
    let [r, q, o, a, p, st, esc, ps, ls, lut] = [(); 10].map(|_| Pubkey::new_unique());
    let flags = |ix: &Instruction| ix.accounts.iter().map(|m| (m.pubkey, m.is_signer, m.is_writable)).collect::<Vec<_>>();

    let commit = vrfmod::commit_instruction(r, q, o, a);
    assert_eq!(commit.program_id, SWITCHBOARD_PROGRAM_ID);
    assert_eq!(commit.data, RANDOMNESS_COMMIT_IX_DISCRIMINATOR.to_vec(), "empty RandomnessCommitParams");
    assert_eq!(flags(&commit), vec![
        (r, false, true), (q, false, false), (o, false, true),
        (crate::randomness::SLOT_HASHES_ID, false, false), (a, true, false),
    ]);

    let params = VrfRevealParams { signature: [3u8; 64], recovery_id: 2, value: [9u8; 32] };
    let reveal = vrfmod::reveal_instruction(r, o, q, st, a, p, esc, ps, &params);
    assert_eq!(reveal.program_id, SWITCHBOARD_PROGRAM_ID);
    assert_eq!(reveal.data.len(), 8 + 64 + 1 + 32);
    assert_eq!(&reveal.data[..8], &RANDOMNESS_REVEAL_IX_DISCRIMINATOR);
    assert_eq!(&reveal.data[8..72], &[3u8; 64][..]);
    assert_eq!(reveal.data[72], 2);
    assert_eq!(&reveal.data[73..], &[9u8; 32][..]);
    assert_eq!(flags(&reveal), vec![
        (r, false, true), (o, false, false), (q, false, false), (st, false, true), (a, true, false),
        (p, true, true), (crate::randomness::SLOT_HASHES_ID, false, false),
        (anchor_lang::solana_program::system_program::ID, false, false), (esc, false, true),
        (anchor_spl::token::ID, false, false), (anchor_spl::token::spl_token::native_mint::ID, false, false),
        (ps, false, false),
    ]);

    let init = vrfmod::init_instruction(r, esc, a, q, p, ps, ls, lut, 777);
    assert_eq!(&init.data[..8], &RANDOMNESS_INIT_IX_DISCRIMINATOR);
    assert_eq!(&init.data[8..], &777u64.to_le_bytes());
    assert_eq!(flags(&init), vec![
        (r, true, true), (esc, false, true), (a, true, false), (q, false, true), (p, true, true),
        (anchor_lang::solana_program::system_program::ID, false, false), (anchor_spl::token::ID, false, false),
        (anchor_spl::associated_token::ID, false, false), (anchor_spl::token::spl_token::native_mint::ID, false, false),
        (ps, false, false), (ls, false, false), (lut, false, true),
        (vrfmod::ADDRESS_LOOKUP_TABLE_PROGRAM_ID, false, false),
    ]);
    // Discriminators are Anchor's global namespace hashes of the IDL names.
    for (name, disc) in [("randomness_commit", RANDOMNESS_COMMIT_IX_DISCRIMINATOR),
        ("randomness_reveal", RANDOMNESS_REVEAL_IX_DISCRIMINATOR), ("randomness_init", RANDOMNESS_INIT_IX_DISCRIMINATOR)] {
        let h = anchor_lang::solana_program::hash::hash(format!("global:{name}").as_bytes()).to_bytes();
        assert_eq!(&h[..8], &disc, "{name}");
    }
    assert_eq!(SWITCHBOARD_PROGRAM_ID.to_string(), "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv");
    assert_eq!(SWITCHBOARD_QUEUE.to_string(), "A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w");
    assert_eq!(vrfmod::ADDRESS_LOOKUP_TABLE_PROGRAM_ID.to_string(), "AddressLookupTab1e1111111111111111111111111");
    assert_eq!(vrfmod::SWITCHBOARD_ON_DEMAND_DEVNET.to_string(), "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");
    assert_eq!(vrfmod::SWITCHBOARD_QUEUE_DEVNET.to_string(), "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
}

fn commit_accounts(randomness: &AccountInfo<'static>) -> vrfmod::CommitAccounts<'static> {
    vrfmod::CommitAccounts {
        switchboard_program: sb_program(),
        randomness: randomness.clone(),
        queue: plain(SWITCHBOARD_QUEUE),
        oracle: plain(Pubkey::new_unique()),
        recent_slothashes: plain(crate::randomness::SLOT_HASHES_ID),
        vrf_authority: plain(vrf_authority_key()),
    }
}

fn reveal_accounts(randomness: &AccountInfo<'static>, payer: &AccountInfo<'static>) -> vrfmod::RevealAccounts<'static> {
    vrfmod::RevealAccounts {
        switchboard_program: sb_program(),
        randomness: randomness.clone(),
        oracle: plain(Pubkey::new_unique()),
        queue: plain(SWITCHBOARD_QUEUE),
        stats: plain(Pubkey::new_unique()),
        vrf_authority: plain(vrf_authority_key()),
        payer: payer.clone(),
        recent_slothashes: plain(crate::randomness::SLOT_HASHES_ID),
        system_program: system_program_info(),
        reward_escrow: plain(Pubkey::new_unique()),
        token_program: token_program_info(),
        wrapped_sol_mint: plain(anchor_spl::token::spl_token::native_mint::ID),
        program_state: plain(Pubkey::new_unique()),
    }
}

/// The pool lifecycle: one commit per slot, seeded by Switchboard in the same
/// instruction; only the holder reveals, only inside the window, and the value
/// is read back from the account; refunds only after the window.
#[test]
fn vrf_pool_slot_lifecycle_is_one_shot_and_time_separated() {
    runtime();
    let bump = pda(&[VRF_AUTHORITY_SEED]).1;
    let rkey = Pubkey::new_unique();
    let randomness = pool_randomness(rkey, 10, 11);
    let holder = Pubkey::new_unique();
    let (_, mut slot) = vrf_slot_state(rkey, Pubkey::default());

    // Busy / retired / foreign randomness / foreign authority / foreign queue.
    let (_, mut busy) = vrf_slot_state(rkey, Pubkey::new_unique());
    rejected(vrfmod::commit(&mut busy, holder, &commit_accounts(&randomness), bump, SLOT_NOW).map(|_| ()), "VrfSlotBusy");
    let (_, mut retired) = vrf_slot_state(rkey, Pubkey::default());
    retired.retired = true;
    rejected(vrfmod::commit(&mut retired, holder, &commit_accounts(&randomness), bump, SLOT_NOW).map(|_| ()), "VrfSlotRetired");
    let other = pool_randomness(Pubkey::new_unique(), 10, 11);
    rejected(vrfmod::commit(&mut slot, holder, &commit_accounts(&other), bump, SLOT_NOW).map(|_| ()), "InvalidRandomnessAccount");
    let foreign_authority = info(rkey, false, 1,
        randomness_bytes(Pubkey::new_unique(), SWITCHBOARD_QUEUE, 10, 11, [0; 32]), SWITCHBOARD_PROGRAM_ID, false);
    rejected(vrfmod::commit(&mut slot, holder, &commit_accounts(&foreign_authority), bump, SLOT_NOW).map(|_| ()), "InvalidRandomnessAccount");
    let foreign_queue = info(rkey, false, 1,
        randomness_bytes(vrf_authority_key(), Pubkey::new_unique(), 10, 11, [0; 32]), SWITCHBOARD_PROGRAM_ID, false);
    rejected(vrfmod::commit(&mut slot, holder, &commit_accounts(&foreign_queue), bump, SLOT_NOW).map(|_| ()), "InvalidRandomnessAccount");
    assert!(switchboard_cpis().is_empty(), "nothing reached Switchboard before the checks passed");

    // A commit that did not re-seed the account is rejected.
    SB_MODE.with(|m| m.set(SB_STALE_COMMIT));
    rejected(vrfmod::commit(&mut slot, holder, &commit_accounts(&randomness), bump, SLOT_NOW).map(|_| ()), "RandomnessNotFresh");
    assert_eq!(slot.lock, Pubkey::default());
    SB_MODE.with(|m| m.set(SB_HONEST));

    // Honest commit: seeded on the previous slot, locked to the holder, signed
    // by the program PDA only.
    let seed = vrfmod::commit(&mut slot, holder, &commit_accounts(&randomness), bump, SLOT_NOW).unwrap();
    assert_eq!(seed, SLOT_NOW - 1);
    assert_eq!(slot.lock, holder);
    let sb = switchboard_cpis();
    let last = sb.last().unwrap();
    assert_eq!(&last.data[..8], &RANDOMNESS_COMMIT_IX_DISCRIMINATOR);
    assert_eq!(last.signer_seeds, vec![vec![VRF_AUTHORITY_SEED.to_vec(), vec![bump]]]);
    rejected(vrfmod::commit(&mut slot, Pubkey::new_unique(), &commit_accounts(&randomness), bump, SLOT_NOW).map(|_| ()), "VrfSlotBusy");

    // Reveal: holder only, window only, value read back.
    let cranker = wallet(Pubkey::new_unique(), true);
    let v = [0x5au8; 32];
    rejected(vrfmod::reveal(&mut slot, &Pubkey::new_unique(), &rkey, seed, SLOT_NOW, &reveal_accounts(&randomness, &cranker),
        &params_with(v), bump, SLOT_NOW).map(|_| ()), "VrfSlotNotHeld");
    rejected(vrfmod::reveal(&mut slot, &holder, &rkey, seed, SLOT_NOW - VRF_REFUND_AFTER_SLOTS, &reveal_accounts(&randomness, &cranker),
        &params_with(v), bump, SLOT_NOW).map(|_| ()), "RevealWindowClosed");
    rejected(vrfmod::reveal(&mut slot, &holder, &rkey, seed + 1, SLOT_NOW, &reveal_accounts(&randomness, &cranker),
        &params_with(v), bump, SLOT_NOW).map(|_| ()), "RandomnessNotFresh");
    assert_eq!(slot.lock, holder, "a failed reveal keeps the lock");
    SB_MODE.with(|m| m.set(SB_SWAPPED_VALUE));
    rejected(vrfmod::reveal(&mut slot, &holder, &rkey, seed, SLOT_NOW, &reveal_accounts(&randomness, &cranker),
        &params_with(v), bump, SLOT_NOW).map(|_| ()), "RandomnessNotRevealed");
    SB_MODE.with(|m| m.set(SB_HONEST));
    let got = vrfmod::reveal(&mut slot, &holder, &rkey, seed, SLOT_NOW, &reveal_accounts(&randomness, &cranker),
        &params_with(v), bump, SLOT_NOW).unwrap();
    assert_eq!(got, v);
    assert_eq!(slot.lock, Pubkey::default(), "the settled slot is free again");
    let reveal_cpi = switchboard_cpis().last().unwrap().clone();
    assert_eq!(&reveal_cpi.data[..8], &RANDOMNESS_REVEAL_IX_DISCRIMINATOR);
    assert_eq!(reveal_cpi.accounts[5].pubkey, *cranker.key, "the settler pays Switchboard");
    rejected(vrfmod::reveal(&mut slot, &holder, &rkey, seed, SLOT_NOW, &reveal_accounts(&randomness, &cranker),
        &params_with(v), bump, SLOT_NOW).map(|_| ()), "VrfSlotNotHeld");

    // Refund: never inside the window, exactly from its end.
    let (_, mut held) = vrf_slot_state(rkey, holder);
    let committed = SLOT_NOW - VRF_REFUND_AFTER_SLOTS + 1;
    rejected(vrfmod::release_for_refund(&mut held, &holder, committed, SLOT_NOW), "CommitNotExpired");
    assert!(vrfmod::reveal_window_open(committed, SLOT_NOW));
    assert!(!vrfmod::reveal_window_open(committed - 1, SLOT_NOW) && vrfmod::refund_window_open(committed - 1, SLOT_NOW));
    rejected(vrfmod::release_for_refund(&mut held, &Pubkey::new_unique(), committed - 1, SLOT_NOW), "VrfSlotNotHeld");
    vrfmod::release_for_refund(&mut held, &holder, committed - 1, SLOT_NOW).unwrap();
    assert_eq!(held.lock, Pubkey::default());
}

/// Cross-language vector: docs/ECONOMY_RNG_EV.md publishes the outcome formula
/// and scripts/vrf/devnet-smoke.mjs (plus tests/readiness/vrf-smoke.test.cjs)
/// recompute it in JavaScript. These exact numbers are asserted on both sides.
#[test]
fn vrf_roll_matches_the_published_javascript_vector() {
    let value = [7u8; 32];
    let commit = Pubkey::new_from_array([9u8; 32]);
    let roll = derive_roll(&value, b"pack", commit.as_ref());
    let hex: String = roll.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hex, "88acec04a70c78304cf18b01bcb04ce09b677358bb63b1556d6a7fa0ec317ab9");
    assert_eq!(vrfmod::lane(&roll, 0), 3_492_555_422_507_510_920);
    assert_eq!(vrfmod::bps(vrfmod::lane(&roll, 0)), 1_893);
    assert_eq!(vrfmod::below(vrfmod::lane(&roll, 1), 3), 2);
    let (rarity, tool_type) =
        crate::instructions::settlement::roll_tool(&value, b"pack", &commit, &PACK_SMALL_ODDS_BPS).unwrap();
    assert_eq!(rarity, Rarity::Common);
    assert_eq!(tool_type, PACK_TOOL_TYPES[2]);
    for (tag, expected) in [
        (b"reroll".as_ref(), 4_301u64),
        (b"explore".as_ref(), 377),
        (b"forge".as_ref(), 2_658),
        (b"lottery".as_ref(), 3_599),
        (b"drum".as_ref(), 1_369),
    ] {
        assert_eq!(vrfmod::bps(vrfmod::lane(&derive_roll(&value, tag, commit.as_ref()), 0)), expected);
    }
}

/// Outcomes are pure, domain-separated functions of the oracle value and the
/// commit snapshot; zero-weight rarities are unreachable; ranges hold.
#[test]
fn vrf_outcomes_are_pure_and_bounded() {
    let v = [9u8; 32];
    assert_ne!(derive_roll(&v, b"pack", b"a"), derive_roll(&v, b"pack", b"b"));
    assert_ne!(derive_roll(&v, b"pack", b"a"), derive_roll(&v, b"forge", b"a"));
    assert_eq!(derive_roll(&v, b"pack", b"a"), derive_roll(&v, b"pack", b"a"));
    assert_eq!(vrfmod::below(u64::MAX, 7), 6);
    assert_eq!(vrfmod::below(0, 7), 0);
    assert_eq!(vrfmod::bps(u64::MAX), 9_999);

    let mut rng = XorShift(0xf06_2026);
    let commit = Pubkey::new_unique();
    let mut seen = [0u32; 5];
    for _ in 0..4_000 {
        let mut value = [0u8; 32];
        for chunk in value.chunks_mut(8) {
            chunk.copy_from_slice(&rng.next().to_le_bytes());
        }
        let (rarity, tool_type) =
            crate::instructions::settlement::roll_tool(&value, b"pack", &commit, &PACK_SMALL_ODDS_BPS).unwrap();
        seen[rarity as usize] += 1;
        assert!(PACK_TOOL_TYPES.contains(&tool_type.as_str()));
        for tier in 1..=MAX_EXPLORATION_TIER {
            let (ok, reward) = crate::instructions::exploration::trip_outcome(&value, &commit, tier).unwrap();
            let idx = (tier - 1) as usize;
            if ok {
                assert!(reward >= EXPLORATION_SHARDS_MIN[idx] as u64 * RESOURCE_UNIT);
                assert!(reward <= EXPLORATION_SHARDS_MAX[idx] as u64 * RESOURCE_UNIT);
            } else {
                assert_eq!(reward, 0);
            }
        }
        for level in 0..ENCHANT_MAX_LEVEL {
            let (after, outcome) = crate::instructions::forge::forge_outcome(&value, &commit, level, false).unwrap();
            match outcome {
                0 => assert_eq!(after, level + 1),
                1 => assert_eq!(after, level.saturating_sub(1)),
                _ => assert_eq!(after, 0),
            }
            let (_, protected) = crate::instructions::forge::forge_outcome(&value, &commit, level, true).unwrap();
            assert_ne!(protected, 2, "the protector turns a full loss into a partial fail");
        }
    }
    assert_eq!(seen[4], 0, "Legendary is never rolled");
    // 60/32/7/1 %: loose 4-sigma bands over 4000 draws.
    assert!((2_250..=2_550).contains(&seen[0]), "{seen:?}");
    assert!((1_150..=1_410).contains(&seen[1]), "{seen:?}");
    assert!((200..=365).contains(&seen[2]), "{seen:?}");
    assert!(seen[3] <= 90, "{seen:?}");
    assert!(crate::instructions::exploration::trip_outcome(&v, &commit, 0).is_err());
    assert!(crate::instructions::forge::forge_outcome(&v, &commit, ENCHANT_MAX_LEVEL, false).is_err());
}

fn pack_config_account(pack_type: u8, price: u64) -> AccountInfo<'static> {
    let (key, bump) = pda(&[PACK_CONFIG_SEED, &[pack_type]]);
    program_account(key, &PackConfig { pack_type, price_lamports: price, odds_bps: PACK_SMALL_ODDS_BPS, bump }, PACK_CONFIG_SPACE)
}

/// F-06 end to end on the real handlers: the pack commit takes the operator
/// gate and the price bound, seeds the pool slot through Switchboard and locks
/// it; the permissionless reveal settles once, pays exactly the escrow out and
/// frees the slot; a refund is only possible after the window.
#[test]
fn pack_opening_settles_once_through_the_program_owned_pool() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let nonce = 42u64;
    let price = PACK_SMALL_PRICE_LAMPORTS;
    let rkey = Pubkey::new_unique();
    let (commit_key, commit_bump) = pda(&[PACK_COMMIT_SEED, user.as_ref(), &nonce.to_le_bytes()]);
    let (slot_key, slot_state) = vrf_slot_state(rkey, Pubkey::default());
    let commit_infos = |operator: AccountInfo<'static>, slot: VrfSlot| {
        vec![
            w.config_info(),
            operator,
            wallet(user, true),
            pack_config_account(0, price),
            info(commit_key, false, rent_exempt(PACK_COMMIT_SPACE), vec![0; PACK_COMMIT_SPACE], crate::ID, false),
            program_account(slot_key, &slot, VRF_SLOT_SPACE),
            pool_randomness(rkey, 10, 11),
            info(vrf_authority_key(), false, 0, Vec::new(), anchor_lang::solana_program::system_program::ID, false),
            plain(SWITCHBOARD_QUEUE),
            plain(Pubkey::new_unique()),
            plain(crate::randomness::SLOT_HASHES_ID),
            sb_program(),
            system_program_info(),
        ]
    };
    let mut ix = vec![0u8];
    ix.extend_from_slice(&nonce.to_le_bytes());
    ix.extend_from_slice(&price.to_le_bytes());

    // The operator co-signature is the backend gate.
    let err = rejected(validate::<PackOpenCommit>(commit_infos(wallet(Pubkey::new_unique(), true), slot_state.clone()), &ix), "Unauthorized");
    assert!(blames(&err, "config"), "{err}");
    // A slot held by another commit fails the whole commit.
    let (mut accounts, bumps) = parse::<PackOpenCommit>(
        commit_infos(wallet(w.operator, true), vrf_slot_state(rkey, Pubkey::new_unique()).1), &ix).unwrap();
    rejected(crate::instructions::pack_open_commit::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), PackType::Small, nonce, price), "VrfSlotBusy");
    // Price above the caller's maximum.
    let (mut accounts, bumps) = parse::<PackOpenCommit>(commit_infos(wallet(w.operator, true), slot_state.clone()), &ix).unwrap();
    rejected(crate::instructions::pack_open_commit::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), PackType::Small, nonce, price - 1), "PriceAboveMaximum");

    runtime();
    let (mut accounts, bumps) = parse::<PackOpenCommit>(commit_infos(wallet(w.operator, true), slot_state.clone()), &ix).unwrap();
    crate::instructions::pack_open_commit::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), PackType::Small, nonce, price).unwrap();
    let deposit = vrfmod::tool_settlement_rent(&Rent::default());
    let transfers: Vec<u64> = cpi_log().iter()
        .filter(|c| c.program_id == anchor_lang::solana_program::system_program::ID && c.data.get(..4) == Some(&[2, 0, 0, 0][..]))
        .map(|c| u64::from_le_bytes(c.data[4..12].try_into().unwrap()))
        .collect();
    assert_eq!(transfers, vec![price + deposit], "price + settlement deposit escrowed in one transfer");
    let pc = &accounts.pack_commit;
    assert_eq!((pc.user, pc.nonce, pc.pack_type, pc.odds_bps), (user, nonce, 0, PACK_SMALL_ODDS_BPS));
    assert_eq!((pc.paid_lamports, pc.deposit_lamports, pc.randomness, pc.seed_slot, pc.commit_slot, pc.bump),
        (price, deposit, rkey, SLOT_NOW - 1, SLOT_NOW, commit_bump));
    assert_eq!(accounts.vrf_slot.lock, commit_key);
    let recorded = load_randomness(&accounts.randomness.to_account_info()).unwrap();
    assert_eq!(recorded.seed_slot, SLOT_NOW - 1);

    // ---- reveal (permissionless: a third-party cranker settles)
    runtime();
    let commit_state = PackCommit {
        user, nonce, pack_type: 0, odds_bps: PACK_SMALL_ODDS_BPS, paid_lamports: price, deposit_lamports: deposit,
        randomness: rkey, seed_slot: SLOT_NOW - 1, commit_slot: SLOT_NOW - 3, bump: commit_bump,
    };
    let (mint_key, _) = pda(&[PACK_MINT_SEED, commit_key.as_ref()]);
    let cranker_key = Pubkey::new_unique();
    let reveal_infos = |commit_state: &PackCommit, randomness: AccountInfo<'static>, lock: Pubkey| {
        let commit = program_account(commit_key, commit_state, PACK_COMMIT_SPACE);
        set_lamports(&commit, rent_exempt(PACK_COMMIT_SPACE) + price + deposit);
        vec![
            w.config_info(),
            wallet(cranker_key, true),
            commit,
            wallet(user, false),
            wallet(w.treasury, false),
            spl_mint(mint_key, 0, Some(w.auth_key), None),
            token_account(ata(&user, &mint_key), mint_key, user, 0),
            info(pda(&[TOOL_SEED, mint_key.as_ref()]).0, false, rent_exempt(TOOL_DATA_SPACE), vec![0; TOOL_DATA_SPACE], crate::ID, false),
            w.auth_info(),
            program_account(slot_key, &vrf_slot_state(rkey, lock).1, VRF_SLOT_SPACE),
            randomness,
            info(vrf_authority_key(), false, 0, Vec::new(), anchor_lang::solana_program::system_program::ID, false),
            plain(ORACLE),
            plain(SWITCHBOARD_QUEUE),
            plain(vrfmod::stats_address(&ORACLE)),
            plain(crate::randomness::SLOT_HASHES_ID),
            plain(vrfmod::reward_escrow_address(&rkey)),
            plain(anchor_spl::token::spl_token::native_mint::ID),
            plain(vrfmod::SWITCHBOARD_STATE),
            sb_program(),
            token_program_info(),
            executable_program(anchor_spl::associated_token::ID),
            system_program_info(),
        ]
    };
    // Another pool account in the randomness slot is refused by the context.
    let err = rejected(validate::<PackOpenReveal>(reveal_infos(&commit_state, pool_randomness(Pubkey::new_unique(), SLOT_NOW - 1, 0), commit_key), &[]),
        "InvalidRandomnessAccount");
    assert!(blames(&err, "randomness"), "{err}");

    // Switchboard pass-through accounts are bound in this program's context too.
    for (index, field) in [(12usize, "oracle"), (14, "stats"), (16, "reward_escrow"), (18, "program_state")] {
        let mut infos = reveal_infos(&commit_state, pool_randomness(rkey, SLOT_NOW - 1, 0), commit_key);
        infos[index] = plain(Pubkey::new_unique());
        let err = rejected(validate::<PackOpenReveal>(infos, &[]), "InvalidRandomnessAccount");
        assert!(blames(&err, field), "{field}: {err}");
    }

    let infos = reveal_infos(&commit_state, pool_randomness(rkey, SLOT_NOW - 1, 0), commit_key);
    let (commit_i, cranker_i, treasury_i) = (infos[2].clone(), infos[1].clone(), infos[4].clone());
    let (mut accounts, bumps) = parse::<PackOpenReveal>(infos, &[]).unwrap();
    let value = [0x33u8; 32];
    crate::instructions::pack_open_reveal::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), params_with(value)).unwrap();
    let (rarity, tool_type) = crate::instructions::settlement::roll_tool(&value, b"pack", &commit_key, &PACK_SMALL_ODDS_BPS).unwrap();
    assert_eq!((accounts.tool_data.rarity, accounts.tool_data.tool_type.clone()), (rarity, tool_type));
    assert_eq!((accounts.tool_data.owner, accounts.tool_data.operator, accounts.tool_data.mint), (user, user, mint_key));
    assert_eq!(accounts.tool_data.durability, MAX_DURABILITY);
    assert_eq!(treasury_i.lamports(), WALLET_LAMPORTS + price, "the price reaches the treasury only now");
    assert_eq!(cranker_i.lamports(), WALLET_LAMPORTS + deposit, "the settler is made whole");
    assert_eq!(commit_i.lamports(), rent_exempt(PACK_COMMIT_SPACE), "only the rent is left for `close = user`");
    assert_eq!(accounts.vrf_slot.lock, Pubkey::default());
    assert!(cpi_log().iter().any(|c| c.program_id == anchor_spl::token::ID && c.data.first() == Some(&7)), "one NFT minted");

    // A slot held by someone else cannot settle this commit.
    let (mut accounts, bumps) = parse::<PackOpenReveal>(
        reveal_infos(&commit_state, pool_randomness(rkey, SLOT_NOW - 1, 0), Pubkey::new_unique()), &[]).unwrap();
    rejected(crate::instructions::pack_open_reveal::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), params_with(value)), "VrfSlotNotHeld");

    // ---- refund: refused inside the window, accepted after it
    let expire_infos = |commit_slot: u64| {
        let mut st = commit_state.clone();
        st.commit_slot = commit_slot;
        vec![
            w.config_info(),
            program_account(commit_key, &st, PACK_COMMIT_SPACE),
            wallet(user, false),
            program_account(slot_key, &vrf_slot_state(rkey, commit_key).1, VRF_SLOT_SPACE),
        ]
    };
    let (mut accounts, bumps) = parse::<PackOpenExpire>(expire_infos(SLOT_NOW - VRF_REFUND_AFTER_SLOTS + 1), &[]).unwrap();
    rejected(crate::instructions::pack_open_expire::handler(Context::new(&crate::ID, &mut accounts, &[], bumps)), "CommitNotExpired");
    let (mut accounts, bumps) = parse::<PackOpenExpire>(expire_infos(SLOT_NOW - VRF_REFUND_AFTER_SLOTS), &[]).unwrap();
    crate::instructions::pack_open_expire::handler(Context::new(&crate::ID, &mut accounts, &[], bumps)).unwrap();
    assert_eq!(accounts.vrf_slot.lock, Pubkey::default());
    // ...and the reveal of the same commit is closed at that very slot.
    let mut late = commit_state.clone();
    late.commit_slot = SLOT_NOW - VRF_REFUND_AFTER_SLOTS;
    let (mut accounts, bumps) = parse::<PackOpenReveal>(reveal_infos(&late, pool_randomness(rkey, SLOT_NOW - 1, 0), commit_key), &[]).unwrap();
    rejected(crate::instructions::pack_open_reveal::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), params_with(value)), "RevealWindowClosed");
}

/// An undrawn round refunds each ticket in full to its buyer after the timeout
/// (never to the treasury), and only once.
#[test]
fn lottery_tickets_of_an_undrawn_round_are_refunded_to_their_buyers() {
    runtime();
    let w = World::new();
    let round_id = 7u64;
    let (round_key, round_bump) = pda(&[LOTTERY_ROUND_SEED, &round_id.to_le_bytes()]);
    let buyer = Pubkey::new_unique();
    let ticket_number = 3u64;
    let (ticket_key, _) = pda(&[LOTTERY_TICKET_SEED, &round_id.to_le_bytes(), &ticket_number.to_le_bytes()]);
    let round = |created_at: i64, draw_committed: bool| LotteryRound {
        round_id, pool_lamports: 5 * LOTTERY_TICKET_PRICE_LAMPORTS, tickets_sold: 5, seed_slot: 0, drawn: false,
        winning_ticket: 0, claimed: false, bump: round_bump, created_at, draw_committed, draw_commit_slot: 0,
        randomness: Pubkey::default(),
    };
    let infos = |r: LotteryRound| {
        let round_info = program_account(round_key, &r, LOTTERY_ROUND_SPACE);
        set_lamports(&round_info, rent_exempt(LOTTERY_ROUND_SPACE) + r.pool_lamports);
        vec![
            w.config_info(),
            round_info,
            program_account(ticket_key, &LotteryTicket { round_id, ticket_number, buyer }, LOTTERY_TICKET_SPACE),
            wallet(buyer, false),
        ]
    };
    let run = |r: LotteryRound| -> (Result<()>, AccountInfo<'static>, AccountInfo<'static>) {
        let infos = infos(r);
        let (round_i, buyer_i) = (infos[1].clone(), infos[3].clone());
        let (mut accounts, bumps) = parse::<RefundLotteryTicket>(infos, &[]).unwrap();
        let result = crate::instructions::lottery::refund_ticket_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
        (result, round_i, buyer_i)
    };
    let expired = NOW_TS - LOTTERY_ROUND_TIMEOUT_SECONDS;
    rejected(run(round(expired + 1, false)).0, "LotteryRoundNotExpired");
    rejected(run(round(expired, true)).0, "LotteryDrawAlreadyCommitted");
    let (result, round_i, buyer_i) = run(round(expired, false));
    result.unwrap();
    assert_eq!(buyer_i.lamports(), WALLET_LAMPORTS + LOTTERY_TICKET_PRICE_LAMPORTS, "full ticket price back to the buyer");
    assert_eq!(round_i.lamports(), rent_exempt(LOTTERY_ROUND_SPACE) + 4 * LOTTERY_TICKET_PRICE_LAMPORTS);
}

// ---------------------------------------------------------------- duplication (#56)

/// #56: a ready tile pays once; the replayed harvest finds it empty and mints
/// nothing (Solana serializes writes to the tile, the handler resets it before
/// returning).
#[test]
fn a_harvest_cannot_be_collected_twice() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tool_mint = Pubkey::new_unique();
    let (energy_key, energy_bump) = pda(&[ENERGY_ACCOUNT_SEED, user.as_ref()]);
    let (tile_key, tile_bump) = pda(&[FARM_TILE_SEED, user.as_ref(), &[TILE]]);
    let energy = EnergyAccount { owner: user, current: ENERGY_CAP, last_regen_at: NOW_TS, cap: ENERGY_CAP, bump: energy_bump };
    let tile = FarmTile { owner: user, state: 2, planted_at: NOW_TS - 7_200, ready_at: NOW_TS - 1, seeds_amount: 100, bump: tile_bump };
    let infos = vec![
        w.config_info(),
        wallet(user, true),
        w.mm_info(),
        program_account(energy_key, &energy, ENERGY_ACCOUNT_SPACE),
        program_account(tile_key, &tile, FARM_TILE_SPACE),
        program_account(pda(&[TOOL_SEED, tool_mint.as_ref()]).0, &tool(tool_mint, user, user, "neural_seeder"), TOOL_DATA_SPACE),
        w.auth_info(),
        spl_mint(w.mm.wheat, 0, Some(w.auth_key), None),
        token_account(Pubkey::new_unique(), w.mm.wheat, user, 0),
        token_program_info(),
        system_program_info(),
    ];
    let harvest = |infos: Vec<AccountInfo<'static>>| -> Result<()> {
        let (mut accounts, bumps) = parse::<HarvestWheat>(infos, &[TILE])?;
        crate::instructions::harvest_wheat::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), TILE)?;
        // Persist the new state exactly as the runtime would after the instruction.
        accounts.exit(&crate::ID)
    };
    assert!(harvest(infos.clone()).is_ok());
    assert_eq!(cpi_calls(), 1);
    rejected(harvest(infos), "FarmTileEmpty");
    assert_eq!(cpi_calls(), 1, "the replay minted nothing");
}

// ---------------------------------------------------------------- invariants (#49/#52/#53)

/// #52/#53: random withdraw/sweep sequences never create or destroy a lamport,
/// never let the tank drop below rent + owed balance + dust, and a failed step
/// changes nothing.
#[test]
fn gas_tank_invariants_hold_under_random_operations() {
    runtime();
    let w = World::new();
    let mut rng = XorShift(0x5eed_0a0f_2026);
    let rent = rent_exempt(GASTANK_SPACE);
    for _round in 0..30 {
        let user = Pubkey::new_unique();
        let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
        let balance = rng.below(400_000);
        let dust = rng.below(MICROS_TO_LAMPORTS);
        let fees = rng.below(3_000_000);
        let tank = program_account(tank_key, &gas_tank(user, balance, dust, 0), GASTANK_SPACE);
        set_lamports(&tank, rent + balance * MICROS_TO_LAMPORTS + dust + fees);
        let user_info = wallet(user, true);
        let treasury = wallet(w.treasury, false);
        let total = tank.lamports() + user_info.lamports() + treasury.lamports();
        let mut owed = balance;
        for _step in 0..6 {
            let before = (tank.lamports(), user_info.lamports(), treasury.lamports());
            let result: Result<()> = if rng.below(2) == 0 {
                let amount = rng.below(owed + 5_000);
                (|| {
                    let (mut accounts, bumps) = parse::<WithdrawGas>(
                        vec![w.config_info(), user_info.clone(), tank.clone(), system_program_info()],
                        &amount.to_le_bytes(),
                    )?;
                    crate::instructions::withdraw_gas::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), amount)?;
                    owed = accounts.gastank.balance_micros;
                    accounts.exit(&crate::ID)
                })()
            } else {
                (|| {
                    let (mut accounts, bumps) = parse::<SweepGasFees>(
                        vec![w.config_info(), wallet(w.operator, true), tank.clone(), treasury.clone(), system_program_info()],
                        &[],
                    )?;
                    crate::instructions::sweep_gas_fees::handler(Context::new(&crate::ID, &mut accounts, &[], bumps))
                })()
            };
            let after = (tank.lamports(), user_info.lamports(), treasury.lamports());
            if result.is_err() {
                assert_eq!(before, after, "a failed step moved lamports");
            }
            assert_eq!(after.0 + after.1 + after.2, total, "lamports conserved");
            assert!(tank.lamports() >= rent + owed * MICROS_TO_LAMPORTS + dust, "tank under-collateralized");
        }
    }
}

/// #52/#53: random crossing orders — every match conserves lamports, fees stay
/// within the trade and the remaining buy escrow still covers the rest of the
/// order at the buyer's own price plus the taker buffer.
#[test]
fn order_matching_invariants_hold_for_random_orders() {
    runtime();
    let w = World::new();
    let mut rng = XorShift(0xa0f_0b0e_2026);
    let rent = rent_exempt(RESOURCE_ORDER_SPACE);
    let taker = |x: u64| x * ORDERBOOK_TAKER_FEE_BPS as u64 / 10_000;
    for _ in 0..60 {
        let (buyer, seller) = (Pubkey::new_unique(), Pubkey::new_unique());
        let mint = w.config.food_mint;
        let buy_price = 1 + rng.below(50_000);
        let sell_price = 1 + rng.below(buy_price);
        let buy_amount = 1 + rng.below(1_000);
        let sell_amount = 1 + rng.below(1_000);
        let buy_key = pda(&[RESOURCE_ORDER_SEED, buyer.as_ref(), mint.as_ref()]).0;
        let sell_key = pda(&[RESOURCE_ORDER_SEED, seller.as_ref(), mint.as_ref()]).0;
        let buy = program_account(buy_key, &resource_order(buyer, true, buy_price, buy_amount, mint), RESOURCE_ORDER_SPACE);
        set_lamports(&buy, rent + buy_price * buy_amount + taker(buy_price * buy_amount));
        let seller_wallet = wallet(seller, false);
        let treasury = wallet(w.treasury, false);
        let total = buy.lamports() + seller_wallet.lamports() + treasury.lamports();
        let (mut accounts, bumps) = parse::<MatchResourceOrders>(
            vec![
                w.config_info(),
                w.mm_info(),
                spl_mint(mint, 1_000_000, Some(w.auth_key), None),
                buy.clone(),
                program_account(sell_key, &resource_order(seller, false, sell_price, sell_amount, mint), RESOURCE_ORDER_SPACE),
                seller_wallet.clone(),
                treasury.clone(),
                token_account(Pubkey::new_unique(), mint, sell_key, sell_amount),
                token_account(ata(&buyer, &mint), mint, buyer, 0),
                token_program_info(),
            ],
            &[],
        )
        .unwrap();
        let result = crate::instructions::orderbook::match_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
        assert!(result.is_ok(), "{result:?}");
        let traded = buy_amount.min(sell_amount);
        let remaining = buy_amount - traded;
        assert_eq!(accounts.buy_order.amount_remaining, remaining);
        assert_eq!(buy.lamports() + seller_wallet.lamports() + treasury.lamports(), total, "lamports conserved");
        assert!(treasury.lamports() - WALLET_LAMPORTS <= sell_price * traded, "fees stay within the trade");
        assert!(
            buy.lamports() >= rent + buy_price * remaining + taker(buy_price * remaining),
            "remaining escrow covers the rest of the order"
        );
    }
}

// ======================================================================
// H. Матрица крайних значений 0 / 1 / max / dust  (#111)
// ======================================================================
//
// #111 закрывал нулевые суммы guard-ами в полусотне мест и оставлял открытым
// вопрос: что каждый путь делает на КРАЮ диапазона. Здесь по одному
// представителю каждого класса путей —
//   * claim    — `collect_flour` (мельница) и `collect_well_water` (колодец);
//   * deposit  — `deposit_gas` (лампорты -> микро-единицы газ-бака);
//   * withdraw — `withdraw_gas` и `sweep_gas_fees`;
//   * transfer — `match_handler` ордербука и `pay_out_with_referral` (казна) —
// прогоняется через НАСТОЯЩИЕ handler-ы на amount ∈ {0, 1, max, dust}, и
// проверяются три свойства:
//   1) 0 и переполнение отвергаются ДО записи состояния (и до CPI там, где
//      порядок проверок это позволяет);
//   2) «пыль» — значение ниже минимальной единицы учёта — либо отвергается,
//      либо переносится целиком: ни один лампорт и ни одна микро-единица не
//      исчезают и не появляются из воздуха;
//   3) «выдано ≤ начислено»: минтится/выплачивается ровно начисленное, а
//      повторный claim не создаёт новую ценность.
//
// `AccountsExit::exit` здесь не вызывается (см. комментарий в шапке файла):
// состояние после первого вызова копируется в свежий fixture так, как его
// сохранил бы рантайм.

// ----------------------------------------------------------------------
// deposit: `deposit_gas`
// ----------------------------------------------------------------------

struct DepositOutcome {
    result: Result<()>,
    micros: u64,
    dust: u64,
    cpis: usize,
}

/// Реальный `deposit_gas::handler` с заданной суммой, логическим балансом и
/// уже накопленной пылью (лампортами ниже микро-единицы).
fn deposit(amount: u64, balance_micros: u64, dust_lamports: u64) -> DepositOutcome {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let tank = program_account(tank_key, &gas_tank(user, balance_micros, dust_lamports, 0), GASTANK_SPACE);
    let (mut accounts, bumps) = parse::<DepositGas>(
        vec![w.config_info(), wallet(user, true), tank, system_program_info()],
        &amount.to_le_bytes(),
    )
    .unwrap();
    let result =
        crate::instructions::deposit_gas::handler(Context::new(&crate::ID, &mut accounts, &[], bumps), amount);
    DepositOutcome {
        result,
        micros: accounts.gastank.balance_micros,
        dust: accounts.gastank.dust_lamports,
        cpis: cpi_calls(),
    }
}

#[test]
fn deposit_gas_matrix_zero_one_max_and_dust() {
    let micro = MICROS_TO_LAMPORTS;

    // 0: отвергается до любого движения средств.
    let zero = deposit(0, 0, 0);
    rejected(zero.result, "ZeroAmount");
    assert_eq!((zero.cpis, zero.micros, zero.dust), (0, 0, 0), "нулевой вклад не меняет ничего");

    // dust: вклад меньше микро-единицы переносит все лампорты и ничего не теряет.
    let dust = deposit(micro - 1, 0, 0);
    assert!(dust.result.is_ok(), "{:?}", dust.result);
    assert_eq!((dust.micros, dust.dust), (0, micro - 1), "суб-микро лампорты ждут следующего вклада");
    assert_eq!(last_system_transfer_lamports(), micro - 1, "переводятся все лампорты до последнего");

    // dust + 1: пыль складывается с новым вкладом в целую микро-единицу.
    let carried = deposit(1, 0, micro - 1);
    assert!(carried.result.is_ok(), "{:?}", carried.result);
    assert_eq!((carried.micros, carried.dust), (1, 0), "пыль переносится, а не пропадает");

    // 1: ровно одна микро-единица сверх уже накопленного баланса.
    let one = deposit(micro, 7, 0);
    assert!(one.result.is_ok(), "{:?}", one.result);
    assert_eq!((one.micros, one.dust), (8, 0));

    // max: логический баланс не должен переполниться.
    let max = deposit(micro, u64::MAX, 0);
    rejected(max.result, "MathOverflow");
    assert_eq!((max.micros, max.dust), (u64::MAX, 0), "отвергнутая запись не тронула бак");

    // max + dust: сумма лампортов проверяется до записи; на Solana такой
    // отказ откатывает и перевод целиком, поэтому вклад не теряется.
    let max_dust = deposit(u64::MAX, 0, 1);
    rejected(max_dust.result, "MathOverflow");
    assert_eq!((max_dust.micros, max_dust.dust), (0, 1), "пыль переживает отвергнутый вклад");

    // Границы конвертера — та же арифметика, что внутри handler-а.
    assert_eq!(crate::instructions::deposit_gas::lamports_to_micros(micro - 1).unwrap(), 0);
    assert_eq!(crate::instructions::deposit_gas::lamports_to_micros(micro).unwrap(), 1);
    assert_eq!(
        crate::instructions::deposit_gas::lamports_to_micros(u64::MAX).unwrap(),
        u64::MAX / micro
    );
    assert!(
        crate::instructions::withdraw_gas::micros_to_lamports(u64::MAX).is_err(),
        "вывод на максимуме отвергается, а не заворачивается"
    );
}

// ----------------------------------------------------------------------
// claim: `collect_flour` (мельница), `collect_well_water` (колодец)
// ----------------------------------------------------------------------

struct FlourClaim {
    result: Result<()>,
    cpis: usize,
    in_progress: bool,
    output_flour: u64,
}

/// Реальный `collect_flour::handler`: `output_flour` — начисленная партия,
/// `signal_cap` — потолок выпуска сигнала, `mint_supply` — эмиссия сигнала.
fn claim_flour(output_flour: u64, signal_cap: u64, mint_supply: u64) -> FlourClaim {
    runtime();
    let mut w = World::new();
    w.mm.max_supply[ResourceKind::Signal as usize] = signal_cap;
    let user = Pubkey::new_unique();
    let (mill_key, mill_bump) = pda(&[MILL_STATE_SEED, user.as_ref()]);
    let mill = MillState {
        owner: user,
        in_progress: true,
        ready_at: NOW_TS - 1,
        output_flour,
        bump: mill_bump,
    };
    let (mut accounts, bumps) = parse::<CollectFlour>(
        vec![
            w.config_info(),
            wallet(user, true),
            w.mm_info(),
            program_account(mill_key, &mill, MILL_STATE_SPACE),
            w.auth_info(),
            spl_mint(w.mm.flour, mint_supply, Some(w.auth_key), None),
            token_account(Pubkey::new_unique(), w.mm.flour, user, 0),
            token_program_info(),
        ],
        &[],
    )
    .unwrap();
    let result =
        crate::instructions::collect_flour::handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    FlourClaim {
        result,
        cpis: cpi_calls(),
        in_progress: accounts.mill_state.in_progress,
        output_flour: accounts.mill_state.output_flour,
    }
}

struct WellClaim {
    result: Result<()>,
    cpis: usize,
    last_collected_at: i64,
}

/// Реальный `collect_well_water::handler`: `last_collected_at` задаёт окно
/// начисления, `water_cap` — потолок выпуска энергопотока, `mint_supply` —
/// его эмиссия.
fn claim_well(last_collected_at: i64, water_cap: u64, mint_supply: u64) -> WellClaim {
    runtime();
    let mut w = World::new();
    w.mm.max_supply[ResourceKind::Power as usize] = water_cap;
    let user = Pubkey::new_unique();
    let (well_key, well_bump) = pda(&[WELL_STATE_SEED, user.as_ref()]);
    let (weather_key, weather_bump) = pda(&[WEATHER_STATE_SEED]);
    let well = WellState { owner: user, water_buffer: 0, last_collected_at, bump: well_bump };
    let now_day = (NOW_TS / 86_400) as u32;
    let weather = WeatherState {
        day_id: now_day,
        weather: weather_for_day(now_day),
        updated_at: NOW_TS,
        bump: weather_bump,
    };
    let mut villager = player(user);
    villager.villagers = 1;
    let (mut accounts, bumps) = parse::<CollectWellWater>(
        vec![
            w.config_info(),
            wallet(user, true),
            program_account(pda(&[PLAYER_SEED, user.as_ref()]).0, &villager, PLAYER_SPACE),
            w.mm_info(),
            program_account(well_key, &well, WELL_STATE_SPACE),
            program_account(weather_key, &weather, WEATHER_STATE_SPACE),
            w.auth_info(),
            spl_mint(w.mm.water, mint_supply, Some(w.auth_key), None),
            token_account(Pubkey::new_unique(), w.mm.water, user, 0),
            token_program_info(),
            system_program_info(),
        ],
        &[],
    )
    .unwrap();
    let result =
        crate::instructions::collect_well_water::handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    WellClaim {
        result,
        cpis: cpi_calls(),
        last_collected_at: accounts.well_state.last_collected_at,
    }
}

#[test]
fn claim_paths_mint_exactly_what_was_accrued_and_never_twice() {
    // --- мельница: 0 / 1 / max / потолок / максимум эмиссии -----------------
    let zero = claim_flour(0, SUPPLY_CAP_UNLIMITED, 0);
    rejected(zero.result, "ZeroAmount");
    assert_eq!(zero.cpis, 0, "ничего не начислено — ничего не выдается");
    assert!(zero.in_progress, "отвергнутый сбор не сбрасывает мельницу");

    let one = claim_flour(1, SUPPLY_CAP_UNLIMITED, 0);
    assert!(one.result.is_ok(), "{:?}", one.result);
    assert_eq!(last_minted_amount(), 1, "выдано ровно начисленное");
    assert_eq!(one.cpis, 1, "один минт-CPI");
    assert_eq!((one.in_progress, one.output_flour), (false, 0), "партия дренируется целиком");

    let max_ok = claim_flour(u64::MAX, SUPPLY_CAP_UNLIMITED, 0);
    assert!(max_ok.result.is_ok(), "{:?}", max_ok.result);
    assert_eq!(last_minted_amount(), u64::MAX, "«нет потолка» — минтится ровно начисленное");

    // Потолок ниже начисленного: отказ до CPI, состояние не тронуто.
    let capped = claim_flour(u64::MAX, u64::MAX - 1, 0);
    rejected(capped.result, "SupplyCapExceeded");
    assert_eq!(capped.cpis, 0, "отвергнуто до минт-CPI");
    assert!(capped.in_progress, "выдано 0 ≤ начислено, партия ждёт решения");

    // Максимум эмиссии + начисленное: потолок не вычисляется — отказ, не перенос.
    let overflow = claim_flour(2, u64::MAX - 1, u64::MAX);
    rejected(overflow.result, "MathOverflow");
    assert_eq!(overflow.cpis, 0, "переполнение потолка отвергается до минта");
    assert!(overflow.in_progress, "партия не потеряна");

    // --- колодец: окно начисления решает, сколько можно снять --------------
    let fresh = claim_well(NOW_TS, SUPPLY_CAP_UNLIMITED, 0);
    rejected(fresh.result, "WellEmpty");
    assert_eq!(fresh.cpis, 0, "нулевое окно — ноль начислено, ноль выдано");

    // Самое маленькое снимаемое начисление: 1 секунда окна. Ноль секунд до
    // него не даёт ничего — «пыли» из воздуха не появляется.
    let (elapsed, smallest) = (1..=3 * 86_400i64)
        .find_map(|e| {
            let accrued = accrual(NOW_TS - e, NOW_TS);
            (accrued > 0).then_some((e, accrued))
        })
        .expect("в окне начисления обязано появиться положительное значение");
    assert_eq!(accrual(NOW_TS, NOW_TS), 0, "окно нулевой длины не начисляет");
    if elapsed > 1 {
        assert_eq!(accrual(NOW_TS - (elapsed - 1), NOW_TS), 0, "на секунду короче — ещё ноль");
    }
    let tiny = claim_well(NOW_TS - elapsed, SUPPLY_CAP_UNLIMITED, 0);
    assert!(tiny.result.is_ok(), "{:?}", tiny.result);
    assert_eq!(last_minted_amount(), smallest, "выдано = начислено, до последней единицы");
    assert_eq!(tiny.last_collected_at, NOW_TS, "окно начисления стартует заново");

    // Максимум за один вызов ограничен суточным окном и лучшей ставкой.
    let week = claim_well(NOW_TS - 5 * 86_400, SUPPLY_CAP_UNLIMITED, 0);
    assert!(week.result.is_ok(), "{:?}", week.result);
    let accrued_day = accrual(NOW_TS - 86_400, NOW_TS);
    assert_eq!(last_minted_amount(), accrued_day, "пятидневное окно обрезается сутками");
    assert_eq!(last_minted_amount(), accrual(NOW_TS - 5 * 86_400, NOW_TS));
    assert!(
        accrued_day <= 24 * WELL_RATE_FRENZY,
        "сутки не могут начислить больше 480 единиц, начислено {accrued_day}"
    );

    // Потолок ниже начисленного: отказ, и окно начисления остаётся прежним.
    let window = NOW_TS - elapsed;
    let capped_well = claim_well(window, smallest - 1, 0);
    rejected(capped_well.result, "SupplyCapExceeded");
    assert_eq!(capped_well.cpis, 0);
    assert_eq!(capped_well.last_collected_at, window, "отвергнутый сбор не перезапускает окно");

    // Максимум эмиссии при потолке ниже начисленного: отказ до минта.
    let well_overflow = claim_well(NOW_TS - elapsed, u64::MAX - 1, u64::MAX);
    rejected(well_overflow.result, "MathOverflow");
    assert_eq!(well_overflow.cpis, 0);
    assert_eq!(well_overflow.last_collected_at, NOW_TS - elapsed, "окно не тронуто");
}

/// Повторный сбор того же урожая не создаёт новую ценность: после первого
/// сбора мельница пуста, и второй вызов отвергается без CPI. Состояние между
/// вызовами переносится так, как его сохранил бы рантайм.
#[test]
fn a_claim_cannot_be_collected_twice() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let (mill_key, mill_bump) = pda(&[MILL_STATE_SEED, user.as_ref()]);
    let mill = MillState {
        owner: user,
        in_progress: true,
        ready_at: NOW_TS - 1,
        output_flour: 50,
        bump: mill_bump,
    };
    let flour_mint = spl_mint(w.mm.flour, 0, Some(w.auth_key), None);
    let user_flour = token_account(Pubkey::new_unique(), w.mm.flour, user, 0);
    let infos = |mill_info: AccountInfo<'static>| {
        vec![
            w.config_info(),
            wallet(user, true),
            w.mm_info(),
            mill_info,
            w.auth_info(),
            flour_mint.clone(),
            user_flour.clone(),
            token_program_info(),
        ]
    };

    let (mut accounts, bumps) =
        parse::<CollectFlour>(infos(program_account(mill_key, &mill, MILL_STATE_SPACE)), &[]).unwrap();
    let result = crate::instructions::collect_flour::handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    assert!(result.is_ok(), "{result:?}");
    assert_eq!(last_minted_amount(), 50, "первый сбор отдаёт начисленное");
    let cpis_after_first = cpi_calls();
    assert_eq!(cpis_after_first, 1);

    let drained = MillState::clone(&*accounts.mill_state);
    assert_eq!(
        (drained.in_progress, drained.output_flour),
        (false, 0),
        "рантайм сохраняет дренаж партии"
    );

    let (mut again, bumps) =
        parse::<CollectFlour>(infos(program_account(mill_key, &drained, MILL_STATE_SPACE)), &[]).unwrap();
    let second =
        crate::instructions::collect_flour::handler(Context::new(&crate::ID, &mut again, &[], bumps));
    rejected(second, "MillNotReady");
    assert_eq!(cpi_calls(), cpis_after_first, "повторный сбор не минтит ничего");
    assert_eq!(again.mill_state.output_flour, 0, "начисленного больше нет");
}

// ----------------------------------------------------------------------
// withdraw: `withdraw_gas` и `sweep_gas_fees`
// ----------------------------------------------------------------------

#[test]
fn withdraw_gas_matrix_zero_one_max_and_dust() {
    let micro = MICROS_TO_LAMPORTS;
    let rent = rent_exempt(GASTANK_SPACE);

    // 0: отвергается до движения средств.
    let zero = withdraw(1_000, 0, 1_000 * micro, 0);
    rejected(zero.result, "ZeroAmount");
    assert_eq!(zero.tank_lamports, rent + 1_000 * micro, "ни один лампорт не сдвинулся");
    assert_eq!(zero.user_lamports, WALLET_LAMPORTS);
    assert_eq!(zero.tank.balance_micros, 1_000, "логический баланс цел");

    // 1: самая мелкая единица бака выводится ровно один раз.
    let one = withdraw(1_000, 0, 1_000 * micro, 1);
    assert!(one.result.is_ok(), "{:?}", one.result);
    assert_eq!(one.tank_lamports, rent + 1_000 * micro - micro);
    assert_eq!(one.user_lamports, WALLET_LAMPORTS + micro, "микро-единица ушла целиком");
    assert_eq!(one.tank.balance_micros, 999);
    assert_eq!(one.tank.cooldown_until, 0, "пылевой вывод не запирает бак на 12 ч");

    // dust: на баке лежит меньше, чем он должен игроку — рента защищена.
    let dust = withdraw(1_000, 0, micro - 1, 1);
    rejected(dust.result, "RentExemptionFailed");
    assert_eq!(dust.tank_lamports, rent + micro - 1, "отвергнутый вывод не двигает лампорты");
    assert_eq!(dust.user_lamports, WALLET_LAMPORTS);
    assert_eq!(dust.tank.balance_micros, 1_000);

    // max: конвертация в лампорты не должна переполниться.
    let max = withdraw(u64::MAX, 0, 0, u64::MAX);
    rejected(max.result, "MathOverflow");
    assert_eq!(max.tank_lamports, rent, "ни один лампорт не ушёл");
    assert_eq!(max.user_lamports, WALLET_LAMPORTS);
    assert_eq!(max.tank.balance_micros, u64::MAX, "логический баланс не тронут");
}

#[test]
fn sweep_matrix_zero_one_max_and_dust() {
    runtime();
    let w = World::new();
    let user = Pubkey::new_unique();
    let tank_key = pda(&[GASTANK_SEED, user.as_ref()]).0;
    let rent = rent_exempt(GASTANK_SPACE);
    let owed = 5_000 * MICROS_TO_LAMPORTS;
    let dust = 777u64;
    let floor = rent + owed + dust;

    let tank = program_account(tank_key, &gas_tank(user, 5_000, dust, 0), GASTANK_SPACE);
    let treasury = wallet(w.treasury, false);
    let sweep = |tank: &AccountInfo<'static>, treasury: &AccountInfo<'static>| {
        let (mut accounts, bumps) = parse::<SweepGasFees>(
            vec![w.config_info(), wallet(w.operator, true), tank.clone(), treasury.clone(), system_program_info()],
            &[],
        )
        .unwrap();
        crate::instructions::sweep_gas_fees::handler(Context::new(&crate::ID, &mut accounts, &[], bumps))
    };

    // 0: нет превышения над резервом — нет перевода.
    set_lamports(&tank, floor);
    rejected(sweep(&tank, &treasury), "NoExcessToSweep");
    assert_eq!(tank.lamports(), floor, "ни одного лампорта при нулевом превышении");
    assert_eq!(treasury.lamports(), WALLET_LAMPORTS, "при нулевом превышении в казну не уходит ничего");

    // 1: единственный лампорт сверх резерва уходит целиком и только он.
    set_lamports(&tank, floor + 1);
    let before = treasury.lamports();
    assert!(sweep(&tank, &treasury).is_ok(), "один лампорт — уже превышение");
    assert_eq!(treasury.lamports(), before + 1, "переводится ровно превышение");
    assert_eq!(tank.lamports(), floor, "резерв, долг и пыль остаются игроку");

    // Крупное превышение, которое казна ещё влезает: уходит целиком.
    let huge = 1_000_000_000_000u64; // 1 000 SOL
    set_lamports(&tank, floor + huge);
    let before = treasury.lamports();
    assert!(sweep(&tank, &treasury).is_ok(), "крупное превышение переводится целиком");
    assert_eq!(treasury.lamports(), before + huge, "выдано = превышение, до последнего лампорта");
    assert_eq!(tank.lamports(), floor, "резерв, долг и пыль остаются игроку");

    // max: превышение больше, чем казна физически может принять (сумма двух
    // балансов не влезает в u64) — перевод отвергается ДО записи, и ни один
    // лампорт не двигается ни вниз, ни вверх.
    set_lamports(&tank, u64::MAX);
    let before = (tank.lamports(), treasury.lamports());
    rejected(sweep(&tank, &treasury), "MathOverflow");
    assert_eq!(
        (tank.lamports(), treasury.lamports()),
        before,
        "перевод, который не влезает в кошелёк казны, отвергнут до записи"
    );
}

// ----------------------------------------------------------------------
// transfer: `match_handler` ордербука (биржевой обмен ресурса)
// ----------------------------------------------------------------------

struct MatchOutcome {
    result: Result<()>,
    cpis: usize,
    escrow_before: u64,
    buyer_escrow: u64,
    seller_wallet: u64,
    treasury: u64,
    total: u64,
    buy_remaining: u64,
    sell_remaining: u64,
}

/// Верхняя граница фикстуры: столько лампортов тест кладёт в аккаунт, чтобы
/// суммы по кошелькам заведомо не переполнили u64. Крайние цены матрицы
/// (`u64::MAX`) в кошелёк не влезают, а проверять нужно отказ handler-а, а не
/// арифметику самого теста.
const MAX_FIXTURE_LAMPORTS: u64 = u64::MAX / 8;

/// Реальный `orderbook::match_handler` для встречных заявок; эскроу покупателя
/// всегда покрывает сделку и остаётся rent-exempt.
fn match_orders(buy_price: u64, buy_amount: u64, sell_price: u64, sell_amount: u64) -> MatchOutcome {
    runtime();
    let w = World::new();
    let (buyer, seller) = (Pubkey::new_unique(), Pubkey::new_unique());
    let mint = w.config.food_mint;
    let buy_key = pda(&[RESOURCE_ORDER_SEED, buyer.as_ref(), mint.as_ref()]).0;
    let sell_key = pda(&[RESOURCE_ORDER_SEED, seller.as_ref(), mint.as_ref()]).0;
    let rent = rent_exempt(RESOURCE_ORDER_SPACE);
    let taker = |gross: u64| gross.saturating_mul(ORDERBOOK_TAKER_FEE_BPS as u64) / 10_000;
    let escrow = buy_price.saturating_mul(buy_amount).min(MAX_FIXTURE_LAMPORTS);
    let buy = program_account(
        buy_key,
        &resource_order(buyer, true, buy_price, buy_amount, mint),
        RESOURCE_ORDER_SPACE,
    );
    set_lamports(&buy, rent.saturating_add(escrow).saturating_add(taker(escrow)).saturating_add(1));
    let sell = program_account(
        sell_key,
        &resource_order(seller, false, sell_price, sell_amount, mint),
        RESOURCE_ORDER_SPACE,
    );
    let seller_wallet = wallet(seller, false);
    let treasury = wallet(w.treasury, false);
    let escrow_before = buy.lamports();
    let total = buy.lamports() + seller_wallet.lamports() + treasury.lamports();
    let (mut accounts, bumps) = parse::<MatchResourceOrders>(
        vec![
            w.config_info(),
            w.mm_info(),
            spl_mint(mint, 1_000_000, Some(w.auth_key), None),
            buy.clone(),
            sell.clone(),
            seller_wallet.clone(),
            treasury.clone(),
            token_account(Pubkey::new_unique(), mint, sell_key, sell_amount),
            token_account(ata(&buyer, &mint), mint, buyer, 0),
            token_program_info(),
        ],
        &[],
    )
    .unwrap();
    let result =
        crate::instructions::orderbook::match_handler(Context::new(&crate::ID, &mut accounts, &[], bumps));
    MatchOutcome {
        result,
        cpis: cpi_calls(),
        escrow_before,
        buyer_escrow: buy.lamports(),
        seller_wallet: seller_wallet.lamports(),
        treasury: treasury.lamports(),
        total,
        buy_remaining: accounts.buy_order.amount_remaining,
        sell_remaining: accounts.sell_order.amount_remaining,
    }
}

#[test]
fn transfer_matrix_zero_one_max_and_dust() {
    // 0: пустая заявка не двигает ни токен, ни лампорт.
    let zero = match_orders(1_000, 0, 900, 4);
    rejected(zero.result, "OrderExhausted");
    assert_eq!(zero.cpis, 0, "нулевой обмен не делает токен-CPI");
    assert_eq!(zero.buyer_escrow + zero.seller_wallet + zero.treasury, zero.total);
    assert_eq!((zero.buy_remaining, zero.sell_remaining), (0, 4), "заявки не тронуты");

    // 1 (минимальная единица обмена): комиссии округляются вниз, покупатель
    // платит ровно сделку плюс тейкерскую комиссию, лампорты сохраняются.
    let dust = match_orders(1_000, 1, 900, 1);
    assert!(dust.result.is_ok(), "{:?}", dust.result);
    let gross = 900u64;
    let taker_fee = gross * ORDERBOOK_TAKER_FEE_BPS as u64 / 10_000;
    let maker_fee = gross * ORDERBOOK_MAKER_FEE_BPS as u64 / 10_000;
    assert_eq!(dust.cpis, 1, "один токен-перевод обменянной единицы");
    assert_eq!((dust.buy_remaining, dust.sell_remaining), (0, 0), "единица обмена исполнена");
    assert_eq!(maker_fee, 0, "на одной единице комиссия мейкера округляется вниз до нуля");
    assert_eq!(dust.seller_wallet, WALLET_LAMPORTS + gross - maker_fee, "выдано = продано минус комиссия");
    assert_eq!(dust.treasury, WALLET_LAMPORTS + taker_fee + maker_fee, "казна берёт ровно свои bps");
    assert_eq!(
        dust.escrow_before - dust.buyer_escrow,
        gross + taker_fee,
        "покупатель платит сделку и тейкерскую комиссию, ни лампортом больше"
    );
    assert_eq!(
        dust.buyer_escrow + dust.seller_wallet + dust.treasury,
        dust.total,
        "ни один лампорт не создан и не уничтожен"
    );

    // max: произведение цены и объёма не должно переполниться.
    let max = match_orders(u64::MAX, 2, u64::MAX, 2);
    rejected(max.result, "MathOverflow");
    assert_eq!(max.cpis, 0, "отказ до токен-перевода");
    assert_eq!((max.buy_remaining, max.sell_remaining), (2, 2), "заявки не тронуты");
    assert_eq!(
        max.buyer_escrow + max.seller_wallet + max.treasury,
        max.total,
        "ни один лампорт не сдвинулся"
    );

    // max по комиссии: сделка проходит по цене, а процент от неё переполняется.
    let fee_overflow = match_orders(u64::MAX / 2, 1, u64::MAX / 2, 1);
    rejected(fee_overflow.result, "MathOverflow");
    assert_eq!(fee_overflow.cpis, 0, "отказ до токен-перевода");
    assert_eq!((fee_overflow.buy_remaining, fee_overflow.sell_remaining), (1, 1));
}

// ----------------------------------------------------------------------
// transfer через казну: `pay_out_with_referral`
// ----------------------------------------------------------------------

#[test]
fn referral_claim_matrix_zero_one_and_max() {
    // 0: отвергается до расхода эпохи.
    let zero = referral_payout(PayoutCase { amount: 0, ..PayoutCase::default() });
    rejected(zero.0, "ZeroAmount");
    assert_eq!(zero.1, 0, "ни одного перевода из казны");
    assert_eq!(zero.2.withdrawn_in_epoch, 0, "лимит эпохи не израсходован");

    // 1: минимальная выплата. Доля реферера округляется вниз до нуля, поэтому
    // уходит ровно одна единица — выдано = начислено, пыли сверху нет.
    let one = referral_payout(PayoutCase { amount: 1, ..PayoutCase::default() });
    assert!(one.0.is_ok(), "{:?}", one.0);
    assert_eq!(one.1, 1, "рефереру не достаётся пыль: единственный перевод — игроку");
    assert_eq!(one.2.withdrawn_in_epoch, 1, "лимит эпохи израсходован ровно на выплату");

    // max: казна не может выдать больше, чем в ней есть.
    let max = referral_payout(PayoutCase {
        amount: u64::MAX,
        max_per_tx: u64::MAX,
        ..PayoutCase::default()
    });
    rejected(max.0, "VaultInsufficient");
    assert_eq!(max.1, 0, "ни одного перевода");
    assert_eq!(max.2.withdrawn_in_epoch, 0, "отвергнутая выплата не расходует лимит эпохи");
}
