# AOF — Production Readiness Roadmap

_Обновлено: 2026-09-21 (итерация 2). Источник: внешний ревью-чеклист, сверенный с фактическим кодом._

Документ фиксирует, что из внешних замечаний **подтвердилось**, что **уже закрыто** в
этой ветке, и что **осталось** — с приоритетом, оценкой и явным решением по спорным пунктам.
Он не заменяет `AUDIT_2026-09-20.md` (техаудит) — это план работ.

---

## 1. Закрыто в этой ветке (P0, backend)

| # | Замечание | Факт | Решение |
|---|---|---|---|
| 1 | `POST /admin/send-tx` — произвольный relay | Подтверждено (`admin.ts`) | В production отвечает **404** (`nonProductionOnly`). Оставлен только для devnet-отладки. |
| 2 | `test-grant`, `test-grant-potato`, `test-grant-tools`, `mint-resource` в проде | Подтверждено, guard отсутствовал | **404 в production** независимо от токена. Regression-тест `test:admin-auth`. |
| 3 | Единый `ADMIN_TOKEN` | Подтверждено | Разделён на **ops** (`ADMIN_TOKEN`) и **read** (`ADMIN_READ_TOKEN`). GET под `/admin/audit`, `/admin/economy`, `/security` принимает read; любой POST — только ops. 5 ролей/2FA — см. §3. |
| 4 | `trust proxy` не настроен | Подтверждено — не было вовсе | `app.set("trust proxy", TRUST_PROXY_HOPS)`; в production переменная обязательна; `docker-compose.prod.yml` выставляет 1. |
| 5 | `readLimiter` объявлен, но не подключён | Подтверждено | Подключён к `/query`, `/whale-alerts`, `/market-data`, `/public`. |
| 6 | `GET /whale-alerts/feed` без защиты | **Частично**: PII в модели нет (type/mint/amount/price/ts) | Явный `select`, санитайз `limit`, readLimiter. Авторизация не нужна — это публичная лента по дизайну. |
| 7 | `127.0.0.1:8899` в price tracker | Подтверждено | Берётся из `RPC_URL`; в production devnet/localhost запрещён. |
| 8 | Wallet prefix в device fingerprint | Подтверждено — ломало сам сигнал | Убран; добавлен `FINGERPRINT_SALT`, заголовок `x-timezone`. |
| 9 | `AuditLog.user` из `req.body.user` | Подтверждено — подделываемо | Actor = `authenticatedWallet` → `admin:<role>` → `anonymous`. Значение из body сохраняется как `metadata.claimedUser`. |
| 10 | Экономический монитор показывает нули как факт | Подтверждено: mint/burn/topHolders — заглушки `return []` | `fieldQuality` per-field + `dataQuality`; API отдаёт `null` вместо 0 для `unavailable`; дашборд показывает бейджи и предупреждение. |
| 11 | gitleaks по полной истории | Выполнен regex-скан по всем 70 коммитам всех веток (бинарь gitleaks недоступен в песочнице — см. §4) | Реальных секретов не найдено. |

### 1b. Закрыто во второй итерации

| # | Задача | Что сделано |
|---|---|---|
| 12 | Workers отдельно от API | `docker-compose.prod.yml`: `price-cranker`, `price-tracker`, `trust-worker`, `push-worker` как отдельные сервисы за profiles `market`/`trust`/`push` (SQLite single-writer — включать осознанно). `farm-trader` намеренно не добавлен — продуктовое решение. |
| 13 | trust-worker не мог пушить snapshot on-chain | `/trust/snapshot/update` за `requireAdmin`, а воркер слал без токена → тихий 401. Теперь шлёт `ADMIN_TOKEN`, `BACKEND_URL=http://backend:8080` в compose. |
| 14 | Readiness/liveness | `/health` (liveness, без зависимостей) + `/ready` (DB `SELECT 1` + RPC `getSlot`, таймаут 3с, 503 при сбое). Для LB/reverse-proxy использовать `/ready`, для рестарта контейнера — `/health`. |
| 15 | Верификация program ID / bytecode | `scripts/verify-programs.sh <cluster> [authority] [deploy_dir]`: существование, executable, upgrade authority, `declare_id!` drift, sha256 on-chain dump vs локальный `.so`. |
| 16 | Backup + restore drill | `scripts/backup-db.sh backup|restore|drill` — `sqlite3 .backup` (не `cp`), integrity_check, sha256, retention, drill с `prisma migrate status` на восстановленной копии. |
| 17 | gitleaks как постоянный gate | job `secrets-scan` в CI с `fetch-depth: 0` + `.gitleaks.toml` (allowlist плейсхолдеров). |
| 18 | Issuance caps — дизайн | `docs/ISSUANCE_CAPS_DESIGN.md`: отдельный PDA на kind, эпохи в слотах, fail-closed, `set_cap` не сбрасывает счётчик, `MintDelegate` для разделения hot-key и Squads. Реализация требует SBPF-тулчейна (в песочнице недоступен). |

**Не изменено**: `AuditLog.action` по-прежнему = нормализованный URL. Замена на бизнес-тип
события требует ручной разметки ~60 роутов; сделать вместе с indexer'ом (§2.3), чтобы
не размечать дважды.

---

## 2. Осталось до mainnet — согласованный порядок

### 2.1 On-chain (блокеры, требуют редеплоя и внешнего аудита)

| Приоритет | Задача | Комментарий |
|---|---|---|
| P0 | **Issuance caps для `mint_resource`** | Дизайн готов: `docs/ISSUANCE_CAPS_DESIGN.md`. Следующий шаг — реализация в `aof-core` + validator-тесты в CI `programs`/`anchor-test`. |
| P0 | **Authority → Squads multisig** для `set_fees`, `set_paused`, `set_resource_mints`, `set_craft_economy`, treasury | Это и есть «dual approval» — делать on-chain, а не approval-flow в Express. Hot-key backend'а остаётся только для `mint_resource_once` (inbox rewards) под cap. |
| P0 | Верификация 6 program ID через RPC + сверка deployed bytecode с audited commit | Скрипт готов (`scripts/verify-programs.sh`). Осталось: прогнать против devnet с артефактами CI и записать хэши в release manifest. |
| P0 | Внешний аудит всех программ | После caps и multisig, иначе аудит устареет. |
| P1 | Bonding curve / `minted_count` / поведение burns в цене | Зафиксировать формулу в `docs/ECONOMY.md`, добавить property-тесты в Rust. |

### 2.2 Инфраструктура

| Приоритет | Задача | Комментарий |
|---|---|---|
| P0 | **PostgreSQL** | Смена provider + `metadata String` → `Json` + миграция данных + тест `test:idempotency-db` на PG. Отдельная ветка. SQLite остаётся допустимым только для devnet/staging single-host. |
| P0 | Staging окружение | Тот же compose с `NODE_ENV=staging`? **Нет** — `nonProductionOnly` и другие guard'ы смотрят на `production`. Staging должен идти с `NODE_ENV=production` и своими ключами, иначе он не проверяет prod-поведение. |
| ~~P0~~ done | Workers в compose | Сделано (profiles). **Открытый вопрос** остаётся: нужен ли `farm-trader` в проде. |
| P0 | Backup + restore drill | Скрипт готов. Осталось: cron на хосте + первый реальный drill на staging (в песочнице нет `sqlite3`, скрипт не исполнялся). |
| P1 | Redis | **Только** когда появится второй инстанс backend. До этого — лишний компонент и лишняя точка отказа. |
| ~~P1~~ done | Readiness/liveness раздельно | `/health` + `/ready`. |
| P1 | Prometheus / OTel / Sentry | `prom-client` + `/metrics` за admin-read токеном; Sentry для backend и frontend. |

### 2.3 Данные

| Приоритет | Задача | Комментарий |
|---|---|---|
| P0 | **On-chain event indexer** для `aof_core`, `aof_market`, `aof_quests` | Таблица `ChainEvent(signature, slot, blockTime, programId, eventType, walletHash, mint, amount, success)` с unique(signature, index). Backfill через `getSignaturesForAddress` с курсором. После него `ECONOMY_FIELD_QUALITY.potatoMinted24h/Burned24h/topHolders` → `complete`. |
| P1 | `AuditLog.action` → бизнес-тип | Вместе с indexer'ом, единый словарь событий. |
| P1 | Daily player facts | Материализованная таблица от indexer + AuditLog. |

### 2.4 Anti-fraud

| Приоритет | Задача | Комментарий |
|---|---|---|
| P1 | Сигналы: funding source, wallet age (реальный, через первый tx), IP/device cluster, reward velocity | После indexer'а — большинство сигналов из него. |
| P1 | Trust Index: убрать placeholder-возраст и rebirth-заглушку, staking из on-chain stake | Проверить `services/trust-worker/formula.js`. |
| P1 | Fraud review queue + аудит каждой резолюции, **без авто-бана** | Согласны полностью: авто-бан без human review недопустим. |

---

## 3. Спорные пункты — принятые решения

| Замечание | Решение | Почему |
|---|---|---|
| 5 ролей RBAC (viewer/analyst/operator/finance/superadmin) | **Нет, 2 роли** (read/ops) | Команда 1–3 человека. 5 ролей без реальных пользователей — мёртвый код. Расширить, когда появятся отдельные люди на finance. |
| 2FA для опасных действий | **Заменяется Squads multisig** | Опасные действия должны требовать вторую подпись on-chain, а не второй фактор к HTTP-токену, который всё равно живёт в одном `.env`. |
| Dual approval в backend | **Squads** | См. выше. |
| Переписать историю Git (убрать IP/UA) | **Нет** | В истории не найдено секретов (см. §4). IP/UA в audit-логах живут в БД, не в git. Переписывание истории ломает все клоны/PR ради нулевого выигрыша. Ротация ключей при любом подозрении — да. |
| Продуктовые метрики (DAU/retention/funnel/crash) | **Отдельный трек после запуска** | Не блокер безопасности. Требует indexer + client analytics SDK. |
| Notification service, P0/P1/P2 каналы, on-call/SLA | **Минимум**: Telegram read-only + runbook | Запрет write-действий из Telegram — да (проверить, что бот их не делает). SLA/on-call — когда есть кому дежурить. |
| Redis сейчас | **Нет** | Один инстанс backend; express-rate-limit in-memory достаточно. |

---

## 4. Скан истории Git на секреты (2026-09-21)

- Охват: все 70 коммитов, все ветки (`git rev-list --objects --all`), каждый blob один раз.
- Паттерны: PEM private key, Solana JSON keypair (64 байта), base58 86–88 символов,
  `*_SECRET_KEY|ADMIN_TOKEN|BOT_TOKEN|API_KEY|DATABASE_URL=<значение>`, Telegram bot token,
  JWT, AWS/GitHub/OpenAI/Firebase ключи, публичные IPv4 в коде.
- Результат: **реальных секретов не найдено.** Все совпадения — плейсхолдеры в
  `.env.example`, `docs/*.md`, `docker-compose.prod.yml` и `process.env.X` в `functions/index.js`.
- Файлы-ключи (`solana/keys/*`, `id.json`, `.env`) в истории отсутствуют.
- Ограничение: бинарь `gitleaks` не удалось скачать из песочницы (сетевой сбой), скан выполнен
  эквивалентным набором regex. **Рекомендация**: добавить `gitleaks/gitleaks-action@v2`
  с `fetch-depth: 0` в CI как постоянный gate — это 10 строк в `ci.yml`.

---

## 5. Критерии готовности (обновлённые)

- [x] `send-tx`, `test-grant*`, `mint-resource` недоступны в production
- [x] Admin-токен разделён на read/ops
- [x] `trust proxy`, readLimiter, RPC_URL в воркерах
- [x] Audit log не подделывается через body
- [x] Метрики экономики помечены data quality, нули не выдаются за факты
- [x] История Git проверена на секреты
- [ ] On-chain issuance caps
- [ ] Authority на Squads multisig
- [ ] Program ID / bytecode verified (скрипт есть, прогон против devnet/mainnet — нет)
- [ ] PostgreSQL в production
- [ ] Backup/restore drill пройден на реальных данных (скрипт есть)
- [x] Workers вынесены в отдельные сервисы compose
- [ ] On-chain indexer работает, `ECONOMY_FIELD_QUALITY` → complete
- [ ] Staging с `NODE_ENV=production`
- [ ] Внешний аудит завершён
