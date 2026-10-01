'use strict';
/*
 * Source-level tripwires for SECURITY_CHECKLIST_REVIEW_2026-09-25.md.
 *
 * Each assertion pins one defence that a refactor could silently delete, across
 * all six Anchor programs. They are NOT behavioural evidence: the real handlers
 * and Anchor's generated account validation are exercised by the host tests in
 * aof-core/src/security_checklist_tests.rs (CI: `cargo test --workspace --lib`).
 * Checklist items are cited as #N, findings of the review as F-X.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const PROGRAMS = {
  aof_core: 'aof-core',
  aof_market: 'programs/aof-market',
  aof_liquidity: 'programs/aof-liquidity',
  aof_quests: 'programs/aof-quests',
  aof_rebirth: 'programs/aof-rebirth',
  aof_session_keys: 'programs/aof-session-keys',
};

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const stripComments = (src) => src.replace(/\/\/[^\n]*/g, '');

/** Drop inline `#[cfg(test)] mod x { ... }` blocks (keeps `mod x;` lines). */
function withoutInlineTests(src) {
  const re = /#\[cfg\(test\)\]\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+\w+\s*\{/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    out += src.slice(last, m.index);
    last = i;
    re.lastIndex = i;
  }
  return out + src.slice(last);
}

/** On-chain .rs files of a program (test files excluded). */
function rustFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.rs') && !/test/.test(e.name)) out.push(p);
    }
  };
  walk(path.join(root, dir, 'src'));
  return out.sort();
}

function programSource(dir, { comments = false } = {}) {
  return rustFiles(dir)
    .map((f) => {
      const src = withoutInlineTests(fs.readFileSync(f, 'utf8'));
      return comments ? src : stripComments(src);
    })
    .join('\n');
}

/** Bodies of every `#[account(...)]` in a region, parentheses matched by depth. */
function accountAttrs(region) {
  const out = [];
  let i = 0;
  for (;;) {
    const j = region.indexOf('#[account(', i);
    if (j < 0) break;
    let k = j + '#[account('.length;
    let depth = 1;
    while (k < region.length && depth) {
      if (region[k] === '(') depth += 1;
      else if (region[k] === ')') depth -= 1;
      k += 1;
    }
    out.push(region.slice(j + '#[account('.length, k - 1));
    i = k;
  }
  return out.join(' ');
}

/** { StructName: [{ name, type, docs, attrs }] } for every Accounts context. */
function accountStructs(src) {
  const out = new Map();
  const re = /#\[derive\(Accounts\)\](?:\s*#\[instruction\([\s\S]*?\)\])?\s*pub struct (\w+)<'info>\s*\{([\s\S]*?)\n\}/g;
  for (const m of src.matchAll(re)) {
    const body = m[2];
    const fields = [];
    let prev = 0;
    for (const f of body.matchAll(/^[ \t]*pub (\w+):\s*([^\n]+?),[ \t]*$/gm)) {
      const region = body.slice(prev, f.index);
      prev = f.index + f[0].length;
      fields.push({ name: f[1], type: f[2].trim(), docs: region, attrs: stripComments(accountAttrs(region)) });
    }
    out.set(m[1], fields);
  }
  return out;
}

/** Text of `pub fn <name>` up to the next top-level `pub fn` (comments stripped). */
function fnBody(src, name) {
  const code = stripComments(src);
  const m = new RegExp(`pub fn ${name}\\b`).exec(code);
  assert.ok(m, `pub fn ${name} not found`);
  const rest = code.slice(m.index + m[0].length);
  const next = rest.search(/\npub fn /);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Every handler `pub fn x(ctx: Context<Struct>, ..)` with its body. */
function handlers(src) {
  const code = stripComments(src);
  const out = [];
  const re = /pub fn (\w+)\s*(?:<[^>]*>)?\s*\(\s*ctx:\s*Context<(\w+)>/g;
  const hits = [...code.matchAll(re)];
  hits.forEach((m, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].index : code.length;
    out.push({ name: m[1], ctx: m[2], body: code.slice(m.index, end) });
  });
  return out;
}

const sources = Object.fromEntries(
  Object.entries(PROGRAMS).map(([name, dir]) => [name, {
    dir,
    code: programSource(dir),
    raw: programSource(dir, { comments: true }),
    structs: accountStructs(programSource(dir, { comments: true })),
  }]),
);

const core = (rel) => read(`aof-core/src/${rel}`);

// ---------------------------------------------------------------- A. Accounts

test('#1 #22 every init / init_if_needed is a PDA with payer, space and the System Program', () => {
  let checked = 0;
  for (const [program, { structs }] of Object.entries(sources)) {
    for (const [name, fields] of structs) {
      for (const f of fields) {
        if (!/\binit(_if_needed)?\b/.test(f.attrs)) continue;
        checked += 1;
        const where = `${program}::${name}.${f.name}`;
        assert.match(f.attrs, /\bpayer\s*=/, `${where}: init without payer`);
        const ata = /associated_token::authority\s*=/.test(f.attrs);
        // [F-06] Settlement NFTs are PDA mints created by the program itself:
        // Anchor sizes them; they still need seeds, and the program's auth PDA
        // as the only mint authority, 0 decimals and no freeze authority.
        const mint = /\bmint::authority\s*=/.test(f.attrs);
        if (mint) {
          assert.match(f.attrs, /\bseeds\s*=/, `${where}: mint init on a keypair account (no seeds)`);
          assert.match(f.attrs, /\bbump\b/, `${where}: mint init without bump`);
          assert.match(f.attrs, /\bmint::decimals\s*=\s*0\b/, `${where}: NFT mint must have 0 decimals`);
          assert.match(f.attrs, /\bmint::authority\s*=\s*auth\b/, `${where}: NFT mint authority must be the auth PDA`);
          assert.doesNotMatch(f.attrs, /freeze_authority/, `${where}: NFT mint must not be freezable`);
        } else if (!ata) {
          assert.match(f.attrs, /\bspace\s*=/, `${where}: init without space`);
          assert.match(f.attrs, /\bseeds\s*=/, `${where}: init on a keypair account (no seeds)`);
          assert.match(f.attrs, /\bbump\b/, `${where}: init without bump`);
        }
        assert.ok(
          fields.some((x) => x.name === 'system_program' && /^Program<'info,\s*System>$/.test(x.type)),
          `${where}: context has no Program<'info, System>`,
        );
      }
    }
  }
  assert.ok(checked > 40, `suspiciously few init accounts parsed (${checked})`);
});

test('#4 program and sysvar accounts are type- or address-checked', () => {
  const VALUE_ACCOUNTS = new Set(['aof_session_keys::SessionCreate.target_program']);
  for (const [program, { structs }] of Object.entries(sources)) {
    for (const [name, fields] of structs) {
      for (const f of fields) {
        const where = `${program}::${name}.${f.name}`;
        if (/_program$/.test(f.name) && !VALUE_ACCOUNTS.has(where)) {
          assert.match(f.type, /^(Box<)?(Program|Interface)</, `${where}: CPI target must be Program<..>`);
        }
        if (/slot_?hashes|recent_blockhashes|^rent$|^clock$|^instructions$/.test(f.name) && !/^Sysvar</.test(f.type)) {
          assert.match(f.attrs, /\baddress\s*=/, `${where}: sysvar passed without an address check`);
        }
      }
    }
  }
});

test('#2 #16 every unchecked account is documented and bound to something', () => {
  // Keys a signer deliberately stores as configuration / delegation.
  const VALUE_ACCOUNTS = new Map([
    ['aof_market::InitConfig.treasury', 'treasury chosen once by the upgrade authority'],
    ['aof_session_keys::InitSkConfig.oracle_authority', 'oracle key chosen by the upgrade authority'],
    ['aof_session_keys::SessionCreate.session_signer', 'delegate chosen by the signing owner'],
    ['aof_session_keys::SessionCreate.target_program', 'program id stored in the session'],
  ]);
  // [F-06] The oracle of a Switchboard commit is picked by the client from the
  // queue; Switchboard itself checks queue membership and records it on the
  // randomness account, where every reveal context then binds it.
  const SWITCHBOARD_COMMIT_ORACLE = new Set(['PackOpenCommit', 'RerollRandomCommit', 'StartExplorationCommit',
    'ForgeAttemptCommit', 'CommitLotteryDraw', 'DrumCommitCtx', 'PotatoSpinCommit']);
  let unchecked = 0;
  for (const [program, { structs }] of Object.entries(sources)) {
    for (const [name, fields] of structs) {
      for (const f of fields) {
        if (!/(^|<)(UncheckedAccount|AccountInfo)</.test(f.type)) continue;
        unchecked += 1;
        const where = `${program}::${name}.${f.name}`;
        assert.match(f.docs, /\/\/\/\s*CHECK:/, `${where}: missing /// CHECK: justification`);
        const own = /\b(seeds|address|constraint)\s*=/.test(f.attrs);
        const byOthers = fields.some((x) => x !== f && new RegExp(`\\b${f.name}\\.key\\(\\)`).test(x.attrs));
        const oracle = f.name === 'oracle' && SWITCHBOARD_COMMIT_ORACLE.has(name)
          && fields.some((x) => x.name === 'switchboard_program' && /SwitchboardOnDemand/.test(x.type));
        assert.ok(own || byOthers || oracle || VALUE_ACCOUNTS.has(where), `${where}: unchecked account bound by nothing`);
      }
    }
  }
  assert.ok(unchecked > 30, `suspiciously few unchecked accounts parsed (${unchecked})`);
});

test('#28 rent of a closed account only goes to a signer or to a constrained address', () => {
  let closes = 0;
  for (const [program, { structs }] of Object.entries(sources)) {
    for (const [name, fields] of structs) {
      for (const f of fields) {
        const m = /\bclose\s*=\s*(\w+)/.exec(f.attrs);
        if (!m) continue;
        closes += 1;
        const where = `${program}::${name}.${f.name} -> ${m[1]}`;
        const target = fields.find((x) => x.name === m[1]);
        assert.ok(target, `${where}: close target is not an account of the context`);
        const signer = /Signer</.test(target.type);
        const bound = /\b(address|constraint|seeds)\s*=/.test(target.attrs)
          || new RegExp(`has_one\\s*=\\s*${m[1]}\\b`).test(f.attrs)
          || fields.some((x) => new RegExp(`\\b${m[1]}\\.key\\(\\)`).test(x.attrs));
        assert.ok(signer || bound, `${where}: refund destination is attacker-controlled`);
      }
    }
  }
  assert.ok(closes >= 20, `suspiciously few close constraints parsed (${closes})`);
});

// ---------------------------------------------------------------- B/C. State & economics

test('#13 release builds keep overflow checks on', () => {
  const cargo = read('Cargo.toml');
  const release = /\[profile\.release\]([\s\S]*?)(?=\n\[|$)/.exec(cargo);
  assert.ok(release, 'no [profile.release] in the workspace Cargo.toml');
  assert.match(release[1], /overflow-checks\s*=\s*true/);
});

test('F-A #4 System Program transfers only ever debit a signing wallet', () => {
  let transfers = 0;
  for (const [program, { dir, structs }] of Object.entries(sources)) {
    for (const file of rustFiles(dir)) {
      for (const h of handlers(withoutInlineTests(fs.readFileSync(file, 'utf8')))) {
        for (const t of h.body.matchAll(/system_program::Transfer\s*\{\s*from:\s*ctx\.accounts\.(\w+)/g)) {
          transfers += 1;
          const field = (structs.get(h.ctx) || []).find((x) => x.name === t[1]);
          assert.ok(field, `${program}::${h.name}: cannot resolve ${h.ctx}.${t[1]}`);
          assert.match(field.type, /Signer</, `${program}::${h.name} debits ${t[1]}, which is not a Signer`);
        }
      }
    }
  }
  assert.ok(transfers >= 10, `suspiciously few System transfers parsed (${transfers})`);
  const sweep = stripComments(core('instructions/sweep_gas_fees.rs'));
  assert.doesNotMatch(sweep, /system_program::transfer/);
  assert.match(sweep, /transfer_owned_lamports\(/);
  assert.match(sweep, /dust_lamports/, 'the sweep reserve must keep the user\'s dust');
});

test('F-F #11 every enabled resource-minting path checks the supply cap before minting', () => {
  // 1-of-1 tool NFTs: supply 0 -> 1 is enforced by the account constraints.
  const TOOL_NFT = ['craft.rs', 'reroll.rs', 'mint_tool.rs',
    // [F-06] VRF settlements mint exactly one unit of a fresh PDA mint.
    'settlement.rs', 'pack_open_reveal.rs', 'reroll_random.rs'];
  const DISABLED = [];
  const dir = path.join(root, 'aof-core/src/instructions');
  const minting = fs.readdirSync(dir).filter((f) => /\bmint_to\(/.test(stripComments(fs.readFileSync(path.join(dir, f), 'utf8'))));
  assert.ok(minting.includes('harvest_wheat.rs'), 'harvest_wheat no longer mints?');
  for (const file of minting) {
    const src = stripComments(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (TOOL_NFT.includes(file)) continue;
    if (DISABLED.includes(file)) {
      assert.match(src, /require!\(\s*false\s*,\s*AofError::(FeatureDisabled|RandomnessDisabled)/, `${file} was re-enabled: add check_supply_cap`);
      continue;
    }
    const cap = src.indexOf('check_supply_cap(');
    assert.ok(cap >= 0, `${file} mints resources without check_supply_cap`);
    assert.ok(cap < src.indexOf('mint_to('), `${file}: supply cap must be checked before the mint CPI`);
  }
});

test('F-E #16 #20 both vault payouts pass the shared brakes before any transfer', () => {
  const cases = [
    ['instructions/pay_out.rs', 'handler'],
    ['instructions/referral.rs', 'pay_out_with_referral_handler'],
  ];
  for (const [file, fn] of cases) {
    const body = fnBody(core(file), fn);
    const brake = body.indexOf('charge_vault_withdrawal(');
    assert.ok(brake >= 0, `${file}::${fn} skips charge_vault_withdrawal`);
    assert.ok(brake < body.indexOf('token::transfer('), `${file}::${fn}: brakes must run before the CPI`);
    assert.match(body, /emit!\(VaultWithdrawal/, `${file}::${fn}: vault outflow must be observable`);
  }
  const gate = fnBody(core('state.rs'), 'charge_vault_withdrawal');
  for (const piece of ['is_resource_mint(', 'guard.mint != *mint', 'guard.charge(']) {
    assert.ok(gate.includes(piece), `charge_vault_withdrawal lost ${piece}`);
  }
});

test('F-I #11 every freshly minted tool NFT must be unfreezable', () => {
  const lib = core('lib.rs');
  const blocks = [];
  let i = 0;
  for (;;) {
    const j = lib.indexOf('#[account(', i);
    if (j < 0) break;
    const attrs = accountAttrs(lib.slice(j, lib.indexOf('\n    pub ', j)));
    if (/supply == 0 @ AofError::InvalidMint/.test(attrs)) blocks.push(attrs);
    i = j + 1;
  }
  // [F-06] The pack / random-reroll NFTs are no longer caller-supplied mints:
  // they are PDA mints created by the settling instruction (checked by the
  // #1 #22 init test: 0 decimals, auth PDA authority, no freeze authority).
  assert.equal(blocks.length, 3, 'MintTool, Craft, Reroll (MigrateTool removed in plan item 12, step B)');
  for (const attrs of blocks) {
    const mint = /(\w+)\.supply == 0/.exec(attrs)[1];
    assert.ok(attrs.includes(`${mint}.freeze_authority.is_none()`), `${mint}: freeze authority not rejected`);
    assert.ok(attrs.includes(`${mint}.decimals == 0`), `${mint}: decimals not pinned`);
  }
});

test('F-B burning a tool NFT also closes its ToolData (no ghost tools)', () => {
  const { structs } = sources.aof_core;
  const burned = [['Craft', 'prev_tool'], ['Reroll', 'tool_a'], ['Reroll', 'tool_b'], ['BurnTool', 'tool_data'], ['BurnNft', 'tool']];
  for (const [ctx, field] of burned) {
    const f = (structs.get(ctx) || []).find((x) => x.name === field);
    assert.ok(f, `${ctx}.${field} not found`);
    assert.match(f.type, /ToolData/);
    assert.match(f.attrs, /\bclose\s*=\s*user\b/, `${ctx}.${field} survives the burn`);
  }
});

test('#8 #10 #17 F-06 randomness settles only through the program-owned Switchboard pool', () => {
  // Every commit CPIs Switchboard's commit on a locked pool slot, every reveal
  // CPIs its reveal and reads the value back, every refund waits for the
  // window to close. No handler touches SlotHashes or a secret any more.
  const cases = [
    ['aof-core/src/instructions/pack_open_commit.rs', 'handler', 'commit'],
    ['aof-core/src/instructions/pack_open_reveal.rs', 'handler', 'reveal'],
    ['aof-core/src/instructions/pack_open_expire.rs', 'handler', 'release_for_refund'],
    ['aof-core/src/instructions/reroll_random.rs', 'commit_handler', 'commit'],
    ['aof-core/src/instructions/reroll_random.rs', 'reveal_handler', 'reveal'],
    ['aof-core/src/instructions/reroll_random.rs', 'expire_handler', 'release_for_refund'],
    ['aof-core/src/instructions/exploration.rs', 'start_commit_handler', 'commit'],
    ['aof-core/src/instructions/exploration.rs', 'reveal_handler', 'reveal'],
    ['aof-core/src/instructions/exploration.rs', 'expire_handler', 'release_for_refund'],
    ['aof-core/src/instructions/forge.rs', 'commit_handler', 'commit'],
    ['aof-core/src/instructions/forge.rs', 'reveal_handler', 'reveal'],
    ['aof-core/src/instructions/forge.rs', 'expire_handler', 'release_for_refund'],
    ['aof-core/src/instructions/lottery.rs', 'commit_draw_handler', 'commit'],
    ['aof-core/src/instructions/lottery.rs', 'draw_handler', 'reveal'],
    ['aof-core/src/instructions/lottery.rs', 'expire_draw_handler', 'release_for_refund'],
    ['programs/aof-quests/src/instructions/drum/drum_reveal.rs', 'handler', 'reveal'],
    ['programs/aof-quests/src/instructions/drum/drum_expire.rs', 'handler', 'release_for_refund'],
  ];
  for (const [file, fn, step] of cases) {
    const body = fnBody(read(file), fn);
    assert.match(body, new RegExp(`vrf::${step}\\(`), `${file}::${fn} must use vrf::${step}`);
    assert.doesNotMatch(body, /slot_hashes|hash_secret|derive_entropy|secret/, `${file}::${fn}: legacy commit-reveal`);
    assert.doesNotMatch(body, /require!\(\s*false/, `${file}::${fn} is still hard-disabled`);
  }
  // New Potato payments are intentionally blocked until a decimals-aware
  // contract is deployed. Existing reveal/refund still use Switchboard.
  assert.match(fnBody(read('programs/aof-quests/src/instructions/drum/drum_commit.rs'), 'handler'),
    /require!\(false, QuestError::Paused\)/);
  // Legacy helpers are gone, so nothing can be wired back to them.
  assert.doesNotMatch(stripComments(core('randomness.rs')), /fn (hash_secret|get_slot_hash|derive_entropy)/);
  // Rebirth is not a randomness mechanic. [§3.4] Он включён: сброс прогресса
  // существует одной инструкцией, а сам ребёрт не подписывается игроком без
  // бэкенда — иначе бонус начислялся бы без сброса.
  const rebirthHandler = fnBody(read('programs/aof-rebirth/src/instructions/do_rebirth.rs'), 'handler');
  assert.doesNotMatch(rebirthHandler, /require!\(\s*false/,
    'ребёрт снова выключен заглушкой');
  assert.match(read('programs/aof-rebirth/src/instructions/do_rebirth.rs'),
    /address = rebirth_config\.authority @ RebirthError::Unauthorized/,
    'ребёрт обязан требовать подпись authority, иначе бонус достижим без сброса');
  assert.match(read('aof-core/src/instructions/rebirth_reset.rs'), /is_resource_mint/,
    'сброс обязан отвергать неканонические минты');
});

test('#8 #24 #30 no raw CPI, no instruction introspection, no manual account decoding, no deprecated sysvars', () => {
  const banned = [
    [/\binvoke(_signed)?\s*\(/, 'raw invoke: CPIs must use the typed Anchor helpers'],
    [/\bremaining_accounts\b/, 'unvalidated remaining_accounts'],
    [/sysvar::instructions|load_instruction_at|get_instruction_relative/, 'instruction-sysvar introspection'],
    [/try_from_slice|try_deserialize_unchecked/, 'manual account decoding bypasses owner/discriminator checks'],
    [/RecentBlockhashes|recent_blockhashes|sysvar::fees|Fees::get/, 'deprecated sysvar'],
    [/InterfaceAccount|token_interface|Token2022|spl_token_2022/, 'Token-2022 needs a separate extension review (#12)'],
  ];
  // [F-06] vrf.rs (one copy per program that CPIs Switchboard) is the single
  // audited exception for raw invoke_signed: Switchboard ships no Anchor CPI
  // crate for this toolchain. Every raw CPI there targets the trusted program.
  const VRF = { aof_core: 'aof-core/src/vrf.rs', aof_quests: 'programs/aof-quests/src/vrf.rs' };
  // [§3.4] reset_for_rebirth — единственное место, где список аккаунтов задаёт
  // бэкенд: излишков у игрока может быть 0..16 пар (mint, token_account), и
  // фиксированная структура их не выражает. Это не «невалидированный
  // remaining_accounts»: каждая пара проходит чётность, лимит, канонический
  // ресурсный минт, вывод канонического ATA из (игрок, минт), проверку
  // программы-владельца и точной длины SPL token account, официальную
  // распаковку и сверку владельца/минта/остатка — и только потом CPI burn.
  // Anchor тут не подходит: `Account<'info, T>` строится только из
  // `&'info AccountInfo<'info>`, а `Context::remaining_accounts` даёт
  // `&'c [AccountInfo<'info>]` с независимым 'c (см. комментарий в файле).
  const REMAINING_ACCOUNTS = 'aof-core/src/instructions/rebirth_reset.rs';
  {
    const raw = read(REMAINING_ACCOUNTS);
    const body = stripComments(withoutInlineTests(raw));
    const guards = [
      [/require!\(\s*pairs\.len\(\) % 2 == 0/, 'чётность пар'],
      [/pair_count <= REBIRTH_RESET_MAX_RESOURCE_ACCOUNTS/, 'лимит пар'],
      [/is_resource_mint\(/, 'канонический ресурсный минт'],
      [/get_associated_token_address\(&user_key, &mint_info\.key\(\)\)/, 'адрес ATA выводится из игрока и минта'],
      [/NonCanonicalTokenAccount/, 'не-ATA аккаунт отвергается'],
      [/require_keys_eq!\(\s*\*token_info\.owner,\s*anchor_spl::token::spl_token::ID/, 'владелец — классический Token program'],
      [/TokenState::LEN/, 'точная длина SPL token account'],
      [/TokenState::unpack\(&data\[\.\.\]\)/, 'официальная распаковка вместо байтовых смещений'],
      [/require_keys_eq!\(data_owner, user_key/, 'владелец в данных — игрок'],
      [/require_keys_eq!\(data_mint, mint_info\.key\(\)/, 'минт в данных — минт пары'],
      [/require!\(amount > 0/, 'ненулевой остаток'],
    ];
    for (const [re, why] of guards) assert.match(body, re, `${REMAINING_ACCOUNTS}: ${why} обязателен до сжигания`);
    // CPI идёт строго после всех проверок пары.
    for (const check of ['get_associated_token_address(', 'TokenState::unpack(', 'require!(amount > 0']) {
      assert.ok(body.indexOf(check) < body.indexOf('token::burn('), `проверка ${check} обязана быть до CPI burn`);
    }
    assert.equal([...body.matchAll(/remaining_accounts/g)].length, 1, 'remaining_accounts читается один раз и только как pairs');
  }
  for (const [program, { code }] of Object.entries(sources)) {
    const vrf = VRF[program] ? stripComments(withoutInlineTests(read(VRF[program]))) : null;
    for (const [re, why] of banned) {
      let scope = code;
      if (vrf && /raw invoke/.test(why)) scope = scope.replace(vrf, '');
      if (/unvalidated remaining_accounts/.test(why) && program === 'aof_core') {
        scope = scope.replace(stripComments(withoutInlineTests(read(REMAINING_ACCOUNTS))), '');
      }
      assert.doesNotMatch(scope, re, `${program}: ${why}`);
    }
  }
  for (const file of Object.values(VRF)) {
    const vrf = stripComments(read(file));
    const invokes = [...vrf.matchAll(/invoke_signed\(/g)].length;
    assert.equal(invokes, 3, `${file}: exactly the init / commit / reveal CPIs`);
    const guards = [...vrf.matchAll(/require_keys_eq!\(a\.switchboard_program\.key\(\), SWITCHBOARD_PROGRAM_ID/g)].length;
    assert.equal(guards, 3, `${file}: every raw CPI checks the Switchboard program id first`);
    assert.equal([...vrf.matchAll(/program_id: SWITCHBOARD_PROGRAM_ID/g)].length, 3, `${file}: builders target Switchboard only`);
    assert.doesNotMatch(vrf, /sysvar::instructions|load_instruction_at/, `${file}: no introspection needed any more`);
  }
});

test('#18 no unbounded per-call input: collection arguments are allowlisted and bounded', () => {
  const allowed = new Map([
    ['aof_core::mint_tool.tool_type', 'canonicalised to TOOL_KINDS'],
    ['aof_core::craft.tool_type', 'canonicalised to TOOL_KINDS'],
    ['aof_core::reroll.new_type', 'canonicalised to TOOL_KINDS'],
  ]);
  let args = 0;
  for (const [program, { dir }] of Object.entries(sources)) {
    const lib = stripComments(read(`${dir}/src/lib.rs`));
    const prog = /#\[program\]\s*pub mod \w+\s*\{([\s\S]*)\n\}/.exec(lib)[1];
    for (const m of prog.matchAll(/pub fn (\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g)) {
      for (const arg of m[2].split(/,(?![^<\[]*[>\]])/).slice(1)) {
        const [name, type = ''] = arg.split(':').map((s) => s.trim());
        if (!name) continue;
        args += 1;
        if (/\b(Vec<|String\b)/.test(type)) {
          assert.ok(allowed.has(`${program}::${m[1]}.${name}`), `${program}::${m[1]}(${name}: ${type}) is an unbounded collection argument`);
        }
      }
    }
  }
  assert.ok(args > 50, `suspiciously few instruction arguments parsed (${args})`);
  for (const f of ['craft.rs', 'reroll.rs', 'mint_tool.rs']) {
    assert.match(stripComments(core(`instructions/${f}`)), /canonical_tool_type\(|is_valid_tool_type\(/, f);
  }
});

test('#20 critical admin mutations stay observable (emit an event)', () => {
  const pinned = [
    ['instructions/set_fees.rs', 'handler'],
    ['instructions/set_paused.rs', 'handler'],
    ['instructions/set_resource_mints.rs', 'handler'],
    ['instructions/admin_config.rs', 'set_mining_enabled'],
    ['instructions/admin_config.rs', 'set_supply_cap'],
    ['instructions/authority.rs', 'set_pending_authority'],
    ['instructions/authority.rs', 'accept_authority'],
    ['instructions/pay_out.rs', 'init_vault_guard_handler'],
    ['instructions/pay_out.rs', 'set_vault_guard_handler'],
    ['instructions/issuance_cap.rs', 'init_handler'],
    ['instructions/issuance_cap.rs', 'set_handler'],
    ['instructions/sweep_gas_fees.rs', 'handler'],
    // Previously silent admin mutations (review F-C):
    ['instructions/authority.rs', 'cancel_pending_authority'],
    ['instructions/pack_config.rs', 'init_handler'],
    ['instructions/pack_config.rs', 'set_handler'],
    ['instructions/reroll_random.rs', 'init_config_handler'],
    ['instructions/reroll_random.rs', 'set_config_handler'],
    ['instructions/season.rs', 'init_season_handler'],
    ['instructions/season.rs', 'grant_xp_handler'],
    ['instructions/init_material_mints.rs', 'handler'],
  ];
  for (const [file, fn] of pinned) assert.match(fnBody(core(file), fn), /emit!\(/, `${file}::${fn}`);
  for (const file of ['programs/aof-liquidity/src/instructions/authority.rs',
    'programs/aof-quests/src/instructions/quests/authority.rs',
    'programs/aof-rebirth/src/instructions/authority.rs']) {
    assert.match(fnBody(read(file), 'cancel_pending_authority_handler'), /emit!\(AuthorityRotationCancelled/, file);
  }
  assert.match(fnBody(read('programs/aof-market/src/lib.rs'), 'cancel_pending_authority'), /emit!\(AuthorityRotationCancelled/);
});

// ---------------------------------------------------------------- D. Anchor specifics

test('#25 #26 instruction, account and event discriminators never collide', () => {
  const disc = (ns, name) => crypto.createHash('sha256').update(`${ns}:${name}`).digest().subarray(0, 8).toString('hex');
  for (const [program, { dir, code }] of Object.entries(sources)) {
    const lib = stripComments(read(`${dir}/src/lib.rs`));
    const prog = /#\[program\]\s*pub mod \w+\s*\{([\s\S]*)\n\}/.exec(lib)[1];
    const groups = {
      global: [...prog.matchAll(/pub fn (\w+)\s*(?:<[^>]*>)?\s*\(\s*ctx:/g)].map((m) => m[1]),
      account: [...code.matchAll(/#\[account(?:\([^)]*\))?\]\s*(?:#\[[^\]]*\]\s*)*pub struct (\w+)/g)].map((m) => m[1]),
      event: [...code.matchAll(/#\[event\]\s*(?:#\[[^\]]*\]\s*)*pub struct (\w+)/g)].map((m) => m[1]),
    };
    assert.ok(groups.global.length > 0 && groups.account.length > 0, `${program}: nothing parsed`);
    for (const [ns, names] of Object.entries(groups)) {
      assert.equal(new Set(names).size, names.length, `${program}: duplicate ${ns} names`);
      const seen = new Map();
      for (const n of names) {
        const d = disc(ns, n);
        assert.ok(!seen.has(d), `${program}: ${ns} discriminator collision ${n} / ${seen.get(d)}`);
        seen.set(d, n);
      }
    }
  }
});

test('the host security suite stays wired into the aof-core test build', () => {
  assert.match(core('lib.rs'), /#\[cfg\(test\)\]\s*mod security_checklist_tests;/);
  const suite = core('security_checklist_tests.rs');
  for (const fn of ['referral_payout_cannot_move_a_non_resource_mint', 'harvest_is_bounded_by_the_synapse_supply_cap',
    'sweep_moves_exactly_the_fees_and_never_user_funds', 'tool_nft_mint_with_a_freeze_authority_is_rejected',
    'an_order_cannot_be_matched_against_itself', 'fake_system_program_is_rejected_before_any_init_or_cpi']) {
    assert.match(suite, new RegExp(`#\\[test\\]\\s*fn ${fn}\\(`), fn);
  }
});

// ---------------------------------------------------------------- Follow-up decisions (2026-09-26)

const configAttrs = (ctx) => {
  const f = (sources.aof_core.structs.get(ctx) || []).find((x) => x.name === 'config');
  assert.ok(f, `${ctx}.config not found`);
  return f.attrs;
};

test('F-C exit paths are never paused; every trade entry is', () => {
  const exits = ['WithdrawGas', 'Unstake', 'CollectorUnstake', 'MarketplaceCancel', 'OfferCancelCtx',
    'RentalEndCtx', 'RentalRevokeCtx', 'RentalDelistCtx', 'AuctionCancelCtx', 'CancelBuyOrder', 'CancelSellOrder',
    'CraftOrderCancelCtx'];
  for (const ctx of exits) assert.doesNotMatch(configAttrs(ctx), /config\.paused/, `${ctx} must stay usable during a pause`);
  const entries = ['OfferAcceptCtx', 'OfferCreateCtx', 'MarketplaceList', 'MarketplaceBuy', 'AuctionCreateCtx',
    'AuctionBidCtx', 'RentalListCtx', 'RentalStartCtx', 'PlaceBuyOrder', 'PlaceSellOrder', 'DepositGas'];
  for (const ctx of entries) assert.match(configAttrs(ctx), /!config\.paused/, `${ctx} must be stopped by a pause`);
});

test('F-I trading entry points refuse freezable NFTs', () => {
  for (const ctx of ['MarketplaceList', 'AuctionCreateCtx', 'OfferAcceptCtx', 'OfferCreateCtx', 'RentalListCtx']) {
    const mint = (sources.aof_core.structs.get(ctx) || []).find((x) => x.name === 'mint');
    assert.ok(mint, `${ctx}.mint not found`);
    assert.match(mint.attrs, /mint\.freeze_authority\.is_none\(\)/, ctx);
  }
});

test('F-C set_fees has hard ceilings', () => {
  const body = fnBody(core('instructions/set_fees.rs'), 'handler');
  assert.match(body, /craft_fee\s*<=\s*MAX_CRAFT_FEE_MICROS/);
  assert.match(body, /unstake_fee\s*<=\s*MAX_UNSTAKE_FEE_MICROS/);
  assert.ok(body.indexOf('FeeTooHigh') < body.indexOf('cfg.craft_fee ='), 'check before the write');
});

test('F-D the well prices every second at its own day, not at the cached weather', () => {
  const body = fnBody(core('instructions/collect_well_water.rs'), 'handler');
  assert.doesNotMatch(body, /weather_state\.weather/);
  assert.match(body, /well_accrual\(/);
  assert.match(fnBody(core('instructions/weather_crank.rs'), 'handler'), /weather_for_day\(/);
});

test('season passes are sold once and only inside their season', () => {
  const pass = fnBody(core('instructions/season.rs'), 'purchase_pass_handler');
  for (const guard of ['SeasonNotStarted', 'SeasonEnded', 'SeasonPassAlreadyPremium', 'SEASON_LENGTH_SECONDS']) {
    assert.ok(pass.includes(guard), guard);
  }
  assert.ok(pass.indexOf('SeasonPassAlreadyPremium') < pass.indexOf('system_program::transfer'), 'guards before payment');
});

test('migrate_tool is gone from the program, the IDL and the clients (plan item 12, step B)', () => {
  // Pre-genesis migration that never had a deployment: removed rather than kept disabled.
  assert.equal(fs.existsSync(path.join(root, 'aof-core/src/instructions/migrate_tool.rs')), false, 'модуль migrate_tool должен быть удалён');
  const idl = JSON.parse(fs.readFileSync(path.join(root, 'aof_backend/src/idl/aof_core.json'), 'utf8'));
  assert.equal(idl.instructions.some((i) => i.name === 'migrateTool'), false, 'IDL всё ещё объявляет migrateTool');
  const roles = JSON.parse(fs.readFileSync(path.join(root, 'security/instruction-roles.json'), 'utf8'));
  const flat = JSON.stringify(roles);
  assert.equal(flat.includes('migrate_tool'), false, 'роли всё ещё описывают migrate_tool');
});

test('F-C routine operations need the operator; rule changes need the admin', () => {
  const OPERATOR = ['MintResource', 'MintResourceOnce', 'MintTool', 'Craft', 'PayOut', 'PayOutWithReferral',
    'AdjustPlayerCapacity', 'GrantSeasonXp', 'ClaimSeasonReward', 'SweepGasFees',
    // [F-06] paid VRF commits are co-signed by the operator (backend gate).
    'PackOpenCommit', 'RerollRandomCommit', 'StartExplorationCommit', 'ForgeAttemptCommit'];
  for (const ctx of OPERATOR) {
    const attrs = configAttrs(ctx);
    assert.match(attrs, /authority\.key\(\)\s*==\s*config\.operator/, `${ctx} must be operator-signed`);
    assert.doesNotMatch(attrs, /has_one\s*=\s*authority/, `${ctx} must not accept the admin key`);
  }
  for (const ctx of ['VrfPoolAdd', 'VrfPoolSetRetired', 'VrfSlotRecover']) {
    assert.match(configAttrs(ctx), /operator\.key\(\)\s*==\s*config\.operator/, `${ctx} must be operator-signed`);
  }
  // [F-06] Settlement must be impossible to block: no reveal / refund / draw
  // context may require the operator (or any particular signer).
  for (const ctx of ['PackOpenReveal', 'RerollRandomReveal', 'ExploreReveal', 'ForgeAttemptReveal', 'DrawLottery',
    'CommitLotteryDraw', 'PackOpenExpire', 'RerollRandomExpire', 'ExploreExpire', 'ForgeAttemptExpire',
    'ExpireLotteryDraw', 'RefundLotteryTicket']) {
    assert.doesNotMatch(configAttrs(ctx), /config\.operator|has_one\s*=\s*authority/, `${ctx} must be permissionless`);
  }
  const ADMIN = ['SetFees', 'SetPaused', 'SetResourceMints', 'SetPendingAuthority', 'CancelPendingAuthority',
    'SetMiningEnabled', 'InitVaultGuard', 'SetVaultGuard', 'SetSupplyCap', 'InitIssuanceCap', 'SetIssuanceCap',
    'SetCraftEconomy', 'RegisterCollectorMint', 'RevokeCollectorMint', 'SetPackConfig', 'SetRerollConfig',
    'InitSeason', 'SetRoles', 'SetCashoutFrozen'];
  for (const ctx of ADMIN) assert.match(configAttrs(ctx), /has_one\s*=\s*authority/, `${ctx} must be admin-only`);
});

test('F-C the cash-out freeze covers every path where value leaves the game - and only those', () => {
  const CASHOUT = ['PayOut', 'PayOutWithReferral', 'MarketplaceBuy', 'AuctionSettleCtx', 'OfferAcceptCtx',
    'MatchResourceOrders', 'RentalStartCtx', 'CraftOrderFulfillCtx', 'ClaimLotteryPrize'];
  for (const ctx of CASHOUT) assert.match(configAttrs(ctx), /!config\.cashout_frozen/, `${ctx} pays value out`);
  // Players' own exits and gameplay keep working during a freeze.
  const UNAFFECTED = ['WithdrawGas', 'Unstake', 'CollectorUnstake', 'MarketplaceCancel', 'OfferCancelCtx', 'RentalEndCtx',
    'CancelBuyOrder', 'CancelSellOrder', 'CraftOrderCancelCtx', 'HarvestWheat', 'CollectMining', 'CollectFlour',
    'CollectBread', 'CollectWellWater', 'Craft', 'Stake', 'StartMining',
    // [F-06] settling or refunding an already-paid commit is not a cash-out.
    'PackOpenReveal', 'PackOpenExpire', 'RerollRandomReveal', 'RerollRandomExpire', 'ExploreReveal', 'ExploreExpire',
    'ForgeAttemptReveal', 'ForgeAttemptExpire', 'DrawLottery', 'ExpireLotteryDraw', 'RefundLotteryTicket'];
  for (const ctx of UNAFFECTED) assert.doesNotMatch(configAttrs(ctx), /cashout_frozen/, `${ctx} must not be frozen`);
  const stop = fnBody(core('instructions/roles.rs'), 'emergency_stop_handler');
  assert.doesNotMatch(stop, /=\s*false/, 'an emergency stop can only switch flags on');
  assert.match(configAttrs('EmergencyStop'), /caller\.key\(\)\s*==\s*config\.guardian/);
});

test('F-C Config v2 migration runs once, for the stored authority, and only appends fields', () => {
  const mig = fnBody(core('instructions/roles.rs'), 'migrate_config_v2_handler');
  for (const piece of ['info.data_len() == CONFIG_V1_SPACE', 'DISCRIMINATOR', 'require_keys_eq!(v1.authority, ctx.accounts.authority.key()',
    'realloc(CONFIG_SPACE, true)', 'operator: v1.authority', 'guardian: v1.authority', 'cashout_frozen: false']) {
    assert.ok(mig.includes(piece), piece);
  }
  const fields = (sources.aof_core.code.match(/pub struct Config \{([\s\S]*?)\n\}/) || [])[1] || '';
  const order = [...fields.matchAll(/pub (\w+):/g)].map((m) => m[1]);
  assert.deepEqual(order.slice(-5), ['authority_updated_at', 'operator', 'guardian', 'cashout_frozen', 'reserved'],
    'v2 fields must be appended after the v1 layout');
  assert.match(fnBody(core('instructions/initialize.rs'), 'handler'), /cfg\.operator = cfg\.authority/);
});

test('F-H rentals escrow the NFT, need custody and a signed fee ceiling, keep the platform share', () => {
  const rental = core('instructions/rental.rs');
  const list = fnBody(rental, 'list_handler');
  assert.match(list, /from: ctx\.accounts\.owner_token[\s\S]*to: ctx\.accounts\.rental_vault/, 'listing escrows the NFT');
  assert.match(list, /owner_split_bps <= RENTAL_MAX_OWNER_SPLIT_BPS/);
  const vault = (sources.aof_core.structs.get('RentalStartCtx') || []).find((f) => f.name === 'rental_vault');
  assert.ok(vault && /rental_vault\.amount == 1/.test(vault.attrs), 'only an escrowed NFT can be rented');
  const start = fnBody(rental, 'start_handler');
  assert.ok(start.indexOf('PriceLimitExceeded') < start.indexOf('system_program::transfer'), 'fee ceiling before payment');
  assert.match(fnBody(rental, 'rental_fee_split'), /min\(RENTAL_MAX_OWNER_SPLIT_BPS\)/, 'legacy 100% splits are clamped');
  assert.match(fnBody(rental, 'revoke_handler'), /rental_refund\(/, 'early revocation refunds the unused time');
  assert.match(fnBody(core('lib.rs'), 'rental_start'), /err!\(AofError::FeatureDisabled\)/, 'unbounded rental_start stays fail-closed');
});

test('F-G auctions: bid floor, real increments, bounded duration, cancel without bids', () => {
  const auction = core('instructions/auction.rs');
  const create = fnBody(auction, 'create_handler');
  assert.match(create, /min_bid >= AUCTION_MIN_BID_LAMPORTS/);
  assert.match(create, /duration_seconds <= AUCTION_MAX_DURATION_SECONDS/);
  assert.match(fnBody(auction, 'bid_handler'), /next_min_bid\(/);
  const cancel = (sources.aof_core.structs.get('AuctionCancelCtx') || []).find((f) => f.name === 'auction');
  assert.ok(cancel && /auction\.current_bid == 0/.test(cancel.attrs), 'cancel only without bids');
  assert.ok(/auction\.seller == seller\.key\(\)/.test(cancel.attrs), 'only the seller cancels');
});

// ---------------------------------------------------------------- Second checklist (items 31-70)

test('#33 third-party payout destinations must be canonical ATAs', () => {
  const fields = [['AuctionSettleCtx', 'winner_token'], ['MatchResourceOrders', 'buyer_token'],
    ['CraftOrderFulfillCtx', 'creator_wood'], ['CraftOrderFulfillCtx', 'creator_stone']];
  for (const [ctx, field] of fields) {
    const f = (sources.aof_core.structs.get(ctx) || []).find((x) => x.name === field);
    assert.ok(f, `${ctx}.${field} not found`);
    assert.match(f.attrs, new RegExp(`is_canonical_ata\\(&${field}\\.key\\(\\), &${field}\\.owner`), `${ctx}.${field}`);
  }
  assert.match(fnBody(core('state.rs'), 'is_canonical_ata'), /get_associated_token_address\(owner, mint\)/);
});

test('#36 #37 F-06 Switchboard VRF: trusted program/queue, program-owned accounts, read-back reveal', () => {
  const vrf = core('vrf.rs');
  assert.match(fnBody(vrf, 'load_randomness'), /require_keys_eq!\(\*account\.owner, SWITCHBOARD_PROGRAM_ID/);
  const commit = fnBody(vrf, 'commit');
  for (const piece of ['!slot.retired', 'slot.lock, Pubkey::default()', 'before.authority, a.vrf_authority.key()',
    'before.queue, SWITCHBOARD_QUEUE', 'cpi_commit(', 'after.seed_slot == clock_slot - 1', 'slot.lock = holder']) {
    assert.ok(commit.includes(piece), `vrf::commit lost: ${piece}`);
  }
  assert.ok(commit.indexOf('cpi_commit(') < commit.indexOf('after.seed_slot'), 'the seed is read back after the CPI');
  const reveal = fnBody(vrf, 'reveal');
  for (const piece of ['reveal_window_open(commit_slot, clock_slot)', 'slot.lock, *holder', 'cpi_reveal(',
    'r.seed_slot == committed_seed_slot', 'r.reveal_slot == clock_slot', 'r.value == params.value', 'slot.lock = Pubkey::default()']) {
    assert.ok(reveal.includes(piece), `vrf::reveal lost: ${piece}`);
  }
  assert.match(fnBody(vrf, 'release_for_refund'), /refund_window_open\(commit_slot, clock_slot\)/);
  assert.match(fnBody(vrf, 'refund_window_open'), /!reveal_window_open/, 'reveal and refund windows never overlap');
  assert.match(vrf, /SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv|6, 115, 189, 70/, 'mainnet program id');
  assert.match(vrf, /A43DyUGA7s8eXPxqEjJY6EBu1KKbNgfxF8h17VAHn13w/, 'mainnet queue');
  assert.match(read('aof-core/Cargo.toml'), /^devnet = \[\]/m, 'devnet trust is an explicit build feature');
  assert.match(read('programs/aof-quests/Cargo.toml'), /^devnet = \[\]/m, 'devnet trust is an explicit build feature');
  // Pool accounts: randomness address and Switchboard authority are PDAs of the program.
  const add = configAttrs('VrfPoolAdd');
  assert.ok(add.length > 0);
  const poolAdd = sources.aof_core.structs.get('VrfPoolAdd');
  assert.match(poolAdd.find((f) => f.name === 'randomness').attrs, /seeds\s*=\s*\[VRF_RANDOMNESS_SEED/);
  assert.match(poolAdd.find((f) => f.name === 'vrf_authority').attrs, /seeds\s*=\s*\[VRF_AUTHORITY_SEED\]/);
  // Every VRF context binds the queue, the program and the slot to the commit.
  for (const [ctx, fields] of sources.aof_core.structs) {
    if (!fields.some((f) => f.name === 'switchboard_program')) continue;
    assert.match(fields.find((f) => f.name === 'switchboard_program').type, /Program<'info,\s*SwitchboardOnDemand>/, ctx);
    assert.match(fields.find((f) => f.name === 'queue').attrs, /address\s*=\s*crate::vrf::SWITCHBOARD_QUEUE/, ctx);
    const slot = fields.find((f) => f.name === 'vrf_slot');
    assert.ok(slot && /seeds\s*=\s*\[VRF_SLOT_SEED/.test(slot.attrs), `${ctx}.vrf_slot is not the canonical PDA`);
  }
});

test('#65 session keys (SPL delegates) are never stored in plaintext', () => {
  const ks = stripComments(read('aof_backend/src/lib/sessionKeys.ts'));
  assert.match(ks, /createCipheriv\("aes-256-gcm"/, 'authenticated encryption');
  assert.match(ks, /createDecipheriv\("aes-256-gcm"/, 'authenticated decryption');
  assert.match(ks, /setAuthTag\(/, 'GCM tag verified');
  assert.doesNotMatch(ks, /secretKey:\s*Array\.from/, 'no plaintext secret persistence');
  assert.match(ks, /SESSION_KEYSTORE_KEY is not configured/, 'fail closed without a key');
  assert.match(ks, /pk\.toBase58\(\) !== user/, 'canonical pubkey file names (no traversal)');
  assert.match(read('.github/workflows/ci.yml'), /npm run test:session-keystore/);
});

test('#66 no known-compromised @solana/web3.js release in any lockfile', () => {
  const compromised = new Set(['1.95.6', '1.95.7']);
  let checked = 0;
  for (const lock of ['package-lock.json', 'aof_backend/package-lock.json', 'frontend/package-lock.json']) {
    const packages = JSON.parse(read(lock)).packages || {};
    for (const [where, meta] of Object.entries(packages)) {
      if (!where.endsWith('node_modules/@solana/web3.js')) continue;
      checked += 1;
      assert.ok(!compromised.has(meta.version), `${lock}: ${where}@${meta.version} is the Dec-2024 key-stealing release`);
    }
  }
  assert.ok(checked >= 3, 'web3.js not found in the lockfiles');
});

test('#50 the frontend ships HSTS and an enforced baseline CSP', () => {
  const headers = read('frontend/public/_headers');
  assert.match(headers, /Strict-Transport-Security: max-age=\d+/);
  const csp = (headers.match(/^\s*Content-Security-Policy: (.+)$/m) || [])[1] || '';
  for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "script-src 'self'"]) {
    assert.ok(csp.includes(directive), directive);
  }
  assert.match(headers, /Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'/);
});
