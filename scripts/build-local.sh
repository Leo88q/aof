#!/usr/bin/env bash
set -euo pipefail

# Локальная сборка программ без IDL, с обходом известного бага proc-macro2/anchor-syn
# Ошибка которую вы видите:
#   error[E0425]: cannot find type `SourceFile` in crate `proc_macro`
#   --> proc-macro2-1.0.94/src/wrapper.rs:366
#   Error: Building IDL failed
# Причина: anchor-syn 0.30.1 требует proc-macro2 <=1.0.94 (метод source_file),
# а 1.0.94 не компилируется на Rust nightly / Rust >=1.90 из-за удаления
# proc_macro::SourceFile. Решение: Rust 1.89.0 + сборка без IDL.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== Проверка тулчейна =="
if ! command -v rustup >/dev/null 2>&1; then
  echo "❌ rustup не найден. Установи: https://rustup.rs"
  exit 1
fi

RUST_VERSION="1.89.0"
AGAVE_VERSION="4.2.1"
ANCHOR_VERSION="0.30.1"

echo "Установка Rust $RUST_VERSION..."
rustup toolchain install "$RUST_VERSION" --profile minimal --component rustfmt,clippy || true
rustup default "$RUST_VERSION"
echo "rustc: $(rustc --version)"
echo "cargo: $(cargo --version)"

# Проверка Agave / Solana CLI
if ! command -v solana >/dev/null 2>&1; then
  echo "⚠️  solana CLI не найден. Устанавливаю Agave $AGAVE_VERSION..."
  sh -c "$(curl -sSfL https://release.anza.xyz/v${AGAVE_VERSION}/install)" || {
    echo "fallback: пробую GitHub release"
    curl -sSfL --retry 3 -o /tmp/solana-release.tar.bz2 "https://github.com/anza-xyz/agave/releases/download/v${AGAVE_VERSION}/solana-release-x86_64-unknown-linux-gnu.tar.bz2" 2>/dev/null || \
    curl -sSfL --retry 3 -o /tmp/solana-release.tar.bz2 "https://github.com/anza-xyz/agave/releases/download/v${AGAVE_VERSION}/solana-release-aarch64-apple-darwin.tar.bz2"
    mkdir -p ~/.local/share/solana/install/active_release
    tar xjf /tmp/solana-release.tar.bz2 -C /tmp
    rm -rf ~/.local/share/solana/install/active_release
    mv /tmp/solana-release ~/.local/share/solana/install/active_release
  }
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi
echo "solana: $(solana --version 2>&1 || echo 'not in PATH')"

# Проверка Anchor CLI
if ! command -v anchor >/dev/null 2>&1; then
  echo "⚠️  anchor CLI не найден. Устанавливаю $ANCHOR_VERSION..."
  cargo install --git https://github.com/coral-xyz/anchor --tag "v${ANCHOR_VERSION}" anchor-cli --locked --force
fi
echo "anchor: $(anchor --version 2>&1 || echo 'not found')"

echo ""
echo "== Пиним proc-macro2 до 1.0.94 (последняя версия с source_file) =="
# В Cargo.lock уже должно быть 1.0.94, но если локально обновился — фиксим
current=$(awk '/^name = "proc-macro2"$/{f=1;next} f&&/^version/{gsub(/"/,"",$3); print $3; exit}' Cargo.lock 2>/dev/null || echo "unknown")
echo "Текущая версия в Cargo.lock: $current"
if [ "$current" != "1.0.94" ]; then
  cargo update -p proc-macro2 --precise 1.0.94 || {
    echo "❌ Не удалось запинить proc-macro2. Попробуй: cargo update -p proc-macro2 --precise 1.0.94"
    exit 1
  }
  echo "Запинено: $(awk '/^name = "proc-macro2"$/{f=1;next} f&&/^version/{gsub(/"/,"",$3); print $3; exit}' Cargo.lock)"
else
  echo "Уже 1.0.94 — ок"
fi

echo ""
echo "== Сборка программ (без IDL) =="
# --no-idl пропускает хостовую сборку IDL, которая ломается из-за proc-macro2/anchor-syn
# Это блокирующий гейт в CI тоже (.github/workflows/ci.yml: Anchor build --no-idl)
anchor build --no-idl --skip-lint || anchor build --no-idl

echo ""
echo "== Сидим IDL из коммитов =="
node scripts/ensure-idl.mjs 2>/dev/null || node scripts/ensure-idl.js 2>/dev/null || echo "⚠️ ensure-idl не найден, но продолжаем"

echo ""
echo "== Проверяем кошелёк для Anchor =="
WALLET="solana/keys/aof-authority-devnet.json"
if [ ! -f "$WALLET" ]; then
  echo "Кошелёк $WALLET не найден — создаю throwaway..."
  mkdir -p "$(dirname "$WALLET")"
  if command -v solana-keygen >/dev/null 2>&1; then
    solana-keygen new --silent --no-bip39-passphrase --force -o "$WALLET"
    echo "Создан: $WALLET"
    solana airdrop 100 --url localhost 2>/dev/null || true
  else
    echo "❌ solana-keygen не найден. Поставь Agave и запусти:"
    echo "   solana-keygen new --no-bip39-passphrase -o $WALLET"
  fi
else
  echo "Кошелёк есть: $WALLET"
fi

echo ""
echo "✅ Готово!"
echo "   Бинарники: target/deploy/*.so"
echo "   IDL: target/idl/*.json (скопированы из aof_backend/src/idl/)"
echo "   Wallet: $WALLET"
echo ""
echo "Для прогона тестов:"
echo "  # 1. Запусти валидатор в отдельном терминале, если ещё не запущен:"
echo "  solana-test-validator --reset"
echo "  # 2. В другом терминале:"
echo "  anchor test --skip-build"
echo "  # или напрямую (нужен ANCHOR_PROVIDER_URL):"
echo "  export ANCHOR_PROVIDER_URL=http://127.0.0.1:8899"
echo "  export ANCHOR_WALLET=$WALLET"
echo "  npx tsx node_modules/mocha/bin/mocha.js -t 1000000 tests/aof_core.ts"
