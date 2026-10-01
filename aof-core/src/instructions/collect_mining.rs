use anchor_lang::prelude::*;
use anchor_spl::token::{self, MintTo};
use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::events::MiningCollected;
use crate::CollectMining;
use crate::ResourceKind;
use crate::instructions::tool_ownership::assert_token_in_escrow;

// Mining is settled in the same instruction that closes the session. The
// previous flow reset ToolData first and asked a backend worker to calculate
// and pay the reward in a second transaction; a failed or stale worker could
// therefore leave the player with no payout. The reward formula stays
// deterministic (BASE_RATE_MINING display units per hour, scaled by
// `Rarity::yield_bps`) and the destination mint comes from the canonical
// registry in `state::mint_for_kind`.
//
// Canonical tool -> resource mapping for all five current types.
// `pub(crate)`: та же функция используется делегированным сбором арендатора,
// чтобы формулы и маршрутизация ресурсов не разошлись между путями.
pub(crate) fn resource_kind_for_tool(tool_type: &str) -> Option<ResourceKind> {
    // Accept only the current five ToolData ids.
    let canonical = crate::state::canonical_tool_type(tool_type)?;
    match canonical {
        "plasma_cutter" => Some(ResourceKind::Circuit),
        "silicon_extractor" => Some(ResourceKind::Silicon),
        // Both data-processing tools yield Dataset.
        "data_harvester" | "quantum_transmitter" => Some(ResourceKind::Dataset),
        "neural_seeder" => Some(ResourceKind::Neuron),
        _ => None,
    }
}

// Use the same checked calculation in settlement and host regression tests.
pub(crate) fn mining_reward_amount(hours: u8, rarity: Rarity) -> Result<u64> {
    (hours as u64)
        .checked_mul(BASE_RATE_MINING)
        .and_then(|base| base.checked_mul(RESOURCE_UNIT))
        .and_then(|base| base.checked_mul(rarity.yield_bps()))
        .and_then(|base| base.checked_div(10_000))
        .ok_or_else(|| AofError::MathOverflow.into())
}

pub fn handler(ctx: Context<CollectMining>) -> Result<()> {
    // [AUDIT F-27] The kill-switch now lives on-chain. Before this, mining was
    // only gated by a backend env var, so a direct RPC call bypassed it.
    require!(ctx.accounts.config.mining_enabled, AofError::MiningDisabled);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= ctx.accounts.tool.mining_end, AofError::MiningNotComplete);

    // Token-primary ownership: награда выплачивается только пока supply-1 токен
    // инструмента действительно лежит в эскроу программы. Флаг `tool.staked` из
    // контекста — не доказательство: он лишь кэш, который мог разойтись с
    // фактическим держателем токена. См. `instructions::tool_ownership`.
    assert_token_in_escrow(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.vault_token,
        &ctx.accounts.vault.key(),
    )?;

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

    let amount = mining_reward_amount(hours, ctx.accounts.tool.rarity)?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_current_tool_routes_to_its_canonical_resource() {
        for (tool, expected) in [
            ("plasma_cutter", ResourceKind::Circuit),
            ("silicon_extractor", ResourceKind::Silicon),
            ("data_harvester", ResourceKind::Dataset),
            ("quantum_transmitter", ResourceKind::Dataset),
            ("neural_seeder", ResourceKind::Neuron),
        ] {
            assert_eq!(resource_kind_for_tool(tool), Some(expected));
            assert_eq!(resource_kind_for_tool(&tool.to_uppercase()), Some(expected));
        }
        for old in ["axe", "pick", "spear", "bow", "reaper", "", "unknown"] {
            assert_eq!(resource_kind_for_tool(old), None);
        }
    }

    #[test]
    fn reward_is_scaled_to_atomic_units_and_checked() {
        for (rarity, bps) in [
            (Rarity::Common, 10_000),
            (Rarity::Uncommon, 11_500),
            (Rarity::Rare, 13_000),
            (Rarity::Epic, 15_000),
            (Rarity::Legendary, 18_000),
        ] {
            assert_eq!(mining_reward_amount(2, rarity).unwrap(), 20 * RESOURCE_UNIT * bps / 10_000);
        }
        // Zero duration is rejected by start_mining/collect_mining, never minted.
        assert_eq!(mining_reward_amount(0, Rarity::Common).unwrap(), 0);
    }
}
