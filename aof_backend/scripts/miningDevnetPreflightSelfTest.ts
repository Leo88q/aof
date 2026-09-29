import { strict as assert } from 'assert';
import { spawn } from 'child_process';
import { createServer } from 'http';
import { once } from 'events';

// Local JSON-RPC fixture proves a non-devnet endpoint is rejected before
// fetching any program account. This never signs or transmits a transaction.
const server = createServer(async (req, res) => {
  let input = '';
  for await (const chunk of req) input += String(chunk);
  const request = JSON.parse(input);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: 'not-the-devnet-genesis' }));
});

async function main() {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  try {
    const child = spawn(process.execPath, [require.resolve('ts-node/dist/bin.js'), '--project', 'tsconfig.json', '--transpile-only', 'scripts/miningDevnetPreflight.ts'], {
      cwd: process.cwd(), env: { ...process.env, DEVNET_RPC_URL: `http://127.0.0.1:${port}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    const timer = setTimeout(() => child.kill(), 12_000);
    const [status] = await once(child, 'exit');
    clearTimeout(timer);
    assert.equal(status, 1, stderr);
    const report = JSON.parse(stdout);
    assert.equal(report.status, 'BLOCKED');
    assert.ok(report.blockers.includes('wrong_cluster_genesis'));
    assert.equal(report.observations.genesisHash, 'not-the-devnet-genesis');
    assert.equal(report.observations.config, undefined);
    console.log('Read-only preflight rejects wrong cluster without fetching user accounts or signing');
  } finally {
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
