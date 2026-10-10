import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Регрессии интерфейса, найденные в аудите лаборатории 2026-09-28.
 *
 * Это статические проверки исходников, а не браузерные тесты: они не дают
 * вернуть в код мёртвые поля, выдуманные числа и верстку, которая выезжает
 * за экран на телефоне. Каждая проверка ссылается на конкретный дефект.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Код без комментариев: пояснения «почему так» не считаются содержимым экрана. */
const code = (rel: string) => read(rel)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const RESOURCE_MANIFEST = JSON.parse(read('../docs/RESOURCE_MANIFEST.json'));
const resourceKeyForApi = (apiName: string) => apiName
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toUpperCase();

test("лаборатория не показывает выдуманный SOL-газ", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.ok(!/value="12\.4"/.test(dash), "хардкод 12.4 вернулся в StatChip");
  const panels = read("src/components/farm/LabHero.tsx");
  assert.match(panels, /api\.query\s*\.\s*gastank/, "газ-бак должен читаться из /query/gastank");
  assert.match(panels, /balanceMicros/, "баланс газа берётся из on-chain поля balanceMicros");
  assert.ok(!/rewardDaily[\s\S]{0,120}Стрик/.test(dash), "мёртвый стрик вернулся в обзор");
});

test("обзор лаборатории не дублирует ресурсы: один источник списка", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.ok(!/ResourceBar/.test(dash), "ResourceBar снова подключён в обзор");
  const panels = read("src/components/farm/LabHero.tsx");
  for (const key of ["DATA", "CIRCUIT", "SILICON", "POWER", "NEURON", "SYNAPSE", "SIGNAL", "MODEL"]) {
    assert.ok(panels.includes(`"${key}"`), `в панели ресурсов нет ${key}`);
  }
});

test("шапка лаборатории не распирает экран: погодный чип компактный", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.match(dash, /<WeatherWidget compact \/>/, "погода в шапке должна быть в компактном режиме");
  const widget = read("src/components/ui/WeatherWidget.tsx");
  assert.match(widget, /if \(compact\) return loadChip/, "компактный режим должен отдавать чип, а не карточку");
  assert.match(widget, /truncate/, "компактный чип обязан обрезать длинные подписи");
});

test("подписи таб-бара не налезают друг на друга", () => {
  const css = read("src/theme/forge.css");
  assert.match(css, /\.fg-dock__tab \{[^}]*min-width: 0/, "вкладка должна ужиматься");
  assert.match(css, /\.fg-dock__tab \.tab-label \{[^}]*text-overflow: ellipsis/, "подпись вкладки должна обрезаться");
  // Адаптация подписи теперь не в медиазапросе, а в clamp(): размер едет от
  // ширины экрана, поэтому «Лаборатория» влезает и на 320px, и на 520px.
  assert.match(css, /\.fg-dock__tab \.tab-label \{[^}]*font-size: clamp\(/, "нет адаптивного размера подписи");
  const bar = read("src/nav/TabBar.tsx");
  assert.match(bar, /className=\{\"fg-dock__tab\"/, "таб-бар снова не на классе капсулы");
});

test("подтабы экономики переносятся, а не обрезаются", () => {
  const css = read("src/theme/forge.css");
  assert.match(css, /\.sub-tabs \{[^}]*flex-wrap: wrap/, "подтабы должны переноситься по строкам");
});

test("декоративные эффекты отключены и не создают горизонтальный скролл", () => {
  const css = read("src/theme/forge.css");
  assert.match(css, /html \{[^}]*overflow-x: clip;/, "html должен клипать горизонтальный оверфлоу");
  // Частицы/звук manorFx удалены вместе с легаси-слоями: канвас не создаётся.
  assert.throws(() => read("src/lib/manorFx.ts"), "src/lib/manorFx.ts должен отсутствовать");
  const main = read("src/main.tsx");
  assert.ok(!main.includes("initManorFx"), "инициализация частиц вернулась в точку входа");
  assert.ok(!main.includes("mn-fx-canvas"), "канвас эффектов вернулся в точку входа");
  // Единственный слой представления: старые темы не должны вернуться.
  for (const dead of ["src/theme/globals.css", "src/theme/manor.css", "src/theme/plates.css", "src/theme/circuit.css"]) {
    assert.throws(() => read(dead), `${dead} должен отсутствовать: слой один — forge.css`);
  }
  assert.match(main, /import "\.\/theme\/forge\.css"/, "точка входа обязана подключать forge.css");
});

test("сбой одного экрана не роняет весь шелл", () => {
  const stack = read("src/nav/StackView.tsx");
  assert.match(stack, /<ErrorBoundary label=\{tabKey\}>/, "StackView должен оборачивать экран в ErrorBoundary");
  const panel = read("src/components/PrivilegesPanel.tsx");
  assert.match(panel, /DataUnavailableNotice id="privileges"/,
    "закрытый источник привилегий не должен имитировать доступный список");
  assert.match(read("../aof_backend/src/routes/privileges.ts"), /r\.get\("\/:user"[\s\S]*?res\.status\(503\)/,
    "сетевая привилегия открылась — необходимо вернуть проверяемый интерфейс");
});

test("главная заданий переведена на семь языков и не выдает награды при закрытом индексе", async () => {
  const page = code('src/pages/quests/QuestsHome.tsx');
  const backend = code('../aof_backend/src/routes/quests.ts');
  assert.match(backend, /r\.get\("\/list\/:user"[\s\S]*?res\.status\(503\)/);
  assert.match(backend, /r\.get\("\/achievements\/:user"[\s\S]*?res\.status\(503\)/);
  assert.match(page, /questsHomeCopy\[language\]/);
  assert.match(page, /DataUnavailableNotice id="quest_progress"/);
  assert.match(page, /steps=\{emptyQuestSteps\}/);
  assert.match(page, /unknown title=\{copy\.cardTitle\}/);
  assert.ok(!/api\.quests|claimQuest|RewardBurst|onClaim|<AnimatedCounter|LiquidBar|setQuests/.test(page),
    'нет подтверждённого прогресса и наград; старые кнопки не должны быть активны');
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'тексты интерфейса должны брать перевод из словаря');
  const { questsHomeCopy } = await import('../src/i18n/questsHomeCopy.ts');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    for (const [key, value] of Object.entries(questsHomeCopy[language])) {
      assert.ok(value.trim(), `${language}.${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}.${key}`);
    }
  }
});

test("экран заданий не зависает на скелете и не выдаёт отсутствие кошелька за ноль заданий", () => {
  const quests = code("src/pages/quests/QuestsHome.tsx");
  assert.match(quests, /!user && <Note quiet>\{copy\.connect\}<\/Note>/, "нужно состояние без кошелька");
  assert.ok(!/setQuests|setLoading|quests\.length === 0/.test(quests), "нельзя выдумывать пустой список или вечную загрузку");
});

test("выдуманные проценты прогресса не возвращаются", () => {
  const quests = read("src/pages/quests/QuestsHome.tsx");
  assert.ok(!/level=\{64\}/.test(quests), "хардкод 64% вернулся в челленджи");
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.ok(!/value="12\.4"/.test(dash), "хардкод метрики вернулся в обзор лаборатории");
});

test("плитка хот-маркета не изображает механику закрытой", () => {
  const market = read("src/pages/market/MarketHome.tsx");
  // Механика включена (пул + aof_core::transfer_tool): ветки «закрыто» в коде
  // быть не должно, иначе плитка снова покажет игроку ложную плашку.
  assert.ok(!/hotDisabled|isMechanicDisabled/.test(market), "плитка не должна ветвиться на «закрыто»");
  assert.match(market, /copy\.hotOpen/, "плитка обязана называть рынок открытым");
  assert.doesNotMatch(read("src/i18n/tradeNavigationCopy.ts"), /hotClosed|hotReason/,
    "тексты «недоступно» для включённой механики не нужны");
});

test("шапка сайта: кнопка меню существует и скрыта на десктопе", () => {
  const layout = read("src/site/layout/Layout.tsx");
  assert.match(layout, /site-small-button site-menu-toggle/, "класс site-menu-toggle отсутствовал в разметке");
  const css = read("src/site/styles/site.css");
  assert.match(css, /\.site-desktop-nav details:last-child \.site-nav-panel/, "панель меню выезжала за экран");
});

test("плитки ресурсов на сайте переносят длинные названия", () => {
  const css = read("src/site/styles/site.css");
  assert.match(css, /\.site-icon-strip__item small \{[^}]*overflow-wrap: anywhere/, "«Вычислительный цикл» вылезал из плитки");
});

test("участок показывает постройки, а не сырые плашки NFT", () => {
  const plot = read("src/pages/farm/FarmPlot.tsx");
  assert.match(plot, /buildingFor\(tool\.toolType\)\?\.icon/, "тайл должен рисовать постройку");
  assert.match(plot, /conditions\[weatherState\.type\]/, "погода должна показываться человеческими подписями выбранного языка");
  assert.match(plot, /Object\.values\(WEATHER_BY_INDEX\)/, "скорость станции берётся из правила сети");
  assert.ok(!/well_water_rate_15_per_hour" \|\| ""/.test(plot), "служебный ключ эффекта вернулся в подпись");
  const buildings = read("src/lib/buildings.ts");
  for (const t of ["plasma_cutter", "silicon_extractor", "data_harvester", "quantum_transmitter", "neural_seeder"]) {
    assert.ok(buildings.includes(t), `нет постройки для ${t}`);
  }
});

test("погода читается из одного канонического источника во всех панелях", () => {
  const weather = read("src/lib/weather.ts");
  // Формула дня — зеркало aof-core/src/state.rs::weather_for_day.
  const rust = read("../aof-core/src/state.rs");
  assert.match(rust, /weather_for_day/, "нет weather_for_day в ядре — обновить lib/weather.ts");
  const rustMultiplier = rust.match(/wrapping_mul\(0x([0-9A-Fa-f_]+)\)/);
  assert.ok(rustMultiplier, "не найден множитель хеша дня в Rust");
  const hex = rustMultiplier![1].replace(/_/g, "").toLowerCase();
  assert.equal(hex, "9e3779b97f4a7c15", "множитель weather_for_day изменился — обновить зеркало в UI");
  assert.match(weather, /0x9e3779b97f4a7c15n/, "зеркало множителя пропало из lib/weather.ts");
  // Пороги 10/50/30/10 из Rust должны совпадать с зеркалом.
  const rustBands = rust.match(/0\.\.=9[\s\S]{0,80}10\.\.=59[\s\S]{0,80}60\.\.=89/);
  assert.ok(rustBands, "полосы распределения погоды изменились");
  assert.match(weather, /bucket <= 9\) return 0/, "полоса блэкаута не совпадает с цепью");
  assert.match(weather, /bucket <= 59\) return 1/, "полоса номинала не совпадает с цепью");
  assert.match(weather, /bucket <= 89\) return 2/, "полоса скачка не совпадает с цепью");
  // 64-битное умножение с маской, сдвиг на 32 и остаток по 100 — без этих трёх
  // шагов зеркало перестаёт совпадать с Rust при любых полосах.
  assert.match(weather, /& 0xffffffffffffffffn/, "в зеркале пропала маска u64");
  assert.match(weather, />> 32n/, "в зеркале пропал сдвиг на 32 бита");
  assert.match(weather, /% 100n/, "в зеркале пропал остаток по 100");

  // Шапка, обзор и колодец обязаны ходить через общий загрузчик.
  for (const file of [
    "src/components/ui/WeatherWidget.tsx",
    "src/pages/farm/FarmDashboard.tsx",
    "src/pages/farm/WellPanel.tsx",
  ]) {
    assert.match(read(file), /fetchWeatherSnapshot/, `${file} снова читает погоду по-своему`);
    assert.ok(!/api\.weather\.current\(\)/.test(read(file)), `${file} дублирует прямой вызов /weather/current`);
  }
  // /weather/forecast сервит то же правило дня, но виджет считает прогноз
  // локально: незачем ходить в сеть за тем, что следует из номера дня.
  assert.ok(!/api\.weather\.forecast/.test(read("src/components/ui/WeatherWidget.tsx")),
    "прогноз снова берётся из сети, хотя он следует из расписания дня");
  assert.match(read("src/components/ui/WeatherWidget.tsx"), /forecastFromDayId/,
    "прогноз должен считаться из расписания дня");

  // Погода дня известна всегда: аккаунт WeatherState — подтверждение, а не
  // условие показа. Загрузчик обязан уметь посчитать день сам.
  assert.match(weather, /currentDayId/, "у загрузчика нет номера дня из часов");
  assert.match(weather, /source: "canonical-schedule"/, "значение из правила дня не помечается");
  assert.ok(!/Promise<WeatherSnapshot \| null>/.test(weather),
    "загрузчик снова объявляет погоду неизвестной без аккаунта в сети");
  assert.match(read("src/components/ui/WeatherWidget.tsx"), /text\.scheduleNote/,
    "интерфейс обязан отличать правило дня от подтверждения сетью");
});

test("503 не выглядит как настоящие данные", () => {
  const availability = read("src/lib/availability.tsx");
  assert.match(availability, /isFailClosedCode/, "нет проверки fail-closed кодов");
  const api = read("src/lib/api.ts");
  assert.match(api, /error\.failClosed = isFailClosedCode\(raw\)/,
    "api.ts должен помечать 503 до очеловечивания текста, иначе UI не отличит сбой сети от закрытой механики");
  assert.match(api, /humanizeApiError/, "сырые коды бэкенда снова попадут игроку");

  // Балансы: прочерк/сообщение вместо нулей (ResourceBar удалён как мёртвый —
  // балансы показывают живые панели).
  const lab = read("src/components/farm/LabHero.tsx");
  assert.match(lab, /unavailable \? "—"/, "стойка образцов показывает нули при 503");
  const overview = read("src/pages/economy/ResourceOverview.tsx");
  const economyCopy = read("src/i18n/economyDetailCopy.ts");
  assert.match(economyCopy, /unavailable: 'Балансы ресурсов недоступны из сети'/,
    "обзор ресурсов обязан честно сообщать о недоступности вместо нулей");
  assert.match(economyCopy, /loading: 'Читаем балансы из сети…'/,
    "до первого ответа игрок должен видеть загрузку, а не ложную недоступность");
  assert.match(overview, /copy\.unavailable/);
  assert.match(overview, /copy\.loading/);
  assert.match(read("src/pages/economy/useEconomyBalances.ts"), /readEconomyBalances\(raw\)/,
    "балансы должны проверяться до отображения");

  // Ежедневная награда: мёртвая кнопка «Завтра» не возвращается.
  const daily = read("src/components/DailyRewardButton.tsx");
  assert.match(daily, /DataUnavailableNotice id="daily_rewards"/, "нет честного сообщения вместо кнопки");
  assert.ok(!/api\.daily\.(status|claim)|nextReward|onClick=\{claim\}/.test(daily),
    "закрытая ежедневная награда не должна показывать выдуманный баланс или предлагать получение");
  const dailyRoute = read("../aof_backend/src/routes/daily.ts");
  assert.match(dailyRoute, /r\.get\("\/status\/:user"[\s\S]+res\.status\(503\)/,
    "серверный статус награды изменился — сверить UI");
  assert.match(dailyRoute, /r\.post\("\/claim"[\s\S]+res\.status\(503\)/,
    "сервер включил получение награды — вернуть проверяемый интерфейс");
  assert.match(read("src/lib/availability.tsx"), /unavailableDataCopy\[language\]\[id\]/,
    "причина отключения должна переводиться при смене языка");
});

test("ремонт проверяется до отрисовки кнопки", () => {
  const repair = read("src/pages/tools/RepairPage.tsx");
  assert.match(repair, /repairState/, "нет состояния готовности ремонта");
  assert.match(repair, /api\.query\.config\(\)/, "готовность должна проверяться по Config, как в /tools/repair");
  assert.match(repair, /FeatureDisabledNotice id="tools_repair"/, "нет объяснения, почему ремонт закрыт");
  assert.match(repair, /disabled=\{repairState !== "ready"/, "кнопка ремонта снова активна при закрытой механике");
  assert.ok(!/>\s*Durability\s*</.test(repair), "английское «Durability» вернулось в русский интерфейс");
  const notice = read("src/components/ui/FeatureDisabledNotice.tsx");
  assert.match(notice, /tools_repair/, "список закрытых механик разошёлся с бэкендом");
  assert.match(read("../aof_backend/src/routes/tools.ts"), /REPAIR_RESOURCES_NOT_CONFIGURED/,
    "код REPAIR_RESOURCES_NOT_CONFIGURED исчез из бэкенда — проверить список механик");
});

test("эмодзи не выводятся текстом: плашки вместо символов", () => {
  const notice = read("src/components/visual/NoticeMsg.tsx");
  for (const emoji of ["↩️", "⏸️", "🔥"]) {
    assert.ok(notice.includes(emoji), `нет маппинга для ${emoji}`);
  }
  for (const file of [
    "src/components/DrumSpin.tsx",
    "src/components/animations/RewardBurst.tsx",
    "src/pages/quests/QuestsHome.tsx",
    "src/pages/tools/CraftPage.tsx",
    "src/pages/market/OfferPage.tsx",
  ]) {
    assert.ok(!/>(?:✅|🎉|❌|🏷️|🤝|💬|⚠️)</.test(read(file)),
      `${file} снова рисует эмодзи как иконку`);
  }
});

test("закрытые механики объясняются единым текстом, а кнопки без эмодзи-подписей", () => {
  const profile = read("src/pages/profile/ProfileHome.tsx");
  // [§3.4] Перерождение вышло из списка закрытых: у него своя панель, которая
  // читает цену/кулдаун/излишки из сети и подписывает полный сброс.
  assert.match(profile, /<RebirthPanel \/>/,
    "перерождение обязано показывать живую панель, а не заглушку");
  assert.ok(!/FeatureDisabledNotice id="rebirth"/.test(profile),
    "перерождение больше не закрытая механика: заглушка вернулась");
  const noticeSource = read("src/components/ui/FeatureDisabledNotice.tsx");
  const disabledBlock = noticeSource.slice(
    noticeSource.indexOf("export const DISABLED_MECHANICS = {"),
    noticeSource.indexOf("} as const;"),
  );
  assert.ok(!/rebirth:/.test(disabledBlock), "rebirth всё ещё в DISABLED_MECHANICS");
  const mining = read("src/components/ToolMiningCard.tsx");
  for (const label of ['"⏸️ Сбор отключён', '"⏸️ Добыча отключена до проверки в сети"', '"↩️ Вернуть']) {
    assert.ok(!mining.includes(label), `эмоji-подпись в JSX-кнопке вернулась: ${label}`);
  }
  // Flash остаётся с эмодзи — его разбирает NoticeMsg.
  assert.match(mining, /flashMsg\(`⏸️ \${copy.disabledMining}`\)/, "flash-сообщение должно брать переведённую причину из общего словаря");
});

test("барабан показывает локализованные статусы, а ошибка чтения журнала не считается пустым списком", async () => {
  const drum = read("src/components/DrumSpin.tsx");
  assert.match(drum, /drumCopy\[language\]/);
  assert.match(drum, /actionErrorFeedback\(error, currentLanguage, drumCopy\[currentLanguage\]\.uncertain\)/);
  assert.match(drum, /walletRef\.current !== address/);
  assert.match(drum, /Number\.isFinite\(s\.prize\)/);
  assert.ok(!drum.includes('toLocaleString("ru-RU")'));
  const { drumCopy } = await import("../src/i18n/drumCopy.ts");
  for (const language of ["en", "pt", "es", "vi", "id", "fil", "ru"] as const) {
    const copy = drumCopy[language];
    for (const key of ['title', 'spin', 'reveal', 'uncertain', 'paid', 'oracle'] as const) {
      assert.ok(copy[key]);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy[key]));
    }
    for (const key of ['cost', 'revealed', 'refunded'] as const) {
      assert.ok(copy[key]('7').includes('7'));
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy[key]('7')));
    }
  }
  const audit = read('src/pages/admin/AuditLogPage.tsx');
  assert.match(audit, /if \(readFailed\)/);
  assert.match(audit, /setReadFailed\(true\)/);
  assert.match(audit, /if \(!Array\.isArray\(data\)\)/);
  assert.match(audit, /filteredLogs\.length === 0/);
});

test("барабан удачи называет ресурс канонически", () => {
  const drum = read("src/components/DrumSpin.tsx");
  assert.ok(!/MASCOT/.test(drum), "легаси-термин MASCOT вернулся в интерфейс");
  assert.doesNotMatch(drum, /resourceIcon\("MIND"\)|[} ] MIND</, "MIND is not offered by the legacy drum UI");
  assert.match(drum, /copy\.unavailable/);
  assert.ok(!/🔻/.test(drum), "эмодзи-стрелка вернулась на барабан");
  // ↩️ допустим только как префикс flash-сообщения — его разбирает NoticeMsg.
  assert.ok(!/>\s*↩️/.test(drum), "↩️ снова рисуется как символ, а не плашкой");
});

test("UI узнаёт реальные fail-closed коды бэкенда", () => {
  const availability = read("src/lib/availability.tsx");
  const literal = availability.match(/const FAIL_CLOSED_PATTERN =\s*\/(.+?)\//s);
  assert.ok(literal, "не найден FAIL_CLOSED_PATTERN");
  const pattern = new RegExp(literal![1]);
  // Коды взяты из aof_backend/src/routes/* как есть — с суффиксами _UNTIL_...
  for (const code of [
    "DAILY_REWARDS_UNAVAILABLE_UNTIL_ONCHAIN_MIND_REWARD_IS_DEPLOYED",
    "QUEST_PROGRESS_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
    "REPAIR_RESOURCES_NOT_CONFIGURED",
    "MINING_DISABLED_ONCHAIN",
    "ENERGY_SPEND_MUST_USE_CANONICAL_GAME_INSTRUCTION",
    "LEGACY_REWARD_REQUIRES_RECONCILIATION",
    "HTTP 503",
  ]) {
    assert.ok(pattern.test(code), `код ${code} не распознан как fail-closed`);
  }
  for (const text of ["Failed to fetch", "SwitchboardAccountNotFound", "HTTP 500"]) {
    assert.ok(!pattern.test(text), `обычная ошибка «${text}» принята за закрытую механику`);
  }
});

test("пути api.ts совпадают с монтированием роутов бэкенда", () => {
  const api = read("src/lib/api.ts");
  // Клиент звал /season/vip-status/:user, а роут живёт на /season/:user —
  // из-за этого VIP-статус молча не находился.
  assert.match(api, /current: \(\) => get\('\/season\/current'\)/,
    "источник текущего сезона пропал из API");
  assert.match(api, /vipStatus: \(user: string, seasonId\?: number\)/,
    "VIP-статус должен быть привязан к проверенному seasonId");
  const vip = read("../aof_backend/src/routes/vipStatus.ts");
  assert.match(vip, /r\.get\("\/current"/, "бэкенд перестал выдавать текущий сезон");
  assert.match(vip, /r\.get\("\/:user"/, "бэкенд переименовал роут vipStatus — обновить api.ts");
  const server = read("../aof_backend/src/server.ts");
  assert.match(server, /app\.use\("\/season", vipStatus\)/, "vipStatus больше не смонтирован на /season");
});

test("сбой чтения инвентаря не выглядит как пустой участок", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.match(dash, /const \[staked, setStaked\] = useState<any\[\] \| null>\(null\)/,
    "staked обязан различать «неизвестно» и «ноль»");
  assert.match(dash, /staked === null/, "чип «построек» не показывает неизвестность");
  assert.match(dash, /toolsFailed\s*\? overview\.unknownTools/,
    "карта участка обязана объяснять недоступность, а не молчать");
  const overview = read("src/i18n/farmOverviewCopy.ts");
  assert.match(overview, /unknownTools: 'Не удалось прочитать инструменты из сети/,
    "словарь обязан объяснять недоступность инструментов");
  const plot = read("src/pages/farm/FarmPlot.tsx");
  assert.match(plot, /setTools\(null\)/, "ошибка myTools не должна давать пустой массив");
  assert.match(plot, /!address \|\| toolsFailed \? "—" : tools === null \? "…" : staked\.length/,
    "сводка «Построек на участке» должна показывать —/… вместо 0");
  const home = read("src/pages/tools/ToolsHome.tsx");
  assert.match(home, /copy.inventoryUnavailable/,
    "ToolsHome при сбое обязан показывать переведённую ошибку чтения");
  assert.match(home, /if \(!Array.isArray\(items\)\) throw/,
    "неожиданный ответ myTools не должен превращаться в пустой инвентарь");
  assert.match(home, /knownTools = address && loadedAddress === address && !loading \? tools : null/,
    "данные другого кошелька или незаконченного чтения не должны появиться на стойке");
  const repair = read("src/pages/tools/RepairPage.tsx");
  assert.match(repair, /knownTools !== null && knownTools.length === 0/,
    "RepairPage при сбое говорит «инструментов нет»");
  assert.match(repair, /if \(!Array.isArray\(a\)\) throw/, "неожиданный ответ myTools не должен выглядеть как пустой инвентарь");
});

test("кошелёк: Wallet Standard и мобильный deep-link в Phantom", () => {
  const wallet = read("src/lib/wallet.ts");
  assert.match(wallet, /navigator\.wallets/, "detectWallet обязан читать реестр Wallet Standard");
  assert.match(wallet, /standardProvider/, "стандартные кошельки оборачиваются провайдером");
  assert.match(wallet, /standard:connect/, "без standard:connect подключение не работает");
  assert.match(wallet, /solana:signMessage/, "без solana:signMessage не подписываются walletProof");
  assert.match(wallet, /solana:signAndSendTransaction/, "без solana:signAndSendTransaction не уходят транзакции");
  assert.match(wallet, /provider\.signTransaction\(tx\)/, "Phantom должен только подписать частично подписанную транзакцию");
  assert.match(wallet, /connection\.sendRawTransaction\(raw/, "отправка идёт через RPC игры, не через signAndSendTransaction Phantom");
  assert.match(wallet, /phantom\.app\/ul\/browse/, "mobile deep-link обязан собираться по документации Phantom");
  assert.match(wallet, /encodeURIComponent/, "целевой URL в deep-link кодируется");
  const btn = read("src/components/ui/WalletButton.tsx");
  assert.match(btn, /phantomBrowseLink/, "без кошелька на мобильном кнопка обязана вести в Phantom");
  assert.match(btn, /isMobileBrowser/, "deep-link показывается только на мобильном");
  assert.match(btn, /hasWalletSupport/, "проверка наличия кошелька до показа ссылки");
});

test("мёртвый код не возвращается: wallet-adapter-шелл и lib/ws вычищены", () => {
  const app = read("src/App.tsx");
  assert.ok(!app.includes("AppWalletProvider"), "AppWalletProvider вернулся в App — он не имел ни одного потребителя");
  assert.ok(!app.includes("wallet/WalletProvider"), "модуль WalletProvider был удалён");
  assert.throws(
    () => read("src/wallet/WalletProvider.tsx"),
    "src/wallet/WalletProvider.tsx должен отсутствовать"
  );
  assert.throws(() => read("src/lib/ws.ts"), "src/lib/ws.ts должен отсутствовать — никто его не импортировал");
  const pkg = JSON.parse(read("package.json"));
  assert.ok(!pkg.dependencies["socket.io-client"], "socket.io-client больше не используется фронтендом");
  const store = read("src/store/walletStore.ts");
  assert.match(store, /import\("\.\.\/lib\/wallet"\)/, "web3.js-адаптер грузится только по действию игрока");
});

test("code-split по вкладкам закреплён: ленивые чанки и prefetch", () => {
  const chunks = read("src/nav/tabChunks.ts");
  assert.match(chunks, /lazy\(/, "вкладки обязаны грузиться через React.lazy");
  assert.match(chunks, /prefetchTab/, "переход должен прогревать соседний чанк");
  for (const key of ["farm", "tools", "economy", "market", "quests", "profile"]) {
    assert.ok(chunks.includes(`${key}: lazy(`) || chunks.includes(`${key}: lazy (`), `вкладка ${key} не ленивая`);
  }
  const app = read("src/App.tsx");
  assert.match(app, /Suspense/, "корни вкладок обёрнуты в Suspense со скелетом");
  const bar = read("src/nav/TabBar.tsx");
  assert.match(bar, /prefetchTab\(t\.key\)/, "наведение/тап на таб запускает prefetch");
  const pager = read("src/nav/TabPager.tsx");
  assert.match(pager, /live\[k\]/, "пейджер монтирует только «живые» вкладки");
});

test("палитра «Морозное стекло» живёт в одном файле", () => {
  const forge = read("src/theme/forge.css");
  assert.match(forge, /--fg-glow: #5FC9DA/, "акцент палитры A должен быть объявлен в forge.css");
  assert.match(forge, /--fg-void: #0B0D11/, "фон палитры A должен быть объявлен в forge.css");
  // Комментарии в конфиге объясняют, что именно удалено, — проверяем стек, а не прозу.
  const tw = read("tailwind.config.js").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/Rajdhani|Orbitron|Playfair/.test(tw), "удалённые шрифты вернулись в конфиг Tailwind");
  assert.match(tw, /aof: \{[\s\S]*var\(--fg-/, "утилиты aof.* должны читать токены, а не свои значения");
  const fonts = read("src/ui/fonts.ts");
  assert.match(fonts, /@fontsource\/manrope/, "Manrope не подключён");
  assert.match(fonts, /@fontsource\/exo-2/, "Exo 2 не подключён");
  const fontImports = fonts.split("\n").filter((line) => line.trim().startsWith("import")).join("\n");
  assert.ok(!/playfair|inter\//i.test(fontImports), "удалённые шрифты вернулись в fonts.ts");

  // Старый неон не должен вернуться ни в разметку, ни в данные инструментов.
  const legacy = /#00D4FF|#00E5A0|#9B59FF|#FFD700|#FF3366|#FF3CAC/i;
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (rel === "src/site") continue; // сайт переводится своим слоем, см. site.css
        walk(rel);
      } else if (/\.(ts|tsx)$/.test(entry.name) && legacy.test(read(rel))) {
        offenders.push(rel);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, [], `легаси-неон вернулся: ${offenders.join(", ")}`);
});

test("все восемь приборов набора подключены к экранам на реальных данных", () => {
  // Прибор → экран. Если экран перестанет собирать прибор на данных, тест
  // упадёт: набор не должен снова стать набором макетов.
  const wiring: [string, string, string][] = [
    ["CryoRack", "src/components/farm/LabHero.tsx", "криобанк на герое «Твоя лаборатория»"],
    ["MixerStrips", "src/pages/tools/ToolsHome.tsx", "пульт на инструментах"],
    ["EchoTrace", "src/pages/farm/FarmDashboard.tsx", "эхолот в журнале смены"],
    ["SonarPPI", "src/pages/market/ListingPage.tsx", "сонар на прилавках рынка"],
    ["PlateGrid", "src/pages/farm/FarmDashboard.tsx", "микропланшет на участке"],
    ["GelLanes", "src/pages/economy/ResourceOverview.tsx", "гель на складе"],
    ["CrossPanel", "src/pages/inbox/InboxHome.tsx", "кросс-панель на сообщениях"],
    ["PunchedCard", "src/pages/quests/QuestsHome.tsx", "перфокарты на заданиях"],
    ["DrumChart", "src/components/farm/WeatherRecorder.tsx", "барограф на сетевой станции"],
  ];
  for (const [device, file, why] of wiring) {
    assert.match(read(file), new RegExp(`<${device}\\b`), `${why}: ${device} не вызывается из ${file}`);
  }

  // Приборы не рисуют данные из воздуха: у каждого состояния «нет данных»
  // есть прочерк или честная подпись.
  assert.match(read("src/components/farm/WeatherRecorder.tsx"), /dash=\{!/, "барограф обязан показывать прочерк без данных");
  assert.match(read("src/i18n/economyDetailCopy.ts"), /noBands: 'Все позиции пусты — полос нет/, "гель обязан говорить о пустом складе словами");
  assert.match(read("src/pages/economy/ResourceOverview.tsx"), /copy\.noBands/, "гель обязан брать сообщение из словаря");
  assert.match(read("src/pages/inbox/InboxHome.tsx"), /<Note quiet>\{copy\.empty\}<\/Note>/, "кросс-панель обязана говорить о подтверждённо пустом ящике словами на выбранном языке");
  assert.match(read("src/pages/market/ListingPage.tsx"), /listings\.length > 0 &&/, "сонар не должен рисоваться без загруженных лотов");
  // Каждый прибор набора умеет честно молчать: у эхолота пустая лента — это
  // прямая линия дна без развёртки, а не нарисованный график.
  assert.match(read("src/ui/forge/devices.tsx"), /depth === null/, "эхолот обязан различать «нет данных» и глубину");
  const devices = read("src/ui/forge/devices.tsx");
  for (const banned of [/Math\.random/, /hardcode/i]) {
    assert.ok(!banned.test(devices), "в приборах не должно быть выдуманных значений");
  }
});

test("в интерфейсе нет дев-лексики: игрок читает игровой язык", () => {
  // Аудит §7: «каноническая сеть», «индексатор», «деплой», «ончейн», коды API
  // и названия инструкций не должны попадать в текст для игрока. Технические
  // строки остаются только там, где их читает поддержка: админ-консоль,
  // правовые документы, поле guard закрытых механик и сам слой доступности.
  const banned = /\bканоническ|\bончейн|on-chain|\bиндексатор|\bдеплой|\bбэкенд|\bPDA\b|\bконфиг|\bmint\b|\b503\b|\bтранзакц|\bапдейт/i;
  const skip = [
    "src/site/", "src/legal/", "src/pages/admin/", "src/ui/forge/",
    // Витрина приборов — служебный экран для команды: там допустимы слова
    // «слайд», «код», «файл». Игрок его не читает.
    "src/gallery/",
  ];
  const offenders: string[] = [];
  for (const file of walkApp()) {
    if (skip.some((prefix) => file.startsWith(prefix)) || file === "src/lib/availability.tsx") continue;
    const lines = read(file).split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (trimmed.startsWith("import") || trimmed.includes("guard:")) return;
      const found = line.match(/"([^"\n]{12,})"|>([^<>{}\n]{12,})</g) || [];
      for (const raw of found) {
        const text = raw.replace(/^["'>]|["'<]$/g, "");
        // Только человеческие фразы: с пробелом и кириллицей.
        if (!/[А-Яа-яЁё]/.test(text) || !text.includes(" ")) continue;
        if (banned.test(text)) offenders.push(`${file}:${i + 1}: ${text.slice(0, 80)}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `дев-лексика вернулась в тексты:\n${offenders.join("\n")}`);
});

function walkApp(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(rel);
    }
  };
  walk("src");
  return out;
}

test("экран вкладки не схлопывается в нулевую высоту (чёрный экран с одним доком)", () => {
  // Дефект 2026-09-28: при сведении четырёх слоёв в forge.css у .page-stack
  // пропала высота. Стек занимал 0 px, .page с position:absolute не имел
  // размеров — игрок видел только нижний док на чёрном фоне. Держим цепочку
  // высот целиком: html/body/#root → пейджер (inline height:100%) → .page-stack → .page.
  const css = read("src/theme/forge.css");
  assert.match(css, /html, body, #root \{[^}]*height: 100%/, "высотная цепочка html/body/#root потеряна");
  assert.match(css, /\.page-stack \{[^}]*height: 100%/, ".page-stack обязан получать высоту процентом");
  assert.match(css, /\.page-stack \{[^}]*min-height: 0/, ".page-stack должен позволять сжатие во flex-колонке");
  assert.match(css, /\.page \{[^}]*position: absolute/, ".page обязан растягиваться по стеку вкладки");
  const pager = read("src/nav/TabPager.tsx");
  assert.match(pager, /height: "100%"/, "пейджер вкладок обязан задавать высоту цепочке");
});

test("совместимые классы сохраняют раскладку, а не только цвет", () => {
  // Тот же свод четырёх слоёв потерял объявления геометрии: кладовая, каталог
  // ресурсов, рецепты и подтабы разъезжались. Проверяем именно раскладку.
  const css = read("src/theme/forge.css");
  const layout: Array<[string, RegExp, string]> = [
    ["resource-card", /\.resource-card \{[^}]*display: flex/, "карточка ресурса обязана быть строкой"],
    ["resource-icon", /\.resource-icon \{[^}]*justify-content: center/, "иконка ресурса должна центрироваться"],
    ["resource-label", /\.resource-label \{[^}]*text-overflow: ellipsis/, "подпись ресурса должна обрезаться"],
    ["pantry-item", /\.pantry-item \{[^}]*display: flex/, "строка кладовой обязана быть строкой"],
    ["pantry-item-info", /\.pantry-item-info \{[^}]*min-width: 0/, "тексту кладовой нужно сжатие"],
    ["pantry-filter", /\.pantry-filter \{[^}]*justify-content: center/, "фильтр кладовой должен центрироваться"],
    ["sub-tab-btn", /\.sub-tab-btn \{[^}]*display: flex/, "подтаб обязан быть строкой"],
    ["recipe-btn", /\.recipe-btn \{[^}]*width: 100%/, "кнопка рецепта обязана занимать строку"],
    ["economy-root", /\.economy-root \{[^}]*padding: 12px/, "экономике нужен внутренний отступ"],
    ["economy-empty", /\.economy-empty \{[^}]*text-align: center/, "пустое состояние экономики центрируется"],
    ["workshop-msg", /\.workshop-msg \{[^}]*padding: 10px/, "сообщению мастерской нужен отступ"],
  ];
  for (const [name, re, why] of layout) assert.match(css, re, `${name}: ${why}`);
});

test("фоновая сцена вкладки видна: слой не уходит за фон документа", () => {
  // Жалоба 2026-09-28: «фоновые картинки пропали». Ассеты были целы — сцена
  // вкладки лежала в слое с отрицательным z-index и уходила за непрозрачный
  // фон body, потому что у оболочки не было своей системы наложения.
  const css = read("src/theme/forge.css");
  assert.match(css, /\.app-shell \{[^}]*isolation: isolate/, "оболочке нужна изоляция слоёв, иначе фон вкладок исчезает");
  const scene = css.match(/\.nf-scene img \{[^}]*\}/s);
  assert.ok(scene, "правило .nf-scene img потеряно");
  const opacity = Number((scene![0].match(/opacity:\s*([\d.]+)/) || [])[1]);
  assert.ok(opacity >= 0.28, `сцена вкладки слишком бледная: opacity ${opacity}`);
  const veil = css.match(/\.nf-scene::after \{[^}]*\}/s);
  assert.ok(veil, "затемняющий слой сцены потерян");
  const top = Number((veil![0].match(/--fg-void\) (\d+)%/) || [])[1]);
  assert.ok(top <= 55, `затемняющий слой закрывает сцену: ${top}% сверху`);
  const assets = readdirSync(join(root, "public/assets/backgrounds"));
  assert.ok(assets.filter((f: string) => f.endsWith(".jpg")).length >= 10, "ассеты фонов пропали");
});

test("приборы стоят на своих вкладках и без кошелька", () => {
  // Тот же разбор: приборы К5, К7, К10 и эхолот рынка показывались только при
  // подключённом кошельке и непустых данных, поэтому «жили» лишь в лаборатории.
  const tools = read("src/pages/tools/ToolsHome.tsx");
  assert.ok(!/address && tools !== null && tools\.length > 0/.test(tools), "пульт К5 снова спрятан за кошелёк");
  assert.match(tools, /<MixerStrips/, "пульт К5 обязан стоять на экране мастерской");
  assert.match(tools, /rackNote/, "у пульта обязана быть честная подпись пустого состояния");

  const quests = read("src/pages/quests/QuestsHome.tsx");
  assert.match(quests, /<PunchedCard unknown [^>]*steps=\{emptyQuestSteps\}/, "перфокарта К10 обязана показывать неизвестный прогресс без ложного 0\/12");
  assert.match(read("src/ui/forge/devices.tsx"), /unknown \? '— \/ —' : `\$\{done\}\/\$\{steps\.length\}`/);

  const market = read("src/pages/market/MarketHome.tsx");
  assert.match(market, /<SonarPPI/, "эхолот рынка обязан стоять на входе, а не только в витрине");

  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.match(dash, /emptyPlateWells/, "планшет К7 обязан показывать пустые лунки без инструментов");
});

test("инструментальная палитра описывает все 8 аппаратов и 50 слайдов", async () => {
  // Владелец 2026-09-28: «непонятно, где используются новые панели». Палитра
  // `/visual` — витрина приборов на живом коде плюс карта «прибор → вкладка».
  const gallery = read("src/gallery/VisualGallery.tsx");
  const ids = gallery.match(/\bid: "[a-z]+-\d{2}"/g) || [];
  assert.equal(ids.length, 50, `в палитре должно быть 50 слайдов, найдено ${ids.length}`);
  assert.match(gallery, /vg-demo/, "слайды с показательными числами обязаны быть помечены");
  assert.match(gallery, /copy\.chrome\.where/, "слайд обязан говорить, где прибор стоит в игре");

  const { DEVICE_MAP } = await import('../src/gallery/deviceMap.ts');
  const { galleryCopy } = await import('../src/i18n/galleryCopy.ts');
  assert.equal(DEVICE_MAP.length, 9, '8 devices plus the panel frame');
  for (const entry of DEVICE_MAP) {
    assert.ok(entry.file && entry.purpose, `${entry.key}: source and description required`);
    for (const file of entry.file.split(', ')) {
      assert.ok(existsSync(join(root, file)), `device map points to a missing file: ${file}`);
    }
    for (const field of ['name', 'tab', 'sub', 'purpose'] as const) {
      assert.equal(entry[field], galleryCopy.ru.devices[entry.key][field], `${entry.key}: source and gallery diverged`);
    }
  }
  const generated = readFileSync(join(root, '../docs/UI_DEVICE_MAP_2026-09-28.md'), 'utf8');
  for (const entry of DEVICE_MAP) if (entry.key !== 'frame') {
    assert.ok(generated.includes(`| ${entry.name} | ${entry.tab} | ${entry.sub} | ${entry.purpose} |`),
      `${entry.key}: the generated documentation is stale`);
  }
  assert.ok(!generated.includes('96 лунок'), 'the live rack plate has 6 × 8 slots, not 96');
  assert.match(read("src/main.tsx"), /path="\/visual"/, "витрина приборов должна открываться по /visual");
});

test("состояния статусов берут цвета из палитры A, а не из молчаливых классов", () => {
  // Разметка звала text-gold-400, bg-ember-500 и text-info-400 — таких ступеней
  // в палитре не было, и статусные окна рендерились нейтральными.
  const cfg = read("tailwind.config.js");
  for (const step of ["gold", "ember"]) {
    assert.match(cfg, new RegExp(`${step}: \\{[^}]*DEFAULT: "#`), `${step}: нужна ступенчатая палитра с DEFAULT`);
  }
  assert.match(cfg, /info: \{ 400: "#/, "info-400 вызывается из разметки и обязан существовать");
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (entry.name.endsWith(".tsx")) out.push(rel);
    }
    return out;
  };
  const missing: string[] = [];
  for (const file of walk("src")) {
    const text = read(file);
    for (const m of text.matchAll(/\b(?:text|bg|border|from|to|via)-(gold|ember|info|sprout|soil|nf)-([a-z0-9]+)\b/g)) {
      const token = m[0];
      const family = m[1];
      const step = m[2];
      const allowed =
        family === "gold" || family === "ember"
          ? ["300", "400", "500", "600", "700", "900", "DEFAULT"].includes(step)
          : family === "info"
            ? ["400", "500", "600"].includes(step)
            : family === "sprout"
              ? ["500", "600", "700"].includes(step)
              : true;
      if (!allowed) missing.push(`${file}: ${token}`);
    }
  }
  assert.deepEqual(missing, [], `разметка зовёт цвета, которых нет в палитре:\n${missing.join("\n")}`);
});

test("ящик требует подтверждение кошелька и не раскрывает письма по публичному адресу", async () => {
  const backend = code('../aof_backend/src/routes/inbox.ts');
  const api = code('src/lib/api.ts');
  const page = code('src/pages/inbox/InboxHome.tsx');
  assert.match(backend, /r\.post\("\/list", requireWalletProof\("inbox_list", "user"\)/);
  assert.ok(!/r\.get\("\/:user"/.test(backend), 'публичное чтение писем запрещено');
  assert.match(api, /\{ path: "\/inbox\/list", subject: "inbox_list", field: "user" \}/);
  assert.match(api, /list: \(user: string\) => post\("\/inbox\/list", \{ user \}\)/);
  assert.match(page, /if \(!data \|\| typeof data !== 'object'/);
  assert.match(page, /readState\?\.owner === user/);
  assert.match(page, /state !== 'ready'/);
  assert.ok(!page.includes('.catch(() => setLetters([]))'));
  assert.match(page, /res\.item\.claimState === 'confirmed'/);
  assert.match(page, /res\.recoveredFromReceipt/);
  assert.match(page, /confirmed\.onchainSig/);
  assert.match(page, /disabled=\{claimBusy\}/);
  assert.match(page, /quote: res\.payerQuote/);
  assert.match(page, /validatePayerQuoteForIntent\(intent, new PublicKey\(user\)\)/);
  assert.match(page, /role="group" aria-labelledby="inbox-claim-quote-title"/);
  assert.match(page, /copy\.quoteRent\(formatLamportsAsSol\(quote\.rentLamports, language\)/);
  assert.match(page, /copy\.quoteFee\(formatLamportsAsSol\(quote\.networkFeeLamports, language\)/);
  assert.match(page, /copy\.quoteMax\(formatLamportsAsSol\(quote\.maxCostLamports, language\)/);
  assert.match(page, /const sent = await handleTxResponse\(prepared\.response, prepared\.intent\)/);
  assert.match(page, /if \(prepared\?\.user === user && prepared\?\.letterId === letter\?\.dbId\) \{\s*await confirmRewardClaim\(letter\);\s*\} else \{\s*await prepareRewardClaim\(letter\);/);
  assert.ok(!page.includes('handleTxResponse(res)'), 'ответ API без подтверждения выдачи не является успехом');
  assert.ok(!page.includes('setClaimStatus(`${e.message}`)'), 'сырые ошибки не показываются игроку');
  const { inboxReadCopy, inboxUiCopy } = await import('../src/i18n/inboxReadCopy.ts');
  assert.match(page, /inboxUiCopy\[language\]/);
  assert.match(page, /readCopy\[claimStatus\]/);
  assert.match(page, /item\.claimState === 'confirmed'/);
  assert.match(page, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
  assert.match(page, /ariaLabel=\{copy\.panelTitle\}/);
  const crossPanel = code('src/ui/forge/devices.tsx');
  assert.match(crossPanel, /aria-label=\{ariaLabel \?\? copy\.crossPanel\}/);
  assert.match(crossPanel, /textAnchor=\{i === 0/);
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'player-visible literals must come from the locale catalog');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    const copy = inboxReadCopy[language];
    for (const key of ['connect', 'loading', 'unavailable', 'retry', 'preparing', 'pending', 'confirmed', 'unknown'] as const) {
      assert.ok(copy[key]);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy[key]));
    }
    const labels = inboxUiCopy[language];
    for (const key of ['intro', 'sticker', 'panelTitle', 'panelSub', 'waiting', 'read', 'fresh', 'empty', 'letters', 'inBox', 'unread', 'lamps', 'rewardLetters', 'includeReward', 'reward', 'claim', 'claimed', 'close', 'original', 'quoteTitle', 'quoteReview', 'confirmClaim', 'refreshQuote'] as const) {
      assert.ok(labels[key], `${language}.${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(labels[key]), `${language}.${key}`);
    }
    for (const key of ['quoteRent', 'quoteFee', 'quoteMax'] as const) {
      const value = labels[key]('0.001 SOL', '1000000');
      assert.ok(value.includes('0.001 SOL') && value.includes('1000000'), `${language}.${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}.${key}`);
    }
    for (const key of ['ports', 'unreadCount'] as const) {
      const value = labels[key]('9');
      assert.ok(value.includes('9'), `${language}.${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}.${key}`);
    }
  }
});

test("сбой экрана и загрузка вкладки следуют языку, не печатают внутреннюю ошибку игроку", async () => {
  const boundary = code('src/components/ErrorBoundary.tsx');
  const fallback = code('src/nav/TabFallback.tsx');
  const app = code('src/App.tsx');
  assert.match(boundary, /useLocale\(\)/);
  assert.match(boundary, /errorScreenCopy\[language\]/);
  assert.ok(!boundary.includes('{error.message}') && !boundary.includes('{this.state.error.message}'));
  assert.match(fallback, /gameTabs\[language\]\[label\]\.full/);
  assert.match(fallback, /errorScreenCopy\[language\]\.loading/);
  assert.ok(!app.includes('TAB_LABELS.') && !app.includes('label="экраны"'));
  const { errorScreenCopy } = await import('../src/i18n/errorScreenCopy.ts');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    const copy = errorScreenCopy[language];
    for (const key of ['title', 'hint', 'retry', 'reload', 'loading', 'screens'] as const) {
      assert.ok(copy[key]);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy[key]));
    }
    assert.ok(copy.section('Test').includes('Test'));
  }
});

test("каталог переводится и не выдаёт сбой чтения за пустую коллекцию или доказательство владения", async () => {
  const { readCompendiumGrid, COMPENDIUM_TOOL_IDS, COMPENDIUM_RARITIES } = await import('../src/lib/compendiumReadings.ts');
  const { compendiumCopy } = await import('../src/i18n/compendiumCopy.ts');
  const raw = { grid: COMPENDIUM_TOOL_IDS.map(toolType => ({ toolType,
    rarities: COMPENDIUM_RARITIES.map(rarity => ({ rarity, seen: false })) })) };
  assert.equal(readCompendiumGrid(raw)?.size, 0, 'подтверждённый пустой каталог даёт ноль');
  const one = structuredClone(raw);
  one.grid[0].rarities[0].seen = true;
  assert.equal(readCompendiumGrid(one)?.size, 1);
  for (const bad of [null, {}, { grid: [] }, { grid: [{ ...one.grid[0] }] },
    { grid: [...one.grid.slice(0, 4), one.grid[0]] },
    { grid: [{ ...one.grid[0], rarities: one.grid[0].rarities.slice(0, 4) }, ...one.grid.slice(1)] },
    { grid: [{ ...one.grid[0], rarities: one.grid[0].rarities.map((r, i) => i === 1 ? { ...r, seen: null } : r) }, ...one.grid.slice(1)] },
    { grid: [{ ...one.grid[0], rarities: one.grid[0].rarities.map((r, i) => i === 1 ? { ...r, rarity: 'common' } : r) }, ...one.grid.slice(1)] },
  ]) assert.equal(readCompendiumGrid(bad), null, 'неполный или несогласованный ответ неизвестен');
  const page = code('src/pages/compendium/CompendiumHome.tsx');
  assert.match(page, /readCompendiumGrid\(raw\)/);
  assert.match(page, /reading\?\.owner === user/);
  assert.match(page, /\{caught &&/);
  assert.ok(!page.includes('setCaught(new Set())'));
  const backend = read('../aof_backend/src/routes/compendium.ts');
  assert.match(backend, /const TOTAL_ENTRIES = TOOL_TYPES\.length \* RARITIES\.length; \/\/ 25/);
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    const copy = compendiumCopy[language];
    for (const key of ['title', 'intro', 'progress', 'connect', 'loading', 'unavailable', 'milestone'] as const) {
      assert.ok(copy[key]);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy[key]));
    }
    for (const key of ['recorded', 'found', 'notFound'] as const) {
      const value = copy[key]('1', '2');
      assert.ok(value.includes('1') && value.includes('2'));
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value));
    }
  }
});

test("каталог не показывает пути к файлам, а арт инструментов лежит на одном фоне", () => {
  // Жалоба 2026-09-28: в каталоге печатались внутренние пути — заголовок
  // «/assets/nfts/plasma-cutter.jpg Плазменный резак», а в плитках вместо
  // картины стояла та же строка. Плюс фон картин был разным: одна полка
  // каталога выглядела как разные по качеству предметы.
  const compendium = read("src/pages/compendium/CompendiumHome.tsx");
  assert.ok(!/\{tool\.icon\}/.test(compendium), "путь к файлу снова попал в подпись каталога");
  assert.match(compendium, /toolPlate\(tool\.id, rarity\.id\)/, "плитка каталога обязана показывать картину редкости");
  assert.match(compendium, /<img[\s\S]{0,160}toolPlate\(tool\.id, rarity\.id\)/, "картина ставится тегом img, а не текстом");

  const plate = read("src/components/visual/ArtPlate.tsx");
  assert.ok(!/!url \? src/.test(plate), "подложка ArtPlate снова печатает исходный путь");

  // Один фон у всех 25 картин: скрипт меряет рамку каждой и сверяет с плиткой.
  const report = execFileSync("node", ["scripts/normalize-art-backgrounds.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.match(report, /фон у всех картин один/, `фон картин разъехался:\n${report}`);
  // Жалоба 2026-09-30: «в инструментах и в ресурсах разные фоны по оттенку».
  // Обход обязан заходить во вложенную папку ресурсов, иначе половина полки
  // остаётся непроверенной, а допуск не должен пропускать синий уклон.
  assert.match(report, /инструменты: 25, ресурсы: 2[0-9]/, `выравнивание не покрывает обе полки:\n${report}`);
  assert.match(read("scripts/normalize-art-backgrounds.mjs"), /export const TOLERANCE = 6;/,
    "допуск снова пропускает подложку с другим оттенком");
});

test("шесть вкладок дока делят ширину и помещаются на телефоне", () => {
  // Жалоба 2026-09-28: «в нижней панели не помещаются задания и профиль».
  // Вкладки стояли несжимаемыми (flex: 0 0 auto) с горизонтальной прокруткой —
  // правые уезжали за край экрана.
  const css = read("src/theme/forge.css");
  assert.match(css, /\.fg-dock \{[^}]*width: min\(100%, 520px\)/, "капсуле дока нужна собственная ширина, а не прокрутка");
  assert.ok(!/\.fg-dock \{[^}]*overflow-x: auto/.test(css), "док снова прокручивается по горизонтали: вкладки прячутся");
  assert.match(css, /\.fg-dock__tab \{[^}]*flex: 1 1 0/, "вкладки обязаны делить ширину поровну");
  assert.match(css, /\.fg-dock__tab \{[^}]*flex-direction: column/, "знак над подписью: иначе длинное имя не влезает");
  assert.match(css, /\.fg-dock__tab \.tab-label \{[^}]*font-size: clamp/, "подпись вкладки должна уменьшаться на узком экране");
  const bar = read("src/nav/TabBar.tsx");
  assert.equal((bar.match(/key: "/g) || []).length, 6, "в доке должно быть ровно шесть вкладок");
});

test("выбор cookies не спрашивают второй раз", () => {
  // Жалоба 2026-09-28: «настройки кукис не уходят после подтверждения».
  // Панель открывалась на каждом входе, а выбор терялся, если браузер запрещал
  // постоянное хранилище (приватный режим, песочница предпросмотра).
  const consent = read("src/legal/consent.ts");
  assert.match(consent, /function sessionBacking/, "нужен запасной уровень хранения на вкладку");
  assert.match(consent, /mode: StorageMode/, "сохранение обязано сообщать, где именно остался выбор");
  assert.match(consent, /session\.setItem\(CONSENT_KEY/, "при запрете постоянного хранилища выбор пишется в sessionStorage");

  const ui = read("src/legal/LegalCenter.tsx");
  assert.match(ui, /const \[ask, setAsk\]/, "короткая полоса выбора — отдельное состояние");
  assert.match(ui, /setOpen\(false\); setAsk\(false\)/, "после выбора закрываются и полоса, и панель");
  assert.match(ui, /nf:privacy-change/, "панель обязана ловить собственное событие сохранения");
  assert.match(ui, /\{ask && !open &&/, "полоса выбора показывается только при отсутствии выбора");
  assert.match(ui, /Режим|mode === 'session'|mode === 'memory'/, "игроку нужно сказать, где остался его выбор");
});

test("новая страница и новый предмет открываются с верха", () => {
  // Жалоба 2026-09-28: «при переключении страниц или нажатии на предмет
  // переводит на новую страницу, но вниз её — это нужно исправить».
  // Стек игры держит прокрутку в .page, сайт — в окне: сброс нужен в обоих.
  const stack = read("src/nav/StackView.tsx");
  assert.match(stack, /pageRef/, "у .page нет ссылки для сброса прокрутки");
  assert.match(stack, /useEffect\([\s\S]{0,200}\[top\.key\]/, "сброс обязан срабатывать на смену страницы стека");
  assert.match(stack, /scrollTo\(\{\s*top: 0[^)]*\}\)/, "прокрутка .page не возвращается наверх");

  const layout = read("src/site/layout/Layout.tsx");
  assert.match(layout, /useEffect\([\s\S]{0,320}\[location\.pathname\]/, "сброс прокрутки сайта не привязан к адресу");
  assert.match(layout, /window\.scrollTo\(\{[^}]*top: 0/, "сайт не возвращает окно наверх при смене адреса");
  assert.match(layout, /window\.location\.hash/, "переход по якорю обязан сохранять прокрутку к цели");
  assert.match(layout, /site-main/, "после смены адреса фокус уходит в основную область");
});

test("каталог ресурсов не затенён страницей-однофамильцем, а механики ведут на живые страницы", async () => {
  // Жалоба-дефект: /site/resources открывал текстовую страницу вместо каталога,
  // а карточки ресурсов и механик ссылались на страницы, которых нет в меню.
  const app = read("src/site/SiteApp.tsx");
  const catalog = app.indexOf('<Route path="resources"');
  const mapped = app.indexOf(".filter(p => p.id !== 'resources')");
  assert.ok(catalog !== -1 && mapped !== -1 && catalog < mapped, "каталог обязан объявляться до перечня текстовых страниц");
  assert.match(app, /p\.id !== 'resources'/, "страница-однофамилец 'resources' снова перекрывает каталог");

  const { pages } = await import("../src/site/content/pages");
  const { resourcesBySlug } = await import("../src/site/content/resources");
  const { mechanicRoutes } = await import("../src/site/content/mechanics");
  const ids = new Set(pages.map((p: { id: string }) => p.id));

  for (const page of pages) {
    for (const ref of page.relatedMechanics ?? []) {
      assert.ok(mechanicRoutes[ref], `страница ${page.id} ссылается на механику ${ref}, у которой нет маршрута`);
      assert.ok(ids.has(mechanicRoutes[ref]), `маршрут механики ${ref} ведёт на несуществующую страницу ${mechanicRoutes[ref]}`);
    }
  }
  const used = new Set(Object.values(mechanicRoutes));
  for (const id of used) assert.ok(ids.has(id), `маршрут механики ${id} отсутствует в дереве страниц`);
  assert.equal(resourcesBySlug.size, 27, "каталог ресурсов изменился: проверь sitemap и связанные ссылки");
});

test("sitemap описывает только существующие маршруты", async () => {
  const { pages } = await import("../src/site/content/pages");
  const { resources } = await import("../src/site/content/resources");
  const expected = new Set([
    "/site",
    ...pages.filter((p: { id: string }) => p.id !== "home").map((p: { id: string }) => `/site/${p.id}`),
    "/site/resources",
    ...resources.map((r: { slug: string }) => `/site/resources/${r.slug}`),
  ]);

  const xml = read("public/sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^http:\/\/localhost:3000/, ""));
  const unknown = locs.filter((p) => !expected.has(p));
  assert.deepEqual(unknown, [], `в sitemap есть маршруты, которых нет в дереве страниц:\n${unknown.join("\n")}`);
  const missing = [...expected].filter((p) => !locs.includes(p));
  assert.deepEqual(missing, [], `в sitemap не хватает маршрутов:\n${missing.join("\n")}`);
  assert.match(xml, /localhost:3000/, "origin заменяется только на release-сборке: плейсхолдер обязан остаться");
});

test("в текстах для игрока нет служебных пометок и старой лексики", () => {
  // Вычитка 2026-09-28: внутренние пометки аудита и слова эпохи картошки
  // оставались в контенте, а игры «нейрослоп» требовалось убрать ещё раньше.
  const dir = join(root, "src/site/content");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 9, "контент сайта пропал из дерева после удаления устаревших русских источников");
  const bad: string[] = [];
  for (const file of files) {
    const text = code(`src/site/content/${file}`);
    for (const [name, pattern] of [
      ["служебная пометка аудита", /\[(АУДИТ|AUDIT)\s[^\]]*\]/],
      ["жаргон исполнения", /\b(escrow|on-chain(?!-verified)|он-чейн|canonical mint|каноническ\w+ mint)\b/i],
      ["старая лексика", /\b(картошк\w*|жернов\w*|пшениц\w*|урожай\w*|полив\w*|грядк\w*)\b/i],
    ] as const) {
      const hit = text.match(pattern);
      if (hit) bad.push(`${file}: ${name} — «${hit[0]}»`);
    }
  }
  assert.deepEqual(bad, [], `в текстах для игрока остались следы:\n${bad.join("\n")}`);
});

test("смайл в сообщении — это плашка состояния, а не символ в тексте", () => {
  // Всплывающие сообщения начинаются со значка ✅/❌/⏸️ или ресурсного значка —
  // NoticeMsg подменяет его картинкой. Всё, что вне сообщений (заголовки, кнопки,
  // подписи), значки рисовать не должно.
  const notices = read("src/components/visual/NoticeMsg.tsx");
  const registered = new Set<string>();
  for (const block of [
    notices.match(/SUCCESS = new Set\(\[([^\]]*)\]\)/)?.[1] ?? "",
    notices.match(/ERROR = new Set\(\[([^\]]*)\]\)/)?.[1] ?? "",
  ]) {
    for (const m of block.matchAll(/"([^"]+)"/g)) registered.add(m[1]);
  }
  for (const m of notices.matchAll(/"([^"]+)":\s*"[A-Z_]+"/gu)) registered.add(m[1]);

  /** Диапазоны вызовов flash/flashMsg/toast.show — там значок работает как плашка. */
  const noticeRanges = (text: string) => {
    const ranges: Array<[number, number]> = [];
    for (const call of text.matchAll(/(?:flash(?:Ref\.current)?|flashMsg|toast\.show)\s*\(/g)) {
      let depth = 1;
      let i = call.index + call[0].length;
      for (; i < text.length && depth > 0; i++) {
        if (text[i] === "(") depth++;
        else if (text[i] === ")") depth--;
      }
      ranges.push([call.index, i]);
    }
    return ranges;
  };

  const dirs = ["src/pages", "src/components"];
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{26A0}]/u;
  const unregistered: string[] = [];
  const inMarkup: string[] = [];
  for (const dir of dirs) {
    for (const file of readdirSync(join(root, dir), { recursive: true }) as string[]) {
      if (!/\.(tsx|ts)$/.test(file)) continue;
      const rel = `${dir}/${file}`;
      if (rel.includes("src/pages/admin/") || rel.includes("NoticeMsg")) continue;
      const text = read(rel);
      const ranges = noticeRanges(text);
      const inNotice = (index: number) => ranges.some(([from, to]) => index > from && index < to);
      for (const m of text.matchAll(/["'`\s]([\u{1F300}-\u{1FAFF}\u{2705}\u{274C}\u{26A0}]\uFE0F?) /gu)) {
        const index = (m.index ?? 0) + 1;
        if (inNotice(index)) {
          if (!registered.has(m[1])) unregistered.push(`${rel}: значок «${m[1]}» не зарегистрирован в NoticeMsg`);
        } else {
          inMarkup.push(`${rel}: ${m[1]} в тексте разметки`);
        }
      }
    }
  }
  assert.deepEqual(inMarkup, [], `в интерфейс вернулись смайлы вместо слов и приборных плашек:\n${inMarkup.join("\n")}`);
  assert.deepEqual(unregistered, [], `сообщение подписано значком без плашки:\n${unregistered.join("\n")}`);
});

test("календарь эпох берёт погоду дня из сети, а не считает своей формулой", () => {
  // Дефект 2026-09-28: страница «Эпохи» считала погоду сама — dayId * 0x9E3779B9
  // с долями 20/30/40/10 — и расписание не совпадало с цепью ни в один день.
  const page = code("src/pages/economy/SeasonCalendar.tsx");
  assert.match(page, /fetchWeatherSnapshot/, "календарь обязан читать каноническое состояние дня");
  assert.match(page, /weatherIndexForDay/, "сетка эпохи строится правилом сети, а не своей формулой");
  assert.match(read("src/i18n/seasonCalendarCopy.ts"), /unavailable: 'Состояние дня недоступно'/, "без данных сети календарь обязан честно сказать об этом");
  assert.match(page, /copy\.unavailable/, "сообщение должно быть переведено");
  assert.match(page, /next\.dayId > 0/, "без номера дня календарь не должен строить сетку");
  assert.ok(!/0x9E3779B9|0x9e3779b9/.test(page), "в страницу вернулась собственная формула погоды");
  assert.ok(!/Данные \+10%|Всё -15%/.test(page), "выдуманные эффекты вернулись в легенду");

  // Формула дня живёт ровно в одном месте — lib/weather.ts (зеркало aof-core).
  const files = readdirSync(join(root, "src"), { recursive: true }) as string[];
  const owners = files
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => {
      const text = readFileSync(join(root, "src", f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      return /9[eE]3779[bB]/.test(text);
    })
    .map((f) => f.replace(/\\/g, "/"));
  assert.deepEqual(owners, ["lib/weather.ts"], `формула дня расползлась по файлам: ${owners.join(", ")}`);
});

test("фляги обещают ровно тот эффект, который есть в программе", () => {
  // Дефект 2026-09-28: каталог фляг обещал «+20% добыча на 1ч», «+100 газа»,
  // «×2 скорость» и «+50% Forge» — ничего из этого в aof-core нет.
  // [§3.8] Теперь у флюидов есть единственный объявленный эффект:
  // aof_core::use_flask сжигает флягу и возвращает энергию по тиру, не выше
  // потолка. Копирайт обязан говорить именно это и не возвращать баффы.
  const page = code("src/pages/market/FlaskMarketplace.tsx");
  assert.ok(!/\+20%|\+50%|×2|на 1ч|газа/.test(page), "выдуманные эффекты фляг вернулись");
  assert.ok(!/\{flask\.icon\}/.test(page), "иконка фляги снова печатается текстом");
  assert.match(page, /ResourceGlyph/, "значок фляги рисуется приборной плашкой");
  const detailCopy = read("src/i18n/marketDetailCopy.ts");
  assert.match(page, /copy.flaskRecipe/, "игроку нужно сказать, что делает фляга");
  assert.match(page, /copy.flaskNoPrice/, "цена фляги не выдумывается");
  assert.match(detailCopy, /используется в сети|применяется в сети/, "русская версия обязана описывать применение фляги");
  assert.match(detailCopy, /\+5…\+20 энергии/, "русская версия обязана называть настоящий эффект — энергию");
  // Старые обещания не должны вернуться ни в одном из семи языков. Упоминание
  // слова «бафф» рядом со словом «не объявлены» — это объяснение, а не обещание,
  // поэтому ищем именно числовые обещания эффектов.
  assert.ok(!/\+\s*20\s*%|\+\s*50\s*%|×\s*2|\+\s*100/.test(detailCopy),
    "копирайт не должен обещать эффекты фляг, которых в программе нет");
  assert.match(detailCopy, /Цены нет/, "русская версия обязана показывать неизвестную цену");

  // [§3.8] Каталог обязан быть действием, а не витриной: применение фляги и
  // обмен DATA→энергия идут через живые маршруты, баланс читается из сети, а
  // неудачное чтение остаётся «неизвестно», а не превращается в ноль.
  assert.match(page, /api\.tools\.useFlask/, "кнопка применения фляги обязана звать /tools/use-flask");
  assert.match(page, /api\.resources\.exchangeEnergy/, "обмен обязан звать /resources/exchange-energy");
  assert.match(page, /api\.energy\.balance/, "баланс энергии читается из сети, а не выдумывается");
  assert.match(page, /copy\.exchangeSubmit/, "у обмена обязана быть подпись кнопки из каталога");
  assert.match(page, /copy\.useSubmit/, "у применения фляги обязана быть подпись кнопки из каталога");
  assert.match(page, /setEnergy\(null\)/, "неудачное чтение энергии обязано оставлять состояние неизвестным");

  // Эффект копирайта обязан совпадать с таблицей программы, а не жить сам по себе.
  const constants = read("../aof-core/src/constants.rs");
  assert.match(constants, /pub const FLASK_ENERGY_GAIN: \[u8; 5\] = \[5, 5, 8, 10, ENERGY_CAP\];/);
  // И та же лестница обязана стоять в UI: цифры на кнопке — не маркетинг.
  const uiLadder = page.match(/FLASK_ENERGY_GAIN = \[([^\]]+)\]/);
  const rustLadder = constants.match(/pub const FLASK_ENERGY_GAIN: \[u8; 5\] = \[([^\]]+)\];/);
  assert.ok(uiLadder && rustLadder, "лестница тиров обязана существовать и в UI, и в программе");
  const norm = (value: string) => value.split(",").map((part) => part.trim().replace("ENERGY_CAP", "20")).join(",");
  assert.equal(norm(uiLadder![1]), norm(rustLadder![1]), "лестница тиров в UI разошлась с программой");
});

test("знак сайта — прибор, а не сеть узлов, и в палитре нет неона", () => {
  // Решение владельца: нейро-декор (узлы, связи, свечение) в проекте не остаётся.
  // Прежний знак рисовал четыре точки с линиями в градиенте #00D4FF → #9B59FF.
  const favicon = read("public/favicon.svg");
  assert.ok(!/<line\s/.test(favicon), "в знаке снова линии между узлами");
  assert.match(favicon, /#5FC9DA/, "знак обязан быть в циане палитры A");
  assert.match(favicon, /aria-label="NeuroForge"/, "у знака должна быть подпись для чтения с экрана");

  const layout = read("src/site/layout/Layout.tsx");
  assert.ok(!/nf-logo-g/.test(layout), "старый градиент знака вернулся в шапку");
  assert.ok(!/#00D4FF|#9B59FF/.test(layout), "в шапке снова неоновые цвета прежнего макета");

  const oldColors = /#00D4FF|#9B59FF|rgb\(255, 60, 172\)|rgb\(6, 6, 15\)|#06060F/;
  const offenders: string[] = [];
  for (const file of readdirSync(join(root, "src/site"), { recursive: true }) as string[]) {
    if (!/\.(tsx?|css)$/.test(file)) continue;
    if (oldColors.test(read(`src/site/${file}`))) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `в сайт вернулись цвета прежней палитры:\n${offenders.join("\n")}`);
});

test("сезонный пропуск локализован и не предлагает повторную оплату при неизвестном статусе", async () => {
  const page = code("src/pages/profile/SeasonPassPage.tsx");
  const copy = await import("../src/i18n/seasonPassCopy");
  for (const language of ["en", "pt", "es", "vi", "id", "fil", "ru"] as const) {
    assert.ok(copy.seasonPassCopy[language].purchase && copy.seasonPassCopy[language].unavailable);
  }
  assert.match(page, /useVipStatus/, "VIP определяется проверенным сетевым статусом");
  assert.match(page, /snapshot\?\.isVip/, "локальный флаг покупки не доказывает VIP");
  assert.match(page, /snapshot\?\.seasonActive/, "покупка возможна только в активном сезоне");
  assert.match(page, /paymentBlocked/, "неизвестный статус оплаты не приглашает платить повторно");
  assert.match(code("src/lib/wallet.ts"), /error\s+as Error & \{ signature\?: string \}\)\.signature = signature/,
    "кошелёк сохраняет подпись уже отправленной, но не подтверждённой транзакции");
  assert.match(code("src/lib/txFlow.ts"), /signature: typeof e\?\.signature/, "результат оплаты сохраняет подпись при ошибке подтверждения");
  assert.match(page, /kind: 'seasonPass'/, "покупку защищает локальный интент");
  assert.ok(!/XP-бустер|умная покупка|snapshot\.privileges/.test(page), "неподтверждённые преимущества вернулись в карточку");
  assert.match(page, /c\.unverified/, "VIP не должен обещать неработающие игровые преимущества");
  assert.match(page, /overflow-wrap:anywhere/, "длинные переводы должны переноситься");
  const backend = readFileSync(join(root, "..", "aof_backend/src/routes/vipStatus.ts"), "utf8");
  assert.match(backend, /getAccountInfo\(seasonPass\)/, "отсутствующий пропуск отличается от ошибки сети");
  assert.match(backend, /seasonActive/, "сервер подтверждает активность сезона");
  assert.match(backend, /energyCapPlanned/, "расширенный запас энергии остаётся планом");
  assert.ok(!/energyCap: isVip \? 30/.test(backend), "план снова выдан за действующую привилегию");
});

test("каждая особая секция сайта принадлежит существующей странице", async () => {
  // Дефект прошлой эпохи: в ExtraSections оставались ветки для страниц, которых
  // нет в дереве (например, погодный блок без адреса) — игрок не мог их открыть.
  const { pages } = await import("../src/site/content/pages");
  const ids = new Set(pages.map((p: { id: string }) => p.id));
  const source = read("src/site/pages/ExtraSections.tsx");
  const branches = [...source.matchAll(/if \(id === (["'])([a-z-]+)\1\)/g)].map((m) => m[2]);
  assert.ok(branches.length >= 18, "особые секции сайта пропали");
  const orphans = branches.filter((branch) => !ids.has(branch));
  assert.deepEqual(orphans, [], `в разметку вернулись секции без страниц: ${orphans.join(", ")}`);
  const duplicates = branches.filter((branch, index) => branches.indexOf(branch) !== index);
  assert.deepEqual(duplicates, [], `две ветки одной страницы: ${duplicates.join(", ")}`);
});

test("сайт запускает игру, а не отправляет к статье о первом запуске", () => {
  const page = code("src/site/pages/ContentPage.tsx");
  const layout = code("src/site/layout/Layout.tsx");
  assert.match(page, /<Button to="\/">\{t\('launch'\)\}/);
  assert.match(layout, /className="site-play-link" to="\/"/);
  assert.match(layout, /LanguageSwitcher/);
  const switcher = code("src/i18n/LocaleProvider.tsx");
  assert.match(switcher, /languageOptions\.map/);
  assert.match(switcher, /aria-pressed=\{choice === option\.code\}/);
  assert.match(layout, /site-mobile-menu/);
});

test("ландшафтные фоны не зумятся на портретном экране и не повторяются", () => {
  const backdrop = code("src/components/visual/SceneBackdrop.tsx");
  const css = read("src/theme/forge.css");
  assert.match(backdrop, /all\.indexOf\(image\) === index/);
  assert.match(css, /\.nf-scene img \{ width: 100%; height: auto;/);
  assert.match(css, /object-fit: contain/);
  const home = code("src/site/pages/ContentPage.tsx");
  assert.ok(!home.includes('game-banner.png'), "повторный key art под постером вернулся");
  assert.match(home, /site-scene-gallery/);
});

test("семь языков имеют полные словари шапки, навигации и главной", async () => {
  const { languages, pageNames, messages, detectLanguage } = await import('../src/i18n/translations');
  const { pages } = await import('../src/site/content/pages');
  const { gameTabs } = await import('../src/i18n/gameLabels');
  const { homeFeatures } = await import('../src/i18n/homeFeatures');
  const { gameHeaders } = await import('../src/i18n/gameHeaders');
  assert.deepEqual(languages, ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru']);
  const baseKeys = Object.keys(messages.ru).sort();
  for (const language of languages) {
    assert.deepEqual(Object.keys(messages[language]).sort(), baseKeys, `${language}: missing UI keys`);
    assert.equal(homeFeatures[language].length, 4);
    for (const page of pages) assert.ok(pageNames[language][page.id as keyof typeof pageNames.ru], `${language}: missing ${page.id}`);
    for (const tab of ['farm','tools','economy','market','quests','profile'] as const) {
      assert.ok(gameTabs[language][tab].full && gameTabs[language][tab].short, `${language}: missing ${tab}`);
    }
    assert.deepEqual(Object.keys(gameHeaders[language]).sort(), Object.keys(gameHeaders.ru).sort());
  }
  assert.equal(detectLanguage(['tl-PH']), 'fil');
  assert.equal(detectLanguage(['pt-BR']), 'pt');
  assert.equal(detectLanguage(['xx', 'es-MX']), 'es');
  assert.equal(detectLanguage(['xx']), 'ru');
});

test("выбранный язык общий для сайта и игры, а русские статьи не выдают за перевод", () => {
  const main = code('src/main.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const game = code('src/App.tsx');
  const content = code('src/site/pages/ContentPage.tsx');
  assert.match(main, /<LocaleProvider>/);
  assert.match(layout, /<LanguageSwitcher compact \/>/);
  assert.match(game, /<LanguageSwitcher compact \/>/);
  assert.match(layout, /t\('translationNotice'\)/);
  assert.match(content, /lang=\{hero \|\| pageCopy \? language : 'ru'\}/);
  assert.match(game, /gameNotices\[language\]/);
  assert.match(read('src/i18n/LocaleProvider.tsx'), /functionalStorage\.setItem\(STORAGE_KEY/);
});

test("домашняя цепочка, все ресурсы и SHA-256-демо имеют тексты на каждом языке", async () => {
  const { languages } = await import('../src/i18n/translations');
  const { resources } = await import('../src/site/content/resources');
  const { homeDetail, homeResourceNames } = await import('../src/i18n/homeDetail');
  const { commitLabels } = await import('../src/i18n/commitLabels');
  const components = code('src/site/ui/Components.tsx');
  const sections = code('src/site/pages/ExtraSections.tsx');
  assert.match(components, /commitLabels\[language\]/);
  assert.match(sections, /homeResourceNames\[language\]/);
  for (const language of languages) {
    for (const resource of resources) {
      assert.ok(homeResourceNames[language][resource.id as keyof typeof homeResourceNames.ru], `${language}: ${resource.id} missing`);
    }
    assert.equal(homeDetail[language].leads.length, 8, `${language}: intro resource descriptions`);
    assert.ok(homeDetail[language].chainCaption);
    for (const key of Object.keys(commitLabels.ru)) {
      assert.ok(commitLabels[language][key as keyof typeof commitLabels.ru], `${language}: SHA-256 ${key}`);
    }
  }
});

test("первые страницы руководства и живой обзор лаборатории имеют проверенные словари", async () => {
  const { languages } = await import('../src/i18n/translations');
  const { introPages } = await import('../src/i18n/siteIntro');
  const { labHeroCopy } = await import('../src/i18n/labHeroCopy');
  const { farmOverviewCopy } = await import('../src/i18n/farmOverviewCopy');
  const { weatherCopy } = await import('../src/i18n/weatherCopy');
  for (const language of languages) {
    for (const id of ['start', 'world', 'energy'] as const) {
      assert.ok(introPages[language][id].lead);
      assert.equal(introPages[language][id].paragraphs.length, id === 'energy' ? 2 : 3);
      if (id !== 'world') assert.equal(introPages[language][id].steps?.items.length, 3);
    }
    assert.deepEqual(Object.keys(labHeroCopy[language]).sort(), Object.keys(labHeroCopy.ru).sort());
    assert.deepEqual(Object.keys(farmOverviewCopy[language]).sort(), Object.keys(farmOverviewCopy.ru).sort());
    assert.deepEqual(Object.keys(weatherCopy[language]).sort(), Object.keys(weatherCopy.ru).sort());
  }
  assert.match(code('src/components/farm/LabHero.tsx'), /labHeroCopy\[language\]/);
  assert.match(code('src/components/ui/WeatherWidget.tsx'), /weatherCopy\[language\]/);
  assert.match(code('src/site/pages/ContentPage.tsx'), /introPages\[language\]/);
});

test("поиск каталога принимает названия выбранного языка, статусы и категории не выпирают", async () => {
  const { languages } = await import('../src/i18n/translations');
  const { resourceCatalogCopy } = await import('../src/i18n/resourceCatalogCopy');
  const { resourceLeads } = await import('../src/i18n/resourceLeads');
  const { siteNotFound } = await import('../src/i18n/siteNotFound');
  const { homeResourceNames } = await import('../src/i18n/homeDetail');
  const { resources } = await import('../src/site/content/resources');
  const source = code('src/site/pages/ContentPage.tsx');
  assert.match(source, /resourceName\(r\.id, r\.name\) \+ ' ' \+ resourceLead\(r\.id, r\.lead\)/);
  assert.doesNotMatch(source, /\+ r\.name \+ ' ' \+ r\.lead/, 'search must not mix Russian source into other languages');
  assert.match(read('src/site/content/resources.ts'), /name: homeResourceNames\.ru\.data/);
  assert.match(source, /copy\.labels\[r\.category\]/);
  assert.match(source, /lang=\{language\}>\{resourceLead\(r\.id, r\.lead\)\}/);
  assert.match(source, /lead=\{resourceLeads\[language\]\[resource\.id as ResourceId\]/);
  assert.match(source, /const copy = siteNotFound\[language\]/);
  assert.match(code('src/site/styles/site.css'), /\.site-card, \.site-paper \{ overflow-wrap: anywhere; \}/);
  assert.equal(resources.length, 27);
  for (const lang of languages) {
    const copy = resourceCatalogCopy[lang];
    assert.deepEqual(Object.keys(resourceLeads[lang]).sort(), Object.keys(homeResourceNames[lang]).sort(), `${lang}: все 27 описаний`);
    for (const resource of resources) assert.ok(resourceLeads[lang][resource.id as keyof typeof resourceLeads[typeof lang]]?.trim(), `${lang}: ${resource.id}`);
    for (const field of ['title', 'lead', 'home', 'catalog'] as const) assert.ok(siteNotFound[lang][field].trim(), `${lang}: 404 ${field}`);
    for (const key of ['search', 'category', 'all', 'found', 'live', 'soon'] as const) assert.ok(copy[key], `${lang}: ${key}`);
    for (const category of ['base', 'chain', 'material', 'rare', 'consumable', 'token', 'collab', 'social'] as const) assert.ok(copy.labels[category], `${lang}: ${category}`);
  }
});

test('манифест и интерактивная нагрузка сети переведены целиком на семь языков', async () => {
  const { editorialPages } = await import('../src/i18n/siteEditorial');
  const { languages } = await import('../src/i18n/translations');
  const content = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  assert.match(content, /editorialPages\[language\]/);
  assert.match(content, /steps\.items\.map\(\(step, i\) =>/);
  assert.doesNotMatch(content, /mechanicMap|mechanicsById/, 'legacy mechanism copy must not determine visible site steps');
  assert.doesNotMatch(read('src/site/content/mechanics.ts'), /narrative:|steps:|status:|lead:/, 'obsolete Russian-only walkthroughs must not ship');
  assert.match(extras, /const copy = editorialPages\[language\]\.manifesto/);
  assert.match(extras, /const copy = editorialPages\[language\]\.weather/);
  assert.match(extras, /text\.statePrefix/);
  assert.match(layout, /localizedRoutes\.has\(location\.pathname\.split\('\/'\)\[2\]\)/);
  const states = ['drought', 'sun', 'rain', 'festival'] as const;
  for (const lang of languages) {
    const { manifesto, weather } = editorialPages[lang];
    assert.equal(manifesto.paragraphs.length, 3, `${lang}: manifesto intro`);
    assert.equal(manifesto.principles.length, 4, `${lang}: four principles`);
    assert.equal(weather.paragraphs.length, 4, `${lang}: four network states`);
    assert.equal(weather.steps.items.length, 3, `${lang}: weather steps`);
    for (const key of states) assert.ok(weather.states[key], `${lang}: ${key}`);
    for (const value of [manifesto.lead, ...manifesto.paragraphs, manifesto.heading,
      ...manifesto.principles.flatMap(p => [p.title, p.text]), manifesto.closing,
      weather.lead, ...weather.paragraphs, weather.heading, weather.demoLegend,
      ...states.map(key => weather.states[key]), weather.statePrefix, weather.stateSuffix,
      weather.caution, weather.steps.heading,
      ...weather.steps.items.flatMap(step => [step.title, step.text])]) {
      assert.ok(value.trim(), `${lang}: empty translation`);
      if (lang !== 'ru') assert.doesNotMatch(value, /[\u0400-\u04ff]/, `${lang}: untranslated Russian`);
    }
  }
});

test('первый запуск переводится до открытия лаборатории и позволяет сменить язык', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { onboardingCopy } = await import('../src/i18n/onboardingCopy');
  const wizard = code('src/pages/onboarding/OnboardingWizard.tsx');
  assert.match(wizard, /<LanguageSwitcher compact \/>/);
  assert.match(wizard, /onboardingCopy\[language\]/);
  assert.match(wizard, /<motion\.div lang=\{language\}/);
  assert.match(wizard, /copy\.steps\.length - 1/);
  assert.match(wizard, /\{copy\.skip\}/);
  assert.match(wizard, /aria-live="polite"/);
  for (const language of languages) {
    const copy = onboardingCopy[language];
    assert.equal(copy.steps.length, 5, `${language}: five introduction panels`);
    for (const value of [copy.speaker, copy.skip, copy.progress(1, 5), ...copy.steps.flatMap(step => [step.text, step.action])]) {
      assert.ok(value.trim(), `${language}: empty introduction`);
      if (language !== 'ru') assert.doesNotMatch(value, /[\u0400-\u04ff]/, `${language}: Russian introduction`);
    }
  }
});

test('сетевая станция и барограф переводят реальные и отсутствующие данные на семи языках', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { wellCopy } = await import('../src/i18n/wellCopy');
  const panel = code('src/pages/farm/WellPanel.tsx');
  const recorder = code('src/components/farm/WeatherRecorder.tsx');
  const chart = code('src/ui/forge/devices.tsx');
  assert.match(panel, /fetchWeatherSnapshot\(\)/);
  assert.match(panel, /api\.chain\.weatherCrank/);
  assert.match(panel, /api\.chain\.collectPower/);
  assert.match(panel, /wellCopy\[language\]/);
  assert.match(panel, /!weather \|\| !w/);
  assert.match(panel, /WellHall/);
  assert.match(panel, /import \{ stationLastCollectedAt \} from \"\.\/wellReadings\"/);
  assert.match(panel, /import \{ WellHall \} from \"\.\/WellHall\"/);
  assert.match(panel, /weatherAccountPresent !== false/);
  const hall = code('src/pages/farm/WellHall.tsx');
  assert.match(hall, /\/assets\/well\/station\.jpg/);
  assert.doesNotMatch(hall, /grid_accrual|powerBuffer/);
  const { stationLastCollectedAt } = await import('../src/pages/farm/wellReadings');
  assert.equal(stationLastCollectedAt(null), null);
  assert.equal(stationLastCollectedAt({ lastCollectedAt: 0 }), null);
  assert.equal(stationLastCollectedAt({ lastCollectedAt: 1_700_000_000 }), 1_700_000_000);
  assert.equal(stationLastCollectedAt({ last_collected_at: '1700000001' }), 1700000001);
  assert.match(recorder, /known = forecast\.filter/);
  assert.match(recorder, /scaleLabels=\{\(\['drought', 'sunny', 'festival'\]/);
  assert.match(recorder, /ariaLabel=\{copy\.barograph\}/);
  assert.match(chart, /aria-label=\{ariaLabel \?\? copy\.loadChart\}/);
  for (const language of languages) {
    const copy = wellCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(wellCopy.ru).sort(), `${language}: station fields`);
    assert.deepEqual(Object.keys(copy.seasonNames).sort(), Object.keys(wellCopy.ru.seasonNames).sort());
    for (const value of [...Object.entries(copy).filter(([key]) => key !== 'seasonNames').map(([, value]) => value),
      ...Object.values(copy.seasonNames)] as string[]) {
      assert.ok(value.trim(), `${language}: station field empty`);
      if (language !== 'ru') assert.doesNotMatch(value, /[\u0400-\u04ff]/, `${language}: Russian station label`);
    }
  }
});

test('нейронная лаборатория переводит действия и не показывает вечную загрузку без кошелька', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { neuralLabCopy } = await import('../src/i18n/neuralLabCopy');
  const panel = code('src/pages/farm/NeuralLabPanel.tsx');
  assert.match(panel, /neuralLabCopy\[language\]/);
  assert.ok(panel.indexOf('if (!walletAddr) {\n    return (') < panel.indexOf('if (loading) {\n    return ('), 'disconnected visitor must see a prompt before the loading branch');
  assert.match(panel, /loadError \? \(/);
  assert.match(panel, /setLoadError\(true\)/);
  assert.match(panel, /!loadError && selectedCell !== null/);
  assert.match(panel, /copy\.started\(neuronAmount, selectedCell \+ 1\)/);
  assert.match(panel, /copy\.collected\(tileIndex \+ 1\)/);
  for (const language of languages) {
    const copy = neuralLabCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(neuralLabCopy.ru).sort(), `${language}: neural laboratory fields`);
    const values = [...Object.values(copy).filter(v => typeof v === 'string'),
      copy.tile(1), copy.activateIn(1), copy.startButton(3), copy.started(3, 1), copy.collected(1)];
    for (const value of values) {
      assert.ok(value.trim(), `${language}: missing lab label`);
      if (language !== 'ru') assert.doesNotMatch(value, /[\u0400-\u04ff]/, `${language}: untranslated lab label`);
    }
  }
});

test('участок переводит постройки, статусы и причины отключённой добычи без подмены сетевых данных', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { farmPlotCopy, buildingKeys } = await import('../src/i18n/farmPlotCopy');
  const plot = code('src/pages/farm/FarmPlot.tsx');
  const dash = code('src/pages/farm/FarmDashboard.tsx');
  assert.match(plot, /const MINING_ENABLED = useMiningAvailability\(\)/);
  assert.match(plot, /await readMiningEnabled\(\)/);
  assert.match(plot, /disabled=\{!MINING_ENABLED \|\| busy\}/);
  assert.match(plot, /farmPlotCopy\[language\]/);
  assert.match(plot, /weatherState\.rate \? copy\.powerGain\(weatherState\.rate\)/);
  assert.match(plot, /!address \|\| toolsFailed \? "—" : tools === null \? "…"/);
  assert.match(plot, /disabled=\{!tool\}/);
  assert.match(dash, /farmPlotCopy\[language\]\.buildings/);
  for (const id of ['plasma_cutter', 'silicon_extractor', 'data_harvester', 'quantum_transmitter', 'neural_seeder']) assert.ok(buildingKeys[id]);
  for (const id of ['axe', 'pick', 'spear', 'bow', 'reaper']) assert.equal(buildingKeys[id], undefined);
  for (const language of languages) {
    const copy = farmPlotCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(farmPlotCopy.ru).sort(), `${language}: plot fields`);
    assert.deepEqual(Object.keys(copy.buildings).sort(), Object.keys(farmPlotCopy.ru.buildings).sort());
    for (const value of [...Object.values(copy).filter(v => typeof v === 'string'),
      ...Object.values(copy.buildings), copy.powerGain(15)]) {
      assert.ok(value.trim(), `${language}: empty plot label`);
      if (language !== 'ru') assert.doesNotMatch(value, /[\u0400-\u04ff]/, `${language}: Russian plot label`);
    }
  }
});

test('сепарация и обучение имеют полный перевод на 7 языков и не принимают сбой сети за пустой цикл', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { labProcessCopy } = await import('../src/i18n/labProcessCopy');
  const mill = code('src/pages/farm/MillPanel.tsx');
  const oven = code('src/pages/farm/OvenPanel.tsx');
  for (const source of [mill, oven]) {
    assert.match(source, /labProcessCopy\[language\]/);
    assert.match(source, /setReadStatus\('unavailable'\)/);
    assert.match(source, /readStatus === 'ready' && !/);
    assert.match(source, /request !== requestSeq\.current/);
    assert.match(source, /inFlight\.current === walletAddr/);
    assert.match(source, /!Number\.isFinite\(readyAt\)/);
    assert.match(source, /copy\.hours\(m\.time \/ 3600\)/);
  }
  assert.match(mill, /readStatus === 'ready' && (?:!signalState|signalState)/);
  assert.match(oven, /readStatus === 'ready' && (?:!modelState|modelState)/);
  for (const language of languages) {
    const copy = labProcessCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(labProcessCopy.ru).sort(), `${language}: process copy`);
    for (const section of ['sizes', 'mill', 'oven'] as const)
      assert.deepEqual(Object.keys(copy[section]).sort(), Object.keys(labProcessCopy.ru[section]).sort(), `${language}: ${section}`);
    const text = [...Object.values(copy).filter(v => typeof v === 'string'), ...Object.values(copy.sizes),
      ...Object.values(copy.mill).filter(v => typeof v === 'string'),
      ...Object.values(copy.oven).filter(v => typeof v === 'string'),
      copy.hours(6), copy.mill.started(6, 3), copy.mill.collected(3), copy.oven.started(4, 2), copy.oven.collected(2)];
    for (const value of text) {
      assert.ok(value.trim(), `${language}: empty process translation`);
      if (language !== 'ru') assert.doesNotMatch(value, /[\u0400-\u04ff]/, `${language}: Russian process translation`);
    }
  }
});

test('выбор топлива обучения показывает и передаёт ровно тот рецепт, который использует контракт', () => {
  const source = code('src/pages/farm/OvenPanel.tsx');
  const core = read('../aof-core/src/instructions/start_model_training.rs');
  assert.match(core, /fuel_kind == 0[\s\S]*?MODEL_CIRCUIT_COST\[idx\], MODEL_CIRCUIT_OUTPUT\[idx\]/);
  assert.match(core, /MODEL_COMPUTE_COST\[idx\], MODEL_COMPUTE_OUTPUT\[idx\]/);
  const circuit = core.match(/MODEL_CIRCUIT_OUTPUT: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT, (\d+) \* RESOURCE_UNIT, (\d+) \* RESOURCE_UNIT\]/);
  const compute = core.match(/MODEL_COMPUTE_OUTPUT: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT, (\d+) \* RESOURCE_UNIT, (\d+) \* RESOURCE_UNIT\]/);
  assert.ok(circuit && compute);
  const numbers = [...source.matchAll(/model: (\d+),\s+modelCompute: (\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(numbers, circuit.slice(1).map((w, i) => [Number(w), Number(compute[i + 1])]));
  assert.match(source, /const fuelKind = FUEL_KIND\[fuel\]/);
  assert.match(source, /const resultAmount = fuel === 'circuit' \? m\.model : m\.modelCompute/);
  assert.match(source, /fuel === 'circuit' \? m\.circuit : m\.compute/);
  assert.match(source, /<input type="radio" name="training-fuel" checked=\{fuel === option\}/);
  assert.match(source, /api\.chain\.startModelTraining\(\{[\s\S]*?fuelKind/);
});


test("мастерская и галерея используют семь переводов и не обещают закрытую добычу", () => {
  const copy = read("src/i18n/toolsCopy.ts");
  for (const language of ["ru", "en", "pt", "es", "vi", "id", "fil"]) {
    assert.match(copy, new RegExp(`\\n  ${language}: \\{`), `нет словаря для ${language}`);
  }
  for (const field of ["inventoryUnavailable", "inventoryEmpty", "disabledMining", "timerUnknown", "rarities"]) {
    assert.equal((copy.match(new RegExp(`${field}:`, "g")) || []).length, 8,
      `${field} должен быть типизирован и присутствовать в каждом языке`);
  }
  const home = read("src/pages/tools/ToolsHome.tsx");
  assert.match(home, /knownTools !== null \? String\(rack.length\) : undefined/,
    "пустая прочитанная стойка должна показывать 0, а не прочерк");
  assert.match(home, /dash=\{knownTools === null\}/,
    "непрочитанная стойка должна показывать прочерк");
  const card = read("src/components/ToolMiningCard.tsx");
  assert.match(card, /if \(\(kind === "start" \|\| kind === "collect"\) && \(\!MINING_ENABLED \|\| \!await readMiningEnabled\(\)\)\)/,
    "добыча и сбор остаются недоступны при выключенном флаге");
  assert.match(card, /const canCollect = tool.isMining && hasMiningEnd && done/,
    "неизвестное время завершения не означает готовность к сбору");
  assert.match(card, /hours: selectedHours/, "на сервер уходят те же часы, что показаны на карточке");
  assert.match(card, /mine-start/, "доступная добыча не должна выглядеть серой неактивной кнопкой");
  assert.ok(!/cursor-not-allowed/.test(card), "кнопка добычи снова помечена как недоступная, хотя флаг включён");
  const gallery = read("src/pages/tools/CollectionPage.tsx");
  assert.match(gallery, /homeResourceNames\[language\]/, "названия ресурсов должны совпадать с остальной игрой");
  assert.match(gallery, /copy.rarities\[i\]/, "редкости должны меняться с языком");
});


test("рынок и навигация экономики честно переведены без ложных цен", () => {
  const copy = read("src/i18n/tradeNavigationCopy.ts");
  for (const language of ["ru", "en", "pt", "es", "vi", "id", "fil"]) {
    assert.match(copy, new RegExp(`\\n  ${language}: \\{`), `нет переводов рынка для ${language}`);
  }
  for (const field of ["sonarHint", "hotOpen", "orderbookSub", "calendar"]) {
    assert.equal((copy.match(new RegExp(`${field}:`, "g")) || []).length, 8,
      `${field} должен быть типизирован и переведён на все семь языков`);
  }
  const market = read("src/pages/market/MarketHome.tsx");
  assert.match(market, /blips=\{\[\]\}/, "эхолот не должен изображать цены без источника");
  assert.match(market, /copy.sonarHint/, "эхолот должен объяснять, что цены здесь не запрашиваются");
  assert.ok(!market.includes("сеть не ответила"), "без запроса к сети нельзя объявлять сетевую ошибку");
  assert.match(market, /copy\.hotOpen/, "событийный рынок включён и называется открытым");
  const economy = read("src/pages/economy/EconomyHome.tsx");
  assert.match(economy, /copy\[t.key\]/, "названия вкладок экономики должны меняться с языком");
  assert.match(economy, /aria-pressed=\{sub === t.key\}/, "состояние вкладки должно быть доступно скринридеру");
});


test("капсулы, флюиды и отключённые механики переводятся без подмены данных", async () => {
  const { packsCopy } = await import("../src/i18n/packsCopy.ts");
  const { marketDetailCopy } = await import("../src/i18n/marketDetailCopy.ts");
  const { disabledMechanicCopy } = await import("../src/i18n/disabledMechanicCopy.ts");
  const { humanizeVrfError } = await import("../src/lib/vrfErrors.ts");
  const ids = ["session", "tools_repair"];
  for (const language of ["ru", "en", "pt", "es", "vi", "id", "fil"] as const) {
    for (const field of ["title", "intro", "small", "medium", "big", "configError", "pendingError", "commitUnknown", "refunded"] as const) {
      assert.ok(packsCopy[language][field], `${language}: нет текста ${field} для капсул`);
    }
    for (const field of ["flaskTitle", "flaskExplanation", "flaskRecipe", "flaskNoPrice", "hotExplanation"] as const) {
      assert.ok(marketDetailCopy[language][field], `${language}: нет текста ${field} для рынка`);
    }
    if (language !== "ru") for (const id of ids) {
      assert.ok(disabledMechanicCopy[language].explanations[id].title, `${language}: нет названия ${id}`);
      assert.ok(disabledMechanicCopy[language].explanations[id].reason, `${language}: нет объяснения ${id}`);
    }
    for (const code of ["VRF_POOL_EXHAUSTED", "VRF_POOL_EMPTY", "VRF_ORACLE_UNAVAILABLE", "VRF_SETTLEMENT_DEGRADED", "PRICE_ABOVE_MAXIMUM", "RevealWindowClosed", "LotterySalesClosed"]) {
      const text = humanizeVrfError(code, language);
      assert.ok(text && text !== code, `${language}: нет понятной причины для ${code}`);
      if (language !== "ru") assert.equal(text, humanizeVrfError(humanizeVrfError(code), language),
        `${language}: серверная русская версия ${code} тоже должна переводиться`);
    }
  }
  assert.match(humanizeVrfError("VRF_POOL_EXHAUSTED", "en"), /oracle channels are busy/);
  assert.equal(humanizeVrfError(humanizeVrfError("VRF_POOL_EXHAUSTED"), "en"),
    humanizeVrfError("VRF_POOL_EXHAUSTED", "en"), "уже очеловеченная сервером ошибка тоже должна переводиться");
  assert.equal(humanizeVrfError("UNKNOWN_ORACLE_ERROR", "en"), "UNKNOWN_ORACLE_ERROR", "нельзя выдумывать значение неизвестной ошибки");

  const packs = read("src/pages/tools/PacksPage.tsx");
  assert.match(packs, /if \(!Array.isArray\(r\?\.packs\)\) throw/, "ошибка чтения цен не должна выглядеть как отсутствие капсул");
  assert.match(packs, /p.oddsBps\[4\] === 0/, "пятый, легендарный тир нельзя рекламировать в капсулах");
  assert.match(packs, /if \(!Array.isArray\(r\?\.pending\)\) throw/, "ошибка чтения ожидающих открытий не должна выглядеть как пустой список");
  assert.match(packs, /const visiblePending = address && pendingAddress === address/, "открытия чужого кошелька нельзя показывать");
  assert.match(packs, /const generation = \+\+pollGeneration.current/, "устаревший ответ опроса нельзя показывать после смены кошелька");
  assert.match(packs, /copy.commitUnknown/, "успешная оплата без ID не должна предлагать заплатить ещё раз");
  assert.match(packs, /copy.pendingError/, "недоступный список ожиданий должен явно объясняться");
  const flasks = read("src/pages/market/FlaskMarketplace.tsx");
  assert.match(flasks, /homeResourceNames\[language\]\[flask.resourceId\]/, "названия флюидов должны быть общими для игры");
  assert.match(flasks, /copy.flaskNoPrice/, "отсутствие цены нельзя подменять нулём");
  const notice = read("src/components/ui/FeatureDisabledNotice.tsx");
  assert.match(notice, /DISABLED_MECHANICS\[id\]/, "причины блокировки обязаны оставаться связаны с on-chain guards");
  assert.match(notice, /disabledMechanicCopy\[language\].explanations\[id\]/, "причины блокировки должны переводиться");
});

test("крафт и ремонт переводятся, а цена берётся только из проверенных полей сети", async () => {
  const { readCraftQuote, readCraftBalances, readCraftMints, CRAFT_RESOURCES } = await import("../src/lib/craftReadings.ts");
  const { craftCopy } = await import("../src/i18n/craftCopy.ts");
  const { repairCopy } = await import("../src/i18n/repairCopy.ts");
  const costs = { circuit: 3, silicon: 2, data: 4, neuron: 5, power: 6, mind: 7 };
  assert.deepEqual(readCraftQuote(costs), costs);
  const historicalAliases = Object.fromEntries(RESOURCE_MANIFEST.resources.map((resource: any) => [resource.legacyAliases[0], 1]));
  assert.equal(readCraftQuote(historicalAliases), null, "исторические поля не разрешаются как текущие цены");
  assert.equal(readCraftQuote({ ...costs, neuron: undefined }), null);
  assert.equal(readCraftQuote({ ...costs, silicon: NaN }), null);
  assert.equal(readCraftQuote({ ...costs, data: -1 }), null);
  const chainBalances = { source: "onchain", CIRCUIT: 3, SILICON: 2, DATA: 4, NEURON: 5, POWER: 6, MIND: 7 };
  assert.deepEqual(readCraftBalances(chainBalances), costs);
  const retiredBalances = Object.fromEntries(Object.keys(historicalAliases).map(key => [key, 3]));
  assert.equal(readCraftBalances({ source: "onchain", ...retiredBalances }), null);
  assert.equal(readCraftBalances({ ...chainBalances, source: "local" }), null);
  assert.equal(readCraftBalances({ ...chainBalances, MIND: undefined }), null);
  const minted = Object.fromEntries(CRAFT_RESOURCES.map(({chain}) => [chain, "a".repeat(32)]));
  assert.deepEqual(readCraftMints({ initialized: true, mints: minted }),
    Object.fromEntries(CRAFT_RESOURCES.map(({key}) => [key, "a".repeat(32)])));
  assert.equal(readCraftMints({ initialized: true, mints: {CIRCUIT: "a".repeat(32)} }), null);

  const backend = read("../aof_backend/src/routes/tools.ts");
  assert.match(backend, /res\.json\(\{ circuit, silicon, data, neuron, power, mind, minted, privilege \}\)/,
    "если бэкенд изменит поля котировки, нужно заново сверить клиентскую карту");
  const craft = read("src/pages/tools/CraftPage.tsx");
  assert.match(craft, /const quoteForTarget = craftQuote\?\.rarity === targetRk/,
    "устаревшую котировку другого тира показывать нельзя");
  assert.match(craft, /api\.query\.materialMints\(\)/,
    "адреса ресурсов должны приходить из проверенного сетевого реестра");
  assert.match(craft, /api\.query\.balances\(address\)/,
    "балансы должны читаться из сети, а не подставляться нулями");
  assert.match(craft, /if \(!latest\) \{ setCraftQuote\(null\); flash\(copy.quoteUnavailable\); return; \}/,
    "перед подтверждением нельзя пропускать новую сетевую котировку");
  assert.match(craft, /disabled=\{!preparedMint \|\| !resMints \|\| !quoteForTarget \|\| !activeBalances \|\| !sufficient/,
    "создание нельзя открывать без баланса, минта, котировки и подготовленного инструмента");
  const repair = read("src/pages/tools/RepairPage.tsx");
  assert.match(repair, /Number\(q\?\.amount\) === amt/,
    "котировка ремонта должна соответствовать выбранному количеству");
  assert.match(repair, /quote\?\.address === address && quote\?\.mint === tool\?\.mint && quote\?\.amount === amt/,
    "старая котировка другого кошелька/инструмента не должна открывать кнопку");
  assert.match(repair, /!quoteForSelection \|\| busy/,
    "ремонт без проверенной стоимости или во время транзакции должен быть заблокирован");
  for (const language of ["ru", "en", "pt", "es", "vi", "id", "fil"] as const) {
    for (const key of ["quoteUnavailable", "readinessUnknown", "toolsUnavailable", "repair"] as const) {
      assert.ok(repairCopy[language][key], `${language}: нет перевода ремонта ${key}`);
    }
    for (const key of ["quoteChanged", "mintsUnavailable", "balancesUnavailable", "skrNote", "lastQuote"] as const) {
      assert.ok(craftCopy[language][key], `${language}: нет перевода крафта ${key}`);
    }
  }
});


test("кладовая и гель различают подтверждённый ноль и неполный ответ сети", async () => {
  const { readEconomyBalances, ALL_BALANCE_KEYS, economyResourceName } = await import("../src/lib/economyBalances.ts");
  const registry = read("../aof_backend/src/lib/resourceRegistryCore.ts");
  const declared = registry.match(/export const RESOURCE_MINT_KEYS = \[([^\]]+)\]/);
  assert.ok(declared, "не найден канонический перечень mint-ключей");
  const backendKeys = JSON.parse(`[${declared[1]}]`) as string[];
  assert.deepEqual([...ALL_BALANCE_KEYS].sort(), [...backendKeys].sort(),
    "кладовая должна проверять ровно те же ресурсы, что и сетевой маршрут балансов");
  const confirmed = { source: "onchain", ...Object.fromEntries(ALL_BALANCE_KEYS.map(key => [key, 0])) };
  assert.equal(readEconomyBalances(confirmed)?.SOUL_CORE, 0, "настоящий нулевой баланс виден");
  assert.equal(readEconomyBalances({ ...confirmed, source: "cached" }), null);
  assert.equal(readEconomyBalances({ ...confirmed, POWER: undefined }), null);
  assert.equal(readEconomyBalances({ ...confirmed, POWER: NaN }), null);
  assert.equal(readEconomyBalances({ ...confirmed, POWER: -1 }), null);
  assert.equal(readEconomyBalances({ ...confirmed, POWER: "0" }), null);
  assert.equal(economyResourceName("vi", "BLUE_CORE"), "Lõi xanh lam");
  assert.equal(economyResourceName("en", "SOUL_CORE"), "Soul core");
  const pantry = read("src/pages/economy/Pantry.tsx");
  assert.match(pantry, /useEconomyBalances\(address\)/);
  assert.match(pantry, /copy\.vialNotice/);
  assert.ok(!/баланс \?\? 0|balances\[.*\] \?\? 0/.test(pantry));
  assert.ok(!/стамину|ускоря|удач|битве/.test(pantry), "неподтверждённые эффекты вернулись в кладовую");
});

test("рецепты мастерской совпадают с инструкцией сети и не расходуют неизвестный баланс", async () => {
  const { WORKSHOP_RECIPES, canCraftRecipe } = await import("../src/lib/workshopRecipes.ts");
  const { readEconomyBalances, ALL_BALANCE_KEYS } = await import("../src/lib/economyBalances.ts");
  const mintToKey: Record<string, string> = Object.fromEntries(RESOURCE_MANIFEST.resources.map((resource: any) => [
    resource.mintSource.replace(/^config\./, 'cfg.').replace(/^material_mints\./, 'mm.'),
    resourceKeyForApi(resource.apiName),
  ]));
  const kindToKey: Record<string, string> = Object.fromEntries(RESOURCE_MANIFEST.resources.map((resource: any) => [
    resource.kind,
    resourceKeyForApi(resource.apiName),
  ]));
  const rust = read('../aof-core/src/instructions/craft_recipe.rs');
  const blocks = rust.split(/\n {8}\/\/ \d+ =/).slice(1);
  const network = blocks.map(block => {
    const id = Number(block.match(/\n\s*(\d+) =>/)?.[1]);
    const inputs = [1, 2].flatMap(number => {
      const mint = block.match(new RegExp(`input_${number}_mint\\.key\\(\\) == ((?:mm|cfg)\\.[a-z_]+)`))?.[1];
      const amount = block.match(new RegExp(`input_${number}_acc, (\\d+) \\* RESOURCE_UNIT`))?.[1];
      return mint && amount ? [{ key: mintToKey[mint], amount: Number(amount) }] : [];
    });
    const output = block.match(/mint_out!\([^,]+, [^,]+, (\d+) \* RESOURCE_UNIT, ResourceKind::(\w+)\)/);
    return { id, inputs, output: { key: kindToKey[output?.[2] || ''], amount: Number(output?.[1]) } };
  });
  assert.deepEqual(WORKSHOP_RECIPES.map(({ id, inputs, output }) => ({ id, inputs, output })), network,
    'цены и продукты в мастерской должны совпадать с craft_recipe.rs');
  const zero = readEconomyBalances({ source: 'onchain', ...Object.fromEntries(ALL_BALANCE_KEYS.map(key => [key, 0])) });
  assert.ok(zero);
  assert.equal(canCraftRecipe(WORKSHOP_RECIPES[0], null), false);
  assert.equal(canCraftRecipe(WORKSHOP_RECIPES[0], zero), false);
  assert.equal(canCraftRecipe(WORKSHOP_RECIPES[0], { ...zero, BLUE_CORE: 1 }), true);
  const ui = read('src/pages/economy/Workshop.tsx');
  assert.match(ui, /readEconomyBalances\(await api\.query\.balances\(address\)\)/,
    'перед подписью рецепт обязан прочитать актуальный сетевой баланс');
  assert.match(ui, /getMintAsync\(recipe\.inputs\[0\]\.key\)/);
  assert.match(ui, /!response\?\.tx/, 'создание без кошельковой транзакции не может считаться успешным');
  assert.match(ui, /disabled=\{!address \|\| !affordable \|\| busy\}/);
  assert.match(read('src/i18n/recipeWorkshopCopy.ts'), /en: \{[\s\S]+?gems: 'Gems'/);
});

test('уведомления о недоступных данных и вложенные заголовки рынка следуют выбранному языку', async () => {
  const { unavailableDataCopy } = await import('../src/i18n/unavailableDataCopy.ts');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    for (const id of ['resource_balances', 'quest_progress', 'daily_rewards', 'trust_profile'] as const) {
      assert.ok(unavailableDataCopy[language][id].title);
      assert.ok(unavailableDataCopy[language][id].reason);
    }
  }
  const home = read('src/pages/market/MarketHome.tsx');
  assert.match(home, /function MarketDetailScreen/);
  assert.match(home, /tradeNavigationCopy\[language\]\.market/);
  assert.match(home, /<NavHeader title=\{title\}/);
  assert.ok(!/label: "Листинг"/.test(home), 'заголовок дочернего рынка не должен оставаться на русском');
});

test('листинги отличают сбой сети от пустых прилавков и проверяют точные цены перед покупкой', async () => {
  const { PublicKey } = await import('@solana/web3.js');
  const { readMarketListings, readFreeTools, readListingTreasury } = await import('../src/lib/listingReadings.ts');
  const owner = new PublicKey(new Uint8Array(32).fill(3)).toBase58();
  const seller = new PublicKey(new Uint8Array(32).fill(5)).toBase58();
  const mint = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
  const good = { seller, mint, priceLamports: '100000001' };
  assert.deepEqual(readMarketListings([]), [], 'verified empty is an empty market');
  assert.equal(readMarketListings(null), null);
  assert.equal(readMarketListings({ listings: [] }), null);
  assert.equal(readMarketListings([good, { ...good, seller: '' }]), null);
  assert.equal(readMarketListings([{ ...good, priceLamports: 0 }]), null);
  assert.equal(readMarketListings([{ ...good, priceLamports: '0' }]), null);
  assert.equal(readMarketListings([{ ...good, priceLamports: '0.1' }]), null);
  assert.equal(readMarketListings([{ ...good, priceLamports: '18446744073709551616' }]), null);
  assert.deepEqual(readMarketListings([good]), [good]);
  assert.equal(readListingTreasury({ treasury: '' }), null);
  assert.equal(readListingTreasury({ treasury: seller }), seller);
  assert.equal(readFreeTools(null, owner), null);
  assert.equal(readFreeTools({ tools: null }, owner), null);
  assert.equal(readFreeTools([{ mint, owner: seller }], owner), null);
  assert.deepEqual(readFreeTools([{ mint, owner, staked: false, isMining: false }], owner), [{ mint }]);
  assert.deepEqual(readFreeTools([{ mint, owner, staked: true }], owner), []);

  const page = read('src/pages/market/ListingPage.tsx');
  assert.match(page, /readMarketListings\(await api\.query\.listings\(\)\)/);
  assert.match(page, /listings !== null && listings\.length === 0 && !loading/,
    'only a verified zero listings response can say the market is empty');
  assert.match(page, /readFreeTools\(await api\.query\.myTools\(address\), address\)/,
    'inventory must be read again before offering a tool');
  assert.match(page, /handleTxResponse\(response, intent\)/,
    'market purchase still requires the locally bound intent');
  assert.match(page, /!response\?\.tx/,
    'absence of wallet transaction cannot be announced as a confirmed trade');
  assert.match(page, /BigInt\(row\.priceLamports\)/,
    'sonar must not fabricate a rounded zero when a listing has a small positive price');
  assert.match(page, /listing-cats/, 'listings need a category the player can open');
  assert.match(page, /row\.tool\?\.toolType/, 'a category must filter offers by tool type');
  const { listingCopy } = await import('../src/i18n/listingCopy.ts');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    assert.ok(listingCopy[language].listingsUnavailable);
    assert.ok(listingCopy[language].toolsUnavailable);
    assert.ok(listingCopy[language].invalidPrice);
    assert.ok(listingCopy[language].categoryLabel);
    assert.ok(listingCopy[language].allTools);
    assert.ok(listingCopy[language].categoryEmpty);
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(listingCopy[language].categoryEmpty));
  }
});

test('индекс доверия не показывает расчётные уровни вместо закрытого сетевого источника', () => {
  const route = read('../aof_backend/src/routes/trust.ts');
  assert.match(route, /r\.get\("\/:user"[\s\S]*?res\.status\(503\)/,
    'маршрут доверия изменился — пересмотреть переводы и вернуть проверяемый экран');
  const page = code('src/pages/profile/TrustPage.tsx');
  assert.match(page, /DataUnavailableNotice id="trust_profile"/);
  assert.ok(!/api\.trust\.get|penaltyMult|privileges|Math\.random/.test(page),
    'страница не должна выдавать локальные баллы или привилегии за данные сети');
});

test('профиль показывает только поля Player PDA и не выдаёт офчейн-ранги за сетевые данные', async () => {
  const { readPlayerSnapshot } = await import('../src/lib/playerReadings.ts');
  const owner = '7gANg5wpDNKWTDvkeZLf1KjPDa34wF6X3znTpsBw27ND';
  const valid = { owner, hasTent: false, villagers: 0, villagersAvailable: 0,
    historianCount: 0, medallionCount: 0 };
  assert.deepEqual(readPlayerSnapshot(valid, owner), valid, 'подтверждённые нули остаются нулями');
  for (const invalid of [
    null, {}, { ...valid, owner: 'other' }, { ...valid, hasTent: undefined },
    { ...valid, villagers: undefined }, { ...valid, villagers: '0' },
    { ...valid, villagersAvailable: 1 }, { ...valid, historianCount: -1 },
    { ...valid, medallionCount: NaN },
  ]) assert.equal(readPlayerSnapshot(invalid, owner), null);
  const rust = read('../aof-core/src/state.rs');
  const canonical = rust.match(/pub struct Player \{([\s\S]*?)\n\}/)?.[1] || '';
  for (const name of ['owner', 'has_tent', 'villagers', 'villagers_available', 'historian_count', 'medallion_count']) {
    assert.ok(canonical.includes(`pub ${name}:`), `Player PDA не содержит ${name}`);
  }
  for (const fabricated of ['days_played', 'rebirth_count', 'quests_completed', 'total_harvests']) {
    assert.ok(!canonical.includes(`pub ${fabricated}:`), `${fabricated} появился в Player PDA — пересмотреть экран`);
  }
  const page = code('src/pages/profile/ProfileHome.tsx');
  assert.match(page, /readPlayerSnapshot\(raw\.player, user\)/);
  assert.match(read('../aof_backend/src/routes/query.ts'), /return res\.json\(\{ exists: true, player: deep\(player\) \}\)/);
  assert.match(page, /reading\?\.owner === user/);
  // The public profile cannot authenticate to the admin API. Do not expose
  // dead-end team tools or present a failed audit read as an empty log.
  assert.ok(!/AuditLogPage|EconomyDashboard|NpcDashboard|SandboxPage|copy\.teamSticker/.test(page));
  assert.match(page, /label=\{copy\.gallery\}/);
  assert.match(read('../aof_backend/src/routes/admin-audit.ts'), /r\.use\(adminByMethod\)/);
  assert.match(read('../aof_backend/src/routes/admin-economy.ts'), /r\.use\(adminByMethod\)/);
  assert.match(read('../aof_backend/src/routes/npc.ts'), /r\.post\("\/run", requireAdmin/);
  assert.match(read('../aof_backend/src/routes/sandbox.ts'), /r\.post\("\/run", requireAdmin/);
  assert.match(page, /<Readout label=\{copy\.trust\} dash/);
  assert.ok(!/computeVeteranStatus|computeBadges|daysPlayed|rebirthCount|questsCompleted|api\.trust\.get/.test(page),
    'неизвестный ранг, серия и прогресс заданий не должны появляться в карточке');
  assert.match(read('src/components/PrivilegesPanel.tsx'), /DataUnavailableNotice id="privileges"/);
  assert.match(read('../aof_backend/src/routes/privileges.ts'), /r\.get\("\/:user"[\s\S]*?res\.status\(503\)/,
    'привилегии открылись — вернуть экран проверяемых данных');
  const { profileCopy } = await import('../src/i18n/profileCopy.ts');
  const { unavailableDataCopy } = await import('../src/i18n/unavailableDataCopy.ts');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    assert.ok(profileCopy[language].villagers && profileCopy[language].rebirthDisabled);
    assert.ok(unavailableDataCopy[language].privileges.title);
  }
});

test("закрытый список соседей не притворяется пустым", async () => {
  const source = code("src/pages/friend/FriendsList.tsx");
  assert.match(source, /DataUnavailableNotice id="neighbors"/);
  assert.ok(!/visitsLeft|friend-search|Пока нет друзей/.test(source));
  const { unavailableDataCopy } = await import("../src/i18n/unavailableDataCopy");
  for (const language of ["en", "pt", "es", "vi", "id", "fil", "ru"] as const) {
    assert.ok(unavailableDataCopy[language].neighbors.title);
    assert.ok(unavailableDataCopy[language].neighbors.reason);
  }
});

test("оценки сообщества: пустота только из подтверждённого ответа, ошибка не ноль", async () => {
  const { readPlayerRating, readLeaderboard } = await import("../src/lib/ratingReadings");
  const { PublicKey } = await import("@solana/web3.js");
  const owner = new PublicKey(new Uint8Array(32).fill(2)).toBase58();
  const other = new PublicKey(new Uint8Array(32).fill(3)).toBase58();
  const empty = { user: owner, average: 0, count: 0, ratings: [], verified: false };
  assert.equal(readPlayerRating(empty, owner)?.count, 0);
  for (const invalid of [null, {}, { ...empty, user: other }, { ...empty, ratings: undefined },
    { ...empty, count: 1 }, { ...empty, verified: true }]) {
    assert.equal(readPlayerRating(invalid, owner), null);
  }
  const rated = { user: owner, count: 2, average: 4.5, distribution: [0, 0, 0, 1, 1],
    verified: false, recentRatings: [{ fromUser: other, rating: 5, timestamp: '2026-01-01T00:00:00Z' }] };
  assert.equal(readPlayerRating(rated, owner)?.average, 4.5);
  assert.equal(readPlayerRating({ ...rated, distribution: [0, 0, 0, 1, 0] }, owner), null);
  assert.deepEqual(readLeaderboard({ leaderboard: [] }), []);
  assert.equal(readLeaderboard(null), null);
  assert.equal(readLeaderboard({ leaderboard: [{ rank: 1, user: owner, average: 4.5, count: 5 }] })?.length, 1);
  assert.equal(readLeaderboard({ leaderboard: [{ rank: 1, user: owner, average: 4.5, count: 1 }] }), null);
  assert.equal(readLeaderboard({ leaderboard: [{ rank: 2, user: owner, average: 4.5, count: 5 }] }), null);
  assert.equal(readLeaderboard({ leaderboard: [{ rank: 1, user: 'not-a-wallet', average: 4.5, count: 5 }] }), null);
});

test("рейтинги переведены на семь языков без ложной отметки verified player", async () => {
  const { ratingCopy } = await import("../src/i18n/ratingCopy");
  for (const language of ["en", "pt", "es", "vi", "id", "fil", "ru"] as const) {
    const copy = ratingCopy[language];
    for (const key of ["loading", "unavailable", "connect", "emptyPlayer", "leaderboard", "leaderboardUnavailable", "leaderboardEmpty", "communitySource"] as const) {
      assert.ok(copy[key], `${language}: нет перевода ${key}`);
    }
    assert.ok(copy.reviews(5));
  }
  const mine = code("src/pages/social/PlayerRatingPage.tsx");
  const board = code("src/pages/social/LeaderboardPage.tsx");
  assert.match(mine, /readPlayerRating\(raw, user\)/);
  assert.match(board, /readLeaderboard\(raw\)/);
  assert.ok(!/Verified Player|data\.verified/.test(mine));
  assert.match(mine, /overflow-wrap:anywhere/);
  assert.match(board, /overflow-wrap:anywhere/);
});

test("недоступные портфель и доска заданий не показывают нули или несуществующие награды", async () => {
  const portfolio = code('src/pages/portfolio/PortfolioHome.tsx');
  const quests = code('src/pages/quests/QuestBoardPage.tsx');
  assert.match(portfolio, /DataUnavailableNotice id="portfolio"/);
  assert.match(quests, /DataUnavailableNotice id="quest_progress"/);
  assert.ok(!/netWorth|AnimatedCounter|VipGate/.test(portfolio));
  assert.ok(!/reward\.mind|quests\.map|quests\.daily/.test(quests));
  const { unavailableDataCopy } = await import('../src/i18n/unavailableDataCopy');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    assert.ok(unavailableDataCopy[language].portfolio.title);
    assert.ok(unavailableDataCopy[language].portfolio.reason);
    assert.ok(unavailableDataCopy[language].quest_progress.title);
  }
  const backend = readFileSync(join(root, '..', 'aof_backend/src/routes/portfolio.ts'), 'utf8');
  assert.match(backend, /status\(503\)/);
});

test("кошелёк и предупреждение перед подключением переведены; подтверждение остаётся обязательным", async () => {
  const { walletCopy } = await import('../src/i18n/walletCopy');
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    const c = walletCopy[language];
    for (const key of ['connect', 'disconnect', 'connecting', 'phantom', 'safetyTitle', 'seedWarning', 'signatureWarning',
      'acknowledge', 'disclaimer', 'continue', 'cancel'] as const) {
      assert.ok(c[key], `${language}: нет текста ${key}`);
    }
  }
  const wallet = code('src/components/ui/WalletButton.tsx');
  const notice = code('src/legal/WalletSafetyNotice.tsx');
  assert.match(wallet, /walletCopy\[language\]/);
  assert.match(wallet, /WalletSafetyNotice/);
  assert.match(wallet, /copy\.disconnect/);
  assert.match(notice, /disabled=\{!understood\}/);
  assert.match(notice, /walletCopy\[language\]/);
  assert.match(notice, /<Link to="\/legal\/status">/);
  assert.match(notice, /legalUnavailableCopy\[language\]\.link/);
  assert.match(notice, /overflow-wrap:anywhere/);
});

test('история мастерской переведена целиком: пролог, шесть глав, метаданные и переключение языка', async () => {
  const { siteLore } = await import('../src/i18n/siteLore');
  const ids = ['founding', 'guilds', 'market', 'drum', 'rebirth', 'today'];
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    const copy = siteLore[language];
    assert.ok(copy.lead && copy.heading);
    assert.equal(copy.paragraphs.length, 2);
    assert.deepEqual(copy.chapters.map(ch => ch.id), ids);
    for (const chapter of copy.chapters) {
      assert.ok(chapter.era && chapter.title);
      assert.equal(chapter.paragraphs.length, 2);
      assert.ok(chapter.paragraphs.every(Boolean));
    }
  }
  const content = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  assert.match(content, /id === 'lore' \? siteLore\[language\]/);
  assert.match(extras, /const copy = siteLore\[language\]/);
  assert.match(extras, /copy\.chapters\.map/);
  assert.match(extras, /overflow-wrap:anywhere/);
  assert.match(layout, /id === 'lore' \? siteLore\[language\]/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]+'lore'/);
});

test('прямой предпросмотр соседней лаборатории не выдаёт неизвестные балансы за ноль', () => {
  const source = code('src/pages/friend/FriendFarmPage.tsx');
  assert.match(source, /DataUnavailableNotice id="neighbors"/);
  assert.ok(!/balances|visitsLeft|friendFarm\(/.test(source), 'недостоверные балансы или лимит вернулись в экран соседа');
});

test('карта развития целиком переведена и не выдаёт старые отметки за фактический релиз', async () => {
  const { siteRoadmap } = await import('../src/i18n/siteRoadmap');
  const { roadmapItems } = await import('../src/site/content/roadmap');
  const ids = Array.from({ length: 12 }, (_, i) => `r${i + 1}`);
  assert.deepEqual(roadmapItems.map(x => x.id), ids);
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    const copy = siteRoadmap[language];
    assert.ok(copy.lead && copy.heading && copy.note);
    assert.equal(copy.paragraphs.length, 1);
    assert.deepEqual(Object.keys(copy.eraLabels).sort(), ['done', 'later', 'next', 'now']);
    assert.deepEqual(copy.items.map(x => x.id), ids);
    for (const entry of copy.items) {
      assert.ok(copy.eraLabels[entry.era] && entry.title);
      assert.equal(entry.bullets.length, 3, `${language}/${entry.id}: пропущен пункт`);
      assert.ok(entry.bullets.every(Boolean));
    }
    if (language !== 'ru') assert.doesNotMatch(JSON.stringify(copy), /[А-Яа-яЁё]/,
      `${language}: в переведённой карте остался русский текст`);
  }
  const extras = code('src/site/pages/ExtraSections.tsx');
  const content = code('src/site/pages/ContentPage.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  assert.match(extras, /const copy = siteRoadmap\[language\]/);
  assert.match(extras, /copy\.note/);
  assert.match(extras, /copy\.items\.map/);
  assert.match(extras, /copy\.eraLabels\[it\.era\]/);
  assert.match(extras, /overflow-wrap:anywhere/);
  assert.match(content, /id === 'roadmap' \? siteRoadmap\[language\]/);
  assert.match(layout, /id === 'roadmap' \? siteRoadmap\[language\]/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]+'roadmap'/);
});

test('экспедиция переведена и не выдаёт закрытый commit за награду или возврат', async () => {
  const page = code('src/pages/farm/ExplorationPage.tsx');
  const backend = read('../aof_backend/src/lib/vrfSettlement.ts');
  const rust = read('../aof-core/src/instructions/exploration.rs');
  assert.match(page, /explorationCopy\[language\]/);
  assert.match(page, /homeResourceNames\[language\]/);
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'все видимые тексты берутся из словаря');
  const constants = read('../aof-core/src/constants.rs');
  for (const [resource, symbol, amount] of [
    ['data', 'DATA', 75], ['circuit', 'CIRCUIT', 35], ['silicon', 'SILICON', 35], ['dataset', 'DATASET', 50],
  ] as const) {
    assert.match(page, new RegExp(`id: '${resource}', symbol: '[A-Z]+', amount: ${amount}`));
    assert.match(constants, new RegExp(`TRIP_COST_${symbol}: u64 = ${amount} \\* RESOURCE_UNIT`));
    assert.match(rust, new RegExp(`TRIP_COST_${symbol}`));
  }
  assert.match(backend, /if \(!mint\) return \{ state: "unknown" \}/);
  assert.match(page, /tripCommit\(tool\.mint\)/);
  assert.match(page, /api\.exploration\.status\(transmitter\.commit\)/);
  assert.match(page, /status\?\.state === 'pending'/);
  assert.match(page, /setTrip\('unavailable'\)/);
  assert.match(page, /response\?\.explorationCommit !== transmitter\.commit/);
  assert.match(page, /typeof response\.tx !== 'string'/);
  assert.match(page, /typeof response\?\.tx !== 'string'/);
  assert.match(page, /walletRef\.current !== address/);
  assert.match(page, /setTrip\('closed'\); setNotice\('unknown'\)/, 'закрытый commit не считается успехом');
  assert.match(page, /setInterval/);
  assert.match(page, /ExplorationHall/);
  assert.match(code('src/pages/farm/ExplorationHall.tsx'), /EXPLORATION_ART/);
  assert.match(code('../aof_backend/src/routes/exploration.ts'), /fetchNullable\(explorationStatePda/);
  const { EXPLORATION_SUCCESS_BPS, EXPLORATION_TRIPS_PER_DAY, explorationTierRule } = await import('../src/lib/explorationReadings.ts');
  assert.deepEqual([...EXPLORATION_SUCCESS_BPS], [3000, 4000, 5000, 5500, 6000, 6000, 6500, 7000, 7500, 8000]);
  assert.deepEqual([...EXPLORATION_TRIPS_PER_DAY], [1, 1, 1, 1, 1, 2, 2, 2, 2, 3]);
  assert.equal(explorationTierRule(1)?.rewardMin, 2);
  assert.equal(explorationTierRule(0), null);
  for (const plate of ['bay.jpg', 'sonar.jpg']) {
    assert.ok(existsSync(join(root, 'public/assets/exploration', plate)), plate);
  }
  const { explorationCopy } = await import('../src/i18n/explorationCopy.ts');
  const keys = Object.keys(explorationCopy.ru);
  for (const language of ['en', 'pt', 'es', 'vi', 'id', 'fil', 'ru'] as const) {
    assert.deepEqual(Object.keys(explorationCopy[language]), keys);
    for (const [key, text] of Object.entries(explorationCopy[language])) {
      assert.ok(text.trim(), `${language}.${key} пуст`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}.${key} не переведён`);
    }
  }
});

test('книга заявок: v1 закрыт, v2 платит по подписанной цене за целый ресурс', async () => {
  const page = code('src/pages/market/OrderbookPage.tsx');
  const chart = code('src/components/charts/DepthChart.tsx');
  const backend = code('../aof_backend/src/routes/query.ts');
  const contract = code('../aof-core/src/instructions/orderbook.rs');
  const routes = code('../aof_backend/src/routes/orderbook.ts');
  assert.match(contract, /price_lamports_per_unit\.checked_mul\(amount\)/);
  // v1 остаётся закрыт для новых заявок: старые эскроу должны отменяться, а не
  // читаться как «заявок нет».
  for (const route of ['/buy/place', '/sell/place', '/match']) {
    assert.ok(routes.includes(`r.post('${route}', legacyPaused)`), `${route} must stay closed for older clients`);
  }
  assert.match(routes, /r\.post\('\/buy\/cancel', async/);
  assert.match(routes, /r\.post\('\/sell\/cancel', async/);
  // v2: цена за ЦЕЛЫЙ ресурс, эскроу вверх, кошелёк сверяет ту же сумму.
  for (const route of ['/v2/buy/place', '/v2/sell/place']) {
    assert.match(routes, new RegExp(`r\\.post\\('${route.replace(/\//g, '\\/')}', requireCircuitOpen`), route);
  }
  assert.match(routes, /r\.post\('\/v2\/match', requireCircuitOpen/);
  assert.match(routes, /quoteTotalLamports\(pricePerWhole, amountAtoms\)/);
  // Программа считает тот же итог и отказывает, если эскроу его не покрывает.
  assert.match(contract, /RESOURCE_ATOMS_PER_UNIT - 1\)/);
  assert.match(contract, /require!\(ctx\.accounts\.buy_order\.escrow_lamports >= buyer_pays/);
  const lottery = code('../aof-core/src/instructions/lottery.rs');
  assert.match(lottery, /require!\(price <= max_price_lamports/);
  assert.match(page, /orderbookCopy\[language\]/);
  assert.match(page, /homeResourceNames\[language\]/);
  assert.ok(!/api\.orderbook\.(placeBuy|placeSell|match)\(/.test(page), 'старая v1-форма не возвращается');
  assert.match(page, /api\.orderbook\.placeBuyV2\(/, 'покупка через v2');
  assert.match(page, /api\.orderbook\.matchV2\(/, 'свод доступен из интерфейса');
  assert.match(page, /api\.orderbook\.cancelBuyV2/);
  assert.match(page, /api\.orderbook\.cancelSellV2/);
  assert.match(page, /readOrderbookV2\(await api\.query\.orderbookV2/);
  assert.match(backend, /exhausted: decoded\.filter/);
  assert.match(chart, /BigInt\(level\.amount\)/);
  assert.ok(!/[А-Яа-яЁё]/.test(page + chart), 'видимые подписи только в локалях');
  const { orderbookCopy } = await import('../src/i18n/orderbookCopy.ts');
  const fields = Object.keys(orderbookCopy.ru);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(orderbookCopy[language]), fields);
    for (const [key, value] of Object.entries(orderbookCopy[language])) {
      const text = typeof value === 'function' ? (value as (a: string, b: string) => string)('1', '2') : value;
      assert.ok(text.trim(), `${language}.${key}: пустой текст`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}.${key}: не переведено`);
    }
  }
  assert.ok(!existsSync(new URL('../src/site/content/trade.ts', import.meta.url)), 'старые опасные рекомендации по книге заявок удалены');
  const { siteMarket } = await import('../src/i18n/siteMarket.ts');
  assert.match(siteMarket.en.venues.orderbook, /disabled/);
});

test('книга заявок проверяет PDA, точные u64, стороны и нулевые остатки без Number', async () => {
  const { PublicKey } = await import('@solana/web3.js');
  const { CORE_PROGRAM_ID } = await import('../src/lib/transactionIntent.ts');
  const { readOrderbook, priceSolPerResource, formatResourceUnits, comparePrice } = await import('../src/lib/orderbookReadings.ts');
  const maker = new PublicKey(new Uint8Array(32).fill(3)).toBase58();
  const mint = new PublicKey(new Uint8Array(32).fill(4)).toBase58();
  const order = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('resource_order'), new PublicKey(maker).toBuffer(), new PublicKey(mint).toBuffer()],
    new PublicKey(CORE_PROGRAM_ID),
  )[0].toBase58();
  const row = { pubkey: order, maker, mint, kind: 1, isBuy: true, priceLamportsPerUnit: '9007199254740993', amountRemaining: '1000000000' };
  const book = { buy: [row], sell: [], exhausted: [] };
  assert.deepEqual(readOrderbook(book, mint, 1), book);
  assert.equal(priceSolPerResource('1', 'en'), '1'); // one lamport per atomic token = 1 SOL per full resource
  assert.equal(formatResourceUnits('1000000001'), '1.000000001');
  assert.equal(comparePrice(row, { ...row, priceLamportsPerUnit: '9007199254740992' }), 1);
  assert.equal(readOrderbook({ buy: [], sell: [], exhausted: [{ ...row, amountRemaining: '0' }] }, mint, 1)?.exhausted.length, 1);
  for (const invalid of [
    null, {}, { buy: [], sell: [] }, { ...book, buy: [{ ...row, pubkey: maker }] },
    { ...book, buy: [{ ...row, mint: maker }] }, { ...book, buy: [{ ...row, isBuy: false }] },
    { ...book, buy: [{ ...row, priceLamportsPerUnit: '18446744073709551616' }] },
    { ...book, buy: [{ ...row, amountRemaining: 0 }] },
    { ...book, sell: [{ ...row, isBuy: false }] }, // duplicate PDA
    { ...book, buy: [{ ...row, amountRemaining: '0' }] },
    { buy: [], sell: [], exhausted: [{ ...row, amountRemaining: '1' }] },
  ]) assert.equal(readOrderbook(invalid, mint, 1), null);
});

test('FAQ сайта целиком переведён: 30 вопросов в семи языках, состояния поиска и честные ответы', async () => {
  const { siteFaq } = await import('../src/i18n/siteFaq.ts');
  const ids = siteFaq.ru.items.map(item => item.id);
  const topics = siteFaq.ru.items.map(item => item.topic);
  assert.deepEqual(ids, Array.from({ length: 30 }, (_, i) => i));
  const labels = Object.keys(siteFaq.ru.topics);
  for (const lang of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = siteFaq[lang];
    assert.deepEqual(copy.items.map(item => item.id), ids, `пропущен вопрос: ${lang}`);
    assert.deepEqual(copy.items.map(item => item.topic), topics, `сбились темы: ${lang}`);
    assert.deepEqual(Object.keys(copy.topics), labels);
    for (const [key, value] of Object.entries(copy)) {
      if (key === 'items' || key === 'topics' || key === 'paragraphs') continue;
      assert.ok(typeof value === 'string' && value.trim(), `${lang}.${key} пуст`);
      if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${lang}.${key} без перевода`);
    }
    assert.ok(copy.paragraphs.length > 0);
    for (const item of copy.items) {
      assert.ok(item.q.trim() && item.a.trim(), `${lang}.${item.id} пуст`);
      if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(item.q + item.a), `${lang}.${item.id} без перевода`);
    }
  }
  for (const [file, pattern] of [
    ['src/site/pages/ContentPage.tsx', /id === 'faq' \? siteFaq\[language\]/],
    ['src/site/layout/Layout.tsx', /localizedRoutes = new Set<string>\(\[[^\]]*'faq'/],
    ['src/site/pages/ExtraSections.tsx', /faq\.items\.filter/],
  ] as const) assert.match(code(file), pattern);
  const faq = code('src/site/pages/ExtraSections.tsx');
  assert.match(faq, /setFaqQuery\(''\); setFaqTag\('all'\); setGlossQuery\(''\); \}, \[language\]/);
  assert.match(faq, /overflow-wrap:anywhere/);
  assert.ok(!/faqItems|faqTagsList/.test(faq));
  assert.ok(!/export \* from '\.\/faq'/.test(read('src/site/content/game.ts')));
  assert.equal(existsSync(join(root, 'src/site/content/faq.ts')), false, 'старая версия с непроверенными обещаниями не должна попадать в сборку');
  for (const lang of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    // Книга заявок живёт в v2 (цена за целый ресурс, эскроу в целых числах),
    // поэтому ответ обязан это описывать и не повторять прежнюю формулировку
    // «новые заявки приостановлены»: она относилась к v1-форме.
    assert.match(siteFaq[lang].items[21].a, /цел|whole|inteiro|entero|nguyên vẹn|utuh|buong/i,
      `${lang}: книга заявок должна называть цену за целый ресурс`);
    assert.ok(!/приостанов|pausad|suspens|tạm dừng|ditunda|Nakahinto/i.test(siteFaq[lang].items[21].a),
      `${lang}: книга заявок объявлена приостановленной, хотя v2 работает`);
    assert.match(siteFaq[lang].items[24].a, /not|não|no |Chưa|Belum|Hindi|Пока/i);
    // Живые механики не описываются отрицанием в начале ответа.
    for (const id of [6, 22]) {
      assert.ok(!/^(нет|no|não|no|chưa|belum|hindi)\b/i.test(siteFaq[lang].items[id].a.trim()),
        `${lang}: ответ ${id} объявляет включённую механику закрытой`);
    }
  }
  // ...и код подтверждает: рынок строит инструкции, а книга заявок — v2.
  assert.match(read('../aof_backend/src/routes/hotMarket.ts'), /hotMarketBuy\(/);
  assert.match(read('../aof_backend/src/routes/orderbook.ts'), /v2\/buy\/place/);
  assert.ok(!/err!\(MarketError::TradingDisabled\)\s*there/.test(''), 'sanity');
});

test('локальный журнал сайта переведён на семь языков и не выдаёт отметки за игровые награды', async () => {
  const { siteJournalCopy } = await import('../src/i18n/siteJournalCopy.ts');
  const { parseSiteJournal, siteBadgeIds, readSiteJournal } = await import('../src/site/siteJournal.ts');
  assert.deepEqual(siteBadgeIds, ['reader', 'resource', 'commit', 'pack', 'drum', 'chronicler']);
  const keys = Object.keys(siteJournalCopy.ru);
  for (const lang of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = siteJournalCopy[lang];
    assert.deepEqual(Object.keys(copy), keys, `нет поля журнала: ${lang}`);
    assert.deepEqual(Object.keys(copy.badges), siteBadgeIds, `пропущен значок: ${lang}`);
    const strings = [copy.lead, ...copy.paragraphs, copy.heading, copy.marks,
      copy.visits(5), copy.note, copy.consent, copy.reset, copy.inspect, copy.capsule, copy.wheel, copy.roadmap,
      ...siteBadgeIds.flatMap(id => [copy.badges[id].name, copy.badges[id].description])];
    assert.ok(strings.every(Boolean), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(strings.every(s => !/[А-Яа-яЁё]/.test(s)), `${lang}: осталось русское слово`);
  }
  assert.equal(readSiteJournal(), null, 'без согласия нельзя показывать ложный нулевой прогресс');
  assert.deepEqual(parseSiteJournal('{broken'), { visits: [], badges: [] });
  const forged = JSON.stringify({ visits: ['home', 'home', 'not-a-page', ...Array(100).fill('faq')],
    badges: ['reader', 'reader', 'resource', 'server-reward'] });
  assert.deepEqual(parseSiteJournal(forged), { visits: ['home', 'faq'], badges: ['resource'] });
  assert.deepEqual(parseSiteJournal(JSON.stringify({ visits: ['home', 'faq', 'roadmap', 'energy', 'start'], badges: ['reader'] })).badges, ['reader']);
  const route = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const board = code('src/site/pages/ExtraSections.tsx');
  assert.match(route, /markJournalRoute\(location\.pathname\)/, 'отметки должны записываться при переходах между страницами');
  assert.match(route, /window\.addEventListener\('aof:badge'/);
  assert.match(page, /siteJournalCopy\[language\]/);
  assert.ok(!/quests:\s*\['quests'\]/.test(page), 'игровая механика заданий попала в локальный журнал');
  assert.match(board, /siteBadgeIds\.map\(id/);
  assert.match(board, /journal \?[^\n]*: '— \/ —'/);
});

test('журнал отмечает переходы между страницами только после согласия; сброс и отзыв согласия безопасны', async () => {
  const { CONSENT_KEY, CONSENT_VERSION, MAX_AGE } = await import('../src/legal/consent.ts');
  const { SITE_JOURNAL_KEY, readSiteJournal, recordSiteVisit, recordSiteBadge,
    resetSiteJournal, refreshSiteJournal } = await import('../src/site/siteJournal.ts');
  const data = new Map<string, string>();
  const browserStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browserStorage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  try {
    refreshSiteJournal();
    recordSiteVisit('home');
    recordSiteBadge('resource');
    assert.equal(data.has(SITE_JOURNAL_KEY), false, 'до согласия записи нет');
    const now = Date.now();
    data.set(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, id: 'test', timestamp: now,
      expires: now + MAX_AGE, necessary: true, functional: true, analytics: false, marketing: false }));
    for (const id of ['home', 'faq', 'start', 'energy', 'roadmap', 'roadmap', 'bogus']) recordSiteVisit(id);
    recordSiteBadge('unknown');
    recordSiteBadge('chronicler');
    assert.deepEqual(readSiteJournal(), { visits: ['home', 'faq', 'start', 'energy', 'roadmap'],
      badges: ['reader', 'chronicler'] });
    assert.equal(data.get(SITE_JOURNAL_KEY) !== undefined, true);
    resetSiteJournal();
    assert.deepEqual(readSiteJournal(), { visits: [], badges: [] });
    data.delete(CONSENT_KEY);
    refreshSiteJournal();
    assert.equal(readSiteJournal(), null);
    recordSiteVisit('faq');
    assert.deepEqual(JSON.parse(data.get(SITE_JOURNAL_KEY)!), { visits: [], badges: [] }, 'после отзыва новых записей нет');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    refreshSiteJournal();
  }
});

test('сайт о капсулах и розыгрыше: семь полных переводов, иллюстрации не изображают сетевой выигрыш', async () => {
  const { siteChanceCopy } = await import('../src/i18n/siteChanceCopy.ts');
  const locales = ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const;
  const keys = Object.keys(siteChanceCopy.ru);
  for (const language of locales) {
    const copy = siteChanceCopy[language];
    assert.deepEqual(Object.keys(copy), keys, `${language}: нет блока перевода`);
    for (const route of ['packs', 'lottery'] as const) {
      const article = copy[route];
      assert.deepEqual(Object.keys(article), Object.keys(siteChanceCopy.ru[route]));
      assert.equal(article.paragraphs.length, 2);
      assert.equal(article.steps.length, 3);
      const strings = [article.lead, ...article.paragraphs, article.demoTitle, article.guideTitle, ...article.steps, article.note];
      assert.ok(strings.every(s => s.trim()), `${language}.${route}: пустая строка`);
      if (language !== 'ru') assert.ok(strings.every(s => !/[А-Яа-яЁё]/.test(s)), `${language}.${route}: русский текст`);
    }
    assert.equal(copy.packDemo.sizes.length, 3);
    assert.equal(copy.packDemo.samples.length, 4);
    assert.equal(copy.drumDemo.rhythms.length, 3);
    for (const key of ['packDemo', 'drumDemo'] as const) {
      assert.deepEqual(Object.keys(copy[key]), Object.keys(siteChanceCopy.ru[key]));
      const strings = Object.values(copy[key]).flatMap(v => Array.isArray(v) ? v : typeof v === 'function' ? [v('sample')] : [v]) as string[];
      assert.ok(strings.every(s => s.trim()), `${language}.${key}: пустая строка`);
      if (language !== 'ru') assert.ok(strings.every(s => !/[А-Яа-яЁё]/.test(s)), `${language}.${key}: русский текст`);
    }
  }
  const page = code('src/site/pages/ContentPage.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const demos = code('src/site/ui/Components.tsx');
  assert.match(page, /siteChanceCopy\[language\]\[id\]/);
  assert.ok(!/packs:\s*\['packs'\]|lottery:\s*\['lottery'/.test(page), 'русские игровые инструкции вновь добавлены на страницы сайта');
  assert.ok(!/Билет 0\.0008 SOL|Три размера — честные шансы/.test(read('src/site/content/pages.ts')), 'устаревшая стоимость/гарантия шансов вернулась');
  for (const route of ['packs', 'lottery']) assert.match(layout, new RegExp(`'${route}'`));
  assert.match(demos, /siteChanceCopy\[language\]\.packDemo/);
  assert.match(demos, /siteChanceCopy\[language\]\.drumDemo/);
  assert.match(demos, /sample === null \? copy\.sealed : copy\.opened\(copy\.samples\[sample\]\)/, 'смена языка не должна оставлять образец на старом языке');
  assert.match(demos, /result === null \? copy\.idle : copy\.rhythms\[result\]/, 'ритм должен меняться вместе с языком');
  assert.match(demos, /<fieldset className="site-options">/, 'подписи размеров должны иметь доступную группу');
  const styles = read('src/site/styles/site.css');
  assert.match(styles, /\.site-ritual \{ grid-template-columns: minmax\(0, 1fr\); \}/, 'на телефоне демонстрация должна ужиматься в одну колонку');
  assert.match(styles, /\.site-ritual > \.site-demo-label, \.site-ritual > \.site-button \{ grid-column: 1; \}/, 'подпись не должна создавать вторую колонку на телефоне');
});

test('страница эпох переведена полностью: колесо — иллюстрация, не проверенный сезон и не награда', async () => {
  const { siteSeasons } = await import('../src/i18n/siteSeasons.ts');
  const keys = Object.keys(siteSeasons.ru);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = siteSeasons[language];
    assert.deepEqual(Object.keys(copy), keys, `${language}: неполный словарь эпох`);
    assert.equal(copy.paragraphs.length, 2);
    assert.equal(copy.phases.length, 4);
    const strings = [copy.lead, ...copy.paragraphs, copy.wheelTitle, copy.wheelHint,
      copy.wheelLabel, copy.wheelAction, ...copy.phases, copy.wheelStatus(copy.phases[0]), copy.disclaimer];
    assert.ok(strings.every(s => s.trim()), `${language}: пустая подпись`);
    if (language !== 'ru') assert.ok(strings.every(s => !/[А-Яа-яЁё]/.test(s)), `${language}: русский текст`);
  }
  const page = code('src/site/pages/ContentPage.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const sections = code('src/site/pages/ExtraSections.tsx');
  const fallback = code('src/site/content/pages.ts');
  assert.match(page, /siteSeasons\[language\]/);
  assert.ok(!/seasons:\s*\['seasons'\]/.test(page), 'русские описания механики снова показываются на странице эпох');
  assert.match(layout, /'lottery', 'seasons'/);
  assert.match(sections, /copy\.wheelStatus\(copy\.phases\[phase\]\)/, 'при смене языка текущая фаза должна получать новый перевод');
  assert.match(sections, /copy\.wheelLabel.*copy\.wheelAction/, 'колесо должно иметь переведённое имя для скринридера');
  assert.match(sections, /<Section title=\{copy\.wheelTitle\}>/);
  assert.ok(!/42 дня|42 ступени|0\.15 SOL/.test(fallback), 'страница не должна обещать фиксированный срок и цену');
  assert.match(read('src/site/styles/site.css'), /\.site-season \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
});

test('медальоны доверия переведены как иллюстрации, без выдуманных рангов и привилегий', async () => {
  const { siteTrust, trustMedallionIds } = await import('../src/i18n/siteTrust.ts');
  const ids = ['stranger', 'neighbour', 'partner', 'guildsman', 'elder'];
  assert.deepEqual(trustMedallionIds, ids);
  const fields = Object.keys(siteTrust.ru);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = siteTrust[language];
    assert.deepEqual(Object.keys(copy), fields);
    assert.equal(copy.paragraphs.length, 2);
    assert.deepEqual(copy.medallions.map(item => item.id), ids, `${language}: потерян образ доверия`);
    const strings = [copy.lead, ...copy.paragraphs, copy.heading, copy.note, copy.tierLabel(3),
      ...copy.medallions.flatMap(item => [item.name, item.text])];
    assert.ok(strings.every(s => s.trim()), `${language}: пустая строка`);
    if (language !== 'ru') assert.ok(strings.every(s => !/[А-Яа-яЁё]/.test(s)), `${language}: русский текст`);
  }
  const page = code('src/site/pages/ContentPage.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const sections = code('src/site/pages/ExtraSections.tsx');
  const fallback = code('src/site/content/pages.ts');
  assert.match(page, /siteTrust\[language\]/);
  assert.ok(!/trust:\s*\['trust'\]/.test(page), 'нельзя показывать устаревшую сетевую механику без перевода и проверки');
  assert.match(layout, /'seasons', 'trust'/);
  assert.match(sections, /copy\.medallions\.map\(/);
  assert.match(sections, /aria-hidden="true"/);
  assert.ok(!/5 уровней репутации|Novice → Operator/.test(fallback), 'рекламный рейтинг вновь оказался на странице');
});

test('игровая лотерея переведена: покупка только с потолком цены, неподтверждённых билетов и выигрыша нет', async () => {
  const { lotteryCopy } = await import('../src/i18n/lotteryCopy.ts');
  const { lotteryPda, lotteryU64, readLotteryRound, readLotteryTickets, canRefundLotteryTicket, LOTTERY_SALES_SECONDS, LOTTERY_REFUND_AFTER_SECONDS } = await import('../src/lib/lotteryReadings.ts');
  const { Keypair } = await import('@solana/web3.js');
  const all = ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const;
  const fields = Object.keys(lotteryCopy.ru);
  for (const lang of all) {
    const copy = lotteryCopy[lang];
    assert.deepEqual(Object.keys(copy), fields, `${lang}: нет полей`);
    const strings = Object.values(copy).map(value => typeof value === 'function' ? value('2') : value) as string[];
    assert.ok(strings.every(s => s.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(strings.every(s => !/[А-Яа-яЁё]/.test(s)), `${lang}: остался русский текст`);
  }
  const owner = Keypair.generate().publicKey.toBase58();
  const now = Math.floor(Date.now() / 1000);
  const raw = { roundId: '9007199254740993', ticketsSold: '3', poolLamports: '800000',
    drawn: false, drawCommitted: false, winningTicket: '0', claimed: false, createdAt: String(now - 14 * 86400 - 1) };
  const round = readLotteryRound(raw, raw.roundId)!;
  assert.ok(round);
  assert.ok(readLotteryRound({ ...raw, roundId: '0' }, '0'), 'старые билеты раунда 0 должны оставаться доступными');
  assert.equal(canRefundLotteryTicket(round), true);
  assert.equal(canRefundLotteryTicket({ ...round, drawCommitted: true }), false);
  assert.equal(canRefundLotteryTicket({ ...round, drawn: true }), false);
  const tickets = [0, 2].map(n => ({ pubkey: lotteryPda('lottery_ticket', raw.roundId, String(n)),
    roundId: raw.roundId, ticketNumber: String(n), buyer: owner }));
  assert.deepEqual(readLotteryTickets(tickets, round, owner), tickets);
  assert.deepEqual(readLotteryTickets([], round, owner), []);
  for (const bad of [null, {}, [{ ...tickets[0], buyer: Keypair.generate().publicKey.toBase58() }],
    [{ ...tickets[0], ticketNumber: '3' }], [{ ...tickets[0], pubkey: owner }], [tickets[0], tickets[0]]]) {
    assert.equal(readLotteryTickets(bad, round, owner), null);
  }
  for (const bad of [null, {}, { ...raw, roundId: '2' }, { ...raw, claimed: true },
    { ...raw, ticketsSold: '5x' }, { ...raw, drawn: true, winningTicket: '3' },
    { ...raw, poolLamports: Number.NaN }]) assert.equal(readLotteryRound(bad, raw.roundId), null);
  assert.equal(lotteryU64('18446744073709551616'), false);
  assert.equal(lotteryU64('01'), false);
  assert.equal(lotteryU64('0', true), true);
  assert.equal(LOTTERY_SALES_SECONDS, 7 * 86400);
  assert.equal(LOTTERY_REFUND_AFTER_SECONDS, 14 * 86400);
  assert.match(code('src/pages/market/LotteryHall.tsx'), /data-pool=\{id\}/);
  assert.match(code('src/pages/market/LotteryHall.tsx'), /LOTTERY_ART/);
  for (const plate of ['sol.jpg', 'skr.jpg', 'potato.jpg', 'drum.jpg']) {
    assert.ok(existsSync(join(root, 'public/assets/lottery', plate)), plate);
  }
  assert.match(code('src/pages/market/LotteryPage.tsx'), /setInterval/);
  assert.match(code('../aof_backend/src/routes/lottery.ts'), /POTATO_ESCROW_NOT_DEPLOYED/);
  const page = code('src/pages/market/LotteryPage.tsx');
  const backend = code('../aof_backend/src/routes/lottery.ts');
  assert.match(page, /lotteryCopy\[language\]/);
  assert.match(page, /lotteryU64\(roundId, true\)/, 'раунд 0 нельзя потерять');
  assert.match(page, /readLotteryRound\(await api\.query\.lotteryRound\(id\), id\)/);
  assert.match(page, /readLotteryTickets\(await api\.query\.myTickets\(id, owner\), fresh, owner\)/);
  assert.match(page, /kind: 'lotteryTicket', action, user: owner, roundId: id, ticketNumber:/);
  // Покупка платит только с потолком цены, который подписал игрок: и страница,
  // и интент используют одну константу, а бэкенд отказывает ниже неё.
  assert.match(page, /api\.lottery\.ticketBuy\(\{\s*buyer: owner, roundId: id, maxPriceLamports: LOTTERY_TICKET_PRICE_LAMPORTS,/);
  assert.match(page, /kind: 'lotteryTicket', action: 'buy', user: owner, roundId: id,\s*ticketNumber: fresh\.ticketsSold, maxPriceLamports: LOTTERY_TICKET_PRICE_LAMPORTS/);
  assert.ok(!/api\.lottery\.(roundInit|drawCommit)\(/.test(page), 'в публичной форме не должно быть админ-кнопок');
  assert.match(backend, /r\.post\("\/ticket\/buy", requireCircuitOpen, requireWalletLimits\("lottery_buy"\), requireIdempotency/);
  assert.match(backend, /maxPrice\.lt\(ceiling\)/, 'потолок ниже цены должен отказывать до кошелька');
  assert.match(backend, /r\.post\("\/round\/init", requireAdmin/);
  assert.match(backend, /r\.post\("\/draw\/commit", requireAdmin/);
});

test('правила безопасности полностью переведены без обещаний о недоступных функциях', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteRulesCopy, ruleIds } = await import('../src/i18n/siteRulesCopy');
  assert.equal(ruleIds.length, 9);
  const titleSource = code('src/site/pages/ContentPage.tsx');
  const bodySource = code('src/site/pages/ExtraSections.tsx');
  const layoutSource = code('src/site/layout/Layout.tsx');
  assert.match(titleSource, /id === 'rules' \? siteRulesCopy\[language\]/);
  assert.match(bodySource, /copy\.items\.map\(\(rule\) =>/);
  assert.match(bodySource, /copy\.heading/);
  assert.match(bodySource, /copy\.note/);
  assert.match(layoutSource, /localizedRoutes = new Set<string>\(\[[^\]]*'rules'/);
  assert.match(layoutSource, /const rules = id === 'rules' \? siteRulesCopy\[language\]/);
  assert.match(code('src/site/styles/site.css'), /\.site-accordion summary \{[^}]*overflow-wrap: anywhere/s);
  assert.match(code('src/site/styles/site.css'), /\.site-accordion details > div \{[^}]*overflow-wrap: anywhere/s);
  assert.ok(!/id: 'keys'/.test(code('src/site/content/rules.ts')), 'старое опасное/устаревшее руководство удалено');
  for (const lang of languages) {
    const copy = siteRulesCopy[lang];
    assert.ok(copy.heading.trim() && copy.lead.trim() && copy.note.trim(), lang);
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.deepEqual(copy.items.map(item => item.id), [...ruleIds], `${lang}: одинаковые девять правил`);
    for (const item of copy.items) {
      assert.ok(item.title.trim(), `${lang}: ${item.id} title`);
      assert.equal(item.paragraphs.length, 2, `${lang}: ${item.id} paragraphs`);
      assert.ok(item.paragraphs.every(s => s.trim()), `${lang}: ${item.id} blank`);
    }
    if (lang !== 'ru') {
      const text = [copy.lead, copy.heading, copy.note, ...copy.paragraphs,
        ...copy.items.flatMap(item => [item.title, ...item.paragraphs])].join(' ');
      assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}: untranslated Russian`);
      assert.notEqual(copy.heading, siteRulesCopy.ru.heading);
    }
  }
});

test('сайт инструментов переводит все пять типов и редкостей; рисунки не выдаются за кошелёк или добычу', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteTools } = await import('../src/i18n/siteTools');
  const { toolsCopy, toolName } = await import('../src/i18n/toolsCopy');
  const { TOOL_NFTS, TOOL_RARITIES } = await import('../src/lib/visualAssets');
  const content = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const css = code('src/site/styles/site.css');
  assert.match(content, /id === 'tools' \? siteTools\[language\]/);
  assert.ok(!/tools: \['tools'\]/.test(content), 'не показывать старые инструкции как подтверждённое руководство');
  // Реестр вынесен в собственный компонент витрины: тип перебирается по списку
  // TOOL_NFTS, имя берётся из общего словаря, редкости — из ряда TOOL_RARITIES.
  assert.match(extras, /TOOL_NFTS\.map\(\(tool\) => tool\.id as ToolTypeId\)/);
  assert.match(extras, /TOOL_RARITIES\.map\(\(rarity, index\) =>/);
  assert.match(extras, /toolName\(language, type\)/);
  assert.match(extras, /rarityLabels\[index\]/);
  assert.match(extras, /toolsCatalogCopy\[language\]/, 'реестр инструментов обязан читать свой словарь');
  assert.match(extras, /TOOL_SHIFT_HOURS\.join/, 'часы захода берутся из спецификации, а не из текста');
  assert.match(extras, /catalog\.registryHeading/, 'у реестра нет заголовка');
  assert.match(extras, /copy\.galleryNotice/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'tools'/);
  assert.match(layout, /id === 'tools' \? siteTools\[language\]/);
  assert.match(css, /site-nft-grid \{[^}]*minmax\(min\(100%, 230px\), 1fr\)/);
  assert.match(css, /site-nft__rarities small \{[^}]*overflow-wrap: anywhere/);
  assert.equal(TOOL_NFTS.length, 5);
  assert.equal(TOOL_RARITIES.length, 5);
  for (const lang of languages) {
    const copy = siteTools[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.equal(copy.rarityDescriptions.length, 5, lang);
    assert.equal(toolsCopy[lang].collectionPage.rarities.length, 5, lang);
    for (const tool of TOOL_NFTS) assert.ok(toolName(lang, tool.id).trim(), `${lang}: ${tool.id}`);
    const text = [copy.lead, ...copy.paragraphs, copy.rarityHeading, ...copy.rarityDescriptions,
      copy.rarityNotice, copy.galleryHeading, copy.galleryIntro, copy.galleryNotice].join(' ');
    assert.ok(!text.includes('undefined') && !text.includes('null'), lang);
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}: русский текст`);
  }
});

test('страница добычи на семи языках не объявляет отключённый цикл доступным', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteMine } = await import('../src/i18n/siteMine');
  const { pages } = await import('../src/site/content/pages');
  const body = code('src/site/pages/ExtraSections.tsx');
  const content = code('src/site/pages/ContentPage.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const client = code('src/components/ToolMiningCard.tsx');
  assert.match(client, /useMiningAvailability\(\)/);
  assert.match(code("src/lib/useMiningAvailability.ts"), /config\?\.miningEnabled === true/);
  assert.match(client, /disabled=\{!MINING_ENABLED \|\| busy/);
  assert.match(body, /id === 'mine'[\s\S]*?const copy = siteMine\[language\]/);
  assert.match(body, /copy\.steps\.map\(\(step, index\) =>/);
  assert.match(code('src/site/styles/site.css'), /\.site-steps li \{[^}]*grid-template-columns: 64px minmax\(0, 1fr\)[^}]*overflow-wrap: anywhere/s);
  assert.match(code('src/site/styles/site.css'), /\.site-steps li \{ grid-template-columns: 44px minmax\(0, 1fr\)/);
  assert.match(body, /copy\.expedition/);
  assert.match(body, /copy\.note/);
  assert.match(content, /id === 'mine' \? siteMine\[language\]/);
  assert.ok(!/mine: \['mine', 'exploration'\]/.test(content), 'старые инструкции не должны предлагать запуск');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'mine'/);
  assert.match(layout, /id === 'mine' \? siteMine\[language\]/);
  assert.equal(pages.find(p => p.id === 'mine')?.lead, siteMine.ru.lead);
  assert.equal(pages.find(p => p.id === 'tools')?.lead, (await import('../src/i18n/siteTools')).siteTools.ru.lead);
  for (const lang of languages) {
    const copy = siteMine[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.equal(copy.steps.length, 3, lang);
    const text = [copy.lead, ...copy.paragraphs, copy.heading, ...copy.steps.flatMap(s => [s.title, s.text]), copy.expedition, copy.note].join(' ');
    assert.ok(!text.includes('undefined') && !text.includes('null'), lang);
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}: остался русский`);
  }
});

test('страница рынка: все шесть форматов на семи языках, закрытые торги не объявлены доступными', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteMarket, marketVenueIds } = await import('../src/i18n/siteMarket');
  const { tradeNavigationCopy } = await import('../src/i18n/tradeNavigationCopy');
  const { pages } = await import('../src/site/content/pages');
  const content = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  assert.match(content, /id === 'market' \? siteMarket\[language\]/);
  assert.ok(!/market: \['marketplace', 'orderbook', 'auction', 'hot_market'\]/.test(content), 'старые торговые инструкции не показываются');
  assert.match(extras, /marketVenueIds\.map\(\(venue\) =>/);
  assert.match(extras, /const names = tradeNavigationCopy\[language\]\.market/);
  assert.match(extras, /copy\.venues\[venue\]/);
  assert.match(extras, /copy\.note/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'market'/);
  assert.match(layout, /id === 'market' \? siteMarket\[language\]/);
  assert.equal(pages.find(p => p.id === 'market')?.lead, siteMarket.ru.lead);
  assert.deepEqual([...marketVenueIds], ['listing', 'orderbook', 'auction', 'offer', 'rental', 'hotMarket']);
  const orderbook = code('../aof_backend/src/routes/orderbook.ts');
  for (const path of ['buy/place', 'sell/place', 'match']) assert.ok(orderbook.includes(`r.post('/${path}', legacyPaused)`), path);
  const hotMarket = code('../aof_backend/src/routes/hotMarket.ts');
  assert.match(hotMarket, /hotMarketBuy/, 'событийный рынок обязан строить каноническую покупку');
  assert.match(hotMarket, /hotMarketSellIntoQueue/, 'событийный рынок обязан строить каноническую продажу');
  assert.match(hotMarket, /requireQuote\(/, 'обе стороны подписывают границу цены');
  assert.doesNotMatch(hotMarket, /HOT_MARKET_DISABLED/, 'механика больше не закрыта заглушкой');
  for (const lang of languages) {
    const copy = siteMarket[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.deepEqual(Object.keys(copy.venues).sort(), [...marketVenueIds].sort(), `${lang}: шесть площадок`);
    for (const venue of marketVenueIds) {
      assert.ok(copy.venues[venue].trim(), `${lang}: ${venue}`);
      // Площадка рынка событий называется по живому состоянию: механика
      // включена, поэтому берётся hotOpen, а не «закрыто».
      const label = venue === 'hotMarket' ? tradeNavigationCopy[lang].market.hotOpen
        : tradeNavigationCopy[lang].market[venue];
      assert.ok(label.trim(), `${lang}: название ${venue}`);
    }
    const text = [copy.lead, ...copy.paragraphs, copy.heading, ...Object.values(copy.venues), copy.note].join(' ');
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}: русский фрагмент`);
  }
});

test('сайт экономики: семь переводов показывают схемы, не живые остатки, эмиссию или перерождение', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteEconomy, economyCycleIds } = await import('../src/i18n/siteEconomy');
  const { pages } = await import('../src/site/content/pages');
  const content = code('src/site/pages/ContentPage.tsx');
  const body = code('src/site/pages/ExtraSections.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  assert.match(content, /id === 'economy' \? siteEconomy\[language\]/);
  assert.match(body, /id === 'economy'[\s\S]*?const copy = siteEconomy\[language\]/);
  assert.match(body, /economyCycleIds\.map\(\(id\) =>/);
  assert.match(body, /copy\.incomingItems\.map/);
  assert.match(body, /copy\.outgoingItems\.map/);
  assert.match(body, /copy\.note/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'economy'/);
  assert.match(layout, /id === 'economy' \? siteEconomy\[language\]/);
  assert.equal(pages.find(p => p.id === 'economy')?.lead, siteEconomy.ru.lead);
  assert.deepEqual([...economyCycleIds], ['production', 'craft', 'exchange', 'season']);
  for (const lang of languages) {
    const copy = siteEconomy[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.equal(copy.incomingItems.length, 3, lang);
    assert.equal(copy.outgoingItems.length, 3, lang);
    assert.deepEqual(Object.keys(copy.cycles).sort(), [...economyCycleIds].sort(), `${lang}: циклы`);
    for (const id of economyCycleIds) {
      assert.ok(copy.cycles[id].title.trim(), `${lang}: ${id} title`);
      assert.equal(copy.cycles[id].steps.length, 3, `${lang}: ${id} steps`);
      assert.ok(copy.cycles[id].steps.every(s => s.trim()), `${lang}: ${id} blank`);
    }
    const text = [copy.lead, ...copy.paragraphs, copy.flowHeading, copy.incoming, ...copy.incomingItems,
      copy.outgoing, ...copy.outgoingItems, copy.cyclesHeading, copy.note,
      ...economyCycleIds.flatMap(id => [copy.cycles[id].title, ...copy.cycles[id].steps])].join(' ');
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}: русский текст`);
  }
});

test('статья для инвестора переведена целиком и не выдаёт иллюстрации за доход или работающие механики', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteInvestors } = await import('../src/i18n/siteInvestors');
  const { siteEconomy, economyCycleIds } = await import('../src/i18n/siteEconomy');
  const { pages } = await import('../src/site/content/pages');
  const content = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  assert.match(content, /id === 'investors' \? siteInvestors\[language\]/);
  assert.match(extras, /id === 'investors'[\s\S]*?const copy = siteInvestors\[language\]/);
  assert.match(extras, /const economy = siteEconomy\[language\]/);
  assert.match(extras, /economyCycleIds\.map\(\(id\) =>/);
  assert.match(extras, /copy\.questions\.map\(\(question, index\) =>/);
  assert.match(extras, /copy\.note/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'investors'/);
  assert.match(layout, /id === 'investors' \? siteInvestors\[language\]/);
  assert.equal(pages.find(p => p.id === 'investors')?.lead, siteInvestors.ru.lead);
  assert.ok(!existsSync(new URL('../src/site/content/investors-ext.ts', import.meta.url)), 'старые неподтверждённые показатели не должны оставаться в каталоге');
  assert.ok(!code('src/site/content/game.ts').includes("'./investors-ext'"));
  assert.match(code('src/site/styles/site.css'), /site-guide-warn--numbered \{[^}]*overflow-wrap: anywhere/);
  for (const lang of languages) {
    const copy = siteInvestors[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.equal(copy.questions.length, 5, lang);
    assert.equal(new Set(copy.questions).size, 5, `${lang}: повтор вопроса`);
    assert.ok(economyCycleIds.every(id => siteEconomy[lang].cycles[id]?.steps.length === 3));
    const text = [copy.lead, ...copy.paragraphs, copy.cyclesHeading, copy.flowsHeading,
      copy.questionsHeading, ...copy.questions, copy.note].join(' ');
    assert.ok(copy.questions.every(question => question.trim()), `${lang}: пустой вопрос`);
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}: русский текст`);
  }
});

test('шесть первых смен переведены на семь языков и не предлагают отключённые заявки, задания и перерождение', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteGuide, shiftIds } = await import('../src/i18n/siteGuide');
  const { pages } = await import('../src/site/content/pages');
  const layout = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'guide'/);
  assert.match(layout, /id === 'guide' \? siteGuide\[language\]/);
  assert.match(page, /id === 'guide' \? siteGuide\[language\]/);
  assert.match(extras, /id === 'guide'[\s\S]*?const copy = siteGuide\[language\]/);
  assert.match(extras, /copy\.steps\.map\(\(shift, index\) =>/);
  assert.match(extras, /shift\.caution/);
  assert.match(extras, /shift\.image/);
  assert.ok(!extras.includes('guideSteps.map'), 'устаревший русский маршрут с ложными сроками удалён');
  assert.ok(!existsSync(new URL('../src/site/content/guide.ts', import.meta.url)), 'старые русские инструкции и неподтверждённые пути удалены');
  assert.ok(!code('src/site/content/game.ts').includes("'./guide'"));
  assert.equal(pages.find(p => p.id === 'guide')?.lead, siteGuide.ru.lead);
  assert.deepEqual([...shiftIds], ['wallet', 'garden', 'model', 'tool', 'market', 'season']);
  const css = code('src/site/styles/site.css');
  assert.match(css, /site-guide-step \{[^}]*minmax\(0, 1fr\)[^}]*overflow-wrap: anywhere/);
  assert.match(css, /site-guide-step \{ grid-template-columns: 44px minmax\(0, 1fr\)/);
  assert.match(siteGuide.en.steps[4].caution, /paused/);
  // [§3.4] Перерождение включено: текст смены обязан предупреждать о цене и
  // списке излишков, а не повторять, что механика отключена.
  assert.match(siteGuide.en.steps[5].caution, /Rebirth charges a price/);
  assert.ok(!/rebirth is disabled/.test(siteGuide.en.steps[5].caution));
  for (const lang of languages) {
    const copy = siteGuide[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.deepEqual(copy.steps.map(step => step.id), [...shiftIds], `${lang}: порядок шести смен`);
    const values = [copy.lead, ...copy.paragraphs, copy.heading, copy.note, ...copy.steps.flatMap(s => [s.title, s.action, s.caution, s.image])];
    assert.ok(values.every(value => value.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(!values.some(value => /[А-Яа-яЁё]/.test(value)), `${lang}: русский текст`);
  }
});

test('пять путей и шесть вымышленных голосов стратегий доступны на семи языках без старых обещаний', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteStrategies, pathIds, storyIds } = await import('../src/i18n/siteStrategies');
  const { pages } = await import('../src/site/content/pages');
  const layout = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const css = code('src/site/styles/site.css');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'strategies'/);
  assert.match(layout, /id === 'strategies' \? siteStrategies\[language\]/);
  assert.match(page, /id === 'strategies' \? siteStrategies\[language\]/);
  assert.match(extras, /id === 'strategies'[\s\S]*?const copy = siteStrategies\[language\]/);
  assert.match(extras, /copy\.paths\.map\(\(path\) =>/);
  assert.match(extras, /copy\.stories\.map\(\(story\) =>/);
  assert.match(extras, /copy\.voicesNotice/);
  assert.ok(!extras.includes('masterStories.map') && !extras.includes('strategies.map'));
  assert.ok(!existsSync(new URL('../src/site/content/guide.ts', import.meta.url)));
  assert.ok(!code('src/site/content/game.ts').includes("'./guide'"));
  assert.equal(pages.find(p => p.id === 'strategies')?.lead, siteStrategies.ru.lead);
  assert.match(css, /site-strategy-grid > \*, \.site-strategy-stories > \* \{ min-width: 0; overflow-wrap: anywhere/);
  for (const lang of languages) {
    const copy = siteStrategies[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.deepEqual(copy.paths.map(path => path.id), [...pathIds], `${lang}: пути`);
    assert.deepEqual(copy.stories.map(story => story.id), [...storyIds], `${lang}: герои`);
    const values = [copy.lead, ...copy.paragraphs, copy.heading, copy.voicesHeading, copy.voicesNotice,
      ...copy.paths.flatMap(path => [path.title, path.style, path.description, ...path.tips]),
      ...copy.stories.flatMap(story => [story.character, story.quote, story.context])];
    assert.ok(values.every(value => value.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(!values.some(value => /[А-Яа-яЁё]/.test(value)), `${lang}: русский текст`);
  }
  assert.match(siteStrategies.en.paths[2].description, /paused/);
  assert.match(siteStrategies.en.voicesNotice, /characters/);
});

test('обзор торговых форматов на семи языках не обещает исполнение или пассивный доход', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteTrade } = await import('../src/i18n/siteTrade');
  const { siteMarket, marketVenueIds } = await import('../src/i18n/siteMarket');
  const { tradeNavigationCopy } = await import('../src/i18n/tradeNavigationCopy');
  const { pages } = await import('../src/site/content/pages');
  const layout = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'trade'/);
  assert.match(layout, /id === 'trade' \? siteTrade\[language\]/);
  assert.match(page, /id === 'trade' \? siteTrade\[language\]/);
  assert.match(extras, /id === 'trade'[\s\S]*?const copy = siteTrade\[language\]/);
  assert.match(extras, /marketVenueIds\.map\(\(venue\) =>/);
  assert.match(extras, /venues\.venues\[venue\]/);
  assert.match(extras, /copy\.checks\.map\(\(check, index\) =>/);
  assert.ok(!existsSync(new URL('../src/site/content/trade.ts', import.meta.url)));
  assert.ok(!code('src/site/content/game.ts').includes("'./trade'"));
  assert.equal(pages.find(p => p.id === 'trade')?.lead, siteTrade.ru.lead);
  assert.match(code('src/site/styles/site.css'), /site-trade-grid > \* \{ min-width: 0; overflow-wrap: anywhere/);
  for (const lang of languages) {
    const copy = siteTrade[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.equal(copy.checks.length, 4, lang);
    assert.deepEqual(Object.keys(siteMarket[lang].venues), [...marketVenueIds], `${lang}: шесть площадок`);
    const values = [copy.lead, ...copy.paragraphs, copy.heading, copy.checksHeading, ...copy.checks, copy.note,
      ...marketVenueIds.flatMap(id => [siteMarket[lang].venues[id],
        id === 'hotMarket' ? tradeNavigationCopy[lang].market.hotOpen : tradeNavigationCopy[lang].market[id]])];
    assert.ok(values.every(value => value.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(!values.some(value => /[А-Яа-яЁё]/.test(value)), `${lang}: русский текст`);
  }
  assert.match(siteTrade.en.note, /No return/);
  assert.match(siteTrade.en.paragraphs[1], /paused/);
});

test('индекс инструкций использует точные имена из исходного кода и семиязычные предупреждения', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteDocs, instructionGroups } = await import('../src/i18n/siteDocs');
  const { pages } = await import('../src/site/content/pages');
  const source = read('../aof-core/src/lib.rs');
  const names = instructionGroups.flatMap(group => group.instructions);
  assert.equal(names.length, 15);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    assert.match(source, new RegExp(`\\bpub fn ${name}\\(`), `нет инструкции ${name} в исходном коде`);
  }
  assert.ok(!names.includes('buy_lottery_ticket'));
  assert.ok(!names.includes('place_buy_order'));
  assert.ok(!names.includes('start_mining'));
  const layout = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'docs'/);
  assert.match(layout, /id === 'docs' \? siteDocs\[language\]/);
  assert.match(page, /id === 'docs' \? siteDocs\[language\]/);
  assert.match(extras, /id === 'docs'[\s\S]*?const copy = siteDocs\[language\]/);
  assert.match(extras, /instructionGroups\.map\(\(group\) =>/);
  assert.match(extras, /group\.instructions\.map\(\(instruction\) =>/);
  assert.doesNotMatch(extras.slice(extras.indexOf("if (id === 'docs')"), extras.indexOf('return null;', extras.indexOf("if (id === 'docs')"))), /mechanics\.filter/);
  assert.equal(pages.find(p => p.id === 'docs')?.lead, siteDocs.ru.lead);
  assert.match(code('src/site/styles/site.css'), /site-docs-accordion code \{[^}]*overflow-wrap: anywhere/);
  for (const lang of languages) {
    const copy = siteDocs[lang];
    assert.deepEqual(Object.keys(copy.groups), instructionGroups.map(group => group.id));
    assert.equal(copy.paragraphs.length, 2, lang);
    const values = [copy.lead, ...copy.paragraphs, copy.heading, copy.codeNote, copy.caution,
      ...instructionGroups.flatMap(group => [copy.groups[group.id].title, copy.groups[group.id].description])];
    assert.ok(values.every(value => value.trim()), `${lang}: пропуск`);
    if (lang !== 'ru') assert.ok(!values.some(value => /[А-Яа-яЁё]/.test(value)), `${lang}: русский текст`);
  }
  assert.match(siteDocs.en.caution, /does not verify deployment/);
  assert.match(siteDocs.en.groups.market.description, /paused/);
});

test('книга рецептов сайта показывает те же восемь составов, что и игровая мастерская, на семи языках', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteRecipes } = await import('../src/i18n/siteRecipes');
  const { WORKSHOP_RECIPES } = await import('../src/lib/workshopRecipes');
  const { homeResourceNames } = await import('../src/i18n/homeDetail');
  const { recipeWorkshopCopy } = await import('../src/i18n/recipeWorkshopCopy');
  const { pages } = await import('../src/site/content/pages');
  const layout = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'recipes'/);
  assert.match(layout, /id === 'recipes' \? siteRecipes\[language\]/);
  assert.match(page, /id === 'recipes' \? siteRecipes\[language\]/);
  assert.match(extras, /id === 'recipes'[\s\S]*?const copy = siteRecipes\[language\]/);
  assert.match(extras, /WORKSHOP_RECIPES\.filter\(recipe => recipe\.category === category\)/);
  assert.match(extras, /recipe\.inputs\.map\(\(\{ key, amount \}\) =>/);
  assert.match(extras, /recipe\.output\.amount/);
  assert.ok(!existsSync(new URL('../src/site/content/recipes.ts', import.meta.url)));
  assert.ok(!code('src/site/content/game.ts').includes("'./recipes'"));
  assert.equal(pages.find(p => p.id === 'recipes')?.lead, siteRecipes.ru.lead);
  assert.equal(WORKSHOP_RECIPES.length, 8);
  assert.deepEqual(WORKSHOP_RECIPES.map(recipe => recipe.id), [0, 1, 2, 3, 4, 5, 6, 7]);
  const ids = [...new Set(WORKSHOP_RECIPES.flatMap(recipe => [recipe.output.key, ...recipe.inputs.map(input => input.key)]))];
  for (const id of ids) assert.match(extras, new RegExp(`\\b${id}: '`), `${id}: нет имени ресурса в словаре`);
  assert.match(code('src/site/styles/site.css'), /site-recipe-grid > \*[^}]*overflow-wrap: anywhere/);
  for (const lang of languages) {
    const copy = siteRecipes[lang];
    const values = [copy.lead, ...copy.paragraphs, copy.heading, copy.sourceLabel, copy.inputLabel, copy.outputLabel, copy.note,
      recipeWorkshopCopy[lang].gems, recipeWorkshopCopy[lang].flasks];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.ok(values.every(value => value.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(!values.some(value => /[А-Яа-яЁё]/.test(value)), `${lang}: русский текст`);
    assert.ok(Object.values(homeResourceNames[lang]).every(value => value.trim()));
  }
  assert.match(siteRecipes.en.note, /not your balance/);
});

test('страница MIND переведена на семь языков и не обещает обмен, доход или доступность неподтверждённых действий', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteMind, mindCheckIds, mindSafetyIds, mindVoiceIds } = await import('../src/i18n/siteMind');
  const { pages } = await import('../src/site/content/pages');
  const layout = code('src/site/layout/Layout.tsx');
  const page = code('src/site/pages/ContentPage.tsx');
  const extras = code('src/site/pages/ExtraSections.tsx');
  const css = code('src/site/styles/site.css');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'mind'/);
  assert.match(layout, /id === 'mind' \? siteMind\[language\]/);
  assert.match(page, /id === 'mind' \? siteMind\[language\]/);
  assert.match(extras, /id === 'mind'[\s\S]*?const copy = siteMind\[language\]/);
  assert.match(extras, /copy\.checks\.map\(\(check\) =>/);
  assert.match(extras, /copy\.voices\.map\(\(voice\) =>/);
  assert.match(extras, /copy\.safety\.map\(\(item\) =>/);
  assert.match(extras, /copy\.voicesNotice/);
  assert.equal(pages.find(p => p.id === 'mind')?.lead, siteMind.ru.lead);
  assert.match(css, /site-mind-origin > \*, \.site-mind-grid > \*, \.site-mind-stories > \* \{ min-width: 0; overflow-wrap: anywhere/);
  assert.match(read('../aof-core/src/lib.rs'), /mind_mint/);
  for (const lang of languages) {
    const copy = siteMind[lang];
    assert.equal(copy.paragraphs.length, 2, lang);
    assert.equal(copy.origin.length, 2, lang);
    assert.deepEqual(copy.checks.map(check => check.id), [...mindCheckIds]);
    assert.deepEqual(copy.safety.map(item => item.id), [...mindSafetyIds]);
    assert.deepEqual(copy.voices.map(voice => voice.id), [...mindVoiceIds]);
    const values = [copy.lead, ...copy.paragraphs, copy.originHeading, ...copy.origin, copy.checksHeading,
      ...copy.checks.flatMap(check => [check.title, check.body]), copy.voicesHeading, copy.voicesNotice,
      ...copy.voices.flatMap(voice => [voice.character, voice.quote, voice.context]),
      copy.safetyHeading, ...copy.safety.flatMap(item => [item.title, item.body]), copy.note];
    assert.ok(values.every(value => value.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(!values.some(value => /[А-Яа-яЁё]/.test(value)), `${lang}: русский текст`);
  }
  assert.match(siteMind.en.checks[3].body, /not verified as available/);
  assert.match(siteMind.en.note, /not a promise/);
});

test('вход на сайт и в галерею во время загрузки показывает выбранный язык', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { routeLoadingCopy } = await import('../src/i18n/routeLoadingCopy');
  const main = code('src/main.tsx');
  assert.match(main, /function RouteLoading\(\{ route \}/);
  assert.match(main, /const \{ language \} = useLocale\(\)/);
  assert.match(main, /lang=\{language\} role="status"/);
  assert.match(main, /fallback=\{<RouteLoading route="gallery" \/>\}/);
  assert.match(main, /fallback=\{<RouteLoading route="site" \/>\}/);
  assert.ok(!/[А-Яа-яЁё]/.test(main));
  for (const lang of languages) {
    assert.ok(routeLoadingCopy[lang].gallery.trim() && routeLoadingCopy[lang].site.trim());
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(routeLoadingCopy[lang].gallery + routeLoadingCopy[lang].site));
  }
});

test('производственная цепочка и кузница сайта переведены на семь языков без ложных смет', async () => {
  const { languages } = await import('../src/i18n/translations');
  const { siteWorkshop, farmStageIds, processStageIds, craftStageIds } = await import('../src/i18n/siteWorkshop');
  const { pages } = await import('../src/site/content/pages');
  const page = code('src/site/pages/ContentPage.tsx');
  const layout = code('src/site/layout/Layout.tsx');
  const css = code('src/site/styles/site.css');
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'farm', 'craft'/);
  assert.match(layout, /id === 'farm' \? siteWorkshop\[language\]\.farm/);
  assert.match(layout, /id === 'craft' \? siteWorkshop\[language\]\.craft/);
  assert.match(page, /id === 'farm' \? siteWorkshop\[language\]\.farm/);
  assert.match(page, /id === 'craft' \? siteWorkshop\[language\]\.craft/);
  assert.match(page, /workshopGroups\.map\(group =>/);
  assert.match(page, /group\.steps\.map\(\(step, index\) =>/);
  assert.doesNotMatch(page, /farm: \['farm', 'milling'\]|craft: \['craft'\]/);
  assert.equal(pages.find(p => p.id === 'farm')?.lead, siteWorkshop.ru.farm.lead);
  assert.equal(pages.find(p => p.id === 'craft')?.lead, siteWorkshop.ru.craft.lead);
  assert.match(css, /site-workshop-steps li > \* \{ min-width: 0; overflow-wrap: anywhere/);
  assert.match(css, /site-workshop-note \{[^}]*overflow-wrap: anywhere/);
  for (const lang of languages) {
    const { farm, craft } = siteWorkshop[lang];
    assert.equal(farm.paragraphs.length, 2);
    assert.equal(craft.paragraphs.length, 2);
    assert.deepEqual(farm.cultivation.steps.map(s => s.id), [...farmStageIds]);
    assert.deepEqual(farm.processing.steps.map(s => s.id), [...processStageIds]);
    assert.deepEqual(craft.steps.steps.map(s => s.id), [...craftStageIds]);
    const values = [farm.lead, ...farm.paragraphs, farm.cultivation.heading, farm.processing.heading, farm.note,
      craft.lead, ...craft.paragraphs, craft.steps.heading, craft.note,
      ...[...farm.cultivation.steps, ...farm.processing.steps, ...craft.steps.steps].flatMap(s => [s.title, s.text])];
    assert.ok(values.every(v => v.trim()), `${lang}: пустой текст`);
    if (lang !== 'ru') assert.ok(!values.some(v => /[А-Яа-яЁё]/.test(v)), `${lang}: русский текст`);
  }
  assert.match(siteWorkshop.en.farm.note, /Neither timings nor output quantities.*live quote/);
  assert.match(siteWorkshop.en.craft.steps.steps[3].text, /not proof/);
});

test('словарь сайта сохраняет все 62 определения при смене семи языков и ищет на выбранном языке', async () => {
  const { siteGlossary, glossaryIds } = await import('../src/i18n/siteGlossary');
  const { languages } = await import('../src/i18n/translations');
  const { pages } = await import('../src/site/content/pages');
  const layout = read('src/site/layout/Layout.tsx');
  const page = read('src/site/pages/ContentPage.tsx');
  const extras = read('src/site/pages/ExtraSections.tsx');
  const css = read('src/site/styles/site.css');
  assert.equal(glossaryIds.length, 62);
  assert.equal(new Set(glossaryIds).size, 62);
  assert.equal(pages.find(p => p.id === 'glossary')?.lead, siteGlossary.ru.lead);
  assert.match(layout, /id === 'glossary' \? siteGlossary\[language\]/);
  assert.match(layout, /localizedRoutes = new Set<string>\(\[[^\]]*'glossary'/);
  assert.match(page, /id === 'glossary' \? siteGlossary\[language\]/);
  assert.match(extras, /if \(id === 'glossary'\)[\s\S]*?<Section title=\{gloss.heading\}>/);
  assert.match(extras, /setGlossQuery\(''\)/);
  assert.match(extras, /gloss\.entries\.filter/);
  assert.match(extras, /g\.term \+ ' ' \+ g\.definition/);
  assert.match(extras, /siteGlossary\.ru\.entries\[index\]\.term/);
  assert.match(extras, /includes\(normalizedGloss\)/);
  assert.match(extras, /gloss\.found/);
  assert.match(extras, /gloss\.empty/);
  assert.match(css, /\.site-glossary \.site-paper \{[^}]*overflow-wrap: anywhere/);
  for (const lang of languages) {
    const copy = siteGlossary[lang];
    assert.deepEqual(copy.entries.map(e => e.id), [...glossaryIds], `${lang}: terms missing or reordered`);
    for (const field of [copy.lead, ...copy.paragraphs, copy.heading, copy.search, copy.found, copy.empty, copy.note]) {
      assert.ok(field.trim(), `${lang}: empty page label`);
    }
    for (const entry of copy.entries) {
      assert.ok(entry.term.trim() && entry.definition.trim(), `${lang}: empty ${entry.id}`);
      if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(entry.term + entry.definition), `${lang}: ${entry.id} still in Russian`);
    }
    if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test([copy.lead, ...copy.paragraphs, copy.heading, copy.search, copy.found, copy.empty, copy.note].join(' ')), `${lang}: Russian page copy`);
  }
  assert.notEqual(siteGlossary.en.entries[4].term, siteGlossary.ru.entries[4].term);
  assert.match(siteGlossary.en.note, /not.*advice/i);
  assert.throws(() => read('src/site/content/glossary.ts'), 'stale Russian-only source must be retired');
});

test('27 карточек ресурсов целиком локализованы и рецепты берутся из таблицы программы', async () => {
  const { resources } = await import('../src/site/content/resources');
  const { resourceDetailCopy, resourceRecipes } = await import('../src/i18n/resourceDetailCopy');
  const { homeResourceNames } = await import('../src/i18n/homeDetail');
  const { WORKSHOP_RECIPES } = await import('../src/lib/workshopRecipes');
  const { languages } = await import('../src/i18n/translations');
  const source = read('src/site/pages/ContentPage.tsx');
  const detail = source.slice(source.indexOf('export function ResourceDetail()'), source.indexOf('export function NotFound()'));
  assert.equal(resources.length, 27);
  assert.match(detail, /lang=\{language\} className="site-resource-detail"/);
  assert.match(detail, /resourceRecipes\(resource\.id as ResourceId, language\)/);
  const layout = read('src/site/layout/Layout.tsx');
  assert.match(layout, /'glossary', 'resources'\]\)/);
  assert.match(layout, /res \? homeResourceNames\[language\]\[res\.id as ResourceId\]/);
  assert.match(layout, /res \? resourceLeads\[language\]\[res\.id as ResourceId\]/);
  assert.match(detail, /pageNames\[language\]\[pageId as PageId\]/);
  assert.match(detail, /\{copy\.caution\}/);
  assert.match(detail, /\{copy\.otherSources\}/);
  assert.match(detail, /\{copy\.catalog\}/);
  assert.doesNotMatch(detail, /resource\.(description|sources|sinks)|m\.name/);
  assert.match(read('src/site/styles/site.css'), /\.site-resource-detail \.site-grid > \* \{[^}]*overflow-wrap: anywhere/);
  const allRecipeLines = new Set<number>();
  for (const lang of languages) {
    const copy = resourceDetailCopy[lang];
    for (const label of Object.values(copy)) {
      assert.ok(label.trim(), `${lang}: empty detail label`);
      if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(label), `${lang}: untranslated detail label`);
    }
    for (const resource of resources) {
      const id = resource.id as keyof typeof homeResourceNames.ru;
      const { produces, uses } = resourceRecipes(id, lang);
      for (const line of [...produces, ...uses]) {
        assert.ok(!/[А-Яа-яЁё]/.test(lang === 'ru' ? '' : line), `${lang}: Russian recipe`);
        assert.ok(line.includes(homeResourceNames[lang][id]), `${lang}: ${id} missing from recipe`);
        const recipeId = Number(line.match(/\d+/)?.[0]);
        assert.ok(WORKSHOP_RECIPES.some(r => r.id === recipeId), `${lang}: recipe does not exist`);
        allRecipeLines.add(recipeId);
      }
    }
  }
  assert.equal(allRecipeLines.size, 8);
  assert.match(resourceRecipes('roseQuartz', 'en').uses[0], /3 /, 'recipe 6 must not repeat legacy five-quartz cost');
  assert.deepEqual(resourceRecipes('mind', 'en'), { produces: [], uses: [] }, 'no fictional MIND exchange');
  assert.deepEqual(resourceRecipes('amberQuartz', 'en'), { produces: [], uses: [] });
  assert.ok(!/\b(description|sources|sinks|narrative):/.test(read('src/site/content/resources.ts')), 'legacy claims remain in bundled content');
});

test('экран предложений использует полный словарь семи языков и локализованные названия инструментов', async () => {
  const { offerCopy } = await import('../src/i18n/offerCopy');
  const { languages } = await import('../src/i18n/translations');
  const page = code('src/pages/market/OfferPage.tsx');
  assert.match(page, /const \{ language \} = useLocale\(\)/);
  assert.match(page, /const copy = offerCopy\[language\]/);
  assert.match(page, /toolName\(language, t\.toolType\)/);
  assert.match(page, /toolsCopy\[language\]\.collectionPage\.rarities\[index\]/);
  assert.match(page, /lang=\{language\}/);
  assert.match(page, /txStatus && statusLanguage === language/, 'old-language transaction feedback must be hidden after switching');
  assert.match(page, /overflow-wrap:anywhere/);
  assert.match(page, /htmlFor="offer-price"/);
  assert.match(page, /flex flex-wrap items-center/);
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'visible offer copy must not be embedded in the page');
  const keys = Object.keys(offerCopy.ru).sort();
  for (const lang of languages) {
    const copy = offerCopy[lang];
    assert.deepEqual(Object.keys(copy).sort(), keys, `${lang}: incomplete offer dictionary`);
    for (const [key, text] of Object.entries(copy)) {
      assert.ok(text.trim(), `${lang}.${key} is empty`);
      if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}.${key} still in Russian`);
    }
  }
  assert.match(offerCopy.en.noListings, /could not be read/i, 'failed reads must not be called an empty market');
});

test('аренда переводит сорок состояний на семь языков и не обещает заработок от рисунка', async () => {
  const { rentalCopy } = await import('../src/i18n/rentalCopy');
  const { languages } = await import('../src/i18n/translations');
  const page = code('src/pages/market/RentalPage.tsx');
  assert.match(page, /const \{ language \} = useLocale\(\)/);
  assert.match(page, /const copy = rentalCopy\[language\]/);
  assert.match(page, /toolName\(language, l\.tool\?\.toolType\)/);
  assert.match(page, /toolsCopy\[language\]\.collectionPage\.rarities\[index\]/);
  assert.match(page, /lang=\{language\}/);
  assert.match(page, /txStatus && statusLanguage === language/);
  assert.match(page, /grid-cols-1 sm:grid-cols-2/);
  assert.match(page, /htmlFor="rental-price"/);
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'rental page must not embed Russian player copy');
  const keys = Object.keys(rentalCopy.ru).sort();
  assert.equal(keys.length, 40);
  for (const lang of languages) {
    const copy = rentalCopy[lang];
    assert.deepEqual(Object.keys(copy).sort(), keys, `${lang}: missing rental labels`);
    for (const [key, text] of Object.entries(copy)) {
      assert.ok(text.trim(), `${lang}.${key} is empty`);
      if (lang !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${lang}.${key} still in Russian`);
    }
  }
  assert.match(rentalCopy.en.intro, /does not confirm income or mining availability/);
  assert.match(rentalCopy.en.noRentalsHint, /network may not have answered/);
});

test('auction screen uses seven complete locale catalogs and neutral transaction responses', async () => {
  const page = code('src/pages/market/AuctionPage.tsx');
  assert.match(page, /auctionCopy\[language\]/);
  assert.match(page, /toolName\(language, a\.tool\?\.toolType\)/);
  assert.match(page, /statusLanguage === language/);
  assert.match(page, /htmlFor="auction-min-bid"/);
  assert.match(page, /htmlFor="auction-duration"/);
  assert.match(page, /timeRemaining\(toNum\(a\.endsAt\)\)/);
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'auction page must not contain Russian player-facing copy');
  const { auctionCopy } = await import('../src/i18n/auctionCopy.ts');
  const keys = Object.keys(auctionCopy.ru).sort();
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(auctionCopy[language]).sort(), keys, `${language}: missing auction labels`);
    for (const [key, value] of Object.entries(auctionCopy[language])) {
      assert.ok(value.trim(), `${language}.${key}: blank label`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}.${key}: untranslated`);
    }
  }
  assert.match(auctionCopy.en.emptyHint, /network may not have answered/);
  assert.match(auctionCopy.en.bidResponse, /check auction status/);
  assert.doesNotMatch(auctionCopy.en.bidResponse, /confirmed|accepted/);
});

test('reusable forge instruments follow the active language, including accessibility defaults', async () => {
  const devices = code('src/ui/forge/devices.tsx');
  const provider = code('src/i18n/LocaleProvider.tsx');
  assert.match(provider, /function useInstrumentLanguage\(\)/);
  assert.match(provider, /useContext\(LocaleContext\)\?\.language \?\? 'ru'/);
  assert.match(devices, /forgeDeviceCopy\[useInstrumentLanguage\(\)\]/);
  assert.match(devices, /label \?\? copy\.dewar/);
  assert.match(devices, /labels \?\? \{ active: copy\.working, racked: copy\.onRack \}/);
  assert.match(devices, /aria-label=\{ariaLabel \?\? copy\.sonar\}/);
  assert.match(devices, /aria-label=\{ariaLabel \?\? copy\.crossPanel\}/);
  assert.match(devices, /scaleLabels \?\? copy\.loadScale/);
  assert.match(devices, /aria-label=\{channelLabels\.active\}/);
  assert.match(devices, /aria-label=\{channelLabels\.racked\}/);
  assert.ok(!/[А-Яа-яЁё]/.test(devices), 'no Russian default copy in shared device implementation');
  const { forgeDeviceCopy } = await import('../src/i18n/forgeDeviceCopy.ts');
  const keys = Object.keys(forgeDeviceCopy.ru).sort();
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = forgeDeviceCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), keys);
    assert.equal(copy.loadScale.length, 3);
    for (const value of [...Object.values(copy), ...copy.loadScale]) {
      const labels = Array.isArray(value) ? value : [value];
      for (const label of labels) {
        assert.ok(label.trim(), `${language}: blank instrument label`);
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(label), `${language}: untranslated instrument label`);
      }
    }
  }
  const css = read('src/theme/forge.css');
  assert.match(css, /\.dewar small \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.reader \.fg-key \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.pcard__head span, \.pcard__foot span \{[^}]*overflow-wrap: anywhere/);
});

test('gallery chrome and nine device map entries have seven-language copy for every slide', async () => {
  const gallery = code('src/gallery/VisualGallery.tsx');
  const map = await import('../src/gallery/deviceMap.ts');
  const { galleryCopy } = await import('../src/i18n/galleryCopy.ts');
  const languages = ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const;
  const ids = map.DEVICE_MAP.map((device) => device.key).sort();
  assert.match(gallery, /galleryCopy\[language\]/);
  assert.match(gallery, /<LanguageSwitcher compact \/>/);
  assert.doesNotMatch(gallery, /chrome\.partial|vg-translation-note/);
  assert.match(gallery, /throw new Error\(`Missing gallery translation for \$\{id\}`\)/);
  assert.match(gallery, /<nav aria-label=\{copy\.chrome\.navigation\}>/);
  assert.match(gallery, /const device = \{ \.\.\.DEVICE_BY_KEY\[slide\.device\], \.\.\.copy\.devices\[slide\.device\] \}/);
  assert.match(gallery, /const slideLanguage = language/);
  assert.match(gallery, /<span lang=\{language\}>\s*\{slideMeta\(s\.id\)\.title\}/);
  assert.match(gallery, /lang=\{slideLanguage\}>\{slide\.render\(language\)\}/);
  assert.match(gallery, /lang=\{slideLanguage\}>\{shown\.note\}/);
  assert.equal((gallery.match(/\bid: "[a-z]+-\d{2}"/g) ?? []).length, 50);
  for (const language of languages) {
    const copy = galleryCopy[language];
    assert.deepEqual(Object.keys(copy.devices).sort(), ids, `${language}: missing devices`);
    assert.deepEqual(Object.keys(copy.chrome).sort(), Object.keys(galleryCopy.ru.chrome).sort(), `${language}: missing chrome`);
    for (const [key, value] of Object.entries(copy.chrome)) {
      const text = typeof value === 'function' ? value(2, 50) : value;
      assert.ok(text.trim(), `${language}.${key}: empty chrome`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}.${key}: Russian chrome`);
    }
    for (const device of Object.values(copy.devices)) {
      assert.deepEqual(Object.keys(device).sort(), ['name', 'purpose', 'sub', 'tab']);
      for (const value of Object.values(device)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: Russian device detail`);
      }
    }

  }
  assert.match(read('src/theme/forge.css'), /\.vg-index__item > span:last-child \{[^}]*overflow-wrap: anywhere/);
  assert.match(read('src/theme/forge.css'), /\.vg-facts dd \{[^}]*overflow-wrap: anywhere/);
});

test('all six panel-frame slides have full seven-language titles, descriptions and staged sample copy', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const { frameIds, galleryFrameCopy } = await import('../src/i18n/galleryFrameCopy.ts');
  assert.equal(frameIds.length, 6);
  assert.match(source, /slideMeta\(s\.id\)\.title/);
  assert.match(source, /const shown = slideMeta\(slide\.id\)/);
  assert.match(source, /slide\.render\(language\)/);
  for (const id of frameIds) assert.match(source, new RegExp(`\.\.\.galleryFrameCopy\\.ru\\.slides\\["${id}"\\]`));
  const keys = Object.keys(galleryFrameCopy.ru.sample).sort();
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = galleryFrameCopy[language];
    assert.deepEqual(Object.keys(copy.slides).sort(), [...frameIds].sort());
    assert.deepEqual(Object.keys(copy.sample).sort(), keys);
    for (const id of frameIds) {
      assert.deepEqual(Object.keys(copy.slides[id]).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(copy.slides[id])) {
        assert.ok(value.trim(), `${language}.${id}: missing metadata`);
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}.${id}: Russian metadata`);
      }
    }
    for (const key of keys as (keyof typeof copy.sample)[]) {
      const sample = copy.sample[key];
      assert.deepEqual(Object.keys(sample).sort(), Object.keys(galleryFrameCopy.ru.sample[key]).sort());
      for (const value of Object.values(sample)) {
        for (const text of Array.isArray(value) ? value : [value]) {
          assert.ok(text.trim(), `${language}.${key}: blank sample`);
          if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}.${key}: Russian sample`);
        }
      }
    }
  }
  assert.equal(galleryFrameCopy.ru.sample.swatches.length, 8);
  assert.equal(galleryFrameCopy.en.sample.swatches.length, 8);
});

test('four cryogenic gallery slides translate as one block and use canonical resource names, not obsolete samples', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const cryo = source.split('const cryoSlides: Slide[] = [')[1].split('const mixSlides: Slide[] = [')[0];
  const { cryoIds, galleryCryoCopy } = await import('../src/i18n/galleryCryoCopy.ts');
  assert.equal(cryoIds.length, 4);
  for (const key of cryoIds) {
    assert.match(cryo, new RegExp(`\\.\\.\\.galleryCryoCopy\\.ru\\.slides\\["${key}"\\]`));
  }
  assert.match(source, /cryoIds\.includes\(id as CryoId\)/);
  assert.match(cryo, /homeResourceNames\[language\]/);
  assert.match(cryo, /names\.data, names\.circuit, names\.silicon, names\.power/);
  assert.match(cryo, /names\.neuron, names\.synapse/);
  assert.match(cryo, /name: names\.soulCore/);
  assert.match(cryo, /label=\{c\.energyDemo\}/);
  assert.match(cryo, /label=\{c\.energyUnknown\}/);
  assert.ok(!/SPROUT|EMBER|GOLD|POWER|SKR|REWARD|ЖИДК/.test(cryo), 'legacy sample names must not return to the translated gallery');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = galleryCryoCopy[language];
    assert.deepEqual(Object.keys(copy.slides).sort(), [...cryoIds].sort(), `${language}: missing cryo slide`);
    assert.deepEqual(Object.keys(copy.demo).sort(), Object.keys(galleryCryoCopy.ru.demo).sort());
    for (const entry of Object.values(copy.slides)) {
      assert.deepEqual(Object.keys(entry).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(entry)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value));
      }
    }
    for (const value of Object.values(copy.demo)) {
      assert.ok(value.trim());
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value));
    }
  }
  assert.match(galleryCryoCopy.en.slides['cryo-01'].note, /fictional.*no wallet balance/);
  assert.match(galleryCryoCopy.en.slides['cryo-02'].note, /does not confirm a seasonal reward/);
  assert.match(galleryCryoCopy.en.slides['cryo-04'].note, /Neither measures liquid nitrogen/);
  const css = read('src/theme/forge.css');
  assert.match(css, /\.slot__name \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.cryo-rack__id \{[^}]*flex-wrap: wrap/);
});

test('the five mixer-gallery slides translate all labels and distinguish catalog tools from test channels', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const mixer = source.split('const mixSlides: Slide[] = [')[1].split('const sonarSlides: Slide[] = [')[0];
  const { mixIds, galleryMixCopy } = await import('../src/i18n/galleryMixCopy.ts');
  assert.equal(mixIds.length, 5);
  for (const key of mixIds) assert.match(mixer, new RegExp(`\\.\\.\\.galleryMixCopy\\.ru\\.slides\\["${key}"\\]`));
  assert.match(source, /mixIds\.includes\(id as MixId\)/);
  for (const id of ['plasma_cutter', 'silicon_extractor', 'data_harvester', 'quantum_transmitter', 'neural_seeder']) {
    assert.ok(mixer.includes(`toolName(language, "${id}")`), `${id}: expected canonical localized tool name`);
  }
  assert.match(mixer, /c\.testOne/);
  assert.match(mixer, /c\.testTwo/);
  assert.match(mixer, /c\.testThree/);
  assert.match(mixer, /label=\{c\.shiftChannels\}/);
  assert.match(mixer, /label=\{c\.idle\}/);
  assert.ok(!/станция засева|очиститель|сушилка|"модель"/.test(mixer), 'obsolete/non-tool example names must not return');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = galleryMixCopy[language];
    assert.deepEqual(Object.keys(copy.slides).sort(), [...mixIds].sort(), `${language}: missing mixer slides`);
    assert.deepEqual(Object.keys(copy.sample).sort(), Object.keys(galleryMixCopy.ru.sample).sort());
    for (const entry of Object.values(copy.slides)) {
      assert.deepEqual(Object.keys(entry).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(entry)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated mixer description`);
      }
    }
    for (const value of Object.values(copy.sample)) {
      assert.ok(value.trim());
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated mixer label`);
    }
  }
  assert.match(galleryMixCopy.en.slides['mix-01'].note, /fictional, not a player inventory/);
  assert.match(galleryMixCopy.en.slides['mix-05'].note, /not a wallet reading/);
  const css = read('src/theme/forge.css');
  assert.match(css, /\.strip__name \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.mix__bus \{[^}]*flex-wrap: wrap/);
});

test('six sonar gallery slides translate demo and no-read states without invented live prices', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const sonar = source.split('const sonarSlides: Slide[] = [')[1].split('const plateSlides: Slide[] = [')[0];
  const { sonarIds, gallerySonarCopy } = await import('../src/i18n/gallerySonarCopy.ts');
  assert.equal(sonarIds.length, 6);
  for (const key of sonarIds) assert.match(sonar, new RegExp(`\\.\\.\\.gallerySonarCopy\\.ru\\.slides\\["${key}"\\]`));
  assert.match(source, /sonarIds\.includes\(id as SonarId\)/);
  assert.match(sonar, /ariaLabel=\{c\.slides\["sonar-04"\]\.title\}/);
  assert.match(sonar, /ariaLabel=\{c\.slides\["sonar-05"\]\.title\}/);
  assert.match(sonar, /ariaLabel=\{c\.slides\["sonar-06"\]\.title\}/);
  assert.match(sonar, /\{c\.sample\.lots\}/);
  assert.match(sonar, /\{c\.sample\.layout\}/);
  assert.match(sonar, /\{c\.sample\.listings\}/);
  assert.match(sonar, /\{c\.sample\.prices\}/);
  assert.ok(!/0\.0420|Медиана|чем ближе к центру|реал.{0,8}архив/.test(sonar), 'sample sonar must not present a made-up network price or depth as live');
  const home = code('src/pages/market/MarketHome.tsx');
  const listings = code('src/pages/market/ListingPage.tsx');
  assert.match(home, /<SonarPPI[\s\S]*?blips=\{\[\]\}/);
  assert.match(listings, /BigInt\(row\.priceLamports\)/);
  assert.match(listings, /blips=\{blips\}/);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = gallerySonarCopy[language];
    assert.deepEqual(Object.keys(copy.slides).sort(), [...sonarIds].sort(), `${language}: missing sonar slide`);
    assert.deepEqual(Object.keys(copy.sample).sort(), Object.keys(gallerySonarCopy.ru.sample).sort());
    for (const meta of Object.values(copy.slides)) {
      assert.deepEqual(Object.keys(meta).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(meta)) {
        assert.ok(value.trim(), `${language}: blank sonar metadata`);
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated sonar metadata`);
      }
    }
    for (const value of Object.values(copy.sample)) {
      assert.ok(value.trim());
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated legend`);
    }
  }
  assert.match(gallerySonarCopy.en.slides['sonar-05'].note, /not fetched here/);
  assert.match(gallerySonarCopy.en.slides['sonar-06'].note, /not 24 confirmed lots/);
  assert.match(read('src/theme/forge.css'), /\.sonar__legend \{[^}]*overflow-wrap: anywhere/);
});

test('five plate-gallery slides translate 6×8 live layout and distinguish 8×12 demonstration from owned tools', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const plate = source.split('const plateSlides: Slide[] = [')[1].split('const gelSlides: Slide[] = [')[0];
  const farm = code('src/pages/farm/FarmDashboard.tsx');
  const { plateIds, galleryPlateCopy } = await import('../src/i18n/galleryPlateCopy.ts');
  assert.equal(plateIds.length, 5);
  for (const key of plateIds) assert.match(plate, new RegExp(`\\.\\.\\.galleryPlateCopy\\.ru\\.slides\\["${key}"\\]`));
  assert.match(source, /plateIds\.includes\(id as PlateId\)/);
  assert.match(farm, /<PlateGrid\s+rows=\{6\}\s+cols=\{8\}\s+wells=\{plateWells\}/);
  assert.match(plate, /<PlateGrid\s+rows=\{8\}\s+cols=\{12\}/);
  assert.match(plate, /label: toolsCopy\[language\]\.card\.durability/);
  assert.match(plate, /12 \$\{toolsCopy\[language\]\.card\.hourAbbrev\}/);
  assert.match(plate, /galleryPlateCopy\[language\]\.sample\.shift/);
  assert.match(plate, /galleryPlateCopy\[language\]\.sample\.batch/);
  assert.ok(!/[А-Яа-яЁё]/.test(plate.replace(/group: "[^"]+"/g, '')), 'plate slide copy should live in locale catalog');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = galleryPlateCopy[language];
    assert.deepEqual(Object.keys(copy.slides).sort(), [...plateIds].sort());
    assert.deepEqual(Object.keys(copy.sample).sort(), ['batch', 'shift']);
    for (const meta of Object.values(copy.slides)) {
      assert.deepEqual(Object.keys(meta).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(meta)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated plate metadata`);
      }
    }
    for (const value of Object.values(copy.sample)) {
      assert.ok(value.trim());
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated plate label`);
    }
  }
  assert.match(galleryPlateCopy.en.slides['plate-04'].note, /8 × 12.*not a full rack.*6 × 8/);
  assert.match(galleryPlateCopy.en.slides['plate-05'].note, /fictional/);
});

test('five gel-gallery slides use localized real inventory categories, not retired sample token symbols', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const gel = source.split('const gelSlides: Slide[] = [')[1].split('const crossSlides: Slide[] = [')[0];
  const { gelIds, galleryGelCopy } = await import('../src/i18n/galleryGelCopy.ts');
  const { economyDetailCopy } = await import('../src/i18n/economyDetailCopy.ts');
  assert.equal(gelIds.length, 5);
  assert.match(source, /gelIds\.includes\(id as GelId\)/);
  assert.match(source, /name: economyDetailCopy\[language\]\.lanes\[key\]/);
  assert.match(source, /title: economyDetailCopy\[language\]\.categories\[key\]/);
  assert.ok(!/SPROUT|EMBER|GOLD|POWER|MIND|SKR/.test(gel), 'retired resource names must not imply inventory');
  for (const key of gelIds) assert.match(gel, new RegExp(`\\.\\.\\.galleryGelCopy\\.ru\\.slides\\["${key}"\\]`));
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(galleryGelCopy[language].slides).sort(), [...gelIds].sort());
    assert.equal(Object.keys(economyDetailCopy[language].lanes).length, 6);
    for (const meta of Object.values(galleryGelCopy[language].slides)) {
      assert.deepEqual(Object.keys(meta).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(meta)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated gel copy`);
      }
    }
  }
  assert.match(galleryGelCopy.en.slides['gel-02'].note, /read error is a separate state/);
});

test('five cross-panel gallery slides reuse localized inbox statuses without claiming sender outage', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const cross = source.split('const crossSlides: Slide[] = [')[1].split('const cardsSlides: Slide[] = [')[0];
  const { crossIds, galleryCrossCopy } = await import('../src/i18n/galleryCrossCopy.ts');
  assert.equal(crossIds.length, 5);
  assert.match(source, /crossIds\.includes\(id as CrossId\)/);
  assert.match(cross, /inboxUiCopy\[language\]\.waiting/);
  assert.match(cross, /inboxUiCopy\[language\]\.read/);
  assert.match(cross, /inboxUiCopy\[language\]\.fresh/);
  assert.ok(!/[А-Яа-яЁё]/.test(cross.replace(/group: "[^"]+"/g, '')));
  for (const key of crossIds) assert.match(cross, new RegExp(`\\.\\.\\.galleryCrossCopy\\.ru\\.slides\\["${key}"\\]`));
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(galleryCrossCopy[language].slides).sort(), [...crossIds].sort());
    for (const meta of Object.values(galleryCrossCopy[language].slides)) {
      assert.deepEqual(Object.keys(meta).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(meta)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated cross-panel copy`);
      }
    }
  }
  assert.match(galleryCrossCopy.en.slides['cross-04'].note, /does not yet give it a distinct color/);
});

test('five quest-card slides localize sample labels without inventing a confirmed quest reward', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const cards = source.split('const cardsSlides: Slide[] = [')[1].split('const baroSlides: Slide[] = [')[0];
  const quests = code('src/pages/quests/QuestsHome.tsx');
  const { cardsIds, galleryCardsCopy } = await import('../src/i18n/galleryCardsCopy.ts');
  assert.equal(cardsIds.length, 5);
  assert.match(source, /cardsIds\.includes\(id as CardsId\)/);
  assert.match(quests, /<PunchedCard unknown title=\{copy\.cardTitle\} steps=\{emptyQuestSteps\} rows=\{4\}/);
  assert.match(quests, /length: 12/);
  assert.match(cards, /unknown title=\{questsHomeCopy\[language\]\.cardTitle\} steps=\{steps\("oooooooooooo"\)\} rows=\{4\}/);
  assert.match(cards, /galleryCardsCopy\[language\]\.sampleLabel/);
  for (const key of cardsIds) assert.match(cards, new RegExp(`\\.\\.\\.galleryCardsCopy\\.ru\\.slides\\["${key}"\\]`));
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(galleryCardsCopy[language].slides).sort(), [...cardsIds].sort());
    assert.ok(galleryCardsCopy[language].sampleLabel.trim());
    for (const meta of Object.values(galleryCardsCopy[language].slides)) {
      assert.deepEqual(Object.keys(meta).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(meta)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated card copy`);
      }
    }
  }
  assert.match(galleryCardsCopy.en.slides['cards-03'].note, /does not confirm.*claimed reward/);
});

test('four barograph slides localize forecast scale and avoid invented blackout history', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const baro = source.split('const baroSlides: Slide[] = [')[1].split('const behaviorSlides: Slide[] = [')[0];
  const { baroIds, galleryBaroCopy } = await import('../src/i18n/galleryBaroCopy.ts');
  assert.equal(baroIds.length, 4);
  assert.match(source, /baroIds\.includes\(id as BaroId\)/);
  assert.match(source, /labHeroCopy\[language\]\.load\[type\]/);
  assert.match(baro, /dayLabels=\{sampleDays\} scaleLabels=\{sampleLoadScale\(language\)\}/);
  assert.match(baro, /points=\{\[\]\} dayLabels=\{\[\]\}/);
  for (const key of baroIds) assert.match(baro, new RegExp(`\\.\\.\\.galleryBaroCopy\\.ru\\.slides\\["${key}"\\]`));
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(galleryBaroCopy[language].slides).sort(), [...baroIds].sort());
    for (const meta of Object.values(galleryBaroCopy[language].slides)) {
      assert.deepEqual(Object.keys(meta).sort(), ['note', 'title', 'variant', 'where']);
      for (const value of Object.values(meta)) {
        assert.ok(value.trim());
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated barograph copy`);
      }
    }
  }
  assert.match(galleryBaroCopy.en.slides['baro-04'].note, /not a blackout/);
});

test('all 50 gallery slides have a seven-language catalog entry; behavior slides never invent an ID', async () => {
  const source = code('src/gallery/VisualGallery.tsx');
  const behavior = source.split('const behaviorSlides: Slide[] = [')[1].split('export const SLIDES: Slide[] = [')[0];
  const modules = await Promise.all([
    import('../src/i18n/galleryFrameCopy.ts'),
    import('../src/i18n/galleryCryoCopy.ts'),
    import('../src/i18n/galleryMixCopy.ts'),
    import('../src/i18n/gallerySonarCopy.ts'),
    import('../src/i18n/galleryPlateCopy.ts'),
    import('../src/i18n/galleryGelCopy.ts'),
    import('../src/i18n/galleryCrossCopy.ts'),
    import('../src/i18n/galleryCardsCopy.ts'),
    import('../src/i18n/galleryBaroCopy.ts'),
    import('../src/i18n/galleryBehaviorCopy.ts'),
  ]);
  const fields = [
    ['frameIds', 'galleryFrameCopy'], ['cryoIds', 'galleryCryoCopy'],
    ['mixIds', 'galleryMixCopy'], ['sonarIds', 'gallerySonarCopy'],
    ['plateIds', 'galleryPlateCopy'], ['gelIds', 'galleryGelCopy'],
    ['crossIds', 'galleryCrossCopy'], ['cardsIds', 'galleryCardsCopy'],
    ['baroIds', 'galleryBaroCopy'], ['behaviorIds', 'galleryBehaviorCopy'],
  ] as const;
  const ids = modules.flatMap((mod, i) => mod[fields[i][0]] as string[]);
  assert.equal(ids.length, 50);
  assert.equal(new Set(ids).size, 50);
  assert.deepEqual([...ids].sort(), (source.match(/\bid: "([a-z]+-\d{2})"/g) ?? []).map((value) => value.slice(5, -1)).sort());
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const [i, [idsKey, copyKey]] of fields.entries()) {
      const mod = modules[i];
      assert.deepEqual(Object.keys(mod[copyKey][language].slides).sort(), [...mod[idsKey]].sort());
      for (const meta of Object.values(mod[copyKey][language].slides) as Record<string, string>[]) {
        for (const key of ['title', 'variant', 'where', 'note']) {
          assert.ok(meta[key]?.trim(), `${language}: missing ${key}`);
          if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(meta[key]), `${language}: untranslated ${key}`);
        }
      }
    }
  }
  assert.match(behavior, /<Row k=\{c\.batch\} v="—"/);
  assert.match(behavior, /<Row k=\{c\.stand\} v="—"/);
  assert.match(behavior, /toolName\(language, "quantum_transmitter"\)/);
  assert.match(behavior, /toolsCopy\[language\]\.home/);
  assert.ok(!/0x3f|СТОЙКА · 3|прочитано из сети/.test(behavior));
});

test('site route metadata stays in sync with the visible seven-language page catalogs', async () => {
  const { pages } = await import('../src/site/content/pages.ts');
  const { pageNames, messages } = await import('../src/i18n/translations.ts');
  const { editorialPages } = await import('../src/i18n/siteEditorial.ts');
  const { siteGuide } = await import('../src/i18n/siteGuide.ts');
  assert.equal(pages.length, 30);
  assert.equal(new Set(pages.map(p => p.id)).size, pages.length);
  for (const page of pages) {
    assert.equal(page.title, pageNames.ru[page.id]);
    assert.ok(Object.values(messages.ru).includes(page.group));
    assert.ok(page.lead?.trim(), `${page.id}: missing lead`);
    assert.ok(page.paragraphs?.length, `${page.id}: missing paragraphs`);
  }
  assert.equal(pages.find(p => p.id === 'manifesto')?.lead, editorialPages.ru.manifesto.lead);
  assert.equal(pages.find(p => p.id === 'guide')?.lead, siteGuide.ru.lead);
  assert.match(read('src/site/content/pages.ts'), /siteRoadmap\.ru/);
  assert.ok(!/[А-Яа-яЁё]/.test(code('src/site/content/pages.ts')), 'duplicate Russian site copy');
});

test('all fail-closed API codes have seven-language explanations and preserve the raw code', async () => {
  const { apiErrorCopy, apiErrorCodes } = await import('../src/i18n/apiErrorCopy.ts');
  // Список растёт вместе с бэкендом; важно не число, а полнота и уникальность.
  assert.ok(apiErrorCodes.length >= 48, `в списке только ${apiErrorCodes.length} кодов`);
  assert.equal(new Set(apiErrorCodes).size, apiErrorCodes.length);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(apiErrorCopy[language].messages).sort(), [...apiErrorCodes].sort());
    for (const code of apiErrorCodes) {
      const text = apiErrorCopy[language].messages[code];
      assert.ok(text && text !== code, `${language}: ${code} is not translated`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: Russian fallback for ${code}`);
    }
    assert.match(apiErrorCopy[language].unknownCode('X_DISABLED'), /X_DISABLED/);
  }
  const api = read('src/lib/api.ts');
  assert.match(api, /humanizeApiError\(raw, getApiErrorLanguage\(\)\)/);
  assert.match(api, /const localized = humanizeVrfError\(humanizeApiError\(raw, getApiErrorLanguage\(\)\), getApiErrorLanguage\(\)\)/);
  assert.match(api, /error\.code = raw/);
  assert.match(api, /error\.failClosed = isFailClosedCode\(raw\)/);
  const locale = read('src/i18n/LocaleProvider.tsx');
  assert.match(locale, /setApiErrorLanguage\(language\)/);
  assert.match(read('src/App.tsx'), /className="app-shell" lang=\{language\}/);
});

test('market resource IDs retain their contract order but share localized name sources', async () => {
  const source = code('src/lib/marketUtils.ts');
  const { homeResourceNames } = await import('../src/i18n/homeDetail.ts');
  const { toolsCopy } = await import('../src/i18n/toolsCopy.ts');
  const section = source.split('export const ALL_TRADE_RESOURCES: TradeResource[] = [')[1];
  const entries = [...section.matchAll(/\{ key: "([A-Z_]+)", label: homeResourceNames\.ru\.(\w+), icon: resourceIcon\("[A-Z_]+"\) \|\| "", mint: "", kind: (\d+) \}/g)];
  assert.equal(entries.length, 27);
  for (const [index, entry] of entries.entries()) {
    const id = entry[1].toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    assert.equal(Number(entry[3]), index, `ResourceKind changed for ${entry[1]}`);
    assert.equal(entry[2], id);
    assert.ok(homeResourceNames.ru[id as keyof typeof homeResourceNames.ru]);
  }
  for (const id of ['data', 'circuit', 'silicon']) assert.match(source, new RegExp(`label: homeResourceNames\\.ru\\.${id}`));
  assert.match(source, /toolsCopy\.ru\.collectionPage\.rarities\[index\]/);
  assert.equal(toolsCopy.ru.collectionPage.rarities.length, 5);
});

test('resource categories share the same catalog in all seven languages', async () => {
  const { categoryNames, resources } = await import('../src/site/content/resources.ts');
  const { resourceCatalogCopy } = await import('../src/i18n/resourceCatalogCopy.ts');
  assert.deepEqual(categoryNames, resourceCatalogCopy.ru.labels);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const resource of resources) assert.ok(resourceCatalogCopy[language].labels[resource.category]);
  }
  assert.match(code('src/site/pages/ContentPage.tsx'), /copy\.labels\[r\.category\]/);
  assert.ok(!code('src/site/pages/ContentPage.tsx').includes('categoryNames['));
});

test('transaction guard explanations change language without changing rejection policy', async () => {
  const { txGuardCopy } = await import('../src/i18n/txGuardCopy.ts');
  const source = code('src/lib/txGuard.ts');
  assert.match(source, /txGuardCopy\[getApiErrorLanguage\(\)\]/);
  assert.match(source, /reason: feeError \? copy\.feeFailed : copy\.checkFailed/);
  assert.match(source, /safe: risk !== "HIGH"/);
  assert.ok(!source.includes('reason: `${e.message}`'));
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const labels = txGuardCopy[language];
    for (const label of [labels.payer, labels.payerWarning, labels.blockedProgram, labels.suspiciousProgram,
      labels.blockedAddress, labels.blockedAddressWarning, labels.tokenNoLimit, labels.unknownPrograms,
      labels.checkFailed, labels.feeFailed, labels.simulationError,
      labels.highCost('0.5', '0.1'), labels.highTokenSpend('TOKEN', 5, 2)]) {
      assert.ok(label.trim(), `${language}: missing guard warning`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(label), `${language}: untranslated guard warning`);
    }
  }
});

test('local wallet errors and pending/failed transaction responses follow the active language', async () => {
  const { walletRuntimeCopy } = await import('../src/i18n/walletRuntimeCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const [key, text] of Object.entries(walletRuntimeCopy[language])) {
      assert.ok(text.trim(), `${language}: missing ${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: untranslated ${key}`);
    }
  }
  const adapter = code('src/lib/wallet.ts');
  const flow = code('src/lib/txFlow.ts');
  const store = code('src/store/walletStore.ts');
  assert.match(adapter, /walletText\(\)\.missingTxSignature/);
  assert.match(adapter, /walletText\(\)\.notFound/);
  assert.match(store, /walletRuntimeCopy\[getApiErrorLanguage\(\)\]\.notFoundShort/);
  assert.match(flow, /const language = getApiErrorLanguage\(\);\s+const copy = walletRuntimeCopy\[language\]/);
  assert.match(flow, /response\.pending[^\n]+copy\.pending/);
  assert.match(flow, /e\?\.message === "NEED_WALLET"/);
  assert.match(flow, /signature: typeof e\?\.signature === 'string' \? e\.signature : undefined/);
});

test('long translated errors and support codes wrap inside the toast viewport', () => {
  const toast = code('src/components/ui/Toast.tsx');
  const notice = code('src/components/visual/NoticeMsg.tsx');
  assert.match(toast, /createPortal\(node, document\.body\)/);
  assert.ok(!/-translate-x-1\/2|w-\[calc\(100vw-2rem\)\]|motion\.div/.test(toast),
    "тост снова центрируется transform и может уехать за край телефона");
  assert.match(toast, /left-3 right-3 mx-auto max-w-lg/);
  assert.match(toast, /max-h-\[calc\(100dvh-2rem\)\] overflow-y-auto/);
  assert.match(toast, /\[overflow-wrap:anywhere\]/);
  assert.match(notice, /<span className="min-w-0 \[overflow-wrap:anywhere\]">\{n\.text\}<\/span>/);
});

test('27 visual assets use canonical IDs only; retired resource aliases are rejected', async () => {
  const { RESOURCES, PLAYABLE_RESOURCES, SPECIAL_RESOURCES, TOOL_NFTS, resourceVisual } = await import('../src/lib/visualAssets.ts');
  const { homeResourceNames } = await import('../src/i18n/homeDetail.ts');
  assert.equal(PLAYABLE_RESOURCES.length, 26);
  assert.equal(SPECIAL_RESOURCES.length, 1);
  assert.equal(RESOURCES.length, 27);
  assert.equal(new Set(RESOURCES.map(r => r.id)).size, 27);
  for (const r of RESOURCES) {
    const id = r.id as keyof typeof homeResourceNames.ru;
    assert.equal(r.name, homeResourceNames.ru[id]);
    assert.equal(r.en, homeResourceNames.en[id]);
    assert.equal(resourceVisual(r.id)?.plate, r.plate);
    const canonicalIdForLabel = RESOURCES.find(candidate => candidate.id.toUpperCase() === r.name.trim().toUpperCase())?.id;
    assert.equal(resourceVisual(r.name)?.id, canonicalIdForLabel,
      `a display label resolves only when it exactly equals a canonical resource ID: ${r.id}`);
  }
  const historical = JSON.parse(read('../docs/RESOURCE_MANIFEST.json'));
  const retiredKeys = historical.resources.flatMap((resource: any) => resource.legacyAliases.map((alias: string) => alias.toUpperCase()));
  for (const retired of [...retiredKeys, 'Фотон-бит', 'Био-чип', 'Ядро души', 'Голубое ядро']) {
    assert.equal(resourceVisual(retired), undefined, `${retired}: historical identifiers must not resolve`);
  }
  for (const canonical of ['DATA', 'CIRCUIT', 'SILICON', 'NEURON', 'SYNAPSE', 'SIGNAL', 'MODEL', 'POWER']) {
    assert.ok(resourceVisual(canonical), `${canonical}: canonical on-chain key must resolve`);
  }
  assert.equal(TOOL_NFTS.length, 5);
  assert.ok(TOOL_NFTS.every(tool => tool.id && tool.base));
  assert.ok(!/[А-Яа-яЁё]/.test(code('src/lib/visualAssets.ts').split('export const PLAYABLE_RESOURCES:')[1].split('export const SPECIAL_RESOURCES')[0]));
});

test('exact amount validation and confirmation failures are translated without altering payment results', async () => {
  const { transactionValidationCopy } = await import('../src/i18n/transactionValidationCopy.ts');
  const { setApiErrorLanguage } = await import('../src/lib/apiErrorLanguage.ts');
  const { positiveU64, solToLamports } = await import('../src/lib/amounts.ts');
  const { confirmSignature } = await import('../src/lib/confirmation.ts');
  const signature = '1'.repeat(64);
  try {
    for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
      setApiErrorLanguage(language);
      const copy = transactionValidationCopy[language];
      assert.equal(solToLamports('0.000000001'), '1');
      assert.equal(positiveU64('18446744073709551615'), '18446744073709551615');
      assert.throws(() => positiveU64('18446744073709551616'), { message: copy.positiveU64 });
      assert.throws(() => solToLamports('0.0000000001'), { message: copy.solPrecision });
      await assert.rejects(confirmSignature({ getSignatureStatuses: async () => { throw Error('must not call RPC'); } } as any, 'bad'), { message: copy.invalidSignature });
      await assert.rejects(confirmSignature({ getSignatureStatuses: async () => ({ value: [{ err: 'failed' }] }) } as any, signature, async () => {}, 1),
        { message: `${copy.executionFailed}: ${signature}` });
      await assert.rejects(confirmSignature({ getSignatureStatuses: async () => ({ value: [null] }) } as any, signature, async () => {}, 1),
        { message: `${copy.confirmationUnknown}: ${signature}` });
      await confirmSignature({ getSignatureStatuses: async () => ({ value: [{ err: null, confirmationStatus: 'confirmed' }] }) } as any, signature, async () => {}, 1);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(Object.values(copy).join(' ')), `${language}: untranslated validation`);
    }
  } finally {
    setApiErrorLanguage('ru');
  }
});

test('laboratory and plot reuse translated resource and building names without duplicate Russian fallbacks', async () => {
  const { farmPlotCopy, buildingKeys } = await import('../src/i18n/farmPlotCopy.ts');
  const { homeResourceNames } = await import('../src/i18n/homeDetail.ts');
  const lab = code('src/components/farm/LabHero.tsx');
  const buildings = code('src/lib/buildings.ts');
  const keys = [...lab.split('const LAB_RESOURCES = [')[1].split('] as const;')[0].matchAll(/\{ key: "([A-Z]+)" \}/g)].map(m => m[1]);
  assert.deepEqual(keys, ['DATA', 'CIRCUIT', 'SILICON', 'POWER', 'NEURON', 'SYNAPSE', 'SIGNAL', 'MODEL']);
  assert.match(lab, /homeResourceNames\[language\]\[r\.key\.toLowerCase\(\) as ResourceId\]/);
  for (const key of keys) assert.ok(homeResourceNames.ru[key.toLowerCase() as keyof typeof homeResourceNames.ru]);
  assert.equal(Object.keys(farmPlotCopy.ru.buildings).length, 5);
  assert.match(buildings, /name: farmPlotCopy\.ru\.buildings\.plasma_cutter/);
  assert.match(buildings, /data_harvester: [^\n]*resource: "DATASET"/);
  assert.match(buildings, /quantum_transmitter: [^\n]*resource: "DATASET"/);
  for (const old of ['axe', 'pick', 'spear', 'bow', 'reaper']) assert.equal(buildingKeys[old], undefined);
});

test('disabled mechanics keep canonical guard identifiers and translate all player copy', async () => {
  const { disabledMechanicCopy } = await import('../src/i18n/disabledMechanicCopy.ts');
  const notice = read('src/components/ui/FeatureDisabledNotice.tsx');
  const ids = ['session', 'tools_repair'] as const;
  for (const id of ids) assert.match(notice, new RegExp(`${id}: \\{ guard:`));
  // [AUDIT F-16] Коллекционеры живые (allowlist оператора), поэтому постоянной
  // плашки «недоступно» быть не должно: панель работает с живым состоянием.
  assert.doesNotMatch(notice, /^  collectors: \{/m, 'коллекционеры включены — плашка была бы ложью');
  assert.ok(!('collectors' in disabledMechanicCopy.ru.explanations),
    'тексты «недоступно» для коллекционеров больше не нужны');
  assert.match(notice, /const m = DISABLED_MECHANICS\[id\]/);
  assert.match(notice, /disabledMechanicCopy\[language\]\.explanations\[id\]/);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.deepEqual(Object.keys(disabledMechanicCopy[language].explanations).sort(), [...ids].sort());
    const text = [disabledMechanicCopy[language].noCharge, disabledMechanicCopy[language].supportCode,
      ...Object.values(disabledMechanicCopy[language].explanations).flatMap(e => [e.title, e.reason])].join(' ');
    assert.ok(text.trim());
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: untranslated notice`);
  }
});

test('VRF codes reach the specific seven-language explanation without a false charge or refund guarantee', async () => {
  const { vrfCopy, legacyVrfRussian } = await import('../src/i18n/vrfCopy.ts');
  const { isKnownVrfCode, humanizeVrfError } = await import('../src/lib/vrfErrors.ts');
  const availability = code('src/lib/availability.tsx');
  const api = code('src/lib/api.ts');
  assert.match(availability, /if \(isKnownVrfCode\(code\)\) return code/);
  assert.match(api, /const localized = humanizeVrfError\(humanizeApiError\(raw, getApiErrorLanguage\(\)\), getApiErrorLanguage\(\)\)/);
  assert.match(api, /error\.code = raw/);
  assert.match(api, /error\.failClosed = isFailClosedCode\(raw\)/);
  for (const code of ['VRF_ORACLE_UNAVAILABLE', 'VRF_SETTLEMENT_DEGRADED']) assert.equal(isKnownVrfCode(code), true);
  assert.equal(isKnownVrfCode('VRF_OTHER_UNAVAILABLE'), false);
  assert.equal(vrfCopy.ru.length, 7);
  assert.equal(legacyVrfRussian.length, 7);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const [i, text] of vrfCopy[language].entries()) {
      assert.ok(text.trim(), `${language}: no VRF error ${i}`);
      assert.equal(humanizeVrfError(legacyVrfRussian[i], language), text, `${language}: unsafe legacy text leaked`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: untranslated VRF error`);
    }
    assert.equal(humanizeVrfError('VRF_SETTLEMENT_DEGRADED', language), vrfCopy[language][3]);
  }
  assert.doesNotMatch(vrfCopy.en[2], /no funds were charged/i);
  assert.doesNotMatch(vrfCopy.en[3], /will be revealed or refunded/i);
});

test('visual gallery uses stable group IDs while Russian documentation keeps its device names', () => {
  const gallery = code('src/gallery/VisualGallery.tsx');
  const generator = read('scripts/device-map.mjs');
  const slides = [...gallery.matchAll(/id: "([a-z]+-\d{2})",\s*\n\s*group: "([a-z]+)",\s*\n\s*device: "([a-z]+)"/g)];
  assert.equal(slides.length, 50);
  const ids = [...new Set(slides.map(([, , group]) => group))].sort();
  assert.deepEqual(ids, ['baro', 'behavior', 'cards', 'cross', 'cryo', 'frame', 'gel', 'mix', 'plate', 'sonar']);
  for (const [, id, group, device] of slides) assert.equal(id.startsWith('beh-') ? 'behavior' : device, group);
  assert.match(generator, /entries\.find\(\(entry\) => entry\.key === key\)\?\.name/);
  assert.match(generator, /groupTitle\(g\.name\)/);
  assert.ok(!/[А-Яа-яЁё]/.test(slides.map(([, , group]) => group).join('')));
});

test('resource catalog clears an incompatible search immediately when the language changes', () => {
  const catalog = code('src/site/pages/ContentPage.tsx').split('export function ResourcesCatalog()')[1].split('export function ResourcePage')[0];
  assert.match(catalog, /const \[search, setSearch\] = useState\(\{ language, query: '' \}\)/);
  assert.match(catalog, /const query = search\.language === language \? search\.query : ''/);
  assert.match(catalog, /setSearch\(\{ language, query: e\.target\.value \}\)/);
  assert.match(catalog, /resourceName\(r\.id, r\.name\) \+ ' ' \+ resourceLead\(r\.id, r\.lead\)/);
  assert.ok(!/\+ r\.name|\+ r\.lead/.test(catalog), 'Russian fallback re-entered foreign-language search');
});

test('weather labels use the selected language and only defined on-chain rates', async () => {
  const { weatherCopy } = await import('../src/i18n/weatherCopy.ts');
  const { labHeroCopy } = await import('../src/i18n/labHeroCopy.ts');
  const { wellCopy } = await import('../src/i18n/wellCopy.ts');
  const weather = code('src/lib/weather.ts');
  const widget = code('src/components/ui/WeatherWidget.tsx');
  assert.match(weather, /new Map\(Object\.values\(WEATHER_BY_INDEX\)\.map\(\(\{ effect, rate \}\)/);
  assert.match(weather, /if \(rate === undefined\) return ''/);
  assert.match(weather, /copy\.stationIdle/);
  assert.match(weather, /copy\.stationRate/);
  assert.match(weather, /\.\.\.labHeroCopy\.ru\.load/);
  assert.match(weather, /SEASON_LABELS: Record<string, string> = wellCopy\.ru\.seasonNames/);
  assert.match(widget, /weatherEffectLabel\(effect, language\)/);
  assert.ok(!/WEATHER_LABELS\[key\]|SEASON_LABELS\[key\]/.test(widget), 'foreign-language UI must not fall back to Russian');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.equal(Object.keys(labHeroCopy[language].load).length, 4);
    assert.equal(Object.keys(wellCopy[language].seasonNames).length, 4);
    assert.ok(weatherCopy[language].stationIdle && weatherCopy[language].stationRate && weatherCopy[language].perHour);
  }
});

test('retired legal drafts and archives cannot be served while storage controls remain available', async () => {
  const { legalUnavailableCopy } = await import('../src/i18n/legalUnavailableCopy.ts');
  const { legalStorageCopy } = await import('../src/i18n/legalStorageCopy.ts');
  const { legalUiCopy } = await import('../src/i18n/legalUiCopy.ts');
  const page = code('src/legal/LegalPage.tsx');
  const center = code('src/legal/LegalCenter.tsx');
  const main = code('src/main.tsx');
  assert.ok(!existsSync(join(root, 'src/legal/documents.ts')));
  assert.ok(!existsSync(join(root, 'src/legal/archive/2026-09-28.1.json')));
  for (const file of ['cookie', 'risk', 'privacy', 'terms', 'disclosure', 'dataRequest']) {
    assert.ok(!existsSync(join(root, `src/i18n/${file}DocumentCopy.ts`)), file);
  }
  assert.match(main, /const LegalPage = lazy\(/);
  assert.match(page, /legalUnavailableCopy\[language\]/);
  assert.match(page, /setPageMetadata\(/);
  assert.match(page, /<LanguageSwitcher compact \/>/);
  assert.match(page, /copy\.archive/);
  assert.match(page, /role="alert">\{copy\.notice\}/);
  assert.match(page, /slug === 'cookies'/);
  assert.match(page, /storageRows\(language\)\.map/);
  assert.doesNotMatch(page + center, /from ['"]\.\/documents|archive\/2026|DocumentCopy/);
  assert.match(center, /to="\/legal\/status"/);
  assert.doesNotMatch(center, /legalDocumentSlugs\.map|to="\/legal\/contacts"/);
  assert.match(center, /saveConsent\(allow\)/);
  assert.match(center, /disabled=\{gpc\}/);
  assert.match(center, /legalUnavailableCopy\[language\]\.notice/);
  for (const language of ['ru','en','pt','es','vi','id','fil'] as const) {
    const copy = legalUnavailableCopy[language];
    for (const value of Object.values(copy)) {
      assert.ok(value.trim(), `${language}: empty status text`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: Russian notice`);
    }
    assert.ok(copy.visibility.includes('Solana'), `${language}: public network caution`);
    const inventory = legalStorageCopy[language];
    assert.equal(inventory.purposes.length, 6);
    assert.equal(inventory.periods.length, 3);
    assert.equal(inventory.categories.length, 3);
    assert.ok(legalUiCopy[language].banner);
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(JSON.stringify(inventory)));
  }
});

test('the dormant rating form and countdown have complete locale copy without changing their availability', async () => {
  const form = code('src/components/PlayerRating.tsx');
  assert.match(form, /ratingCopy\[language\]/);
  assert.match(form, /aria-label=\{text\.chooseStar\(star\)\}/);
  assert.match(form, /disabled=\{loading \|\| !fromUser\}/);
  assert.match(form, /role="alert"[^>]+>\{text\.submitUnavailable\}/);
  assert.ok(!/[А-Яа-яЁё]/.test(form), 'Rating form must not embed Russian-only labels');
  // This component is not wired into the public rating pages. Translation alone
  // must never make a submission endpoint or a payment/reward mechanism available.
  assert.ok(!/components\/PlayerRating|<PlayerRating/.test(code('src/pages/social/PlayerRatingPage.tsx')));
  const { ratingCopy } = await import('../src/i18n/ratingCopy.ts');
  const { marketTimeCopy } = await import('../src/i18n/marketTimeCopy.ts');
  const countdown = code('src/lib/marketUtils.ts');
  assert.match(countdown, /marketTimeCopy\[language\]/);
  assert.match(countdown, /timeLeftStr\(untilSec: number, language: Language = "ru"\)/);
  assert.match(countdown, /return text\.daysHours\(d, h\)/);
  assert.match(countdown, /return text\.hoursMinutes\(h, m\)/);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = ratingCopy[language];
    for (const key of ['rateTitle', 'commentPlaceholder', 'sending', 'submit', 'submitted', 'submitUnavailable'] as const) {
      assert.ok(copy[key]);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy[key]));
    }
    assert.ok(copy.chooseStar(5).includes('5'));
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(copy.chooseStar(5)));
    assert.ok(marketTimeCopy[language].finished);
    assert.ok(marketTimeCopy[language].daysHours(1, 2).includes('1'));
    assert.ok(marketTimeCopy[language].hoursMinutes(1, 2).includes('2'));
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(marketTimeCopy[language].finished));
  }
  assert.equal(marketTimeCopy.ru.daysHours(1, 2), '1д 2ч');

});

test('dead trust tier labels were removed; canonical resource IDs remain strict', async () => {
  const trust = code('src/components/ui/TrustRing.tsx');
  assert.ok(!/label: "[А-Яа-яЁё]/.test(trust));
  assert.ok(!/meta\.label/.test(trust));
  const { resourceVisual } = await import('../src/lib/visualAssets.ts');
  assert.equal(resourceVisual('photonBit')?.id, 'photonBit');
  assert.equal(resourceVisual('bioChip')?.id, 'bioChip');
  assert.equal(resourceVisual('Фотон-бит'), undefined);
  assert.equal(resourceVisual('Био-чип'), undefined);
});

test('nested navigation uses stable typed IDs and changes title with the selected locale', async () => {
  const { gameHeaders } = await import('../src/i18n/gameHeaders.ts');
  const files = ['src/pages/farm/FarmDashboard.tsx', 'src/pages/profile/ProfileHome.tsx', 'src/pages/tools/ToolsHome.tsx'];
  const ids = new Set<string>();
  for (const file of files) {
    const source = code(file);
    for (const match of source.matchAll(/<NavHeader\s+headerId="([^"]+)"/g)) ids.add(match[1]);
    for (const match of source.matchAll(/go\("[^"\n]+",\s*<[^>]+\s*\/>\s*,\s*'([^']+)'\)/g)) ids.add(match[1]);
    assert.ok(!/<NavHeader\s+title="[А-Яа-яЁё]/.test(source), file);
  }
  ids.add('back');
  assert.ok(ids.size >= 15, 'Expected nested navigation IDs were not detected');
  for (const id of ids) for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.ok(gameHeaders[language][id], `Missing ${language} header ${id}`);
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(gameHeaders[language][id]));
  }
  const nav = code('src/components/NavHeader.tsx');
  assert.match(nav, /headerId \? gameHeaders\[language\]\[headerId\] : title/);
  assert.ok(!/gameHeaders\[language\]\[title\]/.test(nav));
  const market = code('src/pages/market/MarketHome.tsx');
  assert.match(market, /const market = tradeNavigationCopy\[language\]\.market;/);
  assert.match(market, /const title = id === 'hot'[^;]+market\[id\]/);
  assert.match(market, /<NavHeader title=\{title\} tabKey="market"/);
});

test('unknown API prose and malformed success payloads never display raw server text', async () => {
  const { apiErrorCopy } = await import('../src/i18n/apiErrorCopy.ts');
  const api = code('src/lib/api.ts');
  assert.match(api, /const localized = humanizeVrfError\(humanizeApiError\(raw, getApiErrorLanguage\(\)\), getApiErrorLanguage\(\)\)/);
  assert.match(api, /localized === raw\s*\? apiErrorCopy\[getApiErrorLanguage\(\)\]\.unexpected\(res\.status\)/);
  assert.match(api, /error\.code = raw/);
  assert.match(api, /error\.failClosed = isFailClosedCode\(raw\)/);
  assert.match(api, /if \(data === null\)[\s\S]+NON_JSON_RESPONSE_/);
  assert.match(api, /signalState: \(owner: string\) => get\(`\/query\/signal-state\/\$\{owner\}`, \{ allowNull: true \}\)/);
  assert.match(api, /modelState: \(owner: string\) => get\(`\/query\/model-state\/\$\{owner\}`, \{ allowNull: true \}\)/);
  assert.match(api, /if \(raw === "INSUFFICIENT_RESOURCES"\)/);
  assert.match(api, /startSignalProcessing: \(v: any\) => post\("\/chain\/signal\/start-processing", v\)/);
  assert.match(api, /startModelTraining: \(v: any\) => post\("\/chain\/model\/start-training", v\)/);
  assert.ok(!/post\([\s\S]{0,80}allowNull/.test(api), 'action calls must not treat an empty body as success');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const text = apiErrorCopy[language].unexpected(503);
    assert.ok(text.includes('503'), `${language}: missing HTTP diagnostic`);
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: Russian fallback`);
    assert.ok(!/success|успешно|successful/i.test(text), `${language}: unverified result called successful`);
  }
});

test('a resource shortage names the measured resource and does not invent one', async () => {
  const { formatResourceShortage, shortagesFromBalances } = await import('../src/lib/resourceShortageMessage.ts');
  const { ALL_BALANCE_KEYS } = await import('../src/lib/economyBalances.ts');
  const balances = Object.fromEntries(ALL_BALANCE_KEYS.map(key => [key, key === 'SYNAPSE' ? 1 : 40]));
  const missing = shortagesFromBalances(balances, [
    { resource: 'SYNAPSE', need: 6 },
    { resource: 'SILICON', need: 1 },
  ]);
  assert.deepEqual(missing, [{ resource: 'SYNAPSE', have: '1', need: '6' }]);
  assert.equal(shortagesFromBalances(null, [{ resource: 'SYNAPSE', need: 6 }]), null);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const text = formatResourceShortage(language, missing);
    assert.match(text, /1/);
    assert.match(text, /6/);
    assert.ok(!/SYNAPSE/.test(text), `${language}: raw key leaked`);
    assert.ok(!/success|успешно/i.test(text), `${language}: shortage called successful`);
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: Russian fallback`);
  }
  const unnamed = formatResourceShortage('en', [{ resource: 'NOT_A_RESOURCE', have: '0', need: '1' }]);
  assert.equal(unnamed, 'Not enough resources to start. The start was not sent.');
  const feedback = code('src/lib/txResponseFeedback.ts');
  assert.match(feedback, /code === 'INSUFFICIENT_RESOURCES'/);
  assert.match(code('src/pages/farm/MillPanel.tsx'), /shortagesFromBalances\(/);
  assert.match(code('src/pages/farm/OvenPanel.tsx'), /shortagesFromBalances\(/);
});

test('unlinked admin audit has seven-language labels without weakening failed-read handling', async () => {
  const page = code('src/pages/admin/AuditLogPage.tsx');
  assert.match(page, /adminAuditCopy\[language\]/);
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'Admin audit screen has Russian-only prose');
  assert.match(page, /if \(readFailed\)/);
  assert.match(page, /if \(!Array\.isArray\(data\)\)/);
  assert.match(page, /filteredLogs\.length === 0/);
  assert.match(page, /filter \? text\.noMatches : text\.noRecords/);
  assert.match(page, /new Date\(log\.timestamp\)\.toLocaleString\(language\)/);
  assert.ok(!/AuditLogPage/.test(code('src/pages/profile/ProfileHome.tsx')),
    'Public navigation must not mount an admin-only log');
  const { adminAuditCopy } = await import('../src/i18n/adminAuditCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = adminAuditCopy[language];
    for (const [key, text] of Object.entries(copy)) {
      const value = typeof text === 'function' ? text(2) : text;
      assert.ok(value.trim(), `${language}: missing ${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated ${key}`);
    }
    assert.ok(copy.requestBody(2).includes('2'));
    assert.notEqual(copy.noRecords, copy.noMatches);
  }
});

test('admin NPC stub never advertises a runner that its backend explicitly refuses', async () => {
  const backend = code('../aof_backend/src/routes/npc.ts');
  assert.match(backend, /r\.get\("\/stats"[\s\S]*enabled: false/);
  assert.match(backend, /r\.post\("\/run", requireAdmin[\s\S]*status\(503\)/);
  const page = code('src/pages/admin/NpcDashboard.tsx');
  assert.match(page, /npcAdminCopy\[language\]/);
  assert.match(page, /role="status"/);
  assert.ok(!/api\.npc\.(run|stats)|<button|setRecentTrades|setStats/.test(page), 'A blocked agent must not offer live controls or fabricated metrics');
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'Admin NPC status has an untranslated literal');
  assert.ok(!/NpcDashboard/.test(code('src/pages/profile/ProfileHome.tsx')), 'Admin page must not be in player navigation');
  const { npcAdminCopy } = await import('../src/i18n/npcAdminCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const key of ['title', 'unavailable', 'reason'] as const) {
      const value = npcAdminCopy[language][key];
      assert.ok(value.trim(), `${language}: missing ${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated ${key}`);
    }
  }
});

test('admin economy labels are localized and a failed read cannot be shown as no alerts', async () => {
  const source = code('src/pages/admin/EconomyDashboard.tsx');
  assert.match(source, /economyAdminCopy\[language\]/);
  assert.ok(!/[А-Яа-яЁё]/.test(source), 'Economy dashboard embeds Russian-only text');
  assert.ok(!/\.catch\(\(\) => \[\]\)/.test(source), 'Failed admin read must not become a verified empty list');
  assert.match(source, /if \(!Array\.isArray\(snapData\) \|\| !Array\.isArray\(alertData\)\)/);
  assert.match(source, /setReadFailed\(true\)/);
  assert.match(source, /if \(readFailed\)[\s\S]+role="alert"[\s\S]+text\.readFailed/);
  assert.match(source, /alerts\.length === 0 \?/);
  assert.match(source, /actionFailed && <p role="alert"/);
  assert.match(source, /aria-label=\{text\.resolve\}/);
  assert.ok(!/EconomyDashboard/.test(code('src/pages/profile/ProfileHome.tsx')));
  const { economyAdminCopy } = await import('../src/i18n/economyAdminCopy.ts');
  const baseline = Object.keys(economyAdminCopy.ru).sort();
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = economyAdminCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), baseline);
    for (const [key, entry] of Object.entries(copy)) {
      const values = typeof entry === 'string' ? [entry] : typeof entry === 'function' ? [entry(2)] : Object.values(entry);
      for (const value of values) {
        assert.ok(value.trim(), `${language}: missing ${key}`);
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: Russian ${key}`);
      }
    }
    assert.ok(copy.active(2).includes('2'));
    assert.notEqual(copy.noAlerts, copy.readFailed);
  }
});

test('obsolete admin economy simulation is disclosed, never presented as a live forecast', async () => {
  const v1 = code('../aof_backend/src/lib/economySimulator.ts');
  const v2 = code('../aof_backend/src/lib/economySimulatorV2.ts');
  const routes = code('../aof_backend/src/routes/sandbox.ts');
  assert.match(v1, /"NEURON" \| "SYNAPSE"/);
  assert.match(v1, /mindSupply/);
  assert.match(v2, /"FLASK_ENERGY" \| "FLASK_GROWTH"/);
  assert.match(v2, /"rebirth" \| "quest"/);
  assert.match(routes, /r\.post\("\/run", requireAdmin/);
  assert.match(routes, /r\.post\("\/run-v2", requireAdmin/);
  const page = code('src/pages/admin/SandboxPage.tsx');
  assert.match(page, /sandboxAdminCopy\[language\]/);
  assert.match(page, /role="status"/);
  assert.ok(!/api\.sandbox|<button|runSimulation|setResult|priceChanges/.test(page),
    'A legacy model must not promise an actionable forecast or start a run');
  assert.ok(!/[А-Яа-яЁё]/.test(page), 'The admin status page has Russian-only strings');
  assert.ok(!/SandboxPage/.test(code('src/pages/profile/ProfileHome.tsx')));
  const { sandboxAdminCopy } = await import('../src/i18n/sandboxAdminCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const [key, text] of Object.entries(sandboxAdminCopy[language])) {
      assert.ok(text.trim(), `${language}: missing ${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: untranslated ${key}`);
    }
  }
});

test('retired Premium gate and reward animation do not claim or purchase by timer', async () => {
  const gate = code('src/components/ui/VipGate.tsx');
  const reward = code('src/components/animations/RewardBurst.tsx');
  for (const source of [gate, reward]) {
    assert.match(source, /dormantFeatureCopy\[language\]/);
    assert.match(source, /role="status"/);
    assert.ok(!/<button|<motion\.button|setTimeout\(|\.onClaim\(|onClaim\(\)|<SeasonPassPage|\bpush\(/.test(source),
      'A dormant notice must not enable a claim or a purchase link');
    assert.ok(!/[А-Яа-яЁё]/.test(source), 'Russian-only UI literal in retired feature');
    assert.match(source, /\[overflow-wrap:anywhere\]/);
  }
  assert.ok(!/\{children\}|if \(isVip\)/.test(gate), 'An unaudited flag must not reveal unverified benefits');
  const sourceFiles = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? sourceFiles(`${dir}/${entry.name}`) : entry.name.endsWith('.tsx') ? [`${dir}/${entry.name}`] : []);
  for (const file of sourceFiles('src')) {
    if (file.endsWith('/VipGate.tsx') || file.endsWith('/RewardBurst.tsx')) continue;
    assert.ok(!/\b(?:VipGate|RewardBurst)\b/.test(code(file)), `${file}: retired mechanism mounted`);
  }
  const { dormantFeatureCopy } = await import('../src/i18n/dormantFeatureCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    for (const [key, text] of Object.entries(dormantFeatureCopy[language])) {
      assert.ok(text.trim(), `${language}: missing ${key}`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(text), `${language}: untranslated ${key}`);
    }
  }
});

test('network-only API failures are localized while HTTP responses keep their structured parser', async () => {
  const { fetchApi } = await import('../src/lib/apiFetch.ts');
  const { getApiErrorLanguage, setApiErrorLanguage } = await import('../src/lib/apiErrorLanguage.ts');
  const { apiErrorCopy } = await import('../src/i18n/apiErrorCopy.ts');
  const apiSource = code('src/lib/api.ts');
  assert.equal([...apiSource.matchAll(/await fetchApi\(`\$\{BASE\}\$\{path\}`/g)].length, 3,
    'GET, POST and DELETE must share the transport fallback');
  assert.ok(!/await fetch\(`\$\{BASE\}\$\{path\}`/.test(apiSource));
  assert.match(apiSource, /return parseApiResponse\(res\)/);
  const oldFetch = globalThis.fetch;
  const oldLanguage = getApiErrorLanguage();
  const cause = new TypeError('Failed to fetch');
  try {
    for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
      setApiErrorLanguage(language);
      globalThis.fetch = async () => { throw cause; };
      await assert.rejects(fetchApi('/api/query/config'), (error: unknown) => {
        const e = error as Error & { code?: string; cause?: unknown };
        assert.equal(e.message, apiErrorCopy[language].networkUnavailable);
        assert.equal(e.code, 'API_NETWORK_UNAVAILABLE');
        assert.equal(e.cause, cause);
        assert.notEqual(e.message, cause.message);
        if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(e.message));
        return true;
      });
    }
    const response = new Response(JSON.stringify({ error: 'MINING_DISABLED_ONCHAIN' }), {
      status: 503, headers: { 'content-type': 'application/json' },
    });
    let gotInit: RequestInit | undefined;
    globalThis.fetch = async (_url, init) => { gotInit = init; return response; };
    const init = { method: 'POST', body: '{}' };
    assert.equal(await fetchApi('/api/tools/start-mining', init), response);
    assert.equal(gotInit, init);
  } finally {
    globalThis.fetch = oldFetch;
    setApiErrorLanguage(oldLanguage);
  }
});

test('transaction response notices use seven-language pending/unknown text without losing the signature', async () => {
  const source = code('src/lib/txFlow.ts');
  assert.match(source, /const language = getApiErrorLanguage\(\);/);
  assert.match(source, /txResponseFeedback\(response\.error, language, copy\.unconfirmedResponse\)/);
  assert.match(source, /if \(response\.pending\) return \{ success: false, signature: response\.signature, error: copy\.pending \}/);
  assert.ok(!/error: response\.reason|error: response\.error/.test(source), 'Untrusted server prose must not be displayed');
  assert.match(source, /signature: typeof e\?\.signature === 'string' \? e\.signature : undefined/);
  assert.match(code('src/lib/confirmation.ts'), /throw new LocalTxFeedbackError/);
  // This pass is translation-only: do not mistake it for a repair of the
  // existing empty-envelope success.
  assert.match(source, /return \{ success: true \};/);
  const { txResponseFeedback, txExceptionFeedback, actionErrorFeedback, LocalTxFeedbackError } = await import('../src/lib/txResponseFeedback.ts');
  const { transactionValidationCopy } = await import('../src/i18n/transactionValidationCopy');
  const { apiErrorCopy } = await import('../src/i18n/apiErrorCopy');
  const { walletRuntimeCopy } = await import('../src/i18n/walletRuntimeCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const fallback = walletRuntimeCopy[language].unconfirmedResponse;
    assert.equal(txResponseFeedback('MINING_DISABLED_ONCHAIN', language, fallback), apiErrorCopy[language].messages.MINING_DISABLED_ONCHAIN);
    assert.notEqual(txResponseFeedback('VRF_POOL_EMPTY', language, fallback), fallback);
    const { legacyVrfRussian, vrfCopy } = await import('../src/i18n/vrfCopy.ts');
    assert.equal(txResponseFeedback(legacyVrfRussian[0], language, fallback), vrfCopy[language][0]);
    assert.equal(actionErrorFeedback(Object.assign(new Error('legacy API prose'), { code: legacyVrfRussian[0] }), language, fallback), vrfCopy[language][0]);
    const confirmedFailure = `${transactionValidationCopy[language].executionFailed}: ${'2'.repeat(64)}`;
    assert.equal(txExceptionFeedback(new LocalTxFeedbackError(confirmedFailure), language, fallback), confirmedFailure);
    assert.equal(txExceptionFeedback(new Error(confirmedFailure), language, fallback), fallback);
    assert.equal(txExceptionFeedback(new LocalTxFeedbackError('guard checked the wallet'), language, fallback), 'guard checked the wallet');
    assert.equal(txExceptionFeedback(new Error(walletRuntimeCopy[language].cannotSend), language, fallback), walletRuntimeCopy[language].cannotSend);
    for (const raw of ['Failed to fetch', 'rpc timed out', 'платёж успешен', 'Wallet changed during verification',
      `${transactionValidationCopy[language].confirmationUnknown}: INVALID`]) {
      assert.equal(txExceptionFeedback(new Error(raw), language, fallback), fallback, `${language}: provider prose must not be shown`);
    }
    for (const raw of ['платёж выполнен', 'Completed', 'UNKNOWN_PAYMENT_STATUS', '', 'a VRF_POOL_EMPTY message', { error: 'VRF_POOL_EMPTY' }, 'x'.repeat(300)]) {
      assert.equal(txResponseFeedback(raw, language, fallback), fallback, `${language}: untrusted server error must not be shown`);
    }
    for (const key of ['pending', 'unconfirmedResponse'] as const) {
      const value = walletRuntimeCopy[language][key];
      assert.ok(value && value.length > 25, `${language}: missing careful ${key} notice`);
      if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(value), `${language}: untranslated ${key}`);
    }
  }
});

test('exploration and tool-action catches never display arbitrary provider prose', async () => {
  const exploration = code('src/pages/farm/ExplorationPage.tsx');
  const plot = code('src/pages/farm/FarmPlot.tsx');
  const tool = code('src/components/ToolMiningCard.tsx');
  for (const source of [exploration, plot, tool]) {
    assert.match(source, /actionErrorFeedback\(e, language,/);
    assert.ok(!/e\?\.response\?\.data\?\.error|e\?\.message \|\| copy\.failed/.test(source));
  }
  assert.ok(!/Transaction not confirmed|Missing settlement transaction|Missing or mismatched trip transaction/.test(exploration));
  assert.match(exploration, /new LocalTxFeedbackError\(result\.error \|\| copy\.uncertain\)/);
  assert.match(exploration, /error\?\.language === language \? error\.text : null/);
  assert.match(tool, /msg\?\.language === language/);
  assert.match(code('src/lib/marketUtils.ts'), /entry\?\.language === language \? entry\.text/);
  for (const file of ['CraftPage', 'RepairPage', 'PacksPage']) assert.match(code(`src/pages/tools/${file}.tsx`), /useFlash\(language\)/);
  assert.match(plot, /useFlash\(language\)/);
  assert.match(code('src/pages/farm/WellPanel.tsx'), /message\?\.language === language/);
  const { actionErrorFeedback, LocalTxFeedbackError } = await import('../src/lib/txResponseFeedback.ts');
  const { apiErrorCopy } = await import('../src/i18n/apiErrorCopy.ts');
  const { explorationCopy } = await import('../src/i18n/explorationCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const fallback = explorationCopy[language].uncertain;
    assert.equal(actionErrorFeedback(new LocalTxFeedbackError(fallback), language, fallback), fallback);
    assert.equal(actionErrorFeedback(Object.assign(new Error('Failed to fetch'), {
      code: 'API_NETWORK_UNAVAILABLE', cause: new TypeError('Failed to fetch'),
    }), language, fallback), apiErrorCopy[language].networkUnavailable);
    assert.equal(actionErrorFeedback(Object.assign(new Error('raw backend text'), {
      code: 'MINING_DISABLED_ONCHAIN',
    }), language, fallback), apiErrorCopy[language].messages.MINING_DISABLED_ONCHAIN);
    for (const e of [new Error('You were charged'), { message: 'платёж выполнен' },
      { response: { data: { error: 'PAYMENT_COMPLETE' } } },
      Object.assign(new Error('raw server stack'), { code: 'SOME_UNKNOWN_SERVER_ERROR' })]) {
      assert.equal(actionErrorFeedback(e, language, fallback), fallback, `${language}: no server or wallet prose on screen`);
    }
  }
});

test('farm actions and capsule purchase catches localize known codes without echoing RPC prose', async () => {
  for (const file of ['NeuralLabPanel', 'MillPanel', 'OvenPanel', 'WellPanel']) {
    const source = code(`src/pages/farm/${file}.tsx`);
    assert.equal((source.match(/actionErrorFeedback\(e, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\)/g) || []).length, 2, file);
    assert.ok(!/e\?\.message \|\| copy\.(networkError|failed)/.test(source), `${file}: raw provider message`);
    assert.match(source, /handleTxResponse\(resp|handleTxResponse\(response/);
  }
  const packs = code('src/pages/tools/PacksPage.tsx');
  assert.equal((packs.match(/flash\(actionErrorFeedback\(e, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\), 8000\)/g) || []).length, 2);
  assert.equal((packs.match(/new LocalTxFeedbackError\(r\.error \|\| walletRuntimeCopy\[language\]\.unconfirmedResponse\)/g) || []).length, 2);
  assert.ok(!/String\(e\?\.message \|\| e\)/.test(packs));
  const { actionErrorFeedback } = await import('../src/lib/txResponseFeedback.ts');
  const { vrfCopy } = await import('../src/i18n/vrfCopy.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.equal(actionErrorFeedback(Object.assign(new Error('untrusted'), { code: 'VRF_POOL_EMPTY' }), language, 'fallback'), vrfCopy[language][1]);
  }
});

test('craft and repair catch paths retain wallet-bound checks while hiding arbitrary error prose', () => {
  for (const [file, count] of [['CraftPage', 2], ['RepairPage', 1]] as const) {
    const source = code(`src/pages/tools/${file}.tsx`);
    assert.equal((source.match(/walletRef\.current === address\) flash\(actionErrorFeedback\(e, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\)\)/g) || []).length, count);
    assert.ok(!/flash\(e\?\.message \|\| copy\.failed\)/.test(source));
    assert.match(source, /const r = await handleTxResponse\(resp\)/);
  }
});

test('drum and market actions show structured failures in the active locale, not a guessed final status', () => {
  const drum = code('src/components/DrumSpin.tsx');
  assert.match(drum, /useFlash\(language\)/);
  assert.match(drum, /flashRef\.current\(currentCopy\.revealed/);
  assert.match(drum, /flashRef\.current\(currentCopy\.refunded/);
  assert.match(drum, /currentLanguage === language[\s\S]+actionErrorFeedback\(error, currentLanguage, drumCopy\[currentLanguage\]\.uncertain\)/);
  assert.equal((drum.match(/new LocalTxFeedbackError\(r\.error \|\| copy\.uncertain\)/g) || []).length, 1);
  assert.doesNotMatch(drum, /api\.drum\.commit\(/);
  assert.ok(!/String\(error instanceof Error|humanizeVrfError\(raw, language\)/.test(drum));
  for (const [file, actions] of [['OfferPage', 3], ['RentalPage', 4], ['AuctionPage', 3]] as const) {
    const source = code(`src/pages/market/${file}.tsx`);
    assert.match(source, /useFlash\(language\)/);
    assert.match(source, /txStatus && statusLanguage === language/);
    assert.equal((source.match(/notify\(actionErrorFeedback\(e, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\)\)/g) || []).length, actions);
    assert.equal((source.match(/: \(r\.error \|\| walletRuntimeCopy\[language\]\.unconfirmedResponse\)/g) || []).length, actions);
    assert.match(source, /if \(r\.success\)/, 'the displayed error must not alter submission decisions');
  }
});

test('listing and recipe workshop never echo an HTTP, RPC or wallet exception', () => {
  const listing = code('src/pages/market/ListingPage.tsx');
  const workshop = code('src/pages/economy/Workshop.tsx');
  assert.match(listing, /const fail = \(error: unknown\) => flash\(actionErrorFeedback\(error, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\)\)/);
  assert.match(workshop, /flash\(actionErrorFeedback\(error, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\)\)/);
  assert.ok(!/error instanceof Error \? error\.message/.test(listing + workshop));
  assert.equal((listing.match(/flash\(result\.error \|\| walletRuntimeCopy\[language\]\.unconfirmedResponse\)/g) || []).length, 3);
  assert.match(workshop, /flash\(result\.error \|\| walletRuntimeCopy\[language\]\.unconfirmedResponse\)/);
  for (const source of [listing, workshop]) {
    assert.match(source, /(?:notice|message)\?\.language === language/);
    assert.match(source, /!response\?\.tx/);
  }
  assert.match(listing, /handleTxResponse\(response, intent\)/);
  assert.match(workshop, /readEconomyBalances\(await api\.query\.balances\(address\)\)/);
});


test('selected plot structure uses translated rarity instead of English metadata', async () => {
  const plot = code('src/pages/farm/FarmPlot.tsx');
  assert.match(plot, /toolsCopy\[language\]\.collectionPage\.rarities\[index\]/);
  assert.match(plot, /toolsCopy\[language\]\.card\.unknownRarity/);
  assert.match(plot, /\{rarityLabel\(selected\.rarity\)\} · \{copy\.durability\}/);
  assert.ok(!/RARITY_META\[rarityKey\(selected\.rarity\)\]\?\.label/.test(plot));
  const { toolsCopy } = await import('../src/i18n/toolsCopy.ts');
  for (const lang of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.equal(toolsCopy[lang].collectionPage.rarities.length, 5, lang);
    assert.ok(toolsCopy[lang].card.unknownRarity);
    if (lang !== 'en') assert.notEqual(toolsCopy[lang].collectionPage.rarities[0], 'Base', `${lang}: English rarity`);
  }
});

test('landing product category and any commit demo heading follow the site locale', async () => {
  const page = code('src/site/pages/ContentPage.tsx');
  assert.match(page, /nf-product__tag">\{siteProductTag\[language\]\}/);
  assert.match(page, /id === 'fair' && <Section title=\{commitLabels\[language\]\.section\}>/);
  assert.ok(!/Blockchain Game · Solana|title="Commit \/ Reveal"/.test(page), 'untranslated English literal in the content page');
  const { siteProductTag } = await import('../src/i18n/siteProductTag.ts');
  const { commitLabels } = await import('../src/i18n/commitLabels.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.ok(siteProductTag[language].includes('Solana'));
    assert.ok(commitLabels[language].section.trim());
    if (language !== 'en') assert.notEqual(siteProductTag[language], siteProductTag.en, `${language}: English product tag`);
    if (language !== 'ru') assert.ok(!/[А-Яа-яЁё]/.test(siteProductTag[language]), `${language}: Russian product tag`);
  }
  assert.match(page, /NeuroForge — Age of Intelligence/, 'keep the official brand spelling');
});

test('game, site and legal metadata follow the locale without earnings claims', async () => {
  const html = read('index.html');
  const { gameMetaCopy } = await import('../src/i18n/gameMetaCopy.ts');
  assert.ok(html.includes(`name="description" content="${gameMetaCopy.ru}"`), 'static HTML must match its Russian lang tag');
  assert.ok(html.includes(`property="og:description" content="${gameMetaCopy.ru}"`));
  assert.ok(html.includes(`name="twitter:description" content="${gameMetaCopy.ru}"`));
  assert.ok(!/play-to-earn|trade the future|DeFi/i.test(html), 'metadata must not promise earnings or financial features');
  assert.match(code('src/App.tsx'), /setPageMetadata\('NeuroForge — Age of Intelligence', gameMetaCopy\[language\], language\)/);
  assert.match(code('src/site/layout/Layout.tsx'), /setPageMetadata\(title, desc,/);
  assert.match(code('src/legal/LegalPage.tsx'), /setPageMetadata\(`\$\{copy\.title\} · NeuroForge`, `\$\{copy\.notice\} \$\{copy\.visibility\}`, language\)/);
  assert.match(code('src/legal/LegalPage.tsx'), /version && <p role="status">\{copy\.archive\}<\/p>/);
  assert.match(code('src/legal/LegalPage.tsx'), /role="alert">\{copy\.notice\}/);
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    assert.ok(gameMetaCopy[language].length > 90);
    assert.ok(!/earnings|income|profit|play.to.earn/i.test(gameMetaCopy[language]));
    if (language !== 'ru') assert.doesNotMatch(gameMetaCopy[language], /[А-Яа-яЁё]/);
  }
  const { setPageMetadata } = await import('../src/lib/pageMetadata.ts');
  const originalDocument = globalThis.document;
  type FakeMeta = { attrs: Record<string, string>; setAttribute: (name: string, value: string) => void };
  const metas: FakeMeta[] = [];
  const fakeDocument = {
    title: '',
    querySelector: (selector: string) => {
      const match = selector.match(/^meta\[(name|property)="([^"]+)"\]$/);
      return match ? metas.find(meta => meta.attrs[match[1]] === match[2]) ?? null : null;
    },
    createElement: (tag: string): FakeMeta => {
      assert.equal(tag, 'meta');
      const attrs: Record<string, string> = {};
      return { attrs, setAttribute(name, value) { attrs[name] = value; } };
    },
    head: { appendChild: (meta: FakeMeta) => { metas.push(meta); } },
  };
  try {
    Object.assign(globalThis, { document: fakeDocument });
    const get = (key: string) => metas.find(meta => meta.attrs.name === key || meta.attrs.property === key)?.attrs.content;
    for (const [language, locale] of [['ru', 'ru_RU'], ['en', 'en_US'], ['pt', 'pt_BR'],
      ['es', 'es_ES'], ['vi', 'vi_VN'], ['id', 'id_ID'], ['fil', 'fil_PH']] as const) {
      const title = `${language} · NeuroForge`;
      setPageMetadata(title, gameMetaCopy[language], language);
      assert.equal(fakeDocument.title, title);
      for (const key of ['description', 'og:description', 'twitter:description']) assert.equal(get(key), gameMetaCopy[language], `${language}: ${key}`);
      for (const key of ['og:title', 'twitter:title']) assert.equal(get(key), title, `${language}: ${key}`);
      assert.equal(get('og:locale'), locale);
    }
    assert.equal(metas.length, 6, 'route changes must update existing tags, not duplicate them');
  } finally {
    if (originalDocument === undefined) delete (globalThis as { document?: Document }).document;
    else Object.assign(globalThis, { document: originalDocument });
  }
});

test('farm toasts are tied to the locale that produced their text', () => {
  const source = code('src/components/ui/Toast.tsx');
  assert.match(source, /messageLanguage: Language \| null/);
  assert.match(source, /show: \(message: string, type: "success" \| "error" \| "info", language: Language\)/);
  assert.match(source, /set\(\{ message, type, visible: true, messageLanguage: language \}\)/);
  assert.match(source, /visible && messageLanguage === language/);
  for (const [file, expected] of [['NeuralLabPanel', 9], ['MillPanel', 8], ['OvenPanel', 8]] as const) {
    const panel = code(`src/pages/farm/${file}.tsx`);
    const calls = panel.match(/toast\.show\([^\n]+?\);/g) ?? [];
    assert.equal(calls.length, expected, file);
    for (const call of calls) assert.match(call, /, "(?:error|success|info)", language\);$/, `${file}: untagged toast`);
    assert.match(panel, /actionErrorFeedback\(e, language, walletRuntimeCopy\[language\]\.unconfirmedResponse\)/);
  }
});

test('transaction flashes cancel previous timers and clear old-locale text', () => {
  const hook = code('src/lib/marketUtils.ts');
  assert.match(hook, /useFlash\(language: Language\)/);
  assert.match(hook, /activeLanguage\.current !== language\) return/);
  assert.match(hook, /if \(timer\.current\) clearTimeout\(timer\.current\);\s*setEntry\(\{ text, language \}\)/);
  assert.match(hook, /useEffect\(\(\) => \{\s*setEntry\(null\);\s*if \(timer\.current\) clearTimeout\(timer\.current\)/);
  assert.match(code('src/pages/profile/SeasonPassPage.tsx'), /useFlash\(language\)/);
  const farmToast = code('src/components/ui/Toast.tsx');
  assert.match(farmToast, /if \(dismissTimer\) clearTimeout\(dismissTimer\);\s*set\(\{ message, type, visible: true, messageLanguage: language \}\)/);
  assert.match(farmToast, /if \(useToast\.getState\(\)\.messageLanguage !== language\) useToast\.getState\(\)\.hide\(\)/);
});

test('gallery shortcuts leave arrow keys to the focused language menu and other controls', () => {
  const gallery = code('src/gallery/VisualGallery.tsx');
  assert.match(gallery, /if \(e\.defaultPrevented \|\| e\.altKey \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey \|\| e\.isComposing\) return/);
  assert.match(gallery, /e\.target\.closest\([\s\S]*?a, button, input, select, textarea, summary, details/);
  assert.match(gallery, /\[contenteditable="true"\]/);
  assert.match(gallery, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  assert.ok(gallery.indexOf('e.target.closest(') < gallery.indexOf('if (e.key === "ArrowRight")'));
});

test('collection labels do not claim resource mining is available; Filipino titles and names are translated', async () => {
  const { toolsCopy } = await import('../src/i18n/toolsCopy.ts');
  const { homeResourceNames } = await import('../src/i18n/homeDetail.ts');
  const { pageNames } = await import('../src/i18n/translations.ts');
  const { gameHeaders } = await import('../src/i18n/gameHeaders.ts');
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    const copy = toolsCopy[language].collectionPage;
    assert.ok(copy.intro.includes(copy.resources), `${language}: collection count and heading disagree`);
    assert.ok(!/добываем|mineable|extraíve|extraíble|khai thác|ditambang|minahin/i.test(copy.intro + copy.resources),
      `${language}: catalog incorrectly claims resource mining is active`);
  }
  const names = toolsCopy.fil.names;
  assert.equal(names.quantum_transmitter, 'Tagapaghatid ng kuwantum');
  assert.equal(names.neural_seeder, 'Panghasik ng neural na binhi');
  assert.equal(toolsCopy.fil.collectionPage.rarities[2], 'Kuwantum');
  assert.equal(homeResourceNames.fil.quantumBit, 'Kuwantum na bit');
  assert.equal(homeResourceNames.fil.signal, 'Senyal');
  assert.equal(pageNames.fil.craft, 'Pandayang kuwantum');
  assert.equal(pageNames.fil.lottery, 'Bunutan ng kuwantum');
  assert.equal(gameHeaders.fil.drum, 'Tambol na kuwantum');
});

test('Filipino player navigation, install-adjacent labels, and instrument examples avoid English fallbacks', async () => {
  const { gameTabs } = await import('../src/i18n/gameLabels.ts');
  const { galleryCopy } = await import('../src/i18n/galleryCopy.ts');
  const { galleryMixCopy } = await import('../src/i18n/galleryMixCopy.ts');
  const { legalStorageCopy } = await import('../src/i18n/legalStorageCopy.ts');
  const { labHeroCopy } = await import('../src/i18n/labHeroCopy.ts');
  const { pageNames } = await import('../src/i18n/translations.ts');
  const { gameHeaders } = await import('../src/i18n/gameHeaders.ts');
  assert.notEqual(gameTabs.fil.profile.full, gameTabs.en.profile.full);
  for (const key of ['gel', 'cards', 'baro'] as const) {
    assert.notEqual(galleryCopy.fil.devices[key].name, galleryCopy.en.devices[key].name);
  }
  assert.notEqual(galleryMixCopy.fil.sample.testOne, galleryMixCopy.en.sample.testOne);
  assert.notEqual(labHeroCopy.fil.load.drought, labHeroCopy.en.load.drought);
  assert.equal(pageNames.fil.craft, 'Pandayang kuwantum');
  assert.equal(gameHeaders.fil.seasonPass, 'Pases ng panahon');
  assert.equal(gameHeaders.fil.fluids, 'Mga likido');
  assert.ok(JSON.stringify(legalStorageCopy.fil).includes('Pang-andar'));
});

test('Russian source inventory has no resource-alias literals; legal release gate remains closed', async () => {
  const report = JSON.parse(execFileSync(process.execPath, ['scripts/i18n-audit.mjs', '--json', '--all'],
    { cwd: root, encoding: 'utf8' }));
  assert.equal(report.rawRussianLiterals, 0);
  assert.equal(report.files, 0);
  assert.deepEqual(report.retainedOriginals, { legacyAliases: 0 });
  assert.equal(report.unreviewedCandidates, 0);
  assert.equal(report.protectedSourcesIntact, true);
  assert.deepEqual(report.sample, []);
  const { resourceVisual } = await import('../src/lib/visualAssets.ts');
  for (const retired of ['Фотон-бит', 'Био-чип', 'Ядро души', 'Голубое ядро']) {
    assert.equal(resourceVisual(retired), undefined, `${retired}: legacy input alias must not resolve`);
  }
  assert.match(read('src/legal/operator.json'), /"approved": false/, 'do not waive the legal release gate');
});

test('glossary rank and rarity terms follow seven-language display catalogs without losing historic search aliases', async () => {
  const { siteGlossary } = await import('../src/i18n/siteGlossary.ts');
  const { siteTrust, trustMedallionIds } = await import('../src/i18n/siteTrust.ts');
  const { toolsCopy } = await import('../src/i18n/toolsCopy.ts');
  const rarityIds = ['base', 'enhanced', 'quantum', 'singularity', 'transcendent'];
  for (const language of ['ru', 'en', 'pt', 'es', 'vi', 'id', 'fil'] as const) {
    if (language === 'en') continue; // Retain historical English identifiers as aliases.
    for (const [index, id] of trustMedallionIds.entries()) {
      const term = siteGlossary[language].entries.find(entry => entry.id === id)?.term;
      assert.equal(term, siteTrust[language].medallions[index].name, `${language}: ${id}`);
      assert.notEqual(term, siteGlossary.en.entries.find(entry => entry.id === id)?.term, `${language}: English rank`);
    }
    for (const [index, id] of rarityIds.entries()) {
      const term = siteGlossary[language].entries.find(entry => entry.id === id)?.term;
      assert.equal(term, toolsCopy[language].collectionPage.rarities[index], `${language}: ${id}`);
      assert.notEqual(term, siteGlossary.en.entries.find(entry => entry.id === id)?.term, `${language}: English rarity`);
    }
  }
  const page = code('src/site/pages/ExtraSections.tsx');
  assert.match(page, /siteGlossary\.ru\.entries\[index\]\.term \+ ' ' \+ siteGlossary\.en\.entries\[index\]\.term/);
  assert.match(page, /<dt>\{g\.term\}<\/dt>/);
});

test("фон сайта собран из сгенерированных сцен, и каждая лежит на диске", async () => {
  // Задача владельца 2026-09-30: «добавить сгенерированные картинки на фон
  // сайта». Сцена выбирается по маршруту, поэтому пропавший файл виден сразу
  // на конкретной странице — проверяем и таблицу, и сам ассет.
  const scenery = code("src/site/content/scenery.ts");
  const images = [...scenery.matchAll(/["'](\/assets\/site\/[a-z-]+\.jpg)["']/g)].map((m) => m[1]);
  assert.ok(images.length >= 6, `сцен стенда должно быть не меньше шести, найдено ${images.length}`);
  for (const image of images) {
    const file = join(root, "public", image.replace(/^\//, ""));
    assert.ok(existsSync(file), `нет файла сцены ${image}`);
    assert.ok(statSync(file).size > 20_000, `сцена ${image} пустая: файл меньше 20 КБ`);
  }
  // В таблице не должно остаться маршрутов, которых нет в дереве страниц:
  // иначе сцена молча не доедет до игрока.
  const { pages } = await import("../src/site/content/pages");
  const ids = new Set(pages.map((p: { id: string }) => p.id));
  const table = scenery.match(/const PAGE_SCENERY[^=]*=\s*\{([\s\S]*?)\n\};/);
  assert.ok(table, "таблица сцен не найдена");
  const listed = [...table![1].matchAll(/([a-z]+):\s*'/g)].map((m) => m[1]);
  assert.ok(listed.length >= 20, "таблица сцен усохла");
  assert.deepEqual(listed.filter((id) => !ids.has(id)), [], "в таблице сцен есть маршруты без страниц");
  const { sceneryForPage, SITE_SCENERY } = await import("../src/site/content/scenery");
  const known = new Set(Object.keys(SITE_SCENERY));
  for (const page of pages) {
    assert.ok(known.has(sceneryForPage(page.id)), `${page.id}: неизвестная сцена`);
  }
});

test("пульт стенда управляет только картинкой и не трогает данные игры", () => {
  // Пульт — оформление: рубильник, галетник и фейдер меняют свет фона.
  // Ни одного числа из сети он читать не должен, иначе «стенд» станет
  // вторым источником показаний рядом с игрой.
  const stand = code("src/site/layout/SiteStand.tsx");
  assert.ok(!/\bapi\b|fetch\(|useWallet|balance|signature/.test(stand), "пульт стенда тянет игровые данные");
  assert.match(stand, /useState/, "положения приборов хранятся в состоянии страницы");
  const controls = code("src/site/ui/Controls.tsx");
  assert.match(controls, /role="switch"/, "рубильник обязан объявлять себя переключателем");
  assert.match(controls, /aria-checked=\{on\}/, "у рубильника нет состояния для чтения с экрана");
  assert.match(controls, /type="radio"/, "галетник собран на радиокнопках, а не на div");
  assert.match(controls, /type="range"/, "фейдер — настоящий ползунок");
  assert.match(controls, /htmlFor=\{fieldId\}/, "у фейдера должна быть подпись");
  const css = read("src/site/styles/site.css");
  assert.match(css, /\.site-backdrop \{[^}]*z-index: -1/, "фон стенда уйдёт за непрозрачный слой страницы");
  assert.match(css, /\.aof-ui\.aof-site \{[^}]*isolation: isolate/, "без изоляции слоёв фон стенда не виден");
  assert.match(css, /\.site-lever__arm \{[^}]*transform-origin/, "рычаг рубильника не качается");
  assert.match(css, /\.site-deck \{[^}]*position: fixed/, "пульт должен стоять на экране, а не уезжать со страницей");
  assert.match(read("src/site/layout/Layout.tsx"), /<SiteBackdrop scene=\{scenery\} state=\{stand\} \/>/);
  assert.match(read("src/site/layout/Layout.tsx"), /<StandDeck state=\{stand\} \/>/);
});

test("окна сайта собраны как панели приборов: лампа, табличка, безель", () => {
  const components = code("src/site/ui/Components.tsx");
  assert.match(components, /site-panel-bar/, "у заголовка страницы нет планки корпуса");
  assert.match(components, /<NamePlate>/, "подпись страницы вернулась к плоскому бейджу");
  assert.match(components, /site-section__title/, "заголовок секции потерял лицевую панель");
  assert.match(components, /<Lamp state="live" \/>/, "в окнах нет лампы состояния");
  const css = read("src/site/styles/site.css");
  for (const [name, pattern] of [
    ["лампа живой лампы", /\.site-lamp--live \{/],
    ["лампа ожидания", /\.site-lamp--wait \{/],
    ["винты панели", /--sb-screw: radial-gradient/],
    ["безeль окна", /inset 0 0 0 7px/],
    ["галetник", /\.site-rocker__stop\[data-on='true'\]/],
    ["фейдер", /\.site-fader__input::-webkit-slider-thumb/],
    ["состояние экрана стенда", /\.site-screen\[data-on='true'\] img \{ filter: none; \}/],
  ] as const) {
    assert.match(css, pattern, `в слое приборов пропало: ${name}`);
  }
  const page = code("src/site/pages/ContentPage.tsx");
  assert.match(page, /<Rocker/, "витрина экранов вернулась к ряду картинок без галетника");
  assert.match(page, /data-on=\{index === screen\}/, "галетник не подсвечивает выбранный экран");
});

test("подписи пульта стоят на всех семи языках сайта", async () => {
  const { sitePanelCopy } = await import("../src/i18n/sitePanelCopy");
  const { languages } = await import("../src/i18n/translations");
  for (const language of languages) {
    const copy = sitePanelCopy[language];
    assert.ok(copy, `${language}: нет подписей пульта`);
    for (const key of ["deckLabel", "switchLabel", "modeLegend", "levelLabel", "statusOn", "statusOff", "galleryLegend"] as const) {
      assert.ok(copy[key] && copy[key].trim().length > 1, `${language}: пустая подпись ${key}`);
    }
    assert.equal(copy.modes.length, 3, `${language}: у галетника должно быть три положения`);
    assert.notEqual(copy.statusOn, copy.statusOff, `${language}: состояния пульта не различаются`);
  }
});

test("реестр инструментов показывает все пять типов с числами спецификации", async () => {
  // Жалоба владельца 2026-09-30: «в инструментах не показаны все инструменты и
  // как-то всё хаотично». Теперь на странице реестр типов, профиль каждого типа,
  // матрица редкостей и витрина всех 25 исполнений.
  const catalog = await import("../src/i18n/siteToolsCatalog.ts");
  const { TOOL_NFTS, TOOL_RARITIES, toolPlate } = await import("../src/lib/visualAssets.ts");
  const { toolsCopy } = await import("../src/i18n/toolsCopy.ts");
  const { homeResourceNames } = await import("../src/i18n/homeDetail.ts");
  const { languages } = await import("../src/i18n/translations.ts");
  const extras = code("src/site/pages/ExtraSections.tsx");

  // Реестр описан для всех пяти типов: ресурс, часы, множитель, источник.
  assert.equal(TOOL_NFTS.length, 5, "типов инструмента должно быть пять");
  assert.equal(TOOL_RARITIES.length, 5, "редкостей должно быть пять");
  assert.equal(Object.keys(catalog.TOOL_RESOURCE).length, 5, "не у всех типов указан ресурс");
  assert.equal(Object.keys(catalog.TOOL_FROM_PACK).length, 5, "не у всех типов указан источник");
  assert.equal(catalog.TOOL_SHIFT_HOURS.length, 5, "часы захода должны быть перечислены по редкости");
  assert.equal(catalog.TOOL_YIELD_MULTIPLIER.length, 5, "множитель выхода должен быть перечислен по редкости");
  for (const tool of TOOL_NFTS) {
    const id = tool.id as keyof typeof catalog.TOOL_RESOURCE;
    assert.ok(catalog.TOOL_RESOURCE[id], `${id}: нет добываемого ресурса`);
    assert.ok(homeResourceNames.ru[catalog.TOOL_RESOURCE[id] as keyof typeof homeResourceNames.ru], `${id}: ресурс не назван`);
    assert.equal(typeof catalog.TOOL_FROM_PACK[id], "boolean", `${id}: источник не определён`);
  }
  // Из капсул выпадают только три типа: это правило спецификации, не оформление.
  const fromPack = Object.values(catalog.TOOL_FROM_PACK).filter(Boolean).length;
  assert.equal(fromPack, 3, "из капсул дропа должны выпадать три типа из пяти");
  // Витрина показывает каждое исполнение: 5 типов × 5 редкостей = 25 картин.
  for (const tool of TOOL_NFTS) for (const rarity of TOOL_RARITIES) {
    assert.ok(toolPlate(tool.id, rarity), `${tool.id}/${rarity}: нет картины`);
  }
  const source = read("src/lib/visualAssets.ts");
  assert.equal((source.match(/\/assets\/nfts\/[a-z-]+\.png/g) || []).length >= 25, true, "картины исполнений пропали");

  for (const language of languages) {
    const copy = catalog.toolsCatalogCopy[language];
    const profiles = catalog.toolProfiles[language];
    for (const key of ["registryHeading", "registryIntro", "profileHeading", "profileIntro", "miningNote", "matrixHeading", "matrixIntro", "galleryFilter", "galleryAllRarities"] as const) {
      assert.ok(copy[key] && copy[key].trim().length > 4, `${language}: пустая подпись ${key}`);
    }
    for (const key of ["tool", "resource", "hours", "yield", "source"] as const) {
      assert.ok(copy.columns[key].trim(), `${language}: пустая колонка ${key}`);
    }
    assert.ok(copy.fromPack.trim() && copy.craftOnly.trim(), `${language}: нет подписи источника`);
    assert.notEqual(copy.fromPack, copy.craftOnly, `${language}: капсула и сборка не различаются`);
    assert.match(copy.produces("X"), /X/, `${language}: строка «добывает» теряет название ресурса`);
    assert.match(copy.galleryShowing(5, 25), /5/);
    assert.match(copy.galleryShowing(5, 25), /25/);
    for (const tool of TOOL_NFTS) {
      const text = profiles[tool.id as keyof typeof profiles];
      assert.ok(text && text.trim().length > 40, `${language}: ${tool.id} без описания`);
    }
  }
  // Страница обязана показывать и реестр, и профили, и матрицу, и витрину.
  for (const anchor of ["catalog.registryHeading", "catalog.profileHeading", "catalog.matrixHeading", "copy.galleryHeading", "<ToolGallery"]) {
    assert.ok(extras.includes(anchor), `на странице инструментов пропал блок: ${anchor}`);
  }
  assert.match(extras, /TOOL_YIELD_MULTIPLIER\[index\]/, "матрица редкостей должна показывать множитель выхода");
});

test("каталог ресурсов разложен по отделам и показывает все 27 ресурсов", async () => {
  const { resources } = await import("../src/site/content/resources.ts");
  const { resourceCatalogCopy } = await import("../src/i18n/resourceCatalogCopy.ts");
  const { homeResourceNames } = await import("../src/i18n/homeDetail.ts");
  const { resourceLeads } = await import("../src/i18n/resourceLeads.ts");
  const { resourceRecipes } = await import("../src/i18n/resourceDetailCopy.ts");
  const { languages } = await import("../src/i18n/translations.ts");
  const page = code("src/site/pages/ContentPage.tsx");
  const css = read("src/site/styles/site.css");

  assert.equal(resources.length, 27, "каталог обязан описывать все 27 ресурсов");
  // Отделы выводятся по порядку и только те, где что-то лежит: пустой отдел
  // выглядел как поломка поиска.
  assert.match(page, /const CATALOG_ORDER: ResourceCategory\[\] = \[/, "нет порядка отделов");
  assert.match(page, /CATALOG_ORDER\.filter\(key => resources\.some/, "отделы без ресурсов обязаны отсеиваться");
  assert.match(page, /site-catalog-group__title/, "заголовок отдела пропал");
  assert.match(page, /copy\.showing\(list\.length, resources\.length\)/, "нет счётчика показанного");
  assert.match(page, /resourceRecipes\(r\.id as ResourceId, language\)/, "роли ресурса берутся из таблицы рецептов, а не из текста");
  assert.match(css, /\.site-catalog-group__count \{/, "у отдела нет счётчика");
  assert.match(css, /\.site-resource__roles li \{/, "у карточки ресурса нет марок роли");

  const categories = [...new Set(resources.map((r: { category: string }) => r.category))];
  assert.ok(categories.length >= 6, `отделов должно быть не меньше шести, найдено ${categories.length}`);
  for (const language of languages) {
    const copy = resourceCatalogCopy[language];
    for (const category of categories) {
      const key = category as keyof typeof copy.labels;
      assert.ok(copy.labels[key]?.trim(), `${language}: нет названия отдела ${category}`);
      assert.ok(copy.notes[key]?.trim().length > 30, `${language}: нет пояснения отдела ${category}`);
    }
    assert.ok(copy.linkedLabel.trim() && copy.groupNote.trim().length > 30, `${language}: нет подписи связей`);
    assert.match(copy.recipeMakes(2), /2/);
    assert.match(copy.recipeUses(3), /3/);
    assert.match(copy.showing(27, 27), /27/);
    assert.match(copy.showing(4, 27), /4/);
    for (const resource of resources) {
      const id = resource.id as keyof typeof homeResourceNames.ru;
      assert.ok(homeResourceNames[language][id], `${language}: ${resource.id} без названия`);
      assert.ok(resourceLeads[language][id], `${language}: ${resource.id} без описания`);
    }
  }
  // Роли в карточке — это следствие таблицы рецептов, а не выдуманные числа.
  const withRecipe = resources.filter((r: { id: string }) => {
    const lines = resourceRecipes(r.id as never, "ru");
    return lines.produces.length + lines.uses.length > 0;
  });
  assert.ok(withRecipe.length >= 10, "таблица рецептов перестала связывать ресурсы");
});

test("витрина капсул дропа: картины, описания и раскрытие — и на сайте, и в игре", async () => {
  // Жалоба владельца 2026-09-30: «иллюстрация дропа отсутствует — картинки и
  // описание нет ни на сайте, ни в игре, при нажатии не раскрывается визуал».
  const { PACK_ART, packPlate } = await import("../src/lib/visualAssets.ts");
  const { packsCopy } = await import("../src/i18n/packsCopy.ts");
  const { siteChanceCopy } = await import("../src/i18n/siteChanceCopy.ts");
  const { languages } = await import("../src/i18n/translations.ts");
  const packs = code("src/pages/tools/PacksPage.tsx");
  const site = code("src/site/ui/Components.tsx");
  const plate = code("src/components/visual/PackPlate.tsx");

  // Три закрытые витрины по размеру и одна открытая: открытая не показывает
  // выигрыш — его решает оракул в сети.
  for (const id of ["small", "medium", "big", "opened"] as const) {
    assert.ok(PACK_ART[id], `нет картины капсулы: ${id}`);
    assert.ok(existsSync(join(root, "public", PACK_ART[id])), `файл картины не найден: ${PACK_ART[id]}`);
  }
  assert.equal(packPlate("small"), PACK_ART.small);
  assert.equal(packPlate(undefined), undefined, "без id плашка не должна показывать чужую картину");
  assert.match(plate, /state === "opened" \? PACK_ART\.opened : PACK_ART\[packId\]/,
    "открытая витрина должна отличаться от закрытой");

  // Игра: карточка размера показывает картину и объяснение, ожидание — витрину
  // выбранного размера, возврат — раскрытую пустую капсулу.
  assert.match(packs, /<PackPlate packId=\{pack\.id\}/, "в игре у карточки капсулы нет картины");
  assert.match(packs, /copy\.about\[pack\.id\]/, "в игре нет описания капсулы");
  assert.match(packs, /<PackPlate packId=\{lastPack\} size="100%"/, "ожидание открытия без витрины");
  assert.match(packs, /<PackPlate packId=\{lastPack\} state="opened"/, "возврат без раскрытой витрины");
  assert.match(packs, /setLastPack\(pack\.id\)/, "витрина не запоминает открытый размер");

  // Сайт: иллюстрация меняется вместе с размером и раскрывается по кнопке.
  assert.match(site, /<PackPlate packId=\{size\} state=\{sample === null \? 'sealed' : 'opened'\}/,
    "на сайте витрина капсулы не связана с размером и открытием");
  assert.match(read("src/site/styles/site.css"), /\.site-pack-demo \{/, "у витрины капсулы нет оформления");

  for (const language of languages) {
    const game = packsCopy[language];
    for (const size of ["small", "medium", "big"] as const) {
      assert.ok(game.about[size]?.trim().length > 60, `${language}: ${size} без описания`);
    }
    assert.ok(game.illustration.trim(), `${language}: нет подписи витрины`);
    const demo = siteChanceCopy[language].packDemo;
    assert.ok(demo.sizes.length === 3 && demo.sealed.trim() && demo.open.trim(), `${language}: иллюстрация капсулы не подписана`);
  }
});

test("раскрытие одной панели закрывает остальные — меню и аккордеоны", async () => {
  // Жалоба владельца 2026-09-30: «верхняя панель когда разворачиваешь и
  // раскрываешь две, например, остаются на месте и не сворачиваются при
  // раскрытии других». Это нативные <details>: браузер держит открытыми все.
  const hook = code("src/site/hooks/useSingleOpen.ts");
  const components = code("src/site/ui/Components.tsx");
  const layout = code("src/site/layout/Layout.tsx");
  const extras = code("src/site/pages/ExtraSections.tsx");

  assert.match(hook, /querySelectorAll<HTMLDetailsElement>\('details\[open\]'\)/, "нет поиска открытых панелей");
  assert.match(hook, /other\.open = false/, "соседние панели не закрываются");
  assert.match(hook, /addEventListener\('toggle', onToggle, true\)/,
    "событие toggle не всплывает — нужен перехват");
  assert.equal((extras.match(/<Accordion/g) || []).length, 3,
    "правила, частые вопросы и регламенты должны быть на общем аккордеоне");
  assert.ok(!/<div className="site-accordion/.test(extras), "остался старый div-аккордеон без правила");
  assert.match(components, /export function Accordion\(/, "нет общего компонента аккордеона");
  assert.match(components, /useSingleOpen<HTMLDivElement>\(\)/, "аккордеон не использует правило одной панели");
  assert.match(layout, /const navRef = useSingleOpen<HTMLElement>\(\)/, "меню в шапке не сворачивает прежнюю группу");
  assert.match(layout, /<nav className="site-desktop-nav"[^>]*ref=\{navRef\}/, "хук не подключён к меню");
});

test("у каждого отказа бэкенда есть человеческое объяснение на всех языках", async () => {
  // Владелец 2026-09-30: «разблокируй везде все действия». Половина отказов —
  // это состояние сети, а не переключатель, поэтому игрок обязан видеть
  // причину, а не технический код. Тест ловит новый 503-код, к которому
  // забыли текст.
  const { apiErrorCodes, apiErrorCopy } = await import("../src/i18n/apiErrorCopy.ts");
  const { languages } = await import("../src/i18n/translations.ts");
  const { isKnownVrfCode } = await import("../src/lib/vrfErrors.ts");

  // Вытаскиваем все машинные коды, которые бэкенд может вернуть игроку.
  const backendCodes = new Set<string>();
  const backendRoot = join(root, "..", "aof_backend", "src");
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith(".ts")) continue;
      const text = readFileSync(full, "utf8");
      for (const match of text.matchAll(/error:\s*"([A-Z][A-Z0-9_]{6,})"/g)) backendCodes.add(match[1]);
      for (const match of text.matchAll(/vrfUnavailable\("([A-Z0-9_]+)"\)/g)) backendCodes.add(match[1]);
      // Season XP helpers throw stable codes that the routes return through
      // catch(error). Include those dynamic responses in the same localization gate.
      if (/(?:adminXp|seasonXpClaims|seasonXpEntitlement|seasonXpEntitlementStore|seasonXpClaimConfirmation)\.ts$/.test(full)) {
        for (const match of text.matchAll(/throw new Error\(\s*["']([A-Z][A-Z0-9_]{6,})["']\s*\)/g)) backendCodes.add(match[1]);
      }
    }
  };
  walk(backendRoot);
  assert.ok(backendCodes.size > 40, `кодов бэкенда найдено слишком мало: ${backendCodes.size}`);

  const missing: string[] = [];
  for (const code of backendCodes) {
    // Коды VRF переводит второй стадии конвейера (vrfCopy), а не общий список.
    if (isKnownVrfCode(code)) continue;
    if (!apiErrorCodes.includes(code as never)) missing.push(code);
  }
  assert.deepEqual(missing, [], `у этих кодов бэкенда нет объяснения в apiErrorCopy: ${missing.join(", ")}`);

  // Ни одно сообщение не должно быть пустым или оставленным по-русски в
  // остальных языках: сравнение по совпадению строк ловит копипасту.
  for (const language of languages) {
    const copy = apiErrorCopy[language];
    for (const code of apiErrorCodes) {
      const text = copy.messages[code];
      assert.ok(text && text.trim().length > 20, `${language}/${code}: пустое объяснение`);
    }
  }
  for (const language of languages.filter(l => l !== "ru")) {
    const ru = apiErrorCopy.ru.messages, other = apiErrorCopy[language].messages;
    const same = apiErrorCodes.filter(code => other[code] === ru[code]);
    assert.ok(same.length <= 2, `${language}: ${same.length} сообщений остались русскими (${same.slice(0, 3).join(", ")})`);
  }
});

test("газ-бак: живые действия игры впервые получили интерфейс", async () => {
  // Владелец 2026-09-30: «включи, если не доделано то доделай». Механика бака
  // была полностью живой (инструкции deposit_gas/withdraw_gas, маршруты
  // /gastank/deposit|withdraw, чтение /query/gastank), но пополнить бак в игре
  // было нечем — а снятие инструмента и разлок коллекционера берут 0.01 SOL
  // именно из него.
  const panel = code("src/components/GasTankPanel.tsx");
  const lib = code("src/lib/gasTank.ts");
  const dash = code("src/pages/farm/FarmDashboard.tsx");

  assert.match(dash, /<GasTankPanel/, "панель бака не подключена к экрану лаборатории");
  assert.match(lib, /api\.query\.gastank\(owner\)/, "баланс должен читаться из /query/gastank");
  assert.match(panel, /handleTxResponse\(response, intent\)/, "транзакция бака идёт через общий контур с намерением");
  assert.match(panel, /kind: "gasTank" as const, action: "deposit" as const/, "депозит не привязан к намерению кошелька");
  assert.match(panel, /kind: "gasTank" as const, action: "withdraw" as const/, "вывод не привязан к намерению кошелька");
  assert.ok(!/parseFloat|Number\(amount/.test(panel + lib), "сумма бака снова считается через плавающую точку");
  // Неизвестное чтение не превращается в ноль: игрок видит прочерк.
  assert.match(panel, /reading\.kind === "unknown" \? "—"/, "сбой чтения бака показывается нулём");
  // Крупный вывод (> 0.2 SOL) обязан предупредить про кулдаун 12 ч.
  assert.match(lib, /INSTANT_WITHDRAW_MICROS = 200_000n/, "порог мгновенного вывода разошёлся с контрактом");
  assert.match(lib, /COOLDOWN_SECONDS = 12 \* 3600/, "кулдаун бака разошёлся с контрактом");
  assert.match(lib, /FEE_PER_NFT_MICROS = 10_000n/, "комиссия снятия разошлась с контрактом");

  // Тексты: семь языков, все поля заполнены, русский не подставлен вместо копий.
  const { gasTankCopy } = await import("../src/i18n/gasTankCopy.ts");
  const { languages } = await import("../src/i18n/translations.ts");
  const keys = Object.keys(gasTankCopy.ru).sort();
  for (const language of languages) {
    const copy: any = gasTankCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), keys, `${language}: набор полей бака разошёлся`);
    for (const key of keys) {
      const value = copy[key];
      const text = typeof value === "function" ? value("1") : value;
      assert.ok(typeof text === "string" && text.trim().length >= 2, `${language}/${key}: пустой текст бака`);
    }
  }
  const subs = languages.filter(l => l !== "ru");
  const identical = subs.filter(l => gasTankCopy[l].title === gasTankCopy.ru.title && gasTankCopy[l].balance === gasTankCopy.ru.balance);
  assert.equal(identical.length, 0, `баковые тексты остались русскими: ${identical.join(", ")}`);
});

test("намерение газ-бака не подписывает чужую сумму и чужой аккаунт", async () => {
  const { validateTransactionIntent, CORE_PROGRAM_ID } = await import("../src/lib/transactionIntent.ts");
  const { coreInstructionSpec } = await import("../src/lib/coreInstructions.ts");
  const { PublicKey } = await import("@solana/web3.js");
  const { CORE_INSTRUCTIONS } = await import("../src/lib/coreInstructions.ts");

  const user = new PublicKey("7xKXtg2CW87d97TXJTDpQkAX9sv2vHHwL7PRQCPHh8oF");
  const specFor = (name: string) => CORE_INSTRUCTIONS.find(i => i.name === name)!;
  const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), ...(key ? [key.toBytes()] : [])], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  const u64 = (value: bigint) => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, value, true);
    return bytes;
  };
  const ix = (name: string, amountLamports: bigint, keys = [pda("config"), user, pda("gastank", user),
    new PublicKey("11111111111111111111111111111111")]) => ({
    programId: CORE_PROGRAM_ID,
    keys,
    data: new Uint8Array([...specFor(name).discriminator, ...u64(amountLamports)]),
  });
  const intent = (amountLamports: string) => ({
    kind: "gasTank" as const, action: "deposit" as const, user: user.toBase58(), amountLamports,
  });

  // Ровно то, что игрок видел на экране, — подписывается.
  validateTransactionIntent([ix("deposit_gas", 50_000_000n)], intent("50000000"), user);
  // Подменённая сумма, чужой бак, подмена действия и лишняя инструкция — отказ.
  assert.throws(() => validateTransactionIntent([ix("deposit_gas", 900_000_000n)], intent("50000000"), user));
  assert.throws(() => validateTransactionIntent(
    [ix("deposit_gas", 50_000_000n, [pda("config"), user, pda("gastank", new PublicKey("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T")), new PublicKey("11111111111111111111111111111111")])],
    intent("50000000"), user,
  ));
  assert.throws(() => validateTransactionIntent([ix("withdraw_gas", 50_000_000n)], intent("50000000"), user));
  assert.throws(() => validateTransactionIntent(
    [ix("deposit_gas", 50_000_000n), ix("deposit_gas", 50_000_000n)], intent("50000000"), user,
  ));
  // Вывод проверяется своей единицей (микро) и своим именем инструкции.
  validateTransactionIntent([ix("withdraw_gas", 50_000n)], {
    kind: "gasTank", action: "withdraw", user: user.toBase58(), amountMicros: "50000",
  }, user);
});

test("коллекционеры: перки включаются из игры, а не только числом в профиле", async () => {
  // [AUDIT F-16]: perks были посчитаны в программе и объявлены на сайте, но
  // постановка NFT жила только в API. Панель обязана повторять правила
  // контракта, а не «улучшать» их: 1 NFT за вызов, lock 3 дня, allowlist
  // оператора, 0.01 SOL из газ-бака за возврат.
  const panel = code("src/components/CollectorsPanel.tsx");
  const lib = code("src/lib/collectors.ts");
  const profile = code("src/pages/profile/ProfileHome.tsx");
  const backend = read("../aof_backend/src/routes/query.ts");

  assert.match(profile, /<CollectorsPanel \/>/, "панель коллекционеров не подключена к профилю");
  assert.match(panel, /api\.collectors\.stake/, "нет пути постановки NFT");
  assert.match(panel, /api\.collectors\.unstake/, "нет пути возврата NFT");
  assert.match(panel, /handleTxResponse\(response, intent\)/, "транзакция коллекционера идёт мимо общего контура");
  assert.match(lib, /COLLECTOR_LOCK_SECONDS = 3 \* 86400/, "лок разошёлся с контрактом (3 дня)");
  assert.match(lib, /kind: "unknown"/, "сбой чтения позиции должен отличаться от «позиции нет»");
  assert.ok(!/parseFloat/.test(panel + lib), "адрес или сумма коллекционера считаются плавающей точкой");
  // Чтение позиции канонично и fail-closed: ошибка — 503, а не пустой объект.
  assert.match(backend, /r\.get\("\/collector\/:mint"/, "нет read-маршрута позиции коллекционера");
  assert.match(backend, /COLLECTOR_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN/, "ошибка чтения позиции не отличается от «нет позиции»");

  const { collectorCopy } = await import("../src/i18n/collectorCopy.ts");
  const { languages } = await import("../src/i18n/translations.ts");
  const keys = Object.keys(collectorCopy.ru).sort();
  for (const language of languages) {
    const copy: any = collectorCopy[language];
    assert.deepEqual(Object.keys(copy).sort(), keys, `${language}: набор полей коллекционеров разошёлся`);
    for (const key of keys) {
      const value = copy[key];
      const text = typeof value === "function" ? value("abc") : value;
      assert.ok(typeof text === "string" && text.trim().length >= 2, `${language}/${key}: пустой текст`);
    }
  }
});

test("намерение коллекционера не уводит в хранилище чужой NFT", async () => {
  const { validateTransactionIntent, CORE_PROGRAM_ID } = await import("../src/lib/transactionIntent.ts");
  const { coreInstructionSpec, CORE_INSTRUCTIONS } = await import("../src/lib/coreInstructions.ts");
  const { PublicKey } = await import("@solana/web3.js");

  const user = new PublicKey("7xKXtg2CW87d97TXJTDpQkAX9sv2vHHwL7PRQCPHh8oF");
  const other = new PublicKey("4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T");
  const mint = new PublicKey("So11111111111111111111111111111111111111112");
  const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const SYSTEM = new PublicKey("11111111111111111111111111111111");
  const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), ...(key ? [key.toBytes()] : [])], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  const vault = pda("vault");
  // Адрес персоны в тесте может оказаться off-curve, поэтому ATA выводим
  // примитивом PDA (как это делает сам валидатор), а не удобным хелпером.
  const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const ataRaw = (m: PublicKey, owner: PublicKey) => PublicKey.findProgramAddressSync(
    [owner.toBytes(), TOKEN.toBytes(), m.toBytes()], ATA_PROGRAM)[0];
  const keys = (m: PublicKey, forStake: boolean) => forStake
    ? [pda("config"), user, m, ataRaw(m, user), vault, ataRaw(m, vault),
      pda("collector", m), pda("collector_allow", m), pda("player", user), TOKEN, SYSTEM]
    : [pda("config"), user, m, ataRaw(m, user), vault, ataRaw(m, vault),
      pda("collector", m), pda("player", user), pda("gastank", user), TOKEN];
  const disc = (name: string) => CORE_INSTRUCTIONS.find(i => i.name === name)!.discriminator;
  const stakeIx = (m: PublicKey, kind: number) => ({
    programId: CORE_PROGRAM_ID, keys: keys(m, true), data: new Uint8Array([...disc("collector_stake"), kind]),
  });
  const unstakeIx = (m: PublicKey) => ({
    programId: CORE_PROGRAM_ID, keys: keys(m, false), data: new Uint8Array(disc("collector_unstake")),
  });

  validateTransactionIntent([stakeIx(mint, 0)], {
    kind: "collector", action: "stake", user: user.toBase58(), mint: mint.toBase58(), collectorKind: "historian",
  }, user);
  validateTransactionIntent([unstakeIx(mint)], {
    kind: "collector", action: "unstake", user: user.toBase58(), mint: mint.toBase58(),
  }, user);
  // Чужой минт, чужой вид перка, снятие вместо постановки и чужая сторона — отказ.
  assert.throws(() => validateTransactionIntent([stakeIx(other, 0)], {
    kind: "collector", action: "stake", user: user.toBase58(), mint: mint.toBase58(), collectorKind: "historian",
  }, user));
  assert.throws(() => validateTransactionIntent([stakeIx(mint, 1)], {
    kind: "collector", action: "stake", user: user.toBase58(), mint: mint.toBase58(), collectorKind: "historian",
  }, user));
  assert.throws(() => validateTransactionIntent([unstakeIx(mint)], {
    kind: "collector", action: "stake", user: user.toBase58(), mint: mint.toBase58(), collectorKind: "medallion",
  }, user));
  assert.throws(() => validateTransactionIntent([stakeIx(mint, 0)], {
    kind: "collector", action: "stake", user: other.toBase58(), mint: mint.toBase58(), collectorKind: "historian",
  }, user));
  // Вторая инструкция в пакете не прячется за первой.
  assert.throws(() => validateTransactionIntent([stakeIx(mint, 0), unstakeIx(mint)], {
    kind: "collector", action: "stake", user: user.toBase58(), mint: mint.toBase58(), collectorKind: "historian",
  }, user));
  void coreInstructionSpec;
});

test("намерение покупки билета не даёт списать больше подписанного потолка", async () => {
  const { validateTransactionIntent, CORE_PROGRAM_ID } = await import("../src/lib/transactionIntent.ts");
  const { CORE_INSTRUCTIONS } = await import("../src/lib/coreInstructions.ts");
  const { LOTTERY_TICKET_PRICE_LAMPORTS } = await import("../src/lib/lotteryReadings.ts");
  const { PublicKey } = await import("@solana/web3.js");

  const user = new PublicKey("7xKXtg2CW87d97TXJTDpQkAX9sv2vHHwL7PRQCPHh8oF");
  const SYSTEM = new PublicKey("11111111111111111111111111111111");
  const pda = (seed: string, ...parts: Uint8Array[]) => PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), ...parts], new PublicKey(CORE_PROGRAM_ID),
  )[0];
  const u64 = (text: string) => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, BigInt(text), true);
    return bytes;
  };
  const roundId = "9007199254740993";
  const ticketNumber = "3";
  const buyDisc = CORE_INSTRUCTIONS.find(i => i.name === "buy_lottery_ticket")!.discriminator;
  const buyIx = (maxPrice: string, round = roundId, ticket = ticketNumber) => ({
    programId: CORE_PROGRAM_ID,
    keys: [pda("config"), user, pda("lottery_round", u64(round)),
      pda("lottery_ticket", u64(round), u64(ticket)),
      pda("lottery_ticket", new TextEncoder().encode("count"), u64(round), user.toBytes()), SYSTEM],
    data: new Uint8Array([...buyDisc, ...u64(maxPrice)]),
  });
  const intent = {
    kind: "lotteryTicket", action: "buy", user: user.toBase58(), roundId,
    ticketNumber, maxPriceLamports: LOTTERY_TICKET_PRICE_LAMPORTS,
  } as const;

  // Ровно один билет своего раунда с потолком из интерфейса — принимается.
  validateTransactionIntent([buyIx(LOTTERY_TICKET_PRICE_LAMPORTS)], intent, user);
  // Другой потолок, другой билет/раунд, чужой потолок в намерении, лишняя
  // инструкция — отказ до кошелька.
  assert.throws(() => validateTransactionIntent([buyIx("900000")], intent, user), /ceiling/);
  assert.throws(() => validateTransactionIntent([buyIx(LOTTERY_TICKET_PRICE_LAMPORTS)], { ...intent, ticketNumber: "4" }, user));
  assert.throws(() => validateTransactionIntent([buyIx(LOTTERY_TICKET_PRICE_LAMPORTS)], { ...intent, maxPriceLamports: "800001" }, user), /ceiling/);
  assert.throws(() => validateTransactionIntent([buyIx(LOTTERY_TICKET_PRICE_LAMPORTS), buyIx(LOTTERY_TICKET_PRICE_LAMPORTS)], intent, user));
});

test("книга v2: целочисленная цена, эскроу вверх и проверка намерения до кошелька", async () => {
  const { quoteTotalLamports, takerBufferLamports, resourceUnitsToAtoms, solPerWholeToLamports,
    readOrderbookV2, lamportsPerWholeToSol, comparePriceV2 } = await import("../src/lib/orderbookReadings.ts");
  const { validateTransactionIntent, CORE_PROGRAM_ID } = await import("../src/lib/transactionIntent.ts");
  const { CORE_INSTRUCTIONS } = await import("../src/lib/coreInstructions.ts");
  const { PublicKey } = await import("@solana/web3.js");

  // Формулы повторяют `quote_total_lamports` и подушку тейкера из программы.
  assert.equal(quoteTotalLamports("1000000000", "1000000000"), 1000000000n);
  assert.equal(quoteTotalLamports("3", "1"), 1n);
  assert.equal(quoteTotalLamports("1500000000", "1"), 2n);
  assert.equal(takerBufferLamports(10_000n), 40n);
  assert.equal(takerBufferLamports(1n), 1n);
  // Ввод пользователя: 9 знаков после точки, больше — отказ, а не округление.
  assert.equal(resourceUnitsToAtoms("1.5"), "1500000000");
  assert.equal(resourceUnitsToAtoms("0.000000001"), "1");
  assert.equal(solPerWholeToLamports("0.001"), "1000000");
  assert.equal(lamportsPerWholeToSol("1000000", "en"), "0.001");
  for (const bad of ["1.0000000001", "0", "-1", "1e9", "", "0.0000000001"]) {
    assert.throws(() => resourceUnitsToAtoms(bad), `должно отвергаться: ${bad}`);
  }
  for (const bad of ["0", "1.0000000001", "abc"]) assert.throws(() => solPerWholeToLamports(bad));

  const maker = new PublicKey(new Uint8Array(32).fill(7)).toBase58();
  const mint = new PublicKey(new Uint8Array(32).fill(8)).toBase58();
  const order = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("resource_order_v2"), new PublicKey(maker).toBuffer(), new PublicKey(mint).toBuffer()],
    new PublicKey(CORE_PROGRAM_ID),
  )[0].toBase58();
  const row = { pubkey: order, maker, mint, kind: 1, isBuy: true,
    priceLamportsPerWhole: "1000000", amountRemaining: "1500000000", escrowLamports: "1501000" };
  const book = { buy: [row], sell: [], exhausted: [] };
  assert.deepEqual(readOrderbookV2(book, mint, 1), book);
  assert.equal(comparePriceV2(row, { ...row, priceLamportsPerWhole: "1000001" }), -1);
  for (const invalid of [null, {}, { buy: [], sell: [] }, { ...book, buy: [{ ...row, pubkey: maker }] },
    { ...book, buy: [{ ...row, escrowLamports: "0" }] },      // покупатель без эскроу
    { ...book, buy: [{ ...row, priceLamportsPerWhole: "0" }] },
    { ...book, buy: [{ ...row, amountRemaining: "0" }] },
    { buy: [], sell: [{ ...row, isBuy: false, escrowLamports: "1" }], exhausted: [] }]) {
    assert.equal(readOrderbookV2(invalid, mint, 1), null, JSON.stringify(invalid).slice(0, 120));
  }

  // Намерение: одна инструкция, те же аккаунты, те же 8+1+8+8 байт условий и
  // тот же посчитанный эскроу.
  const user = new PublicKey(new Uint8Array(32).fill(9));
  const disc = CORE_INSTRUCTIONS.find(i => i.name === "place_buy_order_v2")!.discriminator;
  const SYSTEM = new PublicKey("11111111111111111111111111111111");
  const pda = (seed: string, key?: PublicKey) => PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(seed), ...(key ? [key.toBytes()] : [])], new PublicKey(CORE_PROGRAM_ID))[0];
  const u64 = (value: bigint) => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setBigUint64(0, value, true);
    return bytes;
  };
  const userOrder = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("resource_order_v2"), user.toBytes(), new PublicKey(mint).toBytes()],
    new PublicKey(CORE_PROGRAM_ID),
  )[0];
  // escrow = ceil(1e6 × 1.5e9 / 1e9) + ceil(total × 40 / 1e4) = 1_500_000 + 6_000
  const terms = { kind: "orderbookV2", action: "buy", user: user.toBase58(), mint, resourceKind: 1,
    priceLamportsPerWhole: "1000000", amountAtoms: "1500000000", escrowLamports: "1506000" } as const;
  const buyIx = (price: bigint, atoms: bigint, kind = 1) => ({
    programId: CORE_PROGRAM_ID,
    keys: [pda("config"), user, new PublicKey(mint), pda("material_mints"), userOrder, SYSTEM],
    data: new Uint8Array([...disc, kind, ...u64(price), ...u64(atoms)]),
  });
  validateTransactionIntent([buyIx(1_000_000n, 1_500_000_000n)], terms, user);
  assert.throws(() => validateTransactionIntent([buyIx(1_000_001n, 1_500_000_000n)], terms, user), /terms/);
  assert.throws(() => validateTransactionIntent([buyIx(1_000_000n, 1_500_000_000n, 2)], terms, user), /terms/);
  assert.throws(() => validateTransactionIntent([buyIx(1_000_000n, 1_500_000_000n), buyIx(1_000_000n, 1_500_000_000n)], terms, user));
  // Подмена залога: бэкенд не может показать одну сумму, а списать другую.
  assert.throws(() => validateTransactionIntent([buyIx(1_000_000n, 1_500_000_000n)],
    { ...terms, escrowLamports: "1506001" }, user), /escrow/);
});

test("перерождение: панель читает сеть, отвергает расхождение и подписывает полный сброс", async () => {
  const { readRebirthStatus, surplusTotalAtoms, cooldownRemainingMs, verifySurplusOnChain } =
    await import("../src/lib/rebirthReadings.ts");
  const { validateTransactionIntent, CORE_PROGRAM_ID, REBIRTH_PROGRAM_ID, REBIRTH_DO_DISCRIMINATOR } =
    await import("../src/lib/transactionIntent.ts");
  const { CORE_INSTRUCTIONS } = await import("../src/lib/coreInstructions.ts");
  const { PublicKey } = await import("@solana/web3.js");

  const mint = new PublicKey(new Uint8Array(32).fill(3)).toBase58();
  // Ресурсный ATA игрока: адрес вычисляется, а не берётся «как похоже» —
  // программа сброса принимает только канонический ATA (is_canonical_ata).
  const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ownerKey = new PublicKey(new Uint8Array(32).fill(9));
  const token = PublicKey.findProgramAddressSync(
    [ownerKey.toBytes(), TOKEN_PROGRAM.toBytes(), new PublicKey(mint).toBytes()], ATA_PROGRAM,
  )[0].toBase58();
  const raw = {
    seasonId: 7, rebirth: {
      configured: true, paused: false, authority: mint, treasury: token, costLamports: "100000000",
      cooldownSeconds: 604800, maxRebirths: 10, bonusPerRebirthBps: 200, maxBonusBps: 2000,
      generation: 2, rebirthCount: 1, permanentBonusBps: 200, lastRebirthTs: 100, nextAllowedAt: 604900,
    },
    progress: { player: true, villagers: 4, villagersAvailable: 2, hasTent: true, seasonPass: true, xp: 1500, premium: false },
    surplus: { limit: 16, accounts: [{ mint, tokenAccount: token, amountAtoms: "1500000000" }], fitsInOneTransaction: true },
    canRebirth: true, reasons: [], now: 200,
  };
  const status = readRebirthStatus(raw);
  assert.ok(status, "полный ответ обязан разбираться");
  assert.equal(status!.surplus.accounts.length, 1);
  assert.equal(surplusTotalAtoms(status!.surplus.accounts).toString(), "1500000000");
  // Часы передаются явно: ответ не должен зависеть от того, успел ли пройти
  // тик секунды между двумя замерами времени внутри функции.
  assert.equal(cooldownRemainingMs(status!, 200_000), (604900 - 200) * 1000);
  assert.equal(cooldownRemainingMs(status!, 604_899_000), 1000);
  assert.equal(cooldownRemainingMs(status!, 604_900_000), 0, 'после срока кулдаун не блокирует');
  assert.equal(cooldownRemainingMs(status!, 700_000_000), 0);

  // Любая неполнота — отказ, а не «покажем половину».
  for (const broken of [
    null, {}, { ...raw, seasonId: -1 }, { ...raw, rebirth: { ...raw.rebirth, costLamports: "0x10" } },
    { ...raw, rebirth: { ...raw.rebirth, treasury: "not-an-address" } },
    { ...raw, surplus: { ...raw.surplus, accounts: [{ mint, tokenAccount: token, amountAtoms: "0" }] } },
    { ...raw, surplus: { ...raw.surplus, accounts: [{ mint, tokenAccount: token }] } },
    { ...raw, surplus: { limit: 1, accounts: [{ mint, tokenAccount: token, amountAtoms: "1" }, { mint, tokenAccount: token, amountAtoms: "1" }], fitsInOneTransaction: true } },
    { ...raw, reasons: [7] }, { ...raw, canRebirth: "yes" },
  ]) {
    assert.equal(readRebirthStatus(broken), null, JSON.stringify(broken).slice(0, 100));
  }

  // Независимая сверка склада: совпало / разошлось / сеть недоступна.
  const account = (amount: bigint) => {
    const data = new Uint8Array(165);
    new DataView(data.buffer).setBigUint64(64, amount, true);
    return { data };
  };
  const surplus = [{ mint, tokenAccount: token, amountAtoms: "1500000000" }];
  const rpc = (value: bigint) => ({ getMultipleAccountsInfo: async () => [account(value)] });
  assert.deepEqual(await verifySurplusOnChain(rpc(1_500_000_000n), surplus),
    { kind: "confirmed", totalAtoms: "1500000000" });
  assert.deepEqual(await verifySurplusOnChain(rpc(1_400_000_000n), surplus),
    { kind: "mismatch", mint, expected: "1500000000", actual: "1400000000" });
  assert.deepEqual(await verifySurplusOnChain({ getMultipleAccountsInfo: async () => { throw new Error("rpc"); } }, surplus),
    { kind: "unavailable" });

  // Намерение: ровно две инструкции и те же аккаунты, что показаны игроку.
  const user = new PublicKey(new Uint8Array(32).fill(9));
  const SYSTEM = new PublicKey("11111111111111111111111111111111");
  const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const pda = (seed: string, program = CORE_PROGRAM_ID, ...parts: Uint8Array[]) =>
    PublicKey.findProgramAddressSync([new TextEncoder().encode(seed), ...parts], new PublicKey(program))[0];
  const u32 = (value: number) => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true); return bytes; };
  const season = pda("season", CORE_PROGRAM_ID, u32(7));
  const seasonPass = pda("season_pass", CORE_PROGRAM_ID, user.toBytes(), u32(7));
  const player = pda("player", CORE_PROGRAM_ID, user.toBytes());
  const resetDisc = CORE_INSTRUCTIONS.find(i => i.name === "reset_for_rebirth")!.discriminator;
  const operator = new PublicKey(new Uint8Array(32).fill(11));
  const resetIx = {
    programId: CORE_PROGRAM_ID,
    keys: [pda("config"), operator, user, player, season, seasonPass, pda("material_mints"), TOKEN,
      new PublicKey(mint), new PublicKey(token)],
    data: new Uint8Array([...resetDisc, ...u32(7)]),
  };
  const doIx = {
    programId: REBIRTH_PROGRAM_ID,
    keys: [pda("rebirth_config", REBIRTH_PROGRAM_ID), operator, pda("rebirth_record", REBIRTH_PROGRAM_ID, user.toBytes()),
      user, new PublicKey(token), SYSTEM],
    data: new Uint8Array(REBIRTH_DO_DISCRIMINATOR),
  };
  const intent = { kind: "rebirth", user: user.toBase58(), seasonId: 7, costLamports: "100000000",
    treasury: token, surplus: [{ mint, tokenAccount: token, amountAtoms: "1500000000" }] } as const;
  validateTransactionIntent([resetIx, doIx], intent, user);
  // Порядок, состав и полнота списка — часть намерения.
  assert.throws(() => validateTransactionIntent([doIx, resetIx], intent, user));
  assert.throws(() => validateTransactionIntent([resetIx], intent, user));
  assert.throws(() => validateTransactionIntent([resetIx, doIx, doIx], intent, user));
  assert.throws(() => validateTransactionIntent([{ ...resetIx, keys: resetIx.keys.slice(0, 8) }, doIx], intent, user));
  assert.throws(() => validateTransactionIntent([{ ...resetIx, keys: [...resetIx.keys, resetIx.keys[8]] }, doIx], intent, user));
  assert.throws(() => validateTransactionIntent([resetIx, { ...doIx, keys: doIx.keys.slice(1) }], intent, user));
  assert.throws(() => validateTransactionIntent([resetIx, { ...doIx, data: new Uint8Array(9) }], intent, user));
  assert.throws(() => validateTransactionIntent([{ ...resetIx, data: new Uint8Array([...resetDisc, ...u32(8)]) }, doIx], intent, user));
  assert.throws(() => validateTransactionIntent([resetIx, doIx], { ...intent, user: operator.toBase58() }, user));
  // Неканонический токен-аккаунт: сброс сжёг бы не тот ATA.
  assert.throws(() => validateTransactionIntent([resetIx, doIx],
    { ...intent, surplus: [{ mint, tokenAccount: mint, amountAtoms: "1500000000" }] }, user));
  assert.throws(() => validateTransactionIntent([
    { ...resetIx, keys: [...resetIx.keys.slice(0, 8), new PublicKey(mint), new PublicKey(mint)] }, doIx,
  ], intent, user));
});
