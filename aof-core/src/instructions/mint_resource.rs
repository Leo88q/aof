use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_spl::token::{self, Token, Mint, TokenAccount, MintTo};
use anchor_lang::solana_program::program_option::COption;
use crate::constants::*;
use crate::MintResource;
use crate::state::*;
use crate::errors::*;
use crate::ResourceKind;
use crate::events::ResourceIssued;

/// Deterministic fee policy, NOT a random/unpredictable draw. Timing retries
/// cannot change it, but choosing another wallet or amount can. Economic caps
/// must not assume this hash prevents Sybil/amount selection. Receipts bind one
/// reward ID; they do not prevent a privileged mint authority issuing new IDs.
fn pick_fee_bps(user: &Pubkey, amount: u64, has_medallion: bool, has_historian: bool) -> u16 {
    let (min_bps, max_bps) = match (has_medallion, has_historian) {
        (true, true) => (MINT_FEE_BOTH_MIN_BPS, MINT_FEE_BOTH_MAX_BPS),
        (false, true) => (MINT_FEE_HISTORIAN_MIN_BPS, MINT_FEE_HISTORIAN_MAX_BPS),
        (true, false) => (MINT_FEE_MEDALLION_MIN_BPS, MINT_FEE_MEDALLION_MAX_BPS),
        (false, false) => (MINT_FEE_BASE_MIN_BPS, MINT_FEE_BASE_MAX_BPS),
    };
    // Do not include the current slot: a caller could retry the same logical
    // payout until a cheaper fee appeared in a later slot.
    let h = hashv(&[user.as_ref(), &amount.to_le_bytes()]);
    let span = (max_bps - min_bps) as u64;
    let offset = if span > 0 {
        u64::from_le_bytes(h.to_bytes()[0..8].try_into().unwrap()) % (span + 1)
    } else {
        0
    };
    min_bps + offset as u16
}

pub fn handler(ctx: Context<MintResource>, kind: ResourceKind, amount: u64) -> Result<()> {
    execute_mint(&ctx.accounts.config, &ctx.accounts.material_mints,
        &mut ctx.accounts.player, &mut ctx.accounts.issuance_cap,
        &ctx.accounts.mint, &ctx.accounts.token_account,
        &ctx.accounts.treasury_token, &ctx.accounts.auth, &ctx.accounts.token_program,
        ctx.bumps.auth, kind, amount)
}

// One canonical economic path for both legacy admin mints and replay-protected rewards.
pub fn execute_mint<'info>(
    config: &Config, material_mints: &MaterialMints, player: &mut Player,
    issuance_cap: &mut IssuanceCap,
    mint: &Account<'info, Mint>, token_account: &Account<'info, TokenAccount>,
    treasury_token: &Account<'info, TokenAccount>, auth: &UncheckedAccount<'info>,
    token_program: &Program<'info, Token>, auth_bump: u8,
    kind: ResourceKind, amount: u64,
) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    let expected = mint_for_kind(config, material_mints, &kind);
    require!(mint.key() == expected, AofError::InvalidResourceKind);
    // [AUDIT F-03] Global supply ceiling, on top of the per-epoch budget. This
    // is the only bound that also applies to the paths that never touch
    // IssuanceCap (collect_*, craft_recipe, claim_season_reward).
    check_supply_cap(material_mints, kind, mint.supply, amount)?;
    require!(
        mint.mint_authority == COption::Some(auth.key()),
        AofError::Unauthorized
    );

    // Charge the per-kind budget BEFORE any CPI: a rejected mint must not
    // move the counter, and the counter must be charged for the gross amount
    // (the treasury fee is issuance too). Errors abort the whole instruction,
    // so the epoch roll performed inside charge() is also discarded on failure.
    let slot = Clock::get()?.slot;
    issuance_cap.charge(kind as u8, amount, slot)?;

    if player.owner == Pubkey::default() {
        player.owner = token_account.owner;
        player.villagers = DEFAULT_VILLAGERS;
        player.villagers_available = DEFAULT_VILLAGERS;
    }

    let bps = pick_fee_bps(
        &token_account.owner,
        amount,
        player.has_medallion(),
        player.has_historian(),
    );
    let fee_cut = ((amount as u128) * (bps as u128) / 10_000) as u64;
    let user_cut = amount.checked_sub(fee_cut).ok_or(AofError::MathOverflow)?;

    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    if user_cut > 0 {
        token::mint_to(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                MintTo {
                    mint: mint.to_account_info(),
                    to: token_account.to_account_info(),
                    authority: auth.to_account_info(),
                },
                signer_seeds,
            ),
            user_cut,
        )?;
    }
    if fee_cut > 0 {
        token::mint_to(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                MintTo {
                    mint: mint.to_account_info(),
                    to: treasury_token.to_account_info(),
                    authority: auth.to_account_info(),
                },
                signer_seeds,
            ),
            fee_cut,
        )?;
    }
    emit!(ResourceIssued {
        kind: kind as u8,
        mint: mint.key(),
        recipient: token_account.owner,
        gross: amount,
        fee: fee_cut,
        minted_in_epoch: issuance_cap.minted_in_epoch,
        cap_per_epoch: issuance_cap.cap_per_epoch,
        epoch_start_slot: issuance_cap.epoch_start_slot,
        slot,
    });
    Ok(())
}
