use anchor_lang::prelude::*;
use crate::state::QuestConfig;
use crate::events::QuestConfigInitialized;
use crate::errors::QuestError;

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
    /// Canonical upgrade authority for the one-time quest-config bootstrap.
    #[account(address = Pubkey::find_program_address(
        &[crate::ID.as_ref()],
        &anchor_lang::solana_program::bpf_loader_upgradeable::id()
    ).0)]
    pub program_data: Account<'info, anchor_lang::ProgramData>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitQuestConfig>,
    mascot_mint: Pubkey,
    treasury_mascot: Pubkey,
) -> Result<()> {
    let upgrade_authority = ctx
        .accounts
        .program_data
        .upgrade_authority_address
        .ok_or(QuestError::Unauthorized)?;
    require_keys_eq!(upgrade_authority, ctx.accounts.authority.key(), QuestError::Unauthorized);

    let config = &mut ctx.accounts.quest_config;
    config.authority = ctx.accounts.authority.key();
    config.bump = ctx.bumps.quest_config;
    config.mascot_mint = mascot_mint;
    config.treasury_mascot = treasury_mascot;
    config.paused = false;
    // [AUDIT F-02] no rotation in flight at bootstrap.
    config.pending_authority = Pubkey::default();
    config.authority_updated_at = Clock::get()?.unix_timestamp;

    emit!(QuestConfigInitialized {
        authority: ctx.accounts.authority.key(),
        mascot_mint,
    });

    Ok(())
}
