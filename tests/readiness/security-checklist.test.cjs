'use strict';
/*
 * Source-level tripwires for SECURITY_CHECKLIST_REVIEW_2026-09-26.md.
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
        if (!ata) {
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
        assert.ok(own || byOthers || VALUE_ACCOUNTS.has(where), `${where}: unchecked account bound by nothing`);
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
  const TOOL_NFT = ['craft.rs', 'reroll.rs', 'mint_tool.rs', 'migrate_tool.rs'];
  // Randomness paths that stay behind FeatureDisabled / RandomnessDisabled.
  const DISABLED = ['exploration.rs', 'forge.rs', 'pack_open_reveal.rs', 'reroll_random.rs'];
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
  assert.equal(blocks.length, 7, 'MintTool, MigrateTool, Craft, Reroll, PackOpenCommit/Reveal, RerollRandomReveal');
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

test('#8 #10 #17 randomness-driven entry points stay disabled', () => {
  // Every commit AND every reveal/draw is gated on its own: re-enabling one
  // half of a commit-reveal pair is exactly the window the audit closed.
  const gated = [
    ['aof-core/src/instructions/exploration.rs', ['start_commit_handler', 'reveal_handler']],
    ['aof-core/src/instructions/forge.rs', ['commit_handler', 'reveal_handler']],
    ['aof-core/src/instructions/lottery.rs', ['buy_ticket_handler', 'commit_draw_handler', 'draw_handler']],
    ['aof-core/src/instructions/pack_open_commit.rs', ['handler']],
    ['aof-core/src/instructions/pack_open_reveal.rs', ['handler']],
    ['aof-core/src/instructions/reroll_random.rs', ['commit_handler', 'reveal_handler']],
    ['programs/aof-quests/src/instructions/drum/drum_commit.rs', ['handler']],
    ['programs/aof-rebirth/src/instructions/do_rebirth.rs', ['handler']],
  ];
  for (const [file, fns] of gated) {
    for (const fn of fns) {
      assert.match(
        fnBody(read(file), fn),
        /require!\(\s*false\s*,\s*\w+::(FeatureDisabled|RandomnessDisabled)\s*\)/,
        `${file}::${fn}: SlotHashes-based randomness is predictable; re-enabling needs a VRF/commit-reveal review`,
      );
    }
  }
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
  for (const [program, { code }] of Object.entries(sources)) {
    for (const [re, why] of banned) assert.doesNotMatch(code, re, `${program}: ${why}`);
  }
});

test('#18 no unbounded per-call input: collection arguments are allowlisted and bounded', () => {
  const allowed = new Map([
    ['aof_core::mint_tool.tool_type', 'canonicalised to TOOL_KINDS'],
    ['aof_core::craft.tool_type', 'canonicalised to TOOL_KINDS'],
    ['aof_core::reroll.new_type', 'canonicalised to TOOL_KINDS'],
    ['aof_core::migrate_tool.tool_type', 'tool_type.len() <= 32'],
    ['aof_quests::drum_reveal.secret', 'reveal of a disabled commit'],
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
  assert.match(stripComments(core('instructions/migrate_tool.rs')), /tool_type\.len\(\)\s*<=\s*32/);
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
  ];
  for (const [file, fn] of pinned) assert.match(fnBody(core(file), fn), /emit!\(/, `${file}::${fn}`);
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
