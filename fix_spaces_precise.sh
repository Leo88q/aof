#!/bin/bash
set -e

echo "🔧 Точечный патч размеров аккаунтов"
echo "====================================="

# Получаем список реально используемых _SPACE из lib.rs
echo ""
echo "📋 Находим реально используемые _SPACE..."
NEEDED_SPACES=$(grep -oE "[A-Z_]+_SPACE" aof-core/src/lib.rs | sort -u)
echo "$NEEDED_SPACES"

echo ""
echo "📋 Проверяем, какие есть в constants.rs..."
for space in $NEEDED_SPACES; do
    if grep -q "^pub const $space" aof-core/src/constants.rs; then
        echo "✅ $space есть"
    else
        echo "❌ $space отсутствует"
    fi
done

# ============================================================
# Добавляем InitSpace только к тем структурам, которые нужны
# ============================================================
echo ""
echo "📋 Добавляем InitSpace к нужным структурам..."

python3 << 'PYEOF'
import re

# Читаем список нужных _SPACE
with open("aof-core/src/lib.rs") as f:
    lib_content = f.read()

needed_spaces = set(re.findall(r'[A-Z_]+_SPACE', lib_content))
print(f"Нужно {len(needed_spaces)} констант _SPACE")

# Маппинг: CONFIG_SPACE -> Config, PLAYER_SPACE -> Player
space_to_struct = {}
for space in needed_spaces:
    # CONFIG_SPACE -> Config
    struct_name = space.replace('_SPACE', '').title().replace('_', '')
    space_to_struct[space] = struct_name

print("Маппинг:")
for space, struct in space_to_struct.items():
    print(f"  {space} -> {struct}")

# Читаем state.rs
with open("aof-core/src/state.rs") as f:
    state_content = f.read()

# Для каждой нужной структуры добавляем InitSpace если нет
changes = 0
for space, struct_name in space_to_struct.items():
    # Ищем: #[account]\npub struct StructName {
    # или: #[account]\n#[derive(...)]\npub struct StructName {
    pattern1 = rf'(#\[account\])\n(pub struct {struct_name}\s*<\'info>\s*{{|pub struct {struct_name}\s*{{)'
    pattern2 = rf'(#\[account\])\n(#\[derive\([^)]*\)\])\n(pub struct {struct_name}\s*<\'info>\s*{{|pub struct {struct_name}\s*{{)'
    
    def add_init_space1(match):
        global changes
        if 'InitSpace' not in match.group(0):
            changes += 1
            return f'{match.group(1)}\n#[derive(InitSpace)]\n{match.group(2)}'
        return match.group(0)
    
    def add_init_space2(match):
        global changes
        derive_line = match.group(2)
        if 'InitSpace' not in derive_line:
            changes += 1
            # Добавляем InitSpace в существующий derive
            new_derive = derive_line.replace('#[derive(', '#[derive(InitSpace, ')
            return f'{match.group(1)}\n{new_derive}\n{match.group(3)}'
        return match.group(0)
    
    new_content, count1 = re.subn(pattern1, add_init_space1, state_content)
    if count1 > 0:
        state_content = new_content
        print(f"✅ Добавлен InitSpace к {struct_name} (pattern1)")
    
    new_content, count2 = re.subn(pattern2, add_init_space2, state_content)
    if count2 > 0:
        state_content = new_content
        print(f"✅ Добавлен InitSpace к {struct_name} (pattern2)")

with open("aof-core/src/state.rs", 'w') as f:
    f.write(state_content)

print(f"\nВсего изменений: {changes}")
PYEOF

# ============================================================
# Добавляем _SPACE константы в constants.rs
# ============================================================
echo ""
echo "📋 Добавляем _SPACE константы..."

python3 << 'PYEOF'
import re

# Читаем lib.rs чтобы получить список нужных _SPACE
with open("aof-core/src/lib.rs") as f:
    lib_content = f.read()

needed_spaces = set(re.findall(r'[A-Z_]+_SPACE', lib_content))

# Читаем constants.rs
with open("aof-core/src/constants.rs") as f:
    const_content = f.read()

# Добавляем только те, которых нет
to_add = []
for space in needed_spaces:
    if f'pub const {space}' not in const_content:
        struct_name = space.replace('_SPACE', '').title().replace('_', '')
        to_add.append(f'pub const {space}: usize = 8 + {struct_name}::INIT_SPACE;')

if to_add:
    with open("aof-core/src/constants.rs", "a") as f:
        f.write("\n// ===== Размеры аккаунтов (для init space) =====\n")
        for const in to_add:
            f.write(const + "\n")
    print(f"✅ Добавлено {len(to_add)} констант")
    for c in to_add[:5]:
        print(f"   {c}")
    if len(to_add) > 5:
        print(f"   ... и ещё {len(to_add) - 5}")
else:
    print("ℹ️  Все константы уже есть")
PYEOF

# ============================================================
# Проверка
# ============================================================
echo ""
echo "🔨 Проверка компиляции..."
cd aof-core
cargo build 2>&1 | grep -E "^error" | head -15 || echo "✅ 0 ошибок"

echo ""
echo "=== Общее число ошибок ==="
cargo build 2>&1 | grep -c "^error" || echo "0"

cd /Users/zlata/Desktop/aof_gui

if [ "$(cd aof-core && cargo build 2>&1 | grep -c '^error')" = "0" ]; then
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
fi
