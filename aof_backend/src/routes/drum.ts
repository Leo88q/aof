import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AUTHORITY } from "../config";
import { questsProgram } from "../provider";
import { drumCommitPda, questConfigPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { newCommit, popSecret } from "../lib/secretStore";

const r = Router();

// Commit для Барабана Удачи (пользователь платит за спин)
r.post("/commit", requireCircuitOpen, requireWalletLimits("drum_commit"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const { hash } = await newCommit(`drum:${user.toBase58()}`);

    const [drumCommit] = drumCommitPda(user);
    const [questConfig] = questConfigPda();

    // [ФИКС] Читаем конфиг для минта и казны (стоимость спина списывается в казну)
    const config: any = await (questsProgram.account as any)["questConfig"].fetch(questConfig);
    const userPotato = getAssociatedTokenAddressSync(config.potatoMint, user);

    const ix = await (questsProgram.methods as any)
      .drumCommit(hash)
      .accounts({
        drumCommit,
        questConfig,
        user,
        treasuryPotato: config.treasuryPotato,
        userPotato,
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
    const secret = await popSecret(`drum:${user.toBase58()}`);

    const [drumCommit] = drumCommitPda(user);
    const [questConfig] = questConfigPda();

    // [ФИКС] Читаем конфиг для минта и казны (выплата приза из казны)
    const config: any = await (questsProgram.account as any)["questConfig"].fetch(questConfig);
    const userPotato = getAssociatedTokenAddressSync(config.potatoMint, user);

    const ix = await (questsProgram.methods as any)
      .drumReveal(secret)
      .accounts({
        drumCommit,
        questConfig,
        authority: AUTHORITY.publicKey,
        user,
        treasuryPotato: config.treasuryPotato,
        userPotato,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
