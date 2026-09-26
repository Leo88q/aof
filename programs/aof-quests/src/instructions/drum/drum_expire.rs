use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::errors::QuestError;
use crate::events::DrumRefunded;
use crate::state::{DrumCommit, QuestConfig, VrfSlot};
use crate::vrf::{self, VRF_SLOT_SEED};

/// [F-06] Refund of a spin the oracle never revealed. Permissionless and only
/// from `commit_slot + VRF_REFUND_AFTER_SLOTS`, the slot at which `drum_reveal`
/// stops accepting a reveal: refund and settlement are never open together.
#[derive(Accounts)]
pub struct DrumExpire<'info> {
    #[account(
        mut,
        seeds = [b"drum_commit", drum_commit.user.as_ref()],
        bump = drum_commit.bump,
        close = user
    )]
    pub drum_commit: Account<'info, DrumCommit>,

    #[account(seeds = [b"quest_config"], bump = quest_config.bump)]
    pub quest_config: Box<Account<'info, QuestConfig>>,

    #[account(mut)]
    pub cranker: Signer<'info>,

    /// CHECK: the spin's owner; the only possible recipient.
    #[account(mut, address = drum_commit.user @ QuestError::Unauthorized)]
    pub user: UncheckedAccount<'info>,

    #[account(mut, address = quest_config.treasury_mascot @ QuestError::Unauthorized)]
    pub treasury_mascot: Box<Account<'info, TokenAccount>>,

    #[account(address = quest_config.mascot_mint @ QuestError::Unauthorized)]
    pub mascot_mint: Box<Account<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = cranker,
        associated_token::mint = mascot_mint,
        associated_token::authority = user
    )]
    pub user_mascot: Box<Account<'info, TokenAccount>>,

    #[account(mut, seeds = [VRF_SLOT_SEED, drum_commit.randomness.as_ref()], bump = vrf_slot.bump)]
    pub vrf_slot: Box<Account<'info, VrfSlot>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DrumExpire>) -> Result<()> {
    let clock = Clock::get()?;
    let commit_key = ctx.accounts.drum_commit.key();
    let commit_slot = ctx.accounts.drum_commit.commit_slot;
    vrf::release_for_refund(&mut ctx.accounts.vrf_slot, &commit_key, commit_slot, clock.slot)?;

    let cost = ctx.accounts.drum_commit.cost;
    let config_bump = ctx.accounts.quest_config.bump;
    let bump_bytes = [config_bump];
    let config_seeds: &[&[u8]] = &[b"quest_config", &bump_bytes];
    let signer_seeds: &[&[&[u8]]] = &[config_seeds];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury_mascot.to_account_info(),
                to: ctx.accounts.user_mascot.to_account_info(),
                authority: ctx.accounts.quest_config.to_account_info(),
            },
            signer_seeds,
        ),
        cost,
    )?;

    emit!(DrumRefunded {
        user: ctx.accounts.drum_commit.user,
        amount: cost,
    });
    Ok(())
}
