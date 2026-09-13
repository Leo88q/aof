import { Router } from "express";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { AUTHORITY } from "../config";
import { questsProgram } from "../provider";
import {
  questConfigPda,
  challengeRoundPda,
  challengeContributionPda,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";

const r = Router();

// Создание еженедельного челленджа
r.post("/init", async (req, res) => {
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
        authority: AUTHORITY.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Вклад медалей в челлендж
r.post("/contribute", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const weekNumber = Number(req.body.weekNumber);
    const medals = new BN(req.body.medals);

    const [questConfig] = questConfigPda();
    const [challengeRound] = challengeRoundPda(weekNumber);
    const [contribution] = challengeContributionPda(user, weekNumber);

    const ix = await (questsProgram.methods as any)
      .challengeContribute(weekNumber, medals)
      .accounts({
        questConfig,
        challengeRound,
        contribution,
        user,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
