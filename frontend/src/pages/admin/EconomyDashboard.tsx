import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { ProgressRing } from "../../components/ProgressRing";
import { api } from "../../lib/api";

interface EconomySnapshot {
  id: string;
  timestamp: string;
  potatoSupply: string;
  potatoBurned24h: string;
  potatoMinted24h: string;
  inflation24h: number;
  activeCrafters24h: number;
  activeTraders24h: number;
  totalTxs24h: number;
  failedTxs24h: number;
}

interface EconomyAlert {
  id: string;
  timestamp: string;
  type: string;
  severity: string;
  message: string;
  metadata: string;
  resolved: boolean;
}

export function EconomyDashboard() {
  const [snapshots, setSnapshots] = useState<EconomySnapshot[]>([]);
  const [alerts, setAlerts] = useState<EconomyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [snapData, alertData] = await Promise.all([
        api.admin.economySnapshots(50).catch(() => []),
        api.admin.economyAlerts(20).catch(() => []),
      ]);
      
      setSnapshots(snapData || []);
      setAlerts(alertData || []);
    } catch (e) {
      console.error("Failed to load economy data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function takeSnapshot() {
    try {
      await api.admin.economySnapshot();
      setTimeout(loadData, 1000);
    } catch (e) {
      console.error("Snapshot failed:", e);
    }
  }

  async function resolveAlert(id: string) {
    try {
      await api.admin.economyAlertResolve(id);
      loadData();
    } catch (e) {
      console.error("Resolve failed:", e);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <Card><p className="text-straw text-center py-8">Загрузка экономики...</p></Card>
      </div>
    );
  }

  const latest = snapshots[0];
  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-parchment font-bold text-lg">🤖 OpenClaw Economy Monitor</h2>
            <p className="text-straw text-sm">Real-time мониторинг экономики POTATO</p>
          </div>
          <button
            onClick={takeSnapshot}
            className="px-4 py-2 bg-wheat-600 text-white text-sm rounded-lg hover:bg-wheat-700 transition active:scale-95"
          >
            📸 Snapshot
          </button>
        </div>
      </Card>

      {latest && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-3">📊 Текущие метрики</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">POTATO Supply</p>
              <p className="text-wheat-500 text-xl font-bold">
                {(Number(latest.potatoSupply) / 1e9).toFixed(2)}M
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">Инфляция 24ч</p>
              <div className="flex items-center gap-2">
                <ProgressRing
                  value={Math.min(Math.abs(latest.inflation24h), 20)}
                  max={20}
                  size={40}
                  stroke={4}
                  color={latest.inflation24h > 10 ? "#f87171" : latest.inflation24h > 5 ? "#fbbf24" : "#34d399"}
                  label={`${latest.inflation24h.toFixed(1)}%`}
                />
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">Крафтеры 24ч</p>
              <p className="text-sprout-500 text-xl font-bold">{latest.activeCrafters24h}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">Трейдеры 24ч</p>
              <p className="text-blue-400 text-xl font-bold">{latest.activeTraders24h}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">TX за 24ч</p>
              <p className="text-parchment text-xl font-bold">{latest.totalTxs24h}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">Failed TX</p>
              <p className={`text-xl font-bold ${latest.failedTxs24h > 200 ? "text-red-400" : "text-parchment"}`}>
                {latest.failedTxs24h}
              </p>
            </div>
          </div>
          
          <p className="text-straw text-xs mt-3">
            Обновлено: {new Date(latest.timestamp).toLocaleString()}
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-parchment font-semibold text-sm">🚨 Алерты</h3>
          {unresolvedAlerts.length > 0 && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
              {unresolvedAlerts.length} активных
            </span>
          )}
        </div>
        
        {alerts.length === 0 ? (
          <p className="text-straw text-center py-4">Нет алертов ✅</p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 10).map(alert => {
              const severityColor = {
                critical: "bg-red-500/20 border-red-500/40 text-red-400",
                warning: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400",
                info: "bg-blue-500/20 border-blue-500/40 text-blue-400",
              }[alert.severity] || "bg-soil-800 border-straw/20 text-straw";
              
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-lg border ${severityColor} ${alert.resolved ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase">{alert.severity}</span>
                        <span className="text-xs opacity-70">{alert.type}</span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    
                    {!alert.resolved && (
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="px-2 py-1 bg-soil-800 text-parchment text-xs rounded hover:bg-soil-700 transition"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {snapshots.length > 0 && (
        <Card>
          <h3 className="text-parchment font-semibold text-sm mb-3">📈 История snapshots</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {snapshots.slice(0, 20).map((snap) => (
              <div key={snap.id} className="p-2 rounded bg-soil-800/40 text-xs flex items-center justify-between">
                <span className="text-straw">{new Date(snap.timestamp).toLocaleTimeString()}</span>
                <div className="flex gap-3">
                  <span className="text-wheat-500">{(Number(snap.potatoSupply) / 1e9).toFixed(2)}M</span>
                  <span className={snap.inflation24h > 10 ? "text-red-400" : snap.inflation24h > 5 ? "text-yellow-400" : "text-sprout-500"}>
                    {snap.inflation24h.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
