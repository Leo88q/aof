use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{DrumCommit, QuestConfig, VrfSlot};
use crate::errors::QuestError;
use crate::events::DrumCommitted;
use crate::instructions::drum::drum_reveal::DRUM_MAX_PRIZE;
use crate::vrf::{self, SLOT_HASHES_ID, VRF_AUTHORITY_SEED, VRF_SLOT_SEED};

/// Стоимость одного спина барабана в маскотах (медалях).
pub const DRUM_SPIN_COST_MASCOT: u64 = 5;

/// [F-06] Paid spin: the cost moves to the treasury and a pool randomness
/// account is committed (CPI signed by this program's PDA) in the same
/// instruction. The prize is decided by the oracle only.
#[derive(Accounts)]
pub struct DrumCommitCtx<'info> {
    #[account(
        init,
        payer = user,
        space = DrumCommit::SIZE,
        seeds = [b"drum_commit", user.key().as_ref()],
        bump
    )]
    pub drum_commit: Account<'info, DrumCommit>,

    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(mut)]
    pub user: Signer<'info>,

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

    #[account(mut, seeds = [VRF_SLOT_SEED, randomness.key().as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,
    /// CHECK: pool randomness account; owner, authority and queue are verified by vrf::commit.
    #[account(mut, address = vrf_slot.randomness @ QuestError::InvalidRandomnessAccount)]
    pub randomness: UncheckedAccount<'info>,
    /// CHECK: PDA that signs the Switchboard CPI as the randomness authority.
    #[account(seeds = [VRF_AUTHORITY_SEED], bump)]
    pub vrf_authority: UncheckedAccount<'info>,
    /// CHECK: the trusted Switchboard queue.
    #[account(address = crate::vrf::SWITCHBOARD_QUEUE @ QuestError::InvalidRandomnessAccount)]
    pub queue: UncheckedAccount<'info>,
    /// CHECK: oracle picked from the queue by the client; Switchboard validates it.
    #[account(mut)]
    pub oracle: UncheckedAccount<'info>,
    /// CHECK: SlotHashes sysvar.
    #[account(address = SLOT_HASHES_ID)]
    pub recent_slothashes: UncheckedAccount<'info>,
    pub switchboard_program: Program<'info, crate::vrf::SwitchboardOnDemand>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DrumCommitCtx>) -> Result<()> {
    // Fail closed even for direct RPC clients: current constants are raw atoms,
    // not 5 whole units of a verified external MIND SPL mint. Replace with a
    // decimals-aware, funded version and complete the devnet review first.
    require!(false, QuestError::Paused);
    // The treasury must be able to pay the largest prize of this spin.
    require!(
        ctx.accounts.treasury_mascot.amount >= DRUM_MAX_PRIZE,
        QuestError::TreasuryTooLow
    );

    // Списание стоимости спина с пользователя в казну ДО розыгрыша.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_mascot.to_account_info(),
                to: ctx.accounts.treasury_mascot.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        DRUM_SPIN_COST_MASCOT,
    )?;

    let clock = Clock::get()?;
    let commit_key = ctx.accounts.drum_commit.key();
    let accounts = vrf::CommitAccounts {
        switchboard_program: ctx.accounts.switchboard_program.to_account_info(),
        randomness: ctx.accounts.randomness.to_account_info(),
        queue: ctx.accounts.queue.to_account_info(),
        oracle: ctx.accounts.oracle.to_account_info(),
        recent_slothashes: ctx.accounts.recent_slothashes.to_account_info(),
        vrf_authority: ctx.accounts.vrf_authority.to_account_info(),
    };
    let seed_slot = vrf::commit(&mut ctx.accounts.vrf_slot, commit_key, &accounts, ctx.bumps.vrf_authority, clock.slot)?;

    let commit = &mut ctx.accounts.drum_commit;
    commit.user = ctx.accounts.user.key();
    commit.bump = ctx.bumps.drum_commit;
    commit.randomness = ctx.accounts.randomness.key();
    commit.seed_slot = seed_slot;
    commit.commit_slot = clock.slot;
    commit.created_at = clock.unix_timestamp;
    commit.cost = DRUM_SPIN_COST_MASCOT;

    emit!(DrumCommitted {
        user: ctx.accounts.user.key(),
        randomness: commit.randomness,
        seed_slot,
    });
    Ok(())
}
