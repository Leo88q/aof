import { serializeChainValue as deep } from "../lib/serializeChain";
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
  toolPda, hotMarketPoolPda, hotMarketQueuePda, materialMintsPda, farmTilePda,
  weatherStatePda, wellStatePda, millStatePda, ovenStatePda } from "../lib/pda";
import { validateCanonicalResourceRegistry } from "../lib/resourceRegistry";

const r = Router();
const RESOURCE_UNIT = 1_000_000_000;
const resourceDisplay = (value: any) => Number(value?.toString?.() ?? value ?? 0) / RESOURCE_UNIT;

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
    const registry = await validateCanonicalResourceRegistry(connection, cfg, mm);
    if (!registry.mints) {
      return res.status(503).json({
        error: "RESOURCE_REGISTRY_UNAVAILABLE_OR_INVALID_FROM_CANONICAL_CHAIN",
        details: registry.errors,
      });
    }

    const mints = registry.mints;
    const balances: Record<string, number> = {};
    for (const key of Object.keys(mints)) balances[key] = 0;
    let readError = false;

    for (const [key, mintPk] of Object.entries(mints)) {
      try {
        const ata = getAssociatedTokenAddressSync(mintPk, owner, true);
        const info = await connection.getParsedAccountInfo(ata);
        const amt = (info.value?.data as any)?.parsed?.info?.tokenAmount?.uiAmount;
        if (typeof amt === "number") balances[key] = amt;
      } catch {
        readError = true;
      }
    }
    if (readError) {
      return res.status(503).json({
        error: "RESOURCE_BALANCES_UNAVAILABLE_FROM_CANONICAL_CHAIN",
      });
    }
    res.json({ ...balances, source: "onchain" });
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

// [БЛОК L] On-chain weather and production state
r.get("/weather-state", async (_req, res) => {
  const [addr] = weatherStatePda();
  res.json(deep(await fetchOne("weatherState", addr)));
});

r.get("/well-state/:owner", async (req, res) => {
  const [addr] = wellStatePda(new PublicKey(req.params.owner));
  const state: any = await fetchOne("wellState", addr);
  if (!state) return res.json(null);
  res.json({ ...deep(state), waterBuffer: resourceDisplay(state.waterBuffer) });
});

r.get("/mill-state/:owner", async (req, res) => {
  const [addr] = millStatePda(new PublicKey(req.params.owner));
  const state: any = await fetchOne("millState", addr);
  if (!state) return res.json(null);
  res.json({ ...deep(state), outputFlour: resourceDisplay(state.outputFlour) });
});

r.get("/oven-state/:owner", async (req, res) => {
  const [addr] = ovenStatePda(new PublicKey(req.params.owner));
  const state: any = await fetchOne("ovenState", addr);
  if (!state) return res.json(null);
  res.json({ ...deep(state), outputBread: resourceDisplay(state.outputBread) });
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
      targetPriceCore: Number(data.targetPriceCore),
      targetPriceGem: Number(data.targetPriceGem),
      targetRatePerHour: Number(data.targetRatePerHour),
      growthBpsPerSale: Number(data.growthBpsPerSale),
      decayBpsPerHour: Number(data.decayBpsPerHour),
      feeBps: Number(data.feeBps),
      soldSinceStart: Number(data.soldSinceStart),
      purchasesInWindow: Number(data.purchasesInWindow),
      paused: Boolean(data.paused),
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
    const potatoAta = ataFor(cfg?.potatoMint);

    const readAmt = async (ata: any) => {
      if (!ata) return 0;
      try {
        const info = await connection.getParsedAccountInfo(ata);
        const amt = (info?.value?.data as any)?.parsed?.info?.tokenAmount?.uiAmount;
        return typeof amt === "number" ? amt : 0;
      } catch { return 0; }
    };

    const [FOOD, WOOD, STONE, POTATO] = await Promise.all([
      readAmt(foodAta),
      readAmt(woodAta),
      readAmt(stoneAta),
      readAmt(potatoAta),
    ]);

    const activeMining = myTools.filter((t: any) => t.isMining);

    res.json({
      address,
      player: player ? deep(player) : null,
      tools: myTools,
      balances: { FOOD, WOOD, STONE, POTATO },
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
    let readError = false;
    
    // The on-chain instructions accept tile indexes 0..9.
    // Read the full canonical ten-tile surface; returning six caused the
    // frontend to hide valid tiles and disagree with the program bounds.
    for (let i = 0; i < 10; i++) {
      try {
        const [farmTile] = farmTilePda(user, i);
        const account = await (program as any).account.farmTile.fetchNullable(farmTile);
        
        if (account) {
          const state = Number(account.state || 0);
          const plantedAt = Number(account.plantedAt || 0);
          const readyAt = Number(account.readyAt || 0);
          const now = Math.floor(Date.now() / 1000);
          const planted = state !== 0;
          const ready = planted && readyAt > 0 && now >= readyAt;
          const duration = readyAt > plantedAt ? readyAt - plantedAt : 0;
          const progress = !planted ? 0 : ready ? 100 : duration > 0
            ? Math.max(0, Math.min(99, Math.floor(((now - plantedAt) / duration) * 100)))
            : 0;
          tiles.push({
            index: i,
            state,
            planted,
            ready,
            // On-chain farm amounts are atomic SPL units; API exposes display units.
            seedsAmount: resourceDisplay(account.seedsAmount),
            progress,
            plantedAt,
            readyAt,
            cropType: "wheat",
          });
        } else {
          tiles.push({
            index: i,
            state: 0,
            planted: false,
            ready: false,
            seedsAmount: 0,
            progress: 0,
            plantedAt: 0,
            readyAt: 0,
            cropType: "wheat",
          });
        }
      } catch (e) {
        // A failed RPC/account read is not an empty farm. Returning synthetic
        // empty tiles would allow the UI to show stale/made-up state and could
        // invite a user to overwrite a tile they do not actually see.
        readError = true;
      }
    }

    if (readError) {
      return res.status(503).json({
        error: "FARM_STATE_UNAVAILABLE_FROM_CANONICAL_CHAIN",
      });
    }
    res.json({ tiles });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



// ===== Material Mints: канонический registry из блокчейна =====
r.get("/material-mints", async (_req, res) => {
  try {
    const [materialMints] = materialMintsPda();
    const [configAddress] = configPda();
    const [account, config] = await Promise.all([
      fetchOne("materialMints", materialMints),
      fetchOne("config", configAddress),
    ]);

    // Never return a partial HTTP 200. The frontend is allowed to use this
    // registry only after every address, alias, SPL owner and decimal count
    // has been checked against canonical chain state.
    const registry = await validateCanonicalResourceRegistry(
      connection,
      config as Record<string, unknown> | null,
      account as Record<string, unknown> | null,
    );
    if (!registry.mints) {
      return res.status(503).json({
        error: "RESOURCE_MINT_REGISTRY_UNAVAILABLE_OR_INVALID",
        details: registry.errors,
      });
    }

    const mints: Record<string, string> = {};
    for (const [key, value] of Object.entries(registry.mints)) {
      mints[key] = value.toBase58();
    }
    res.json({
      initialized: true,
      address: materialMints.toBase58(),
      mints,
    });
  } catch (e: any) {
    res.status(503).json({ error: "RESOURCE_MINT_REGISTRY_UNAVAILABLE_FROM_CANONICAL_CHAIN" });
  }
});

export default r;
