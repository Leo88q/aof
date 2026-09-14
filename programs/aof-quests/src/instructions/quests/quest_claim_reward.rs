use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{QuestConfig, QuestTemplate, QuestProgress};
use crate::errors::QuestError;
use crate::events::QuestRewardClaimed;

#[derive(Accounts)]
#[instruction(quest_id: u32)]
pub struct QuestClaimReward<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        has_one = authority @ QuestError::Unauthorized,
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        seeds = [b"quest_template", quest_id.to_le_bytes().as_ref()],
        bump = quest_template.bump,
        constraint = quest_template.active @ QuestError::QuestNotActive,
        constraint = quest_template.quest_id == quest_id @ QuestError::Unauthorized
    )]
    pub quest_template: Account<'info, QuestTemplate>,

    #[account(
        mut,
        seeds = [b"quest_progress", user.key().as_ref(), quest_id.to_le_bytes().as_ref()],
        bump = quest_progress.bump,
        constraint = quest_progress.user == user.key() @ QuestError::Unauthorized,
        constraint = quest_progress.quest_id == quest_id @ QuestError::Unauthorized,
        constraint = quest_progress.completed @ QuestError::QuestNotCompleted,
        constraint = !quest_progress.claimed @ QuestError::AlreadyClaimed
    )]
    pub quest_progress: Account<'info, QuestProgress>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub authority: Signer<'info>,

    #[account(
        mut,
        address = quest_config.treasury_mascot @ QuestError::Unauthorized,
        constraint = treasury_mascot.owner == quest_config.key() @ QuestError::Unauthorized,
        constraint = treasury_mascot.mint == quest_config.mascot_mint @ QuestError::Unauthorized
    )]
    pub treasury_mascot: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = quest_config.mascot_mint,
        associated_token::authority = user
    )]
    pub user_mascot: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<QuestClaimReward>, quest_id: u32) -> Result<()> {
    let reward = ctx.accounts.quest_template.reward_mascot;
    let bump = [ctx.accounts.quest_config.bump];
    let signer_seeds: &[&[&[u8]]] = &[&[b"quest_config", &bump]];

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
        reward,
    )?;

    ctx.accounts.quest_progress.claimed = true;

    emit!(QuestRewardClaimed {
        user: ctx.accounts.user.key(),
        quest_id,
        reward_mascot: reward,
    });

    Ok(())
}
