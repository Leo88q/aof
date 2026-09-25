# Аудит визуала NeuroForge (AOF) — 2026-09-25

Проверено на ветке `arena/01a0d59f-aof`, коммит `0dc3bf2` («Add season, rebirth, and reputation icons.», 2026-09-25 12:49:43Z).
Метод: скачан tarball ветки через GitHub API, `npm install` + `npm run build` (`tsc && vite build`), статический разбор `frontend/src`.

---

## 0. Вердикт одной строкой

**Визуал не готов.** Картинки нарисованы и лежат в репозитории, но **сборка фронта не проходит**, фоны не подключены вовсе, а арт ресурсов используется в 2 файлах из 60, где он нужен. Главный дефицит — не рисунки, а **проводка**.

---

## 1. БЛОКЕР: фронтенд не собирается

`npm run build` → `tsc` падает, **exit 2**. Две независимые причины:

### 1.1. `frontend/src/pages/farm/ExplorationPage.tsx` — 16 ошибок TS

Поисковая замена ребренда NeuroForge превратила объявление константы в комментарий:

```
- const EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset = { food: 75, wood: 35, stone: 35, meat: 50 };
+ const EXPLORATION_COST = { data: 75, circuit: 35, silicon: 35, dataset: 50 };
```

и сломала 4 JSX-выражения (строки 103–106):

```
- {EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset.food}
+ {EXPLORATION_COST.data}
```

Всего 5 мест с маркером `// NeuroForge:`, все в одном файле.
**Важно: эта поломка есть и в `main`** (проверено на tarball main — те же 5 совпадений). То есть `main` сейчас тоже не собирается; патч картинок тут ни при чём.

### 1.2. `frontend/src/pages/friend/FriendsList.tsx` — 1 ошибка TS

```
src/pages/friend/FriendsList.tsx(109,19): error TS2304: Cannot find name 'UI_ICONS'.
```

Коммит `314cd24e` («Add workshop, inbox, privilege, weather, and friends icons.», 2026-09-25 01:14:34Z) добавил `<img src={UI_ICONS.friends} …>` на строку 109, но **не добавил импорт**. Это привнёс именно патч картинок.

Фикс — одна строка после `import { FriendFarmPage } …`:

```ts
import { UI_ICONS } from "../../lib/visualAssets";
```

### Результат после двух фиксов

```
✓ built in 6.60s
=== BUILD EXIT: 0 ===
```

Единственное предупреждение — чанк `index-*.js` 1.15 МБ (352 кБ gzip), к визуалу не относится.

---

## 2. Инвентарь ассетов (что реально лежит)

| Каталог | Файлов | Комментарий |
|---|---|---|
| `frontend/public/assets/backgrounds/` | 10 | **не отрисовываются нигде** |
| `frontend/public/assets/icons/` | 26 | иконки ресурсов |
| `frontend/public/assets/icons/ui/` | 60 | интерфейсные иконки |
| `frontend/public/assets/nfts/` | 25 | 5 инструментов × 5 редкостей |
| `frontend/public/assets/nfts/resources/` | 28 | 27 ресурсов + 1 сирота |
| **Итого** | **149** | 2.63 МБ |

Сверка ссылок и файлов:
- уникальных ссылок в коде: **148**
- ссылок без файла (битых): **0**
- файлов без ссылки (сирот): **1** — `assets/nfts/resources/drop-capsule.jpg`

Игровые движки (`game/godot/`, `game/unity/`) картинок **не содержат и не используют** — grep по `.gd`/`.tscn`/`.cs`/`.godot` не нашёл ни одного обращения к `.png`/`.jpg`. Весь арт живёт только во фронтенде.

---

## 3. Что подключено полностью ✅

| Набор | Объявлено | Используется | Мёртвых ключей |
|---|---|---|---|
| `UI_ICONS` (60 иконок) | 60 | **60** | **0** |
| `toolPlate()` — 25 плиток инструментов | 25 | используется в **11** файлах | 0 |

`TabBar` (6 вкладок), погода (4), сезоны (4), ранги (5), факторы доверия (5), подстраницы рынка (6) — всё на картинках. Эта часть работы сделана чисто.

---

## 4. Что НЕ подключено ❌

### 4.1. Фоны — 10 файлов, 1.88 МБ, ноль использований

```
BACKGROUNDS объявлено: 10 | используется в компонентах: 0
SCENE_BY_TAB используется в компонентах: False
```

`SCENE_BY_TAB` и `BACKGROUNDS` объявлены в `visualAssets.ts` и не импортируются **ни одним** файлом. Приложение рисует CSS-градиенты. Все 10 сцен (`lab`, `grid`, `forge`, `market`, `deep`, `hero`, `blackout`, `nominal`, `surge`, `frenzy`) — мёртвый груз в бандле.

### 4.2. Арт ресурсов используется в 2 файлах

```
resourceIcon / resourcePlate / RESOURCE_ART используются только в:
  frontend/src/components/ui/ResourceBar.tsx   (3 счётчика на главной)
  frontend/src/site/pages/ContentPage.tsx      (лендинг)
```

Проверено, что в ключевых экранах обращений к арту **ноль**:

| Файл | `resourceIcon`/`ArtPlate` |
|---|---|
| `pages/economy/Pantry.tsx` | 0 |
| `pages/economy/ResourceOverview.tsx` | 0 |
| `lib/marketUtils.ts` | 0 |
| `pages/market/OrderbookPage.tsx` | 0 |

### 4.3. `marketUtils.ts` — второй, параллельный источник иконок (эмодзи)

`ALL_TRADE_RESOURCES` несёт собственные `icon:`-эмодзи для всех **27** ресурсов on-chain (`aof-core/src/lib.rs`, `enum ResourceKind`: Data…Mind, 27 значений) и **не импортирует** `visualAssets`:

```ts
{ key: "DATA",    label: "Данные",   icon: "📊",  kind: 0 },
{ key: "CIRCUIT", label: "Схема",    icon: "🔌",  kind: 1 },
{ key: "SILICON", label: "Кремний",  icon: "🧱",  kind: 2 },
…
{ key: "SOUL_CORE", label: "Ядро души", icon: "❤️", kind: 25 },
{ key: "MIND",      label: "MIND",      icon: "🧠", kind: 26 },
```

Отсюда — весь рынок, ордербук, аукцион, аренда и офферы показывают эмодзи, хотя картинки для всех 27 ресурсов уже лежат на диске.

### 4.4. Остатки старого фермерского набора

В `ResourceBar.tsx` поле `icon` с эмодзи объявлено, но не рендерится (рядом стоит `ArtPlate`) — мёртвый код:

```ts
{ key: "DATA", icon: "🌾", label: "Данные", accent: "#c9a24a" },
```

По коду разбросаны legacy-эмодзи, для которых в `visualAssets.ts` уже есть маппинг `LEGACY_RESOURCE_ID` (food→data, wood→circuit, stone→silicon, potato→mind, meat→dataset, flour→signal, bread→model и т.д.): 🌾 🌱 🪨 🪵 🥔 🥣 🍞 🍖 💧 🌰 🧊.

### 4.5. Погода: иконки перепутаны местами

```ts
const WEATHER_ICONS = {
  sunny:            UI_ICONS.weatherNominal,
  rain:             UI_ICONS.weatherSurge,     // «дождь» → иконка всплеска
  drought:          UI_ICONS.weatherBlackout,  // «засуха» → иконка блэкаута
  harvest_festival: UI_ICONS.weatherFrenzy,
};
```

Семантика ключей (`sunny/rain/drought/harvest_festival`) не совпадает с семантикой арта (`nominal/surge/blackout/frenzy`). Нужны либо 4 честных иконки погоды, либо переименование.

### 4.6. Сирота

`assets/nfts/resources/drop-capsule.jpg` — файл есть, в коде не упоминается. Либо подключить (дро́пы/капсулы), либо удалить.

---

## 5. Эмодзи: масштаб остатка

| Показатель | Значение |
|---|---|
| Вхождений эмодзи в прод-коде | **728** |
| Уникальных символов | **131** |
| Файлов `.ts`/`.tsx` с эмодзи | **60** |
| Файлов, уже подключивших арт | 25 из 60 |
| Всего `.ts`/`.tsx` в `frontend/src` | 134 |
| Файлов, импортирующих `visualAssets` | 31 (23%) |
| В тест-файлах | 0 |

### Топ-15 файлов по остатку

| Эмодзи | Файл | Арт подключён? |
|---|---|---|
| 41 | `pages/portfolio/PortfolioHome.tsx` | частично (toolPlate) |
| 35 | `pages/profile/ProfileHome.tsx` | частично (UI_ICONS) |
| 35 | `pages/economy/Workshop.tsx` | частично (UI_ICONS) |
| 33 | `pages/farm/FarmPlot.tsx` | частично (toolPlate) |
| 31 | `pages/economy/ResourceOverview.tsx` | **нет** |
| 31 | `lib/marketUtils.ts` | **нет** |
| 30 | `pages/tools/CraftPage.tsx` | частично (toolPlate) |
| 30 | `pages/market/OrderbookPage.tsx` | **нет** |
| 26 | `pages/farm/OvenPanel.tsx` | **нет** |
| 24 | `pages/economy/Pantry.tsx` | **нет** |
| 24 | `pages/farm/MillPanel.tsx` | **нет** |
| 23 | `pages/market/LotteryPage.tsx` | частично (UI_ICONS) |
| 16 | `pages/farm/WellPanel.tsx` | **нет** |
| 11 | `pages/admin/SandboxPage.tsx` | **нет** |
| 11 | `components/PrivilegesPanel.tsx` | **нет** |

---

## 6. Приоритетный план

### P0 — починить сборку (новые картинки не нужны, ~10 минут)
1. `ExplorationPage.tsx`: вернуть `const EXPLORATION_COST = {…}` и 4 JSX-выражения (готовый diff ниже).
2. `FriendsList.tsx`: добавить `import { UI_ICONS } from "../../lib/visualAssets";`.
3. Прогнать `npm run build` — должен дать exit 0.

### P1 — подключить то, что уже нарисовано (картинки не нужны, только код)
4. `marketUtils.ts`: заменить `icon: "📊"` на `resourceIcon(key)` во всех 27 записях → рынок/ордербук/аукцион сразу получают арт.
5. Подключить `SCENE_BY_TAB` к корневому layout → оживут 10 фонов (1.88 МБ).
6. Прогнать `resourceIcon`/`ArtPlate` по `Pantry`, `ResourceOverview`, `MillPanel`, `OvenPanel`, `WellPanel`, `PlantingPanel`, `OrderbookPage` (~180 эмодзи).
7. Вычистить legacy-эмодзи через `LEGACY_RESOURCE_ID` (🌾🌱🪨🪵🥔🥣🍞🍖💧🌰🧊 — 169 вхождений).
8. Удалить мёртвое поле `icon` в `ResourceBar.tsx`.
9. Разобраться с `drop-capsule.jpg`: подключить или удалить.

### P2 — дорисовать недостающее (~75–80 иконок)

**Статус и системные (самое частое, ~191 вхождение):**
`✅` (40), `❌` (151), `✓` (15), `✕` (5), `⚠` (11), `⏳` (4), `⏸` (6), `⏹`, `🔒` (5), `🔑` (3), `🔔`, `🔍`, `🔄` (2), `🚫`, `❓`, `❔`, `⌄`

**Рейтинг и награды (~28):**
`🏆` (5), `🏅` (2), `🥇🥈🥉`, `🎖`, `⭐` (5), `🌟` (2), `★` (6), `✦`, `👑` (3) — нужны и для `LeaderboardPage`, `PlayerRatingPage`, `PlayerRating`

**Валюта и сделки (~21):**
`💰` (3), `🪙`, `🎫` (3), `🏷` (3), `📦` (6), `🛒`, `🧺` (4), `👛` (3), `💼`, `🧾`

**Баффы и эффекты (~40):**
`🔥` (17 — стрик/буст), `✨` (9), `🎁` (7), `⚡` (7), `🏅`, `💡` (4), `🎯` (6), `🚨` (3), `🎉` (6), `🎡` (3), `🎰`

**Графики и админка (~30):**
`📊` (13), `📈` (8), `📉` (2), `💹`, `📋`, `🗂`, `📸`, `🛡` (3), `⚙` (15), `📜` (3), `🎮`, `🚀`

**Локации для «Экспедиции» (~12):**
`🗺` (2), `🏚` (2), `🏡`, `🏭`, `🏰`, `🏖`, `🌵`, `🏹` (2) — сейчас страница исследования показывает лук и руины эмодзи

**Персонажи и соц. (~13):**
`🧙` (3 — NPC), `👨`, `👥`, `🤝` (3), `🔗` (2), `💬`, `📭`, `🚫`, `💀`

**Ремонт и инструменты (~12):**
`🛠` (4), `🔨` (5), `🧰` (2), `🩹`, `💔`, `🧿`

**Сердечки/флюиды в интерфейсе (~9):**
`💗` (5), `❤` (2), `🩷`, `💎` (10), `🧪` (31 — колбы/флюиды)

**Погода/сезоны — переделать 4 существующие** под ключи `sunny/rain/drought/harvest_festival`.

### P3 — игра
`game/godot/` и `game/unity/` не содержат ни одной картинки. Если арт нужен и там — это отдельный экспорт всего набора.

---

## 7. Итоговая таблица готовности

| Категория | Готово | Осталось |
|---|---|---|
| Иконки инструментов (5×5) | 25/25 ✅ | 0 |
| Интерфейсные иконки | 60/60 ✅ | 0 |
| Плитки ресурсов (27) | 27/27 ✅ | 0 |
| Иконки ресурсов (27) | 26/27 ⚠️ | soul-core (только плитка) |
| Фоны сцен | 10 нарисовано ✅ / 0 подключено ❌ | вся проводка |
| Подключение арта ресурсов в UI | 2 файла | ~10 экранов |
| Эмодзи в прод-коде | — | 728 вхождений, 131 символ, 60 файлов |
| Сборка фронтенда | ❌ exit 2 | 2 файла |

---

## Приложение: готовый фикс P0

```diff
--- a/frontend/src/pages/farm/ExplorationPage.tsx
+++ b/frontend/src/pages/farm/ExplorationPage.tsx
@@ -10,7 +10,7 @@
 import { connection } from "../../lib/wallet";
 import { UI_ICONS } from "../../lib/visualAssets";
 
-const EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset = { food: 75, wood: 35, stone: 35, meat: 50 };
+const EXPLORATION_COST = { data: 75, circuit: 35, silicon: 35, dataset: 50 };
 
 export function ExplorationPage() {
   const { address } = useWalletStore();
@@ -100,10 +100,10 @@
         <div className="bg-soil-800/60 rounded-xl p-4 mb-4">
           <h3 className="text-parchment font-semibold text-sm mb-3">Стоимость похода:</h3>
           <div className="space-y-2 text-sm">
-            <div className="flex justify-between"><span className="text-straw">📊 Данные (DATA)</span><span className="text-parchment font-bold">{EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset.food}</span></div>
-            <div className="flex justify-between"><span className="text-straw">🔌 Схема (CIRCUIT)</span><span className="text-parchment font-bold">{EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset.wood}</span></div>
-            <div className="flex justify-between"><span className="text-straw">🧊 Кремний (SILICON)</span><span className="text-parchment font-bold">{EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset.stone}</span></div>
-            <div className="flex justify-between border-t border-straw/20 pt-2 mt-2"><span className="text-wheat-500 font-semibold">🍖 Датасет (MEAT)</span><span className="text-wheat-500 font-bold">{EXPLORATION_COST // NeuroForge: Data/Circuit/Silicon/Dataset.meat}</span></div>
+            <div className="flex justify-between"><span className="text-straw">📊 Данные (DATA)</span><span className="text-parchment font-bold">{EXPLORATION_COST.data}</span></div>
+            <div className="flex justify-between"><span className="text-straw">🔌 Схема (CIRCUIT)</span><span className="text-parchment font-bold">{EXPLORATION_COST.circuit}</span></div>
+            <div className="flex justify-between"><span className="text-straw">🧊 Кремний (SILICON)</span><span className="text-parchment font-bold">{EXPLORATION_COST.silicon}</span></div>
+            <div className="flex justify-between border-t border-straw/20 pt-2 mt-2"><span className="text-wheat-500 font-semibold">🍖 Датасет (MEAT)</span><span className="text-wheat-500 font-bold">{EXPLORATION_COST.dataset}</span></div>
           </div>
         </div>
 
--- a/frontend/src/pages/friend/FriendsList.tsx
+++ b/frontend/src/pages/friend/FriendsList.tsx
@@ -5,6 +5,7 @@
 import { useWalletStr } from "../../lib/useWalletStr";
 import { useNav } from "../../nav/NavContext";
 import { FriendFarmPage } from "./FriendFarmPage";
+import { UI_ICONS } from "../../lib/visualAssets";
```

Проверено: после этих двух правок `npm run build` → `✓ built in 6.60s`, exit 0.
