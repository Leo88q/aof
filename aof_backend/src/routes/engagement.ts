import { Router } from "express";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { questsProgram, program, connection } from "../provider";
import { questConfigPda, playerPda, explorationStatePda, seasonPassPda, questProgressPda } from "../lib/pda";
import { coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits } from "../middleware/security";

const r = Router();

function engagementPda(user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("engagement"), user.toBuffer()],
    questsProgram.programId,
  )[0];
}

async function mascotAccounts(user: PublicKey) {
  const [questConfig] = questConfigPda();
  const config: any = await (questsProgram.account as any).questConfig.fetch(questConfig);
  return {
    questConfig,
    treasuryMascot: getAssociatedTokenAddressSync(config.mascotMint, questConfig, true),
    userMascot: getAssociatedTokenAddressSync(config.mascotMint, user),
    config,
  };
}

function baseAccounts(user: PublicKey, extra: Record<string, PublicKey>) {
  return {
    user,
    engagement: engagementPda(user),
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    ...extra,
  };
}

r.post("/daily", requireCircuitOpen, requireWalletLimits("engagement_daily"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const m = await mascotAccounts(user);
    const ix = await (questsProgram.methods as any).claimDaily().accounts(baseAccounts(user, m)).instruction();
    res.json({ tx: await coSign([ix], user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/comeback", requireCircuitOpen, requireWalletLimits("engagement_comeback"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const m = await mascotAccounts(user);
    const ix = await (questsProgram.methods as any).claimComeback().accounts(baseAccounts(user, m)).instruction();
    res.json({ tx: await coSign([ix], user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/neighbor", requireCircuitOpen, requireWalletLimits("engagement_neighbor"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const neighbor = pk(req.body.neighbor);
    const [questConfig] = questConfigPda();
    const ix = await (questsProgram.methods as any).visitNeighbor().accounts({
      questConfig,
      engagement: engagementPda(user),
      user,
      neighborEngagement: engagementPda(neighbor),
      systemProgram: SystemProgram.programId,
    }).instruction();
    res.json({ tx: await coSign([ix], user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/guild", requireCircuitOpen, requireWalletLimits("engagement_guild"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const amount = new BN(req.body.amount);
    const m = await mascotAccounts(user);
    const ix = await (questsProgram.methods as any).guildDeposit(amount).accounts(baseAccounts(user, m)).instruction();
    res.json({ tx: await coSign([ix], user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/quest-progress", requireCircuitOpen, requireWalletLimits("engagement_quest"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const questId = Number(req.body.questId);
    const proof = questId <= 4
      ? playerPda(user)[0]
      : questId === 5
        ? explorationStatePda(user)[0]
        : seasonPassPda(user, Number(req.body.seasonId))[0];
    const [questConfig] = questConfigPda();
    const ix = await (questsProgram.methods as any).proveQuestProgress(questId).accounts({
      questConfig,
      questProgress: questProgressPda(user, questId)[0],
      user,
      proof,
      systemProgram: SystemProgram.programId,
    }).instruction();
    res.json({ tx: await coSign([ix], user) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

function readU32(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset);
}

/** Privilege summary from chain accounts. Not a self-reported flag. */
r.get("/summary/:user", async (req, res) => {
  try {
    const user = new PublicKey(req.params.user);
    const [player] = playerPda(user);
    const [engagement] = [engagementPda(user)];
    const infos = await connection.getMultipleAccountsInfo([player, engagement], "confirmed");
    const playerData = infos[0]?.data;
    const engagementData = infos[1]?.data;
    const privileges = playerData && playerData.length >= 59
      ? {
          tent: playerData[8 + 40] === 1,
          villagers: readU32(playerData, 8 + 41),
          historian: playerData[8 + 49] > 0,
          medallion: playerData[8 + 50] > 0,
        }
      : null;
    const row = engagementData && engagementData.length >= 8 + 32 + 8 + 2 + 2
      ? {
          lastDailyDay: Number(engagementData.readBigInt64LE(8 + 32)),
          streak: engagementData.readUInt16LE(8 + 32 + 8),
          bestStreak: engagementData.readUInt16LE(8 + 32 + 8 + 2),
          guildDeposited: engagementData.length >= 77 ? engagementData.readBigUInt64LE(69).toString() : "0",
        }
      : null;
    let season: any = null;
    try {
      const passes = await (program.account as any).seasonPass.all([{ memcmp: { offset: 8, bytes: user.toBase58() } }]);
      season = passes[0]?.account ? {
        seasonId: Number(passes[0].account.seasonId),
        xp: Number(passes[0].account.xp),
        premium: Boolean(passes[0].account.premium),
        level: Math.floor(Number(passes[0].account.xp) / 1000),
      } : null;
    } catch {
      season = null;
    }
    res.json({ user: user.toBase58(), privileges, engagement: row, season });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
