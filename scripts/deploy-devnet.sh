#!/usr/bin/env bash
# Деплой программ на девнет — недостающий шаг, из-за которого игра закрыта.
#
# Факт (читающий зонд, 2026-09-30): на девнете отвечают только aof_quests,
# aof_rebirth и aof_liquidity. По адресам aof_core, aof_market и
# aof_session_keys аккаунтов НЕТ, а aof_core — это 113 инструкций: добыча,
# инструменты, ресурсы, крафт, паки, рынок, газ-бак. Пока его нет в сети, любая
# механика игры честно отдаёт 503 «нет данных из сети», и никакой переключатель
# это не исправит.
#
# Скрипт ничего не собирает сам: он берёт уже собранные .so (из CI-артефакта
# или из target/deploy после `anchor build`) и задеплоить их в правильные
# адреса. По умолчанию — сухой прогон, он только рассказывает, что будет.
#
# Использование:
#   AOF_DEPLOY_TARGET=devnet scripts/deploy-devnet.sh              # сухой прогон
#   AOF_DEPLOY_TARGET=devnet scripts/deploy-devnet.sh --apply      # деплой
#   AOF_DEPLOY_TARGET=devnet ARTIFACTS=/path/to/artifact scripts/deploy-devnet.sh --apply
#
# Обязательные условия (без них выход 3 и ни одной транзакции):
#   * цель ровно devnet — mainnet этим скриптом не деплоится;
#   * ключ оператора: AUTHORITY_KEYPAIR (по умолчанию solana/keys/aof-authority-devnet.json);
#   * CLI solana в PATH и ≥ MIN_SOL SOL на нём (аренда аккаунта программы платная);
#   * для каждого нового адреса — ключ программы target/deploy/<name>-keypair.json,
#     чей pubkey РАВЕН объявленному адресу. Создать программу по адресу без её
#     ключа нельзя: подписывает сам аккаунт программы. Если ключа нет, адрес
#     придётся менять во всех местах разом (declare_id!, Anchor.toml, реестр,
#     IDL, клиент) — скрипт об этом честно скажет и остановится.
#
# Ключ никогда не печатается: только pubkey и наличие файла.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APPLY=0
case "${1:-}" in
  "") ;;
  --apply) APPLY=1 ;;
  *) echo "использование: $0 [--apply]" >&2; exit 2 ;;
esac
RPC_URL="${RPC_URL:-https://api.devnet.solana.com}"
AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-solana/keys/aof-authority-devnet.json}"
ARTIFACTS="${ARTIFACTS:-target/deploy}"
ONLY="${ONLY:-}"                     # список имён через запятую; пусто = все недостающие
MIN_SOL="${MIN_SOL:-1}"               # минимум на ключе перед деплоем
PROBE="${PROBE:-scripts/devnet-program-probe.py}"

# Проверяет, что в собранной программе действительно зашит объявленный адрес.
# Зачем: `declare_id!` попадает в бинарник, и Anchor сверяет его на каждом вызове
# (DeclaredProgramIdMismatch). Сборка в CI специально переписывает declare_id! на
# временные ключи раннера, поэтому .so из CI-артефакта на девнете не заработает —
# такую ошибку дешевле поймать здесь, чем после деплоя.
verify_so_id() { # $1 — файл .so, $2 — base58 адрес
  python3 - "$1" "$2" <<'PYID'
import sys
ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
path, address = sys.argv[1], sys.argv[2]
value = 0
for char in address:
    index = ALPHABET.find(char)
    if index < 0:
        sys.exit(2)
    value = value * 58 + index
raw = value.to_bytes(32, 'big')
with open(path, 'rb') as handle:
    sys.exit(0 if raw in handle.read() else 1)
PYID
}

die() { echo >&2; echo "ОТКАЗ: $*" >&2; exit 3; }
ok()   { echo "   ✓ $*"; }
step() { echo; echo "== $*"; }

step "1/6 Предохранители"
[ "${AOF_DEPLOY_TARGET:-}" = "devnet" ] || die "нужен AOF_DEPLOY_TARGET=devnet (получено '${AOF_DEPLOY_TARGET:-<пусто>}'); mainnet этим скриптом не деплоится"
command -v solana >/dev/null || die "нет CLI solana в PATH (docs: https://docs.anza.xyz/cli/install)"
[ -f "$AUTHORITY_KEYPAIR" ] || die "нет ключа оператора: $AUTHORITY_KEYPAIR (в чат его не присылайте, положите файлом на своей машине)"
ok "цель devnet, CLI на месте, ключ найден"

step "2/6 Ключ и баланс"
AUTHORITY_PUBKEY="$(solana address -k "$AUTHORITY_KEYPAIR" 2>/dev/null)" || die "ключ не читается как keypair-файл"
BALANCE="$(solana balance "$AUTHORITY_PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')" || die "RPC недоступен: $RPC_URL"
ok "оператор: $AUTHORITY_PUBKEY, баланс: ${BALANCE:-0} SOL (нужно минимум $MIN_SOL SOL + аренда аккаунтов программ)"
case "${BALANCE:-0}" in 0|0.0*) die "на ключе нет SOL: аренда аккаунта программы на девнете платная; попросите airdrop на $AUTHORITY_PUBKEY";; esac

step "3/6 Что уже есть в сети"
MISSING=()
while read -r name address; do
  if solana account "$address" --url "$RPC_URL" >/dev/null 2>&1; then
    ok "$name уже отвечает на $address"
  else
    echo "   ✗ $name отсутствует: $address"
    MISSING+=("$name $address")
  fi
done < <(python3 - "$ONLY" <<'PY'
import json, sys
registry = json.load(open('watchtower/addresses.json'))
only = {s for s in (sys.argv[1].split(',') if len(sys.argv) > 1 and sys.argv[1] else []) if s}
for p in registry['programs']:
    if only and p['name'] not in only:
        continue
    print(p['name'], p['address'])
PY
)
[ "${#MISSING[@]}" -gt 0 ] || { step "готово"; echo "   Все выбранные программы уже в сети — деплоить нечего."; python3 "$PROBE" "$RPC_URL" || true; exit 0; }
echo "   К деплою: ${#MISSING[@]}"

step "4/6 Ключи программ и собранные .so"
TO_DEPLOY=()
for entry in "${MISSING[@]}"; do
  name="${entry%% *}"; address="${entry##* }"
  so="$ARTIFACTS/$name.so"
  keypair="$ARTIFACTS/$name-keypair.json"
  [ -f "$so" ] || die "нет собранной программы: $so (соберите 'anchor build --no-idl' или возьмите артефакт из CI: Actions → Build program artifacts)"
  [ -f "$keypair" ] || die "нет ключа программы $keypair.
   Чтобы создать программу по адресу $address, нужен именно его keypair: аккаунт программы подписывает свой деплой.
   Варианты: (1) взять файл с машины, где программа собиралась; (2) сменить адрес — тогда его нужно
   переписать сразу в declare_id!, Anchor.toml ([programs.*]), watchtower/addresses.json, src/idl/*.json,
   aof_backend/src/config.ts и frontend/src/lib/*; после этого CI (AOF readiness) поймает расхождения."
  actual="$(solana address -k "$keypair" 2>/dev/null)" || die "ключ программы $keypair не читается"
  [ "$actual" = "$address" ] || die "ключ $keypair принадлежит адресу $actual, а объявлен $address — деплой в чужой адрес запрещён"
  verify_so_id "$so" "$address" || die "в собранной программе $so нет объявленного адреса $address.
   Так бывает, когда .so взят из CI-артефакта: сборка в CI переписывает declare_id! на временные ключи раннера,
   и Anchor отвергнет каждый вызов (DeclaredProgramIdMismatch). Соберите локально: 'anchor build --no-idl',
   положив свои target/deploy/$name-keypair.json на место — тогда адрес в бинарнике совпадёт."
  ok "$name: $so + ключ, и адрес действительно зашит в программу"
  TO_DEPLOY+=("$name $address $so $keypair")
done

step "5/6 Деплой"
if [ "$APPLY" != 1 ]; then
  echo "   сухой прогон, транзакций не будет. Команды, которые выполнились бы:"
  for entry in "${TO_DEPLOY[@]}"; do
    set -- $entry
    echo "   solana program deploy --url $RPC_URL --keypair $AUTHORITY_KEYPAIR --program-id $4 $3"
  done
  echo "   повторите с --apply, чтобы выполнить"
  exit 0
fi
for entry in "${TO_DEPLOY[@]}"; do
  set -- $entry
  echo "   деплой $1 → $2"
  solana program deploy --url "$RPC_URL" --keypair "$AUTHORITY_KEYPAIR" --program-id "$4" "$3" \
    || die "деплой $1 не прошёл: смотрите вывод выше (частая причина — не хватает SOL на аренду)"
  ok "$1 задеплоен"
done

step "6/6 Проверка после деплоя"
python3 "$PROBE" "$RPC_URL" || true
echo
echo "Дальше можно одной командой (Config → минты → капы → добыча → коллекционеры):"
echo "  AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh              # сухой прогон"
echo "  AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply      # включить"
echo
echo "Тот же порядок вручную (docs/UNBLOCK_PLAN_2026-09-30.md §0):"
echo "  1) инициализация Config:            cd aof_backend && npx ts-node scripts/initConfig.ts"
echo "  2) минты ресурсов:                  npx ts-node scripts/initMintsV2.ts"
echo "  3) потолки выпуска:                 npm run caps:init"
echo "  4) включение добычи:                scripts/enable-mining-devnet.sh --apply"
echo "  5) allowlist коллекционеров:        POST /admin/config/collector-mint"
