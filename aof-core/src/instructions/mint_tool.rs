use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::MintTool;
use crate::errors::*;
use crate::events::*;
use crate::Rarity;

pub fn handler(ctx: Context<MintTool>, tool_type: String, rarity: Rarity) -> Result<()> {
    require!(tool_type.len() <= 32, AofError::ToolTypeTooLong);
    // mint 1 NFT to recipient ATA
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.auth.to_account_info(),
    };
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::mint_to(cpi_ctx, 1)?;
    // record tool data; owner derived from ATA owner
    let td = &mut ctx.accounts.tool_data;
    td.mint = ctx.accounts.mint.key();
    td.owner = ctx.accounts.token_account.owner;
    td.tool_type = tool_type;
    td.rarity = rarity;
    td.durability = MAX_DURABILITY;
    td.is_mining = false;
    td.mining_end = 0;
    td.staked = false;
    td.unlock_at = 0;
    td.operator = ctx.accounts.token_account.owner;
    emit!(ToolMinted {
        to: ctx.accounts.token_account.owner,
        mint: ctx.accounts.mint.key(),
        tool_type: td.tool_type.clone(),
        rarity,
    });
    Ok(())
}