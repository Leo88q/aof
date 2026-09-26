//! Host-side security regression suite for the 30-item Anchor checklist
//! reviewed in `SECURITY_CHECKLIST_REVIEW_2026-09-26.md` (items are cited as
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

// ======================================================================
// Host runtime: sysvars + CPI recorder
// ======================================================================

const NOW_TS: i64 = 1_760_000_000;
const SLOT_NOW: u64 = 5_000;
const WALLET_LAMPORTS: u64 = 5_000_000_000;

thread_local! {
    static CPI_CALLS: Cell<usize> = Cell::new(0);
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
        _instruction: &Instruction,
        _account_infos: &[AccountInfo],
        _signers_seeds: &[&[&[u8]]],
    ) -> ProgramResult {
        CPI_CALLS.with(|calls| calls.set(calls.get() + 1));
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
}

fn cpi_calls() -> usize {
    CPI_CALLS.with(|calls| calls.get())
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
                wallet(w.authority, true),
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
            vec![w.config_info(), wallet(w.authority, true), tank(), wallet(Pubkey::new_unique(), false), system_program_info()],
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
}

impl Default for PayoutCase {
    fn default() -> Self {
        PayoutCase {
            amount: 10_000,
            non_resource_mint: false,
            guard_for_other_mint: false,
            max_per_tx: 50_000,
            withdrawn_in_epoch: 0,
        }
    }
}

/// Run the REAL `pay_out_with_referral` handler; returns (result, CPIs, guard).
fn referral_payout(case: PayoutCase) -> (Result<()>, usize, VaultGuard) {
    runtime();
    let w = World::new();
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
        wallet(w.authority, true),
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
    let (mut accounts, bumps) = parse::<PayOutWithReferral>(infos, &case.amount.to_le_bytes()).unwrap();
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
    runtime();
    let mut w = World::new();
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
            vec![w.config_info(), wallet(w.authority, true), tank.clone(), treasury.clone(), system_program_info()],
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
            token_account(Pubkey::new_unique(), mint, buyer, 0),
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
                token_account(Pubkey::new_unique(), mint, maker, 0),
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
