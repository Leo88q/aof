import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

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
  const lab = read("src/components/farm/LabHero.tsx");
  assert.match(lab, /unavailable \? "—"/, "стойка образцов показывает нули при 503");
  const overview = read("src/pages/economy/ResourceOverview.tsx");
  assert.match(overview, /Балансы ресурсов недоступны из сети/,
    "обзор ресурсов обязан честно сообщать о недоступности вместо нулей");
  assert.match(overview, /Читаем балансы из сети/,
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
  for (const label of ['"⏸️ Сбор отключён', '"⏸️ Добыча отключена до проверки в сети"', '"↩️ Вернуть']) {
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
  assert.match(dash, /Не удалось прочитать инструменты из сети/,
    "карта участка обязана объяснять недоступность, а не молчать");
  const plot = read("src/pages/farm/FarmPlot.tsx");
  assert.match(plot, /setTools\(null\)/, "ошибка myTools не должна давать пустой массив");
  assert.match(plot, /tools === null \? \(toolsFailed \? "—" : "…"\)/,
    "сводка «Построек на участке» должна показывать —/… вместо 0");
  const home = read("src/pages/tools/ToolsHome.tsx");
  assert.match(home, /Инструменты недоступны из сети/,
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
  assert.match(read("src/pages/economy/ResourceOverview.tsx"), /Все позиции пусты — полос нет/, "гель обязан говорить о пустом складе словами");
  assert.match(read("src/pages/inbox/InboxHome.tsx"), /Ящик пуст — кордов нет/, "кросс-панель обязана говорить о пустом ящике словами");
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
  assert.match(quests, /<PunchedCard[\s\S]{0,400}questSteps\(0\)/, "перфокарта К10 обязана стоять без данных");

  const market = read("src/pages/market/MarketHome.tsx");
  assert.match(market, /<SonarPPI/, "эхолот рынка обязан стоять на входе, а не только в витрине");

  const dash = read("src/pages/farm/FarmDashboard.tsx");
  assert.match(dash, /emptyPlateWells/, "планшет К7 обязан показывать пустые лунки без инструментов");
});

test("инструментальная палитра описывает все 8 аппаратов и 50 слайдов", () => {
  // Владелец 2026-09-28: «непонятно, где используются новые панели». Палитра
  // `/visual` — витрина приборов на живом коде плюс карта «прибор → вкладка».
  const gallery = read("src/gallery/VisualGallery.tsx");
  const ids = gallery.match(/\bid: "[a-z]+-\d{2}"/g) || [];
  assert.equal(ids.length, 50, `в палитре должно быть 50 слайдов, найдено ${ids.length}`);
  assert.match(gallery, /vg-demo/, "слайды с показательными числами обязаны быть помечены");
  assert.match(gallery, /Прибор|Где в игре/, "слайд обязан говорить, где прибор стоит в игре");

  const map = read("src/gallery/deviceMap.ts");
  const entries = map.split("{\n    key:").slice(1);
  assert.equal(entries.length, 9, "в карте приборов должно быть 8 аппаратов К4–К11 и каркас окна");
  for (const entry of entries) {
    assert.match(entry, /file: "/, "у прибора обязан быть файл-источник");
    assert.match(entry, /purpose: "/, "у прибора обязано быть описание");
  }
  for (const file of map.match(/src\/[\w/.]+\.tsx?/g) || []) {
    for (const path of file.split(", ")) {
      assert.ok(existsSync(join(root, path.trim())), `карта приборов ссылается на удалённый файл: ${path}`);
    }
  }
  assert.match(read("src/main.tsx"), /path="\/visual"/, "витрина приборов должна открываться по /visual");
});

test("состояния статусов берут цвета из палитры A, а не из молчаливых классов", () => {
  // Разметка звала text-gold-400, bg-ember-500 и text-water-400 — таких ступеней
  // в палитре не было, и статусные окна рендерились нейтральными.
  const cfg = read("tailwind.config.js");
  for (const step of ["gold", "ember"]) {
    assert.match(cfg, new RegExp(`${step}: \\{[^}]*DEFAULT: "#`), `${step}: нужна ступенчатая палитра с DEFAULT`);
  }
  assert.match(cfg, /water: \{ 400: "#/, "water-400 вызывается из разметки и обязан существовать");
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
    for (const m of text.matchAll(/\b(?:text|bg|border|from|to|via)-(gold|ember|water|sprout|wheat|soil|nf)-([a-z0-9]+)\b/g)) {
      const token = m[0];
      const family = m[1];
      const step = m[2];
      const allowed =
        family === "gold" || family === "ember"
          ? ["300", "400", "500", "600", "700", "900", "DEFAULT"].includes(step)
          : family === "water"
            ? ["400", "500", "600"].includes(step)
            : family === "sprout"
              ? ["500", "600", "700"].includes(step)
              : true;
      if (!allowed) missing.push(`${file}: ${token}`);
    }
  }
  assert.deepEqual(missing, [], `разметка зовёт цвета, которых нет в палитре:\n${missing.join("\n")}`);
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
  assert.ok(files.length >= 14, "контент сайта пропал из дерева");
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
    for (const call of text.matchAll(/(?:flash|flashMsg|toast\.show)\s*\(/g)) {
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
  assert.match(page, /Состояние дня недоступно/, "без данных сети календарь обязан честно сказать об этом");
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

test("фляги не обещают эффектов, которых нет в сети", () => {
  // Дефект 2026-09-28: каталог фляг обещал «+20% добыча на 1ч», «+100 газа»,
  // «×2 скорость» и «+50% Forge». Применения фляг в aof-core нет вовсе.
  const page = code("src/pages/market/FlaskMarketplace.tsx");
  assert.ok(!/\+20%|\+50%|×2|на 1ч|газа/.test(page), "выдуманные эффекты фляг вернулись");
  assert.ok(!/\{flask\.icon\}/.test(page), "иконка фляги снова печатается текстом");
  assert.match(page, /ResourceGlyph/, "значок фляги рисуется приборной плашкой");
  assert.match(page, /применение в сети не объявлено/, "игроку нужно сказать, почему каталог без эффектов");
  assert.match(page, /Цены нет/, "цена фляги не выдумывается");
});

test("в книге рецептов нет служебных формулировок и выдуманных ресурсов", () => {
  const text = read("src/site/content/recipes.ts");
  for (const word of ["Редакционное описание", "Продуктовое описание", "провизи", "не подтверждён"]) {
    assert.ok(!text.includes(word), `в описаниях рецептов вернулась служебная формулировка: ${word}`);
  }
  // Гостевой рецепт выпускает данные — их и называем, а не «провизию».
  assert.match(text, /дают пять единиц данных/, "выход гостевого рецепта назван предметно");
});

test("книга рецептов сайта совпадает с таблицей сети", async () => {
  // Дефект 2026-09-28: рецепты сайта были написаны «по мотивам» и расходились с
  // aof-core (сепарация 5→3 вместо 6+1→3, фляги из кварца вместо гемов и данных).
  // Сетевые рецепты сверяются с исходником Rust, редакционные помечены значком.
  const { recipes } = await import("../src/site/content/recipes");
  const rust = readFileSync(join(root, "..", "aof-core/src/instructions/craft_recipe.rs"), "utf8");

  const MINT_TO_SITE: Record<string, string> = {
    gem_blue: "quantumBit", gem_orange: "neuralChip", gem_white: "photonBit", gem_green: "bioChip",
    stone_blue: "blueCore", stone_red: "redCore", stone_purple: "purpleCore",
    sand_white: "clearQuartz", sand_pink: "roseQuartz", sand_yellow: "amberQuartz",
    flask_blue: "cryoFluid", flask_yellow: "voltFluid", flask_green: "bioFluid",
    flask_pink: "nanoFluid", flask_purple: "quantumFluid",
    seeds: "neuron", wheat: "synapse", flour: "signal", bread: "model",
    water: "power", coal: "compute",
  };

  // craft_recipe.rs: разбираем блоки «N => { ... }» и пары вход/выход.
  const verified = recipes.filter((r: { verification?: string }) => r.verification === "on-chain-verified");
  assert.ok(verified.length >= 7, "сверенных с сетью рецептов стало меньше");

  const byOutput = new Map<string, { inputs: Array<[string, number]>; output: [string, number] }>();
  for (const block of rust.split(/\n {8}\/\/ \d+ =/).slice(1)) {
    const id = Number(block.match(/^\s*(\d+) =>/)?.[1]);
    if (Number.isNaN(id)) continue;
    const mintOf = (n: number) => block.match(new RegExp(`input_${n}_mint\\.key\\(\\) == (?:mm|cfg)\\.([a-z_]+)`))?.[1];
    const amountOf = (n: number) => Number(block.match(new RegExp(`input_${n}_acc, (\\d+) \\* RESOURCE_UNIT`))?.[1]);
    const outMint = block.match(/mint_out!\([^,]+, [^,]+, (\d+) \* RESOURCE_UNIT, ResourceKind::(\w+)\)/);
    if (!mintOf(1) || !amountOf(1) || !outMint) continue;
    const kindToSite: Record<string, string> = {
      QuantumBit: "quantumBit", NeuralChip: "neuralChip", PhotonBit: "photonBit", BioChip: "bioChip",
      CryoFluid: "cryoFluid", VoltFluid: "voltFluid", BioFluid: "bioFluid",
      NanoFluid: "nanoFluid", QuantumFluid: "quantumFluid",
    };
    const inputs: Array<[string, number]> = [[MINT_TO_SITE[mintOf(1)] ?? mintOf(1)!, amountOf(1)]];
    if (mintOf(2) && amountOf(2)) inputs.push([MINT_TO_SITE[mintOf(2)] ?? mintOf(2)!, amountOf(2)]);
    byOutput.set(kindToSite[outMint[2]], { inputs, output: [kindToSite[outMint[2]], Number(outMint[1])] });
  }

  const mismatches: string[] = [];
  for (const recipe of verified) {
    const outId = recipe.outputs[0]?.resourceId;
    const chain = byOutput.get(outId);
    if (!chain) continue; // сепарация и обучение проверяются ниже по своим инструкциям
    const siteInputs = [...recipe.inputs].map((i: { resourceId: string; amount: number }) => `${i.resourceId}×${i.amount}`).sort().join(", ");
    const chainInputs = chain.inputs.map(([id, amount]) => `${id}×${amount}`).sort().join(", ");
    if (siteInputs !== chainInputs) mismatches.push(`${recipe.name}: сайт ${siteInputs} ≠ сеть ${chainInputs}`);
    if ((recipe.outputs[0]?.amount ?? 0) !== chain.output[1]) {
      mismatches.push(`${recipe.name}: выход ${recipe.outputs[0]?.amount} ≠ ${chain.output[1]}`);
    }
  }
  assert.deepEqual(mismatches, [], `книга рецептов разошлась с таблицей сети:\n${mismatches.join("\n")}`);

  // Партии сепарации и обучения: малые значения из start_milling/start_baking.
  const mill = readFileSync(join(root, "..", "aof-core/src/instructions/start_milling.rs"), "utf8");
  const milleSmall = mill.match(/MILL_WHEAT_COST: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT, (\d+) \* RESOURCE_UNIT/);
  const millOut = mill.match(/MILL_FLOUR_OUT: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT/);
  const millRecipe = recipes.find((r: { id: string }) => r.id === "mill_flour")!;
  assert.equal(millRecipe.inputs[0].amount, Number(milleSmall?.[1]), "малая партия сепарации не совпала с сетью");
  const millStone = mill.match(/MILL_STONE_COST: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT/);
  assert.equal(millRecipe.inputs[1].amount, Number(millStone?.[1]), "сепарация: кремний не совпал с сетью");
  assert.equal(millRecipe.outputs[0].amount, Number(millOut?.[1]), "выход сепарации не совпал с сетью");
  assert.equal(millRecipe.energy, 2, "сепарация стоит 2 единицы энергии: столько списывает сеть");

  const bake = readFileSync(join(root, "..", "aof-core/src/instructions/start_baking.rs"), "utf8");
  const ovenFlour = bake.match(/OVEN_FLOUR_COST: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT/);
  const ovenCoal = bake.match(/OVEN_COAL_COST: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT/);
  const ovenBread = bake.match(/OVEN_BREAD_COAL: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT/);
  const bakeRecipe = recipes.find((r: { id: string }) => r.id === "bake_bread")!;
  assert.equal(bakeRecipe.inputs[0].amount, Number(ovenFlour?.[1]), "обучение модели: сигнал не совпал с сетью");
  const ovenWater = bake.match(/OVEN_WATER_COST: \[u64; 3\] = \[(\d+) \* RESOURCE_UNIT/);
  assert.equal(bakeRecipe.inputs[1].amount, Number(ovenWater?.[1]), "обучение модели: энергопоток не совпал с сетью");
  assert.equal(bakeRecipe.inputs[2].amount, Number(ovenCoal?.[1]), "обучение модели: топливо не совпало с сетью");
  assert.equal(bakeRecipe.outputs[0].amount, Number(ovenBread?.[1]), "обучение модели: выход не совпал с сетью");
  assert.equal(bakeRecipe.energy, 2, "обучение стоит 2 единицы энергии: столько списывает сеть");
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

test("привилегии пропуска собираются из ответа сети, а не из макета", () => {
  // Дефект 2026-09-28: карточка Premium обещала «XP-бустеры» и «умную покупку 24/7»,
  // которых нет ни в /season/:user, ни в aof-core, и печатала имена полей аккаунта.
  const page = code("src/pages/profile/SeasonPassPage.tsx");
  assert.match(page, /useVipStatus/, "список привилегий обязан читаться из сети");
  assert.match(page, /vipPrivileges/, "значения привилегий берутся из ответа сети");
  assert.ok(!/XP-бустер|умная покупка/.test(page), "выдуманные привилегии вернулись в карточку");
  assert.match(page, /PASS_FIELDS/, "поля прогресса эпохи подписываются словарём, а не ключами сети");
  const labels = page.match(/PASS_FIELDS: Record<string, string> = \{([\s\S]*?)\};/)?.[1] ?? "";
  for (const word of ["Эпоха", "Ступень", "Опыт", "Premium-ветка"]) {
    assert.ok(labels.includes(word), `в словаре подписей нет «${word}»`);
  }

  // Сервис не должен обещать с пропуском механик, которых нет в цепи.
  const backend = readFileSync(join(root, "..", "aof_backend/src/routes/vipStatus.ts"), "utf8");
  assert.match(backend, /energyCapPlanned/, "расширенный запас энергии обязан быть помечен планом");
  assert.match(backend, /energyRegenMinutesPlanned/, "ускоренный возврат энергии обязан быть помечен планом");
  assert.ok(!/energyCap: isVip \? 30/.test(backend), "сервис снова выдаёт план за действующую привилегию");
});
