use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use crate::constants::*;
use crate::errors::*;
use crate::events::MiningCollected;
use crate::state::{MaterialMints, Rarity};
use crate::CollectMining;

/// Mining is settled in the same instruction that closes the session.  The
/// previous flow reset ToolData first and asked a backend worker to calculate
/// and pay the reward in a second transaction; a failed or stale worker could
/// therefore leave the player with no payout. Keep the reward formula
/// deterministic (10 display units per hour, represented in 9-decimal
/// atomic units) and derive the destination mint from the canonical registry.
fn resource_mint_for_tool(
    config: &crate::state::Config,
    materials: &MaterialMints,
    tool_type: &str,
) -> Option<Pubkey> {
    if tool_type.eq_ignore_ascii_case("axe") {
        Some(config.wood_mint)
    } else if tool_type.eq_ignore_ascii_case("pick") {
        Some(config.stone_mint)
    } else if tool_type.eq_ignore_ascii_case("bow") {
        Some(materials.meat)
    } else if tool_type.eq_ignore_ascii_case("reaper") {
        Some(materials.seeds)
    } else {
        None
    }
}

fn yield_bps(rarity: Rarity) -> u64 {
    match rarity {
        Rarity::Common => 10_000,
        Rarity::Uncommon => 11_500,
        Rarity::Rare => 13_000,
        Rarity::Epic => 15_000,
        Rarity::Legendary => 18_000,
    }
}

pub fn handler(ctx: Context<CollectMining>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.tool.mining_end, AofError::MiningNotComplete);

    let hours = ctx.accounts.tool.last_mined_hours;
    require!(hours > 0, AofError::InvalidAmount);
    let expected_mint = resource_mint_for_tool(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.tool.tool_type,
    )
    .ok_or(AofError::InvalidResourceKind)?;
    require!(
        ctx.accounts.payout_mint.key() == expected_mint,
        AofError::InvalidResourceKind
    );
    require!(
        ctx.accounts.payout_mint.mint_authority
            == anchor_lang::solana_program::program_option::COption::Some(ctx.accounts.auth.key()),
        AofError::Unauthorized
    );

    let amount = (hours as u64)
        .checked_mul(10)
        .and_then(|base| base.checked_mul(RESOURCE_UNIT))
        .ok_or(AofError::MathOverflow)?
        .checked_mul(yield_bps(ctx.accounts.tool.rarity))
        .ok_or(AofError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(AofError::MathOverflow)?;
    require!(amount > 0, AofError::ZeroAmount);

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.payout_mint.to_account_info(),
                to: ctx.accounts.payout_token.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let durability = ctx
        .accounts
        .tool
        .durability
        .checked_sub(hours)
        .ok_or(AofError::InsufficientDurability)?;
    ctx.accounts.tool.durability = durability;
    ctx.accounts.tool.is_mining = false;
    ctx.accounts.tool.mining_end = 0;
    ctx.accounts.tool.last_mined_hours = 0;

    ctx.accounts.player.villagers_available = ctx
        .accounts
        .player
        .villagers_available
        .saturating_add(1)
        .min(ctx.accounts.player.villagers);

    emit!(MiningCollected {
        user: ctx.accounts.user.key(),
        tool_mint: ctx.accounts.mint.key(),
        resource_mint: expected_mint,
        hours,
        amount,
        durability_after: durability,
    });
    Ok(())
}
