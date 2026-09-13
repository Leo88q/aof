#!/bin/bash
set -e

echo "🔧 Применяем все 4 фикса..."

# ===== ФИКС 1: Добавляем energy в Player =====
python3 << 'PYEOF'
path = "aof-core/src/state.rs"
with open(path) as f:
    c = f.read()

if "pub energy:" not in c:
    c = c.replace(
        "    pub medallion_count: u8,        // 1\n}",
        "    pub medallion_count: u8,        // 1\n    pub energy: u32,             // 4\n}"
    )
    with open(path, 'w') as f:
        f.write(c)
    print("✅ 1/4: energy добавлено в Player (как u32, без Option)")
else:
    print("ℹ️  energy уже есть")
PYEOF

# ===== ФИКС 2: Расширяем импорт token =====
python3 << 'PYEOF'
path = "aof-core/src/lib.rs"
with open(path) as f:
    c = f.read()

old = "use anchor_spl::token::{Token, TokenAccount, Mint};"
new = "use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn};"
if old in c:
    c = c.replace(old, new, 1)
    with open(path, 'w') as f:
        f.write(c)
    print("✅ 2/4: импорт token расширен (self + Burn)")
PYEOF

# ===== ФИКС 3: Добавляем GASTANK_SPACE =====
if ! grep -q "GASTANK_SPACE" aof-core/src/constants.rs; then
    echo "" >> aof-core/src/constants.rs
    echo "pub const GASTANK_SPACE: usize = 57;" >> aof-core/src/constants.rs
    echo "✅ 3/4: GASTANK_SPACE добавлен"
fi

# ===== ФИКС 4: Добавляем InvalidMint в AofError =====
python3 << 'PYEOF'
path = "aof-core/src/errors.rs"
with open(path) as f:
    c = f.read()
if "InvalidMint" not in c:
    c = c.replace("    NoExcessToSweep,\n",
                  "    NoExcessToSweep,\n    #[msg(\"Invalid mint address\")]\n    InvalidMint,\n")
    with open(path, 'w') as f:
        f.write(c)
    print("✅ 4/4: InvalidMint добавлен")
PYEOF

# ===== ФИКС 5: Исправляем player.energy (без unwrap_or) =====
python3 << 'PYEOF'
path = "aof-core/src/lib.rs"
with open(path) as f:
    c = f.read()

# Заменяем "player.energy.unwrap_or(0)" на просто "player.energy"
# так как теперь это u32, а не Option<u32>
c = c.replace("player.energy.unwrap_or(0)", "player.energy")
c = c.replace("player_state.energy.unwrap_or(0)", "player_state.energy")

# Заменяем Some(new_energy) на new_energy
import re
# В инструкциях exchange_food_energy и use_flask
c = re.sub(r'player\.energy = Some\(([^)]+)\);', r'player.energy = \1;', c)
c = re.sub(r'player_state\.energy = Some\(([^)]+)\);', r'player_state.energy = \1;', c)

with open(path, 'w') as f:
    f.write(c)
print("✅ 5/5: убран unwrap_or/Some для energy")
PYEOF

echo ""
echo "🔨 Проверка компиляции aof-core..."
cd aof-core
cargo build 2>&1 | grep -E "^error" | head -20
echo "---"
cargo build 2>&1 | tail -5

