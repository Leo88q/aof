use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use errors::*;
pub use instructions::*;
pub use state::*;

declare_id!("Gvbo9wDEW6kCzzhjk3stEcZoVtcScbN8mGv9SNwTUJLv");

#[program]
pub mod aof_liquidity {
    use super::*;

    pub fn init_lp_config(ctx: Context<InitLpConfig>, mascot_mint: Pubkey) -> Result<()> {
        instructions::init_lp_config::handler(ctx, mascot_mint)
    }

    pub fn lp_deposit(ctx: Context<LpDeposit>, rarity: u8, amount: u64) -> Result<()> {
        instructions::lp_deposit::handler(ctx, rarity, amount)
    }

    pub fn lp_withdraw(ctx: Context<LpWithdraw>, rarity: u8, shares: u64) -> Result<()> {
        instructions::lp_withdraw::handler(ctx, rarity, shares)
    }
}
