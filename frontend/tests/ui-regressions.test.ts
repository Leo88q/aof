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
