# GAME_INVENTORY.md — NeuroForge: ресурсы, инструменты и механики (по коду)

> **Ребрендинг 2026-09-24:** проект переименован в **NeuroForge — Age of Intelligence** (тема — ИИ и развитие).
> Механики, числа экономики, PDA, адреса и enum-дискриминанты **не менялись**; см. `REBRAND_MAP.md`.
> Legacy-идентификаторы инструментов (axe/pick/spear/bow/reaper) принимаются он-чейн как алиасы.


Составлено 2026-09-24 по коду репозитория (ветка `arena/01a0d008-aof`).
Источники: `aof-core/src/{lib.rs,constants.rs,state.rs,instructions/*}`,
`programs/aof-{market,quests,rebirth,liquidity,session-keys}`, `aof_backend/`.
Все числа — константы из `aof-core/src/constants.rs` (если не указано иное).

---

## 1. Инструменты (NFT)

5 типов; из паков выпадают только plasma_cutter/silicon_extractor/data_harvester (quantum_transmitter и neural_seeder — только крафт).

| Тип | Ресурс (добыча) | Часы захода C/U/R/E/L | Yield × (bps) | Из пака |
|---|---|---|---|---|
| `plasma_cutter` | CIRCUIT | 8 / 12 / 14 / 20 / 20 | ×1.00 / 1.15 / 1.30 / 1.50 / 1.80 | да |
| `silicon_extractor` | SILICON | 8 / 12 / 14 / 20 / 20 | то же | да |
| `data_harvester` | DATASET (охота) | 8 / 12 / 14 / 20 / 20 | то же | да |
| `quantum_transmitter` | DATASET (охота) | 8 / 12 / 14 / 20 / 20 | то же | **нет** |
| `neural_seeder` | NEURON | 8 / 12 / 14 / 20 / 20 | то же | **нет** |

C/U/R/E/L = Base / Enhanced / Quantum / Singularity / Transcendent.
Маппинг инструмента→ресурс: `aof-core/src/instructions/collect_mining.rs` (`resource_kind_for_tool`).

Свойства и lifecycle:

| Свойство | Значение | Где |
|---|---|---|
| Прочность | макс. **20** (`MAX_DURABILITY`) | `repair` — ремонт CIRCUIT+SILICON за 1 юнит |
| Ремонт за юнит (CIRCUIT / SILICON) | 3.0/3.5 / 2.0/2.5 → 5.0/3.5 по редкости (кривая F-08: нетто-маржа растёт с редкостью) | `REPAIR_CIRCUIT_*/REPAIR_SILICON_*` |
| Слоты зачарования | 0=Speed, 1=Durability, 2=EnergyEfficiency | `enchant_slot` PDA |
| Стейкинг | перки из счётчиков Player-PDA: `historian_count`, `medallion_count` | `stake`/`unstake` |
| Mint / сжигание / миграция | `mint_tool`, `burn_tool`, `migrate_tool` | aof-core |

Yield-таблица (net-маржа по F-08): Base +12 CIRCUIT/ч и +18 SILICON/ч → Transcendent +24 / +33.

---

## 2. Ресурсы (27 видов, `RESOURCE_KIND_COUNT = 27`)

1 «ресурс-юнит» = `RESOURCE_UNIT = 1 000 000 000` (9 decimals).
Эмиссия каждого вида ограничена **issuance cap** (PDA `issuance_cap`, лимит на epoch,
epoch = 1 500 … 6 480 000 слотов) + одноразовые начисления `mint_resource_once`
(reward-receipt по reward_id, replay-safe).

| Ресурс | Группа | Источник | Траты / куда уходит |
|---|---|---|---|
| Data | базовые | эмиссия: админ/инбокс-награды (`mint_resource`) | крафт флюидов (р. 3, 6 — по 5), общий |
| Circuit | базовые | `plasma_cutter` (mining), exploration (reward) | ремонт, топливо тренажёра (р. `start_baking`), bio fluid (×5), крафт инструментов |
| Silicon | базовые | `silicon_extractor` (mining), exploration | ремонт, volt fluid (×3), крафт инструментов |
| Neuron | модельная цепочка | `neural_seeder` (mining) | посев (`plant_seeds`), bio fluid (×5) |
| Synapse | модельная цепочка | `plant_seeds` (neuron+power, energy 1) → `harvest_wheat` (×1.5 от посева, energy 1) | переработка (`start_milling`) |
| Signal | модельная цепочка | `start_milling`/`collect_flour` (energy 2) | тренировка (`start_baking`) |
| Model | модельная цепочка | `start_baking`/`collect_bread` (signal + топливо CIRCUIT или Compute, energy 2) | готовая модель — конечный продукт игрока |
| Power | базовые | **сетевая станция** `collect_well_water`: ставка по нагрузке 0 / 5 / 15 / 20 юнитов·ч (blackout/nominal/surge/frenzy), накопление до 24 ч | посев, крафт |
| Compute | базовые | эмиссия: награды | топливо тренажёра (альтернатива CIRCUIT) |
| Dataset | базовые | `quantum_transmitter` / `data_harvester` (охота) | крафт / датасеты |
| BlueCore | ядра | эмиссия / дропы | рецепт 0 → QuantumBit (1:1) |
| PurpleCore | ядра | эмиссия / дропы | рецепт 7 → QuantumFluid |
| RedCore | ядра | эмиссия / дропы | рецепт 1 → NeuralChip (1:1) |
| ClearQuartz | кварц | эмиссия / дропы | рецепт 2 → PhotonBit (1:1) |
| RoseQuartz | кварц | эмиссия / дропы | рецепт 6 → NanoFluid (×5) |
| AmberQuartz | кварц | эмиссия / дропы | (резерв, рецептов нет) |
| QuantumBit | чипы | рецепт 0 (1 BlueCore) | рецепт 3 (×2) → CryoFluid |
| NeuralChip | чипы | рецепт 1 (1 RedCore) | рецепт 4 (×2) → VoltFluid |
| PhotonBit | чипы | рецепт 2 (1 ClearQuartz) | (резерв) |
| BioChip | чипы | эмиссия / дропы | рецепт 7 → QuantumFluid |
| CryoFluid | флюиды | рецепт 3: 2 QuantumBit + 5 Data | утилити/прогрессия |
| VoltFluid | флюиды | рецепт 4: 2 NeuralChip + 3 Silicon | утилити/прогрессия |
| BioFluid | флюиды | рецепт 5: 5 Circuit + 5 Neuron | утилити/прогрессия |
| NanoFluid | флюиды | рецепт 6: 5 RoseQuartz + 5 Data | утилити/прогрессия |
| QuantumFluid | флюиды | рецепт 7: 1 PurpleCore + 1 BioChip | утилити/прогрессия |
| SoulCore | особое | эмиссия (специальные события) | особое |
| MIND | утилити | бэкенд-награды (`mint_resource`, `RESOURCE_KIND_BY_NAME.MIND`) | утилити-валюта (SKR-скидка 15% на MIND при балансе ≥ 3000 SKR) |

Цепочки:
- **Модельная цепочка:** Neuron (+Power) → Synapse (×1.5) → Signal → Model (топливо CIRCUIT/Compute).
- **Чипы/флюиды:** цветные ядра/кварц → чипы (рецепты 0–2) → флюиды (рецепты 3–7), `craft_recipe` (мгновенный, 1:1-конверсии с бонусами).

---

## 3. Экономика: лимиты и комиссии

| Параметр | Значение | Где |
|---|---|---|
| Выдача ресурсов | per-kind issuance cap на epoch (1 500 … 6 480 000 слотов) | `issuance_cap` PDA, `set_issuance_cap` |
| Vault guard (вывод authority) | `cap_per_epoch` + `max_per_tx` (с 2026-09-24 `0` отклоняется — AOF-M2); тормоз = `cap_per_epoch=0` | `pay_out` / `init/set_vault_guard` |
| Комиссия крафта | 0.1 SOL (`FEE_PER_CRAFT_MICROS=100 000`) | aof-core |
| Комиссия NFT / пака | 0.01 SOL | `FEE_PER_NFT/PACK_MICROS=10 000` |
| Комиссия reroll | 0.06 SOL | `FEE_PER_REROLL_MICROS=60 000` |
| Крафт-экономика | bonding curve: `CRAFT_<res>_BASE/MULT[4]` по редкости (Enhanced…Transcendent), 6 ресурсов; меняется `set_craft_economy` без редеплоя | `CraftEconomy` |
| SKR-бонус | ≥ 3000 SKR → −15% на MIND | `SKR_MIN_BALANCE`, `SKR_CRAFT_DISCOUNT_BPS=1500` |

---

## 4. Механики

### 4.1 Нейро-лаборатория и энергия (aof-core)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| Энергия | ленивая реген, трата по действиям | кап **20**, **+1 / 30 мин**; цены: plant 1, harvest 1, milling 2, training 2 |
| Посев / сбор | `plant_seeds` (тайл, neuron+power) → `harvest_wheat` | yield **×1.5** от посева (`SYNAPSE_YIELD_MULT_BPS`) |
| Переработка / тренировка | `start_milling`/`collect_flour`, `start_baking`/`collect_bread` | топливо: CIRCUIT или Compute |
| Сетевая станция | накопление по нагрузке сети | 0 / 5 / 15 / 20 юнитов·ч, макс. накопление **24 ч** |
| Нагрузка сети | `weather_crank` | 4 состояния: Blackout / Nominal / Surge / Frenzy |
| Агенты | villagers + ёмкость хранилища | дефолт **6** агентов; `adjust_player_capacity` (дельта ≤ ±6, с server rack больше) |

### 4.2 Добыча (aof-core)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| Mining | `start_mining` (инструмент, N часов) → `collect_mining` | часы по редкости (8…20), yield ×1.0…×1.8; kill-switch `mining_enabled` **он-чейн** (F-27) |

### 4.3 Крафт (aof-core)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| `craft` | крафт инструмента NFT (tool_type + rarity), цена = bonding curve по 6 ресурсам | base/mult по редкости (Enhanced…Transcendent) |
| `craft_recipe` | 8 рецептов чипы/флюиды (см. §2) | мгновенный, с supply-cap на выход |
| `craft_order` | крафт-под-заказ: create / fulfill / cancel | ордера на крафт |

### 4.4 Лут и RNG (всё commit-reveal, secret 32 байта)

| Механика | Как работает | Ключевые числа |
|---|---|---|
| Капсулы дропа | 3 капсулы, выпадают plasma_cutter/silicon_extractor/data_harvester, Transcendent — никогда (только крафт) | 0.1 / 0.3 / 1.0 SOL; шансы bps: small 60/32/7/1/0, medium 50/35/10/5/0, big 35/40/15/10/0 |
| Reroll | честный ре-ролл редкости инструмента | таблица 55/30/11/4/0 % (настраивается), fee 0.06 SOL |
| Квантовая кузница `forge` | commit / reveal / expire | ставка на редкость |
| Deep Learning (экскурсия) | start/reveal, тир | награда CIRCUIT+SILICON; тир даёт перки (+5%/+2% с медальоном) |
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
| Пасс эпохи | aof-core | **42 дня**, **42 уровня**, 1000 XP/уровень, награда 100 юнитов/уровень; premium **0.15 SOL** |
| Quantum Draw | aof-core | билет **0.0008 SOL**, 70% пул / 30% дев, раунд до **14 дн**, commit-reveal розыгрыш, refund |
| Рефералы | aof-core | link + stats, капы **25/5** (с медальоном больше) |
| Re-Training | program `aof-rebirth` | стоимость, cooldown, бонус bps за каждый цикл, капы (max_bonus_bps, max_rebirths) |
| Compute Tank (DePIN-газ) | aof-core | deposit/withdraw, cooldown **12 ч**, мгновенный вывод за **0.2 SOL**, `sweep_gas_fees` |
| Archivists (стейкинг NFT) | aof-core | по CollectorKind, лок **3 дня**, register/revoke mint |

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

- **5 типов инструментов** (plasma_cutter, silicon_extractor, data_harvester, quantum_transmitter, neural_seeder), 5 редкостей (Base…Transcendent), прочность 20, 3 слота зачарования, стейкинг-перки.
- **27 ресурсов**: 3 базовых + модельная цепочка (4) + power/compute/dataset + 3 цветных ядра + 3 кварца + 4 чипа + 5 флюидов + SoulCore + MIND.
- **24+ игровые механики**: нейро-лаборатория с нагрузкой сети и энергией, добыча компонентов, 3 вида крафта, 4 RNG-механики (капсулы/reroll/кузница/deep learning + drum), 6 рыночных (marketplace/offers/аукционы/аренда/ордербук/hot-market), квесты/challenges/achievements, эпоха 42 дня, quantum draw, рефералы, re-training, compute tank, archivists.
- **Ограничения эмиссии** — везде он-чейн: issuance cap по ресурсам, vault guard по vault, supply-cap на выходе рецептов, одноразовые reward-receipt.
