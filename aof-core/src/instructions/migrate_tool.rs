use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::MigrateTool;
use crate::errors::*;
use crate::events::*;
use crate::Rarity;

pub fn handler(
    ctx: Context<MigrateTool>,
    tool_type: String,
    rarity: Rarity,
    durability: u8,
) -> Result<()> {
    require!(tool_type.len() <= 32, AofError::ToolTypeTooLong);
    require!(durability <= MAX_DURABILITY, AofError::DurabilityExceedsMax);
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
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
    // NOTE: tool_data.owner intentionally NOT set to a real user — migration
    // script must later update ownership/link after mapping to Firestore uid.
    // For safety the tool is minted into the vault ATA with staked=true.
    let td = &mut ctx.accounts.tool_data;
    td.mint = ctx.accounts.mint.key();
    td.owner = ctx.accounts.vault.key();  // set to vault; post-migration reassign to user
    td.tool_type = tool_type;
    td.rarity = rarity;
    td.durability = durability;
    td.is_mining = false;
    td.mining_end = 0;
    td.staked = true;
    td.unlock_at = 0;
    td.operator = ctx.accounts.vault.key();
    emit!(ToolMinted {
        to: ctx.accounts.vault.key(),
        mint: ctx.accounts.mint.key(),
        tool_type: td.tool_type.clone(),
        rarity,
    });
    Ok(())
}