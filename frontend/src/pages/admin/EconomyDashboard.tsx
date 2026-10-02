import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { ProgressRing } from "../../components/ProgressRing";
import { api } from "../../lib/api";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { useLocale } from "../../i18n/LocaleProvider";
import { economyAdminCopy } from "../../i18n/economyAdminCopy";

interface EconomySnapshot {
  id: string;
  timestamp: string;
  mindSupply: string;
  mindBurned24h: string | null;
  mindMinted24h: string | null;
  inflation24h: number;
  activeCrafters24h: number;
  activeTraders24h: number;
  totalTxs24h: number;
  failedTxs24h: number;
  dataQuality?: DataQuality;
  fieldQuality?: Partial<Record<string, DataQuality>>;
}

type DataQuality = "complete" | "partial" | "unavailable";

const QUALITY_CLS: Record<DataQuality, string> = {
  complete: "bg-sprout-500/20 text-sprout-500",
  partial: "bg-gold-500/20 text-gold-400",
  unavailable: "bg-ember-500/20 text-ember-400",
};

function QualityBadge({ q, label }: { q?: DataQuality; label: Record<DataQuality, string> }) {
  if (!q) return null;
  return <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] [overflow-wrap:anywhere] ${QUALITY_CLS[q]}`}>{label[q]}</span>;
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
  const { language } = useLocale();
  const text = economyAdminCopy[language];
  const [snapshots, setSnapshots] = useState<EconomySnapshot[]>([]);
  const [alerts, setAlerts] = useState<EconomyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [snapData, alertData] = await Promise.all([
        api.admin.economySnapshots(50),
        api.admin.economyAlerts(20),
      ]);
      if (!Array.isArray(snapData) || !Array.isArray(alertData)) throw new Error("Invalid economy response");
      setSnapshots(snapData);
      setAlerts(alertData);
      setReadFailed(false);
    } catch (e) {
      setReadFailed(true);
      console.error("Failed to load economy data:", e);
    } finally {
      setLoading(false);
    }
  }

  async function takeSnapshot() {
    try {
      setActionFailed(false);
      await api.admin.economySnapshot();
      setTimeout(loadData, 1000);
    } catch (e) {
      setActionFailed(true);
      console.error("Snapshot failed:", e);
    }
  }

  async function resolveAlert(id: string) {
    try {
      setActionFailed(false);
      await api.admin.economyAlertResolve(id);
      loadData();
    } catch (e) {
      setActionFailed(true);
      console.error("Resolve failed:", e);
    }
  }

  if (loading) {
    return (
      <div className="p-4" lang={language}>
        <Card><p className="text-straw text-center py-8">{text.loading}</p></Card>
      </div>
    );
  }

  if (readFailed) {
    return <div className="p-4" lang={language}><Card>
      <p role="alert" className="text-straw text-sm [overflow-wrap:anywhere]">{text.readFailed}</p>
      <button type="button" onClick={loadData} className="mt-3 px-3 py-2 bg-soil-700 text-parchment rounded [overflow-wrap:anywhere]">{text.retry}</button>
    </Card></div>;
  }

  const latest = snapshots[0];
  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="p-4 pb-24 min-w-0" lang={language}>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
          <div>
            <h2 className="text-parchment font-bold text-lg flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.trainer} alt="" className="w-6 h-6" /> {text.title}</h2>
            <p className="text-straw text-sm">{text.subtitle}</p>
          </div>
          <button
            onClick={takeSnapshot}
            type="button"
            className="px-4 py-2 bg-accent-600 text-white text-sm rounded-lg hover:bg-accent-700 transition active:scale-95 [overflow-wrap:anywhere]"
          >
            {text.snapshot}
          </button>
        </div>
        {actionFailed && <p role="alert" className="mt-2 text-ember-400 text-sm [overflow-wrap:anywhere]">{text.actionFailed}</p>}
      </Card>

      {!latest && <Card className="mb-4"><p className="text-straw text-sm">{text.noSnapshots}</p></Card>}
      {latest && (
        <Card className="mb-4">
          <h3 className="text-parchment font-semibold text-sm mb-1">
            <ResourceGlyph icon={UI_ICONS.chartsBar} alt="" className="w-4 h-4 inline-block align-text-bottom" /> {text.latest}
            <QualityBadge label={text.quality} q={latest.dataQuality} />
          </h3>
          {(!latest.dataQuality || latest.dataQuality !== "complete") && (
            <p className="text-straw text-xs mb-3">
              {latest.dataQuality ? text.coverage : text.unknownQuality}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.supply}<QualityBadge label={text.quality} q={latest.fieldQuality?.mindSupply} /></p>
              <p className="text-accent-500 text-xl font-bold">
                {latest.fieldQuality?.mindSupply === "unavailable" ? "—" : `${(Number(latest.mindSupply) / 1e9).toFixed(2)}M`}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.mintedBurned}<QualityBadge label={text.quality} q={latest.fieldQuality?.mindMinted24h} /></p>
              <p className="text-parchment text-xl font-bold">
                {latest.mindMinted24h === null || latest.mindMinted24h === undefined ? "—" : `${latest.mindMinted24h} / ${latest.mindBurned24h}`}
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.inflation}<QualityBadge label={text.quality} q={latest.fieldQuality?.inflation24h} /></p>
              <div className="flex items-center gap-2">
                <ProgressRing
                  value={Math.min(Math.abs(latest.inflation24h), 20)}
                  max={20}
                  size={40}
                  stroke={4}
                  color={latest.inflation24h > 10 ? "#E2685F" : latest.inflation24h > 5 ? "#5FC9DA" : "#5FD3A8"}
                  label={`${latest.inflation24h.toFixed(1)}%`}
                />
              </div>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.crafters}<QualityBadge label={text.quality} q={latest.fieldQuality?.activity24h} /></p>
              <p className="text-sprout-500 text-xl font-bold">{latest.activeCrafters24h}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.traders}</p>
              <p className="text-info-400 text-xl font-bold">{latest.activeTraders24h}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.transactions}</p>
              <p className="text-parchment text-xl font-bold">{latest.totalTxs24h}</p>
            </div>
            
            <div className="p-3 rounded-lg bg-soil-800/60">
              <p className="text-straw text-xs mb-1">{text.failedTransactions}</p>
              <p className={`text-xl font-bold ${latest.failedTxs24h > 200 ? "text-ember-400" : "text-parchment"}`}>
                {latest.failedTxs24h}
              </p>
            </div>
          </div>
          
          <p className="text-straw text-xs mt-3">
            {text.updated} {new Date(latest.timestamp).toLocaleString(language)}
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-parchment font-semibold text-sm flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.noticeError} alt="" className="w-4 h-4" /> {text.alerts}</h3>
          {unresolvedAlerts.length > 0 && (
            <span className="px-2 py-1 bg-ember-500/20 text-ember-400 text-xs rounded-full">
              {text.active(unresolvedAlerts.length)}
            </span>
          )}
        </div>
        
        {alerts.length === 0 ? (
          <p className="text-straw text-center py-4 inline-flex w-full items-center justify-center gap-1.5">{text.noAlerts} <ResourceGlyph icon={UI_ICONS.noticeSuccess} alt="" className="w-4 h-4" /></p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 10).map(alert => {
              const severityColor = {
                critical: "bg-ember-500/20 border-ember-500/40 text-ember-400",
                warning: "bg-gold-500/20 border-gold-500/40 text-gold-400",
                info: "bg-info-500/20 border-info-500/40 text-info-400",
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
                        <span className="text-xs font-bold uppercase [overflow-wrap:anywhere]">{text.severity[alert.severity as keyof typeof text.severity] ?? alert.severity}</span>
                        <span className="text-xs opacity-70 [overflow-wrap:anywhere]">{alert.type}</span>
                      </div>
                      <p className="text-sm [overflow-wrap:anywhere]">{alert.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(alert.timestamp).toLocaleString(language)}
                      </p>
                    </div>
                    
                    {!alert.resolved && (
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        type="button"
                        aria-label={text.resolve}
                        title={text.resolve}
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
          <h3 className="text-parchment font-semibold text-sm mb-3 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.chartsUp} alt="" className="w-4 h-4" /> {text.history}</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {snapshots.slice(0, 20).map((snap) => (
              <div key={snap.id} className="p-2 rounded bg-soil-800/40 text-xs flex items-center justify-between">
                <span className="text-straw">{new Date(snap.timestamp).toLocaleTimeString(language)}</span>
                <div className="flex gap-3">
                  <span className="text-accent-500">{(Number(snap.mindSupply) / 1e9).toFixed(2)}M</span>
                  <span className={snap.inflation24h > 10 ? "text-ember-400" : snap.inflation24h > 5 ? "text-gold-400" : "text-sprout-500"}>
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
