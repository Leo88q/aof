#!/usr/bin/env node
// Read-only JSON-RPC probe. Never writes to chain or loads a signer.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';
async function verify(registry, rpc) {
  const result = { gameId: 'aof', network: 'devnet', checkedAt: new Date().toISOString(), writes: false,
    deploymentMatchesSource: false, custodyVerified: false, status: 'unavailable', programs: [], error: null };
  try {
    const genesis = await rpc('getGenesisHash', []);
    if (genesis !== 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG7') throw new Error('wrong_cluster');
    const response = await rpc('getMultipleAccounts', [registry.programs.map(p => p.address), { encoding: 'base64', commitment: 'finalized' }]);
    if (!Array.isArray(response?.value) || response.value.length !== registry.programs.length) throw new Error('invalid_rpc_response');
    result.slot = response.context?.slot ?? null;
    result.programs = registry.programs.map((p, i) => {
      const a = response.value[i];
      return { name: p.name, address: p.address, status: !a ? 'missing' : a.executable === true && a.owner === LOADER ? 'executable-reference' : 'invalid_program',
        upgradeAuthorityVerified: false, bytecodeVerified: false };
    });
    result.status = result.programs.every(p => p.status === 'executable-reference') ? 'references-observed' : 'incomplete';
  } catch (err) {
    // Never persist provider URLs/errors which might contain API keys.
    result.error = ['wrong_cluster', 'invalid_rpc_response'].includes(err.message) ? err.message : 'rpc_unreachable_or_rejected';
  }
  return result;
}
module.exports = { verify };
if (require.main === module) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'watchtower/addresses.json')));
  const rpc = async (method, params) => {
    const response = await fetch(process.env.AOF_READONLY_RPC_URL || 'https://api.devnet.solana.com', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('rpc_http_error');
    const body = await response.json();
    if (body.error) throw new Error('rpc_error');
    return body.result;
  };
  verify(registry, rpc).then(result => {
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    fs.writeFileSync(path.join(root, 'reports/aof-rpc.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'references-observed') process.exitCode = 1;
  });
}
