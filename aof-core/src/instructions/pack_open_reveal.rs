use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, MintTo};
use crate::constants::*;
use crate::PackOpenReveal;
use crate::errors::*;
use crate::events::*;
use crate::state::Rarity;
use crate::randomness::*;

pub fn handler(ctx: Context<PackOpenReveal>, secret: [u8; 32]) -> Result<()> {
    require!(!ctx.accounts.pack_commit.revealed, AofError::CommitMismatch);
    require!(
        hash_secret(&secret) == ctx.accounts.pack_commit.commit_hash,
        AofError::CommitMismatch
    );

    let slot_hash = get_slot_hash(&ctx.accounts.slot_hashes, ctx.accounts.pack_commit.commit_slot)?;
    let entropy = derive_entropy(&secret, &slot_hash, b"pack");
    let roll = entropy_u64(&entropy);

    let rarity_idx = weighted_pick(roll, &ctx.accounts.pack_config.odds_bps);
    let rarity = Rarity::from_u8(rarity_idx as u8).ok_or(AofError::MathOverflow)?;

    // второй независимый ролл (следующие 8 байт энтропии) — выбор типа инструмента
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
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_token.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        1,
    )?;

    let td = &mut ctx.accounts.tool_data;
    td.mint = ctx.accounts.mint.key();
    td.owner = ctx.accounts.pack_commit.user;
    td.tool_type = tool_type.clone();
    td.rarity = rarity;
    td.durability = MAX_DURABILITY;
    td.is_mining = false;
    td.mining_end = 0;
    td.staked = false;
    td.unlock_at = 0;
    td.last_mined_hours = 0;
    td.operator = ctx.accounts.pack_commit.user;

    ctx.accounts.pack_commit.revealed = true;

    emit!(PackOpened {
        user: ctx.accounts.pack_commit.user,
        mint: ctx.accounts.mint.key(),
        pack_type: ctx.accounts.pack_commit.pack_type,
        rarity,
        tool_type,
    });
    Ok(())
}
