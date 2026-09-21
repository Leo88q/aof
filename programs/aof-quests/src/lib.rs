use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use instructions::*;
pub use state::*;

declare_id!("4fNKhVw2nErWZBBw9hgWD3Metu1UKbDLdhFGWbCewdLU");

#[program]
pub mod aof_quests {
    use super::*;

    // ===== [AUDIT F-02] two-step authority rotation =====
    pub fn set_pending_authority(ctx: Context<SetPendingAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::quests::authority::set_pending_authority_handler(ctx, new_authority)
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        instructions::quests::authority::accept_authority_handler(ctx)
    }

    pub fn cancel_pending_authority(ctx: Context<CancelPendingAuthority>) -> Result<()> {
        instructions::quests::authority::cancel_pending_authority_handler(ctx)
    }

    pub fn init_quest_config(
        ctx: Context<InitQuestConfig>,
        mascot_mint: Pubkey,
        treasury_mascot: Pubkey,
    ) -> Result<()> {
        instructions::quests::init_quest_config::handler(ctx, mascot_mint, treasury_mascot)
    }

    pub fn quest_init(
        ctx: Context<QuestInit>,
        quest_id: u32,
        reward_mascot: u64,
    ) -> Result<()> {
        instructions::quests::quest_init::handler(ctx, quest_id, reward_mascot)
    }

    pub fn quest_claim_reward(ctx: Context<QuestClaimReward>, quest_id: u32) -> Result<()> {
        instructions::quests::quest_claim_reward::handler(ctx, quest_id)
    }

    pub fn achievement_unlock(ctx: Context<AchievementUnlock>, achievement_id: u32) -> Result<()> {
        instructions::quests::achievement_unlock::handler(ctx, achievement_id)
    }

    pub fn challenge_init(
        ctx: Context<ChallengeInit>,
        week_number: u32,
        medals_pool: u64,
    ) -> Result<()> {
        instructions::challenges::challenge_init::handler(ctx, week_number, medals_pool)
    }

    pub fn challenge_contribute(ctx: Context<ChallengeContribute>, week_number: u32, medals: u64) -> Result<()> {
        instructions::challenges::challenge_contribute::handler(ctx, week_number, medals)
    }

    pub fn drum_commit(ctx: Context<DrumCommitCtx>, hash: [u8; 32]) -> Result<()> {
        instructions::drum::drum_commit::handler(ctx, hash)
    }

    pub fn drum_reveal(ctx: Context<DrumReveal>, secret: Vec<u8>) -> Result<()> {
        instructions::drum::drum_reveal::handler(ctx, secret)
    }
}
