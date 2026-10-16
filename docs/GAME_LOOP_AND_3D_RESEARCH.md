# Ресерч: реальный игровой цикл и 3D-модели для AOF

Дата: 2026-10-16. Цель — понять, какую «живую» игру можно собрать из текущего проекта, что взять с GitHub и какие 3D-модели можно использовать без юридических рисков.

Все данные по репозиториям сняты через GitHub API (звёзды, лицензия, дата последнего пуша). Лицензии с пометкой `NOASSERTION` GitHub не распознал — их надо читать вручную.

---

## 0. Диагностика: почему сейчас «статичный запуск»

| Клиент | Что реально есть | Игрового цикла нет, потому что |
|---|---|---|
| **Godot** (`game/godot/`) | 194 строки GDScript на 7 слоёв + 12 продуктов | `scenes/main.tscn` — пустой `Node`; `boot()` только печатает строку; все функции `SolanaClient`, `AnchorProgram`, `farming.plant/harvest` — заглушки `pass` / `return []`. Нет `_process` / `_physics_process`. |
| **Unity** (`game/unity/`) | C#-зеркало Godot-кода | `L1Platform.Boot()` делает `Console.WriteLine`. Тех же заглушек больше. |
| **Web** (`frontend/`, React 18 + Vite) | Реальный UI, реальные данные из API и цепочки | Цикл — это поллинг: `setInterval` на 5–60 с (`MillPanel`, `OvenPanel`, `WellPanel`, `NeuralLabPanel`…). Фон — статичные JPG (`SceneBackdrop`). Единственный `requestAnimationFrame` — счётчик `AnimatedCounter`. 3D-библиотек и `.glb` нет. |

Вывод: «живость» сейчас держится на поллинге и CSS-анимациях. Игровой цикл (кадр → симуляция → ввод → синхронизация с цепочкой) нигде не реализован.

**Важно для лицензий:** в корне репозитория **нет файла LICENSE** (GitHub показывает `license: none`). Пока это не решено, брать код из GPL-проектов нельзя: он потребовал бы открыть наш код под GPL.

---

## 1. Реальные игры на GitHub

Готовой 3D-фермы с пермиссивной лицензией, которую можно встроить как есть, я не нашёл. Поиск по «farming game godot» дал в основном учебные проекты с 0–2 звёздами. Ниже — лучшие кандидаты как **референсы** (учиться на архитектуре, не копировать код).

| Репозиторий | Что это | Язык | Лицензия | ★ | Последний пуш | Зачем нам / риск |
|---|---|---|---|---|---|---|
| [jeremyckahn/farmhand](https://github.com/jeremyckahn/farmhand) | Полноценная игра-менеджер фермы, играется в браузере | TypeScript | **GPL-2.0** | 145 | 2026-10-10 | Самая «настоящая» игра с циклом дней, таймеров и экономикой. **Риск:** GPL — только читать, код не брать. |
| [nicechunk/game](https://github.com/nicechunk/game) | Браузерный 3D-клиент Solana-игры (WebGL2, свой движок Chunk.js) | JavaScript | Apache-2.0 | 313 | 2026-10-12 | **Ближайший аналог нашей задумки:** 3D в вебе + Solana + состояние из цепочки. README явно разделяет: рендер и предсказание движения — это не финальность on-chain. Ровно та архитектура, которая нужна AOF. |
| [winsznx/bull-rush](https://github.com/winsznx/bull-rush) | 3D endless runner на React Three Fiber + API на Hono/Redis | Solidity (в основном) / клиент R3F | MIT | 352 | 2026-07-20 | Пример реального игрового цикла внутри R3F. Блокчейн тут EVM, поэтому берём только клиентскую часть. |
| [hackagotchi/hackagotchi](https://github.com/hackagotchi/hackagotchi) | Многопользовательская ферма с экономикой | Rust | BSD-3-Clause | 33 | 2026-10-02 | Близко к нашей экономике (ресурсы, рынок, рост). Нативный клиент, для веба не подходит. |
| [WispSnow/TinyFarm](https://github.com/WispSnow/TinyFarm) | Ферма на C++ / SDL3 / OpenGL | C++ | MIT | 63 | 2026-08-14 | Нативный референс структуры главного цикла. Детали цикла я не проверял. |
| [indium114/termfarm](https://github.com/indium114/termfarm) | CLI idle-ферма | Rust | MIT | 28 | 2026-10-15 | Самый короткий рабочий пример тик-цикла (idle loop). |
| [TinyTakinTeller/GodotProjectZero](https://github.com/TinyTakinTeller/GodotProjectZero) | Idle-игра на Godot 4 | GDScript | `NOASSERTION` | 207 | 2026-05-02 | Пример цикла на Godot. Лицензию читать вручную. |
| [gdquest-demos/godot-4-3d-third-person-controller](https://github.com/gdquest-demos/godot-4-3d-third-person-controller) | Godot 4 демо с 3D-контроллером персонажа | GDScript | `NOASSERTION` | 1038 | 2026-08-15 | Лучший по популярности 3D-контроллер для Godot 4, но лицензию надо проверить. |
| [WaffleAWT/Godot-4.3-Third-Person-Controller](https://github.com/WaffleAWT/Godot-4.3-Third-Person-Controller) | Третье лицо для Godot 4.3 | GDScript | MIT | 53 | 2024-08-18 | Безопасная лицензия, но проект заброшен (WIP, 2024). |
| [TinyTakinTeller/TakinGodotTemplate](https://github.com/TinyTakinTeller/TakinGodotTemplate) | Шаблон структуры проекта Godot 4 | GDScript | MIT | 499 | 2025-10-06 | База для Godot-клиента: структура сцен, автолоады, менеджер состояний. |

**Чего не нашлось:** открытого Stardew-подобного клона на Godot или three.js с нормальной лицензией. Поиск по топику `stardew-valley` даёт в основном моды и серверы для оригинальной игры.

---

## 2. Godot + Solana (ядро нашего L3)

| Репозиторий | Что даёт | Лицензия | ★ | Статус |
|---|---|---|---|---|
| [Virus-Axel/godot-solana-sdk](https://github.com/Virus-Axel/godot-solana-sdk) | GDExtension: `SolanaClient`, `WalletAdapter`, `AnchorProgram`, Candy Machine, SPL, Token | MIT | 78 | Последний релиз **v2.0.0-rc.1** (2026-10-06), это пре-релиз. README: безопасность SDK «не оценивалась», на mainnet не рекомендуется. |
| [magicblock-labs/Solana.Unity-SDK](https://github.com/magicblock-labs/Solana.Unity-SDK) | Полный Unity-SDK: RPC, NFT, кошелёк | MIT | 201 | Для Unity-зеркала. Есть пример [Solana-Unity-Chess](https://github.com/magicblock-labs/Solana-Unity-Chess) (MIT) — on-chain UI. |

Имена нод у `godot-solana-sdk` (`SolanaClient`, `AnchorProgram`, `WalletAdapter`) совпадают с заглушками в `game/godot/chain/`. Заглушки можно заменить на SDK без переписывания слоёв.

---

## 3. Веб: 3D в нашем React-фронтенде

3D-зависимостей в `frontend/package.json` сейчас нет. Актуальные версии из npm (все MIT):

- `three` — 0.186.1
- `@react-three/fiber` — 9.8.2 (React-рендерер для three.js)
- `@react-three/drei` — 10.7.9 (готовые помощники: `useGLTF`, `useAnimations`, `Environment`)

Для идей: [verekia/r3f-gamedev](https://github.com/verekia/r3f-gamedev) (MIT, рецепты геймдева на R3F), [pmndrs/react-three-next](https://github.com/pmndrs/react-three-next) (MIT, стартер, но последний пуш 2024-06 — берём только идеи).

**Ограничение:** three.js заметно тяжёлый. Его надо грузить лениво (`dynamic import`) только на экране фермы, иначе ухудшится первая загрузка всего кабинета.

---

## 4. 3D-модели и анимации (с проверенными лицензиями)

Для наших задач подходят CC0-паки: без атрибуции, для коммерческих проектов.

| Пак | Что внутри | Лицензия | Форматы | Куда в AOF |
|---|---|---|---|---|
| **Quaternius — Universal Animation Library** ([страница](https://quaternius.com/packs/universalanimationlibrary.html)) | 120+ анимаций на одном humanoid-риге: локомоция в 8 направлениях, бег, сбор, сидение, смерть. Совместим с Godot, Unity, UE. | CC0 | FBX, GLB, OBJ, Blend | Фермер и NPC: ходьба, сбор урожая, idle |
| **Quaternius — LowPoly Crops Pack** ([OpenGameArt](https://opengameart.org/content/lowpoly-crops-pack)) | 100+ культур, **5 стадий роста** каждой | CC0 | FBX, OBJ, Blend | Растения на плитках: стадия = `progress` из `NeuralLabPanel` |
| **Quaternius — Farm Buildings** ([itch](https://quaternius.itch.io/lowpoly-farm-buildings)) | 13 строений: амбар, силос, курятник, ветряк | CC0 | FBX, OBJ, Blend, GLB | Декорации фермы |
| **Quaternius — Farm Animal Pack** ([poly.pizza](https://poly.pizza/bundle/Farm-Animal-Pack-1kUvRTPLzT)) | 7 животных с анимациями run / idle / jump / walk | CC0 | FBX, GLTF | Животные на ферме |
| **Kenney — Nature Kit** ([kenney.nl](https://kenney.nl/assets/nature-kit)) | 330 объектов: деревья, камни, кусты, цветы | CC0 | glTF, OBJ, FBX | Окружение, пейзаж |
| **Kenney — Animated Characters 1–3** ([itch](https://kenney-assets.itch.io/animated-characters-3)) | Риг + idle / run / jump | CC0 | glTF, FBX | Лёгкая альтернатива персонажу |

**Осторожно с остальным:**

- **Mixamo** — по обзору [cinevva](https://app.cinevva.com/guides/free-rigged-3d-character-models) бесплатен и коммерчески применим, но без перераспространения файлов. Перед использованием перепроверить условия Adobe.
- **Poly Pizza, Sketchfab, Icosa** — смешанные лицензии, часть CC-BY (нужна атрибуция). Брать только с фильтром CC0.
- **Khronos glTF-Sample-Models** ([GitHub](https://github.com/KhronosGroupArchives/glTF-Sample-Models), 3610★) — эталонные тестовые модели. У каждой своя лицензия, в продакшен не брать без проверки.

**Практика по репозиторию:** для сторонних ассетов в `frontend/public/licenses/` уже лежат тексты лицензий шрифтов. Для 3D-паков стоит делать так же.

---

## 5. Что значит «настоящий игровой цикл» и как его построить

Цикл здесь — это:

1. **Рендер-цикл** на каждый кадр (`useFrame` в R3F / `_process` в Godot): анимации, частицы, камера.
2. **Фиксированный шаг симуляции** (например, 10–20 тиков в секунду): рост растений, таймеры, стадии. Не зависит от FPS.
3. **Ввод** (клик по грядке, сбор, посадка) → локальное предсказание сразу, подтверждение позже.
4. **Синхронизация с источником истины**: состояние из API / цепочки перезаписывает предсказание. Поллинг заменяется подпиской или редкими сверками.

Важное ограничение из самого проекта: `docs/VIP_VISUAL_ASSETS.md` говорит, что визуал — **чисто косметический**: он не отображает минт, награды и токены. 3D должен работать по той же схеме.

---

## 5a. Что изучили в референсах (вариант C)

Референсы разобраны по коду и документации в локальных клонах. В репозиторий ничего не скопировано. Все выводы ниже — проверены по файлам, а не по описаниям.

| Референс | Лицензия | Что видно про цикл | Что берём в AOF (своим кодом) |
|---|---|---|---|
| [nicechunk/game](https://github.com/nicechunk/game) — `docs/architecture.md`, `play/main.js` | Apache-2.0 | Четыре слоя истины: презентация (эффекты, интерполяция) — одноразовая; real-time (Guardian) — может теряться; состояние Solana PDA — авторитетно; детерминированная реконструкция. Главный цикл — `requestAnimationFrame`. Явное правило: анимация на нажатии не равна подтверждённой транзакции. | 3D-слой отвечает только за показ. Анимация сбора не считается сбором, пока API или цепочка не подтвердили. |
| [indium114/termfarm](https://github.com/indium114/termfarm) — `src/crops.rs`, `src/harvest_cmd.rs`, `src/models.rs` | MIT | Рост не тикает. В структуре записано время посадки, готовность считается как «прошло ≥ grow_time» от этой метки. Игра может быть закрыта, рост всё равно идёт. | Это та же схема, что у нас: `LabTile.startedAt` и `readyAt`. Клиент может считать прогресс каждый кадр сам, без запросов. |
| [jeremyckahn/farmhand](https://github.com/jeremyckahn/farmhand) — `src/game-logic/reducers/computeStateForNextDay.ts` | **GPL-2.0** | Переход «следующий день» — чистая функция: цепочка `process*`-редьюсеров, возвращает новое состояние. Стадия `SEED / GROWING / GROWN` выводится из `daysWatered` (`getCropLifeStage.ts`): рост идёт только в дни полива. Это цикл, в котором действие игрока двигает время. Логика полностью отделена от React. | Только паттерн, код не берём (GPL). Шаг симуляции — чистая функция с отдельными тестами. В бэкенде уже есть `economySimulator.ts` в этом духе. |

**Что показал наш код (проверено):**

- **Прогресс плиток уже считается на бэкенде.** `aof_backend/src/routes/query.ts`, строки ~586–603: `progress = (now − startedAt) / (readyAt − startedAt)`, максимум 99 до готовности, 100 когда `now ≥ readyAt`. Значит фронту не нужен поллинг, чтобы плавно рисовать рост. Достаточно `startedAt` и `readyAt`.
- **Риск с часами.** `now` берётся как `Date.now()/1000` на сервере. Часы клиента могут отличаться. Решение: отдавать `serverNow` в ответе и считать смещение один раз.
- **WebSocket есть, но не подключён.** `aof_backend/src/lib/wsHub.ts` описывает socket.io-сервер на пути `/ws`, но функция `initWS` нигде не вызывается. Фронтенд тоже не использует socket.io. Поллинг с 5–10 с можно заменить подпиской, но сначала надо подключить сервер.

## 6. Варианты направления

### Вариант A — Веб-сцена фермы на R3F (рекомендую для первого результата)

- Экран фермы (`FarmDashboard`) получает 3D-сцену: грядки, строения, фермер из Universal Animation Library.
- Прогресс роста берётся из **тех же данных**, что уже грузит `NeuralLabPanel`: у каждой плитки `LabTile` есть `progress` (0–100), `ready`, `active`, `startedAt`, `outputKind`. Прогресс делим на 5 стадий и выбираем соответствующую модель из пакета Crops. Новых запросов не нужно.
- Важно: `FarmPlot` к росту отношения не имеет. Он работает с майнингом инструментов (`startMining` / `collectMining`).
- Эффекты сбора переиспользуют идею `RewardBurst`.
- Цикл: `useFrame` для анимации + накопитель для шага роста. Поллинг остаётся как синхронизация.
- Плюсы: один деплой, одна кодовая база, данные уже есть. Минусы: three.js тяжёлый, нужен fallback на 2D (`prefers-reduced-motion`, слабые устройства).
- Размер: средний.

### Вариант B — Настоящий Godot-клиент

- База: `TakinGodotTemplate` (структура) + `godot-solana-sdk` (L3) + GLB из Quaternius / Kenney.
- Основной цикл в `_physics_process`, конечный автомат состояний фермы.
- Минусы: сейчас Godot-клиент — это 194 строки заглушек. Всё нужно писать с нуля. SDK в RC-статусе, безопасность не оценена. Дублирует веб-функции.
- Размер: большой.

### Вариант C — Изучить референсы, потом решить (выбран)

- Референсы разобраны (раздел 5a). Модель цикла для AOF: время как источник истины (`startedAt` / `readyAt`), рендер на каждый кадр, подтверждение через API.
- Размер: маленький, без результата в продукте. Следующий шаг — выбрать A или B уже с этим знанием.

---

## 7. Риски и вопросы, которые надо решить до старта

1. **Лицензия проекта — решено: закрытый код.** Из MIT, Apache-2.0, BSD и CC0 можно брать код с сохранением уведомлений. GPL-проекты (`farmhand`) только читаем, код не копируем. Файл LICENSE в корне пока не добавлен — его стоит завести отдельно.
2. **Godot SDK в RC.** Не использовать на mainnet, пока безопасность не проверена.
3. **Размер 3D.** Оптимизировать GLB (меш-упрощение, сжатие текстур, Draco / meshopt). Ставить бюджет на модель и на сцену.
4. **Доступность.** Учитывать `prefers-reduced-motion` и слабые устройства, как минимум с 2D-режимом.
5. **Чистота данных.** Визуал не должен показывать то, чего нет в цепочке или API.

---

## 8. Рекомендованный первый шаг (вертикальный срез, если выбран вариант A)

1. Добавить `three`, `@react-three/fiber`, `@react-three/drei` и подгружать их лениво.
2. Одна сцена, одна плитка с 5 стадиями роста (Crops) и один анимированный фермер (Universal Animation Library).
3. Стадия роста берётся из существующих данных `LabTile.progress` / `ready` (`NeuralLabPanel`).
4. Замерить вес бандла и FPS на мобильном профиле.
5. Решить по результатам, идти ли в Godot (вариант B).
