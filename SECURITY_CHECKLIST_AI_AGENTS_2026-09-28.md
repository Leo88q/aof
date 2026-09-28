# Чек-лист безопасности крипто-игр (пункты 71–82: ИИ-агенты, отравление аудита, подписи) — разбор NeuroForge, 2026-09-28

Продолжение отчётов:
- `SECURITY_CHECKLIST_REVIEW_2026-09-25.md` — пункты 1–30;
- `SECURITY_CHECKLIST_GAMES_2026-09-26.md` — пункты 31–70;
- `docs/REVIEW_DB_TESTS_LOAD_AI_2026-09-28.md` — базы данных, тесты, нагрузка (этот же проход).
- `SECURITY_CHECKLIST_ATTACKS_2026-09-28.md` — пункты 94–130 (атаки июня–сентября 2026 и дополнения по всему году).

Обозначения: ✅ защищено; 🔧 исправлено/добавлено в этой ветке; ⚠️ действие владельца; — неприменимо.

## Итог

| | |
|---|---|
| Защищено изначально | 4: #72, #73, #75, #82 (клиентская часть) |
| Добавлено сейчас | 6: #74 (политика + лок), #76, #77, #78/#79, #80 (статика на каждом коммите), #81 |
| Действия владельца | 2: #82 (timelock Squads, мониторинг nonce-аккаунтов), #80 (VPN/allowlist на reverse-proxy) |
| Неприменимо сейчас | #71 — ИИ-агента с кошельком в репозитории нет («Soup» — 0 файлов); правила на случай появления — `docs/AI_AGENT_SECURITY_POLICY.md` §1 |

Новые проверки на каждый коммит: `tests/readiness/ai-agent-surface.test.cjs` (9 тестов, запускаются в `AOF readiness regressions` и `bash scripts/dev-local.sh check`).

## T. Агенты с доступом к активам

| # | Пункт | Статус | Разбор по коду |
|---|---|---|---|
| 71 | Косвенная инъекция промпта в агента с кошельком («Soup» читает NFT-метаданные/чат и переводит средства) | — 🔧 | Такого агента нет: `grep -ri soup` — 0; LLM-SDK (`openai`, `@anthropic-ai/sdk`, `langchain`, `@ai-sdk/*`, `@modelcontextprotocol/sdk`) не импортируются runtime-кодом `aof_backend/src`, `services`, `watchtower/src`, `frontend/src` и отсутствуют в `dependencies` — **проверяется readiness-тестом**. Единственный ИИ-скрипт `openrouter.js` — dev-генератор кода без ключей и RPC. Если агент с кошельком появится: отдельный кошелёк с недельным балансом, on-chain spending limit, allowlist получателей на уровне RPC-прокси, human-in-the-loop вне allowlist, весь внешний текст — в кавычках как данные (политика §1) |
| 72 | Владение NFT/токеном как авторизация | ✅ | Привилегии выдаются только по **адресу минта из реестра**, никогда по имени/символу/URI: `lib/skrPrivilege.ts` — фиксированный `SKR_MINT` (пока placeholder → привилегия выключена), проверка Saga-NFT — TODO с обязательной проверкой `collection.verified` + адрес коллекции; VIP — только из on-chain `SeasonPass` PDA (`routes/vipStatus.ts`, 503 без цепочки, БД-фолбэка нет); коллекционные NFT — `register_collector_mint` on-chain; выплаты — только на минты из `MaterialMints` (`charge_vault_withdrawal`). Клиентские заявления «у меня есть NFT X» бэкендом не принимаются — он читает цепочку сам |
| 73 | Confused deputy между агентами | ✅ | Единственные «агенты» — воркеры бэкенда. `farm-trader` — **только симуляция** (`executor.ts`, реальный режим удалён 2026-09-26; readiness-тест держит), `aof-session-keys` — спенд отключён до атомарной привязки к инструкции (`Session spending is disabled…`, тест держит). Каждая мутация API — только с wallet-proof подписью того кошелька, чьи данные меняются (`requireMappedWalletProof()` глобально, `security.ts` берёт кошелёк из proof, а не из body) — межсервисных «доверенных» вызовов от имени игрока нет |
| 74 | Отравление памяти агента → HMAC на записи | 🔧 | Долговременной памяти ИИ-агента в системе нет. Аналог — файлы-инструкции агентов и конфиги инструментов, которые каждая новая сессия читает как «память»: `CLAUDE.md`, `QWEN.md`, `opencode.json`, `PROMPT_AUDIT_FULL_STACK_V2.md`, `docs/AI_AGENT_SECURITY_POLICY.md` теперь запинованы по SHA-256 в `security/agent-config.lock.json` (`scripts/security/agent-config-lock.mjs --check` в CI) — любое изменение обязано прийти отдельным ревьюируемым дифом. Правило HMAC для будущей памяти агента зафиксировано в политике §1 п. 5 (`HMAC-SHA256(secret, agent_id|record_id|content|created_at)`, записи без подписи отбрасываются и логируются) |
| 75 | Human-in-the-loop, лимиты и allowlist — в инфраструктуре, не в промпте | ✅ | Для единственного автоматического подписанта (authority бэкенда): `AUTHORITY_MODE=read-only` как прод-поза (fail-closed, `authorityGate.ts`, 503 на подпись), ключ только через Docker secret; on-chain — `VaultGuard` (cap per epoch + max per tx, обязателен для каждого минта), `IssuanceCap`, `set_paused`/`emergency_stop`/`set_cashout_frozen` (guardian), `SetFees` с потолками; офчейн — `CircuitBreaker`, `walletLimits` (SERIALIZABLE), `AllowedMint`, `txSimulator`. Readiness-тест проверяет, что эти якоря на месте |

## U. Отравление ИИ-аудита и поставки кода

| # | Пункт | Статус | Разбор по коду |
|---|---|---|---|
| 76 | Невидимый Unicode / скрытые инструкции в README и комментариях для ИИ-аудитора | 🔧 | `scripts/security/check-hidden-unicode.mjs`: все отслеживаемые текстовые файлы (786) сканируются на zero-width, bidi-overrides/isolates (Trojan Source), TAG-блок U+E0000–E007F (невидимый ASCII), supplementary variation selectors, soft hyphen, C0/C1, BOM не в начале; ZWJ внутри эмодзи (👨‍🌾) разрешён; allowlist — `hidden-unicode.allow.json`. Результат сейчас: **0 находок**. Запускается readiness-тестом на каждом push/PR |
| 77 | Аудит на коде без комментариев; аудитор не слушает «out of scope» | 🔧 | `scripts/security/ai-audit-bundle.mjs --out DIR [--strip-comments]`: копия репозитория без секретов/ключей/БД/lock-файлов, невидимый Unicode удалён и **залогирован в MANIFEST.json** (sha256 до/после каждого файла, git commit), `--strip-comments` снимает комментарии и док-строки (TS/JS — через парсер TypeScript с обходом токенов, Rust — вложенные блоки/raw/byte-строки, py/sh/toml/yaml/prisma/sql/css — string-aware). Проверено: 249 файлов очищено, 154 TS-файла бандла парсятся без ошибок, в `aof_backend/src` и `frontend/src/lib` не осталось ни одной строки комментария. В бандл кладётся `README_AUDITOR.md`; `PROMPT_AUDIT_FULL_STACK_V2.md` §0 п. 8–11 требует два прохода и трактует «already audited / out of scope» как находку |
| 78 | Отравление описаний MCP-инструментов | 🔧 | В репозитории один конфиг агента — `opencode.json` (локальный Ollama, MCP-секций нет). Лок хэширует каждый провайдер/сервер/описание инструмента отдельно (`tools[]`), readiness-тест запрещает не-локальные `baseURL` и появление `mcp`/`mcpServers` без изменения политики; для внешних MCP — пин версии, контейнер без сети (политика §2) |
| 79 | Компрометация «роутера»/оркестратора агентов → read-only по умолчанию | 🔧 | Агентские сессии (Arena, редакторы) работают на ветке без прав на `main`, без секретов в окружении (`.env` в `.gitignore`, `AUTHORITY_SECRET_KEY` у агента отсутствует), auto-approve для `Bash/Write/Edit` вне репозитория запрещён политикой; аудитор — строго read-only (§0 промпта). Технически подпись невозможна без `AUTHORITY_SECRET_KEY`/`SESSION_KEYSTORE_KEY`, которых у агентов нет |
| 80 | Непрерывный аудит на каждый коммит; dev/admin-инструменты за VPN/allowlist | 🔧 ⚠️ | На каждый push/PR: `CI` (Rust unit, Anchor build + test на validator, backend self-tests на SQLite и Postgres, frontend, gitleaks) + `AOF readiness regressions` (101 статический инвариант, теперь включая #71–#82). Внешний ИИ-аудит — на релиз-кандидат по обновлённому промпту. **Действие владельца:** `/admin/*`, `src/os/server.js` (:8787), watchtower `/metrics` — за allowlist IP/VPN на reverse-proxy (в коде — токены `ADMIN_TOKEN`/`ADMIN_READ_TOKEN`, Bearer у watchtower, `nonProductionOnly` → 404 для тестовых маршрутов) |

## V. Игроки, подписи, multisig

| # | Пункт | Статус | Разбор по коду |
|---|---|---|---|
| 81 | AI-brand drainers: предупредить игроков, что ИИ подсказывает чужие адреса | 🔧 | Сайт → «Правила» → **«Не верь ИИ-помощнику на слово»** (`frontend/src/site/content/rules.ts`): игра никогда не просит деплоить контракт/подписать тест/верифицировать кошелёк; адреса программ — только из `Anchor.toml`/`watchtower/addresses.json` (ядро `HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq`); «пустая» подпись, durable nonce, Approve, SetAuthority в игре не встречаются |
| 82 | Durable nonce + социнженерия подписантов (Drift); ненулевой timelock; мониторинг nonce-аккаунтов | ✅ ⚠️ | **Клиент:** `frontend/src/lib/txGuard.ts` отклоняет любую System-инструкцию кроме `Transfer` от пользователя и `CreateAccount` под 82-байтный минт (`Unsupported System Program instruction`) — `AdvanceNonceAccount` в транзакцию игры не попадёт; Token: только `InitializeMint`, без `Approve`/`SetAuthority`; Token-2022 и прямой Switchboard — отказ. Durable-nonce API отсутствуют в клиенте, бэкенде и watchtower — **readiness-тест запрещает их появление**. **On-chain:** ротация authority двухшаговая с событиями (`set_pending_authority` → `accept_authority` новым ключом, `cancel_pending_authority`), но без минимальной задержки на уровне программы. **Действия владельца:** (1) Squads: timelock ≥ 24 ч на изменение состава/порога и upgrade authority, spending limits на казну; (2) политика подписантов: аппаратные кошельки, никаких подписей «на потом», любое предложение «подпишите тест/верификацию» — эскалация; (3) алерт на `CreateNonceAccount`/`InitializeNonce` с authority = участник multisig или authority программы (Helius webhook на адреса подписантов + `/watchtower/security`); появление такого аккаунта — инцидент |

## Тесты этого прохода

- `tests/readiness/ai-agent-surface.test.cjs` — 9 тестов: невидимый Unicode; лок конфигов агентов и обязательные записи; локальность провайдера / отсутствие MCP; запрет durable-nonce API; якоря `txGuard`; отсутствие LLM-SDK в runtime и `dependencies`; farm-trader simulation-only + спенд сессий отключён; требования к промпту аудита; якоря тормозов authority (`AUTHORITY_MODE`, `VaultGuard`, `charge_vault_withdrawal`, `requireMappedWalletProof`, circuit breaker).
- `scripts/security/check-hidden-unicode.mjs` — самопроверка на файле с U+200B и TAG-символом даёт 2 находки и exit 1.
- `scripts/security/ai-audit-bundle.mjs --strip-comments` — 154 TS-файла результата парсятся `typescript` без диагностик.

## Команды

```bash
make security-static      # unicode + lock + readiness-тесты #71–#82
make audit-bundle         # /tmp/aof-audit и /tmp/aof-audit-nocomments
node scripts/security/agent-config-lock.mjs --update   # после ревью изменений CLAUDE.md/opencode.json/промпта
```
