use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, CloseAccount, Token, Transfer};
use crate::constants::*;
use crate::{
    Config, MaterialMints, PlaceBuyOrder, PlaceSellOrder, CancelBuyOrder, CancelSellOrder,
    MatchResourceOrders,
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

    **ctx.accounts.buy_order.to_account_info().try_borrow_mut_lamports()? -=
        gross.checked_add(taker_fee).ok_or(AofError::MathOverflow)?;
    **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_receives;
    **ctx.accounts.treasury.try_borrow_mut_lamports()? +=
        taker_fee.checked_add(maker_fee).ok_or(AofError::MathOverflow)?;

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
