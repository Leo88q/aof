# REBRAND_MAP.md — AOF → NeuroForge (тема: ИИ и развитие)

Полный ребрендинг 2026-09-24. **Механики не меняются** — меняются имена
(игро-видимые и developer-видимые), картинки и копира. Эта таблица — единый
источник истины для всех замен.

## Проект

| Было | Стало |
|---|---|
| Age of Farming (AOF) | **NeuroForge — Age of Intelligence** |
| gameId / tenant_id | `aof` (НЕ меняется — RLS Postgres + интеграция с хаbem) |
| Жанр | farming crafting trading marketplace | **AI development: grow neurons, train models, trade the future** |

## Ресурсы (27)

API-ключ (camelCase, как в mints.json) → новое имя. **Адреса mint'ов на
devnet не меняются** — меняется только имя. Позиции enum-дискриминантов не
меняются (бинарно-совместимо), PDA-сиды не меняются (адреса аккаунтов те же).

| # | Было (ключ) | Стало (ключ) | Игровое имя (EN / RU) | Роль в механике (без изменений) |
|---|---|---|---|---|
| 0 | food | `data` | Data / Данные | базовый ресурс, вход в рецепты |
| 1 | wood | `circuit` | Circuit / Схема | добыча Plasma Cutter, ремонт, топливо |
| 2 | stone | `silicon` | Silicon / Кремний | добыча Silicon Extractor, ремонт |
| 3 | potato | `mind` | MIND / MIND | утилити-валюта (SKR-скидка) |
| 4 | seeds | `neuron` | Neuron / Нейрон | добыча Neural Seeder, «посев» |
| 5 | wheat | `synapse` | Synapse / Синапс | сбор ×1.5 |
| 6 | flour | `signal` | Signal / Сигнал | «молотьба» |
| 7 | bread | `model` | Model / Модель | «выпечка» → готовая модель |
| 8 | water | `power` | Power / Энергопоток | «колодец» — сетевая станция, погода |
| 9 | coal | `compute` | Compute / Вычислительный цикл | топливо печи |
| 10 | meat | `dataset` | Dataset / Датасет | добыча Data Harvester / Quantum Transmitter |
| 11 | stoneBlue | `blueCore` | Blue Core / Синее ядро | → Quantum Bit |
| 12 | stonePurple | `purpleCore` | Purple Core / Фиолетовое ядро | → Quantum Fluid |
| 13 | stoneRed | `redCore` | Red Core / Красное ядро | → Neural Chip |
| 14 | sandWhite | `clearQuartz` | Clear Quartz / Чистый кварц | → Photon Bit |
| 15 | sandPink | `roseQuartz` | Rose Quartz / Розовый кварц | → Nano Fluid |
| 16 | sandYellow | `amberQuartz` | Amber Quartz / Янтарный кварц | (резерв) |
| 17 | gemBlue | `quantumBit` | Quantum Bit / Квантовый бит | → Cryo Fluid |
| 18 | gemOrange | `neuralChip` | Neural Chip / Нейрочип | → Volt Fluid |
| 19 | gemWhite | `photonBit` | Photon Bit / Фотонный бит | (резерв) |
| 20 | gemGreen | `bioChip` | Bio Chip / Биочип | → Quantum Fluid |
| 21 | flaskBlue | `cryoFluid` | Cryo-Fluid / Крио-флюид | утилити |
| 22 | flaskYellow | `voltFluid` | Volt-Fluid / Вольт-флюид | утилити |
| 23 | flaskGreen | `bioFluid` | Bio-Fluid / Био-флюид | утилити |
| 24 | flaskPink | `nanoFluid` | Nano-Fluid / Нано-флюид | утилити |
| 25 | flaskPurple | `quantumFluid` | Quantum-Fluid / Квантовый флюид | утилити |
| 26 | loveHeart | `soulCore` | Soul Core / Ядро-душа | особое |

## Инструменты (5)

| Было | Новый ID | Имя (EN / RU) | Ресурс | Альтернативы |
|---|---|---|---|---|
| axe | `plasma_cutter` | Plasma Cutter / Плазменный резчик | Circuit | — |
| pick | `silicon_extractor` | Silicon Extractor / Кремниевый экстрактор | Silicon | — |
| spear | `data_harvester` | Data Harvester / Дата-харвестер | Dataset | — |
| bow | `quantum_transmitter` | Quantum Transmitter / Квантовый передатчик | Dataset | — |
| reaper | `neural_seeder` | Neural Seeder / Нейральный сеятель | Neuron | — |

Совместимость: `canonical_tool_type` принимает и старые названия (axe/pick/
spear/bow/reaper) как алиасы → старые devnet-инструменты продолжают работать.

## Редкости (UI-ярлыки; on-chain enum не меняется)

| Было | Стало |
|---|---|
| Common / Обычный | **Base** / Базовый |
| Uncommon / Необычный | **Enhanced** / Усиленный |
| Rare / Редкий | **Quantum** / Квантовый |
| Epic / Эпический | **Singularity** / Сингулярность |
| Legendary / Легендарный | **Transcendent** / Трансцендентный |

## Погода (UI-ярлыки; u8-значения не меняются)

| Было | Стало |
|---|---|
| Drought / Засуха | **Blackout** / Блэкаут |
| Sunny / Солнечно | **Nominal** / Номинал |
| Rain / Дождь | **Surge** / Скачок |
| Festival / Фестиваль | **Frenzy** / Френзи |

## Ключевой UI-копир (механики те же)

| Механика (код) | Было | Стало |
|---|---|---|
| Ферма (farm) | Ферма / поля | **Neuro Lab** / Нейро-лаборатория |
| Колодец (well) | Колодец | **Grid Station** / Сетевая станция |
| Погода (weather) | Погода | **Grid Load** / Нагрузка сети |
| Villagers | Жители | **Agents** / Агенты |
| Tent | Палатка | **Server Rack** / Серверная стойка |
| Mining | Добыча | **Extraction** / Добыча компонентов |
| Baking | Выпечка | **Training** / Тренировка модели |
| Season | Сезон | **Epoch** / Эпоха |
| Compendium | Компендиум | **Catalog** / Каталог |
| Packs | Паки | **Drop Capsules** / Капсулы дропа |
| Lottery | Лотерея | **Quantum Draw** / Квантовый розыгрыш |
| Forge | Кузница | **Quantum Forge** / Квантовая кузница |
| Exploration | Исследование | **Deep Learning** / Глубокое обучение |
| Rebirth | Перерождение | **Re-Training** / Переобучение |
| Gastank | Газовый танк | **Compute Tank** / Топливный бак |
| Collectors | Коллекционеры | **Archivists** / Архивисты |

## Что НЕ меняется (дизайн-решение)

1. **PDA-сиды** (`b"config"`, `b"well_state"`, …) — адреса аккаунтов на devnet
   сохраняются; mainnet будет чистым деплоем в новых именах.
2. **Поля аккаунтов Config/MaterialMints** (`food_mint`, `wood_mint`, …) —
   внутренние идентификаторы, не видны игроку; IDL-поля обновятся при
   `anchor build` только если переименовать (решено: не переименовывать).
3. **Дискриминанты** enum (Rarity, ResourceKind) — позиционные, бинарно
   совместимы.
4. **Адреса 27 ресурсных mint'ов** — devnet-токены не пересоздаются.
5. **gameId/tenant `aof`** — интеграция с хаbem и RLS.
6. **Числа экономики** (шансы, кривые, комиссии, лимиты) — полностью.

## Операторские следствия

- `anchor build` перегенерирует IDL с новыми именами enum-вариантов
  (ResourceKind: Food→Data, …) и новой таблицей `TOOL_KINDS`; до этого IDL в
  репо остаётся со старыми именами (клиент кодирует enum по индексу —
  бинарно совместимо).
- `cargo test` / `anchor test` — локально/CI (Rust переименован).
- Mainnet = первый деплой уже под брендом NeuroForge (старых devnet-аккаунтов
  там не будет).
