/**
 * Pure-detector tests for src/lib/fraudSignals.ts (no database).
 * Run: npm run test:fraud-signals
 */
import assert from "node:assert/strict";
import {
  detectDeviceClusters, detectFreshWalletRewards, detectRewardVelocity, detectSharedFunding, detectWashTrades, SIGNAL_CONFIG,
} from "../src/lib/fraudSignals";

const now = new Date("2026-09-21T12:00:00Z");
const h = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600_000);
const reward = (wallet: string, hoursAgo: number, feePayer = "AUTH", signature = `${wallet}-${hoursAgo}-${Math.random()}`) =>
  ({ wallet, blockTime: h(hoursAgo), feePayer, signature });

// fresh wallet: 5 rewards within 2h of first sight → flagged; old wallet with same count → not.
{
  const rewards = [...Array(SIGNAL_CONFIG.FRESH_WALLET_MIN_REWARDS)].map((_, i) => reward("fresh", i * 0.1));
  const old = [...Array(SIGNAL_CONFIG.FRESH_WALLET_MIN_REWARDS)].map((_, i) => reward("old", i * 0.1));
  const f = detectFreshWalletRewards([...rewards, ...old], [{ wallet: "fresh", firstSeen: h(2) }, { wallet: "old", firstSeen: h(24 * 30) }], now);
  assert.deepEqual(f.map((x) => x.wallet), ["fresh"]);
  assert.equal(f[0].signal, "fresh_wallet_reward");
  assert.equal(f[0].evidence.walletAgeHours, 2);
  // one fewer reward → below threshold
  assert.equal(detectFreshWalletRewards(rewards.slice(1), [{ wallet: "fresh", firstSeen: h(2) }], now).length, 0);
  // wallet with no first-seen record (not yet in ledger) is skipped, not flagged blindly
  assert.equal(detectFreshWalletRewards(rewards, [], now).length, 0);
}

// velocity: threshold per hour over the window; severity escalates at 3x.
{
  const perHour = SIGNAL_CONFIG.VELOCITY_PER_HOUR;
  const okRows = [...Array(perHour * 2 - 1)].map((_, i) => reward("calm", i * 0.01));
  const hot = [...Array(perHour * 2)].map((_, i) => reward("hot", i * 0.01));
  const burst = [...Array(perHour * 2 * 3)].map((_, i) => reward("burst", i * 0.01));
  const f = detectRewardVelocity([...okRows, ...hot, ...burst], 2);
  assert.deepEqual(f.map((x) => [x.wallet, x.severity]).sort(), [["burst", 3], ["hot", 2]]);
  assert.equal(f.find((x) => x.wallet === "hot")!.score, perHour);
  assert.ok(f[0].evidence.signatures.length <= 20, "evidence is capped");
}

// shared funding: backend authority as payer is normal; a third-party payer funding N wallets is not.
{
  const n = SIGNAL_CONFIG.SHARED_PAYER_MIN_WALLETS;
  const viaAuthority = [...Array(n + 2)].map((_, i) => reward(`w${i}`, 1, "AUTH"));
  const viaFarm = [...Array(n)].map((_, i) => reward(`f${i}`, 1, "FARMER"));
  const selfPaid = [...Array(n)].map(() => reward("FARMER", 1, "FARMER")); // payer == recipient does not count
  const f = detectSharedFunding([...viaAuthority, ...viaFarm, ...selfPaid], new Set(["AUTH"]));
  assert.equal(f.length, n);
  assert.ok(f.every((x) => x.signal === "shared_funding" && x.evidence.feePayer === "FARMER" && x.evidence.clusterSize === n));
  assert.equal(detectSharedFunding(viaFarm.slice(1), new Set(["AUTH"])).length, 0);
}

// device cluster
{
  const n = SIGNAL_CONFIG.DEVICE_CLUSTER_MIN_USERS;
  const rows = [
    ...[...Array(n)].map((_, i) => ({ fingerprint: "fp-shared-abcdefghijklmnop", user: `u${i}` })),
    { fingerprint: "fp-shared-abcdefghijklmnop", user: "u0" }, // duplicate row, same user → not double counted
    { fingerprint: "fp-solo", user: "solo" },
    ...[...Array(n - 1)].map((_, i) => ({ fingerprint: "fp-small", user: `s${i}` })),
  ];
  const f = detectDeviceClusters(rows);
  assert.equal(f.length, n);
  assert.equal(f[0].evidence.fingerprint, "fp-shared-ab", "fingerprint is truncated in evidence");
  assert.equal(f[0].evidence.clusterSize, n);
}

// wash trading: needs round trips in both directions; one-directional volume is not flagged.
{
  const n = SIGNAL_CONFIG.WASH_MIN_ROUND_TRIPS;
  const t = (seller: string, buyer: string, i: number) => ({ signature: `${seller}${buyer}${i}`, seller, buyer, blockTime: h(i) });
  const wash = [...[...Array(n)].map((_, i) => t("A", "B", i)), ...[...Array(n + 1)].map((_, i) => t("B", "A", i))];
  const oneWay = [...Array(n * 4)].map((_, i) => t("C", "D", i));
  const selfTrade = [...Array(n * 4)].map((_, i) => t("E", "E", i));
  const f = detectWashTrades([...wash, ...oneWay, ...selfTrade]);
  assert.deepEqual(f.map((x) => x.wallet).sort(), ["A", "B"]);
  assert.equal(f[0].score, n);
  assert.equal(f.find((x) => x.wallet === "A")!.evidence.counterparty, "B");
  assert.equal(detectWashTrades(wash.slice(1)).length, 0, "n-1 round trips is below threshold");
}

// No detector ever produces an enforcement field.
{
  const f = detectRewardVelocity([...Array(1000)].map((_, i) => reward("x", i * 0.001)), 1);
  for (const x of f) assert.deepEqual(Object.keys(x).sort(), ["evidence", "score", "severity", "signal", "wallet"]);
}

console.log("fraud signal tests: fresh-wallet, velocity, shared funding, device cluster, wash trading detectors passed (review-only, no enforcement)");
