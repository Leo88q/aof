'use strict';
/*
 * Ответ на сводку атак июня–сентября 2026 (пункты #94–#130):
 * SECURITY_CHECKLIST_ATTACKS_2026-09-28.md.
 *
 * Здесь только то, что можно держать статически на каждом коммите, офлайн, без
 * ноды и без сети: реестр программ/апстримов/ключей, кворум RPC в подписи,
 * наборы для инцидента и домена, гигиена рабочего окружения и навыков агентов,
 * нулевые суммы и предохранители. Поведенческие доказательства — в host-тестах
 * (`cargo test --workspace --lib`) и backend self-test'ах (CI).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const run = (script, args = []) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8' });
const walk = (dir, exts, out = []) => {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const name of fs.readdirSync(abs)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const p = path.join(abs, name);
    if (fs.statSync(p).isDirectory()) walk(path.relative(ROOT, p), exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(path.relative(ROOT, p));
  }
  return out;
};
const rustSources = () => [
  ...walk('aof-core/src', ['.rs']).filter((f) => !/test/.test(f)),
  ...walk('programs', ['.rs']).filter((f) => !/test/.test(f)),
];
const readJsonc = (rel) => JSON.parse(read(rel).replace(/^\s*\/\/.*$/gm, ''));

// ======================================================================
// AB. Устаревшие программы, ключи и секреты (#98–#101)
// ======================================================================

test('#98/#116/#128 реестр программ, апстримов и ключей сходится с кодом', () => {
  const r = run('scripts/security/program-registry.mjs', ['--check']);
  assert.equal(r.status, 0, `program-registry --check провален:\n${r.stdout}${r.stderr}`);
  const registry = JSON.parse(read('security/program-registry.json'));
  const names = new Set(registry.programs.map((p) => p.name));
  for (const must of ['aof_core', 'aof_market', 'aof_quests', 'aof_rebirth', 'aof_liquidity', 'aof_session_keys']) {
    assert.ok(names.has(must), `${must} должен быть в реестре программ`);
  }
  for (const retired of registry.retired) {
    assert.equal(retired.drained, true, `retired ${retired.name} обязан быть drained (#98)`);
    assert.ok(retired.evidence && retired.successor, `retired ${retired.name}: нужны evidence и successor`);
  }
  // Депрекейт обязан быть выполнен, а не «помечен»: проверка встроена в скрипт,
  // но и здесь фиксируем наличие в реестре хотя бы одного ожидаемого поля.
  for (const p of registry.programs.filter((p) => p.status === 'active' && p.valueBearing)) {
    assert.ok(p.upgradeAuthorityPlan, `${p.name}: активная ценная программа без плана по upgrade authority`);
  }
  assert.ok(read('Anchor.toml').includes('HtJg3R3Ki938QeSD98djwMgWESboDVEykuyKGtvRamEq'), 'канонический program id должен остаться в Anchor.toml');
});

test('#98/#116 апстрим-дозор: пиннинг, advisory-источники, еженедельный workflow', () => {
  const r = run('scripts/security/upstream-watch.mjs', ['--check']);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  const deps = JSON.parse(read('security/upstream-dependencies.json')).dependencies;
  assert.ok(deps.length >= 8, 'в апстрим-реестре должно быть не меньше восьми зависимостей');
  assert.ok(deps.some((d) => d.id === 'switchboard-on-demand'), 'VRF-оракул обязан быть в апстрим-реестре');
  const workflow = read('.github/workflows/upstream-watch.yml');
  assert.match(workflow, /schedule:/, 'апстрим обязан проверяться по расписанию (#128)');
  assert.match(workflow, /upstream-watch\.mjs --online/);
  assert.match(workflow, /issues: write/, 'находка должна превращаться в issue, а не теряться в логах');
  assert.match(read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md'), /сначала приватно|приватной ветке/i, 'порядок «фикс → деплой → публикация» должен быть записан (#128)');
});

test('#101/#126 инвентарь ключей: роли, ротация, происхождение, никаких значений', () => {
  const inventory = JSON.parse(read('security/key-inventory.json'));
  const ids = inventory.roles.map((r) => r.id);
  for (const must of ['authority', 'guardian', 'admin_multisig', 'vrf_settler', 'multisig_signers']) {
    assert.ok(ids.includes(must), `роль ${must} должна быть в инвентаре ключей`);
  }
  for (const role of inventory.roles) {
    assert.ok(role.storage && role.rotation && role.compromiseAction, `роль ${role.id}: нужны storage/rotation/compromiseAction`);
  }
  const provenance = inventory.roles.filter((r) => r.provenanceRequired).map((r) => r.id);
  for (const must of ['authority', 'multisig_signers', 'guardian']) {
    assert.ok(provenance.includes(must), `${must}: происхождение ключа (устройство/прошивка/дата) обязательно (#126)`);
  }
  // Значений секретов в файле быть не может.
  assert.doesNotMatch(read('security/key-inventory.json'), /"[1-9A-HJ-NP-Za-km-z]{64,88}"|[0-9a-fA-F]{64,}/, 'в инвентаре не должно быть похожего на секрет материала');
  // Политика KMS: отдельный аккаунт/проект, алерты на Sign, отсутствие долгоживущих ключей.
  const treasuryPolicy = read('docs/TREASURY_AND_SIGNER_POLICY.md');
  for (const anchor of [/Отдельный аккаунт\/проект под подпись/, /Алерты на необычные `Sign`/, /Инвариант в контракте/]) {
    assert.match(treasuryPolicy, anchor, `политика KMS (#101) должна описывать: ${anchor}`);
  }
});

test('#99 генерация ключей — только CSPRNG/аппаратный кошелёк, без самописных генераторов', () => {
  const scripts = [
    ...walk('scripts', ['.sh', '.mjs', '.js']),
    ...walk('aof_backend/scripts', ['.ts', '.js']),
    ...walk('src/os', ['.js']),
  ];
  const offenders = [];
  for (const file of scripts) {
    const src = read(file);
    if (!/(keypair|secretKey|Keypair|solana-keygen|authority.*key)/i.test(src)) continue;
    if (/Math\.random\(\)/.test(src) && /keypair|Keypair|secretKey/i.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `генерация ключей не может опираться на Math.random (#99): ${offenders.join(', ')}`);
  assert.match(read('docs/TREASURY_AND_SIGNER_POLICY.md'), /solana-keygen/, 'политика должна фиксировать инструмент генерации');
  // Гайд по devnet-ключу в runbook тоже обязан использовать solana-keygen.
  assert.match(read('docs/SECURITY_RUNBOOK.md'), /solana-keygen new/, 'ключи создаются solana-keygen, а не «чем получилось»');
});

test('#100 секреты в публичном репозитории: полная история, pre-commit, public-output gate', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /fetch-depth: 0/, 'gitleaks обязан сканировать всю историю, а не верхний коммит');
  assert.match(ci, /gitleaks\/gitleaks-action/, 'gitleaks обязан быть в CI');
  assert.match(ci, /GITLEAKS_CONFIG: \.gitleaks\.toml/);
  assert.match(read('.pre-commit-config.yaml'), /gitleaks/, 'pre-commit hook обязателен для каждого клона');
  for (const pattern of ['id.json', 'keypair*.json', '.env']) {
    assert.ok(read('.gitignore').includes(pattern), `.gitignore обязан содержать ${pattern}`);
  }
  assert.ok(read('.gitleaks.toml').includes('solana-keypair-array') || read('.gitleaks.toml').includes('base58-private-key-assignment'), 'нужны правила под Solana-ключи');
  assert.match(read('docs/INCIDENT_RESPONSE_15_MIN.md'), /ротаци/i, 'после утечки — немедленная ротация, а не «удалим из истории»');
});

// ======================================================================
// AC. Верификаторы и источники данных для подписанта (#102–#103)
// ======================================================================

test('#102/#103 кворум независимых RPC для решений, ведущих к подписи', () => {
  const module = read('aof_backend/src/lib/rpcQuorum.ts');
  assert.match(module, /commitment = "finalized"/, 'подписывающие чтения — только по finalized');
  assert.match(module, /finalized/, 'commitment finalized должен быть зашит');
  assert.match(module, /минимум `minAgreement` независимых хостов|minAgreement/, 'решение принимается по согласию хостов');
  assert.match(module, /RPC_QUORUM_URLS/, 'адреса кворума задаются только конфигурацией');
  assert.match(module, /RpcQuorumError[\s\S]{0,200}status = 503|status = 503/, 'расхождение = 503, а не «выберем первого»');
  assert.match(module, /одном хосте/, 'два endpoint одного провайдера не считаются независимостью');
  assert.match(module, /NODE_ENV === "production"/, 'в production без кворума подпись не читает состояние (fail-closed)');
  const decode = read('aof_backend/src/lib/decode.ts');
  assert.match(decode, /export async function fetchOneForSigner/, 'должен существовать отдельный путь чтения для подписи');
  for (const caller of ['aof_backend/src/lib/miningPayout.ts', 'aof_backend/src/routes/inbox.ts', 'aof_backend/src/routes/admin.ts']) {
    assert.match(read(caller), /fetchOneForSigner/, `${caller}: путь выплаты/минта обязан читать через кворум (#103)`);
  }
  assert.match(read('aof_backend/.env.example'), /RPC_QUORUM_URLS/, 'переменная кворума обязана быть в примере окружения');
  // Мониторинг — не тот же канал, что подписант: правило записано в политике казны.
  assert.match(read('docs/TREASURY_AND_SIGNER_POLICY.md'), /другом канале|другого канала/, 'мониторинг должен читать из другого канала, чем подписант');
});

test('#103 самопроверка кворума: согласие, расхождение, деградация, fail-closed', () => {
  const selfTest = read('aof_backend/scripts/rpcQuorumSelfTest.ts');
  for (const anchor of ['не достигнут', 'fail-closed', 'finalized', 'одном хосте']) {
    assert.ok(selfTest.includes(anchor), `self-test кворума обязан проверять: ${anchor}`);
  }
  assert.match(read('aof_backend/package.json'), /test:rpc-quorum/, 'self-test обязан запускаться в CI');
  assert.match(read('.github/workflows/ci.yml'), /test:rpc-quorum/, 'CI обязан прогонять self-test кворума');
});

// ======================================================================
// AD. Фронтенд и устройства игроков (#104–#105)
// ======================================================================

test('#104 строгий CSP, никаких сторонних скриптов, отдельный origin подписи', () => {
  const headers = read('frontend/public/_headers');
  for (const anchor of [
    /script-src 'self'/,
    /script-src-attr 'none'/,
    /object-src 'none'/,
    /frame-ancestors 'none'/,
    /frame-src 'none'/,
    /default-src 'self'/,
    /Cross-Origin-Opener-Policy: same-origin/,
    /X-Permitted-Cross-Domain-Policies: none/,
  ]) {
    assert.match(headers, anchor, `_headers обязан содержать ${anchor}`);
  }
  assert.doesNotMatch(headers.split('\n').find((l) => l.includes('Content-Security-Policy:')) || '', /unsafe-eval/, 'unsafe-eval в боевом CSP недопустим');
  const html = read('frontend/index.html');
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i, 'сторонние скрипты на страницах с кошельком запрещены (#104)');
  assert.doesNotMatch(html, /googleapis|gstatic|cdn\./i, 'никаких внешних CDN');
  const guard = read('frontend/src/lib/txGuard.ts');
  for (const anchor of ['Approve', 'SetAuthority', 'Switchboard may only be invoked by the game program', 'addressTableLookups', 'AOF_PROGRAMS']) {
    assert.ok(guard.includes(anchor), `txGuard обязан помнить про ${anchor} (#114)`);
  }
});

test('#105/#124/#125 localized safety rules warn about fake support, devices and coercion', () => {
  const rules = read('frontend/src/i18n/siteRulesCopy.ts');
  for (const id of ["id: 'support'", "id: 'devices'", "id: 'coercion'", "id: 'keys'"]) {
    assert.ok(rules.includes(id), `missing rule ${id}`);
  }
  assert.match(rules, /самозваной поддержки|fake support/i);
  assert.match(rules, /аппаратное устройство|hardware device/i);
  assert.match(rules, /принуждают|coerced/i);
  assert.match(read('frontend/src/legal/WalletSafetyNotice.tsx'), /walletCopy\[language\]/,
    'wallet warning must use the localized seed phrase notice');
  assert.match(read('frontend/src/i18n/walletCopy.ts'), /Никогда не вводите seed-фразу или приватный ключ/);
});

// ======================================================================
// AE. Команда и рабочее окружение (#106–#107)
// ======================================================================

test('#106 VS Code: workspace trust включён, автозапуск задач выключен, чужой код — в песочнице', () => {
  const settings = readJsonc('.vscode/settings.json');
  assert.equal(settings['task.autoDetect'], 'off', 'задачи не должны запускаться при открытии папки (WaterPlum #106)');
  assert.equal(settings['security.workspace.trust.enabled'], true, 'Workspace Trust обязателен');
  assert.equal(settings['npm.autoDetect'], 'off');
  const devcontainer = readJsonc('.devcontainer/devcontainer.json');
  assert.deepEqual(devcontainer.mounts, [], 'в песочницу нельзя монтировать хостовые каталоги с ключами');
  assert.equal(devcontainer.containerEnv.AUTHORITY_MODE, 'read-only', 'в песочнице подпись запрещена');
  assert.equal(devcontainer.containerEnv.NPM_CONFIG_IGNORE_SCRIPTS, 'true', 'install-скрипты пакетов в песочнице не исполняем (#107)');
  assert.match(read('docs/OPSEC_AND_DEV_ENVIRONMENT.md'), /одноразовой VM|песочниц/i, 'политика «чужой код — только в VM» должна быть записана');
  assert.match(read('docs/OPSEC_AND_DEV_ENVIRONMENT.md'), /видеозвонок/i, 'предупреждение про фейковых рекрутеров (#106)');
});

test('#107 снабжение: точные версии, allowlist расширений, проверка навыков агентов', () => {
  for (const rc of ['.npmrc', 'aof_backend/.npmrc', 'frontend/.npmrc']) {
    assert.match(read(rc), /save-exact=true/, `${rc}: новые зависимости фиксируются точной версией`);
  }
  const extensions = readJsonc('.vscode/extensions.json');
  assert.ok(extensions.recommendations.length > 0, 'allowlist рекомендованных расширений должен существовать');
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /npm ci/, 'установка зависимостей — только по lock-файлу');
  assert.match(read('docs/OPSEC_AND_DEV_ENVIRONMENT.md'), /ignore-scripts/, 'политика install-скриптов должна быть записана');
  assert.match(read('docs/OPSEC_AND_DEV_ENVIRONMENT.md'), /ChainDrop|JetBrains/, 'контекст атак на снабжение (#107)');
});

test('#130 навыки и плагины ИИ-агентов: опасные инструкции, пиннинг, песочница', () => {
  const r = run('scripts/security/check-agent-skills.mjs');
  assert.equal(r.status, 0, `check-agent-skills провален:\n${r.stdout}${r.stderr}`);
  const lock = JSON.parse(read('security/agent-config.lock.json'));
  const skills = Object.keys(lock.files).filter((f) => f.includes('/skills/'));
  assert.ok(skills.length >= 2, 'внутренние навыки .claude/skills/** должны быть запинованы по SHA-256 (#130)');
  assert.ok(read('security/agent-skills.allow.json').includes('"allow"'), 'исключения навыков живут в security/agent-skills.allow.json');
  const policy = read('docs/AI_AGENT_SECURITY_POLICY.md');
  assert.match(policy, /341–386|341-386/, 'политика должна описывать инцидент с реестром навыков (#130)');
  assert.match(policy, /без сети/i, 'внешние навыки/MCP — только в песочнице без сети');
});

// ======================================================================
// AF/AG. Боты, делегирование, предохранители и крайние значения (#108–#113)
// ======================================================================

test('#108/#109 боты и делегированные права: allowlist, лимиты, отзыв, никаких подписей от чужого имени', () => {
  const session = read('programs/aof-session-keys/src/lib.rs');
  for (const anchor of ['target_program', 'allowed_ixs', 'max_amount_per_tx', 'FORBIDDEN_IXS_MASK', 'revoked', 'valid_until']) {
    assert.ok(session.includes(anchor), `сессионный ключ обязан ограничивать ${anchor} (#109)`);
  }
  assert.match(session, /AtomicBindingRequired|Session spending is disabled/, 'спенд сессий выключен до атомарной привязки к инструкции');
  const trader = read('aof_backend/services/farm-trader/executor.ts');
  assert.ok(!/sendTransaction|signTransaction/.test(trader), 'бот farm-trader не подписывает транзакции (#108)');
  assert.match(read('docs/AI_AGENT_SECURITY_POLICY.md'), /Отдельный кошелёк|отдельный кошелёк/, 'у бота с кошельком — отдельный кошелёк и лимиты (#108)');
});

test('#110 предохранители проверяются состязательно и описаны для инцидента', () => {
  const hostTests = read('aof-core/src/security_checklist_tests.rs');
  for (const anchor of ['exits_stay_open_while_the_game_is_paused', 'emergency(', 'refuses_freezable_nfts']) {
    assert.ok(hostTests.includes(anchor), `нужен host-тест/каркас ${anchor} (#110)`);
  }
  const kit = read('docs/INCIDENT_KIT.md');
  for (const anchor of [/Предавторизованная пауза/, /SEAL 911/, /Safe harbor/, /НЕ КАСАЕТСЯ|Не переводить средства/]) {
    assert.match(kit, anchor, `набор инцидента должен содержать ${anchor} (#113)`);
  }
  assert.match(kit, /volo|Volo/, 'нужен ориентир по времени заморозки (Volo: 30 минут)');
  assert.match(read('frontend/scripts/legal-release.mjs'), /securityEmail/, 'security.txt выпускается только с реальным контактом');
  assert.match(read('docs/DOMAIN_AND_DNS_SECURITY.md'), /Registry Lock|Transfer Lock/i, 'домен: блокировки регистратора (#119)');
});

test('#111 нулевые и пылевые значения: guard-ы на путях ценности и идемпотентность клеймов', () => {
  // Каждый путь, двигающий ценность, обязан отклонять нулевую/некорректную
  // сумму до вызова SPL. Матрица 0/1/max/dust в host-тестах — следующий шаг
  // (см. SECURITY_CHECKLIST_ATTACKS_2026-09-28.md §«Следующие шаги»).
  const valuePaths = [
    'burn_resource', 'mint_resource', 'deposit_gas', 'craft_order', 'marketplace', 'offer',
    'orderbook', 'collect_mining', 'collect_bread', 'collect_flour', 'collect_well_water',
    'lottery', 'pay_out', 'withdraw_gas', 'exploration',
    // #111-хвост: sweep — единственный путь, двигающий lamports, и он же
    // раньше не имел явного guard-а на нулевую сумму.
    'sweep_gas_fees',
  ];
  const noGuard = [];
  for (const name of valuePaths) {
    const file = `aof-core/src/instructions/${name}.rs`;
    if (!exists(file)) continue;
    if (!/ZeroAmount|amount > 0|amount == 0|lamports > 0|micros > 0|hours > 0|output > 0|price_lamports > 0/.test(read(file))) {
      noGuard.push(name);
    }
  }
  assert.deepEqual(noGuard, [], `пути без guard-а на нулевую сумму (#111): ${noGuard.join(', ')}`);
  let zeroGuards = 0;
  for (const file of rustSources()) {
    const src = read(file);
    if (/ZeroAmount/.test(src)) zeroGuards += 1;
  }
  assert.ok(zeroGuards >= 15, `ZeroAmount-проверок должно быть много (сейчас ${zeroGuards}) — нулевые суммы не должны доходить до SPL (#111)`);
  assert.match(read('aof-core/src/errors.rs'), /ZeroAmount/, 'ошибка ZeroAmount обязана существовать');

  // #111-хвост: нулевой sweep не должен доходить до перевода lamports, а
  // резерв обязан удерживать логический баланс, пыль и ренту.
  const sweep = read('aof-core/src/instructions/sweep_gas_fees.rs')
    .replace(/\/\/[^\n]*/g, '')            // построчные комментарии
    .replace(/\/\*[\s\S]*?\*\//g, ''); // блочные комментарии
  assert.match(sweep, /require!\(excess > 0, AofError::ZeroAmount\)/,
    'у sweep_gas_fees нет явного guard-а на нулевую сумму (#111)');
  assert.match(sweep, /balance_micros[\s\S]{0,120}MICROS_TO_LAMPORTS/,
    'резерв sweep обязан считать логический баланс по MICROS_TO_LAMPORTS');
  assert.match(sweep, /dust_lamports/, 'резерв sweep обязан удерживать пыль пользователя');
  assert.match(sweep, /minimum_balance\(GASTANK_SPACE\)/, 'резерв sweep обязан удерживать ренту');
  assert.match(sweep, /transfer_owned_lamports\(/, 'sweep обязан двигать lamports напрямую, а не через System Program');
  const receipt = read('aof-core/src/instructions/mint_resource_once.rs');
  assert.match(receipt, /RewardReceipt|reward_receipt/, 'claim награды обязан быть идемпотентным через receipt/reward_id (#111)');
  assert.match(read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md'), /границах|fuzz/i, 'крайние значения обязаны гоняться на границах (fuzz на форке) (#117)');
});

test('#112 заражение через наш токен: потолки предложения и лимиты на любой минт', () => {
  const payOut = read('aof-core/src/instructions/pay_out.rs');
  assert.match(payOut, /vault_guard|VaultGuard/, 'каждая выдача проходит через VaultGuard (#112)');
  const caps = fs.existsSync(path.join(ROOT, 'aof-core/src/instructions/issuance_cap.rs'))
    ? read('aof-core/src/instructions/issuance_cap.rs')
    : '';
  assert.match(caps, /IssuanceCap|issuance_cap/, 'IssuanceCap обязан существовать');
  assert.match(read('aof-core/src/instructions/mint_resource.rs'), /max_supply|MaxSupply|supply/, 'минт ограничен supply');
  assert.match(read('aof_backend/src/security/mintValidator.ts'), /MINT_NOT_ALLOWED/, 'незнакомый минт отвергается (#97/#112)');
});

// ======================================================================
// AH. Solana-специфика 2026 (#114–#122)
// ======================================================================

test('#114 произвольный внешний вызов: CPI только к allowlist, пользовательские program id не исполняются', () => {
  // CPI-инструкция всегда строится локально (конструктор *_instruction) и
  // адресуется константному program id; инструкция/программа, пришедшая
  // параметром от вызывающего, в invoke не попадает.
  for (const file of rustSources()) {
    const src = read(file);
    assert.doesNotMatch(src, /Instruction\s*\{\s*program_id:\s*[a-z_][a-zA-Z_0-9]*\.key\(\)/, `${file}: program_id CPI не может приходить из аккаунта вызывающего (#114)`);
    for (const call of src.matchAll(/invoke(?:_signed)?\(/g)) {
      const around = src.slice(Math.max(0, call.index - 2400), call.index + 900);
      assert.match(
        around,
        /_instruction\(|spl_token::instruction|token_instruction|system_instruction|TOKEN_PROGRAM_ID|SWITCHBOARD_PROGRAM_ID/,
        `${file}: CPI без локально построенной инструкции/пиннинга program id (#114)`,
      );
    }
  }
  const guard = read('frontend/src/lib/txGuard.ts');
  assert.match(guard, /AOF_PROGRAMS/, 'allowlist программ обязателен на клиенте');
  assert.match(guard, /Only idempotent ATA creation is permitted/);
  assert.match(read('SECURITY_CHECKLIST_ATTACKS_2026-09-28.md'), /Approve/, 'документ обязан зафиксировать отказ от бессрочных Approve (#114)');
});

test('#115 переполнение: overflow-checks в release и checked-арифметика', () => {
  assert.match(read('Cargo.toml'), /\[profile\.release\]\s*\noverflow-checks = true/, 'release-профиль обязан включать overflow-checks (#115)');
  let checked = 0;
  for (const file of rustSources()) checked += (read(file).match(/checked_(add|sub|mul|div|pow)\b/g) || []).length;
  assert.ok(checked >= 50, `checked_*-арифметики должно быть много (сейчас ${checked}) (#115)`);
});

test('#116/#129 версия общей программы и «зачистка класса»: форки и выведенные компоненты под контролем', () => {
  const ci = read('.github/workflows/aof-readiness.yml');
  assert.match(ci, /sync-quests-vrf\.py --check/, 'копия vrf.rs в aof-quests обязана сверяться с источником (#116)');
  const registry = JSON.parse(read('security/program-registry.json'));
  assert.ok(registry.retired.length >= 2, 'реестр должен помнить выведенные компоненты (Ronin, farm-trader live)');
  assert.match(read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md'), /Зачистка класса|зачистка класса/i, 'процедура «зачистки класса» после инцидента (#129)');
  assert.match(read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md'), /drained/i, 'депрекейт без drain должен считаться находкой');
});

test('#117/#118 цена и оракул: конфигурация проверяется до выката, последняя сделка не определяет ценность', () => {
  const doc = read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md');
  for (const anchor of [/на форке состояния основной сети/, /fuzz на границах/, /стартовая пауза/]) {
    assert.match(doc, anchor, `изменение конфигурации цены: ${anchor} (#117)`);
  }
  const rustAll = rustSources().map((f) => read(f)).join('\n');
  assert.doesNotMatch(rustAll, /pyth|chainlink|reflector|price_oracle|band_oracle/i, 'внешних ценовых оракулов быть не должно: единственный оракул — Switchboard для случайности (#118)');
  const market = fs.existsSync(path.join(ROOT, 'aof_backend/src/lib/marketData.ts')) ? read('aof_backend/src/lib/marketData.ts') : '';
  assert.doesNotMatch(market, /collateral|залог/i, 'цены графиков не должны использоваться как залог/оценка (#95/#118)');
});

test('#119–#122 казна, подписанты и аллокации: письменная политика и мониторы', () => {
  const policy = read('docs/TREASURY_AND_SIGNER_POLICY.md');
  for (const anchor of [
    /3-из-5/,
    /разные устройства, разные ОС, разные вендоры/i,
    /time lock/i,
    /vesting/i,
    /DeactivateStake/,
    /duress|Дурес|давление/i,
    /Step Finance/,
    /Fogo/,
    /Dominion Market/,
  ]) {
    assert.match(policy, anchor, `политика казны обязана покрывать: ${anchor} (#120–#122, #125)`);
  }
  assert.match(read('docs/SECURITY_RUNBOOK.md'), /Squads/, 'runbook обязан описывать Squads-процедуру');
});

// ======================================================================
// AI/AJ. Люди, контрагенты, инфраструктура и цепочка поставок (#123–#127)
// ======================================================================

test('#123/#124/#125/#126 OPSEC: контрагенты, поддержка, принуждение, происхождение ключей', () => {
  const doc = read('docs/OPSEC_AND_DEV_ENVIRONMENT.md');
  for (const anchor of [
    /OTC|эскроу/i,
    /независимому каналу/i,
    /не пишет первой/i,
    /duress|принуждени/i,
    /WaterPlum|Contagious Interview/,
    /DarkSword/,
  ]) {
    assert.match(doc, anchor, `OPSEC-документ обязан покрывать: ${anchor}`);
  }
  assert.match(read('docs/TREASURY_AND_SIGNER_POLICY.md'), /Coldcard/, 'история Coldcard должна быть в политике ключей (#126)');
});

test('#127 решение о выводе принимает независимый модуль, а не инициатор в том же бэкенде', () => {
  const middleware = read('aof_backend/src/middleware/security.ts');
  assert.match(middleware, /checkWalletLimits/, 'лимиты проверяются отдельным модулем (#127)');
  const limits = read('aof_backend/src/security/walletLimits.ts');
  assert.match(limits, /wallet: walletAddress/, 'лимит считается по кошельку (агрегат по всем путям), а не по маршруту (#127)');
  assert.match(limits, /SERIALIZABLE/, 'решение о лимите должно быть атомарным (SERIALIZABLE)');
  const tx = read('aof_backend/src/lib/tx.ts');
  assert.match(tx, /simulateTransaction/, 'перед отправкой — независимая симуляция (#127)');
  assert.match(read('docs/TREASURY_AND_SIGNER_POLICY.md'), /скорость/i, 'нужен монитор скорости выводов (#127)');
  assert.match(read('docs/TREASURY_AND_SIGNER_POLICY.md'), /Bitget/, 'контекст Bitget: 15 переводов за 20 минут (#127)');
});

// ======================================================================
// AA. Governance и цена (#94–#97) — правила на случай появления
// ======================================================================

test('#94 в репозитории нет захватываемого голосования, и правила на будущее записаны', () => {
  const doc = read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md') + read('SECURITY_CHECKLIST_ATTACKS_2026-09-28.md');
  for (const anchor of [/снимок голосов/i, /voting delay/i, /кворум/i, /create-vote-execute/i]) {
    assert.match(doc, anchor, `правила DAO-захвата должны быть записаны на будущее: ${anchor} (#94)`);
  }
  // В коде не должно быть исполнения предложения в той же транзакции, что и голосование.
  for (const file of rustSources()) {
    assert.doesNotMatch(read(file), /create_proposal[\s\S]{0,200}execute_proposal/, `${file}: create/execute в одной инструкции (#94)`);
  }
});

test('#95/#96/#97 оценка токена не берётся из спот-цены тонкого пула; неизвестный минт не имеет цены', () => {
  const doc = read('SECURITY_CHECKLIST_ATTACKS_2026-09-28.md');
  for (const anchor of [/Tectonic/, /глубин[а-яё]* ликвидности/i, /TWAP/]) {
    assert.match(doc, anchor, `правило против pump-and-borrow: ${anchor} (#95)`);
  }
  const validator = read('aof_backend/src/security/mintValidator.ts');
  assert.match(validator, /assertMintAllowed/, 'любая работа с минтом начинается с allowlist (#97)');
  assert.match(read('docs/UPSTREAM_AND_PROGRAM_LIFECYCLE.md'), /таймлок|time lock/i, 'новый листинг — через таймлок и период остывания (#97)');
});

// ======================================================================
// Инструменты этого прохода
// ======================================================================

test('инструменты #94–#130 запускаются и в CI readiness', () => {
  const readiness = read('.github/workflows/aof-readiness.yml');
  for (const script of ['program-registry.mjs', 'check-agent-skills.mjs']) {
    assert.ok(readiness.includes(script), `readiness workflow обязан запускать ${script}`);
  }
  const makefile = read('Makefile');
  for (const target of ['registry-check', 'agent-skills']) {
    assert.ok(makefile.includes(target), `Makefile обязан иметь цель ${target}`);
  }
});
