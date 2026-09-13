use anchor_lang::prelude::*;
use crate::state::{QuestConfig, ChallengeRound};
use crate::events::ChallengeCreated;

#[derive(Accounts)]
#[instruction(week_number: u32)]
pub struct ChallengeInit<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        init,
        payer = authority,
        space = ChallengeRound::SIZE,
        seeds = [b"challenge_round", week_number.to_le_bytes().as_ref()],
        bump
    )]
    pub challenge_round: Account<'info, ChallengeRound>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ChallengeInit>, week_number: u32, medals_pool: u64) -> Result<()> {
    let round = &mut ctx.accounts.challenge_round;
    round.week_number = week_number;
    round.bump = ctx.bumps.challenge_round;
    round.medals_pool = medals_pool;
    round.contributed_total = 0;
    round.active = true;

    emit!(ChallengeCreated { week_number, medals_pool });

    Ok(())
}
