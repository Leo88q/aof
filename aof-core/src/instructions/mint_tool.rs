use anchor_lang::prelude::*;
use crate::constants::*;
use crate::instructions::settlement;
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
    // Mint one SPL unit and its immutable Metaplex metadata.
    settlement::mint_tool_nft(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.mint.to_account_info(),
        &ctx.accounts.token_account.to_account_info(),
        &ctx.accounts.auth.to_account_info(),
        ctx.bumps.auth,
        &ctx.accounts.metadata.to_account_info(),
        &ctx.accounts.token_metadata_program.to_account_info(),
        &ctx.accounts.payer.to_account_info(),
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.tool_metadata_registry,
        &tool_type,
        rarity,
    )?;
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