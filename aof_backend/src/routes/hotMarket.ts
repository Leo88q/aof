import { Router } from "express";
import { validate } from "../middleware/validate";
import { hotMarketBuySchema, hotMarketPoolInitSchema } from "../lib/validation";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { AUTHORITY } from "../config";
import { marketProgram } from "../provider";
import {
  hotMarketPoolPda,
  hotMarketQueuePda,
  potatoConfigPda,
} from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";

const r = Router();

// Инициализация конфигурации рынка (маскот-токен, комиссии, казна)
r.post("/config/init", async (req, res) => {
  try {
    const potatoMint = pk(req.body.potatoMint);
    const treasuryPotato = pk(req.body.treasuryPotato);
    const treasurySol = pk(req.body.treasurySol);
    const feeBps = Number(req.body.feeBps);

    const [potatoConfig] = potatoConfigPda();

    const ix = await (marketProgram.methods as any)
      .initMarketConfig(treasuryPotato, treasurySol, feeBps)
      .accounts({
        potatoConfig,
        potatoMint,
        authority: AUTHORITY.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Создание пула для редкости (1-4 = uncommon..legendary)
r.post("/pool/init", validate(hotMarketPoolInitSchema), async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);
    const params = {
      basePricePotato: new BN(req.body.basePricePotato),
      basePriceSolLamports: new BN(req.body.basePriceSolLamports),
      growthPerPurchaseBps: Number(req.body.growthPerPurchaseBps),
      decayPerHourBps: Number(req.body.decayPerHourBps),
      targetSalesPerHour: Number(req.body.targetSalesPerHour),
      feeBps: Number(req.body.feeBps),
    };

    const [pool] = hotMarketPoolPda(rarity);
    const [queue] = hotMarketQueuePda(rarity);
    const [potatoConfig] = potatoConfigPda();

    const ix = await (marketProgram.methods as any)
      .hotMarketInitPool(rarity, params)
      .accounts({
        pool,
        queue,
        potatoConfig,
        authority: AUTHORITY.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Покупка инструмента из очереди (за маскот-токен)
r.post("/buy", validate(hotMarketBuySchema), async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const rarity = Number(req.body.rarity);
    const toolMint = pk(req.body.toolMint);
    const priceSnapshot = new BN(req.body.priceSnapshot);
    const slippageBps = Number(req.body.slippageBps || 100);

    const [pool] = hotMarketPoolPda(rarity);
    const [queue] = hotMarketQueuePda(rarity);
    const [potatoConfig] = potatoConfigPda();

    // Читаем конфиг чтобы взять адреса казны и минта
    const config: any = await (marketProgram.account as any)["potatoConfig"].fetch(potatoConfig);
    const potatoMint = config.potatoMint;
    const treasuryPotato = config.treasuryPotato;
    // [ФИКС] Берём и SOL-казну для ветки оплаты в SOL
    const treasurySol = config.treasurySol;

    const buyerPotato = getAssociatedTokenAddressSync(potatoMint, buyer);
    const poolToolToken = getAssociatedTokenAddressSync(toolMint, pool, true);
    const buyerToolToken = getAssociatedTokenAddressSync(toolMint, buyer);

    // [ФИКС] Валюта оплаты теперь динамическая: req.body.currency = "sol" | "potato"
    // Для SOL-оплаты клиент шлёт currency="sol"; buyerPotato для SOL не обязателен
    // (контракт держит его как Option, пустой ATA резолвится в None).
    const currency = req.body.currency === "sol" ? { sol: {} } : { potato: {} };

    const ix = await (marketProgram.methods as any)
      .hotMarketBuy(rarity, currency, priceSnapshot, slippageBps)
      .accounts({
        pool,
        queue,
        potatoConfig,
        buyer,
        buyerPotato,
        potatoMint,
        treasuryPotato,
        // [ФИКС] Новый аккаунт контракта: SOL-казна для ветки Sol
        treasurySol,
        toolMint,
        poolToolToken,
        buyerToolToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], buyer);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Продажа своего инструмента в очередь пула
r.post("/sell", requireCircuitOpen, requireWalletLimits("hotmarket_sell"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const rarity = Number(req.body.rarity);
    const toolMint = pk(req.body.toolMint);
    const minPrice = new BN(req.body.minPrice || "0");

    const [pool] = hotMarketPoolPda(rarity);
    const [queue] = hotMarketQueuePda(rarity);

    const sellerToolToken = getAssociatedTokenAddressSync(toolMint, seller);
    const poolToolToken = getAssociatedTokenAddressSync(toolMint, pool, true);

    const ix = await (marketProgram.methods as any)
      .hotMarketSellIntoQueue(rarity, minPrice)
      .accounts({
        pool,
        queue,
        seller,
        signer: seller,        // [ФИКС] прямая продажа: продавец сам подписант
        sessionToken: null,      // [ФИКС] для сессии передаётся токен сессии,
        toolMint,
        sellerToolToken,
        poolToolToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], seller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Пропуск текущего лота (реролл)
r.post("/skip", requireCircuitOpen, requireWalletLimits("hot_market_skip"), requireIdempotency, async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);
    // [ФИКС] Скип теперь player-facing: игрок платит фис в SOL в казну
    const player = pk(req.body.player);

    const [pool] = hotMarketPoolPda(rarity);
    const [queue] = hotMarketQueuePda(rarity);
    const [potatoConfig] = potatoConfigPda();

    // Читаем конфиг чтобы взять адрес SOL-казны
    const config: any = await (marketProgram.account as any)["potatoConfig"].fetch(potatoConfig);

    const ix = await (marketProgram.methods as any)
      .hotMarketSkip(rarity)
      .accounts({
        pool,
        queue,
        potatoConfig,
        player,
        treasurySol: config.treasurySol,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const tx = await coSign([ix], player);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Запуск горячего окна (ивент)
r.post("/event/start", async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);
    const durationSeconds = new BN(req.body.durationSeconds);
    const multiplierBps = Number(req.body.multiplierBps);

    const [pool] = hotMarketPoolPda(rarity);

    const ix = await (marketProgram.methods as any)
      .hotMarketStartEvent(rarity, durationSeconds, multiplierBps)
      .accounts({
        pool,
        authority: AUTHORITY.publicKey,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Permissionless обновление цены (может вызываться keeper-ботом)
r.post("/crank", async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);

    const [pool] = hotMarketPoolPda(rarity);

    const ix = await (marketProgram.methods as any)
      .hotMarketCrank(rarity)
      .accounts({
        pool,
        caller: AUTHORITY.publicKey,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
