use anchor_lang::prelude::*;
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
        constraint = challenge_round.active @ QuestError::ChallengeNotActive
    )]
    pub challenge_round: Account<'info, ChallengeRound>,

    #[account(
        init,
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

pub fn handler(_ctx: Context<ChallengeContribute>, _week_number: u32, _medals: u64) -> Result<()> {
    // The previous implementation only incremented counters. It did not debit
    // a canonical medals mint and had no claim/settlement path, which would
    // make contribution progress freely forgeable. Keep this feature closed
    // until the economic asset and settlement semantics are specified.
    return err!(QuestError::FeatureDisabled);

    /*
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
    */
}
