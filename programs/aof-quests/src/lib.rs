use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod vrf;

pub use errors::*;
pub use instructions::*;
pub use state::*;
pub use vrf::VrfRevealParams;

declare_id!("2SLSduEGX9UDXH2h1P37ELzdPagJuV752favytPixdKc");

#[program]
pub mod aof_quests {
    use super::*;

    /// Create a versioned, isolated MIND treasury ATA, initially paused.
    /// Historical QuestConfig mints/commits remain on their original path.
    pub fn init_mind_bank(ctx: Context<InitMindBank>) -> Result<()> {
        instructions::drum::mind_bank::init_handler(ctx)
    }

    /// Operator pause for FUTURE V2 MIND commits only; settlements/refunds
    /// must remain permissionless even when this switch is on.
    pub fn set_mind_bank_paused(ctx: Context<SetMindBankPaused>, paused: bool) -> Result<()> {
        instructions::drum::mind_bank::set_paused_handler(ctx, paused)
    }

    /// V2 custody, 5 whole MIND units per spin. Hard-disabled pending signed devnet validation.
    pub fn mind_spin_commit(ctx: Context<MindSpinCommit>) -> Result<()> {
        instructions::drum::mind_spin::commit_handler(ctx)
    }

    /// Existing V2 spins may settle even while the bank is paused.
    pub fn mind_spin_reveal(ctx: Context<MindSpinReveal>, params: VrfRevealParams) -> Result<()> {
        instructions::drum::mind_spin::reveal_handler(ctx, params)
    }

    /// Permissionless refund after the oracle reveal window closes.
    pub fn mind_spin_expire(ctx: Context<MindSpinExpire>) -> Result<()> {
        instructions::drum::mind_spin::expire_handler(ctx)
    }

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

    /// [F-06] Paid spin committed to the program-owned Switchboard pool.
    pub fn drum_commit(ctx: Context<DrumCommitCtx>) -> Result<()> {
        instructions::drum::drum_commit::handler(ctx)
    }

    /// [F-06] Permissionless settlement with the oracle's signed value.
    pub fn drum_reveal(ctx: Context<DrumReveal>, params: VrfRevealParams) -> Result<()> {
        instructions::drum::drum_reveal::handler(ctx, params)
    }

    /// [F-06] Refund a spin the oracle never revealed.
    pub fn drum_expire(ctx: Context<DrumExpire>) -> Result<()> {
        instructions::drum::drum_expire::handler(ctx)
    }

    /// [F-06] Authority: add pool randomness account #index.
    pub fn vrf_pool_add(ctx: Context<QuestVrfPoolAdd>, index: u32, recent_slot: u64) -> Result<()> {
        instructions::drum::vrf_pool::add_handler(ctx, index, recent_slot)
    }

    /// [F-06] Authority: retire / re-enable a free pool slot.
    pub fn vrf_pool_set_retired(ctx: Context<QuestVrfPoolSetRetired>, retired: bool) -> Result<()> {
        instructions::drum::vrf_pool::set_retired_handler(ctx, retired)
    }
}
