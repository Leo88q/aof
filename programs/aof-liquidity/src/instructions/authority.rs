use anchor_lang::prelude::*;
use crate::state::LpConfig;
use crate::errors::LiquidityError;
use crate::events::*;

/// [AUDIT F-02] Propose the next authority. Nothing changes yet, so a wrong
/// pubkey stays recoverable.
#[derive(Accounts)]
pub struct SetPendingAuthority<'info> {
    #[account(mut, seeds = [b"lp_config"], bump = lp_config.bump, has_one = authority @ LiquidityError::Unauthorized)]
    pub lp_config: Account<'info, LpConfig>,
    pub authority: Signer<'info>,
}

/// [AUDIT F-02] The *new* key accepts. Requiring its signature is what stops a
/// proposal from handing the program to a key nobody controls.
#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    #[account(
        mut,
        seeds = [b"lp_config"],
        bump = lp_config.bump,
        constraint = lp_config.pending_authority == new_authority.key() @ LiquidityError::NotPendingAuthority
    )]
    pub lp_config: Account<'info, LpConfig>,
    pub new_authority: Signer<'info>,
}

/// [AUDIT F-02] Withdraw a pending rotation.
#[derive(Accounts)]
pub struct CancelPendingAuthority<'info> {
    #[account(mut, seeds = [b"lp_config"], bump = lp_config.bump, has_one = authority @ LiquidityError::Unauthorized)]
    pub lp_config: Account<'info, LpConfig>,
    pub authority: Signer<'info>,
}

pub fn set_pending_authority_handler(
    ctx: Context<SetPendingAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    require!(new_authority != Pubkey::default(), LiquidityError::InvalidInput);
    let c = &mut ctx.accounts.lp_config;
    let previous = c.authority;
    c.pending_authority = new_authority;
    emit!(AuthorityRotationProposed {
        previous,
        next: new_authority,
        at: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

pub fn accept_authority_handler(ctx: Context<AcceptAuthority>) -> Result<()> {
    let c = &mut ctx.accounts.lp_config;
    require!(c.pending_authority != Pubkey::default(), LiquidityError::NoPendingAuthority);
    let previous = c.authority;
    let next = ctx.accounts.new_authority.key();
    let now = Clock::get()?.unix_timestamp;
    c.authority = next;
    c.pending_authority = Pubkey::default();
    c.authority_updated_at = now;
    emit!(AuthorityChanged { previous, next, at: now });
    Ok(())
}

pub fn cancel_pending_authority_handler(ctx: Context<CancelPendingAuthority>) -> Result<()> {
    let c = &mut ctx.accounts.lp_config;
    require!(c.pending_authority != Pubkey::default(), LiquidityError::NoPendingAuthority);
    let cancelled = c.pending_authority;
    c.pending_authority = Pubkey::default();
    emit!(AuthorityRotationCancelled {
        authority: ctx.accounts.authority.key(),
        cancelled,
        slot: Clock::get()?.slot,
    });
    Ok(())
}
