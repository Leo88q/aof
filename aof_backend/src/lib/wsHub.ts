import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { logger } from "./logger";

let io: Server | null = null;

// Инициализация на том же HTTP-сервере что и Express
export function initWS(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/ws",
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "WS client connected");

    // Клиент подписывается на канал редкости: "hotmarket:2"
    socket.on("subscribe", (channel: string) => {
      socket.join(channel);
      socket.emit("subscribed", { channel });
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "WS client disconnected");
    });
  });

  logger.info("WS hub initialized");
  return io;
}

// Публикация тика всем подписчикам канала
export function publishTick(rarity: number, tick: any) {
  if (!io) return;
  const channel = `hotmarket:${rarity}`;
  io.to(channel).emit("tick", { rarity, ...tick, ts: Date.now() });
}

// Публикация свечи (для закрытия интервала)
export function publishCandle(rarity: number, timeframe: string, candle: any) {
  if (!io) return;
  const channel = `hotmarket:${rarity}:${timeframe}`;
  io.to(channel).emit("candle", { rarity, timeframe, ...candle });
}

// Публикация системных событий (алерты, whale, погода)
export function publishEvent(eventType: string, payload: any) {
  if (!io) return;
  io.emit(eventType, payload);
}
