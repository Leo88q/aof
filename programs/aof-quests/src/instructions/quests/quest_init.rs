use anchor_lang::prelude::*;
use crate::state::{QuestConfig, QuestTemplate};
use crate::events::QuestCreated;

#[derive(Accounts)]
#[instruction(quest_id: u32)]
pub struct QuestInit<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        has_one = authority @ crate::errors::QuestError::Unauthorized
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(
        init,
        payer = authority,
        space = QuestTemplate::SIZE,
        seeds = [b"quest_template", quest_id.to_le_bytes().as_ref()],
        bump
    )]
    pub quest_template: Account<'info, QuestTemplate>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<QuestInit>, quest_id: u32, reward_mascot: u64) -> Result<()> {
    let template = &mut ctx.accounts.quest_template;
    template.quest_id = quest_id;
    template.bump = ctx.bumps.quest_template;
    template.reward_mascot = reward_mascot;
    template.active = true;

    emit!(QuestCreated { quest_id, reward_mascot });

    Ok(())
}
