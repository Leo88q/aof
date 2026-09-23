# AOF — W1 remediation / readiness evidence

Дата: 2026-09-23. Рабочая ветка: `arena/01a0cf4b-aof`.
База: `6f4cdb1045d629e06685b99d0206f29a84665fe5`.
**Результат: частичный W1, не L3/L4 и не разрешение production-релиза.**

## A — Контекст и контракт

Хаб клонирован read-only из default branch, ревизия
`1aea14c7c9422022d8581abcca25649e8d2edd24`. Его исходный аудит сохранён
неизменённым в `aof-hub-baseline.json` (17 findings: 1 critical, 11 high, 5 low).

В этой ревизии **нет** `prompts/arena/00_HUB_CONTRACT.md`,
`docs/ECOSYSTEM_MAXIMUM_TARGET.md`, `scripts/check-ecosystem-target.mjs`.
Команды пользователя выполнены: чтение отсутствующих файлов завершилось ошибкой,
checker — `MODULE_NOT_FOUND`. Поэтому названия A–F в этом отчёте временные:
соответствие неизвестному §7 не заявляется. Хаб не изменялся.

## B — Изменения

### On-chain / ABI

- SW001: `SessionCheckAndSpend.authority` — `Signer`, с сохранением PDA и stored
  authority/delegate constraints. Новые Anchor `try_accounts` тесты: unsigned owner,
  неверный PDA и неверная stored authority. Делегированный spending остаётся disabled.
- SW013: explicit system-owner constraint для oracle-signed snapshot subject;
  `trust.user` связан с user/authority; drum recipient ограничен `drum_commit.user`.
- SW016: SessionCreate использует `init`. Trust update запрещает rollback epoch.
  LP pool/position сохраняют `init_if_needed` для повторных депозитов; добавлены
  identity/rarity constraints, существующие counters только увеличиваются через
  checked_add. Rebirth остаётся fail-closed. Ни один guard не снят.
- SW008: reload именно SPL token accounts после refund CPI. **Order не reload**:
  это отменило бы его локальное `active=false`. Есть host regression stale-cache.
- SW024: checked_div уже был в исходном checkout; добавлены 10000 full-u64 случаев
  shares/solvency и крайние значения. SW027 events тоже уже присутствовали: теперь
  их удаление ловит source/mutation regression.
- Дополнительно: SESSION_SPACE исправлен с 130 до 146 байт; allocation привязан к
  `INIT_SPACE`. Drum EV regression сравнивает полный weighted numerator, без
  преждевременного округления каждой вероятности.
- Обновлён signer flag в committed session IDL. Drift gate подтверждает account
  metas/инструкции/аргументы/адреса шести IDL; это не полная Anchor-регенерация IDL.
- CI теперь запускает `cargo test --locked --workspace --lib`, включая market/session.
  Глобальный ignore SW013 удалён из sentio.toml.

### Read-only exporter / адреса

- Существующие 14 маршрутов сохранены; добавлены fail-closed coverage и качество по
  players/economy/craft/market/security с причинами. Mock, отсутствие истории,
  отсутствующие/ошибочные/stale cursors не дают `complete`/ready.
- Статический паспорт теперь unavailable; это устраняет ложную гарантию partial
  без доступного источника. Runtime domain quality не выше partial до закрытия
  ограничений. Никаких новых blockchain write-путей нет.
- Каталог явно фиксирует unavailable для отсутствующих требуемых farming-событий.
  `ReferralBound` больше не превращается в `WalletConnected`. PlayerJoined не
  объявляется доступным event stream только из-за наличия cohort-query.
- Economic events из failed transaction logs отбрасываются. Pagination использует
  slot+signature tie-break; пустые/отфильтрованные транзакции двигают source cursor.
- `watchtower/addresses.json`: шесть reference IDs + два null placeholders.
  Session ID в OS config больше не vanity placeholder; core/session не объявляются
  deployed без RPC. Индексатор по-прежнему подписан только на три реализации.
- Read-only RPC probe проверяет devnet genesis/executable loader; даже успешный
  ответ не сертифицирует bytecode/custody. Реальная попытка — unavailable, см.
  `aof-rpc.json`; URL/секреты провайдера в отчёт не пишутся.

### PostgreSQL

- Удалён `OR tenant_id='aof'`, обходивший tenant isolation. FORCE RLS + отдельные
  NOLOGIN/NOBYPASSRLS reader/writer роли; restrictive boundary; межтенантные записи
  запрещены. Одной подмены `app.tenant` недостаточно для доступа.
- Materialized view защищена отдельным role grant; base RLS к её чтению не применяется.
  Уникальный refresh-index теперь покрывает всю группировку, включая nullable Bolt ID.
- На настоящем PostgreSQL 18.4 проверены read isolation, missing/wrong/spoofed tenant,
  запрещённые insert/update, закрытый view и refresh с несколькими Bolt entities.
  В CI — отдельный PostgreSQL 16 service job. Это не production migration.

## C — Непринятые вызовы и риски

### Все 17 исходных findings

Полная таблица **каждого finding** с текущими файлом/строкой, причиной непринятия,
severity и экономическим последствием: [AOF_FINDINGS.md](AOF_FINDINGS.md).
Машиночитаемый эквивалент: [aof-audit.json](aof-audit.json).

Это `remediation-review-NOT-external-rescan`. Все исходные findings остаются
`open-pending-independent-validation`, suppression=false. **Formal accepted-risk
не оформлялся**: нет назначенного владельца и независимой подписи принятия.
Исходная severity не понижена для красивого счётчика. 0 critical/high не достигнуто
в смысле внешней приёмки, несмотря на внесённые исправления.

### Остальные непринятые критерии MAX

Severity ниже — release-risk assessment этого review, не вывод внешнего scanner.

| Критерий | Файл:строка / точка вызова | Причина непринятия | Severity | Экономическое последствие |
|---|---|---|---|---|
| Hub contract/checker | три отсутствующих пути из A (строки нет) | Нет файлов в клонированной ревизии | high | Нельзя подтвердить общий контракт budgets/control |
| c-01/c-02/c-12 deployment/custody | `scripts/verify-address-registry.cjs:9`, `watchtower/addresses.json:1` | RPC TLS/network failure; executable/bytecode/ProgramData не подтверждены | high | Нельзя привязывать реальные средства к непроверенному deployment |
| c-07 craft/forge/market/auction/lottery | `aof-core/src/state.rs:1259`, `programs/aof-liquidity/src/state/lp_pool.rs:87` | Есть helper/property coverage, но нет выполненных сквозных SVM conservation/no-double-draw тестов для всех путей | high | Риск лишней эмиссии, повторной награды, insolvency |
| c-09…c-11 custody/pause/migration | `docs/AOF_CUSTODY_AND_MIGRATION.md:1` | Runbook, не развёрнутый multisig/timelock; authority tx evidence отсутствует | high | Hot key или upgrade может обойти экономические caps |
| W1 14/14 live + accepted/duplicate | `watchtower/src/watchtower-exporter.ts:84` | Проверена регистрация/readonly contract; нет live DB/RPC/hub credentials/config и devnet signature | high | Потери/дубли ingestion нельзя считать исключёнными |
| W1 RLS rollout | `src/os/sql/cross_game_materials.sql:34` | Изоляция тестовой БД доказана, production роли/членства не проверены | high | Неправильные grants раскрывают inventory/допускают чужие записи |
| b-04…b-08 indexer/read-model | `aof_backend/services/chain-indexer/index.ts:45`, `watchtower/src/read-model.ts:19` | Три RPC-polled программы, не подтверждены LaserStream/Shyft/Timescale/Redis deployment и full-gap recovery | high | Неполные проекции и устаревшие балансы |
| b-09/b-10 ledger/rewards | `watchtower/src/data-quality.ts:15`, `aof-core/src/state.rs:1365` | Нет полного события↔double-entry↔баланса отчёта и Merkle/epoch/claim end-to-end доказательства | high | Невидимый дефицит, cap bypass либо двойная выплата |
| b-11 anti-fraud | `aof_backend/services/trust-worker/formula.js:1` | Нет размеченной выборки precision/recall и проверенного decision journal | high | Sybil/wash trading могут извлекать reward budget |
| b-12…b-14 API/proposal | `watchtower/src/watchtower-exporter.ts:63`, `src/os/handoff-v3.js:16` | Не реализован полный OpenAPI/ETag/rotation + signed proposal→RBAC/2FA→approval→apply→dual log→rollback e2e | high | Несанкционированные fees/cap изменения либо дубли apply |
| b-15/b-16/b-18 и W4 | `watchtower/src/metrics.ts:1`, `scripts/backup-db.sh:1` | OTel hooks/backup скрипт не заменяют load/SLO/restore drill; RPO/RTO не измерены; SBOM/CVE gate не завершён | high | Инцидент/потеря истории rewards может длиться неопределённо |
| f-01…f-12 | `game/godot/autoload/watchtower_os.gd:1`, `programs/aof-session-keys/src/lib.rs:241` | Не проверен полный Godot inventory/market/onboarding/a11y/ru-en UX; session spending disabled | high | UI не должен обещать подтверждённые средства и автоматический вывод |
| i-01/i-03/i-04/i-05/i-11 | `src/os/handoff-v3.js:16`, `src/os/sql/cross_game_materials.sql:1` | Config/view не являются реализованным cross-game transfer, общим identity или budget/proposal протоколом с e2e evidence | high | Двойной учёт актива и автономная эмиссия между играми |
| i-06/i-07/i-09/i-10/i-12 | `src/os/stack-v3.js:1` | Нет совместной приёмки календаря/rewards/analytics/alerts/KYT и bridge лимитов | high | Cross-game/bridge награды могут выйти за per-game budget |
| Секреты / supply chain | `.github/workflows/ci.yml:1370` | Локальный Gitleaks binary download недоступен; существующий CI full-history gate ещё не проверен для PR | high | Нельзя заявлять аудиторское «0 секретов» без scanner result |

## D — Проверки и границы доказательств

Выполнено локально:

- `python3 scripts/test-p0-security.py` — 4 теста, включая 6 negative source mutations
  SW001/SW008/SW013/SW016/SW024/SW027. **Это source tripwires, не SVM доказательства.**
- `python3 scripts/check-idl-drift.py` — 6 IDL, drift отсутствует.
- `node --test tests/readiness/*.test.cjs` — 5 тестов registry/RPC/fail-closed evidence.
- `npm test --prefix watchtower` — 6 suites: mapping/decoder/replay/readonly/fixtures/quality.
- `npm run typecheck --prefix watchtower` — успешно. Prisma Client сгенерирован с
  `--no-engine` и локальными path overrides только для типов; DB runtime этим не проверен.
- `npm test --prefix src/os` — 43/43.
- Backend `test:security-invariants` и `test:chain-indexer` — успешно (source/fixture self-tests).
- SQL migration + `tests/sql/cross-game-materials-isolation.sql` — настоящий PostgreSQL
  18.4; все assertions прошли. Локальные бинарники/данные тестовой БД вне Git.
- `git diff --check` — успешно.

Не выполнено / заблокировано:

- `cargo test --locked --workspace --lib`, SBF build, SVM/local-validator tests:
  cargo/rustc/Anchor/Solana отсутствуют; rustup TLS download недоступен. Тесты добавлены
  в CI, но это не заявление о зелёном прогоне.
- Полная Prisma runtime generation: binaries.prisma.sh недоступен. Только type generation.
- Sentio/SolGuard/SLAM rescan не выполнен. Не подменяется Python regex проверкой.
- `node scripts/verify-address-registry.cjs` — exit 1, RPC unavailable (ожидаемо fail-closed).
- Devnet → hub accepted=true, repeat duplicate=true, GET ingestion — не проверены.
- Полный Gitleaks scan — download release asset завершился network EOF; секретные
  значения не создавались, но formal zero-secrets claim пока отсутствует.

## E — Приёмка / rollout

1. Согласовать правильную ревизию отсутствующего hub contract и адрес read-only
   ingestion acceptance environment. Не передавать секреты через чат.
2. Дождаться зелёного Rust/SBF/SVM/secret CI; выполнить независимый rescan всех программ,
   включая aof-core (hub baseline сканировал только 52 файла). Назначить владельцев
   оставшимся risks, принять или исправить их формально.
3. Выполнить custody/migration runbook, получить RPC/bytecode/authority evidence.
4. Развернуть RLS с проверенными ролями, exporter read-only credentials; отдельно
   восстановить event projections после удаления ложного WalletConnected.
5. Получить реальную devnet signature и hub accepted/duplicate/ingestion receipts.
6. Отдельными проверяемыми этапами закрыть W2 ledger+rewards+proposal, W3 identity/
   provenance/per-game budgets, затем W4 SLO/DR/security release. ML и cross-chain
   не включать раньше стабилизации этих контуров.

## F — Итог / Definition of Done

- [x] Конкретные P0 source fixes и regression gates внесены; disabled paths сохранены.
- [x] RLS/view isolation доказана на локальной PostgreSQL; CI service job добавлен.
- [x] Адресный реестр и честная маркировка unavailable/reference/placeholder.
- [x] 14 routes зарегистрированы, readonly/quality/catalog tests проходят.
- [ ] Независимый 0 critical/high либо owner-signed accepted-risk.
- [ ] Все экономические инварианты и negative tests проверены в SVM.
- [ ] RPC/bytecode/custody, полная IDL regeneration, hub acceptance.
- [ ] Double-entry reconciliation, rewards no-double-claim e2e, i-01/i-03/i-04/i-05/i-11.
- [ ] Полный Godot UX, SLO/load/DR drills, external audit/SBOM/CVE.
- [ ] Проверенный CI secret scan / release approval.

PR должен оставаться **draft**, main не изменять. Этот набор исправлений сам по себе
не повышает игру до L3/L4 и не разрешает включать денежные операции.
