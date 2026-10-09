import { Router } from "express";
import { BN } from "bn.js";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { program } from "../provider";
import {
  authPda,
  configPda,
  energyAccountPda,
  labTilePda,
  materialMintsPda,
  signalStatePda,
  modelStatePda,
  playerPda,
  toolPda,
  weatherStatePda,
  gridStatePda,
  issuanceCapPda,
} from "../lib/pda";
import { coSign, pk } from "../lib/tx";

const r = Router();
const RESOURCE_UNIT = new BN("1000000000");
const RECIPE_OUTPUT_KIND = ["quantumBit", "neuralChip", "photonBit", "cryoFluid", "voltFluid", "bioFluid", "nanoFluid", "quantumFluid"] as const;

// ===== Neural lab: plant Neuron =====
r.post("/lab/plant-neuron", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const tileIndex = Number(req.body.tileIndex);
    // Public API amount is in display neuron; SPL burn uses atomic units.
    const amount = new BN(req.body.amount).mul(RESOURCE_UNIT);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [labTile] = labTilePda(user, tileIndex);
    const neuronMint = new PublicKey(req.body.neuronMint);
    const userNeuron = getAssociatedTokenAddressSync(neuronMint, user);

    const ix = await (program.methods as any)
      .plantNeuron(tileIndex, amount)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        labTile,
        neuronMint,
        userNeuron,
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

// ===== Neural lab: collect Synapse =====
r.post("/lab/harvest-synapse", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const tileIndex = Number(req.body.tileIndex);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [labTile] = labTilePda(user, tileIndex);
    const [auth] = authPda();
    const synapseMint = new PublicKey(req.body.synapseMint);
    const userSynapse = getAssociatedTokenAddressSync(synapseMint, user);
    const toolMint = pk(req.body.toolMint);
    const [toolData] = toolPda(toolMint);

    const ix = await (program.methods as any)
      .harvestSynapse(tileIndex)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        labTile,
        toolData,
        auth,
        synapseMint,
        userSynapse,
        issuanceCapSynapse: issuanceCapPda("synapse")[0],
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

// ===== Signal processing: start =====
r.post("/signal/start-processing", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const batchSize = Number(req.body.batchSize);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [signalState] = signalStatePda(user);
    const synapseMint = new PublicKey(req.body.synapseMint);
    const siliconMint = new PublicKey(req.body.siliconMint);
    const userSynapse = getAssociatedTokenAddressSync(synapseMint, user);
    const userSilicon = getAssociatedTokenAddressSync(siliconMint, user);

    const ix = await (program.methods as any)
      .startSignalProcessing(batchSize)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        signalState,
        synapseMint,
        siliconMint,
        userSynapse,
        userSilicon,
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

// ===== Signal processing: collect =====
r.post("/signal/collect", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [signalState] = signalStatePda(user);
    const [auth] = authPda();
    const signalMint = new PublicKey(req.body.signalMint);
    const userSignal = getAssociatedTokenAddressSync(signalMint, user);

    const ix = await (program.methods as any)
      .collectSignal()
      .accounts({
        config,
        user,
        materialMints,
        signalState,
        auth,
        signalMint,
        userSignal,
        issuanceCapSignal: issuanceCapPda("signal")[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ===== Model training: start =====
r.post("/model/start-training", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const batchSize = Number(req.body.batchSize);
    const fuelKind = Number(req.body.fuelKind); // 0=схемы, 1=вычислительные циклы
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [energyAccount] = energyAccountPda(user);
    const [modelState] = modelStatePda(user);
    const signalMint = new PublicKey(req.body.signalMint);
    const powerMint = new PublicKey(req.body.powerMint);
    const circuitMint = new PublicKey(req.body.circuitMint);
    const computeMint = new PublicKey(req.body.computeMint);
    const userSignal = getAssociatedTokenAddressSync(signalMint, user);
    const userPower = getAssociatedTokenAddressSync(powerMint, user);
    const userCircuit = getAssociatedTokenAddressSync(circuitMint, user);
    const userCompute = getAssociatedTokenAddressSync(computeMint, user);

    const ix = await (program.methods as any)
      .startModelTraining(batchSize, fuelKind)
      .accounts({
        config,
        user,
        materialMints,
        energyAccount,
        modelState,
        signalMint,
        powerMint,
        circuitMint,
        computeMint,
        userSignal,
        userPower,
        userCircuit,
        userCompute,
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

// ===== Model training: collect =====
r.post("/model/collect", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [modelState] = modelStatePda(user);
    const [auth] = authPda();
    const modelMint = new PublicKey(req.body.modelMint);
    const userModel = getAssociatedTokenAddressSync(modelMint, user);

    const ix = await (program.methods as any)
      .collectModel()
      .accounts({
        config,
        user,
        materialMints,
        modelState,
        auth,
        modelMint,
        userModel,
        issuanceCapModel: issuanceCapPda("model")[0],
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
    const [config] = configPda();
    const [weatherState] = weatherStatePda();

    const ix = await (program.methods as any)
      .weatherCrank()
      .accounts({
        config,
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

// ===== Grid station: collect Power =====
r.post("/grid/collect", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [gridState] = gridStatePda(user);
    const [weatherState] = weatherStatePda();
    const [auth] = authPda();
    // [AUDIT F-11] the well is no longer a faucet for throwaway wallets: the
    // wallet must already own a Player PDA with villagers.
    const [player] = playerPda(user);
    const powerMint = new PublicKey(req.body.powerMint);
    const userPower = getAssociatedTokenAddressSync(powerMint, user);

    const ix = await (program.methods as any)
      .collectPower()
      .accounts({
        config,
        user,
        player,
        materialMints,
        gridState,
        weatherState,
        auth,
        powerMint,
        userPower,
        issuanceCapPower: issuanceCapPda("power")[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // The program requires an initialized POWER token account. Create it in the
    // player's transaction; the player pays its rent only if it does not exist.
    const createUserPower = createAssociatedTokenAccountIdempotentInstruction(user, userPower, user, powerMint);
    const tx = await coSign([createUserPower, ix], user);
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
    const outputKind = Number.isInteger(recipeId) ? RECIPE_OUTPUT_KIND[recipeId] : undefined;
    if (!outputKind) throw new Error("recipeId must be an integer from 0 to 7");
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
        issuanceCap: issuanceCapPda(outputKind)[0],
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
