import { program } from "../provider";
import { Router } from "express";
import { marketProgram, connection } from "../provider";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import bs58 from "bs58";
import { fetchAll, fetchOne, memcmpFilter } from "../lib/decode";
import { pk } from "../lib/tx";
import { auctionPda, configPda, craftEconomyPda, enchantSlotPda, gastankPda,
  listingPda, lotteryRoundPda, offerPda, packConfigPda, playerPda,
  rarityCounterPda, rentalAgreementPda, rentalListingPda, seasonPassPda,
  toolPda, hotMarketPoolPda, hotMarketQueuePda, materialMintsPda, farmTilePda } from "../lib/pda";

const r = Router();

// Нормализация: PublicKey → base58, BN → number, рекурсивно
const num = (v: any) => (v && v.toString ? v.toString() : v);
const deep = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object" && typeof obj.toBase58 === "function") return obj.toBase58();
  if (typeof obj === "bigint" || (obj && obj._bn)) return num(obj);
  if (Array.isArray(obj)) return obj.map(deep);
  if (typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) out[k] = deep(obj[k]);
    return out;
  }
  return obj;
};

// Глобальный конфиг программы
r.get("/config", async (_req, res) => {
  const [addr] = configPda();
  res.json(deep(await fetchOne("config", addr)));
});

// Экономика крафта (bonding curve)


// [NEW] Балансы ресурсов FOOD/WOOD/STONE — читаем через SPL ATA владельца
r.get("/balances/:owner", async (req, res) => {
  try {
    const owner = new PublicKey(req.params.owner);
    const [cfgAddr] = configPda();
    const [mmAddr] = materialMintsPda();
    const cfg: any = await fetchOne("config", cfgAddr);
    const mm: any = await fetchOne("materialMints", mmAddr);

    // Все минты: базовые из Config + новые из MaterialMints
    const mints: Record<string, any> = {
      FOOD: cfg?.foodMint,
      WOOD: cfg?.woodMint,
      STONE: cfg?.stoneMint,
      // [БЛОК L] Хлебная цепочка
      SEEDS: mm?.seeds,
      WHEAT: mm?.wheat,
      FLOUR: mm?.flour,
      BREAD: mm?.bread,
      WATER: mm?.water,
      COAL: mm?.coal,
      MEAT: mm?.meat,
      // Камни
      STONE_BLUE: mm?.stoneBlue,
      STONE_PURPLE: mm?.stonePurple,
      STONE_RED: mm?.stoneRed,
      // Песок
      SAND_WHITE: mm?.sandWhite,
      SAND_PINK: mm?.sandPink,
      SAND_YELLOW: mm?.sandYellow,
      // Гемы
      GEM_BLUE: mm?.gemBlue,
      GEM_ORANGE: mm?.gemOrange,
      GEM_WHITE: mm?.gemWhite,
      GEM_GREEN: mm?.gemGreen,
      // Баночки
      FLASK_BLUE: mm?.flaskBlue,
      FLASK_YELLOW: mm?.flaskYellow,
      FLASK_GREEN: mm?.flaskGreen,
      FLASK_PINK: mm?.flaskPink,
      FLASK_PURPLE: mm?.flaskPurple,
      // Особое
      LOVE_HEART: mm?.loveHeart,
    };
    const balances: Record<string, number> = {};
    for (const key of Object.keys(mints)) balances[key] = 0;

    for (const [key, mint] of Object.entries(mints)) {
      if (!mint) continue;
      try {
        const mintPk = typeof mint === "string" ? new PublicKey(mint) : mint;
        const ata = getAssociatedTokenAddressSync(mintPk, owner, true);
        const info = await connection.getParsedAccountInfo(ata);
        const amt = (info.value?.data as any)?.parsed?.info?.tokenAmount?.uiAmount;
        if (typeof amt === "number") balances[key] = amt;
      } catch {}
    }
    res.json(balances);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

r.get("/craft-economy", async (_req, res) => {
  const [addr] = craftEconomyPda();
  res.json(deep(await fetchOne("craftEconomy", addr)));
});

// Счётчик заминченных инструментов по редкости
r.get("/rarity-counter/:idx", async (req, res) => {
  const [addr] = rarityCounterPda(Number(req.params.idx));
  res.json(deep(await fetchOne("rarityCounter", addr)));
});

// Конфиг пака по типу
r.get("/pack-config/:type", async (req, res) => {
  const [addr] = packConfigPda(Number(req.params.type));
  res.json(deep(await fetchOne("packConfig", addr)));
});

// Профиль игрока (жители, энергия, перки)
r.get("/player/:owner", async (req, res) => {
  const [addr] = playerPda(new PublicKey(req.params.owner));
  res.json(deep(await fetchOne("player", addr)));
});

// Газ-бак игрока
r.get("/gastank/:owner", async (req, res) => {
  const [addr] = gastankPda(new PublicKey(req.params.owner));
  res.json(deep(await fetchOne("gasTank", addr)));
});

// Данные инструмента по минту
r.get("/tool/:mint", async (req, res) => {
  const [addr] = toolPda(new PublicKey(req.params.mint));
  res.json(deep(await fetchOne("toolData", addr)));
});

// Все инструменты игрока (поиск по владельцу через memcmp)
r.get("/my-tools/:owner", async (req, res) => {
  const list = await fetchAll("toolData", [
    memcmpFilter(40, req.params.owner), // offset 8+32 (mint) = 40
  ]);
  res.json(list.map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) })));
});

// Слоты кузницы для инструмента
r.get("/enchant-slots/:toolMint", async (req, res) => {
  const list = await fetchAll("enchantSlot", [
    memcmpFilter(8, req.params.toolMint), // offset 8 (после дискриминатора)
  ]);
  res.json(list.map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) })));
});

// Ордербук по ресурсу (разделение на buy/sell)
r.get("/orderbook/:mint", async (req, res) => {
  const all = await fetchAll("resourceOrder", [memcmpFilter(58, req.params.mint)]);
  const decoded = all.map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) }));
  res.json({
    buy: decoded.filter((o: any) => o.isBuy && Number(o.amountRemaining) > 0),
    sell: decoded.filter((o: any) => !o.isBuy && Number(o.amountRemaining) > 0),
  });
});

// Все активные аукционы (опционально по минту)
r.get("/auctions", async (req, res) => {
  const filters = [memcmpFilter(128, bs58.encode(Buffer.from([1])))]; // active=true
  const all = await fetchAll("auction", filters);
  let decoded = all.map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) }));
  if (req.query.mint) decoded = decoded.filter((a: any) => a.mint === req.query.mint);
  res.json(decoded);
});

// Конкретный аукцион по минту
r.get("/auction/:mint", async (req, res) => {
  const [addr] = auctionPda(new PublicKey(req.params.mint));
  res.json(deep(await fetchOne("auction", addr)));
});

// Активные листинги маркетплейса
r.get("/listings", async (_req, res) => {
  const all = await fetchAll("listing", [memcmpFilter(80, bs58.encode(Buffer.from([1])))]);
  res.json(all.map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) })));
});

// Офферы по минту
r.get("/offers/:mint", async (req, res) => {
  const all = await fetchAll("offer", [memcmpFilter(40, req.params.mint)]);
  res.json(
    all
      .map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) }))
      .filter((o: any) => o.active)
  );
});

// Активные аренды
r.get("/rentals", async (_req, res) => {
  const all = await fetchAll("rentalListing", [memcmpFilter(90, bs58.encode(Buffer.from([1])))]);
  res.json(all.map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) })));
});

// Аренда по минту (листинг + соглашение)
r.get("/rental/:mint", async (req, res) => {
  const [listing] = rentalListingPda(new PublicKey(req.params.mint));
  const [agreement] = rentalAgreementPda(new PublicKey(req.params.mint));
  res.json({
    listing: deep(await fetchOne("rentalListing", listing)),
    agreement: deep(await fetchOne("rentalAgreement", agreement)),
  });
});

// Раунд лотереи
r.get("/lottery/:roundId", async (req, res) => {
  const [addr] = lotteryRoundPda(BigInt(req.params.roundId));
  res.json(deep(await fetchOne("lotteryRound", addr)));
});

// Билеты игрока в раунде
r.get("/lottery/:roundId/my-tickets/:buyer", async (req, res) => {
  const all = await fetchAll("lotteryTicket", [memcmpFilter(24, req.params.buyer)]);
  const roundId = req.params.roundId;
  res.json(
    all
      .map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) }))
      .filter((t: any) => t.roundId === roundId)
  );
});

// Активные крафт-заказы
r.get("/craft-orders", async (_req, res) => {
  const all = await fetchAll("craftOrder");
  res.json(
    all
      .map((x: any) => ({ pubkey: x.publicKey.toBase58(), ...deep(x.account) }))
      .filter((o: any) => o.active)
  );
});

// Сезонный пасс игрока
r.get("/season-pass/:owner/:seasonId", async (req, res) => {
  const [addr] = seasonPassPda(new PublicKey(req.params.owner), Number(req.params.seasonId));
  res.json(deep(await fetchOne("seasonPass", addr)));
});


// [ФИКС Группы 1] Голова очереди хот-маркета — фронт покупал по хардкод-минту
r.get("/hot-market-queue/:rarity", async (req, res) => {
  try {
    const rarity = Number(req.params.rarity);
    const [queue] = hotMarketQueuePda(rarity);
    let data: any;
    try {
      data = await (marketProgram.account as any)["hotMarketQueue"].fetch(queue);
    } catch {
      return res.json({ rarity, len: 0, first: null, items: [] });
    }
    const items: string[] = (data.items || []).map((k: any) => k.toBase58());
    const head = Number(data.head || 0);
    const len = Number(data.len || 0);
    const first = len > 0 && items.length > 0 ? items[head % items.length] : null;
    res.json({ rarity, len, first, items: items.slice(0, 20) });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [ФИКС Средний] Пул хот-маркета: параметры VRGDA для реальной глубины стакана
r.get("/hot-market-pool/:rarity", async (req, res) => {
  try {
    const rarity = Number(req.params.rarity);
    const [pool] = hotMarketPoolPda(rarity);
    let data: any;
    try {
      data = await (marketProgram.account as any)["hotMarketPool"].fetch(pool);
    } catch {
      return res.status(404).json({ error: "Pool not initialized" });
    }
    res.json({
      rarity,
      currentPricePotato: Number(data.currentPricePotato),
      currentPriceSolLamports: Number(data.currentPriceSolLamports),
      basePricePotato: Number(data.basePricePotato),
      growthPerPurchaseBps: Number(data.growthPerPurchaseBps),
      decayPerHourBps: Number(data.decayPerHourBps),
      feeBps: Number(data.feeBps),
      soldCount: Number(data.soldCount),
      purchasesInWindow: Number(data.purchasesInWindow),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});


// [NEW] Ферма друга — агрегатор всех данных игрока (read-only)
r.get("/friend-farm/:address", async (req, res) => {
  try {
    const address = req.params.address;
    const owner = pk(address);

    // Параллельно: player + gastank + конфиг + инструменты
    const [player, gastank, cfg, toolsRaw] = await Promise.all([
      fetchOne("player", playerPda(owner)[0]).catch(() => null),
      fetchOne("gastank", gastankPda(owner)[0]).catch(() => null),
      fetchOne("config", configPda()[0]).catch(() => null),
      fetchAll("toolData", [memcmpFilter(40, address)]).catch(() => []),
    ]);

    const myTools = toolsRaw.map((x: any) => ({
      pubkey: x.publicKey?.toBase58?.(),
      mint: x.account?.mint?.toBase58?.(),
      toolType: x.account?.toolType,
      rarity: x.account?.rarity,
      durability: Number(x.account?.durability ?? 0),
      isMining: !!x.account?.isMining,
      miningEnd: Number(x.account?.miningEnd ?? 0),
    }));

    // Балансы ресурсов через ATA
    const ataFor = (mintStr: string) => mintStr ? getAssociatedTokenAddressSync(pk(mintStr), owner, true) : null;
    const foodAta = ataFor(cfg?.foodMint);
    const woodAta = ataFor(cfg?.woodMint);
    const stoneAta = ataFor(cfg?.stoneMint);

    const readAmt = async (ata: any) => {
      if (!ata) return 0;
      try {
        const info = await connection.getParsedAccountInfo(ata);
        const amt = (info?.value?.data as any)?.parsed?.info?.tokenAmount?.uiAmount;
        return typeof amt === "number" ? amt : 0;
      } catch { return 0; }
    };

    const [FOOD, WOOD, STONE] = await Promise.all([readAmt(foodAta), readAmt(woodAta), readAmt(stoneAta)]);

    const activeMining = myTools.filter((t: any) => t.isMining);

    res.json({
      address,
      player: player ? deep(player) : null,
      tools: myTools,
      balances: { FOOD, WOOD, STONE },
      gastank: gastank ? deep(gastank) : null,
      activeMining,
      stats: {
        totalTools: myTools.length,
        avgDurability: myTools.length > 0
          ? Math.round(myTools.reduce((s: number, t: any) => s + t.durability, 0) / myTools.length)
          : 0,
        miningCount: activeMining.length,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



// [НОВОЕ] GET /pack-configs — получение конфигураций всех паков
r.get("/pack-configs", async (req, res) => {
  try {
    const configs = [];
    for (const packType of [0, 1, 2]) {
      const [packConfig] = packConfigPda(packType);
      try {
        const data: any = await fetchOne("packConfig", packConfig);
        if (data) {
          configs.push({
            packType,
            packTypeName: ["Small", "Medium", "Big"][packType],
            priceLamports: data.priceLamports?.toString(),
            priceSol: Number(data.priceLamports) / 1e9,
            oddsBps: data.oddsBps,
            oddsPct: data.oddsBps?.map((b: number) => (b / 100).toFixed(2) + "%"),
            address: packConfig.toBase58(),
          });
        }
      } catch (e) {
        // PackConfig не инициализирован для этого типа
      }
    }
    res.json({ configs, total: configs.length });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



// ===== Ферма: состояние тайлов =====
r.get("/farm-tiles/:user", async (req, res) => {
  try {
    const user = new PublicKey(req.params.user);
    const tiles = [];
    
    // Читаем 6 тайлов (0-5) из блокчейна
    for (let i = 0; i < 6; i++) {
      try {
        const [farmTile] = farmTilePda(user, i);
        const account = await (program as any).account.farmTile.fetchNullable(farmTile);
        
        if (account) {
          tiles.push({
            index: i,
            planted: account.planted || false,
            ready: account.ready || false,
            seedsAmount: Number(account.seedsAmount || 0),
            progress: Number(account.progress || 0),
            plantedAt: account.plantedAt ? Number(account.plantedAt) : 0,
            cropType: account.cropType || null,
          });
        } else {
          tiles.push({
            index: i,
            planted: false,
            ready: false,
            seedsAmount: 0,
            progress: 0,
            plantedAt: 0,
            cropType: null,
          });
        }
      } catch (e) {
        tiles.push({
          index: i,
          planted: false,
          ready: false,
          seedsAmount: 0,
          progress: 0,
          plantedAt: 0,
          cropType: null,
        });
      }
    }
    
    res.json({ tiles });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



// ===== Material Mints: все mint-адреса ресурсов из блокчейна =====
r.get("/material-mints", async (req, res) => {
  try {
    const [materialMints] = materialMintsPda();
    const account = await (program as any).account.materialMints.fetchNullable(materialMints);
    
    if (!account) {
      return res.json({ 
        initialized: false,
        mints: {}
      });
    }
    
    // Извлекаем mint-адреса из аккаунта
    const mints: Record<string, string> = {};
    const fields = [
      "seeds", "wheat", "flour", "bread", "wood", "stone", "coal", "meat", "water", "food",
      "sandWhite", "sandPink", "sandYellow",
      "stoneBlue", "stonePurple", "stoneRed",
      "gemBlue", "gemOrange", "gemWhite", "gemGreen",
      "flaskBlue", "flaskYellow", "flaskGreen", "flaskPink", "flaskPurple",
    ];
    
    for (const field of fields) {
      const val = (account as any)[field];
      if (val && typeof val.toBase58 === "function") {
        // Конвертируем из camelCase в UPPER_CASE
        const key = field.replace(/([A-Z])/g, "_$1").toUpperCase();
        mints[key] = val.toBase58();
      }
    }
    
    res.json({ 
      initialized: true,
      address: materialMints.toBase58(),
      mints
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
