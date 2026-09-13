#!/bin/bash
set -e

MARKET="/Users/zlata/Desktop/aof_gui/programs/aof-market/src"
KEYPAIR="/Users/zlata/Desktop/aof_gui/solana/keys/aof-market.json"
ANCHOR_TOML="/Users/zlata/Desktop/aof_gui/Anchor.toml"

# Получаем валидный Program ID
if [ ! -f "$KEYPAIR" ]; then
    echo "❌ Keypair не найден: $KEYPAIR"
    echo "   Запустите: solana-keygen new --no-bip39-passphrase -o $KEYPAIR"
    exit 1
fi

MARKET_ID=$(solana address -k "$KEYPAIR")
echo "🔑 Program ID: $MARKET_ID"

# Бэкапы
cp "$MARKET/lib.rs" "$MARKET/lib.rs.bak.$(date +%s)"
cp "$ANCHOR_TOML" "$ANCHOR_TOML.bak.$(date +%s)"

# =============================================================
# 1. Заменяем placeholder declare_id на настоящий
# =============================================================
echo "📝 Обновляем declare_id!"
python3 << PYEOF
import re

market_id = "$MARKET_ID"
market_path = "$MARKET/lib.rs"

with open(market_path) as f:
    src = f.read()

# Заменяем declare_id!("...") на настоящий ID
src = re.sub(
    r'declare_id!\("[^"]+"\)',
    f'declare_id!("{market_id}")',
    src
)

with open(market_path, "w") as f:
    f.write(src)

print(f"✅ lib.rs: declare_id = {market_id}")
PYEOF

# =============================================================
# 2. Добавляем программу в Anchor.toml
# =============================================================
echo "📝 Обновляем Anchor.toml"
python3 << PYEOF
import re

market_id = "$MARKET_ID"
anchor_toml = "$ANCHOR_TOML"

with open(anchor_toml) as f:
    src = f.read()

# Ищем [programs.localnet] секцию и добавляем aof_market
if "aof_market" in src and "[programs.localnet]" in src:
    # Заменяем существующую строку
    src = re.sub(
        r'aof_market\s*=\s*"[^"]+"',
        f'aof_market = "{market_id}"',
        src
    )
    print("  (заменено существующее aof_market)")
elif "[programs.localnet]" in src:
    # Добавляем новую строку после [programs.localnet]
    src = src.replace(
        "[programs.localnet]",
        f"[programs.localnet]\naof_market = \"{market_id}\"",
        1
    )
    print("  (добавлено aof_market в [programs.localnet])")
else:
    # Добавляем новую секцию
    src += f"\n[programs.localnet]\naof_market = \"{market_id}\"\n"
    print("  (создана новая секция [programs.localnet])")

with open(anchor_toml, "w") as f:
    f.write(src)

print("✅ Anchor.toml обновлён")
PYEOF

# =============================================================
# 3. Исправляем borrow checker в hot_market_sell_into_queue
# =============================================================
echo "📝 Исправляем borrow checker (pool_info)"
python3 << 'PYEOF'
lib_path = "/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"

with open(lib_path) as f:
    src = f.read()

# Проблемное место: hot_market_sell_into_queue
# Было: let pool = &mut ctx.accounts.pool; ... ctx.accounts.pool.to_account_info()
# Нужно: сначала сохранить pool_info, потом делать &mut

old_sell = """    pub fn hot_market_sell_into_queue(ctx: Context<HotMarketSell>, rarity: u8, currency: Currency, min_price: u64) -> Result<()> {
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.pool;
        let base = match currency {
            Currency::Core => pool.target_price_core,
            Currency::Gem => pool.target_price_gem,
        };
        let price = pricing::current_price(
            base,
            pool.growth_bps_per_sale,
            pool.decay_bps_per_hour,
            pool.purchases_in_window,
            pool.last_trade_ts,
            now,
        )?;
        require!(price >= min_price, MarketError::SlippageExceeded);
        require!(ctx.accounts.pool_currency.amount >= price, MarketError::InsufficientReserve);
        let pool_bump = pool.bump;
        let seeds: &[&[u8]] = &[POOL_SEED, &[rarity], &[pool_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_currency.to_account_info(),
                    to: ctx.accounts.seller_currency.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            price,
        )?;
        pool.last_trade_ts = now;
        // продажа В пул слегка тянет purchases_in_window вниз — противоположно buy
        pool.purchases_in_window = pool.purchases_in_window.saturating_sub(1);
        emit!(HotMarketSold {
            seller: ctx.accounts.seller.key(),
            rarity,
            currency,
            price,
        });
        Ok(())
    }"""

new_sell = """    pub fn hot_market_sell_into_queue(ctx: Context<HotMarketSell>, rarity: u8, currency: Currency, min_price: u64) -> Result<()> {
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        // [FIX] сохраняем pool_info ДО мутирующего заимствования — иначе borrow checker ругается
        let pool_info = ctx.accounts.pool.to_account_info();
        let base = match currency {
            Currency::Core => ctx.accounts.pool.target_price_core,
            Currency::Gem => ctx.accounts.pool.target_price_gem,
        };
        let price = pricing::current_price(
            base,
            ctx.accounts.pool.growth_bps_per_sale,
            ctx.accounts.pool.decay_bps_per_hour,
            ctx.accounts.pool.purchases_in_window,
            ctx.accounts.pool.last_trade_ts,
            now,
        )?;
        require!(price >= min_price, MarketError::SlippageExceeded);
        require!(ctx.accounts.pool_currency.amount >= price, MarketError::InsufficientReserve);
        let pool_bump = ctx.accounts.pool.bump;
        let seeds: &[&[u8]] = &[POOL_SEED, &[rarity], &[pool_bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.pool_currency.to_account_info(),
                    to: ctx.accounts.seller_currency.to_account_info(),
                    authority: pool_info.clone(),
                },
                &[seeds],
            ),
            price,
        )?;
        let pool = &mut ctx.accounts.pool;
        pool.last_trade_ts = now;
        // продажа В пул слегка тянет purchases_in_window вниз — противоположно buy
        pool.purchases_in_window = pool.purchases_in_window.saturating_sub(1);
        emit!(HotMarketSold {
            seller: ctx.accounts.seller.key(),
            rarity,
            currency,
            price,
        });
        Ok(())
    }"""

if old_sell in src:
    src = src.replace(old_sell, new_sell)
    with open(lib_path, "w") as f:
        f.write(src)
    print("✅ hot_market_sell_into_queue исправлен (borrow-safe)")
else:
    print("⚠️  Паттерн не найден точно — пробуем универсальную замену")
    # Универсальная замена: добавляем pool_info = ctx.accounts.pool.to_account_info() в начале
    src = src.replace(
        "let pool = &mut ctx.accounts.pool;",
        "// [FIX] pool_info для CPI перед мутирующим заимствованием\n        let pool_info = ctx.accounts.pool.to_account_info();\n        let pool = &mut ctx.accounts.pool;",
        1
    )
    # Заменяем использование ctx.accounts.pool.to_account_info() внутри CPI на pool_info
    src = src.replace(
        "authority: ctx.accounts.pool.to_account_info(),",
        "authority: pool_info.clone(),"
    )
    with open(lib_path, "w") as f:
        f.write(src)
    print("✅ Применена универсальная замена")
PYEOF

# =============================================================
# 4. Проверяем и копируем keypair в target/deploy/
# =============================================================
echo ""
echo "📦 Синхронизируем keypair в target/deploy/"
mkdir -p /Users/zlata/Desktop/aof_gui/target/deploy
cp "$KEYPAIR" /Users/zlata/Desktop/aof_gui/target/deploy/aof_market-keypair.json
echo "✅ target/deploy/aof_market-keypair.json обновлён"

# =============================================================
# 5. Запуск сборки
# =============================================================
echo ""
echo "================================================"
echo "🔨 Сборка aof-market"
echo "================================================"
cd /Users/zlata/Desktop/aof_gui
anchor build 2>&1 | tee /tmp/build_market.log

echo ""
echo "=== Последние 20 строк ==="
tail -20 /tmp/build_market.log

echo ""
echo "=== Итог ==="
ERRORS=$(grep -cE "^error" /tmp/build_market.log 2>/dev/null || echo 0)
if [ "$ERRORS" -eq 0 ]; then
    echo "✅ Сборка успешна! $ERRORS ошибок"
    echo ""
    echo "📋 Что сделано:"
    echo "  • Program ID: $MARKET_ID"
    echo "  • Anchor.toml обновлён"
    echo "  • Borrow checker в sell_into_queue исправлен"
    echo "  • IDL готовы в target/idl/aof_market.json"
else
    echo "❌ Осталось $ERRORS ошибок. Пришлите tail /tmp/build_market.log"
fi
