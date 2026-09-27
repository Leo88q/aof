import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import {AUTHORITY_PUBKEY} from "../config";
import { program, connection } from "../provider";
import { authPda, configPda, enchantSlotPda, forgeCommitPda, toolPda, bowCommitPda, skinPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";
import { reservePoolSlot, vrfCommitAccounts } from "../lib/vrf";
import { commitStatus, selfSettleTransaction } from "../lib/vrfSettlement";

const r = Router();

/**
 * [F-06] Forge attempt: wood/stone burned, fee (+protector) escrowed, level
 * snapshotted, Switchboard commit on a pool slot (operator co-signs as the
 * backend gate). Settled by the vrf-settler or by the player (POST /reveal).
 */
r.post("/commit", requireCircuitOpen, requireWalletLimits("forge_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const slotType = Number(req.body.slotType);
    if (!Number.isInteger(slotType) || slotType < 0 || slotType > 2) throw new Error("slotType must be 0, 1 or 2");
    const useProtector = req.body.useProtector === true;
    const [config] = configPda();
    const cfg: any = await (program.account as any).config.fetch(config);
    const [forgeCommit] = forgeCommitPda(toolMint, slotType);
    const slot = await reservePoolSlot(program, connection);
    const vrf = await vrfCommitAccounts(program, connection, slot);

    const ix = await (program.methods as any)
      .forgeAttemptCommit(slotType, useProtector)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        user,
        tool: toolPda(toolMint)[0],
        toolMint,
        enchantSlot: enchantSlotPda(toolMint, slotType)[0],
        forgeCommit,
        woodMint: cfg.woodMint,
        userWood: getAssociatedTokenAddressSync(cfg.woodMint, user),
        stoneMint: cfg.stoneMint,
        userStone: getAssociatedTokenAddressSync(cfg.stoneMint, user),
        ...vrf,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx, forgeCommit: forgeCommit.toBase58() });
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});

r.get("/status/:forgeCommit", async (req, res) => {
  try {
    res.json(await commitStatus("forge", new PublicKey(req.params.forgeCommit)));
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** Transaction for the player to settle (or after the window refund) an attempt. */
r.post("/reveal", requireCircuitOpen, requireWalletLimits("forge_reveal"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const commit = req.body.forgeCommit
      ? pk(req.body.forgeCommit)
      : forgeCommitPda(pk(req.body.toolMint), Number(req.body.slotType))[0];
    res.json(await selfSettleTransaction("forge", commit, user));
  } catch (e: any) {
    res.status(e.status || 400).json({ error: e.message });
  }
});


// Disabled: no bow_reward_commit/reveal entrypoints exist in aof-core.
r.post("/bow/commit", (_req, res) => {
  res.status(503).json({ error: "BOW_REWARD_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS" });
});
r.post("/bow/reveal", (_req, res) => {
  res.status(503).json({ error: "BOW_REWARD_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS" });
});

/*
// Bow: шанс на скин (коммит)
r.post("/bow/commit", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolMint = pk(req.body.toolMint);
    const [config] = configPda();
    const [tool] = toolPda(toolMint);
    const [bowCommit] = bowCommitPda(toolMint);
    const { hash } = await newCommit(`bow:${toolMint.toBase58()}`);
    const ix = await (program.methods as any)
      .bowRewardCommit(hash)
      .accounts({
        config,
        user,
        tool,
        toolMint,
        bowCommit,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Bow: раскрытие результата (сервер)
r.post("/bow/reveal", async (req, res) => {
  try {
    const toolMint = pk(req.body.toolMint);
    const user = pk(req.body.user);
    const skinMint = pk(req.body.skinMint);
    const skinId = Number(req.body.skinId);
    const key = `bow:${toolMint.toBase58()}`;
    const secret = await peekSecret(key);
    const [config] = configPda();
    const [bowCommit] = bowCommitPda(toolMint);
    const [skin] = skinPda(skinMint);
    const [auth] = authPda();
    const userSkinToken = getAssociatedTokenAddressSync(skinMint, user);
    const ix = await (program.methods as any)
      .bowRewardReveal(secret, skinId)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        bowCommit,
        payer: user,
        skinMint,
        userSkinToken,
        skin,
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
*/

export default r;
