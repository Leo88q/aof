//! V2 Potato spin accounts are disjoint from historical `drum_commit` PDAs.
//! All custody and liability transitions happen inside the corresponding SPL
//! transfer instruction; an error in ANY CPI rolls back the entire transaction.
//! New sales remain hard-disabled until the contract is built, independently
//! audited and exercised on devnet with the operator's actual mint.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::QuestError;
use crate::events::{PotatoSpinCommitted, PotatoSpinRefunded, PotatoSpinRevealed};
use crate::state::{PotatoCommit, PotatoBank, VrfSlot, POTATO_BANK_SEED, POTATO_SPIN_PRICE, POTATO_UNIT};
use crate::vrf::{self, VrfRevealParams, SLOT_HASHES_ID, VRF_AUTHORITY_SEED, VRF_SLOT_SEED};

const COMMIT_SEED: &[u8] = b"potato_commit";

#[derive(Accounts)]
pub struct PotatoSpinCommit<'info> {
    #[account(init, payer = user, space = PotatoCommit::SIZE,
        seeds = [COMMIT_SEED, user.key().as_ref()], bump)]
    pub potato_commit: Account<'info, PotatoCommit>,
    #[account(mut, seeds = [POTATO_BANK_SEED], bump = potato_bank.bump,
        constraint = !potato_bank.paused @ QuestError::PotatoBankPaused)]
    pub potato_bank: Box<Account<'info, PotatoBank>>,
    #[account(mut, address = potato_bank.vault @ QuestError::Unauthorized,
        token::mint = potato_bank.mint, token::authority = potato_bank)]
    pub potato_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, associated_token::mint = potato_bank.mint,
        associated_token::authority = user)]
    pub user_mind: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [VRF_SLOT_SEED, randomness.key().as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,
    /// CHECK: owner, authority, queue and freshness are checked by vrf::commit.
    #[account(mut, address = vrf_slot.randomness @ QuestError::InvalidRandomnessAccount)]
    pub randomness: UncheckedAccount<'info>,
    /// CHECK: canonical PDA, used by the Switchboard CPI only.
    #[account(seeds = [VRF_AUTHORITY_SEED], bump)]
    pub vrf_authority: UncheckedAccount<'info>,
    /// CHECK: trusted queue.
    #[account(address = crate::vrf::SWITCHBOARD_QUEUE @ QuestError::InvalidRandomnessAccount)]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: Switchboard validates this queue oracle.
    #[account(mut)]
    pub oracle: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar.
    #[account(address = SLOT_HASHES_ID)]
    pub recent_slothashes: UncheckedAccount<'info>,
    pub switchboard_program: Program<'info, crate::vrf::SwitchboardOnDemand>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn commit_handler(ctx: Context<PotatoSpinCommit>) -> Result<()> {
    // An operator cannot activate sales just by unpausing the bank. Remove this
    // line ONLY after generated-IDL/build checks, signed concurrent-spin and
    // refund smoke tests, mint verification, and independent release approval.
    require!(false, QuestError::FeatureDisabled);

    // Credit the actual vault first, then reload its SPL balance. There is no
    // read-before-transfer race: a Solana transaction locks both writable
    // accounts, and ALL mutations roll back if the VRF CPI later fails.
    token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
        from: ctx.accounts.user_mind.to_account_info(),
        to: ctx.accounts.potato_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    }), POTATO_SPIN_PRICE)?;
    ctx.accounts.potato_vault.reload()?;
    ctx.accounts.potato_bank.reserve(ctx.accounts.potato_vault.amount)?;

    let clock = Clock::get()?;
    let commit_key = ctx.accounts.potato_commit.key();
    let accounts = vrf::CommitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
    };
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, &accounts,
        ctx.bumps.vrf_authority, clock.slot)?;
    let commit = &mut ctx.accounts.potato_commit;
    commit.user = ctx.accounts.user.key();
    commit.bump = ctx.bumps.potato_commit;
    commit.randomness = ctx.accounts.randomness.key();
    commit.seed_slot = seed_slot;
    commit.commit_slot = clock.slot;
    commit.created_at = clock.unix_timestamp;
    commit.cost = POTATO_SPIN_PRICE;
    emit!(PotatoSpinCommitted { user: commit.user, commit: commit_key,
        mint: ctx.accounts.potato_bank.mint, price_atoms: POTATO_SPIN_PRICE,
        randomness: commit.randomness, seed_slot });
    Ok(())
}

#[derive(Accounts)]
pub struct PotatoSpinReveal<'info> {
    #[account(mut, seeds = [COMMIT_SEED, potato_commit.user.as_ref()],
        bump = potato_commit.bump, close = user,
        constraint = potato_commit.cost == POTATO_SPIN_PRICE @ QuestError::InvalidInput)]
    pub potato_commit: Account<'info, PotatoCommit>,
    // Deliberately NO pause constraint: already-paid spins always settle.
    #[account(mut, seeds = [POTATO_BANK_SEED], bump = potato_bank.bump)]
    pub potato_bank: Box<Account<'info, PotatoBank>>,
    #[account(mut)]
    pub cranker: Signer<'info>,
    /// CHECK: canonical owner of the commit; receives rent and payout.
    #[account(mut, address = potato_commit.user @ QuestError::Unauthorized)]
    pub user: UncheckedAccount<'info>,
    #[account(mut, address = potato_bank.vault @ QuestError::Unauthorized,
        token::mint = potato_bank.mint, token::authority = potato_bank)]
    pub potato_vault: Box<Account<'info, TokenAccount>>,
    #[account(address = potato_bank.mint @ QuestError::Unauthorized)]
    pub mind_mint: Box<Account<'info, Mint>>,
    #[account(init_if_needed, payer = cranker, associated_token::mint = mind_mint,
        associated_token::authority = user)]
    pub user_mind: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [VRF_SLOT_SEED, potato_commit.randomness.as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,
    /// CHECK: the locked randomness; vrf::reveal verifies the signed value.
    #[account(mut, address = potato_commit.randomness @ QuestError::InvalidRandomnessAccount)]
    pub randomness: UncheckedAccount<'info>,
    /// CHECK: canonical Switchboard authority PDA.
    #[account(seeds = [VRF_AUTHORITY_SEED], bump)]
    pub vrf_authority: UncheckedAccount<'info>,
    /// CHECK: assigned oracle verified against the randomness account.
    #[account(constraint = crate::vrf::assigned_oracle_is(&randomness, &oracle.key()) @ QuestError::InvalidRandomnessAccount)]
    pub oracle: UncheckedAccount<'info>,
    /// CHECK: trusted queue.
    #[account(address = crate::vrf::SWITCHBOARD_QUEUE @ QuestError::InvalidRandomnessAccount)]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: canonical stats PDA.
    #[account(mut, constraint = stats.key() == crate::vrf::stats_address(&oracle.key()) @ QuestError::InvalidRandomnessAccount)]
    pub stats: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar.
    #[account(address = SLOT_HASHES_ID)]
    pub recent_slothashes: UncheckedAccount<'info>,
    /// CHECK: canonical wSOL reward escrow.
    #[account(mut, constraint = reward_escrow.key() == crate::vrf::reward_escrow_address(&randomness.key()) @ QuestError::InvalidRandomnessAccount)]
    pub reward_escrow: UncheckedAccount<'info>,
    /// CHECK: native SOL mint.
    #[account(address = anchor_spl::token::spl_token::native_mint::ID)]
    pub wrapped_sol_mint: UncheckedAccount<'info>,
    /// CHECK: canonical Switchboard state PDA.
    #[account(address = crate::vrf::SWITCHBOARD_STATE @ QuestError::InvalidRandomnessAccount)]
    pub program_state: UncheckedAccount<'info>,
    pub switchboard_program: Program<'info, crate::vrf::SwitchboardOnDemand>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn reveal_handler(ctx: Context<PotatoSpinReveal>, params: VrfRevealParams) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.potato_commit.key();
    let (randomness, seed_slot, commit_slot) = (ctx.accounts.potato_commit.randomness,
        ctx.accounts.potato_commit.seed_slot, ctx.accounts.potato_commit.commit_slot);
    let accounts = vrf::RevealAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        stats: ctx.accounts.stats.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
        payer: ctx.accounts.cranker.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
        reward_escrow: ctx.accounts.reward_escrow.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
        wrapped_sol_mint: ctx.accounts.wrapped_sol_mint.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
    };
    let value = vrf::reveal(&mut ctx.accounts.vrf_slot, &commit_key, &randomness,
        seed_slot, commit_slot, &accounts, &params, ctx.bumps.vrf_authority, clock.slot)?;
    // The audited 60/25/10/4/1% table returns WHOLE units. V2 PDA is a
    // different hash context from legacy drum; no historical amounts change.
    let prize = crate::instructions::drum::drum_reveal::drum_prize(&value, &commit_key)
        .checked_mul(POTATO_UNIT).ok_or(QuestError::MathOverflow)?;
    ctx.accounts.potato_bank.release(ctx.accounts.potato_vault.amount, prize)?;
    pay(&ctx.accounts.token_program, &ctx.accounts.potato_bank,
        &ctx.accounts.potato_vault, &ctx.accounts.user_mind, prize)?;
    emit!(PotatoSpinRevealed { user: ctx.accounts.user.key(), commit: commit_key,
        mint: ctx.accounts.potato_bank.mint, prize_atoms: prize, randomness,
        seed_slot, value, cranker: ctx.accounts.cranker.key() });
    Ok(())
}

#[derive(Accounts)]
pub struct PotatoSpinExpire<'info> {
    #[account(mut, seeds = [COMMIT_SEED, potato_commit.user.as_ref()],
        bump = potato_commit.bump, close = user,
        constraint = potato_commit.cost == POTATO_SPIN_PRICE @ QuestError::InvalidInput)]
    pub potato_commit: Account<'info, PotatoCommit>,
    #[account(mut, seeds = [POTATO_BANK_SEED], bump = potato_bank.bump)]
    pub potato_bank: Box<Account<'info, PotatoBank>>,
    #[account(mut)]
    pub cranker: Signer<'info>,
    /// CHECK: stored owner, never an arbitrary refund address.
    #[account(mut, address = potato_commit.user @ QuestError::Unauthorized)]
    pub user: UncheckedAccount<'info>,
    #[account(mut, address = potato_bank.vault @ QuestError::Unauthorized,
        token::mint = potato_bank.mint, token::authority = potato_bank)]
    pub potato_vault: Box<Account<'info, TokenAccount>>,
    #[account(address = potato_bank.mint @ QuestError::Unauthorized)]
    pub mind_mint: Box<Account<'info, Mint>>,
    #[account(init_if_needed, payer = cranker, associated_token::mint = mind_mint,
        associated_token::authority = user)]
    pub user_mind: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [VRF_SLOT_SEED, potato_commit.randomness.as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn expire_handler(ctx: Context<PotatoSpinExpire>) -> Result<()> {
    let commit_key = ctx.accounts.potato_commit.key();
    vrf::release_for_refund(&mut ctx.accounts.vrf_slot, &commit_key,
        ctx.accounts.potato_commit.commit_slot, Clock::get()?.slot)?;
    ctx.accounts.potato_bank.release(ctx.accounts.potato_vault.amount, POTATO_SPIN_PRICE)?;
    pay(&ctx.accounts.token_program, &ctx.accounts.potato_bank,
        &ctx.accounts.potato_vault, &ctx.accounts.user_mind, POTATO_SPIN_PRICE)?;
    emit!(PotatoSpinRefunded { user: ctx.accounts.potato_commit.user, commit: commit_key,
        mint: ctx.accounts.potato_bank.mint, amount_atoms: POTATO_SPIN_PRICE });
    Ok(())
}

fn pay<'info>(token_program: &Program<'info, Token>, bank: &Account<'info, PotatoBank>,
    vault: &Account<'info, TokenAccount>, recipient: &Account<'info, TokenAccount>, amount: u64) -> Result<()> {
    let bump = [bank.bump];
    let seeds: &[&[u8]] = &[POTATO_BANK_SEED, &bump];
    token::transfer(CpiContext::new_with_signer(token_program.to_account_info(), Transfer {
        from: vault.to_account_info(), to: recipient.to_account_info(),
        authority: bank.to_account_info(),
    }, &[seeds]), amount)?;
    Ok(())
}
