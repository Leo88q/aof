use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn, CloseAccount};
use crate::constants::*;
use crate::state::*;
use crate::BurnTool;
use crate::errors::*;
use crate::events::*;

pub fn handler(ctx: Context<BurnTool>) -> Result<()> {
    // burn the 1 NFT
    let cpi_burn = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_burn), 1)?;
    // close ATA back to user
    let cpi_close = CloseAccount {
        account: ctx.accounts.token_account.to_account_info(),
        destination: ctx.accounts.user.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    token::close_account(CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_close))?;
    emit!(ToolBurned {
        from: ctx.accounts.user.key(),
        mint: ctx.accounts.mint.key(),
    });
    Ok(())
}