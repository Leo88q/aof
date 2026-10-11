//! Общие проверки горячего рынка: канонический инструмент, цена пула, комиссия
//! и вызов `aof_core::transfer_tool`.
//!
//! Пока этих проверок не было, `hot_market_buy/sell` были закрыты: рынок
//! принимал произвольный SPL-минт и не мог обновить `ToolData.owner` после
//! перевода NFT (та заглушка `TradingDisabled` удалена в шаге B пункта 12
//! вместе с лимитными ордерами).
//!
//! CPI в aof_core делается typed-хелпером (`aof_core::cpi::transfer_tool`):
//! program id берётся из типа, список аккаунтов — из сгенерированной структуры,
//! а сам инструмент проверяется официальной распаковкой `ToolData`
//! (чеклист #4/#8/#114: CPI только к типизированной цели, без сырого invoke и
//! без ручного разбора байтов).

use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;
use aof_core::cpi::accounts::TransferTool as CoreTransferTool;
use aof_core::cpi::transfer_tool as core_transfer_tool;
use aof_core::{ToolData, TOOL_SEED};

use crate::errors::MarketError;
use crate::pricing;
use crate::state::{Currency, HotMarketPool, MarketConfig};

/// Проверяет, что переданный аккаунт — канонический `ToolData` (PDA
/// `[TOOL_SEED, mint]` программы aof_core) нужного владельца и редкости.
///
/// Без этой проверки любой игрок мог принести свой SPL-минт в пул и получить
/// оплату по цене пула — «кран» вместо рынка.
pub fn read_canonical_tool(
    tool_data: &UncheckedAccount<'_>,
    mint: Pubkey,
    expected_owner: Pubkey,
    rarity_index: u8,
) -> Result<()> {
    require_keys_eq!(*tool_data.owner, aof_core::ID, MarketError::InvalidInput);
    let (expected, _bump) =
        Pubkey::find_program_address(&[TOOL_SEED, mint.as_ref()], &aof_core::ID);
    require_keys_eq!(*tool_data.key, expected, MarketError::InvalidInput);

    // `try_deserialize` сам сверяет дискриминатор ToolData: чужая структура по
    // этому адресу не пройдёт.
    let data = tool_data.try_borrow_data()?;
    let tool = ToolData::try_deserialize(&mut &data[..])
        .map_err(|_| error!(MarketError::InvalidInput))?;

    require_keys_eq!(tool.mint, mint, MarketError::InvalidInput);
    require_keys_eq!(tool.owner, expected_owner, MarketError::InvalidInput);
    require_keys_eq!(tool.operator, expected_owner, MarketError::InvalidInput);
    require!(!tool.staked && !tool.is_mining, MarketError::InvalidInput);
    require!(tool.rarity.to_u8() == rarity_index, MarketError::InvalidInput);
    Ok(())
}

/// Канонический SPL-минт валюты по `MarketConfig`: `Currency::Core` →
/// `config.core_mint`, `Currency::Gem` → `config.gem_mint`.
///
/// F-CURRENCY-01: `hot_market_buy`/`hot_market_sell_into_queue` считают цену по
/// аргументу `currency`, а платёж выполняют в том mint'е, который пришёл
/// аккаунтом `currency_mint`. Пока эти две вещи не связаны, игрок выбирает
/// дорогую валюту (`Gem`), а платит своим произвольным дешёвым SPL-минтом —
/// пул отдаёт канонический инструмент за мусорный токен. Привязка обязана
/// проверяться в программе: frontend/backend — не граница безопасности.
pub fn expected_currency_mint(config: &MarketConfig, currency: Currency) -> Pubkey {
    match currency {
        Currency::Core => config.core_mint,
        Currency::Gem => config.gem_mint,
    }
}

/// Текущая цена пула в выбранной валюте: рост от покупок, затухание по
/// простою (см. `pricing::current_price`) и множитель события горячего окна.
pub fn pool_price(pool: &HotMarketPool, currency: Currency, now: i64) -> Result<u64> {
    let base = match currency {
        Currency::Core => pool.target_price_core,
        Currency::Gem => pool.target_price_gem,
    };
    require!(base > 0, MarketError::ZeroPrice);
    let mut price = pricing::current_price(
        base,
        pool.growth_bps_per_sale,
        pool.decay_bps_per_hour,
        pool.purchases_in_window,
        pool.last_trade_ts,
        now,
    )?;
    if pool.hot_multiplier_bps > 0 && now < pool.hot_window_end_ts {
        let raised = (price as u128)
            .checked_mul(10_000u128 + pool.hot_multiplier_bps as u128)
            .ok_or(MarketError::MathOverflow)?
            / 10_000u128;
        price = u64::try_from(raised).map_err(|_| error!(MarketError::MathOverflow))?;
    }
    Ok(price.max(1))
}

/// `(выплата продавцу, комиссия казны)` — комиссия не может превысить цену.
/// Treasury keeps 8–10% of a hot-market fill. Zero and the old 2% default are rejected.
pub fn require_treasury_fee(fee_bps: u16) -> Result<()> {
    require!(
        (crate::constants::MARKET_TREASURY_FEE_MIN_BPS..=crate::constants::MARKET_TREASURY_FEE_MAX_BPS)
            .contains(&fee_bps),
        crate::errors::MarketError::InvalidFee
    );
    Ok(())
}

pub fn fee_split(price: u64, fee_bps: u16) -> Result<(u64, u64)> {
    let fee = (price as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(MarketError::MathOverflow)?
        / 10_000u128;
    let fee = u64::try_from(fee).map_err(|_| error!(MarketError::MathOverflow))?;
    let payout = price.checked_sub(fee).ok_or(MarketError::MathOverflow)?;
    Ok((payout, fee))
}

/// Вызов `aof_core::transfer_tool`: NFT и `ToolData.owner/operator` меняются
/// одной инструкцией, поэтому рынок не может заплатить за инструмент, который
/// остался у продавца.
///
/// typed CPI (а не сырой `invoke`): program id берётся из типа `AofCore`, а
/// список аккаунтов — из сгенерированного `accounts::TransferTool`
/// (требование чеклиста #8/#114).
#[allow(clippy::too_many_arguments)]
pub fn transfer_tool_cpi<'info>(
    core_program: AccountInfo<'info>,
    sender: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    sender_token: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    recipient_token: AccountInfo<'info>,
    tool_data: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    require_keys_eq!(*core_program.key, aof_core::ID, MarketError::InvalidInput);
    let accounts = CoreTransferTool {
        sender,
        mint,
        sender_token,
        recipient,
        recipient_token,
        tool_data,
        token_program,
    };
    match signer_seeds {
        Some(neuron) => core_transfer_tool(CpiContext::new_with_signer(core_program, accounts, neuron)),
        None => core_transfer_tool(CpiContext::new(core_program, accounts)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn treasury_fee_band_is_eight_to_ten_percent() {
        assert!(require_treasury_fee(799).is_err());
        assert!(require_treasury_fee(800).is_ok());
        assert!(require_treasury_fee(1_000).is_ok());
        assert!(require_treasury_fee(1_001).is_err());
    }

    #[test]
    fn fee_split_keeps_the_whole_price() {
        assert_eq!(fee_split(1_000_000, 250).unwrap(), (975_000, 25_000));
        assert_eq!(fee_split(100, 0).unwrap(), (100, 0));
        // Комиссия округляется вниз и никогда не превышает цену.
        let (payout, fee) = fee_split(3, 10_000).unwrap();
        assert_eq!(payout + fee, 3);
    }

    /// F-CURRENCY-01 держится на этом соответствии: `Currency` выбирает, какой
    /// именно канонический минт конфига обязан прийти в `currency_mint`.
    #[test]
    fn currency_selects_the_matching_canonical_mint() {
        let config = MarketConfig {
            authority: Pubkey::new_unique(),
            treasury: Pubkey::new_unique(),
            core_mint: Pubkey::new_unique(),
            gem_mint: Pubkey::new_unique(),
            fee_bps: 800,
            paused: false,
            bump: 255,
            pending_authority: Pubkey::default(),
            authority_updated_at: 0,
        };
        assert_eq!(expected_currency_mint(&config, Currency::Core), config.core_mint);
        assert_eq!(expected_currency_mint(&config, Currency::Gem), config.gem_mint);
        // Валюты различимы: подмена одного минта другим не проходит.
        assert_ne!(expected_currency_mint(&config, Currency::Core), config.gem_mint);
        assert_ne!(expected_currency_mint(&config, Currency::Gem), config.core_mint);
    }

}
