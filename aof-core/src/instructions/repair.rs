use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn};
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::state::Rarity;
use crate::Repair;

pub fn handler(ctx: Context<Repair>, amount: u8) -> Result<()> {
    let tool = &mut ctx.accounts.tool;
    require!(tool.owner == ctx.accounts.user.key(), AofError::NotToolOwner);
    require!(amount > 0, AofError::InvalidAmount);
    
    let new_durability = tool.durability.saturating_add(amount);
    require!(new_durability <= MAX_DURABILITY, AofError::DurabilityOverflow);
    
    let rarity = tool.rarity;
    let stone_cost = amount as u64 * rarity.repair_stone_cost_per_unit();
    let wood_cost = amount as u64 * rarity.repair_wood_cost_per_unit();
    
    // Burn STONE
    require!(ctx.accounts.user_stone.amount >= stone_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.stone_mint.to_account_info(),
                from: ctx.accounts.user_stone.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        stone_cost,
    )?;
    
    // Burn WOOD
    require!(ctx.accounts.user_wood.amount >= wood_cost, AofError::InsufficientBalance);
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.wood_mint.to_account_info(),
                from: ctx.accounts.user_wood.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        wood_cost,
    )?;
    
    tool.durability = new_durability;
    
    emit!(ToolRepaired {
        user: ctx.accounts.user.key(),
        tool_mint: tool.mint,
        repaired_amount: amount,
        stone_cost,
        wood_cost,
        new_durability,
    });
    
    Ok(())
}
