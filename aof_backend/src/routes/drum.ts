import { Router } from "express";
import { SystemProgram, SYSVAR_SLOT_HASHES_PUBKEY } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {AUTHORITY_PUBKEY} from "../config";
import { questsProgram } from "../provider";
import { drumCommitPda, questConfigPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { newCommit, peekSecret, markUsed } from "../lib/secretStore";

const r = Router();

// Commit для Барабана Удачи (пользователь платит за спин)
r.post("/commit", requireCircuitOpen, requireWalletLimits("drum_commit"), async (req, res) => {
  // The quest program has no typed expiry refund for a paid spin. Refuse new
  // commits rather than taking a token that may become unrevealable.
  return res.status(503).json({
    error: "DRUM_COMMITS_DISABLED_UNTIL_EXPIRY_REFUND_WORKER_IS_DEPLOYED",
  });
  try {
    const user = pk(req.body.user);
    const { hash } = await newCommit(`drum:${user.toBase58()}`);

    const [drumCommit] = drumCommitPda(user);
    const [questConfig] = questConfigPda();

    // [ФИКС] Читаем конфиг для минта и казны (стоимость спина списывается в казну)
    const config: any = await (questsProgram.account as any)["questConfig"].fetch(questConfig);
    const userMascot = getAssociatedTokenAddressSync(config.mascotMint, user);

    const ix = await (questsProgram.methods as any)
      .drumCommit(hash)
      .accounts({
        drumCommit,
        questConfig,
        user,
        treasuryMascot: config.treasuryMascot,
        userMascot,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Reveal для Барабана Удачи (сервер подписывает, приз из казны)
r.post("/reveal", requireCircuitOpen, requireWalletLimits("drum_reveal"), requireIdempotency, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const key = `drum:${user.toBase58()}`;
    const secret = await peekSecret(key);

    const [drumCommit] = drumCommitPda(user);
    const [questConfig] = questConfigPda();

    // [ФИКС] Читаем конфиг для минта и казны (выплата приза из казны)
    const config: any = await (questsProgram.account as any)["questConfig"].fetch(questConfig);
    const userMascot = getAssociatedTokenAddressSync(config.mascotMint, user);

    const ix = await (questsProgram.methods as any)
      .drumReveal(secret)
      .accounts({
        drumCommit,
        questConfig,
        authority: AUTHORITY_PUBKEY,
        user,
        slotHashes: SYSVAR_SLOT_HASHES_PUBKEY,
        treasuryMascot: config.treasuryMascot,
        userMascot,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    await markUsed(key);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
