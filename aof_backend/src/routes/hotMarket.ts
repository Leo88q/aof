import { Router } from "express";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {AUTHORITY_PUBKEY, PROGRAM_ID} from "../config";
import { marketProgram } from "../provider";
import { marketConfigPda, marketProgramDataPda, hotMarketPoolPda, toolPda } from "../lib/pda";
import { authorityOnly, coSign, pk } from "../lib/tx";
import { requireCircuitOpen, requireWalletLimits, requireIdempotency } from "../middleware/security";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

type CurrencyName = "core" | "gem";

function currencyArg(value: unknown): { core: {} } | { gem: {} } {
  return value === "gem" ? { gem: {} } : { core: {} };
}

function currencyMint(config: any, currency: CurrencyName) {
  return currency === "gem" ? config.gemMint : config.coreMint;
}


/**
 * Слиппедж-пара сделки обязательна. Пустая или нулевая граница превращает
 * подписанную транзакцию в «согласен на любую цену пула», поэтому обе стороны
 * горячего рынка подписывают потолок (покупка) или минимум (продажа).
 */
function requireQuote(value: unknown, field: string): void {
  if (value === undefined || value === null || String(value).trim() === "") {
    const err: any = new Error(`${field} is required: the wallet must sign a price bound`);
    err.status = 400;
    throw err;
  }
  if (BigInt(String(value)) <= 0n) {
    const err: any = new Error(`${field} must be greater than zero`);
    err.status = 400;
    throw err;
  }
}

// Инициализация конфигурации рынка. Все параметры и адреса соответствуют
// текущей on-chain программе aof-market; старый mindConfig API удалён.
r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const coreMint = pk(req.body.coreMint || req.body.mindMint);
    const gemMint = pk(req.body.gemMint);
    const treasury = pk(req.body.treasury);
    const feeBps = Number(req.body.feeBps);
    if (!Number.isInteger(feeBps) || feeBps < 800 || feeBps > 1_000) {
      return res.status(400).json({ error: "MARKET_FEE_OUTSIDE_TREASURY_BAND" });
    }
    const [config] = marketConfigPda();
    const [programData] = marketProgramDataPda();

    const ix = await (marketProgram.methods as any)
      .initMarketConfig(feeBps)
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        coreMint,
        gemMint,
        treasury,
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

// Создание пула для редкости (0-3 = common..epic).
r.post("/pool/init", requireAdmin, async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);
    const targetPriceCore = new BN(req.body.targetPriceCore ?? req.body.basePriceCore ?? req.body.basePriceMind);
    const targetPriceGem = new BN(req.body.targetPriceGem ?? req.body.basePriceGem ?? 0);
    const targetRatePerHour = new BN(req.body.targetRatePerHour ?? req.body.targetSalesPerHour ?? 0);
    const decayBpsPerHour = Number(req.body.decayBpsPerHour ?? req.body.decayPerHourBps);
    const growthBpsPerSale = Number(req.body.growthBpsPerSale ?? req.body.growthPerPurchaseBps);
    const feeBps = Number(req.body.feeBps);
    if (!Number.isInteger(feeBps) || feeBps < 800 || feeBps > 1_000) {
      return res.status(400).json({ error: "MARKET_FEE_OUTSIDE_TREASURY_BAND" });
    }
    const [config] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);
    const marketConfig: any = await (marketProgram.account as any).marketConfig.fetch(config);

    const ix = await (marketProgram.methods as any)
      .initPool(
        rarity,
        targetPriceCore,
        targetPriceGem,
        targetRatePerHour,
        decayBpsPerHour,
        growthBpsPerSale,
        feeBps,
      )
      .accounts({
        config,
        authority: AUTHORITY_PUBKEY,
        pool,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    // Двустороннему пулу нужны свои ATA обеих валют: сюда приходит цена покупки
    // и отсюда платит продажа. Казна получает комиссию в свои ATA. Создаём
    // идемпотентно тем же authority, который инициализирует пул.
    const setup = [marketConfig.coreMint, marketConfig.gemMint].flatMap((mint: any) => [
      createAssociatedTokenAccountIdempotentInstruction(AUTHORITY_PUBKEY, getAssociatedTokenAddressSync(mint, pool, true), pool, mint),
      createAssociatedTokenAccountIdempotentInstruction(AUTHORITY_PUBKEY, getAssociatedTokenAddressSync(mint, marketConfig.treasury), marketConfig.treasury, mint),
    ]);

    const sig = await authorityOnly([...setup, ix]);
    res.json({ sig, poolCurrencyAta: getAssociatedTokenAddressSync(marketConfig.coreMint, pool, true).toBase58() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Покупка инструмента из инвентаря пула. aof_market проверяет канонический
// ToolData (PDA [tool, mint] программы aof_core) и переводит NFT вместе с
// владением одной CPI в aof_core::transfer_tool — купленный инструмент сразу
// можно майнить и ремонтировать. Цену считает программа: покупатель подписывает
// только потолок maxPrice.
r.post("/buy", requireCircuitOpen, requireWalletLimits("hotmarket_buy"), requireIdempotency, async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const rarity = Number(req.body.rarity);
    const currency = (req.body.currency === "gem" ? "gem" : "core") as CurrencyName;
    const newToolMint = pk(req.body.newToolMint || req.body.toolMint);
    // Потолок цены обязателен: без него кошелёк подписал бы любую цену пула.
    requireQuote(req.body.maxPrice ?? req.body.priceSnapshot, "maxPrice");
    const maxPrice = new BN(req.body.maxPrice ?? req.body.priceSnapshot);
    const [configAddress] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);
    const config: any = await (marketProgram.account as any).marketConfig.fetch(configAddress);
    const mint = currencyMint(config, currency);
    const buyerCurrency = getAssociatedTokenAddressSync(mint, buyer);
    const treasuryCurrency = getAssociatedTokenAddressSync(mint, config.treasury);
    const poolCurrency = getAssociatedTokenAddressSync(mint, pool, true);
    const poolTool = getAssociatedTokenAddressSync(newToolMint, pool, true);
    const buyerTool = getAssociatedTokenAddressSync(newToolMint, buyer);
    const [toolData] = toolPda(newToolMint);

    // Покупатель получает инструмент в свой ATA: создаём его идемпотентно, платит
    // покупатель (он и так подписывает транзакцию).
    const createBuyerToolAta = createAssociatedTokenAccountIdempotentInstruction(
      buyer, buyerTool, buyer, newToolMint,
    );

    const ix = await (marketProgram.methods as any)
      .hotMarketBuy(rarity, currencyArg(currency), maxPrice)
      .accounts({
        config: configAddress,
        buyer,
        pool,
        treasury: config.treasury,
        currencyMint: mint,
        buyerCurrency,
        treasuryCurrency,
        newToolMint,
        poolTool,
        buyerTool,
        poolCurrency,
        toolData,
        coreProgram: PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([createBuyerToolAta, ix], buyer);
    res.json({ tx, priceCeiling: maxPrice.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Продажа инструмента в пул. Инструмент обязан быть каноническим ToolData
// самого продавца, NFT уходит в инвентарь пула, выплата — из резерва пула.
// Продавец подписывает минимум цены, чтобы пул не заплатил меньше.
r.post("/sell", requireCircuitOpen, requireWalletLimits("hotmarket_sell"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const rarity = Number(req.body.rarity);
    const currency = (req.body.currency === "gem" ? "gem" : "core") as CurrencyName;
    const soldToolMint = pk(req.body.soldToolMint || req.body.toolMint);
    requireQuote(req.body.minPrice, "minPrice");
    const minPrice = new BN(req.body.minPrice);
    const [configAddress] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);
    const config: any = await (marketProgram.account as any).marketConfig.fetch(configAddress);
    const mint = currencyMint(config, currency);
    const sellerCurrency = getAssociatedTokenAddressSync(mint, seller);
    const poolCurrency = getAssociatedTokenAddressSync(mint, pool, true);
    const treasuryCurrency = getAssociatedTokenAddressSync(mint, config.treasury);
    const sellerTool = getAssociatedTokenAddressSync(soldToolMint, seller);
    const poolTool = getAssociatedTokenAddressSync(soldToolMint, pool, true);
    const [toolData] = toolPda(soldToolMint);

    // Пулу нужен ATA проданного инструмента: создаём идемпотентно, ренту платит
    // продавец (владелец ATA — PDA пула, поэтому owner off-curve разрешён).
    const createPoolToolAta = createAssociatedTokenAccountIdempotentInstruction(
      seller, poolTool, pool, soldToolMint,
    );

    const ix = await (marketProgram.methods as any)
      .hotMarketSellIntoQueue(rarity, currencyArg(currency), minPrice)
      .accounts({
        config: configAddress,
        seller,
        pool,
        currencyMint: mint,
        sellerCurrency,
        poolCurrency,
        soldToolMint,
        sellerTool,
        poolTool,
        treasuryCurrency,
        toolData,
        coreProgram: PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([createPoolToolAta, ix], seller);
    res.json({ tx, priceFloor: minPrice.toString() });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Пропуск текущего окна (не transfer, только permissionless event).
r.post("/skip", requireCircuitOpen, requireWalletLimits("hot_market_skip"), requireIdempotency, async (req, res) => {
  try {
    const player = pk(req.body.player);
    const rarity = Number(req.body.rarity);
    const [pool] = hotMarketPoolPda(rarity);
    const ix = await (marketProgram.methods as any)
      .hotMarketSkip(rarity)
      .accounts({ user: player, pool })
      .instruction();
    const tx = await coSign([ix], player);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Запуск горячего окна (только authority).
r.post("/event/start", requireAdmin, async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);
    const durationSeconds = new BN(req.body.durationSeconds);
    const multiplierBps = Number(req.body.multiplierBps);
    const [config] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);
    const ix = await (marketProgram.methods as any)
      .startMarketEvent(rarity, durationSeconds, multiplierBps)
      .accounts({ config, authority: AUTHORITY_PUBKEY, pool })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Permissionless on-chain price/counter crank, sent by the configured keeper.
r.post("/crank", requireAdmin, async (req, res) => {
  try {
    const rarity = Number(req.body.rarity);
    const [pool] = hotMarketPoolPda(rarity);
    const ix = await (marketProgram.methods as any)
      .crankMarket(rarity)
      .accounts({ pool })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
