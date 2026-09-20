# Миграция backend на PostgreSQL — runbook

_Статус: подготовлено (схема, baseline, скрипт переноса, compose). Cut-over не выполнялся._

## Зачем

SQLite — один writer на файл. Из-за этого каждый воркер в `docker-compose.prod.yml` сидит
за profile, а `connection_limit=1` для API. PostgreSQL снимает ограничение и делает
воркеры (indexer, price-tracker, trust) полноценными параллельными писателями.

## Что подготовлено

| Артефакт | Назначение |
|---|---|
| `aof_backend/prisma/postgres/schema.prisma` | **Генерируется** из `prisma/schema.prisma` (`provider = "postgresql"`). Не редактировать руками. |
| `aof_backend/prisma/postgres/migrations/0_baseline/` | Все SQLite-миграции, транслированные в PG DDL (`DATETIME→TIMESTAMP(3)`, `REAL→DOUBLE PRECISION`) и склеенные в один baseline. |
| `aof_backend/scripts/gen-postgres-schema.py` | Генератор + `--check` в CI: PG-файлы не могут устареть относительно SQLite. |
| `aof_backend/scripts/migrate-sqlite-to-postgres.ts` | Перенос данных: truncate → копия по таблицам (FK-порядок, батчи, транзакция на таблицу) → сверка count по всем таблицам + построчная сверка `InboxItem`, `IdempotencyRecord`, `WalletOperation`, `ReconciliationCursor`, `IndexerCursor`. |
| `docker-compose.postgres.yml` | Overlay: сервис `postgres`, `DATABASE_URL` и PG-образ для всех сервисов. Воркеры включаются через `COMPOSE_PROFILES=market,trust,push,indexer,recovery`. |
| `walletLimits.ts` | Транзакция переведена на `Serializable` + retry на `P2034` — на PG READ COMMITTED двойной count/insert обходил лимит. |

Почему два набора файлов, а не один: Prisma не переключает `datasource.provider` через env,
а `migration_lock.toml` привязан к провайдеру. Генерация из одного источника — единственный
способ не получить дрейф двух схем.

## Совместимость кода (проверено)

- **Idempotency / secretStore / profile** — CAS через уникальный индекс и `P2002`: одинаково на обоих.
- **BigInt** (`EconomySnapshot`, `Chain*`) — нативный `BIGINT` на PG, без изменений.
- **JSON-as-TEXT** (`AuditLog.metadata`, `EconomySnapshot.topHolders`, `ChainEvent.data` и т.д.) —
  остаются `TEXT`. Перевод в `Json`/`jsonb` — отдельная expand/contract-миграция уже на PG,
  не смешивать с cut-over.
- **Raw SQL** — только `SELECT 1` в `/ready`. Диалект-специфичного SQL в коде нет.
- **`connection_limit=1`** в URL — для PG убрать; Prisma сам держит пул (по умолчанию `num_cpus*2+1`).

## Cut-over (staging сначала, затем production)

```
0. Заморозка: объявить окно; API и все воркеры будут остановлены на время копии.
1. Бэкап SQLite:               scripts/backup-db.sh backup /srv/aof/data/aof.db /srv/aof/backups
2. Поднять PG:                 docker compose -f docker-compose.prod.yml -f docker-compose.postgres.yml up -d postgres
3. Применить baseline:         cd aof_backend && DATABASE_URL=$POSTGRES_URL \
                                 npx prisma migrate deploy --schema prisma/postgres/schema.prisma
4. Остановить API+воркеры:     docker compose -f docker-compose.prod.yml stop
5. Перенос данных:             SQLITE_URL=file:/srv/aof/data/aof.db POSTGRES_URL=$POSTGRES_URL \
                                 npx ts-node --transpile-only scripts/migrate-sqlite-to-postgres.ts
                               (скрипт завершится с кодом 1 при любом расхождении — тогда НЕ переключаться)
6. PG-клиент собирается в образе через build-arg PRISMA_SCHEMA (overlay задаёт его сам)
7. Запуск на PG:               COMPOSE_PROFILES=market,trust,push,indexer,recovery \
                                 docker compose -f docker-compose.prod.yml -f docker-compose.postgres.yml up -d --build
8. Проверки:                   GET /ready → db.ok; GET /admin/chain/status; выполнить 1 тестовый inbox-claim на devnet-сумме
9. SQLite-файл не удалять минимум 30 дней (откат = шаг 4 + запуск без overlay).
```

Откат: остановить, убрать overlay, запустить — данные, записанные в PG после cut-over,
теряются; поэтому окно заморозки и проверка на шаге 8 обязательны до открытия трафика.

## После cut-over

- Убрать profiles у воркеров в основном compose (сейчас это делает overlay).
- Бэкапы: `pg_dump -Fc` вместо `sqlite3 .backup` в `scripts/backup-db.sh` (drill-шаг сохранить).
- ~~`test:idempotency-db` прогнать против PG в CI~~ — сделано: job `backend-postgres` (service container `postgres:16-alpine`) гоняет `prisma migrate diff` по PG shadow-схеме, `migrate deploy` baseline'а, `tsc` против PG-клиента и `npm run test:idempotency-db:pg`.
- Затем — `Json` колонки и `AuditLog.action` → бизнес-события.
