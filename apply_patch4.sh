#!/bin/bash
set -e

FILE="/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"

echo "🔒 Патч #4: Hot-market treasury protection"
echo "==========================================="

# Проверяем, есть ли уже защита
if grep -q "address = config.treasury" "$FILE"; then
    echo "✅ Защита уже на месте — патч не нужен"
    grep -B1 "address = config.treasury" "$FILE"
    exit 0
fi

echo "⚠️  Защита отсутствует — применяем патч"
cp "$FILE" "$FILE.bak.patch4.$(date +%s)"

python3 << 'PYEOF'
import re

path = "/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"
with open(path) as f:
    src = f.read()

# Ищем в HotMarketBuy блок:
#     /// CHECK: казна
#     #[account(mut)]
#     pub treasury: UncheckedAccount<'info>,
# Заменяем #[account(mut)] на #[account(mut, address = config.treasury)]

# Паттерн: #[account(mut)] непосредственно перед pub treasury: UncheckedAccount
pattern = r'(    /// CHECK: казна\n    )#\[account\(mut\)\](\n    pub treasury: UncheckedAccount<\'info>)'
replacement = r'\1#[account(mut, address = config.treasury)]\2'

new_src, count = re.subn(pattern, replacement, src)

if count == 0:
    # Пробуем более общий паттерн
    pattern2 = r'#\[account\(mut\)\](\s*\n\s*pub treasury: UncheckedAccount<\'info>)'
    replacement2 = r'#[account(mut, address = config.treasury)]\1'
    new_src, count = re.subn(pattern2, replacement2, src, count=1)

if count > 0:
    with open(path, 'w') as f:
        f.write(new_src)
    print(f"✅ Патч применён ({count} замен)")
else:
    print("⚠️  Паттерн не найден — проверьте файл вручную")
    print("   Возможно, treasury уже имеет другой атрибут")
PYEOF

echo ""
echo "🔨 Пересборка..."
cd /Users/zlata/Desktop/aof_gui
anchor build 2>&1 | tail -5
