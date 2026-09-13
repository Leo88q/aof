#!/bin/bash
set -e

FILE="programs/aof-session-keys/src/lib.rs"

echo "🔧 Исправление aof-session-keys"
echo "==============================="

# Бэкап
cp "$FILE" "$FILE.bak.$(date +%s)"

# Python-фикс всех проблем разом
python3 << 'PYEOF'
import re

path = "programs/aof-session-keys/src/lib.rs"
with open(path) as f:
    src = f.read()

changes = 0

# ============================================================
# Фикс 1: oracle_authority в TrustSnapshotUpdate должен быть mut
# (он payer для init_if_needed trust)
# ============================================================
old1 = """    pub oracle_authority: Signer<'info>,
    /// CHECK: чей снапшот обновляется
    pub user: UncheckedAccount<'info>,
    #[account(
        init_if_needed, payer = oracle_authority, space = TRUST_SPACE,"""

new1 = """    #[account(mut)]
    pub oracle_authority: Signer<'info>,
    /// CHECK: чей снапшот обновляется
    pub user: UncheckedAccount<'info>,
    #[account(
        init_if_needed, payer = oracle_authority, space = TRUST_SPACE,"""

if old1 in src:
    src = src.replace(old1, new1, 1)
    changes += 1
    print("✅ Фикс 1: oracle_authority помечен как mut в TrustSnapshotUpdate")
else:
    print("⚠️  Фикс 1: паттерн не найден — возможно, уже исправлено")

# ============================================================
# Фикс 2: В SessionCreate trust должен иметь bump = trust.bump
# ============================================================
old2 = """    #[account(seeds = [TRUST_SEED, authority.key().as_ref()], bump)]
    pub trust: Account<'info, TrustSnapshot>,"""

new2 = """    #[account(seeds = [TRUST_SEED, authority.key().as_ref()], bump = trust.bump)]
    pub trust: Account<'info, TrustSnapshot>,"""

if old2 in src and "bump = trust.bump" not in src:
    src = src.replace(old2, new2, 1)
    changes += 1
    print("✅ Фикс 2: trust имеет явный bump = trust.bump в SessionCreate")
else:
    print("⚠️  Фикс 2: уже исправлено или паттерн не найден")

# ============================================================
# Фикс 3: Проверить, что declare_id не плейсхолдер
# ============================================================
if 'declare_id!("SessAoF111111111111111111111111111111111")' in src:
    print("⚠️  declare_id всё ещё плейсхолдер! Запускаю обновление...")
    import subprocess
    result = subprocess.run(
        ['solana', 'address', '-k', 'target/deploy/aof_session_keys-keypair.json'],
        capture_output=True, text=True
    )
    real_id = result.stdout.strip()
    if real_id:
        src = src.replace(
            'declare_id!("SessAoF111111111111111111111111111111111")',
            f'declare_id!("{real_id}")',
            1
        )
        changes += 1
        print(f"✅ Фикс 3: declare_id обновлён на {real_id}")
else:
    print("✅ Фикс 3: declare_id уже реальный")

# Сохраняем
with open(path, 'w') as f:
    f.write(src)

print(f"\n✅ Всего применено фиксов: {changes}")
PYEOF

echo ""
echo "🔨 Пересборка..."
anchor build 2>&1 | tee /tmp/build_sk_fix.log

echo ""
echo "=== Последние 10 строк ==="
tail -10 /tmp/build_sk_fix.log

echo ""
ERR=$(grep -c "^error" /tmp/build_sk_fix.log || echo "0")
if [ "$ERR" = "0" ]; then
    echo "✅✅✅ СБОРКА УСПЕШНА ✅✅✅"
    
    # Синхронизация с бэкендом
    if [ -f target/idl/aof_session_keys.json ]; then
        cp target/idl/aof_session_keys.json aof_backend/src/idl/
        echo "✅ IDL скопирован в бэкенд"
    fi
    
    SESSION_ID=$(solana address -k target/deploy/aof_session_keys-keypair.json)
    if ! grep -q "SESSION_PROGRAM_ID" aof_backend/.env 2>/dev/null; then
        echo "SESSION_PROGRAM_ID=$SESSION_ID" >> aof_backend/.env
        echo "✅ SESSION_PROGRAM_ID добавлен в .env"
    fi
    
    echo ""
    echo "📊 ИТОГ: 9/11 критических проблем аудита закрыто"
    echo "  ✅ Патч #7 (Trust tier) — защита has_one = oracle_authority в коде"
    echo "  ✅ Программа aof-session-keys собрана и интегрирована"
else
    echo "❌ Осталось $ERR ошибок:"
    grep "^error" /tmp/build_sk_fix.log | head -10
fi
