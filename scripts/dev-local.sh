#!/usr/bin/env bash
# Локальный web-стек NeuroForge / AOF одной командой.
#
#   сайт  -> http://localhost:3000/site   (frontend/src/site — Vite)
#   игра  -> http://localhost:3000/       (frontend/src/App.tsx — Vite)
#   API   -> http://localhost:8080        (aof_backend — Express + Prisma/SQLite)
#
# Vite проксирует /api -> backend (frontend/vite.config.ts), поэтому в браузере
# сайт, игра и API живут на одном origin.
#
# Использование:
#   bash scripts/dev-local.sh check     # ОДНОЙ КОМАНДОЙ: sync (свежие файлы и фото с GitHub) + install + test + build
#   bash scripts/dev-local.sh sync      # git fetch + pull --ff-only + merge origin/main (+ git lfs pull, если есть)
#   bash scripts/dev-local.sh install   # npm ci во frontend/ и aof_backend/
#   bash scripts/dev-local.sh test      # тесты без валидатора: frontend + readiness + os + backend self-tests
#   bash scripts/dev-local.sh build     # сборка: frontend (tsc + vite build), backend (prisma generate + tsc)
#   bash scripts/dev-local.sh up        # поднять backend :8080 и frontend :3000 (Ctrl+C гасит оба)
#   bash scripts/dev-local.sh all       # check + up
#
# Переменные окружения:
#   FRONTEND_PORT=3000  BACKEND_PORT=8080  RPC_URL=https://api.devnet.solana.com
#   SYNC_BASE=main   — какую ветку GitHub вливать при sync (по умолчанию main)
#   SKIP_SYNC=1      — check без обращения к GitHub
#   SKIP_BACKEND=1   — только сайт + игра (например, нет доступа к binaries.prisma.sh)
#   SKIP_FRONTEND=1  — только API
#   WITH_ANCHOR=1    — в check/test/build добавить on-chain часть: cargo test + anchor build --no-idl + anchor test
#                      (нужны Rust 1.89 / Agave 4.2.1 / Anchor 0.30.1, см. docs/BUILD_TROUBLESHOOTING.md)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FE="$ROOT/frontend"
BE="$ROOT/aof_backend"

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
RPC_URL="${RPC_URL:-https://api.devnet.solana.com}"
SYNC_BASE="${SYNC_BASE:-main}"
SKIP_SYNC="${SKIP_SYNC:-0}"
SKIP_BACKEND="${SKIP_BACKEND:-0}"
SKIP_FRONTEND="${SKIP_FRONTEND:-0}"
WITH_ANCHOR="${WITH_ANCHOR:-0}"
# Канонический program id aof_core (Anchor.toml / aof_backend/.env.example)
PROGRAM_ID="${PROGRAM_ID:-HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq}"

log() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠️  %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31m❌ %s\033[0m\n' "$*" >&2; exit 1; }

need_node() {
  command -v node >/dev/null 2>&1 || die "node не найден (нужен Node >= 20, CI использует 20)"
  command -v npm >/dev/null 2>&1 || die "npm не найден"
  local major
  major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  [ "$major" -ge 20 ] || die "Нужен Node >= 20, сейчас $(node --version)"
}

file_sha() { node -e 'const c=require("crypto"),f=require("fs");console.log(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex"))' "$1"; }

# npm ci, если node_modules нет или package-lock.json изменился с прошлой установки
# (после sync с GitHub lock-файл часто обновляется — старые node_modules ломают сборку).
ensure_deps_in() { # dir label
  local dir=$1 label=$2 stamp="$1/node_modules/.dev-local.lock-sha" want have=""
  want="$(file_sha "$dir/package-lock.json")"
  [ -f "$stamp" ] && have="$(cat "$stamp")"
  if [ ! -d "$dir/node_modules" ] || [ "$want" != "$have" ]; then
    log "npm ci $label"
    (cd "$dir" && npm ci --no-audit --no-fund)
    printf '%s\n' "$want" >"$stamp"
  fi
}

ensure_deps() {
  [ "$SKIP_FRONTEND" = "1" ] || ensure_deps_in "$FE" "frontend/"
  [ "$SKIP_BACKEND" = "1" ] || ensure_deps_in "$BE" "aof_backend/"
}

rand_hex() { node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'; }

http_ok() { # url
  if command -v curl >/dev/null 2>&1; then
    curl -sf -m 2 -o /dev/null "$1"
  else
    node -e 'fetch(process.argv[1]).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' "$1"
  fi
}

# Убить процесс вместе с потомками (npm -> node/vite/ts-node). Работает на Linux и macOS.
kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}

count_images() {
  find "$FE/public/assets" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.svg' -o -iname '*.gif' \) 2>/dev/null | wc -l | tr -d ' '
}

# ---------------------------------------------------------------------------
# aof_backend/.env — генерируется один раз, только для локальной разработки.
# Ключи throwaway (hot mode разрешён только вне production, см. src/security/authorityGate.ts).
# Файл в .gitignore и никогда не перезаписывается.
# ---------------------------------------------------------------------------
ensure_backend_env() {
  local envfile="$BE/.env"
  if [ -f "$envfile" ]; then
    echo "aof_backend/.env уже есть — не трогаю"
    return 0
  fi
  log "Создаю aof_backend/.env (dev, throwaway-ключи)"
  local keys authority_secret authority_pub treasury_pub
  keys="$(cd "$BE" && node -e '
    const { Keypair } = require("@solana/web3.js");
    const bs58 = require("bs58");
    const a = Keypair.generate(), t = Keypair.generate();
    console.log([bs58.encode(a.secretKey), a.publicKey.toBase58(), t.publicKey.toBase58()].join(" "));
  ')"
  read -r authority_secret authority_pub treasury_pub <<<"$keys"
  mkdir -p "$BE/data"
  cat >"$envfile" <<EOF
# Сгенерировано scripts/dev-local.sh для ЛОКАЛЬНОЙ разработки. Не коммитить (.gitignore).
# Смысл параметров и production-требования: aof_backend/.env.example
NODE_ENV=development
PORT=$BACKEND_PORT
LOG_LEVEL=info
EXPOSE_ERROR_STACK=true
CORS_ORIGIN=http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT

RPC_URL=$RPC_URL
PROGRAM_ID=$PROGRAM_ID
# throwaway dev authority; pubkey: $authority_pub
AUTHORITY_MODE=hot
AUTHORITY_SECRET_KEY=$authority_secret
TREASURY_PUBKEY=$treasury_pub
MINING_ENABLED=false

# SQLite рядом с бэкендом: aof_backend/data/aof-dev.db (в .gitignore)
DATABASE_URL=file:../data/aof-dev.db?connection_limit=1

ADMIN_TOKEN=$(rand_hex)
TRUST_PROXY_HOPS=0
FINGERPRINT_SALT=$(rand_hex)
WALLET_PROOF_DOMAIN=AOF_API
SESSION_KEYSTORE_DIR=../data/session-keys
SESSION_KEYSTORE_KEY=$(rand_hex)
WALLET_HASH_SALT=$(rand_hex)
BACKEND_URL=http://localhost:$BACKEND_PORT
FARM_TRADER_SIMULATION=true
EOF
  echo "authority (dev): $authority_pub"
  echo "treasury  (dev): $treasury_pub"
  echo "БД: aof_backend/data/aof-dev.db"
}

prepare_backend_db() {
  log "Prisma: generate + migrate deploy (SQLite)"
  (cd "$BE" && npm run -s prisma:generate) || die "prisma generate не прошёл. Нужен доступ к binaries.prisma.sh (или SKIP_BACKEND=1, чтобы поднять только сайт+игру)"
  (cd "$BE" && npm run -s prisma:migrate:deploy)
}

# ---------------------------------------------------------------------------
# On-chain часть (опционально, WITH_ANCHOR=1): переиспользует существующие скрипты репо.
# ---------------------------------------------------------------------------
anchor_available() { command -v anchor >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; }

anchor_hint() {
  if [ "$WITH_ANCHOR" != "1" ] && anchor_available; then
    warn "найдены anchor/cargo: добавь WITH_ANCHOR=1, чтобы прогнать и on-chain сборку/тесты (cargo test + anchor build --no-idl + anchor test)"
  fi
}

cmd_anchor_test() {
  anchor_available || die "WITH_ANCHOR=1, но anchor/cargo не найдены (см. docs/BUILD_TROUBLESHOOTING.md)"
  log "on-chain: cargo test --workspace --lib (unit-тесты программ, без валидатора)"
  (cd "$ROOT" && cargo test --workspace --lib)
  log "on-chain: anchor test --skip-build (поднимет solana-test-validator, ~2 мин)"
  (cd "$ROOT" && make test)
}

cmd_anchor_build() {
  anchor_available || die "WITH_ANCHOR=1, но anchor/cargo не найдены (см. docs/BUILD_TROUBLESHOOTING.md)"
  log "on-chain: bash scripts/build-local.sh (anchor build --no-idl + seed IDL)"
  (cd "$ROOT" && bash scripts/build-local.sh)
}

# ---------------------------------------------------------------------------
# Команды
# ---------------------------------------------------------------------------
cmd_sync() {
  command -v git >/dev/null 2>&1 || die "git не найден"
  git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "$ROOT — не git-репозиторий"
  local branch upstream
  branch="$(git -C "$ROOT" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  log "git fetch origin --prune (ветка: ${branch:-detached HEAD}, база: origin/$SYNC_BASE)"
  git -C "$ROOT" fetch origin --prune --tags || die "git fetch не удался — проверь сеть/доступ к GitHub"
  git -C "$ROOT" rev-parse --verify --quiet "origin/$SYNC_BASE" >/dev/null || die "origin/$SYNC_BASE не найден (SYNC_BASE=$SYNC_BASE)"
  if [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ]; then
    warn "есть незакоммиченные изменения: git не даст их затереть, но при конфликте sync остановится — тогда закоммить или git stash"
  fi
  if [ -z "$branch" ]; then
    warn "detached HEAD — pull/merge пропускаю, только fetch"
  else
    if upstream="$(git -C "$ROOT" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
      log "git pull --ff-only ($branch <- $upstream)"
      git -C "$ROOT" pull --ff-only || die "ветка $branch разошлась с $upstream — разбери вручную (git pull --rebase или merge)"
    fi
    if [ "$branch" != "$SYNC_BASE" ]; then
      if git -C "$ROOT" merge-base --is-ancestor "origin/$SYNC_BASE" HEAD; then
        echo "origin/$SYNC_BASE уже полностью в $branch — сливать нечего"
      else
        log "git merge origin/$SYNC_BASE -> $branch (свежие файлы и фото из GitHub)"
        git -C "$ROOT" merge --no-edit "origin/$SYNC_BASE" \
          || die "конфликт при слиянии origin/$SYNC_BASE: разреши конфликты и git commit (или git merge --abort), затем повтори"
      fi
    fi
  fi
  # Git LFS — на случай, если бинарные ассеты когда-нибудь переедут в LFS
  if [ -f "$ROOT/.gitattributes" ] && grep -q "filter=lfs" "$ROOT/.gitattributes" 2>/dev/null; then
    if git lfs version >/dev/null 2>&1; then
      log "git lfs pull"; git -C "$ROOT" lfs pull
    else
      warn "в репо настроен Git LFS, но git-lfs не установлен — картинки могут оказаться LFS-указателями"
    fi
  fi
  log "Синхронизировано: $(git -C "$ROOT" log -1 --format='%h %s (%cr)')"
  echo "картинок в frontend/public/assets: $(count_images)"
}

cmd_install() {
  need_node
  log "npm ci frontend/"; (cd "$FE" && npm ci --no-audit --no-fund) && file_sha "$FE/package-lock.json" >"$FE/node_modules/.dev-local.lock-sha"
  log "npm ci aof_backend/"; (cd "$BE" && npm ci --no-audit --no-fund) && file_sha "$BE/package-lock.json" >"$BE/node_modules/.dev-local.lock-sha"
}

cmd_test() {
  need_node; ensure_deps
  if [ "$SKIP_FRONTEND" != "1" ]; then
    log "frontend: test:security + test:aof-stylelint + lint:aof-colors"
    (cd "$FE" && npm run -s test:security && npm run -s test:aof-stylelint && npm run -s lint:aof-colors)
  fi
  log "readiness-тесты (tests/readiness) + Watchtower OS v3 (src/os)"
  (cd "$ROOT" && node --test tests/readiness/*.test.cjs)
  (cd "$ROOT/src/os" && npm test -s)
  if [ "$SKIP_BACKEND" != "1" ]; then
    log "backend self-tests (тот же набор, что в CI job 'Backend build + self-tests')"
    (cd "$BE" && npm run -s prisma:generate) || die "prisma generate не прошёл (нужен доступ к binaries.prisma.sh; для проверки только фронта — SKIP_BACKEND=1)"
    local t
    for t in test:audit-security test:admin-auth test:chain-indexer test:fraud-signals test:watchtower \
             test:wallet-proof test:wallet-proof-middleware test:authority-gate test:reward-receipts \
             test:resource-registry test:security-invariants test:session-keystore test:fraud-hold test:vrf \
             test:idempotency-db; do
      echo "--- $t ---"
      (cd "$BE" && npm run -s "$t")
    done
  fi
  if [ "$WITH_ANCHOR" = "1" ]; then cmd_anchor_test; fi
  log "Все тесты прошли"
}

cmd_build() {
  need_node; ensure_deps
  if [ "$SKIP_FRONTEND" != "1" ]; then
    log "frontend: tsc + vite build -> frontend/dist (сайт и игра в одном бандле)"
    (cd "$FE" && npm run -s build)
  fi
  if [ "$SKIP_BACKEND" != "1" ]; then
    log "backend: prisma generate + tsc -> aof_backend/dist"
    (cd "$BE" && npm run -s build) || die "сборка backend не прошла (prisma generate требует доступ к binaries.prisma.sh)"
  fi
  if [ "$WITH_ANCHOR" = "1" ]; then cmd_anchor_build; fi
  log "Сборка готова"
}

cmd_check() {
  local started=$SECONDS
  if [ "$SKIP_SYNC" = "1" ]; then
    warn "SKIP_SYNC=1 — GitHub не опрашиваю, собираю то, что лежит в папке"
  else
    cmd_sync
  fi
  need_node; ensure_deps
  cmd_test
  cmd_build
  anchor_hint
  log "check OK за $((SECONDS - started)) c"
  cat <<EOF
  commit : $(git -C "$ROOT" log -1 --format='%h %s' 2>/dev/null || echo "n/a")
  фото   : $(count_images) файлов в frontend/public/assets
  сборка : frontend/dist$([ "$SKIP_BACKEND" = "1" ] || printf ', aof_backend/dist')
  запуск : bash scripts/dev-local.sh up
EOF
}

cmd_up() {
  need_node; ensure_deps
  local pids=() be_pid="" fe_pid=""

  cleanup() {
    local rc=$?
    trap - INT TERM EXIT
    log "Останавливаю процессы"
    local p
    for p in ${pids[@]+"${pids[@]}"}; do kill_tree "$p"; done
    wait 2>/dev/null || true
    exit "$rc"
  }
  trap cleanup INT TERM EXIT

  if [ "$SKIP_BACKEND" != "1" ]; then
    ensure_backend_env
    prepare_backend_db
    log "backend: npm run dev (ts-node src/server.ts) на :$BACKEND_PORT"
    (cd "$BE" && PORT="$BACKEND_PORT" npm run -s dev) &
    be_pid=$!; pids+=("$be_pid")
    local i
    for ((i = 0; i < 120; i++)); do
      if http_ok "http://127.0.0.1:$BACKEND_PORT/health"; then break; fi
      kill -0 "$be_pid" 2>/dev/null || die "backend завершился при старте — смотри лог выше"
      sleep 1
    done
    http_ok "http://127.0.0.1:$BACKEND_PORT/health" \
      && echo "backend готов: http://localhost:$BACKEND_PORT/health" \
      || warn "backend ещё не ответил на /health — ts-node может компилировать дольше, ждём дальше"
  fi

  if [ "$SKIP_FRONTEND" != "1" ]; then
    log "frontend: vite на 0.0.0.0:$FRONTEND_PORT (proxy /api -> http://127.0.0.1:$BACKEND_PORT)"
    (cd "$FE" && VITE_DEV_BACKEND_URL="http://127.0.0.1:$BACKEND_PORT" \
      npm run -s dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort) &
    fe_pid=$!; pids+=("$fe_pid")
  fi

  cat <<EOF

  ┌──────────────────────────────────────────────────────────┐
  │  сайт : http://localhost:$FRONTEND_PORT/site
  │  игра : http://localhost:$FRONTEND_PORT/
  │  API  : http://localhost:$BACKEND_PORT/health   (/ready — БД + RPC)
  │  Ctrl+C — остановить всё
  └──────────────────────────────────────────────────────────┘

EOF
  # Держим скрипт живым, пока живы оба процесса; как только один упал — cleanup через trap.
  # (без `wait -n`: его нет в bash 3.2 на macOS)
  local p all_alive
  while :; do
    all_alive=1
    for p in ${pids[@]+"${pids[@]}"}; do kill -0 "$p" 2>/dev/null || all_alive=0; done
    [ "$all_alive" = 1 ] || { warn "один из процессов завершился — останавливаю остальные"; break; }
    sleep 1
  done
}

cmd_all() {
  cmd_check
  cmd_up
}

usage() {
  sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

case "${1:-}" in
  check)   cmd_check ;;
  sync)    cmd_sync ;;
  install) cmd_install ;;
  test)    cmd_test ;;
  build)   cmd_build ;;
  up)      cmd_up ;;
  all)     cmd_all ;;
  -h|--help|help|"") usage ;;
  *) die "неизвестная команда: $1 (check|sync|install|test|build|up|all)" ;;
esac
