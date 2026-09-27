import { Router } from "express";
import { EventParser } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { questsProgram, connection } from "../provider";
import { drumCommitPda, questConfigPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, drumOutcomeFromLogs, DrumOutcome, selfSettleTransaction } from "../lib/vrfSettlement";

/**
 * [F-06] Drum of Luck on the aof-quests randomness pool. The spin costs 5
 * mascots (to the treasury at commit); the prize is fixed by Switchboard and
 * paid by the permissionless reveal; an unrevealed spin is refunded.
 */
const r = Router();

r.post("/commit", requireCircuitOpen, requireWalletLimits("drum_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [drumCommit] = drumCommitPda(user);
    const [questConfig] = questConfigPda();
    const config: any = await (questsProgram.account as any).questConfig.fetch(questConfig);
    const slot = await reservePoolSlot(questsProgram, connection);
    const vrf = await vrfCommitAccounts(questsProgram, connection, slot);

    const ix = await (questsProgram.methods as any)
      .drumCommit()
      .accounts({
        drumCommit,
        questConfig,
        user,
        treasuryMascot: config.treasuryMascot,
        userMascot: getAssociatedTokenAddressSync(config.mascotMint, user),
        ...vrf,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx, drumCommit: drumCommit.toBase58() });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
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
r.post("/reveal", requireCircuitOpen, requireWalletLimits("drum_reveal"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    res.json(await selfSettleTransaction("drum", drumCommitPda(user)[0], user));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

export default r;
