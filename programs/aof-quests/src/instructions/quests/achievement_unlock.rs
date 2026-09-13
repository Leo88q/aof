use anchor_lang::prelude::*;
use crate::state::{QuestConfig, AchievementRecord};
use crate::errors::QuestError;
use crate::events::AchievementUnlocked;

#[derive(Accounts)]
#[instruction(achievement_id: u32)]
pub struct AchievementUnlock<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        init,
        payer = user,
        space = AchievementRecord::SIZE,
        seeds = [b"achievement", user.key().as_ref(), achievement_id.to_le_bytes().as_ref()],
        bump
    )]
    pub achievement_record: Account<'info, AchievementRecord>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AchievementUnlock>, achievement_id: u32) -> Result<()> {
    let record = &mut ctx.accounts.achievement_record;
    record.user = ctx.accounts.user.key();
    record.achievement_id = achievement_id;
    record.bump = ctx.bumps.achievement_record;
    record.unlocked_at = Clock::get()?.unix_timestamp;

    emit!(AchievementUnlocked {
        user: ctx.accounts.user.key(),
        achievement_id,
    });

    Ok(())
}
