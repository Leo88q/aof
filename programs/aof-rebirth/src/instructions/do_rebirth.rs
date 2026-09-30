use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{RebirthConfig, RebirthRecord};
use crate::errors::RebirthError;
use crate::events::RebirthPerformed;

#[derive(Accounts)]
pub struct DoRebirth<'info> {
    #[account(
        seeds = [b"rebirth_config"],
        bump = rebirth_config.bump,
        constraint = !rebirth_config.paused @ RebirthError::Paused
    )]
    pub rebirth_config: Account<'info, RebirthConfig>,

    /// [§3.4] Подпись бэкенда. Ребёрт даёт постоянный бонус, поэтому он не
    /// должен быть достижим без той же транзакции, что несёт полный сброс
    /// (`aof_core::reset_for_rebirth`). Игрок не может вызвать ребёрт сам и
    /// сохранить излишки.
    #[account(address = rebirth_config.authority @ RebirthError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = RebirthRecord::SIZE,
        seeds = [b"rebirth_record", user.key().as_ref()],
        bump
    )]
    pub rebirth_record: Account<'info, RebirthRecord>,

    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: казна, получает цену возрождения; адрес фиксируется конфигом
    #[account(mut, address = rebirth_config.treasury @ RebirthError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DoRebirth>) -> Result<()> {
    // Полный сброс прогресса теперь существует: `aof_core::reset_for_rebirth`
    // в этой же транзакции обнуляет деревню, сезонный пропуск и сжигает
    // излишки. Подпись `authority` (см. DoRebirth) не даёт собрать «бонус без
    // сброса» вручную, а падение любой части транзакции отменяет всё.
    let config = &ctx.accounts.rebirth_config;
    let record = &mut ctx.accounts.rebirth_record;

    // Инициализация при первом ребёрте
    if record.user == Pubkey::default() {
        record.user = ctx.accounts.user.key();
        record.bump = ctx.bumps.rebirth_record;
        record.generation = 1;
        record.rebirth_count = 0;
        record.permanent_bonus_bps = 0;
        record.last_rebirth_ts = 0;
    }

    // Проверка лимитов
    require!(
        record.rebirth_count < config.max_rebirths,
        RebirthError::MaxRebirthsReached
    );

    // Расчёт нового бонуса с капом
    let new_bonus = record
        .permanent_bonus_bps
        .checked_add(config.bonus_per_rebirth_bps)
        .ok_or(RebirthError::MathOverflow)?;
    require!(new_bonus <= config.max_bonus_bps, RebirthError::BonusCapReached);

    // [ФИКС] Кулдаун между ребёртами. Раньше last_rebirth_ts только писался,
    // но не проверялся — можно было спамить ребёрты без остановки.
    let now = Clock::get()?.unix_timestamp;
    if record.last_rebirth_ts > 0 && config.cooldown_seconds > 0 {
        require!(
            now.checked_sub(record.last_rebirth_ts)
                .ok_or(RebirthError::MathOverflow)?
                >= config.cooldown_seconds,
            RebirthError::CooldownActive
        );
    }

    // [ФИКС] Цена возрождения: перевод SOL в казну. Ребёрт больше не бесплатный —
    // это ончейн-часть "потери прогресса". Полный сброс инструментов/ресурсов
    // выполняется оркестрацией бэкенда через aof-core по событию RebirthPerformed.
    let cost = config.rebirth_cost_lamports;
    if cost > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            cost,
        )?;
    }

    // Применяем ребёрт
    record.rebirth_count = record.rebirth_count.checked_add(1).ok_or(RebirthError::MathOverflow)?;
    record.generation = record.generation.checked_add(1).ok_or(RebirthError::MathOverflow)?;
    record.permanent_bonus_bps = new_bonus;
    record.last_rebirth_ts = now;

    emit!(RebirthPerformed {
        user: ctx.accounts.user.key(),
        generation: record.generation,
        rebirth_count: record.rebirth_count,
        permanent_bonus_bps: record.permanent_bonus_bps,
    });

    Ok(())
}
