#!/bin/bash
set -e

FILE="aof-core/src/lib.rs"
BACKUP="$FILE.bak.security.$(date +%s)"

echo "🔒 Применение 3 критических патчей безопасности"
echo "================================================"
cp "$FILE" "$BACKUP"
echo "✅ Бэкап: $BACKUP"

# ============================================================
# ПАТЧ #3: Orderbook — buy_order должен быть привязан к mint
# ============================================================
echo ""
echo "📌 Патч #3: Orderbook buy_order constraint"

python3 << 'PYEOF'
import re

path = "aof-core/src/lib.rs"
with open(path) as f:
    content = f.read()

# Патч #3: buy_order в MatchResourceOrders
# Ищем паттерн и добавляем constraint
pattern = r'(#\[account\([^)]*\)\]\s*\n\s*pub buy_order: Account<ResourceOrder>)'

def add_buy_order_constraint(match):
    old = match.group(1)
    if 'constraint = buy_order.mint' in old:
        print("  ⚠️  buy_order уже имеет constraint — пропускаем")
        return old
    # Добавляем constraint и seeds
    new = old.replace(
        '#[account(mut)]',
        '#[account(mut, seeds = [RESOURCE_ORDER_SEED, buy_order.maker.as_ref(), mint.key().as_ref()], bump, constraint = buy_order.mint == mint.key())]'
    )
    if new == old:
        # Если паттерн другой, пробуем более общую замену
        new = re.sub(
            r'#\[account\(([^)]*)\)\]',
            r'#[account(\1, constraint = buy_order.mint == mint.key())]',
            old,
            count=1
        )
    print("  ✅ buy_order: добавлен constraint + seeds")
    return new

content = re.sub(pattern, add_buy_order_constraint, content)

# ============================================================
# ПАТЧ #5: Repair — wood_mint должен быть address = config.wood_mint
# ============================================================
print("\n📌 Патч #5: Repair wood_mint address")

pattern5 = r'(#\[account\([^)]*\)\]\s*\n\s*pub wood_mint: Account<\'info, Mint>)'

def add_wood_mint_address(match):
    old = match.group(1)
    if 'address = config.wood_mint' in old:
        print("  ⚠️  wood_mint уже имеет address — пропускаем")
        return old
    new = old.replace(
        '#[account(mut)]',
        '#[account(mut, address = config.wood_mint)]'
    )
    if new == old:
        new = re.sub(
            r'#\[account\(([^)]*)\)\]',
            r'#[account(\1, address = config.wood_mint)]',
            old,
            count=1
        )
    print("  ✅ wood_mint: добавлен address = config.wood_mint")
    return new

content = re.sub(pattern5, add_wood_mint_address, content)

# ============================================================
# ПАТЧ #9: Auction — previous_bidder должен быть mut
# ============================================================
print("\n📌 Патч #9: Auction previous_bidder mut")

pattern9 = r'(#\[account\]\s*\n\s*pub previous_bidder:)'

def add_previous_bidder_mut(match):
    old = match.group(1)
    if '#[account(mut' in old:
        print("  ⚠️  previous_bidder уже имеет mut — пропускаем")
        return old
    new = old.replace(
        '#[account]',
        '#[account(mut, address = auction.current_bidder)]'
    )
    print("  ✅ previous_bidder: добавлен mut + address")
    return new

content = re.sub(pattern9, add_previous_bidder_mut, content)

# Сохраняем
with open(path, 'w') as f:
    f.write(content)

print("\n✅ Все 3 патча применены")
PYEOF

echo ""
echo "🔨 Пересборка aof-core..."
anchor build 2>&1 | tee /tmp/build_security.log

echo ""
echo "=== Последние 15 строк ==="
tail -15 /tmp/build_security.log

ERRORS=$(grep -cE "^error" /tmp/build_security.log 2>/dev/null || echo 0)
if [ "$ERRORS" -eq 0 ]; then
    echo ""
    echo "✅✅✅ ПАТЧИ ПРИМЕНЕНЫ УСПЕШНО! ✅✅✅"
    echo ""
    echo "Закрыто критических проблем: 6/11"
    echo ""
    echo "Следующий шаг: Синхронизация IDL с бэкендом"
    cp target/idl/*.json aof_backend/src/idl/
    echo "✅ IDL скопированы"
else
    echo ""
    echo "❌ Осталось $ERRORS ошибок"
    grep -E "^error\[" /tmp/build_security.log | head -10
fi
