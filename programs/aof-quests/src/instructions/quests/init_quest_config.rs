use anchor_lang::prelude::*;
use crate::state::QuestConfig;
use crate::events::QuestConfigInitialized;

#[derive(Accounts)]
pub struct InitQuestConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = QuestConfig::SIZE,
        seeds = [b"quest_config"],
        bump
    )]
    pub quest_config: Account<'info, QuestConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitQuestConfig>,
    mascot_mint: Pubkey,
    treasury_mascot: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.quest_config;
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.quest_config;
    config.mascot_mint = mascot_mint;
    config.treasury_mascot = treasury_mascot;
    config.paused = false;

    emit!(QuestConfigInitialized {
        authority: ctx.accounts.authority.key(),
        mascot_mint,
    });

    Ok(())
}
