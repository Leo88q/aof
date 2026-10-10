import { Router } from "express";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { AUTHORITY_PUBKEY } from "../config";
import { program, connection } from "../provider";
import { configPda, packCommitPda, packConfigPda, packMintPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { publicErrorBody, randomNonce, releasePoolSlot, reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, selfSettleTransaction } from "../lib/vrfSettlement";

/**
 * [F-06] Paid packs, settled by Switchboard On-Demand through the program's
 * own randomness pool (docs/VRF_SWITCHBOARD.md):
 *
 *   POST /packs/commit   player + operator co-signed commit (price escrowed,
 *                        odds snapshotted, randomness committed, slot locked)
 *   GET  /packs/status/:packCommit   pending / settled (tool) / refunded
 *   POST /packs/reveal   transaction for the PLAYER to settle it themselves
 *                        (the vrf-settler worker normally does it in seconds)
 *   GET  /packs/configs  prices and odds as stored on-chain
 */
const r = Router();
const PACK_TYPES = ["small", "medium", "big"] as const;
const packTypeArg = (index: number) => ({ [PACK_TYPES[index]]: {} });

function packIndex(value: unknown): number {
  const index = typeof value === "number" ? value : PACK_TYPES.indexOf(String(value) as (typeof PACK_TYPES)[number]);
  if (!Number.isInteger(index) || index < 0 || index >= PACK_TYPES.length) throw new Error("Unknown pack type");
  return index;
}

function u64(value: unknown, field: string): BN {
  const text = String(value ?? "");
  if (!/^[1-9][0-9]{0,19}$/.test(text) || BigInt(text) > 18446744073709551615n) throw new Error(`${field} must be a positive u64`);
  return new BN(text);
}

r.get("/configs", async (_req, res) => {
  try {
    const out = [];
    for (let i = 0; i < PACK_TYPES.length; i++) {
      const cfg: any = await (program.account as any).packConfig.fetchNullable(packConfigPda(i)[0]);
      if (cfg) out.push({ packType: PACK_TYPES[i], priceLamports: cfg.priceLamports.toString(), oddsBps: cfg.oddsBps });
    }
    res.json({ packs: out });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/commit", requireCircuitOpen, requireWalletLimits("packs_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const index = packIndex(req.body.packType);
    const [packConfig] = packConfigPda(index);
    const cfg: any = await (program.account as any).packConfig.fetch(packConfig);
    // The player's own ceiling (defaults to the current price); the program
    // refuses a higher price even if the config changes before execution.
    const maxPrice = req.body.maxPriceLamports === undefined ? new BN(cfg.priceLamports.toString()) : u64(req.body.maxPriceLamports, "maxPriceLamports");
    if (maxPrice.lt(new BN(cfg.priceLamports.toString()))) throw new Error("PRICE_ABOVE_MAXIMUM");
    const nonce = randomNonce();
    const [packCommit] = packCommitPda(user, nonce);
    const slot = await reservePoolSlot(program, connection);
    try {
      const vrf = await vrfCommitAccounts(program, connection, slot);
      const ix = await (program.methods as any)
        .packOpenCommit(packTypeArg(index), new BN(nonce), maxPrice)
        .accounts({
          config: configPda()[0],
          authority: AUTHORITY_PUBKEY,
          user,
          packConfig,
          packCommit,
          ...vrf,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      const tx = await coSign([ix], user);
      res.json({
        tx,
        packCommit: packCommit.toBase58(),
        mint: packMintPda(packCommit)[0].toBase58(),
        nonce,
        priceLamports: cfg.priceLamports.toString(),
        maxPriceLamports: maxPrice.toString(),
      });
    } catch (error) {
      releasePoolSlot(slot);
      throw error;
    }
  } catch (e: any) {
    const body = publicErrorBody(e);
    res.status(body.status).json(body.body);
  }
});

r.get("/status/:packCommit", async (req, res) => {
  try {
    res.json(await commitStatus("pack", new PublicKey(req.params.packCommit)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/reveal", requireCircuitOpen, requireWalletLimits("packs_reveal"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const packCommit = pk(req.body.packCommit);
    res.json(await selfSettleTransaction("pack", packCommit, user));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const packType = Number(req.body.packType);
    const priceLamports = new BN(req.body.priceLamports);
    const oddsBps = req.body.oddsBps;

    const ix = await (program.methods as any)
      .initPackConfig(packType, priceLamports, oddsBps)
      .accounts({
        config: configPda()[0],
        authority: AUTHORITY_PUBKEY,
        packConfig: packConfigPda(packType)[0],
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/config/set", requireAdmin, async (req, res) => {
  try {
    const packType = Number(req.body.packType);
    const priceLamports = new BN(req.body.priceLamports);
    const oddsBps = req.body.oddsBps;

    const ix = await (program.methods as any)
      .setPackConfig(priceLamports, oddsBps)
      .accounts({ config: configPda()[0], authority: AUTHORITY_PUBKEY, packConfig: packConfigPda(packType)[0] })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
