const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'aof_backend/src/lib/vrf.ts'), 'utf8');

function extract(name) {
  const asyncAt = source.indexOf(`export async function ${name}`);
  const start = asyncAt >= 0 ? asyncAt : source.indexOf(`export function ${name}`);
  assert.ok(start >= 0, name);
  let depth = 0;
  let seen = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; seen = true; }
    else if (source[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

test('капсула берёт свежий оракул случайности даже без pull-фида', async () => {
  assert.match(source, /return chooseOracle\(oracleCache!\.candidates\)/);
  const stripped = ['oracleEligible', 'oracleRejectionReasons', 'oracleSelectionSummary', 'forRandomnessSelection', 'chooseOracle', 'majorityVersion', 'pickOracle']
    .map(extract)
    .join('\n')
    .replace(/export /g, '')
    .replace(/: OracleCandidate\[\]|: OracleCandidate|: string\[\]|: boolean|: string \| null|: \(\) => number = Math\.random|: PublicKey|: string|: number/g, '')
    .replace(/new Map<[^>]+>/g, 'new Map');
  const file = path.join(os.tmpdir(), 'aof-oracle-selection.mjs');
  fs.writeFileSync(file, `${stripped}\nfunction vrfUnavailable(reason) { const error = new Error(reason); error.status = 503; return error; }\nexport { oracleEligible, chooseOracle };\n`);
  const mod = await import(file);
  const fresh = {
    oracle: 'oracle-a',
    gatewayUrl: 'https://oracle.example',
    isOnQueue: true,
    isVerified: true,
    heartbeatFresh: true,
    quoteFresh: true,
    liveHealthy: true,
    restricted: false,
    gatewayEnabled: true,
    pullOracleEnabled: false,
  };
  assert.equal(mod.oracleEligible(fresh), false);
  assert.equal(mod.chooseOracle([fresh], () => 0), 'oracle-a');
  assert.throws(() => mod.chooseOracle([{ ...fresh, heartbeatFresh: false }], () => 0), /VRF_ORACLE_UNAVAILABLE/);
});

test('свежий on-chain оракул читается без опроса шлюза', async () => {
  const inspect = extract('inspectOracles');
  assert.doesNotMatch(inspect, /inspectRandomnessOracles/);
  assert.match(source, /inspectOraclesFromChain/);
  assert.match(fs.readFileSync(path.join(root, 'aof_backend/src/routes/packs.ts'), 'utf8'), /releasePoolSlot\(slot\)/);

  const layoutStart = source.indexOf('const SWITCHBOARD_ORACLE_DISCRIMINATOR');
  const layoutEnd = source.indexOf('async function inspectOraclesFromChain');
  assert.ok(layoutStart > 0 && layoutEnd > layoutStart);
  const layout = source.slice(layoutStart, layoutEnd)
    .replace(/export /g, '')
    .replace(/ as const/g, '')
    .replace(/type ChainOracleFields = \{[\s\S]*?\};\n/, '')
    .replace(/: Buffer\[\]|: Buffer(?=\s*[,)\n\r])|: ChainOracleFields \| null|: ChainOracleFields|: PublicKey|: bigint|: OracleCandidate|: ArrayLike<number>|: URL/g, '')
    .replace(/\): \{[^}]*\} \{/g, ') {')
    .replace(/\): [^{]+\{/g, ') {');
  const helpers = ['gatewayUrlFromBytes', 'oracleEligible', 'oracleRejectionReasons', 'forRandomnessSelection', 'oracleSelectionSummary', 'majorityVersion', 'pickOracle', 'chooseOracle']
    .map(extract)
    .join('\n')
    .replace(/export /g, '')
    .replace(/: OracleCandidate\[\]|: OracleCandidate|: string\[\]|: boolean|: string \| null|: \(\) => number = Math\.random|: PublicKey|: string|: number|: ArrayLike<number>|: URL/g, '')
    .replace(/new Map<[^>]+>/g, 'new Map');
  const file = path.join(os.tmpdir(), 'aof-chain-oracle.mjs');
  fs.writeFileSync(file, `
class PublicKey {
  constructor(value) { this.bytes = Buffer.from(value); }
  toBuffer() { return this.bytes; }
  equals(other) { return this.bytes.equals(other.toBuffer()); }
}
${layout}
${helpers}
function vrfUnavailable(reason) { const error = new Error(reason); error.status = 503; return error; }
export { parseChainQueue, parseChainOracle, chainOracleCandidate, chooseOracle };
`);
  const mod = await import(file);
  const queueKey = Buffer.alloc(32, 7);
  const oracleKey = Buffer.alloc(32, 9);
  const now = 1_700_000_000n;
  const queue = Buffer.alloc(5208);
  queue.set([217, 194, 55, 127, 184, 83, 138, 1]);
  queue.set(oracleKey, 1064);
  queue.writeBigInt64LE(300n, 5176);
  queue.writeUInt32LE(1, 5204);
  const parsedQueue = mod.parseChainQueue(queue);
  assert.equal(parsedQueue.nodeTimeout, 300n);
  assert.equal(parsedQueue.oracleKeys.length, 1);

  const account = Buffer.alloc(3657);
  account.set([128, 30, 16, 241, 170, 73, 55, 54]);
  account[72] = 4;
  account.writeBigInt64LE(now + 3600n, 88);
  account.set(queueKey, 3472);
  account.writeBigInt64LE(now - 30n, 3512);
  account.set(Buffer.from('https://oracle.example'), 3584);
  account[3656] = 1;
  const fields = mod.parseChainOracle(account);
  assert.equal(fields.gatewayUrl, 'https://oracle.example');
  assert.equal(fields.verified, true);
  const oracle = { bytes: oracleKey };
  const candidate = mod.chainOracleCandidate(oracle, fields, { toBuffer: () => queueKey }, 300n, now);
  assert.equal(candidate.heartbeatFresh, true);
  assert.equal(candidate.quoteFresh, true);
  assert.equal(candidate.isOnQueue, true);
  assert.equal(mod.chooseOracle([candidate], () => 0), oracle);

  account.writeBigInt64LE(now - 10_000n, 3512);
  const stale = mod.chainOracleCandidate(
    oracle,
    mod.parseChainOracle(account),
    { toBuffer: () => queueKey },
    300n,
    now,
  );
  assert.equal(stale.heartbeatFresh, false);
  assert.throws(() => mod.chooseOracle([stale], () => 0), /VRF_ORACLE_UNAVAILABLE/);
});
