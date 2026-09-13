# ANALYSIS.md — Полный аудит Age of Farming (2026-08-29)

## §1 Критические находки

### 🔴 Проблема 1: ResourceKind enum — только 3 из 18+ предметов
**Факт:** `enum ResourceKind { Food, Wood, Stone }` (lib.rs:18-22)  
**Нужно:** +Seeds, Wheat, Flour, Bread, Water, Coal, Meat, StoneBlue/Purple/Red, SandWhite/Pink/Yellow, GemBlue/Orange/White/Green, FlaskBlue/Yellow/Green/Pink/Purple (15+ новых)  
**Влияние:** Хлебная цепочка, баночки, гемы **невозможны** без редеплоя контракта  
**Решение:** Расширить enum → редеплой программы → миграция ResourceOrder

### 🔴 Проблема 2: Energy, Weather, Drum, Mill/Oven/Well — только офчейн
**Факт:** Бэкенд имеет роуты (`/energy`, `/weather`, `/drum`, `/farm`), но контракта нет:
- Нет `WeatherState` / `weather_crank` (погода — сид blockhash, но инструкция отсутствует)
- Нет `Energy` поля в `Player` (только бэкенд-счётчик — обходимо)
- Нет `MillState` / `OvenState` / `WellState` / `FarmTile`
- Нет `Drum` инструкции (Барабан Удачи)
**Влияние:** Бэкенд "задаёт" балансы сам — нет ончейн-верификации, можно обойти  
**Решение:** Добавить 10+ новых аккаунтов + инструкций

### 🟡 Проблема 3: Query endpoints неполные
**Отсутствуют:**
- `GET /query/balances/:owner` (SPL-балансы всех ресурсов)
- `GET /query/weather/current`
- `GET /query/drum/:roundId`
- `GET /query/compendium/:owner`
- `GET /query/trust/:owner`
- `GET /query/neighbors/:owner`
- `GET /query/streaks/:owner`
- `GET /query/inbox/:owner`
**Влияние:** Фронтенд не может показать живые данные  
**Решение:** Добавить query-эндпоинты (бэкенд)

---

## §2 Матрица: что есть / что нет

| Фича | В контракте | В бэкенде | Во фронте | Приоритет | Блок |
|------|-------------|-----------|-----------|-----------|------|
| **Рынок (6 площадок)** | | | | | |
| Marketplace (листинг/покупка) | ✅ | ✅ | ✅ | — | Готово |
| Auction | ✅ | ✅ | ✅ | — | Готово |
| Offer | ✅ | ✅ | ✅ | — | Готово |
| Rental | ✅ | ✅ | ✅ | — | Готово |
| Orderbook (ресурсы) | ✅ | ✅ | ✅ | — | Готово |
| Lottery (commit-reveal) | ✅ | ✅ | ✅ | — | Готово |
| Hot Market (VRGDA) | ✅ | ✅ | ✅ | — | Готово |
| **Инструменты** | | | | | |
| Mint | ✅ | ✅ | ✅ | — | Готово |
| Stake/Unstake | ✅ | ✅ | ✅ | — | Готово |
| Mining | ✅ | ✅ | ✅ | — | Готово |
| Repair | ✅ (только STONE) | ✅ | ✅ (пульс) | 🟡 | D |
| Craft | ✅ (WOOD+STONE) | ✅ | ✅ (лента) | 🟡 | D |
| Forge (commit-reveal) | ✅ | ✅ | ✅ | — | Готово |
| Reroll | ✅ | ✅ | ✅ | — | Готово |
| **Экономика** | | | | | |
| GasTank | ✅ | ✅ | ✅ | — | Готово |
| Packs | ✅ | ✅ | ✅ (анимация) | — | Готово |
| Exploration | ✅ | ✅ | ✅ | — | Готово |
| Resources (FOOD/WOOD/STONE) | ✅ | ✅ | ❌ баланс | 🔴 | C |
| **Хлебная цепочка** | | | | | |
| Seeds (Reaper) | ❌ | ✅ (pay_out) | ❌ | 🔴 | L1 |
| Wheat (plant/harvest) | ❌ | ❌ | ❌ | 🔴 | L2 |
| Flour (мельница) | ❌ | ❌ | ❌ | 🔴 | L3 |
| Bread (печь) | ❌ | ❌ | ❌ | 🔴 | L4 |
| Water (колодец) | ❌ | ❌ | ❌ | 🔴 | L5 |
| Coal (дроп) | ❌ | ❌ | ❌ | 🟡 | L6 |
| Meat (Archer) | ❌ | ❌ | ❌ | 🔴 | L7 |
| Gems (крафт) | ❌ | ❌ | ❌ | 🔴 | L8 |
| Flasks (5 видов) | ❌ | ❌ | ❌ | 🔴 | L9 |
| Love Heart | ❌ | ❌ | ❌ | 🟡 | L10 |
| **Социалка** | | | | | |
| Referral (тиры) | ✅ | ✅ | ✅ | — | Готово |
| Neighbors (ферма друга) | ❌ | ✅ | ❌ | 🟡 | E |
| Guild | ❌ | ✅ | ❌ | 🟡 | E |
| Inbox (сообщения) | ❌ | ✅ | 🟡 (не по центру) | 🟡 | B |
| **Retention** | | | | | |
| Energy | ❌ (только бэк) | ✅ | ❌ | 🔴 | J |
| Weather | ❌ | ✅ | ❌ | 🔴 | J |
| Drum (Барабан Удачи) | ❌ | ✅ | ❌ | 🟡 | I |
| Compendium | ❌ | ✅ | 🟡 (награды не выдаются) | 🟡 | H |
| Streaks | ❌ | ✅ | ❌ | 🟡 | H |
| Comeback | ❌ | ✅ | ❌ | 🟡 | H |
| **Монетизация** | | | | | |
| Season Pass | ✅ | ✅ | ✅ (карточка) | 🟡 | G |
| VIP-привилегии | ❌ (гейт на бэке) | ✅ | ❌ (не включаются) | 🔴 | G |
| Rebirth | ✅ | ✅ | ✅ (модалка) | 🟡 | F |
| **Профиль** | | | | | |
| Trust Index | ❌ (формула офчейн) | ✅ | ✅ (кольцо) | 🟡 | K |
| Portfolio | ❌ | ✅ | 🟡 (нет "Назад") | 🟡 | B |
| Showcase (витрина) | ❌ | ✅ | ❌ (заглушка) | 🟡 | F |

---

## §3 Таблица потоков (куда идут активы)

| Актив | Источник | Сток | Куда идёт комиссия |
|-------|----------|------|---------------------|
| SOL | Аирдроп / депозит | Газ-бак / покупки | — |
| Газ-бак (lamports) | deposit_gas | craft/unstake/withdraw | 🔴 **Неясно**: сгорают или в treasury? |
| FOOD/WOOD/STONE | mining / pay_out | craft / repair / ордер | — |
| CORE | Квесты / рефералы | Хот-маркет / паки | fee_bps → treasury |
| MASCOT/GEM | Донаты / паки | Хот-маркет | fee_bps → treasury |
| Инструменты (NFT) | mint / craft / пак | burn / reroll / forge | — |
| Комиссия marketplace | 3% | — | ✅ treasury |
| Комиссия auction | 5% | — | ✅ treasury |
| Комиссия rental | 100% - ownerSplitBps | — | ✅ treasury |
| Лотерея | 70% пул | 30% разработчику | ✅ treasury |

**Дыра:** Газ-бак — куда деваются комиссии craft/unstake? Нужно проверить `sweep_gas_fees`.

---

## §4 План миграции контракта (редеплой)

### Последовательность (зависимости):
1. **L1:** Расширить `ResourceKind` enum (Food→FlaskPurple, 18 вариантов)
2. **L2:** Новые аккаунты: `MaterialMints`, `RecipeConfig`, `FarmTile`
3. **L3:** `WeatherState` + `weather_crank` (сид blockhash)
4. **L4:** `WellState` + `collect_well_water`
5. **L5:** `MillState` + `start_milling` / `collect_flour`
6. **L6:** `OvenState` + `start_baking` / `collect_bread`
7. **L7:** `Energy` поле в `Player` (или отдельный PDA)
8. **L8:** `Drum` инструкция (commit-reveal)
9. **L9:** `Reaper` / `Archer` в `pay_out` таблице (бэкенд)
10. **L10:** `LoveProgress` + `consume_love_item`

### Скрипты инициализации:
- `init_material_mints` — задать все 18 минтов
- `init_recipe` — таблица рецептов (гемы/баночки)
- `init_pack_config` — уже есть (запущено)
- `weather_crank` — permissionless, раз в сутки

### Миграция данных:
- Существующие `ResourceOrder` (ордербук) — пересоздать с новым `kind` (u8 вместо enum)
- Staked инструменты — не трогаем (ToolData не меняется)
- Season Pass — не трогаем

---

## §5 Эконом-баланс (faucets / sinks)

### Faucets (источники):
| Ресурс | Источник | Формула |
|--------|----------|---------|
| FOOD | mining (нет — это WOOD) | ❌ **Ошибка**: axe→WOOD, pick→STONE, bow→Meat, reaper→Seeds |
| WOOD | mining axe | 10 × YIELD_BPS[rarity] / 10000 |
| STONE | mining pick | 10 × YIELD_BPS[rarity] / 10000 |
| Seeds | mining reaper | 10 × YIELD_BPS[rarity] / 10000 |
| Meat | mining bow | 10 × YIELD_BPS[rarity] / 10000 |
| Coal | mining pick (15% шанс) | floor(hours / 2) |
| Wheat | harvest (Reaper) | Seeds × 1.5 × REAPER_YIELD[rarity] / 10000 |
| Flour | milling | Wheat + STONE → Flour (3 партии) |
| Bread | baking | Flour + Water + топливо → Bread (3 партии) |
| Water | collect_well_water | elapsed × rate(погода) |
| Gems | craft_recipe | 1 Stone/Sand → 1 Gem (мгновенно) |
| Flasks | craft_recipe | Гемы + сырьё → Flask (мгновенно) |

### Sinks (стоки):
| Ресурс | Куда тратится | Количество |
|--------|---------------|------------|
| WOOD | craft / repair | mintedCount × mult (эскалация) |
| STONE | craft / repair | mintedCount × mult |
| FOOD | repair (если добавим) | ? |
| Seeds | plant_seeds | 1 Energy за тайл |
| Wheat | milling | 6/18/40 (малая/средняя/крупная) |
| Flour | baking | 4/12/28 |
| Water | baking | 3/8/18 |
| Coal | baking (угольная печь) | 2/5/10 |
| Gems | craft_recipe (баночки) | 1-2 за флакон |
| Flasks | consume (различные действия) | 1 за использование |

**Дыра:** FOOD не используется ни в craft, ни в repair — инфляция. Нужен сток.

---

## §6 Трассировка пунктов ТЗ (21 пункт → блок)

| Пункт | Блок | Ожидаемое время | Сложность |
|-------|------|-----------------|-----------|
| 1. Баланс на главной | C | 2ч | 🟡 |
| 2. Сообщения по центру + "Назад" | B | 1ч | 🟢 |
| 3. Ремонт (все 3 ресурса) | D | 3ч | 🟡 |
| 4. Крафт (+FOOD, калькулятор) | D | 4ч | 🟡 |
| 5. Посетить ферму друга | E | 4ч | 🟡 |
| 6. Оффер отослать | — | 0ч | ✅ Готово |
| 7. Оффер по нику + переход | E | 3ч | 🟡 |
| 8. Портфель (диаграммы) | F | 6ч | 🔴 |
| 9. Кнопка "Назад" в Портфеле | B | 0.5ч | 🟢 |
| 10. Сезон-пасс (привилегии) | G | 4ч | 🟡 |
| 11. Квесты (прогресс + награда) | H | 5ч | 🟡 |
| 12. Достижения (авто-детект) | H | 4ч | 🟡 |
| 13. Барабан Удачи | I | 6ч | 🔴 |
| 14. Погода + времена года | J | 8ч | 🔴 |
| 15. Индекс доверия + Рейтинг | K | 6ч | 🔴 |
| 16. Витрина | F | 2ч | 🟢 |
| 17. Возрождение | F | 2ч | 🟢 |
| 18. Компендиум (награды) | H | 3ч | 🟡 |
| 19. Выработка по типу/редкости | C/F | 2ч | 🟢 |
| 20. SOL/gas/энергия/стрик | A→J | 4ч | 🟡 |
| 21. Потоки в казну | A/F | 3ч | 🟡 |
| L. Хлебная экономика | L | 20ч | 🔴 |

**Итого:** ~85 часов работы (2-3 недели full-time)

---

## §7 Первые шаги (приоритет)

### Немедленно (Блок B, 2ч):
1. Инбокс → "Сообщения" по центру с "Назад"
2. Портфель с "Назад"
3. Баланс ресурсов на Главной (query-эндпоинт + компонент)

### Критично (Блок L, 20ч):
Хлебная экономика — редеплой контракта с расширением ResourceKind

### Важно (Блоки C/D/E/G/H, 30ч):
- Ремонт/Крафт с 3 ресурсами
- Ферма друга
- Сезон-пасс привилегии
- Квесты/Достижения

### Долгосрочно (Блоки F/I/J/K, 25ч):
- Портфель-дашборд
- Барабан Удачи
- Погода
- Индекс доверия

---

## §8 Рекомендации

1. **Редеплой контракта обязателен** — без него хлебная экономика невозможна
2. **Бэкенд уже полный** — нужно только добавить query-эндпоинты
3. **Фронтенд — 60% готов** — остались страницы Drum/Weather/Energy/Compendium
4. **Эконом-баланс** — FOOD не имеет стока, нужно добавить в repair или craft
5. **Миграция** — на локалнете бесплатно, на проде нужен план

