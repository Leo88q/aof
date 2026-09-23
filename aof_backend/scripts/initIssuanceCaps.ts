import "dotenv/config";
/**
 * One-time bootstrap of on-chain issuance caps for every ResourceKind.
 *
 * mint_resource / mint_resource_once are fail-closed: a kind without an
 * initialised `issuance_cap` PDA cannot be minted at all. Run this right after
 * deploying the program build that introduces caps and BEFORE the backend is
 * restarted on it, otherwise inbox claims start failing with
 * AccountNotInitialized.
 *
 * Usage:
 *   CAP_PER_EPOCH=<base units> [EPOCH_SLOTS=216000] [KINDS=food,wood] [DRY_RUN=1] \
 *     npm run caps:init
 *
 * Per-kind overrides: CAP_<KIND>=<base units>, e.g. CAP_POTATO=5000000000000.
 * Already-initialised kinds are skipped (idempotent; use /admin/issuance-caps/set to change).
 */
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { AUTHORITY } from "../src/config";
// [AUDIT AOF-H1] bootstrap scripts need a hot authority key by design;
// refuse to run (loudly) under AUTHORITY_MODE=read-only.
if (!AUTHORITY) {
  throw new Error(
    "Deploy script requires AUTHORITY_MODE=hot + AUTHORITY_SECRET_KEY [AOF-H1]; "
    + "read-only mode cannot bootstrap programs.",
  );
}

import { connection, program } from "../src/provider";
import { configPda, issuanceCapPda, RESOURCE_KIND_ORDER } from "../src/lib/pda";
import { authorityOnly } from "../src/lib/tx";

const SLOTS_PER_DAY = 216_000;

async function main() {
  const defaultCap = process.env.CAP_PER_EPOCH;
  const epochSlots = new BN(process.env.EPOCH_SLOTS ?? String(SLOTS_PER_DAY));
  const only = process.env.KINDS ? new Set(process.env.KINDS.split(",").map((s) => s.trim())) : null;
  const dryRun = process.env.DRY_RUN === "1";
  const [config] = configPda();

  let done = 0, skipped = 0;
  for (const kind of RESOURCE_KIND_ORDER) {
    if (only && !only.has(kind)) continue;
    const override = process.env[`CAP_${kind.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase()}`];
    const capRaw = override ?? defaultCap;
    if (!capRaw) throw new Error(`no cap for ${kind}: set CAP_PER_EPOCH or CAP_${kind.toUpperCase()}`);
    const cap = new BN(capRaw);
    if (cap.lten(0)) throw new Error(`cap for ${kind} must be > 0 (use /admin/issuance-caps/set with 0 to halt)`);
    const [pda] = issuanceCapPda(kind);
    if (await connection.getAccountInfo(pda)) {
      console.log(`skip ${kind}: already initialised (${pda.toBase58()})`);
      skipped++;
      continue;
    }
    console.log(`${dryRun ? "[dry-run] " : ""}init ${kind}: cap=${cap.toString()} epochSlots=${epochSlots.toString()} pda=${pda.toBase58()}`);
    if (dryRun) continue;
    const ix = await (program.methods as any)
      .initIssuanceCap({ [kind]: {} }, epochSlots, cap)
      .accounts({ config, authority: AUTHORITY.publicKey, issuanceCap: pda, systemProgram: SystemProgram.programId })
      .instruction();
    const sig = await authorityOnly([ix]);
    console.log(`  ok ${sig}`);
    done++;
  }
  console.log(`initialised=${done} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
