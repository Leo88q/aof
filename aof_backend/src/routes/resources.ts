import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { authPda, configPda, playerPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { validateMintForTransaction } from "../security/mintValidator";
import { requireCircuitOpen } from "../middleware/security";

const r = Router();

const kindMap: Record<string, any> = {
  // Базовые ресурсы
  food: { food: {} },
  wood: { wood: {} },
  stone: { stone: {} },
  // [БЛОК L] Хлебная цепочка
  seeds: { seeds: {} },
  wheat: { wheat: {} },
  flour: { flour: {} },
  bread: { bread: {} },
  water: { water: {} },
  coal: { coal: {} },
  meat: { meat: {} },
  // Камни
  stoneBlue: { stoneBlue: {} },
  stonePurple: { stonePurple: {} },
  stoneRed: { stoneRed: {} },
  // Песок
  sandWhite: { sandWhite: {} },
  sandPink: { sandPink: {} },
  sandYellow: { sandYellow: {} },
  // Гемы
  gemBlue: { gemBlue: {} },
  gemOrange: { gemOrange: {} },
  gemWhite: { gemWhite: {} },
  gemGreen: { gemGreen: {} },
  // Баночки
  flaskBlue: { flaskBlue: {} },
  flaskYellow: { flaskYellow: {} },
  flaskGreen: { flaskGreen: {} },
  flaskPink: { flaskPink: {} },
  flaskPurple: { flaskPurple: {} },
  // Особое
  loveHeart: { loveHeart: {} },
};

r.post("/mint", requireCircuitOpen, async (req, res) => {
  try {
    // Проверка что минт разрешён и существует на чейне
    await validateMintForTransaction(req.body.mint);

    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const treasuryToken = pk(req.body.treasuryToken);
    const kind = kindMap[req.body.kind];
    const amount = new BN(req.body.amount);

    const [config] = configPda();
    const [auth] = authPda();
    const [player] = playerPda(owner);
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner);

    const ix = await (program.methods as any)
      .mintResource(kind, amount as any)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        auth,
        mint,
        tokenAccount,
        treasuryToken,
        player,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: pk("11111111111111111111111111111111"),
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/burn", requireCircuitOpen, async (req, res) => {
  try {
    // Проверка что минт разрешён
    await validateMintForTransaction(req.body.mint);

    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const kind = kindMap[req.body.kind];
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner);

    const ix = await (program.methods as any)
      .burnResource(kind, amount as any)
      .accounts({
        config,
        user: owner,
        mint,
        tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { coSign } = await import("../lib/tx");
    const tx = await coSign([ix], owner);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// Обмен FOOD на энергию (1 FOOD = 4 энергии, кап 5000)
r.post("/exchange-energy", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const foodMint = pk(req.body.foodMint);
    const foodAmount = BigInt(req.body.foodAmount);
    const [config] = configPda();
    const [player] = playerPda(user);
    const userFood = getAssociatedTokenAddressSync(foodMint, user);
    const ix = await (program.methods as any)
      .exchangeFoodEnergy(foodAmount)
      .accounts({
        config,
        user,
        foodMint,
        userFood,
        player,
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

export default r;
