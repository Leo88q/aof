const fs = require('fs');
const text = fs.readFileSync(process.argv[2], 'utf8');
let jsonStr;

// Попытка 1: блок ```json ... ```
const m1 = text.match(/```json\s*\n?([\s\S]*?)\n?```/);
if (m1) {
  jsonStr = m1[1].trim();
  console.log('→ взят из ```json блока');
} else {
  // Попытка 2: первая { до последней }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || first > last) {
    console.log('❌ JSON не найден в ответе');
    process.exit(1);
  }
  jsonStr = text.slice(first, last + 1);
  console.log('→ взят из текста (первая { → последняя })');
}

// Валидация
let parsed;
try {
  parsed = JSON.parse(jsonStr);
} catch (e) {
  console.log('❌ JSON невалидный:', e.message);
  // Попробуем починить типичные артефакты: trailing commas, комментарии
  const fixed = jsonStr
    .replace(/\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
  try {
    parsed = JSON.parse(fixed);
    console.log('✓ починен автоматически (trailing commas/comments)');
  } catch (e2) {
    console.log('❌ не починился:', e2.message);
    console.log('Первые 500 символов:', jsonStr.slice(0, 500));
    process.exit(1);
  }
}

fs.writeFileSync(process.argv[3], JSON.stringify(parsed, null, 2));
console.log('✅ сохранён:', Object.keys(parsed).join(', '));
