/**
 * Собирает public/sitemap.xml из фактического контента сайта.
 *
 * Origin в файле — плейсхолдер dev-сервера: в `build:release` такая карта исключается из вывода; отдельная команда
 * `node scripts/legal-release.mjs --emit-security` заменяет origin лишь после проверки реквизитов
 * на проверенный canonicalOrigin из src/legal/operator.json (см. docs/LEGAL_AND_PRIVACY_OPERATIONS.md).
 * Так в индексацию не может уехать ни один маршрут, которого нет в дереве страниц.
 *
 * Запуск: npm run sitemap:build
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pages } from '../src/site/content/pages';
import { resources } from '../src/site/content/resources';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER_ORIGIN = 'http://localhost:3000';

const pageRoutes = pages.map((p) => (p.id === 'home' ? '/site' : `/site/${p.id}`));
const routes = [...pageRoutes, '/site/resources', ...resources.map((r) => `/site/resources/${r.slug}`)];

const body = routes.map((path) => `  <url><loc>${PLACEHOLDER_ORIGIN}${path}</loc></url>`).join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(resolve(ROOT, 'public/sitemap.xml'), xml, 'utf8');
console.log(`sitemap: ${routes.length} маршрутов (страниц ${pageRoutes.length}, ресурсов ${resources.length + 1})`);
