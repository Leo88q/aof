#!/usr/bin/env bash
# `anchor test` на локальном валидаторе с тестовым двойником Switchboard.
#
# Зачем. `tests/aof_vrf_localnet.ts` прогоняет полный цикл commit -> reveal ->
# выдача NFT по реальным CPI `aof_core`. Оракул Switchboard не может подписать
# локальную цепочку, поэтому CI собирает `tests/mock-switchboard` и подкладывает
# его в genesis валидатора по mainnet-адресу Switchboard (ci.yml, шаг «Load the
# Switchboard test double»). Без этой записи набор молча помечается `skipped`, и
# «зелёный прогон» ничего не говорит о VRF-инструкциях.
#
# Что делает:
#   1. собирает `target/mock/mock_switchboard.so` (cargo-build-sbf; повторный
#      запуск — секунды, артефакт кэшируется);
#   2. добавляет `[[test.genesis]]` в `Anchor.toml` на время прогона и возвращает
#      файл побайтно как было (trap EXIT/INT/TERM); если запись уже есть — не
#      трогает файл вовсе;
#   3. запускает `anchor test --skip-build` с `AOF_REQUIRE_SWITCHBOARD_MOCK=1`,
#      чтобы отсутствие двойника было отказом, а не тихим пропуском.
#
# Почему запись добавляется на время прогона, а не лежит в `Anchor.toml`:
# genesis-запись с путём к несуществующему `.so` валит старт валидатора, а
# `tests/mock-switchboard` — тестовый артефакт, которого нет в свежем клоне
# (`target/` в .gitignore). Постоянная запись ломала бы `anchor test` до сборки
# двойника и дублировалась бы в CI, который добавляет её сам.
#
# Переменные:
#   SKIP_SWITCHBOARD_MOCK=1 — запустить `anchor test --skip-build` как есть;
#                             VRF-набор при этом пропустится.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MOCK_ADDRESS="SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"
MOCK_SO="target/mock/mock_switchboard.so"
TOML="Anchor.toml"
backup=""

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ -n "$backup" ]; then
    cp "$backup" "$TOML"
    if cmp -s "$backup" "$TOML"; then
      echo "[anchor-test] $TOML возвращён как был"
    else
      echo "[anchor-test] ⚠️ $TOML не удалось вернуть побайтно (копия: $backup)" >&2
    fi
  fi
  exit "$rc"
}

if [ "${SKIP_SWITCHBOARD_MOCK:-0}" = "1" ]; then
  echo "[anchor-test] SKIP_SWITCHBOARD_MOCK=1: запускаю без двойника — VRF-набор будет skipped"
  exec anchor test --skip-build "$@"
fi

if ! command -v cargo-build-sbf >/dev/null 2>&1; then
  cat >&2 <<'EOF'
❌ cargo-build-sbf не найден: он ставится вместе с Agave/Solana CLI 4.2.1
   (docs/BUILD_TROUBLESHOOTING.md). Без двойника Switchboard VRF-набор молча
   пропускается, поэтому отказываю, а не делаю вид, что прогон полный.
   Запустить без него: SKIP_SWITCHBOARD_MOCK=1 make test
EOF
  exit 1
fi

# CI копирует Cargo.lock рабочего пространства к манифесту двойника, чтобы
# solana-program разрешался в те же версии, что у программ (ci.yml, тот же шаг).
# Копия лок-файла рядом с манифестом — в его .gitignore.
cp Cargo.lock tests/mock-switchboard/Cargo.lock
echo "[anchor-test] собираю тестовый двойник Switchboard (tests/mock-switchboard)"
cargo-build-sbf --manifest-path tests/mock-switchboard/Cargo.toml --sbf-out-dir target/mock || {
  echo "❌ двойник Switchboard не собрался — см. вывод cargo-build-sbf выше" >&2
  exit 1
}
if [ ! -f "$MOCK_SO" ]; then
  echo "❌ $MOCK_SO не появился после сборки" >&2
  exit 1
fi

if grep -q "$MOCK_ADDRESS" "$TOML"; then
  echo "[anchor-test] $TOML уже содержит genesis-запись двойника — файл не меняю"
else
  backup="$(mktemp -t aof-anchor-toml.XXXXXX)"
  cp "$TOML" "$backup"
  trap cleanup EXIT INT TERM
  printf '\n# Временная запись: её добавляет scripts/anchor-test.sh только на время прогона\n# (то же делает CI перед `anchor test`) — тестовый двойник Switchboard в genesis.\n[[test.genesis]]\naddress = "%s"\nprogram = "%s"\n' \
    "$MOCK_ADDRESS" "$MOCK_SO" >> "$TOML"
  echo "[anchor-test] genesis-запись двойника добавлена на время прогона"
fi

echo "[anchor-test] anchor test --skip-build (AOF_REQUIRE_SWITCHBOARD_MOCK=1)"
AOF_REQUIRE_SWITCHBOARD_MOCK=1 anchor test --skip-build "$@"
