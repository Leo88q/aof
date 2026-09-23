import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { coverage, windowQuality, type ReadModelDeps } from "../src/read-model";
import { domainQuality, liveQuality } from "../src/data-quality";

async function main() {
  const cursors = [{ programId: "core", backfillComplete: true, newestSlot: 9n, updatedAt: new Date(), lastError: null }];
  let newest: any = { slot: 9n, blockTime: new Date() };
  const deps = { programIds: ["core"], db: {
    indexerCursor: { findMany: async () => cursors },
    chainTx: { findFirst: async () => newest },
  } } as unknown as ReadModelDeps;
  assert.equal((await coverage(deps)).quality, "complete");
  deps.programIds.push("missing");
  assert.equal((await coverage(deps)).quality, "unavailable");
  deps.programIds.pop();
  cursors[0].updatedAt = new Date(Date.now() - 11 * 60_000);
  const stale = await coverage(deps);
  assert.equal(stale.quality, "unavailable");
  assert.equal(windowQuality(stale, new Date()), "unavailable");
  cursors[0].updatedAt = new Date();
  cursors[0].backfillComplete = false;
  assert.equal((await coverage(deps)).quality, "partial");
  newest = null;
  assert.equal((await coverage(deps)).quality, "unavailable");
  deps.programIds = [];
  assert.equal((await coverage(deps)).quality, "unavailable");
  assert.equal(liveQuality("complete", "mock"), "unavailable");
  for (const status of Object.values(domainQuality("complete", "mock", true))) {
    assert.equal(status.dataQuality, "unavailable"); assert.ok(status.reason);
  }
  for (const status of Object.values(domainQuality("complete", "indexer", true))) {
    assert.equal(status.dataQuality, "partial"); assert.ok(status.reason);
  }
  assert.equal(domainQuality("complete", "indexer", false).players.dataQuality, "unavailable");
  const source = readFileSync(join(__dirname, "../src/watchtower-exporter.ts"), "utf8");
  const routes = [...source.matchAll(/^  "(\/watchtower\/[^\"]+)":/gm)].map(m => m[1]);
  assert.equal(routes.length, 14);
  assert.equal(new Set(routes).size, 14);
  console.log("watchtower-quality: empty/missing/stale/mock/salt cases fail closed; 14 unique routes");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
