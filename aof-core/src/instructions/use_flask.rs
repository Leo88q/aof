use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};
use crate::constants::*;
use crate::errors::*;
use crate::state::*;
use crate::UseFlask;
use crate::ResourceKind;

/// Применение флякона (флюида): одна фляга сжигается, игрок получает энергию
/// по тиру (`FLASK_ENERGY_GAIN`), не выше потолка `ENERGY_CAP`.
///
/// Почему инструкция вообще появилась. Все пять флюидов — живые ресурсы
/// программы: их выпускают рецепты 3–7 (`craft_recipe`), они входят в
/// `MaterialMints`, каталог игры называет их расходниками. Но потребителя у них
/// не было ни одного: крафт выпускал предмет, который некуда деть. Здесь у
/// флюидов появляется единственный объявленный эффект — энергия; обещания
/// «+20% добычи», «×2 скорости» и прочих баффов остаются необъявленными, пока
/// для них нет состояния в программе.
///
/// Границы:
/// * `flask_kind` строго 1..=5 (`InvalidFlaskType`), минт сверяется с
///   каноническим `mint_for_kind` (`MaterialNotRegistered`) — произвольный
///   SPL-минт флягой не считается;
/// * бак должен вместить всю награду (`EnergyCapExceeded`) — фляга не тратится
///   на пустой обмен;
/// * сжигание идёт до начисления: отказ CPI ничего не меняет.
pub fn handler(ctx: Context<UseFlask>, flask_kind: u8) -> Result<()> {
    let (kind, gain) = flask_kind_reward(flask_kind).ok_or(AofError::InvalidFlaskType)?;
    require!(gain > 0, AofError::InvalidFlaskType);

    let expected = mint_for_kind(&ctx.accounts.config, &ctx.accounts.material_mints, &kind);
    require!(ctx.accounts.flask_mint.key() == expected, AofError::MaterialNotRegistered);

    let energy = &mut ctx.accounts.energy_account;
    crate::instructions::exchange_data_energy::lazy_init_energy(
        energy,
        ctx.accounts.user.key(),
        ctx.bumps.energy_account,
    )?;
    require!(energy.owner == ctx.accounts.user.key(), AofError::Unauthorized);

    let amount = RESOURCE_UNIT;
    require!(ctx.accounts.user_flask.amount >= amount, AofError::InsufficientBalance);
    let room = energy.cap.saturating_sub(energy.current) as u64;
    require!(gain as u64 <= room, AofError::EnergyCapExceeded);

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.flask_mint.to_account_info(),
                from: ctx.accounts.user_flask.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    energy.current = energy
        .current
        .checked_add(gain)
        .ok_or(AofError::MathOverflow)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_flask_kind_maps_to_its_canonical_resource() {
        assert_eq!(flask_kind_reward(1).unwrap().0, ResourceKind::CryoFluid);
        assert_eq!(flask_kind_reward(2).unwrap().0, ResourceKind::VoltFluid);
        assert_eq!(flask_kind_reward(3).unwrap().0, ResourceKind::BioFluid);
        assert_eq!(flask_kind_reward(4).unwrap().0, ResourceKind::NanoFluid);
        assert_eq!(flask_kind_reward(5).unwrap().0, ResourceKind::QuantumFluid);
    }

    #[test]
    fn out_of_range_kinds_never_reach_the_burn() {
        for kind in [0u8, 6, 7, 200, u8::MAX] {
            assert!(flask_kind_reward(kind).is_none(), "kind {kind} обязан быть отклонён");
        }
    }

    #[test]
    fn gain_always_fits_into_an_empty_tank() {
        for kind in 1..=5u8 {
            let (_, gain) = flask_kind_reward(kind).unwrap();
            assert!(gain <= ENERGY_CAP, "награда {gain} выше бака");
        }
    }
}
