/**
 * Writes events/fixtures/* from tests/_fixtures.ts through the normalizer.
 *   ts-node tests/_fixtures.gen.ts          # regenerate
 *   ts-node tests/_fixtures.gen.ts --check  # fail if committed fixtures are stale (CI)
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EVENTS, TXS, SALT, W } from "./_fixtures";
import { normalizeChainEvent, normalizeChainTx } from "../src/event-normalizer";

const dir = join(__dirname, "..", "events", "fixtures");
const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2) + "\n";
const files: Record<string, string> = {
  "chain-events.input.json": ser({ note: "ChainEvent rows as written by aof_backend/services/chain-indexer (synthetic deterministic wallets/mints)", salt: SALT, rows: EVENTS }),
  "chain-txs.input.json": ser({ note: "ChainTx rows: one ok, one failed with custom error 6098 (IssuanceCapExceeded)", rows: TXS }),
  "watchtower-events.expected.json": ser({ parserVersion: "aof-v1", events: [...TXS.flatMap((t) => normalizeChainTx(t, SALT)), ...EVENTS.flatMap((e) => normalizeChainEvent(e, SALT, { treasury: W.treasury }))] }),
};
if (process.argv.includes("--check")) {
  const stale = Object.entries(files).filter(([f, c]) => !existsSync(join(dir, f)) || readFileSync(join(dir, f), "utf8") !== c).map(([f]) => f);
  if (stale.length) { console.error("stale fixtures (run tests/_fixtures.gen.ts):", stale.join(", ")); process.exit(1); }
  console.log("watchtower fixtures up to date");
} else {
  mkdirSync(dir, { recursive: true });
  for (const [f, c] of Object.entries(files)) writeFileSync(join(dir, f), c);
  console.log("fixtures written:", Object.keys(files).join(", "));
}
