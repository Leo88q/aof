import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { onTick } from "../../lib/ws";
import { Card } from "../../components/ui/Card";
import { Candlestick } from "../../components/charts/Candlestick";
import { DepthChart } from "../../components/charts/DepthChart";
import { TradeTape } from "../../components/charts/TradeTape";
import { PriceHeader } from "../../components/charts/PriceHeader";

const rarities = [
  { id: 1, label: "Uncommon", color: "text-sprout-500" },
  { id: 2, label: "Rare", color: "text-water-500" },
  { id: 3, label: "Epic", color: "text-wheat-500" },
  { id: 4, label: "Legendary", color: "text-gold" },
];

export function HotMarket() {
  const [rarity, setRarity] = useState(1);
  const [timeframe, setTimeframe] = useState("1m");
  const [candles, setCandles] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [price, setPrice] = useState(0);
  const [prevPrice, setPrevPrice] = useState<number | undefined>();
  const [buyAmount, setBuyAmount] = useState(1);
  // [ФИКС] Глубина из реальных данных (пул VRGDA + очередь) вместо мока
  const [depth, setDepth] = useState<{ bids: any[]; asks: any[] }>({ bids: [], asks: [] });

  // Загрузка свечей и ленты
  useEffect(() => {
    loadMarketData();
  }, [rarity, timeframe]);

  // Живые тики через WS
  useEffect(() => {
    const unsubscribe = onTick(rarity, (tick) => {
      setPrevPrice(price);
      setPrice(tick.pricePotato);
    });
    return unsubscribe;
  }, [rarity, price]);

  async function loadMarketData() {
    try {
      const [candlesData, tradesData, priceData, poolData, queueData] = await Promise.all([
        api.marketData.candles(rarity, timeframe, 100),
        api.marketData.trades(rarity, 20),
        api.marketData.price(rarity),
        // [ФИКС] Реальные параметры глубины: VRGDA-пул + очередь лотов
        api.query.hotMarketPool(rarity).catch(() => null),
        api.query.hotMarketQueue(rarity).catch(() => null),
      ]);
      setCandles(candlesData.candles || []);
      setTrades(tradesData.trades || []);
      const p = priceData.price?.pricePotato || 0;
      setPrice(p);

      // [ФИКС] Аски — реальная очередь: каждый следующий лот дороже на
      // growth_per_purchase_bps (подлинная кривая VRGDA, не мок).
      const growth = (poolData?.growthPerPurchaseBps ?? 0) / 10000;
      const queueLen = queueData?.len ?? 0;
      const asks = Array.from({ length: Math.min(Math.max(queueLen, 1), 5) }, (_, i) => ({
        price: p * Math.pow(1 + growth, i),
        amount: 1, // один лот на позицию очереди
      }));
      // Биды — уровни поддержки от текущей цены к полу VRGDA (10% от базовой)
      const floor = (poolData?.basePricePotato ?? p) * 0.1;
      const bids = Array.from({ length: 4 }, (_, i) => ({
        price: p - ((p - floor) * (i + 1)) / 5,
        amount: 1,
      })).filter((lvl) => lvl.price > 0);
      setDepth({ bids, asks });
    } catch (e) {
      console.error("Не удалось загрузить данные рынка:", e);
    }
  }

  const { address } = useWalletStore();
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // [ФИКС] Нормализация редкости инструмента к индексу хот-маркета
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
  function rarityIndex(r: any): number {
    if (typeof r === "number") return r;
    if (typeof r === "string") return RARITY_ORDER.indexOf(r.toLowerCase());
    if (r && typeof r === "object") {
      const keys = Object.keys(r);
      if (keys.length > 0) return RARITY_ORDER.indexOf(keys[0].toLowerCase());
    }
    return -1;
  }

  async function handleBuy() {
    if (!address) {
      setTxStatus("❌ Сначала подключите кошелёк (кнопка вверху)");
      setTimeout(() => setTxStatus(null), 4000);
      return;
    }
    try {
      // [ФИКС] Покупаем голову очереди вместо хардкод-минта
      setTxStatus("Читаем очередь...");
      const q: any = await api.query.hotMarketQueue(rarity);
      if (!q?.first) {
        setTxStatus("❌ Очередь пуста — покупать нечего");
        setTimeout(() => setTxStatus(null), 4000);
        return;
      }
      setTxStatus("Готовим транзакцию...");
      const resp = await api.hotMarket.buy({
        buyer: address,
        rarity,
        toolMint: q.first,
        priceSnapshot: String(Math.floor(price * 1e9)),
        slippageBps: 100,
      });
      const result = await handleTxResponse(resp);
      if (result.success) {
        setTxStatus(`✅ Успешно: ${result.signature?.slice(0, 8)}...`);
      } else {
        setTxStatus(`❌ ${result.error}`);
      }
      setTimeout(() => setTxStatus(null), 4000);
    } catch (e: any) {
      setTxStatus(`❌ ${e.message}`);
      setTimeout(() => setTxStatus(null), 4000);
    }
  }

  // [ФИКС] Продажа: выбор инструмента нужной редкости из инвентаря + отправка в очередь
  async function handleSell() {
    if (!address) {
      setTxStatus("❌ Сначала подключите кошелёк (кнопка вверху)");
      setTimeout(() => setTxStatus(null), 4000);
      return;
    }
    try {
      setTxStatus("Ищем ваш инструмент...");
      const toolsResp: any = await api.query.myTools(address);
      const tools: any[] = Array.isArray(toolsResp) ? toolsResp : toolsResp?.tools || [];
      const tool = tools.find(
        (t: any) => rarityIndex(t.rarity) === rarity && !t.staked && !t.isMining
      );
      if (!tool) {
        setTxStatus(`❌ Нет инструмента редкости ${rarity} для продажи`);
        setTimeout(() => setTxStatus(null), 4000);
        return;
      }
      const mint: string =
        typeof tool.mint === "string" ? tool.mint : tool.mint?.toBase58?.() || "";
      if (!mint) {
        setTxStatus("❌ Не удалось определить минт инструмента");
        setTimeout(() => setTxStatus(null), 4000);
        return;
      }
      setTxStatus("Готовим транзакцию...");
      const resp = await api.hotMarket.sell({
        seller: address,
        rarity,
        toolMint: mint,
        // Пол цены: −5% от текущей (защита от проскальзывания вниз)
        minPrice: String(Math.floor(price * 0.95 * 1e9)),
      });
      const result = await handleTxResponse(resp);
      if (result.success) {
        setTxStatus(`✅ Продано в очередь: ${result.signature?.slice(0, 8)}...`);
      } else {
        setTxStatus(`❌ ${result.error}`);
      }
      setTimeout(() => setTxStatus(null), 4000);
    } catch (e: any) {
      setTxStatus(`❌ ${e.message}`);
      setTimeout(() => setTxStatus(null), 4000);
    }
  }

  // [ФИКС] Реролл (скип) текущего лота — платный, для игрока (Группа 2: контракт)
  async function handleReroll() {
    if (!address) {
      setTxStatus("❌ Сначала подключите кошелёк (кнопка вверху)");
      setTimeout(() => setTxStatus(null), 4000);
      return;
    }
    try {
      setTxStatus("Рероллим лот...");
      const resp = await api.hotMarket.skip({ player: address, rarity });
      const result = await handleTxResponse(resp);
      if (result.success) {
        setTxStatus(`✅ Новый лот: ${result.signature?.slice(0, 8)}...`);
      } else {
        setTxStatus(`❌ ${result.error}`);
      }
      setTimeout(() => setTxStatus(null), 4000);
    } catch (e: any) {
      setTxStatus(`❌ ${e.message}`);
      setTimeout(() => setTxStatus(null), 4000);
    }
  }

  return (
    <div className="p-4 pt-6 pb-32">
      {/* Заголовок + табы редкостей */}
      <h1 className="text-2xl font-bold mb-4">🔥 Хот-маркет</h1>

      {/* Табы редкостей */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {rarities.map((r) => (
          <button
            key={r.id}
            onClick={() => setRarity(r.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              rarity === r.id
                ? "bg-wheat-600 text-soil-950"
                : "bg-soil-850 text-straw"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Текущая цена */}
      <Card className="mb-4">
        <PriceHeader price={price} prevPrice={prevPrice} label="POTATO" />
      </Card>

      {/* Таймфреймы */}
      <div className="flex gap-2 mb-3">
        {["1m", "5m", "1h", "1d"].map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 rounded-lg text-xs ${
              timeframe === tf ? "bg-wheat-600 text-soil-950" : "bg-soil-850 text-straw"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Свечи */}
      <Card className="mb-4">
        {candles.length > 0 ? (
          <Candlestick candles={candles} />
        ) : (
          <div className="h-40 flex items-center justify-center text-straw text-sm">
            Загрузка свечей...
          </div>
        )}
      </Card>

      {/* Стакан + лента */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <Card>
          <h3 className="text-sm font-semibold text-parchment mb-3">Стакан</h3>
          <DepthChart bids={depth.bids} asks={depth.asks} />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-parchment mb-3">Лента сделок</h3>
          <TradeTape trades={trades} />
        </Card>
      </div>

      {/* Зона покупки/продажи — внизу, зона большого пальца */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto px-4 action-zone">
        <Card className="bg-soil-900/95 backdrop-blur-xl border-t border-soil-700">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-straw text-sm">Кол-во:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBuyAmount(Math.max(1, buyAmount - 1))}
                className="w-8 h-8 rounded-full bg-soil-800 text-parchment"
              >
                −
              </button>
              <span className="w-8 text-center text-parchment font-semibold">{buyAmount}</span>
              <button
                onClick={() => setBuyAmount(buyAmount + 1)}
                className="w-8 h-8 rounded-full bg-soil-800 text-parchment"
              >
                +
              </button>
            </div>
            <div className="flex-1 text-right">
              <span className="text-straw text-xs">Итого: </span>
              <span className="text-wheat-500 font-semibold">{(price * buyAmount).toFixed(2)}</span>
            </div>
          </div>

          {txStatus && (
            <p className="text-xs text-center mb-2 text-parchment">{txStatus}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleReroll}
              title="Реролл: пропустить текущий лот (платно)"
              className="px-3 py-3 rounded-2xl bg-soil-800 text-wheat-500 text-lg active:scale-95 transition-transform"
            >
              🎲
            </button>
            <button
              onClick={handleBuy}
              className="flex-1 py-3 rounded-2xl bg-sprout-600 text-white font-semibold active:scale-95 transition-transform"
            >
              🪴 Купить
            </button>
            <button
              onClick={handleSell}
              className="flex-1 py-3 rounded-2xl bg-wheat-700 text-white font-semibold active:scale-95 transition-transform"
            >
              🪣 Продать
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
