#!/usr/bin/env bash
# =============================================================================
# release.sh — полный цикл релиза on-chain контрактов AOF / NeuroForge
# Проект: ~/LeoGamesStudio/aof
#
# Использование:
#   ./release.sh                # обновление + сборка + все тесты (без деплоя)
#   ./release.sh devnet         # всё выше + деплой на devnet + верификация
#   ./release.sh localnet       # всё выше + деплой на локальный валидатор
#   ./release.sh mainnet        # деплой на mainnet-beta (см. NO-GO ниже!)
#
# Опции:
#   --skip-tests                # пропустить тесты (НЕ использовать для прода)
#   --no-pull                   # не делать git pull
#   --help                      # эта справка
#
# ⚠️ MAINNET: docs/PRODUCTION_CHECKLIST.md — статус "NO-GO".
#    Деплой на mainnet требует ключ --i-understand-nogo:
#      ./release.sh mainnet --i-understand-nogo
#
# Запрещено (CLAUDE.md): cargo build --features idl-build, anchor clean,
# даунгрейды тулчейна, файлы rust-toolchain в репо.
# Деплой ТОЛЬКО через `solana program deploy` (anchor deploy глючит).
# =============================================================================
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
REPO_DIR="$(pwd)"

# ---------- аргументы ----------
CLUSTER=""
SKIP_TESTS=0
NO_PULL=0
NOGO_OK=0
for arg in "$@"; do
  case "$arg" in
    devnet|mainnet|localnet) CLUSTER="$arg" ;;
    --skip-tests)            SKIP_TESTS=1 ;;
    --no-pull)               NO_PULL=1 ;;
    --i-understand-nogo)     NOGO_OK=1 ;;
    --help|-h)
      # portable sed (macOS BSD sed не понимает \?)
      sed -n '2,23p' "$0" | sed -e 's/^#//' -e 's/^ //'
      exit 0 ;;
    *)
      echo "❌ Неизвестный аргумент: $arg (см. --help)" >&2
      exit 2 ;;
  esac
done
CLUSTER="${CLUSTER:-none}"

# ---------- цвета и логи ----------
if [ -t 1 ]; then
  RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; BLU=$'\033[34m'; RST=$'\033[0m'
else
  RED=""; GRN=""; YLW=""; BLU=""; RST=""
fi
STEP=0
step()  { STEP=$((STEP+1)); echo; echo "${BLU}━━ [${STEP}] $* ${RST}"; }
ok()     { echo "${GRN}✅ $*${RST}"; }
warn()   { echo "${YLW}⚠️  $*${RST}"; }
die()    { echo "${RED}❌ $*${RST}" >&2; exit 1; }

# ---------- 0. PATH / окружение ----------
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Кошелёк-плательщик/authority (gitignored, должен быть перенесён с бэкапа)
WALLET="${AUTHORITY_KEY:-solana/keys/aof-authority-devnet.json}"

# Все программы workspace (имена = из Anchor.toml → target/deploy/<name>.so)
PROGRAMS=(aof_core aof_liquidity aof_rebirth aof_quests aof_market aof_session_keys)

# ID программ из Anchor.toml (сверка keypair ↔ declare_id).
# NB: не declare -A: на macOS системный bash 3.2 не поддерживает
# ассоциативные массивы (ошибка "unbound variable" на строке declare).
expected_id() {
  case "$1" in
    aof_core)         echo "HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq" ;;
    aof_liquidity)    echo "Gvbo9wDEW6kCzzhjk3stEcZoVtcScbN8mGv9SNwTUJLv" ;;
    aof_rebirth)      echo "4rMWC1h9mt6JTfBsUPYLMCydPED4e31cffmix5nZyuRb" ;;
    aof_quests)       echo "4fNKhVw2nErWZBBw9hgWD3Metu1UKbDLdhFGWbCewdLU" ;;
    aof_market)       echo "4BhD6spJHdvHQ9mgyaU6AUSLU37oJbTMCDcAXyWhMRVo" ;;
    aof_session_keys) echo "6ZnnyKkv1kUE4AJqi5uwdh5ZX6VFGfbQiwhGSkfqZ9K5" ;;
    *) echo "unknown program: $1" >&2; return 1 ;;
  esac
}

case "$CLUSTER" in
  devnet)     RPC_URL="https://api.devnet.solana.com" ;;
  mainnet)    RPC_URL="https://api.mainnet-beta.solana.com" ;;
  localnet)   RPC_URL="http://127.0.0.1:8899" ;;
  none)       RPC_URL="" ;;
  *) die "неизвестный кластер: $CLUSTER" ;;
esac

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AOF release pipeline"
echo "  папка:    $REPO_DIR"
echo "  кластер:  $CLUSTER"
echo "  тесты:    $([ $SKIP_TESTS -eq 1 ] && echo 'ПРОПУСК (--skip-tests)' || echo 'полный прогон')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ---------- 0.5 NO-GO guard для mainnet ----------
if [ "$CLUSTER" = "mainnet" ]; then
  if [ $NOGO_OK -ne 1 ]; then
    die "MAINNET = NO-GO по docs/PRODUCTION_CHECKLIST.md.
Если release gates закрыты и ты подтверждаешь — повтори:
  ./release.sh mainnet --i-understand-nogo"
  fi
  if ! grep -q '^\[programs\.mainnet\]' Anchor.toml; then
    die "В Anchor.toml нет секции [programs.mainnet] — добавь её (те же ID, что и в devnet) перед mainnet-деплоем."
  fi
  warn "MAINNET-деплой подтверждён флагом --i-understand-nogo."
fi

# ---------- 1. Обновление репозитория ----------
step "Обновление локальной папки проекта (git)"
if [ $NO_PULL -eq 1 ]; then
  warn "git pull пропущен (--no-pull)"
else
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "ветка: $BRANCH"
  git fetch origin
  # pull только если upstream настроен; иначе не мешаем (arena-ветки и т.п.)
  if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git pull --ff-only
    ok "репозиторий обновлён: $(git log -1 --oneline)"
  else
    warn "у ветки $BRANCH нет upstream — pull пропущен"
  fi
fi

# ---------- 2. Проверка тулчейна ----------
step "Проверка тулчейна (пины: Agave 4.2.1 / Anchor 0.30.1 / rustc 1.89.0)"
command -v solana      >/dev/null || die "solana CLI не найден в PATH"
command -v anchor      >/dev/null || die "anchor не найден в PATH"
command -v rustc       >/dev/null || die "rustc не найден в PATH"
command -v cargo       >/dev/null || die "cargo не найден в PATH"
command -v node        >/dev/null || die "node не найден в PATH"
command -v python3     >/dev/null || die "python3 не найден в PATH"

echo "  solana: $(solana --version)"
echo "  anchor: $(anchor --version)"
echo "  rustc:  $(rustc --version)"
echo "  node:   $(node -v)"

solana --version | grep -q "4.2.1" || warn "ожидался Solana/Agave 4.2.1"
anchor --version | grep -q "0.30.1" || warn "ожидался Anchor 0.30.1"
rustc --version  | grep -q "1.89.0" || warn "ожидался rustc 1.89.0"
ok "тулчейн на месте"

# ---------- 3. Зависимости ----------
step "Установка JS-зависимостей (npm ci)"
npm ci
(cd aof_backend && npm ci)
(cd frontend && npm ci)
ok "зависимости установлены"

# ---------- 4. Сборка контрактов ----------
step "Сборка on-chain программ (anchor build)"
# запрещено: cargo build --features idl-build, anchor clean
anchor build
for p in "${PROGRAMS[@]}"; do
  [ -f "target/deploy/${p}.so" ] || die "нет артефакта target/deploy/${p}.so"
done
ok "собрано ${#PROGRAMS[@]} программ (.so в target/deploy/)"

# ---------- 4b. Проверка keypair'ов программ ----------
step "Сверка keypair'ов программ с Anchor.toml / declare_id!"
MISSING_KP=0
for p in "${PROGRAMS[@]}"; do
  kp="target/deploy/${p}-keypair.json"
  if [ ! -f "$kp" ]; then
    warn "нет $kp — anchor build сгенерирует НОВЫЙ id (не апгрейд!)"
    MISSING_KP=1
    continue
  fi
  actual="$(solana-keygen pubkey "$kp")"
  expected="$(expected_id "$p")"
  if [ "$actual" != "$expected" ]; then
    warn "$p: keypair=$actual, ожидается $expected — ID DRIFT!"
    MISSING_KP=1
  else
    echo "  ✓ $p → $actual"
  fi
done
if [ $MISSING_KP -eq 1 ]; then
  if [ "$CLUSTER" != "none" ] && [ "$CLUSTER" != "localnet" ]; then
    die "keypair'ы программ не совпадают. Восстанови target/deploy/*-keypair.json из secure-бэкапа перед деплоем на $CLUSTER.
(В git они не входят: .gitignore → **/*-keypair.json, target/)"
  fi
  warn "keypair'ы неполные — для localnet продолжаем (anchor test подставит свои)"
fi
ok "ID программ сверены"

# Wallet для деплоя/anchor test
if [ ! -f "$WALLET" ]; then
  warn "нет $WALLET — генерирую новый (ТОЛЬКО для devnet/localnet!)"
  mkdir -p "$(dirname "$WALLET")"
  solana-keygen new --no-bip39-passphrase -o "$WALLET" --force
fi
echo "  wallet: $WALLET → $(solana-keygen pubkey "$WALLET")"

# ---------- 5. Тесты ----------
if [ $SKIP_TESTS -eq 1 ]; then
  warn "--skip-tests: полный прогон тестов ПРОПУЩЕН (недопустимо для релиза)"
else
  step "Rust unit-тесты"
  cargo test --locked -p aof-core -p aof-liquidity --lib
  ok "cargo test"

  step "Статические проверки безопасности / IDL"
  python3 scripts/check-idl-drift.py
  python3 scripts/check-mint-writable.py
  python3 scripts/test-mint-cost-model.py
  python3 scripts/test-reward-migrations.py
  python3 scripts/test-idl-drift.py
  python3 scripts/test-p0-security.py
  node --test tests/readiness/*.test.cjs
  npm test --prefix src/os
  ok "статические проверки"

  step "Backend: build + тесты"
  (
    cd aof_backend
    npm run build
    npm run test:wallet-proof
    npm run test:resource-registry
    npm run test:security-invariants
    npm run test:audit-security
    npm run test:reward-receipts
    npm run test:idempotency-db
    npx tsc -p tsconfig.workers.json
  )
  ok "backend"

  step "Frontend: security-тесты + сборка"
  (cd frontend && npm run test:security && npm run build)
  ok "frontend"

  step "Интеграционные тесты контрактов (anchor test, изолированный localnet)"
  # CLAUDE.md: не запускать solana-test-validator --reset вручную —
  # anchor test сам поднимает и опускает валидатор.
  anchor test
  ok "anchor test"
fi

# ---------- 6. Деплой ----------
if [ "$CLUSTER" = "none" ]; then
  step "Деплой: пропущен (запусти ./release.sh devnet | localnet | mainnet)"
else
  step "Деплой контрактов → $CLUSTER ($RPC_URL)"
  [ $SKIP_TESTS -eq 1 ] && warn "деплой без тестов!"

  # бэкап текущего байткода перед апгрейдом (rollback-план)
  BACKUP_DIR="backup/$(date +%Y%m%d-%H%M%S)-$CLUSTER"
  mkdir -p "$BACKUP_DIR"
  for p in "${PROGRAMS[@]}"; do
    pid="$(expected_id "$p")"
    if solana program show "$pid" --url "$RPC_URL" >/dev/null 2>&1; then
      echo "  dump текущего $p ($pid) → $BACKUP_DIR/"
      solana program dump "$pid" "$BACKUP_DIR/${p}.so" --url "$RPC_URL" >/dev/null
    fi
  done
  ok "бэкап on-chain бинарей: $BACKUP_DIR (откат: solana program deploy --program-id <kp> $BACKUP_DIR/<p>.so --url $RPC_URL)"

  for p in "${PROGRAMS[@]}"; do
    kp="target/deploy/${p}-keypair.json"
    so="target/deploy/${p}.so"
    [ -f "$kp" ] || die "нет keypair $kp — деплой остановлен"
    actual="$(solana-keygen pubkey "$kp")"
    exp_id="$(expected_id "$p")"
    [ "$actual" = "$exp_id" ] || die "$p: keypair ($actual) != Anchor.toml ($exp_id)"
    echo "  → деплой $p ($actual)"
    solana --url "$RPC_URL" --keypair "$WALLET" program deploy \
      --program-id "$kp" \
      "$so"
  done
  ok "все ${#PROGRAMS[@]} программ задеплоены на $CLUSTER"

  step "Верификация on-chain (scripts/verify-programs.sh)"
  # сверяет: существует, executable, upgrade authority, declare_id, sha256 .so ↔ chain
  scripts/verify-programs.sh "$CLUSTER"
  ok "верификация пройдена"
fi

# ---------- Итог ----------
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "${GRN} РЕЛИЗ-ПАЙПЛАЙН ЗАВЕРШЁН${RST}"
echo "  кластер: $CLUSTER"
echo "  шагов:   $STEP"
if [ "$CLUSTER" = "mainnet" ]; then
  echo "  ${YLW}Mainnet: проверь set_paused, caps, мониторинг (см. docs/PRODUCTION_DEPLOYMENT.md)${RST}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
