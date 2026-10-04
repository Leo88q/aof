use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};
use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::ExchangeDataEnergy;

/// Обмен ресурса DATA на энергию.
///
/// Правило: `data_amount` атомов DATA сжигаются, игрок получает
/// `data_amount / DATA_ATOMS_PER_ENERGY` единиц энергии (целое DATA → 1 энергия).
///
/// Почему инструкция вообще появилась. Энергия уже живёт в сети (`EnergyAccount`)
/// и тратится лабораторной цепочкой (`plant_neuron`, `harvest_synapse`,
/// `start_signal_processing`, `start_model_training`), но восстановить её можно
/// было **только временем** — 1 единица за 30 минут. DATA, базовый ресурс
/// добычи, не имел ни одного стока: его можно было только продать или положить
/// в рецепт. Здесь DATA становится топливом.
///
/// Границы честные и проверяются ДО сжигания:
/// * `data_amount` обязан быть целым числом единиц (`DATA_ATOMS_PER_ENERGY`) —
///   иначе дробная часть сгорела бы без энергии;
/// * обмен не проходит, если энергии не хватает ровно на посчитанную награду
///   (`EnergyCapExceeded`) — сжечь DATA «в никуда» нельзя, игрок увидит причину;
/// * сначала сжигаем (единственный внешний вызов), потом начисляем: если CPI
///   откажет, состояние энергии не изменится.
pub fn handler(ctx: Context<ExchangeDataEnergy>, data_amount: u64) -> Result<()> {
    require!(data_amount > 0, AofError::ZeroAmount);
    require!(data_amount % DATA_ATOMS_PER_ENERGY == 0, AofError::InvalidAmount);

    let gain = data_amount / DATA_ATOMS_PER_ENERGY;
    // DATA_ATOMS_PER_ENERGY == RESOURCE_UNIT, а u8-потолок энергии всё равно
    // ниже: узкое приведение безопасно, но проверяем явно, чтобы «gain == 0»
    // не стал тихой ошибкой округления.
    require!(gain > 0 && gain <= ENERGY_CAP as u64, AofError::InvalidAmount);

    let energy = &mut ctx.accounts.energy_account;
    lazy_init_energy(energy, ctx.accounts.user.key(), ctx.bumps.energy_account)?;
    require!(energy.owner == ctx.accounts.user.key(), AofError::Unauthorized);

    // Проверка запаса токенов и места в баке — до burn'а.
    require!(ctx.accounts.user_data.amount >= data_amount, AofError::InsufficientBalance);
    let room = energy.cap.saturating_sub(energy.current) as u64;
    require!(gain <= room, AofError::EnergyCapExceeded);

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.data_mint.to_account_info(),
                from: ctx.accounts.user_data.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        data_amount,
    )?;

    energy.current = energy
        .current
        .checked_add(gain as u8)
        .ok_or(AofError::MathOverflow)?;
    Ok(())
}

/// Ленивая инициализация энергии — та же форма, что во всех лабораторных
/// инструкциях: новый аккаунт создаётся полным (`ENERGY_CAP`), иначе первый
/// вызов стал бы бесплатным пополнением поверх отсутствующего состояния.
pub fn lazy_init_energy(energy: &mut EnergyAccount, owner: Pubkey, bump: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    if energy.owner == Pubkey::default() {
        energy.owner = owner;
        energy.current = ENERGY_CAP;
        energy.last_regen_at = now;
        energy.cap = ENERGY_CAP;
        energy.bump = bump;
        return Ok(());
    }
    energy.regenerate(now);
    Ok(())
}
