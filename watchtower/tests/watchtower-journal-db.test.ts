/** Called ONLY by the backend's disposable SQLite/PostgreSQL integration runner.
 * Proves the real Prisma query/rebuild path, not devnet ingestion authenticity.
 */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resourceIssuanceJournal } from "../src/read-model";
import { EVENTS, SALT } from "./_fixtures";

export async function testIssuanceJournalDatabase(db: PrismaClient): Promise<void> {
  const event = EVENTS.find(e => e.eventType === "ResourceIssued")!;
  const data = event.data as Record<string, unknown>;
  const signature = `journal-itest:${event.signature}`; // synthetic, never sent to RPC
  const since = new Date("2100-01-01T00:00:00.000Z");
  const blockTime = new Date(since.getTime() + 1_000);
  const slot = BigInt(event.slot);
  const clear = async () => {
    await db.chainMintDelta.deleteMany({ where: { signature } });
    await db.chainEvent.deleteMany({ where: { signature } });
    await db.chainTx.deleteMany({ where: { signature } });
  };
  await clear();
  try {
    await db.$transaction(async tx => {
      await tx.chainTx.create({ data: { signature, slot, blockTime, success: true,
        feePayer: "fixture", programIds: JSON.stringify([event.programId]) } });
      await tx.chainEvent.create({ data: { signature, slot, blockTime, success: true,
        programId: event.programId, eventIndex: 0, eventType: event.eventType,
        mint: data.mint as string, data: JSON.stringify(data) } });
      await tx.chainMintDelta.create({ data: { signature, slot, blockTime,
        mint: data.mint as string, delta: data.gross as string } });
    });
    const deps = { db, salt: SALT, treasury: null, programIds: [event.programId] };
    const first = await resourceIssuanceJournal(deps, since);
    assert.equal(first.journals.length, 1);
    assert.equal(first.reconciliation[0].status, "matched");
    assert.equal(first.journals[0].postings.reduce((n, p) => n + BigInt(p.amount), 0n), 0n);
    const counts = [await db.chainTx.count(), await db.chainEvent.count(), await db.chainMintDelta.count()];
    assert.deepEqual(await resourceIssuanceJournal(deps, since), first, "rebuild from immutable rows must be deterministic");
    assert.deepEqual([await db.chainTx.count(), await db.chainEvent.count(), await db.chainMintDelta.count()], counts, "read-only projection must not persist writes");
    // Failed writes in an ingestion transaction leave NO partial event/delta.
    await assert.rejects(db.$transaction(async tx => {
      await tx.chainMintDelta.update({ where: { signature_mint: { signature, mint: data.mint as string } }, data: { delta: "1" } });
      throw new Error("simulated-ingestion-rollback");
    }), /simulated-ingestion-rollback/);
    assert.deepEqual(await resourceIssuanceJournal(deps, since), first);
    // Observed disagreement is surfaced, not patched by synthetic adjustments.
    await db.chainMintDelta.update({ where: { signature_mint: { signature, mint: data.mint as string } }, data: { delta: "1" } });
    const mismatch = await resourceIssuanceJournal(deps, since);
    assert.equal(mismatch.journals.length, 0);
    assert.equal(mismatch.reconciliation[0].status, "mismatch");
    assert.equal(mismatch.dataQuality, "unavailable");
    console.log("issuance journal DB integration: replay/rebuild, no writes, ingestion rollback and delta mismatch passed");
  } finally { await clear(); }
}
