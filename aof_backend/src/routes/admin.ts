import { Router } from "express";
import { SystemProgram, Transaction, PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createInitializeMintInstruction, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import {AUTHORITY, TREASURY, AUTHORITY_PUBKEY} from "../config";
import { fetchOne, fetchOneForSigner } from "../lib/decode";
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
  DATA: { data: {} },
  CIRCUIT: { circuit: {} },
  SILICON: { silicon: {} },
  MIND: { mind: {} },
  NEURON: { neuron: {} },
  SYNAPSE: { synapse: {} },
  SIGNAL: { signal: {} },
  MODEL: { model: {} },
  POWER: { power: {} },
  COMPUTE: { compute: {} },
  DATASET: { dataset: {} },
  BLUE_CORE: { blueCore: {} },
  PURPLE_CORE: { purpleCore: {} },
  RED_CORE: { redCore: {} },
  CLEAR_QUARTZ: { clearQuartz: {} },
  ROSE_QUARTZ: { roseQuartz: {} },
  AMBER_QUARTZ: { amberQuartz: {} },
  QUANTUM_BIT: { quantumBit: {} },
  NEURAL_CHIP: { neuralChip: {} },
  PHOTON_BIT: { photonBit: {} },
  BIO_CHIP: { bioChip: {} },
  CRYO_FLUID: { cryoFluid: {} },
  VOLT_FLUID: { voltFluid: {} },
  BIO_FLUID: { bioFluid: {} },
  NANO_FLUID: { nanoFluid: {} },
  QUANTUM_FLUID: { quantumFluid: {} },
  SOUL_CORE: { soulCore: {} },
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
    const dataMint = pk(req.body.dataMint);
    const circuitMint = pk(req.body.circuitMint);
    const siliconMint = pk(req.body.siliconMint);
    const neuronMint = pk(req.body.neuronMint);
    const powerMint = pk(req.body.powerMint);
    const mindMint = pk(req.body.mindMint);
    const [config] = configPda();
    const ix = await (program.methods as any)
      .setResourceMints(dataMint, circuitMint, siliconMint, neuronMint, powerMint, mindMint)
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
    const circuitBase = (req.body.circuitBase || ["100","100","100","100"]).map((x: any) => new BN(x));
    const siliconBase = (req.body.siliconBase || ["100","100","100","100"]).map((x: any) => new BN(x));
    const circuitMult = (req.body.circuitMult || ["2","2","2","2"]).map((x: any) => new BN(x));
    const siliconMult = (req.body.siliconMult || ["2","2","2","2"]).map((x: any) => new BN(x));
    const [config] = configPda();
    const [craftEconomy] = craftEconomyPda();
    
    console.log("[craft-economy/set] params:", { circuitBase, siliconBase, circuitMult, siliconMult });
    
    const ix = await (program.methods as any)
      .setCraftEconomy(circuitBase, siliconBase, circuitMult, siliconMult)
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
    const cfg: any = await fetchOneForSigner("config", config);
    if (!cfg || !cfg.treasury) return res.status(400).json({ error: "Config not initialized" });
    const mint = kind === "Data" ? cfg.dataMint
      : kind === "Circuit" ? cfg.circuitMint
      : kind === "Silicon" ? cfg.siliconMint
      : kind === "Mind" ? cfg.mindMint
      : undefined;
    if (!mint) return res.status(400).json({ error: "минт ресурса не задан в конфиге" });
    const mintPk = typeof mint === "string" ? pk(mint) : mint;
    const treasury = new PublicKey(cfg.treasury.toString());
    const userAta = getAssociatedTokenAddressSync(mintPk, owner, true);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasury, true);
    const kindMap: Record<string, any> = {
      data: { data: {} },
      circuit: { circuit: {} },
      silicon: { silicon: {} },
      mind: { mind: {} },
    };

    // [PAYER] ATA игрока — его аккаунт и его подпись: создаётся лениво в ЕГО
    // транзакции (owner = fee payer = payer ATA), authority только авторизует
    // минт. ATA казны — инфраструктура проекта: проект оплачивает её сам и
    // только если её ещё нет, вне транзакции игрока.
    const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta, "confirmed");
    if (!treasuryAtaInfo) {
      await authorityOnly([
        createAssociatedTokenAccountIdempotentInstruction(
          AUTHORITY_PUBKEY, treasuryAta, cfg.treasury, mintPk,
        ),
      ]);
    }
    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      owner, userAta, owner, mintPk
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

    const tx = await coSign([createAtaIx, ix], owner);
    res.json({ tx });
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
    const circuitBase = asAtomic([100, 150, 500, 2_000]);
    const siliconBase = asAtomic([100, 120, 400, 1_500]);
    const circuitMult = asAtomic([1, 2, 10, 50]);
    const siliconMult = asAtomic([1, 2, 10, 50]);

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
      .setCraftEconomy(circuitBase, siliconBase, circuitMult, siliconMult)
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
    
    const cfg: any = await fetchOneForSigner("config", config);
    const mm: any = await fetchOneForSigner("materialMints", materialMints);
    const treasury = cfg?.treasury ? new PublicKey(cfg.treasury.toString()) : null;
    
    if (!cfg || !mm || !treasury) {
      return res.status(400).json({ error: "Config/MaterialMints not initialized" });
    }
    
    // Базовые ресурсы из Config (DATA/CIRCUIT/SILICON) - много для тестов
    const baseResources = [
      { name: "DATA", mint: cfg.dataMint, amount: 10000 },
      { name: "CIRCUIT", mint: cfg.circuitMint, amount: 10000 },
      { name: "SILICON", mint: cfg.siliconMint, amount: 10000 },
      { name: "MIND", mint: cfg.mindMint, amount: 10000 },
    ];
    
    // Все ресурсы из MaterialMints
    const materialResources = [
      { name: "NEURON", mint: mm.neuron, amount: 500 },
      { name: "SYNAPSE", mint: mm.synapse, amount: 1000 },
      { name: "SIGNAL", mint: mm.signal, amount: 500 },
      { name: "MODEL", mint: mm.model, amount: 200 },
      { name: "POWER", mint: mm.power, amount: 2000 },
      { name: "COMPUTE", mint: mm.compute, amount: 500 },
      { name: "DATASET", mint: mm.dataset, amount: 300 },
      // Камни
      { name: "BLUE_CORE", mint: mm.blueCore, amount: 100 },
      { name: "PURPLE_CORE", mint: mm.purpleCore, amount: 100 },
      { name: "RED_CORE", mint: mm.redCore, amount: 100 },
      // Песок
      { name: "CLEAR_QUARTZ", mint: mm.clearQuartz, amount: 100 },
      { name: "ROSE_QUARTZ", mint: mm.roseQuartz, amount: 100 },
      { name: "AMBER_QUARTZ", mint: mm.amberQuartz, amount: 100 },
      // Гемы
      { name: "QUANTUM_BIT", mint: mm.quantumBit, amount: 50 },
      { name: "NEURAL_CHIP", mint: mm.neuralChip, amount: 50 },
      { name: "PHOTON_BIT", mint: mm.photonBit, amount: 50 },
      { name: "BIO_CHIP", mint: mm.bioChip, amount: 50 },
      // Флаконы
      { name: "CRYO_FLUID", mint: mm.cryoFluid, amount: 20 },
      { name: "VOLT_FLUID", mint: mm.voltFluid, amount: 20 },
      { name: "BIO_FLUID", mint: mm.bioFluid, amount: 20 },
      { name: "NANO_FLUID", mint: mm.nanoFluid, amount: 20 },
      { name: "QUANTUM_FLUID", mint: mm.quantumFluid, amount: 20 },
    ];
    
    const allResources = [...baseResources, ...materialResources];
    const instructions: any[] = [];
    const treasurySetup: any[] = [];
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
        
        // [PAYER] ATA игрока — его аккаунт: создаётся лениво в его транзакции,
        // платит и подписывает игрок. ATA казны — инфраструктура проекта: её
        // проект оплачивает сам, вне транзакции игрока.
        const [userInfo, treasuryInfo] = await Promise.all([
          connection.getAccountInfo(userAta, "confirmed"),
          connection.getAccountInfo(treasuryAta, "confirmed"),
        ]);
        if (!userInfo) {
          instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(
              user,
              userAta,
              user,
              mintPk,
            )
          );
        }
        if (!treasuryInfo) {
          treasurySetup.push(
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
    
    // ATA казны проект создаёт сам: это инфраструктура, а не аккаунт игрока.
    if (treasurySetup.length) await authorityOnly(treasurySetup);

    // Инструкции минта игроку отдаём частично подписанной транзакцией: у
    // игрока появляется обязанность создать свой ATA и подписать её. Батчим
    // по 10 (лимит Solana) — каждая пачка подписывается игроком отдельно.
    const BATCH_SIZE = 10;
    const txs: string[] = [];
    
    for (let i = 0; i < instructions.length; i += BATCH_SIZE) {
      const batch = instructions.slice(i, i + BATCH_SIZE);
      txs.push(await coSign(batch, user));
    }
    
    res.json({
      success: true,
      message: `Granted ${mintedCount} resources (${skippedCount} skipped - no mints)`,
      txs,
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

// [ТЕСТ] Начисление MIND (отдельно, через Config)
r.post("/test-grant-mind", nonProductionOnly, async (req, res) => {
  try {
    const user = pk(req.body.user);
    const amount = Number(req.body.amount || 10000);
    const [config] = configPda();
    const cfg: any = await fetchOneForSigner("config", config);
    
    if (!cfg?.mindMint) {
      return res.status(400).json({ error: "External MIND mint not configured" });
    }
    
    const mintPk = pk(cfg.mindMint);
    const treasury = new PublicKey(cfg.treasury.toString());
    const userAta = getAssociatedTokenAddressSync(mintPk, user, true);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasury, true);
    const [auth] = authPda();
    const [materialMints] = materialMintsPda();
    
    // [PAYER] ATA игрока оплачивает и подписывает игрок (в его транзакции);
    // ATA казны — инфраструктура проекта, её проект создаёт сам и только если
    // её ещё нет.
    const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta, "confirmed");
    if (!treasuryAtaInfo) {
      await authorityOnly([
        createAssociatedTokenAccountIdempotentInstruction(
          AUTHORITY_PUBKEY, treasuryAta, treasury, mintPk,
        ),
      ]);
    }
    const instructions: any[] = [
      createAssociatedTokenAccountIdempotentInstruction(
        user, userAta, user, mintPk,
      ),
    ];
    
    const amountWithDecimals = amount * 1e9;
    const ix = await (program.methods as any)
      .mintResource(RESOURCE_KIND_BY_NAME.MIND, new BN(amountWithDecimals))
      .accounts({
        config,
        materialMints,
        authority: AUTHORITY_PUBKEY,
        auth,
        mint: mintPk,
        tokenAccount: userAta,
        treasuryToken: treasuryAta,
        player: playerPda(user)[0],
        issuanceCap: issuanceCapPda(RESOURCE_KIND_BY_NAME.MIND)[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    
    instructions.push(ix);
    const tx = await coSign(instructions, user);
    
    res.json({ success: true, tx, amount });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Выдача инструментов (только вне продакшена). Раньше здесь стояла заглушка
// «нет карты аккаунтов»: актуальная карта — config, authority, auth-PDA, минт,
// ATA получателя, сам получатель и ToolData-PDA. Минт создаётся 0-decimal с
// авторитетом auth-PDA (иначе mint_tool отклонит его по mint_authority), а
// `token_account.owner == recipient` проверяет уже сама программа: инструмент
// нельзя навязать кошельку, который его не просил.
const TOOL_KIND_IDS = [
  "plasma_cutter", "silicon_extractor", "data_harvester", "quantum_transmitter", "neural_seeder",
] as const;
const TOOL_RARITY_ARG: Record<string, any> = {
  common: { common: {} },
  uncommon: { uncommon: {} },
  rare: { rare: {} },
  epic: { epic: {} },
  legendary: { legendary: {} },
};

r.post("/test-grant-tools", nonProductionOnly, async (req, res) => {
  try {
    if (!AUTHORITY) {
      return res.status(503).json({ error: "Authority signing is disabled (AUTHORITY_MODE=read-only)." });
    }
    const recipient = pk(req.body.user || req.body.recipient);
    if (recipient.equals(AUTHORITY_PUBKEY)) {
      return res.status(400).json({ error: "AUTHORITY_CANNOT_BE_TOOL_RECIPIENT" });
    }
    const toolType = String(req.body.toolType || "plasma_cutter").toLowerCase();
    const rarity = TOOL_RARITY_ARG[String(req.body.rarity || "common").toLowerCase()];
    const count = Math.min(Math.max(Number(req.body.count ?? 1) || 1, 1), 5);
    if (!(TOOL_KIND_IDS as readonly string[]).includes(toolType)) {
      return res.status(400).json({ error: "Unknown tool type" });
    }
    if (!rarity) return res.status(400).json({ error: "Unknown rarity" });

    const [config] = configPda();
    const [auth] = authPda();
    const instructions: any[] = [];
    const mintKeypairs: Keypair[] = [];
    const granted: Array<{ mint: string; tokenAccount: string; toolData: string }> = [];
    // [PAYER] Инструмент — собственность получателя: mint-аккаунт, ATA и
    // ToolData оплачивает он, а не кошелёк проекта. Backend только готовит
    // частично подписанную транзакцию фиксированной формы: authority
    // подписывает исключительно минт-авторизацию (mint_authority = auth PDA),
    // подпись получателя и оплата добавляются его кошельком. Блокхаш — expiry.
    const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    for (let index = 0; index < count; index += 1) {
      const mintKp = Keypair.generate();
      const mint = mintKp.publicKey;
      const tokenAccount = getAssociatedTokenAddressSync(mint, recipient);
      const [toolData] = toolPda(mint);
      instructions.push(
        SystemProgram.createAccount({
          fromPubkey: recipient,
          newAccountPubkey: mint,
          lamports: mintRent,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
      );
      instructions.push(createInitializeMintInstruction(mint, 0, auth, null));
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(recipient, tokenAccount, recipient, mint),
      );
      instructions.push(await (program.methods as any)
        .mintTool(toolType, rarity)
        .accounts({
          config,
          authority: AUTHORITY_PUBKEY,
          auth,
          mint,
          tokenAccount,
          recipient,
          payer: recipient,
          toolData,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction());
      mintKeypairs.push(mintKp);
      granted.push({ mint: mint.toBase58(), tokenAccount: tokenAccount.toBase58(), toolData: toolData.toBase58() });
    }
    const tx = await coSign(instructions, recipient, mintKeypairs);
    res.json({ success: true, count: granted.length, recipient: recipient.toBase58(), tx, granted });
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
    const required = ["neuron", "synapse", "signal", "model", "power", "compute", "dataset", "blueCore", "purpleCore", "redCore", "clearQuartz", "roseQuartz", "amberQuartz", "quantumBit", "neuralChip", "photonBit", "bioChip", "cryoFluid", "voltFluid", "bioFluid", "nanoFluid", "quantumFluid", "soulCore"];
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
        mintKeys.neuron,
        mintKeys.synapse,
        mintKeys.signal,
        mintKeys.model,
        mintKeys.power,
        mintKeys.compute,
        mintKeys.dataset,
        mintKeys.blueCore,
        mintKeys.purpleCore,
        mintKeys.redCore,
        mintKeys.clearQuartz,
        mintKeys.roseQuartz,
        mintKeys.amberQuartz,
        mintKeys.quantumBit,
        mintKeys.neuralChip,
        mintKeys.photonBit,
        mintKeys.bioChip,
        mintKeys.cryoFluid,
        mintKeys.voltFluid,
        mintKeys.bioFluid,
        mintKeys.nanoFluid,
        mintKeys.quantumFluid,
        mintKeys.soulCore
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
