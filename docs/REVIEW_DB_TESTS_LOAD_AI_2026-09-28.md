# Базы данных · тесты · нагрузка · ИИ-агенты — разбор NeuroForge, 2026-09-28

Ответ на вопросы владельца: как устроены базы «которые всё записывают», есть ли нагрузочные и мутационные тесты, работают ли тесты вообще, какую нагрузку выдержит игра, и закрытие пунктов #71–#82 чек-листа безопасности (ИИ-агенты). Всё проверено по коду ветки `arena/01a0e42b-aof` (база `02a402a`), результаты прогонов — из песочницы и GitHub Actions.

Коротко:

| Вопрос | Ответ |
|---|---|
| Базы данных | Одна операционная БД бэкенда (Prisma, **55 таблиц**): SQLite по умолчанию, PostgreSQL готов как overlay. Источник правды по активам — **цепочка Solana** (6 программ); бэкенд ведёт финализированный леджер событий (`ChainTx/ChainEvent/ChainMintDelta`) и журналы (`AuditLog`, `AuditRecord`, `WalletOperation`, `IdempotencyRecord`, `FraudCase`, `EconomySnapshot`). Watchtower читает те же таблицы только на чтение. Firestore (`functions/`) — мёртвое наследие Ronin-версии |
| Тесты работают? | **Да.** CI на последнем коммите зелёный: 6 джобов `CI` + 2 `AOF readiness`. В песочнице сейчас прошли: readiness 92/92 (+9 новых), OS 43/43, 7 python-гейтов, 9/12 backend self-tests (3 требуют Prisma-движок, в CI проходят), watchtower 7/7, frontend 16+5. Не запускались здесь только Rust/Anchor (нет toolchain) — в CI прошли |
| Нагрузочные тесты | **Не было.** Добавлен `scripts/loadtest/nf-load.mjs` (без зависимостей, 6 сценариев, оценка ёмкости) + `docs/LOAD_TESTING.md` |
| Мутационные тесты | **Не было** (только ручные «мутационные проверки» в аудитах). Добавлен `scripts/mutation/nf-mutate.mjs` + `targets.json` (13 целей: TS-модули безопасности, watchtower, Rust через cargo). Первый прогон: 8 модулей, score от 38 % до 97 %; два теста усилены по его результатам |
| Какую нагрузку выдержит | Потолок задают **не сервер**, а (1) per-IP лимитер — был 20 req/мин на IP при ~34 req/мин от одного игрока на ферме (исправлено: 60/мин, настраивается), (2) **квота Solana RPC** — каждый опрос фермы = RPC-вызов без кеша: ≈ **25 игроков на 10 rps RPC, ≈ 250 на 100 rps, ≈ 1200 на 500 rps**, (3) SQLite с одним writer. Точная цифра — после прогона `nf-load --scenario farm` на прод-конфигурации |
| #71–#82 | Разобраны в `SECURITY_CHECKLIST_AI_AGENTS_2026-09-28.md`: 6 закрыто кодом в этой ветке, 4 были закрыты, 2 — действия владельца (Squads timelock, мониторинг nonce-аккаунтов) |

---

## 1. Базы данных

### 1.1. Карта хранилищ

| Хранилище | Что хранит | Кто пишет | Кто читает |
|---|---|---|---|
| **Solana (devnet/localnet)**: `aof_core`, `aof_market`, `aof_quests`, `aof_rebirth`, `aof_liquidity`, `aof_session_keys` | всё, что имеет ценность: конфиг и роли, ресурсы (SPL-минты), инструменты (NFT + `ToolData`), стейкинг, рынок, аукционы, аренда, лотерея, commit/reveal VRF, `VaultGuard`/`IssuanceCap`, `AuthorityRotation*` события | игроки (подпись в кошельке), authority-ключ бэкенда (ограничен on-chain тормозами) | бэкенд (`/query/*`), chain-indexer, фронт (симуляция в `txGuard`) |
| **Операционная БД бэкенда** (Prisma `aof_backend/prisma/schema.prisma`, 55 моделей) | см. 1.2 | API `aof_backend/src`, воркеры `services/*` | API, воркеры, watchtower (read-only) |
| **Watchtower read model** (`watchtower/migrations/watchtower-read-model.sql`) | индексы + view поверх леджера; своих таблиц нет | никто (SELECT-only, проверяется тестом `watchtower-readonly`) | экспортер `watchtower/src/read-model.ts` |
| **Файлы**: `data/session-keys/*` (AES-256-GCM), `.env`/Docker secrets | сессионные ключи (сейчас фактически не используются — спенд отключён), секреты | `sessionKeys.ts` | — |
| **Redis** | опционально, только счётчики метрик watchtower (`metrics.ts`, `REDIS_URL`) | — | — |
| **Firestore** (`functions/index.js`, 11.5k строк, ethers/Ronin; `functions/index.solana.js`) | наследие прошлой версии игры | не деплоится из этого репо | — (кандидат на удаление, см. `AUDIT_2026-09-20.md` п. 8) |

### 1.2. Что именно «записывает всё» в операционной БД

| Группа | Таблицы | Назначение |
|---|---|---|
| **Финализированный леджер цепочки** | `ChainTx`, `ChainEvent` (уникально по `signature+eventIndex`), `ChainMintDelta` (эмиссия/сжигание по pre/post балансам), `IndexerCursor` (forward-sync + backfill на программу) | единственный источник для экономики, Watchtower, антифрода; только `finalized` |
| **Журналы действий** | `AuditLog` (кто/что/результат/txSig/ip/UA; актор — по подписи кошелька, не из body — `middleware/audit.ts`), `AuditRecord` (финансовые операции с `signature`, `status`, `ipAddress`), `WalletOperation` (счётчики лимитов кошелька, SERIALIZABLE-транзакция) | расследование споров, лимиты, админ-действия (`/admin/fraud/*` пишут сюда же) |
| **Идемпотентность и секреты** | `IdempotencyRecord` (`operationKey` unique, CAS — проверяется интеграционным тестом на SQLite и PostgreSQL в CI), `CommitSecret` (секреты commit/reveal) | защита от двойных клеймов, повтор reveal |
| **Экономика и мониторинг** | `EconomySnapshot`, `EconomyAlert`, `PriceTick`, `Candle`, `WhaleAlert`, `CircuitBreaker` | дашборд `/admin/economy`, стоп-кран |
| **Антифрод (без автобана)** | `FraudCase` (один открытый кейс на пару кошелёк/сигнал), `DeviceFingerprint`, `SybilFlag`, `TrustScore`, `TrustFlag`, `TrustBreakdown` | очередь на ручной разбор; решения пишутся в `AuditLog` |
| **Игровые офчейн-данные** | `FarmPlot`, `FarmBuilding`, `Energy`, `Weather`, `InboxItem`, `Profile`/`PlayerProfile`, `Streak`, `QuestProgressDb`, `ChallengeScore`, `Guild*`, `Territory`, `Leaderboard*`, `Referral*`, `Comeback*`, `NeighborVisit`, `FriendWatering`, `LoreProgress`, `OnboardingState`, `CompendiumEntry`, `PlayerRating` | UX-состояние; не источник правды по ценности (VIP — только из on-chain `SeasonPass`, `vipStatus.ts` возвращает 503 без цепочки) |
| **Воркеры** | `TraderRule`, `TraderExecution` (farm-trader, **только симуляция**), `NotificationQueue`, `DeviceToken`, `ApiKey`, `AllowedMint`, `ReconciliationCursor` | автоматизация |

Миграции: `prisma/migrations` (6: `0_init`, reward reconciliation/receipts, reconciliation cursor, chain indexer, fraud cases) + `prisma/postgres/migrations/0_baseline`; PostgreSQL-схема **генерируется** (`scripts/gen-postgres-schema.py`), дрейф обеих ловится в CI (`prisma:migrate:check`, `prisma:postgres:check`). Бэкапы: `scripts/backup-db.sh` (`sqlite3 .backup`, restore-drill); для Postgres — `pg_dump -Fc` по `docs/POSTGRES_MIGRATION.md`.

### 1.3. Замечания по БД

1. **SQLite в проде = один writer** (`connection_limit=1`, воркеры за compose-profiles). Это главный архитектурный лимит масштабирования (см. §3). Postgres-overlay готов, cut-over не делался.
2. **Персональные данные**: `AuditLog.ip/userAgent`, `AuditRecord.ipAddress/userAgent`, `DeviceFingerprint` — без политики хранения (нет retention/prune-задач в `cron.ts`). Нужен срок хранения (например, 90 дней) и анонимизация при экспорте (в Watchtower уже хэш `playerId`).
3. **Нет ежедневного snapshot-теста восстановления** в CI (drill есть только как скрипт).
4. **`functions/` + `firebase.json`** — 14k строк чужого стека в репозитории с деплой-конфигом. Удалить или вынести в архивную ветку.

## 2. Тесты — что есть, что работает

### 2.1. Инвентарь

| Слой | Где | Объём | Где выполняется |
|---|---|---|---|
| Rust unit/property | `aof-core/src/**`, `programs/*/src/**` (`#[test]` ×91, `security_checklist_tests.rs`, `drum_odds_tests`, один proptest) | ~90 тестов | CI `cargo test --workspace --lib` (2 джоба) |
| Anchor integration (local validator) | `tests/aof_core.ts` (30 `it`), `aof_extended.ts` (10), `aof_vrf_localnet.ts` (5), `aof_cu_report.ts` (1) + Switchboard test double | 46 | CI «Anchor test (local validator)» |
| Backend self-tests | `aof_backend/scripts/*SelfTest.ts` + 2 интеграционных (14 npm-скриптов) | wallet proof, authority gate, resource registry, security invariants, audit security, admin auth, fraud signals/hold, session keystore, reward receipts, chain indexer, VRF, idempotency CAS (SQLite **и** PostgreSQL) | CI «Backend build + self-tests», «Backend on PostgreSQL» |
| Python-гейты | `scripts/test-*.py`, `check-idl-drift.py`, `sync-quests-vrf.py --check` | 7 | CI + readiness |
| Readiness (статические инварианты чек-листа) | `tests/readiness/*.test.cjs` | 92 → **101** (добавлен `ai-agent-surface.test.cjs`) | CI «AOF readiness regressions» |
| Watchtower OS v3 | `src/os/tests/os-v3.test.js` | 43 | readiness |
| Watchtower exporter | `watchtower/tests/*.ts` (7 сьютов, 10 000 property-итераций в journal) | 7 | CI (backend job) |
| Frontend | `frontend/tests/security.test.ts` (16), `no-raw-color.test.mjs` (5), `lint:aof-colors`, `tsc + vite build` | 21 | CI «Frontend build» |
| Secret scan | gitleaks по всей истории | — | CI |
| Нагрузочные | — | **не было** → `scripts/loadtest/nf-load.mjs` | вручную / `make load-test` |
| Мутационные | — | **не было** → `scripts/mutation/nf-mutate.mjs` | вручную / `make mutate`; Rust — `make mutants` (cargo-mutants) |
| E2E UI (браузер) | — | нет | — |
| Fuzz on-chain (trident/инструкционный) | — | нет (только рандомизированные тесты #52) | — |

### 2.2. Работают ли

- **GitHub Actions, коммит `02a402a` (2026-09-27 22:03 UTC):** `CI` — success (Anchor build, Anchor test, Backend build + self-tests, Backend on PostgreSQL, Frontend build, Secret scan); `AOF readiness regressions` — success (evidence, tenant-isolation с настоящим Postgres и RLS); `VRF devnet probe` — success.
- **Прогон в песочнице (без Rust/Anchor, без Prisma-движка):** readiness 92/92 ✓, OS 43/43 ✓, 7/7 python ✓, `audit-gate.mjs` ✓, backend self-tests 9/12 ✓ (`test:audit-security`, `test:admin-auth`, `test:fraud-signals` требуют сгенерированный Prisma-клиент — в CI ✓), watchtower 7/7 ✓, frontend `test:security` 16 ✓ + stylelint 5 ✓, новые readiness-тесты 9/9 ✓.
- **Локально на Mac** всё это делает `bash scripts/dev-local.sh check` (Prisma там генерируется), on-chain — `make test` (Anchor).

### 2.3. Мутационное тестирование — первый прогон

`node scripts/mutation/nf-mutate.mjs --max 60` (песочница, полный лог — `reports/mutation-baseline-2026-09-28.md`):

| Модуль | Мутантов | Убито | Выжило | Score |
|---|---:|---:|---:|---:|
| `security/walletProofCore.ts` | 20 | 15 → **20** | 5 → **0** | 75 % → **100 %** (добавлен тест глубины вложенности) |
| `security/authorityGate.ts` | 39 | 37 | 2 | 94.9 % |
| `security/purchaseBounds.ts` | 29 | 18 → **22** | 11 → 7 | 62 % → **76 %** (добавлен тест окна 300 с с реальным временем; остаток — мутации внутри regex) |
| `lib/rewardReceipt.ts` | 26 | 21 | 5 | 80.8 % |
| `lib/resourceRegistryCore.ts` | 31 | 30 | 1 | 96.8 % |
| `security/fraudHold.ts` | 46 | 37 | 9 | 80.4 % |
| `lib/chainIndexerCore.ts` | 60 из 102 | 46 | 14 | 76.7 % |
| `lib/vrfSettlement.ts` | 60 из 128 | 23 | 37 | **38.3 %** |
| `watchtower/src/event-normalizer.ts` | 60 из 83 | 40 | 20 | 66.7 % |

Вывод: модули, от которых зависит подпись и custody, покрыты хорошо. **`vrfSettlement.ts` — слабое место**: оффлайн-тест проверяет только фазу commit и декодирование исхода; сканирование pending-коммитов по механикам и сборка аккаунтов reveal-транзакций (все `if (mechanic === …)` выжили) проверяются лишь devnet-пробой. Рекомендация: тест с моком `program.account.*.all()` на все 6 механик и snapshot аккаунтов каждой reveal-инструкции.

## 3. Какую нагрузку выдержит игра

### 3.1. Профиль нагрузки одного игрока (из кода клиента)

`MillPanel`/`OvenPanel` — `loadState` каждые **5 с**, `PlantingPanel` — 10 с, `WellPanel` — 15 с, плюс `energy`, `weather`, `balances`, `player`, `inbox`, `quests`, `vip-status` при входе и по таймерам. Профиль фермы в `nf-load` = **0.567 req/s ≈ 34 запроса/мин на игрока**, из них ~70 % — маршруты, которые идут в Solana RPC (`/query/*`, `/energy`, `/weather`, `/season/vip-status`) **без кеша** (`lib/decode.ts` → `program.account.*.fetch`, для списков — `getProgramAccounts`).

### 3.2. Узкие места по порядку срабатывания

1. **Per-IP лимитер** (`middleware/rateLimit.ts`): было 300 запросов / 15 мин = 20/мин на IP. Один игрок на ферме выбирал квоту за ~9 минут, двое за одним NAT (семья, офис, мобильный CGNAT) — сразу; `/health` тоже считался (мониторинг мог «уронить» инстанс 429-ми). **Исправлено в этой ветке:** 900/15 мин (60/мин), `tx` 120/мин, `read` 1500/15 мин, всё через `RATE_LIMIT_*`; `/health` и `/ready` исключены. Store — память процесса: при N репликах лимит фактически ×N (нужен `rate-limit-redis`).
2. **RPC-квота.** ≈ 0.4 RPC-запроса/с на игрока. Публичный mainnet RPC (~100 req/10 с на IP) — **~25 игроков**; Helius/Triton free (~10 rps) — столько же; платные планы 100–500 rps — **250–1200 одновременных игроков на ферме**. `getProgramAccounts` (`/query/my-tools`, `/query/listings`, orderbook, rentals) на многих провайдерах ограничен отдельно или платный — это первые кандидаты на кеш/индексер.
3. **SQLite, один writer** — записи (`WalletOperation` SERIALIZABLE, `AuditLog` на каждую мутацию, `IdempotencyRecord`) сериализуются; чтения быстрые. Порядок: сотни–тысяча запросов/с на один процесс, но любая длинная запись блокирует всех. PostgreSQL снимает это.
4. **Один процесс Node + socket.io** — `/health` даёт тысячи req/s, JSON+Prisma — сотни–тысяча. Горизонтально масштабироваться нельзя, пока лимитер в памяти и БД — файл.

### 3.3. Оценка

| Конфигурация | Оценка одновременных игроков (вкладка фермы, p95 ≤ 500 мс) | Что ограничивает |
|---|---|---|
| Текущий compose (SQLite) + публичный/бесплатный RPC | **~20–30** | RPC-квота, затем лимитер (до фикса) |
| SQLite + платный RPC 100 rps | **~200–250** | RPC |
| Postgres + RPC 500 rps + кеш чтений 2–5 с | **~1000–3000** | CPU одного процесса Node; далее — реплики + Redis-лимитер |
| + push через `wsHub` вместо опроса 5 с | ×3–5 к предыдущему | — |

Измерить, а не оценивать: `node scripts/loadtest/nf-load.mjs --scenario farm --vus 100|200|400|800 --duration 90` против прод-конфигурации (`docs/LOAD_TESTING.md`). В песочнице против mock-сервера инструмент показал 1350 req/s, p95 48 мс (это проверка инструмента, не бэкенда).

### 3.4. Что сделать для роста (по убыванию эффекта)

1. Кеш чтений цепочки на 2–5 с по PDA (in-memory → Redis) в `lib/decode.ts`; `getProgramAccounts` — заменить на чтение из леджера индексера/`memcmp`-подписки.
2. Перевести таймеры фермы на push (`wsHub` уже есть) — минус ~70 % RPC-трафика.
3. Cut-over на PostgreSQL по `docs/POSTGRES_MIGRATION.md`; общий store лимитера.
4. Гейт в CI: `nf-load --scenario db --strict --p95-target 100` против SQLite in-memory на каждом PR (регрессии производительности).

## 4. ИИ-агенты и аудит (#71–#82)

Подробный разбор с кодом — `SECURITY_CHECKLIST_AI_AGENTS_2026-09-28.md`; политика — `docs/AI_AGENT_SECURITY_POLICY.md`. Главное:

- В репозитории **нет** ИИ-инструмента с доступом к кошельку («Soup» отсутствует); LLM-SDK не импортируется runtime-кодом — теперь это проверяет readiness-тест на каждом коммите.
- Hot-ключ authority ограничен инфраструктурой, а не промптом: `AUTHORITY_MODE` (fail-closed), on-chain `VaultGuard`/`IssuanceCap`, circuit breaker, wallet limits, wallet-proof на каждую мутацию.
- Против отравления ИИ-аудита: `check-hidden-unicode.mjs` (0 находок по 786 текстовым файлам; в CI), `ai-audit-bundle.mjs` (санитизация + проход без комментариев — 249 файлов очищены, TS-вывод парсится без ошибок), обновлённый §0 промпта аудита, лок конфигов агентов `security/agent-config.lock.json`.
- Durable nonce: клиентский `txGuard` отклоняет любые System-инструкции кроме перевода/создания минта; readiness-тест запрещает nonce-API в коде; политика подписантов и мониторинг nonce-аккаунтов — действие владельца (Squads).
- Игрокам: новый пункт правил на сайте «Не верь ИИ-помощнику на слово» с адресом ядра и перечнем того, чего игра никогда не просит.

## 5. Что изменено в этой ветке

| Файл | Что |
|---|---|
| `aof_backend/src/middleware/rateLimit.ts`, `.env.example` | лимиты 900/120/1500, env-настройка, `/health`+`/ready` вне лимита |
| `scripts/loadtest/nf-load.mjs`, `docs/LOAD_TESTING.md`, `Makefile` (`load-test`, `load-test-farm`), `aof_backend` `npm run loadtest` | нагрузочный инструмент |
| `scripts/mutation/nf-mutate.mjs`, `targets.json`, `Makefile` (`mutate`, `mutants`), `npm run test:mutation`, `reports/mutation-baseline-2026-09-28.md` | мутационные тесты |
| `aof_backend/scripts/rewardReceiptSelfTest.ts`, `walletProofSelfTest.ts` | тесты усилены по выжившим мутантам |
| `scripts/security/check-hidden-unicode.mjs`, `ai-audit-bundle.mjs`, `agent-config-lock.mjs`, `security/agent-config.lock.json` | защита ИИ-аудита и конфигов агентов |
| `tests/readiness/ai-agent-surface.test.cjs` | 9 статических проверок #71–#82 в CI |
| `docs/AI_AGENT_SECURITY_POLICY.md`, `SECURITY_CHECKLIST_AI_AGENTS_2026-09-28.md`, `PROMPT_AUDIT_FULL_STACK_V2.md` §0 п. 8–11 | политика и чек-лист |
| `frontend/src/site/content/rules.ts` | пункт для игроков (#81) |

## 6. Команды

```bash
cd ~/LeoGamesStudio/aof && git pull --ff-only

# всё, что проверяет CI без валидатора (frontend + readiness + os + backend self-tests)
bash scripts/dev-local.sh check

# статическая безопасность ИИ-агентов (в CI readiness)
make security-static

# мутационные тесты TS (≈5 мин) и Rust (нужен cargo install cargo-mutants)
make mutate
make mutants

# нагрузка: поднять бэкенд с TRUST_PROXY_HOPS=1, затем
make load-test VUS=50 DURATION=30
make load-test-farm VUS=200 DURATION=90

# бандлы для внешнего ИИ-аудита
make audit-bundle
```
