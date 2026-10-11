//! Daily reward, streak, comeback, neighbor visit, guild deposit and
//! quest-progress proof. None of these accept a player-written flag.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::errors::QuestError;
use crate::events::{ComebackClaimed, DailyClaimed, GuildDeposited, NeighborVisited, QuestProgressProven};
use crate::state::{QuestConfig, QuestProgress};

pub const DAY: i64 = 86_400;
pub const COMEBACK_GAP_DAYS: i64 = 3;
pub const DAILY_REWARD: u64 = 1_000_000_000;
pub const COMEBACK_REWARD: u64 = 3_000_000_000;
pub const NEIGHBOR_VISITS_PER_DAY: u8 = 3;

#[account]
#[derive(InitSpace)]
pub struct PlayerEngagement {
    pub user: Pubkey,
    pub last_daily_day: i64,
    pub streak: u16,
    pub best_streak: u16,
    pub last_comeback_day: i64,
    pub neighbor_day: i64,
    pub neighbor_visits: u8,
    pub guild_deposited: u64,
    pub bump: u8,
}

impl PlayerEngagement {
    pub const SPACE: usize = 8 + Self::INIT_SPACE;
}

fn day_index(now: i64) -> i64 {
    now.div_euclid(DAY)
}

fn pay<'info>(
    token_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    bump: u8,
    amount: u64,
) -> Result<()> {
    let bump_seed = [bump];
    let signer_seeds: &[&[&[u8]]] = &[&[b"quest_config", &bump_seed]];
    token::transfer(
        CpiContext::new_with_signer(
            token_program.clone(),
            Transfer { from: from.clone(), to: to.clone(), authority: authority.clone() },
            signer_seeds,
        ),
        amount,
    )
}

#[derive(Accounts)]
pub struct EngagementAccounts<'info> {
    #[account(
        seeds = [b"quest_config"],
        bump = quest_config.bump,
        constraint = !quest_config.paused @ QuestError::Paused
    )]
    pub quest_config: Account<'info, QuestConfig>,
    #[account(
        init_if_needed,
        payer = user,
        space = PlayerEngagement::SPACE,
        seeds = [b"engagement", user.key().as_ref()],
        bump
    )]
    pub engagement: Account<'info, PlayerEngagement>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        associated_token::mint = quest_config.mascot_mint,
        associated_token::authority = quest_config
    )]
    pub treasury_mascot: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_mascot.mint == quest_config.mascot_mint @ QuestError::InvalidData,
        constraint = user_mascot.owner == user.key() @ QuestError::Unauthorized
    )]
    pub user_mascot: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

fn touch(ctx: &mut Context<EngagementAccounts>) {
    let row = &mut ctx.accounts.engagement;
    if row.user == Pubkey::default() {
        row.user = ctx.accounts.user.key();
        row.bump = ctx.bumps.engagement;
    }
}

pub fn claim_daily(ctx: Context<EngagementAccounts>) -> Result<()> {
    let mut ctx = ctx;
    touch(&mut ctx);
    let now = Clock::get()?.unix_timestamp;
    let today = day_index(now);
    let bump = ctx.accounts.quest_config.bump;
    let (streak, amount) = {
        let row = &mut ctx.accounts.engagement;
        require!(row.last_daily_day != today, QuestError::AlreadyClaimed);
        if row.last_daily_day == today - 1 {
            row.streak = row.streak.saturating_add(1);
        } else {
            row.streak = 1;
        }
        if row.streak > row.best_streak {
            row.best_streak = row.streak;
        }
        row.last_daily_day = today;
        let streak = row.streak;
        let amount = DAILY_REWARD.saturating_add((streak as u64).saturating_mul(100_000_000));
        (streak, amount)
    };
    pay(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.treasury_mascot.to_account_info(),
        &ctx.accounts.user_mascot.to_account_info(),
        &ctx.accounts.quest_config.to_account_info(),
        bump,
        amount,
    )?;
    emit!(DailyClaimed { user: ctx.accounts.user.key(), day: today, streak, amount });
    Ok(())
}

pub fn claim_comeback(ctx: Context<EngagementAccounts>) -> Result<()> {
    let mut ctx = ctx;
    touch(&mut ctx);
    let today = day_index(Clock::get()?.unix_timestamp);
    let bump = ctx.accounts.quest_config.bump;
    {
        let row = &mut ctx.accounts.engagement;
        require!(row.last_daily_day != 0, QuestError::QuestNotCompleted);
        require!(today - row.last_daily_day >= COMEBACK_GAP_DAYS, QuestError::QuestNotCompleted);
        require!(row.last_comeback_day != today, QuestError::AlreadyClaimed);
        row.last_comeback_day = today;
        row.streak = 1;
    }
    pay(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.treasury_mascot.to_account_info(),
        &ctx.accounts.user_mascot.to_account_info(),
        &ctx.accounts.quest_config.to_account_info(),
        bump,
        COMEBACK_REWARD,
    )?;
    emit!(ComebackClaimed { user: ctx.accounts.user.key(), day: today, amount: COMEBACK_REWARD });
    Ok(())
}

#[derive(Accounts)]
pub struct NeighborVisit<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, constraint = !quest_config.paused @ QuestError::Paused)]
    pub quest_config: Account<'info, QuestConfig>,
    #[account(
        init_if_needed, payer = user, space = PlayerEngagement::SPACE,
        seeds = [b"engagement", user.key().as_ref()], bump
    )]
    pub engagement: Account<'info, PlayerEngagement>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: another player's engagement PDA. Must exist and not be this user.
    #[account(seeds = [b"engagement", neighbor_engagement.user.as_ref()], bump = neighbor_engagement.bump)]
    pub neighbor_engagement: Account<'info, PlayerEngagement>,
    pub system_program: Program<'info, System>,
}

pub fn visit_neighbor(ctx: Context<NeighborVisit>) -> Result<()> {
    let neighbor = ctx.accounts.neighbor_engagement.user;
    require_keys_neq!(neighbor, ctx.accounts.user.key(), QuestError::InvalidInput);
    require_keys_neq!(neighbor, Pubkey::default(), QuestError::InvalidData);
    let today = day_index(Clock::get()?.unix_timestamp);
    let row = &mut ctx.accounts.engagement;
    if row.user == Pubkey::default() {
        row.user = ctx.accounts.user.key();
        row.bump = ctx.bumps.engagement;
    }
    if row.neighbor_day != today {
        row.neighbor_day = today;
        row.neighbor_visits = 0;
    }
    require!(row.neighbor_visits < NEIGHBOR_VISITS_PER_DAY, QuestError::AlreadyClaimed);
    row.neighbor_visits = row.neighbor_visits.saturating_add(1);
    emit!(NeighborVisited { user: ctx.accounts.user.key(), neighbor, day: today });
    Ok(())
}

pub fn guild_deposit(ctx: Context<EngagementAccounts>, amount: u64) -> Result<()> {
    require!(amount > 0, QuestError::InvalidInput);
    let mut ctx = ctx;
    touch(&mut ctx);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_mascot.to_account_info(),
                to: ctx.accounts.treasury_mascot.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    let total = {
        let row = &mut ctx.accounts.engagement;
        row.guild_deposited = row.guild_deposited.checked_add(amount).ok_or(QuestError::MathOverflow)?;
        row.guild_deposited
    };
    emit!(GuildDeposited { user: ctx.accounts.user.key(), amount, total });
    Ok(())
}

#[derive(Accounts)]
#[instruction(quest_id: u32)]
pub struct ProveQuestProgress<'info> {
    #[account(seeds = [b"quest_config"], bump = quest_config.bump, constraint = !quest_config.paused @ QuestError::Paused)]
    pub quest_config: Account<'info, QuestConfig>,
    #[account(
        init_if_needed, payer = user, space = QuestProgress::SIZE,
        seeds = [b"quest_progress", user.key().as_ref(), quest_id.to_le_bytes().as_ref()], bump
    )]
    pub quest_progress: Account<'info, QuestProgress>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: same proof accounts as achievements. Quest id selects the check.
    pub proof: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn prove_quest(ctx: Context<ProveQuestProgress>, quest_id: u32) -> Result<()> {
    crate::instructions::quests::achievement_unlock::require_progress(
        &ctx.accounts.user.key(),
        quest_id,
        &ctx.accounts.proof.to_account_info(),
    )?;
    let progress = &mut ctx.accounts.quest_progress;
    if progress.user == Pubkey::default() {
        progress.user = ctx.accounts.user.key();
        progress.quest_id = quest_id;
        progress.bump = ctx.bumps.quest_progress;
        progress.claimed = false;
    }
    require!(!progress.claimed, QuestError::AlreadyClaimed);
    progress.completed = true;
    emit!(QuestProgressProven { user: ctx.accounts.user.key(), quest_id });
    Ok(())
}
