import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useNav } from "../../nav/NavContext";
import { fmtNum } from "../../lib/marketUtils";
import { resourceIcon } from "../../lib/visualAssets";
import { ArtPlate } from "../visual/ArtPlate";
import { DataUnavailableNotice } from "../../lib/availability";

interface ResourceBarProps {
  owner: string | null;
  refreshKey?: any;
}

/**
 * Три счётчика ресурсов на главной: Данные / Схема / Кремний (DATA / CIRCUIT / SILICON).
 * Источник правды — SPL-балансы на цепи (через /query/balances). Реестр
 * ресурсов читается из Config + MaterialMints PDA: если их нет, бэкенд отвечает
 * 503, и это «неизвестно», а не ноль. Нули в шапке выглядели бы как настоящий
 * баланс и вводили игрока в заблуждение.
 * Автообновление при смене refreshKey (например, после collect_mining).
 */
export function ResourceBar({ owner, refreshKey }: ResourceBarProps) {
  const { setTab } = useNav();
  const [balances, setBalances] = useState<Record<string, number>>({ DATA: 0, CIRCUIT: 0, SILICON: 0 });
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!owner) {
      setBalances({ DATA: 0, CIRCUIT: 0, SILICON: 0 });
      setUnavailable(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.query.balances(owner)
      .then((b: any) => {
        setBalances({
          DATA: b?.DATA ?? b?.FOOD ?? 0,
          CIRCUIT: b?.CIRCUIT ?? b?.WOOD ?? 0,
          SILICON: b?.SILICON ?? b?.STONE ?? 0,
        });
        setUnavailable(false);
      })
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  }, [owner, refreshKey]);

  const items = [
    { key: "DATA", label: "Данные", accent: "#00D4FF" },
    { key: "CIRCUIT", label: "Схема", accent: "#00E5A0" },
    { key: "SILICON", label: "Кремний", accent: "#9B59FF" },
  ];

  return (
    <div className="mb-4">
      <div className="grid grid-cols-3 gap-2">
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
              {loading ? "…" : unavailable ? "—" : fmtNum(balances[it.key])}
            </span>
          </div>
        </motion.div>
      ))}
      </div>
      {unavailable && !loading && (
        <DataUnavailableNotice id="resource_balances" compact className="mt-2" />
      )}
    </div>
  );
}
