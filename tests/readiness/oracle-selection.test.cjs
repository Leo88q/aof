const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'aof_backend/src/lib/vrf.ts'), 'utf8');

function extract(name) {
  const start = source.indexOf(`export function ${name}`);
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
  const stripped = ['oracleEligible', 'oracleRejectionReasons', 'forRandomnessSelection', 'chooseOracle', 'majorityVersion', 'pickOracle']
    .map(extract)
    .join('\n')
    .replace(/export /g, '')
    .replace(/: OracleCandidate\[\]|: OracleCandidate|: string\[\]|: boolean|: string \| null|: \(\) => number = Math\.random|: PublicKey/g, '')
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
