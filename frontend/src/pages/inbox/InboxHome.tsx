import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import { handleTxResponse } from "../../lib/txFlow";
import { PublicKey } from "@solana/web3.js";
import { formatLamportsAsSol } from "../../lib/formatLamports";
import { validatePayerQuoteForIntent, type RewardClaimIntent } from "../../lib/transactionIntent";
import { useLocale } from "../../i18n/LocaleProvider";
import { inboxReadCopy, inboxUiCopy } from "../../i18n/inboxReadCopy";
import { farmOverviewCopy } from "../../i18n/farmOverviewCopy";
import { Card } from "../../components/ui/Card";
import { NavHeader } from "../../components/NavHeader";
import { useWalletStr } from "../../lib/useWalletStr";
import { UI_ICONS } from "../../lib/visualAssets";
import { Panel, Readout, Readouts, Sticker, Note } from "../../ui/forge/kit";
import { CrossPanel, type CrossLink } from "../../ui/forge/devices";


type PreparedInboxClaim = {
  user: string;
  letterId: string;
  response: any;
  intent: RewardClaimIntent;
};

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
    // A reserved/quarantined claim is not a confirmed reward.
    claimed: item.claimed === true && item.claimState === 'confirmed',
    hasReward,
    createdAt: item.createdAt,
  };
}

export function InboxHome() {
  const user = useWalletStr();
  const { language } = useLocale();
  const readCopy = inboxReadCopy[language];
  const copy = inboxUiCopy[language];
  const ownerRef = useRef(user);
  ownerRef.current = user;
  const [letters, setLetters] = useState<any[]>([]);
  const [opened, setOpened] = useState<any>(null);
  const [claimStatus, setClaimStatus] = useState<'preparing' | 'pending' | 'confirmed' | 'unknown' | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [preparedClaim, setPreparedClaim] = useState<PreparedInboxClaim | null>(null);
  const [readState, setReadState] = useState<{ owner: string; kind: 'loading' | 'ready' | 'error' } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLetters([]);
    setOpened(null);
    setClaimStatus(null);
    setPreparedClaim(null);
    if (!user) { setReadState(null); return () => { active = false; }; }
    setReadState({ owner: user, kind: 'loading' });
    api.inbox.list(user)
      .then((data: unknown) => {
        if (!active) return;
        if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) {
          throw new Error('Incomplete inbox response');
        }
        setLetters(data.items.map(normalizeLetter));
        setReadState({ owner: user, kind: 'ready' });
      })
      .catch(() => { if (active) { setLetters([]); setReadState({ owner: user, kind: 'error' }); } });
    return () => { active = false; };
  }, [user, retry]);

  const state = !user ? 'disconnected' : readState?.owner === user ? readState.kind : 'loading';

  function openLetter(letter: any) {
    setOpened(letter);
    setPreparedClaim(current => current?.user === user && current?.letterId === letter.dbId ? current : null);
    setClaimStatus(null);
    if (letter.dbId && user) api.inbox.read({ id: letter.dbId, user })
      .then((data: any) => {
        const item = data?.item;
        if (ownerRef.current === user && item?.id === letter.dbId && item?.user === user && item?.read === true) {
          setLetters((ls) => ls.map((l) => l.id === letter.id ? { ...l, read: true } : l));
        }
      }).catch(() => { /* The message remains unread if confirmation fails. */ });
  }

  function markClaimed(letter: any) {
    setPreparedClaim(current => current?.letterId === letter.dbId ? null : current);
    setClaimStatus('confirmed');
    setLetters(ls => ls.map(l => l.id === letter.id ? { ...l, claimed: true, read: true } : l));
    setOpened((current: any) => current?.id === letter.id ? { ...current, claimed: true } : current);
  }

  async function prepareRewardClaim(letter: any) {
    if (!letter?.dbId || !user || claimBusy) return;
    setClaimBusy(true);
    setClaimStatus('preparing');
    setPreparedClaim(null);
    try {
      // [PAYER] The player's wallet pays Player/RewardReceipt rent and the
      // network fee. The authority only authorizes the reward; it does not pay.
      // Preparation returns the exact transaction and its bounded payer quote.
      const res: any = await api.inbox.claim({ id: letter.dbId, user });
      if (ownerRef.current !== user) return;
      if (res?.pending) {
        setClaimStatus('pending');
        return;
      }
      if (res?.item?.id === letter.dbId && res.item.user === user && res.item.claimed === true &&
          (res.item.claimState === 'confirmed' || typeof res.recoveredFromReceipt === 'string')) {
        markClaimed(letter);
        return;
      }
      if (!res?.tx || !res?.quote || !res?.payerQuote) {
        setClaimStatus('unknown');
        return;
      }
      const intent: RewardClaimIntent = {
        kind: 'rewardClaim',
        user,
        mint: res.quote.mint,
        resourceKind: res.quote.resourceKind,
        amountAtoms: res.quote.amount,
        treasury: res.quote.treasury,
        rewardId: res.quote.rewardId,
        quote: res.payerQuote,
      };
      validatePayerQuoteForIntent(intent, new PublicKey(user));
      if (ownerRef.current !== user) return;
      setPreparedClaim({ user, letterId: letter.dbId, response: res, intent });
      setClaimStatus(null);
    } catch {
      if (ownerRef.current === user) setClaimStatus('unknown');
    } finally {
      setClaimBusy(false);
    }
  }

  async function confirmRewardClaim(letter: any) {
    const prepared = preparedClaim;
    if (!letter?.dbId || !user || claimBusy) return;
    if (!prepared || prepared.user !== user || prepared.letterId !== letter.dbId) {
      await prepareRewardClaim(letter);
      return;
    }
    setClaimBusy(true);
    setClaimStatus('preparing');
    try {
      // The quote is shown before this explicit confirmation. txGuard validates
      // the same quote against the exact transaction before requesting a wallet signature.
      const sent = await handleTxResponse(prepared.response, prepared.intent);
      if (ownerRef.current !== user) return;
      if (!sent.signature) {
        setClaimStatus('unknown');
        return;
      }
      // A signature means the transaction may already have landed, even if
      // confirmation timed out. Do not offer the same prepared transaction again.
      setPreparedClaim(null);
      setClaimStatus('pending');
      const confirmed: any = await api.inbox.confirmClaim({ id: letter.dbId, user, signature: sent.signature });
      if (ownerRef.current !== user) return;
      if (confirmed?.item?.id === letter.dbId && confirmed.item.user === user &&
          (confirmed.item.claimState === 'confirmed' || typeof confirmed.onchainSig === 'string')) {
        markClaimed(letter);
      } else {
        setClaimStatus('pending');
      }
    } catch {
      if (ownerRef.current === user) setClaimStatus('unknown');
    } finally {
      setClaimBusy(false);
    }
  }

  async function claimReward(letter: any) {
    const prepared = preparedClaim;
    if (prepared?.user === user && prepared?.letterId === letter?.dbId) {
      await confirmRewardClaim(letter);
    } else {
      await prepareRewardClaim(letter);
    }
  }

  const unread = letters.filter((l) => !l.read).length;
  const format = (n: number) => n.toLocaleString(language);
  const visiblePreparedClaim = preparedClaim?.user === user && preparedClaim?.letterId === opened?.dbId
    ? preparedClaim : null;

  if (state !== 'ready') return (
    <div lang={language} className="p-4 pt-2 pb-24 min-w-0">
      <NavHeader title={farmOverviewCopy[language].inbox} tabKey="farm" />
      <p role={state === 'error' ? 'alert' : 'status'} className="text-straw text-sm mt-4 break-words">
        {state === 'disconnected' ? readCopy.connect : state === 'loading' ? readCopy.loading : readCopy.unavailable}
      </p>
      {state === 'error' && <button type="button" onClick={() => setRetry(n => n + 1)}
        className="mt-3 rounded-xl bg-soil-700 px-4 py-2 text-parchment text-sm">{readCopy.retry}</button>}
    </div>
  );

  return (
    <div lang={language} className="p-4 pt-2 pb-24 min-w-0">
      <NavHeader title={farmOverviewCopy[language].inbox} tabKey="farm" />

      <div className="flex justify-center items-center mb-4 mt-2">
        {unread > 0 && (
          <span className="max-w-full break-words text-xs px-2.5 py-1 rounded-full bg-accent-600 text-white font-bold">
            {copy.unreadCount(format(unread))}
          </span>
        )}
      </div>

      <p className="text-straw text-xs mb-4 break-words">
        {copy.intro}
      </p>

      {/* К9 · кросс-панель АТС: каждый порт сверху — письмо, снизу — состояние.
          Патч-корд показывает, куда письмо подключено: ждёт выдачи, ждёт
          прочтения или уже получено. Список — реальный /inbox/list, порядок
          писем не переставляется, номера портов честные. */}
      <Panel
        tier="panel"
        device="cross"
        className="mb-4"
        id={<Sticker>{copy.sticker}</Sticker>}
        meta={copy.ports(format(letters.length))}
        title={copy.panelTitle}
        sub={copy.panelSub}
      >
        {letters.length > 0 ? (
          <CrossPanel
            ariaLabel={copy.panelTitle}
            top={letters.slice(0, 6).map((l) => ({ label: l.sender, lamp: l.read ? "idle" : "ok" }))}
            bottom={[
              { label: copy.waiting },
              { label: copy.read },
              { label: copy.fresh },
            ]}
            links={letters.slice(0, 6).map((l, i): CrossLink => ({
              from: i,
              to: l.claimed ? 1 : l.hasReward ? 0 : l.read ? 1 : 2,
              cord: ((i % 4) + 1) as 1 | 2 | 3 | 4,
              pulse: !l.read,
            }))}
          />
        ) : (
          <Note quiet>{copy.empty}</Note>
        )}
        <div style={{ marginTop: 14 }}>
          <Readouts>
            <Readout label={copy.letters} value={format(letters.length)} hint={copy.inBox} />
            <Readout label={copy.unread} value={format(unread)} hint={copy.lamps} />
            <Readout label={copy.rewardLetters} value={format(letters.filter((l) => l.hasReward).length)} hint={copy.includeReward} />
          </Readouts>
        </div>
      </Panel>

      <div className="space-y-2">
        {letters.map((l, i) => (
          <motion.button key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => openLetter(l)}
            className={`w-full text-left rounded-2xl p-3 border ${l.read ? "bg-soil-850/50 border-straw/10" : "bg-soil-800 border-accent-600/30"} active:scale-[0.99]`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${l.hasReward ? "bg-gold/20" : "bg-soil-700"}`}>
                <img src={l.hasReward ? UI_ICONS.inboxReward : UI_ICONS.inbox} alt="" className="w-7 h-7 object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-parchment text-sm font-semibold truncate">{l.sender}</span>
                  {!l.read && <span className="w-2 h-2 rounded-full bg-accent-500" />}
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
              className="bg-soil-850 rounded-3xl p-4 sm:p-6 max-w-md w-full min-w-0 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain border border-accent-600/30 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <img src={opened.hasReward ? UI_ICONS.inboxReward : UI_ICONS.inbox} alt="" className="w-10 h-10 object-contain" />
                <button onClick={() => setOpened(null)} type="button" aria-label={copy.close} className="w-8 h-8 rounded-full bg-soil-800 flex items-center justify-center text-straw">✕</button>
              </div>

              <p className="text-straw text-xs break-words">{opened.sender}</p>
              <h3 className="text-parchment font-bold text-lg mt-1 break-words">{opened.subject}</h3>
              <p className="text-parchment text-sm mt-3 leading-relaxed whitespace-pre-wrap break-words">{opened.body}</p>
              <p className="text-straw text-xs mt-2 break-words">{copy.original}</p>

              {opened.hasReward && (
                <div className="mt-4 p-3 rounded-xl bg-gold/10 border border-gold/30">
                  <p className="text-straw text-xs">{copy.reward}</p>
                  <p className="text-gold font-bold text-lg flex flex-wrap items-center gap-2 break-words min-w-0">
                    <img src={UI_ICONS.inboxReward} alt="" className="w-5 h-5 object-contain" />
                    {opened.reward}
                  </p>
                </div>
              )}

              {visiblePreparedClaim && (() => {
                const quote = visiblePreparedClaim.intent.quote;
                return (
                  <div className="mt-4 p-3 rounded-xl bg-soil-800 border border-gold/30 text-xs text-parchment space-y-1 break-words"
                    role="group" aria-labelledby="inbox-claim-quote-title">
                    <p id="inbox-claim-quote-title" className="font-bold text-gold">{copy.quoteTitle}</p>
                    <p className="text-straw">{copy.quoteReview}</p>
                    <p>{copy.quoteRent(formatLamportsAsSol(quote.rentLamports, language), quote.rentLamports)}</p>
                    <p>{copy.quoteFee(formatLamportsAsSol(quote.networkFeeLamports, language), quote.networkFeeLamports)}</p>
                    <p className="font-semibold">{copy.quoteMax(formatLamportsAsSol(quote.maxCostLamports, language), quote.maxCostLamports)}</p>
                  </div>
                );
              })()}

              {claimStatus && <p role="status" className="text-xs text-parchment mt-3 text-center break-words">{readCopy[claimStatus]}</p>}

              {opened.hasReward && !opened.claimed && (
                <>
                  <button onClick={() => claimReward(opened)}
                    disabled={claimBusy}
                    className="w-full mt-4 py-3 px-2 rounded-2xl whitespace-normal break-words disabled:opacity-50 bg-gold text-soil-950 font-bold text-sm active:scale-95 transition-transform">
                    {claimBusy ? readCopy.preparing : visiblePreparedClaim ? copy.confirmClaim : copy.claim}
                  </button>
                  {visiblePreparedClaim && <button type="button" onClick={() => prepareRewardClaim(opened)} disabled={claimBusy}
                    className="w-full mt-2 py-2 px-2 rounded-2xl whitespace-normal break-words disabled:opacity-50 border border-straw/30 text-straw text-sm">
                    {copy.refreshQuote}
                  </button>}
                </>
              )}
              {opened.claimed && (
                <p className="w-full mt-4 py-3 px-2 rounded-2xl bg-soil-800 text-straw text-sm text-center break-words">
                  {copy.claimed}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
