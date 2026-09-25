import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { toolPlate } from "../../lib/visualAssets";
import { ArtPlate } from "../../components/visual/ArtPlate";
import { fmtNum, shortAddr, useFlash } from "../../lib/marketUtils";
import { AnimatedCounter } from "../../components/ui/AnimatedCounter";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_RU: Record<string, string> = {
  common: "Базовый", uncommon: "Усиленный", rare: "Квантовый", epic: "Сингулярность", legendary: "Трансцендентный",
};

// [НОВОЕ] Метаданные всех 6 ресурсов
const RES_META: Record<string, { icon: string; label: string; color: string }> = {
  wood:   { icon: "🪵", label: "Схема",   color: "text-amber-400" },
  stone:  { icon: "🪨", label: "Кремний",   color: "text-stone-400" },
  food:   { icon: "🌾", label: "Еда",      color: "text-yellow-500" },
  seeds:  { icon: "🌱", label: "Нейрон",   color: "text-sprout-500" },
  water:  { icon: "💧", label: "Энергопоток",     color: "text-water-500" },
  potato: { icon: "🥔", label: "MIND",   color: "text-wheat-500" },
};

export function CraftPage() {
  const { address } = useWalletStore();
  const [tools, setTools] = useState<any[]>([]);
  const [selMint, setSelMint] = useState("");
  const [newMint, setNewMint] = useState("");
  const [econ, setEcon] = useState<any>(null);
  const [resMints, setResMints] = useState<Record<string, string>>({
    wood: "", stone: "", food: "", seeds: "", water: "", potato: "", skr: ""
  });
  const [balances, setBalances] = useState<Record<string, number>>({
    wood: 0, stone: 0, food: 0, seeds: 0, water: 0, potato: 0, skr: 0
  });
  const [craftQuote, setCraftQuote] = useState<any>(null);
  const [craftReceipt, setCraftReceipt] = useState<string | null>(null);
  const [busyPrep, setBusyPrep] = useState(false);
  const [txStatus, flash] = useFlash();

  const loadTools = () => {
    if (!address) return;
    api.query.myTools(address)
      .then((r: any) => {
        const a: any[] = Array.isArray(r) ? r : r?.tools || [];
        setTools(a.filter((t) => !t.staked && !t.isMining));
      })
      .catch(() => {});
  };

  useEffect(() => { loadTools(); }, [address]);

  // Legacy resources live in Config; the bread-chain resources live in the
  // canonical MaterialMints account. Do not read missing mints from a local
  // placeholder map.
  useEffect(() => {
    Promise.all([api.query.config(), api.query.materialMints()])
      .then(([c, material]) => {
        const mints = material?.mints || {};
        setResMints({
          wood: c?.woodMint || mints.WOOD || "",
          stone: c?.stoneMint || mints.STONE || "",
          food: c?.foodMint || mints.FOOD || "",
          seeds: mints.SEEDS || "",
          water: mints.WATER || "",
          potato: c?.potatoMint || mints.POTATO || "",
          skr: "",
        });
      })
      .catch(() => setResMints({ wood: "", stone: "", food: "", seeds: "", water: "", potato: "", skr: "" }));
    api.query.craftEconomy().then((e: any) => setEcon(e)).catch(() => setEcon(null));
  }, []);

  // Загружаем балансы ресурсов пользователя
  useEffect(() => {
    if (!address || !resMints.wood) return;
    const resources = ["wood", "stone", "food", "seeds", "water", "potato", "skr"];
    const fetchBalances = async () => {
      const newBal: Record<string, number> = { wood: 0, stone: 0, food: 0, seeds: 0, water: 0, potato: 0 };
      // [ФИКС] Используем api.balances (возвращает все балансы пользователя)
      try {
        const allBalances: any = await api.query.balances(address);
        for (const res of resources) {
          const mint = resMints[res];
          if (!mint || !allBalances) continue;
          let val = 0;
          if (Array.isArray(allBalances)) {
            const entry = allBalances.find((b: any) => String(b.mint || b.mintAddress || b.address || "").toLowerCase() === mint.toLowerCase());
            val = Number(entry?.balance ?? entry?.amount ?? 0);
          } else if (typeof allBalances === "object") {
            const key = Object.keys(allBalances).find((k) => k.toLowerCase() === mint.toLowerCase());
            if (key) {
              const v: any = allBalances[key];
              val = Number(typeof v === "object" ? (v.balance ?? v.amount ?? 0) : v);
            } else if (allBalances[res] != null) {
              const v: any = allBalances[res];
              val = Number(typeof v === "object" ? (v.balance ?? v.amount ?? 0) : v);
            }
          }
          newBal[res] = val;
        }
      } catch (e) {
        console.warn("Failed to fetch balances:", e);
      }
      setBalances(newBal);
    };
    fetchBalances();
  }, [address, resMints]);

  const src = tools.find((t) => t.mint === selMint);
  const srcRk = src ? rarityKey(src.rarity) : "";
  const srcIdx = RARITY_ORDER.indexOf(srcRk);
  const targetRk = srcIdx >= 0 && srcIdx < 4 ? RARITY_ORDER[srcIdx + 1] : "";

  // живой калькулятор стоимости улучшения (6 ресурсов)
  useEffect(() => {
    if (!targetRk) { setCraftQuote(null); return; }
    api.tools.craftQuote({ rarity: targetRk })
      .then((q: any) => setCraftQuote(q))
      .catch(() => setCraftQuote(null));
  }, [targetRk]);

  async function prepMint() {
    if (!address) return flash("❌ Connect wallet (кнопка вверху)");
    setBusyPrep(true);
    flash("Готовим новый минт (инструмент будет создан на нём)…", 8000);
    try {
      const resp = await api.tools.prepMint({ owner: address });
      const r = await handleTxResponse(resp);
      if (r.success && resp.mint) {
        setNewMint(resp.mint);
        flash(`✅ Минт готов: ${shortAddr(resp.mint)}`);
      } else {
        flash(`❌ ${r.error || "минт не вернулся"}`);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    } finally {
      setBusyPrep(false);
    }
  }

  async function doCraft() {
    if (!address) return flash("❌ Connect wallet");
    if (!src) return flash("❌ Выберите инструмент для переплавки");
    if (!targetRk) return flash("❌ Это уже максимальная редкость");
    if (!newMint) return flash("❌ Сначала подготовьте новый минт (шаг 1)");
    
    const requiredMints = ["wood", "stone", "food", "seeds", "water", "potato"];
    for (const res of requiredMints) {
      if (!resMints[res]) return flash(`❌ Минт ${res.toUpperCase()} не найден в конфиге`);
    }
    
    // Проверка баланса
    if (craftQuote) {
      for (const res of requiredMints) {
        const needed = craftQuote[res] || 0;
        if (balances[res] < needed) {
          return flash(`❌ Not enough ${RES_META[res].label}: нужно ${fmtNum(needed)}, есть ${fmtNum(balances[res])}`);
        }
      }
    }

    try {
      flash("Куём…");
      const resp = await api.tools.craft({
        user: address,
        prevMint: src.mint,
        newMint,
        toolType: src.toolType,
        rarity: targetRk,
        woodMint: resMints.wood,
        stoneMint: resMints.stone,
        foodMint: resMints.food,
        seedsMint: resMints.seeds,
        waterMint: resMints.water,
        potatoMint: resMints.potato,
        skrMint: resMints.skr,
      });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Выкован ${RARITY_RU[targetRk]}: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) {
        const q = craftQuote;
        if (q) {
          setCraftReceipt(`Списано: ${fmtNum(q.wood)} 🪵 + ${fmtNum(q.stone)} 🪨 + ${fmtNum(q.food)} 🌾 + ${fmtNum(q.seeds)} 🌱 + ${fmtNum(q.water)} 💧 + ${fmtNum(q.potato)} 🥔`);
        }
        window.dispatchEvent(new CustomEvent("aof:refresh"));
        setNewMint("");
        setSelMint("");
        setTimeout(loadTools, 2500);
      }
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  // Проверка достаточности баланса
  function getBalanceStatus(res: string, needed: number) {
    const have = balances[res] || 0;
    if (have >= needed) return "sufficient";
    if (have > 0) return "partial";
    return "empty";
  }

  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <p className="text-straw text-xs">
        Путь кузнеца: сжигаешь инструмент — куёшь следующий тир. Расход 6 ресурсов растёт с каждой ковкой.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      {/* ШАГ 1: Выбор исходного инструмента */}
      <Card>
        <h3 className="text-parchment font-semibold mb-3">1. Выбери инструмент для переплавки</h3>
        {tools.length === 0 ? (
          <p className="text-straw text-xs text-center py-4">Нет доступных инструментов для улучшения</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {tools.map((t) => {
              const rk = rarityKey(t.rarity);
              const isMax = rk === "legendary";
              const isSelected = t.mint === selMint;
              return (
                <button
                  key={t.mint}
                  onClick={() => setSelMint(t.mint)}
                  disabled={isMax}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    isSelected ? "border-gold bg-gold/10" : "border-straw/10 bg-soil-800/60"
                  } ${isMax ? "opacity-50 cursor-not-allowed" : "active:scale-95"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ArtPlate src={toolPlate(t.toolType, rk)} alt={t.toolType || "Инструмент"} size={40} />
                    <div className="flex-1">
                      <p className="text-parchment text-xs font-medium capitalize">{t.toolType}</p>
                      <p className="text-[10px]" style={{ color: RARITY_META[rk]?.color }}>
                        {RARITY_RU[rk]}
                      </p>
                    </div>
                  </div>
                  {isMax && <p className="text-[10px] text-straw">Макс. редкость</p>}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* ШАГ 2: Подготовка нового минта */}
      {src && (
        <Card>
          <h3 className="text-parchment font-semibold mb-3">
            2. Подготовка нового минта для{" "}
            <span style={{ color: RARITY_META[rarityKey(targetRk)]?.color }}>
              {RARITY_RU[targetRk]}
            </span>
          </h3>
          {newMint ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-sprout-500/10 border border-sprout-500/30">
              <span className="text-2xl">✅</span>
              <div className="flex-1">
                <p className="text-parchment text-xs font-medium">Минт готов</p>
                <p className="text-straw text-[10px]">{shortAddr(newMint)}</p>
              </div>
              <button onClick={() => setNewMint("")} className="text-xs text-straw hover:text-parchment">
                ↺
              </button>
            </div>
          ) : (
            <button
              onClick={prepMint}
              disabled={busyPrep}
              className="w-full py-3 rounded-2xl bg-wheat-600 text-soil-950 font-semibold active:scale-95 transition-transform disabled:opacity-50"
            >
              {busyPrep ? "Готовим..." : "🔨 Подготовить новый минт"}
            </button>
          )}
        </Card>
      )}

      {/* ШАГ 3: Стоимость крафта (6 ресурсов) */}
      {craftQuote && src && newMint && (
        <Card>
          <h3 className="text-parchment font-semibold mb-3">3. Стоимость улучшения</h3>
          <div className="space-y-2">
            {(["wood", "stone", "food", "seeds", "water", "potato"] as const).map((res) => {
              const needed = craftQuote[res] || 0;
              if (needed === 0) return null;
              const status = getBalanceStatus(res, needed);
              const have = balances[res] || 0;
              const pct = needed > 0 ? Math.min(100, (have / needed) * 100) : 0;
              return (
                <div key={res} className="p-3 rounded-xl bg-soil-800/60 border border-straw/10">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{RES_META[res].icon}</span>
                      <span className={`text-xs font-medium ${RES_META[res].color}`}>
                        {RES_META[res].label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-parchment text-xs font-bold">
                        {fmtNum(needed)}
                      </span>
                      <span className="text-straw text-[10px] ml-1">
                        / {fmtNum(have)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-soil-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className={`h-full rounded-full ${
                        status === "sufficient" ? "bg-sprout-500" :
                        status === "partial" ? "bg-wheat-500" :
                        "bg-red-500"
                      }`}
                    />
                  </div>
                  {status !== "sufficient" && (
                    <p className="text-[10px] text-red-400 mt-1">
                      ⚠️ Not enough {RES_META[res].label}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* SKR discount is intentionally not displayed as active: no
              canonical SKR mint is configured on-chain, so craft charges the
              full POTATO amount. */}
          <div className="p-3 rounded-xl bg-soil-800/60 border border-straw/10">
            <p className="text-straw text-[10px]">
              SKR-скидка отключена: канонический mint SKR ещё не настроен в контракте.
              Крафт списывает полную стоимость POTATO.
            </p>
          </div>
          
          {/* Кнопка крафта */}
          <button
            onClick={doCraft}
            disabled={!newMint || craftQuote && ["wood","stone","food","seeds","water","potato"].some(r => (balances[r]||0) < (craftQuote[r]||0))}
            className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-gold to-wheat-600 text-soil-950 font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⚒️ Выковать {RARITY_RU[targetRk]}
          </button>

          {craftReceipt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 p-3 rounded-xl bg-sprout-500/10 border border-sprout-500/30 text-xs text-parchment"
            >
              <p className="font-semibold mb-1">✅ Последний крафт:</p>
              <p className="text-straw">{craftReceipt}</p>
            </motion.div>
          )}
        </Card>
      )}
    </div>
  );
}
