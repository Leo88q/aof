'use strict';
/*
 * Инвентарь инструкций (scripts/instruction-inventory.mjs): гейт обязан ловить появление инструкции, про
 * которую никто не решил, зачем она нужна, и ложные утверждения в классификации.
 *
 * «Новую инструкцию» здесь создаём по-настоящему, но НЕ в репозитории: на временной копии кладём `pub fn`
 * в `#[program]` aof_core и запись в IDL — ровно как это сделал бы разработчик — и требуем, чтобы
 * `--check` упал с именем инструкции. Так тест не может «пройти» только потому, что проверка выключена.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(root, 'scripts/instruction-inventory.mjs');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function run(args, cwd = root) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/** Минимальная копия репозитория, достаточная для инвентаря. */
function makeRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-inventory-'));
  const copy = (rel) => {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) return;
    fs.cpSync(from, path.join(tmp, rel), { recursive: true, filter: (src) => !/node_modules|\/target(\/|$)/.test(src) });
  };
  for (const rel of ['watchtower/addresses.json', 'aof_backend/src/idl', 'security/instruction-roles.json', 'aof-core/src', 'programs']) copy(rel);
  fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
  // в копии — только то, что нужно: без IDL-дубликатов `.ts`
  for (const f of fs.readdirSync(path.join(tmp, 'aof_backend/src/idl'))) if (!f.endsWith('.json')) fs.rmSync(path.join(tmp, 'aof_backend/src/idl', f));
  return tmp;
}
const edit = (tmp, rel, fn) => { const p = path.join(tmp, rel); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); };
const editJson = (tmp, rel, fn) => edit(tmp, rel, (text) => `${JSON.stringify(fn(JSON.parse(text)), null, 2)}\n`);
const withRoot = (fn) => { const tmp = makeRoot(); try { return fn(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('репозиторий проходит гейт: 170 инструкций, все классифицированы, файлы свежие', () => {
  const result = run(['--check']);
  assert.equal(result.code, 0, result.out);
  assert.match(result.out, /170 инструкций, все классифицированы/);
});

test('счётчики по программам совпадают с IDL, а у каждой инструкции есть обработчик', () => {
  const inventory = JSON.parse(read('docs/INSTRUCTION_INVENTORY.json'));
  const expected = { aof_core: 122, aof_market: 12, aof_quests: 19, aof_rebirth: 5, aof_liquidity: 6, aof_session_keys: 6 };
  for (const [name, count] of Object.entries(expected)) {
    assert.equal(JSON.parse(read(`aof_backend/src/idl/${name}.json`)).instructions.length, count, `IDL ${name}`);
    assert.equal(inventory.programs[name].instructions, count, `инвентарь ${name}`);
  }
  assert.equal(inventory.totals.instructions, 170);
  for (const ix of inventory.instructions) {
    assert.ok(ix.handler.file, `${ix.program}.${ix.name}: не найден обработчик (${ix.handler.path})`);
    assert.ok(ix.role && ix.status && ix.note, `${ix.program}.${ix.name}: нет классификации`);
  }
});

test('новая инструкция без классификации роняет гейт и называется по имени', () => {
  withRoot((tmp) => {
    assert.equal(run(['--write', '--root', tmp]).code, 0);
    assert.equal(run(['--check', '--root', tmp]).code, 0, 'копия без изменений должна проходить');
    // как это делает разработчик: pub fn в #[program] и запись в IDL
    edit(tmp, 'aof-core/src/lib.rs', (src) => src.replace('pub fn set_fees(', 'pub fn brand_new_instruction(ctx: Context<SetFees>) -> Result<()> {\n        Ok(())\n    }\n\n    pub fn set_fees('));
    editJson(tmp, 'aof_backend/src/idl/aof_core.json', (idl) => {
      idl.instructions.push({ name: 'brand_new_instruction', discriminator: [1, 2, 3, 4, 5, 6, 7, 8], accounts: [], args: [] });
      return idl;
    });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /aof_core\.brand_new_instruction: инструкция есть в IDL, но не классифицирована/);
  });
});

test('IDL и #[program] не должны расходиться ни в одну сторону', () => {
  withRoot((tmp) => {
    editJson(tmp, 'aof_backend/src/idl/aof_market.json', (idl) => { idl.instructions.push({ name: 'only_in_idl', accounts: [], args: [] }); return idl; });
    let result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /aof_market: инструкция only_in_idl есть в IDL, но нет pub fn в #\[program\]/);
  });
  withRoot((tmp) => {
    edit(tmp, 'programs/aof-rebirth/src/lib.rs', (src) => src.replace('pub fn do_rebirth(', 'pub fn only_in_rust(ctx: Context<DoRebirth>) -> Result<()> {\n        Ok(())\n    }\n\n    pub fn do_rebirth('));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /aof_rebirth: pub fn only_in_rust есть в #\[program\], но нет в IDL/);
  });
});

test('запись о несуществующей инструкции, неизвестная роль/статус и пустая заметка — ошибки', () => {
  const cases = [
    [(roles) => { roles.programs.aof_core.ghost_instruction = { role: 'gameplay', status: 'active', note: 'призрак без инструкции' }; }, /запись aof_core\.ghost_instruction устарела/],
    [(roles) => { roles.programs.aof_core.set_fees.role = 'important'; }, /aof_core\.set_fees: неизвестная роль 'important'/],
    [(roles) => { roles.programs.aof_core.set_fees.status = 'maybe'; }, /aof_core\.set_fees: неизвестный статус 'maybe'/],
    [(roles) => { roles.programs.aof_core.set_fees.note = ''; }, /aof_core\.set_fees: нужна осмысленная заметка/],
    [(roles) => { roles.programs.aof_ghost = {}; }, /программа 'aof_ghost' не из реестра/],
  ];
  for (const [mutate, pattern] of cases) {
    withRoot((tmp) => {
      editJson(tmp, 'security/instruction-roles.json', (roles) => { mutate(roles); return roles; });
      const result = run(['--check', '--root', tmp]);
      assert.equal(result.code, 1, `ожидался отказ для ${pattern}`);
      assert.match(result.out, pattern);
    });
  }
});

test('статус в классификации обязан совпадать с кодом: отключённое не может быть «active» и наоборот', () => {
  withRoot((tmp) => {
    // [Шаг B п.12] rental_start удалён; берём живую отключённую инструкцию
    editJson(tmp, 'security/instruction-roles.json', (roles) => { roles.programs.aof_core.purchase_season_pass.status = 'active'; return roles; });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /aof_core\.purchase_season_pass: код отключает инструкцию .* статус 'active'/);
  });
  withRoot((tmp) => {
    editJson(tmp, 'security/instruction-roles.json', (roles) => { roles.programs.aof_core.set_fees.status = 'disabled-on-chain'; return roles; });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /aof_core\.set_fees: в классификации инструкция отключена, но в коде этого не видно/);
  });
  withRoot((tmp) => {
    // инструкцию «включили» в коде: первая команда обработчика больше не отказ
    edit(tmp, 'aof-core/src/instructions/season.rs', (src) => src.replace('    require!(false, AofError::SeasonPremiumRequired);\n', ''));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /aof_core\.purchase_season_pass: в классификации инструкция отключена, но в коде этого не видно/);
  });
});

test('deprecated требует существующую замену; candidate-dead-code требует evidence и не терпит call sites', () => {
  withRoot((tmp) => {
    // [Шаг B п.12] deprecated-инструкций больше нет; правило проверяем на живой
    editJson(tmp, 'security/instruction-roles.json', (roles) => {
      roles.programs.aof_core.burn_tool = { role: 'deprecated', status: 'active', note: 'временно переклассифицирована тестом' };
      return roles;
    });
    assert.match(run(['--check', '--root', tmp]).out, /aof_core\.burn_tool: роль deprecated требует replacedBy/);
  });
  withRoot((tmp) => {
    editJson(tmp, 'security/instruction-roles.json', (roles) => {
      roles.programs.aof_core.burn_tool = { role: 'deprecated', status: 'active', note: 'временно переклассифицирована тестом', replacedBy: 'does_not_exist' };
      return roles;
    });
    assert.match(run(['--check', '--root', tmp]).out, /replacedBy 'does_not_exist' — такой инструкции нет в aof_core/);
  });
  withRoot((tmp) => {
    // [шаг B] обе лимитки удалены; проверяем правило на живой инструкции без call sites
    editJson(tmp, 'security/instruction-roles.json', (roles) => {
      roles.programs.aof_core.burn_tool = { role: 'candidate-dead-code', status: 'active', note: 'временно переклассифицирована тестом' };
      return roles;
    });
    assert.match(run(['--check', '--root', tmp]).out, /aof_core\.burn_tool: candidate-dead-code требует evidence/);
  });
  // «мёртвой» объявлена инструкция, у которой есть вызов в backend, — утверждение ложно
  withRoot((tmp) => {
    editJson(tmp, 'security/instruction-roles.json', (roles) => {
      roles.programs.aof_core.set_mining_enabled = { role: 'candidate-dead-code', status: 'active', note: 'ложно объявлена мёртвой', evidence: 'проверка того, что гейт ловит ложное утверждение о мёртвом коде' };
      return roles;
    });
    fs.mkdirSync(path.join(tmp, 'aof_backend/src/routes'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'aof_backend/src/routes/admin-config.ts'), 'await (program.methods as any).setMiningEnabled(true).accounts({}).instruction();\n');
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /aof_core\.set_mining_enabled: помечена candidate-dead-code, но call sites есть/);
  });
});

test('классификация в закоммиченных JSON и MD не может отстать от кода', () => {
  withRoot((tmp) => {
    run(['--write', '--root', tmp]);
    // правка в таблице ролей (часть гейта) — отказ
    edit(tmp, 'docs/INSTRUCTION_INVENTORY.md', (md) => md.replace('| gameplay |', '| gameplay! |'));
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /docs\/INSTRUCTION_INVENTORY\.md устарел/);
  });
  withRoot((tmp) => {
    run(['--write', '--root', tmp]);
    editJson(tmp, 'security/instruction-roles.json', (roles) => { roles.programs.aof_core.set_fees.note = 'новая заметка, JSON не пересоздан'; return roles; });
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 1);
    assert.match(result.out, /docs\/INSTRUCTION_INVENTORY\.json устарел/);
  });
});

test('данные call sites и тестов справочные: их отставание — предупреждение, а не отказ', () => {
  withRoot((tmp) => {
    run(['--write', '--root', tmp]);
    // любой новый файл с упоминанием имени меняет «справочную» часть; гейт из-за этого падать не должен
    fs.mkdirSync(path.join(tmp, 'tests/readiness'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'tests/readiness/new.test.cjs'), "const re = /set_fees|marketplace_list/;\n");
    edit(tmp, 'docs/INSTRUCTION_INVENTORY.md', (md) => `${md}\nрукой дописанная строка вне гейтовых разделов\n`);
    const result = run(['--check', '--root', tmp]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /справочные данные call sites и тестов отстали/);
  });
  // и наоборот: само репозиторное состояние после --write не требует повторного --write при правке чужих тестов
  const fresh = run(['--check']);
  assert.equal(fresh.code, 0, fresh.out);
});

test('вызовы атрибутируются по получателю, реестры исключены, общие имена не приписываются чужой программе', () => {
  const inventory = JSON.parse(read('docs/INSTRUCTION_INVENTORY.json'));
  const registryFiles = inventory.registries.map((r) => r.file);
  assert.ok(registryFiles.includes('frontend/src/lib/coreInstructions.ts'), 'таблица инструкций фронтенда должна быть опознана как реестр');
  const byKey = new Map(inventory.instructions.map((i) => [`${i.program}.${i.name}`, i]));
  // реестры не считаются call sites
  for (const ix of inventory.instructions) {
    for (const category of Object.values(ix.callSites)) {
      for (const file of category.files) assert.ok(!registryFiles.includes(file), `${ix.program}.${ix.name}: реестр ${file} посчитан как call site`);
    }
  }
  // вызов `marketProgram.methods.crankMarket(` приписан market, а `program.methods.setPausedХ` — не market
  assert.ok(byKey.get('aof_market.crank_market').callSites.backend, 'crank_market вызывается из backend через marketProgram');
  assert.ok(byKey.get('aof_core.set_paused').sharedName && byKey.get('aof_market.set_paused').sharedName);
  assert.equal(byKey.get('aof_market.set_paused').callSites.backend, undefined, 'вызов program.methods.setPaused принадлежит aof_core, а не aof_market');
});

test('--compare-cu сверяет статический охват с CU-отчётом и держит порог 150 000 CU', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aof-cu-'));
  try {
    const report = path.join(dir, 'cu-report.md');
    fs.writeFileSync(report, ['# cu', '', '| Instruction | Calls | Max CU | Median CU | Max, % of 200k |', '|---|---:|---:|---:|---:|',
      '| MintTool | 4 | 41000 | 38000 | 20.5% |', '| SetFees | 1 | 9000 | 9000 | 4.5% |', '| NotInIdl | 1 | 100 | 100 | 0.1% |'].join('\n'));
    let result = run(['--compare-cu', report]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /CU-отчёт: 3 инструкций выполнено успешно из 122 в IDL aof_core/);
    assert.match(result.out, /В отчёте, но не в IDL \(1\): NotInIdl/);
    assert.match(result.out, /Не затронуты ни тестами, ни CU-отчётом/);
    fs.appendFileSync(report, '\n| Craft | 1 | 160001 | 160001 | 80% |\n');
    result = run(['--compare-cu', report]);
    assert.equal(result.code, 1, 'выше 150 000 CU — отказ');
    assert.match(result.out, /Выше порога 150 000 CU: Craft: 160001/);
    assert.equal(run(['--compare-cu', path.join(dir, 'nope.md')]).code, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('лимитные ордера удалены целиком, а удаление по-прежнему требует доказательств', () => {
  const roles = JSON.parse(read('security/instruction-roles.json'));
  const candidates = [];
  for (const [program, entries] of Object.entries(roles.programs)) {
    for (const [name, entry] of Object.entries(entries)) if (entry.role === 'candidate-dead-code') candidates.push(`${program}.${name}`);
  }
  // [шаг B] place_limit_order и cancel_limit_order удалены вместе с состоянием и событиями:
  // ордера некому было создать (TradingDisabled), а парной инструкции матчинга нет вовсе.
  assert.deepEqual(candidates, []);
  const lib = fs.readFileSync(path.join(root, 'programs/aof-market/src/lib.rs'), 'utf8');
  for (const needle of ['place_limit_order', 'cancel_limit_order', 'HotLimitOrder', 'LimitOrderCancelled']) {
    assert.equal(lib.includes(needle), false, `aof-market всё ещё содержит ${needle}`);
  }
  assert.match(roles.$comment, /удалять инструкции можно только после доказательства отсутствия всех call sites/);
});
