import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import { authPda, configPda, materialMintsPda, playerPda, issuanceCapPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { fetchOne } from "../lib/decode";
import { validateMintForTransaction } from "../security/mintValidator";
import { requireCircuitOpen } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

const kindMap: Record<string, any> = {
  // Базовые ресурсы
  food: { food: {} },
  wood: { wood: {} },
  stone: { stone: {} },
  potato: { potato: {} },
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

r.post("/mint", requireAdmin, requireCircuitOpen, async (req, res) => {
  try {
    // Проверка что минт разрешён и существует на чейне
    await validateMintForTransaction(req.body.mint);

    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const kind = kindMap[req.body.kind];
    if (!kind) return res.status(400).json({ error: "unknown resource kind" });
    const amount = new BN(req.body.amount);

    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [auth] = authPda();
    const [player] = playerPda(owner);
    const cfg: any = await fetchOne("config", config);
    if (!cfg?.treasury) return res.status(400).json({ error: "Config not initialized" });
    const treasury = new PublicKey(cfg.treasury.toString());
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner, true);
    const treasuryToken = getAssociatedTokenAddressSync(mint, treasury, true);

    const ix = await (program.methods as any)
      .mintResource(kind, amount as any)
      .accounts({
        config,
        materialMints,
        authority: AUTHORITY.publicKey,
        auth,
        mint,
        tokenAccount,
        treasuryToken,
        player,
        issuanceCap: issuanceCapPda(kind)[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: pk("11111111111111111111111111111111"),
      })
      .instruction();

    const createUserAta = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY.publicKey, tokenAccount, owner, mint,
    );
    const createTreasuryAta = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY.publicKey, treasuryToken, treasury, mint,
    );
    const sig = await authorityOnly([createTreasuryAta, createUserAta, ix]);
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
    if (!kind) return res.status(400).json({ error: "unknown resource kind" });
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner);

    const ix = await (program.methods as any)
      .burnResource(kind, amount as any)
      .accounts({
        config,
        materialMints,
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


// Disabled because the current aof-core program has no exchange_food_energy
// instruction. Do not pretend to build a transaction for a missing entrypoint.
r.post("/exchange-energy", (_req, res) => {
  res.status(503).json({ error: "ENERGY_EXCHANGE_DISABLED_UNTIL_ONCHAIN_INSTRUCTION_EXISTS" });
});

/*
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
*/

export default r;
