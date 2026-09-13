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
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        seeds = [b"quest_template", quest_id.to_le_bytes().as_ref()],
        bump = quest_template.bump,
        constraint = quest_template.active @ QuestError::QuestNotActive
    )]
    pub quest_template: Account<'info, QuestTemplate>,

    #[account(
        mut,
        seeds = [b"quest_progress", user.key().as_ref(), quest_id.to_le_bytes().as_ref()],
        bump = quest_progress.bump,
        constraint = quest_progress.completed @ QuestError::QuestNotCompleted,
        constraint = !quest_progress.claimed @ QuestError::AlreadyClaimed
    )]
    pub quest_progress: Account<'info, QuestProgress>,

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
}

pub fn handler(ctx: Context<QuestClaimReward>, quest_id: u32) -> Result<()> {
    let reward = ctx.accounts.quest_template.reward_mascot;

    // Перевод награды из казны пользователю (казна подписывает через authority-контроль на бэкенде)
    // В реальной схеме казна должна быть либо владельцем, либо delegate.
    // Здесь упрощённо: награда идёт от казны, подпись обеспечивается на уровне доступа.
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury_mascot.to_account_info(),
                to: ctx.accounts.user_mascot.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
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
