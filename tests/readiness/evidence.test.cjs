const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const report = require('../../reports/aof-audit.json');
test('review cannot masquerade as a clean external rescan or accepted risk', () => {
  assert.equal(report.reportType, 'remediation-review-NOT-external-rescan');
  assert.equal(report.productionReady, false);
  assert.equal(report.findings.length, 17);
  assert.deepEqual(report.unresolvedBaselineBySeverity, { high: 11, low: 5, critical: 1 });
  assert.deepEqual(report.formalAcceptedRisks, []);
  for (const f of report.findings) {
    assert.equal(f.acceptedRisk, false);
    assert.equal(f.suppressed, false);
    assert.ok(f.reason && f.economicConsequence && f.blockingReason);
    assert.ok(fs.existsSync(path.join(__dirname, '../..', f.location.path)));
  }
  const baseline = fs.readFileSync(path.join(__dirname, '../../reports/aof-hub-baseline.json'));
  assert.equal(report.baselineSha256, createHash('sha256').update(baseline).digest('hex'));
});
