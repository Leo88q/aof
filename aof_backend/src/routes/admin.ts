import { Router } from "express";
import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { AUTHORITY, TREASURY } from "../config";
import { fetchOne } from "../lib/decode";
import { program, connection } from "../provider";
import {
  authPda,
  configPda,
  craftEconomyPda,
  rarityCounterPda,
  toolPda,
  vaultPda,
  playerPda,
  materialMintsPda,
} from "../lib/pda";
import { authorityOnly, pk, coSign } from "../lib/tx";

const r = Router();

r.post("/initialize", async (req, res) => {
  try {
    const [config] = configPda();
    const [auth] = authPda();
    const [vault] = vaultPda();
    const ix = await (program.methods as any)
      .initialize()
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        auth,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig, config: config.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/set-fees", async (req, res) => {
  try {
    const craftFee = new BN(req.body.craftFee);
    const unstakeFee = new BN(req.body.unstakeFee);
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setFees(craftFee, unstakeFee)
      .accounts({ config, authority: AUTHORITY.publicKey })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/set-paused", async (req, res) => {
  try {
    const paused = Boolean(req.body.paused);
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setPaused(paused)
      .accounts({ config, authority: AUTHORITY.publicKey })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/set-resource-mints", async (req, res) => {
  try {
    const foodMint = pk(req.body.foodMint);
    const woodMint = pk(req.body.woodMint);
    const stoneMint = pk(req.body.stoneMint);
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setResourceMints(foodMint, woodMint, stoneMint)
      .accounts({ config, authority: AUTHORITY.publicKey })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/craft-economy/init", async (req, res) => {
  try {
    const [config] = configPda();
    const [craftEconomy] = craftEconomyPda();
    const ix = await (program.methods as any)
      .initCraftEconomy()
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        craftEconomy,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/craft-economy/set", async (req, res) => {
  try {
    // IDL требует массивы [u64; 4] для каждого параметра
    const woodBase = (req.body.woodBase || ["100","100","100","100"]).map((x: any) => new BN(x));
    const stoneBase = (req.body.stoneBase || ["100","100","100","100"]).map((x: any) => new BN(x));
    const woodMult = (req.body.woodMult || ["2","2","2","2"]).map((x: any) => new BN(x));
    const stoneMult = (req.body.stoneMult || ["2","2","2","2"]).map((x: any) => new BN(x));
    const [config] = configPda();
    const [craftEconomy] = craftEconomyPda();
    
    console.log("[craft-economy/set] params:", { woodBase, stoneBase, woodMult, stoneMult });
    
    const ix = await (program.methods as any)
      .setCraftEconomy(woodBase, stoneBase, woodMult, stoneMult)
      .accounts({ config, authority: AUTHORITY.publicKey, craftEconomy })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    console.error("[craft-economy/set] error:", e.message);
    res.status(400).json({ error: e.message });
  }
});

r.post("/rarity-counter/init", async (req, res) => {
  try {
    const rarityIdx = Number(req.body.rarityIdx);
    const rarityMap: Record<number, any> = {
      1: { uncommon: {} },
      2: { rare: {} },
      3: { epic: {} },
      4: { legendary: {} },
    };
    const [config] = configPda();
    const [rarityCounter] = rarityCounterPda(rarityIdx);
    const ix = await (program.methods as any)
      .initRarityCounter(rarityMap[rarityIdx])
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        rarityCounter,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/migrate-tool", async (req, res) => {
  try {
    const migrationAuthorityKeypair = AUTHORITY;
    const mint = pk(req.body.mint);
    const toolType = req.body.toolType;
    const rarityMap: Record<string, any> = {
      common: { common: {} },
      uncommon: { uncommon: {} },
      rare: { rare: {} },
      epic: { epic: {} },
      legendary: { legendary: {} },
    };
    const rarity = rarityMap[req.body.rarity];
    const durability = Number(req.body.durability);
    const [config] = configPda();
    const [auth] = authPda();
    const [vault] = vaultPda();
    const [toolData] = toolPda(mint);
    const vaultTokenAccount = getAssociatedTokenAddressSync(mint, vault, true);
    const ix = await (program.methods as any)
      .migrateTool(toolType, rarity, durability)
      .accounts({
        config,
        migrationAuthority: migrationAuthorityKeypair.publicKey,
        authority: AUTHORITY.publicKey,
        auth,
        vault,
        mint,
        vaultTokenAccount,
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



// [FIXED] Тестовая выдача ресурса игроку — правильные аккаунты tokenAccount + treasuryToken + player + авто-создание ATA
r.post("/mint-resource", async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const kind = req.body.kind;
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [auth] = authPda();
    const cfg: any = await fetchOne("config", config);
    const mint = kind === "Food" ? cfg?.foodMint : kind === "Wood" ? cfg?.woodMint : cfg?.stoneMint;
    if (!mint) return res.status(400).json({ error: "минт ресурса не задан в конфиге" });
    const mintPk = typeof mint === "string" ? pk(mint) : mint;
    const userAta = getAssociatedTokenAddressSync(mintPk, owner, true);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, cfg.treasury, true);
    const kindMap: Record<string, any> = { Food: { food: {} }, Wood: { wood: {} }, Stone: { stone: {} } };

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY.publicKey, userAta, owner, mintPk
    );
    const createTreasuryAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY.publicKey, treasuryAta, cfg.treasury, mintPk
    );

    const ix = await (program.methods as any)
      .mintResource(kindMap[kind], amount)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        auth,
        mint: mintPk,
        tokenAccount: userAta,
        treasuryToken: treasuryAta,
        player: playerPda(owner)[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction().add(createTreasuryAtaIx, createAtaIx, ix);
    tx.feePayer = AUTHORITY.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(AUTHORITY);
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [FIXED] Инициализация CraftEconomy + установка параметров (2 инструкции)
r.post("/init-craft-economy", async (req, res) => {
  try {
    const [config] = configPda();
    const [craftEconomy] = craftEconomyPda();
    // Anchor ожидает BN[] для u64 массивов — заворачиваю каждое число
    const woodBase = [50, 100, 200, 400].map((x) => new BN(x).mul(new BN(1_000_000_000)));
    const stoneBase = [30, 60, 120, 240].map((x) => new BN(x).mul(new BN(1_000_000_000)));
    const woodMult = [10, 20, 40, 80].map((x) => new BN(x).mul(new BN(1_000_000_000)));
    const stoneMult = [6, 12, 24, 48].map((x) => new BN(x).mul(new BN(1_000_000_000)));

    const ix1 = await (program.methods as any)
      .initCraftEconomy()
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        craftEconomy,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const ix2 = await (program.methods as any)
      .setCraftEconomy(woodBase, stoneBase, woodMult, stoneMult)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        craftEconomy,
      })
      .instruction();

    const sig = await authorityOnly([ix1, ix2]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



// [ТЕСТ] Начисление всех ресурсов и инструментов для ручного тестирования
r.post("/test-grant", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [auth] = authPda();
    
    const cfg: any = await fetchOne("config", config);
    const mm: any = await fetchOne("materialMints", materialMints);
    
    if (!cfg || !mm) {
      return res.status(400).json({ error: "Config/MaterialMints not initialized" });
    }
    
    // Базовые ресурсы из Config (FOOD/WOOD/STONE) - много для тестов
    const baseResources = [
      { name: "FOOD", mint: cfg.foodMint, amount: 10000 },
      { name: "WOOD", mint: cfg.woodMint, amount: 10000 },
      { name: "STONE", mint: cfg.stoneMint, amount: 10000 },
    ];
    
    // Все ресурсы из MaterialMints
    const materialResources = [
      { name: "SEEDS", mint: mm.seeds, amount: 500 },
      { name: "WHEAT", mint: mm.wheat, amount: 1000 },
      { name: "FLOUR", mint: mm.flour, amount: 500 },
      { name: "BREAD", mint: mm.bread, amount: 200 },
      { name: "WATER", mint: mm.water, amount: 2000 },
      { name: "COAL", mint: mm.coal, amount: 500 },
      { name: "MEAT", mint: mm.meat, amount: 300 },
      // Камни
      { name: "STONE_BLUE", mint: mm.stoneBlue, amount: 100 },
      { name: "STONE_PURPLE", mint: mm.stonePurple, amount: 100 },
      { name: "STONE_RED", mint: mm.stoneRed, amount: 100 },
      // Песок
      { name: "SAND_WHITE", mint: mm.sandWhite, amount: 100 },
      { name: "SAND_PINK", mint: mm.sandPink, amount: 100 },
      { name: "SAND_YELLOW", mint: mm.sandYellow, amount: 100 },
      // Гемы
      { name: "GEM_BLUE", mint: mm.gemBlue, amount: 50 },
      { name: "GEM_ORANGE", mint: mm.gemOrange, amount: 50 },
      { name: "GEM_WHITE", mint: mm.gemWhite, amount: 50 },
      { name: "GEM_GREEN", mint: mm.gemGreen, amount: 50 },
      // Флаконы
      { name: "FLASK_BLUE", mint: mm.flaskBlue, amount: 20 },
      { name: "FLASK_YELLOW", mint: mm.flaskYellow, amount: 20 },
      { name: "FLASK_GREEN", mint: mm.flaskGreen, amount: 20 },
      { name: "FLASK_PINK", mint: mm.flaskPink, amount: 20 },
      { name: "FLASK_PURPLE", mint: mm.flaskPurple, amount: 20 },
    ];
    
    const allResources = [...baseResources, ...materialResources];
    const instructions: any[] = [];
    let mintedCount = 0;
    let skippedCount = 0;
    
    for (const r of allResources) {
      if (!r.mint || r.mint === "11111111111111111111111111111111") {
        skippedCount++;
        continue;
      }
      
      try {
        const mintPk = pk(r.mint);
        const userAta = getAssociatedTokenAddressSync(mintPk, user);
        
        // Проверяем существует ли ATA, если нет - создаём
        const ataInfo = await connection.getAccountInfo(userAta);
        if (!ataInfo) {
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              AUTHORITY.publicKey,
              userAta,
              user,
              mintPk
            )
          );
        }
        
        // Минтим ресурс (умножаем на 1e9 для 9 decimals)
        const amountWithDecimals = r.amount * 1e9;
        const ix = await (program.methods as any)
          .mintResource(r.name.toLowerCase(), new (require("bn.js"))(amountWithDecimals))
          .accounts({
            config,
            materialMints,
            auth,
            user,
            mint: mintPk,
            tokenAccount: userAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        
        instructions.push(ix);
        mintedCount++;
      } catch (e: any) {
        console.log(`Skip ${r.name}:`, e.message);
        skippedCount++;
      }
    }
    
    if (instructions.length === 0) {
      return res.status(400).json({ error: "No valid mints to process" });
    }
    
    // Батчим инструкции по 10 (лимит Solana)
    const BATCH_SIZE = 10;
    const signatures = [];
    
    for (let i = 0; i < instructions.length; i += BATCH_SIZE) {
      const batch = instructions.slice(i, i + BATCH_SIZE);
      const sig = await authorityOnly(batch);
      signatures.push(sig);
    }
    
    res.json({
      success: true,
      message: `Granted ${mintedCount} resources (${skippedCount} skipped - no mints)`,
      signatures,
      resources: allResources.map(r => ({
        name: r.name,
        amount: r.amount,
        status: r.mint && r.mint !== "11111111111111111111111111111111" ? "granted" : "skipped"
      }))
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [ТЕСТ] Начисление POTATO (отдельно, через Config)
r.post("/test-grant-potato", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const amount = Number(req.body.amount || 10000);
    const [config] = configPda();
    const cfg: any = await fetchOne("config", config);
    
    if (!cfg?.potatoMint) {
      return res.status(400).json({ error: "PotatoMint not configured" });
    }
    
    const mintPk = pk(cfg.potatoMint);
    const userAta = getAssociatedTokenAddressSync(mintPk, user);
    const [auth] = authPda();
    
    // Создаём ATA если нет
    const instructions: any[] = [];
    const ataInfo = await connection.getAccountInfo(userAta);
    if (!ataInfo) {
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          AUTHORITY.publicKey,
          userAta,
          user,
          mintPk
        )
      );
    }
    
    const amountWithDecimals = amount * 1e9;
    const ix = await (program.methods as any)
      .mintResource("potato", new (require("bn.js"))(amountWithDecimals))
      .accounts({
        config,
        materialMints: materialMintsPda()[0],
        auth,
        user,
        mint: mintPk,
        tokenAccount: userAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    instructions.push(ix);
    const sig = await authorityOnly(instructions);
    
    res.json({ success: true, signature: sig, amount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// [ТЕСТ] Создание инструментов всех редкостей
r.post("/test-grant-tools", async (req, res) => {
  try {
    const user = pk(req.body.user);
    const toolTypes = ["axe", "pick", "spear", "bow"];
    const rarities = ["common", "uncommon", "rare", "epic"];
    const signatures = [];
    
    for (const toolType of toolTypes) {
      for (const rarity of rarities) {
        try {
          const resp = await (program.methods as any)
            .mintTool(toolType, rarity)
            .accounts({
              // Используем существующий mint_tool endpoint
            })
            .rpc();
          signatures.push({ toolType, rarity, sig: resp });
        } catch (e: any) {
          console.log(`Skip ${toolType}/${rarity}:`, e.message);
        }
      }
    }
    
    res.json({ success: true, tools: signatures });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});






// ===== Инициализация MaterialMints аккаунта =====
r.post("/init-material-mints", async (req, res) => {
  try {
    const { mints } = req.body;
    
    if (!mints || Object.keys(mints).length === 0) {
      return res.status(400).json({ 
        error: "Нужно передать mint-адреса"
      });
    }
    
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    
    // Конвертируем строки в PublicKey
    const mintKeys: Record<string, any> = {};
    for (const [key, val] of Object.entries(mints)) {
      if (typeof val === "string" && val.length > 0) {
        mintKeys[key] = new PublicKey(val);
      }
    }
    
    // Проверяем что все необходимые mint'ы есть
    const required = [
      "seeds", "wheat", "flour", "bread", "water", "coal", "meat",
      "stoneBlue", "stonePurple", "stoneRed",
      "sandWhite", "sandPink", "sandYellow",
      "gemBlue"
    ];
    const missing = required.filter(k => !mintKeys[k]);
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: "Отсутствуют обязательные mint-адреса",
        missing
      });
    }
    
    // Передаём mint'ы как ОТДЕЛЬНЫЕ аргументы (как в контракте)
    // Порядок аргументов должен точно совпадать с pub fn init_material_mints
    const ix = await (program.methods as any)
      .initMaterialMints(
        mintKeys.seeds,
        mintKeys.wheat,
        mintKeys.flour,
        mintKeys.bread,
        mintKeys.water,
        mintKeys.coal,
        mintKeys.meat,
        mintKeys.stoneBlue,
        mintKeys.stonePurple,
        mintKeys.stoneRed,
        mintKeys.sandWhite,
        mintKeys.sandPink,
        mintKeys.sandYellow,
        mintKeys.gemBlue
      )
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
        materialMints,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    const tx = await coSign([ix], AUTHORITY.publicKey);
    
    res.json({ 
      success: true, 
      tx,
      message: `Инициализировано 14 mint-адресов`
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// ===== Отправка подписанной транзакции =====
r.post("/send-tx", async (req, res) => {
  try {
    const { tx: txBase64 } = req.body;
    if (!txBase64) return res.status(400).json({ error: "tx required" });
    
    const { Transaction } = await import("@solana/web3.js");
    const { connection } = await import("../provider");
    
    const tx = Transaction.from(Buffer.from(txBase64, "base64"));
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    
    await connection.confirmTransaction(signature, "confirmed");
    
    res.json({ success: true, signature });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
