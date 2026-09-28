import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredText = ['operatorName', 'operatorAddress', 'operatorCountry', 'registrationDetails', 'governingLaw', 'retentionPolicy', 'transferSafeguards', 'privacyRepresentative'];
export function validateOperator(config) {
  const errors = [];
  if (config.approved !== true) errors.push('Legal documents must be reviewed and approved by the operator.');
  for (const field of requiredText) {
    if (typeof config[field] !== 'string' || !config[field].trim() || /TODO|TBD|не указано|заполнить/i.test(config[field])) errors.push(`Missing or unfinished field: ${field}`);
  }
  for (const field of ['contactEmail', 'privacyEmail', 'securityEmail']) {
    if (typeof config[field] !== 'string' || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(config[field]) || /@(example\.(com|org|net)|.*\.(invalid|test|example))$/i.test(config[field])) errors.push(`A verified, real email is required: ${field}`);
  }
  try {
    const url = new URL(config.canonicalOrigin);
    if (url.protocol !== 'https:' || url.origin !== config.canonicalOrigin || url.username || url.password || /(^|\.)(localhost|example\.(com|org|net))$|\.(invalid|test|example)$/.test(url.hostname)) throw new Error();
  } catch { errors.push('canonicalOrigin must be the verified public HTTPS origin, without trailing slash/path.'); }
  for (const field of ['audienceCountries', 'processors']) {
    if (!Array.isArray(config[field]) || config[field].length === 0 || config[field].some(v => typeof v !== 'string' || !v.trim())) errors.push(`Non-empty reviewed list required: ${field}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(config.version || '') || !/^\d{4}-\d{2}-\d{2}$/.test(config.date || '')) errors.push('Document date/version required.');
  return errors;
}
export function securityText(config, now = new Date()) {
  if (validateOperator(config).length) throw new Error('Invalid operator configuration');
  const expires = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
  return `Contact: mailto:${config.securityEmail}\nExpires: ${expires}\nPreferred-Languages: ru, en\nCanonical: ${config.canonicalOrigin}/.well-known/security.txt\nPolicy: ${config.canonicalOrigin}/legal/disclosure\n`;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'src/legal/operator.json'), 'utf8'));
  const errors = validateOperator(config);
  if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
  else if (process.argv.includes('--emit-security')) {
    if (!fs.existsSync(path.join(root, 'dist/index.html'))) throw new Error('Build output is missing');
    fs.mkdirSync(path.join(root, 'dist/.well-known'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist/.well-known/security.txt'), securityText(config));
    const sitemapPath = path.join(root, 'dist/sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      const xml = fs.readFileSync(sitemapPath, 'utf8').replaceAll('http://localhost:3000', config.canonicalOrigin);
      fs.writeFileSync(sitemapPath, xml);
    }
    fs.writeFileSync(path.join(root, 'dist/robots.txt'), `User-agent: *\nAllow: /site/\nSitemap: ${config.canonicalOrigin}/sitemap.xml\n`);
    console.log('security.txt generated. Verify headers and contact delivery on the deployed domain.');
  } else console.log('Legal configuration gate passed; this is not a legal opinion or contact-delivery test.');
}
