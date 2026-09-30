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
#   * ключи программ target/deploy/<name>-keypair.json, чьи pubkey равны
#     объявленным адресам (иначе см. §0.1: PROGRAMS=... scripts/dev-local.sh keys --apply);
#   * solana CLI; для сборки — anchor; для шагов 5–7 — работающий backend
#     (BACKEND_URL, ADMIN_TOKEN) в hot-режиме, потому что минты и тумблер добычи
#     подписываются его ключом (AUTHORITY_SECRET_KEY);
#   * для шага collector — COLLECTOR_MINTS="<mint>:historian,<mint>:medallion"
#     (адреса минтов инструментов, попадающих в allowlist коллекционеров).
#
# Переменные окружения:
#   RPC_URL, AUTHORITY_KEYPAIR, ARTIFACTS, BACKEND_URL, ADMIN_TOKEN, MIN_SOL,
#   COLLECTOR_MINTS,
#   SKIP=build,deploy,config,mints,caps,craft,mechanics,market,mining,collectors,report
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
# docs/UNBLOCK_PLAN_2026-09-30.md §3, которые ещё требуют работы по контракту
# (сессионные ключи, платный сезон-пропуск, Potato V2), скрипт печатает в конце
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
AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-solana/keys/aof-authority-devnet.json}"
ARTIFACTS="${ARTIFACTS:-target/deploy}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
BACKEND_URL="${BACKEND_URL%/}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
MIN_SOL="${MIN_SOL:-1}"
SKIP="${SKIP:-}"
COLLECTOR_MINTS="${COLLECTOR_MINTS:-}"
PROBE="${PROBE:-scripts/devnet-program-probe.py}"
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

step "1/10 Предохранители"
[ "${AOF_DEPLOY_TARGET:-}" = "devnet" ] || die \
  "нужен AOF_DEPLOY_TARGET=devnet (получено '${AOF_DEPLOY_TARGET:-<пусто>}'); mainnet этим скриптом не включается"
command -v solana >/dev/null || die "нет CLI solana в PATH (docs: https://docs.anza.xyz/cli/install)"
command -v curl >/dev/null || die "нет curl"
[ -f "$AUTHORITY_KEYPAIR" ] || die \
  "нет ключа оператора: $AUTHORITY_KEYPAIR (файл кладётся на своей машине, в чат его присылать нельзя)"
[ -f "$PROBE" ] || die "нет читающего зонда $PROBE"
NEED_BACKEND=0
for s in mints caps market mining collectors; do skipped "$s" || NEED_BACKEND=1; done
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

step "2/10 Ключ, баланс и состояние сети"
AUTHORITY_PUBKEY="$(solana address -k "$AUTHORITY_KEYPAIR" 2>/dev/null)" || die "ключ не читается как keypair-файл"
BALANCE="$(solana balance "$AUTHORITY_PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')" \
  || die "RPC недоступен из этой машины: $RPC_URL"
ok "оператор: $AUTHORITY_PUBKEY, баланс: ${BALANCE:-0} SOL"
case "${BALANCE:-0}" in
  0|0.0*) die "на ключе нет SOL: аренда аккаунта программы на девнете платная; попросите airdrop на $AUTHORITY_PUBKEY" ;;
esac
python3 "$PROBE" "$RPC_URL" || die "зонд не смог прочитать реестр программ (сеть или адреса)"

step "3/10 Сборка с своими ключами программ"
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

step "4/10 Деплой недостающих программ"
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

step "5/10 Config, минты, потолки выпуска и экономика крафта"
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
  # трек пропуска этим НЕ включается — он остаётся работой по контракту (§3.6),
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
  #   core — MARKET_CORE_MINT → Config.potatoMint (внутриигровой MIND);
  #   gem  — MARKET_GEM_MINT  → MaterialMints.gem_blue (QUANTUM_BIT);
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
      MARKET_CORE_MINT="$(printf '%s' "$CORE_STATE" | jq -r '.potatoMint // empty')"
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
echo "  * перерождение: полный сброс сезонного состояния и излишков одной транзакцией (§3.4)."
echo
echo "Горячий рынок включается этим же прогоном (шаг 7): MarketConfig, валюты пула"
echo "и пулы редкостей. Панель рынка читает цены и инвентарь из сети, а владение"
echo "инструментом переводит aof_core::transfer_tool через CPI — покупатель сразу"
echo "может майнить и ремонтировать купленный инструмент."
echo
echo "Осталось работой по контракту (не переключатель, docs/UNBLOCK_PLAN_2026-09-30.md §3):"
echo "  * сессионные ключи: резерв лимита обязан быть атомарно привязан к целевой инструкции (§3.3);"
echo "  * платный сезон-пропуск: сезон создан, но продажа пропуска — раздельные"
echo "    треки и идемпотентные начисления (V2) (§3.6);"
echo "  * Potato: отдельный минт, казна и V2-инструкции барабана (§3.7, docs/POTATO_DEVNET_SETUP.md)."
echo
echo "Проверить всё это в любой момент (ничего не подписывает):"
echo "  python3 scripts/devnet-program-probe.py $RPC_URL"
