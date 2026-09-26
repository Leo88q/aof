use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn};
use crate::constants::*;
use crate::state::charge_vault_withdrawal;
use crate::{ReferralBindCtx, ReferralUpgradeCtx, PayOutWithReferral};
use crate::errors::*;
use crate::events::*;

pub fn bind_handler(ctx: Context<ReferralBindCtx>) -> Result<()> {
    let stats = &mut ctx.accounts.referrer_stats;
    if stats.referrer == Pubkey::default() {
        stats.referrer = ctx.accounts.referrer.key();
        stats.active_count = 0;
    }

    let cap = REFERRAL_BASE_CAP
        + if ctx.accounts.referrer_player.has_medallion() { REFERRAL_MEDALLION_BONUS_CAP } else { 0 }
        + if ctx.accounts.referrer_player.has_historian() { REFERRAL_HISTORIAN_BONUS_CAP } else { 0 };
    require!(stats.active_count < cap, AofError::ReferralCapReached);
    stats.active_count = stats
        .active_count
        .checked_add(1)
        .ok_or(AofError::MathOverflow)?;

    let link = &mut ctx.accounts.referral_link;
    link.referred = ctx.accounts.referred.key();
    link.referrer = ctx.accounts.referrer.key();
    link.tier = 0;
    link.bound_at = Clock::get()?.unix_timestamp;

    emit!(ReferralBound {
        referrer: ctx.accounts.referrer.key(),
        referred: ctx.accounts.referred.key(),
    });
    Ok(())
}

pub fn upgrade_handler(ctx: Context<ReferralUpgradeCtx>) -> Result<()> {
    let link = &mut ctx.accounts.referral_link;
    require!((link.tier as usize) < REFERRAL_PCT_BPS.len() - 1, AofError::ReferralMaxTier);
    let next = (link.tier + 1) as usize;

    for (mint, from, cost) in [
        (&ctx.accounts.wood_mint, &ctx.accounts.user_wood, REFERRAL_UPGRADE_WOOD[next]),
        (&ctx.accounts.stone_mint, &ctx.accounts.user_stone, REFERRAL_UPGRADE_STONE[next]),
        (&ctx.accounts.food_mint, &ctx.accounts.user_food, REFERRAL_UPGRADE_FOOD[next]),
    ] {
        if cost == 0 { continue; }
        require!(from.amount >= cost, AofError::InsufficientBalance);
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: mint.to_account_info(),
                    from: from.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    link.tier = link.tier.checked_add(1).ok_or(AofError::MathOverflow)?;
    Ok(())
}

/// [ФИКС относительно Ronin-оригинала, см. TOR v4 §2.9]: в реальном
/// index.js реферальный бонус — чистая доп. эмиссия сверх дохода
/// реферала (`bonus[...] += finUser * refPercent`), инфляционный баг.
/// Здесь bonus НЕ добавляется поверх — это split ОДНОЙ и той же суммы
/// `amount`, которую authority уже решила выплатить (см. pay_out):
/// реферер получает `amount * pct`, реферал — остаток. Общая сумма,
/// уходящая из vault, не меняется в зависимости от наличия реферала —
/// не инфляционно по построению.
pub fn pay_out_with_referral_handler(ctx: Context<PayOutWithReferral>, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    require!(
        (ctx.accounts.referral_link.tier as usize) < REFERRAL_PCT_BPS.len(),
        AofError::ReferralMaxTier
    );
    require!(
        ctx.accounts.vault_token.amount >= amount,
        AofError::VaultInsufficient
    );

    // [SECURITY_CHECKLIST_REVIEW F-E] `PayOutWithReferral` promised "the same
    // three brakes as PayOut" and loads `material_mints` + the per-mint
    // `vault_guard`, but this handler never consulted them: a leaked authority
    // key could move ANY mint the vault holds (resources past every cap, and
    // even staked tool NFTs once a guard PDA exists for them). The brakes now
    // run here, before any CPI, through the very function `pay_out` uses.
    let slot = Clock::get()?.slot;
    let mint_key = ctx.accounts.mint.key();
    charge_vault_withdrawal(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &mut ctx.accounts.vault_guard,
        &mint_key,
        amount,
        slot,
    )?;

    let pct_bps = REFERRAL_PCT_BPS[ctx.accounts.referral_link.tier as usize] as u64;
    let referrer_cut = amount.checked_mul(pct_bps).ok_or(AofError::MathOverflow)? / 10_000;
    let user_cut = amount.checked_sub(referrer_cut).ok_or(AofError::MathOverflow)?;

    let vault_bump = ctx.bumps.vault;
    let seeds: &[&[u8]] = &[VAULT_SEED, &[vault_bump]];
    let signer = &[seeds];

    if user_cut > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            user_cut,
        )?;
    }
    if referrer_cut > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: ctx.accounts.vault_token.to_account_info(),
                    to: ctx.accounts.referrer_token.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            referrer_cut,
        )?;
    }

    emit!(ReferralPayout {
        referrer: ctx.accounts.referral_link.referrer,
        referred: ctx.accounts.referral_link.referred,
        amount: referrer_cut,
    });
    // Vault monitors key on VaultWithdrawal; a referral payout used to leave the
    // vault without it, i.e. invisible to the same alerting as `pay_out`.
    emit!(VaultWithdrawal {
        mint: mint_key,
        recipient: ctx.accounts.referral_link.referred,
        amount,
        withdrawn_in_epoch: ctx.accounts.vault_guard.withdrawn_in_epoch,
        cap_per_epoch: ctx.accounts.vault_guard.cap_per_epoch,
        slot,
    });
    Ok(())
}
