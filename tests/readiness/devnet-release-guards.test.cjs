const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync, mkdtempSync, chmodSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const root = join(__dirname, '../..');
const source = path => readFileSync(join(root, path), 'utf8');

test('paid Mind stays fail-closed; season purchase uses separate ledgers and remains UI-gated pending acceptance', () => {
  assert.match(source('aof_backend/src/routes/drum.ts'), /r\.post\("\/commit"[^\n]*\n\s*res\.status\(503\)/);
  assert.match(source('aof_backend/src/routes/quests.ts'), /r\.post\("\/config\/init"[^\n]*\n\s*res\.status\(503\)/);
  assert.match(source('aof_backend/src/routes/quests.ts'), /r\.post\("\/quest\/init"[^\n]*\n\s*res\.status\(503\)/);
  const seasonRoute = source('aof_backend/src/routes/season.ts');
  assert.match(seasonRoute, /r\.post\("\/pass\/purchase", requirePaidSeasonPassSales, requireWalletProof/);
  assert.match(seasonRoute, /SEASON_PREMIUM_CLAIMS_ACCOUNT_SIZE/);
  assert.match(seasonRoute, /coSignQuoted\(\[ix\], user/);
  assert.match(source('programs/aof-quests/src/instructions/drum/drum_commit.rs'), /pub fn handler[^\n]*\{[\s\S]{0,360}require!\(false, QuestError::Paused\)/);
  const v2 = source('programs/aof-quests/src/instructions/drum/mind_spin.rs');
  assert.match(v2, /pub fn commit_handler[^\n]*\{[\s\S]{0,500}require!\(false, QuestError::FeatureDisabled\)/);
  assert.match(v2, /seeds = \[COMMIT_SEED, user\.key\(\)\.as_ref\(\)\]/);
  assert.match(v2, /pub mind_commit: Account<'info, MindCommit>/);
  assert.match(v2, /mind_bank\.reserve\(ctx\.accounts\.mind_vault\.amount\)/);
  assert.match(v2, /mind_bank\.release\(ctx\.accounts\.mind_vault\.amount, MIND_SPIN_PRICE\)/);
  assert.doesNotMatch(v2, /DrumCommitted|DrumRevealed|DrumRefunded/);
  assert.match(source('programs/aof-quests/src/instructions/drum/mind_bank.rs'), /bank\.paused = true/);
  const seasonProgram = source('aof-core/src/instructions/season.rs');
  assert.match(seasonProgram, /require!\(false, AofError::SeasonPremiumRequired\)/,
    'direct on-chain pass purchases remain closed until the Devnet acceptance gate passes');
  assert.match(seasonProgram, /pub fn claim_premium_reward_handler/);
  assert.match(seasonProgram, /premium_claims\.claimed_bitmap/);
  assert.match(source('aof_backend/src/routes/drum.ts'), /r\.post\("\/reveal", requireWalletLimits/);
  assert.match(source('aof_backend/src/routes/drum.ts'), /r\.get\("\/status\/:user"/);
  assert.match(source('frontend/src/pages/profile/SeasonPassPage.tsx'), /const PAID_PASS_READY = false/);
  assert.doesNotMatch(source('frontend/src/components/DrumSpin.tsx'), /api\.drum\.commit\(/);
});

test('mining boots disabled and front/back check live on-chain availability', () => {
  assert.match(source('aof-core/src/instructions/initialize.rs'), /cfg\.mining_enabled = false/);
  assert.match(source('aof-core/src/instructions/collect_mining.rs'), /require!\(ctx\.accounts\.config\.mining_enabled/);
  assert.match(source('frontend/src/lib/useMiningAvailability.ts'), /config\?\.miningEnabled === true/);
  assert.match(source('aof_backend/src/routes/tools.ts'), /miningRewardMint\(toolData\.toolType, cfg, materials\)/);
  assert.match(source('aof_backend/src/routes/admin-config.ts'), /typeof req\.body\?\.enabled !== "boolean"/);
  assert.match(source('aof_backend/src/lib/configState.ts'), /cfg\?\.miningEnabled === true/);
  assert.match(source('scripts/verify-programs.sh'), /REQUIRE_BYTECODE=0/);
  assert.match(source('scripts/verify-programs.sh'), /if \(\( REQUIRE_BYTECODE \)\); then fail=1; fi/);
});

test('VIP season rollover and cosmetics require verified chain state, not stored preferences', () => {
  assert.doesNotMatch(source('frontend/src/pages/profile/SeasonPassPage.tsx'), /const SEASON_ID = 1/);
  assert.match(source('aof_backend/src/routes/vipStatus.ts'), /r\.get\("\/current"/);
  assert.match(source('aof_backend/src/routes/vipStatus.ts'), /seasonWindow\(data\.seasonId, data\.startTime/);
  assert.match(source('aof_backend/src/routes/vipStatus.ts'), /!process\.env\.EXPECTED_GENESIS_HASH/);
  assert.match(source('aof_backend/src/routes/vipStatus.ts'), /await assertExpectedCluster\(\)/);
  assert.match(source('frontend/src/lib/useVipStatus.ts'), /readActiveSeason\(await api\.season\.current\(\)\)/);
  assert.match(source('frontend/src/lib/useVipStatus.ts'), /readVipSnapshot\(await api\.season\.vipStatus\(user, season\.seasonId\)/);
  assert.match(source('frontend/src/lib/vipTheme.ts'), /if \(!verifiedVip \|\| !owner\) return null/);
});

test('strict bytecode gate rejects nonzero program padding (including with pipefail)', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'aof-bytecode-gate-'));
  try {
    mkdirSync(join(sandbox, 'bin'));
    mkdirSync(join(sandbox, 'programs/foo/src'), { recursive: true });
    mkdirSync(join(sandbox, 'target/deploy'), { recursive: true });
    writeFileSync(join(sandbox, 'Anchor.toml'), '[programs.devnet]\nfoo = "testProgramId"\n');
    writeFileSync(join(sandbox, 'programs/foo/src/lib.rs'), 'declare_id!("testProgramId");\n');
    writeFileSync(join(sandbox, 'target/deploy/foo.so'), 'TEST_PROGRAM_BYTES');
    const mock = join(sandbox, 'bin/solana');
    writeFileSync(mock, `#!/usr/bin/env bash
if [[ "$1 $2" == 'program show' ]]; then echo '{"authority":"expectedAuthority"}'; exit 0; fi
if [[ "$1 $2" == 'program dump' ]]; then
  python3 - "$4" "$PROGRAM_TAIL_MODE" <<'PY'
import sys
with open(sys.argv[1], 'wb') as f:
    f.write(b'TEST_PROGRAM_BYTES')
    f.write(b'\\0' * 200000)
    if sys.argv[2] == 'bad': f.write(b'X')
PY
  exit 0
fi
exit 1
`);
    chmodSync(mock, 0o755);
    const verify = (mode, cluster = 'devnet') => spawnSync('bash', [join(root, 'scripts/verify-programs.sh'), cluster, 'expectedAuthority', 'target/deploy', '--require-bytecode'], {
      cwd: sandbox, encoding: 'utf8', env: { ...process.env, PATH: join(sandbox, 'bin') + ':' + process.env.PATH, PROGRAM_TAIL_MODE: mode },
    });
    const zero = verify('zero');
    assert.equal(zero.status, 0, zero.stdout + zero.stderr);
    assert.match(zero.stdout, /bytecode verified on devnet/);
    const keyed = verify('zero', 'https://rpc.example.invalid/?api-key=DO_NOT_PRINT');
    assert.equal(keyed.status, 0, keyed.stdout + keyed.stderr);
    assert.match(keyed.stdout, /bytecode verified on rpc\.example\.invalid/);
    assert.doesNotMatch(keyed.stdout + keyed.stderr, /DO_NOT_PRINT|api-key=/,
      'custom RPC credentials must not appear in verifier output');
    const bad = verify('bad');
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    assert.match(bad.stdout, /MISMATCH\(trailing\)/);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
