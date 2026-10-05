#!/usr/bin/env bash
# Деплой программ на девнет — недостающий шаг, из-за которого игра закрыта.
#
# Факт (читающий зонд, 2026-09-30): на девнете отвечают только aof_quests,
# aof_rebirth и aof_liquidity. По адресам aof_core, aof_market и
# aof_session_keys аккаунтов НЕТ, а aof_core — это 120 инструкций: добыча,
# инструменты, ресурсы, крафт, паки, рынок, газ-бак. Пока его нет в сети, любая
# механика игры честно отдаёт 503 «нет данных из сети», и никакой переключатель
# это не исправит.
#
# Скрипт ничего не собирает сам: он берёт уже собранные .so (из CI-артефакта
# или из target/deploy после `anchor build`) и задеплоить их в правильные
# адреса. По умолчанию — сухой прогон, он только рассказывает, что будет.
#
# Использование:
#   PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet scripts/deploy-devnet.sh          # сухой прогон
#   PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet scripts/deploy-devnet.sh --apply  # деплой
#   AOF_DEPLOY_TARGET=devnet ARTIFACTS=/path/to/artifact PROGRAM_MAX_LEN_POLICY=exact scripts/deploy-devnet.sh --apply
#
# Обновление уже развёрнутой программы (новый код в уже живущем адресе) — только
# явным списком, потому что это замена работающего байткода:
#   UPGRADE=aof_core PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet scripts/deploy-devnet.sh --apply
#   UPGRADE=all      ... # обновить всё, что отличается от локальной сборки
# Скрипт сам сверяет байткод в сети с локальным .so (upgrade-state) и обновляет
# только отличающееся; совпавшее остаётся нетронутым. Ключ программы для upgrade
# не нужен — аккаунт уже создан, подписывает upgrade authority. Ёмкость ProgramData
# при этом не уменьшается (загрузчик умеет только расширять), поэтому пост-проверка
# сверяется с фактической ёмкостью из сети, а не с policy-значением.
#
# Обязательные условия (без них выход 3 и ни одной транзакции):
#   * цель ровно devnet — mainnet этим скриптом не деплоится; RPC обязан
#     отвечать genesis-хешем devnet (имя URL ничего не доказывает);
#   * ёмкость программ задана ЯВНО: PROGRAM_MAX_LEN_POLICY = exact | headroom |
#     legacy-2x (для headroom ещё PROGRAM_MAX_LEN_HEADROOM_PERCENT=1..99).
#     Без значения скрипт отказывает: CLI без --max-len молча берёт ровно размер
#     .so (Agave v4.2.1, cli/src/program.rs:1414), то есть решение «без запаса»
#     принималось бы за владельца. Скрипт ВСЕГДА передаёт --max-len сам.
#     Политика действует только здесь, на devnet, и к mainnet не применяется;
#   * ключ оператора: AUTHORITY_KEYPAIR (по умолчанию solana/keys/aof-authority-devnet.json);
#   * CLI solana в PATH; баланс оператора покрывает ВСЕ недостающие программы
#     сразу (рента Program + ProgramData каждой, комиссии и явные резервы
#     OPERATOR_RESERVE_SOL / DEPLOY_FEE_RESERVE_SOL) — это проверяется в шаге 5
#     до первой транзакции; MIN_SOL=1 достаточностью не считается;
#   * для каждого НОВОГО адреса — ключ программы target/deploy/<name>-keypair.json,
#     чей pubkey РАВЕН объявленному адресу. Создать программу по адресу без её
#     ключа нельзя: подписывает сам аккаунт программы. Для UPGRADE ключ не нужен. Если ключа нет, адрес
#     придётся менять во всех местах разом (declare_id!, Anchor.toml, реестр,
#     IDL, клиент) — скрипт об этом честно скажет и остановится.
#
# Повторный запуск безопасен: уже развёрнутые программы пропускаются, а после
# каждого деплоя состояние проверяется в сети (владелец, authority, ёмкость,
# хеш байткода). «Осиротевшие» buffer-аккаунты прерванных деплоев скрипт только
# ПОКАЗЫВАЕТ — закрывать их или нет, решает владелец (см. docs/DEVNET_DEPLOY_COSTS.md).
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
UPGRADE="${UPGRADE:-}"               # имена через запятую или all: обновить уже развёрнутые программы,
                                     # у которых байткод в сети отличается от локальной сборки (без этого
                                     # программа в сети считается «готовой» и скрипт её не трогает)
MIN_SOL="${MIN_SOL:-1}"               # минимум на ключе перед деплоем
PROBE="${PROBE:-scripts/devnet-program-probe.py}"
ESTIMATOR="${ESTIMATOR:-scripts/devnet-deploy-estimator.py}"
# Тот же genesis, что в aof_backend/scripts/miningDevnetPreflight.ts и scripts/verify-address-registry.cjs.
DEVNET_GENESIS_HASH="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
# Резервы — отдельные явные строки расчёта. Прежний MIN_SOL («оставить на ключе») теперь резерв оператора по умолчанию.
OPERATOR_RESERVE_SOL="${OPERATOR_RESERVE_SOL:-$MIN_SOL}"
DEPLOY_FEE_RESERVE_SOL="${DEPLOY_FEE_RESERVE_SOL:-0.1}"
estimator() { python3 "$ESTIMATOR" "$@"; }

# UPGRADE=all|имя1,имя2 — выбрано ли имя к обновлению. Пробелы убираются, чтобы
# «aof_core, aof_market» не превращалось в неизвестное имя « aof_market».
UPGRADE="$(printf '%s' "$UPGRADE" | tr -d ' ')"
upgrade_requested() { # $1 — имя программы
  case ",$UPGRADE," in
    *,all,*) return 0 ;;
    *",$1,"*) return 0 ;;
    *) return 1 ;;
  esac
}
# Имена всех программ реестра — чтобы опечатка в UPGRADE отказывала, а не молчала.
registry_names() {
  python3 - <<'PY'
import json
registry = json.load(open('watchtower/addresses.json'))
print(' '.join(p['name'] for p in registry['programs']))
PY
}

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
info() { echo "   $*"; }
step() { echo; echo "== $*"; }

step "1/7 Предохранители"
[ "${AOF_DEPLOY_TARGET:-}" = "devnet" ] || die "нужен AOF_DEPLOY_TARGET=devnet (получено '${AOF_DEPLOY_TARGET:-<пусто>}'); mainnet этим скриптом не деплоится"
command -v solana >/dev/null || die "нет CLI solana в PATH (docs: https://docs.anza.xyz/cli/install)"
command -v python3 >/dev/null || die "нет python3 (нужен оценщику стоимости и проверкам после деплоя)"
[ -f "$AUTHORITY_KEYPAIR" ] || die "нет ключа оператора: $AUTHORITY_KEYPAIR (в чат его не присылайте, положите файлом на своей машине)"
[ -f "$ESTIMATOR" ] || die "нет оценщика стоимости $ESTIMATOR"
# Политика max_len проверяется ДО любого обращения к сети: молчаливого значения нет.
POLICY_LABEL="$(estimator check-policy 2>&1)" || die "политика max_len: ${POLICY_LABEL#ОТКАЗ: }"
ok "цель devnet, CLI на месте, ключ найден"
ok "ёмкость программ (max-len): $POLICY_LABEL — задана явно, передаётся в каждый деплой"
CLI_VERSION="$(solana --version 2>/dev/null || true)"
[ -z "$CLI_VERSION" ] || info "CLI: $CLI_VERSION (проект закреплён на Agave 4.2.1; --max-len передаётся явно, поэтому умолчания CLI не важны)"

step "2/7 Ключ, кластер и баланс"
AUTHORITY_PUBKEY="$(solana address -k "$AUTHORITY_KEYPAIR" 2>/dev/null)" || die "ключ не читается как keypair-файл"
# Название URL не доказывает сеть: AOF_DEPLOY_TARGET=devnet с mainnet-RPC иначе деплоил бы на mainnet.
GENESIS_REPORT="$(estimator cluster --rpc "$RPC_URL" --expect-genesis "$DEVNET_GENESIS_HASH" 2>&1)" \
  || die "RPC не подтверждён как devnet: ${GENESIS_REPORT#ОТКАЗ: }"
ok "RPC отвечает genesis-хешем devnet"
BALANCE="$(solana balance "$AUTHORITY_PUBKEY" --url "$RPC_URL" 2>/dev/null | awk '{print $1}')" || die "RPC недоступен: $RPC_URL"
ok "оператор: $AUTHORITY_PUBKEY, баланс: ${BALANCE:-0} SOL (достаточность по ВСЕМ программам считается в шаге 5; MIN_SOL её не заменяет)"
case "${BALANCE:-0}" in 0|0.0*) die "на ключе нет SOL: аренда аккаунта программы на девнете платная; попросите airdrop на $AUTHORITY_PUBKEY";; esac

step "3/7 Что уже есть в сети"
MISSING=()
UPGRADES=()   # "имя адрес" — уже в сети, но байткод отличается от локальной сборки
if [ -n "$UPGRADE" ]; then
  ALL_NAMES="$(registry_names)"
  for want in $(printf '%s' "$UPGRADE" | tr ',' ' '); do
    [ "$want" = "all" ] && continue
    case " $ALL_NAMES " in
      *" $want "*) ;;
      *) die "UPGRADE=$want, но такой программы нет в реестре watchtower/addresses.json (есть: $ALL_NAMES)" ;;
    esac
  done
  info "UPGRADE=$UPGRADE: уже развёрнутые программы будут обновлены, если байткод в сети отличается от локальной сборки"
fi
while read -r name address; do
  if solana account "$address" --url "$RPC_URL" >/dev/null 2>&1; then
    if upgrade_requested "$name"; then
      so="$ARTIFACTS/$name.so"
      [ -f "$so" ] || die "UPGRADE=$name, но нет локальной сборки $so: соберите 'anchor build --no-idl' или уберите $name из UPGRADE"
      report="$(estimator upgrade-state --rpc "$RPC_URL" --program "$name:$address:$so" 2>&1)" || die "UPGRADE=$name: состояние программы в сети не прочиталось:
$report"
      state="$(printf '%s\n' "$report" | awk '/^state:/{print $2}')"
      uauth="$(printf '%s\n' "$report" | awk '/^authority:/{print $2}')"
      case "$state" in
        same)
          ok "$name уже в сети, байткод совпадает с $so — upgrade не нужен" ;;
        different)
          # Authority сверяется ДО деплоя: CLI сначала фиксирует SOL в буфере и
          # только потом отправляет upgrade, а загрузчик отвергнет чужую authority
          # (Incorrect upgrade authority) — то есть рента 2.6-МБ программы
          # осталась бы заперта в буфере из-за ошибки, которую видно одним
          # read-only запросом.
          [ "$uauth" = "$AUTHORITY_PUBKEY" ] || die "UPGRADE=$name: upgrade authority в сети $uauth, а ключ оператора $AUTHORITY_PUBKEY (AUTHORITY_KEYPAIR) — обновление запрещено.
   Обновлять программу может только её upgrade authority. Ни одной транзакции не отправлено:
   иначе CLI запер бы SOL в буфере и отказ пришёл бы уже после траты."
          info "⇪ $name уже в сети, но байткод отличается от $so — будет upgrade (authority $uauth; ёмкость в сети не уменьшается: загрузчик умеет только расширять ProgramData)"
          UPGRADES+=("$name $address") ;;
        *)
          die "UPGRADE=$name: не понял состояние '$state' (ожидалось same|different):
$report" ;;
      esac
    else
      ok "$name уже отвечает на $address"
    fi
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
if [ "${#MISSING[@]}" -eq 0 ] && [ "${#UPGRADES[@]}" -eq 0 ]; then
  step "готово"; echo "   Все выбранные программы уже в сети — деплоить нечего."
  python3 "$PROBE" "$RPC_URL" || true; exit 0
fi
[ "${#MISSING[@]}" -eq 0 ] || echo "   К деплою: ${#MISSING[@]}"
[ "${#UPGRADES[@]}" -eq 0 ] || echo "   К обновлению: ${#UPGRADES[@]}"

step "4/7 Ключи программ и собранные .so"
TO_DEPLOY=()
# Оба цикла под защитой длины массива: в bash 3.2 (macOS) `"${arr[@]}"` у пустого
# массива при `set -u` — ошибка «unbound variable» (исправлено только в 4.4), а
# после появления UPGRADE возможен запуск без единой отсутствующей программы.
if [ "${#MISSING[@]}" -gt 0 ]; then
for entry in "${MISSING[@]}"; do
  name="${entry%% *}"; address="${entry##* }"
  so="$ARTIFACTS/$name.so"
  keypair="$ARTIFACTS/$name-keypair.json"
  [ -f "$so" ] || die "нет собранной программы: $so (соберите 'anchor build --no-idl' или возьмите артефакт из CI: Actions → Build program artifacts)"
  [ -f "$keypair" ] || die "нет ключа программы $keypair.
   Чтобы создать программу по адресу $address, нужен именно его keypair: аккаунт программы подписывает свой деплой.
   Варианты: (1) взять файл с машины, где программа собиралась; (2) сменить адрес одной командой —
   она сама создаст ключи и перепишет declare_id!, Anchor.toml, реестр, IDL, watchtower и клиентов,
   а CI-гейт (AOF readiness → tests/readiness/program-ids.test.cjs) поймает любое расхождение:
       PROGRAMS=$name bash scripts/dev-local.sh keys --apply
   или напрямую: node scripts/rotate-program-ids.mjs --generate $name --apply"
  actual="$(solana address -k "$keypair" 2>/dev/null)" || die "ключ программы $keypair не читается"
  [ "$actual" = "$address" ] || die "ключ $keypair принадлежит адресу $actual, а объявлен $address — деплой в чужой адрес запрещён"
  verify_so_id "$so" "$address" || die "в собранной программе $so нет объявленного адреса $address.
   Так бывает, когда .so взят из CI-артефакта: сборка в CI переписывает declare_id! на временные ключи раннера,
   и Anchor отвергнет каждый вызов (DeclaredProgramIdMismatch). Соберите локально: 'anchor build --no-idl',
   положив свои target/deploy/$name-keypair.json на место — тогда адрес в бинарнике совпадёт."
  ok "$name: $so + ключ, и адрес действительно зашит в программу"
  TO_DEPLOY+=("$name $address $so $keypair new")
done
fi

# Обновление уже развёрнутой программы: ключ программы не нужен — аккаунт создан,
# финальную транзакцию подписывает upgrade authority (тот же ключ оператора).
# Если файл ключа есть, он всё равно сверяется с объявленным адресом.
if [ "${#UPGRADES[@]}" -gt 0 ]; then
for entry in "${UPGRADES[@]}"; do
  name="${entry%% *}"; address="${entry##* }"
  so="$ARTIFACTS/$name.so"
  keypair="$ARTIFACTS/$name-keypair.json"
  [ -f "$so" ] || die "обновление $name: нет собранной программы $so (соберите 'anchor build --no-idl')"
  if [ -f "$keypair" ]; then
    actual="$(solana address -k "$keypair" 2>/dev/null)" || die "ключ программы $keypair не читается"
    [ "$actual" = "$address" ] || die "ключ $keypair принадлежит адресу $actual, а объявлен $address — обновление в чужой адрес запрещено"
    program_id_arg="$keypair"
  else
    program_id_arg="$address"
  fi
  verify_so_id "$so" "$address" || die "в собранной программе $so нет объявленного адреса $address.
   Так бывает, когда .so взят из CI-артефакта: сборка в CI переписывает declare_id! на временные ключи раннера,
   и Anchor отвергнет каждый вызов (DeclaredProgramIdMismatch). Соберите локально: 'anchor build --no-idl'."
  ok "$name: $so, upgrade поверх $address (ключ программы: ${program_id_arg})"
  TO_DEPLOY+=("$name $address $so $program_id_arg upgrade")
done
fi

step "5/7 Ёмкость программ и баланс до первой транзакции"
PLAN_ARGS=()
for entry in "${TO_DEPLOY[@]}"; do
  set -- $entry
  PLAN_ARGS+=(--program "$1:$2:$3")
done
echo "   rent и комиссии берутся только из RPC; политика: $POLICY_LABEL;"
echo "   резерв оператора $OPERATOR_RESERVE_SOL SOL и резерв комиссий $DEPLOY_FEE_RESERVE_SOL SOL — отдельными строками"
if [ "${#UPGRADES[@]}" -gt 0 ]; then
  echo "   среди ${#TO_DEPLOY[@]} программ ${#UPGRADES[@]} — обновление уже развёрнутых:"
  echo "   для них таблица считает полную аренду буфера (столько нужно иметь на ключе на время транзакции);"
  echo "   загрузчик вернёт плательщику всё, что не уйдёт в ренту ProgramData, — постоянная доплата это разница, а не вся сумма"
fi
estimator plan --rpc "$RPC_URL" --expect-genesis "$DEVNET_GENESIS_HASH" --payer "$AUTHORITY_PUBKEY" \
  --operator-reserve-sol "$OPERATOR_RESERVE_SOL" --fee-reserve-sol "$DEPLOY_FEE_RESERVE_SOL" \
  "${PLAN_ARGS[@]}" \
  || die "расчёт стоимости не пройден (таблица и причина выше): деплой не начат, ни одной транзакции не отправлено"
ok "баланса хватает на все ${#TO_DEPLOY[@]} программ сразу"
# Незавершённые прошлые деплои оставляют buffer-аккаунты с заблокированным SOL. Только показываем.
estimator buffers --rpc "$RPC_URL" --authority "$AUTHORITY_PUBKEY" \
  || info "не удалось перечислить buffer-аккаунты оператора (деплою это не мешает)"

step "6/7 Деплой"
if [ "$APPLY" != 1 ]; then
  echo "   сухой прогон, транзакций не будет. Команды, которые выполнились бы:"
  for entry in "${TO_DEPLOY[@]}"; do
    set -- $entry
    kind="${5:-new}"
    MAXLEN="$(estimator max-len --so "$3")" || die "не удалось вычислить max-len для $1"
    if [ "$kind" = "upgrade" ]; then echo "   upgrade уже развёрнутой программы (ёмкость в сети не уменьшится):"; fi
    echo "   solana program deploy --url $RPC_URL --keypair $AUTHORITY_KEYPAIR --program-id $4 --max-len $MAXLEN $3"
  done
  echo "   повторите с --apply, чтобы выполнить"
  exit 0
fi
for entry in "${TO_DEPLOY[@]}"; do
  set -- $entry
  kind="${5:-new}"
  MAXLEN="$(estimator max-len --so "$3")" || die "не удалось вычислить max-len для $1"
  if [ "$kind" = "upgrade" ]; then
    echo "   upgrade $1 → $2 (max-len $MAXLEN)"
  else
    echo "   деплой $1 → $2 (max-len $MAXLEN)"
  fi
  solana program deploy --url "$RPC_URL" --keypair "$AUTHORITY_KEYPAIR" --program-id "$4" --max-len "$MAXLEN" "$3" \
    || die "деплой $1 не прошёл: смотрите вывод выше (частая причина — не хватает SOL на аренду).
   Повторный запуск безопасен: уже развёрнутые программы пропускаются, а совпавшие по байткоду — не обновляются.
   Недогруженный buffer скрипт НЕ закрывает — он будет показан в шаге 5
   (seed phrase буфера CLI печатает выше; решение — за владельцем)."
  ok "$1 задеплоен"
  if [ "$kind" = "upgrade" ]; then
    # Ёмкость после upgrade не равна policy-значению: ProgramData уменьшать нельзя,
    # а CLI расширяет её минимум на 10 KiB (SIMD-0431). Поэтому сверяемся с тем,
    # что реально в сети: байткод совпал, authority наша, ёмкости хватает.
    report="$(estimator upgrade-state --rpc "$RPC_URL" --program "$1:$2:$3" 2>&1)" \
      || die "$1 обновлён, но состояние в сети не прочиталось:
$report"
    ustate="$(printf '%s\n' "$report" | awk '/^state:/{print $2}')"
    capacity="$(printf '%s\n' "$report" | awk '/^capacity:/{print $2}')"
    uauth="$(printf '%s\n' "$report" | awk '/^authority:/{print $2}')"
    [ "$ustate" = "same" ] || die "$1 обновлён, но байткод в сети всё ещё не совпадает с $3 — код §3.8 на chain не уехал"
    [ "$uauth" = "$AUTHORITY_PUBKEY" ] || die "$1: upgrade authority в сети $uauth, ожидалась $AUTHORITY_PUBKEY"
    case "$capacity" in ''|*[!0-9]*) die "$1: ёмкость ProgramData не прочиталась ('$capacity')" ;; esac
    [ "$capacity" -ge "$MAXLEN" ] || die "$1: ёмкость ProgramData $capacity Б меньше max-len $MAXLEN"
    estimator verify-deployed --rpc "$RPC_URL" --program "$1:$2:$3" --max-len "$capacity" --authority "$AUTHORITY_PUBKEY" \
      || die "$1 обновлён, но состояние в сети не сошлось с ожидаемым (причина выше): дальше не идём"
  else
    estimator verify-deployed --rpc "$RPC_URL" --program "$1:$2:$3" --max-len "$MAXLEN" --authority "$AUTHORITY_PUBKEY" \
      || die "$1 задеплоен, но состояние в сети не сошлось с ожидаемым (причина выше): дальше не идём"
  fi
done

step "7/7 Проверка после деплоя"
python3 "$PROBE" "$RPC_URL" || true
echo
echo "Дальше можно одной командой (Config → минты → капы → добыча → коллекционеры):"
echo "  AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh              # сухой прогон (политику $POLICY_LABEL задайте теми же PROGRAM_MAX_LEN_* переменными)"
echo "  AOF_DEPLOY_TARGET=devnet scripts/devnet-bringup.sh --apply      # включить"
echo
echo "Тот же порядок вручную (docs/UNBLOCK_PLAN_2026-09-30.md §0):"
echo "  1) инициализация Config:            cd aof_backend && npx ts-node scripts/initConfig.ts"
echo "  2) минты ресурсов:                  npx ts-node scripts/initMintsV2.ts"
echo "  3) потолки выпуска:                 npm run caps:init"
echo "  4) включение добычи:                scripts/enable-mining-devnet.sh --apply"
echo "  5) allowlist коллекционеров:        POST /admin/config/collector-mint"
