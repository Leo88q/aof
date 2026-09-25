import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { toolPlate, resourceIcon, UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { fmtNum, useFlash } from "../../lib/marketUtils";

const MAX_DURABILITY = 20;
const D9 = 1e9;

export function RepairPage() {
  const { address } = useWalletStore();
  const [tools, setTools] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mints, setMints] = useState({ wood: "", stone: "" });
  const [amount, setAmount] = useState(1);
  const [quote, setQuote] = useState<{ stone: number; wood: number } | null>(null);
  const [receipt, setReceipt] = useState<React.ReactNode | null>(null);
  const [txStatus, flash] = useFlash();

  useEffect(() => {
    api.query.config()
      .then((c: any) => setMints({ wood: c?.woodMint || "", stone: c?.stoneMint || "" }))
      .catch(() => {});
  }, []);

  const loadTools = () => {
    if (!address) return;
    api.query.myTools(address)
      .then((r: any) => {
        const a: any[] = Array.isArray(r) ? r : r?.tools || [];
        setTools(a);
        setSelected((s) => s || (a[0]?.mint ?? null));
      })
      .catch(() => setTools([]));
  };

  useEffect(() => { loadTools(); }, [address]);

  const tool = tools.find((t) => t.mint === selected);
  const durability = tool ? Number(tool.durability) : 0;
  const maxRepair = Math.max(0, MAX_DURABILITY - durability);
  const amt = Math.min(amount, maxRepair);
  const critical = durability <= 5;

  // живой калькулятор: пересчёт при смене инструмента или количества
  useEffect(() => {
    if (!tool || amt <= 0) { setQuote(null); return; }
    api.tools.repairQuote({ mint: tool.mint, amount: amt })
      .then((q: any) => setQuote(q))
      .catch(() => setQuote(null));
  }, [tool?.mint, amt]);

  async function doRepair() {
    if (!address) return flash("❌ Connect wallet (кнопка вверху)");
    if (!tool) return flash("❌ Выберите инструмент");
    if (!mints.stone || !mints.wood) return flash("❌ Минты ресурсов не загружены");
    if (amt <= 0) return flash("❌ Durability уже полная");
    const q = quote;
    try {
      flash("Чиним…");
      const resp = await api.tools.repair({
        user: address, mint: tool.mint,
        stoneMint: mints.stone, woodMint: mints.wood,
        amount: amt,
      });
      const r = await handleTxResponse(resp);
      if (r.success) {
        flash(`✅ Отремонтировано (+${amt}): ${r.signature?.slice(0, 10)}…`);
        setReceipt(
          <>Списано: {fmtNum((q?.stone ?? 0) / D9)} <ResourceGlyph icon={resourceIcon("SILICON")} alt="" className="inline-block w-3.5 h-3.5" /> + {fmtNum((q?.wood ?? 0) / D9)} <ResourceGlyph icon={resourceIcon("CIRCUIT")} alt="" className="inline-block w-3.5 h-3.5" /></>
        );
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setTimeout(loadTools, 2500);
      } else {
        flash(`❌ ${r.error}`);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <p className="text-straw text-xs">
        Durability тратится майнингом. Ремонт атомарно списывает кремний и схему. Чем реже инструмент — тем дороже.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {receipt && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="text-xs px-3 py-2 rounded-xl bg-gold/10 border border-gold/40 text-gold font-semibold">
          🧾 {receipt}
        </motion.div>
      )}

      {!address && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-2">👛</div>
          <p className="text-parchment text-sm">Подключите кошелёк, чтобы чинить инструменты</p>
        </Card>
      )}

      {address && tools.length === 0 && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-2">🧰</div>
          <p className="text-parchment text-sm">Инструментов нет — нечего чинить</p>
        </Card>
      )}

      {tools.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tools.map((t) => {
              const rk = rarityKey(t.rarity);
              return (
                <button key={t.mint} onClick={() => { setSelected(t.mint); setReceipt(null); }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${selected === t.mint ? "border-wheat-500 bg-wheat-500/10 text-parchment" : "border-straw/15 bg-soil-800/60 text-straw"}`}>
                  <ArtPlate src={toolPlate(t.toolType, rk)} alt={t.toolType || "Инструмент"} size={28} />
                  <span style={{ color: RARITY_META[rk]?.color }}>{RARITY_META[rk]?.label}</span>
                  <span>· {Number(t.durability)}/{MAX_DURABILITY}</span>
                </button>
              );
            })}
          </div>

          {tool && (
            <Card>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ArtPlate src={toolPlate(tool.toolType, rarityKey(tool.rarity))} alt={tool.toolType || "Инструмент"} size={72} />
                  {critical && <span className="absolute -top-1 -right-2 text-lg">💔</span>}
                </div>
                <div className="flex-1">
                  <p className="text-parchment font-semibold" style={{ color: RARITY_META[rarityKey(tool.rarity)]?.color }}>
                    {RARITY_META[rarityKey(tool.rarity)]?.label} · {tool.toolType}
                  </p>
                  <p className="text-straw text-xs">
                    Durability {durability} / {MAX_DURABILITY}
                    {critical && <span className="text-wheat-500 font-semibold"> — вот-вот сломается!</span>}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-3 rounded-full bg-soil-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ width: `${(durability / MAX_DURABILITY) * 100}%`, background: critical ? "#c2703d" : durability <= 10 ? "#e8a33d" : "#6bbf59" }}
                  animate={{ opacity: critical ? [1, 0.45, 1] : [1, 0.8, 1] }}
                  transition={{ repeat: Infinity, duration: critical ? 0.6 : 1.6 }}
                />
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-straw text-xs">Восстановить единиц (макс. {maxRepair})</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setAmount((a) => Math.max(1, a - 1))}
                    className="w-9 h-9 rounded-xl bg-soil-700 border border-straw/20 text-parchment text-lg">−</button>
                  <span className="text-parchment font-bold w-8 text-center">{amt}</span>
                  <button onClick={() => setAmount((a) => Math.min(Math.max(1, maxRepair), a + 1))}
                    className="w-9 h-9 rounded-xl bg-soil-700 border border-straw/20 text-parchment text-lg">+</button>
                </div>
              </div>

              {/* Калькулятор стоимости: два ресурса */}
              <div className="mt-4 rounded-xl bg-soil-800/70 border border-straw/15 p-3">
                <p className="text-straw text-[10px] uppercase tracking-wide mb-2">Стоимость ремонта</p>
                {quote ? (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div>
                      <p className="text-parchment font-bold text-sm tabular-nums">{fmtNum(quote.stone / D9)}</p>
                      <p className="text-straw text-[10px]">🪨 Кремний</p>
                    </div>
                    <div>
                      <p className="text-parchment font-bold text-sm tabular-nums">{fmtNum(quote.wood / D9)}</p>
                      <p className="text-straw text-[10px]">🪵 Схема</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-straw text-xs text-center">…</p>
                )}
              </div>

              <button onClick={doRepair} disabled={!mints.stone || maxRepair === 0}
                className="w-full mt-4 py-2.5 rounded-xl bg-wheat-600 text-white font-semibold text-sm disabled:opacity-40">
                🩹 Починить на {amt} прочности
              </button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
