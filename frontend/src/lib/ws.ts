import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function connectWS(): Socket {
  if (socket?.connected) return socket;

  const configuredUrl = (import.meta as any).env?.VITE_MARKET_WS_URL as string | undefined;
  const configuredPath = (import.meta as any).env?.VITE_MARKET_WS_PATH || "/ws";
  // With no explicit URL Socket.IO uses the current origin, which is also the
  // only browser-reachable option behind the production reverse proxy.
  socket = io(configuredUrl || undefined, {
    path: configuredPath,
    transports: ["websocket"],
  });
  socket.on("connect", () => console.log("[ws] подключён к индексатору"));
  return socket;
}

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
