require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const FENCE = '`'.repeat(3);

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'AOF Migration',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || 'stealth/ox-alpha';

function readContext(files) {
  return files.map(function (f) {
    const p = path.join(__dirname, f);
    if (fs.existsSync(p) === false) {
      return '# ===== FILE: ' + f + ' =====\n(не найден)\n';
    }
    return '# ===== FILE: ' + f + ' =====\n' + FENCE + '\n' + fs.readFileSync(p, 'utf8') + '\n' + FENCE + '\n';
  }).join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('node openrouter.js "вопрос" [файлы...]');
    return;
  }
  let reasoning = false;
  let saveFile = null;
  while (args.length > 0 && args[0].startsWith('--')) {
    const flag = args.shift();
    if (flag === '--reason') { reasoning = true; }
    else if (flag === '--save') { saveFile = args.shift(); }
  }
  let prompt = args[0];
  if (prompt && prompt.startsWith('@')) {
    prompt = fs.readFileSync(path.join(__dirname, prompt.slice(1)), 'utf8');
  }
  const files = args.slice(1);
  const system = files.length > 0
    ? 'Ты — ведущий разработчик проекта. Файлы проекта:\n\n' + readContext(files)
    : 'Ты — ведущий разработчик.';

  console.log('');
  console.log('🤖 Модель: ' + MODEL);
  console.log('🧠 Reasoning: ' + (reasoning ? 'ON' : 'OFF'));
  console.log('📁 Файлы: ' + (files.join(', ') || 'нет'));
  console.log('💾 Сохранить: ' + (saveFile || 'нет'));
  console.log('─'.repeat(60));

  const params = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
  if (reasoning) { params.reasoning = { enabled: true }; }

  const response = await client.chat.completions.create(params);
  const content = response.choices[0].message.content || '';

  console.log('\n📝 Ответ:\n');
  console.log(content);

  if (saveFile) {
    fs.writeFileSync(path.join(__dirname, saveFile), content);
    console.log('\n💾 Сохранено в ' + saveFile);
  }
  if (response.usage) { console.log('\n📊 Токены:', JSON.stringify(response.usage)); }
}

main().catch(function (e) {
  console.error('❌ Ошибка:', e.message);
  if (e.status === 401) { console.error('   → Проверь OPENROUTER_API_KEY'); }
  if (e.status === 402) { console.error('   → Кончились кредиты'); }
  if (e.status === 429) { console.error('   → Rate limit, подожди минуту'); }
});
