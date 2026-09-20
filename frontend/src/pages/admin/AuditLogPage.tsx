import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";

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
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadLogs() {
    try {
      const data = await api.admin.auditLogs(100);
      setLogs(data || []);
    } catch (e) {
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
      <div className="p-4">
        <Card>
          <p className="text-straw text-center">Loading логов...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <Card className="mb-4">
        <h2 className="text-parchment font-bold text-lg mb-2">🛡️ Sentinel Audit Log</h2>
        <p className="text-straw text-sm mb-4">
          Автоматическое логирование всех действий игроков для расследования споров
        </p>
        
        <input
          type="text"
          placeholder="Фильтр по user или action..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full p-2 bg-soil-800 border border-straw/20 rounded text-parchment text-sm"
        />

        <div className="flex gap-2 mt-3">
          <button
            onClick={loadLogs}
            className="px-3 py-1 bg-soil-700 text-parchment text-xs rounded hover:bg-soil-600 transition"
          >
            🔄 Обновить
          </button>
          <span className="text-straw text-xs flex items-center">
            Записей: {filteredLogs.length}
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
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        isSuccess 
                          ? "bg-sprout-500/20 text-sprout-500" 
                          : "bg-red-500/20 text-red-500"
                      }`}>
                        {log.result?.toUpperCase() || "UNKNOWN"}
                      </span>
                      <span className="text-wheat-500 font-bold text-sm">{log.action}</span>
                    </div>
                    <p className="text-straw text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-straw">User:</span>{" "}
                    <span className="text-parchment font-mono">
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
                        className="text-blue-400 font-mono hover:underline"
                      >
                        {log.txSig.slice(0, 16)}...
                      </a>
                    </div>
                  )}
                  
                  {meta.method && (
                    <div>
                      <span className="text-straw">Method:</span>{" "}
                      <span className="text-parchment">{meta.method} {meta.path}</span>
                    </div>
                  )}

                  {meta.statusCode && (
                    <div>
                      <span className="text-straw">Status:</span>{" "}
                      <span className={`font-mono ${
                        meta.statusCode >= 400 ? "text-red-400" : "text-sprout-500"
                      }`}>
                        {meta.statusCode}
                      </span>
                    </div>
                  )}
                  
                  {meta.body && Object.keys(meta.body).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-straw cursor-pointer hover:text-parchment">
                        Request Body ({Object.keys(meta.body).length} fields)
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
          <p className="text-straw text-center py-8">Нет записей</p>
        </Card>
      )}
    </div>
  );
}
