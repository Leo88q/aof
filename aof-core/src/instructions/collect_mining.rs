use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use crate::constants::*;
use crate::errors::*;
use crate::events::MiningCollected;
use crate::CollectMining;

// Mining is settled in the same instruction that closes the session. The
// previous flow reset ToolData first and asked a backend worker to calculate
// and pay the reward in a second transaction; a failed or stale worker could
// therefore leave the player with no payout. The reward formula stays
// deterministic (BASE_RATE_MINING display units per hour, scaled by
// `Rarity::yield_bps`) and the destination mint comes from the canonical
// registry in `state::mint_for_kind`.
//
// Canonical tool -> resource mapping. [AUDIT F-17]: the previous mapping
// silently dropped "spear" (one of the three types `PACK_TOOL_TYPES` can
// produce), leaving those tools with no yield at all.
fn resource_kind_for_tool(tool_type: &str) -> Option<ResourceKind> {
    if tool_type.eq_ignore_ascii_case("axe") {
        Some(ResourceKind::Wood)
    } else if tool_type.eq_ignore_ascii_case("pick") {
        Some(ResourceKind::Stone)
    } else if tool_type.eq_ignore_ascii_case("bow") {
        Some(ResourceKind::Meat)
    } else if tool_type.eq_ignore_ascii_case("spear") {
        // Spear is a hunting tool: same resource as the bow.
        Some(ResourceKind::Meat)
    } else if tool_type.eq_ignore_ascii_case("reaper") {
        Some(ResourceKind::Seeds)
    } else {
        None
    }
}

pub fn handler(ctx: Context<CollectMining>) -> Result<()> {
    // [AUDIT F-27] The kill-switch now lives on-chain. Before this, mining was
    // only gated by a backend env var, so a direct RPC call bypassed it.
    require!(ctx.accounts.config.mining_enabled, AofError::MiningDisabled);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.tool.mining_end, AofError::MiningNotComplete);

    let hours = ctx.accounts.tool.last_mined_hours;
    require!(hours > 0, AofError::InvalidAmount);
    let kind = resource_kind_for_tool(&ctx.accounts.tool.tool_type)
        .ok_or(AofError::InvalidResourceKind)?;
    let expected_mint = crate::state::mint_for_kind(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &kind,
    );
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
        .checked_mul(BASE_RATE_MINING)
        .and_then(|base| base.checked_mul(RESOURCE_UNIT))
        .ok_or(AofError::MathOverflow)?
        .checked_mul(ctx.accounts.tool.rarity.yield_bps())
        .ok_or(AofError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(AofError::MathOverflow)?;
    require!(amount > 0, AofError::ZeroAmount);

    // [AUDIT F-03] Mining is the single largest emission path in the game and
    // it never touched IssuanceCap. The global supply ceiling closes that.
    check_supply_cap(
        &ctx.accounts.material_mints,
        kind,
        ctx.accounts.payout_mint.supply,
        amount,
    )?;

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
