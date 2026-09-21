/**
 * Индексатор цен хот-маркета v2:
 * - поллинг пулов aof-market каждые 2 сек
 * - пишет тики в БД
 * - агрегирует свечи
 * - ПУБЛИКУЕТ через WebSocket для живых графиков (вместо поллинга фронтом)
 *
 * Запуск: npx ts-node services/indexer/priceTracker.ts
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PrismaClient } from "@prisma/client";
import { Server as WebSocketServer } from "ws";
import { createServer } from "http";
import marketIdl from "../../src/idl/aof_market.json";

const db = new PrismaClient();
// Same RPC as the API process; a hard-coded localhost URL made the worker
// silently index nothing outside a developer machine.
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
if (process.env.NODE_ENV === "production" && (!process.env.RPC_URL || /devnet|localhost|127\.0\.0\.1/i.test(RPC_URL))) {
  throw new Error("[indexer] Production requires an explicit non-devnet RPC_URL");
}
const connection = new Connection(RPC_URL, "confirmed");

const provider = new AnchorProvider(connection, new Wallet(new Keypair()), {
  commitment: "confirmed",
});
const marketProgram = new Program(marketIdl as any, provider);

const RARITIES = [1, 2, 3, 4];
const POLL_INTERVAL_MS = 2000;
const WS_PORT = Number(process.env.WS_PORT || 8081);

const TIMEFRAMES: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "1h": 3_600_000,
  "1d": 86_400_000,
};

// WS-сервер индексатора
const httpServer = createServer();
const wsServer = new WebSocketServer({ server: httpServer, path: "/ws" });

wsServer.on("connection", (socket) => {
  console.log("[indexer] WS клиент подключён");
  (socket as any).channels = new Set<string>();

  socket.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "subscribe" && msg.channel) {
        (socket as any).channels.add(msg.channel);
        socket.send(JSON.stringify({ type: "subscribed", channel: msg.channel }));
      }
    } catch {}
  });
});

httpServer.listen(WS_PORT, () => {
  console.log(`[indexer] WS сервер на порту ${WS_PORT}`);
});

function broadcastTick(rarity: number, tick: any) {
  const channel = `hotmarket:${rarity}`;
  const message = JSON.stringify({ type: "tick", channel, rarity, ...tick });
  wsServer.clients.forEach((client) => {
    if ((client as any).channels?.has(channel) && client.readyState === 1) {
      client.send(message);
    }
  });
}

function broadcastCandle(rarity: number, timeframe: string, candle: any) {
  const channel = `hotmarket:${rarity}:${timeframe}`;
  const message = JSON.stringify({ type: "candle", channel, rarity, timeframe, ...candle });
  wsServer.clients.forEach((client) => {
    if ((client as any).channels?.has(channel) && client.readyState === 1) {
      client.send(message);
    }
  });
}

async function fetchPrices() {
  const ticks: any[] = [];
  for (const rarity of RARITIES) {
    try {
      const [poolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("hot_market_pool"), Buffer.from([rarity])],
        marketProgram.programId
      );
      const pool: any = await (marketProgram.account as any)["hotMarketPool"]
        .fetch(poolPda)
        .catch(() => null);
      if (!pool) continue;

      const priceMascot = Number(pool.currentPriceMascot.toString()) / 1e9;
      const priceSol = Number(pool.currentPriceSolLamports.toString()) / 1e9;

      ticks.push({ rarity, priceMascot, priceSol, side: "crank", ts: new Date() });
    } catch {}
  }
  return ticks;
}

async function writeTick(tick: any) {
  await db.priceTick.create({ data: tick });
}

async function aggregateCandles(rarity: number) {
  const now = Date.now();
  for (const [tf, ms] of Object.entries(TIMEFRAMES)) {
    const tsStart = new Date(Math.floor(now / ms) * ms);
    const tsEnd = new Date(tsStart.getTime() + ms);

    const ticks = await db.priceTick.findMany({
      where: { rarity, ts: { gte: tsStart, lt: tsEnd } },
      orderBy: { ts: "asc" },
    });
    if (ticks.length === 0) continue;

    const prices = ticks.map((t) => t.priceMascot);
    const candle = {
      rarity,
      timeframe: tf,
      tsStart,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: ticks.length,
    };

    await db.candle.upsert({
      where: { rarity_timeframe_tsStart: { rarity, timeframe: tf, tsStart } },
      update: candle,
      create: candle,
    });

    // Публикуем обновление последней свечи через WS
    broadcastCandle(rarity, tf, candle);
  }
}

async function main() {
  console.log("[indexer] Запуск индексатора цен (поллинг + WS)");

  setInterval(async () => {
    try {
      const ticks = await fetchPrices();
      for (const tick of ticks) {
        await writeTick(tick);
        broadcastTick(tick.rarity, tick);
        await aggregateCandles(tick.rarity);
      }
      if (ticks.length > 0) {
        console.log(`[indexer] ${ticks.length} тиков записано + опубликовано в WS`);
      }
    } catch (e: any) {
      console.error("[indexer] Ошибка:", e.message);
    }
  }, POLL_INTERVAL_MS);
}

main().catch(console.error);
