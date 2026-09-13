import { BN } from "bn.js";
import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { AUTHORITY } from "../config";
import { program } from "../provider";
import {
  authPda,
  configPda,
  craftEconomyPda,
  gastankPda,
  playerPda,
  rarityCounterPda,
  toolPda,
  vaultPda,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { fetchOne } from "../lib/decode";
import { getMintForToolType, calculatePayoutAmount, calculateCoalDrop } from "../lib/miningPayout";
import { Keypair, Transaction } from "@solana/web3.js";
import { MINT_SIZE, createInitializeMintInstruction, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { connection } from "../provider";
import { checkSkrPrivilege } from "../lib/skrPrivilege";
import { criticalOperationGuard, requireCircuitOpen, requireWalletLimits } from "../middleware/security";

const r = Router();

const rarityMap: Record<string, any> = {
  common: { common: {} },
  uncommon: { uncommon: {} },
  rare: { rare: {} },
  epic: { epic: {} },
  legendary: { legendary: {} },
};

r.post("/mint", async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const mint = pk(req.body.mint);
    const toolType = req.body.toolType;
    const rarity = rarityMap[req.body.rarity];
    const [config] = configPda();
    const [auth] = authPda();
    const [toolData] = toolPda(mint);
    const tokenAccount = getAssociatedTokenAddressSync(mint, owner);

    const ix = await (program.methods as any)
      .mintTool(toolType, rarity)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        auth,
        mint,
        tokenAccount,
        toolData,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [NEW] Калькулятор стоимости крафта (WOOD + STONE + FOOD)
r.post("/craft-quote", async (req, res) => {
  try {
    const rarity = req.body.rarity; // "uncommon" | "rare" | "epic" | "legendary"
    const rarityIdx = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(rarity);
    if (rarityIdx < 1 || rarityIdx > 4) return res.status(400).json({ error: "invalid rarity" });
    
    const [craftEconomy] = craftEconomyPda();
    const [rarityCounter] = rarityCounterPda(rarityIdx);
    const econ: any = await fetchOne("craftEconomy", craftEconomy);
    const counter: any = await fetchOne("rarityCounter", rarityCounter);
    
    if (!econ) return res.status(400).json({ error: "craft economy not initialized" });
    
    const idx = rarityIdx - 1;
    const minted = counter?.mintedCount || 0;
    const wood = Number(econ.woodBase[idx]) + minted * Number(econ.woodMult[idx]);
    const stone = Number(econ.stoneBase[idx]) + minted * Number(econ.stoneMult[idx]);
    const food = Number(econ.foodBase?.[idx] || 0) + minted * Number(econ.foodMult?.[idx] || 0);
    const seeds = Number(econ.seedsBase?.[idx] || 0) + minted * Number(econ.seedsMult?.[idx] || 0);
    const water = Number(econ.waterBase?.[idx] || 0) + minted * Number(econ.waterMult?.[idx] || 0);
    const potato = Number(econ.potatoBase?.[idx] || 0) + minted * Number(econ.potatoMult?.[idx] || 0);
    
    // [НОВОЕ] Проверка SKR-привилегий и применение скидки 15%
    let privilege = { source: "NONE", discountBps: 0 };
    try {
      const userPk = new PublicKey(req.body.user || "11111111111111111111111111111111");
      const priv = await checkSkrPrivilege(connection, userPk);
      if (priv.hasPrivilege) {
        privilege = { source: priv.source, discountBps: priv.craftDiscountBps };
        const mult = 1 - (priv.craftDiscountBps / 10000);
        // Применяем скидку только к POTATO (основная утилити-валюта)
        const discountedPotato = Math.floor(potato * mult);
        return res.json({ 
          wood, stone, food, seeds, water, 
          potato: discountedPotato, 
          potatoOriginal: potato,
          minted, 
          privilege 
        });
      }
    } catch (e) {
      // Если проверка не сработала — возвращаем обычные цены
    }
    
    res.json({ wood, stone, food, seeds, water, potato, minted, privilege });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/craft", requireCircuitOpen, requireWalletLimits("tools_craft"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const prevMint = pk(req.body.prevMint);
    const newMint = pk(req.body.newMint);
    const toolType = req.body.toolType;
    const rarity = rarityMap[req.body.rarity];
    const rarityIdx = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(req.body.rarity);

    const [config] = configPda();
    const [gastank] = gastankPda(user);
    const [prevTool] = toolPda(prevMint);
    const [newToolData] = toolPda(newMint);
    const [auth] = authPda();
    const [rarityCounter] = rarityCounterPda(rarityIdx);
    const [craftEconomy] = craftEconomyPda();
    const prevToken = getAssociatedTokenAddressSync(prevMint, user);
    const newToken = getAssociatedTokenAddressSync(newMint, user);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);

    const ix = await (program.methods as any)
      .craft(toolType, rarity)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        user,
        gastank,
        prevTool,
        prevMint,
        prevToken,
        newMint,
        newToken,
        newToolData,
        auth,
        rarityCounter,
        craftEconomy,
        woodMint,
        userWood,
        stoneMint,
        userStone,
        // [НОВОЕ] 4 дополнительных ресурса
        foodMint: pk(req.body.foodMint),
        userFood: getAssociatedTokenAddressSync(pk(req.body.foodMint), user),
        seedsMint: pk(req.body.seedsMint),
        userSeeds: getAssociatedTokenAddressSync(pk(req.body.seedsMint), user),
        waterMint: pk(req.body.waterMint),
        userWater: getAssociatedTokenAddressSync(pk(req.body.waterMint), user),
        potatoMint: pk(req.body.potatoMint),
        userPotato: getAssociatedTokenAddressSync(pk(req.body.potatoMint), user),
        // [НОВОЕ] SKR для ончейн-проверки скидки
        skrMint: pk(req.body.skrMint),
        userSkr: getAssociatedTokenAddressSync(pk(req.body.skrMint), user),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // [ФИКС] FOOD теперь сжигается внутри контракта в инструкции craft
    // Отдельный burnResource больше не нужен
    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [NEW] Калькулятор стоимости ремонта (STONE + WOOD + FOOD)
r.post("/repair-quote", async (req, res) => {
  try {
    const mint = pk(req.body.mint);
    const amount = Number(req.body.amount);
    const [tool] = toolPda(mint);
    const toolData: any = await fetchOne("toolData", tool);
    if (!toolData) return res.status(400).json({ error: "tool not found" });
    
    // Константы REPAIR_STONE из контракта (в атомарных единицах)
    const repairCosts: Record<string, number> = {
      common: 2_000_000_000, uncommon: 4_000_000_000, rare: 9_000_000_000,
      epic: 20_000_000_000, legendary: 45_000_000_000,
    };
    const rarQ = toolData.rarity;
    const rkQ = typeof rarQ === "object" && rarQ ? Object.keys(rarQ)[0] : String(rarQ || "common");
    const stonePerUnit = repairCosts[rkQ] || 0;
    const stone = stonePerUnit * amount;
    const wood = Math.floor(stonePerUnit * 0.5) * amount;
    const food = Math.floor(stonePerUnit * 0.5) * amount;
    
    res.json({ stone, wood, food, amount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/repair", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const stoneMint = pk(req.body.stoneMint);
    const woodMint = pk(req.body.woodMint);
    const foodMint = pk(req.body.foodMint);
    const amount = Number(req.body.amount);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const userStone = getAssociatedTokenAddressSync(stoneMint, user);
    const userWood = getAssociatedTokenAddressSync(woodMint, user);
    const userFood = getAssociatedTokenAddressSync(foodMint, user);

    // repair ix (сжигает STONE через контракт)
    const repairIx = await (program.methods as any)
      .repair(amount)
      .accounts({
        config,
        user,
        tool,
        mint,
        stoneMint,
        userStone,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // стоимость по редкости (та же формула, что в repair-quote)
    const toolData: any = await fetchOne("toolData", tool);
    const rar = toolData?.rarity;
    const rk = typeof rar === "object" && rar ? Object.keys(rar)[0] : String(rar || "common");
    const repairCostsR: Record<string, number> = {
      common: 2_000_000_000, uncommon: 4_000_000_000, rare: 9_000_000_000,
      epic: 20_000_000_000, legendary: 45_000_000_000,
    };
    const stonePerUnitR = repairCostsR[rk] || 2_000_000_000;
    // burn WOOD через burnResource
    const woodCost = Math.floor(stonePerUnitR * 0.5) * amount;
    const burnWoodIx = await (program.methods as any)
      .burnResource({ wood: {} }, new BN(woodCost))
      .accounts({
        config,
        user,
        mint: woodMint,
        tokenAccount: userWood,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    // burn FOOD через burnResource
    const foodCost = Math.floor(stonePerUnitR * 0.5) * amount;
    const burnFoodIx = await (program.methods as any)
      .burnResource({ food: {} }, new BN(foodCost))
      .accounts({
        config,
        user,
        mint: foodMint,
        tokenAccount: userFood,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([repairIx, burnWoodIx, burnFoodIx], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/stake", requireCircuitOpen, requireWalletLimits("tools_stake"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const lockSeconds = new BN(req.body.lockSeconds);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [vault] = vaultPda();
    const userToken = getAssociatedTokenAddressSync(mint, user);
    const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);

    const ix = await (program.methods as any)
      .stake(lockSeconds as any)
      .accounts({
        config,
        user,
        tool,
        mint,
        userToken,
        vault,
        vaultToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/unstake", requireCircuitOpen, requireWalletLimits("tools_unstake"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [vault] = vaultPda();
    const [gastank] = gastankPda(user);
    const userToken = getAssociatedTokenAddressSync(mint, user);
    const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);

    const ix = await (program.methods as any)
      .unstake()
      .accounts({
        config,
        user,
        tool,
        mint,
        userToken,
        gastank,
        vault,
        vaultToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/start-mining", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const hours = Number(req.body.hours);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [player] = playerPda(user);

    const ix = await (program.methods as any)
      .startMining(hours)
      .accounts({
        config,
        user,
        tool,
        mint,
        player,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/collect-mining", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const [player] = playerPda(user);

    // Шаг 1: collectMining (сбрасывает is_mining на контракте)
    const ix = await (program.methods as any)
      .collectMining()
      .accounts({ config, user, tool, mint, player })
      .instruction();

    const tx = await coSign([ix], user);

    // Шаг 2: читаем toolData чтобы узнать toolType и lastMinedHours
    const toolData: any = await fetchOne("toolData", tool);
    if (!toolData) {
      return res.json({ tx, warning: "ToolData not found, payout skipped" });
    }

    const toolType = toolData.toolType?.toLowerCase();
    const hours = Number(toolData.lastMinedHours || 0);
    const rarity = Object.keys(toolData.rarity || {})[0] || "common";

    // Шаг 3: получаем mint основного ресурса
    const resourceMint = await getMintForToolType(toolType);
    if (!resourceMint) {
      return res.json({ tx, warning: "Resource mint not found, payout skipped" });
    }

    // Шаг 4: рассчитываем amount
    const amount = calculatePayoutAmount(hours, rarity);

    // Шаг 5: вызываем payOut (authority_only)
    const userToken = getAssociatedTokenAddressSync(resourceMint, user);
    const [vault] = vaultPda();
    const vaultToken = getAssociatedTokenAddressSync(resourceMint, vault, true);

    const payOutIx = await (program.methods as any)
      .payOut(amount as any)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        vault,
        mint: resourceMint,
        vaultToken,
        userToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const payOutSig = await authorityOnly([payOutIx]);

    // Шаг 6: coal drop для pick (15% шанс)
    let coalPayoutSig = null;
    if (toolType === "pick") {
      const coalDrop = await calculateCoalDrop(toolType, hours);
      if (coalDrop) {
        const coalUserToken = getAssociatedTokenAddressSync(coalDrop.mint, user);
        const coalVaultToken = getAssociatedTokenAddressSync(coalDrop.mint, vault, true);
        const coalIx = await (program.methods as any)
          .payOut(coalDrop.amount as any)
          .accounts({
            config,
            authority: AUTHORITY.publicKey,
            vault,
            mint: coalDrop.mint,
            vaultToken: coalVaultToken,
            userToken: coalUserToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
        coalPayoutSig = await authorityOnly([coalIx]);
      }
    }

    res.json({ tx, payOutSig, coalPayoutSig, toolType, hours, rarity, amount: amount.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/burn", requireCircuitOpen, requireWalletLimits("tools_burn"), async (req, res) => {
  try {
    const user = pk(req.body.user);
    const mint = pk(req.body.mint);
    const [config] = configPda();
    const [tool] = toolPda(mint);
    const tokenAccount = getAssociatedTokenAddressSync(mint, user);

    const ix = await (program.methods as any)
      .burnNft()
      .accounts({
        config,
        user,
        mint,
        tool,
        tokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = await coSign([ix], user);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/pay-out", requireCircuitOpen, requireWalletLimits("tools_payout"), async (req, res) => {
  try {
    const userToken = pk(req.body.userToken);
    const mint = pk(req.body.mint);
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [vault] = vaultPda();
    const vaultToken = getAssociatedTokenAddressSync(mint, vault, true);

    const ix = await (program.methods as any)
      .payOut(amount as any)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        vault,
        mint,
        vaultToken,
        userToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [NEW] Подготовка нового минта для Крафта/Паков: создаём SPL-минт (власть = auth-PDA) + ATA владельца
r.post("/prep-mint", async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const mintKp = Keypair.generate();
    const [auth] = authPda();
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const userToken = getAssociatedTokenAddressSync(mintKp.publicKey, owner);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: AUTHORITY.publicKey,
        newAccountPubkey: mintKp.publicKey,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(mintKp.publicKey, 0, auth, auth),
      createAssociatedTokenAccountIdempotentInstruction(AUTHORITY.publicKey, userToken, owner, mintKp.publicKey)
    );
    tx.feePayer = AUTHORITY.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(mintKp);
    tx.partialSign(AUTHORITY);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    res.json({ sig, mint: mintKp.publicKey.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [НОВОЕ] Использование флакона (зелья)
r.post("/use-flask", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const flaskType = Number(req.body.flaskType); // 1-5
    const flaskMint = pk(req.body.flaskMint);
    
    // Валидация типа флакона
    if (flaskType < 1 || flaskType > 5) {
      return res.status(400).json({ error: "Invalid flask type (must be 1-5)" });
    }
    
    const [playerState] = playerPda(user);
    const userFlask = getAssociatedTokenAddressSync(flaskMint, user);
    
    const ix = await (program.methods as any)
      .useFlask(flaskType)
      .accounts({
        player: user,
        playerState,
        userFlask,
        flaskMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    const tx = await coSign([ix], user);
    res.json({ tx, message: `Flask type ${flaskType} used! Buff active for 1 hour.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
