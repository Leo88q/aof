import { Router } from "express";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AUTHORITY_PUBKEY } from "../config";
import { program, questsProgram, connection } from "../provider";
import { configPda, questConfigPda } from "../lib/pda";
import { authorityOnly } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";
import { evaluatePool, listPoolSlots, switchboardCluster, vrfComputeBudget, vrfPoolAddAccounts } from "../lib/vrf";
import { commitPhase, listPendingCommits, MECHANICS } from "../lib/vrfSettlement";

/**
 * [F-06] Switchboard pool operations and read models.
 *   GET  /vrf/health            pool health of both programs (the commit
 *                               routes refuse new commits while unhealthy)
 *   GET  /vrf/pending?user=...  a wallet's unsettled commits (self-settle UI)
 *   POST /vrf/pool/add          admin: grow a pool by `count` accounts
 *   POST /vrf/pool/retire       admin: retire / re-enable a free slot
 */
const r = Router();
const programs = { core: program, quests: questsProgram } as const;
type PoolName = keyof typeof programs;

function poolName(value: unknown): PoolName {
  if (value === "core" || value === "quests") return value;
  throw new Error("program must be core or quests");
}

r.get("/health", async (_req, res) => {
  try {
    const currentSlot = await connection.getSlot("confirmed");
    const out: Record<string, unknown> = { cluster: switchboardCluster(), currentSlot };
    for (const [name, prog] of Object.entries(programs)) {
      out[name] = evaluatePool(await listPoolSlots(prog), currentSlot);
    }
    res.json(out);
  } catch (e: any) {
    res.status(503).json({ error: e.message });
  }
});

r.get("/pending", async (req, res) => {
  try {
    const user = new PublicKey(String(req.query.user || ""));
    const currentSlot = await connection.getSlot("confirmed");
    const pending = (await listPendingCommits(MECHANICS.filter((m) => m !== "lottery")))
      .filter((c) => c.user && c.user.equals(user))
      .map((c) => ({
        mechanic: c.mechanic,
        commit: c.address.toBase58(),
        commitSlot: c.commitSlot,
        phase: commitPhase(c.commitSlot, currentSlot),
        ageSlots: currentSlot - c.commitSlot,
      }));
    res.json({ currentSlot, pending });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/pool/add", requireAdmin, async (req, res) => {
  try {
    const name = poolName(req.body.program);
    const prog: any = programs[name];
    const count = Math.min(Math.max(Number(req.body.count) || 1, 1), 16);
    const existing = await listPoolSlots(prog);
    let index = existing.reduce((max, s) => Math.max(max, s.index + 1), 0);
    const added: string[] = [];
    for (let i = 0; i < count; i++, index++) {
      const { recentSlot, accounts } = await vrfPoolAddAccounts(prog, connection, index);
      const signer = name === "core"
        ? { config: configPda()[0], operator: AUTHORITY_PUBKEY }
        : { questConfig: questConfigPda()[0], authority: AUTHORITY_PUBKEY };
      const ix = await (prog.methods as any)
        .vrfPoolAdd(index, new (require("bn.js"))(recentSlot))
        .accounts({
          ...signer,
          ...accounts,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      added.push(await authorityOnly([...vrfComputeBudget(), ix]));
    }
    res.json({ program: name, added });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.post("/pool/retire", requireAdmin, async (req, res) => {
  try {
    const name = poolName(req.body.program);
    const prog: any = programs[name];
    const vrfSlot = new PublicKey(req.body.vrfSlot);
    const retired = req.body.retired !== false;
    const signer = name === "core"
      ? { config: configPda()[0], operator: AUTHORITY_PUBKEY }
      : { questConfig: questConfigPda()[0], authority: AUTHORITY_PUBKEY };
    const ix = await (prog.methods as any).vrfPoolSetRetired(retired).accounts({ ...signer, vrfSlot }).instruction();
    res.json({ sig: await authorityOnly([ix]) });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

export default r;
