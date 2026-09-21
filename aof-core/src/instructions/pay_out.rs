use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use crate::constants::*;
use crate::state::*;
use crate::{InitVaultGuard, PayOut, SetVaultGuard};
use crate::errors::*;
use crate::events::*;

/// [AUDIT F-01] Bounded authority withdrawal from the staking vault.
///
/// What this instruction is allowed to do now:
///  * move **resource** tokens only (`Config::is_resource_mint`, checked here
///    against `MaterialMints` + the legacy mints in `Config`);
///  * pay them to an existing `Player` owner (the `player` account is a PDA
///    derived from `user_token.owner`, so a throwaway recipient wallet cannot
///    be used);
///  * move at most `VaultGuard::max_per_tx` per call and
///    `VaultGuard::cap_per_epoch` per epoch, both configured by the authority
///    through `init_vault_guard` / `set_vault_guard`.
///
/// Staked tool NFTs are structurally excluded: their mints are never in the
/// resource registry, so `pay_out` can no longer be used to steal them, and
/// `ToolData.staked` can no longer be left lying about the real owner.
pub fn handler(ctx: Context<PayOut>, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    require!(
        ctx.accounts.vault_token.amount >= amount,
        AofError::VaultInsufficient
    );

    // (1) resource mint only
    require!(
        ctx.accounts
            .config
            .is_resource_mint(&ctx.accounts.material_mints, &ctx.accounts.mint.key()),
        AofError::NotAResourceMint
    );

    // (2) charge the per-mint withdrawal budget BEFORE any CPI
    let slot = Clock::get()?.slot;
    let guard = &mut ctx.accounts.vault_guard;
    require!(guard.mint == ctx.accounts.mint.key(), AofError::InvalidMint);
    guard.charge(amount, slot)?;

    let vault_seeds = &[VAULT_SEED, &[ctx.bumps.vault]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[vault_seeds],
        ),
        amount,
    )?;

    emit!(PaidOut {
        user: ctx.accounts.user_token.owner,
        amount,
        vault_balance_after: ctx
            .accounts
            .vault_token
            .amount
            .checked_sub(amount)
            .ok_or(AofError::MathOverflow)?,
    });

    emit!(VaultWithdrawal {
        mint: ctx.accounts.mint.key(),
        recipient: ctx.accounts.user_token.owner,
        amount,
        withdrawn_in_epoch: guard.withdrawn_in_epoch,
        cap_per_epoch: guard.cap_per_epoch,
        slot,
    });
    Ok(())
}

/// [AUDIT F-01] Create the per-mint withdrawal budget. `cap_per_epoch = 0`
/// halts withdrawals of that mint entirely (emergency brake that does not
/// require pausing the whole program).
pub fn init_vault_guard_handler(
    ctx: Context<InitVaultGuard>,
    epoch_slots: u64,
    cap_per_epoch: u64,
    max_per_tx: u64,
) -> Result<()> {
    require!(
        epoch_slots >= ISSUANCE_EPOCH_MIN_SLOTS && epoch_slots <= ISSUANCE_EPOCH_MAX_SLOTS,
        AofError::InvalidVaultGuardParams
    );
    require!(cap_per_epoch > 0, AofError::InvalidVaultGuardParams);
    let slot = Clock::get()?.slot;
    let g = &mut ctx.accounts.vault_guard;
    g.mint = ctx.accounts.mint.key();
    g.epoch_slots = epoch_slots;
    g.cap_per_epoch = cap_per_epoch;
    g.max_per_tx = max_per_tx;
    g.epoch_start_slot = slot;
    g.withdrawn_in_epoch = 0;
    g.lifetime_withdrawn = 0;
    g.bump = ctx.bumps.vault_guard;
    emit!(VaultGuardChanged {
        mint: g.mint,
        epoch_slots,
        cap_per_epoch,
        max_per_tx,
        slot,
    });
    Ok(())
}

/// [AUDIT F-01] Adjust the budget. `withdrawn_in_epoch` is preserved (lowering
/// the cap below what was already withdrawn blocks further withdrawals until
/// the epoch rolls) and `cap_per_epoch = 0` halts the mint.
pub fn set_vault_guard_handler(
    ctx: Context<SetVaultGuard>,
    epoch_slots: u64,
    cap_per_epoch: u64,
    max_per_tx: u64,
) -> Result<()> {
    require!(
        epoch_slots >= ISSUANCE_EPOCH_MIN_SLOTS && epoch_slots <= ISSUANCE_EPOCH_MAX_SLOTS,
        AofError::InvalidVaultGuardParams
    );
    let slot = Clock::get()?.slot;
    let g = &mut ctx.accounts.vault_guard;
    g.roll_epoch(slot);
    g.epoch_slots = epoch_slots;
    g.cap_per_epoch = cap_per_epoch;
    g.max_per_tx = max_per_tx;
    emit!(VaultGuardChanged {
        mint: g.mint,
        epoch_slots,
        cap_per_epoch,
        max_per_tx,
        slot,
    });
    Ok(())
}
