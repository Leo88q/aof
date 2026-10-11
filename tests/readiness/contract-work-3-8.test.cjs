/**
 * [§3.8] Фляги, обмен DATA→энергия и снятый «лук».
 *
 * Три механики из одного раздела плана, у которых разная судьба, и страж
 * держит вместе всё, что обязано совпадать, но лежит в пяти местах: инструкцию
 * aof-core, её IDL-запись, маршрут бэкенда, карту wallet-proof и словарь
 * объяснений игроку. Отдельно проверяется снятый предмет: у «лука» не должно
 * остаться ни маршрута, обещающего транзакцию, ни ожидания «инструкция
 * появится», потому что скинов в программе нет.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const idl = (name) => JSON.parse(read(`aof_backend/src/idl/${name}.json`));

test('aof-core: use_flask и exchange_data_energy объявлены, и IDL совпадает с программой', () => {
  const core = idl('aof_core');
  const byName = new Map(core.instructions.map((ix) => [ix.name, ix]));

  const exchange = byName.get('exchange_data_energy');
  assert.ok(exchange, 'exchange_data_energy отсутствует в IDL: обмен DATA на энергию не соберётся');
  assert.deepEqual(exchange.args, [{ name: 'data_amount', type: 'u64' }]);
  assert.deepEqual(exchange.accounts.map((a) => a.name), [
    'config', 'user', 'energy_account', 'data_mint', 'user_data', 'token_program', 'system_program',
  ]);
  assert.equal(exchange.accounts.find((a) => a.name === 'data_mint').writable, true,
    'сжигание уменьшает supply минта: минт обязан быть writable');
  assert.equal(exchange.accounts.find((a) => a.name === 'energy_account').writable, true);

  const flask = byName.get('use_flask');
  assert.ok(flask, 'use_flask отсутствует в IDL: применение фляг не соберётся');
  assert.deepEqual(flask.args, [{ name: 'flask_kind', type: 'u8' }]);
  assert.deepEqual(flask.accounts.map((a) => a.name), [
    'config', 'user', 'material_mints', 'energy_account', 'flask_mint', 'user_flask', 'token_program', 'system_program',
  ]);
  assert.equal(flask.accounts.find((a) => a.name === 'flask_mint').writable, true,
    'сжигание уменьшает supply минта: минт обязан быть writable');

  // TS-копия IDL — то, что реально загружает бэкенд; расхождение ловит
  // check-idl-drift.py, но здесь проверяем, что обе инструкции в неё попали.
  const ts = read('aof_backend/src/idl/aof_core.ts');
  assert.match(ts, /"name": "exchangeDataEnergy"/);
  assert.match(ts, /"name": "useFlask"/);
});

test('aof-core: границы обмена и лестница фляг заданы константами, а не конфигом', () => {
  const constants = read('aof-core/src/constants.rs');
  assert.match(constants, /pub const DATA_ATOMS_PER_ENERGY: u64 = RESOURCE_UNIT;/);
  assert.match(constants, /pub const FLASK_ENERGY_GAIN: \[u8; 5\] = \[5, 5, 8, 10, ENERGY_CAP\];/);
  assert.match(constants, /pub fn flask_kind_reward\(flask_kind: u8\) -> Option<\(crate::ResourceKind, u8\)>/,
    'тип фляги обязан отображаться на ресурс и награду одной функцией');

  const exchange = read('aof-core/src/instructions/exchange_data_energy.rs');
  assert.match(exchange, /data_amount % DATA_ATOMS_PER_ENERGY == 0/, 'дробная часть DATA сгорела бы без энергии');
  assert.match(exchange, /AofError::EnergyCapExceeded/, 'обмен не должен сжигать DATA, если энергия не влезет в бак');
  assert.ok(
    exchange.indexOf('token::burn') < exchange.indexOf('energy.current = energy'),
    'сжигание обязано идти до начисления: отказ CPI не должен давать энергию',
  );

  const flaskUse = read('aof-core/src/instructions/use_flask.rs');
  assert.match(flaskUse, /mint_for_kind\(&ctx\.accounts\.config, &ctx\.accounts\.material_mints, &kind\)/,
    'каноничность минта фляги обязана проверяться до сжигания');
  assert.match(flaskUse, /AofError::InvalidFlaskType/);
  assert.match(flaskUse, /AofError::EnergyCapExceeded/);

  const mod = read('aof-core/src/instructions/mod.rs');
  assert.match(mod, /pub mod use_flask;/);
  assert.match(mod, /pub mod exchange_data_energy;/);
});

test('бэкенд: маршруты собирают транзакцию и не отдают старые 503-заглушки', () => {
  const resources = read('aof_backend/src/routes/resources.ts');
  const tools = read('aof_backend/src/routes/tools.ts');

  assert.match(resources, /\.exchangeDataEnergy\(dataAmount/, 'маршрут не вызывает инструкцию обмена');
  assert.match(resources, /energyAccountPda\(user\)/, 'маршрут не прикладывает аккаунт энергии');
  assert.match(resources, /validateSingleCanonicalResourceMint\(connection, "DATA", dataMint\)/,
    'каноничность минта DATA обязана проверяться до сборки транзакции');
  assert.match(resources, /requireCircuitOpen, requireWalletLimits\("resources_exchange_energy"\)/,
    'маршрут обязан идти через тумблер и лимит кошелька');

  assert.match(tools, /\.useFlask\(flaskType\)/, 'маршрут не вызывает инструкцию применения фляги');
  assert.match(tools, /FLASK_KIND_BY_TYPE/, 'тип фляги обязан отображаться на канонический ресурс');
  assert.match(tools, /validateSingleCanonicalResourceMint\(connection, flaskKind, flaskMint\)/,
    'каноничность минта фляги обязана проверяться до сборки транзакции');
  assert.match(tools, /requireCircuitOpen, requireWalletLimits\("tools_use_flask"\)/,
    'маршрут обязан идти через тумблер и лимит кошелька');

  for (const [file, source] of [['resources.ts', resources], ['tools.ts', tools]]) {
    assert.ok(!source.includes('DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS'),
      `${file}: заглушка «инструкции нет» осталась, хотя инструкция объявлена`);
  }
});

test('лук снят навсегда: 410 вместо обещания инструкции, ни одного вызова bowReward', () => {
  const forge = read('aof_backend/src/routes/forge.ts');
  assert.match(forge, /res\.status\(410\)\.json\(\{ error: "BOW_REWARD_ROUTE_RETIRED_LEGACY_ITEM" \}\)/,
    'снятые маршруты обязаны отвечать 410 с объяснением, а не 503 «инструкции нет»');
  assert.ok(!forge.includes('bowRewardCommit') && !forge.includes('bowRewardReveal'),
    'маршруты не должны собирать транзакции по инструкциям, которых нет и не будет');

  // Комментарий «здесь был bowCommitPda» — это объяснение удаления, а не код:
  // строки комментариев из проверки исключаются.
  const codeOnly = (file) => read(file)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
  const corpus = [
    'aof_backend/src/lib/pda.ts',
    'aof_backend/src/security/walletProof.ts',
    'frontend/src/lib/api.ts',
    'aof_backend/src/routes/forge.ts',
  ].map(codeOnly).join('\n');
  for (const dead of ['bowCommitPda', 'skinPda', 'forge_bow_commit', 'forge_bow_reveal']) {
    assert.ok(!corpus.includes(dead), `${dead} остался в коде снятой механики`);
  }

  // IDL программы: инструкций для лука не должно быть и в ожиданиях IDL.
  const core = idl('aof_core');
  for (const missing of ['bow_reward_commit', 'bow_reward_reveal']) {
    assert.ok(!core.instructions.some((ix) => ix.name === missing),
      `${missing} не должен появляться в IDL: предмета нет`);
  }

  const copy = read('frontend/src/i18n/apiErrorCopy.ts');
  assert.match(copy, /BOW_REWARD_ROUTE_RETIRED_LEGACY_ITEM/,
    'игрок обязан увидеть человеческое объяснение снятой награды');
  for (const dead of ['BOW_REWARD_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS',
    'FLASK_USE_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS',
    'ENERGY_EXCHANGE_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS']) {
    assert.ok(!copy.includes(dead), `${dead} — мёртвый код: маршрут его больше не возвращает`);
  }
});

test('wallet-proof: оба живых маршрута защищены, снятые — убраны из карт', () => {
  const backend = read('aof_backend/src/security/walletProof.ts');
  const frontend = read('frontend/src/lib/api.ts');

  assert.match(backend, /\{ path: "\/tools\/use-flask", subject: "tools_use_flask", selector: "user" \}/,
    'новый маршрут без записи в MAPPED_MUTATIONS стал бы анонимной поверхностью записи');
  assert.match(frontend, /\{ path: "\/tools\/use-flask", subject: "tools_use_flask", field: "user" \}/,
    'клиент не сможет подписать proof для маршрута, которого нет в карте');
  assert.match(backend, /\/resources\/exchange-energy/);
  assert.match(frontend, /\/resources\/exchange-energy/);

  for (const [name, source] of [['walletProof.ts', backend], ['api.ts', frontend]]) {
    assert.ok(!/\/forge\/bow\//.test(source), `${name}: снятые маршруты не должны требовать proof`);
  }
});

test('документы: раздел §3.8 живёт в активном документе, а не в historical-плане', () => {
  const queue = read('docs/CONTRACT_WORK_QUEUE.md');
  assert.match(queue, /## §3\.8/, 'у очереди работ нет раздела §3.8');
  assert.match(queue, /use_flask/, 'в §3.8 не сказано про фляги');
  assert.match(queue, /exchange_data_energy/, 'в §3.8 не сказано про обмен DATA на энергию');
  assert.match(queue, /verify-programs\.sh/, 'в §3.8 нет проверки, доказывающей деплой');
  assert.match(queue, /BOW_REWARD_ROUTE_RETIRED_LEGACY_ITEM|лук/, 'в §3.8 не сказано про снятый лук');

  const probe = read('scripts/devnet-program-probe.py');
  assert.match(probe, /docs\/CONTRACT_WORK_QUEUE\.md §3\.8/);
  assert.ok(!probe.includes('UNBLOCK_PLAN_2026-09-30.md §3.8'),
    'зонд не должен ссылаться на раздел, которого нет в historical-документе');

  assert.equal(fs.existsSync(path.join(root, 'docs/UNBLOCK_PLAN_2026-09-30.md')), false,
    'устаревший план разблокировки удалён и не должен снова стать источником указаний');
});
