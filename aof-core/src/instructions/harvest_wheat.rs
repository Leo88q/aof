use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo};
use crate::constants::*;
use crate::state::*;
use crate::errors::*;
use crate::HarvestWheat;
use crate::ResourceKind;

/// [БЛОК L] Сбор пшеницы с готового тайла.
/// Требует:
/// - Тайл в состоянии "готово" (state == 2 или ready_at <= now)
/// - Neural Seeder (tool_type == "neural_seeder") не занят майнингом (is_mining == false)
/// - 1 Energy
/// Тратит:
/// - 1 Energy
/// - 1 durability инструмента
/// Минтит: Wheat = neuron_amount × 1.5 × yield_mult[редкость]
pub fn handler(ctx: Context<HarvestWheat>, tile_index: u8) -> Result<()> {
    require!(tile_index < 10, AofError::InvalidBatchSize);

    // Проверка что инструмент — Neural Seeder и не занят. Farm actions follow the
    // rental/delegate model: the current operator, not only the owner, signs.
    let tool = &mut ctx.accounts.tool_data;
    require!(tool.operator == ctx.accounts.user.key(), AofError::NotToolOperator);
    require!(crate::state::canonical_tool_type(&tool.tool_type) == Some("neural_seeder"), AofError::InvalidRarityForCraft);
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

    // Считаем урожай: neuron_amount × 1.5 × yield_mult
    let neuron_amount = tile.neuron_amount;
    let yield_bps = match tool.rarity {
        Rarity::Common => YIELD_BPS_COMMON,
        Rarity::Uncommon => YIELD_BPS_UNCOMMON,
        Rarity::Rare => YIELD_BPS_RARE,
        Rarity::Epic => YIELD_BPS_EPIC,
        Rarity::Legendary => YIELD_BPS_LEGENDARY,
    };
    
    let synapse_amount = neuron_amount
        .checked_mul(SYNAPSE_YIELD_MULT_BPS as u64)
        .ok_or(AofError::MathOverflow)?
        .checked_mul(yield_bps as u64)
        .ok_or(AofError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(AofError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(AofError::MathOverflow)?;

    // [SECURITY_CHECKLIST_REVIEW F-F] [AUDIT F-03] claimed that every minting
    // path checks the global supply ceiling, but harvest (the only enabled
    // source of Synapse/"wheat") minted without it. Checked before the CPI so a
    // rejected harvest changes nothing, exactly like collect_flour/bread.
    check_supply_cap(
        &ctx.accounts.material_mints,
        ResourceKind::Synapse,
        ctx.accounts.synapse_mint.supply,
        synapse_amount,
    )?;

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
                mint: ctx.accounts.synapse_mint.to_account_info(),
                to: ctx.accounts.user_synapse.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        synapse_amount,
    )?;

    // Сбрасываем тайл
    tile.state = 0;
    tile.planted_at = 0;
    tile.ready_at = 0;
    tile.neuron_amount = 0;

    Ok(())
}
