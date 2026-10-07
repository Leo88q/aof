use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::{ResourceKind, SetIssuanceLifetimeBaseline, SetMiningEnabled, SetSupplyCap};

/// [AUDIT F-27] Flip the on-chain mining kill-switch. Before this the switch
/// was `MINING_ENABLED = !isProduction && env === 'true'` in the backend, which
/// a direct RPC caller ignored completely.
pub fn set_mining_enabled(ctx: Context<SetMiningEnabled>, enabled: bool) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.mining_enabled = enabled;
    emit!(MiningToggled {
        enabled,
        at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

/// [AUDIT F-03] Set the lifetime supply ceiling of one resource kind.
///
/// `SUPPLY_CAP_UNLIMITED` (u64::MAX) disables the ceiling for that kind; any
/// other value is enforced on **every** mint path (mint_resource, mint_resource
/// once, collect_mining, collect_signal, collect_model, collect_power,
/// craft_recipe, claim_season_reward), not just the two that go through
/// `IssuanceCap`. Lowering it below the current supply halts that resource.
pub fn set_supply_cap(ctx: Context<SetSupplyCap>, kind: ResourceKind, max_supply: u64) -> Result<()> {
    let mm = &mut ctx.accounts.material_mints;
    mm.max_supply[kind as usize] = max_supply;
    emit!(SupplyCapChanged {
        kind: kind as u8,
        max_supply,
        at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

/// Establish a historically complete gross-mint baseline after scanning every
/// SPL MintTo for the canonical mint. This is monotonic: the authority may
/// conservatively raise a baseline later, but cannot reset issuance allowance.
pub fn set_issuance_lifetime_baseline(
    ctx: Context<SetIssuanceLifetimeBaseline>,
    kind: ResourceKind,
    total_minted: u128,
) -> Result<()> {
    let issuance_cap = &mut ctx.accounts.issuance_cap;
    require!(issuance_cap.kind == kind as u8, AofError::InvalidResourceKind);
    let previous = issuance_cap.lifetime_minted;
    require!(total_minted >= previous, AofError::InvalidIssuanceCapParams);
    require!(total_minted >= ctx.accounts.mint.supply as u128, AofError::InvalidIssuanceCapParams);
    // A historical baseline may exceed a stale finite cap configured under
    // the old outstanding-supply semantics. Recording that fact is safe: every
    // subsequent mint remains blocked until the authority sets a cap above it.
    // Baseline first, then choose/apply the finite lifetime cap.
    issuance_cap.raise_lifetime_baseline(total_minted)?;
    emit!(IssuanceLifetimeBaselineSet {
        kind: kind as u8,
        mint: ctx.accounts.mint.key(),
        previous,
        baseline: total_minted,
        slot: Clock::get()?.slot,
    });
    Ok(())
}
