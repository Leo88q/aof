use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{QuestConfig, ChallengeRound, ChallengeContribution};
use crate::errors::QuestError;
use crate::events::ChallengePayoutClaimed;

#[derive(Accounts)]
#[instruction(week_number: u32)]
pub struct ChallengeClaim<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        seeds = [b"challenge_round", week_number.to_le_bytes().as_ref()],
        bump = challenge_round.bump,
        constraint = !challenge_round.active @ QuestError::ChallengeNotActive,
        constraint = challenge_round.week_number == week_number @ QuestError::InvalidInput
    )]
    pub challenge_round: Account<'info, ChallengeRound>,

    #[account(
        mut,
        seeds = [b"challenge_contrib", user.key().as_ref(), week_number.to_le_bytes().as_ref()],
        bump = contribution.bump,
        constraint = contribution.user == user.key() @ QuestError::Unauthorized
    )]
    pub contribution: Account<'info, ChallengeContribution>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = quest_config.mascot_mint,
        associated_token::authority = quest_config
    )]
    pub escrow_mascot: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_mascot.mint == quest_config.mascot_mint @ QuestError::InvalidData,
        constraint = user_mascot.owner == user.key() @ QuestError::Unauthorized
    )]
    pub user_mascot: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(week_number: u32)]
pub struct ChallengeClose<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        has_one = authority @ QuestError::Unauthorized
    )]
    pub quest_config: Account<'info, QuestConfig>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"challenge_round", week_number.to_le_bytes().as_ref()],
        bump = challenge_round.bump
    )]
    pub challenge_round: Account<'info, ChallengeRound>,
}

pub fn close_handler(ctx: Context<ChallengeClose>, _week_number: u32) -> Result<()> {
    ctx.accounts.challenge_round.active = false;
    Ok(())
}

/// Pro-rata payout of the round's pool. Zeroing `medals` makes a second claim
/// pay zero. Dust from integer division stays in the escrow.
pub fn claim_handler(ctx: Context<ChallengeClaim>, week_number: u32) -> Result<()> {
    let medals = ctx.accounts.contribution.medals;
    require!(medals > 0, QuestError::AlreadyClaimed);
    let total = ctx.accounts.challenge_round.contributed_total;
    require!(total > 0, QuestError::InvalidData);
    let pool = ctx.accounts.challenge_round.medals_pool;
    let payout = (pool as u128)
        .checked_mul(medals as u128)
        .and_then(|v| v.checked_div(total as u128))
        .ok_or(QuestError::MathOverflow)? as u64;
    require!(payout > 0, QuestError::InvalidInput);
    require!(ctx.accounts.escrow_mascot.amount >= payout, QuestError::InvalidData);

    let bump = [ctx.accounts.quest_config.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[b"quest_config", &bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_mascot.to_account_info(),
                to: ctx.accounts.user_mascot.to_account_info(),
                authority: ctx.accounts.quest_config.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
    )?;
    ctx.accounts.contribution.medals = 0;
    emit!(ChallengePayoutClaimed {
        user: ctx.accounts.user.key(),
        week_number,
        payout,
    });
    Ok(())
}
