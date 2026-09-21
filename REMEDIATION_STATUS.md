# AOF — статус устранения замечаний аудита 2026-09-21

Исходный аудит: [`AUDIT_FULL_2026-09-21.md`](./AUDIT_FULL_2026-09-21.md) (36 находок:
C2 / H11 / M16 / L5 / I2, вердикт «не готово к mainnet»).

Документ ведётся по ходу работ. **Ни одна правка не проверена компилятором** —
в песочнице нет Rust-тулчейна (`cargo`/`anchor`/`solana` отсутствуют, установка
заблокирована сетью). Что удалось проверить в песочнице — помечено
`[проверено в песочнице]`; что требует локального запуска — `[нужен локальный запуск]`.

Легенда статуса:
- ✅ **сделано в коде** — правка написана, нужна компиляция/тесты локально;
- ⚠️ **сделано частично** — закрыт главный вектор, остаток описан;
- ❌ **не сделано** — требует решения/артефактов вне кода;
- ➖ **не требуется** — перепроверено и снято.

---

## Критические

### F-01 — неограниченный вывод из vault (`pay_out`, `pay_out_with_referral`) ✅
`aof-core/src/lib.rs` — контексты `PayOut` / `PayOutWithReferral`;
`aof-core/src/instructions/pay_out.rs`.

Три независимых тормоза, все fail-closed:
1. `material_mints` + `Config::is_resource_mint()` — вывести можно только
   зарегистрированный ресурсный минт;
2. `player` — получатель обязан быть **уже существующим** `Player` PDA,
   привязанным к владельцу `user_token`;
3. `vault_guard` (`VaultGuard`, seeds `["vault_guard", mint]`) — бюджет на минт:
   `max_per_tx`, `cap_per_epoch`, `epoch_slots`. `cap_per_epoch == 0` = вывод
   этого минта полностью остановлен. Гвард списывается **до** CPI, каждое
   списание эмитит `VaultWithdrawal`.

Новые инструкции: `init_vault_guard`, `set_vault_guard`.
Бэкенд: `aof_backend/src/routes/tools.ts` (`/pay-out`) и
`aof_backend/src/routes/referral.ts` (`/pay-out`) передают `materialMints`,
`player`, `vaultGuard`; новый административный роут
`aof_backend/src/routes/admin-config.ts` (`POST /admin/config/vault-guard`).

`[нужен локальный запуск]` — `anchor test`: проверить, что `pay_out` без
инициализированного гварда падает, а с гвардом режется по `max_per_tx`.
Юнит-тесты логики гварда: `aof-core/src/state.rs::state_tests::vault_guard_*`.

### F-02 — нет смены authority ни в одной из 6 программ ✅
Двухшаговая ротация `set_pending_authority` → `accept_authority`
(+ `cancel_pending_authority`) добавлена в **пяти** программах:
`aof-core` (`instructions/authority.rs`), `aof-market`
(`lib.rs`), `aof-quests`, `aof-rebirth`, `aof-liquidity`
(`instructions/authority.rs`). Конфиги получили `pending_authority` и
`authority_updated_at`, события `AuthorityRotationProposed`/`AuthorityChanged`.

`aof-session-keys` остался без ротации: у него нет `Config` (stateless-программа,
авторити используется только при `init_config`, который захватывает upgrade
authority). Ротация там = редеплой.

❗ **Следствие для деплоя (важно):** Squads/multisig теперь может быть authority —
но он должен уметь подписать `accept_authority` как `new_authority`. Проверьте это
на Squads-кошельке **до** перевода.

---

## Высокие

| ID | Что | Статус | Где |
|----|-----|--------|-----|
| F-03 | Кап эмиссии только на 2 из 9 путей | ✅ | `MaterialMints.max_supply[27]` + `state::check_supply_cap()`; подключено в `execute_mint`, `collect_mining`, `collect_flour`, `collect_bread`, `collect_well_water`, `craft_recipe`, `claim_season_reward`; новая инструкция `set_supply_cap` |
| F-04 | `craft_recipe` — минт-аккаунты без `mut` | ✅ | `lib.rs::CraftRecipe` — `mut` на `input_1_mint`, `input_2_mint`, `output_mint` |
| F-05 | Гейт `check-mint-writable.py` слеп к CPI в макросах | ✅ | `scripts/check-mint-writable.py` разбирает `macro_rules!` и site вызова; проверено негативным тестом |
| F-06 | LEGACY-randomness жива в 5 reveal-инструкциях | ✅ | `pack_open_reveal`, `reroll_random_reveal`, `explore_reveal`, `forge_attempt_reveal`, `draw_lottery`/`commit_lottery_draw` закрыты `RandomnessDisabled` с обоснованием в коде |
| F-07 | API-ключи на `Math.random()`, без хэша и скоупа | ✅ | `middleware/apiKey.ts`: `randomBytes(32)`, в БД только `sha256(key)`, поиск по хэшу |
| F-08 | Кривая ремонта ×23.3 против добычи ×1.8 | ✅ | `constants.rs` — ремонт пересчитан; правило `yield_per_hour > 2 × repair_per_unit` закреплено тестами `economy_tests` |
| F-09 | `reroll` обходит сжигание ресурсов | ✅ | `Reroll` теперь жжёт тот же бандл, что и `craft` для целевой редкости, и двигает `rarity_counter`; бэкенд `/reroll/fuse` подставляет 6 минтов и PDA счётчика |
| F-10 | Один листинг/аукцион на NFT на всю жизнь | ✅ | `init_if_needed` + `constraint = !listing.active` / `!auction.active` |
| F-11 | Колодец — бесплатный кран (216 WATER/сут/кошелёк) | ✅ | `CollectWellWater` требует существующий `Player` с `villagers > 0`; плюс глобальный кап WATER (F-03) |
| F-12 | `upgrade_exploration_tier` — underflow `u8` на новом аккаунте | ✅ | `exploration.rs`: `require!(state.tier >= 1 && state.tier < MAX_EXPLORATION_TIER, InvalidExplorationTier)` |
| F-13 | Барабан: EV 40 при цене 5 | ✅ | `programs/aof-quests/.../drum_reveal.rs`: таблица пересчитана на EV 4.75; инварианты в тестах `drum_odds_tests` |

---

## Средние

| ID | Что | Статус | Где |
|----|-----|--------|-----|
| F-14 | Сезонные награды без `RESOURCE_UNIT` (пыль) | ✅ | `season.rs`: `level × SEASON_REWARD_UNITS_PER_LEVEL × RESOURCE_UNIT`, + кап (F-03) |
| F-15 | `adjust_player_capacity` без границ | ✅ | `|delta| <= MAX_CAPACITY_DELTA`, нельзя увести ниже занятых жителей, событие `PlayerCapacityChanged` |
| F-16 | Перки коллекционера недостижимы | ✅ | `CollectorAllowEntry` PDA + `register_collector_mint` / `revoke_collector_mint`; `collector_stake` больше не начинается с `require!(false)` |
| F-17 | Несогласованная типизация инструментов | ✅ | `state::TOOL_KINDS` / `is_valid_tool_type` / `canonical_tool_type`; канонизация в `mint_tool`, `craft`, `reroll`; «spear» мапится в Meat как «bow» |
| F-18 | В reroll-конфиге нет запрета Legendary | ✅ | `init_config`/`set_config`: `require!(odds_bps[4] == 0, InvalidOddsWeights)` |
| F-19 | Пауза не покрывает cancel/claim/crank | ✅ | `config` + `!config.paused` добавлены в `MarketplaceCancel`, `OfferCancelCtx`, `CancelBuyOrder`, `CancelSellOrder`, `RentalEndCtx`, `RentalRevokeCtx`, `WeatherCrank`, `CraftOrderCancelCtx`, `CraftOrderFulfillCtx`, `ClaimLotteryPrize` |
| F-20 | GasTank: кулдаун на любой вывод; потеря <1000 lamports | ✅ | кулдаун только при выводе `> GASTANK_INSTANT_WITHDRAW_MICROS`; `GasTank.dust_lamports` переносит остаток |
| F-21 | `cancel_buy_order` на sell-ордере (и наоборот) | ✅ | `constraint = order.is_buy` / `!order.is_buy` |
| F-22 | `mint_tool` без проверки получателя; `reroll` без `decimals == 0` | ✅ | `MintTool.recipient` + `token_account.owner == recipient`; `Reroll.new_mint.decimals == 0` |
| F-23 | Лотерейный пул запирается навсегда | ✅ | `LotteryRound.created_at` + `refund_lottery_round` (таймаут 14 дней, возврат пула в казну + рента) |
| F-24 | Мёртвые PDA/ATA (`Listing`, `Auction`) | ✅ | `close = seller` + `token::close_account` в `marketplace_buy`, `marketplace_cancel`, `auction_settle` |
| F-25 | `session_check_and_spend` без PDA-привязки | ✅ | `seeds = [SESSION_SEED, authority]`, явный `authority`, проверка `session.authority` в хендлере; попутно `saturating_sub` дневного окна |
| F-26 | `crank_market` — underflow при рассинхроне часов | ✅ | `now.saturating_sub(...)` в `lib.rs` и `pricing.rs` |
| F-27 | Майнинг выключен в бэкенде, но включён на цепи | ✅ | `Config.mining_enabled` + `set_mining_enabled`; проверка в `start_mining` и `collect_mining`; бэкенд читает флаг с цепи (`lib/configState.ts`), роут `POST /admin/config/mining` |

---

## Низкие / инфо

| ID | Что | Статус | Где |
|----|-----|--------|-----|
| F-28 | `RewardReceipt` в глобальном пространстве имён | ✅ | seed `["reward_receipt", recipient, reward_id]`; `rewardReceiptPda(id, recipient)` в бэкенде |
| F-29 | Заказ крафта с нулевой ценой | ✅ | `require!(wood_needed + stone_needed > 0, EmptyCraftOrder)` |
| F-30 | `usage: Map` растёт бесконечно | ✅ | GC по таймеру + жёсткий потолок `MAX_TRACKED_KEYS` + инлайн-свип |
| F-31 | EOL-зависимости | ⚠️ | Перепроверено: RUSTSEC-2026-0144 бьёт anchor 1.0.0–1.0.1, здесь 0.30.1 — не актуально. Обновление Anchor/Solana = отдельный проект (миграция API), в этот заход не входит. Рекомендация: закрепить `@solana/web3.js` точной версией и добавить `cargo audit`/`npm audit` в CI |
| F-32 | Валидация намерения только для `marketplace_buy` | ✅ | `frontend/src/lib/coreInstructions.ts` (генерируется из IDL) + `validateCoreInstructions()`: неизвестный дискриминатор, authority-only инструкция, неверное число аккаунтов, «кошелёк обязан быть подписывающей стороной» (52 инструкции). Генератор `scripts/gen-core-instruction-table.py --check` в CI |
| F-33 | Покрытие тестами | ⚠️ | Добавлены: `cargo`-тесты логики (`state_tests`, `economy_tests`, `drum_odds_tests`) и FE-тесты политики кошелька. Валидаторские тесты на новые инструкции (ротация authority, кап, гвард, ре-лист) **написать и прогнать локально** |

---

## Документация и дублирование (G-*)

| ID | Статус | Что сделано |
|----|--------|-------------|
| G-01 (фляги восстановляют энергию) | ✅ | Текст в `investors-ext.ts` помечен как нереализованный; мёртвый `use_flask.rs` удалён |
| G-02 (POTATO: «не выдаётся как награда», ритуал 10→50 SKR) | ✅ | Оба утверждения помечены в `potato.ts` с фактическим статусом |
| G-03 (`ISSUANCE_CAPS_DESIGN.md` переоценивает кап) | ✅ | В шапку добавлена корректировка: кап покрывает 2/9 путей, глобальный потолок — `MaterialMints.max_supply`; Squads теперь возможен (F-02) |
| G-04 (`ANALYSIS.md` помечает отключённое как «Готово») | ✅ | В §2 добавлена таблица реальных статусов и поправлены строки |
| G-05 («шесть способов торговли» при выключенном `aof-market`) | ✅ | `TradeMethod.live`, в UI метка «не запущено» |
| G-06 (две копии `mint_for_kind`) | ✅ | Единственная реализация в `state.rs`; дубли из `mint_resource.rs` и `burn_resource.rs` удалены |
| G-07 (две копии `get_slot_hash`) | ⚠️ | Разные крейты (`aof-core` и `aof-quests`); шарить нечего без отдельного крейта. Оставлено, зафиксировано здесь |
| G-08 (дубль инициализации `ToolData`) | ✅ | `state::init_tool_data()`; три сайта вызова |
| G-09 (мёртвые `buff_expires_at`/`buff_type`) | ✅ | Полей нет в Rust; удалены из IDL (9 структур) — иначе бэкенд декодировал бы мусор |

---

## Что проверено в песочнице

- `python3 scripts/check-mint-writable.py` → `OK (61 checked)`; негативный тест (снять `mut` с `output_mint`) гейт ловит.
- `python3 scripts/check-idl-drift.py` → `IDL drift: none (6 IDL files match their Rust account contexts)`. Все 6 IDL перегенерированы под новые/изменённые контексты.
- `python3 scripts/gen-core-instruction-table.py --check` → актуально.
- `scripts/test-idl-drift.py`, `scripts/test-mint-cost-model.py`, `scripts/test-reward-migrations.py` → OK.
- TypeScript: изменённые файлы бэкенда и фронтенда проверены `tsc --noEmit` (внешние зависимости подложены из npm; `node_modules` проекта в песочницу не ставились).

## Что обязательно сделать локально

1. `anchor build` — **ничего из Rust не компилировалось**. Ожидаемые места, где
   может понадобиться ручная правка: порядок полей в новых структурах, типы
   аргументов новых инструкций, `COLLECTOR_ALLOW_SPACE`/`VAULT_GUARD_SPACE`.
2. `cargo test -p aof-core` — `economy_tests`, `state_tests`.
3. `anchor test` — прогнать `tests/aof_core.ts` (в нём есть `issuance_cap`,
   `mint_resource`, `pay_out`-сценарии; часть вызовов теперь требует
   новых аккаунтов → см. § «Изменения ABI»).
4. `npm ci && npm test` в `frontend` и `aof_backend`.
5. После `anchor build` — `python3 scripts/gen-core-instruction-table.py`
   (перегенерирует FE-таблицу) и обновить `aof_backend/src/idl/*.json` из
   `target/idl/`.

## Изменения ABI (ломают существующие вызовы)

| Инструкция | Что добавилось |
|---|---|
| `pay_out`, `pay_out_with_referral` | `player`, `materialMints`, `vaultGuard` |
| `mint_tool` | `recipient` |
| `reroll` | `rarityCounter`, `craftEconomy`, 6 пар (минт, ATA) |
| `craft_recipe` | три минт-аккаунта стали `mut` |
| `collect_well_water` | `player` |
| `claim_season_reward` | `materialMints` |
| `marketplace_cancel`, `offer_cancel`, `cancel_buy_order`, `cancel_sell_order`, `rental_end`, `rental_revoke`, `weather_crank`, `craft_order_cancel` | `config` |
| `collector_stake` | `collector_allow` |
| `mint_resource_once` | seed `reward_receipt` теперь включает получателя |
| `session_check_and_spend` | `authority` |

Бэкенд-вызовы всех перечисленных инструкций обновлены; IDL обновлены.
