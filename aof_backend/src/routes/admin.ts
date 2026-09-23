import { Router } from "express";
import { SystemProgram, Transaction, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import {AUTHORITY, TREASURY, AUTHORITY_PUBKEY} from "../config";
import { fetchOne } from "../lib/decode";
import { program, connection, sessionProgram } from "../provider";
import {
  authPda,
  configPda,
  craftEconomyPda,
  rarityCounterPda,
  toolPda,
  vaultPda,
  playerPda,
  materialMintsPda,
  sessionConfigPda,
  sessionProgramDataPda,
  programDataPda,
  issuanceCapPda,
  RESOURCE_KIND_ORDER,
} from "../lib/pda";
import { authorityOnly, pk, coSign } from "../lib/tx";
import { requireAdmin, nonProductionOnly } from "../middleware/adminAuth";
import { simulateTransaction } from "../security/txSimulator";

const r = Router();
r.use(requireAdmin);

const RESOURCE_KIND_BY_NAME: Record<string, any> = {
  FOOD: { food: {} },
  WOOD: { wood: {} },
  STONE: { stone: {} },
  POTATO: { potato: {} },
  SEEDS: { seeds: {} },
  WHEAT: { wheat: {} },
  FLOUR: { flour: {} },
  BREAD: { bread: {} },
  WATER: { water: {} },
  COAL: { coal: {} },
  MEAT: { meat: {} },
  STONE_BLUE: { stoneBlue: {} },
  STONE_PURPLE: { stonePurple: {} },
  STONE_RED: { stoneRed: {} },
  SAND_WHITE: { sandWhite: {} },
  SAND_PINK: { sandPink: {} },
  SAND_YELLOW: { sandYellow: {} },
  GEM_BLUE: { gemBlue: {} },
  GEM_ORANGE: { gemOrange: {} },
  GEM_WHITE: { gemWhite: {} },
  GEM_GREEN: { gemGreen: {} },
  FLASK_BLUE: { flaskBlue: {} },
  FLASK_YELLOW: { flaskYellow: {} },
  FLASK_GREEN: { flaskGreen: {} },
  FLASK_PINK: { flaskPink: {} },
  FLASK_PURPLE: { flaskPurple: {} },
  LOVE_HEART: { loveHeart: {} },
};

r.post("/initialize", async (req, res) => {
  try {
    const [config] = configPda();
    const [auth] = authPda();
    const [vault] = vaultPda();
    const [programData] = programDataPda();
    const ix = await (program.methods as any)
      .initialize(TREASURY)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        auth,
        vault,
        programData,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig, config: config.toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.post("/session-config/init", async (req, res) => {
  try {
    const oracleAuthority = pk(req.body.oracleAuthority || AUTHORITY_PUBKEY.toBase58());
    const [config] = sessionConfigPda();
    const [programData] = sessionProgramDataPda();
    const ix = await (sessionProgram.methods as any)
      .initConfig()
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        oracleAuthority,
        programData,
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
      .accounts({ config, authority: AUTHORITY_PUBKEY })
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
      .accounts({ config, authority: AUTHORITY_PUBKEY })
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
    const seedsMint = pk(req.body.seedsMint);
    const waterMint = pk(req.body.waterMint);
    const potatoMint = pk(req.body.potatoMint);
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setResourceMints(foodMint, woodMint, stoneMint, seedsMint, waterMint, potatoMint)
      .accounts({ config, authority: AUTHORITY_PUBKEY })
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
        authority: AUTHORITY_PUBKEY,
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
      .accounts({ config, authority: AUTHORITY_PUBKEY, craftEconomy })
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
        authority: AUTHORITY_PUBKEY,
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
        migrationAuthority: AUTHORITY_PUBKEY,
        authority: AUTHORITY_PUBKEY,
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
// Bulk manual minting is a devnet/staging tool. In production resources are
// issued only through audited flows (inbox rewards with on-chain receipts).
r.post("/mint-resource", nonProductionOnly, async (req, res) => {
  try {
    const owner = pk(req.body.owner);
    const kind = req.body.kind;
    const amount = new BN(req.body.amount);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [auth] = authPda();
    const cfg: any = await fetchOne("config", config);
    if (!cfg || !cfg.treasury) return res.status(400).json({ error: "Config not initialized" });
    const mint = kind === "Food" ? cfg.foodMint
      : kind === "Wood" ? cfg.woodMint
      : kind === "Stone" ? cfg.stoneMint
      : kind === "Potato" ? cfg.potatoMint
      : undefined;
    if (!mint) return res.status(400).json({ error: "минт ресурса не задан в конфиге" });
    const mintPk = typeof mint === "string" ? pk(mint) : mint;
    const treasury = new PublicKey(cfg.treasury.toString());
    const userAta = getAssociatedTokenAddressSync(mintPk, owner, true);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasury, true);
    const kindMap: Record<string, any> = {
      Food: { food: {} },
      Wood: { wood: {} },
      Stone: { stone: {} },
      Potato: { potato: {} },
    };

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY_PUBKEY, userAta, owner, mintPk
    );
    const createTreasuryAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      AUTHORITY_PUBKEY, treasuryAta, cfg.treasury, mintPk
    );

    const ix = await (program.methods as any)
      .mintResource(kindMap[kind], amount)
      .accounts({
        config,
        materialMints,
        authority: AUTHORITY_PUBKEY,
        auth,
        mint: mintPk,
        tokenAccount: userAta,
        treasuryToken: treasuryAta,
        player: playerPda(owner)[0],
        issuanceCap: issuanceCapPda(kindMap[kind])[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const sig = await authorityOnly([createTreasuryAtaIx, createAtaIx, ix]);
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
    const unit = new BN(1_000_000_000);
    const asAtomic = (values: number[]) => values.map((x) => new BN(x).mul(unit));
    const woodBase = asAtomic([100, 150, 500, 2_000]);
    const stoneBase = asAtomic([100, 120, 400, 1_500]);
    const woodMult = asAtomic([1, 2, 10, 50]);
    const stoneMult = asAtomic([1, 2, 10, 50]);

    const ix1 = await (program.methods as any)
      .initCraftEconomy()
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        craftEconomy,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const ix2 = await (program.methods as any)
      .setCraftEconomy(woodBase, stoneBase, woodMult, stoneMult)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
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
r.post("/test-grant", nonProductionOnly, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const [config] = configPda();
    const [materialMints] = materialMintsPda();
    const [auth] = authPda();
    
    const cfg: any = await fetchOne("config", config);
    const mm: any = await fetchOne("materialMints", materialMints);
    const treasury = cfg?.treasury ? new PublicKey(cfg.treasury.toString()) : null;
    
    if (!cfg || !mm || !treasury) {
      return res.status(400).json({ error: "Config/MaterialMints not initialized" });
    }
    
    // Базовые ресурсы из Config (FOOD/WOOD/STONE) - много для тестов
    const baseResources = [
      { name: "FOOD", mint: cfg.foodMint, amount: 10000 },
      { name: "WOOD", mint: cfg.woodMint, amount: 10000 },
      { name: "STONE", mint: cfg.stoneMint, amount: 10000 },
      { name: "POTATO", mint: cfg.potatoMint, amount: 10000 },
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
        const userAta = getAssociatedTokenAddressSync(mintPk, user, true);
        const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasury, true);
        
        // Проверяем существуют ли ATA, если нет — создаём их authority-плательщиком.
        const [userInfo, treasuryInfo] = await Promise.all([
          connection.getAccountInfo(userAta),
          connection.getAccountInfo(treasuryAta),
        ]);
        if (!userInfo) {
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              AUTHORITY_PUBKEY,
              userAta,
              user,
              mintPk,
            )
          );
        }
        if (!treasuryInfo) {
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              AUTHORITY_PUBKEY,
              treasuryAta,
              treasury,
              mintPk,
            )
          );
        }
        
        // Минтим ресурс (ресурсные mint'ы используют 9 atomic decimals).
        const amountWithDecimals = r.amount * 1e9;
        const kind = RESOURCE_KIND_BY_NAME[r.name];
        if (!kind) throw new Error(`Unknown resource kind: ${r.name}`);
        const ix = await (program.methods as any)
          .mintResource(kind, new BN(amountWithDecimals))
          .accounts({
            config,
            materialMints,
            authority: AUTHORITY_PUBKEY,
            auth,
            mint: mintPk,
            tokenAccount: userAta,
            treasuryToken: treasuryAta,
            player: playerPda(user)[0],
            issuanceCap: issuanceCapPda(kind)[0],
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
r.post("/test-grant-potato", nonProductionOnly, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const amount = Number(req.body.amount || 10000);
    const [config] = configPda();
    const cfg: any = await fetchOne("config", config);
    
    if (!cfg?.potatoMint) {
      return res.status(400).json({ error: "PotatoMint not configured" });
    }
    
    const mintPk = pk(cfg.potatoMint);
    const treasury = new PublicKey(cfg.treasury.toString());
    const userAta = getAssociatedTokenAddressSync(mintPk, user, true);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasury, true);
    const [auth] = authPda();
    const [materialMints] = materialMintsPda();
    
    // Идемпотентно создаём ATA игрока и казны.
    const instructions: any[] = [
      createAssociatedTokenAccountIdempotentInstruction(
        AUTHORITY_PUBKEY, userAta, user, mintPk,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        AUTHORITY_PUBKEY, treasuryAta, treasury, mintPk,
      ),
    ];
    
    const amountWithDecimals = amount * 1e9;
    const ix = await (program.methods as any)
      .mintResource(RESOURCE_KIND_BY_NAME.POTATO, new BN(amountWithDecimals))
      .accounts({
        config,
        materialMints,
        authority: AUTHORITY_PUBKEY,
        auth,
        mint: mintPk,
        tokenAccount: userAta,
        treasuryToken: treasuryAta,
        player: playerPda(user)[0],
        issuanceCap: issuanceCapPda(RESOURCE_KIND_BY_NAME.POTATO)[0],
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

// Tool grants stay disabled: the old endpoint had an incomplete account map and
// must not advertise a transaction that cannot be built against the deployed IDL.
r.post("/test-grant-tools", nonProductionOnly, (_req, res) => {
  res.status(503).json({ error: "TOOL_GRANT_DISABLED_UNTIL_ACCOUNT_MAP_IS_IMPLEMENTED" });
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
      "gemBlue", "gemOrange", "gemWhite", "gemGreen",
      "flaskBlue", "flaskYellow", "flaskGreen", "flaskPink", "flaskPurple",
      "loveHeart"
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
        mintKeys.gemBlue,
        mintKeys.gemOrange,
        mintKeys.gemWhite,
        mintKeys.gemGreen,
        mintKeys.flaskBlue,
        mintKeys.flaskYellow,
        mintKeys.flaskGreen,
        mintKeys.flaskPink,
        mintKeys.flaskPurple,
        mintKeys.loveHeart
      )
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        materialMints,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    const tx = await coSign([ix], AUTHORITY_PUBKEY);
    
    res.json({ 
      success: true, 
      tx,
      message: `Инициализировано 23 mint-адреса`
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// ===== Issuance caps (per-ResourceKind on-chain mint budget) =====
// Both endpoints sign with config.authority. After the Squads migration this
// key is the multisig and these routes become read-only helpers that only
// build the instruction for the vault to sign.
const SLOTS_PER_DAY = 216_000; // ~400ms slots

r.get("/issuance-caps", async (_req, res) => {
  try {
    const out: any[] = [];
    for (const name of RESOURCE_KIND_ORDER) {
      const [pda] = issuanceCapPda(name);
      const acc: any = await fetchOne("issuanceCap", pda).catch(() => null);
      out.push(acc ? {
        kind: name, pda: pda.toBase58(), configured: true,
        epochSlots: acc.epochSlots.toString(), capPerEpoch: acc.capPerEpoch.toString(),
        epochStartSlot: acc.epochStartSlot.toString(), mintedInEpoch: acc.mintedInEpoch.toString(),
        lifetimeMinted: acc.lifetimeMinted.toString(),
        headroom: (BigInt(acc.capPerEpoch.toString()) - BigInt(acc.mintedInEpoch.toString())).toString(),
      } : { kind: name, pda: pda.toBase58(), configured: false });
    }
    res.json({ caps: out, note: "unconfigured kinds cannot be minted (fail-closed)" });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/issuance-caps/init { kind, epochSlots?, capPerEpoch } — one-time per kind. */
r.post("/issuance-caps/init", async (req, res) => {
  try {
    const kind = String(req.body.kind);
    if (!(RESOURCE_KIND_ORDER as readonly string[]).includes(kind)) return res.status(400).json({ error: "unknown kind" });
    const epochSlots = new BN(String(req.body.epochSlots ?? SLOTS_PER_DAY));
    const capPerEpoch = new BN(String(req.body.capPerEpoch));
    if (capPerEpoch.lten(0)) return res.status(400).json({ error: "capPerEpoch must be > 0" });
    const [config] = configPda();
    const ix = await (program.methods as any)
      .initIssuanceCap({ [kind]: {} }, epochSlots, capPerEpoch)
      .accounts({ config, authority: AUTHORITY_PUBKEY, issuanceCap: issuanceCapPda(kind)[0], systemProgram: SystemProgram.programId })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ success: true, signature: sig, kind, epochSlots: epochSlots.toString(), capPerEpoch: capPerEpoch.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/** POST /admin/issuance-caps/set { kind, epochSlots, capPerEpoch } — capPerEpoch=0 halts that kind. */
r.post("/issuance-caps/set", async (req, res) => {
  try {
    const kind = String(req.body.kind);
    if (!(RESOURCE_KIND_ORDER as readonly string[]).includes(kind)) return res.status(400).json({ error: "unknown kind" });
    const epochSlots = new BN(String(req.body.epochSlots ?? SLOTS_PER_DAY));
    const capPerEpoch = new BN(String(req.body.capPerEpoch));
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setIssuanceCap({ [kind]: {} }, epochSlots, capPerEpoch)
      .accounts({ config, authority: AUTHORITY_PUBKEY, issuanceCap: issuanceCapPda(kind)[0] })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ success: true, signature: sig, kind, epochSlots: epochSlots.toString(), capPerEpoch: capPerEpoch.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ===== Relay of an arbitrary pre-signed transaction =====
// Devnet debugging aid only. It is NOT available in production: an operator
// token would otherwise become a universal relay for any transaction that
// passes simulation. Production operators use the CLI / multisig directly.
r.post("/send-tx", nonProductionOnly, async (req, res) => {
  try {
    const { tx: txBase64 } = req.body;
    if (!txBase64) return res.status(400).json({ error: "tx required" });
    
    const { Transaction } = await import("@solana/web3.js");
    const { connection } = await import("../provider");
    
    const tx = Transaction.from(Buffer.from(txBase64, "base64"));
    const simulation = await simulateTransaction(tx);
    if (!simulation.success) {
      return res.status(400).json({ error: `Transaction simulation failed: ${simulation.error || "unknown error"}` });
    }
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    
    const confirmation = await connection.confirmTransaction(signature, "finalized");
    if (confirmation.value.err) throw new Error(`Transaction execution failed: ${signature}`);
    
    res.json({ success: true, signature });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
