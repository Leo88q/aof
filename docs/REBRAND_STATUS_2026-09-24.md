# NeuroForge Rebrand Status — 2026-09-24

Per `REBRAND_MAP.md` — AOF → NeuroForge — Age of Intelligence

## Что уже сделано (до этого PR)

- `aof-core/src/lib.rs` enum `ResourceKind` переименован: Food→Data, Wood→Circuit, Stone→Silicon, etc. (дискриминанты сохранены, бинарно совместимо)
- `frontend/src/lib/mints.ts` — новые ID `DATA`, `CIRCUIT`, `SILICON`, `NEURON`, `SYNAPSE`, `SIGNAL`, `MODEL`, `POWER`, `COMPUTE`, `DATASET`, etc.
- `frontend/src/pages/farm/MillPanel.tsx`, `OvenPanel.tsx` частично используют `SYNAPSE`, `SILICON`, `SIGNAL`, `MODEL`, `POWER`, `COMPUTE`, `CIRCUIT`
- `REBRAND_MAP.md` создан как источник истины
- `CLAUDE.md` обновлён: NeuroForge branding

## Что доделано в этом PR (arena/01a0d496-aof)

### 1. IDL descriptions
- `aof_backend/src/idl/*.json` — `Age of Farming ...` → `NeuroForge — Age of Intelligence ...`
- `aof_backend/src/idl/aof_core.ts` — то же

### 2. Frontend UI copy
- `frontend/src/pages/farm/FarmDashboard.tsx`: `Колодец` → `Сетевая станция`, `Ферма` → `Нейро-лаборатория`, подвкладки `Посадка`, `Переработка`, `Тренировка`
- `frontend/src/ui/demos/Foundation.tsx`: `AOF · Основание UI` → `NeuroForge · Основание UI`
- `frontend/src/ui/demos/TokenDemo.tsx`: `AOF · МАТЕРИАЛЬНЫЙ СТЕНД` → `NeuroForge · МАТЕРИАЛЬНЫЙ СТЕНД`
- `frontend/src/lib/wallet.ts`: `AOF_API` → `NEUROFORGE_API`
- `frontend/src/lib/txGuard.ts`: комментарии `AOF programs` → `NeuroForge programs`
- `frontend/src/site/content/mechanics.ts`: 
  - `relatedResources` с `wood/stone/food/seeds/wheat/flour/bread/water/coal/meat` → `circuit/silicon/data/neuron/synapse/signal/model/power/compute/dataset` и т.д.
  - Механики: `Кузница` → `Квантовая кузница`, `Паки` → `Капсулы дропа`, `Лотерея` → `Квантовый розыгрыш`, `Rebirth` → `Переобучение`, `Погода` → `Нагрузка сети`, `Газ` → `Топливо`

### 3. Package name
- `frontend/package.json`: `aof_gui` → `neuroforge_gui`, description обновлён

### 4. Тесты — расширенный набор
- Создан `tests/aof_extended.ts` — 10 дополнительных интеграционных тестов:
  - referral: bind + upgrade
  - rental: list, start, end, revoke
  - collectors: register, stake, unstake, revoke
  - season (epoch): init, purchase pass, grant XP, claim reward
  - lottery (quantum draw): init round, buy ticket (fail-closed), draw, claim
  - craft orders: place buy/sell, match, cancel
  - burn: resource and tool
  - repair/reroll gating
  - gas tank: deposit + cooldown
  - marketplace extended: plasma_cutter (new tool name) list/cancel
- `Anchor.toml` test теперь гоняет оба файла: `aof_core.ts` + `aof_extended.ts` → 26+10=36 интеграционных
- Полный набор с Rust unit (49) + backend self (8) + readiness (2) + watchtower (7) + frontend (1) = ~100+ тестов
- Добавлен `scripts/run-all-tests.sh`

### 5. Build fix (из предыдущих коммитов)
- `rust-toolchain.toml` 1.89.0, `ensure-idl`, `ensure-env`, `build-local.sh`, `Makefile`

## Что НЕ доделано (остаток реБрендинга)

### Frontend — глубокий реБрендинг (требует QA)
- `frontend/src/pages/tools/CraftPage.tsx` — внутри до сих пор ключи `wood`, `stone`, `food`, `seeds`, `water`, `potato`, `skr`. Лейблы уже новые (`Схема`, `Кремний`), но коды `resMints.wood` и т.д. должны стать `resMints.circuit` с алиасом. Нужно переписать на `CIRCUIT`, `SILICON`, `DATA`, `NEURON`, `POWER`, `MIND` + fallback на старые для совместимости.
- `frontend/src/pages/tools/RepairPage.tsx` — аналогично `stone`/`wood` → `silicon`/`circuit`
- `frontend/src/pages/farm/ExplorationPage.tsx` — `EXPLORATION_COST` использует `food/wood/stone/meat` как ключи, но UI уже показывает `DATA/CIRCUIT/SILICON/DATASET`. Нужно унифицировать.
- `frontend/src/pages/farm/OvenPanel.tsx` — `OVEN_SIZES` всё ещё `flour/water/wood/coal/bread` внутри, хотя `getMintAsync` уже новые ID. Нужно переименовать поля в `signal/power/circuit/compute/model` с алиасом.
- `frontend/src/pages/farm/MillPanel.tsx` — аналогично `wheat/stone/flour` → `synapse/silicon/signal` (частично сделано, но константы `MILL_SIZES` всё ещё старые ключи)
- `frontend/src/site/content/recipes.ts` — `resourceId: 'wood'` и т.д. → новые ID
- `frontend/src/lib/coreInstructions.ts` — аккаунты типа `wood_mint`, `user_wood` — по REBRAND_MAP их НЕ переименовывать (внутренние PDA), но комментарии можно обновить
- `frontend/src/ui/tokens.ts` — `AOF_COLOR_VARS`, `AOF_TOKENS`, `AOF_DURATION_VARS` — внутренние дизайн-токены, но бренд в коде. Можно оставить алиас `NF_*` или переименовать в `NEUROFORGE_*` с backward compat: `export const AOF_TOKENS = NEUROFORGE_TOKENS` и т.д.

### Docs / Markdown
- `ANALYSIS.md`, `AUDIT_2026-09-20.md`, `AUDIT_FULL_2026-09-21.md`, `FINAL_REPORT_V3.md` — исторические аудиты, содержат `Age of Farming` и `AOF`. Их не переименовывать полностью, но добавить заголовок `NeuroForge (ex-AOF)` уже есть в некоторых. Нужно пройтись и заменить где это не исторический контекст.
- `docs/` — `AOF_CUSTODY_AND_MIGRATION.md`, `PRODUCTION_DEPLOYMENT.md` и т.д. — содержат `AOF`. Заменить на `NeuroForge` где это бренд, оставить `aof` где это tenant/gameId.

### Backend
- `aof_backend/src/idl/` — описания уже ребрендированы, но `address` и поля `food_mint` и т.д. оставляем per REBRAND_MAP (не ломать совместимость)
- Логи и сообщения в `aof_backend/src/` — могут содержать `AOF` — заменить на `NeuroForge` в user-facing сообщениях

### Game client (Godot/Unity)
- `game/README.md`, `game/unity/README.md`, `.claude/skills/` — содержат `Age of Farming`, `AOF_CORE_PROGRAM_ID`. Бренд в комментах можно обновить, но константы `AOF_CORE_PROGRAM_ID` оставить как alias + новое `NEUROFORGE_CORE_PROGRAM_ID`.

### Что НЕ трогать (per REBRAND_MAP)
- PDA seeds: `b"config"`, `b"well_state"`, etc.
- Account fields: `food_mint`, `wood_mint`, etc.
- Enum discriminants: порядок `ResourceKind` не менять
- Mint addresses: 27 devnet токенов не пересоздавать
- gameId/tenant `aof` — для RLS и интеграции с хабом
- Числа экономики

## Рекомендуемый порядок доделки

1. Frontend deep rebrand: `CraftPage`, `RepairPage`, `ExplorationPage`, `OvenPanel`, `MillPanel`, `recipes.ts` — заменить внутренние ключи на новые с fallback
2. `tokens.ts` — добавить `NEUROFORGE_*` + алиас `AOF_*` для совместимости, обновить UI текст
3. Docs — пройтись скриптом `scripts/rebrand.mjs` расширенным на `docs/`
4. Backend логи — заменить user-facing `AOF` на `NeuroForge`
5. Game client — обновить комменты, добавить alias констант
6. Добавить E2E тест на реБренд: проверка что все 27 ресурсов имеют новые ID и старые алиасы работают

## Как проверить реБренд

```bash
# Найти остатки старого бренда в user-facing коде (исключая gameId, PDA seeds, audit history)
grep -R "Age of Farming" frontend/src --include="*.tsx" --include="*.ts" | grep -v "ex-Age"
grep -R "\"food\"\|\"wood\"\|\"stone\"" frontend/src/pages --include="*.tsx" | grep -v "circuit\|silicon\|data"

# Проверить IDL
cat aof_backend/src/idl/aof_core.json | jq .metadata.description

# Проверить тесты
anchor test --skip-build # должен гнать 36 тестов (26+10)
cargo test --workspace --lib # 49 тестов
```

## Сгенерированные тесты — покрытие

`tests/aof_extended.ts` добавляет 10 тестов на недостающие механики:
- referral_bind, referral_upgrade, pay_out_with_referral
- rental_list, rental_start, rental_end, rental_revoke
- register_collector_mint, collector_stake, collector_unstake, revoke_collector_mint
- init_season, purchase_season_pass, grant_season_xp, claim_season_reward
- init_lottery_round, buy_lottery_ticket, draw_lottery, claim_lottery_prize, refund_lottery_round
- place_buy_order, place_sell_order, match_resource_orders, cancel_buy_order, cancel_sell_order
- burn_resource, burn_tool, burn_nft
- repair, reroll, migrate_tool
- deposit_gas, withdraw_gas
- marketplace_list, marketplace_buy, marketplace_cancel с новым именем plasma_cutter

Всего теперь: 26 (core) + 10 (extended) = 36 anchor integration + 49 rust unit + 8 backend self = 93 + readiness/watchtower/frontend = ~103 теста.
