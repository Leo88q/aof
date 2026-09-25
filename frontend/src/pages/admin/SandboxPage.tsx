import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

interface SimulationResult {
  days: number;
  totalAgents: number;
  potatoInflation: number;
  priceChanges: Record<string, number>;
  resourceImbalance: Record<string, number>;
  warnings: string[];
  recommendations: string[];
  agentStats: {
    totalProfit: number;
    avgProfitPerAgent: number;
    bankruptAgents: number;
    topAgentType: string;
  };
  timeline: Array<{
    day: number;
    potatoSupply: number;
    inflation: number;
    activeAgents: number;
  }>;
}

export function SandboxPage() {
  const [agents, setAgents] = useState(1000);
  const [days, setDays] = useState(30);
  const [dailyMint, setDailyMint] = useState(50000);
  const [running, setRunning] = useState(false);
  const [version, setVersion] = useState<"v1" | "v2">("v2");
  const [result, setResult] = useState<SimulationResult | null>(null);

  async function runSimulation() {
    setRunning(true);
    setResult(null);
    
    try {
      const endpoint = version === "v2" ? api.sandbox.runV2 : api.sandbox.run;
      const data = await endpoint({ agents, days, dailyMint });
      setResult(data.simulation);
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4">
        <h2 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.flasks} alt="" className="w-6 h-6" /> Economy Sandbox</h2>
        <p className="text-straw text-sm">
          Симуляция экономики перед апдейтами. Проверь инфляцию и дисбалансы до деплоя.
        </p>
      </Card>

      <Card className="mb-4">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setVersion("v1")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              version === "v1" ? "bg-wheat-600 text-white" : "bg-soil-800 text-straw"
            }`}
          >
            <ResourceGlyph icon={UI_ICONS.chartsBar} alt="" className="w-4 h-4 inline-block align-text-bottom" /> V1: Базовая
          </button>
          <button
            onClick={() => setVersion("v2")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              version === "v2" ? "bg-wheat-600 text-white" : "bg-soil-800 text-straw"
            }`}
          >
            🎮 V2: Полная (все механики)
          </button>
        </div>
        <h3 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.adminGear} alt="" className="w-4 h-4" /> Параметры симуляции</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-straw text-xs block mb-1">
              Amount агентов: <span className="text-parchment font-bold">{agents}</span>
            </label>
            <input
              type="range"
              min={100}
              max={5000}
              step={100}
              value={agents}
              onChange={(e) => setAgents(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-straw text-xs block mb-1">
              Дней симуляции: <span className="text-parchment font-bold">{days}</span>
            </label>
            <input
              type="range"
              min={7}
              max={90}
              step={1}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-straw text-xs block mb-1">
              Daily POTATO mint: <span className="text-wheat-500 font-bold">{dailyMint.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={10000}
              max={500000}
              step={10000}
              value={dailyMint}
              onChange={(e) => setDailyMint(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        
        <button
          onClick={runSimulation}
          disabled={running}
          className="w-full mt-4 py-3 bg-wheat-600 text-white font-bold rounded-lg hover:bg-wheat-700 transition disabled:opacity-50"
        >
          {running ? "⏳ Симуляция..." : "🚀 Запустить симуляцию"}
        </button>
      </Card>

      {result && (
        <>
          {/* Главные метрики */}
          <Card className="mb-4">
            <h3 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.chartsBar} alt="" className="w-4 h-4" /> Результаты</h3>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-soil-800/60">
                <p className="text-straw text-xs mb-1">Инфляция за {result.days} дней</p>
                <p className={`text-2xl font-bold ${
                  result.potatoInflation > 50 ? "text-red-400" : 
                  result.potatoInflation > 25 ? "text-yellow-400" : "text-sprout-500"
                }`}>
                  {result.potatoInflation.toFixed(1)}%
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-soil-800/60">
                <p className="text-straw text-xs mb-1">Банкроты</p>
                <p className="text-2xl font-bold text-parchment">
                  {result.agentStats.bankruptAgents}
                  <span className="text-xs text-straw ml-1">
                    ({((result.agentStats.bankruptAgents / result.totalAgents) * 100).toFixed(0)}%)
                  </span>
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-soil-800/60">
                <p className="text-straw text-xs mb-1">Средняя прибыль</p>
                <p className="text-2xl font-bold text-wheat-500">
                  {result.agentStats.avgProfitPerAgent.toFixed(2)} SOL
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-soil-800/60">
                <p className="text-straw text-xs mb-1">Топ стратегия</p>
                <p className="text-2xl font-bold text-sprout-500 capitalize">
                  {result.agentStats.topAgentType}
                </p>
              </div>
            </div>
          </Card>

          {/* Изменение цен */}
          <Card className="mb-4">
            <h3 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-4 h-4" /> Изменение цен</h3>
            <div className="space-y-2">
              {Object.entries(result.priceChanges)
                .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                .slice(0, 10)
                .map(([res, change]) => (
                  <div key={res} className="flex items-center justify-between p-2 rounded bg-soil-800/40">
                    <span className="text-parchment text-sm font-mono">{res}</span>
                    <span className={`font-bold ${change > 0 ? "text-sprout-500" : "text-red-400"}`}>
                      {change > 0 ? "+" : ""}{change.toFixed(1)}%
                    </span>
                  </div>
                ))}
            </div>
          </Card>

          {/* Предупреждения */}
          {result.warnings.length > 0 && (
            <Card className="mb-4 bg-red-500/10 border-red-500/30">
              <h3 className="text-red-400 font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.noticeError} alt="" className="w-4 h-4" /> Предупреждения</h3>
              <ul className="space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="text-straw text-xs">• {w}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Рекомендации */}
          {result.recommendations.length > 0 && (
            <Card className="mb-4 bg-sprout-500/10 border-sprout-500/30">
              <h3 className="text-sprout-500 font-semibold text-sm mb-3">💡 Рекомендации</h3>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-straw text-xs">• {r}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <h3 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-4 h-4" /> Timeline</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {result.timeline.map((t) => (
                <div key={t.day} className="flex items-center justify-between p-2 rounded bg-soil-800/40 text-xs">
                  <span className="text-straw">День {t.day}</span>
                  <div className="flex gap-3">
                    <span className="text-wheat-500">{(t.potatoSupply / 1000).toFixed(0)}k</span>
                    <span className={t.inflation > 5 ? "text-red-400" : "text-sprout-500"}>
                      {t.inflation.toFixed(1)}%
                    </span>
                    <span className="text-blue-400">{t.activeAgents} активных</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
