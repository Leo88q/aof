//! Делегированные действия арендатора: mining / collect / repair.
//!
//! ## Почему отдельные инструкции
//!
//! Арендованный инструмент лежит в `rental_vault` листинга, а не в общем
//! stake-vault (`rental_list` требует `!tool.staked`, а `stake` — подписи
//! владельца). Обычные `start_mining`/`collect_mining`/`repair` поэтому
//! недостижимы для арендатора, хотя `ToolData.operator` на время аренды
//! указывает именно на него. Право арендатора доказывает **активная запись
//! аренды**, а не кэш: см. `tool_ownership::assert_rental_delegation`.
//!
//! Контексты выделены отдельными инструкциями, а не расширены «пустыми»
//! аккаунтами в существующих: у стейк-пути (self-mining, self-repair) список
//! аккаунтов и констрейнты остаются ровно теми же, что проверены ранее.
//!
//! ## Семантика награды (та самая явная семантика из отчёта)
//!
//! * сессия обязана завершиться до конца аренды: `now + hours <= agreement.end`
//!   (`RentalSessionTooLong`). Поэтому между `mining_end` и `agreement.end` есть
//!   гарантированное окно, когда аренда ещё не может быть завершена никем,
//!   кроме самого арендатора (`rental_end` разрешает чужой вызов только после
//!   `end`);
//! * сбор награды доступен **только** арендатору (`renter == operator`), в том
//!   числе после `agreement.end`, пока аренда не закрыта: сессия по построению
//!   была начата внутри аренды;
//! * `rental_end`/`rental_revoke` сбрасывают незавершённую сессию (`is_mining`,
//!   `mining_end`, `last_mined_hours`), иначе флаг навсегда заблокировал бы
//!   владельцу `start_mining` после делиста. К этому моменту арендатор либо уже
//!   забрал награду (окно было гарантировано), либо бросил сессию — тогда она
//!   отменяется без выплаты;
//! * награда всегда минтится в emission и уходит на ATA арендатора: владелец
//!   инструмента не может забрать чужую сессию, потому что она его не.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, MintTo};

use crate::constants::*;
use crate::errors::*;
use crate::events::{MiningCollected, ToolRepaired};
use crate::state::*;
use crate::instructions::collect_mining::{mining_reward_amount, resource_kind_for_tool};
use crate::instructions::tool_ownership::{
    assert_rental_collect_right, assert_active_rental_delegation, assert_token_in_escrow,
};
use crate::{CollectMiningDelegated, RepairDelegated, StartMiningDelegated};

/// Старт сессии майнинга арендатором. Тело повторяет `start_mining::handler`,
/// но право даёт аренда, а не стейк: «жители» тратятся из профиля арендатора,
/// длительность сессии ограничена остатком аренды.
pub fn start_handler(ctx: Context<StartMiningDelegated>, hours: u8) -> Result<()> {
    require!(ctx.accounts.config.mining_enabled, AofError::MiningDisabled);

    // Авторизация раньше бизнес-проверок: отказ по правам не должен зависеть от
    // значения `hours` или остатка durability.
    let now = Clock::get()?.unix_timestamp;
    assert_active_rental_delegation(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.rental_listing,
        &ctx.accounts.rental_agreement,
        &ctx.accounts.user.key(),
        now,
    )?;
    // Эскроу — это PDA листинга, а не арендатор: `token.owner == operator`
    // для аренды неверно по построению.
    assert_token_in_escrow(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.rental_vault,
        &ctx.accounts.rental_listing.key(),
    )?;

    require!(hours > 0, AofError::ZeroAmount);
    require!(
        hours <= ctx.accounts.tool.durability,
        AofError::InsufficientDurability
    );
    require!(
        hours <= ctx.accounts.tool.rarity.max_hours(),
        AofError::HoursExceedRarityCap
    );

    let speed = crate::instructions::collect_mining::enchant_slot_level(
        &ctx.accounts.mint.key(),
        crate::instructions::collect_mining::SPEED_ENCHANT_SLOT,
        &ctx.remaining_accounts,
    )?;
    let wait = crate::instructions::collect_mining::mining_wait_hours(hours, speed)?;
    let end = now
        .checked_add((wait as i64) * 3600)
        .ok_or(AofError::MathOverflow)?;
    require!(
        end <= ctx.accounts.rental_agreement.end,
        AofError::RentalSessionTooLong
    );

    let player = &mut ctx.accounts.player;
    if player.owner == Pubkey::default() {
        player.owner = ctx.accounts.user.key();
        player.villagers = DEFAULT_VILLAGERS;
        player.villagers_available = DEFAULT_VILLAGERS;
        player.has_tent = false;
        player.cooldown_until = 0;
    }
    require!(player.villagers_available > 0, AofError::NoIdleVillagers);
    player.villagers_available -= 1;

    let tool = &mut ctx.accounts.tool;
    tool.is_mining = true;
    tool.mining_end = end;
    tool.last_mined_hours = hours;
    Ok(())
}

/// Сбор награды арендатором. Формула, проверка supply cap и списание
/// durability — те же, что в `collect_mining::handler`.
pub fn collect_handler(ctx: Context<CollectMiningDelegated>) -> Result<()> {
    require!(ctx.accounts.config.mining_enabled, AofError::MiningDisabled);

    // Авторизация раньше состояния сессии: посторонний обязан получить
    // NotToolOperator, а не «сессия ещё не завершена».
    let now = Clock::get()?.unix_timestamp;
    assert_rental_collect_right(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.rental_listing,
        &ctx.accounts.rental_agreement,
        &ctx.accounts.user.key(),
        now,
    )?;
    // Эскроу — это PDA листинга, а не арендатор: `token.owner == operator`
    // для аренды неверно по построению.
    assert_token_in_escrow(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.rental_vault,
        &ctx.accounts.rental_listing.key(),
    )?;

    require!(now >= ctx.accounts.tool.mining_end, AofError::MiningNotComplete);

    let hours = ctx.accounts.tool.last_mined_hours;
    require!(hours > 0, AofError::InvalidAmount);
    let kind = resource_kind_for_tool(&ctx.accounts.tool.tool_type)
        .ok_or(AofError::InvalidResourceKind)?;
    let expected_mint = crate::state::mint_for_kind(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &kind,
    );
    require!(
        ctx.accounts.payout_mint.key() == expected_mint,
        AofError::InvalidResourceKind
    );
    require!(
        ctx.accounts.payout_mint.mint_authority
            == anchor_lang::solana_program::program_option::COption::Some(ctx.accounts.auth.key()),
        AofError::Unauthorized
    );

    let amount = mining_reward_amount(hours, ctx.accounts.tool.rarity)?;
    require!(amount > 0, AofError::ZeroAmount);

    check_supply_cap(
        &ctx.accounts.material_mints,
        &mut ctx.accounts.issuance_cap,
        kind,
        amount,
    )?;

    let auth_bump = ctx.bumps.auth;
    let signer_seeds: &[&[&[u8]]] = &[&[AUTH_SEED, &[auth_bump]]];
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.payout_mint.to_account_info(),
                to: ctx.accounts.payout_token.to_account_info(),
                authority: ctx.accounts.auth.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    let level = crate::instructions::collect_mining::durability_enchant_level(
        &ctx.accounts.mint.key(),
        &ctx.remaining_accounts,
    )?;
    let loss = crate::instructions::collect_mining::durability_loss(hours, level)?;
    let durability = ctx
        .accounts
        .tool
        .durability
        .checked_sub(loss)
        .ok_or(AofError::InsufficientDurability)?;
    let tool = &mut ctx.accounts.tool;
    tool.durability = durability;
    tool.is_mining = false;
    tool.mining_end = 0;
    tool.last_mined_hours = 0;

    // Житель возвращается в профиль арендатора — он же его и тратил.
    ctx.accounts.player.villagers_available = ctx
        .accounts
        .player
        .villagers_available
        .saturating_add(1)
        .min(ctx.accounts.player.villagers);

    emit!(MiningCollected {
        user: ctx.accounts.user.key(),
        tool_mint: ctx.accounts.mint.key(),
        resource_mint: expected_mint,
        hours,
        amount,
        durability_after: durability,
    });
    Ok(())
}

/// Ремонт арендованного инструмента арендатором за свои ресурсы. Владелец
/// по-прежнему может чинить обычным `repair`, а арендатор — только этим путём
/// и только пока аренда активна.
pub fn repair_handler(ctx: Context<RepairDelegated>, amount: u8) -> Result<()> {
    require!(amount > 0, AofError::InvalidAmount);

    let now = Clock::get()?.unix_timestamp;
    assert_active_rental_delegation(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.rental_listing,
        &ctx.accounts.rental_agreement,
        &ctx.accounts.user.key(),
        now,
    )?;
    // Эскроу — это PDA листинга, а не арендатор: `token.owner == operator`
    // для аренды неверно по построению.
    assert_token_in_escrow(
        &ctx.accounts.tool,
        &ctx.accounts.mint,
        &ctx.accounts.rental_vault,
        &ctx.accounts.rental_listing.key(),
    )?;

    let new_durability = ctx.accounts.tool.durability.saturating_add(amount);
    require!(new_durability <= MAX_DURABILITY, AofError::DurabilityOverflow);

    let rarity = ctx.accounts.tool.rarity;
    let silicon_cost = amount as u64 * rarity.repair_silicon_cost_per_unit();
    let circuit_cost = amount as u64 * rarity.repair_circuit_cost_per_unit();

    require!(
        ctx.accounts.user_silicon.amount >= silicon_cost,
        AofError::InsufficientBalance
    );
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.silicon_mint.to_account_info(),
                from: ctx.accounts.user_silicon.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        silicon_cost,
    )?;

    require!(
        ctx.accounts.user_circuit.amount >= circuit_cost,
        AofError::InsufficientBalance
    );
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.circuit_mint.to_account_info(),
                from: ctx.accounts.user_circuit.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        circuit_cost,
    )?;

    ctx.accounts.tool.durability = new_durability;

    emit!(ToolRepaired {
        user: ctx.accounts.user.key(),
        tool_mint: ctx.accounts.tool.mint,
        repaired_amount: amount,
        silicon_cost,
        circuit_cost,
        new_durability,
    });
    Ok(())
}
