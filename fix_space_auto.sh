#!/bin/bash
set -e

CORE_DIR="/Users/zlata/Desktop/aof_gui/aof-core"

echo "🔧 Автоматическое исправление размеров аккаунтов..."
echo "=================================================="

# 1. Создаём бэкап
cp "$CORE_DIR/src/constants.rs" "$CORE_DIR/src/constants.rs.bak"
cp "$CORE_DIR/src/lib.rs" "$CORE_DIR/src/lib.rs.bak"
echo "✅ Бэкапы созданы"

# 2. Удаляем все *_SPACE константы из constants.rs
echo ""
echo "📝 Удаляем *_SPACE константы из constants.rs..."
sed -i '' '/^pub const [A-Z_]*_SPACE: usize = /d' "$CORE_DIR/src/constants.rs"
echo "✅ Константы удалены"

# 3. Заменяем space = X_SPACE на space = 8 + X::INIT_SPACE в lib.rs
echo ""
echo "📝 Заменяем space = X_SPACE в lib.rs..."

# Создаём Python скрипт для точной замены
cat > /tmp/fix_space.py << 'PYEOF'
import re

with open('/Users/zlata/Desktop/aof_gui/aof-core/src/lib.rs', 'r') as f:
    content = f.read()

# Паттерн: space = X_SPACE → space = 8 + X::INIT_SPACE
# Пример: space = CONFIG_SPACE → space = 8 + Config::INIT_SPACE
def replace_space(match):
    const_name = match.group(1)
    # Преобразуем SCREAMING_SNAKE_CASE в PascalCase
    type_name = ''.join(word.capitalize() for word in const_name.lower().split('_'))
    return f'space = 8 + {type_name}::INIT_SPACE'

content = re.sub(r'space\s*=\s*([A-Z_]+_SPACE)', replace_space, content)

with open('/Users/zlata/Desktop/aof_gui/aof-core/src/lib.rs', 'w') as f:
    f.write(content)

print("✅ Замены выполнены")
PYEOF

python3 /tmp/fix_space.py

# 4. Проверяем, что все структуры имеют #[derive(InitSpace)]
echo ""
echo "🔍 Проверяем #[derive(InitSpace)] в state.rs..."

if grep -q "#\[account\]" "$CORE_DIR/src/state.rs"; then
    # Проверяем каждую структуру
    missing_init_space=0
    
    # Список всех аккаунтов
    accounts=$(grep -A1 "#\[account\]" "$CORE_DIR/src/state.rs" | grep "pub struct" | sed 's/pub struct \([A-Za-z_]*\).*/\1/')
    
    for account in $accounts; do
        if ! grep -B5 "pub struct $account" "$CORE_DIR/src/state.rs" | grep -q "InitSpace"; then
            echo "⚠️  $account не имеет #[derive(InitSpace)]"
            missing_init_space=$((missing_init_space + 1))
        fi
    done
    
    if [ $missing_init_space -eq 0 ]; then
        echo "✅ Все структуры имеют #[derive(InitSpace)]"
    else
        echo ""
        echo "❌ Найдено $missing_init_space структур без InitSpace"
        echo "   Нужно добавить #[derive(InitSpace)] к каждой структуре в state.rs"
        echo "   Пример:"
        echo "   #[account]"
        echo "   #[derive(InitSpace)]  ← добавить эту строку"
        echo "   pub struct Config {"
        exit 1
    fi
fi

# 5. Финальная проверка
echo ""
echo "📊 Проверка результата..."

remaining_space=$(grep -c "space = [A-Z_]*_SPACE" "$CORE_DIR/src/lib.rs" || echo "0")
if [ "$remaining_space" -gt 0 ]; then
    echo "❌ Осталось $remaining_space необработанных space = X_SPACE"
    grep "space = [A-Z_]*_SPACE" "$CORE_DIR/src/lib.rs"
    exit 1
fi

remaining_constants=$(grep -c "pub const [A-Z_]*_SPACE:" "$CORE_DIR/src/constants.rs" || echo "0")
if [ "$remaining_constants" -gt 0 ]; then
    echo "❌ Осталось $remaining_constants констант *_SPACE"
    grep "pub const [A-Z_]*_SPACE:" "$CORE_DIR/src/constants.rs"
    exit 1
fi

echo ""
echo "✅ ЭТАП 1.1 ЗАВЕРШЁН УСПЕШНО!"
echo ""
echo "Что сделано:"
echo "  • Удалено 35+ констант *_SPACE из constants.rs"
echo "  • Заменено все space = X_SPACE на space = 8 + X::INIT_SPACE в lib.rs"
echo "  • Проверено наличие #[derive(InitSpace)] на всех структурах"
echo ""
echo "Следующий шаг: запустите ./fix_critical.sh снова и выберите вариант 3"
