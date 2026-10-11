import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {AUTHORITY_PUBKEY} from "../config";
import { questsProgram } from "../provider";
import {
  questConfigPda,
  challengeRoundPda,
  challengeContributionPda,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

// Создание еженедельного челленджа
r.post("/init", requireAdmin, async (req, res) => {
  try {
    const weekNumber = Number(req.body.weekNumber);
    const medalsPool = new BN(req.body.medalsPool);

    const [questConfig] = questConfigPda();
    const [challengeRound] = challengeRoundPda(weekNumber);

    const ix = await (questsProgram.methods as any)
      .challengeInit(weekNumber, medalsPool)
      .accounts({
        questConfig,
        challengeRound,
        authority: AUTHORITY_PUBKEY,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/contribute", async (req, res) => {
  try {
    const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
    const user = pk(req.body.user);
    const weekNumber = Number(req.body.weekNumber);
    const medals = new BN(req.body.medals);
    const [questConfig] = questConfigPda();
    const config: any = await (questsProgram.account as any).questConfig.fetch(questConfig);
    const [challengeRound] = challengeRoundPda(weekNumber);
    const [contribution] = challengeContributionPda(user, weekNumber);
    const ix = await (questsProgram.methods as any)
      .challengeContribute(weekNumber, medals)
      .accounts({
        questConfig,
        challengeRound,
        contribution,
        user,
        userMascot: getAssociatedTokenAddressSync(config.mascotMint, user),
        escrowMascot: getAssociatedTokenAddressSync(config.mascotMint, questConfig, true),
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

r.post("/close", requireAdmin, async (req, res) => {
  try {
    const weekNumber = Number(req.body.weekNumber);
    const [questConfig] = questConfigPda();
    const ix = await (questsProgram.methods as any)
      .challengeClose(weekNumber)
      .accounts({
        questConfig,
        authority: AUTHORITY_PUBKEY,
        challengeRound: challengeRoundPda(weekNumber)[0],
      })
      .instruction();
    res.json({ sig: await authorityOnly([ix]) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/claim", async (req, res) => {
  try {
    const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
    const user = pk(req.body.user);
    const weekNumber = Number(req.body.weekNumber);
    const [questConfig] = questConfigPda();
    const config: any = await (questsProgram.account as any).questConfig.fetch(questConfig);
    const ix = await (questsProgram.methods as any)
      .challengeClaim(weekNumber)
      .accounts({
        questConfig,
        challengeRound: challengeRoundPda(weekNumber)[0],
        contribution: challengeContributionPda(user, weekNumber)[0],
        user,
        escrowMascot: getAssociatedTokenAddressSync(config.mascotMint, questConfig, true),
        userMascot: getAssociatedTokenAddressSync(config.mascotMint, user),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    res.json({ tx: await coSign([ix], user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
