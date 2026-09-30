use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, CloseAccount, Token, Transfer};
use crate::constants::*;
use crate::{
    Config, MaterialMints, PlaceBuyOrder, PlaceSellOrder, CancelBuyOrder, CancelSellOrder,
    MatchResourceOrders, PlaceBuyOrderV2, PlaceSellOrderV2, CancelBuyOrderV2, CancelSellOrderV2,
    MatchResourceOrdersV2,
};
use crate::errors::*;
use crate::events::*;

/// [ОБЪЁМ]: полноценный CLOB с матчинг-движком — отдельная большая
/// подсистема (уровня Serum/Openbook). Здесь — минимальный, но честный
/// лимитный ордербук: заявки эскроируются полностью, матчинг — по
/// пересекающейся цене, вызывается permissionless-краном. Buy/Sell —
/// намеренно РАЗНЫЕ инструкции (а не одна с опциональными аккаунтами),
/// чтобы не полагаться на Option<Account<>> в Anchor без возможности
/// прогнать компилятор в этой среде — надёжнее двумя явными путями.

fn expected_resource_mint(config: &Config, materials: &MaterialMints, kind: u8) -> Option<Pubkey> {
    Some(match kind {
        0 => config.food_mint,
        1 => config.wood_mint,
        2 => config.stone_mint,
        3 => materials.seeds,
        4 => materials.wheat,
        5 => materials.flour,
        6 => materials.bread,
        7 => materials.water,
        8 => materials.coal,
        9 => materials.meat,
        10 => materials.stone_blue,
        11 => materials.stone_purple,
        12 => materials.stone_red,
        13 => materials.sand_white,
        14 => materials.sand_pink,
        15 => materials.sand_yellow,
        16 => materials.gem_blue,
        17 => materials.gem_orange,
        18 => materials.gem_white,
        19 => materials.gem_green,
        20 => materials.flask_blue,
        21 => materials.flask_yellow,
        22 => materials.flask_green,
        23 => materials.flask_pink,
        24 => materials.flask_purple,
        25 => materials.love_heart,
        26 => config.potato_mint,
        _ => return None,
    })
}

fn require_canonical_mint(config: &Config, materials: &MaterialMints, mint: &Pubkey, kind: u8) -> Result<()> {
    require!(expected_resource_mint(config, materials, kind) == Some(*mint), AofError::InvalidResourceKind);
    Ok(())
}

pub fn place_buy_handler(
    ctx: Context<PlaceBuyOrder>,
    kind: u8,
    price_lamports_per_unit: u64,
    amount: u64,
) -> Result<()> {
    require_canonical_mint(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.mint.key(),
        kind,
    )?;
    require!(amount > 0 && price_lamports_per_unit > 0, AofError::ZeroAmount);
    let total = price_lamports_per_unit.checked_mul(amount).ok_or(AofError::MathOverflow)?;
    // [ФИКС C2]: эскроу покрывает и тейкер-комиссию, иначе match просядет ниже rent-exemption
    let taker_buffer = total
        .checked_mul(ORDERBOOK_TAKER_FEE_BPS as u64)
        .ok_or(AofError::MathOverflow)?
        / 10_000;
    let deposit = total.checked_add(taker_buffer).ok_or(AofError::MathOverflow)?;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.maker.to_account_info(),
                to: ctx.accounts.order.to_account_info(),
            },
        ),
        deposit,
    )?;
    let o = &mut ctx.accounts.order;
    o.maker = ctx.accounts.maker.key();
    o.kind = kind;
    o.is_buy = true;
    o.price_lamports_per_unit = price_lamports_per_unit;
    o.amount_remaining = amount;
    o.mint = ctx.accounts.mint.key();
    emit!(OrderPlaced { maker: ctx.accounts.maker.key(), is_buy: true, price_lamports_per_unit, amount });
    Ok(())
}

pub fn place_sell_handler(
    ctx: Context<PlaceSellOrder>,
    kind: u8,
    price_lamports_per_unit: u64,
    amount: u64,
) -> Result<()> {
    require_canonical_mint(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.mint.key(),
        kind,
    )?;
    require!(amount > 0 && price_lamports_per_unit > 0, AofError::ZeroAmount);
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.maker_token.to_account_info(),
                to: ctx.accounts.order_vault.to_account_info(),
                authority: ctx.accounts.maker.to_account_info(),
            },
        ),
        amount,
    )?;
    let o = &mut ctx.accounts.order;
    o.maker = ctx.accounts.maker.key();
    o.kind = kind;
    o.is_buy = false;
    o.price_lamports_per_unit = price_lamports_per_unit;
    o.amount_remaining = amount;
    o.mint = ctx.accounts.mint.key();
    emit!(OrderPlaced { maker: ctx.accounts.maker.key(), is_buy: false, price_lamports_per_unit, amount });
    Ok(())
}

pub fn cancel_buy_handler(ctx: Context<CancelBuyOrder>) -> Result<()> {
    let o = &mut ctx.accounts.order;
    // A fully matched order still owns its rent and fee buffer. Allow the
    // maker to close it; otherwise the final match permanently strands the
    // account lamports because amount_remaining is already zero.
    if o.amount_remaining > 0 {
        let refund = o.price_lamports_per_unit.checked_mul(o.amount_remaining).ok_or(AofError::MathOverflow)?;
        o.amount_remaining = 0;
        **ctx.accounts.order.to_account_info().try_borrow_mut_lamports()? -= refund;
        **ctx.accounts.maker.try_borrow_mut_lamports()? += refund;
    }
    Ok(())
}

pub fn cancel_sell_handler(ctx: Context<CancelSellOrder>) -> Result<()> {
    let remaining = ctx.accounts.order.amount_remaining;
    if remaining > 0 {
        let bump = ctx.bumps.order;
        let maker_key = ctx.accounts.maker.key();
        let mint_key = ctx.accounts.mint.key();
        let seeds: &[&[u8]] = &[RESOURCE_ORDER_SEED, maker_key.as_ref(), mint_key.as_ref(), &[bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.order_vault.to_account_info(),
                    to: ctx.accounts.maker_token.to_account_info(),
                    authority: ctx.accounts.order.to_account_info(),
                },
                &[seeds],
            ),
            remaining,
        )?;
        ctx.accounts.order.amount_remaining = 0;
    }

    // The vault is an ATA owned by the order PDA. Close it after the final
    // return so a sell order does not strand rent or leave a reusable PDA
    // holding an unexpected token account.
    let bump = ctx.bumps.order;
    let maker_key = ctx.accounts.maker.key();
    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[RESOURCE_ORDER_SEED, maker_key.as_ref(), mint_key.as_ref(), &[bump]];
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.order_vault.to_account_info(),
            destination: ctx.accounts.maker.to_account_info(),
            authority: ctx.accounts.order.to_account_info(),
        },
        &[seeds],
    ))?;
    Ok(())
}

/// Permissionless: кто угодно может свести совместимую пару buy/sell
/// заявок одного `kind`, если `buy.price >= sell.price`. Сделка проходит
/// по цене продавца (sell.price), объём — минимум из двух остатков.
/// Упрощение: разница между ценой покупателя и ценой сделки не
/// возвращается построчно на каждый мэтч — покупатель получает её при
/// финальной отмене/закрытии своего ордера (остаток эскроу).
pub fn match_handler(ctx: Context<MatchResourceOrders>) -> Result<()> {
    require_canonical_mint(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.mint.key(),
        ctx.accounts.buy_order.kind,
    )?;
    require!(ctx.accounts.buy_order.kind == ctx.accounts.sell_order.kind, AofError::OrdersDoNotCross);
    require!(ctx.accounts.buy_order.is_buy && !ctx.accounts.sell_order.is_buy, AofError::OrdersDoNotCross);
    require!(
        ctx.accounts.buy_order.price_lamports_per_unit >= ctx.accounts.sell_order.price_lamports_per_unit,
        AofError::OrdersDoNotCross
    );
    let amount = ctx.accounts.buy_order.amount_remaining.min(ctx.accounts.sell_order.amount_remaining);
    require!(amount > 0, AofError::OrderExhausted);

    let price = ctx.accounts.sell_order.price_lamports_per_unit;
    let gross = price.checked_mul(amount).ok_or(AofError::MathOverflow)?;
    let taker_fee = gross.checked_mul(ORDERBOOK_TAKER_FEE_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let maker_fee = gross.checked_mul(ORDERBOOK_MAKER_FEE_BPS as u64).ok_or(AofError::MathOverflow)? / 10_000;
    let seller_receives = gross.checked_sub(maker_fee).ok_or(AofError::MathOverflow)?;

    let sell_bump = ctx.bumps.sell_order;
    let seller_key = ctx.accounts.sell_order.maker;
    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[RESOURCE_ORDER_SEED, seller_key.as_ref(), mint_key.as_ref(), &[sell_bump]];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sell_vault.to_account_info(),
                to: ctx.accounts.buyer_token.to_account_info(),
                authority: ctx.accounts.sell_order.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    // [RUNTIME LAMPORT RULE] Direct lamport moves only after the last CPI (at
    // every CPI the runtime re-checks this instruction's lamport sum from the
    // accounts passed to it). This path only worked because none of the three
    // accounts happens to be passed to the transfer above.
    **ctx.accounts.buy_order.to_account_info().try_borrow_mut_lamports()? -=
        gross.checked_add(taker_fee).ok_or(AofError::MathOverflow)?;
    **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_receives;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? +=
        taker_fee.checked_add(maker_fee).ok_or(AofError::MathOverflow)?;

    ctx.accounts.buy_order.amount_remaining -= amount;
    ctx.accounts.sell_order.amount_remaining -= amount;

    emit!(OrderMatched {
        buy_order: ctx.accounts.buy_order.key(),
        sell_order: ctx.accounts.sell_order.key(),
        amount,
        price_lamports_per_unit: price,
    });
    Ok(())
}

// ============================================================================
// v2: цена за ЦЕЛЫЙ ресурс. См. комментарий у `PlaceBuyOrderV2` в lib.rs.
// ============================================================================

/// Сколько лампор стоит `amount_atoms` атомов при цене `price_per_whole` за
/// целый ресурс. Округление ВВЕРХ: эскроу может быть чуть больше точного
/// произведения, но никогда меньше — иначе игрок недоплатит на пыли округления.
pub fn quote_total_lamports(price_per_whole: u64, amount_atoms: u64) -> Result<u64> {
    let product = (price_per_whole as u128)
        .checked_mul(amount_atoms as u128)
        .ok_or(AofError::MathOverflow)?;
    let total = product
        .checked_add(RESOURCE_ATOMS_PER_UNIT - 1)
        .ok_or(AofError::MathOverflow)?
        / RESOURCE_ATOMS_PER_UNIT;
    u64::try_from(total).map_err(|_| error!(AofError::MathOverflow))
}

/// Комиссия тейкера, округлённая вверх по той же причине.
fn taker_buffer_lamports(total: u64) -> Result<u64> {
    let scaled = (total as u128)
        .checked_mul(ORDERBOOK_TAKER_FEE_BPS as u128)
        .ok_or(AofError::MathOverflow)?;
    let buffer = scaled
        .checked_add(9_999)
        .ok_or(AofError::MathOverflow)?
        / 10_000;
    u64::try_from(buffer).map_err(|_| error!(AofError::MathOverflow))
}

/// Общая проверка: заявка v2 должна ссылаться на канонический минт этого вида
/// ресурса, объём и цена — быть ненулевыми.
fn require_v2_order_inputs(
    config: &Config,
    materials: &MaterialMints,
    mint: &Pubkey,
    kind: u8,
    price_lamports_per_whole: u64,
    amount: u64,
) -> Result<()> {
    require_canonical_mint(config, materials, mint, kind)?;
    require!(amount > 0 && price_lamports_per_whole > 0, AofError::ZeroAmount);
    Ok(())
}

pub fn place_buy_handler_v2(
    ctx: Context<PlaceBuyOrderV2>,
    kind: u8,
    price_lamports_per_whole: u64,
    amount: u64,
) -> Result<()> {
    require_v2_order_inputs(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.mint.key(),
        kind,
        price_lamports_per_whole,
        amount,
    )?;
    let total = quote_total_lamports(price_lamports_per_whole, amount)?;
    // Эскроу покрывает и тейкер-комиссию, иначе match просядет ниже rent-exemption.
    let deposit = total
        .checked_add(taker_buffer_lamports(total)?)
        .ok_or(AofError::MathOverflow)?;
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.maker.to_account_info(),
                to: ctx.accounts.order.to_account_info(),
            },
        ),
        deposit,
    )?;
    let o = &mut ctx.accounts.order;
    o.maker = ctx.accounts.maker.key();
    o.kind = kind;
    o.is_buy = true;
    o.price_lamports_per_whole = price_lamports_per_whole;
    o.amount_remaining = amount;
    o.mint = ctx.accounts.mint.key();
    o.escrow_lamports = deposit;
    o.bump = ctx.bumps.order;
    emit!(OrderPlacedV2 {
        maker: ctx.accounts.maker.key(),
        is_buy: true,
        price_lamports_per_whole,
        amount,
        total_lamports: total,
    });
    Ok(())
}

pub fn place_sell_handler_v2(
    ctx: Context<PlaceSellOrderV2>,
    kind: u8,
    price_lamports_per_whole: u64,
    amount: u64,
) -> Result<()> {
    require_v2_order_inputs(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.mint.key(),
        kind,
        price_lamports_per_whole,
        amount,
    )?;
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.maker_token.to_account_info(),
                to: ctx.accounts.order_vault.to_account_info(),
                authority: ctx.accounts.maker.to_account_info(),
            },
        ),
        amount,
    )?;
    let total = quote_total_lamports(price_lamports_per_whole, amount)?;
    let o = &mut ctx.accounts.order;
    o.maker = ctx.accounts.maker.key();
    o.kind = kind;
    o.is_buy = false;
    o.price_lamports_per_whole = price_lamports_per_whole;
    o.amount_remaining = amount;
    o.mint = ctx.accounts.mint.key();
    o.escrow_lamports = 0;
    o.bump = ctx.bumps.order;
    emit!(OrderPlacedV2 {
        maker: ctx.accounts.maker.key(),
        is_buy: false,
        price_lamports_per_whole,
        amount,
        total_lamports: total,
    });
    Ok(())
}

pub fn cancel_buy_handler_v2(ctx: Context<CancelBuyOrderV2>) -> Result<()> {
    // `close = maker` возвращает ВСЕ лампорты аккаунта, включая остаток эскроу и
    // подушку комиссии, поэтому здесь нечего пересчитывать: цены и округление к
    // возврату отношения не имеют. Обнуляем счётчик, чтобы состояние не врало,
    // если аккаунт успели прочитать в этом же слоте.
    ctx.accounts.order.escrow_lamports = 0;
    ctx.accounts.order.amount_remaining = 0;
    Ok(())
}

pub fn cancel_sell_handler_v2(ctx: Context<CancelSellOrderV2>) -> Result<()> {
    let remaining = ctx.accounts.order.amount_remaining;
    // Ключи и bump кладём в локальные значения до сборки seeds: `mint.key()`
    // даёт временный Pubkey (E0716), а `seeds`, живущий до конца функции, не
    // даёт затем обнулить `amount_remaining` (E0502).
    let maker_key = ctx.accounts.order.maker;
    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.accounts.order.bump;
    let seeds: &[&[u8]] = &[
        RESOURCE_ORDER_V2_SEED,
        maker_key.as_ref(),
        mint_key.as_ref(),
        &[bump],
    ];
    if remaining > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.order_vault.to_account_info(),
                    to: ctx.accounts.maker_token.to_account_info(),
                    authority: ctx.accounts.order.to_account_info(),
                },
                &[seeds],
            ),
            remaining,
        )?;
    }
    ctx.accounts.order.amount_remaining = 0;
    // Закрываем vault после возврата токенов, чтобы ордер не оставлял rent и не
    // держал токен-аккаунт с неожиданным содержимым.
    token::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.order_vault.to_account_info(),
            destination: ctx.accounts.maker.to_account_info(),
            authority: ctx.accounts.order.to_account_info(),
        },
        &[seeds],
    ))?;
    Ok(())
}

/// Permissionless свод v2: цена — по продавцу, объём — минимум остатков,
/// покупатель платит `ceil(price_sell × amount / 1e9)` + тейкер-комиссию из
/// своего эскроу. Разница между его ценой и ценой сделки остаётся в эскроу и
/// возвращается при отмене.
pub fn match_handler_v2(ctx: Context<MatchResourceOrdersV2>) -> Result<()> {
    require_canonical_mint(
        &ctx.accounts.config,
        &ctx.accounts.material_mints,
        &ctx.accounts.mint.key(),
        ctx.accounts.buy_order.kind,
    )?;
    require!(ctx.accounts.buy_order.kind == ctx.accounts.sell_order.kind, AofError::OrdersDoNotCross);
    require!(ctx.accounts.buy_order.is_buy && !ctx.accounts.sell_order.is_buy, AofError::OrdersDoNotCross);
    require!(
        ctx.accounts.buy_order.price_lamports_per_whole >= ctx.accounts.sell_order.price_lamports_per_whole,
        AofError::OrdersDoNotCross
    );
    let amount = ctx.accounts.buy_order.amount_remaining.min(ctx.accounts.sell_order.amount_remaining);
    require!(amount > 0, AofError::OrderExhausted);

    let price = ctx.accounts.sell_order.price_lamports_per_whole;
    let gross = quote_total_lamports(price, amount)?;
    let taker_fee = gross
        .checked_mul(ORDERBOOK_TAKER_FEE_BPS as u64)
        .ok_or(AofError::MathOverflow)?
        / 10_000;
    let maker_fee = gross
        .checked_mul(ORDERBOOK_MAKER_FEE_BPS as u64)
        .ok_or(AofError::MathOverflow)?
        / 10_000;
    let buyer_pays = gross.checked_add(taker_fee).ok_or(AofError::MathOverflow)?;
    require!(ctx.accounts.buy_order.escrow_lamports >= buyer_pays, AofError::InsufficientOrderEscrow);
    let seller_receives = gross.checked_sub(maker_fee).ok_or(AofError::MathOverflow)?;

    // Тот же приём, что и в cancel: ключи в локальные значения, чтобы проброс
    // временного Pubkey не ронял сборку.
    let seller_key = ctx.accounts.sell_order.maker;
    let mint_key = ctx.accounts.mint.key();
    let sell_bump = ctx.accounts.sell_order.bump;
    let seeds: &[&[u8]] = &[
        RESOURCE_ORDER_V2_SEED,
        seller_key.as_ref(),
        mint_key.as_ref(),
        &[sell_bump],
    ];
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sell_vault.to_account_info(),
                to: ctx.accounts.buyer_token.to_account_info(),
                authority: ctx.accounts.sell_order.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    // [RUNTIME LAMPORT RULE] прямые движения лампортов — только после последнего CPI.
    **ctx.accounts.buy_order.to_account_info().try_borrow_mut_lamports()? -= buyer_pays;
    **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_receives;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? +=
        taker_fee.checked_add(maker_fee).ok_or(AofError::MathOverflow)?;

    ctx.accounts.buy_order.escrow_lamports -= buyer_pays;
    ctx.accounts.buy_order.amount_remaining -= amount;
    ctx.accounts.sell_order.amount_remaining -= amount;

    emit!(OrderMatchedV2 {
        buy_order: ctx.accounts.buy_order.key(),
        sell_order: ctx.accounts.sell_order.key(),
        amount,
        price_lamports_per_whole: price,
        gross_lamports: gross,
        taker_fee_lamports: taker_fee,
        maker_fee_lamports: maker_fee,
    });
    Ok(())
}

#[cfg(test)]
mod orderbook_v2_quote_tests {
    use super::*;

    /// Цена в v2 — за ЦЕЛЫЙ ресурс (10^9 атомов), поэтому «0,001 SOL за
    /// ресурс» выразимо, а эскроу округляется ВВЕРХ: недоплатить на пыли
    /// округления программа не даёт.
    #[test]
    fn quote_scales_to_whole_units_and_rounds_up() {
        assert_eq!(quote_total_lamports(1_000_000, 1_000_000_000).unwrap(), 1_000_000);
        assert_eq!(quote_total_lamports(1_000_000, 500_000_000).unwrap(), 500_000);
        assert_eq!(quote_total_lamports(1_000_000_000, 1_000_000_000).unwrap(), 1_000_000_000);
        // 3 лампора за целый ресурс × 1 атом = 3e-9 лампора → 1 лампор (вверх).
        assert_eq!(quote_total_lamports(3, 1).unwrap(), 1);
        assert_eq!(quote_total_lamports(1_500_000_000, 1).unwrap(), 2);
        assert_eq!(quote_total_lamports(u64::MAX, 0).unwrap(), 0);
    }

    #[test]
    fn quote_fails_closed_instead_of_wrapping() {
        assert!(quote_total_lamports(u64::MAX, u64::MAX).is_err());
        // u64::MAX × 1 целый ресурс в u64 ещё влезает (ровно u64::MAX), а вот
        // два целых ресурса — уже нет: округление вверх не должно обернуться
        // в маленькое число.
        assert_eq!(quote_total_lamports(u64::MAX, 1_000_000_000).unwrap(), u64::MAX);
        assert!(quote_total_lamports(u64::MAX, 2_000_000_000).is_err());
    }

    /// Подушка тейкер-комиссии тоже округляется вверх, иначе депозит не покроет
    /// комиссию на пылевом объёме.
    #[test]
    fn taker_buffer_rounds_up() {
        assert_eq!(taker_buffer_lamports(10_000).unwrap(), 40);
        assert_eq!(taker_buffer_lamports(1).unwrap(), 1);
        assert_eq!(taker_buffer_lamports(0).unwrap(), 0);
    }
}
