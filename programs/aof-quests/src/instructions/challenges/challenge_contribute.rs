use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{QuestConfig, ChallengeRound, ChallengeContribution};
use crate::errors::QuestError;
use crate::events::ChallengeContributed;

#[derive(Accounts)]
#[instruction(week_number: u32)]
pub struct ChallengeContribute<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        mut,
        seeds = [b"challenge_round", week_number.to_le_bytes().as_ref()],
        bump = challenge_round.bump,
        constraint = challenge_round.active @ QuestError::ChallengeNotActive,
        constraint = challenge_round.week_number == week_number @ QuestError::InvalidInput
    )]
    pub challenge_round: Account<'info, ChallengeRound>,

    #[account(
        init_if_needed,
        payer = user,
        space = ChallengeContribution::SIZE,
        seeds = [b"challenge_contrib", user.key().as_ref(), week_number.to_le_bytes().as_ref()],
        bump
    )]
    pub contribution: Account<'info, ChallengeContribution>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_mascot.mint == quest_config.mascot_mint @ QuestError::InvalidData,
        constraint = user_mascot.owner == user.key() @ QuestError::Unauthorized
    )]
    pub user_mascot: Account<'info, TokenAccount>,

    /// Program escrow. Contributions land here, not in a counter.
    #[account(
        mut,
        associated_token::mint = quest_config.mascot_mint,
        associated_token::authority = quest_config
    )]
    pub escrow_mascot: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ChallengeContribute>, week_number: u32, medals: u64) -> Result<()> {
    require!(medals > 0, QuestError::InvalidInput);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_mascot.to_account_info(),
                to: ctx.accounts.escrow_mascot.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        medals,
    )?;

    let round = &mut ctx.accounts.challenge_round;
    round.contributed_total = round.contributed_total.checked_add(medals).ok_or(QuestError::MathOverflow)?;

    let contrib = &mut ctx.accounts.contribution;
    if contrib.user == Pubkey::default() {
        contrib.user = ctx.accounts.user.key();
        contrib.week_number = week_number;
        contrib.bump = ctx.bumps.contribution;
        contrib.medals = 0;
    }
    require_keys_eq!(contrib.user, ctx.accounts.user.key(), QuestError::Unauthorized);
    require!(contrib.week_number == week_number, QuestError::InvalidInput);
    contrib.medals = contrib.medals.checked_add(medals).ok_or(QuestError::MathOverflow)?;

    emit!(ChallengeContributed {
        user: ctx.accounts.user.key(),
        week_number,
        medals,
    });
    Ok(())
}
