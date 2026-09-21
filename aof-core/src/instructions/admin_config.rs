use anchor_lang::prelude::*;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::{ResourceKind, SetMiningEnabled, SetSupplyCap};

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
/// once, collect_mining, collect_flour, collect_bread, collect_well_water,
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
