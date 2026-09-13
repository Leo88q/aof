use anchor_lang::prelude::*;
use crate::state::{QuestConfig, ChallengeRound, ChallengeContribution};
use crate::errors::QuestError;
use crate::events::ChallengeContributed;

#[derive(Accounts)]
#[instruction(week_number: u32)]
pub struct ChallengeContribute<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        mut,
        seeds = [b"challenge_round", week_number.to_le_bytes().as_ref()],
        bump = challenge_round.bump,
        constraint = challenge_round.active @ QuestError::ChallengeNotActive
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ChallengeContribute>, week_number: u32, medals: u64) -> Result<()> {
    let round = &mut ctx.accounts.challenge_round;
    round.contributed_total = round.contributed_total.checked_add(medals).ok_or(QuestError::MathOverflow)?;

    let contrib = &mut ctx.accounts.contribution;
    contrib.user = ctx.accounts.user.key();
    contrib.week_number = week_number;
    contrib.bump = ctx.bumps.contribution;
    contrib.medals = contrib.medals.checked_add(medals).ok_or(QuestError::MathOverflow)?;

    emit!(ChallengeContributed {
        user: ctx.accounts.user.key(),
        week_number,
        medals,
    });

    Ok(())
}
