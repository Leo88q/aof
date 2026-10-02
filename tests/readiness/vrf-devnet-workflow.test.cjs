const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('ordinary pushes and scheduled VRF checks cannot submit devnet transactions', () => {
  const workflow = read('.github/workflows/vrf-devnet-probe.yml');
  assert.match(workflow, /on:\s*\n  push:\s*\n    paths:/);
  assert.match(workflow, /workflow_dispatch:\s*\n    inputs:[\s\S]*?allow_devnet_transactions:[\s\S]*?type: boolean[\s\S]*?default: false/);

  const guardStart = workflow.indexOf('      - name: Fail-closed report when no explicit manual opt-in was supplied');
  const walletStart = workflow.indexOf('      - name: Require the explicit funded probe wallet');
  const probeStart = workflow.indexOf('      - name: Probe (manual opt-in only; submits devnet transactions)');
  const publishStart = workflow.indexOf('      - name: Publish report');
  assert.ok(guardStart >= 0 && guardStart < walletStart && walletStart < probeStart && probeStart < publishStart,
    'workflow must report skip, require funding, then gate the sole transaction step');

  const skipStep = workflow.slice(guardStart, walletStart);
  assert.match(skipStep, /if: \$\{\{ github\.event_name != 'workflow_dispatch' \|\| inputs\.allow_devnet_transactions != true \}\}/);
  assert.match(skipStep, /# SKIPPED — no devnet transactions authorized/);

  const fundedWalletStep = workflow.slice(walletStart, probeStart);
  assert.match(fundedWalletStep, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.allow_devnet_transactions == true \}\}/);
  assert.match(fundedWalletStep, /DEVNET_PROBE_KEYPAIR: \$\{\{ secrets\.DEVNET_PROBE_KEYPAIR \}\}/);
  assert.match(fundedWalletStep, /if \[ -z "\$DEVNET_PROBE_KEYPAIR" \][\s\S]*?exit 1/);

  const probeStep = workflow.slice(probeStart, publishStart);
  assert.match(probeStep, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.allow_devnet_transactions == true \}\}/);
  assert.match(probeStep, /run: npx ts-node --project tsconfig\.json --transpile-only scripts\/vrfDevnetProbe\.ts/);
  assert.match(probeStep, /DEVNET_PROBE_KEYPAIR: \$\{\{ secrets\.DEVNET_PROBE_KEYPAIR \}\}/);
  assert.match(workflow, /npm ci --ignore-scripts/);
});
