import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useNav } from "../../nav/NavContext";
import { fmtNum } from "../../lib/marketUtils";
import { resourceIcon } from "../../lib/visualAssets";
import { ArtPlate } from "../visual/ArtPlate";

interface ResourceBarProps {
  owner: string | null;
  refreshKey?: any;
}

/**
 * Три счётчика ресурсов на главной: FOOD / WOOD / STONE.
 * Источник правды — SPL-балансы на цепи (через /query/balances).
 * Автообновление при смене refreshKey (например, после collect_mining).
 */
export function ResourceBar({ owner, refreshKey }: ResourceBarProps) {
  const { setTab } = useNav();
  const [balances, setBalances] = useState<Record<string, number>>({ FOOD: 0, WOOD: 0, STONE: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!owner) {
      setBalances({ FOOD: 0, WOOD: 0, STONE: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    api.query.balances(owner)
      .then((b: any) => setBalances({ FOOD: b?.FOOD ?? 0, WOOD: b?.WOOD ?? 0, STONE: b?.STONE ?? 0 }))
      .catch(() => setBalances({ FOOD: 0, WOOD: 0, STONE: 0 }))
      .finally(() => setLoading(false));
  }, [owner, refreshKey]);

  const items = [
    { key: "DATA", label: "Данные", accent: "#c9a24a" },
    { key: "CIRCUIT", label: "Схема", accent: "#6bbf59" },
    { key: "SILICON", label: "Кремний", accent: "#9a8f82" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {items.map((it) => (
        <motion.div key={it.key}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-soil-850 border border-straw/10 px-3 py-2 shadow-card">
          <div className="flex items-center gap-1.5">
            <ArtPlate src={resourceIcon(it.key)} alt={it.label} size={28} />
            <span className="text-straw text-xs">{it.label}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-parchment font-bold text-lg tabular-nums">
              {loading ? "…" : fmtNum(balances[it.key])}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
