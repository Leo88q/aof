import { Router } from "express";
import { EventParser } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { questsProgram, connection } from "../provider";
import { drumCommitPda } from "../lib/pda";
import { pk } from "../lib/tx";
import { requireWalletLimits } from "../middleware/security";
import { commitStatus, drumOutcomeFromLogs, DrumOutcome, selfSettleTransaction } from "../lib/vrfSettlement";

/**
 * Quest drum: new payments are blocked. Existing commitments remain
 * settleable/refundable through the permissionless reveal instruction.
 */
const r = Router();

// Potato is a future external SPL mint, NOT the internal MIND mint. The
// deployed quest program uses raw atomic amounts. Do not accept a new payment
// until a decimals-aware, audited deployment and fully funded treasury exist.
r.post("/commit", (_req, res) => {
  res.status(503).json({ error: "Potato spin payments are not configured; pending spins can still be revealed or refunded." });
});

/** Outcome of the player's latest spin (newest transaction of the commit PDA first). */
async function latestDrumOutcome(drumCommit: PublicKey): Promise<DrumOutcome> {
  const parser = new EventParser(questsProgram.programId, questsProgram.coder);
  const signatures = await connection.getSignaturesForAddress(drumCommit, { limit: 10 }, "confirmed");
  for (const s of signatures) {
    if (s.err) continue;
    const tx = await connection.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    const logs = tx?.meta?.logMessages;
    if (!logs) continue;
    const outcome = drumOutcomeFromLogs(logs, s.signature, parser);
    if (outcome === "committed") break; // newest spin has no settlement yet
    if (outcome) return outcome;
  }
  return { state: "none" };
}

r.get("/status/:user", async (req, res) => {
  try {
    const [drumCommit] = drumCommitPda(new PublicKey(req.params.user));
    const status = await commitStatus("drum", drumCommit);
    // The drum pays mascots instead of minting an NFT: once the commit is
    // closed the result is only in the events of its transactions.
    res.json(status.state === "pending" ? status : await latestDrumOutcome(drumCommit));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Transaction for the player to settle (or after the window refund) their spin. */
r.post("/reveal", requireWalletLimits("drum_reveal"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    res.json(await selfSettleTransaction("drum", drumCommitPda(user)[0], user));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

export default r;
