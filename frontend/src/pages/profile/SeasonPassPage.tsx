import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { fmtNum, useTreasury, useFlash } from "../../lib/marketUtils";

const SEASON_ID = 1;
const PASS_PRICE_SOL = 0.15;

const PREMIUM_PERKS = [
  { icon: "🤖", label: "Farm-Trader", sub: "умная покупка/продажа 24/7" },
  { icon: "⚡", label: "Награды без рекламы", sub: "в заданиях и партнёрках" },
  { icon: "📈", label: "XP-бустеры", sub: "ускорение сезонного трека" },
  { icon: "🔔", label: "Ценовые алерты без лимитов", sub: "free-тир: только 1 алерт" },
];

export function SeasonPassPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const [pass, setPass] = useState<any>(null);
  const [txStatus, flash] = useFlash();

  const load = useCallback(() => {
    if (!address) return;
    api.query.seasonPass(address, String(SEASON_ID))
      .then((p: any) => setPass(p))
      .catch(() => setPass(null));
  }, [address]);

  useEffect(() => { load(); }, [load]);

  async function buy() {
    if (!address) return flash("❌ Connect wallet (кнопка вверху)");
    if (!treasury) return flash("❌ Treasury config unavailable");
    try {
      flash("Готовим покупку пасса…");
      const resp = await api.season.passPurchase({ user: address, seasonId: SEASON_ID, treasury });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Premium активирован: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`❌ ${e.message}`);
    }
  }

  const premium = Boolean(pass?.premiumTrack ?? pass?.premium_track ?? pass?.premium);

  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <p className="text-straw text-xs">
        VIP-статус — это премиум-трек сезонного пасса: автоматизация торговли, награды без рекламы и бусты.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          {txStatus}
        </motion.div>
      )}

      <Card className="bg-gradient-to-r from-wheat-600/20 to-soil-850 border border-wheat-600/30">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🎫</span>
          <div className="flex-1">
            <h2 className="text-parchment font-bold text-lg">Сезон {SEASON_ID} · Premium</h2>
            <p className="text-straw text-xs">Пасс действует до конца сезона</p>
          </div>
          {premium && <span className="text-xs px-3 py-1 rounded-full bg-gold text-soil-950 font-bold">VIP</span>}
        </div>
      </Card>

      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Что даёт Premium</div>
        <div className="space-y-2">
          {PREMIUM_PERKS.map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10">
              <span className="text-xl">{p.icon}</span>
              <div>
                <p className="text-parchment text-sm font-medium">{p.label}</p>
                <p className="text-straw text-xs">{p.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {pass && (
        <Card>
          <div className="text-parchment font-semibold text-sm mb-2">Ваш прогресс сезона</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(pass).filter(([k]) => !["bump"].includes(k)).map(([k, v]) => (
              <div key={k} className="px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10">
                <p className="text-straw text-xs">{k}</p>
                <p className="text-parchment text-sm font-medium break-all">
                  {typeof v === "boolean" ? (v ? "да" : "нет") : fmtNum(v)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!premium ? (
        <button onClick={buy} disabled={!address || !treasury}
          className="w-full py-3.5 rounded-2xl bg-gold text-soil-950 font-bold text-sm disabled:opacity-40">
          Buy Premium за {PASS_PRICE_SOL} ◎
        </button>
      ) : (
        <p className="text-center text-straw text-xs">Premium активен до конца сезона 🌟</p>
      )}
    </div>
  );
}
