import { Router } from "express";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import {
  authPda,
  configPda,
  materialMintsPda,
  energyAccountPda,
  farmTilePda,
  weatherStatePda,
  wellStatePda,
  millStatePda,
  ovenStatePda,
} from "../lib/pda";
import { coSign, pk } from "../lib/tx";

const r = Router();

// ===== [БЛОК L] Ферма: посадка семян =====
r.post("/farm/plant", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const tileIndex = Number(req.body.tileIndex);
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [farmTile] = farmTilePda(user, tileIndex);
    const seedsMint = new PublicKey(req.body.seedsMint);
    const userSeeds = getAssociatedTokenAddressSync(seedsMint, user);

    const ix = await (program.methods as any)
      .plantSeeds(tileIndex, amount)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        farmTile,
        seedsMint,
        userSeeds,
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

// ===== [БЛОК L] Ферма: сбор пшеницы =====
r.post("/farm/harvest", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const tileIndex = Number(req.body.tileIndex);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [farmTile] = farmTilePda(user, tileIndex);
    const [auth] = authPda();
    const wheatMint = new PublicKey(req.body.wheatMint);
    const userWheat = getAssociatedTokenAddressSync(wheatMint, user);
    const toolMint = pk(req.body.toolMint);
    const [toolData] = [new PublicKey(req.body.toolData || toolMint)]; // PDA tool

    const ix = await (program.methods as any)
      .harvestWheat(tileIndex)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        farmTile,
        toolData,
        auth,
        wheatMint,
        userWheat,
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

// ===== [БЛОК L] Мельница: запуск помола =====
r.post("/mill/start", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const batchSize = Number(req.body.batchSize);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [millState] = millStatePda(user);
    const wheatMint = new PublicKey(req.body.wheatMint);
    const stoneMint = new PublicKey(req.body.stoneMint);
    const userWheat = getAssociatedTokenAddressSync(wheatMint, user);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);

    const ix = await (program.methods as any)
      .startMilling(batchSize)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        millState,
        wheatMint,
        stoneMint,
        userWheat,
        userStone,
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

// ===== [БЛОК L] Мельница: сбор муки =====
r.post("/mill/collect", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [millState] = millStatePda(user);
    const [auth] = authPda();
    const flourMint = new PublicKey(req.body.flourMint);
    const userFlour = getAssociatedTokenAddressSync(flourMint, user);

    const ix = await (program.methods as any)
      .collectFlour()
      .accounts({
        config,
        user,
        materialMints,
        millState,
        auth,
        flourMint,
        userFlour,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ===== [БЛОК L] Печь: запуск выпечки =====
r.post("/oven/start", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const batchSize = Number(req.body.batchSize);
    const fuelKind = Number(req.body.fuelKind); // 0=дрова, 1=уголь
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [ovenState] = ovenStatePda(user);
    const flourMint = new PublicKey(req.body.flourMint);
    const waterMint = new PublicKey(req.body.waterMint);
    const woodMint = new PublicKey(req.body.woodMint);
    const coalMint = new PublicKey(req.body.coalMint);
    const userFlour = getAssociatedTokenAddressSync(flourMint, user);
    const userWater = getAssociatedTokenAddressSync(waterMint, user);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userCoal = getAssociatedTokenAddressSync(coalMint, user);

    const ix = await (program.methods as any)
      .startBaking(batchSize, fuelKind)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        ovenState,
        flourMint,
        waterMint,
        woodMint,
        coalMint,
        userFlour,
        userWater,
        userWood,
        userCoal,
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

// ===== [БЛОК L] Печь: сбор хлеба =====
r.post("/oven/collect", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [ovenState] = ovenStatePda(user);
    const [auth] = authPda();
    const breadMint = new PublicKey(req.body.breadMint);
    const userBread = getAssociatedTokenAddressSync(breadMint, user);

    const ix = await (program.methods as any)
      .collectBread()
      .accounts({
        config,
        user,
        materialMints,
        ovenState,
        auth,
        breadMint,
        userBread,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ===== [БЛОК L] Погода: обновление (permissionless) =====
r.post("/weather/crank", async (req, res) => {
  try {
    const cranker = pk(req.body.cranker);
    const [weatherState] = weatherStatePda();

    const ix = await (program.methods as any)
      .weatherCrank()
      .accounts({
        cranker,
        weatherState,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], cranker);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ===== [БЛОК L] Колодец: сбор воды =====
r.post("/well/collect", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [wellState] = wellStatePda(user);
    const [weatherState] = weatherStatePda();
    const [auth] = authPda();
    const waterMint = new PublicKey(req.body.waterMint);
    const userWater = getAssociatedTokenAddressSync(waterMint, user);

    const ix = await (program.methods as any)
      .collectWellWater()
      .accounts({
        config,
        user,
        materialMints,
        wellState,
        weatherState,
        auth,
        waterMint,
        userWater,
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

// ===== [БЛОК L] Крафт рецептов (гемы/баночки) =====
r.post("/recipe/craft", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const recipeId = Number(req.body.recipeId);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [auth] = authPda();
    const input1Mint = new PublicKey(req.body.input1Mint);
    const input2Mint = new PublicKey(req.body.input2Mint);
    const outputMint = new PublicKey(req.body.outputMint);
    const input1Acc = getAssociatedTokenAddressSync(input1Mint, user);
    const input2Acc = getAssociatedTokenAddressSync(input2Mint, user);
    const outputAcc = getAssociatedTokenAddressSync(outputMint, user);

    const ix = await (program.methods as any)
      .craftRecipe(recipeId)
      .accounts({
        config,
        user,
        materialMints,
        auth,
        input1Mint,
        input1Acc,
        input2Mint,
        input2Acc,
        outputMint,
        outputAcc,
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
