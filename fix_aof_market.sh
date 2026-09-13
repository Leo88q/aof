#!/bin/bash
set -e

MARKET="/Users/zlata/Desktop/aof_gui/programs/aof-market/src"

echo "🔧 Исправление aof-market (3 корневые проблемы)"
echo "================================================"

# Бэкапы
for f in \
    "$MARKET/instructions/mod.rs" \
    "$MARKET/instructions/hot_market/mod.rs" \
    "$MARKET/instructions/session" \
    "$MARKET/errors.rs" \
    "$MARKET/lib.rs" \
; do
    if [ -e "$f" ]; then
        cp -r "$f" "$f.bak.$(date +%s)" 2>/dev/null || true
    fi
done
echo "✅ Бэкапы созданы"

# =============================================================
# ИСПРАВЛЕНИЕ 1: УДАЛЯЕМ session из aof-market (архитектурно неверно)
# =============================================================
echo ""
echo "🗑️  Удаляем instructions/session/ (это должно быть в aof-session-keys)"
rm -rf "$MARKET/instructions/session"
echo "✅ session/ удалена"

# =============================================================
# ИСПРАВЛЕНИЕ 2: УДАЛЯЕМ trust из aof-market (тоже не здесь)
# =============================================================
echo ""
echo "🗑️  Удаляем instructions/trust/ (это тоже в aof-session-keys)"
rm -rf "$MARKET/instructions/trust"
echo "✅ trust/ удалена"

# =============================================================
# ИСПРАВЛЕНИЕ 3: Чистим instructions/mod.rs
# =============================================================
echo ""
echo "📝 Чистим instructions/mod.rs"

cat > "$MARKET/instructions/mod.rs" << 'MOD_EOF'
pub mod config;
pub mod hot_market;

pub use config::*;
pub use hot_market::*;
MOD_EOF
echo "✅ mod.rs переписан"

# =============================================================
# ИСПРАВЛЕНИЕ 4: Чистим hot_market/mod.rs (убираем конфликт handler)
# =============================================================
echo ""
echo "📝 Чистим hot_market/mod.rs"

cat > "$MARKET/instructions/hot_market/mod.rs" << 'MOD_EOF'
pub mod init_pool;
pub mod buy;
pub mod sell_into_queue;
pub mod skip;
pub mod start_event;
pub mod crank;

// Реэкспортируем Accounts-контексты (уникальные имена)
pub use init_pool::InitPool;
pub use buy::HotMarketBuy;
pub use sell_into_queue::HotMarketSell;
pub use skip::Skip;
pub use start_event::StartEvent;
pub use crank::Crank;
MOD_EOF
echo "✅ hot_market/mod.rs переписан"

# =============================================================
# ИСПРАВЛЕНИЕ 5: Чистим errors.rs от дубликата InvalidRarity
# =============================================================
echo ""
echo "📝 Чистим errors.rs (дубликат InvalidRarity)"

cat > "$MARKET/errors.rs" << 'ERR_EOF'
use anchor_lang::prelude::*;

#[error_code]
pub enum MarketError {
    #[msg("Market is paused")]
    Paused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid rarity: must be 1-4")]
    InvalidRarity,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Insufficient reserve")]
    InsufficientReserve,
    #[msg("Invalid hot window duration")]
    InvalidWindowDuration,
    #[msg("Order is not active")]
    OrderNotActive,
    #[msg("Invalid tier: must be 1-5")]
    InvalidTier,
}
ERR_EOF
echo "✅ errors.rs переписан (дубликат удалён)"

# =============================================================
# ИСПРАВЛЕНИЕ 6: Удаляем session_create/revoke из lib.rs #[program]
# =============================================================
echo ""
echo "📝 Чистим lib.rs от session-инструкций"

# Используем Python для безопасной правки
python3 << 'PYEOF'
import re

lib_path = "/Users/zlata/Desktop/aof_gui/programs/aof-market/src/lib.rs"
with open(lib_path) as f:
    content = f.read()

# Удаляем импорты session
content = re.sub(r'\nuse crate::instructions::session::\*;\n', '\n', content)
content = re.sub(r'\nuse crate::instructions::trust::\*;\n', '\n', content)
content = re.sub(r'\npub use instructions::session::\*;\n', '\n', content)
content = re.sub(r'\npub use instructions::trust::\*;\n', '\n', content)

# Удаляем функции session_create и session_revoke из #[program] блока
# Паттерн: pub fn session_xxx(...) -> Result<()> { ... }
for fn_name in ['session_create', 'session_revoke', 'trust_snapshot_update']:
    pattern = rf'\s*pub fn {fn_name}\s*\([^)]*\)\s*->\s*Result<\(\)>\s*\{{[^}}]*\}}'
    content = re.sub(pattern, '', content, flags=re.DOTALL)

with open(lib_path, "w") as f:
    f.write(content)

print("✅ lib.rs очищен от session-инструкций")
PYEOF

# =============================================================
# ИСПРАВЛЕНИЕ 7: Удаляем TrustSnapshot из state.rs (не наш тип)
# =============================================================
echo ""
echo "📝 Проверяем state.rs на предмет TrustSnapshot"

if grep -q "struct TrustSnapshot" "$MARKET/state.rs"; then
    python3 << 'PYEOF'
import re
state_path = "/Users/zlata/Desktop/aof_gui/programs/aof-market/src/state.rs"
with open(state_path) as f:
    content = f.read()

# Удаляем блок TrustSnapshot
pattern = r'\n#\[account\][^#]*pub struct TrustSnapshot\s*\{[^}]*\}\s*\n'
content = re.sub(pattern, '\n', content, flags=re.DOTALL)

# Удаляем TRUST_SPACE константу
content = re.sub(r'\npub const TRUST_SPACE: usize = [^;]+;\n', '\n', content)
content = re.sub(r'\npub const TRUST_SNAPSHOT_SEED[^;]+;\n', '\n', content)

with open(state_path, "w") as f:
    f.write(content)

print("✅ TrustSnapshot удалён из state.rs")
PYEOF
else
    echo "   (TrustSnapshot в state.rs не найден — ок)"
fi

# =============================================================
# ФИНАЛ: Пересобираем
# =============================================================
echo ""
echo "================================================"
echo "🔨 Запуск сборки"
echo "================================================"
cd /Users/zlata/Desktop/aof_gui
anchor build 2>&1 | tee /tmp/build4.log

echo ""
echo "=== Последние 30 строк сборки ==="
tail -30 /tmp/build4.log

echo ""
echo "=== Ошибок по модулям ==="
grep -E "^error" /tmp/build4.log | sort | uniq -c | sort -rn || echo "  (нет ошибок)"
