#!/usr/bin/env node
/**
 * Карта приборов для документации.
 *
 * Расположение приборов берётся из `src/gallery/deviceMap.ts`, а тексты —
 * из русского словаря витрины `/visual`. Скрипт собирает из них документ
 * чтобы документ не расходился с кодом: правишь таблицу в коде — обновляешь док.
 *
 * Запуск: npm run map:devices
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEVICE_MAP } from "../src/gallery/deviceMap.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const repo = join(root, "..");

const gallery = readFileSync(join(root, "src/gallery/VisualGallery.tsx"), "utf8");
const entries = DEVICE_MAP;

const instruments = entries.filter((e) => e.key !== "frame");

const slides = [...gallery.matchAll(/id: "([a-z]+-\d{2})",\s*\n\s*group: "([^"]+)"/g)].map((m) => ({
  id: m[1],
  group: m[2],
}));

const groups = [];
for (const slide of slides) {
  const last = groups[groups.length - 1];
  if (last && last.name === slide.group) last.count += 1;
  else groups.push({ name: slide.group, count: 1 });
}

// Gallery groups use stable IDs. Russian documentation labels come from the
// canonical device map, not from the grouping keys used by every UI locale.
const groupTitle = (key) => key === "behavior"
  ? "Поведение окон"
  : entries.find((entry) => entry.key === key)?.name ?? key;

const today = new Date().toISOString().slice(0, 10);

const doc = `# Карта приборов: где какой аппарат стоит в игре

Составлено ${today}. Расположение приборов — \`frontend/src/gallery/deviceMap.ts\`,
русские названия и описания — \`frontend/src/i18n/galleryCopy.ts\`. Из того же
словаря берётся текст витрины \`/visual\`. Пересборка: \`npm run map:devices\`
из папки \`frontend\`.

## Почему появился этот документ

Владелец 2026-09-28: «непонятно, где используются новые панели, я их увидел только
в лаборатории». Причина была не в удалении приборов, а в двух вещах:

1. приборы стояли в суб-вкладках (экономика → обзор, участок → колодец, задания → задания);
2. часть приборов рисовалась только при подключённом кошельке и непустых данных.

Теперь у каждого аппарата есть постоянное место, а пустые состояния подписаны
словами («—», «нет связи», «подключи кошелёк»), поэтому прибор видно и до входа
в игру с кошельком.

## Приборы К4–К11

| Прибор | Вкладка | Суб-вкладка | Что показывает | Файл |
| --- | --- | --- | --- | --- |
${instruments.map((e) => `| ${e.name} | ${e.tab} | ${e.sub} | ${e.purpose} | \`${e.file}\` |`).join("\n")}

## Каркас окна

| Элемент | Где | Что это | Файл |
| --- | --- | --- | --- |
| Три уровня окна | все экраны | крупное окно прибора, рабочее окно, тихая подпись | \`${entries[0]?.file ?? "src/ui/forge/kit.tsx"}\` |
| Этикетка прибора | все приборные окна | номер ставится только за реальными данными | \`src/ui/forge/kit.tsx\` |
| Считыватели | все приборные окна | значение, пояснение, прочерк вместо нуля | \`src/ui/forge/kit.tsx\` |
| Лампы состояния | стойки, письма, кошельки | горят только от реального источника данных | \`src/ui/forge/kit.tsx\` |

## Витрина приборов

Экран \`/visual\` (ссылка — Профиль → Служебное → «Палитра приборов») показывает
каждый аппарат живым кодом и говорит, где он стоит в игре. Всего слайдов:
${slides.length}.

${groups.map((g) => `- ${groupTitle(g.name)} — ${g.count}`).join("\n")}

На слайдах с пометкой «демо-значения» числа показательные: они нужны, чтобы
объяснить шкалу. В игре таких чисел нет — там либо значение из сети, либо «—».
`;

writeFileSync(join(repo, "docs/UI_DEVICE_MAP_2026-09-28.md"), doc, "utf8");
console.log(`docs/UI_DEVICE_MAP_2026-09-28.md: приборов ${instruments.length}, слайдов ${slides.length}`);
