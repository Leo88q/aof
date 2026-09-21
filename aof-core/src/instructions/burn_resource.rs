use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};
use crate::constants::*;
use crate::state::*;
use crate::BurnResource;
use crate::errors::*;
use crate::ResourceKind;

pub fn handler(ctx: Context<BurnResource>, kind: ResourceKind, amount: u64) -> Result<()> {
    require!(amount > 0, AofError::ZeroAmount);
    let expected = mint_for_kind(&ctx.accounts.config, &*ctx.accounts.material_mints, &kind);
    require!(ctx.accounts.mint.key() == expected, AofError::InvalidResourceKind);
    require!(
        ctx.accounts.token_account.amount >= amount,
        AofError::InsufficientBalance
    );
    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.token_account.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::burn(cpi_ctx, amount)?;
    Ok(())
}
