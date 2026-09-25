import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { Card } from "../../components/ui/Card";
import { NavHeader } from "../../components/NavHeader";
import { useWalletStr } from "../../lib/useWalletStr";
import { UI_ICONS } from "../../lib/visualAssets";


function normalizeLetter(item: any, i: number) {
  const hasReward = Boolean(item.rewardType);
  return {
    id: item.id ?? i,
    dbId: item.id,
    sender: item.sender || "—",
    subject: item.subject || "",
    body: item.body || "",
    reward: hasReward ? `${item.rewardAmount ?? ""} ${item.rewardType}` : null,
    rewardType: item.rewardType,
    read: Boolean(item.read),
    claimed: Boolean(item.claimed),
    hasReward,
    createdAt: item.createdAt,
  };
}

export function InboxHome() {
  const user = useWalletStr();
  const [letters, setLetters] = useState<any[]>([]);
  const [opened, setOpened] = useState<any>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const load = () => {
    if (!user) { setLetters([]); return; }
    api.inbox.list(user)
      .then((items: any) => {
        const arr = Array.isArray(items) ? items : items?.items || [];
        setLetters(arr.map(normalizeLetter));
      })
      .catch(() => setLetters([]));
  };

  useEffect(() => { load(); }, [user]);

  function openLetter(letter: any) {
    setOpened(letter);
    setLetters((ls) => ls.map((l) => (l.id === letter.id ? { ...l, read: true } : l)));
    if (letter.dbId) api.inbox.read({ id: letter.dbId, user }).catch(() => {});
  }

  async function claimReward(letter: any) {
    if (!letter?.dbId || !user) return;
    try {
      setClaimStatus("Готовим клейм награды…");
      let mints: any = undefined;
      try {
        const [cfgRaw, registry] = await Promise.all([
          api.query.config(),
          api.query.materialMints(),
        ]);
        const cfg = cfgRaw?.config || cfgRaw;
        const byType: Record<string, string | undefined> = {
          FOOD: cfg?.foodMint, WOOD: cfg?.woodMint, STONE: cfg?.stoneMint,
          POTATO: cfg?.potatoMint,
          ...(registry?.mints || {}),
        };
        const rewardMint = byType[letter.rewardType];
        if (rewardMint) mints = { rewardMint };
      } catch {}
      const res: any = await api.inbox.claim({ id: letter.dbId, user, mints });
      if (res?.pending) {
        setClaimStatus("⏳ Награда отложена — попробуй заклеймить позже");
      } else {
        const r = await handleTxResponse(res);
        setClaimStatus(r.success ? `✅ Награда получена: ${r.signature?.slice(0, 10)}…` : `❌ ${r.error}`);
        if (r.success) {
          setLetters((ls) => ls.map((l) => (l.id === letter.id ? { ...l, claimed: true } : l)));
        }
      }
    } catch (e: any) {
      setClaimStatus(`❌ ${e.message}`);
    }
  }

  const unread = letters.filter((l) => !l.read).length;

  return (
    <div className="p-4 pt-2 pb-24">
      <NavHeader title="Сообщения" tabKey="farm" />

      <div className="flex justify-center items-center mb-4 mt-2">
        {unread > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-wheat-600 text-white font-bold">
            {unread} непрочит.
          </span>
        )}
      </div>

      <p className="text-straw text-xs mb-4">
        Компенсации, награды за задания, события — всё, что игра хочет тебе сказать.
      </p>

      <div className="space-y-2">
        {letters.map((l, i) => (
          <motion.button key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => openLetter(l)}
            className={`w-full text-left rounded-2xl p-3 border ${l.read ? "bg-soil-850/50 border-straw/10" : "bg-soil-800 border-wheat-600/30"} active:scale-[0.99]`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${l.hasReward ? "bg-gold/20" : "bg-soil-700"}`}>
                <img src={l.hasReward ? UI_ICONS.inboxReward : UI_ICONS.inbox} alt="" className="w-7 h-7 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-parchment text-sm font-semibold truncate">{l.sender}</span>
                  {!l.read && <span className="w-2 h-2 rounded-full bg-wheat-500" />}
                </div>
                <p className="text-straw text-xs truncate">{l.subject}</p>
              </div>
              <span className="text-straw text-xs">›</span>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Центральная модалка (по ТЗ: по центру экрана, не bottom-sheet) */}
      <AnimatePresence>
        {opened && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setOpened(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-soil-850 rounded-3xl p-6 max-w-md w-full border border-wheat-600/30 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <img src={opened.hasReward ? UI_ICONS.inboxReward : UI_ICONS.inbox} alt="" className="w-10 h-10 object-contain" />
                <button onClick={() => setOpened(null)} className="w-8 h-8 rounded-full bg-soil-800 flex items-center justify-center text-straw">✕</button>
              </div>

              <p className="text-straw text-xs">{opened.sender}</p>
              <h3 className="text-parchment font-bold text-lg mt-1">{opened.subject}</h3>
              <p className="text-parchment text-sm mt-3 leading-relaxed">{opened.body}</p>

              {opened.hasReward && (
                <div className="mt-4 p-3 rounded-xl bg-gold/10 border border-gold/30">
                  <p className="text-straw text-xs">Награда</p>
                  <p className="text-gold font-bold text-lg flex items-center gap-2">
                    <img src={UI_ICONS.inboxReward} alt="" className="w-5 h-5 object-contain" />
                    {opened.reward}
                  </p>
                </div>
              )}

              {claimStatus && <p className="text-xs text-parchment mt-3 text-center">{claimStatus}</p>}

              {opened.hasReward && !opened.claimed && (
                <button onClick={() => claimReward(opened)}
                  className="w-full mt-4 py-3 rounded-2xl bg-gold text-soil-950 font-bold text-sm active:scale-95 transition-transform">
                  Забрать награду
                </button>
              )}
              {opened.claimed && (
                <p className="w-full mt-4 py-3 rounded-2xl bg-soil-800 text-straw text-sm text-center">
                  ✅ Награда получена
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
