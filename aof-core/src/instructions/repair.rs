use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Burn};
use crate::constants::*;
use crate::errors::*;
use crate::events::*;
use crate::state::Rarity;
use crate::Repair;
use crate::instructions::tool_ownership::{
    assert_idle_tool_ownership, assert_token_in_escrow,
};

/// Право ремонта доказывает владение токеном, а не запись в `ToolData`.
///
/// Допустимы ровно две площадки, где может лежать инструмент:
///
/// 1. личный ATA подписанта — свободный инструмент (`assert_idle_tool_ownership`);
/// 2. общий program vault — застейканный инструмент, эскроу программы
///    (`assert_token_in_escrow`).
///
/// Владение переданным инструментом не доказывается: эскроу принадлежит не
/// подписанту, а программе, и `amount == 1` ищется на его личном аккаунте. Поэтому
/// после обычного SPL-перевода прежний владелец больше не может чинить инструмент,
/// а новый держатель сначала вызывает `sync_tool_owner`.
fn assert_repair_authority(ctx: &Context<Repair>) -> Result<()> {
    let user_key = ctx.accounts.user.key();
    let token_holder = ctx.accounts.tool_token.owner;

    if token_holder == user_key {
        // Свободный инструмент: токен у подписанта. Кэш `owner` проверяет
        // вызывающий обработчик (и это же условие обязательно должно совпасть).
        return assert_idle_tool_ownership(
            &ctx.accounts.tool,
            &ctx.accounts.mint,
            &ctx.accounts.tool_token,
            &user_key,
        );
    }

    // Застейканный инструмент: токен в общем vault программы. Адрес vault
    // выводится, а не принимается аккаунтом, — иначе подписант мог бы подсунуть
    // свой токен-аккаунт и выдать его за эскроу.
    let (vault, _bump) = Pubkey::find_program_address(&[VAULT_SEED], &crate::ID);
    require!(ctx.accounts.tool.staked, AofError::NotStaked);
    require_keys_eq!(token_holder, vault, AofError::NotToolOwner);
    assert_token_in_escrow(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.tool_token,
        &vault,
    )
}

pub fn handler(ctx: Context<Repair>, amount: u8) -> Result<()> {
    require!(amount > 0, AofError::InvalidAmount);
    require!(
        ctx.accounts.tool.owner == ctx.accounts.user.key(),
        AofError::NotToolOwner
    );
    assert_repair_authority(&ctx)?;

    let tool = &mut ctx.accounts.tool;
    
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
