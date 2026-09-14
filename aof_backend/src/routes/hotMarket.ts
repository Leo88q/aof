import { Router } from "express";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { AUTHORITY } from "../config";
import { marketProgram } from "../provider";
import { marketConfigPda, marketProgramDataPda, hotMarketPoolPda } from "../lib/pda";
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

// Инициализация конфигурации рынка. Все параметры и адреса соответствуют
// текущей on-chain программе aof-market; старый potatoConfig API удалён.
r.post("/config/init", requireAdmin, async (req, res) => {
  try {
    const coreMint = pk(req.body.coreMint || req.body.potatoMint);
    const gemMint = pk(req.body.gemMint);
    const treasury = pk(req.body.treasury);
    const feeBps = Number(req.body.feeBps);
    const [config] = marketConfigPda();
    const [programData] = marketProgramDataPda();

    const ix = await (marketProgram.methods as any)
      .initMarketConfig(feeBps)
      .accounts({
        config,
        authority: AUTHORITY.publicKey,
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
    const targetPriceCore = new BN(req.body.targetPriceCore ?? req.body.basePriceCore ?? req.body.basePricePotato);
    const targetPriceGem = new BN(req.body.targetPriceGem ?? req.body.basePriceGem ?? 0);
    const targetRatePerHour = new BN(req.body.targetRatePerHour ?? req.body.targetSalesPerHour ?? 0);
    const decayBpsPerHour = Number(req.body.decayBpsPerHour ?? req.body.decayPerHourBps);
    const growthBpsPerSale = Number(req.body.growthBpsPerSale ?? req.body.growthPerPurchaseBps);
    const feeBps = Number(req.body.feeBps);
    const [config] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);

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
        authority: AUTHORITY.publicKey,
        pool,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    const sig = await authorityOnly([ix]);
    res.json({ sig });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Trading stays fail-closed until the on-chain instruction verifies the
// canonical ToolData and synchronizes its owner with the transferred NFT.
r.post("/buy", (_req, res) => {
  res.status(503).json({ error: "HOT_MARKET_DISABLED_UNTIL_CANONICAL_TOOL_TRANSFER" });
});

/*
// Покупка инструмента из фактически пополненного pool_tool ATA.
r.post("/buy", requireCircuitOpen, requireWalletLimits("hotmarket_buy"), requireIdempotency, async (req, res) => {
  try {
    const buyer = pk(req.body.buyer);
    const rarity = Number(req.body.rarity);
    const currency = (req.body.currency === "gem" ? "gem" : "core") as CurrencyName;
    const newToolMint = pk(req.body.newToolMint || req.body.toolMint);
    const maxPrice = new BN(req.body.maxPrice ?? req.body.priceSnapshot);
    const [configAddress] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);
    const config: any = await (marketProgram.account as any).marketConfig.fetch(configAddress);
    const mint = currencyMint(config, currency);
    const treasury = config.treasury;
    const buyerCurrency = getAssociatedTokenAddressSync(mint, buyer);
    const treasuryCurrency = getAssociatedTokenAddressSync(mint, treasury);
    const poolTool = getAssociatedTokenAddressSync(newToolMint, pool, true);
    const buyerTool = getAssociatedTokenAddressSync(newToolMint, buyer);

    const ix = await (marketProgram.methods as any)
      .hotMarketBuy(rarity, currencyArg(currency), maxPrice)
      .accounts({
        config: configAddress,
        buyer,
        pool,
        treasury,
        currencyMint: mint,
        buyerCurrency,
        treasuryCurrency,
        newToolMint,
        poolTool,
        buyerTool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], buyer);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
*/

// Selling is also disabled: the current program accepts a mint without
// proving that it is the canonical ToolData for the selected rarity.
r.post("/sell", (_req, res) => {
  res.status(503).json({ error: "HOT_MARKET_DISABLED_UNTIL_CANONICAL_TOOL_TRANSFER" });
});

/*
// Продажа инструмента пулу. The instruction now transfers the NFT into the
// pool before paying the seller; it cannot be used as a free-token faucet.
r.post("/sell", requireCircuitOpen, requireWalletLimits("hotmarket_sell"), requireIdempotency, async (req, res) => {
  try {
    const seller = pk(req.body.seller);
    const rarity = Number(req.body.rarity);
    const currency = (req.body.currency === "gem" ? "gem" : "core") as CurrencyName;
    const soldToolMint = pk(req.body.soldToolMint || req.body.toolMint);
    const minPrice = new BN(req.body.minPrice || "0");
    const [config] = marketConfigPda();
    const [pool] = hotMarketPoolPda(rarity);
    const configData: any = await (marketProgram.account as any).marketConfig.fetch(config);
    const mint = currencyMint(configData, currency);
    const sellerCurrency = getAssociatedTokenAddressSync(mint, seller);
    const poolCurrency = getAssociatedTokenAddressSync(mint, pool, true);
    const sellerTool = getAssociatedTokenAddressSync(soldToolMint, seller);
    const poolTool = getAssociatedTokenAddressSync(soldToolMint, pool, true);

    const ix = await (marketProgram.methods as any)
      .hotMarketSellIntoQueue(rarity, currencyArg(currency), minPrice)
      .accounts({
        config,
        seller,
        pool,
        currencyMint: mint,
        sellerCurrency,
        poolCurrency,
        soldToolMint,
        sellerTool,
        poolTool,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const tx = await coSign([ix], seller);
    res.json({ tx });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});
*/

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
      .accounts({ config, authority: AUTHORITY.publicKey, pool })
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
