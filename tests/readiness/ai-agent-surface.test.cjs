// SECURITY_CHECKLIST_AI_AGENTS_2026-09-28.md (#71–#82): the parts of the
// AI-agent / audit-poisoning / signing-hygiene posture that can be enforced by
// a static check on every commit. Everything here runs offline in < 2 s.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '../..');
const run = (script, args = []) => spawnSync(process.execPath, [path.join(ROOT, script), ...args], { cwd: ROOT, encoding: 'utf8' });
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const walk = (dir, exts, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
};

test('#76/#77 no invisible or bidi Unicode in any tracked text file (prompt-injection / Trojan Source)', () => {
  const r = run('scripts/security/check-hidden-unicode.mjs', ['--quiet']);
  assert.equal(r.status, 0, `check-hidden-unicode found hidden code points:\n${r.stdout}${r.stderr}`);
});

test('#78/#79 agent instruction files and tool configs match security/agent-config.lock.json', () => {
  const r = run('scripts/security/agent-config-lock.mjs', ['--check']);
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  const lock = JSON.parse(read('security/agent-config.lock.json'));
  for (const must of ['opencode.json', 'docs/AI_AGENT_SECURITY_POLICY.md']) {
    assert.ok(lock.files[must], `${must} must be pinned in the agent config lock`);
  }
});

test('#78 the only agent provider config points at a local model; no remote MCP servers are wired in', () => {
  const cfg = JSON.parse(read('opencode.json'));
  assert.ok(!cfg.mcp && !cfg.mcpServers, 'MCP servers must be added through a reviewed policy change (docs/AI_AGENT_SECURITY_POLICY.md)');
  for (const [name, p] of Object.entries(cfg.provider || {})) {
    const url = p?.options?.baseURL || '';
    assert.match(url, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//, `provider ${name} must be local (got ${url})`);
  }
});

test('#82 no durable-nonce transactions anywhere in the client or backend (nonce = offline-signable drain)', () => {
  const files = [
    ...walk(path.join(ROOT, 'frontend/src'), ['.ts', '.tsx']),
    ...walk(path.join(ROOT, 'aof_backend/src'), ['.ts']),
    ...walk(path.join(ROOT, 'aof_backend/services'), ['.ts']),
    ...walk(path.join(ROOT, 'watchtower/src'), ['.ts']),
  ];
  const banned = /\b(nonceInfo|NonceAccount|nonceAdvance|advanceNonceAccount|createNonceAccount|nonceInitialize|NONCE_ACCOUNT_LENGTH)\b/;
  const hits = files.filter((f) => banned.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(hits, [], `durable nonce APIs found in: ${hits.join(', ')}`);
});

test('#82 the client transaction guard rejects every System Program instruction except transfer/create-mint (so AdvanceNonce cannot be smuggled)', () => {
  const guard = read('frontend/src/lib/txGuard.ts');
  assert.match(guard, /Unsupported System Program instruction/);
  assert.match(guard, /if \(opcode === 2 && ix\.data\.length === 12 && ix\.keys\[0\]\?\.equals\(user\)\) continue;/);
  assert.match(guard, /opcode !== 0 \|\| ix\.data\.length !== 52/);
});

test('#71/#75 no runtime code hands the authority key or a session key to an LLM/agent SDK', () => {
  const runtime = [
    ...walk(path.join(ROOT, 'aof_backend/src'), ['.ts']),
    ...walk(path.join(ROOT, 'aof_backend/services'), ['.ts']),
    ...walk(path.join(ROOT, 'watchtower/src'), ['.ts']),
    ...walk(path.join(ROOT, 'frontend/src'), ['.ts', '.tsx']),
  ];
  const sdk = /from ["'](openai|@anthropic-ai\/sdk|@google\/generative-ai|langchain|@langchain\/[^"']+|ai|@ai-sdk\/[^"']+|@modelcontextprotocol\/sdk)["']|require\(["'](openai|@anthropic-ai\/sdk|langchain)["']\)/;
  const hits = runtime.filter((f) => sdk.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
  assert.deepEqual(hits, [], `LLM/agent SDK imported by runtime code: ${hits.join(', ')} — agents must stay outside the signing boundary`);
  for (const pkg of ['aof_backend/package.json', 'frontend/package.json', 'watchtower/package.json']) {
    const deps = { ...(JSON.parse(read(pkg)).dependencies || {}) };
    for (const name of Object.keys(deps)) assert.ok(!/^(openai|@anthropic-ai\/|@google\/generative-ai|langchain|@langchain\/|@modelcontextprotocol\/)/.test(name), `${pkg} ships ${name} as a runtime dependency`);
  }
});

test('#73 farm-trader stays simulation-only and session-key spending stays disabled on-chain', () => {
  const executor = read('aof_backend/services/farm-trader/executor.ts');
  assert.match(executor, /ТОЛЬКО симуляция|simulation only/i);
  assert.doesNotMatch(executor, /sendTransaction|sendRawTransaction|signTransaction\(/);
  const sessionKeys = read('programs/aof-session-keys/src/lib.rs');
  assert.match(sessionKeys, /Session spending is disabled until atomically bound to a target instruction/);
});

test('#75 hot authority key is bounded by infrastructure, not by a prompt: gate + vault guard + issuance cap + circuit breaker exist and are wired', () => {
  const gate = read('aof_backend/src/security/authorityGate.ts');
  assert.match(gate, /AUTHORITY_MODE/);
  assert.match(gate, /read-only/);
  const state = read('aof-core/src/state.rs');
  assert.match(state, /pub struct VaultGuard/);
  assert.match(state, /pub fn charge_vault_withdrawal/);
  const server = read('aof_backend/src/server.ts');
  assert.match(server, /requireMappedWalletProof\(\)/);
  const security = read('aof_backend/src/middleware/security.ts');
  assert.match(security, /circuit/i);
});

test('/ready не печатает креденшелы RPC: ключ провайдера и userinfo маскируются', () => {
  const src = read('aof_backend/src/server.ts');
  assert.match(src, /export function redactSecrets\(text: string\): string/);
  assert.match(src, /error: redactSecrets\(String\(e\?\.message \|\| e\)\)/, '/ready обязан маскировать текст ошибки');
  // поведение самой функции: ключ в query и пароль в userinfo
  const body = /export function redactSecrets\(text: string\): string \{([\s\S]*?)\n\}/.exec(src)[1];
  const fn = new Function(`return (text) => {${body}}`)();
  assert.equal(fn('fetch failed: https://devnet.helius-rpc.com/?api-key=SECRET123&x=1'),
    'fetch failed: https://devnet.helius-rpc.com/?api-key=***&x=1');
  assert.equal(fn('https://user:pass@rpc.example.com/path'), 'https://user:***@rpc.example.com/path');
  assert.equal(fn('no secrets here'), 'no secrets here');
  // /ready обязан называть, куда ходит backend, но только схема+хост
  assert.match(src, /export function redactEndpoint\(url: string\): string/);
  assert.match(src, /rpcEndpoint: redactEndpoint\(RPC_URL\)/);
  const endBody = /export function redactEndpoint\(url: string\): string \{([\s\S]*?)\n\}/.exec(src)[1];
  const endpoint = new Function(`return (url) => {${endBody}}`)();
  assert.equal(endpoint('https://devnet.helius-rpc.com/?api-key=SECRET123'), 'https://devnet.helius-rpc.com');
  assert.equal(endpoint('not a url'), '<rpc>');
});

test('dev-local.sh печатает, куда backend пойдёт за сетью, и предупреждает о публичном RPC', () => {
  const src = read('scripts/dev-local.sh');
  assert.match(src, /masked_url\(\) \{/, 'нет маскирующей функции');
  assert.match(src, /backend_rpc_url\(\) \{/, 'не видно, откуда берётся RPC для backend');
  assert.match(src, /printf '   backend RPC: %s \(%s\)\\n' "\$\(masked_url "\$rpc_for_backend"\)"/);
  assert.match(src, /api\.devnet\.solana\.com\*\)/, 'нет предупреждения про публичный эндпоинт');
  // переменная окружения важнее файла: dotenv не перезаписывает уже заданные
  assert.match(src, /if \[ -n "\$\{RPC_URL:-\}" \]; then printf '%s' "\$RPC_URL"; return 0; fi/);
});
