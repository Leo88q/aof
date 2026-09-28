import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredText = ['operatorName', 'operatorAddress', 'operatorCountry', 'registrationDetails', 'governingLaw', 'retentionPolicy', 'transferSafeguards', 'privacyRepresentative'];
// [OWNER] Что именно должен дать владелец, зачем это нужно и где значение
// появится после заполнения. Плейсхолдеры и «примерные» значения запрещены:
// реквизиты оператора — публичное заявление о себе, а не описание интерфейса.
export const OPERATOR_FIELDS = [
  { field: 'approved', requirement: 'Подтверждение владельца после юридической проверки текстов.', where: 'build:release gate' },
  { field: 'operatorName', requirement: 'Юрлицо или ФИО оператора (полное, как в реестре).', where: '/legal/contacts, /legal/terms' },
  { field: 'operatorAddress', requirement: 'Почтовый адрес для обращений и претензий.', where: '/legal/contacts' },
  { field: 'operatorCountry', requirement: 'Страна регистрации оператора.', where: '/legal/contacts, /legal/terms' },
  { field: 'registrationDetails', requirement: 'Регистрационный номер/ИНН или правомерное обоснование неприменимости.', where: '/legal/terms' },
  { field: 'contactEmail', requirement: 'Рабочий адрес поддержки и претензий (проверить доставку).', where: 'футер, /legal/contacts' },
  { field: 'privacyEmail', requirement: 'Рабочий адрес для запросов о персональных данных (DSAR).', where: '/legal/privacy, /legal/data-requests' },
  { field: 'securityEmail', requirement: 'Рабочий адрес для сообщений об уязвимостях.', where: 'security.txt, /legal/disclosure, INCIDENT_KIT' },
  { field: 'canonicalOrigin', requirement: 'Официальный HTTPS origin без завершающего «/».', where: 'sitemap, robots, security.txt, canonical-ссылки' },
  { field: 'governingLaw', requirement: 'Применимое право и порядок разрешения споров.', where: '/legal/terms' },
  { field: 'audienceCountries', requirement: 'Страны аудитории, под которые проверены тексты.', where: '/legal/terms, /legal/risks' },
  { field: 'processors', requirement: 'Фактические процессоры: юрлицо, цель, страна.', where: 'таблица в /legal/privacy' },
  { field: 'retentionPolicy', requirement: 'Конкретные сроки хранения по каждой цели.', where: '/legal/privacy, /legal/cookies' },
  { field: 'transferSafeguards', requirement: 'Механизмы международной передачи данных.', where: '/legal/privacy' },
  { field: 'privacyRepresentative', requirement: 'DPO/представитель либо обоснование неприменимости.', where: '/legal/privacy' },
];

// Что осталось заполнить — машинно, из того же валидатора, что держит релиз.
export function operatorTodo(config) {
  const errors = validateOperator(config);
  return OPERATOR_FIELDS.filter((spec) => {
    const field = config[spec.field];
    const filled = Array.isArray(field) ? field.length > 0 : typeof field === 'string' ? field.trim() !== '' : field === true;
    if (!filled) return true;
    return errors.some((error) => error.toLowerCase().includes(spec.field.toLowerCase()));
  });
}

function reportTodo(config) {
  const todo = operatorTodo(config);
  if (todo.length === 0) {
    console.log('operator.json заполнен: релизный гейт пройден, значений-заглушек нет.');
    return;
  }
  console.log(`operator.json: не хватает ${todo.length} из ${OPERATOR_FIELDS.length} пунктов. Отправьте владельцу/юристу этот список — вымышленные значения не подставляются.`);
  for (const [index, spec] of todo.entries()) {
    console.log(`${String(index + 1).padStart(2, ' ')}. ${spec.field}`);
    console.log(`    нужно: ${spec.requirement}`);
    console.log(`    появится в: ${spec.where}`);
  }
}

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
  if (process.argv.includes('--report')) reportTodo(config);
  else if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
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
