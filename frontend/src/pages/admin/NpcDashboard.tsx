import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";

interface NpcStats {
  name: string;
  totalTradesToday: number;
  buyTrades: number;
  sellTrades: number;
  resources: string[];
  strategy: {
    buyPremium: string;
    sellDiscount: string;
  };
}

interface TradeAction {
  type: "buy" | "sell";
  resource: string;
  amount: number;
  price: number;
  reason: string;
}

export function NpcDashboard() {
  const [stats, setStats] = useState<NpcStats | null>(null);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [statsData, logsData] = await Promise.all([
        api.npc.stats(),
        api.admin.auditLogs(50),
      ]);
      
      setStats(statsData);
      
      // Фильтруем только NPC логи
      const npcLogs = (logsData || [])
        .filter((log: any) => log.action?.startsWith("npc_"))
        .slice(0, 20)
        .map((log: any) => ({
          ...log,
          metadata: JSON.parse(log.metadata || "{}"),
        }));
      
      setRecentTrades(npcLogs);
    } catch (e) {
      console.error("Failed to load NPC data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function runManual() {
    try {
      await api.npc.run();
      setTimeout(loadData, 1000);
    } catch (e) {
      console.error("Manual run failed:", e);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Loading NPC...</p></Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🤖</span>
            <div>
              <h2 className="text-parchment font-bold text-lg">{stats?.name || "NPC Торговец"}</h2>
              <p className="text-straw text-sm">Автономный торговый агент</p>
            </div>
          </div>
          <button
            onClick={runManual}
            className="px-4 py-2 bg-wheat-600 text-white text-sm rounded-lg hover:bg-wheat-700 transition active:scale-95"
          >
            ▶️ Запустить
          </button>
        </div>
      </Card>

      {stats && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">📊 Статистика сегодня</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-soil-800/60 text-center">
              <p className="text-wheat-500 text-2xl font-bold">{stats.totalTradesToday}</p>
              <p className="text-straw text-xs">Всего сделок</p>
            </div>
            <div className="p-3 rounded-lg bg-soil-800/60 text-center">
              <p className="text-sprout-500 text-2xl font-bold">{stats.buyTrades}</p>
              <p className="text-straw text-xs">Покупки</p>
            </div>
            <div className="p-3 rounded-lg bg-soil-800/60 text-center">
              <p className="text-red-400 text-2xl font-bold">{stats.sellTrades}</p>
              <p className="text-straw text-xs">Продажи</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-soil-800/40">
            <h4 className="text-parchment text-xs font-semibold mb-2">🎯 Стратегия</h4>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-straw">Премия покупки:</span>{" "}
                <span className="text-sprout-500 font-bold">{stats.strategy.buyPremium}</span>
              </div>
              <div>
                <span className="text-straw">Скидка продажи:</span>{" "}
                <span className="text-wheat-500 font-bold">{stats.strategy.sellDiscount}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-3">
            <p className="text-straw text-xs mb-1">Торгуемые ресурсы:</p>
            <div className="flex flex-wrap gap-1">
              {stats.resources.map((res) => (
                <span key={res} className="px-2 py-1 bg-soil-700 text-parchment text-xs rounded">
                  {res}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-parchment font-semibold text-sm mb-3">📜 Последние сделки</h3>
        {recentTrades.length === 0 ? (
          <p className="text-straw text-center py-8">Пока нет сделок</p>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade, i) => {
              const isBuy = trade.action.includes("_buy_");
              const resource = trade.action.split("_")[2] || "UNKNOWN";
              
              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`p-3 rounded-lg border ${
                    isBuy 
                      ? "bg-sprout-500/10 border-sprout-500/30" 
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{isBuy ? "📈" : "📉"}</span>
                      <div>
                        <p className="text-parchment font-bold text-sm">
                          {isBuy ? "BUY" : "SELL"} {resource}
                        </p>
                        <p className="text-straw text-xs">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isBuy ? "text-sprout-500" : "text-red-400"}`}>
                        {trade.metadata.amount} ед.
                      </p>
                      <p className="text-straw text-xs">
                        @ {Number(trade.metadata.price).toFixed(4)} SOL
                      </p>
                    </div>
                  </div>
                  {trade.metadata.reason && (
                    <p className="text-straw text-xs italic mt-1">
                      {trade.metadata.reason}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
