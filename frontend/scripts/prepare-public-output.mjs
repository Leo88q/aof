import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const sitemap = path.join(dist, 'sitemap.xml');
// The checked-in sitemap uses a local development origin. Without a verified
// canonical origin, do not ship URLs that point visitors or crawlers to localhost.
if (fs.existsSync(sitemap) && fs.readFileSync(sitemap, 'utf8').includes('http://localhost:3000')) {
  fs.unlinkSync(sitemap);
  console.log('Omitted development-origin sitemap; add a verified origin before publishing a sitemap.');
}
