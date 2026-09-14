use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{DrumCommit, QuestConfig};
use crate::errors::QuestError;
use crate::events::DrumCommitted;

/// Стоимость одного спина барабана в маскотах (медалях).
pub const DRUM_SPIN_COST_MASCOT: u64 = 5;

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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DrumCommitCtx>, hash: [u8; 32]) -> Result<()> {
    // The spin burns the user's mascot before reveal, while the contract has
    // no expiry/refund path. The API is disabled; fail closed for direct
    // program callers as well.
    require!(false, QuestError::FeatureDisabled);

    // [ФИКС] Списание стоимости спина с пользователя в казну ДО розыгрыша.
    // Юзер подписывает перевод своих маскотов -> защита от бесплатного спина.
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

    let commit = &mut ctx.accounts.drum_commit;
    commit.user = ctx.accounts.user.key();
    commit.bump = ctx.bumps.drum_commit;
    let clock = Clock::get()?;
    commit.hash = hash;
    commit.created_at = clock.unix_timestamp;
    commit.commit_slot = clock.slot;

    emit!(DrumCommitted {
        user: ctx.accounts.user.key(),
    });

    Ok(())
}
