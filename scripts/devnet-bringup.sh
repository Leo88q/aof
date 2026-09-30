#!/usr/bin/env bash
# Включение девнета целиком — одной командой, в безопасном порядке.
#
# Зачем этот скрипт. Читающий зонд (scripts/devnet-program-probe.py) показал:
# по адресам aof_core, aof_market и aof_session_keys на девнете нет аккаунтов, а
# aof_core — это 113 инструкций (добыча, инструменты, ресурсы, крафт, паки,
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
#   AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh            # сухой прогон
#   AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply    # включить
#
# Обязательные условия (без них выход 3 и ни одной транзакции):
#   * AOF_DEPLOY_TARGET=devnet — mainnet этим скриптом не включается;
#   * ключ оператора AUTHORITY_KEYPAIR (по умолчанию
#     solana/keys/aof-authority-devnet.json) и ≥ MIN_SOL SOL на нём;
#   * solana CLI; для сборки — anchor; для шагов 5–7 — работающий backend
#     (BACKEND_URL, ADMIN_TOKEN) в hot-режиме, потому что минты и тумблер добычи
#     подписываются его ключом (AUTHORITY_SECRET_KEY);
#   * для шага collector — COLLECTOR_MINTS="<mint>:historian,<mint>:medallion"
#     (адреса минтов инструментов, попадающих в allowlist коллекционеров).
#
# Переменные окружения:
#   RPC_URL, AUTHORITY_KEYPAIR, ARTIFACTS, BACKEND_URL, ADMIN_TOKEN, MIN_SOL,
#   COLLECTOR_MINTS, SKIP=build,deploy,config,mints,caps,mining,collectors,report
#   SKIP_BUILD=1 — не собирать, взять готовые .so из target/deploy.
#
# Что скрипт НЕ делает и не может: не меняет контракты. Пункты из
# docs/UNBLOCK_PLAN_2026-09-30.md §3 (ордербук v2, полный сброс при
# перерождении, цена в лотерее, платный сезон-пропуск, Potato V2) требуют
# новой сборки программ и отдельных релизных проверок — скрипт печатает их в
# конце ещё раз, чтобы «включено» не читалось шире, чем есть.
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
AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-solana/keys/aof-authority-devnet.json}"
ARTIFACTS="${ARTIFACTS:-target/deploy}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL%/}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
MIN_SOL="${MIN_SOL:-1}"
SKIP="${SKIP:-}"
COLLECTOR_MINTS="${COLLECTOR_MINTS:-}"
PROBE="${PROBE:-scripts/devnet-program-probe.py}"
API_TIMEOUT="${API_TIMEOUT:-30}"
PREFLIGHT_TIMEOUT="${PREFLIGHT_TIMEOUT:-900}"

die()  { echo >&2; echo "ОТКАЗ: $*" >&2; exit "${2:-3}"; }
step() { echo; echo "== $*"; }
ok()   { echo "   ✓ $*"; }
info() { echo "   $*"; }
skipped() { case ",${SKIP}," in *",$1,"*) return 0 ;; *) return 1 ;; esac; }

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

echo "Включение девнета: режим=$([ "$APPLY" = 1 ] && echo ПРИМЕНЕНИЕ || echo 'сухой прогон'), RPC=$RPC_URL, backend=$BACKEND_URL"

step "1/8 Предохранители"
[ "${AOF_DEPLOY_TARGET:-}" = "devnet" ] || die \
  "нужен AOF_DEPLOY_TARGET=devnet (получено '${AOF_DEPLOY_TARGET:-<пусто>}'); mainnet этим скриптом не включается"
command -v solana >/dev/null || die "нет CLI solana в PATH (docs: https://docs.anza.xyz/cli/install)"
command -v curl >/dev/null || die "нет curl"
[ -f "$AUTHORITY_KEYPAIR" ] || die \
  "нет ключа оператора: $AUTHORITY_KEYPAIR (файл кладётся на своей машине, в чат его присылать нельзя)"
[ -f "$PROBE" ] || die "нет читающего зонда $PROBE"
NEED_BACKEND=0
for s in mints caps mining collectors; do skipped "$s" || NEED_BACKEND=1; done
if [ "$NEED_BACKEND" = 1 ]; then
  command -v jq >/dev/null || die "нет jq (нужен для шагов минтов/тумблера: brew install jq / apt-get install jq)"
  command -v npx >/dev/null || die "нет npx (нужен для scripts/initConfig.ts и scripts/initMintsV2.ts)"
  # Backend проверяем ДО первой транзакции: деплой без возможности включить —
  # это половина работы, а отказ после деплоя труднее откатывать.
  [ -n "$ADMIN_TOKEN" ] || die \
    "не задан ADMIN_TOKEN: минты и тумблер добычи подписываются ключом backend'а в hot-режиме. Запустите backend (cd aof_backend && npm run dev) с AUTHORITY_MODE=hot/AUTHORITY_SECRET_KEY/RPC_URL и ADMIN_TOKEN, затем повторите с ADMIN_TOKEN=<токен>. Если сейчас нужен только деплой — SKIP=mints,caps,mining,collectors"
  STATE_HTTP="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$API_TIMEOUT" \
    -X GET "$BACKEND_URL/admin/config/mining" -H "Authorization: Bearer $ADMIN_TOKEN" || echo 000)"
  [ "$STATE_HTTP" = "200" ] || die "GET $BACKEND_URL/admin/config/mining вернул HTTP $STATE_HTTP: backend не запущен, недоступен или ADMIN_TOKEN неверный"
  ok "backend отвечает 200, ADMIN_TOKEN принят"
else
  ok "backend-шаги пропущены (SKIP) — ADMIN_TOKEN не нужен"
fi
ok "цель devnet, CLI на месте, ключ найден"

step "2/8 Ключ, баланс и состояние сети"
AUTHORITY_PUBKEY="$(solana address -k "$AUTHORITY_KEYPAIR" 2>/dev/null)" || die "ключ не читается как keypair-файл"
BALANCE="$(solana balance "$AUTHORITY_PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')" \
  || die "RPC недоступен из этой машины: $RPC_URL"
ok "оператор: $AUTHORITY_PUBKEY, баланс: ${BALANCE:-0} SOL"
case "${BALANCE:-0}" in
  0|0.0*) die "на ключе нет SOL: аренда аккаунта программы на девнете платная; попросите airdrop на $AUTHORITY_PUBKEY" ;;
esac
python3 "$PROBE" "$RPC_URL" || die "зонд не смог прочитать реестр программ (сеть или адреса)"

step "3/8 Сборка с своими ключами программ"
MISSING_ARTIFACTS=()
for name in aof_core aof_market aof_session_keys; do
  [ -f "$ARTIFACTS/$name.so" ] || MISSING_ARTIFACTS+=("$name")
done
if [ "${#MISSING_ARTIFACTS[@]}" -eq 0 ]; then
  ok "все .so на месте: $ARTIFACTS"
elif skipped build; then
  die "нет .so для ${MISSING_ARTIFACTS[*]}, а сборка пропущена (SKIP=build): положите свои target/deploy/*.so или уберите SKIP=build"
elif ! command -v anchor >/dev/null; then
  die "нет .so для ${MISSING_ARTIFACTS[*]} и нет anchor: установите Anchor (https://www.anchor-lang.com/docs/installation) или передайте ARTIFACTS с готовой локальной сборкой"
else
  info "не хватает: ${MISSING_ARTIFACTS[*]} — нужна локальная сборка (в CI declare_id! переписывается на чужие ключи, такой .so не годится)"
  do_or_tell "anchor build --no-idl (сборка с ключами из $ARTIFACTS)" anchor build --no-idl
  if [ "$APPLY" = 1 ]; then
    for name in "${MISSING_ARTIFACTS[@]}"; do
      [ -f "$ARTIFACTS/$name.so" ] || die "после сборки нет $ARTIFACTS/$name.so — посмотрите вывод anchor выше"
    done
    ok "сборка завершена"
  fi
fi

step "4/8 Деплой недостающих программ"
if skipped deploy; then
  info "деплой пропущен (SKIP=deploy)"
elif [ "$APPLY" = 1 ]; then
  AOF_DEPLOY_TARGET=devnet RPC_URL="$RPC_URL" AUTHORITY_KEYPAIR="$AUTHORITY_KEYPAIR" \
    ARTIFACTS="$ARTIFACTS" MIN_SOL="$MIN_SOL" PROBE="$PROBE" \
    scripts/deploy-devnet.sh --apply || die "деплой не прошёл (причина — в выводе выше)"
else
  AOF_DEPLOY_TARGET=devnet RPC_URL="$RPC_URL" AUTHORITY_KEYPAIR="$AUTHORITY_KEYPAIR" \
    ARTIFACTS="$ARTIFACTS" MIN_SOL="$MIN_SOL" PROBE="$PROBE" \
    scripts/deploy-devnet.sh || die "сухой прогон деплоя не прошёл (причина — в выводе выше)"
fi

step "5/8 Config, минты ресурсов и потолки выпуска"
if skipped config; then
  info "Config пропущен (SKIP=config)"
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
if skipped caps; then
  info "потолки выпуска пропущены (SKIP=caps)"
elif [ "$APPLY" = 1 ]; then
  ( cd aof_backend && npm run caps:init ) || die "caps:init не прошёл"
else
  echo "   сухой прогон: cd aof_backend && npm run caps:init"
fi

step "6/8 Тумблер добычи"
if skipped mining; then
  info "включение добычи пропущено (SKIP=mining)"
elif [ "$APPLY" != 1 ]; then
  echo "   сухой прогон: preflight:mining-devnet, затем PREFLIGHT_OK=1 scripts/enable-mining-devnet.sh --apply"
else
  PREFLIGHT_REPORT="$(mktemp)"
  set +e
  ( cd aof_backend && MINING_PREFLIGHT_REPORT="$PREFLIGHT_REPORT" npm run preflight:mining-devnet )
  PREFLIGHT_CODE=$?
  set -e
  echo "--- отчёт preflight ---"
  cat "$PREFLIGHT_REPORT" 2>/dev/null || true
  echo "--- конец отчёта ---"
  if [ "$PREFLIGHT_CODE" != 0 ] || grep -q 'BLOCKED' "$PREFLIGHT_REPORT" 2>/dev/null; then
    die "preflight не прошёл (BLOCKED): тумблер НЕ включаем — сначала закройте пункты отчёта. Файл: $PREFLIGHT_REPORT"
  fi
  ok "preflight без BLOCKED"
  PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet BASE_URL="$BACKEND_URL" ADMIN_TOKEN="$ADMIN_TOKEN" \
    scripts/enable-mining-devnet.sh --apply || die "включение добычи не прошло: причина — в выводе выше"
fi

step "7/8 Коллекционеры"
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
step "8/8 Итоговый читающий отчёт"
if skipped report; then
  info "итоговый зонд пропущен (SKIP=report)"
else
  python3 "$PROBE" "$RPC_URL" || true
fi

echo
if [ "$APPLY" = 1 ]; then
  echo "Включено этим прогоном (при отсутствии ошибок выше): добыча инструментов,"
  echo "ресурсы и крафт, паки, ремонт, газ-бак, коллекционеры, минты/капы,"
  echo "и все маршруты, которые читают Config/MaterialMints."
else
  echo "Это был сухой прогон: ничего не задеплоено и не включено."
  echo "Повторите ту же команду с --apply."
fi
echo
echo "Чтобы читались история, квесты и рынок, после включения держите запущенными сервисы:"
echo "  cd aof_backend && npm run chain-indexer   # курсоры aof_core/aof_market/aof_quests, health :8082"
echo "  cd aof_backend && npm run workers:all     # trust-worker, farm-trader, price-cranker по включённым механикам"
echo
echo "Осталось работой по контракту (не переключатель, docs/UNBLOCK_PLAN_2026-09-30.md §3):"
echo "  * ордербук: цена за целый ресурс + связанный intent (v2-инструкции);"
echo "  * перерождение: полный сброс сезонного состояния и активов одним действием;"
echo "  * лотерея: потолок цены max_price в инструкции покупки;"
echo "  * платный сезон-пропуск: раздельные треки и идемпотентные начисления (V2);"
echo "  * Potato: отдельный минт, казна и V2-инструкции барабана (docs/POTATO_DEVNET_SETUP.md);"
echo "  * рынок инструментов (hot market): обмен «инструмент ↔ SOL» без риска для сторон."
