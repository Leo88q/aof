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
одному лишь ответу `executable`. `devnet-bringup.sh --apply` по умолчанию собирает все шесть
программ, передаёт `UPGRADE=all` в deploy step и выполняет обязательный
`scripts/verify-programs.sh <RPC_URL> <authority> target/deploy --require-bytecode` до Config,
minter/cap setup и mining. При несовпадении bringup останавливается; реестр он не меняет. Если
статус ещё `reference-unverified`, последующий read-only mining preflight останется BLOCKED и не
включит mining. Изучите все шесть результатов, выполните smoke review, и только затем фиксируйте
реестровую верификацию. До deploy bringup отдельно читает `Config.mining_enabled` и отказывает при
`true`; сначала выключите on-chain kill-switch.

Отдельно: `CAP_PER_EPOCH` и `caps:init` задают **эпохальный** бюджет `IssuanceCap`, а
`MaterialMints.max_supply` теперь является конечным **cumulative lifetime** потолком gross mint;
он сравнивается с монотонным `IssuanceCap.lifetime_minted`, а не с текущим SPL supply. Burn не
возвращает лимит. `check_supply_cap()` вызывается до CPI на всех resource mint-путях, включая
`collect_mining` и delegated mining.

Перед установкой потолков `npm run issuance:history:scan` перебирает все 27 canonical resource mint
от `InitializeMint`, суммирует `MintTo`/`MintToChecked`, учитывает burns для независимой сверки
`gross mints - burns == finalized Mint.supply`, и помечает отчёт incomplete при пропущенных
транзакциях/неразобранных Token ix. `issuance:baseline:apply` валидирует genesis, program ID,
canonical mint addresses, арифметику gross−burns и полноту отчёта; затем authority-only instruction монотонно поднимает
on-chain baseline. Даже если существующий конечный `max_supply` ниже gross baseline, baseline записывается:
это безопасно, потому что все последующие mint CPI останутся заблокированы, пока оператор не задаст cap выше baseline.
Отчёт не заменяет архивный RPC: если он не возвращает всю историю до `InitializeMint`, bootstrap отказывает.

Политика cumulative issuance — решение оператора, отдельное от `caps:init`:

* **Конечный lifetime-лимит:** выбрать четыре значения в raw SPL atoms и задать
  `LIFETIME_CAP_CIRCUIT`, `LIFETIME_CAP_SILICON`, `LIFETIME_CAP_DATASET` и `LIFETIME_CAP_NEURON`.
  Скрипт не угадывает значения и требует каждое выше live lifetime counter. После baseline запускается
  `issuance:lifetime-caps:apply`; preflight проверяет четыре SPL supply, counters и ненулевой остаток.
* **Намеренно неограниченная эмиссия на Devnet:** оставить `MaterialMints.max_supply = u64::MAX`
  и выполнить read-only preflight с `ALLOW_UNLIMITED_DEVNET_ISSUANCE=1`. Это только явное принятие
  политики: флаг не меняет on-chain state и не устанавливает cap. Без него неограниченные значения
  остаются blocker. Preflight всё равно проверяет Devnet genesis, полную историю, baseline, мints,
  registry и остальные условия. Флаг не может разрешить mainnet: проверка genesis остаётся обязательной.

`enable-mining-devnet.sh` требует тот же флаг при выбранной uncapped Devnet policy, файл
`MINING_PREFLIGHT_REPORT` с нулём blockers и ручные `PREFLIGHT_OK=1` + `MINING_SMOKE_OK=1` для
реального `--apply`; затем выполняются обычные проверки выплатных mint-адресов и `MaterialMints`.
`SKIP=mining` разрешает конфигурационный bringup без smoke-согласия и без переключения флага.
`caps:init` — per-epoch limiter, не lifetime cap. Сейчас `charge_epoch` вызывается прямым
`mint_resource`-путём, а mining/season/exploration проверяют cumulative `max_supply`; при `u64::MAX`
он не останавливает их совокупный выпуск.

Важно для экономики: mining в on-chain коде резервирует жителя и время, а при сборе уменьшает
прочность инструмента; отдельного resource-token платежа за час mining код не списывает. Exploration,
напротив, сжигает входные ресурсы. Если считать durability/время достаточной игровой стоимостью — это
продуктовое решение; это не равнозначно проверяемому on-chain платежу за каждый выпущенный токен.
Не считайте успешный `caps:init` доказательством конечного cumulative cap. Полный runbook намеренно uncapped Devnet режима и его экономические последствия: [`DEVNET_UNCAPPED_ISSUANCE_POLICY.md`](DEVNET_UNCAPPED_ISSUANCE_POLICY.md).

`ExploreExpire`/`ForgeAttemptExpire` возвращают ресурсы transfer-ом из escrow, не mint-ят. Если
ATA получателя закрыт, settlement builder добавляет перед expire top-level idempotent ATA create
(его оплачивает fee payer/cranker); SBF handler не делает вложенный init CPI, поэтому обещанный
refund остаётся исполнимым без зависимости от cap.

Exploration commit/reveal/refund собраны как **одна атомарная v0-транзакция с ALT**: это сохраняет
escrow atomicity и укладывает пакеты, тогда как legacy estimates для commit/reveal превышали 1,232
bytes. `npm run vrf:lut:init` создаёт/дополняет таблицу только на devnet, читает её обратно,
включает фиксированные resource accounts и все уже созданные VRF pool slots, дожидается активации и
пишет публичный `VRF_ADDRESS_LOOKUP_TABLE` в `aof_backend/.env`. Шаг вызывается bringup после
Config/mint setup; после последующего ручного добавления/ротации VRF pool slots его нужно повторить.
Не деактивируйте таблицу. Wallet guard разрешает v0 lookups до проверки allowlist/intent и отказывает
при недоступной/inactive table; сервер также требует размер не больше 1,168 bytes (64 bytes запас).

Mining остаётся закрытым, пока не пройдены code/chain и smoke-gates. В выпуске с конечными caps нужны четыре конечных лимита; при выбранной uncapped Devnet policy оператор должен явно задать `ALLOW_UNLIMITED_DEVNET_ISSUANCE=1` в preflight и mining-enable шагах.

### Шаг 5 (Config, минты, потолки)

`initConfig.ts` и `initMintsV2.ts` запускаются ts-node'ом с проверкой типов: скрипты с guard'ом
`if (!AUTHORITY)` обязаны сужать ключ в локальной константе (иначе `TS18047`, см.
docs/BUILD_TROUBLESHOOTING.md). Перед созданием SPL mint'ов `initMintsV2.ts` читает devnet
MaterialMints PDA: полный существующий registry и все 27 mint accounts проверяются, после чего
скрипт завершает шаг без повторного создания; при частичной/невалидной записи он отказывает.
Шаг `caps:init` требует `CAP_PER_EPOCH` (или per-kind `CAP_<KIND>`):
значение выбирает оператор, и bringup отказывает без него, пока потолки выпуска не созданы; когда все
виды уже `configured`, шаг пропускается (docs/ISSUANCE_CAPS_DESIGN.md). В том же backend bootstrap
`npm run vrf:lut:init` после чтения Config/MaterialMints готовит и проверяет devnet lookup table для
v0 exploration; таблица пополняется идемпотентно, а `SKIP=vrf-lut` допустим только если уже указана
действующая `VRF_ADDRESS_LOOKUP_TABLE`.

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
