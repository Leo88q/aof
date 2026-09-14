import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { sessionProgram } from "../provider";
import { sessionConfigPda, trustSnapshotPda } from "../lib/pda";
import { authorityOnly, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

// A local/partial trust calculation must not be exposed as a privilege score.
r.get("/leaderboard", (_req, res) => {
  res.status(503).json({
    error: "TRUST_LEADERBOARD_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
  });
});

r.get("/:user", (_req, res) => {
  res.status(503).json({
    error: "TRUST_PROFILE_UNAVAILABLE_UNTIL_CANONICAL_INDEXING_IS_DEPLOYED",
  });
});

// Обновление ончейн-снапшота (вызывается воркером от имени authority)
r.post("/snapshot/update", requireAdmin, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const score = Number(req.body.score);
    const tier = Number(req.body.tier);
    const epoch = new (require("bn.js"))(req.body.epoch ?? Math.floor(Date.now() / 86400000));
    if (!Number.isInteger(score) || score < 0 || score > 1000) {
      return res.status(400).json({ error: "score must be an integer from 0 to 1000" });
    }
    if (!Number.isInteger(tier) || tier < 1 || tier > 5) {
      return res.status(400).json({ error: "tier must be an integer from 1 to 5" });
    }

    const [config] = sessionConfigPda();
    const [trust] = trustSnapshotPda(user);

    const ix = await (sessionProgram.methods as any)
      .trustSnapshotUpdate(score, tier, epoch)
      .accounts({
        config,
        oracleAuthority: AUTHORITY.publicKey,
        user,
        trust,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
