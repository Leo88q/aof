#!/usr/bin/env bash
# Включение добычи инструментов — строго в безопасном порядке.
#
# Зачем порядок. `Config.mining_enabled = false` (kill-switch [AUDIT F-27])
# закрывает и `start_mining`, и `collect_mining`. Если включить тумблер раньше
# выплатных минтов, старт пройдёт, а сбор упрётся в
# MINING_TOOL_REWARD_NOT_CONFIGURED: прочность инструмента сгорит, выплаты не
# будет, и доказать это игроку невозможно. Поэтому скрипт сначала проверяет
# четыре выплатных адреса (ровно те, что читает
# aof_backend/src/lib/toolResourceMint.ts), затем MaterialMints целиком, и
# только потом включает флаг.
#
# Что скрипт НЕ делает: не проверяет байткод программ, не подписывает ничего
# своим ключом, не создаёт минтов. Он вызывает админ-API бэкенда тем же
# ключом, что и оператор, и печатает проверяемое состояние до/после.
#
# Сухой прогон по умолчанию — ничего не меняет, печатает шаги:
#   PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet BASE_URL=http://localhost:8080 \
#   ADMIN_TOKEN=<токен> scripts/enable-mining-devnet.sh
# Реальное включение — только после отдельного успешного Devnet smoke:
#   MINING_SMOKE_OK=1 PREFLIGHT_OK=1 AOF_ENABLE_TARGET=devnet ... --apply
# Для намеренно неограниченной cumulative issuance только на Devnet дополнительно
# задайте ALLOW_UNLIMITED_DEVNET_ISSUANCE=1 и при запуске preflight, и здесь,
# плюс передайте MINING_PREFLIGHT_REPORT от того же чистого preflight.
#
# Предохранители (все обязательны, иначе выход 3 без единого POST):
#   * AOF_ENABLE_TARGET=devnet            — mainnet этим скриптом не включается;
#   * ALLOW_UNLIMITED_DEVNET_ISSUANCE=1   — явное принятие unlimited lifetime issuance;
#     MINING_PREFLIGHT_REPORT            — при этом обязателен read-only отчёт
#                                           без blockers и с этим же policy acknowledgement;
#   * PREFLIGHT_OK=1                      — сначала запустить preflight и прочитать
#                                           отчёт (BLOCKED не считается OK);
#   * MINING_SMOKE_OK=1 при --apply       — ручное подтверждение отдельного smoke;
#   * валидный ADMIN_TOKEN                — GET /admin/config/mining отвечает;
#   * четыре выплатных минта заданы       — circuitMint, siliconMint, dataset, neuron;
#   * MaterialMints проходит канонический валидатор бэкенда
#                                           (/query/material-mints = 200).
set -euo pipefail

PLACEHOLDER='11111111111111111111111111111111'
API_TIMEOUT="${API_TIMEOUT:-20}"
APPLY=0
case "${1:-}" in
  "") ;;
  --apply) APPLY=1 ;;
  *) echo "использование: $0 [--apply]" >&2; exit 2 ;;
esac
if [ $# -gt 1 ]; then echo "использование: $0 [--apply]" >&2; exit 2; fi

BASE_URL="${BASE_URL:-http://localhost:8080}"
BASE_URL="${BASE_URL%/}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
ALLOW_UNLIMITED_DEVNET_ISSUANCE="${ALLOW_UNLIMITED_DEVNET_ISSUANCE:-0}"
MINING_SMOKE_OK="${MINING_SMOKE_OK:-0}"

die() { echo "ОТКАЗ: $*" >&2; exit "${2:-3}"; }
step() { echo; echo "== $*"; }
ok() { echo "   ✓ $*"; }

# Токен никогда не печатается: только наличие/длина.
api() { # METHOD PATH [BODY]
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS --max-time "$API_TIMEOUT" -X "$method" "$BASE_URL$path"
              -H 'Content-Type: application/json')
  [ -n "$ADMIN_TOKEN" ] && args+=(-H "Authorization: Bearer $ADMIN_TOKEN")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

api_code() { # METHOD PATH — только HTTP-код
  local method="$1" path="$2"
  curl -sS -o /dev/null -w '%{http_code}' --max-time "$API_TIMEOUT" -X "$method" \
    "$BASE_URL$path" -H 'Content-Type: application/json' \
    ${ADMIN_TOKEN:+-H "Authorization: Bearer $ADMIN_TOKEN"} || echo 000
}

command -v curl >/dev/null || die "нужен curl" 2
command -v jq >/dev/null || die "нужен jq" 2

echo "Включение добычи: цель=$BASE_URL, режим=$([ "$APPLY" = 1 ] && echo ПРИМЕНЕНИЕ || echo 'сухой прогон')"

step "1/6 Предохранители"
[ "${AOF_ENABLE_TARGET:-}" = "devnet" ] || die \
  "AOF_ENABLE_TARGET должен быть ровно devnet (получено '${AOF_ENABLE_TARGET:-<пусто>}'); этот скрипт не включает добычу на mainnet" 
[ "${PREFLIGHT_OK:-}" = "1" ] || die \
  "нужен PREFLIGHT_OK=1: сначала выполните preflight и убедитесь, что в отчёте нет BLOCKED"
if [ "$APPLY" = 1 ]; then
  [ "$MINING_SMOKE_OK" = "1" ] || die \
    "для --apply после отдельного успешного Devnet smoke укажите MINING_SMOKE_OK=1"
fi
case "$ALLOW_UNLIMITED_DEVNET_ISSUANCE" in
  0) ;;
  1)
    [ -n "${MINING_PREFLIGHT_REPORT:-}" ] || die \
      "для uncapped Devnet policy передайте MINING_PREFLIGHT_REPORT от последнего preflight"
    [ -f "$MINING_PREFLIGHT_REPORT" ] || die "файл preflight не найден: $MINING_PREFLIGHT_REPORT"
    jq -e '
      .network == "devnet"
      and .observations.genesisHash == "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
      and .status == "READ_ONLY_PREFLIGHT_PASSED_BYTECODE_AND_SMOKE_REQUIRED"
      and (.blockers | type == "array" and length == 0)
      and .observations.lifetimeIssuancePolicy.mode == "unlimited-devnet-accepted"
    ' "$MINING_PREFLIGHT_REPORT" >/dev/null || die \
      "preflight report не подтверждает чистый Devnet и явно принятую unlimited policy"
    ok "оператор явно принимает unlimited lifetime issuance на Devnet; это не конечный supply cap"
    ;;
  *) die "ALLOW_UNLIMITED_DEVNET_ISSUANCE должен быть 0 или 1" ;;
esac
ok "цель — devnet, предварительная проверка сети отмечена как пройденная"

step "2/6 Админ-доступ и текущее состояние тумблера"
ADMIN_STATE="$(api GET /admin/config/mining)" || die "POST недоступен: $ADMIN_STATE"
echo "$ADMIN_STATE" | jq -e '.miningEnabled == true or .miningEnabled == false' >/dev/null \
  || die "GET /admin/config/mining вернул неожиданное: $ADMIN_STATE (проверьте ADMIN_TOKEN)"
MINING_ENABLED="$(echo "$ADMIN_STATE" | jq -r '.miningEnabled')"
ok "miningEnabled=$MINING_ENABLED"

step "3/6 Выплатные адреса инструментов (§1.5 плана)"
CONFIG_JSON="$(api GET /query/config)" || die "не прочитан Config: $CONFIG_JSON"
MATERIALS_HTTP="$(api_code GET /query/material-mints)"
MATERIALS_JSON="$(api GET /query/material-mints)"
blockers=()
check_mint() { # ЧЕЛОВЕКОЧИТАЕМОЕ ИМЯ ЗНАЧЕНИЕ
  local label="$1" value="${2:-}"
  if [ -z "$value" ] || [ "$value" = "null" ] || [ "$value" = "$PLACEHOLDER" ]; then
    blockers+=("$label")
    echo "   ✗ $label не задан (значение: ${value:-<пусто>})"
  else
    ok "$label=$value"
  fi
}
check_mint "Config.circuitMint  (plasma_cutter → CIRCUIT)"  "$(echo "$CONFIG_JSON" | jq -r '.circuitMint // empty')"
check_mint "Config.siliconMint (silicon_extractor → SILICON)" "$(echo "$CONFIG_JSON" | jq -r '.siliconMint // empty')"
if [ "$MATERIALS_HTTP" != "200" ]; then
  blockers+=("MaterialMints (/query/material-mints = $MATERIALS_HTTP)")
  echo "   ✗ MaterialMints не проходит канонический валидатор: HTTP $MATERIALS_HTTP $(echo "$MATERIALS_JSON" | jq -rc '.error // empty')"
else
  MATERIAL_MINTS="$(echo "$MATERIALS_JSON" | jq -r '.mints // {}')"
  # /query/material-mints publishes canonical ResourceMintKey names (DATASET, NEURON).
  # Older fixtures used the account field names (dataset, neuron). Accept both.
  check_mint "MaterialMints.dataset  (data_harvester, quantum_transmitter → DATASET)" "$(echo "$MATERIAL_MINTS" | jq -r '.DATASET // .dataset // empty')"
  check_mint "MaterialMints.neuron (neural_seeder → NEURON)" "$(echo "$MATERIAL_MINTS" | jq -r '.NEURON // .neuron // empty')"
fi

step "4/6 Решение"
if [ "${#blockers[@]}" -gt 0 ]; then
  printf '   закрыто: %s\n' "${blockers[@]}"
  die "выплаты не готовы, тумблер НЕ включаем: иначе сбор добычи сожжёт прочность инструмента без выплаты. Сначала закройте четыре выплаты из шагов выше и повторите"
fi
if [ "$MINING_ENABLED" = "true" ]; then
  ok "добыча уже включена — делать нечего"
  echo
  echo "Проверка игроком: POST /tools/start-mining, затем POST /tools/collect-mining."
  echo "Выключить обратно: POST /admin/config/mining {\"enabled\":false}"
  exit 0
fi
ok "все четыре выплаты на месте — можно включать"

step "5/6 Включение тумблера"
if [ "$APPLY" != 1 ]; then
  echo "   сухой прогон: POST /admin/config/mining {\"enabled\":true} не выполняется"
  echo "   повторите тот же вызов с --apply, чтобы включить"
else
  RESULT="$(api POST /admin/config/mining '{"enabled":true}')"
  echo "$RESULT" | jq -e '.sig' >/dev/null || die "тумблер не включился: $RESULT"
  ok "транзакция: $(echo "$RESULT" | jq -r '.sig')"
fi

step "6/6 Проверка после включения"
if [ "$APPLY" != 1 ]; then
  echo "   сухой прогон: проверка не выполняется"
else
  sleep 3
  AFTER="$(api GET /admin/config/mining)"
  [ "$(echo "$AFTER" | jq -r '.miningEnabled')" = "true" ] || die "флаг не читается как true после включения: $AFTER"
  ok "miningEnabled=true"
  echo
  echo "Дальше:"
  echo "  1) игрок: start_mining, затем collect_mining — выплата приходит на минт из шага 3;"
  echo "  2) ремонт: POST /tools/repair должен отвечать 200 (Config.siliconMint/circuitMint уже заданы);"
  echo "  3) выключить обратно: POST /admin/config/mining {\"enabled\":false}"
fi
