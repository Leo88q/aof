import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {AUTHORITY_PUBKEY} from "../config";
import { liquidityProgram } from "../provider";
import { lpConfigPda, liquidityProgramDataPda, lpPoolPda, lpPositionPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

// Инициализация конфигурации ликвидности
r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const mascotMint = pk(req.body.mascotMint || req.body.potatoMint);

    const [lpConfig] = lpConfigPda();
    const [programData] = liquidityProgramDataPda();

    const ix = await (liquidityProgram.methods as any)
      .initLpConfig(mascotMint)
      .accounts({
        lpConfig,
        authority: AUTHORITY_PUBKEY,
        programData,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Депозит маскот-токена в пул
r.post("/deposit", requireCircuitOpen, requireWalletLimits("lp_deposit"), requireIdempotency, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const rarity = Number(req.body.rarity);
    const amount = new BN(req.body.amount);

    const [lpConfig] = lpConfigPda();
    const [lpPool] = lpPoolPda(rarity);
    const [lpPosition] = lpPositionPda(user, rarity);

    const config: any = await (liquidityProgram.account as any)["lpConfig"].fetch(lpConfig);
    const mascotMint = config.mascotMint;

    const userMascot = getAssociatedTokenAddressSync(mascotMint, user);
    const poolVault = getAssociatedTokenAddressSync(mascotMint, lpPool, true);

    const ix = await (liquidityProgram.methods as any)
      .lpDeposit(rarity, amount)
      .accounts({
        lpConfig,
        lpPool,
        lpPosition,
        user,
        mascotMint,
        userMascot,
        poolVault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Вывод долей + накопленных комиссий
r.post("/withdraw", requireCircuitOpen, requireWalletLimits("lp_withdraw"), requireIdempotency, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const rarity = Number(req.body.rarity);
    const shares = new BN(req.body.shares);

    const [lpConfig] = lpConfigPda();
    const [lpPool] = lpPoolPda(rarity);
    const [lpPosition] = lpPositionPda(user, rarity);

    const config: any = await (liquidityProgram.account as any)["lpConfig"].fetch(lpConfig);
    const mascotMint = config.mascotMint;

    const userMascot = getAssociatedTokenAddressSync(mascotMint, user);
    const poolVault = getAssociatedTokenAddressSync(mascotMint, lpPool, true);

    const ix = await (liquidityProgram.methods as any)
      .lpWithdraw(rarity, shares)
      .accounts({
        lpConfig,
        lpPool,
        lpPosition,
        user,
        mascotMint,
        userMascot,
        poolVault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
