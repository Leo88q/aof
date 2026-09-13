import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectWS(): Socket {
  if (socket?.connected) return socket;
  // WS индексатора на порту 8081
  socket = io("http://localhost:8081", { path: "/ws", transports: ["websocket"] });
  socket.on("connect", () => console.log("[ws] подключён к индексатору"));
  return socket;
}

/**
 * Подписка на канал. Возвращает функцию очистки с типом () => void,
 * совместимую с useEffect (EffectCallback).
 */
export function subscribeToChannel(channel: string, handler: (data: any) => void): () => void {
  const s = connectWS();
  s.emit("subscribe", channel);
  s.on(channel, handler);
  return () => {
    s.off(channel, handler);
  };
}

export function onTick(rarity: number, handler: (tick: any) => void): () => void {
  return subscribeToChannel(`hotmarket:${rarity}`, handler);
}

export function onCandle(rarity: number, timeframe: string, handler: (candle: any) => void): () => void {
  return subscribeToChannel(`hotmarket:${rarity}:${timeframe}`, handler);
}
