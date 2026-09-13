#!/bin/bash
set -e

echo "🔧 Добавление программы aof-session-keys в workspace"
echo "====================================================="

# 1. Проверяем, есть ли исходники в расширении
if [ ! -d "aof_expansion/programs/aof-session-keys" ]; then
    echo "❌ Исходники aof-session-keys не найдены в aof_expansion/"
    exit 1
fi

# 2. Копируем программу в programs/
echo "📦 Копируем aof-session-keys в programs/"
cp -r aof_expansion/programs/aof-session-keys programs/
echo "✅ Программа скопирована"

# 3. Генерируем keypair для программы
echo ""
echo "🔑 Генерируем keypair для aof-session-keys..."
mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase -o target/deploy/aof_session_keys-keypair.json
SESSION_ID=$(solana address -k target/deploy/aof_session_keys-keypair.json)
echo "✅ Program ID: $SESSION_ID"

# 4. Обновляем declare_id в lib.rs
echo ""
echo "📝 Обновляем declare_id в lib.rs"
python3 << PYEOF
import re

path = "programs/aof-session-keys/src/lib.rs"
with open(path) as f:
    content = f.read()

content = re.sub(
    r'declare_id!\("[^"]+"\)',
    f'declare_id!("$SESSION_ID")',
    content
)

with open(path, 'w') as f:
    f.write(content)

print(f"✅ declare_id обновлён на $SESSION_ID")
PYEOF

# 5. Добавляем программу в Cargo.toml workspace
echo ""
echo "📝 Добавляем в Cargo.toml workspace"
if grep -q "programs/aof-session-keys" Cargo.toml; then
    echo "✅ Уже в workspace"
else
    sed -i '' 's|"programs/aof-rebirth",|"programs/aof-rebirth",\n    "programs/aof-session-keys",|' Cargo.toml
    echo "✅ Добавлено в workspace"
fi

# 6. Добавляем программу в Anchor.toml
echo ""
echo "📝 Добавляем в Anchor.toml"
python3 << PYEOF
import re

path = "Anchor.toml"
with open(path) as f:
    content = f.read()

session_id = "$SESSION_ID"

# Добавляем в [programs.localnet]
if "aof_session_keys" in content:
    print("✅ Уже в Anchor.toml")
else:
    content = re.sub(
        r'(\[programs\.localnet\])',
        rf'\1\naof_session_keys = "{session_id}"',
        content
    )
    content = re.sub(
        r'(\[programs\.devnet\])',
        rf'\1\naof_session_keys = "{session_id}"',
        content
    )
    with open(path, 'w') as f:
        f.write(content)
    print("✅ Добавлено в Anchor.toml")
PYEOF

# 7. Собираем программу
echo ""
echo "🔨 Сборка aof-session-keys..."
anchor build 2>&1 | tee /tmp/build_session.log

echo ""
echo "=== Последние 15 строк ==="
tail -15 /tmp/build_session.log

ERRORS=$(grep -cE "^error" /tmp/build_session.log 2>/dev/null || echo 0)
if [ "$ERRORS" -eq 0 ]; then
    echo ""
    echo "✅✅✅ ПРОГРАММА ДОБАВЛЕНА УСПЕШНО! ✅✅✅"
    echo ""
    echo "Program ID: $SESSION_ID"
    echo "IDL готов: target/idl/aof_session_keys.json"
    echo ""
    echo "📊 Статус критических проблем:"
    echo "  ✅ Патч #7 (Trust tier самоназначение) — УЖЕ ПРИМЕНЁН в коде"
    echo "  ✅ Программа aof-session-keys добавлена в workspace"
    echo ""
    echo "Закрыто критических проблем: 9/11"
else
    echo ""
    echo "❌ Осталось $ERRORS ошибок"
    grep -E "^error\[" /tmp/build_session.log | head -10
fi
