use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::CollectPower;
use crate::ResourceKind;

/// [БЛОК L] Сбор Power из GridState.
/// Power accrues over time using the network-load schedule for each elapsed day.
/// minted Power = elapsed_seconds * rate(day) / 3600
pub fn handler(ctx: Context<CollectPower>) -> Result<()> {
    // [AUDIT F-11] The grid station was an unrestricted Power faucet for any wallet: create an
    // account, wait a day, collect 120-480 POWER, repeat across 1 000 sybils.
    // It is now gated on an existing Player with villagers — a Player PDA can
    // only be created by the authority's resource mint, or by starting a mining
    // session with a real tool NFT — and on the global POWER ceiling (F-03).
    require!(ctx.accounts.player.villagers > 0, AofError::NoIdleVillagers);

    let grid = &mut ctx.accounts.grid_state;
    
    // Init if needed
    let was_initialized = grid.owner != Pubkey::default();
    if !was_initialized {
        grid.owner = ctx.accounts.user.key();
        grid.power_buffer = 0;
        grid.last_collected_at = Clock::get()?.unix_timestamp;
        grid.bump = ctx.bumps.grid_state;
        // The first call creates the GridState account and starts accrual. Requiring a
        // positive elapsed amount here would make init_if_needed impossible:
        // the transaction would always revert and the PDA would never exist.
        return Ok(());
    }

    require!(grid.owner == ctx.accounts.user.key(), AofError::Unauthorized);

    let now = Clock::get()?.unix_timestamp;
    // [SECURITY_CHECKLIST_REVIEW F-D] Each second of the (<= 24 h) window is
    // priced at the weather of its own day, recomputed from the day id. The
    // cached `weather_state` no longer decides the rate, so collecting only on
    // frenzy days or leaving a stale frenzy uncranked gains nothing.
    let power_amount: u64 = grid_accrual(grid.last_collected_at, now)?;

    require!(power_amount > 0, AofError::GridEmpty);

    // [AUDIT F-03] Power emission bypassed IssuanceCap entirely; the audit's
    // sybil model produced 78.8 M POWER/year with no bound at all.
    check_supply_cap(
        &ctx.accounts.material_mints,
        &mut ctx.accounts.issuance_cap,
        ResourceKind::Power,
        power_amount,
    )?;

    // Mint Power
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.power_mint.to_account_info(),
                to: ctx.accounts.user_power.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        power_amount,
    )?;

    grid.last_collected_at = now;

    Ok(())
}
