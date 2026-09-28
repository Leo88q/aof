import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { UI_ICONS, resourceIcon } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";
import { fmtNum, useTreasury, useFlash } from "../../lib/marketUtils";
import { NoticeMsg } from "../../components/visual/NoticeMsg";
import { useVipStatus } from "../../lib/useVipStatus";

const SEASON_ID = 1;
const PASS_PRICE_SOL = 0.15;

/**
 * Список привилегий — из ответа сети (/season/:user), а не из макета.
 *
 * Дефект 2026-09-28: карточка обещала «XP-бустеры» и «умную покупку 24/7»,
 * которых нет ни в ответе сервиса, ни в инструкциях aof-core. Плюс прогресс
 * печатал имена полей аккаунта как есть — теперь у каждого поля своя подпись.
 */
const PERK_ROWS: Array<{ key: string; icon: string; label: string; value: (p: any) => string | null }> = [
  {
    key: "farmTrader",
    icon: UI_ICONS.npcOracle,
    label: "Авто-трейдер",
    value: (p) => (p?.farmTrader?.enabled
      ? `До ${p.farmTrader.maxRules} правил и ${p.farmTrader.maxSpendPerDaySol} SOL в день`
      : null),
  },
  {
    key: "priceAlerts",
    icon: UI_ICONS.buffIdea,
    label: "Ценовые алерты",
    value: (p) => (p?.priceAlerts?.limit ? `Лимит ${p.priceAlerts.limit} против одной бесплатной` : null),
  },
  {
    key: "skipAdsInQuests",
    icon: resourceIcon("power") || "",
    label: "Награды без рекламных вставок",
    value: (p) => (p?.skipAdsInQuests ? "В заданиях и партнёрских предложениях" : null),
  },
  {
    key: "feeDiscountPct",
    icon: UI_ICONS.chartsUp,
    label: "Скидка на комиссии",
    value: (p) => (p?.feeDiscountPct ? `${p.feeDiscountPct}% на торговые операции` : null),
  },
];

const PASS_FIELDS: Record<string, string> = {
  seasonId: "Эпоха",
  level: "Ступень",
  xp: "Опыт",
  premium: "Premium-ветка",
  premiumTrack: "Premium-ветка",
  claimedLevels: "Награды получены",
  bump: "—",
};

export function SeasonPassPage() {
  const { address } = useWalletStore();
  const treasury = useTreasury();
  const { vipPrivileges } = useVipStatus(SEASON_ID);
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
    if (!address) return flash("❌ Подключите кошелёк — кнопка в шапке");
    if (!treasury) return flash("Адрес казны не настроен: действие недоступно");
    try {
      flash("Готовим покупку пасса…");
      const resp = await api.season.passPurchase({ user: address, seasonId: SEASON_ID, treasury });
      const r = await handleTxResponse(resp);
      flash(r.success ? `✅ Premium активирован: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
      if (r.success) setTimeout(load, 2500);
    } catch (e: any) {
      flash(`${e.message}`);
    }
  }

  const premium = Boolean(pass?.premiumTrack ?? pass?.premium_track ?? pass?.premium);

  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <p className="text-straw text-xs">
        Premium-ветка пропуска эпохи открывает сервисы лаборатории: авто-трейдер, алерты без лимита
        и награды без рекламных вставок. Список читается у сети, а не из макета.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      <Card className="bg-gradient-to-r from-wheat-600/20 to-soil-850 border border-wheat-600/30">
        <div className="flex items-center gap-3">
          <img src={UI_ICONS.seasonPass} alt="" className="w-12 h-12 object-contain" />
          <div className="flex-1">
            <h2 className="text-parchment font-bold text-lg">Эпоха {SEASON_ID} · Premium</h2>
            <p className="text-straw text-xs">Пасс действует до конца эпохи</p>
          </div>
          {premium && <span className="text-xs px-3 py-1 rounded-full bg-gold text-soil-950 font-bold">VIP</span>}
        </div>
      </Card>

      <Card>
        <div className="text-parchment font-semibold text-sm mb-2">Что даёт Premium</div>
        <div className="space-y-2">
          {PERK_ROWS.map((perk, i) => {
            const note = perk.value(vipPrivileges);
            return (
              <motion.div key={perk.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10">
                <ResourceGlyph icon={perk.icon} alt="" className="w-6 h-6" />
                <div>
                  <p className="text-parchment text-sm font-medium">{perk.label}</p>
                  <p className="text-straw text-xs">{note ?? "Открывается с пропуском"}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {pass && (
        <Card>
          <div className="text-parchment font-semibold text-sm mb-2">Ваш прогресс эпохи</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(pass).filter(([k]) => PASS_FIELDS[k]).map(([k, v]) => (
              <div key={k} className="px-3 py-2 rounded-xl bg-soil-800/70 border border-straw/10">
                <p className="text-straw text-xs">{PASS_FIELDS[k]}</p>
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
          Активировать Premium за {PASS_PRICE_SOL} SOL
        </button>
      ) : (
        <p className="text-center text-straw text-xs">Premium активен до конца эпохи</p>
      )}
    </div>
  );
}
