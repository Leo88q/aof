use anchor_lang::prelude::*;
use crate::state::{QuestConfig, AchievementRecord};
use crate::errors::QuestError;
use crate::events::AchievementUnlocked;

/// aof-core program id. Proof accounts must be owned by it and match a PDA
/// this program can recompute. A player signature alone is not a proof.
pub const CORE_PROGRAM_ID: Pubkey = pubkey!("okiLaCvFyHqFRFf359emmunPKD77uUmLQ2iJWskZdnx");

#[derive(Accounts)]
#[instruction(achievement_id: u32)]
pub struct AchievementUnlock<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        constraint = !quest_config.paused @ QuestError::Paused
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

    /// CHECK: aof-core PDA named by `achievement_id`. Owner and seeds are checked.
    pub proof: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

fn require_core_pda(account: &AccountInfo, seeds: &[&[u8]]) -> Result<()> {
    require_keys_eq!(*account.owner, CORE_PROGRAM_ID, QuestError::InvalidData);
    let (expected, _) = Pubkey::find_program_address(seeds, &CORE_PROGRAM_ID);
    require_keys_eq!(*account.key, expected, QuestError::InvalidData);
    Ok(())
}

fn read_exact<'a>(data: &'a [u8], start: usize, len: usize) -> Result<&'a [u8]> {
    data.get(start..start + len).ok_or(error!(QuestError::InvalidData))
}

/// Shared by achievements and quest progress. Returns Ok only when the
/// named core account already shows the criterion.
pub fn require_progress(user: &Pubkey, achievement_id: u32, proof: &AccountInfo) -> Result<()> {
    let data = proof.try_borrow_data()?;
    match achievement_id {
        1 | 2 | 3 | 4 => {
            require_core_pda(proof, &[b"player", user.as_ref()])?;
            let body = read_exact(&data, 8, 32 + 8 + 1 + 4 + 4 + 1 + 1)?;
            require!(body[..32] == user.as_ref(), QuestError::Unauthorized);
            let has_tent = body[40] == 1;
            let villagers = u32::from_le_bytes(body[41..45].try_into().unwrap());
            let historian = body[49];
            let medallion = body[50];
            let ok = match achievement_id {
                1 => has_tent,
                2 => villagers >= 1,
                3 => historian > 0,
                _ => medallion > 0,
            };
            require!(ok, QuestError::QuestNotCompleted);
        }
        5 => {
            require_core_pda(proof, &[b"exploration_state", user.as_ref()])?;
            let body = read_exact(&data, 8, 33)?;
            require!(body[..32] == user.as_ref(), QuestError::Unauthorized);
            require!(body[32] >= 2, QuestError::QuestNotCompleted);
        }
        6 => {
            let season_id = u32::from_le_bytes(
                read_exact(&data, 40, 4)?.try_into().unwrap(),
            );
            require_core_pda(
                proof,
                &[b"season_pass", user.as_ref(), &season_id.to_le_bytes()],
            )?;
            require!(read_exact(&data, 8, 32)? == user.as_ref(), QuestError::Unauthorized);
            let xp = u32::from_le_bytes(read_exact(&data, 44, 4)?.try_into().unwrap());
            require!(xp >= 1_000, QuestError::QuestNotCompleted);
        }
        _ => return err!(QuestError::InvalidInput),
    }
    Ok(())
}

/// Criteria the player cannot write from this program:
/// 1 tent placed, 2 a villager, 3 historian, 4 medallion,
/// 5 exploration tier at least 2, 6 one season level of XP.
pub fn handler(ctx: Context<AchievementUnlock>, achievement_id: u32) -> Result<()> {
    let user = ctx.accounts.user.key();
    require_progress(&user, achievement_id, &ctx.accounts.proof.to_account_info())?;

    let record = &mut ctx.accounts.achievement_record;
    record.user = user;
    record.achievement_id = achievement_id;
    record.bump = ctx.bumps.achievement_record;
    record.unlocked_at = Clock::get()?.unix_timestamp;
    emit!(AchievementUnlocked { user, achievement_id });
    Ok(())
}
