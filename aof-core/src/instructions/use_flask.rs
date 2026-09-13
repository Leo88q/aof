use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn};
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UseFlask<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"player", player.key().as_ref()],
        bump = player_state.bump
    )]
    pub player_state: Account<'info, PlayerState>,
    
    #[account(mut)]
    pub user_flask: Account<'info, token::TokenAccount>,
    
    pub flask_mint: Account<'info, token::Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// [НОВОЕ] Использование флакона для получения временного баффа
pub fn handler(ctx: Context<UseFlask>, flask_type: u8) -> Result<()> {
    // 1. Сжигаем 1 флакон
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.flask_mint.to_account_info(),
                from: ctx.accounts.user_flask.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        1,
    )?;

    // 2. Применяем бафф на 1 час (3600 секунд)
    let clock = Clock::get()?;
    ctx.accounts.player_state.buff_expires_at = clock.unix_timestamp + 3600;
    ctx.accounts.player_state.buff_type = flask_type; 
    // flask_type: 1 = BLUE (энергия), 2 = YELLOW (газ), 3 = GREEN (рост), 4 = PINK (любовь), 5 = PURPLE (удача)

    msg!("Flask used! Buff type {} active for 1 hour.", flask_type);
    Ok(())
}
