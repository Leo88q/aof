# GAME_INVENTORY.md — AOF: ресурсы, инструменты и механики (по коду)

Составлено 2026-09-24 по коду репозитория (ветка `arena/01a0d008-aof`).
Источники: `aof-core/src/{lib.rs,constants.rs,state.rs,instructions/*}`,
`programs/aof-{market,quests,rebirth,liquidity,session-keys}`, `aof_backend/`.
Все числа — константы из `aof-core/src/constants.rs` (если не указано иное).

---

## 1. Инструменты (NFT)

5 типов; из паков выпадают только axe/pick/spear (bow и reaper — только крафт).

| Тип | Ресурс (добыча) | Часы захода C/U/R/E/L | Yield × (bps) | Из пака |
|---|---|---|---|---|
| `axe` | WOOD | 8 / 12 / 14 / 20 / 20 | ×1.00 / 1.15 / 1.30 / 1.50 / 1.80 | да |
| `pick` | STONE | 8 / 12 / 14 / 20 / 20 | то же | да |
| `spear` | MEAT (охота) | 8 / 12 / 14 / 20 / 20 | то же | да |
| `bow` | MEAT (охота) | 8 / 12 / 14 / 20 / 20 | то же | **нет** |
| `reaper` | SEEDS | 8 / 12 / 14 / 20 / 20 | то же | **нет** |

C/U/R/E/L = Common / Uncommon / Rare / Epic / Legendary.
Маппинг инструмента→ресурс: `aof-core/src/instructions/collect_mining.rs` (`resource_kind_for_tool`).

Свойства и lifecycle:

| Свойство | Значение | Где |
|---|---|---|
| Прочность | макс. **20** (`MAX_DURABILITY`) | `repair` — ремонт WOOD+STONE за 1 юнит |
| Ремонт за юнит (WOOD / STONE) | 3.0/3.5 / 2.0/2.5 → 5.0/3.5 по редкости (кривая F-08: нетто-маржа растёт с редкостью) | `REPAIR_WOOD_*/REPAIR_STONE_*` |
| Слоты зачарования | 0=Speed, 1=Durability, 2=EnergyEfficiency | `enchant_slot` PDA |
| Стейкинг | перки из счётчиков Player-PDA: `historian_count`, `medallion_count` | `stake`/`unstake` |
| Mint / сжигание / миграция | `mint_tool`, `burn_tool`, `migrate_tool` | aof-core |

Yield-таблица (net-маржа по F-08): Common +12 WOOD/ч и +18 STONE/ч → Legendary +24 / +33.

---

## 2. Ресурсы (27 видов, `RESOURCE_KIND_COUNT = 27`)

1 «ресурс-юнит» = `RESOURCE_UNIT = 1 000 000 000` (9 decimals).
Эмиссия каждого вида ограничена **issuance cap** (PDA `issuance_cap`, лимит на epoch,
epoch = 1 500 … 6 480 000 слотов) + одноразовые начисления `mint_resource_once`
(reward-receipt по reward_id, replay-safe).

| Ресурс | Группа | Источник | Траты / куда уходит |
|---|---|---|---|
| Food | базовые | эмиссия: админ/инбокс-награды (`mint_resource`) | крафт баночек (р. 3, 6 — по 5), общий |
| Wood | базовые | `axe` (mining), exploration (reward) | ремонт, топливо печи (р. `start_baking`), flask green (×5), крафт инструментов |
| Stone | базовые | `pick` (mining), exploration | ремонт, flask yellow (×3), крафт инструментов |
| Seeds | хлебная цепочка | `reaper` (mining) | посадка (`plant_seeds`), flask green (×5) |
| Wheat | хлебная цепочка | `plant_seeds` (seeds+water, energy 1) → `harvest_wheat` (×1.5 от посева, energy 1) | молотьба (`start_milling`) |
| Flour | хлебная цепочка | `start_milling`/`collect_flour` (energy 2) | выпечка (`start_baking`) |
| Bread | хлебная цепочка | `start_baking`/`collect_bread` (flour + топливо WOOD или Coal, energy 2) | конечный продукт игрока |
| Water | базовые | **колодец** `collect_well_water`: ставка по погоде 0 / 5 / 15 / 20 юнитов·ч (засуха/солнце/дождь/фестиваль), накопление до 24 ч | посадка, крафт |
| Coal | базовые | эмиссия: награды | топливо печи (альтернатива WOOD) |
| Meat | базовые | `bow` / `spear` (охота) | крафт / пища |
| StoneBlue | камни | эмиссия / дропы | рецепт 0 → GemBlue (1:1) |
| StonePurple | камни | эмиссия / дропы | рецепт 7 → FlaskPurple |
| StoneRed | камни | эмиссия / дропы | рецепт 1 → GemOrange (1:1) |
| SandWhite | песок | эмиссия / дропы | рецепт 2 → GemWhite (1:1) |
| SandPink | песок | эмиссия / дропы | рецепт 6 → FlaskPink (×5) |
| SandYellow | песок | эмиссия / дропы | (резерв, рецептов нет) |
| GemBlue | гемы | рецепт 0 (1 StoneBlue) | рецепт 3 (×2) → FlaskBlue |
| GemOrange | гемы | рецепт 1 (1 StoneRed) | рецепт 4 (×2) → FlaskYellow |
| GemWhite | гемы | рецепт 2 (1 SandWhite) | (резерв) |
| GemGreen | гемы | эмиссия / дропы | рецепт 7 → FlaskPurple |
| FlaskBlue | баночки | рецепт 3: 2 GemBlue + 5 Food | утилити/прогрессия |
| FlaskYellow | баночки | рецепт 4: 2 GemOrange + 3 Stone | утилити/прогрессия |
| FlaskGreen | баночки | рецепт 5: 5 Wood + 5 Seeds | утилити/прогрессия |
| FlaskPink | баночки | рецепт 6: 5 SandPink + 5 Food | утилити/прогрессия |
| FlaskPurple | баночки | рецепт 7: 1 StonePurple + 1 GemGreen | утилити/прогрессия |
| LoveHeart | особое | эмиссия (специальные события) | особое |
| Potato | утилити | бэкенд-награды (`mint_resource`, `RESOURCE_KIND_BY_NAME.POTATO`) | стабильная утилити-валюта (SKR-скидка 15% на POTATO при балансе ≥ 3000 SKR) |

Цепочки:
- **Хлеб:** Seeds (+Water) → Wheat (×1.5) → Flour → Bread (топливо WOOD/Coal).
- **Гемы/баночки:** цветные камни/песок → гемы (рецепты 0–2) → баночки (рецепты 3–7), `craft_recipe` (мгновенный, 1:1-конверсии с бонусами).

---

## 3. Экономика: лимиты и комиссии

| Параметр | Значение | Где |
|---|---|---|
| Выдача ресурсов | per-kind issuance cap на epoch (1 500 … 6 480 000 слотов) | `issuance_cap` PDA, `set_issuance_cap` |
| Vault guard (вывод authority) | `cap_per_epoch` + `max_per_tx` (с 2026-09-24 `0` отклоняется — AOF-M2); тормоз = `cap_per_epoch=0` | `pay_out` / `init/set_vault_guard` |
| Комиссия крафта | 0.1 SOL (`FEE_PER_CRAFT_MICROS=100 000`) | aof-core |
| Комиссия NFT / пака | 0.01 SOL | `FEE_PER_NFT/PACK_MICROS=10 000` |
| Комиссия reroll | 0.06 SOL | `FEE_PER_REROLL_MICROS=60 000` |
| Крафт-экономика | bonding curve: `CRAFT_<res>_BASE/MULT[4]` по редкости (Uncommon…Legendary), 6 ресурсов; меняется `set_craft_economy` без редеплоя | `CraftEconomy` |
| SKR-бонус | ≥ 3000 SKR → −15% на POTATO | `SKR_MIN_BALANCE`, `SKR_CRAFT_DISCOUNT_BPS=1500` |

---

## 4. Механики

### 4.1 Ферма и энергия (aof-core)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| Энергия | ленивая реген, трата по действиям | кап **20**, **+1 / 30 мин**; цены: plant 1, harvest 1, mill 2, oven 2 |
| Посадка / урожай | `plant_seeds` (тайл, seeds+water) → `harvest_wheat` | yield **×1.5** от посева (`WHEAT_YIELD_MULT_BPS`) |
| Молотьба / выпечка | `start_milling`/`collect_flour`, `start_baking`/`collect_bread` | топливо: WOOD или Coal |
| Колодец | накопление по погоде | 0 / 5 / 15 / 20 юнитов·ч, макс. накопление **24 ч** |
| Погода | `weather_crank` | 4 состояния: Drought / Sunny / Rain / Festival |
| Деревня | villagers + ёмкость хранилища | дефолт **6** жителей; `adjust_player_capacity` (дельта ≤ ±6, с tent больше) |

### 4.2 Добыча (aof-core)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| Mining | `start_mining` (инструмент, N часов) → `collect_mining` | часы по редкости (8…20), yield ×1.0…×1.8; kill-switch `mining_enabled` **он-чейн** (F-27) |

### 4.3 Крафт (aof-core)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| `craft` | крафт инструмента NFT (tool_type + rarity), цена = bonding curve по 6 ресурсам | base/mult по редкости (Uncommon…Legendary) |
| `craft_recipe` | 8 рецептов гемы/баночки (см. §2) | мгновенный, с supply-cap на выход |
| `craft_order` | крафт-под-заказ: create / fulfill / cancel | ордера на крафт |

### 4.4 Лут и RNG (всё commit-reveal, secret 32 байта)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| Паки | 3 пака, выпадают axe/pick/spear, Legendary — никогда (только крафт) | 0.1 / 0.3 / 1.0 SOL; шансы bps: small 60/32/7/1/0, medium 50/35/10/5/0, big 35/40/15/10/0 |
| Reroll | честный ре-ролл редкости инструмента | таблица 55/30/11/4/0 % (настраивается), fee 0.06 SOL |
| Кузница риска `forge` | commit / reveal / expire | ставка на редкость |
| Exploration | start/reveal, тир | награда WOOD+STONE; тир даёт перки (+5%/+2% с медальоном) |
| Drum (aof-quests) | commit / reveal с odds | «барабан» — лут-механика квестов |

### 4.5 Рынок

| Механика | Где | Ключевые числа |
|---|---|---|
| Marketplace (list/buy/cancel) | aof-core | `max_price`, expires |
| Offers (create/accept/cancel) | aof-core | офферы за NFT |
| Аукционы (create/bid/settle) | aof-core | `min_bid`, duration |
| Аренда инструментов (listing/agreement) | aof-core | fee **5%**, срок **24 ч … 30 дн**, grace на отзыв **12 ч** |
| Ордербук ресурсов (buy/sell/match) | aof-core | лимитные ордера на ресурсы |
| HOT-рынок (aof-market) | program `aof-market` | buy/sell по редкости, валюты **Core/Gem**, pool, **market events** (multiplier bps), crank/skip, лимитные ордера |

### 4.6 Прогрессия и события

| Механика | Где | Ключевые числа |
|---|---|---|
| Квесты (init/claim) | aof-quests | награда — mascot NFT (`quest_config.mascot_mint`) |
| Групповые challenges (init/contribute) | aof-quests | коллективное финансирование цели |
| Achievements (unlock) | aof-quests | разблокировки |
| Сезонный пасс | aof-core | **42 дня**, **42 уровня**, 1000 XP/уровень, награда 100 юнитов/уровень; premium **0.15 SOL** |
| Лотерея | aof-core | билет **0.0008 SOL**, 70% пул / 30% дев, раунд до **14 дн**, commit-reveal розыгрыш, refund |
| Рефералы | aof-core | link + stats, капы **25/5** (с медальоном больше) |
| Rebirth | program `aof-rebirth` | стоимость, cooldown, бонус bps за каждый rebirth, капы (max_bonus_bps, max_rebirths) |
| Gastank (DePIN-газ) | aof-core | deposit/withdraw, cooldown **12 ч**, мгновенный вывод за **0.2 SOL**, `sweep_gas_fees` |
| Collectors (стейкинг NFT) | aof-core | по CollectorKind, лок **3 дня**, register/revoke mint |

### 4.7 Инфраструктура и безопасность

| Механика | Где | Заметки |
|---|---|---|
| Session keys + trust | program `aof-session-keys` | create/revoke/pause, `check_and_spend` (ix_bit-маска), trust snapshot (score/tier/epoch); маска запрещает withdraw/transfer/payout |
| Liquidity vault | program `aof-liquidity` | vault-учёт |
| Vault guard | aof-core | лимиты вывода authority (см. §3); `pay_out` только resource-mints на существующего Player |
| Emergency stop / authority | все 6 программ | `set_paused`; `set_pending_authority`/`accept`/`cancel` (двухшаговая ротация) |
| Wallet proof (офф-чейн) | aof_backend | one-time Ed25519-подпись на мутацию + идемпотентность (409 на реплей, CAS на stale-reclaim) |
| Остальная защита бэкенда | aof_backend | rate-limit, circuit breaker, аудит-лог, fraud-сигналы, economy monitor, chain indexer |

---

## 5. Быстрая сводка

- **5 типов инструментов** (axe, pick, spear, bow, reaper), 5 редкостей, прочность 20, 3 слота зачарования, стейкинг-перки.
- **27 ресурсов**: 3 базовых + хлебная цепочка (4) + water/coal/meat + 3 цветных камня + 3 песка + 4 гема + 5 баночек + LoveHeart + Potato.
- **24+ игровые механики**: ферма с погодой и энергией, добыча, 3 вида крафта, 4 RNG-механики (паки/reroll/forge/exploration + drum), 6 рыночных (marketplace/offers/аукционы/аренда/ордербук/hot-market), квесты/challenges/achievements, сезон 42 дня, лотерея, рефералы, rebirth, gastank, collectors.
- **Ограничения эмиссии** — везде он-чейн: issuance cap по ресурсам, vault guard по vault, supply-cap на выходе рецептов, одноразовые reward-receipt.
