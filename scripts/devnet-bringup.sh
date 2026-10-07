#!/usr/bin/env bash
# Включение девнета целиком — одной командой, в безопасном порядке.
#
# Зачем этот скрипт. Читающий зонд (scripts/devnet-program-probe.py) показал:
# по адресам aof_core, aof_market и aof_session_keys на девнете нет аккаунтов, а
# aof_core — это 120 инструкций (добыча, инструменты, ресурсы, крафт, паки,
# рынок, газ-бак, коллекционеры). Пока программ нет в сети, любая механика
# честно отвечает 503 «нет данных из сети» — переключатель этого не исправит.
# Дальше деплоя включать нечего не потому, что «нельзя», а потому что нужен
# ещё один шаг: Config, минты ресурсов, потолки выпуска, флаг добычи и
# allowlist коллекционеров. Скрипт делает их все подряд и печатает, что вышло.
#
# Это не замена проверок, а их порядок: каждый шаг идемпотентен, перед каждым
# печатается состояние, а сухой прогон (по умолчанию) вообще ничего не меняет.
#
# Использование:
#   AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh                           # сухой прогон
#   SKIP=mining AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply        # config-only phase
#     (для uncapped policy также ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 SKIP=lifetime-caps)
#   MINING_SMOKE_OK=1 AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply # full run after smoke
#
# Обязательные условия (без них выход 3 и ни одной транзакции):
#   * AOF_DEPLOY_TARGET=devnet — mainnet этим скриптом не включается; RPC обязан
#     отвечать genesis-хешем devnet;
#   * PROGRAM_MAX_LEN_POLICY=exact|headroom|legacy-2x (для headroom ещё
#     PROGRAM_MAX_LEN_HEADROOM_PERCENT=1..99) — явная ёмкость программ: без неё
#     деплой отказывает (SKIP=deploy её не требует). Подробности и стоимость:
#     docs/DEVNET_DEPLOY_COSTS.md;
#   * ключ оператора AUTHORITY_KEYPAIR (по умолчанию
#     solana/keys/aof-authority-devnet.json) и ≥ MIN_SOL SOL на нём;
#   * ключи программ target/deploy/<name>-keypair.json, чьи pubkey равны
#     объявленным адресам (иначе см. §0.1: PROGRAMS=... scripts/dev-local.sh keys --apply);
#   * solana CLI; для сборки — anchor; для шагов 5–7 — работающий backend
#     (BACKEND_URL, ADMIN_TOKEN) в hot-режиме, потому что минты и тумблер добычи
#     подписываются его ключом (AUTHORITY_SECRET_KEY). Backend проверяется ДО деплоя
#     маршрутом GET /admin/config/bootstrap-preflight, которому не нужен Config:
#     ops-токен принят, режим hot, authority backend'а == ключ оператора, program ID
#     == реестр, RPC backend'а — devnet. Любое расхождение (backend не запущен,
#     чужой сервис на порту, неверный токен, read-only, чужой authority/program ID,
#     mainnet) — отказ до первой транзакции; «любой HTTP 400» не принимается;
#   * для шага collector — COLLECTOR_MINTS="<mint>:historian,<mint>:medallion"
#     (адреса минтов инструментов, попадающих в allowlist коллекционеров);
#   * MINING_SMOKE_OK=1 для --apply, если mining не указан в SKIP; без него
#     используйте SKIP=mining и отдельный enable после smoke.
#
# Переменные окружения:
#   RPC_URL, AUTHORITY_KEYPAIR, ARTIFACTS, BACKEND_URL, ADMIN_TOKEN, MIN_SOL,
#   PROGRAM_MAX_LEN_POLICY, PROGRAM_MAX_LEN_HEADROOM_PERCENT,
#   ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 — explicitly accept uncapped Devnet lifetime issuance;
#     the flag is passed through to mining preflight/enable and cannot authorize mainnet.
#   MINING_SMOKE_OK=1 — required before --apply when mining is not in SKIP; otherwise use
#     SKIP=mining and enable separately after the signed smoke.
#   UPGRADE=all (по умолчанию) — сравнить все шесть программ и обновить каждую,
#     чей bytecode отличается от локальной сборки; после деплоя обязательный
#     scripts/verify-programs.sh --require-bytecode сверяет все шесть payload.
#     До этого gate нельзя менять watchtower/addresses.json на status=verified.
#   OPERATOR_RESERVE_SOL (по умолчанию MIN_SOL), DEPLOY_FEE_RESERVE_SOL (по умолчанию 0.1),
#   COLLECTOR_MINTS,
#   CAP_PER_EPOCH (base units; 1 unit = 1e9) — per-epoch budget for direct
#     mint_resource calls. Other reward instructions use the cumulative max_supply
#     policy; this epoch budget is not a global rate cap or a lifetime-cap substitute.
#   LIFETIME_CAP_CIRCUIT, LIFETIME_CAP_SILICON, LIFETIME_CAP_DATASET,
#   LIFETIME_CAP_NEURON — finite cumulative caps in raw SPL atoms when that policy
#     is selected; no values are guessed. For intentionally uncapped Devnet issuance,
#     pass ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 and SKIP=lifetime-caps explicitly.
#   ISSUANCE_BASELINE_FILE — optional path for the full history-scan report.
#   SKIP=build,deploy,config,mints,escrows,vrf-lut,caps,issuance-baseline,lifetime-caps,craft,mechanics,market,mining,collectors,report
#   SKIP=backend — сокращение для всех шагов, которым нужен backend по HTTP
#   ($BACKEND_STEPS см. ниже): деплой/upgrade без запуска backend и без ADMIN_TOKEN;
#   SKIP_BUILD=1 — не собирать, взять готовые .so из target/deploy.
#
#   Экономика крафта (шаг 5): CRAFT_RARITY_COUNTERS (по умолчанию 1,2,3,4) —
#   какие счётчики редкости создать вместе с CraftEconomy; SKIP=craft выключает шаг.
#
#   Паки, лотерея, сезон и реролл (шаг 6): цены и шансы берутся из канонических
#   констант aof-core (`PACK_*`, `REROLL_ODDS_BPS_DEFAULT`, `LOTTERY_*`);
#   переопределяются только номер первого сезона и раунда лотереи —
#   SEASON_ID (по умолчанию 1), LOTTERY_ROUND_ID (по умолчанию 1);
#   SKIP=mechanics выключает шаг.
#
#   Рынок инструментов (шаг 7) необязательными переменными:
#   MARKET_CORE_MINT, MARKET_GEM_MINT, MARKET_TREASURY, MARKET_FEE_BPS,
#   MARKET_POOL_RARITIES (по умолчанию 0,1,2,3), MARKET_TARGET_CORE,
#   MARKET_TARGET_GEM, MARKET_GROWTH_BPS, MARKET_DECAY_BPS.
#
# Что скрипт НЕ делает и не может: не меняет контракты. Пункты из
# docs/CONTRACT_WORK_QUEUE.md §3, которые ещё требуют работы по контракту
# (сессионные ключи, платный сезон-пропуск, MIND), скрипт печатает в конце
# ещё раз, чтобы «включено» не читалось шире, чем есть.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APPLY=0
case "${1:-}" in
  "") ;;
  --apply) APPLY=1 ;;
  *) echo "использование: $0 [--apply]" >&2; exit 2 ;;
esac
if [ $# -gt 1 ]; then echo "использование: $0 [--apply]" >&2; exit 2; fi

RPC_URL="${RPC_URL:-https://api.devnet.solana.com}"
ALLOW_UNLIMITED_DEVNET_ISSUANCE="${ALLOW_UNLIMITED_DEVNET_ISSUANCE:-0}"
MINING_SMOKE_OK="${MINING_SMOKE_OK:-0}"
AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-solana/keys/aof-authority-devnet.json}"
ARTIFACTS="${ARTIFACTS:-target/deploy}"
UPGRADE="${UPGRADE:-all}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL%/}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
MIN_SOL="${MIN_SOL:-1}"
SKIP="${SKIP:-}"
COLLECTOR_MINTS="${COLLECTOR_MINTS:-}"
PROBE="${PROBE:-scripts/devnet-program-probe.py}"
ESTIMATOR="${ESTIMATOR:-scripts/devnet-deploy-estimator.py}"
# Тот же genesis, что в aof_backend/scripts/miningDevnetPreflight.ts и scripts/verify-address-registry.cjs.
DEVNET_GENESIS_HASH="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
CRAFT_RARITY_COUNTERS="${CRAFT_RARITY_COUNTERS:-1,2,3,4}"
SEASON_ID="${SEASON_ID:-1}"
LOTTERY_ROUND_ID="${LOTTERY_ROUND_ID:-1}"
MARKET_CORE_MINT="${MARKET_CORE_MINT:-}"
MARKET_GEM_MINT="${MARKET_GEM_MINT:-}"
MARKET_TREASURY="${MARKET_TREASURY:-}"
MARKET_FEE_BPS="${MARKET_FEE_BPS:-200}"
MARKET_POOL_RARITIES="${MARKET_POOL_RARITIES:-0,1,2,3}"
MARKET_TARGET_CORE="${MARKET_TARGET_CORE:-1000000000}"
MARKET_TARGET_GEM="${MARKET_TARGET_GEM:-1000000000}"
MARKET_GROWTH_BPS="${MARKET_GROWTH_BPS:-250}"
MARKET_DECAY_BPS="${MARKET_DECAY_BPS:-100}"
API_TIMEOUT="${API_TIMEOUT:-30}"
PREFLIGHT_TIMEOUT="${PREFLIGHT_TIMEOUT:-900}"

die()  { echo >&2; echo "ОТКАЗ: $*" >&2; exit "${2:-3}"; }
step() { echo; echo "== $*"; }
ok()   { echo "   ✓ $*"; }
info() { echo "   $*"; }
# Шаги, которым нужен backend: они читают/пишут через его маршруты, а минты,
# капы и тумблер добычи подписываются ключом backend'а в hot-режиме. `config` и
# `mints`/`caps` ходят в сеть локальными скриптами, но читают тот же
# aof_backend/.env через src/config.ts, который без PROGRAM_ID/TREASURY_PUBKEY и
# authority-gate падает — поэтому «только деплой» обязан выключать и их.
# SKIP=backend — деплой/upgrade без backend, без .env и без ADMIN_TOKEN.
BACKEND_STEPS="config mints escrows vrf-lut caps issuance-baseline lifetime-caps craft mechanics market mining collectors"
skipped() { # $1 — имя шага; SKIP=backend — сокращение для всех $BACKEND_STEPS
  case ",${SKIP}," in
    *",$1,"*) return 0 ;;
    *,backend,*) case " $BACKEND_STEPS " in *" $1 "*) return 0 ;; esac ;;
  esac
  return 1
}

case "$ALLOW_UNLIMITED_DEVNET_ISSUANCE" in
  0|1) ;;
  *) die "ALLOW_UNLIMITED_DEVNET_ISSUANCE должен быть 0 или 1" ;;
esac
if [ "$ALLOW_UNLIMITED_DEVNET_ISSUANCE" = "1" ] && ! skipped lifetime-caps; then
  die "uncapped Devnet policy не применяет finite lifetime caps: используйте SKIP=lifetime-caps (никакие значения не будут угаданы или изменены)"
fi

# Broad bringup may configure many mechanics before its mining step. Require the
# operator's separate smoke sign-off before the first write when mining is part
# of this run; use SKIP=mining for the config-only phase.
if [ "$APPLY" = 1 ] && ! skipped mining; then
  [ "$MINING_SMOKE_OK" = "1" ] || die \
    "bringup не будет делать записи до smoke-gate: задайте MINING_SMOKE_OK=1 после успешного отдельного Devnet smoke или добавьте SKIP=mining"
fi

# В сухом прогоне глаголы не выполняются — печатаются как «что было бы».
do_or_tell() { # ОПИСАНИЕ КОМАНДА [АРГУМЕНТЫ...]
  local what="$1"; shift
  if [ "$APPLY" = 1 ]; then
    "$@"
  else
    echo "   сухой прогон: $what"
  fi
}

# Чтения выполняются и в сухом прогоне: их результат — часть отчёта.
api() { # METHOD PATH [BODY]
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS --max-time "$API_TIMEOUT" -X "$method" "$BACKEND_URL$path"
              -H 'Content-Type: application/json')
  [ -n "$ADMIN_TOKEN" ] && args+=(-H "Authorization: Bearer $ADMIN_TOKEN")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

# caps:init читает CAP_PER_EPOCH (или per-kind CAP_<KIND>) из окружения и из
# aof_backend/.env (dotenv внутри скрипта) — проверяем те же два источника:
# потолок выпуска выбирает оператор, скрипт его не угадывает.
caps_value() {
  if [ -n "${CAP_PER_EPOCH:-}" ]; then printf '%s' "$CAP_PER_EPOCH"; return 0; fi
  if [ -f "$ROOT/aof_backend/.env" ]; then
    local line
    line="$(grep -E '^[[:space:]]*CAP_PER_EPOCH=[^[:space:]]' "$ROOT/aof_backend/.env" | tail -1 || true)"
    if [ -n "$line" ]; then printf '%s' "${line#*=}"; return 0; fi
  fi
  return 1
}

caps_configured() { # все виды уже имеют IssuanceCap в сети (GET /admin/issuance-caps)
  local body
  body="$(api GET /admin/issuance-caps)" || return 1
  printf '%s' "$body" | jq -e '(.caps | type == "array") and ([.caps[] | select(.configured == false)] | length == 0)' >/dev/null 2>&1
}

echo "Включение девнета: режим=$([ "$APPLY" = 1 ] && echo ПРИМЕНЕНИЕ || echo 'сухой прогон'), RPC=$RPC_URL, backend=$BACKEND_URL"

step "1/10 Предохранители"
[ "${AOF_DEPLOY_TARGET:-}" = "devnet" ] || die \
  "нужен AOF_DEPLOY_TARGET=devnet (получено '${AOF_DEPLOY_TARGET:-<пусто>}'); mainnet этим скриптом не включается"
command -v solana >/dev/null || die "нет CLI solana в PATH (docs: https://docs.anza.xyz/cli/install)"
command -v curl >/dev/null || die "нет curl"
command -v jq >/dev/null || die "нет jq (нужен для проверки mining_enabled и bringup preflight)"
[ -f "$AUTHORITY_KEYPAIR" ] || die \
  "нет ключа оператора: $AUTHORITY_KEYPAIR (файл кладётся на своей машине, в чат его присылать нельзя)"
[ -f "$PROBE" ] || die "нет читающего зонда $PROBE"
# Деплой требует явной политики ёмкости программ (PROGRAM_MAX_LEN_POLICY): проверяем её здесь, ДО backend и
# до первой команды, чтобы отказ не нашёл вас посреди запуска. Без деплоя (SKIP=deploy) политика не нужна.
if ! skipped deploy; then
  command -v python3 >/dev/null || die "нет python3 (нужен оценщику стоимости деплоя)"
  [ -f "$ESTIMATOR" ] || die "нет оценщика стоимости $ESTIMATOR"
  POLICY_LABEL="$(python3 "$ESTIMATOR" check-policy 2>&1)" || die "политика max_len: ${POLICY_LABEL#ОТКАЗ: }"
  ok "ёмкость программ (max-len): $POLICY_LABEL"
fi
# Название URL не доказывает сеть: AOF_DEPLOY_TARGET=devnet с mainnet-RPC иначе «включал» бы mainnet.
command -v python3 >/dev/null || die "нет python3 (нужен для проверки кластера и оценки стоимости)"
[ -f "$ESTIMATOR" ] || die "нет оценщика стоимости $ESTIMATOR"
GENESIS_REPORT="$(python3 "$ESTIMATOR" cluster --rpc "$RPC_URL" --expect-genesis "$DEVNET_GENESIS_HASH" 2>&1)" \
  || die "RPC не подтверждён как devnet: ${GENESIS_REPORT#ОТКАЗ: }"
ok "RPC отвечает genesis-хешем devnet"
NEED_BACKEND=0
for s in $BACKEND_STEPS; do skipped "$s" || NEED_BACKEND=1; done
if [ "$NEED_BACKEND" = 1 ]; then
  command -v jq >/dev/null || die "нет jq (нужен для шагов минтов/тумблера: brew install jq / apt-get install jq)"
  command -v npx >/dev/null || die "нет npx (нужен для scripts/initConfig.ts и scripts/initMintsV2.ts)"
  # Backend проверяем ДО первой транзакции: деплой без возможности включить —
  # это половина работы, а отказ после деплоя труднее откатывать.
  [ -n "$ADMIN_TOKEN" ] || die \
    "не задан ADMIN_TOKEN: Config, минты, капы, рынок, крафт, паки и тумблер добычи подписываются ключом backend'а в hot-режиме. Запустите backend (cd aof_backend && npm run dev) с AUTHORITY_MODE=hot/AUTHORITY_SECRET_KEY/RPC_URL и ADMIN_TOKEN, затем повторите с ADMIN_TOKEN=<токен>. Если сейчас нужен только деплой/upgrade — SKIP=backend (все шаги, которым нужен backend: $BACKEND_STEPS) либо отдельные имена."
  # ВАЖНО: раньше здесь был GET /admin/config/mining со строгим «200». Но этот маршрут читает Config, которого
  # до деплоя нет, и честно отвечает 400 — запуск упирался в замкнутый круг. «Принять любой 400» нельзя
  # (так проходят и неверный токен, и чужой сервис), поэтому backend отдаёт отдельный маршрут, который не
  # требует ни программ, ни Config, но закрыт ops-токеном и ничего не подписывает.
  AUTHORITY_PUBKEY="$(solana address -k "$AUTHORITY_KEYPAIR" 2>/dev/null)" || die "ключ не читается как keypair-файл"
  PREFLIGHT_BODY="$(mktemp "${TMPDIR:-/tmp}/aof-bootstrap-preflight.XXXXXX")"
  trap 'rm -f "$PREFLIGHT_BODY"' EXIT
  CURL_RC=0
  PREFLIGHT_HTTP="$(curl -sS -o "$PREFLIGHT_BODY" -w '%{http_code}' --max-time "$API_TIMEOUT" \
    -X GET "$BACKEND_URL/admin/config/bootstrap-preflight" \
    -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Accept: application/json')" || CURL_RC=$?
  [ "$CURL_RC" -eq 0 ] || die "backend недоступен: $BACKEND_URL (curl завершился с кодом $CURL_RC). Запустите его (cd aof_backend && npm run dev) с AUTHORITY_MODE=hot, AUTHORITY_SECRET_KEY, RPC_URL и ADMIN_TOKEN либо поправьте BACKEND_URL"
  case "$PREFLIGHT_HTTP" in
    200) ;;
    401|403) die "backend отклонил ADMIN_TOKEN (HTTP $PREFLIGHT_HTTP): нужен ops-токен ADMIN_TOKEN, а не ADMIN_READ_TOKEN и не чужой токен" ;;
    404) die "по адресу $BACKEND_URL нет /admin/config/bootstrap-preflight (HTTP 404): это посторонний сервис на порту или старая сборка backend — обновите и перезапустите backend из этого репозитория" ;;
    502) die "backend ответил 502 BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE: он сам не может прочитать сеть. Проверьте, куда он ходит: curl -sS $BACKEND_URL/ready | jq '{rpc: .checks.rpc, rpcEndpoint}' — в rpcEndpoint видно адрес (ключ маскируется). Если там публичный api.devnet.solana.com или старый адрес/ключ, а в .env уже новый — backend не перезапускался после правки: dotenv не перезаписывает уже заданные переменные окружения. Перезапустите его с явным RPC: RPC_URL='https://…/?api-key=…' BACKEND_PORT=<порт> bash scripts/dev-local.sh up" ;;
    *) die "GET $BACKEND_URL/admin/config/bootstrap-preflight вернул HTTP $PREFLIGHT_HTTP вместо 200: backend не готов (смотрите его лог, чаще всего недоступен RPC) либо это посторонний сервис" ;;
  esac
  jq -e '.kind == "aof.bootstrap-preflight" and .schemaVersion == 1 and .service == "aof-backend"' "$PREFLIGHT_BODY" >/dev/null 2>&1 \
    || die "ответ $BACKEND_URL не похож на bootstrap-preflight AOF backend (HTTP 200, но другой формат): это посторонний сервис"
  [ "$(jq -r '.authority.mode' "$PREFLIGHT_BODY")" = "hot" ] && [ "$(jq -r '.authority.canSign' "$PREFLIGHT_BODY")" = "true" ] \
    || die "backend не в hot-режиме подписи (mode=$(jq -r '.authority.mode' "$PREFLIGHT_BODY"), canSign=$(jq -r '.authority.canSign' "$PREFLIGHT_BODY")): Config, минты и тумблер подписываются его ключом. Запустите backend с AUTHORITY_MODE=hot и AUTHORITY_SECRET_KEY (read-only для bootstrap не годится)"
  BACKEND_AUTHORITY="$(jq -r '.authority.pubkey' "$PREFLIGHT_BODY")"
  [ "$BACKEND_AUTHORITY" = "$AUTHORITY_PUBKEY" ] \
    || die "authority backend'а $BACKEND_AUTHORITY не совпадает с ключом оператора $AUTHORITY_PUBKEY (AUTHORITY_KEYPAIR): Config привязывается к upgrade authority, и деплой одним ключом с инициализацией другим закончился бы отказом ПОСЛЕ траты SOL.
   Выровнять (в .env попадёт секрет ключа оператора, в вывод — только pubkey): node scripts/set-backend-authority.mjs --apply, затем перезапустить backend"
  BACKEND_GENESIS="$(jq -r '.rpc.genesisHash' "$PREFLIGHT_BODY")"
  [ "$BACKEND_GENESIS" = "$DEVNET_GENESIS_HASH" ] \
    || die "RPC backend'а отвечает genesis $BACKEND_GENESIS — это не devnet ($DEVNET_GENESIS_HASH). mainnet этим скриптом не включается"
  [ "$(jq -r '.rpc.genesisMatchesExpected' "$PREFLIGHT_BODY")" != "false" ] \
    || die "EXPECTED_GENESIS_HASH backend'а не совпадает с genesis его RPC"
  BACKEND_DEPLOYED=0
  while read -r name address; do
    got="$(jq -r --arg n "$name" '.programs[$n].programId // empty' "$PREFLIGHT_BODY")"
    [ "$got" = "$address" ] || die "backend знает $name по адресу '${got:-<нет>}', а в реестре (watchtower/addresses.json) $address: backend собран/настроен под другие программы (PROGRAM_ID, IDL)"
    anomaly="$(jq -r --arg n "$name" '.programs[$n].anomaly // empty' "$PREFLIGHT_BODY")"
    [ -z "$anomaly" ] || die "программа $name ($address) в сети в неожиданном состоянии: $anomaly"
    [ "$(jq -r --arg n "$name" '.programs[$n].deployed' "$PREFLIGHT_BODY")" != "true" ] || BACKEND_DEPLOYED=$((BACKEND_DEPLOYED + 1))
  done < <(jq -r '.programs[] | "\(.name) \(.address)"' watchtower/addresses.json)
  BACKEND_PROGRAM_COUNT="$(jq -r '.programs | length' watchtower/addresses.json)"
  CONFIG_ANOMALY="$(jq -r '.config.anomaly // empty' "$PREFLIGHT_BODY")"
  [ -z "$CONFIG_ANOMALY" ] || die "Config ($(jq -r '.config.pda' "$PREFLIGHT_BODY")) в неожиданном состоянии: $CONFIG_ANOMALY"
  CONFIG_EXISTS="$(jq -r '.config.exists' "$PREFLIGHT_BODY")"
  ok "backend проверен без Config: ops-токен принят, hot-режим, authority $AUTHORITY_PUBKEY, devnet"
  ok "program ID backend'а совпали с реестром; в сети программ: $BACKEND_DEPLOYED из $BACKEND_PROGRAM_COUNT, Config: $([ "$CONFIG_EXISTS" = "true" ] && echo есть || echo 'ещё нет (создаётся в шаге 5)')"
else
  ok "backend-шаги пропущены (SKIP=backend или имена шагов) — ADMIN_TOKEN не нужен"
fi
ok "цель devnet, CLI на месте, ключ найден"

step "2/10 Ключ, баланс и состояние сети"
AUTHORITY_PUBKEY="$(solana address -k "$AUTHORITY_KEYPAIR" 2>/dev/null)" || die "ключ не читается как keypair-файл"
BALANCE="$(solana balance "$AUTHORITY_PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')" \
  || die "RPC недоступен из этой машины: $RPC_URL"
ok "оператор: $AUTHORITY_PUBKEY, баланс: ${BALANCE:-0} SOL"
case "${BALANCE:-0}" in
  0|0.0*) die "на ключе нет SOL: аренда аккаунта программы на девнете платная; попросите airdrop на $AUTHORITY_PUBKEY" ;;
esac
PROBE_REPORT="$(python3 "$PROBE" "$RPC_URL" --json)" || die "зонд не смог прочитать реестр программ (сеть или адреса)"
printf '%s' "$PROBE_REPORT" | jq -e '.mechanics | type == "array"' >/dev/null 2>&1 \
  || die "зонд не подтвердил чтение механик; не обновляйте программу и не меняйте caps без проверенного kill-switch"
MINING_STATE="$(printf '%s' "$PROBE_REPORT" | jq -r '.mechanics[]? | select(.name == "Добыча инструментов") | .state' | head -n 1)"
MINING_EVIDENCE="$(printf '%s' "$PROBE_REPORT" | jq -r '.mechanics[]? | select(.name == "Добыча инструментов") | .evidence' | head -n 1)"
# Python prints booleans as `False`, while older mocks/other probe versions may
# serialize them as lowercase JSON-like text. Compare the flag case-insensitively.
MINING_EVIDENCE_LOWER="$(printf '%s' "$MINING_EVIDENCE" | tr '[:upper:]' '[:lower:]')"
case "$MINING_STATE:$MINING_EVIDENCE" in
  "включено:"*)
    if [ "$APPLY" = "1" ]; then
      die "Config.mining_enabled уже true: сначала выключите реальный on-chain kill-switch через POST /admin/config/mining {\"enabled\":false}, затем повторите bringup; не обновляйте программу и не меняйте lifetime caps при открытой добыче"
    fi
    info "обнаружено mining_enabled=true: dry-run только показывает состояние; перед --apply выключите on-chain kill-switch" ;;
  "выключено:Config есть:"*)
    [[ "$MINING_EVIDENCE_LOWER" == *"mining_enabled=false"* ]] || die "Config state does not prove mining_enabled=false: $MINING_EVIDENCE" ;;
  "выключено:аккаунта Config нет ("*) ;;
  "выключено:программа не задеплоена"*) ;;
  *) die "не удалось доказать выключенное состояние mining kill-switch (state=${MINING_STATE:-нет}, evidence=${MINING_EVIDENCE:-нет}); bringup остановлен до upgrade" ;;
esac
printf '%s' "$PROBE_REPORT" | jq -r '"--- читающий зонд ---", (.programs[]? | "\(.name) \(.address) executable=\(.executable // false)"), (.mechanics[]? | "[\(.state)] \(.name): \(.evidence)")'

step "3/10 Локальная сборка всех шести программ"
PROGRAMS=(aof_core aof_market aof_quests aof_rebirth aof_liquidity aof_session_keys)
MISSING_ARTIFACTS=()
for name in "${PROGRAMS[@]}"; do
  [ -f "$ARTIFACTS/$name.so" ] || MISSING_ARTIFACTS+=("$name")
done
if [ "${SKIP_BUILD:-0}" = "1" ] || skipped build; then
  if [ "${#MISSING_ARTIFACTS[@]}" -gt 0 ]; then
    die "сборка пропущена, но нет .so для ${MISSING_ARTIFACTS[*]} в $ARTIFACTS; соберите все шесть локально либо снимите SKIP_BUILD=1/SKIP=build"
  fi
  ok "используются предоставленные локальные .so; их совпадение с сетью проверяется обязательным bytecode gate ниже"
elif ! command -v anchor >/dev/null; then
  die "нужна локальная сборка всех шести программ и нет anchor: установите Anchor 0.30.1 или передайте проверенные .so через ARTIFACTS вместе с SKIP_BUILD=1"
else
  info "собираются все шесть программ по отдельности с локальными declare_id!; aof_core и aof_quests получают только devnet feature"
  for name in "${PROGRAMS[@]}"; do
    if [ "$name" = "aof_core" ] || [ "$name" = "aof_quests" ]; then
      do_or_tell "anchor build --program-name $name --no-idl -- --features devnet" \
        anchor build --program-name "$name" --no-idl -- --features devnet
    else
      do_or_tell "anchor build --program-name $name --no-idl" \
        anchor build --program-name "$name" --no-idl
    fi
  done
  if [ "$APPLY" = "1" ]; then
    for name in "${PROGRAMS[@]}"; do
      [ -f "$ARTIFACTS/$name.so" ] || die "после сборки нет $ARTIFACTS/$name.so — проверьте anchor build --program-name $name"
    done
    ok "все шесть .so собраны с нужными cluster features"
  fi
fi

step "4/10 Деплой недостающих программ и обновление изменившихся"
if skipped deploy; then
  info "деплой пропущен (SKIP=deploy)"
elif [ "$APPLY" = 1 ]; then
  AOF_DEPLOY_TARGET=devnet RPC_URL="$RPC_URL" AUTHORITY_KEYPAIR="$AUTHORITY_KEYPAIR" \
    ARTIFACTS="$ARTIFACTS" MIN_SOL="$MIN_SOL" PROBE="$PROBE" UPGRADE="$UPGRADE" \
    scripts/deploy-devnet.sh --apply || die "деплой не прошёл (причина — в выводе выше)"
else
  AOF_DEPLOY_TARGET=devnet RPC_URL="$RPC_URL" AUTHORITY_KEYPAIR="$AUTHORITY_KEYPAIR" \
    ARTIFACTS="$ARTIFACTS" MIN_SOL="$MIN_SOL" PROBE="$PROBE" UPGRADE="$UPGRADE" \
    scripts/deploy-devnet.sh || die "сухой прогон деплоя не прошёл (причина — в выводе выше)"
fi

step "4a/10 Обязательное совпадение байткода всех шести программ"
if [ "$APPLY" = "1" ]; then
  scripts/verify-programs.sh "$RPC_URL" "$AUTHORITY_PUBKEY" "$ARTIFACTS" --require-bytecode \
    || die "bytecode gate не прошёл: не меняйте registry status и не включайте mining; при несовпадении обновите UPGRADE=all и повторите"
  ok "все шесть on-chain ProgramData payload совпали с локальными .so"
else
  echo "   сухой прогон: scripts/verify-programs.sh $RPC_URL $AUTHORITY_PUBKEY $ARTIFACTS --require-bytecode"
  info "этот gate проверяет байткод локально собранных .so в сети; без успешного результата не меняйте статусы реестра на verified"
fi

step "5/10 Config, минты, потолки выпуска, исторические baselines и экономика крафта"
if skipped config; then
  info "Config пропущен (SKIP=config)"
elif [ "${CONFIG_EXISTS:-false}" = "true" ]; then
  ok "Config уже инициализирован (по bootstrap-preflight) — шаг пропущен, повторный запуск ничего не пересоздаёт"
elif [ "$APPLY" = 1 ]; then
  ( cd aof_backend && npx ts-node scripts/initConfig.ts ) || die "initConfig.ts не прошёл"
else
  echo "   сухой прогон: cd aof_backend && npx ts-node scripts/initConfig.ts"
fi
if skipped mints; then
  info "минты пропущены (SKIP=mints)"
elif [ "$APPLY" = 1 ]; then
  ( cd aof_backend && npx ts-node scripts/initMintsV2.ts ) || die "initMintsV2.ts не прошёл"
else
  echo "   сухой прогон: cd aof_backend && npx ts-node scripts/initMintsV2.ts"
fi
if skipped vrf-lut; then
  info "v0 lookup table для exploration пропущена (SKIP=vrf-lut); commit/reveal требуют уже настроенную активную VRF_ADDRESS_LOOKUP_TABLE"
elif [ "$APPLY" = 1 ]; then
  ( cd aof_backend && npm run vrf:lut:init ) || die "devnet lookup table для atomic exploration v0 не создана/не прошла read-back"
else
  echo "   сухой прогон: cd aof_backend && npm run vrf:lut:init (создать/дополнить и прочитать обратно devnet ALT)"
fi
if skipped escrows; then
  info "resource escrow ATAs пропущены (SKIP=escrows)"
elif [ "$APPLY" = 1 ]; then
  ( cd aof_backend && npm run escrows:init ) || die "initResourceEscrows.ts не прошёл"
else
  echo "   сухой прогон: cd aof_backend && npm run escrows:init (четыре PDA-owned ATA для escrow/refund)"
fi
if skipped caps; then
  info "потолки выпуска пропущены (SKIP=caps)"
elif caps_configured; then
  ok "потолки выпуска уже инициализированы (все виды configured) — шаг пропущен"
elif [ -z "$(caps_value || true)" ]; then
  die "caps:init требует CAP_PER_EPOCH (базовые единицы; 1 единица = 1e9): потолок выпуска не угадывается. Пример для devnet: CAP_PER_EPOCH=1000000000000 (1000 единиц на вид за эпоху). Задайте его в окружении или в aof_backend/.env; per-kind — CAP_<KIND> (docs/ISSUANCE_CAPS_DESIGN.md). Если потолки уже заданы per-kind, выполните caps:init сами и повторите с SKIP=caps"
elif [ "$APPLY" = 1 ]; then
  ( cd aof_backend && npm run caps:init ) || die "caps:init не прошёл"
else
  echo "   сухой прогон: cd aof_backend && CAP_PER_EPOCH=<базовые единицы> npm run caps:init"
fi
if skipped issuance-baseline; then
  info "историческое сканирование и установка монотонных baselines пропущены (SKIP=issuance-baseline)"
elif [ "$APPLY" = "1" ]; then
  ( cd aof_backend && npm run issuance:history:scan ) || die "исторический SPL MintTo-скан не прошёл или не доказал полноту"
  ( cd aof_backend && npm run issuance:baseline:apply ) || die "исторические lifetime baselines не применены"
else
  echo "   сухой прогон: cd aof_backend && npm run issuance:history:scan"
  echo "   сухой прогон: cd aof_backend && npm run issuance:baseline:apply"
  info "скан должен дойти до InitializeMint и сверить gross mints − burns с live supply для всех 27 canonical mint"
fi
if skipped lifetime-caps; then
  info "конечные cumulative lifetime caps для четырёх mining mint пропущены (SKIP=lifetime-caps)"
elif [ "$APPLY" = "1" ]; then
  ( cd aof_backend && npm run issuance:lifetime-caps:apply ) || die "четыре конечных cumulative lifetime cap не применены; mining остаётся закрыт"
else
  echo "   сухой прогон: cd aof_backend && npm run issuance:lifetime-caps:apply"
  info "нужны LIFETIME_CAP_CIRCUIT/SILICON/DATASET/NEURON в raw SPL atoms; значения оператор задаёт, скрипт их не угадывает"
fi

# Экономика крафта и счётчики редкости — то, без чего крафт инструментов
# остаётся закрытым: /tools/craft-quote и /tools/craft читают CraftEconomy и
# RarityCounter и без них честно отдают 503. Значения не угадываются: инструкция
# `init_craft_economy` берёт канонические CRAFT_* из констант программы, а
# счётчики — по одному на редкость 1..4 (уникальные, повторный init упал бы).
if skipped craft; then
  info "экономика крафта пропущена (SKIP=craft)"
else
  if api GET /query/craft-economy | jq -e '. != null' >/dev/null 2>&1; then
    ok "CraftEconomy уже инициализирован"
  elif [ "$APPLY" = 1 ]; then
    RESULT="$(api POST /admin/craft-economy/init '{}')"
    echo "$RESULT" | jq -e '.sig' >/dev/null \
      || die "CraftEconomy не инициализирован: $RESULT"
    ok "CraftEconomy → $(echo "$RESULT" | jq -r '.sig')"
  else
    echo "   сухой прогон: POST /admin/craft-economy/init (канонические CRAFT_* из программы)"
  fi

  OLD_IFS="$IFS"; IFS=','
  for rarity in $CRAFT_RARITY_COUNTERS; do
    IFS="$OLD_IFS"
    case "$rarity" in
      ""|*[!0-9]*) die "CRAFT_RARITY_COUNTERS: редкость должна быть числом 1..4 (получено '$rarity')" ;;
    esac
    case "$rarity" in
      1|2|3|4) ;;
      *) die "CRAFT_RARITY_COUNTERS: редкость $rarity вне диапазона 1..4" ;;
    esac
    if api GET "/query/rarity-counter/$rarity" | jq -e '. != null' >/dev/null 2>&1; then
      ok "счётчик редкости $rarity уже есть"
    elif [ "$APPLY" = 1 ]; then
      RESULT="$(api POST /admin/rarity-counter/init "{\"rarityIdx\":$rarity}")"
      echo "$RESULT" | jq -e '.sig' >/dev/null \
        || die "счётчик редкости $rarity не создан: $RESULT"
      ok "счётчик редкости $rarity → $(echo "$RESULT" | jq -r '.sig')"
    else
      echo "   сухой прогон: POST /admin/rarity-counter/init {\"rarityIdx\":$rarity}"
    fi
    IFS=','
  done
  IFS="$OLD_IFS"
fi

# Паки, реролл, лотерея и сезон — механики, которые без аккаунта-конфига не
# работают вообще: покупка пака читает PackConfig, фьюз редкости — RerollConfig,
# продажа билета — LotteryRound, сезонный пропуск и XP — Season. Значения не
# выдуманы: канонические PACK_*_PRICE_LAMPORTS/PACK_*_ODDS_BPS,
# REROLL_ODDS_BPS_DEFAULT и LOTTERY_* объявлены в aof-core/src/constants.rs, а
# совпадение чисел в этом скрипте с программой проверяет гейт
# tests/readiness/mechanic-configs.test.cjs — молча разъехаться они не могут.
step "6/10 Паки, лотерея, сезон и реролл: конфиги механик"
if skipped mechanics; then
  info "паки, лотерея, сезон и реролл пропущены (SKIP=mechanics)"
else
  # Паки: индексы 0/1/2 = small/medium/big — те же имена отдаёт /packs/configs.
  PACK_STATE="$(api GET /packs/configs)"
  PACK_INDEX=0
  for pack in small medium big; do
    case "$pack" in
      small)  PACK_PRICE=100000000;  PACK_ODDS="[6000,3200,700,100,0]" ;;
      medium) PACK_PRICE=300000000;  PACK_ODDS="[5000,3500,1000,500,0]" ;;
      big)    PACK_PRICE=1000000000; PACK_ODDS="[3500,4000,1500,1000,0]" ;;
    esac
    if printf '%s' "$PACK_STATE" | jq -e --arg n "$pack" '.packs[]? | select(.packType == $n)' >/dev/null 2>&1; then
      ok "пак $pack уже настроен"
    else
      BODY="{\"packType\":$PACK_INDEX,\"priceLamports\":\"$PACK_PRICE\",\"oddsBps\":$PACK_ODDS}"
      if [ "$APPLY" = 1 ]; then
        RESULT="$(api POST /packs/config/init "$BODY")"
        echo "$RESULT" | jq -e '.sig' >/dev/null || die "пак $pack не настроен: $RESULT"
        ok "пак $pack ($PACK_PRICE lamports, шансы $PACK_ODDS) → $(echo "$RESULT" | jq -r '.sig')"
      else
        echo "   сухой прогон: POST /packs/config/init $BODY"
      fi
    fi
    PACK_INDEX=$((PACK_INDEX + 1))
  done

  # Реролл (фьюз редкости): конфиг один на программу.
  REROLL_STATE="$(api GET /query/reroll-config)"
  if printf '%s' "$REROLL_STATE" | jq -e '. != null' >/dev/null 2>&1; then
    ok "конфиг реролла уже есть"
  else
    BODY='{"oddsBps":[5500,3000,1100,400,0]}'
    if [ "$APPLY" = 1 ]; then
      RESULT="$(api POST /reroll/config/init "$BODY")"
      echo "$RESULT" | jq -e '.sig' >/dev/null || die "конфиг реролла не создан: $RESULT"
      ok "реролл (шансы $BODY) → $(echo "$RESULT" | jq -r '.sig')"
    else
      echo "   сухой прогон: POST /reroll/config/init $BODY"
    fi
  fi

  # Лотерея: раунд открывает продажу билетов; 14-дневное окно ставит программа.
  LOTTERY_STATE="$(api GET "/query/lottery/$LOTTERY_ROUND_ID")"
  if printf '%s' "$LOTTERY_STATE" | jq -e '. != null' >/dev/null 2>&1; then
    ok "раунд лотереи $LOTTERY_ROUND_ID уже создан"
  elif [ "$APPLY" = 1 ]; then
    RESULT="$(api POST /lottery/round/init "{\"roundId\":\"$LOTTERY_ROUND_ID\"}")"
    echo "$RESULT" | jq -e '.sig' >/dev/null || die "раунд лотереи $LOTTERY_ROUND_ID не создан: $RESULT"
    ok "раунд лотереи $LOTTERY_ROUND_ID → $(echo "$RESULT" | jq -r '.sig')"
  else
    echo "   сухой прогон: POST /lottery/round/init {\"roundId\":\"$LOTTERY_ROUND_ID\"}"
  fi

  # Сезон: 42-дневное окно считается программой от времени создания. Платный
  # трек пропуска этим НЕ включается — он остаётся работой по контракту
  # (docs/CONTRACT_WORK_QUEUE.md §3.6),
  # и создание Season не делает продажу пропусков безопасной.
  SEASON_STATE="$(api GET "/query/season/$SEASON_ID")"
  if printf '%s' "$SEASON_STATE" | jq -e '. != null' >/dev/null 2>&1; then
    ok "сезон $SEASON_ID уже создан"
  elif [ "$APPLY" = 1 ]; then
    RESULT="$(api POST /season/init "{\"seasonId\":$SEASON_ID}")"
    echo "$RESULT" | jq -e '.sig' >/dev/null || die "сезон $SEASON_ID не создан: $RESULT"
    ok "сезон $SEASON_ID → $(echo "$RESULT" | jq -r '.sig')"
  else
    echo "   сухой прогон: POST /season/init {\"seasonId\":$SEASON_ID}"
  fi
  info "чтобы /season/current отдавал сезон, владелец задаёт ACTIVE_SEASON_ID=$SEASON_ID и EXPECTED_GENESIS_HASH: без них сезон честно отвечает 503"
fi

step "7/10 Рынок инструментов: конфиг и пулы редкостей"
if skipped market; then
  info "рынок инструментов пропущен (SKIP=market)"
else
  # MarketConfig создаётся один раз, и его валюты больше не меняются: поэтому
  # адреса берутся явно, а не «какие-нибудь». Порядок поиска:
  #   core — MARKET_CORE_MINT → Config.mindMint (внутриигровой MIND);
  #   gem  — MARKET_GEM_MINT  → MaterialMints.quantumBit (QUANTUM_BIT);
  #   казна — MARKET_TREASURY → Config.treasury.
  # Пул без аккаунта не торгует, а hot_market_buy/sell уже живые в коде: пустой
  # пул — это единственное, что остаётся между игроком и механикой.
  MARKET_STATE="$(api GET /query/hot-market-config)"
  if printf '%s' "$MARKET_STATE" | jq -e '.coreMint' >/dev/null 2>&1; then
    ok "MarketConfig уже инициализирован: $(printf '%s' "$MARKET_STATE" | jq -r '.coreMint') / $(printf '%s' "$MARKET_STATE" | jq -r '.gemMint')"
  else
    CORE_STATE="$(api GET /query/config)"
    MINT_STATE="$(api GET /query/material-mints)"
    if [ -z "$MARKET_CORE_MINT" ]; then
      MARKET_CORE_MINT="$(printf '%s' "$CORE_STATE" | jq -r '.mindMint // empty')"
    fi
    if [ -z "$MARKET_GEM_MINT" ]; then
      MARKET_GEM_MINT="$(printf '%s' "$MINT_STATE" | jq -r '.mints.QUANTUM_BIT // empty')"
    fi
    if [ -z "$MARKET_TREASURY" ]; then
      MARKET_TREASURY="$(printf '%s' "$CORE_STATE" | jq -r '.treasury // empty')"
    fi
    for pair in "core:$MARKET_CORE_MINT" "gem:$MARKET_GEM_MINT" "казна:$MARKET_TREASURY"; do
      value="${pair#*:}"
      case "$value" in
        ""|11111111111111111111111111111111)
          die "рынок: не удалось определить адрес (${pair%%:*}). Задайте MARKET_CORE_MINT/MARKET_GEM_MINT/MARKET_TREASURY явно (валюты пула необратимы), либо SKIP=market" ;;
      esac
    done
    info "валюты пула: core=$MARKET_CORE_MINT, gem=$MARKET_GEM_MINT, казна=$MARKET_TREASURY"
    BODY="{\"coreMint\":\"$MARKET_CORE_MINT\",\"gemMint\":\"$MARKET_GEM_MINT\",\"treasury\":\"$MARKET_TREASURY\",\"feeBps\":$MARKET_FEE_BPS}"
    if [ "$APPLY" = 1 ]; then
      RESULT="$(api POST /hot-market/config/init "$BODY")"
      echo "$RESULT" | jq -e '.sig' >/dev/null || die "MarketConfig не инициализирован: $RESULT"
      ok "MarketConfig → $(echo "$RESULT" | jq -r '.sig')"
    else
      echo "   сухой прогон: POST /hot-market/config/init $BODY"
    fi
  fi

  # Пул идемпотентно: существующий не пересоздаётся (init упал бы на занятом
  # аккаунте), отсутствующий создаётся вместе с ATA пула и казны для обеих валют.
  OLD_IFS="$IFS"; IFS=','
  for rarity in $MARKET_POOL_RARITIES; do
    IFS="$OLD_IFS"
    case "$rarity" in
      ""|*[!0-9]*) die "MARKET_POOL_RARITIES: редкость должна быть числом 0..3 (получено '$rarity')" ;;
    esac
    if api GET "/query/hot-market-pool/$rarity" | jq -e '.targetPriceCore' >/dev/null 2>&1; then
      ok "пул редкости $rarity уже есть"
    elif [ "$APPLY" = 1 ]; then
      POOL_BODY="{\"rarity\":$rarity,\"targetPriceCore\":$MARKET_TARGET_CORE,\"targetPriceGem\":$MARKET_TARGET_GEM,\"targetRatePerHour\":0,\"decayBpsPerHour\":$MARKET_DECAY_BPS,\"growthBpsPerSale\":$MARKET_GROWTH_BPS,\"feeBps\":$MARKET_FEE_BPS}"
      RESULT="$(api POST /hot-market/pool/init "$POOL_BODY")"
      echo "$RESULT" | jq -e '.sig' >/dev/null || die "пул редкости $rarity не создан: $RESULT"
      ok "пул редкости $rarity → $(echo "$RESULT" | jq -r '.sig')"
    else
      echo "   сухой прогон: POST /hot-market/pool/init (редкость $rarity, цена $MARKET_TARGET_CORE/$MARKET_TARGET_GEM, комиссия $MARKET_FEE_BPS)"
    fi
    IFS=','
  done
  IFS="$OLD_IFS"
fi

step "8/10 Тумблер добычи"
if skipped mining; then
  info "включение добычи пропущено (SKIP=mining)"
elif [ "$APPLY" != 1 ]; then
  echo "   сухой прогон: preflight:mining-devnet, затем отдельный enable после smoke:"
  if [ "$ALLOW_UNLIMITED_DEVNET_ISSUANCE" = "1" ]; then
    echo "   политика: unlimited lifetime issuance явно принята для Devnet (флаг сам по себе сеть не меняет)"
    echo "   MINING_PREFLIGHT_REPORT=<тот же clean report> ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 MINING_SMOKE_OK=1 PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet scripts/enable-mining-devnet.sh --apply"
  else
    echo "   MINING_SMOKE_OK=1 PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet scripts/enable-mining-devnet.sh --apply"
  fi
else
  PREFLIGHT_REPORT="$(mktemp)"
  set +e
  ( cd aof_backend && ALLOW_UNLIMITED_DEVNET_ISSUANCE="$ALLOW_UNLIMITED_DEVNET_ISSUANCE" \
      MINING_PREFLIGHT_REPORT="$PREFLIGHT_REPORT" npm run preflight:mining-devnet )
  PREFLIGHT_CODE=$?
  set -e
  echo "--- отчёт preflight ---"
  cat "$PREFLIGHT_REPORT" 2>/dev/null || true
  echo "--- конец отчёта ---"
  if [ "$PREFLIGHT_CODE" != 0 ] || grep -q 'BLOCKED' "$PREFLIGHT_REPORT" 2>/dev/null; then
    die "preflight не прошёл (BLOCKED): тумблер НЕ включаем — сначала закройте пункты отчёта. Файл: $PREFLIGHT_REPORT"
  fi
  ok "preflight без BLOCKED"
  PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet \
    MINING_SMOKE_OK="$MINING_SMOKE_OK" \
    ALLOW_UNLIMITED_DEVNET_ISSUANCE="$ALLOW_UNLIMITED_DEVNET_ISSUANCE" \
    MINING_PREFLIGHT_REPORT="$PREFLIGHT_REPORT" \
    BASE_URL="$BACKEND_URL" ADMIN_TOKEN="$ADMIN_TOKEN" \
    scripts/enable-mining-devnet.sh --apply || die "включение добычи не прошло: причина — в выводе выше"
fi

step "9/10 Коллекционеры"
if skipped collectors; then
  info "allowlist коллекционеров пропущен (SKIP=collectors)"
elif [ -z "$COLLECTOR_MINTS" ]; then
  info "COLLECTOR_MINTS не задан — allowlist не заполняется."
  info "Формат: COLLECTOR_MINTS=<mint>:historian,<mint>:medallion; без записи игрок получит COLLECTOR_MINT_NOT_ALLOWED"
else
  IFS=',' read -r -a entries <<< "$COLLECTOR_MINTS"
  for entry in "${entries[@]}"; do
    mint="${entry%%:*}"; kind="${entry##*:}"
    case "$kind" in historian|medallion) ;; *) die "неизвестный вид коллекционера '$kind' (нужно historian или medallion)" ;; esac
    [ -n "$mint" ] || die "пустой адрес минта в COLLECTOR_MINTS"
    if [ "$APPLY" = 1 ]; then
      RESULT="$(api POST /admin/config/collector-mint "{\"mint\":\"$mint\",\"kind\":{\"$kind\":{}}}")"
      echo "$RESULT" | jq -e '.sig' >/dev/null || die "коллекционер $mint ($kind) не зарегистрирован: $RESULT"
      ok "$kind $mint → $(echo "$RESULT" | jq -r '.sig')"
    else
      echo "   сухой прогон: POST /admin/config/collector-mint {\"mint\":\"$mint\",\"kind\":{\"$kind\":{}}}"
    fi
  done
fi
step "10/10 Итоговый читающий отчёт: что включено на самом деле"
if skipped report; then
  info "итоговый зонд пропущен (SKIP=report)"
else
  # Зонд печатает не только «программы задеплоены», но и таблицу механик по
  # состоянию аккаунтов: тумблер добычи, адреса ресурсов для ремонта,
  # MaterialMints, паки, реролл, сезоны, лотерея, allowlist коллекционеров,
  # листинги рынка, пул горячего рынка (MarketConfig + HotMarketPool), конфиги
  # aof-session-keys/aof-rebirth. Это и есть доказательство включения: строка
  # «ВКЛ» рядом с механикой, а не обещание.
  python3 "$PROBE" "$RPC_URL" || true
fi

echo
if [ "$APPLY" = 1 ]; then
  echo "Включено этим прогоном (при отсутствии ошибок выше): добыча инструментов,"
  echo "ресурсы и крафт (CraftEconomy + счётчики редкости), паки (три типа с"
  echo "каноническими ценами и шансами), реролл, лотерея (раунд $LOTTERY_ROUND_ID),"
  echo "сезон $SEASON_ID (окно 42 дня), ремонт, газ-бак, коллекционеры, рынок"
  echo "инструментов (конфиг и пулы), минты/капы, и все маршруты, которые читают"
  echo "Config/MaterialMints."
else
  echo "Это был сухой прогон: ничего не задеплоено и не включено."
  echo "Повторите ту же команду с --apply."
fi
echo
echo "Чтобы читались история, квесты, сделки и графики цен, рядом с игрой должны"
echo "работать фоновые сервисы. Одной командой (Ctrl+C гасит всё):"
echo
echo "  WITH_SERVICES=1 bash scripts/dev-local.sh up"
echo
echo "Поднимается: chain-indexer (история/квесты/рынок, health :8082), indexer"
echo "(тики и свечи цен, WS :8081), trust-worker, farm-trader, price-cranker."
echo "Каждый проверяется на живость, логи — aof_backend/data/logs/*.log."
echo
echo "Включается тем же деплоем (код уже в ветке, но требует новой сборки aof_core)."
echo "Это НЕ работа «когда-нибудь»: после деплоя эти механики просто работают,"
echo "потому что инструкции в байткоде новые:"
echo "  * ордербук: цена за целый ресурс, отдельный эскроу и v2-инструкции (§3.1);"
echo "  * лотерея: потолок цены max_price в покупке билета (§3.2);"
echo "  * перерождение: полный сброс сезонного состояния и излишков одной транзакцией (§3.4);"
echo "  * фляги и обмен DATA→энергия: use_flask / exchange_data_energy — сжигание"
echo "    расходника и энергия не выше потолка (§3.8);"
echo "  * награда за лук снята навсегда: маршруты /forge/bow/* отвечают 410 (§3.8)."
echo
echo "Горячий рынок включается этим же прогоном (шаг 7): MarketConfig, валюты пула"
echo "и пулы редкостей. Панель рынка читает цены и инвентарь из сети, а владение"
echo "инструментом переводит aof_core::transfer_tool через CPI — покупатель сразу"
echo "может майнить и ремонтировать купленный инструмент."
echo
echo "Осталось работой по контракту (не переключатель, docs/CONTRACT_WORK_QUEUE.md §3):"
echo "  * сессионные ключи: резерв лимита обязан быть атомарно привязан к целевой инструкции (§3.3);"
echo "  * платный сезон-пропуск: сезон создан, но продажа пропуска — раздельные"
echo "    треки и идемпотентные начисления (V2) (§3.6);"
echo "  * MIND: отдельный utility mint and bank; spin instructions remain disabled (§3.7)."
echo
echo "Проверить всё это в любой момент (ничего не подписывает):"
echo "  python3 scripts/devnet-program-probe.py $RPC_URL"
