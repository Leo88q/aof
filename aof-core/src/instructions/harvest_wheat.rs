use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::HarvestWheat;

/// [БЛОК L] Сбор пшеницы с готового тайла.
/// Требует:
/// - Тайл в состоянии "готово" (state == 2 или ready_at <= now)
/// - Reaper (tool_type == "Reaper") не занят майнингом (is_mining == false)
/// - 1 Energy
/// Тратит:
/// - 1 Energy
/// - 1 durability инструмента
/// Минтит: Wheat = seeds_amount × 1.5 × yield_mult[редкость]
pub fn handler(ctx: Context<HarvestWheat>, tile_index: u8) -> Result<()> {
    require!(tile_index < 10, AofError::InvalidBatchSize);

    // Проверка что инструмент — Reaper и не занят. Farm actions follow the
    // rental/delegate model: the current operator, not only the owner, signs.
    let tool = &mut ctx.accounts.tool_data;
    require!(tool.operator == ctx.accounts.user.key(), AofError::NotToolOperator);
    require!(tool.tool_type.eq_ignore_ascii_case("reaper"), AofError::InvalidRarityForCraft); // переиспользуем ошибку
    require!(!tool.is_mining, AofError::ToolBusy);

    // Проверка что тайл готов
    let tile = &mut ctx.accounts.farm_tile;
    require!(tile.owner == ctx.accounts.user.key(), AofError::Unauthorized);
    require!(tile.state != 0, AofError::FarmTileEmpty);
    
    // Если тайл ещё растёт, проверяем ready_at
    if tile.state == 1 {
        let now = Clock::get()?.unix_timestamp;
        require!(now >= tile.ready_at, AofError::FarmTileNotReady);
    }

    // Проверка энергии (ленивый реген)
    let energy = &mut ctx.accounts.energy_account;
    if energy.owner == Pubkey::default() {
        energy.owner = ctx.accounts.user.key();
        energy.current = ENERGY_CAP;
        energy.last_regen_at = Clock::get()?.unix_timestamp;
        energy.cap = ENERGY_CAP;
        energy.bump = ctx.bumps.energy_account;
    } else {
        energy.regenerate(Clock::get()?.unix_timestamp);
    }

    require!(energy.current >= ENERGY_COST_HARVEST, AofError::InsufficientEnergy);

    // Считаем урожай: seeds_amount × 1.5 × yield_mult
    let seeds_amount = tile.seeds_amount;
    let yield_bps = match tool.rarity {
        Rarity::Common => YIELD_BPS_COMMON,
        Rarity::Uncommon => YIELD_BPS_UNCOMMON,
        Rarity::Rare => YIELD_BPS_RARE,
        Rarity::Epic => YIELD_BPS_EPIC,
        Rarity::Legendary => YIELD_BPS_LEGENDARY,
    };
    
    let wheat_amount = seeds_amount
        .checked_mul(WHEAT_YIELD_MULT_BPS as u64)
        .ok_or(AofError::MathOverflow)?
        .checked_mul(yield_bps as u64)
        .ok_or(AofError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(AofError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(AofError::MathOverflow)?;

    // Тратим durability
    tool.durability = tool.durability.checked_sub(1).ok_or(AofError::InsufficientDurability)?;

    // Тратим Energy
    energy.current = energy.current.checked_sub(ENERGY_COST_HARVEST).ok_or(AofError::InsufficientEnergy)?;

    // Минтим Wheat
    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.wheat_mint.to_account_info(),
                to: ctx.accounts.user_wheat.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        wheat_amount,
    )?;

    // Сбрасываем тайл
    tile.state = 0;
    tile.planted_at = 0;
    tile.ready_at = 0;
    tile.seeds_amount = 0;

    Ok(())
}
