import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { useWalletStore } from "../../store/walletStore";
import { Card } from "../../components/ui/Card";
import { RARITY_META, rarityKey } from "../../lib/toolMeta";
import { UI_ICONS, toolPlate } from "../../lib/visualAssets";
import { fmtSol, useFlash } from "../../lib/marketUtils";
import type { PackOpenIntent } from "../../lib/transactionIntent";
import { humanizeVrfError } from "../../lib/vrfErrors";
import { NoticeMsg } from "../../components/visual/NoticeMsg";

/**
 * [F-06] Capsule openings settled by Switchboard On-Demand.
 *
 * 1. commit  — one wallet signature: the price is escrowed on-chain, the odds
 *    are snapshotted and a Switchboard randomness account owned by the game
 *    program is committed in the same transaction (the operator co-signs as
 *    the backend gate; the wallet guard checks type and price ceiling).
 * 2. settle  — the settler service reveals within seconds. If it does not,
 *    the player can settle it personally ("Раскрыть самостоятельно"): the
 *    reveal is permissionless and the oracle signature is verified on-chain.
 * 3. refund  — if the oracle never answers inside the ~2 h window, the same
 *    button returns the price (settlement and refund are never both open).
 */
const PACKS = [
  { id: "small", index: 0, title: "Малая капсула" },
  { id: "medium", index: 1, title: "Средняя капсула" },
  { id: "big", index: 2, title: "Большая капсула" },
] as const;
const RARITY_RU = ["Базовый", "Усиленный", "Квантовый", "Сингулярность", "Трансцендентный"];
const TOOL_RU: Record<string, string> = {
  plasma_cutter: "Плазменный резак",
  silicon_extractor: "Экстрактор кремния",
  data_harvester: "Сборщик данных",
};
const SELF_SETTLE_AFTER_MS = 25_000;

type PackConfig = { packType: string; priceLamports: string; oddsBps: number[] };
type Opening = { packCommit: string; startedAt: number; state: "pending" | "settled" | "refunded"; tool?: { toolType: string; rarity: string } };
type Pending = { mechanic: string; commit: string; phase: "revealable" | "refundable"; ageSlots: number };

export function PacksPage() {
  const { address } = useWalletStore();
  const [configs, setConfigs] = useState<Record<string, PackConfig>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [now, setNow] = useState(Date.now());
  const [txStatus, flash] = useFlash();
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.packs.configs()
      .then((r: any) => setConfigs(Object.fromEntries((r?.packs || []).map((p: PackConfig) => [p.packType, p]))))
      .catch(() => setConfigs({}));
  }, []);

  const loadPending = useCallback(() => {
    if (!address) return setPending([]);
    api.vrf.pending(address)
      .then((r: any) => setPending((r?.pending || []).filter((p: Pending) => p.mechanic === "pack")))
      .catch(() => setPending([]));
  }, [address]);

  useEffect(() => { loadPending(); }, [loadPending]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); if (poll.current) clearInterval(poll.current); };
  }, []);

  function watch(packCommit: string) {
    if (poll.current) clearInterval(poll.current);
    const startedAt = Date.now();
    setOpening({ packCommit, startedAt, state: "pending" });
    poll.current = setInterval(async () => {
      try {
        const s: any = await api.packs.status(packCommit);
        if (s?.state === "settled" || s?.state === "refunded") {
          if (poll.current) clearInterval(poll.current);
          setOpening({ packCommit, startedAt, state: s.state, tool: s.tool });
          loadPending();
        }
      } catch {
        /* keep polling: the RPC may lag the confirmation */
      }
    }, 2_000);
  }

  async function open(pack: (typeof PACKS)[number]) {
    if (!address) return flash("❌ Подключите кошелёк");
    const cfg = configs[pack.id];
    if (!cfg) return flash("❌ Капсула ещё не настроена on-chain");
    setBusy(pack.id);
    try {
      flash("Готовим транзакцию: оплата в escrow + Switchboard commit…", 8000);
      const intent: PackOpenIntent = { kind: "packOpen", user: address, packType: pack.index, maxPriceLamports: cfg.priceLamports };
      const resp: any = await api.packs.commit({ user: address, packType: pack.id, maxPriceLamports: cfg.priceLamports });
      const r = await handleTxResponse(resp, intent);
      if (!r.success) throw new Error(r.error || "Транзакция не выполнена");
      flash("✅ Оплачено. Оракул Switchboard раскрывает результат…", 8000);
      watch(resp.packCommit);
    } catch (e: any) {
      flash(`❌ ${humanizeVrfError(String(e?.message || e))}`, 8000);
    } finally {
      setBusy(null);
    }
  }

  async function selfSettle(packCommit: string) {
    if (!address) return flash("❌ Подключите кошелёк");
    setBusy(packCommit);
    try {
      const resp: any = await api.packs.reveal({ user: address, packCommit });
      const r = await handleTxResponse(resp);
      if (!r.success) throw new Error(r.error || "Транзакция не выполнена");
      flash(resp.phase === "refundable" ? "✅ Возврат отправлен" : "✅ Результат раскрыт вашей транзакцией", 6000);
      watch(packCommit);
    } catch (e: any) {
      flash(`❌ ${humanizeVrfError(String(e?.message || e))}`, 8000);
    } finally {
      setBusy(null);
    }
  }

  const waitingMs = opening?.state === "pending" ? now - opening.startedAt : 0;

  return (
    <div className="p-4 pt-6 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-parchment flex items-center gap-2">
        <img src={UI_ICONS.packs} alt="" className="w-7 h-7 object-contain" /> Капсулы дропа
      </h1>
      <p className="text-straw text-xs">
        Исход определяет оракул Switchboard On-Demand: аккаунт случайности принадлежит самой игровой программе,
        поэтому ни игра, ни игрок не могут перебросить или скрыть результат. Раскрыть его может любой — сервер,
        вы сами или третья сторона; цена уходит в казну только после раскрытия, а если оракул не ответит, её вернут.
      </p>

      {txStatus && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs px-3 py-2 rounded-xl bg-soil-800 border border-straw/20 text-parchment">
          <NoticeMsg text={txStatus} />
        </motion.div>
      )}

      {opening && (
        <Card className="text-center py-5">
          {opening.state === "pending" && (
            <>
              <motion.img src={UI_ICONS.packs} alt="" className="w-16 h-16 mx-auto object-contain"
                animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.2 }} />
              <p className="text-parchment font-semibold mt-3">Ждём раскрытия оракула… {Math.floor(waitingMs / 1000)} с</p>
              {waitingMs > SELF_SETTLE_AFTER_MS && (
                <button onClick={() => selfSettle(opening.packCommit)} disabled={busy === opening.packCommit}
                  className="mt-3 px-4 py-2 rounded-xl bg-wheat-600 text-white text-sm font-semibold disabled:opacity-50">
                  Раскрыть самостоятельно
                </button>
              )}
            </>
          )}
          {opening.state === "settled" && opening.tool && (
            <>
              <img src={toolPlate(opening.tool.toolType, rarityKey(opening.tool.rarity)) || UI_ICONS.packs} alt=""
                className="w-20 h-20 mx-auto object-contain rounded-xl" />
              <p className="font-bold mt-3" style={{ color: RARITY_META[rarityKey(opening.tool.rarity)]?.color }}>
                {RARITY_RU[["common", "uncommon", "rare", "epic", "legendary"].indexOf(rarityKey(opening.tool.rarity))] || opening.tool.rarity}
              </p>
              <p className="text-parchment text-sm">{TOOL_RU[opening.tool.toolType] || opening.tool.toolType}</p>
            </>
          )}
          {opening.state === "refunded" && <p className="text-parchment text-sm">Оракул не ответил вовремя — цена возвращена.</p>}
        </Card>
      )}

      <div className="grid gap-3">
        {PACKS.map((pack) => {
          const cfg = configs[pack.id];
          return (
            <Card key={pack.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-parchment font-bold">{pack.title}</p>
                  <p className="text-straw text-xs">{cfg ? `${fmtSol(cfg.priceLamports)} ◎` : "не настроена"}</p>
                </div>
                <button onClick={() => open(pack)} disabled={!cfg || !address || busy !== null}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-wheat-600 text-white text-sm font-bold disabled:opacity-40">
                  {busy === pack.id ? "…" : "Открыть"}
                </button>
              </div>
              {cfg && (
                <div className="grid grid-cols-4 gap-1 mt-3 text-center text-[11px]">
                  {cfg.oddsBps.slice(0, 4).map((bps, i) => (
                    <div key={i} className="rounded-lg bg-soil-800/60 py-1">
                      <p className="text-straw">{RARITY_RU[i]}</p>
                      <p className="text-parchment font-semibold">{(bps / 100).toLocaleString("ru-RU")}%</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {pending.length > 0 && (
        <Card>
          <p className="text-parchment font-semibold text-sm mb-2">Незавершённые открытия</p>
          {pending.map((p) => (
            <div key={p.commit} className="flex items-center justify-between text-xs py-1">
              <span className="text-straw">{p.commit.slice(0, 8)}… · {p.phase === "refundable" ? "можно вернуть" : `ждёт ${p.ageSlots} слотов`}</span>
              <button onClick={() => selfSettle(p.commit)} disabled={busy === p.commit}
                className="px-3 py-1 rounded-lg bg-soil-800 border border-straw/20 text-parchment disabled:opacity-40">
                {p.phase === "refundable" ? "Вернуть" : "Раскрыть"}
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
