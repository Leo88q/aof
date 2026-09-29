import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { useLocale } from "../../i18n/LocaleProvider";
import { adminAuditCopy } from "../../i18n/adminAuditCopy";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  metadata?: string;
  result?: string;
  txSig?: string;
  programId?: string;
  ip?: string;
  userAgent?: string;
}

export function AuditLogPage() {
  const { language } = useLocale();
  const text = adminAuditCopy[language];
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFailed, setReadFailed] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadLogs() {
    try {
      const data = await api.admin.auditLogs(100);
      if (!Array.isArray(data)) throw new Error("Invalid audit response");
      setLogs(data);
      setReadFailed(false);
    } catch (e) {
      setReadFailed(true);
      console.error("Failed to load audit logs:", e);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log =>
    log.user.toLowerCase().includes(filter.toLowerCase()) ||
    log.action.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-4" lang={language}>
        <Card>
          <p className="text-straw text-center">{text.loading}</p>
        </Card>
      </div>
    );
  }

  if (readFailed) {
    return (
      <div className="p-4" lang={language}>
        <Card>
          <p role="alert" className="text-straw text-center">{text.failed}</p>
          <button type="button" onClick={loadLogs} className="mt-3 px-3 py-2 bg-soil-700 text-parchment rounded">{text.retry}</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24" lang={language}>
      <Card className="mb-4">
        <h2 className="text-parchment font-bold text-lg mb-2 flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.sentinel} alt="" className="w-6 h-6" /> Sentinel Audit Log</h2>
        <p className="text-straw text-sm mb-4">
          {text.scope}
        </p>
        
        <input
          type="text"
          placeholder={text.filter}
          aria-label={text.filter}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full p-2 bg-soil-800 border border-straw/20 rounded text-parchment text-sm"
        />

        <div className="flex gap-2 mt-3">
          <button
            onClick={loadLogs}
            className="px-3 py-1 bg-soil-700 text-parchment text-xs rounded hover:bg-soil-600 transition"
          >
            {text.refresh}
          </button>
          <span className="text-straw text-xs flex items-center">
            {text.records} {filteredLogs.length}
          </span>
        </div>
      </Card>

      <div className="space-y-2">
        {filteredLogs.map((log, i) => {
          let meta: any = {};
          try { meta = log.metadata ? JSON.parse(log.metadata) : {}; } catch {}
          const isSuccess = log.result === "success";
          
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <Card className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        isSuccess
                          ? "bg-sprout-500/20 text-sprout-500"
                          : log.result === "fail" ? "bg-ember-500/20 text-ember-500" : "bg-soil-700 text-straw"
                      }`}>
                        {log.result === "success" ? text.success : log.result === "fail" ? text.failure : text.unknown}
                      </span>
                      <span className="text-wheat-500 font-bold text-sm [overflow-wrap:anywhere]">{log.action}</span>
                    </div>
                    <p className="text-straw text-xs">
                      {new Date(log.timestamp).toLocaleString(language)}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-straw">{text.user}</span>{" "}
                    <span className="text-parchment font-mono [overflow-wrap:anywhere]">
                      {log.user.slice(0, 8)}...{log.user.slice(-8)}
                    </span>
                  </div>
                  
                  {log.txSig && (
                    <div>
                      <span className="text-straw">TX:</span>{" "}
                      <a
                        href={`https://explorer.solana.com/tx/${log.txSig}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-water-400 font-mono hover:underline"
                      >
                        {log.txSig.slice(0, 16)}...
                      </a>
                    </div>
                  )}
                  
                  {meta.method && (
                    <div>
                      <span className="text-straw">{text.method}</span>{" "}
                      <span className="text-parchment">{meta.method} {meta.path}</span>
                    </div>
                  )}

                  {meta.statusCode && (
                    <div>
                      <span className="text-straw">{text.status}</span>{" "}
                      <span className={`font-mono ${
                        meta.statusCode >= 400 ? "text-ember-400" : "text-sprout-500"
                      }`}>
                        {meta.statusCode}
                      </span>
                    </div>
                  )}
                  
                  {meta.body && Object.keys(meta.body).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-straw cursor-pointer hover:text-parchment [overflow-wrap:anywhere]">
                        {text.requestBody(Object.keys(meta.body).length)}
                      </summary>
                      <pre className="text-[10px] bg-soil-900 p-2 rounded mt-1 overflow-x-auto max-h-40">
                        {JSON.stringify(meta.body, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filteredLogs.length === 0 && (
        <Card>
          <p className="text-straw text-center py-8">{filter ? text.noMatches : text.noRecords}</p>
        </Card>
      )}
    </div>
  );
}
