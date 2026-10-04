# Bootstrap-preflight: как `devnet-bringup.sh` проверяет backend до деплоя

Статус: 2026-10-01. Код: `aof_backend/src/lib/bootstrapPreflight.ts`,
маршрут `GET /admin/config/bootstrap-preflight` (`aof_backend/src/routes/admin-config.ts`),
потребитель — шаг 1 `scripts/devnet-bringup.sh`.

## Проблема (замкнутый круг)

До деплоя `GET /admin/config/mining` читает `Config` и отвечает **HTTP 400 «Account does not exist»** — Config
появится только после деплоя и `initConfig.ts`. Скрипт же требовал от backend строго **200** ещё в шаге 1, то есть
запуск с нуля не мог начаться. Лечить это приёмом «любой 400 — ок» нельзя: 400, 401, 404 и «чужой сервис на порту»
стали бы неотличимы от здорового backend.

Исходное состояние воспроизводит тест `aof_backend/scripts/bootstrapPreflightSelfTest.ts`: на одном и том же
состоянии сети `GET /mining` → 400, а `bootstrap-preflight` → 200.

## Контракт `aof.bootstrap-preflight` v1

Не требует ни программ, ни Config; ничего не подписывает; секретов нет (ни ключа authority, ни `ADMIN_TOKEN`, ни
RPC URL с API-ключом). Нужен **ops-токен** (`ADMIN_TOKEN`); read-токен получает 403.

```json
{
  "kind": "aof.bootstrap-preflight", "schemaVersion": 1, "service": "aof-backend",
  "authority": { "pubkey": "<base58>", "mode": "hot", "canSign": true },
  "rpc": { "genesisHash": "<hash>", "expectedGenesisHash": null, "genesisMatchesExpected": null },
  "programs": {
    "aof_core": { "programId": "<base58>", "deployed": false, "anomaly": null },
    "aof_market": { "…": "…" }, "aof_quests": {}, "aof_rebirth": {}, "aof_liquidity": {}, "aof_session_keys": {}
  },
  "config": { "pda": "<base58>", "exists": false, "anomaly": null }
}
```

* `deployed` — аккаунт есть, **исполняемый** и принадлежит upgradeable-загрузчику; иначе `deployed:false` и
  `anomaly` объясняет (чужой владелец, не исполняемый);
* `config.exists` — аккаунт есть, принадлежит `aof_core` и начинается с Anchor-дискриминатора `Config`; иначе
  `anomaly` (чужой владелец / не Config / Config без развёрнутого `aof_core`);
* сбой RPC → `502 {"error":"BOOTSTRAP_PREFLIGHT_RPC_UNAVAILABLE"}`: текст ошибки клиенту не отдаётся (в нём бывает
  URL с ключом провайдера), в лог уходит описание без URL.

## Что проверяет скрипт (всё fail-closed, код выхода 3, до первой транзакции)

| Ситуация | Отказ |
|---|---|
| backend не запущен / порт закрыт | «backend недоступен … (curl завершился с кодом N)» |
| на порту другой HTTP-сервис (404, HTML, чужой JSON) | «нет /admin/config/bootstrap-preflight» / «не похож на bootstrap-preflight» |
| старая сборка backend без маршрута | 404 → то же сообщение: обновите backend |
| HTTP 400 и любой другой не-200 | «вернул HTTP N вместо 200» (**«любой 400» не принимается**) |
| неверный токен / read-токен | «backend отклонил ADMIN_TOKEN (HTTP 401/403)» |
| backend в `read-only` | «не в hot-режиме подписи» (`initConfig.ts` в read-only всё равно падает) |
| authority backend'а ≠ ключ оператора | «не совпадает с ключом оператора» — иначе деплой прошёл бы, а `initialize` (он привязывает Config к upgrade authority) отказал бы **после** траты SOL |
| program ID backend'а ≠ реестр (`watchtower/addresses.json`) | «а в реестре …» |
| genesis RPC скрипта или backend'а ≠ devnet | «не подтверждён как devnet» / «не devnet» |
| аномалия программы или Config | отказ с названием аномалии |

Если проверка пройдена, скрипт печатает состояние: сколько программ уже в сети и есть ли Config. Дальше:
развёрнутые программы не деплоятся, существующий Config не пересоздаётся (шаг 5 пропускает `initConfig.ts`), повторный
запуск ничего не меняет.

### Шаг 8 (preflight добычи): RPC и честная блокировка реестра

`miningDevnetPreflight.ts` выбирает RPC в таком порядке: `DEVNET_RPC_URL`, затем `RPC_URL`, затем
публичный devnet endpoint. Он загружает `aof_backend/.env`; в общем запуске `devnet-bringup.sh`
переменная `RPC_URL` поэтому должна направить и preflight на тот же Helius/частный endpoint, а не
на публичный RPC, который часто отвечает 429. Для отдельного ручного запуска можно явно задать
`DEVNET_RPC_URL="$RPC_URL" npm run preflight:mining-devnet` из `aof_backend/`.

Даже при рабочем RPC preflight останется `BLOCKED`, пока `watchtower/addresses.json` помечает
программы как `reference-unverified`: это намеренный gate, а не ошибка сети. Не меняйте статус по
одному лишь ответу `executable`. Сначала подтвердите все шесть ID, upgrade authority и байткод
локальных `.so` против devnet командой `scripts/verify-programs.sh <RPC_URL> <authority> target/deploy
--require-bytecode`, изучите результат, и только затем фиксируйте реестровую верификацию. Пока оба
условия не пройдены, шаг 8 должен оставить `Config.mining_enabled=false`.

### Шаг 5 (Config, минты, потолки)

`initConfig.ts` и `initMintsV2.ts` запускаются ts-node'ом с проверкой типов: скрипты с guard'ом
`if (!AUTHORITY)` обязаны сужать ключ в локальной константе (иначе `TS18047`, см.
docs/BUILD_TROUBLESHOOTING.md). Шаг `caps:init` требует `CAP_PER_EPOCH` (или per-kind `CAP_<KIND>`):
значение выбирает оператор, и bringup отказывает без него, пока потолки выпуска не созданы; когда все
виды уже `configured`, шаг пропускается (docs/ISSUANCE_CAPS_DESIGN.md).

## Тесты

* `npm run test:bootstrap-preflight` (backend): логика на поддельном соединении; настоящий роутер `admin-config` по HTTP
  (401/403/200, ответ без секретов, 502 без текста ошибки RPC, только GET) в режимах `hot` и `read-only`;
* `python3 scripts/test-devnet-bringup.py` — класс `BootstrapPreflight`: десять сценариев из задачи (backend не запущен;
  посторонний сервис; неверный токен; read-only; чужой authority; чужой program ID; программ и Config нет;
  программы есть, Config нет; Config инициализирован; повторный запуск) + mainnet-RPC скрипта и backend'а. Маршрут идёт
  **настоящим curl** к настоящему локальному HTTP-серверу;
* `node --test tests/readiness/bootstrap-preflight.test.cjs` — контракт одинаков в backend, скрипте и тестовом двойнике,
  маршрут закрыт ops-токеном, шаг 1 не зависит от Config.

## Что не проверено

Прогон против настоящего backend + настоящего devnet-RPC в песочнице невозможен (нет сети до RPC, нет Prisma-клиента,
а `solana`/`anchor` не установлены). Самотесты проверяют маршрут настоящим роутером с подменённым соединением; живой
прогон — на машине владельца: `cd aof_backend && npm run dev`, затем
`PROGRAM_MAX_LEN_POLICY=exact AOF_DEPLOY_TARGET=devnet ADMIN_TOKEN=… scripts/devnet-bringup.sh` (сухой прогон).
