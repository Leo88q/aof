import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { AUTHORITY, TREASURY } from "../config";
import { program } from "../provider";
import { authPda, configPda, packCommitPda, packConfigPda, toolPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();
const packTypeMap: Record<string, any> = {
  small: { small: {} },
  medium: { medium: {} },
  big: { big: {} },
};

r.post("/commit", requireCircuitOpen, requireWalletLimits("packs_commit"), async (req, res) => {
  // The pack price is escrowed on the PackCommit PDA (not paid to the
  // treasury) until pack_open_reveal. If the reveal never happens the
  // commit-expirer worker (services/commit-expirer) or anyone else can call
  // pack_open_expire after COMMIT_EXPIRY_SLOTS and the user is refunded.
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const packType = req.body.packType;
    const packTypeIdx = ["small", "medium", "big"].indexOf(packType);
    const { hash } = await newCommit(`pack:${mint.toBase58()}`);

    const [config] = configPda();
    const [packConfig] = packConfigPda(packTypeIdx);
    const [packCommit] = packCommitPda(mint);
    const ix = await (program.methods as any)
      .packOpenCommit(packTypeMap[packType], hash)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        user,
        packConfig,
        auth: authPda()[0],
        mint,
        packCommit,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * Refund of an expired pack commit. On-chain the instruction is permissionless
 * and only succeeds once the commit slot has left SlotHashes
 * (>= COMMIT_EXPIRY_SLOTS), so it can never race a valid reveal and lamports
 * always go to pack_commit.user. This HTTP entry point is admin-only because
 * the authority pays the transaction fee; the commit-expirer worker uses it
 * (or the same program call directly). Players never need to call it.
 */
r.post("/expire", requireCircuitOpen, requireAdmin, async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [packCommit] = packCommitPda(mint);
    const commit: any = await (program.account as any).packCommit.fetch(packCommit);
    const ix = await (program.methods as any)
      .packOpenExpire()
      .accounts({ config, packCommit, user: commit.user, mint })
      .instruction();
    const sig = await authorityOnly([ix]);
    await markUsed(`pack:${mint.toBase58()}`).catch(() => {});
    res.json({ sig, user: commit.user.toBase58(), refundedLamports: commit.paidLamports.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/reveal", requireCircuitOpen, requireWalletLimits("packs_reveal"), requireIdempotency, async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const user = pk(req.body.user);
    const packType = req.body.packType;
    const packTypeIdx = ["small", "medium", "big"].indexOf(packType);
    const key = `pack:${mint.toBase58()}`;
    const secret = await peekSecret(key);

    const [config] = configPda();
    const [packCommit] = packCommitPda(mint);
    const [packConfig] = packConfigPda(packTypeIdx);
    const [toolData] = toolPda(mint);
    const [auth] = authPda();
    const userToken = getAssociatedTokenAddressSync(mint, user);

    const ix = await (program.methods as any)
      .packOpenReveal(secret)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        packCommit,
        user,
        treasury: TREASURY,
        packConfig,
        mint,
        userToken,
        toolData,
        auth,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const packType = Number(req.body.packType);
    const priceLamports = new (require("bn.js"))(req.body.priceLamports);
    const oddsBps = req.body.oddsBps;

    const [config] = configPda();
    const [packConfig] = packConfigPda(packType);

    const ix = await (program.methods as any)
      .initPackConfig(packType, priceLamports, oddsBps)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        packConfig,
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
    const priceLamports = new (require("bn.js"))(req.body.priceLamports);
    const oddsBps = req.body.oddsBps;

    const [config] = configPda();
    const [packConfig] = packConfigPda(packType);

    const ix = await (program.methods as any)
      .setPackConfig(priceLamports, oddsBps)
      .accounts({ config, authority: AUTHORITY.publicKey, packConfig })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
