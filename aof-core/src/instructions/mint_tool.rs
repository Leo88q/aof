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
    // [AUDIT F-17] Reject unknown tool kinds instead of minting a tool that can
    // never mine, repair or be used in exploration.
    let tool_type = canonical_tool_type(&tool_type)
        .ok_or(AofError::InvalidToolType)?
        .to_string();
    // [AUDIT F-22] The tool is minted into whichever ATA the authority passed
    // in, and `ToolData.owner` was then derived from that ATA's owner — so a
    // tool could be pushed into a wallet that never asked for it. The intended
    // recipient is now an explicit account and must own the destination ATA.
    require!(
        ctx.accounts.token_account.owner == ctx.accounts.recipient.key(),
        AofError::Unauthorized
    );
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
    let owner = ctx.accounts.token_account.owner;
    init_tool_data(
        &mut ctx.accounts.tool_data,
        ctx.accounts.mint.key(),
        owner,
        tool_type.clone(),
        rarity,
    );
    emit!(ToolMinted {
        to: owner,
        mint: ctx.accounts.mint.key(),
        tool_type,
        rarity,
    });
    Ok(())
}