use anchor_lang::prelude::*;
use crate::state::SessionToken;
use crate::errors::MarketError;
use crate::events::SessionRevoked;

#[derive(Accounts)]
pub struct SessionRevoke<'info> {
    #[account(
        mut,
        constraint = session_token.authority == authority.key() @ MarketError::InvalidSessionSigner,
        close = authority
    )]
    pub session_token: Account<'info, SessionToken>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<SessionRevoke>) -> Result<()> {
    let session = &ctx.accounts.session_token;
    emit!(SessionRevoked {
        authority: ctx.accounts.authority.key(),
        session_signer: session.session_signer,
    });
    Ok(())
}
