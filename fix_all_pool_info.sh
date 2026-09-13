#!/bin/bash
set -e

FILE="/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"

echo "🔧 Исправляем ВСЕ pool_info одной заменой"
echo "=========================================="

# Бэкап
cp "$FILE" "$FILE.bak.poolinfo.$(date +%s)"
echo "✅ Бэкап создан"

# Стратегия: заменить pool_info.clone() → ctx.accounts.pool.to_account_info()
# Это работает в ЛЮБОМ контексте без предварительного объявления
python3 << 'PYEOF'
import re

path = "/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"
with open(path) as f:
    content = f.read()

# 1. Заменяем pool_info.clone() на прямой вызов
content = content.replace(
    "pool_info.clone()",
    "ctx.accounts.pool.to_account_info()"
)
content = content.replace(
    "authority: pool_info",
    "authority: ctx.accounts.pool.to_account_info()"
)

# 2. Удаляем "let pool_info = ..." строки — они больше не нужны
# (но только те, что перед мутирующим заимствованием — т.е. с комментарием FIX)
content = re.sub(
    r'\s*// \[FIX\] pool_info для CPI перед мутирующим заимствованием\n\s*let pool_info = ctx\.accounts\.pool\.to_account_info\(\);\n',
    '\n',
    content
)
content = re.sub(
    r'\s*let pool_info = ctx\.accounts\.pool\.to_account_info\(\);\n',
    '\n',
    content
)
content = re.sub(
    r'\s*let _pool_info = ctx\.accounts\.pool\.to_account_info\(\);\n',
    '\n',
    content
)

# 3. Проверяем что pool_info больше нигде не упоминается (кроме комментариев)
remaining = [line for line in content.split('\n') 
             if 'pool_info' in line and not line.strip().startswith('//')]
if remaining:
    print(f"⚠️  Осталось {len(remaining)} упоминаний pool_info:")
    for line in remaining:
        print(f"    {line.strip()}")
else:
    print("✅ Все pool_info удалены/заменены")

with open(path, 'w') as f:
    f.write(content)

print(f"✅ Файл сохранён")
PYEOF

# Пересборка
echo ""
echo "🔨 Запуск сборки..."
anchor build 2>&1 | tee /tmp/build_poolinfo.log

echo ""
echo "=== Последние 15 строк ==="
tail -15 /tmp/build_poolinfo.log

echo ""
ERRORS=$(grep -cE "^error" /tmp/build_poolinfo.log 2>/dev/null || echo 0)
if [ "$ERRORS" -eq 0 ]; then
    echo "✅✅✅ СБОРКА УСПЕШНА! ✅✅✅"
    echo ""
    ls -la target/idl/aof_market.json 2>/dev/null && echo "✅ IDL готов"
else
    echo "❌ Осталось $ERRORS ошибок:"
    grep -E "^error" /tmp/build_poolinfo.log | head -10
fi
