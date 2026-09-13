# 📋 ОТЧЁТ АУДИТА ПРОЕКТА "AGE OF FARMING"

**Дата:** 2026-09-05 · **Ветка:** main (root `dafaf11`, aof_backend `139c58ac9`) · **Аудитор:** Claude (Fable 5.1)
**Охват:** aof-core (83 инструкции, 2392 строки lib.rs + 60 файлов инструкций), aof-market, aof-quests, aof-rebirth, aof-liquidity, aof_backend (62 роута, 5 воркеров, prisma), frontend (Vite/React, 95 файлов), корневые артефакты, деплой.

**Что НЕ удалось проверить:** `tsc --noEmit` для frontend/backend (в shell аудитора нет `node`/`npx`), `anchor build`/`cargo check` (запрещено политикой проекта тратить 10+ мин; вместо этого размеры аккаунтов посчитаны скриптом по `target/idl/aof_core.json`, собранному 2026-09-04 20:39).

**Главный вывод в одном абзаце:** ни одна из 5 программ не задеплоена на devnet (проверено `solana program show`), а aof-core в текущем виде **не сможет даже инициализироваться**: 15 типов аккаунтов имеют константы `*_SPACE` меньше реального layout (в т.ч. `Config`), и `declare_id` не совпадает с deploy-keypair. Поверх этого в контрактах есть 4 эксплуатируемые дыры на кражу средств/ресурсов (orderbook, hot-market, repair, exploration), приватный ключ authority лежит в git-истории бэкенда, а ~40 % бэкенд-роутов не совпадают по именам аккаунтов/аргументам с IDL и упадут при первом вызове. Экономика POTATO не подключена вообще: токен нигде не минтится и не сжигается on-chain.

---

## 🚨 КРИТИЧЕСКИЕ ПРОБЛЕМЫ (исправить СРОЧНО)

### Проблема 1: Все `*_SPACE` константы устарели → `initialize()` и ещё 14 init-инструкций падают с `AccountDidNotSerialize`
- Файл: `aof-core/src/constants.rs` (строки 16, 24, 238, 240, 254, 276–284) vs `aof-core/src/state.rs`
- Описание: в `state.rs` к аккаунтам добавлены поля (`seeds_mint/water_mint/potato_mint` в `Config`, 8 массивов в `CraftEconomy`, `buff_expires_at: i64 + buff_type: u8` в 12 аккаунтах), а константы `space = X_SPACE` в `#[account(init)]` не пересчитаны. Проверено скриптом по IDL:

| Аккаунт | Нужно байт (+8 disc) | SPACE const | Статус |
|---|---|---|---|
| Config | 282 | 186 | ❌ |
| CraftEconomy | 393 | 201 | ❌ |
| PackConfig | 37 | 28 | ❌ |
| RerollConfig | 28 | 19 | ❌ |
| Season | 30 | 21 | ❌ |
| MaterialMints | 754 | 745 | ❌ |
| EnergyAccount | 60 | 58 | ❌ |
| FarmTile | 75 | 58 | ❌ |
| WeatherState | 31 | 22 | ❌ |
| WellState | 66 | 57 | ❌ |
| MillState | 67 | 58 | ❌ |
| OvenState | 68 | 59 | ❌ |
| LoveProgress / FortuneBoost | 58 | 49 | ❌ (не в IDL, не используются) |
| остальные 22 | — | — | ✅ |

- Уязвимость: не security, а полная неработоспособность: Anchor при `exit()` сериализует структуру в аккаунт меньшего размера → ошибка 3004. `initialize`, `init_craft_economy`, `init_pack_config`, `init_reroll_config`, `init_season`, `init_material_mints`, `plant_seeds`, `harvest_wheat`, `start_milling`, `start_baking`, `weather_crank`, `collect_well_water` — все упадут.
- Исправление: убрать ручные константы, использовать `space = 8 + T::INIT_SPACE` везде (все структуры уже `#[derive(InitSpace)]`). Удалить бессмысленные поля `buff_expires_at/buff_type` из `PackConfig, RerollConfig, Season, MaterialMints, WeatherState, WellState, MillState, OvenState, FarmTile, EnergyAccount, LoveProgress, FortuneBoost` (баффы игрока должны жить в одном аккаунте `Player`, а не в 12 разных).
- Приоритет: 🔴

### Проблема 2: `declare_id` ≠ deploy keypair ≠ backend PROGRAM_ID
- Файл: `aof-core/src/lib.rs:15` (`sFpDGRDYjH7VqdBdg2HyWGamUC7Pk6bGabhD91eZmaw`), `target/deploy/aof_core-keypair.json` → `HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq`, `Anchor.toml`/`aof_backend/.env`/`aof_backend/src/idl/aof_core.json` → `HtJg…`, `CLAUDE.md`/`solCore.js`/`solana/aofClient.ts`/`tests/aof_core.ts` → `2dQsHg3o…`
- Описание: три разных program ID в трёх слоях. При деплое `.so` под `HtJg…` каждая инструкция падает с `DeclaredProgramIdMismatch (4100)`. `target/idl/aof_core.json` уже содержит `sFpD…`, а бэкенд-IDL — старый `HtJg…` и без полей `buff_*` (13 типов расходятся).
- Исправление: один ID. Либо `declare_id!("HtJg…")` + `anchor keys sync`, либо сгенерировать keypair под `sFpD…`. После пересборки скопировать `target/idl/*.json` в `aof_backend/src/idl/` (сделать это npm-скриптом `sync-idl`). Обновить CLAUDE.md.
- Приоритет: 🔴

### Проблема 3: Кража всего SOL из buy-ордеров ордербука (`buy_order` не привязан к `mint`)
- Файл: `aof-core/src/lib.rs:1876-1899` (`MatchResourceOrders`), `aof-core/src/instructions/orderbook.rs:122-175`
- Описание: `sell_order` проверяется через seeds `[RESOURCE_ORDER_SEED, sell_order.maker, mint]`, а `buy_order` объявлен как `#[account(mut)] pub buy_order: Account<ResourceOrder>` без seeds и без `constraint = buy_order.mint == mint.key()`. `kind: u8` задаётся мейкером произвольно и с минтом не сверяется.
- Эксплойт: жертва ставит buy-ордер на WOOD (эскроу SOL в PDA). Атакующий создаёт свой SPL-минт F, кладёт sell-ордер на F с тем же `kind` и ценой = цене жертвы, создаёт ATA жертвы для F (permissionless) и вызывает `match_resource_orders(mint = F, buy_order = ордер жертвы)`. Все проверки проходят; SOL из эскроу жертвы уходит атакующему, жертва получает мусорный токен.
- Исправление: `#[account(mut, seeds = [RESOURCE_ORDER_SEED, buy_order.maker.as_ref(), mint.key().as_ref()], bump, constraint = buy_order.mint == mint.key())]`; `kind` вычислять из `mint` через `mint_for_kind`, а не принимать от клиента.
- Приоритет: 🔴

### Проблема 4: Hot-market: покупка инструмента бесплатно (`treasury_mascot` не проверяется) + продавцу ничего не платят
- Файл: `programs/aof-market/src/instructions/hot_market/buy.rs:49-51, 111, 118-130`
- Описание: `treasury_mascot: UncheckedAccount` без `address = mascot_config.treasury_mascot`. Покупатель передаёт собственный ATA → переводит маскот-токен сам себе и получает инструмент. Кроме того, `let _net = …` не используется: вся цена уходит в казну, продавец из `sell_into_queue` не получает ни маскот, ни SOL → игроки отдают инструменты пулу бесплатно.
- Исправление: `#[account(mut, address = mascot_config.treasury_mascot)]`; хранить в очереди `(mint, seller)` и при `buy` переводить `net` продавцу, `fee` — в казну.
- Приоритет: 🔴

### Проблема 5: `repair` — WOOD сжигается из произвольного минта
- Файл: `aof-core/src/lib.rs:640-663` (`wood_mint`, `user_wood` без `address = config.wood_mint` / owner-constraint), `aof-core/src/instructions/repair.rs:35-46`
- Эксплойт: игрок создаёт свой минт "FAKEWOOD", минтит себе миллион, передаёт его как `wood_mint` → ремонт стоит только STONE. Аналогично `start_exploration_commit` (`lib.rs:1017-1019`, MEAT) — стоимость похода в MEAT обходится полностью.
- Исправление: `#[account(mut, address = config.wood_mint)]` и `constraint = user_wood.mint == wood_mint.key() && user_wood.owner == user.key()`; для MEAT — `address = material_mints.meat` (и добавить `material_mints` в контекст).
- Приоритет: 🔴

### Проблема 6: Приватный ключ authority закоммичен в git бэкенда
- Файл: `aof_backend/.env` (tracked, 3 коммита: `912d91df7`, `ea87506d9`, `c19874b11`), `aof_backend/.env.bak`, плюс `node_modules/` целиком в индексе aof_backend
- Описание: `AUTHORITY_SECRET_KEY` (225 символов base58) есть в HEAD и истории сабмодуля. `.gitignore` добавлен позже и не помогает. В корневом репо ключи `solana/keys/*.json` **не** трекаются (ок), но `.aider.chat.history.md` и `.claude/settings.local.json` — трекаются.
- Исправление: 1) считать ключ `2gm8qGRY…` скомпрометированным: сгенерировать новый authority, перед mainnet — обязательно; 2) `git rm --cached .env .env.bak node_modules -r`, переписать историю (`git filter-repo`) или пересоздать репо; 3) секреты — только через env/секрет-менеджер.
- Приоритет: 🔴

### Проблема 7: `trust_snapshot_update` — любой игрок выставляет себе tier 5
- Файл: `programs/aof-market/src/instructions/trust/trust_snapshot_update.rs:20` (`oracle_authority: Signer` без сверки с `mascot_config.authority`)
- Эксплойт: подписать инструкцию своим ключом с `tier = 5` → лимит session-key 100 SOL вместо 1 SOL; далее session-key бота может вывести инструменты через `sell_into_queue`.
- Исправление: добавить `mascot_config` в контекст и `constraint = oracle_authority.key() == mascot_config.authority`.
- Приоритет: 🔴

### Проблема 8: Секреты commit-reveal хранятся в памяти процесса → рестарт сервера = потеря оплаченных паков
- Файл: `aof_backend/src/lib/secretStore.ts:3` (`new Map`)
- Описание: `pack_open_commit` уже списал 0.1–1 SOL в казну; секрет для `reveal` живёт только в RAM. Любой рестарт/деплой/краш → игрок заплатил, инструмент не получит, `PackCommit` висит навсегда (окно SlotHashes ~512 слотов ≈ 4 мин, потом `CommitExpired` без возврата). То же для reroll (инструмент уже сожжён), forge, exploration, lottery.
- Исправление: хранить `(key → secret, createdAt)` в Prisma; reveal делать фоновым воркером сразу после подтверждения commit; в контракте добавить `refund`-инструкцию для протухших коммитов (вернуть цену пака / выдать инструмент по fallback-энтропии).
- Приоритет: 🔴

### Проблема 9: Аукцион не принимает вторую ставку
- Файл: `aof-core/src/lib.rs:1373-1374` (`previous_bidder` без `mut`), `aof-core/src/instructions/auction.rs:66-68`
- Описание: прямое `try_borrow_mut_lamports` на не-writable аккаунт → runtime error "instruction modified lamports of a read-only account". Работает только первая ставка; любая перебивающая ставка падает → аукцион фактически "первый поставил — забрал", NFT заблокирован до `end_time`.
- Исправление: `#[account(mut, address = auction.current_bidder)]`.
- Приоритет: 🔴

### Проблема 10: POTATO не существует on-chain: нет сеттера `potato_mint`, нет варианта в `ResourceKind`, `craft` невозможен
- Файл: `aof-core/src/instructions/set_resource_mints.rs` (только food/wood/stone), `aof-core/src/lib.rs:17-51` (`ResourceKind` без `Potato`), `aof-core/src/lib.rs:441-455` (`Craft` требует `address = config.potato_mint`, `seeds_mint`, `water_mint`)
- Описание: `Config.potato_mint/seeds_mint/water_mint` навсегда `Pubkey::default()` → `craft` невозможно вызвать вообще (Anchor не десериализует System Program как `Mint`). `admin/test-grant-potato` вызывает `mintResource("potato")` — такого варианта нет. Все "POTATO"-награды (daily, quests, comeback) — строки в SQLite. Токен, вокруг которого построена вся токеномика ТЗ, не имеет ни одного on-chain источника или стока.
- Исправление: расширить `set_resource_mints(food, wood, stone, seeds, water, potato)` или убрать дубли `seeds_mint/water_mint` из Config (они уже есть в `MaterialMints`); добавить `ResourceKind::Potato` **или** отдельный `mint_potato` с лимитами эмиссии.
- Приоритет: 🔴

### Проблема 11: Бэкенд-роуты не совпадают с IDL (упадут на первом вызове)
- Файлы и расхождения:
  - `aof_backend/src/routes/hotMarket.ts:12-27` — PDA seed `potato_config` и аккаунт `potatoConfig`; в программе `mascot_config`/`MascotConfig` → `marketProgram.account["potatoConfig"]` = `undefined` → TypeError во всех hot-market роутах.
  - `drum.ts:32`, `quests.ts`, `liquidity.ts` — `treasuryPotato/userPotato/potatoMint` vs IDL `treasury_mascot/user_mascot/mascot_mint`.
  - `tools.ts:217-286` `/repair` — не передаёт `woodMint/userWood` (обязательны по IDL) и дополнительно сжигает WOOD/FOOD через `burnResource` в 1e9 раз больше, чем контракт (`repairCosts` ×1e9 при 0-decimals-логике контракта).
  - `exploration.ts:30`, `forge.ts` — не передают `meatMint/userMeat`.
  - `admin.ts:552-573` `/init-material-mints` — 14 аргументов вместо 23.
  - `admin.ts` `/test-grant` — `mintResource(<string>)` вместо enum-объекта, аккаунты `user` без `treasuryToken/player`.
  - `resources.ts:130` `exchangeFoodEnergy`, `tools.ts:569` `useFlask`, `forge.ts:96` `bowRewardCommit` — инструкций нет в программе (`use_flask.rs` не подключён в `mod.rs`, ссылается на несуществующий `PlayerState`).
  - `chain.ts:69` `/farm/harvest` — `toolData` = pubkey минта вместо PDA `["tool", mint]`.
  - `query.ts:395-420` `/farm-tiles` — читает поля `planted/ready/progress/cropType`, которых нет в `FarmTile` (`state/planted_at/ready_at`) → UI всегда видит пустые тайлы.
  - `vipStatus.ts:30` — `premiumTrack`/`active` вместо `premium` → on-chain VIP всегда false.
- Исправление: единый генератор клиентов из IDL (anchor `Program<AofCore>` с типами вместо `as any`), интеграционный тест на каждый роут против localnet.
- Приоритет: 🔴

---

## ⚠️ ВАЖНЫЕ ПРОБЛЕМЫ

### Контракты
1. **`hot_market_init_pool` без проверки authority** (`programs/aof-market/.../init_pool.rs:34`): любой может первым создать пул редкости 1–4 и стать его `authority` (управляет `start_event` мультипликаторами). Добавить `constraint = authority.key() == mascot_config.authority`.
2. **`quest_init`, `challenge_init`** (`aof-quests`): `authority: Signer` не сверяется с `quest_config.authority` — любой создаёт квесты с наградой 10⁹.
3. **`quest_claim_reward`** (`quest_claim_reward.rs:64`): перевод из казны с `authority = user` — всегда падает (казна не принадлежит юзеру). Никто и ничто не выставляет `quest_progress.completed` (нет инструкции) → квесты on-chain мертвы.
4. **`achievement_unlock`, `challenge_contribute`**: юзер сам "разблокирует" любое достижение и вносит любые `medals` без перевода токенов. Если лидерборд/награды считают это — бесплатные очки.
5. **`drum_reveal`** (`drum_reveal.rs:75`): приз выводится из `sha256(secret)` = самого commit-hash, без slot-hash. Сервер знает исход до коммита и может грайндить джекпот (1 % → 500 маскотов) для своих кошельков. Использовать `randomness.rs` из aof-core (secret ⊕ slot_hash).
6. **`lp_deposit`** (`lp_deposit.rs:19`): `lp_pool` объявлен `init` → второй депозит в редкость падает. `share_price` стартует с 1e9 → депозит < 1 маскота даёт 0 долей. `lp_withdraw:64` `shares * price` без checked_mul. `accumulated_fees` никем не пополняется (hot-market не делает CPI). Модуль ликвидности нефункционален.
7. **`Craft` SKR-скидка** (`lib.rs:453-455`): `skr_mint` без `address` → фейковый минт с 3000 токенами даёт 15 % скидки на POTATO.
8. **`collect_well_water`** — бесконечный бесплатный фонтан: 5–20 WATER/час на кошелёк без энергии и капа, вода продаётся за SOL в ордербуке → сибил-фермы воды. Добавить кап буфера (например 24 ч) и/или энергию.
9. **`weather_crank`** — `WeatherState` без bump-сверки при чтении в `CollectWellWater` (`bump = weather_state.bump`, но `weather_crank` не пишет `bump` в аккаунт → `bump = 0` → seeds-проверка в `collect_well_water` не пройдёт). Дописать `weather.bump = ctx.bumps.weather_state`.
10. **Rental**: нет `rental_cancel` — владелец не может снять листинг; `rental_start` не проверяет `!tool.staked && !tool.is_mining`; листинг остаётся `active` навсегда.
11. **Marketplace/Offer**: продажа инструмента в состоянии `is_mining` переносит `operator`, но житель продавца (`villagers_available`) не освобождается — утечка слотов. Требовать `!tool.is_mining` при list/accept.
12. **`cancel_buy_order`** возвращает `price×remaining`, но `taker_buffer` (0.4 %) остаётся в PDA навсегда; частичные матчи не возвращают разницу цен.
13. **`referral_bind`**: `referrer == referred` не запрещён (самореферал ради `active_count`/тиров).
14. **`migrate_tool`**: `MIGRATION_AUTHORITY` захардкожен (`4AjNMok…`), а ключ в `solana/keys/aof-migration-authority.json` — `CWbK3ok…`; инструкция неисполнима.
15. **`mint_resource` fee `pick_fee_bps`** использует `slot` в хэше — сервер может ретраить транзакцию в следующем слоте ради минимального bps (7–10 % → 7 %). Мелко, но противоречит комментарию "не подверженным повторным попыткам".
16. `overflow-checks = true` в `Cargo.toml` — хорошо; но `lottery.rs:57` `round.tickets_sold += 1`, `exploration.rs:71` `trips_today += 1`, `forge.rs:80` `slot.level += 1` полагаются на panic вместо `checked_*`.

### Бэкенд
17. **Нет аутентификации ни на одном роуте.** `/admin/*` (initialize, set-fees, set-paused, mint-resource, migrate-tool, send-tx), `/security/circuit/set`, `/api-keys/issue`, `/trust/snapshot/update`, `/tools/pay-out` (перевод из vault любому ATA!), `/tools/mint`, `/season/xp/grant`, `/inbox/create` (создать письмо с наградой 10⁹ WOOD самому себе и заклеймить) — открыты всему интернету. Аудит-мидлвар `sentinelAutoAudit` только логирует. Нужен как минимум `X-Admin-Token` + подпись кошелька (`verifySolMessage` из `solCore.js`) для user-роутов, чтобы `req.body.user` нельзя было подменить.
18. **`requireWalletLimits`** берёт адрес из тела запроса без подписи → лимиты обходятся сменой поля. **`requireIdempotency`** без заголовка строит ключ из `path + body[:200]` → два разных клейма с одинаковым началом тела блокируют друг друга; при ошибке ключ не снимается (`failIdempotency` нигде не вызывается) → повтор невозможен 409.
19. **`coSign`** (`lib/tx.ts`) подписывает authority **любую** транзакцию, которую сервер собрал, без симуляции/верификации события — противоречит правилу CLAUDE.md "сервер никогда не подписывает вслепую". `/admin/send-tx` вообще отправляет произвольный base64 без проверок.
20. **Rate limiting**: `txLimiter` = 120/мин (комментарий говорит 30), `/gastank`, `/resources`, `/collectors`, `/referral`, `/session`, `/drum`, `/quests`, `/chain/*` — только общий лимит 300/15 мин.
21. **DB**: SQLite (`prisma/aof.db`, бинарник в git сабмодуля) при 60+ моделях и cron-записях каждые 5 мин; `trustFormula.ts:7` и `antifraud.ts:11` создают собственные `PrismaClient` вместо синглтона `lib/db.ts` → утечка соединений. `leaderboard.ts` пишет 100 upsert-ов в цикле без транзакции. `neighbors.ts` `search` загружает 100 профилей в память для фильтра.
22. **Логирование**: 49 `console.log` в проде (мимо pino), в `admin.ts:129` логируются параметры; `errorHandler` возвращает `stack` при `NODE_ENV !== production` (не задан нигде → всегда). Ключи в логи не попадают (проверено), но `Keypair.fromSecretKey(bs58.decode(process.env.AUTHORITY_SECRET_KEY!))` падает без понятной ошибки при пустом env.
23. **`server.ts:154`** — висячий `app` (no-op), `/health` зарегистрирован после `errorHandler`, `/season` смонтирован дважды (`season` и `vipStatus`), `/privileges` — `txLimiter` после общего.
24. **Две системы энергии, погоды и квестов**: DB-`Energy` (кап 20/30, 10 мин) vs on-chain `EnergyAccount` (30 мин); DB-погода (`weather.ts`, веса 40/30/20/10) vs on-chain `weather_crank` (10/50/30/10, влияет на колодец); `quests.ts` отдаёт захардкоженные демо-квесты, `questGenerator` — другие, on-chain `QuestTemplate` — третьи. Игрок видит одно, контракт считает другое.
25. **`economyMonitor`**: инфляция считается как разница supply между двумя снапшотами (5 мин), но записывается как `inflation24h`; `getBurnEvents/getMintEvents/getTopHolders` — заглушки, `autoIncreaseCraftCost` — заглушка. Алерты "критическая инфляция" никогда не сработают, а если и сработают — по неверной метрике.
26. **`npcMerchant`** — генерирует случайные "сделки" `Math.random()` и пишет их в `AuditLog` как `result: success` → загрязняет Sentinel-лог и метрики `activeTraders24h`.
27. **`miningPayout.calculatePayoutAmount`** возвращает `hours × 10 × yield` в **целых единицах**, тогда как минты созданы с `decimals = 9` (`initMintsV2.ts`, `setup_devnet.sh`) → выплата 80 единиц = 0.00000008 токена. Такая же путаница decimals в `/tools/repair-quote` (×1e9) vs контракт (`REPAIR_STONE_COMMON = 2` атомарных единицы). Решить единообразно: либо все ресурсные минты `decimals=0`, либо все константы контракта ×1e9.
28. `trust-worker/formula.js` — скомпилированная **старая** копия `trustFormula.ts` (referral 150 по умолчанию, без antiBot); воркер импортирует `.ts`, так что `.js` — мёртвый дубль, но вводит в заблуждение.

### Фронтенд
29. Две параллельные системы кошелька: `wallet/WalletProvider.tsx` (`@solana/wallet-adapter-react`, autoConnect) и `lib/wallet.ts` + `store/walletStore.ts` (ручной `window.phantom`). Все страницы используют вторую; первая — мёртвый провайдер. `lib/wallet.ts:8` RPC захардкожен `127.0.0.1:8899`, `api.ts` — `localhost:8080`, `ws.ts` — `localhost:8081`; `VITE_RPC_URL` читается только мёртвым провайдером.
30. `txGuard` (`txGuard.ts:83,176`): `estimateLamportsSpent` парсит строку "N lamports" из логов, которых System Program не пишет → всегда 0; `estimateTokenOutflows` — заглушка. Guard даёт ложное чувство защиты; при этом блокирует любую транзакцию, чья симуляция упала (например, из-за Проблемы 1).
31. Моки в UI: `InboxHome.tsx:9` `demoLetters` показываются как реальные письма, `CompendiumHome.tsx:22` `demoCaught` (7 "пойманных" инструментов у нового игрока), `FlaskMarketplace.tsx:18` `mockOrders` + `alert()` вместо ордера, `ActiveBuffs.tsx:18` фейковый активный бафф, `DrumSpin.tsx` — `Math.random()` вместо `api.drum.*`, `ExplorationPage.tsx:29-33` — пустые минты в запросе, `marketUtils.ts:98` — захардкоженные адреса FOOD/WOOD/STONE с localnet, остальные `mint: ""`.
32. `ToolsHome.tsx:42` `handleMiningAction` только `console.log`. `useWalletStr.ts:13` логирует адрес при каждом рендере.
33. Ошибки API везде глотаются `.catch(() => {})` (InboxHome, CompendiumHome, CraftPage и др.) — пользователь не узнает, что бэкенд лежит; интервал `setInterval(loadTiles, 10000)` в `PlantingPanel` без отмены при смене кошелька (зависит от `walletAddr` только через deps, ок), `HotMarket.tsx` пересоздаёт WS-подписку на каждое изменение `price` (deps `[rarity, price]`) → лавина subscribe.
34. `FarmDashboard` показывает DB-энергию, а `plant_seeds` тратит on-chain энергию → UI-баланс никогда не совпадёт с реальным.

---

## 📊 РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ

**Архитектура контрактов**
- Один источник правды по минтам: убрать `food/wood/stone/seeds/water/potato_mint` из `Config`, оставить `MaterialMints` (добавить туда food/wood/stone/potato). Сейчас три места (`Config`, `MaterialMints`, `AllowedMint` в БД) и `mint_for_kind` продублирован в двух файлах.
- Вынести ленивый реген энергии (4 идентичных блока в `plant_seeds/harvest_wheat/start_milling/start_baking`) в `impl EnergyAccount { fn regen(&mut self, now) }`.
- Баффы флаконов — одно поле в `Player` (или отдельный `PlayerBuffs`), а не в 12 аккаунтах.
- Заменить прямое `try_borrow_mut_lamports` на аккаунтах с данными (offer/auction/lottery/craft_order) на единый хелпер с проверкой rent-exempt после списания.
- `burn_tool` и `burn_nft` — дубли (разница только в `close = user`); оставить `burn_nft`.
- Все permissionless-инструкции (`weather_crank`, `match_resource_orders`, `auction_settle`, `rental_end`) — задокументировать, кто платит газ и как это будет кранкаться в проде.
- Экономические числа (`REPAIR_*`, `CRAFT_*`, `TRIP_COST_*`, `PACK_*`, `ENCHANT_*`, `LOTTERY_*`, `SEASON_*`) — перенести из `constants.rs` в настраиваемые PDA (`CraftEconomy` уже так сделан), иначе любой баланс-патч = редеплой.

**Бэкенд**
- Типизированный Anchor-клиент (`Program<AofCore>` из `src/idl/aof_core.ts`) вместо `(program.methods as any)` — 90 % расхождений Проблемы 11 поймал бы компилятор.
- Единый `authGuard`: подпись сообщения кошельком (nonce + ttl) для всех user-роутов, `ADMIN_TOKEN` для `/admin`, `/security`, `/api-keys`, `/trust/snapshot`, `/season/xp`, `/tools/pay-out|mint`, `/inbox/create`.
- Перед `coSign` — `simulateTransaction` (модуль `security/txSimulator.ts` написан, но нигде не подключён) и allow-list программ/инструкций.
- Персистентный `secretStore` + воркер авто-reveal + on-chain `refund_expired_commit`.
- Postgres вместо SQLite; один `PrismaClient`; миграции вместо бинарного `aof.db` в git.
- Убрать `npcMerchant` из cron до появления реального ордербук-интегратора (или помечать его записи `result: "simulated"`).

**Фронтенд**
- Один wallet-провайдер (`wallet-adapter-react`), RPC/API/WS — только из `import.meta.env`.
- Убрать все `demo*/mock*` fallback'и; показывать явное состояние "контракт не инициализирован" (есть `isContractInitialized()` в `mints.ts`, но не используется).
- Единый хук `useTx()` с toast об ошибках вместо `.catch(() => {})`.

**Тесты**
- `tests/aof_core.ts` (245 строк) покрывает только init/mint/stake. Нужны: bankrun/`solana-program-test` сценарии на каждую из Проблем 3, 4, 5, 7, 9 (regression), property-тест на `weighted_pick` (сумма bps), тест `space` через `INIT_SPACE`.
- Бэкенд: supertest на каждый роут против localnet с проверкой, что `program.methods.X.accounts({...})` собирается без ошибок (это бы поймало все 12 расхождений).

---

## 🗑️ СПИСОК НА УДАЛЕНИЕ

Проверено: ни один из файлов ниже не импортируется/не запускается из актуального кода (Vite-frontend, aof_backend, aof-core). Перед удалением — `git rm`, коммит отдельно.

**Корень репо (legacy Ronin/Firebase-эпоха):**
- `functions/index.js` (471 KB, ethers/Ronin), `functions/index.solana.js` (103 KB, Firebase Functions, дублирует aof_backend), `functions/package.json`, `functions/.eslintrc.js`, `firebase.json`, `.firebaserc`, `netlify.toml`, `config-overrides.js` — причина: проект переехал на Express + Vite; Firebase не используется.
- `package.json`/`package-lock.json` (корень, 1.4 MB: CRA, react-scripts, ethers, firebase, openai) + `node_modules/` (633 MB) — причина: это зависимости старого CRA-фронта; актуальный фронт в `frontend/`. Оставить в корне только `Anchor.toml/Cargo.toml` и dev-deps для `tests/` (перенести в `tests/package.json`, он уже есть).
- `openrouter.js`, `extract.js`, `extract_smart.js`, `build.sh`, `build2.sh`, `build3.sh` — причина: скрипты LLM-кодогенерации через OpenRouter; в `.env` корня лежит `OPENROUTER_API_KEY` → удалить и ротировать ключ.
- `solCore.js`, `solana/aofClient.ts` — причина: старый TS-SDK под program ID `2dQsHg…`, импортирует `target/types/aof_core` (не существует); функционал полностью покрыт `aof_backend/src/lib/pda.ts`.
- `AOF_EXPANSION_FULL_SOURCE.md` (188 KB), `resp_idl.md`, `idl_raw.json`, `ANALYSIS.md` (устарел, 2026-08-29) — причина: дампы для промптов; заменить этим отчётом.
- `agave-v2.1.18-aarch64-macos.tar.zst` — 9 байт, содержимое "Not Found" (битая загрузка).
- `.aider.chat.history.md`, `.aider.input.history`, `.aider.tags.cache.v4/` — трекаются вопреки `.gitignore`; `git rm --cached`.
- `.claude/settings.local.json` — содержит пути другого пользователя (`/Users/zlata/...`); не должен быть в репо.
- `aof-core/src/.!22269!lib.rs` — пустой мусорный файл macOS, трекается.
- `test-ledger/` (5.8 GB) — не в git, но занимает диск; архивировать/удалить после переезда на devnet.

**aof-core:**
- `aof-core/src/instructions/use_flask.rs` — не подключён в `mod.rs`, ссылается на несуществующий `PlayerState`. Либо реализовать (через `Player`), либо удалить вместе с роутом `/tools/use-flask`.
- Аккаунты `LoveProgress`, `FortuneBoost` (state.rs) + их seeds/space — не используются ни одной инструкцией.
- `burn_tool.rs` — дубль `burn_nft.rs`.
- `programs/aof-liquidity` — целиком нефункционален (см. Важные §6); либо переписать, либо вырезать из workspace до появления реальной LP-механики.

**aof_backend:**
- `src/lib/economySimulatorV3.ts.bak.1788534935` — бэкап в исходниках.
- `src/lib/economySimulator.ts` (V1) и `economySimulatorV2.ts` — оставить только V3 (SandboxPage вызывает `/run` и `/run-v2`; переключить на `/run-v3`).
- `services/trust-worker/formula.js` — скомпилированный устаревший дубль `trustFormula.ts`.
- `src/security/txSimulator.ts` — не импортируется (лучше **подключить** в `coSign`, чем удалять).
- `src/lib/wsHub.ts` — не импортируется (индексатор поднимает свой `ws`-сервер на 8081).
- `src/routes/public/index.ts` — смонтирован, но `/api-keys/issue` открыт всем → публичный API без защиты. Либо защитить, либо убрать.
- `.env.bak` — бэкап с секретом.
- Роуты без контрактной реализации: `/resources/exchange-energy`, `/tools/use-flask`, `/forge/bow/*` (и `bowCommitPda/skinPda` в `pda.ts`), `/admin/test-grant-tools` (пустой `.accounts({})`).
- `dist/` — трекается? (в `.gitignore` есть, но проверить `git ls-files dist`).

**frontend:**
- `src/components/ActionForm.tsx` — не импортируется.
- `src/pages/economy/index.ts` — реэкспорт, импортируется как `"./pages/economy"` (ок, **не удалять**; ложное срабатывание скрипта).
- Зависимости: `axios` (0 использований, везде `fetch`), `react-router-dom` (только `BrowserRouter` в `main.tsx`, навигация своя — можно убрать), `@solana/wallet-adapter-base` (0), `@solana/spl-token` (1 файл).
- В git трекаются удалённые файлы `WalletPill.tsx`, `BuildingSprite.tsx`, `FarmTile.tsx`, `HomeDashboard.tsx`, `MintToolPage.tsx`, `README.md` — статус `D`, нужно закоммитить удаление.

---

## 💰 ЭКОНОМИЧЕСКИЙ ОТЧЁТ

**Схема эмиссии (по коду, не по ТЗ):**

| Актив | Источники (on-chain) | Стоки (burn) | Комментарий |
|---|---|---|---|
| POTATO | **нет** | **нет** | `Config.potato_mint` = default; `ResourceKind` без Potato; все "POTATO-награды" — записи в SQLite |
| WOOD/STONE | `pay_out` из vault (vault наполняется `mint_resource` authority без лимита), `explore_reveal` (2–8 шт/поход), `claim_season_reward` (level×100 WOOD, до 42 уровней = 90 300 WOOD/сезон/игрок) | craft, repair, exploration, forge, referral_upgrade, mill (stone), oven (wood), craft_recipe | комиссия 7–10 % с `mint_resource` уходит в казну **тем же ресурсом** — казна копит ресурсы, а не SOL |
| FOOD | `pay_out`, `mint_resource` | exploration (75), craft, referral_upgrade, craft_recipe | |
| WATER | `collect_well_water`: 5–20/ч на кошелёк, бесплатно, без капа | oven (3–18), craft (10–400) | **чистый фонтан**: 100 сибил-кошельков = 12–48 k WATER/сутки |
| WHEAT→FLOUR→BREAD | plant (seeds→×1.5×yield wheat), mill (6/18/40 wheat → 3/10/24 flour), oven (4/12/28 flour → 2–22 bread) | цепочка | BREAD — конечный продукт **без единого стока** (не входит ни в один рецепт/крафт) |
| SEEDS | только `pay_out` (reaper) и `mint_resource` | plant, craft, flask_green | |
| SOL (казна) | паки 0.1/0.3/1.0, forge 0.033–0.8 + protector 0.02, season pass 0.15, лотерея 30 % × 0.0008, комиссии 2.5–5 % рынков, аренда, rebirth 0.1 | — | единственная реальная выручка |
| GasTank | `deposit_gas` | craft 0.1 SOL, unstake 0.01, reroll 0.06 | `sweep_gas_fees` переводит излишек в казну ✅ |
| Инструменты (NFT) | `mint_tool` (authority, без лимита), паки, craft (N-1→N), reroll (2→1), `pack_open_reveal` | craft/reroll сжигают предыдущие | Legendary только крафтом ✅ (`odds[4]==0` проверяется) |

**Дневная эмиссия при активном майнинге (расчёт по `miningPayout.ts` и `constants.rs`):**
- Один Common-инструмент: `8 ч × 10 × 1.0 = 80` ед./сессия, ≤ 3 сессии/сутки (durability 20 → 2.5 сессии) → **~200 ед./сутки**, затем ремонт 20 ед. = 40 STONE + 60 WOOD → **чистая добыча ≈ +100 ед./сутки на Common**.
- Legendary: `20 ч × 10 × 1.8 = 360`/сессия, durability уходит за 1 сессию, ремонт 20 ед. = 900 STONE + 1400 WOOD → **Legendary убыточен**: добывает 360, ремонт стоит 2300. Формула `REPAIR_*` растёт быстрее, чем `YIELD_BPS` (1.8×) — игрок никогда не отобьёт ремонт легендарки майнингом. Нужно либо `income_multiplier()` (1/2/4/8/16 — объявлен в `state.rs`, **не используется** бэкендом), либо снизить REPAIR_LEGENDARY в ~10 раз.
- 6 жителей → максимум 6 параллельных инструментов → верхняя граница на игрока ≈ 1 200 ед./сутки (Common) при нулевом ремонте.
- Сценарии (WOOD+STONE суммарно, при 6 Common на игрока, 50 % времени активности):

| Игроков | Эмиссия/сутки | Стоки/сутки (ремонт + 1 крафт Uncommon/10 игроков) | Нетто |
|---|---|---|---|
| 100 | ~60 k | ~35 k | +25 k (+~40 %/сутки к обороту) |
| 1 000 | ~600 k | ~350 k | +250 k |
| 10 000 | ~6 M | ~3.5 M | +2.5 M |

Bonding-curve крафта (`CRAFT_*_MULT`: 1/2/10/50 за каждый скрафченный) — единственный масштабируемый сток; при 10 k игроков цена Epic после 100 крафтов = 500 + 100×10 = 1 500 WOOD — это всего 1.5 дня добычи, кривая слишком пологая для Rare/Epic и слишком крутая для Legendary (2 000 + n×50).

**Инфляция POTATO при 1 000 игроков:** не считается — эмиссии нет. Если подключить `daily.ts` (50–500/день) + квесты (30–150) + drum (10–500 за 5): ≈ 300 POTATO/игрок/сутки → 300 k/сутки при нулевом стоке (`potato_base` крафта 10–500, но craft сломан). Симулятор V3 при `dailyMint = 50 000` на 1 000 агентов даёт +1 500 % за 300 дней — и это в 6 раз **меньше** реальной эмиссии по коду.

**Обнаруженные экономические эксплойты:**
1. Orderbook: кража SOL из чужих buy-ордеров (Крит. 3).
2. Hot-market: бесплатная покупка (Крит. 4) + продавцы не получают оплату.
3. Repair/Exploration с поддельными WOOD/MEAT (Крит. 5).
4. Trust tier 5 самоназначением → лимит session-key 100 SOL (Крит. 7).
5. Бесконечная вода без стоимости → продажа за SOL в ордербуке.
6. `inbox/create` открыт → любой создаёт себе письмо `rewardAmount: 10^12 WOOD` и клеймит через `mint_resource` (авторити подпишет).
7. `/tools/pay-out` открыт → перевод любого ресурса из vault на любой ATA.
8. Drum: сервер знает исход до коммита.
9. `achievement_unlock`/`challenge_contribute` без стоимости → накрутка лидерборда/меркл-снапшотов.
10. Самореферал.

**Рекомендации по экономике:**
- Ввести POTATO on-chain: `mint_potato` только через authority с суточным капом в PDA (`EmissionBudget { day_id, minted_today, cap }`), стоки: craft (`potato_base`), skip в hot-market, drum-спины, аренда.
- Сделать WATER платной по энергии или ограничить буфер колодца (24 ч).
- Дать BREAD сток: FOOD = BREAD + MEAT (как в симуляторе V3) или energy refill.
- Использовать `income_multiplier()` в `calculatePayoutAmount`, пересчитать `REPAIR_*` так, чтобы окупаемость ремонта была 30–50 % от добычи сессии на всех редкостях.
- `MINT_FEE_*` должен уходить в казну **в SOL или POTATO**, а не в ресурсе — иначе казна становится крупнейшим держателем WOOD/STONE и рано или поздно продавцом.
- Ограничить `claim_season_reward` не константой `level×100`, а таблицей наград в `Season`.

---

## 🔢 МАТЕМАТИЧЕСКАЯ ВАЛИДАЦИЯ (Часть 4)

- `weighted_pick` (`randomness.rs`): корректен при сумме весов 10 000; `init_pack_config` и `init_reroll_config` валидируют сумму ✅. `reroll` odds не запрещают Legendary (в паках запрещён) — намеренно?
- Паки (ожидание по `PACK_*_ODDS_BPS`): Small: Common 60 %/Uncommon 32 %/Rare 7 %/Epic 1 %; Medium: 50/35/10/5; Big: 35/40/15/10. При цене 0.1/0.3/1.0 SOL — "стоимость Epic" 10 SOL/3.3 SOL/10 SOL... **Big-пак хуже Medium по Epic за SOL** (Medium: 0.3/0.05 = 6 SOL за ожидаемый Epic; Big: 1.0/0.10 = 10 SOL). Пересмотреть Big.
- Forge: P(успех) 100/90/75/55/35 %, полная потеря 0/2/5/10/20 %. Ожидаемая стоимость довести слот до 5: ≈ 4.3 SOL + ~15 k WOOD/STONE при 1 SOL=$100 — это $430 за +1 слот; сравнить с доходом инструмента (ремонт легендарки убыточен, см. выше) → никто не будет форжить.
- Лотерея: пул 70 %, дом 30 % — ожидание игрока −30 % (норма для лотерей, но `LOTTERY_TICKET_PRICE_LAMPORTS = 800 000` = $0.08 при комментарии "$0.8"; дневной кап не enforce'ится).
- Rental: `total_fee = price_per_hour × duration / 3600` ✅; `owner_split_bps ≤ 10000` ✅.
- Auction anti-snipe: продление до `now + 5 мин` (а не `end + 5`) ✅.
- `pick_fee_bps`: `span = max-min`, `% (span+1)` ✅ равномерно.
- `vrgda_price`: `delta_hours = min(|Δ|, 72 ч)/3600` — при `MAX_DECAY_HOURS = 72` (в секундах это 72 **секунды**, а не часов!) `delta_seconds.abs().min(72) / 3600 = 0` → **затухание и рост никогда не применяются**, цена = base × growth^purchases × hot. Исправить: `.min(72 * 3600)`.
- `LpPool::share_price` при `total_shares == 0` = 1e9 → округление депозита вниз до кратного 1 маскота; при выводе `shares × price` — потеря дробной части у пользователей.
- `trustFormula`: сумма максимумов = 1 100 > 1 000 (кап), тиры 200/400/600/800 — ок; `privileges.ts:29` считает тир по шкале 30/50/70/90 из score 0–1000 → у всех тир 5 (score ≥ 90). Рассинхрон формул тиров в двух файлах.
- `weather_crank` hash: `(day × φ) >> 32 % 100` — детерминирован и **предсказуем на любой день вперёд** (это фича прогноза, но и повод для сибил-планирования сбора воды в "дождь" 15/ч vs "засуха" 0).
- Симуляторы: V1 (`/sandbox/run`, используется UI) — цены зависят от захардкоженных `supply/demandPerDay`, действия агентов не влияют на supply (фермеры "продают" в пустоту: SOL появляется из воздуха → `agent.profit` растёт без контрагента). V3 честнее, но: POTATO только минтится (`potatoSupply += dailyMint`), сток отсутствует; энергия 25/день vs игра 48/день; крафт-дерево (hoe/pickaxe/sword, iron/gold/crystal) не соответствует игре (axe/pick/spear/bow/reaper × 5 редкостей); миссии платят SOL (в игре нет SOL-наград). Вывод: симулятор моделирует **другую игру**; для решений по балансу непригоден до синхронизации с `constants.rs`. Предложение: генерировать конфиг симулятора из IDL/constants (единый JSON), добавить контрагентов в торговлю (ордербук с реальным clearing), стоки POTATO.

---

## 🎯 МАРКЕТИНГОВЫЕ РЕКОМЕНДАЦИИ (Часть 5)

**Путь игрока (как есть):** кошелёк → `OnboardingWizard` (5 шагов, DB) → ферма (пустая: минты не инициализированы) → "откройте первый пак" → нужен SOL в кошельке (0.1) + `prep-mint` (authority платит rent) → пак → инструмент → майнинг 8 ч → `pay_out` (сервер) → крафт (сломан) → рынок.
**Точки оттока:** (1) отсутствие "free-to-start": первый инструмент только за 0.1 SOL — нет стартового Common (у Ronin-версии был `mint_tool` бесплатно?); (2) 8-часовое первое ожидание без промежуточной награды; (3) ремонт легендарки убыточен → верхняя цель разочаровывает; (4) неясно, что такое POTATO, пока он не существует.

**Что работает:** streak с джекпотом 7-го дня, comeback-тиры 3/7/30, инбокс с наградами, компендиум 25/50/75/100 %, соседи (5 визитов/день, полив раз в час), гильдии/территории, сезонный пасс 42 дня, whale-alerts/лента сделок, Trust Index как статус — набор крючков богатый, но большинство даёт **нулевую** реальную награду (TODO в `daily.ts`, `friend.ts`, `quests.ts`).
**Что добавить:** бесплатный стартовый Common-инструмент + 24 ч "ускоренного" майнинга (2 ч сессии) для D1-retention; первый крафт Uncommon за ресурсы онбординга (D3); пуш "урожай готов" (push-worker — заглушка); реферальная витрина с реальным сплитом (`pay_out_with_referral` уже честный, не инфляционный ✅).
**Что убрать/спрятать до готовности:** барабан (симуляция), флаконный маркет (alert), LP-пул, Farm-Trader (симуляция), NPC-торговец, лидерборд по несуществующим медалям.
**Конкуренты:** Pixels — energy + land + быстрая петля 5–15 мин; Sunflower Land — детерминированный оффчейн-стейт с периодическими on-chain синками (дешёво и без 8-часовых ожиданий); Big Time — косметика/время как монетизация без инфляционного токена. Дифференциаторы AoF, которые реально есть в коде: честный commit-reveal через SlotHashes (паки/reroll/exploration), VRGDA hot-market, аренда через `operator` без трансфера NFT, Trust Index с on-chain снапшотом для лимитов бота. Это стоит вынести в позиционирование ("provably fair", "rent your tools without giving them away").

---

## ✅ ЧЕКЛИСТ ДЛЯ ПРОДАКШЕНА

- [ ] Проверено: размеры всех аккаунтов = `8 + INIT_SPACE` (тест в CI)
- [ ] Проверено: `declare_id` == `target/deploy/*-keypair` == `Anchor.toml` == `aof_backend/.env` == frontend
- [ ] Исправлено: Крит. 3, 4, 5, 7, 9 в контрактах + regression-тесты
- [ ] Исправлено: `hot_market` платит продавцу; `init_pool`/`quest_init`/`challenge_init` — authority-only
- [ ] Исправлено: `drum_reveal` использует slot-hash
- [ ] Исправлено: `vrgda_price` `MAX_DECAY_HOURS` в секундах
- [ ] Исправлено: `weather_crank` пишет `bump`
- [ ] Ротирован authority-ключ; `.env`/`.env.bak`/`node_modules` удалены из git-истории aof_backend; OPENROUTER-ключ ротирован
- [ ] Бэкенд: auth на admin/authority-роутах; подпись кошелька на user-роутах
- [ ] Бэкенд: все роуты собирают инструкции без ошибок против localnet (supertest)
- [ ] Бэкенд: персистентный secretStore + авто-reveal + on-chain refund
- [ ] Бэкенд: Postgres, один PrismaClient, `NODE_ENV=production`, stack не отдаётся
- [ ] Бэкенд: `simulateTransaction` перед `coSign`
- [ ] Decimals ресурсов согласованы между `setup_devnet.sh`, `miningPayout.ts`, `constants.rs`
- [ ] POTATO: минт с капом, стоки, `set_resource_mints` расширен
- [ ] Фронт: один wallet-провайдер, env-конфиг RPC/API/WS, моки удалены
- [ ] Деплой на devnet всех 5 программ (нужно ~13 SOL; на `2gm8…` сейчас 4.13 SOL), инициализация `Config`, `MaterialMints`, `CraftEconomy`, `RarityCounter×4`, `PackConfig×3`, `RerollConfig`, `Season 1`, `MascotConfig`, `QuestConfig`, `RebirthConfig`
- [ ] Мониторинг: `economyMonitor` читает реальные burn/mint события (парсинг логов), алерты в Telegram, метрика инфляции за 24 ч
- [ ] Rate limiting per-wallet по подписи, а не по `body.user`
- [ ] Обновлены CLAUDE.md, progress.md (заявленные "✅ Готово" блоки B/D/E/G/J/K/L не соответствуют состоянию кода)

---

## 📦 ЗАВИСИМОСТИ

- Удалить: корневой `package.json` целиком (CRA/ethers/firebase/openai/i18next/react-modal); frontend: `axios`, `@solana/wallet-adapter-base`, `react-router-dom` (после отказа от `BrowserRouter`); backend: `socket.io` (wsHub не используется), `ws` только в индексаторе (перенести в `services/package.json`).
- Обновить: `@solana/web3.js` 1.95→1.98 (единая версия в backend/frontend/tests); `bs58` 5 vs 6 (разные мажоры в backend/root); `zod` ^4 (проверить `safeParse().error.issues` API); `express-rate-limit` ^8 (`max` → `limit` deprecated); `@coral-xyz/anchor` 0.30.1 ↔ Anchor CLI 0.30.1 ✅; `anchor-lang` фича `init-if-needed` включена — ок, но каждый `init_if_needed` (17 мест) должен иметь явную инициализацию полей при `owner == default` (проверено: `energy/farm_tile/mill/oven/well/exploration/referrer_stats/season_pass/player/rebirth_record` — ок; `gastank` в `DepositGas` — ok; `WeatherCrank` — bump не пишется ❌).
- Добавить: `supertest` + `vitest` (backend), `solana-bankrun`/`anchor-bankrun` (контракты), `pino-pretty` (dev), `helmet`, `express-validator`/расширить zod-схемы на все роуты (сейчас `validate()` только на 6 роутах из 200+), `@types/ws`.

---

## 🚀 ПЛАН ДЕЙСТВИЙ

### Этап 1: Критические исправления (1–2 дня)
1. `constants.rs` → `8 + INIT_SPACE`, убрать `buff_*` из 12 аккаунтов, `weather.bump`.
2. Единый program ID; `anchor build`; `sync-idl` в бэкенд.
3. Крит. 3 (orderbook), 4 (hot-market treasury + выплата продавцу), 5 (repair/exploration mints), 7 (trust oracle), 9 (auction mut), `vrgda MAX_DECAY_HOURS`.
4. Ротация ключей, чистка git-истории aof_backend, `git rm --cached` мусора в корне.
5. Persist secretStore.
6. Деплой на localnet + прогон `tests/aof_core.ts` + новые regression-тесты.

### Этап 2: Важные улучшения (3–5 дней)
1. Auth-слой бэкенда (admin token + wallet-signature), `simulateTransaction` в `coSign`.
2. Починить 12 расхождений роут↔IDL; типизированный Anchor-клиент; supertest на все роуты.
3. POTATO on-chain (сеттер + mint с капом + стоки), decimals-единообразие.
4. `quest_claim_reward` через PDA-подпись казны + инструкция `quest_progress_set` (authority); `init_pool/quest_init/challenge_init` authority-only; drum slot-hash.
5. Убрать моки во фронте, один wallet-провайдер, env-конфиг.

### Этап 3: Оптимизация (1–2 недели)
1. Postgres + миграции; один PrismaClient; индексы под `AuditLog` запросы.
2. Синхронизация энергии/погоды/квестов: один источник (on-chain), DB — только кэш.
3. Балансировка: `income_multiplier`, `REPAIR_*`, кривая крафта, вода, BREAD-сток, сезонные награды в конфиг.
4. Симулятор V3 на реальных константах, удалить V1/V2.
5. Rental cancel, marketplace/offer state-checks, cancel_buy buffer refund.
6. economyMonitor на реальных событиях + Telegram-алерты.

### Этап 4: Продакшен-готовность (1 месяц)
1. Внешний аудит контрактов после Этапов 1–2 (OtterSec/Sec3/Neodyme).
2. Bankrun-тесты на все 83 инструкции, fuzz на `weighted_pick`/`vrgda_price`.
3. Devnet-бета с реальными игроками 2 недели, метрики D1/D7, инфляция по ресурсам.
4. VRF (Switchboard) вместо SlotHashes для паков ≥ 1 SOL (окно 512 слотов слишком узкое для продакшн-ревилов).
5. Mainnet: multisig authority (Squads), upgrade authority на multisig, `set_paused` runbook, circuit breaker с алертом.

---

## 💡 ДЛЯ СЛЕДУЮЩЕГО AI

**Структура проекта:**
```
aof_gui/
├── aof-core/            Anchor-программа (83 ix): lib.rs = все #[derive(Accounts)] + #[program];
│   └── src/instructions/*.rs — по одному handler на инструкцию; state.rs, constants.rs, errors.rs, events.rs, randomness.rs
├── programs/aof-market   hot-market VRGDA + session keys + trust snapshot (не задеплоена)
├── programs/aof-quests   квесты/достижения/челленджи/барабан (не задеплоена, claim сломан)
├── programs/aof-rebirth  ребёрт (работает, самая чистая программа)
├── programs/aof-liquidity LP (нефункциональна)
├── aof_backend/  (git-сабмодуль!) Express + Prisma(SQLite); src/routes/*.ts — 62 роута; src/lib/pda.ts — все PDA;
│   src/lib/tx.ts — coSign/authorityOnly; src/idl/*.json — копии IDL (устаревшие); services/* — 5 воркеров
├── frontend/     Vite + React 18 + zustand + framer-motion; src/lib/api.ts — весь REST-клиент; src/nav — своя навигация
├── tests/aof_core.ts    mocha, 245 строк
├── target/idl/*.json    актуальные IDL (2026-09-04); target/deploy/*.so + keypairs
└── solana/keys/*.json   authority devnet 2gm8… (4.13 SOL), НЕ в git
```

**Ключевые файлы:** `aof-core/src/lib.rs`, `aof-core/src/constants.rs`, `aof-core/src/state.rs`, `aof_backend/src/lib/pda.ts`, `aof_backend/src/lib/tx.ts`, `aof_backend/src/server.ts`, `aof_backend/prisma/schema.prisma`, `frontend/src/lib/api.ts`, `frontend/src/lib/txFlow.ts`, `setup_devnet.sh`, `CLAUDE.md`.

**Принятые решения (из кода/комментариев, соблюдать):**
- Co-sign паттерн: сервер строит tx → клиент подписывает → (должна быть) верификация; authority-only для reveal/pay_out.
- Честный рандом: `randomness.rs` (sha256(secret ‖ slot_hash ‖ tag)), не менять на `Math.random`/on-chain clock.
- Реферальный бонус — сплит одной выплаты, не доп. эмиссия.
- Комиссии в micros (1 SOL = 1e6), `MICROS_TO_LAMPORTS = 1000`.
- Legendary из паков не выпадает.
- Аренда через `ToolData.operator`, владение не меняется.
- `Config` — singleton PDA `["config"]`; все админ-инструкции `has_one = authority`.
- Инструменты — SPL-минты с 0 decimals, mint authority = `auth` PDA; ресурсы — SPL с 9 decimals (см. decimals-конфликт выше).

**Что НЕ трогать:**
- `solana-program = 1.18.27` пиннинг, toolchain (см. CLAUDE.md), `anchor clean`, `--reset` валидатора.
- `randomness.rs` логику и commit-reveal схему.
- `test-ledger/` (5.8 GB, локальный стейт).
- `solana/keys/*` — не коммитить.
- `aof_backend` — отдельный git; коммиты внутри него, потом bump указателя в корне.

**Ограничения среды:** в shell аудитора не было `node`/`npx` (проверить `nvm`/homebrew перед запуском tsc/vite); `anchor build` ~10 мин; devnet-баланс authority 4.13 SOL (нужно ~13 для 5 программ); публичный devnet RPC ограничен (в `initMintsV2.ts` есть retry под Helius).

**С чего начать следующему:** Этап 1 пункты 1–3 — они блокируют всё остальное; после них `anchor test` на localnet покажет реальное состояние, и большинство "✅ Готово" в `progress.md` можно будет проверить по-настоящему.
