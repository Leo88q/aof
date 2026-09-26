# Проверка безопасности по чек-листу Anchor (30 пунктов) — 2026-09-25

Область проверки:
- **все 6 on-chain программ** (`aof-core`, `aof-market`, `aof-liquidity`, `aof-quests`, `aof-rebirth`, `aof-session-keys`, Anchor 0.30.1);
- **игровые клиенты** (`game/godot`, `game/unity`);
- доверенные пути **бэкенда** (`aof_backend/src/routes`) и wallet-guard **фронтенда**.

Метки в коде: `[SECURITY_CHECKLIST_REVIEW F-X]`.

## 1. Итог

| | |
|---|---|
| Пунктов чек-листа закрыто полностью | **24 из 30** |
| Частично / требуют решений владельца | 6: #5, #10, #17, #20, #23, #27 |
| Найдено проблем | 1 High, 6 Medium, 2 Low, мелочи |
| **Исправлено в этой ветке** | **F-E (High), F-F, F-A, F-I, F-B** |
| Оставлено открытым (нужны продуктовые решения) | F-C, F-H, F-G, F-D |
| Добавлено тестов | 19 Rust host-тестов + 16 статических Node-тестов |

Главное:
- **Было:** `pay_out_with_referral` позволял authority вывести из хранилища **любой** mint без лимитов, в том числе застейканные NFT игроков. Документация и бэкенд считали, что там стоят те же три тормоза, что и в `pay_out`, но обработчик их не вызывал.
- **Стало:** оба обработчика идут через одну функцию `state::charge_vault_withdrawal`, так что снова разойтись им негде.

## 2. Как проверялось и что считается доказательством

1. Прочитаны все Accounts-контексты и все обработчики шести программ.
2. **Rust host-тесты** (`aof-core/src/security_checklist_tests.rs`) запускают **настоящий** сгенерированный Anchor `try_accounts` и **настоящие** обработчики на аккаунтах в памяти:
   - `Clock` и `Rent` подставляются заглушками syscall'ов;
   - CPI **записывается (считается), но не исполняется**.
   Поэтому тесты доказывают, что инструкция проверяет и меняет **до** передачи управления другой программе и вызывает ли она CPI вообще. Lamports, которые программа двигает сама, проверяются с точностью до lamport'а. Балансы токенов, которые меняет сам SPL CPI, этими тестами **не** покрыты: для этого нужен validator/bankrun.
3. **Статические Node-тесты** (`tests/readiness/security-checklist.test.cjs`) — «растяжки» по исходникам всех шести программ.
   - Каждая проверена **мутационно**: в код возвращалась уязвимость (снимался тормоз, лимит, `close`, `/// CHECK`, seeds, гейт RNG, `overflow-checks` и т.п.), и тест обязан был упасть. Убиты все 24 мутации (0 выживших).
4. CI: Rust-тесты выполняет `cargo test --workspace --lib` (job «Anchor build»), Node-тесты — workflow «AOF readiness».

## 3. Найденные проблемы

| ID | Серьёзность | Пункт | Суть | Статус |
|---|---|---|---|---|
| **F-E** | **High** | #16, #20, #2 | `pay_out_with_referral` не применял ни одного из трёх тормозов `pay_out`, хотя загружал `material_mints` и `vault_guard`. Скомпрометированный ключ authority мог вывести ресурсы сверх лимитов, а также застейканные NFT (достаточно `init_vault_guard` на mint NFT). | **Исправлено** |
| **F-F** | Medium | #11 | `harvest_wheat` минтил Synapse без `check_supply_cap`, вопреки заявлению [AUDIT F-03] «каждый путь эмиссии ограничен». | **Исправлено** |
| **F-A** | Medium | #4, #5 | `sweep_gas_fees` делал `system_program::transfer` из PDA, которым владеет программа и в котором есть данные. Runtime это всегда отвергает, так что комиссии в казну не попадали никогда. При починке учтена «пыль» `dust_lamports`, которая принадлежит пользователю. | **Исправлено** |
| **F-I** | Medium | #11 | Mint нового NFT-инструмента проверялся на `decimals`, `supply` и `mint_authority`, но **не на `freeze_authority`**. Пользователь мог скрафтить NFT со своей freeze authority, продать его и заморозить у покупателя. Или заморозить эскроу аукциона: тогда расчёт невозможен, а SOL участника заблокированы. Политика «non-freezable» была только в клиентском `txGuard`. | **Исправлено** (7 контекстов) |
| **F-B** | Medium | #6 | `craft`/`reroll` сжигали NFT, но оставляли `ToolData` («призрак»). Такой инструмент продолжал собирать урожай, чинился и сдавался в аренду. | **Исправлено** (`close = user`) |
| F-H | Medium | #2, #28 | Аренда: `RentalList/Start` не проверяют, где лежит NFT. Можно сдать инструмент, который сейчас в эскроу аукциона, и тогда `AuctionSettle` блокируется до конца аренды, а срок аренды задаёт владелец. Нет delist, при revoke после grace нет пропорционального возврата, `owner_split_bps = 10000` обнуляет комиссию платформы. | Открыто |
| F-G | Low/Med | #5 | Возврат предыдущей ставки аукциона идёт напрямую на его кошелёк. Если ставка меньше 890 880 lamports, а кошелёк обнулён, возврат падает с `InsufficientFundsForRent`, и перебить ставку нельзя. Обходится допополнением кошелька в той же транзакции. | Открыто |
| F-C | Medium | #20 | Централизация: один ключ authority, нет timelock/multisig. `set_fees` без верхней границы: `unstake_fee = u64::MAX` блокирует unstake, то есть NFT становятся «заложниками». Пауза блокирует и выходы (withdraw_gas, unstake, отмены, LP withdraw). Часть admin-инструкций без событий: `cancel_pending_authority`, pack/reroll config, `init_season`, `grant_season_xp`, `init_material_mints`. | Открыто |
| F-D | Low | #10 | Погода предсказуема (`unix_timestamp / 86400`), а `collect_well_water` применяет текущую погоду ко всему прошедшему окну до 24 ч. | Открыто |

Мелочи:
- сезонный пропуск можно купить повторно, проверки активного сезона нет;
- `OfferAccept` без проверки паузы;
- `migrate_tool` оставляет NFT на vault;
- cooldown `withdraw_gas` обходится частями (это свои средства);
- лишний `mut` на некоторых mint (#23).

## 4. Внесённые исправления

| Файл | Изменение |
|---|---|
| `aof-core/src/state.rs` | Новая `charge_vault_withdrawal()`, единая точка трёх тормозов: только ресурсный mint, guard принадлежит этому mint, списание per-tx/per-epoch бюджета. |
| `aof-core/src/instructions/pay_out.rs` | Переведён на общую функцию, поведение прежнее. |
| `aof-core/src/instructions/referral.rs` | Добавлены проверка баланса vault и `charge_vault_withdrawal` **до** CPI, плюс событие `VaultWithdrawal` для мониторинга. |
| `aof-core/src/instructions/harvest_wheat.rs` | `check_supply_cap(Synapse)` до `mint_to`. |
| `aof-core/src/instructions/sweep_gas_fees.rs` | Прямое списание через `economics::transfer_owned_lamports`. Резерв = баланс + `dust_lamports` + рента. |
| `aof-core/src/lib.rs` | `freeze_authority.is_none()` для mint NFT в `MintTool`, `MigrateTool`, `Craft`, `Reroll`, `PackOpenCommit`, `PackOpenReveal`, `RerollRandomReveal`. `close = user` для `Craft.prev_tool`, `Reroll.tool_a`, `Reroll.tool_b`. Регистрация тестового модуля. |

Совместимость:
- Состав аккаунтов, флаги `mut`/`signer` и аргументы не менялись; `scripts/check-idl-drift.py` сообщает «IDL drift: none».
- Клиенты уже создают mint с `freeze_authority = null` (`aof_backend/src/routes/tools.ts`, `scripts/initMints*.ts`, `tests/aof_core.ts`), так что F-I их не ломает.

## 5. Разбор 30 пунктов

Обозначения: ✅ защищено · ⚠️ частично / решение владельца · 🔧 было уязвимо, исправлено.

### A. Проверка аккаунтов

| # | Вердикт | Доказательство | Тесты |
|---|---|---|---|
| 1 init без seeds/bump | ✅ | Все `init`/`init_if_needed` во всех 6 программах имеют `seeds` + `bump`. Единственное исключение — ATA `LpDeposit.pool_vault` с `associated_token::*`. `Config` — singleton PDA, привязанный к upgrade authority. | Rust `config_must_be_the_initialized_canonical_pda_of_this_program`; Node #1/#22 |
| 2 нет has_one/mint/owner | 🔧 ✅ | Адресные и `constraint`-привязки mint/owner на всех пользовательских путях; PDA игрока связаны с подписантом. **F-E** (guard загружался, но не проверялся) исправлено. 8 unchecked-аккаунтов без собственного ограничения: 4 привязаны через seeds/constraint других полей, 4 — «ключи-значения», их список явно зафиксирован в тесте. | Rust `collect_flour_binds_…`, `a_gas_tank_can_only_be_withdrawn_by_its_owner`, `sweep_cannot_redirect_the_treasury`, `referral_payout_*`; Node #2/#16 |
| 3 payer не signer | ✅ | Все плательщики и admin-подписи имеют тип `Signer<'info>`. | Rust `admin_instruction_requires_the_stored_authority_signature` (`AccountNotSigner`) |
| 4 system_program без проверки | 🔧 ✅ | Везде `Program<'info, System/Token>`, SlotHashes проверяются по адресу. Все `system_program::Transfer` списывают с `Signer`. **F-A** исправлено. | Rust `fake_system_program_is_rejected_before_any_init_or_cpi` (`InvalidProgramId` до любого `init`/CPI); Node #4, F-A |
| 5 rent exemption | ⚠️ | `transfer_owned_lamports` сохраняет резерв; `withdraw_gas` не опускает tank ниже ренты; инвариант эскроу ордербука. Открыто: **F-G** (возврат ставки аукциона). | Rust `withdraw_gas_conserves_…`, `sweep_moves_exactly_…`, `order_matching_…` |
| 6 неинициализированное состояние | 🔧 ✅ | `Account<T>` проверяет владельца, дискриминатор и инициализацию. «Призраки» `ToolData` (**F-B**) исправлены. | Rust `config_must_…` (`AccountNotInitialized`, `AccountOwnedByWrongProgram`, нулевые данные); Node F-B |

### B. Состояние и логика

| # | Вердикт | Доказательство | Тесты |
|---|---|---|---|
| 7 CPI до фиксации состояния | ✅ | CPI идут только в SPL Token и System, они не вызывают программу обратно. Все проверки и списания бюджета выполняются **до** CPI (тормоза vault, лимит эмиссии, `IssuanceCap`, `RewardReceipt`). | Rust: 0 CPI во всех отказах; Node: тормоза раньше `token::transfer`, лимит раньше `mint_to` |
| 8 self-CPI / instruction sysvar | ✅ | Нет raw `invoke`, self-CPI, интроспекции инструкций и `remaining_accounts`. | Node #8/#24/#30 |
| 9 устаревшие кэшированные значения | ✅ | После CPI баланс нигде не читается без `reload` (market `cancel_limit_order` делает reload; есть тест `reload_tests` и гейт SW008). В core значения после CPI вычисляются арифметически из снимка до CPI. | существующие `reload_tests`, `scripts/test-p0-security.py` |
| 10 доверие Clock | ⚠️ | `unix_timestamp` используется только для таймеров (cooldown, аренда, аукцион), где погрешность в секунды или минуты допустима. Вся случайность на SlotHashes **выключена** — 13 точек входа, каждая за своим гейтом. Открыто: **F-D** (погода). | Node #8/#10/#17 |

### C. Токены и экономика

| # | Вердикт | Доказательство | Тесты |
|---|---|---|---|
| 11 mint/freeze authority | 🔧 ✅ | Mint authority ресурсов — PDA `auth`, проверяется на путях эмиссии. **F-I**: NFT-инструменты больше не могут иметь freeze authority. **F-F**: лимит эмиссии на harvest. Рекомендация: убедиться, что у уже развёрнутых mint ресурсов `freeze_authority = None` (скрипты создают их с `null`). | Rust `tool_nft_mint_with_a_freeze_authority_is_rejected`, `harvest_is_bounded_by_the_synapse_supply_cap`; Node F-I, F-F |
| 12 Token-2022 extensions | ✅ | Только классический SPL Token: `Program<Token>`, `Account<Mint>` с проверкой владельца. Token-2022 mint и программа отвергаются. | Rust `collect_flour_…` (`AccountOwnedByWrongProgram`, `InvalidProgramId`); Node #12 |
| 13 overflow в комиссиях | ✅ | `checked_*`, `split_bps` через u128, `overflow-checks = true` в release. | Node #13; Rust `withdraw_gas_…`, `order_matching_…`; существующие `economics::tests` |
| 14 непроверенное вычитание | ✅ | `checked_sub` везде, где важно. Сырые `-=`/`+=` по lamports только после явных проверок (`withdraw_gas`, ордербук). | Rust `withdraw_gas_…` (сохранение суммы), `order_matching_…` |
| 15 округление в пользу атакующего | ✅ | Округление вниз, комиссия ≤ суммы. | Rust `order_matching_…` (`taker + maker ≤ gross`); `economics::tests` |
| 16 казна не PDA / слив админом | 🔧 ✅ | `treasury` задаётся один раз в `initialize` и проверяется `address = config.treasury`. Выводы из vault ограничены `VaultGuard`. **F-E** исправлено. | Rust `sweep_cannot_redirect_the_treasury`, `referral_payout_*`, `vault_brakes_are_one_shared_gate` |
| 17 front-running / MEV | ⚠️ | `marketplace_buy_bounded(max_price, expires_at ≤ 300 s)`; ордербук исполняется по цене стоящего ордера, покупатель защищён собственным лимитом; RNG выключен. Commit-reveal для аукционов и офферов не нужен. | Node #17 (RNG выключен) |
| 18 неограниченные циклы | ✅ | Циклы только по массивам фиксированной длины и константам. Нет `remaining_accounts`. Строковые аргументы канонизируются (`TOOL_KINDS`) или ограничены по длине. | Node #18 (списки исключений на уровне аргументов) |
| 19 спам событиями | ✅ | Одно-два события на инструкцию, размеры фиксированы, пользовательских строк нет. | — |
| 20 «режим бога» у админа | ⚠️ | Есть: двухшаговая ротация authority, привязка к upgrade authority, лимиты `VaultGuard`/`IssuanceCap`/supply cap, события на критичных setter'ах. Нет: multisig/timelock, верхних границ `set_fees`, выходов во время паузы, событий на части admin-инструкций (**F-C**). | Node #20 (12 критичных setter'ов обязаны эмитить события); Rust `referral_payout_is_bounded_by_the_vault_guard` |

### D. Специфика Anchor

| # | Вердикт | Доказательство | Тесты |
|---|---|---|---|
| 21 неверный `space` | ✅ | Все `*_SPACE = 8 + InitSpace`. | Rust `declared_account_space_matches_the_serialized_layout` |
| 22 init без payer/system | ✅ | У каждого `init` есть `payer`, `space` и `Program<System>`. | Node #1/#22 |
| 23 лишний `mut` | ⚠️ | На безопасность не влияет, только на write-lock contention. Несколько лишних `mut` на mint. | — |
| 24 недоверенная десериализация | ✅ | Только типизированные `Account<T>`, ручной десериализации данных аккаунтов нет. Порядок enum сохранён (REBRAND_MAP). | Node #24 |
| 25 коллизия дискриминаторов | ✅ | Anchor проверяет дискриминатор; коллизий нет. | Rust `config_must_…` (данные `Player` в слоте `Config` → `AccountDiscriminatorMismatch`); Node #25/#26 (уникальность instruction/account/event дискриминаторов) |
| 26 рассинхрон IDL | ✅ | `scripts/check-idl-drift.py` в CI; наши изменения IDL не меняют. | CI-гейт |

### E. Рантайм

| # | Вердикт | Доказательство | Тесты |
|---|---|---|---|
| 27 compute budget | ⚠️ | Тяжёлые контексты в `Box`, циклы ограничены, клиентский guard ограничивает CU до 1,4 млн. Реальное потребление CU не измерено: TS-интеграция в CI не запускается, validator-job падает (известная проблема, не связана с этой веткой). | — |
| 28 refund при close не тому | ✅ | Цель каждого `close` — подписант или адрес, закреплённый ограничением. | Rust `rental_close_refund_is_bound_to_the_renter`; Node #28 |
| 29 дубликаты аккаунтов | ✅ | Один и тот же ордер в роли обеих сторон отвергается. `transfer_owned_lamports` требует `from ≠ to`. Двойной NFT в `reroll` падает на втором burn. | Rust `an_order_cannot_be_matched_against_itself` |
| 30 устаревшие sysvar | ✅ | `Clock::get`/`Rent::get`; нет `Fees`/`RecentBlockhashes`. | Node #30 |

## 6. Игра и бэкенд

- **Godot/Unity-клиенты** — прототипы-заглушки (около 660 строк, RPC-методы возвращают пустые значения). Ключей и секретов в них нет, авторитетной логики тоже: экономику определяют on-chain программа и admin-роуты бэкенда. Клиентский `session_keys.gd` с его «запрещёнными инструкциями» — лишь описание, реальную защиту даёт on-chain `aof-session-keys`, где траты выключены (`AtomicBindingRequired`).
- **Бэкенд**:
  - роуты, подписывающие authority-транзакции (`/resources/mint`, `/referral/pay-out`, `/inbox/create`), закрыты `requireAdmin`, а также circuit breaker, лимитами и idempotency;
  - награды выдаются через `mint_resource_once` с `RewardReceipt`, двойное получение исключено;
  - комментарий в `referral.ts` («same three brakes as pay_out») теперь соответствует on-chain коду.
- **Фронтенд**: `txGuard` ограничивает набор инструкций, требует non-freezable mint и лимит CU. Это защита только на клиенте; начиная с F-I то же правило проверяется и on-chain.

## 7. Тесты

Запуск:

```bash
cargo test -p aof-core --lib security_checklist            # 19 host-тестов (+ существующие юнит-тесты)
node --test tests/readiness/security-checklist.test.cjs     # 16 статических растяжек
```

Rust (`aof-core/src/security_checklist_tests.rs`):

| Тест | Пункты |
|---|---|
| `admin_instruction_requires_the_stored_authority_signature` | #3, #2, #20 |
| `config_must_be_the_initialized_canonical_pda_of_this_program` | #1, #6, #25 |
| `fake_system_program_is_rejected_before_any_init_or_cpi` | #4, #22 |
| `collect_flour_binds_mint_token_account_and_mill_to_the_signer` | #2, #12 |
| `rental_close_refund_is_bound_to_the_renter` | #28 |
| `tool_nft_mint_with_a_freeze_authority_is_rejected` | #11, F-I |
| `sweep_cannot_redirect_the_treasury` | #16 |
| `a_gas_tank_can_only_be_withdrawn_by_its_owner` | #2 |
| `referral_payout_cannot_move_a_non_resource_mint` | F-E, #16 |
| `referral_payout_rejects_a_guard_configured_for_another_mint` | F-E |
| `referral_payout_is_bounded_by_the_vault_guard` | F-E, #20 |
| `referral_payout_within_budget_charges_the_guard_before_transferring` | F-E |
| `vault_brakes_are_one_shared_gate` | F-E |
| `harvest_is_bounded_by_the_synapse_supply_cap` | F-F, #11 |
| `sweep_moves_exactly_the_fees_and_never_user_funds` | F-A, #5, #14 |
| `withdraw_gas_conserves_lamports_and_keeps_the_tank_rent_exempt` | #5, #13, #14 |
| `order_matching_conserves_lamports_and_fees_stay_below_the_trade` | #13, #14, #15 |
| `an_order_cannot_be_matched_against_itself` | #29 |
| `declared_account_space_matches_the_serialized_layout` | #21 |

Ограничения:
- CPI не исполняется, поэтому переводы токенов самим SPL Token не проверяются.
- `close` в тестах не вызывается: `AccountInfo::realloc` на хосте небезопасен. Пункт 28 проверяется через привязку адреса получателя.
- CU не измеряется.

Всё это закрывается интеграционными тестами на validator/bankrun (`tests/aof_core.ts`), когда починят validator-job в CI.

## 8. Рекомендации по приоритету

1. **F-C**:
   - authority → Squads multisig;
   - timelock на `set_fees`, `set_supply_cap`, `set_resource_mints`, `set_vault_guard`;
   - константы-потолки для `craft_fee`/`unstake_fee`;
   - разрешить во время паузы выходы: `withdraw_gas`, `unstake`, отмены, `rental_end`, LP withdraw;
   - события для оставшихся admin-инструкций.
2. **F-H**:
   - в `RentalList`/`RentalStart` проверять, что NFT у владельца (`owner_token.amount == 1`), или блокировать аренду, пока инструмент в листинге/аукционе;
   - добавить `rental_delist`;
   - при revoke — пропорциональный возврат;
   - применить `RENTAL_FEE_BPS`.
3. **F-G**: `min_bid ≥ Rent::minimum_balance(0)` в `auction_create` или pull-возвраты.
4. Для уже существующих на devnet «призрачных» `ToolData` и NFT с freeze authority: проверять хранение NFT в `repair`/`harvest_wheat`/`rental_*` или пересоздать devnet-состояние.
5. Починить validator-job в CI, чтобы запускались TS-интеграционные тесты и измерение CU.
