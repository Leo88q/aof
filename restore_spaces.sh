#!/bin/bash
set -e

echo "🔧 Восстановление размеров аккаунтов"
echo "===================================="

# Бэкап
cp aof-core/src/state.rs aof-core/src/state.rs.bak.restore.$(date +%s)
cp aof-core/src/constants.rs aof-core/src/constants.rs.bak.restore.$(date +%s)
cp aof-core/src/lib.rs aof-core/src/lib.rs.bak.restore.$(date +%s)

# ============================================================
# ШАГ 1: Добавляем InitSpace derive ко всем структурам в state.rs
# ============================================================
echo ""
echo "📋 Шаг 1: Добавляем InitSpace к структурам state.rs..."

python3 << 'PYEOF'
path = "aof-core/src/state.rs"
with open(path) as f:
    content = f.read()

changes = 0

# Паттерн: #[account]\npub struct NAME {
# Заменить на: #[account]\n#[derive(InitSpace)]\npub struct NAME {
import re

pattern = r'#\[account\]\n(pub struct \w+ \{)'

def add_init_space(match):
    global changes
    changes += 1
    return f'#[account]\n#[derive(InitSpace)]\n{match.group(1)}'

# Считаем существующие InitSpace
existing_init_space = content.count('#[derive(InitSpace)]')
print(f"Существующих InitSpace: {existing_init_space}")

new_content, count = re.subn(pattern, add_init_space, content)

if count > 0:
    with open(path, 'w') as f:
        f.write(new_content)
    print(f"✅ Добавлено {count} InitSpace derives (всего: {existing_init_space + count})")
else:
    print("ℹ️  InitSpace уже есть у всех структур")
PYEOF

# ============================================================
# ШАГ 2: Добавляем _SPACE константы в constants.rs
# ============================================================
echo ""
echo "📋 Шаг 2: Добавляем _SPACE константы..."

python3 << 'PYEOF'
# Получаем все имена структур из state.rs
with open("aof-core/src/state.rs") as f:
    state_content = f.read()

import re
structs = re.findall(r'#\[derive\(InitSpace\)\]\npub struct (\w+) \{', state_content)
print(f"Найдено структур с InitSpace: {len(structs)}")

# Создаём константы
space_consts = []
for struct_name in structs:
    # Config -> CONFIG_SPACE, Player -> PLAYER_SPACE
    const_name = re.sub(r'([A-Z])', r'_\1', struct_name).upper().lstrip('_') + '_SPACE'
    # Используем INIT_SPACE из derive макроса
    space_consts.append(f"pub const {const_name}: usize = 8 + {struct_name}::INIT_SPACE;")

# Записываем в constants.rs
with open("aof-core/src/constants.rs", "a") as f:
    f.write("\n// ===== Размеры аккаунтов (auto-generated from InitSpace) =====\n")
    for const in space_consts:
        f.write(const + "\n")

print(f"✅ Добавлено {len(space_consts)} констант _SPACE")
for c in space_consts[:5]:
    print(f"   {c}")
if len(space_consts) > 5:
    print(f"   ... и ещё {len(space_consts) - 5}")
PYEOF

# ============================================================
# ШАГ 3: Обновляем declare_id
# ============================================================
echo ""
echo "📋 Шаг 3: Обновляем declare_id..."

REAL_ID=$(solana address -k target/deploy/aof_core-keypair.json 2>/dev/null)
if [ -n "$REAL_ID" ]; then
    python3 << PYEOF
import re
path = "aof-core/src/lib.rs"
with open(path) as f:
    content = f.read()

real_id = "$REAL_ID"
content = re.sub(
    r'declare_id!\("[^"]+"\)',
    f'declare_id!("{real_id}")',
    content,
    count=1
)

with open(path, 'w') as f:
    f.write(content)
print(f"✅ declare_id обновлён на {real_id}")
PYEOF
else
    echo "⚠️  Не удалось получить реальный ID"
fi

# ============================================================
# ШАГ 4: Проверка компиляции
# ============================================================
echo ""
echo "🔨 Проверка компиляции..."
cd aof-core
cargo build 2>&1 | grep -E "^error|Finished" | head -10

echo ""
echo "=== Общее число ошибок ==="
cargo build 2>&1 | grep -c "^error" || echo "0"

cd /Users/zlata/Desktop/aof_gui

# ============================================================
# ШАГ 5: Полная сборка
# ============================================================
echo ""
echo "🔨 Полная сборка..."
rm -f target/idl/aof_core.json
anchor build 2>&1 | tail -5

echo ""
echo "=== IDL ==="
ls -la target/idl/aof_core.json 2>/dev/null || echo "❌ IDL не создан"

echo ""
echo "=== Количество инструкций ==="
jq -r '.instructions[].name' target/idl/aof_core.json 2>/dev/null | wc -l

echo ""
echo "=== declare_id после фикса ==="
grep "declare_id" aof-core/src/lib.rs
