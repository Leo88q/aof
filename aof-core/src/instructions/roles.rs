//! [SECURITY_CHECKLIST_REVIEW F-C] Role separation and emergency switches.
//!
//! * `authority` (admin) — configuration, limits, role and authority rotation.
//!   Meant to be a Squads multisig with a time lock.
//! * `operator` — the hot backend key: routine, budget-bounded operations only.
//! * `guardian` — may only switch the pause / cash-out freeze ON.
//!
//! The cash-out freeze answers "fraudsters with an inflated in-game balance
//! must not be able to withdraw it, but the game must keep running": it stops
//! only the paths where value leaves the game economy (trades paying SOL out,
//! vault payouts), while gameplay and the players' own exit paths (withdrawing
//! their gas deposit, unstaking, cancelling their own orders) stay available.
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::state::Config;
use crate::{EmergencyStop, MigrateConfigV2, SetCashoutFrozen, SetRoles};

/// Byte-exact layout of the v1 `Config` (before the role fields were appended).
#[derive(AnchorDeserialize)]
struct ConfigV1 {
    authority: Pubkey,
    treasury: Pubkey,
    food_mint: Pubkey,
    wood_mint: Pubkey,
    stone_mint: Pubkey,
    seeds_mint: Pubkey,
    water_mint: Pubkey,
    potato_mint: Pubkey,
    craft_fee: u64,
    unstake_fee: u64,
    paused: bool,
    bump: u8,
    mining_enabled: bool,
    pending_authority: Pubkey,
    authority_updated_at: i64,
}

/// Grow the v1 Config in place to the v2 layout. Until this runs after the
/// upgrade, every instruction that loads `Config` fails to deserialize it, so
/// it must be the first transaction after deploying this version. Both roles
/// start as the current authority, i.e. nothing changes until `set_roles`.
pub fn migrate_config_v2_handler(ctx: Context<MigrateConfigV2>) -> Result<()> {
    let info = ctx.accounts.config.to_account_info();
    require_keys_eq!(*info.owner, crate::ID, AofError::Unauthorized);
    require!(info.data_len() == CONFIG_V1_SPACE, AofError::AlreadyInitialized);
    let v1 = {
        let data = info.try_borrow_data()?;
        require!(
            data[..8] == <Config as anchor_lang::Discriminator>::DISCRIMINATOR,
            AofError::Unauthorized
        );
        ConfigV1::deserialize(&mut &data[8..])
            .map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize)?
    };
    require_keys_eq!(v1.authority, ctx.accounts.authority.key(), AofError::Unauthorized);

    let needed = Rent::get()?.minimum_balance(CONFIG_SPACE).saturating_sub(info.lamports());
    if needed > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: info.clone(),
                },
            ),
            needed,
        )?;
    }
    info.realloc(CONFIG_SPACE, true)?;

    let v2 = Config {
        authority: v1.authority,
        treasury: v1.treasury,
        food_mint: v1.food_mint,
        wood_mint: v1.wood_mint,
        stone_mint: v1.stone_mint,
        seeds_mint: v1.seeds_mint,
        water_mint: v1.water_mint,
        potato_mint: v1.potato_mint,
        craft_fee: v1.craft_fee,
        unstake_fee: v1.unstake_fee,
        paused: v1.paused,
        bump: v1.bump,
        mining_enabled: v1.mining_enabled,
        pending_authority: v1.pending_authority,
        authority_updated_at: v1.authority_updated_at,
        operator: v1.authority,
        guardian: v1.authority,
        cashout_frozen: false,
        reserved: [0u8; 32],
    };
    {
        let mut data = info.try_borrow_mut_data()?;
        let mut writer: &mut [u8] = &mut data[..];
        v2.try_serialize(&mut writer)?;
    }
    emit!(ConfigMigrated {
        authority: v2.authority,
        operator: v2.operator,
        guardian: v2.guardian,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

/// Admin: assign the operator (backend) and guardian (emergency) keys.
pub fn set_roles_handler(ctx: Context<SetRoles>, operator: Pubkey, guardian: Pubkey) -> Result<()> {
    require!(
        operator != Pubkey::default() && guardian != Pubkey::default(),
        AofError::InvalidRole
    );
    let cfg = &mut ctx.accounts.config;
    cfg.operator = operator;
    cfg.guardian = guardian;
    emit!(RolesChanged {
        authority: ctx.accounts.authority.key(),
        operator,
        guardian,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

/// Guardian or admin: switch the pause and/or the cash-out freeze ON. It can
/// never switch anything off, so a leaked guardian key cannot undo a stop.
pub fn emergency_stop_handler(ctx: Context<EmergencyStop>, pause_game: bool, freeze_cashout: bool) -> Result<()> {
    require!(pause_game || freeze_cashout, AofError::InvalidAmount);
    let caller = ctx.accounts.caller.key();
    let cfg = &mut ctx.accounts.config;
    if pause_game {
        cfg.paused = true;
    }
    if freeze_cashout {
        cfg.cashout_frozen = true;
    }
    emit!(EmergencyStopActivated {
        caller,
        paused: cfg.paused,
        cashout_frozen: cfg.cashout_frozen,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

/// Admin: set or clear the cash-out freeze.
pub fn set_cashout_frozen_handler(ctx: Context<SetCashoutFrozen>, frozen: bool) -> Result<()> {
    ctx.accounts.config.cashout_frozen = frozen;
    emit!(CashoutFreezeChanged {
        authority: ctx.accounts.authority.key(),
        frozen,
        slot: Clock::get()?.slot,
    });
    Ok(())
}
