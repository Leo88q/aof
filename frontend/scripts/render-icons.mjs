/**
 * Иконки приложения собираются из одного источника: public/favicon.svg.
 *
 * Знак NeuroForge — манометр лаборатории. Раньше PNG-иконки (PWA, apple-touch)
 * остались от старого логотипа с мозгом и сетью узлов, поэтому браузер и телефон
 * показывали другой бренд. Скрипт перерисовывает весь набор из SVG и складывает
 * favicon.ico как контейнер с PNG (формат, который понимают все браузеры).
 *
 * Запуск: npm run icons:render
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(ROOT, 'public/favicon.svg'));

const targets = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['android-chrome-192x192.png', 192],
  ['android-chrome-512x512.png', 512],
];

const rendered = new Map();
for (const [file, size] of targets) {
  const png = await sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' }).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(resolve(ROOT, 'public', file), png);
  rendered.set(size, png);
  console.log(`icons: ${file} ← ${size}px`);
}

// favicon.ico = заголовок + каталог + PNG-кадры (16/32/48)
function ico(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = 6 + frames.length * 16;
  const directory = [];
  for (const [size, png] of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    directory.push(entry);
  }
  return Buffer.concat([header, ...directory, ...frames.map(([, png]) => png)]);
}

const frame48 = await sharp(svg, { density: 384 }).resize(48, 48, { fit: 'contain' }).png().toBuffer();
writeFileSync(resolve(ROOT, 'public/favicon.ico'), ico([[16, rendered.get(16)], [32, rendered.get(32)], [48, frame48]]));
console.log('icons: favicon.ico ← 16/32/48px');
