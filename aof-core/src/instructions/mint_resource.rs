use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use anchor_spl::token::{self, Token, MintTo};
use anchor_lang::solana_program::program_option::COption;
use crate::constants::*;
use crate::MintResource;
use crate::state::*;
use crate::errors::*;
use crate::ResourceKind;

fn mint_for_kind(config: &Config, material_mints: &MaterialMints, kind: &ResourceKind) -> Pubkey {
    match kind {
        // Старые ресурсы из Config
        ResourceKind::Food => config.food_mint,
        ResourceKind::Wood => config.wood_mint,
        ResourceKind::Stone => config.stone_mint,
        // [БЛОК L] Новые ресурсы из MaterialMints
        ResourceKind::Seeds => material_mints.seeds,
        ResourceKind::Wheat => material_mints.wheat,
        ResourceKind::Flour => material_mints.flour,
        ResourceKind::Bread => material_mints.bread,
        ResourceKind::Water => material_mints.water,
        ResourceKind::Coal => material_mints.coal,
        ResourceKind::Meat => material_mints.meat,
        ResourceKind::StoneBlue => material_mints.stone_blue,
        ResourceKind::StonePurple => material_mints.stone_purple,
        ResourceKind::StoneRed => material_mints.stone_red,
        ResourceKind::SandWhite => material_mints.sand_white,
        ResourceKind::SandPink => material_mints.sand_pink,
        ResourceKind::SandYellow => material_mints.sand_yellow,
        ResourceKind::GemBlue => material_mints.gem_blue,
        ResourceKind::GemOrange => material_mints.gem_orange,
        ResourceKind::GemWhite => material_mints.gem_white,
        ResourceKind::GemGreen => material_mints.gem_green,
        ResourceKind::FlaskBlue => material_mints.flask_blue,
        ResourceKind::FlaskYellow => material_mints.flask_yellow,
        ResourceKind::FlaskGreen => material_mints.flask_green,
        ResourceKind::FlaskPink => material_mints.flask_pink,
        ResourceKind::FlaskPurple => material_mints.flask_purple,
        ResourceKind::LoveHeart => material_mints.love_heart,
    }
}

/// [НОВОЕ]: перенос `pickFeeBps` из Ronin index.js — там комиссия на вывод
/// ресурсов была псевдослучайным bps в диапазоне, зависящем от перков
/// (медальон/историк), детерминированным хешем от адреса+nonce+суммы (не
/// предсказуемым заранее, не подверженным повторным попыткам ради лучшего
/// исхода). Здесь тот же принцип применён к моменту материализации
/// ресурсов on-chain (mint_resource — Solana-эквивалент Ronin-"withdraw",
/// см. AUDIT_V2/AUDIT_V3): amount дробится на `user_cut`/`fee_cut`,
/// `fee_cut` уходит в treasury_token вместо пользователя.
fn pick_fee_bps(user: &Pubkey, amount: u64, slot: u64, has_medallion: bool, has_historian: bool) -> u16 {
    let (min_bps, max_bps) = match (has_medallion, has_historian) {
        (true, true) => (MINT_FEE_BOTH_MIN_BPS, MINT_FEE_BOTH_MAX_BPS),
        (false, true) => (MINT_FEE_HISTORIAN_MIN_BPS, MINT_FEE_HISTORIAN_MAX_BPS),
        (true, false) => (MINT_FEE_MEDALLION_MIN_BPS, MINT_FEE_MEDALLION_MAX_BPS),
        (false, false) => (MINT_FEE_BASE_MIN_BPS, MINT_FEE_BASE_MAX_BPS),
    };
    let h = hashv(&[user.as_ref(), &amount.to_le_bytes(), &slot.to_le_bytes()]);
    let span = (max_bps - min_bps) as u64;
    let offset = if span > 0 {
        u64::from_le_bytes(h.to_bytes()[0..8].try_into().unwrap()) % (span + 1)
    } else {
        0
    };
    min_bps + offset as u16
}

pub fn handler(ctx: Context<MintResource>, kind: ResourceKind, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    let expected = mint_for_kind(&ctx.accounts.config, &*ctx.accounts.material_mints, &kind);
    require!(ctx.accounts.mint.key() == expected, AofError::InvalidResourceKind);
    require!(
        ctx.accounts.mint.mint_authority == COption::Some(ctx.accounts.auth.key()),
        AofError::Unauthorized
    );

    let player = &mut ctx.accounts.player;
    if player.owner == Pubkey::default() {
        player.owner = ctx.accounts.token_account.owner;
        player.villagers = DEFAULT_VILLAGERS;
        player.villagers_available = DEFAULT_VILLAGERS;
    }

    let slot = Clock::get()?.slot;
    let bps = pick_fee_bps(
        &ctx.accounts.token_account.owner,
        amount,
        slot,
        player.has_medallion(),
        player.has_historian(),
    );
    let fee_cut = amount.checked_mul(bps as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let user_cut = amount.checked_sub(fee_cut).ok_or(AofError::MathOverflow)?;

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    if user_cut > 0 {
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.auth.to_account_info(),
                },
                signer_seeds,
            ),
            user_cut,
        )?;
    }
    if fee_cut > 0 {
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.auth.to_account_info(),
                },
                signer_seeds,
            ),
            fee_cut,
        )?;
    }
    Ok(())
}
