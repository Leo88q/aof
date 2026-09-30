#!/usr/bin/env node
/**
 * Один фон для арта: инструменты, ресурсы и всё, что лежит в public/assets/nfts.
 *
 * Жалоба владельца 2026-09-28: «у нфт разные цвета фонов». Картины рисовались
 * партиями, и подложка у них разная — почти чёрная, синяя, фиолетовая. На одной
 * полке каталога это читается как разные по качеству предметы.
 *
 * Жалоба 2026-09-30: «в инструментах и в ресурсах разные фоны по оттенку». Плашки
 * ресурсов лежали во вложенной папке, а скрипт читал только верхний уровень:
 * инструменты стояли на тёмно-синей подложке (7,14,30), ресурсы — на почти
 * чёрной (2,9,20). Теперь обход рекурсивный, и обе полки меряются одной меркой.
 *
 * Скрипт приводит подложку каждой картины к цвету плитки интерфейса
 * (`--fg-deep`, #0D1013) уровнями по каждому каналу:
 *
 *     out = T + (in − B) · (255 − T) / (255 − B)
 *
 * где B — медиана рамки картины (её фон), T — цвет плитки. Тон и свет предмета
 * сохраняются, меняется только уровень фона. Геометрия не трогается, ничего не
 * дорисовывается: это выравнивание уровня, а не новая графика.
 *
 * Запуск:
 *   node scripts/normalize-art-backgrounds.mjs --check   # только отчёт (код 1, если фон разный)
 *   node scripts/normalize-art-backgrounds.mjs --write   # выровнять и записать
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";

const here = dirname(fileURLToPath(import.meta.url));
const ART_DIR = join(here, "../public/assets/nfts");
/** Полки арта: карточки инструментов с ресурсами и витрина капсул дропа. */
export const ART_DIRS = [ART_DIR, join(here, "../public/assets/packs")];

/** Все картины полки: инструменты в корне, ресурсы во вложенной папке,
 *  капсулы дропа — на второй полке. Жалоба 2026-09-30: обход не заходил в
 *  public/assets/packs, и витрина дропа жила с чужим оттенком фона. */
export function artFiles(dir = ART_DIR, prefix = "") {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...artFiles(join(dir, entry.name), rel));
    else if (entry.name.endsWith(".jpg")) files.push(rel);
  }
  return files.sort();
}
/** Цвет плитки интерфейса: с ним обязан совпадать фон картины. */
export const TILE = { r: 0x0d, g: 0x10, b: 0x13 };
/** Допуск: столько живёт шум сжатия.
 *  Было 10: при таком зазоре подложка с синим уклоном (+10 по синему) считалась
 *  «нормой» и в каталоге читалась другим оттенком — жалоба 2026-09-30. */
export const TOLERANCE = 6;

export function decode(file) {
  const raw = jpeg.decode(readFileSync(file), { useTArray: true, maxMemoryUsageInMB: 512 });
  return { width: raw.width, height: raw.height, data: raw.data };
}

/** Медиана цвета рамки: фон картины по краям, а не по центру. */
export function borderColor(img, frame = 0.04) {
  const { width, height, data } = img;
  const mx = Math.max(2, Math.round(width * frame));
  const my = Math.max(2, Math.round(height * frame));
  const channels = [[], [], []];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x < mx || y < my || x >= width - mx || y >= height - my;
      if (!edge) continue;
      const i = (y * width + x) * 4;
      channels[0].push(data[i]);
      channels[1].push(data[i + 1]);
      channels[2].push(data[i + 2]);
    }
  }
  return channels.map((list) => {
    list.sort((a, b) => a - b);
    return list[Math.floor(list.length / 2)];
  });
}

/** Уровни: фон B уходит в T, белое остаётся белым. */
export function levelToTile(img, bg, target = TILE) {
  const channel = (inValue, from, to) => {
    const span = 255 - from;
    if (span < 24) return inValue; // фон почти белый — трогать нечего
    const k = (255 - to) / span;
    const out = to + (inValue - from) * k;
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  const map = [
    (v) => channel(v, bg[0], target.r),
    (v) => channel(v, bg[1], target.g),
    (v) => channel(v, bg[2], target.b),
  ];
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = map[0](img.data[i]);
    out[i + 1] = map[1](img.data[i + 1]);
    out[i + 2] = map[2](img.data[i + 2]);
  }
  return { width: img.width, height: img.height, data: out };
}

const distance = (bg) =>
  Math.max(Math.abs(bg[0] - TILE.r), Math.abs(bg[1] - TILE.g), Math.abs(bg[2] - TILE.b));

function main() {
  const write = process.argv.includes("--write");
  const rows = [];
  const offenders = [];
  const counts = { nfts: 0, packs: 0 };

  for (const dir of ART_DIRS) {
    const shelf = dir.endsWith("/packs") ? "packs" : "nfts";
    for (const name of artFiles(dir)) {
      const file = join(dir, name);
      const img = decode(file);
      const before = borderColor(img);
      const off = distance(before);
      let after = before;
      if (off > TOLERANCE && write) {
        const fixed = levelToTile(img, before);
        const encoded = jpeg.encode({ data: fixed.data, width: fixed.width, height: fixed.height }, 92);
        writeFileSync(file, encoded.data);
        after = borderColor(decode(file));
        if (distance(after) > TOLERANCE) offenders.push(`${name}: фон остался ${after.join(",")}`);
      } else if (off > TOLERANCE) {
        offenders.push(`${name}: фон ${before.join(",")} (нужно ${[TILE.r, TILE.g, TILE.b].join(",")})`);
      }
      counts[shelf] += 1;
      rows.push(`${`${shelf}/${name}`.padEnd(42)} ${before.join(",").padEnd(14)} → ${after.join(",").padEnd(14)} ${off <= TOLERANCE ? "норма" : "выровнено"}`);
    }
  }

  console.log(rows.join("\n"));
  const tools = artFiles().filter((f) => !f.includes("/")).length;
  const resources = counts.nfts - tools;
  console.log(`\nкартин: ${counts.nfts + counts.packs} (инструменты: ${tools}, ресурсы: ${resources}, капсулы дропа: ${counts.packs}), выравнивание ${write ? "записано" : "не записывалось"}`);
  if (offenders.length) {
    console.log(`фон отличается от плитки у ${offenders.length} картин:`);
    console.log(offenders.map((o) => `  ${o}`).join("\n"));
    if (!write) process.exitCode = 1;
  } else {
    console.log("фон у всех картин один — совпадает с плиткой интерфейса");
  }
}

if (process.argv[1] && process.argv[1].endsWith("normalize-art-backgrounds.mjs")) main();
