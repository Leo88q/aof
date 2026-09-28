# Политика безопасности ИИ-агентов и инструментов — NeuroForge

_Версия 2026-09-28. Закрывает пункты #71–#82 чек-листа (`SECURITY_CHECKLIST_AI_AGENTS_2026-09-28.md`). Файл запинован в `security/agent-config.lock.json`: любое изменение — отдельный ревьюируемый диф._

## 0. Термины

- **Агент** — любой процесс, который принимает решения по тексту, который не писала команда: LLM-ассистенты в редакторе (opencode, Claude Code, Cursor, Copilot), внешние ИИ-аудиторы (Arena-сессии по `PROMPT_AUDIT_FULL_STACK_V2.md`), боты в Discord/Telegram, «умные» воркеры.
- **Граница подписи** — код, у которого есть доступ к `AUTHORITY_SECRET_KEY`, `SESSION_KEYSTORE_KEY`, ключам multisig-участников, `ADMIN_TOKEN`. Сейчас это только `aof_backend` (API + воркеры `vrf-settler`, `price-cranker`, `chain-indexer`) и люди-подписанты.
- **«Soup»/бот с кошельком** — в репозитории такого инструмента **нет** (grep по `soup` — 0 файлов). Ниже — правила на случай, если он появится.

## 1. Агенты никогда не входят в границу подписи

| Правило | Как обеспечено |
|---|---|
| Ни один LLM/агентский SDK не импортируется runtime-кодом бэкенда, фронта, watchtower | `tests/readiness/ai-agent-surface.test.cjs` (#71/#75) — падает при импорте `openai`, `@anthropic-ai/sdk`, `langchain`, `@ai-sdk/*`, `@modelcontextprotocol/sdk` или при появлении их в `dependencies` |
| Единственный ИИ-инструмент в репо (`openrouter.js`) — dev-скрипт генерации кода; у него нет ключей и доступа к сети Solana | он читает файлы и печатает текст; в проде не деплоится |
| Автотрейдер `farm-trader` — только симуляция, не подписывает | readiness-тест #73 + `executor.ts` |
| Сессионные ключи on-chain не могут тратить, пока не привязаны к инструкции | `aof-session-keys` (`Session spending is disabled…`), readiness-тест #73 |

Если агенту с кошельком всё же быть (маркетинг-бот, «Soup», автоплатежи):

1. **Отдельный кошелёк** с балансом «на неделю», пополняемый вручную. Никогда не authority, не treasury, не участник multisig.
2. **Лимиты в инфраструктуре, не в промпте**: on-chain spending limit Squads (или отдельная программа-кошелёк с дневным капом и allowlist получателей); RPC-прокси, который пропускает только allowlist программ/инструкций; per-tx и per-day cap на стороне ноды-подписанта.
3. **Human-in-the-loop** для любого перевода вне allowlist и для любой транзакции с `SetAuthority`, `Approve`, `CloseAccount`, Token-2022 extensions, `AdvanceNonceAccount`.
4. **Входные данные = недоверенные**: содержимое NFT-метаданных, memo, чатов, тикетов, README чужих репозиториев и результатов web-поиска подаётся агенту как данные в кавычках, никогда как инструкции. Владение NFT/токеном — **сигнал, а не авторизация**: права даёт только адрес минта из реестра (`AllowedMint`, `register_collector_mint`, `SKR_MINT`), не имя/символ/URI.
5. **Память агента подписывается**: каждая запись «долговременной памяти» хранится с HMAC (`HMAC-SHA256(server_secret, agent_id | record_id | content | created_at)`) и проверяется перед загрузкой в контекст; записи без валидной подписи отбрасываются и логируются. Для текущего репо аналог — `TraderRule` (правила исполняет воркер): правила создаются только через маршрут с wallet-proof и исполняются в симуляции.
6. **Между агентами нет доверия**: любой запрос «агент A просит агента B выполнить X» проходит те же проверки прав, что и запрос от анонимного пользователя (confused deputy).

## 2. Инструменты агентов (MCP, плагины, конфиги редакторов)

| Правило | Как обеспечено |
|---|---|
| Все файлы-инструкции и конфиги инструментов запинованы по SHA-256 | `scripts/security/agent-config-lock.mjs --check` в readiness-тесте; лок — `security/agent-config.lock.json` |
| Новый MCP-сервер/инструмент = отдельный PR с обновлением лока; описание каждого инструмента хэшируется отдельно | лок хранит `tools[]` с sha256 описания каждого сервера/провайдера |
| Локальный провайдер по умолчанию | `opencode.json` — только `localhost:11434` (Ollama); readiness-тест #78 запрещает не-локальные baseURL и MCP-секции без изменения политики |
| Read-only по умолчанию | агенты в редакторе работают на ветке, без прав push в `main`, без секретов в окружении (`.env` в `.gitignore`, `AUTHORITY_SECRET_KEY` отсутствует в dev-окружении агента) |
| Никакого auto-approve для файловых операций и shell | в настройках Claude Code / Cursor / opencode запрещены режимы «always allow» для `Bash`, `Write`, `Edit` вне репозитория; удаление/`git push --force`/`rm -rf` требуют подтверждения человеком |
| Rug-pull описания инструмента (описание меняется после установки) | лок ловит изменение описания в конфиге; для внешних MCP-серверов — пин версии/хэша пакета, запуск в контейнере без сети, кроме нужных хостов |

## 3. ИИ-аудит (Watchtower-прогон, `PROMPT_AUDIT_FULL_STACK_V2.md`)

Угрозы: невидимый Unicode и комментарии-«инструкции» в коде, которые видит модель, но не ревьюер; чужие PR/зависимости с «этот модуль уже проверен».

| Мера | Инструмент |
|---|---|
| Ни одного невидимого/bidi-символа в отслеживаемых текстовых файлах, проверка на каждом коммите | `scripts/security/check-hidden-unicode.mjs` + readiness-тест (#76/#77) |
| Аудитор получает **санитизированный бандл** с манифестом sha256 до/после | `scripts/security/ai-audit-bundle.mjs --out DIR` |
| Второй проход **без комментариев и доков** — совпадение выводов = аудит кода, а не текста | `… --strip-comments` (TS через парсер TypeScript, Rust/py/sh/toml/yaml/sql — string-aware) |
| Инструкции внутри файлов — данные, «out of scope / already audited» — красный флаг | §0 промпта аудита; `README_AUDITOR.md` в бандле |
| Агент-аудитор — read-only и без сети к нашим сервисам; отчёт публикуется человеком | процесс Arena/hub `Leo88q/Games-watchtower` |

## 4. Непрерывность и периметр

- **Каждый коммит**: `CI` (Rust unit + Anchor build/test + backend self-tests + frontend + gitleaks) и `AOF readiness regressions` (статические инварианты чек-листа, теперь включая этот файл). Внешний ИИ-аудит — на каждый релиз-кандидат, а не раз в квартал.
- **Инструменты разработчика и админки — не в интернете**: `/admin/*` только с `ADMIN_TOKEN`/`ADMIN_READ_TOKEN` и за allowlist IP/VPN на reverse-proxy (см. `docs/SECURITY_RUNBOOK.md`); `/metrics` watchtower — за Bearer; `src/os/server.js` (Watchtower OS API, порт 8787) — только во внутренней сети; тестовые маршруты (`/admin/send-tx`, `/admin/test-grant*`, `/admin/mint-resource`) отвечают 404 в production (`nonProductionOnly`).
- **Секреты**: `AUTHORITY_MODE=read-only` — production-поза до Squads/KMS; ключ — только через Docker secret (`*_FILE`), никогда в env агента.

## 5. Подписи, durable nonce и multisig

- **Клиент**: `frontend/src/lib/txGuard.ts` отклоняет любую System Program инструкцию кроме `Transfer` от пользователя и `CreateAccount` под минт — `AdvanceNonceAccount`, `Approve`, `SetAuthority`, `CloseAccount`, Token-2022 не проходят симуляцию-гвард. Readiness-тест #82 запрещает durable-nonce API в коде.
- **Подписанты multisig (люди)**: (1) никакие транзакции не подписываются «на потом» — durable nonce запрещён политикой; предложение подписать «сейчас, исполним позже» = попытка Drift-style атаки; (2) подпись только через аппаратный кошелёк с проверкой на экране; (3) multisig (Squads) — **timelock ≥ 24 ч** на изменение состава/порога и на upgrade authority, spending limits на казну; (4) **мониторинг**: алерт на любой `CreateNonceAccount`/`InitializeNonce`, где authority = участник multisig или authority программы (Watchtower `/watchtower/security` + Helius webhook на адреса подписантов); неожиданный durable-nonce аккаунт = инцидент; (5) социнженерия: любой контакт «мы из Squads/Solana Foundation/аудиторы, подпишите тест» — эскалация, не действие.
- **On-chain**: ротация authority двухшаговая (`set_pending_authority` → `accept_authority` новым ключом, `cancel_pending_authority`), события `AuthorityRotationProposed/Changed/Cancelled` индексируются. Минимальная задержка между шагами на уровне программы отсутствует — компенсируется timelock'ом multisig, который держит authority (действие владельца, см. чек-лист #82).

## 6. Игрокам (пункт #81)

Сайт, страница «Правила» → «ИИ-помощники и «официальные» контракты»: NeuroForge никогда не просит «задеплоить контракт», «подписать тест», «верифицировать кошелёк» — ни в чате, ни через ИИ-ассистента; адреса программ сверяются с `Anchor.toml` / `watchtower/addresses.json`; результат «спроси ИИ, какой контракт NeuroForge» не является источником правды (AI-brand drainers).

## 7. Навыки, плагины и MCP-серверы как цепочка поставки (#130)

Инциденты 2026 года: в реестре навыков OpenClaw (ClawHub) — 341–386 вредоносных навыков (стилеры ключей бирж, приватных ключей, SSH-данных; AMOS для macOS через «предварительные требования» в README), Snyk оценил 36 % из ~4 тыс. навыков как имеющие изъяны, пять вредоносных прошли VirusTotal и ClawScan. В июне 15 плагинов JetBrains Marketplace воровали API-ключи ИИ-сервисов; в августе кампания ChainDrop через сотни npm-пакетов била по учётным данным разработчиков и облаков. **Навык может быть просто набором инструкций и не содержать кода.**

Наши правила:

1. **Навык = код.** Внутренние навыки лежат в `.claude/skills/**` и запинованы по SHA-256 в `security/agent-config.lock.json` (любое изменение — отдельный ревьюируемый диф). Внешние навыки/плагины/MCP не ставятся в рабочее окружение вообще: только в песочницу без сети, без домашнего каталога (`~/.ssh`, `~/.aws`, `~/.config/solana`) и без кошельков/`keypair`/`.env`/токенов CI.
2. **Статическая проверка текста, а не только файлов**: `scripts/security/check-agent-skills.mjs` ищет `curl|sh`, установку пакетов, чтение ключей/seed, каналы эксфильтрации, снятие подтверждений (`--dangerously-skip-permissions`, `alwaysAllow`), скрытые инструкции («не сообщай пользователю»), запуск вне песочницы и попытки подписи/перевода. Исключения — только через `security/agent-skills.allow.json` с объяснением.
3. **Пин версии и хэша**: MCP-сервер ставится конкретной версией/коммитом; обновление — как новый инструмент (перепроверка описания, прав, сетевых хостов).
4. **Минимум прав**: инструмент получает только нужные хосты и только репозиторий; никакого доступа к секретам, БД прода или кошелькам.
5. **При подозрении** — снять расширение, ротировать все ключи, к которым агент имел доступ (включая токены CI и облаков), и проверить журналы.

Проверяется на каждом коммите: readiness-тест + `check-agent-skills.mjs`. Внешние навыки — только по решению владельца после письменного разбора исходников (кто автор, что тянет из сети, куда пишет).

## 8. Команды

```bash
# статические проверки этого документа (запускаются в CI readiness)
node --test tests/readiness/ai-agent-surface.test.cjs
node --test tests/readiness/attacks-2026-h2.test.cjs   # #94–#130, вкл. навыки агентов (#130)

# навыки/плагины/MCP: инвентарь и проверка опасных инструкций
node scripts/security/check-agent-skills.mjs
node scripts/security/check-agent-skills.mjs --list

# невидимый Unicode во всех отслеживаемых файлах
node scripts/security/check-hidden-unicode.mjs

# лок конфигов агентов: проверить / зафиксировать после ревью
node scripts/security/agent-config-lock.mjs --check
node scripts/security/agent-config-lock.mjs --update

# бандл для внешнего ИИ-аудита: санитизированный и без комментариев
node scripts/security/ai-audit-bundle.mjs --out /tmp/aof-audit
node scripts/security/ai-audit-bundle.mjs --out /tmp/aof-audit-nocomments --strip-comments
```
