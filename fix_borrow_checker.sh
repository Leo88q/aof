#!/bin/bash
set -e

FILE="/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"
BACKUP="$FILE.bak.borrow.$(date +%s)"

echo "🔧 Точечный фикс borrow checker в hot_market_sell_into_queue"
echo "============================================================"
cp "$FILE" "$BACKUP"
echo "✅ Бэкап: $BACKUP"

python3 << 'PYEOF'
import re

path = "/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"
with open(path) as f:
    content = f.read()

# Ищем точный блок функции hot_market_sell_into_queue
# Паттерн: pub fn hot_market_sell_into_queue(...) -> Result<()> { ... }
pattern = re.compile(
    r'(    pub fn hot_market_sell_into_queue\(ctx: Context<HotMarketSell>,\s*rarity: u8,\s*currency: Currency,\s*min_price: u64\)\s*->\s*Result<\(\)>\s*\{)'
    r'(.*?)'
    r'(    \})',
    re.DOTALL
)

def rewrite_sell_body(match):
    header = match.group(1)
    old_body = match.group(2)
    closing = match.group(3)
    
    # Строим правильное тело функции
    new_body = """
        rarity_index_ok(rarity)?;
        let now = Clock::get()?.unix_timestamp;
        
        // [FIX] Сохраняем pool_info ДО мутирующего заимствования
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
        
        // Теперь можно делать мутирующее заимствование
        let pool = &mut ctx.accounts.pool;
        pool.last_trade_ts = now;
        pool.purchases_in_window = pool.purchases_in_window.saturating_sub(1);
        
        emit!(HotMarketSold {
            seller: ctx.accounts.seller.key(),
            rarity,
            currency,
            price,
        });
        Ok(())
"""
    
    print("✅ Функция hot_market_sell_into_queue переписана")
    return header + new_body + closing

new_content, count = pattern.subn(rewrite_sell_body, content)

if count == 0:
    print("❌ Паттерн не найден — пытаемся универсальный фикс")
    # Универсальная замена: ищем "let pool = &mut ctx.accounts.pool;" 
    # и добавляем pool_info перед ним
    content = re.sub(
        r'(        let pool = &mut ctx\.accounts\.pool;\n)',
        r'        // [FIX] pool_info для CPI перед мутирующим заимствованием\n        let pool_info = ctx.accounts.pool.to_account_info();\n\1',
        content,
        count=1
    )
    # Заменяем ctx.accounts.pool.to_account_info() на pool_info.clone() в CPI
    content = content.replace(
        'authority: ctx.accounts.pool.to_account_info(),',
        'authority: pool_info.clone(),'
    )
    new_content = content
    print("✅ Применена универсальная замена")

with open(path, "w") as f:
    f.write(new_content)
PYEOF

echo ""
echo "🔨 Пересборка..."
cd /Users/zlata/Desktop/aof_gui
anchor build 2>&1 | tee /tmp/build_borrow.log

echo ""
echo "=== Последние 10 строк ==="
tail -10 /tmp/build_borrow.log

echo ""
ERRORS=$(grep -cE "^error\[" /tmp/build_borrow.log 2>/dev/null || echo 0)
if [ "$ERRORS" -eq 0 ]; then
    echo "✅✅✅ СБОРКА УСПЕШНА! ✅✅✅"
    echo ""
    ls -la target/idl/aof_market.json 2>/dev/null && echo "✅ IDL aof_market.json готов"
else
    echo "❌ Осталось $ERRORS ошибок:"
    grep -E "^error\[" /tmp/build_borrow.log | head -5
fi
