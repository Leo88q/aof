# Нагрузочное тестирование бэкенда — `scripts/loadtest/nf-load.mjs`

_2026-09-28. Инструмент без зависимостей (Node ≥ 18). Сценарии повторяют реальный клиент: `frontend/src/pages/farm/*Panel.tsx` опрашивает бэкенд каждые 5/10/15 с._

## Быстрый старт (Mac, локально)

```bash
cd ~/LeoGamesStudio/aof
# 1) бэкенд: доверяем одному прокси-хопу, чтобы каждый виртуальный игрок был отдельным IP
#    (иначе все VU = один IP и тест меряет rate-limit, а не сервер)
(cd aof_backend && TRUST_PROXY_HOPS=1 npm run dev) &
# 2) потолок по пропускной способности (closed loop): DB + RPC маршруты
node scripts/loadtest/nf-load.mjs --scenario mixed --vus 50 --duration 30 --md reports/loadtest.md
# 3) «N игроков на вкладке фермы» (open loop, реальные таймеры клиента)
node scripts/loadtest/nf-load.mjs --scenario farm --vus 200 --duration 90 --md reports/loadtest.md
# 4) чистый потолок Node/Express (без БД и RPC)
node scripts/loadtest/nf-load.mjs --scenario health --vus 100 --duration 15
# 5) поведение лимитера с одного IP: на каком запросе первый 429 и какие заголовки RateLimit-*
node scripts/loadtest/nf-load.mjs --scenario ratelimit --ip single --vus 5 --duration 20
```

`make load-test` / `make load-test-farm` (переменные `LOAD_URL`, `VUS`, `DURATION`) делают то же.

## Что означает вывод

```
total: 10856 requests in 8.0s  →  1349.9 req/s   p50=23ms p95=48ms p99=51ms   errors=0 (0.00%)
capacity estimate: 1350 req/s ÷ 0.567 req/s per farm-tab player ≈ 2382 concurrent players at p95 ≤ 500 ms
verdict: PASS  (targets: p95 ≤ 500 ms, errors ≤ 1%)
```

- **req/s per player** = сумма таймеров профиля фермы (mill 5 с, tiles 10 с, energy+weather 15 с, balances/player/inbox 30 с, quests/vip 60 с) = **0.567 req/s ≈ 34 запроса в минуту на игрока**.
- **capacity estimate** — грубая оценка «сколько игроков на вкладке фермы тянет этот стек при таком p95». Настоящая цифра — из сценария `farm` с нарастанием `--vus` (100 → 200 → 400 → 800) до момента, когда p95 > 500 мс или появляются 429/5xx/таймауты.
- Ошибками считаются `429`, `5xx`, сетевые ошибки и таймауты (`--timeout`, по умолчанию 10 с).
- `--json` пишет машинно-читаемый отчёт, `--md` дописывает сводку в markdown, `--strict` даёт ненулевой exit code при `FAIL` (для CI-гейта).

## Что именно ограничивает нагрузку в текущей архитектуре

| Узкое место | Где | Числа |
|---|---|---|
| **Per-IP лимитер** | `aof_backend/src/middleware/rateLimit.ts` | было 300 req / 15 мин на IP = 20/мин, а один игрок на ферме генерирует ~34/мин → 429 через ~9 мин; два игрока за одним NAT — сразу. Теперь 900/15 мин (60/мин), настраивается `RATE_LIMIT_*`; `/health`, `/ready` не считаются. Store в памяти процесса: при N репликах лимит умножается на N — нужен общий store (Redis) |
| **Solana RPC** | все `/query/*`, `/energy`, `/weather`, `/season/vip-status` — каждый запрос = `getAccountInfo`, `/query/my-tools`, `/query/listings`, orderbook — `getProgramAccounts` | кеша нет. Публичные RPC: ~100 req/10 с на IP; Helius free ≈ 10 rps; платные 50–500 rps. При 0.4 rps RPC-запросов на игрока: **10 rps ≈ 25 игроков, 100 rps ≈ 250, 500 rps ≈ 1200** одновременно на ферме. `getProgramAccounts` на многих провайдерах отключён/платный отдельно |
| **SQLite, один writer** | `docker-compose.prod.yml`: `DATABASE_URL=file:…?connection_limit=1` | все запросы к БД одного процесса сериализуются на одном соединении; воркеры за profiles. Чтения дешёвые (сотни–тысячи req/s), но `SERIALIZABLE`-транзакции лимитов кошелька и любая запись ждут writer-lock. PostgreSQL-overlay готов (`docker-compose.postgres.yml`, `docs/POSTGRES_MIGRATION.md`), cut-over не выполнялся |
| **Один процесс Node** | `server.ts` — `app.listen`, socket.io в том же процессе | потолок `/health` на ноутбуке — тысячи req/s; JSON-маршруты с Prisma — сотни–тысяча; горизонтальное масштабирование упирается в SQLite и in-memory лимитер |
| **Опрос вместо push** | `MillPanel`/`OvenPanel` 5 с, `PlantingPanel` 10 с | `wsHub` (socket.io) уже есть — перевод таймеров фермы на push снимет ~70 % RPC-нагрузки |

## Ожидания (до измерений на вашей машине)

- `health`: 3 000–10 000 req/s на одном ядре M-серии — ограничение самого Node.
- `db` (SQLite): 800–2 000 req/s при p95 < 20 мс на локальном диске.
- `chain` против локального validator: 300–1 000 req/s; против devnet/публичного RPC — **упирается в квоту RPC**, а не в бэкенд (ждите 429 от RPC → 5xx у нас).
- Честный ответ на «какую нагрузку выдержит игра» = результат `farm` с ростом `--vus` на **прод-конфигурации** (тот же RPC-провайдер, Postgres или SQLite, тот же хостинг). До этого — только оценки выше.

## Ограничения инструмента

- Только GET: мутирующие маршруты требуют wallet-proof подписи и создают транзакции — нагрузку на запись меряют против локального validator отдельным сценарием (не реализован).
- Случайные кошельки → `/query/*` отвечают «аккаунт не найден» (RPC-вызов всё равно выполняется, это и меряем), DB-маршруты — пустыми ответами. Для реалистичных payload'ов подставьте `--wallets` меньше числа VU и прогрейте аккаунты через игру.
- `X-Forwarded-For` учитывается только при `TRUST_PROXY_HOPS=1`; в проде за nginx это уже так.
