import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { useWalletStore } from "../store/walletStore";
import { Card } from "./ui/Card";

interface Privilege {
  id: string;
  title: string;
  description: string;
  active: boolean;
  effect: string;
  required: string;
  icon: string;
  color: string;
}

export function PrivilegesPanel({ compact = false }: { compact?: boolean }) {
  const { address } = useWalletStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.privileges.status(address)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <Card className={compact ? "p-3" : "p-4"}>
        <p className="text-straw text-xs text-center">Loading привилегий...</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={compact ? "p-3" : "p-4"}>
        <p className="text-straw text-xs text-center">
          {!address ? "Подключите кошелёк" : "Не удалось загрузить привилегии"}
        </p>
      </Card>
    );
  }

  const activePrivs = data.privileges.filter((p: Privilege) => p.active);
  const inactivePrivs = data.privileges.filter((p: Privilege) => !p.active);

  return (
    <div className="space-y-3">
      {/* Сводка */}
      {!compact && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-r from-purple-600/20 to-gold/20 border border-gold/30"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-parchment font-bold">🎯 Ваши привилегии</h3>
            <span className="text-xs bg-gold/30 text-gold px-2 py-1 rounded-full font-bold">
              {data.summary.activeCount} / {data.summary.total}
            </span>
          </div>
          <p className="text-straw text-xs">
            Общая скидка на крафт: <span className="text-gold font-bold">{data.summary.totalCraftDiscountPct}%</span>
          </p>
        </motion.div>
      )}

      {/* Активные привилегии */}
      {activePrivs.length > 0 && (
        <div className="space-y-2">
          {!compact && <h4 className="text-parchment text-sm font-semibold">✨ Активные</h4>}
          {activePrivs.map((p: Privilege) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 rounded-xl bg-sprout-500/10 border border-sprout-500/30"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{p.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-parchment text-sm font-semibold">{p.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sprout-500/30 text-sprout-500 font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-straw text-xs mb-1">{p.description}</p>
                  <p className="text-gold text-xs font-bold">🎁 {p.effect}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Доступные для разблокировки */}
      {!compact && inactivePrivs.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-parchment text-sm font-semibold">🔒 Доступные для разблокировки</h4>
          {inactivePrivs.map((p: Privilege) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-xl bg-soil-800/60 border border-straw/10 opacity-80"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl grayscale">{p.icon}</span>
                <div className="flex-1">
                  <p className="text-parchment text-sm font-semibold">{p.title}</p>
                  <p className="text-straw text-xs mb-1">{p.description}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gold">🎁 {p.effect}</span>
                    <span className="text-straw">Требуется: {p.required}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Компактный бейдж */}
      {compact && (
        <div className="flex items-center gap-1 flex-wrap">
          {activePrivs.slice(0, 3).map((p: Privilege) => (
            <span key={p.id} className="text-xs px-2 py-1 rounded-full font-bold"
                  style={{ backgroundColor: p.color + "30", color: p.color }}>
              {p.icon} {p.title ? p.title.split(" ").slice(1).join(" ") : ""}
            </span>
          ))}
          {activePrivs.length > 3 && (
            <span className="text-xs px-2 py-1 rounded-full bg-straw/10 text-straw">
              +{activePrivs.length - 3}
            </span>
          )}
        </div>
      )}
      {/* === РАЗДЕЛ: КОЛЛЕКЦИОННЫЕ NFT === */}
      <div style={{marginTop: "16px", padding: "16px", background: "rgba(251, 191, 36, 0.1)", borderRadius: "12px", border: "1px solid rgba(251, 191, 36, 0.3)"}}>
        <h3 style={{color: "#fbbf24", marginBottom: "12px", fontSize: "16px", fontWeight: "bold"}}>🏆 Коллекционные NFT</h3>
        
        <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px"}}>
          
          <div style={{background: "rgba(30, 41, 59, 0.8)", padding: "14px", borderRadius: "10px", border: "2px solid rgba(139, 92, 246, 0.5)"}}>
            <div style={{display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px"}}>
              <span style={{fontSize: "24px"}}>📜</span>
              <h4 style={{color: "#a78bfa", fontSize: "15px", margin: 0, fontWeight: "bold"}}>Historian</h4>
            </div>
            <p style={{fontSize: "12px", color: "#cbd5e1", marginBottom: "10px", lineHeight: "1.5"}}>
              <b style={{color: "#fbbf24"}}>Эффект:</b> +5% шанс Singularity из паков, +25 слотов рефералов
            </p>
            <div style={{fontSize: "11px", color: "#94a3b8", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px"}}>
              <b>🎯 Как получить:</b>
              <ul style={{margin: "4px 0 0 0", paddingLeft: "16px", lineHeight: "1.6"}}>
                <li>Квесты эпохи (редкая награда)</li>
                <li>Покупка за <b>5000 POTATO</b> в магазине</li>
                <li>Топ-10 рейтинга в конце сезона</li>
              </ul>
            </div>
          </div>
          
          <div style={{background: "rgba(30, 41, 59, 0.8)", padding: "14px", borderRadius: "10px", border: "2px solid rgba(236, 72, 153, 0.5)"}}>
            <div style={{display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px"}}>
              <span style={{fontSize: "24px"}}>🏅</span>
              <h4 style={{color: "#ec4899", fontSize: "15px", margin: 0, fontWeight: "bold"}}>Medallion</h4>
            </div>
            <p style={{fontSize: "12px", color: "#cbd5e1", marginBottom: "10px", lineHeight: "1.5"}}>
              <b style={{color: "#fbbf24"}}>Эффект:</b> +3% шанс Transcendent из паков, +5 слотов рефералов
            </p>
            <div style={{fontSize: "11px", color: "#94a3b8", background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px"}}>
              <b>🎯 Как получить:</b>
              <ul style={{margin: "4px 0 0 0", paddingLeft: "16px", lineHeight: "1.6"}}>
                <li>Квесты эпохи (ультра-редкая награда)</li>
                <li>Покупка за <b>10000 POTATO</b> в магазине</li>
                <li>Топ-3 рейтинга в конце сезона</li>
                <li>Специальные события (лимит: 100 шт/сезон)</li>
              </ul>
            </div>
          </div>
          
        </div>
        
        <div style={{marginTop: "12px", padding: "10px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", fontSize: "11px", color: "#94a3b8", textAlign: "center"}}>
          💡 <b>Стейкай NFT</b> в разделе "Коллекционеры" для активации бонусов. Минимальный срок — 3 дня.
        </div>
      </div>


    </div>
  );
}