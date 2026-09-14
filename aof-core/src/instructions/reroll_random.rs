use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn, CloseAccount, MintTo};
use crate::constants::*;
use crate::{RerollRandomCommit, RerollRandomReveal, InitRerollConfig, SetRerollConfig};
use crate::errors::*;
use crate::events::*;
use crate::state::Rarity;
use crate::randomness::*;

/// [НОВОЕ]: настоящая рандомизированная пересдача — то, что было заявлено
/// как "reroll" во всех версиях TOR, но не существовало ни в Ronin-коде
/// (детерминированный `Math.random`-эквивалент без commit-reveal), ни в
/// первой версии этой программы (`reroll` там — детерминированный fuse,
/// оставлен как есть под тем же именем, см. AUDIT_V1). Здесь — честный
/// commit-reveal той же схемы, что и паки.
pub fn init_config_handler(ctx: Context<InitRerollConfig>, odds_bps: [u16; 5]) -> Result<()> {
    let sum: u32 = odds_bps.iter().map(|x| *x as u32).sum();
    require!(sum == 10_000, AofError::InvalidOddsWeights);
    let c = &mut ctx.accounts.reroll_config;
    c.odds_bps = odds_bps;
    c.bump = ctx.bumps.reroll_config;
    Ok(())
}

pub fn set_config_handler(ctx: Context<SetRerollConfig>, odds_bps: [u16; 5]) -> Result<()> {
    let sum: u32 = odds_bps.iter().map(|x| *x as u32).sum();
    require!(sum == 10_000, AofError::InvalidOddsWeights);
    ctx.accounts.reroll_config.odds_bps = odds_bps;
    Ok(())
}

pub fn commit_handler(ctx: Context<RerollRandomCommit>, commit_hash: [u8; 32]) -> Result<()> {
    // The tool is burned before reveal and there is no expiry/refund path.
    // Fail closed in the program, not only in the API route.
    require!(false, AofError::FeatureDisabled);
    require!(
        ctx.accounts.gastank.balance_micros >= FEE_PER_REROLL_MICROS,
        AofError::InsufficientBalance
    );
    ctx.accounts.gastank.balance_micros = ctx
        .accounts
        .gastank
        .balance_micros
        .checked_sub(FEE_PER_REROLL_MICROS)
        .ok_or(AofError::MathOverflow)?;

    // сжигаем инструмент сразу в момент коммита — необратимость коммита
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.burn_mint.to_account_info(),
                from: ctx.accounts.burn_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        1,
    )?;
    token::close_account(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.burn_token.to_account_info(),
            destination: ctx.accounts.user.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    ))?;

    let slot = Clock::get()?.slot;
    let rc = &mut ctx.accounts.reroll_commit;
    rc.user = ctx.accounts.user.key();
    rc.burn_mint = ctx.accounts.burn_mint.key();
    rc.new_mint = ctx.accounts.new_mint.key();
    rc.commit_hash = commit_hash;
    rc.commit_slot = slot;
    Ok(())
}

pub fn reveal_handler(ctx: Context<RerollRandomReveal>, secret: [u8; 32]) -> Result<()> {
    require!(
        hash_secret(&secret) == ctx.accounts.reroll_commit.commit_hash,
        AofError::CommitMismatch
    );
    let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, ctx.accounts.reroll_commit.commit_slot)?;
    let entropy = derive_entropy(&secret, &slot_hash, b"reroll");
    let roll = entropy_u64(&entropy);
    let rarity_idx = weighted_pick(roll, &ctx.accounts.reroll_config.odds_bps);
    let rarity = Rarity::from_u8(rarity_idx as u8).ok_or(AofError::MathOverflow)?;

    let mut roll2_bytes = [0u8; 8];
    roll2_bytes.copy_from_slice(&entropy[8..16]);
    let roll2 = u64::from_le_bytes(roll2_bytes);
    let tool_type_idx = (roll2 % PACK_TOOL_TYPES.len() as u64) as usize;
    let tool_type = PACK_TOOL_TYPES[tool_type_idx].to_string();

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.new_mint.to_account_info(),
                to: ctx.accounts.new_token.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    let td = &mut ctx.accounts.new_tool_data;
    td.mint = ctx.accounts.new_mint.key();
    td.owner = ctx.accounts.reroll_commit.user;
    td.tool_type = tool_type.clone();
    td.rarity = rarity;
    td.durability = MAX_DURABILITY;
    td.is_mining = false;
    td.mining_end = 0;
    td.staked = false;
    td.unlock_at = 0;
    td.last_mined_hours = 0;
    td.operator = ctx.accounts.reroll_commit.user;

    emit!(RerollResult {
        user: ctx.accounts.reroll_commit.user,
        burned_mint: ctx.accounts.reroll_commit.burn_mint,
        new_mint: ctx.accounts.new_mint.key(),
        rarity,
        tool_type,
    });
    Ok(())
}
