import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Регрессии интерфейса, найденные в аудите лаборатории 2026-09-28.
 *
 * Это статические проверки исходников, а не браузерные тесты: они не дают
 * вернуть в код мёртвые поля, выдуманные числа и верстку, которая выезжает
 * за экран на телефоне. Каждая проверка ссылается на конкретный дефект.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("лаборатория не показывает выдуманный SOL-газ", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.ok(!/value="12\.4"/.test(dash), "хардкод 12.4 вернулся в StatChip");
  const panels = read("src/components/farm/LabPanels.tsx");
  assert.match(panels, /api\.query\s*\.\s*gastank/, "газ-бак должен читаться из /query/gastank");
  assert.match(panels, /balanceMicros/, "баланс газа берётся из on-chain поля balanceMicros");
  assert.ok(!/rewardDaily[\s\S]{0,120}Стрик/.test(dash), "мёртвый стрик вернулся в обзор");
});

test("обзор лаборатории не дублирует ресурсы: один источник списка", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.ok(!/ResourceBar/.test(dash), "ResourceBar снова подключён в обзор");
  const panels = read("src/components/farm/LabPanels.tsx");
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
  const css = read("src/theme/manor.css");
  assert.match(css, /\.tab-btn \{[^}]*min-width: 0/, "tab-btn должен ужиматься");
  assert.match(css, /\.tab-btn \.tab-label \{[^}]*text-overflow: ellipsis/, "подпись таба должна обрезаться");
  assert.match(css, /@media \(max-width: 430px\)[\s\S]{0,120}\.tab-btn \.tab-label/, "нет адаптивного размера подписи");
});

test("подтабы экономики переносятся, а не обрезаются", () => {
  const css = read("src/theme/manor.css");
  assert.match(css, /\.sub-tabs \{ flex-wrap: wrap/, "подтабы должны переноситься по строкам");
});

test("декоративный canvas не создаёт горизонтальный скролл", () => {
  const css = read("src/theme/manor.css");
  assert.match(css, /#mn-fx-canvas \{[^}]*width: 100%/, "canvas должен иметь CSS-размер");
  assert.match(css, /html \{ overflow-x: clip; \}/, "html должен клипать горизонтальный оверфлоу");
  const fx = read("src/lib/manorFx.ts");
  assert.match(fx, /Math\.min\(devicePixelRatio \|\| 1, 2\)/, "DPR не ограничен");
});

test("сбой одного экрана не роняет весь шелл", () => {
  const stack = read("src/nav/StackView.tsx");
  assert.match(stack, /<ErrorBoundary label=\{tabKey\}>/, "StackView должен оборачивать экран в ErrorBoundary");
  const panel = read("src/components/PrivilegesPanel.tsx");
  assert.match(panel, /Array\.isArray\(data\?\.privileges\)/, "ответ без privileges ронял экран");
});

test("экран без кошелька не зависает на скелете", () => {
  const quests = read("src/pages/quests/QuestsHome.tsx");
  assert.match(quests, /if \(!address\) \{\s*setQuests\(\[\]\);\s*setLoading\(false\);/s, "вечный индикатор загрузки вернулся");
  assert.match(quests, /Подключите кошелёк, чтобы увидеть задания/, "нет пустого состояния без кошелька");
});

test("выдуманные проценты прогресса не возвращаются", () => {
  const quests = read("src/pages/quests/QuestsHome.tsx");
  assert.ok(!/level=\{64\}/.test(quests), "хардкод 64% вернулся в челленджи");
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.ok(!/value="12\.4"/.test(dash), "хардкод метрики вернулся в обзор лаборатории");
});

test("плитка хот-маркета не обещает отключённую механику", () => {
  const market = read("src/pages/market/MarketHome.tsx");
  assert.match(market, /isMechanicDisabled\("hot_market"\)/, "состояние механики должно учитываться");
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
  assert.match(plot, /WEATHER_TITLE/, "погода должна показываться человеческими подписями");
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

  // Шапка, обзор и колодец обязаны ходить через общий загрузчик.
  for (const file of [
    "src/components/ui/WeatherWidget.tsx",
    "src/pages/farm/FarmDashboard.tsx",
    "src/pages/farm/WellPanel.tsx",
  ]) {
    assert.match(read(file), /fetchWeatherSnapshot/, `${file} снова читает погоду по-своему`);
    assert.ok(!/api\.weather\.current\(\)/.test(read(file)), `${file} дублирует прямой вызов /weather/current`);
  }
  assert.ok(!/api\.weather\.forecast/.test(read("src/components/ui/WeatherWidget.tsx")),
    "прогноз снова берётся из закрытого /weather/forecast");
  assert.match(read("src/components/ui/WeatherWidget.tsx"), /forecastFromDayId/,
    "прогноз должен считаться из расписания дня");
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
  const lab = read("src/components/farm/LabPanels.tsx");
  assert.match(lab, /unavailable \? "—"/, "панель лаборатории показывает нули при 503");
  const overview = read("src/pages/economy/ResourceOverview.tsx");
  assert.match(overview, /Балансы ресурсов недоступны из канонической сети/,
    "обзор ресурсов обязан честно сообщать о недоступности вместо нулей");
  assert.match(overview, /Читаем балансы из канонической сети/,
    "до первого ответа игрок должен видеть загрузку, а не ложную недоступность");

  // Ежедневная награда: мёртвая кнопка «Завтра» не возвращается.
  const daily = read("src/components/DailyRewardButton.tsx");
  assert.match(daily, /kind: "disabled"/, "состояние «механика закрыта» пропало");
  assert.match(daily, /DataUnavailableNotice id="daily_rewards"/, "нет честного сообщения вместо кнопки");
  assert.ok(!/nextReward\.potato\b(?!\s*\?\?)/.test(daily), "легаси-поле potato снова используется напрямую");
});

test("ремонт проверяется до отрисовки кнопки", () => {
  const repair = read("src/pages/tools/RepairPage.tsx");
  assert.match(repair, /repairState/, "нет состояния готовности ремонта");
  assert.match(repair, /api\.query\.config\(\)/, "готовность должна проверяться по Config, как в /tools/repair");
  assert.match(repair, /FeatureDisabledNotice id="tools_repair"/, "нет объяснения, почему ремонт закрыт");
  assert.match(repair, /disabled=\{repairState !== "ready"/, "кнопка ремонта снова активна при закрытой механике");
  assert.ok(!/Durability/.test(repair), "английское «Durability» вернулось в русский интерфейс");
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
  assert.match(profile, /FeatureDisabledNotice id="rebirth"/,
    "причина rebirth обязана браться из DISABLED_MECHANICS, а не дублироваться текстом");
  const mining = read("src/components/ToolMiningCard.tsx");
  for (const label of ['"⏸️ Сбор отключён', '"⏸️ Добыча отключена до проверки on-chain"', '"↩️ Вернуть']) {
    assert.ok(!mining.includes(label), `эмоji-подпись в JSX-кнопке вернулась: ${label}`);
  }
  // Flash остаётся с эмодзи — его разбирает NoticeMsg.
  assert.match(mining, /flashMsg\("⏸️ Добыча отключена/, "flash-версия сообщения должна сохраниться");
});

test("барабан удачи называет ресурс канонически", () => {
  const drum = read("src/components/DrumSpin.tsx");
  assert.ok(!/MASCOT/.test(drum), "легаси-термин MASCOT вернулся в интерфейс");
  assert.match(drum, /resourceIcon\("MIND"\)/, "выигрыш должен показываться в MIND");
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
    "DAILY_REWARDS_UNAVAILABLE_UNTIL_ONCHAIN_POTATO_REWARD_IS_DEPLOYED",
    "QUEST_PROGRESS_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
    "REPAIR_RESOURCES_NOT_CONFIGURED",
    "MINING_DISABLED_ONCHAIN",
    "HOT_MARKET_DISABLED_UNTIL_CANONICAL_TOOL_TRANSFER",
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
  assert.match(api, /vipStatus: \(user: string\) => get\(`\/season\/\$\{user\}`\)/,
    "снова разошлись с r.get('/:user') в aof_backend/src/routes/vipStatus.ts");
  const vip = read("../aof_backend/src/routes/vipStatus.ts");
  assert.match(vip, /r\.get\("\/:user"/, "бэкенд переименовал роут vipStatus — обновить api.ts");
  const server = read("../aof_backend/src/server.ts");
  assert.match(server, /app\.use\("\/season", vipStatus\)/, "vipStatus больше не смонтирован на /season");
});

test("сбой чтения инвентаря не выглядит как пустой участок", () => {
  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.match(dash, /const \[staked, setStaked\] = useState<any\[\] \| null>\(null\)/,
    "staked обязан различать «неизвестно» и «ноль»");
  assert.match(dash, /staked === null/, "чип «построек» не показывает неизвестность");
  assert.match(dash, /Не удалось прочитать инструменты из канонической сети/,
    "карта участка обязана объяснять недоступность, а не молчать");
  const plot = read("src/pages/farm/FarmPlot.tsx");
  assert.match(plot, /setTools\(null\)/, "ошибка myTools не должна давать пустой массив");
  assert.match(plot, /tools === null \? \(toolsFailed \? "—" : "…"\)/,
    "сводка «Построек на участке» должна показывать —/… вместо 0");
  const home = read("src/pages/tools/ToolsHome.tsx");
  assert.match(home, /Инструменты недоступны из канонической сети/,
    "ToolsHome при сбое говорит «инструментов пока нет»");
  const repair = read("src/pages/tools/RepairPage.tsx");
  assert.match(repair, /tools !== null && tools.length === 0/,
    "RepairPage при сбое говорит «инструментов нет»");
});

test("кошелёк: Wallet Standard и мобильный deep-link в Phantom", () => {
  const wallet = read("src/lib/wallet.ts");
  assert.match(wallet, /navigator\.wallets/, "detectWallet обязан читать реестр Wallet Standard");
  assert.match(wallet, /standardProvider/, "стандартные кошельки оборачиваются провайдером");
  assert.match(wallet, /standard:connect/, "без standard:connect подключение не работает");
  assert.match(wallet, /solana:signMessage/, "без solana:signMessage не подписываются walletProof");
  assert.match(wallet, /solana:signAndSendTransaction/, "без solana:signAndSendTransaction не уходят транзакции");
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
