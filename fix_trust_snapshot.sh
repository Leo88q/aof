#!/bin/bash
set -e

FILE="/Users/zlata/Desktop/aof_gui/programs/aof-market/src/instructions/trust/trust_snapshot_update.rs"

echo "🔧 Исправление TrustSnapshotUpdate..."

# Бэкап
cp "$FILE" "$FILE.bak.$(date +%s)"

# Проверяем, есть ли #[derive(Accounts)]
if grep -q "#\[derive(Accounts)\]" "$FILE"; then
    echo "✅ #[derive(Accounts)] уже есть"
    
    # Проверяем, есть ли config с has_one = oracle_authority
    if grep -q "has_one = oracle_authority" "$FILE"; then
        echo "✅ has_one = oracle_authority уже есть"
        exit 0
    else
        echo "⚠️  Нужно добавить has_one = oracle_authority"
        # Добавляем config если его нет
        if ! grep -q "pub config:" "$FILE"; then
            # Ищем первую строку с #[account и добавляем перед ней
            sed -i '' '/^pub struct TrustSnapshotUpdate/i\
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = oracle_authority @ SkError::Unauthorized)]\
    pub config: Account<'\''info, SkConfig>,\
' "$FILE"
            echo "✅ Добавлен config с has_one = oracle_authority"
        fi
    fi
else
    echo "⚠️  Отсутствует #[derive(Accounts)]"
    
    # Ищем строку с "pub struct TrustSnapshotUpdate" и добавляем перед ней атрибут
    sed -i '' 's/^pub struct TrustSnapshotUpdate/#[derive(Accounts)]\npub struct TrustSnapshotUpdate/' "$FILE"
    echo "✅ Добавлен #[derive(Accounts)]"
fi

# Проверяем результат
echo ""
echo "📊 Проверка результата:"
grep -A 20 "pub struct TrustSnapshotUpdate" "$FILE" | head -25

echo ""
echo "✅ Файл исправлен. Запускаем сборку..."
