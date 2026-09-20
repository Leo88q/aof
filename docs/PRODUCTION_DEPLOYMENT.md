# Развёртывание AOF — текущий безопасный порядок

> **Mainnet NO-GO.** См. [актуальный аудит](../AUDIT_2026-09-20.md). Эта инструкция не является сертификатом готовности. Паки/ковка отключены для новых коммитов; возврат старых сохранён. Bubblegum/ZK пока не интегрированы.

## 1. Сначала проверки, затем deployment

```bash
cd aof_backend
npm ci
npm run build
npm run test:wallet-proof
npm run test:resource-registry
npm run test:security-invariants
npm run test:audit-security
npm run test:reward-receipts
npm run test:idempotency-db
npx tsc -p tsconfig.workers.json
cd ../frontend
npm ci
npm run test:security
npm run build
cd ..
python3 scripts/check-idl-drift.py
python3 scripts/check-mint-writable.py
python3 scripts/test-mint-cost-model.py
python3 scripts/test-reward-migrations.py
python3 scripts/test-idl-drift.py
cargo test --locked -p aof-core -p aof-liquidity --lib
# На изолированном localnet с тестовыми ключами:
anchor test
```

Блокирующие проверки должны завершиться успешно, а не через fallback. `prisma generate --no-engine` достаточен только для типов; не использовать его как успешную проверку backend/БД. Нужны Docker build и devnet E2E/soak с реальным кошельком. Никогда не запускать bootstrap/test fixtures против mainnet.

## 2. База данных

Committed Prisma provider и migrations — **SQLite**. Изменение DATABASE_URL на PostgreSQL не мигрирует приложение. `db push` поверх боевой БД запрещён как способ обновления production schema.

- Сделать консистентный backup и проверить восстановление.
- Для существующей схемы использовать [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md), затем `prisma migrate deploy`.
- Новая миграция `202609200001_reward_reconciliation` добавляет claimState/claimSignature. Старые claimed записи становятся `legacy_claimed`, не «доказанно выплачено».
- `202609200002_reward_receipts`: **все старые** награды version=0, новые version=1; claimMint snapshot. Исторические награды требуют ручной сверки; не включать их массово и не создавать новые ID для обхода tombstone.
- `202609200003_reconciliation_cursor`: durable worker cursor и индекс claimState/id. Worker запускать по расписанию в одном экземпляре; checkpoint сохраняется между one-shot runs. Следить за числом quarantined/reserved и возрастом submitted. RPC ошибки не повод сбрасывать claim.
- Python SQLite smoke не заменяет Prisma migration diff/engine tests и восстановление production backup.
- Для multi-instance production отдельно портировать provider + SQL migrations, данные, unique/CAS инварианты и проверить гонки/restore на PostgreSQL. Нельзя применить SQLite migration history к PostgreSQL без конвертации.

Compose теперь отражает только поддерживаемый single-host baseline: SQLite volume, ограниченный pool, recovery worker opt-in. Наличие файла `docker-compose.prod.yml` не означает, что масштабирование или mainnet-проверки пройдены. **Не запускать новую пустую БД вместо существующей production DB.**

## 3. Конфигурация без раскрытия секретов

Из `.env.example` заполнить на сервере через secret manager:

- RPC_URL, PROGRAM_ID, TREASURY_PUBKEY; сверить с on-chain Config и release manifest.
- EXPECTED_GENESIS_HASH из заранее утверждённого cluster manifest; не доверять одному hostname RPC.
- Уникальный WALLET_PROOF_DOMAIN для среды, тот же VITE_WALLET_PROOF_DOMAIN у клиента.
- ADMIN_TOKEN: криптографически случайный, минимум 32 символа; private admin API только за дополнительным сетевым контролем.
- Operational AUTHORITY_SECRET_KEY вне репозитория, с малым SOL бюджетом. Upgrade authority и treasury governance отдельно. Простая замена authority на Squads PDA несовместима с текущим Keypair signer.
- CORS_ORIGIN: точные HTTPS origins. Не открывать ADMIN_TOKEN или authority secret во frontend.

Новые proofs подписывают `{method,target,body}`: обновлять backend и frontend одновременно. API reverse proxy удаляет `/api`, но далее должен сохранять исходный target без добавления/удаления trailing slash/query. Пример штатного target: `/tools/craft`.

## 4. Single-host container baseline

Перед первым запуском: ревизия deployment blockers, backup, approved config, TLS reverse proxy. Node runtime — non-root, volume `/app/data`, read-only rootfs. Backend socket опубликован на loopback. Публичный доступ — только через TLS proxy; корректно ограничить proxy trust, иначе все клиенты разделят rate limit.

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d backend
# Только когда нужен recovery legacy commitments:
docker compose -f docker-compose.prod.yml --profile recovery up -d commit-expirer
```

Worker скомпилирован в `dist-workers`; runtime не зависит от ts-node/devDependencies. Hot-market/price-cranker автоматически не включаются. SQL schema мигрируется перед API. `/health` — liveness, не доказательство работоспособности БД, treasury solvency или цепи.

При volume permission failure исправить владельца volume под UID пользователя `node`, а не запускать backend от root. Секреты не помещать в image/layers/build args. Старый PostgreSQL volume не удалять: если он использовался, сначала миграция данных.

## 5. Reward reconciliation

`claimed=true` теперь может означать резерв, а не выплату; проверять `claimState`.

- `submitted` + signature: **не** выдавать ещё одну награду. Сверить finalized status по правильному cluster.
- `confirmed`: закрытая выплата.
- `reserved` без signature: автоматический reconciler не трогает; investigate crash/логи, ручное решение с независимым подтверждением отсутствия broadcast.
- `legacy_claimed`: отдельная историческая сверка.
- Null/pruned status не означает failed. Нужен archival RPC/ledger, а не сброс `claimed=false`.

Read-only chain reconciliation (не отправляет транзакции, но обновляет БД):

```bash
cd aof_backend
npm run reconcile:inbox
# В собранном контейнере:
# node dist-workers/scripts/reconcileInboxClaims.js
```

Скрипту нужны DATABASE_URL, RPC_URL, EXPECTED_GENESIS_HASH; signing key не нужен. Он обрабатывает до 100 submitted claims за запуск; для больших backlog обеспечить обход неразрешённых старых записей и monitoring, не считать один запуск полной сверкой.

## 6. Frontend и запрет legacy deploy

Собирать **frontend/**, не root CRA package. Runtime конфигурация VITE_RPC_URL / VITE_API_URL / VITE_WALLET_PROOF_DOMAIN должна соответствовать backend и release manifest. На production не оставлять fallback devnet. Публичный браузерный RPC ключ должен быть ограничен domain/quota; не публиковать серверный unrestricted RPC credential.

`firebase deploy` сейчас может развернуть старые `functions/` (Ronin/Firebase), не прошедшие этот аудит. Не использовать его для нового релиза. Netlify root `publish=build` также не является текущим Vite pipeline. Настроить отдельный reviewed deployment для `frontend/dist`, CSP и SPA/API routing.

## 7. Выход в mainnet

Сначала: green CI, внешняя проверка контрактов, версии deployed programs, multisig/key rotation, on-chain caps/receipts, утверждённая экономика, нагрузка и recovery. Затем только вручную утверждённый canary с малыми лимитами. Не снимать fail-closed guards ради демонстрации работающего UI.

## 7. Совместимость второго этапа аудита

После всех release gates — coordinated maintenance window для program + IDL + API + browser cache invalidation. В новом core 87 инструкций; добавлены `mint_resource_once` и `marketplace_buy_bounded`. Старый `marketplace_buy` остаётся по старому discriminator, но возвращает FeatureDisabled. **Не переименовывать bounded инструкцию обратно:** новый discriminator не даёт старому бинарнику молча игнорировать max price/deadline.

Проверить на staging: старые клиенты больше не покупают unbounded; новая инструкция на старом бинарнике отклоняется; новая bounded покупка правильно отклоняет превышение цены/срока и проходит при корректном quote. Сверить generated IDL/verified build; текущие JSON/TS копии синхронизированы вручную и проверены static gate, это не доказательство deployed ABI.

RewardReceipt PDA постоянный, 121 байт данных, payer — authority. Получить актуальный `getMinimumBalanceForRentExemption(121)` и заложить бюджет **на каждую новую выплату**, плюс fee, возможные Player/ATA accounts. Не закрывать receipts ради rent recovery. Snapshot/restore сохраняет тот же inbox ID; новый ID означает новую допустимую on-chain выплату. Версия 0 и конфликт receipt не переводятся в retry без документированного расследования. Смена canonical mint может дать конфликт со старой выплатой — не обходить его.

Обратный rollback на прежний бинарник возвращает старые уязвимые инструкции: простой откат не безопасный recovery plan. Для incident first остановить API writes/workers, использовать проверенную pause/governance процедуру и сохранить DB/signature/receipt evidence.
