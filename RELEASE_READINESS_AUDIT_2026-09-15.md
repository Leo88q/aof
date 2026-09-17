# Release Readiness Audit — 2026-09-15

Ветка: `arena/01a0a358-aof` (продолжение `arena/01a09c71-aof`), PR #3 → `main`.
Область: aof-core + 5 программ, aof_backend, frontend, CI, БД/секреты, IDL.
Production / Cloudflare **не трогались**.

---

## 1. Фактическое состояние ветки после ручного merge

Проверено `git status --short`, `git branch -a -vv`, `git log --graph`, `git show-ref`, `git log -1 --stat`, `git diff --check`, `git ls-remote`, `gh pr view`.

| Проверка | Результат |
|---|---|
| Текущая ветка | Sandbox работает в **`arena/01a0a358-aof`**, созданной от `486b252` ветки `arena/01a09c71-aof` (сессия Arena привязана к этой ветке; я не переключался на `arena/01a09c71-aof` — это ограничение сессии, а не расхождение репозитория). |
| HEAD до моих изменений | `486b252 test(aof-core): deploy upgradeable and stop swallowing the bootstrap failure` — совпадает с ожидаемым. |
| Remote refs | `origin/arena/01a09c71-aof = 486b252`, `origin/arena/01a0a049-aof = 486b252`, `origin/main = ceb4c94` (merge PR #1, содержит только `18ea0f1` и ниже). **`main` не содержит 19 merged-коммитов** — они есть только в arena-ветках. PR #2 (`arena/01a0a049-aof → main`) открыт; PR #1 merged. |
| История 18ea0f1..486b252 | 19 коммитов: `84bbe03` fail-closed aof-market, `9d6b1a3` CI pipeline, серия `ci:` (toolchain/proc-macro2/key sync), `7b0c95e` aof-core в workspace, `df253f0/712f701/bf8a4f4/22fb2ba` SBPF stack-frame fixes, `486b252` upgradeable test setup. Merge был fast-forward: конфликтных маркеров нет (`git diff --check` чисто). |
| Незакоммиченные изменения | Нет (worktree чистый на старте и на финише). |
| Tracked `target/`, `node_modules/` | 0 файлов. |
| Случайно удалённые файлы | Не обнаружены. |
| Repo был shallow (grafted) | `git fetch --unshallow` выполнен для проверки истории. |

Повторный merge **не выполнялся**; destructive-команды не выполнялись.

## 2. Новые коммиты (поверх 486b252) и их назначение

| Commit | Назначение |
|---|---|
| `ec66ca4` test(aof-core) | Исправление `plantSeeds` (2 аргумента вместо 1) — устраняет `Account config not provided`; pack-тест переписан как проверка `FeatureDisabled` + отсутствие списания; regression для `reroll_random_commit`; `ensureAta` без `catch {}`; bootstrap-ошибки пробрасываются (`rethrowUnlessAlreadyInitialised`). |
| `99fea28` idl | `auction_bid.previous_bidder` → `writable: true` в `aof_core.json` и `aof_core.ts`; новый `scripts/check-idl-drift.py` (source ↔ IDL для 6 программ). |
| `4e33356` ci | `anchor-test` blocking (убран `continue-on-error`), missing IDL = fail, парсинг `N failing`; IDL drift gate blocking; backend: integration test, migration gate, hygiene gate. |
| `c90c9ad` backend | `scripts/idempotencyIntegrationTest.ts` (реальный Prisma + SQLite); правка misleading-сообщения в wallet-proof; расширенный `securityInvariantSelfTest` (IDL flag parity, послойная согласованность disabled-механик). |
| `0e63736` db | Untrack `aof.db`/`dev.db` (с локальным backup + sha256), baseline migration `0_init`, `migration_lock.toml`, `.env.example` ×2, `docs/DATABASE_MIGRATIONS.md`. |
| `6ecfe1a` frontend | `mechanics.ts`: 8 механик → `soon`; `FeatureDisabledNotice`; PacksPage/LotteryPage/ExplorationPage блокируют платный поток. |
| `f4b2609` backend/ci | `connection_limit=1` для SQLite в integration-тесте/.env.example/docs; вывод self-tests в publish-лог. |
| `d1…` ci | Backend log как artifact. |
| `97da5b2` fix(backend) | **Реальный баг, найденный новым integration-тестом на CI**: stale-reclaim CAS в `idempotency.ts` матчился только по `status`; 16 из 16 конкурентных retry захватывали одну stale-операцию. Добавлен `createdAt` в предикат `updateMany`. |
| `8c05471` ci/idl-gate | `--ids-from-git $GITHUB_SHA`: CI подменяет `declare_id!` на throwaway-ключи, ids сравниваются с закоммиченной ревизией. |
| `48aa7ce` tsconfig | `types: ["node"]` / `["vite/client"]` — битые `@types/*` в родительских `node_modules` на машине разработчика ломали `tsc` (TS2688); CI не затрагивало. |
| `e2964cd` aof-core | **Реальный on-chain баг, найденный первым запуском `anchor test` на машине владельца**: `PlantSeeds.seeds_mint` без `mut` при `token::burn` → «writable privilege escalated». Аудит burn-CPI нашёл то же в `StartMilling` (wheat, stone) и `StartBaking` (flour, water, wood, coal). Семь мнтов получили `mut` (address-constraint сохранён); IDL json/ts синхронизированы, drift 0. |
| `16aeba1` aof-core | Системный аудит всех `mint_to`/`burn` CPI (в т.ч. через tuple-биндинги): **ещё 17 read-only mint'ов** в `harvest_wheat`, `collect_flour/bread/well_water`, `start_exploration_commit` (4), `upgrade_exploration_tier` (3), `forge_attempt_commit` (2), `referral_upgrade` (3), `claim_season_reward`, `use_flask`. Все эти инструкции были неработоспособны on-chain. Добавлен только `mut`. IDL синхронизированы (drift 0). Новые тесты `start_milling` и `start_baking` (оба вида топлива) — точные списания, supply, state, guard'ы `MillInProgress`/`OvenInProgress`/`MillNotReady`/`OvenNotReady`. |
| `86221e2` scripts/ci | `scripts/check-mint-writable.py` — статический gate «Mint в mint_to/burn обязан быть `mut`» (50 полей проверяется, negative test → exit 1); подключён blocking-шагом в job `programs` перед IDL drift gate. |

## 3. Компоненты

| Компонент | Статус | Проблемы | Исправления | Приоритет |
|---|---|---|---|---|
| aof-core tests (`tests/aof_core.ts`) | 🟡 исправлено локально, ждёт CI | (1) `plantSeeds` вызывался с 1 аргументом → `Account config not provided` @210; (2) pack-тест ожидал mint от fail-closed инструкции; (3) `auction bid` падал `ConstraintMut` из-за IDL; `catch {}` в `ensureAta`, bootstrap только логировал. | Все четыре исправлены; account map harvest_wheat/rental_* сверен со source и IDL — `config` присутствовал; проблема была в аргументах. | P0 |
| IDL (6 программ) | 🟢 | `auction_bid.previous_bidder` без `writable` в обеих backend-копиях; drift-проверка в CI сравнивала только имена/типы аргументов и только при наличии `target/idl` (который никогда не генерируется). | IDL исправлен; `check-idl-drift.py`: имена инструкций, число аргументов, порядок аккаунтов, writable/signer/optional, declare_id == IDL == Anchor.toml, json ↔ ts. Результат: **0 drift / 6 программ / 113 инструкций**. | P0 |
| CI (`ci.yml`) | 🟡 | `anchor-test` job целиком `continue-on-error`; отсутствие IDL → skip = success; drift report advisory. | Убрано; остались только 2 advisory-шага IDL-builder'а (upstream-blocked, документировано). | P0 |
| Backend build | 🟢 CI | Локально `prisma generate` невозможен (binaries.prisma.sh недоступен из sandbox); `tsc` без клиента даёт 25×TS7006. | На CI `prisma generate` + `tsc` **success** (run 34932815104). | — |
| Backend idempotency | 🟢 после фикса | Stale-reclaim не был CAS (см. `97da5b2`). | Исправлено; покрыто `test:idempotency-db` (32 конкурентных claim, replay, failed/stale reclaim ровно 1 раз). | P0 |
| Backend self-tests | 🟢 | wallet-proof печатал устаревшее «prisma generate is unavailable». | Сообщение заменено; добавлены проверки IDL-parity и послойной согласованности disabled-механик. | P1 |
| Frontend | 🟢 | 8 fail-closed механик были `status:'live'`; PacksPage/LotteryPage/ExplorationPage запускали платный поток, оканчивающийся 503. | `soon` + notice + disabled кнопки; `tsc` 0 ошибок, `vite build` OK, stylelint OK. | P1 |
| БД / секреты | 🟡 | `aof.db` (10 MB, 76 976 PriceTick, 285 AuditLog c IP/UA, 58 WalletOperation) и `dev.db` tracked; нет `prisma/migrations`; нет `.env.example`. | Untracked (не удалены, backup `~/aof-db-backup-2026-09-15/` sha256 `703d53…`/`5d4557…`), baseline migration (49 таблиц/63 индекса, применяется на пустую БД), `.env.example`, docs. **История Git всё ещё содержит данные** — нужен owner decision о purge. | P0/P1 |
| Rollback | 🟢 docs | Отсутствовал. | `docs/DATABASE_MIGRATIONS.md` §4 (DB/backend/programs/frontend). | P1 |
| aof-market / quests / rebirth / liquidity / session-keys | 🟢 IDL | — | Drift 0; fail-closed guards на месте. | — |
| Механики (26) | 🟡 | См. §10: 9 disabled on-chain, но frontend-контент объявлял их live. | Согласовано в 4 слоях, проверяется self-test'ом. | P1 |
| Mining (`MINING_ENABLED`) | 🟡 | Флаг fail-closed в backend и frontend; не включался. | Без изменений. | — |

## 4. Команды и exit-коды

Все pipeline-команды выполнялись с `set -o pipefail` / `${PIPESTATUS[0]}`.

| Команда | Exit code | Результат | Ограничения |
|---|---|---|---|
| `git status --short` | 0 | чисто | — |
| `git diff --check` | 0 | конфликтов/whitespace нет | — |
| `anchor build` | **не выполнялась** | — | В sandbox нет Rust/Solana/Anchor; `sh.rustup.rs`, `static.rust-lang.org`, `release.anza.xyz`, `crates.io`, `objects.githubusercontent.com` — TLS-соединение обрывается (curl 35). Доступны только `registry.npmjs.org` и `api.github.com`. Подтверждается только CI. |
| `cargo check` / `cargo test` | **не выполнялась** | — | То же. В CI `cargo test` для программ также не запускается (только `anchor build --no-idl`). |
| `anchor test` | **не выполнялась локально** | — | То же. CI run 34928507107 (486b252): 7 passing / 3 failing. CI на моих коммитах: см. §11. |
| `python3 scripts/check-idl-drift.py` | 0 | 6 программ, 0 drift | — |
| `python3 scripts/check-idl-drift.py` (без IDL-фикса, negative test) | 1 | ловит `auction_bid.previous_bidder` | — |
| `npx tsc --noEmit … tests/aof_core.ts` | 0 | тест-файл типизируется | — |
| backend `npm ci` | 0 | — | — |
| backend `npm run prisma:generate` | 1 (локально) / 0 (CI) | `binaries.prisma.sh` недоступен | sandbox network |
| backend `npm run build` | 1 (локально) / 0 (CI) | локально из-за prisma generate | sandbox network |
| backend `npx tsc -p . --noEmit` (без сгенерированного клиента) | 2 | 25 × TS7006 в местах, зависящих от типов Prisma | артефакт отсутствия клиента; на CI `tsc` после generate — 0 ошибок |
| `npm run test:wallet-proof` | 0 | passed | in-memory модель |
| `npm run test:resource-registry` | 0 | 27 ключей | — |
| `npm run test:security-invariants` | 0 | passed (+ negative test: откат `packs→live` даёт AssertionError) | — |
| `npm run test:idempotency-db` | 1 (локально: engines недоступны) / **1 → 0 на CI** | Первый CI-run поймал реальный CAS-баг; после `97da5b2` — success (run 34932815104) | — |
| frontend `npm ci` | 0 | — | — |
| frontend `npm run build` | 0 | vite build OK (chunk >500 kB warning) | — |
| frontend `npx tsc --noEmit` | 0 | — | — |
| `npm run test:aof-stylelint`, `npm run lint:aof-colors` | 0 / 0 | — | — |
| `local validator` / `devnet smoke` | **не выполнялись** | — | нет toolchain, `api.devnet.solana.com` недоступен, credentials не настроены |
| Cloudflare / production | не выполнялись | — | по требованию |

Предупреждения `unexpected cfg condition value: anchor-debug` — присутствуют в CI-логе Anchor build (39 упоминаний в опубликованном хвосте, `aof-session-keys` 14 warnings), это warnings anchor-lang 0.30.1 под rustc 1.89; **они не маскируют ошибки**: `anchor build --no-idl exit code: 0` печатается отдельно.

## 5. Изменённые файлы (486b252..HEAD)

```
.github/workflows/ci.yml                          | +blocking anchor-test, IDL gate, backend gates, artifact
.gitignore, aof_backend/.gitignore                | !.env.example, .migrate-shadow.db
aof_backend/.env.example, frontend/.env.example   | new
aof_backend/package.json                          | test:idempotency-db, prisma:migrate:check/deploy
aof_backend/prisma/aof.db, dev.db                 | untracked (не удалены с диска)
aof_backend/prisma/migrations/0_init/migration.sql, migration_lock.toml | new
aof_backend/scripts/idempotencyIntegrationTest.ts | new
aof_backend/scripts/securityInvariantSelfTest.ts  | +IDL parity, +layer parity
aof_backend/scripts/walletProofSelfTest.ts        | сообщение
aof_backend/src/idl/aof_core.json, aof_core.ts    | previous_bidder writable
aof_backend/src/security/idempotency.ts           | CAS по createdAt
docs/DATABASE_MIGRATIONS.md                       | new
frontend/src/components/ui/FeatureDisabledNotice.tsx | new
frontend/src/pages/{tools/PacksPage,market/LotteryPage,farm/ExplorationPage}.tsx
frontend/src/site/content/mechanics.ts            | 8× live→soon
scripts/check-idl-drift.py                        | new
tests/aof_core.ts                                 | см. §2
RELEASE_READINESS_AUDIT_2026-09-15.md             | этот файл
```

## 6. Оставшиеся риски

1. **`anchor test` подтверждён только локально, не в CI.** На машине владельца (macOS, локальный валидатор) на `16aeba1`: **13 passing / 0 failing, exit 0** (история: `48aa7ce` — 10/1, `f7dd144` — 11/11). GitHub Actions остаётся заблокирован биллингом («recent account payments have failed…», run 35166693775), поэтому нет независимого прогона на чистом раннере с Node 20 / зафиксированными версиями toolchain.
1b. **24 инструкции aof-core получили изменение account-flags (read-only → writable mint).** Это breaking change для любого клиента со старым IDL: backend/frontend в репо обновлены, но задеплоенная программа на devnet/mainnet (если есть) и любые внешние интеграции требуют скоординированного апгрейда программы + клиентов. Интеграционными тестами покрыты `plant_seeds`, `harvest_wheat` (частично), `start_milling`, `start_baking`; `collect_*`, exploration, forge, referral, season, use_flask — только статический gate.
2. **Operational data в истории Git** (`aof.db` с адресами кошельков/IP). Untrack не удаляет из истории; purge = history rewrite + force-push, что запрещено этой сессии.
3. **IDL генерация upstream-blocked**: anchor-lang 0.30.1 + proc-macro2 ≥1.0.95. Все клиенты живут на закоммиченных IDL; drift-gate парсит Rust регулярками — покрывает имена/порядок/флаги/число аргументов, но **не типы аргументов** и не изменения `#[account] struct` (layouts).
4. **Ключи программ отсутствуют в репозитории** → CI деплоит на throwaway-адреса. Тесты валидны для логики, но не для «те же байты по каноническому адресу».
5. **Отсутствуют `cargo test` для программ** и unit-тесты для 5 не-core программ в CI.
6. **SQLite single-writer**: API + 5 workers делят один файл; `connection_limit=1` задокументирован, но не enforced в коде.
7. **`session_create` fail-closed** → механика «Доверие» (session keys) недоступна; SKR privileged token: `SKR_MIN_BALANCE`/скидка объявлены в constants.rs, но канонический SKR mint не хранится в Config/MaterialMints (craft.rs:27) — скидка отключена, SKR **не входит** в 27 core mints (27 = 23 MaterialMints + food/wood/stone/potato).
8. **Отсутствуют** frontend unit/e2e тесты; disabled-состояние проверяется только статически self-test'ом.
9. Backend `tsc` при отсутствии Prisma-клиента даёт 25 implicit-any ошибок — типизация роутов зависит от сгенерированных типов; не блокер, но хрупко.
10. `AUDIT_REPORT_2026-09-05.md` упоминает закоммиченный приватный ключ authority (Проблема 6) — в текущем дереве tracked ключей нет (`git ls-files` по маскам keypair/pem/env пуст, gate добавлен), но история не проверялась на секреты инструментом типа gitleaks.

## 7. Staging checklist

- [x] Локально (владелец): `anchor test` на `16aeba1` — **13 passing, 0 failing, exit 0** (вкл. новые milling/baking тесты).
- [x] Локально (владелец): backend `prisma:migrate:check` + 4 теста exit 0; frontend `npm run build` exit 0.
- [ ] Восстановить биллинг GitHub Actions; CI на HEAD должен показать 4 зелёных job'а (независимое подтверждение на чистом раннере).
- [ ] Скачать artifact `anchor-target` и заархивировать `.so` текущего релиза (для rollback).
- [ ] Devnet: `anchor test --skip-build --provider.cluster devnet` с реальными keypair'ами (вне CI), либо `solana program deploy` на devnet + прогон `tests/aof_core.ts` с `ANCHOR_PROVIDER_URL`.
- [ ] Devnet smoke по 17 live-механикам (список §10) — минимум по одной транзакции.
- [ ] Backend против staging DB по `docs/DATABASE_MIGRATIONS.md` §3 (migrate resolve → deploy → build → 4 теста → smoke: /health, wallet-proof + повтор idempotency-key, /admin без токена → 401, `/forge/commit` → 503, `/packs/expire` без admin-токена → 401).
- [ ] Frontend build с production `VITE_RPC_URL`, ручная проверка Packs/Lottery/Exploration показывают notice и не открывают кошелёк.
- [ ] `python3 scripts/check-idl-drift.py` = 0 на релизном коммите.
- [ ] Решение владельца по purge `aof.db` из истории.

## 8. Rollback plan

Полный текст — `docs/DATABASE_MIGRATIONS.md` §4. Кратко:
- **Программы**: upgradeable; `solana program deploy --program-id <id> <prev>.so`; kill-switch `set_paused(true)` в aof_core и aof_market.
- **Backend**: redeploy предыдущего тега; `dist/` + `node_modules/.prisma` предыдущей версии сохраняются.
- **БД**: остановить API + workers → `.backup` текущего файла как evidence → восстановить pre-migration snapshot (sha256) → `prisma migrate resolve --rolled-back` при необходимости → smoke.
- **Frontend**: перепубликация предыдущего статического артефакта (вне этой сессии).

## 9. Env-переменные (без значений)

Backend (`aof_backend/.env.example`): `NODE_ENV`, `PORT`, `LOG_LEVEL`, `EXPOSE_ERROR_STACK`, `CORS_ORIGIN`, `RPC_URL`, `PROGRAM_ID`, `AUTHORITY_SECRET_KEY` (secret), `TREASURY_PUBKEY`, `MINING_ENABLED`, `DATABASE_URL` (`?connection_limit=1`), `ADMIN_TOKEN` (secret), `WALLET_PROOF_DOMAIN`, `SESSION_KEYSTORE_DIR`, `WS_PORT`, `BACKEND_URL`, `CRANK_INTERVAL_MS`, `FARM_TRADER_SIMULATION`.
Frontend (`frontend/.env.example`): `VITE_API_URL`, `VITE_DEV_BACKEND_URL`, `VITE_RPC_URL` (обязателен в prod build), `VITE_MARKET_WS_PATH`, `VITE_MARKET_WS_URL`, `VITE_WALLET_PROOF_DOMAIN`, `VITE_MINING_ENABLED`.
Обязательные в production (`src/config.ts`): `RPC_URL` (не devnet), `PROGRAM_ID`, `AUTHORITY_SECRET_KEY`, `TREASURY_PUBKEY`, `ADMIN_TOKEN`.

## 10. Механики и ресурсы — статус по слоям

Ресурсы: 28 в `resources.ts` (22 live / 6 soon: 5 flask + skr); 27 core mints в backend registry = 23 MaterialMints + food/wood/stone/potato (`ResourceKind` 27 вариантов); SKR — отдельный privileged token без канонического mint on-chain.

| Механика | On-chain | Backend | Site (`mechanics.ts`) | App | Итог |
|---|---|---|---|---|---|
| energy, tools, marketplace, orderbook, auction, liquidity, seasons, social/referral, quests (claim), weather, gas, npc (read), rental, farm, craft, milling, mine | live | live | live | live | **Заявлены live — требуют devnet/in-game проверки** |
| packs | escrow на PDA + `pack_open_expire` (refund после 600 слотов) | commit/reveal live, `/expire` admin-only | live | — | live (после anchor test на машине владельца) |
| forge | `FeatureDisabled` | 503 | soon ✔ | notice list | fail-closed |
| lottery (tickets) | `FeatureDisabled` | 503 | soon ✔ | notice + disabled ✔ | fail-closed |
| drum | `FeatureDisabled` (quests) | 503 | soon ✔ | notice list | fail-closed |
| exploration | `FeatureDisabled` | 503 | soon ✔ | notice + disabled ✔ | fail-closed |
| reroll (random) | `FeatureDisabled` | 503 | нет отдельной записи | notice list | fail-closed |
| hot_market | `TradingDisabled` (market) | 503 | soon ✔ | notice list | fail-closed |
| collectors | `CollectorNotConfigured` | 503 | soon ✔ | notice list | fail-closed |
| rebirth | `FeatureDisabled` | 503 | soon (было) | notice list | fail-closed |
| trust / session keys | `AtomicBindingRequired` | 503 | soon ✔ | notice list | fail-closed |
| mining flag | — | `MINING_ENABLED` false in prod | — | `VITE_MINING_ENABLED` | fail-closed flag |

Согласованность 4 слоёв проверяется `test:security-invariants` (negative test подтверждён).

**Требует проверки в игре (devnet/staging)**: все 17 live-механик выше, особенно: auction bid → refund предыдущего bidder'а (исправленный IDL), rental operator → harvest_wheat, orderbook match, mint_resource комиссия, withdraw_gas cooldown, stake/unstake lock, marketplace buy/cancel, liquidity deposit/withdraw, season pass/claim (admin-only routes), quests claim, referral bind, weather crank, craft без SKR-скидки, milling/baking цепочка.

## 11. Разделение подтверждений

**Подтверждено локально (sandbox):**
- git-состояние ветки; `git diff --check`; отсутствие tracked artifacts/секретов/БД после изменений.
- `check-idl-drift.py`: 0 drift для 6 программ (+ negative test).
- Backend self-tests: wallet-proof, resource-registry, security-invariants — exit 0 (+ negative test).
- Frontend: `tsc` 0, `vite build` 0, stylelint 0, colors lint 0.
- Тест-файл `tests/aof_core.ts` компилируется; аргументы всех 40 вызовов сверены с IDL; account maps сверены с IDL (авто-PDA учтены).
- Baseline migration применяется на пустую SQLite; соответствие 49 моделей ↔ 49 таблиц.

**Подтверждено на машине владельца (macOS, Node 26, Anchor/Agave установлены; коммит `48aa7ce`):**
- `anchor build` + `cargo test` для 6 программ — успешно (только `unexpected cfg` / `ambiguous_glob_reexports` warnings).
- `anchor test` (local validator): `48aa7ce` — 10/1 (`plant_seeds`, read-only mint) → `f7dd144` — 11/11 → **`16aeba1` — 13 passing / 0 failing, exit 0** (1m), включая новые `start_milling`/`start_baking`.
- Frontend `npm run build` на `48aa7ce`: exit 0 (предупреждение Vite о chunk > 500 kB — не ошибка).
- Backend: `prisma:migrate:check` «No difference detected», 4 self/integration-теста exit 0 (в т.ч. Prisma CAS). `npm run build` падал с TS2688 из-за окружения (исправлено `48aa7ce`).

**Подтверждено CI (GitHub Actions, ветка arena/01a0a358-aof):**
- run 34933357564 (`8c05471`, PR #3): Anchor build (SBPF всех 6 программ + IDL drift gate 0) — **success**; Backend (prisma generate, tsc, 4 теста, migration gate, hygiene gate) — **success**; Frontend — **success**; Anchor test — **не запущен (billing)**.
- run 34932815104 (`97da5b2`): Backend build + prisma generate + tsc + 4 теста (включая integration idempotency после фикса) — **success**; Frontend — **success**; Anchor build (`anchor build --no-idl`, все 6 программ, SBPF без stack-frame ошибок, без borrow-checker ошибок) — компиляция exit 0, job **failure** на IDL-gate из-за подмены ids (исправлено `8c05471`).
- run 34928507107 (`486b252`, база): Anchor build success; Anchor test 7 passing / 3 failing (harvest wheat, auction bid, pack) — все три адресованы.

**Требует devnet/staging:**
- `anchor test` в CI (чистый раннер, Node 20): Actions заблокирован биллингом.
- On-chain работоспособность `collect_flour/bread/well_water`, exploration, forge, `referral_upgrade`, `claim_season_reward`, `use_flask` после `16aeba1` (покрыты только статическим gate, не интеграционными тестами).
- Все 17 live-механик in-game; refund в auction_bid; staging-миграция по §3 docs; rollback drill.

**Не найдено / заблокировано:**
- Локальный `anchor build`/`cargo check`/`cargo test`/`anchor test`/local validator/devnet smoke — нет toolchain, внешняя сеть кроме npm/GitHub API недоступна.
- Локальный `prisma generate` — `binaries.prisma.sh` недоступен.
- Программные keypair'ы — отсутствуют в репозитории (by design), CI использует throwaway.
- Инструментальная проверка истории Git на секреты (gitleaks) — не выполнялась.

---

## Verdict

Условие «все Anchor-тесты зелёные» выполнено локально (13/13 на `16aeba1`), но не подтверждено в CI (Actions заблокирован биллингом). Остальные условия не выполнены: staging/devnet smoke не проводились; программы после фиксов `e2964cd`+`16aeba1` (24 mint-аккаунта стали writable — breaking change для старых клиентов) не задеплоены ни на один кластер, и 9 затронутых инструкций покрыты только статическим gate; operational data остаётся в истории Git до решения владельца; `cargo test` для программ отсутствует в pipeline.

**Готово к продакшн-деплою: НЕТ**
