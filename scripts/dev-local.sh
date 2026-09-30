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
#   bash scripts/dev-local.sh clean     # уборка: target/, dist/, .anchor, кэши сборки (CLEAN_DEEP=1 — ещё и node_modules)
#   bash scripts/dev-local.sh keys      # ключи программ: показать адреса и переписать их везде (--apply; PROGRAMS=...)
#   bash scripts/dev-local.sh install   # npm ci во frontend/ и aof_backend/
#   bash scripts/dev-local.sh test      # тесты без валидатора: frontend + readiness + os + backend self-tests
#   bash scripts/dev-local.sh build     # сборка: frontend (tsc + vite build), backend (prisma generate + tsc)
#   bash scripts/dev-local.sh up        # поднять backend :8080 и frontend :3000 (Ctrl+C гасит оба) — тестовый запуск
#   WITH_SERVICES=1 bash scripts/dev-local.sh up
#                                       # + фоновые сервисы, без которых половина витрин «неизвестно»:
#                                       #   chain-indexer (история/квесты/рынок, health :8082),
#                                       #   indexer (тики и свечи цен, WS :8081), trust-worker,
#                                       #   farm-trader, price-cranker. Выбор: SERVICES=chain-indexer,...
#                                       #   Сервисы делят .env и БД с backend, поэтому SKIP_BACKEND=1 их не поднимает.
#   bash scripts/dev-local.sh devnet    # всё до девнета: keys → install → test → build(anchor) → deploy+включение → отчёт
#                                       #   без --apply это безопасный сухой прогон; с --apply деплоит и включает
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
#   SERVICES=chain-indexer,indexer,trust-worker,farm-trader,price-cranker — что поднимает WITH_SERVICES=1
#   PROGRAMS=aof_core,aof_market,aof_session_keys — какие программы получают новые ключи в `keys`/`devnet`
#   Without keys нельзя создать программу по объявленному адресу; смена адреса переписывает
#   declare_id!, Anchor.toml, реестр, IDL, watchtower и клиентов одной командой (scripts/rotate-program-ids.mjs).

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
# Фоновые сервисы backend («нужен индексатор»): по умолчанию выключены, потому
# что это ещё пять процессов на машине разработчика. Включаются осознанно:
#   WITH_SERVICES=1 bash scripts/dev-local.sh up
WITH_SERVICES="${WITH_SERVICES:-0}"
SERVICES="${SERVICES:-chain-indexer,indexer,trust-worker,farm-trader,price-cranker}"
SERVICE_WAIT="${SERVICE_WAIT:-8}"   # сколько ждать старта сервисов перед проверкой живости
# Канонический program id aof_core читается из реестра, а не хранится копией:
# после смены адресов (scripts/rotate-program-ids.mjs) копия молча уводит
# backend на программу, которой в сети нет.
# APPLY=1 — выполнять необратимые шаги (деплой на девнет). По умолчанию сухой прогон.
APPLY=0
for arg in "$@"; do [ "$arg" = "--apply" ] && APPLY=1; done
PROGRAMS="${PROGRAMS:-}"

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

# Адрес программы из единственного источника истины — security/program-registry.json.
registry_address() { # имя программы
  local name=$1 value=""
  value="$(node -e '
    const fs=require("fs");
    const r=JSON.parse(fs.readFileSync("security/program-registry.json","utf8"));
    const p=r.programs.find(x=>x.name===process.argv[1]);
    if(!p||!p.address) process.exit(1);
    process.stdout.write(p.address);
  ' "$name" 2>/dev/null || true)"
  if [ -z "$value" ] && command -v python3 >/dev/null 2>&1; then
    value="$(python3 -c '
import json,sys
r=json.load(open("security/program-registry.json"))
p=next((x for x in r["programs"] if x["name"]==sys.argv[1]), None)
print(p["address"] if p and p.get("address") else "", end="")
' "$name" 2>/dev/null || true)"
  fi
  [ -n "$value" ] || die "в security/program-registry.json нет адреса для $name"
  printf '%s' "$value"
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

# watchtower/ своих зависимостей не имеет и живёт на aof_backend/node_modules (NODE_PATH).
# Но Node ищет модули сначала вверх по дереву: если в КОРНЕ репо лежит старый node_modules
# (например, от прежней CRA-сборки — ajv@6 вместо ajv@8), test:watchtower падает с
# "Cannot read properties of undefined (reading 'code')" в ajv-formats.
# Симлинк watchtower/node_modules -> ../aof_backend/node_modules закрывает вопрос
# (он предусмотрен в .gitignore).
ensure_watchtower_link() {
  local link="$ROOT/watchtower/node_modules"
  [ -d "$ROOT/watchtower" ] || return 0
  if [ -L "$link" ]; then
    [ -e "$link" ] && return 0
    rm -f "$link"   # битый симлинк
  elif [ -e "$link" ]; then
    warn "watchtower/node_modules — настоящая папка, а не симлинк на ../aof_backend/node_modules; при проблемах с ajv удали её"
    return 0
  fi
  ln -s ../aof_backend/node_modules "$link"
  echo "watchtower/node_modules -> ../aof_backend/node_modules (симлинк создан)"
}

ensure_deps() {
  [ "$SKIP_FRONTEND" = "1" ] || ensure_deps_in "$FE" "frontend/"
  if [ "$SKIP_BACKEND" != "1" ]; then
    ensure_deps_in "$BE" "aof_backend/"
    ensure_watchtower_link
  fi
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
PROGRAM_ID=$(registry_address aof_core)
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
  if ! anchor_available; then
    [ "$APPLY" = 1 ] && die "WITH_ANCHOR=1, но anchor/cargo не найдены (см. docs/BUILD_TROUBLESHOOTING.md)"
    warn "anchor/cargo не найдены — on-chain тесты пропущены (сухой прогон)"; return 0
  fi
  log "on-chain: cargo test --workspace --lib (unit-тесты программ, без валидатора)"
  (cd "$ROOT" && cargo test --workspace --lib)
  log "on-chain: anchor test --skip-build (поднимет solana-test-validator, ~2 мин)"
  (cd "$ROOT" && make test)
}

cmd_anchor_build() {
  if ! anchor_available; then
    [ "$APPLY" = 1 ] && die "WITH_ANCHOR=1, но anchor/cargo не найдены (см. docs/BUILD_TROUBLESHOOTING.md)"
    warn "anchor/cargo не найдены — on-chain сборка пропущена (сухой прогон)"; return 0
  fi
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
  ensure_watchtower_link
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
             test:resource-registry test:security-invariants test:session-keystore test:fraud-hold test:vrf test:vrf-settlement test:read-cache \
             test:idempotency-db test:append-only-db; do
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

# Сервис -> npm-скрипт в aof_backend и, если есть, порт для проверки живости.
# Скрипт, порт и назначение держим в одном месте: tests/readiness/bringup-entrypoints.test.cjs
# сверяет их с aof_backend/package.json, чтобы переименованный скрипт не превратился
# в тихо не запускающийся сервис.
service_script() { # имя сервиса -> npm-скрипт
  case "$1" in
    chain-indexer) echo chain-indexer ;;
    indexer)       echo indexer ;;
    trust-worker)  echo trust-worker ;;
    farm-trader)   echo farm-trader ;;
    price-cranker) echo price-cranker ;;
    push-worker)   echo push-worker ;;
    *)             echo "" ;;
  esac
}

service_port() { # имя сервиса -> порт (пусто, если сервис не слушает порт)
  case "$1" in
    chain-indexer) echo "${INDEXER_HEALTH_PORT:-8082}" ;;
    indexer)       echo "${WS_PORT:-8081}" ;;
    *)             echo "" ;;
  esac
}

service_role() { # имя сервиса -> зачем он нужен игроку
  case "$1" in
    chain-indexer) echo "история, квесты, сделки и рынок читаются из БД" ;;
    indexer)       echo "графики цен: тики и свечи хот-маркета" ;;
    trust-worker)  echo "траст-скор и правила для трейдеров" ;;
    farm-trader)   echo "исполнение правил автоторговли игроков" ;;
    price-cranker) echo "пересчёт цены пула (VRGDA) без застревания на пике" ;;
    push-worker)   echo "пуш-уведомления" ;;
    *)             echo "" ;;
  esac
}

# Поднимает выбранные сервисы рядом с backend и печатает, что реально живо.
# Список pid'ов поднятых сервисов — глобальный, а не nameref: на macOS
# /bin/bash 3.2 не умеет `local -n`, и скрипт там обязан работать.
SVC_PIDS=()
start_services() {
  local logs="$BE/data/logs" name script port log pid dead=0 entry started=() started_pids=()
  mkdir -p "$logs"
  IFS=',' read -r -a requested <<< "$SERVICES"
  for name in "${requested[@]}"; do
    name="$(printf '%s' "$name" | tr -d '[:space:]')"
    [ -n "$name" ] || continue
    script="$(service_script "$name")"
    if [ -z "$script" ]; then
      warn "неизвестный сервис '$name' — пропускаю (известные: chain-indexer,indexer,trust-worker,farm-trader,price-cranker,push-worker)"
      continue
    fi
    log="logs/$name.log"
    # `exec` важен дважды: без него подшелл держит унаследованные fd и
    # процессы, которые запустили скрипт (тесты, `npm run`, CI-шаг), ждут
    # закрытия пайпа ещё долго после старта сервиса. С `exec` в фоне живёт ровно
    # сервис, и kill_tree гасит его вместе с детьми.
    (cd "$BE" && exec npm run -s "$script" >"data/$log" 2>&1) &
    pid=$!; SVC_PIDS+=("$pid")
    started+=("$name")
    # Bash 3.2 (macOS) не знает ассоциативных массивов, поэтому пары «имя:pid»
    # держим в обычном массиве: так живость проверяется по своему pid, а не
    # поиском по `ps` (его вывод отличается между Linux и macOS).
    started_pids+=("$name:$pid")
  done
  [ "${#started[@]}" -gt 0 ] || return 0
  # Сервисы стартуют не мгновенно (ts-node компилирует), поэтому сначала даём
  # им время, а потом проверяем каждый: упавший — это не «поднялось».
  sleep "${SERVICE_WAIT:-8}"
  for entry in "${started_pids[@]}"; do
    name="${entry%%:*}"; pid="${entry##*:}"
    log="$logs/$name.log"
    port="$(service_port "$name")"
    if { [ -n "$port" ] && http_ok "http://127.0.0.1:$port/health"; } || { [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; }; then
      printf '   ✓ %-14s %s\n' "$name" "$(service_role "$name")"
    else
      dead=$((dead + 1))
      warn "сервис $name не поднялся — последние строки $log:"
      tail -n 5 "$log" 2>/dev/null | sed 's/^/      /' >&2 || true
    fi
  done
  [ "$dead" -eq 0 ] || warn "$dead сервис(ов) не поднялось: игра будет работать, но часть витрин останется «неизвестно». Логи: aof_backend/data/logs/*.log"
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

  if [ "$WITH_SERVICES" = "1" ]; then
    if [ "$SKIP_BACKEND" = "1" ]; then
      warn "WITH_SERVICES=1 игнорируется при SKIP_BACKEND=1: сервисы делят .env и БД с backend"
    else
      log "фоновые сервисы: $SERVICES"
      start_services
      for pid in ${SVC_PIDS[@]+"${SVC_PIDS[@]}"}; do pids+=("$pid"); done
    fi
  fi

  cat <<EOF

  ┌──────────────────────────────────────────────────────────┐
  │  сайт : http://localhost:$FRONTEND_PORT/site
  │  игра : http://localhost:$FRONTEND_PORT/
  │  API  : http://localhost:$BACKEND_PORT/health   (/ready — БД + RPC)
  │  Ctrl+C — остановить всё
  └──────────────────────────────────────────────────────────┘
EOF
  if [ "$WITH_SERVICES" != "1" ]; then
    cat <<EOF

  Часть витрин (история, квесты, графики цен, траст) читает БД, которую
  наполняют фоновые сервисы. Поднять их вместе с игрой:

      WITH_SERVICES=1 bash scripts/dev-local.sh up

EOF
  fi
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

# ---------------------------------------------------------------------------
# Уборка. Ключи (solana/keys, target/deploy/*-keypair.json) и .env не трогаем:
# их потеря — это потеря возможности задеплоить и поднять backend.
# ---------------------------------------------------------------------------
cmd_clean() {
  log "Уборка артефактов сборки"
  local targets=(
    "$ROOT/target" "$ROOT/.anchor" "$ROOT/test-ledger"
    "$FE/dist" "$FE/dist-storybook" "$BE/dist" "$ROOT/src/os/dist"
  )
  local t
  for t in "${targets[@]}"; do
    [ -e "$t" ] || continue
    rm -rf "$t"
    echo "  удалено: ${t#$ROOT/}"
  done
  find "$ROOT" -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete 2>/dev/null || true
  find "$ROOT" -name 'npm-debug.log*' -maxdepth 3 -delete 2>/dev/null || true
  if [ "${CLEAN_DEEP:-0}" = "1" ]; then
    log "CLEAN_DEEP=1 — удаляю node_modules (следующий install поставит заново)"
    rm -rf "$FE/node_modules" "$BE/node_modules" "$ROOT/node_modules"
    [ -L "$ROOT/watchtower/node_modules" ] && rm -f "$ROOT/watchtower/node_modules"
  fi
  log "Готово. Ключи программ и .env на месте:"
  ls -1 "$ROOT/solana/keys" 2>/dev/null | sed 's/^/  solana\/keys\//' || true
  ls -1 "$ROOT/target/deploy"/*-keypair.json 2>/dev/null | sed "s|$ROOT/|  |" || echo "  (ключей программ пока нет: bash scripts/dev-local.sh keys)"
}

# ---------------------------------------------------------------------------
# Ключи программ. Без ключа программу по объявленному адресу создать нельзя,
# поэтому смена адреса — это не «поправить строчку», а одна операция из
# generator + перезаписи declare_id!/Anchor.toml/реестра/IDL/watchtower/клиентов.
# ---------------------------------------------------------------------------
cmd_keys() {
  need_node
  local rotate="$ROOT/scripts/rotate-program-ids.mjs"
  [ -f "$rotate" ] || die "нет $rotate"
  if [ "$APPLY" != "1" ]; then
    log "Ключи программ: состояние (перезапись — с --apply)"
    node "$rotate" --check || die "адреса расходятся; исправляется так: PROGRAMS=aof_core bash scripts/dev-local.sh keys --apply"
    return 0
  fi
  [ -n "$PROGRAMS" ] || die "нужен список программ: PROGRAMS=aof_core,aof_market,aof_session_keys bash scripts/dev-local.sh keys --apply
   Меняйте только те программы, которых в сети нет или чьи ключи потеряны: у уже задеплоенной программы адрес менять нельзя."
  log "Ключи программ: генерирую отсутствующие и переписываю адреса — $PROGRAMS"
  node "$rotate" --generate "$PROGRAMS" --apply || die "смена адресов не прошла (см. вывод выше)"
  log "Адреса после смены:"
  node "$rotate" --plan
}

# ---------------------------------------------------------------------------
# Девнет одной командой: ключи -> install -> тесты -> сборка -> деплой+включение -> отчёт.
# Без --apply ничего не меняет в сети (devnet-bringup.sh сам по умолчанию dry-run).
# ---------------------------------------------------------------------------
cmd_devnet() {
  local started=$SECONDS
  need_node
  command -v git >/dev/null 2>&1 || die "git не найден"
  [ "${AOF_DEPLOY_TARGET:-devnet}" = "devnet" ] || die "AOF_DEPLOY_TARGET=$AOF_DEPLOY_TARGET: этим путём деплоится только devnet"
  if ! command -v solana >/dev/null 2>&1; then
    # Сухой прогон должен показывать план и без установленного Solana CLI;
    # отказ уместен только там, где без CLI действительно нельзя (--apply).
    [ "$APPLY" = 1 ] && die "нет solana CLI — деплой без него невозможен (docs/BUILD_TROUBLESHOOTING.md)"
    warn "нет solana CLI: шаг деплоя в сухом прогоне пропускаю (для --apply он обязателен)"
    SKIP_DEPLOY=1
  fi

  if [ "${SKIP_SYNC:-0}" = "1" ]; then
    warn "SKIP_SYNC=1 — GitHub не опрашиваю"
  else
    cmd_sync
  fi
  if [ "$APPLY" = "1" ] && [ -n "$PROGRAMS" ]; then
    cmd_keys || die "ключи/адреса не в порядке — до деплоя это не «мелочь»"
  elif [ "$APPLY" = "1" ]; then
    node "$ROOT/scripts/rotate-program-ids.mjs" --check || die "адреса расходятся: сначала PROGRAMS=... bash scripts/dev-local.sh keys --apply"
  fi
  cmd_install
  cmd_test
  WITH_ANCHOR=1 cmd_build

  if [ "${SKIP_DEPLOY:-0}" = "1" ]; then
    warn "SKIP_DEPLOY=1 — деплой пропущен"
  elif [ "$APPLY" = "1" ]; then
    log "Девнет: деплой и включение (devnet-bringup.sh --apply)"
    AOF_DEPLOY_TARGET=devnet RPC_URL="$RPC_URL" scripts/devnet-bringup.sh --apply \
      || die "включение девнета не прошло — причина в выводе выше (скрипт fail-closed)"
  else
    log "Девнет: сухой прогон (ничего не деплоится и не включается)"
    AOF_DEPLOY_TARGET=devnet RPC_URL="$RPC_URL" scripts/devnet-bringup.sh \
      || die "сухой прогон нашёл проблему — исправьте до запуска с --apply"
  fi

  log "Итог за $((SECONDS - started)) c"
  python3 "$ROOT/scripts/devnet-program-probe.py" "${RPC_URL}" || true
  cat <<EOF
  Дальше:
    запуск игры и сайта локально : bash scripts/dev-local.sh up
    повтор без сборки           : SKIP=build AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply
EOF
}

cmd_all() {
  cmd_check
  cmd_up
}

usage() {
  awk 'NR>1 && /^set -euo pipefail/ {exit} NR>1 {sub(/^# ?/, ""); print}' "${BASH_SOURCE[0]}"
}

COMMAND="${1:-}"; shift || true
case "$COMMAND" in
  check)   cmd_check ;;
  sync)    cmd_sync ;;
  clean)   cmd_clean ;;
  keys)    cmd_keys ;;
  install) cmd_install ;;
  test)    cmd_test ;;
  build)   cmd_build ;;
  up)      cmd_up ;;
  devnet)  cmd_devnet ;;
  all)     cmd_all ;;
  -h|--help|help|"") usage ;;
  *) die "неизвестная команда: $COMMAND (check|sync|clean|keys|install|test|build|up|devnet|all)" ;;
esac
