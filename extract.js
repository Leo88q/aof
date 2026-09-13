const fs = require('fs');
const FENCE = '`'.repeat(3);
const src = process.argv[2];
const dst = process.argv[3];
if (src === undefined || dst === undefined) {
  console.log('Использование: node extract.js response.md target.js');
  process.exit(1);
}
const content = fs.readFileSync(src, 'utf8');
const regex = new RegExp(FENCE + '(?:javascript|js)?\\n([\\s\\S]*?)' + FENCE, 'g');
const matches = Array.from(content.matchAll(regex));
if (matches.length === 0) {
  console.log('❌ Блок кода не найден в ответе');
  process.exit(1);
}
let best = matches[0][1];
for (const m of matches) {
  if (m[1].length > best.length) { best = m[1]; }
}
fs.writeFileSync(dst, best);
console.log('✅ Извлечено ' + best.length + ' символов → ' + dst);
