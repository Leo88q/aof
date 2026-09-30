import { useEffect, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { collectorCopy } from "../i18n/collectorCopy";
import { useWalletStr } from "../lib/useWalletStr";
import { api } from "../lib/api";
import { handleTxResponse } from "../lib/txFlow";
import { actionErrorFeedback } from "../lib/txResponseFeedback";
import { readPlayerSnapshot } from "../lib/playerReadings";
import {
  COLLECTOR_KINDS, isMintAddress, lockRemainingMs, readCollectorPosition,
  type CollectorKind, type CollectorPosition,
} from "../lib/collectors";
import { FEE_PER_NFT_MICROS, microsToSol } from "../lib/gasTank";
import { Key, Keys, Lamp, Note, Panel, Readout, Readouts, Rows, Row, Sticker } from "../ui/forge/kit";

/** «3 дня 4 ч» — без выдуманной точности: минуты округляем вверх. */
function remainingText(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${rest} min`;
  return `${rest} min`;
}

/**
 * Коллекционеры: постановка NFT в vault PDA и возврат из него.
 *
 * Дефект: перки (скидка на минт-комиссию, кап реферальных бонусов) были
 * объявлены на сайте и посчитаны в программе [AUDIT F-16], а в игре их нельзя
 * было включить — кнопок не существовало, хотя `collector_stake` /
 * `collector_unstake` живут и бэкенд их проксирует.
 *
 * Правила, которые панель не имеет права «улучшать»: один NFT за вызов,
 * lock 3 дня, минт должен быть в allowlist оператора, возврат стоит 0.01 SOL
 * из газ-бака. Всё остальное — включая «сколько осталось» — читается из сети.
 */
export function CollectorsPanel() {
  const { language } = useLocale();
  const copy = collectorCopy[language];
  const address = useWalletStr();
  const [mint, setMint] = useState("");
  const [kind, setKind] = useState<CollectorKind>("historian");
  const [position, setPosition] = useState<CollectorPosition | null>(null);
  const [counters, setCounters] = useState<{ historian: number; medallion: number } | null>(null);
  const [busy, setBusy] = useState<"stake" | "unstake" | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setCounters(null);
    setPosition(null);
    setNotice(null);
    setMint("");
    if (!address) return () => { alive = false; };
    api.query.player(address)
      .then(raw => {
        if (!alive) return;
        const player = readPlayerSnapshot(raw, address);
        setCounters(player ? { historian: player.historianCount, medallion: player.medallionCount } : null);
      })
      .catch(() => alive && setCounters(null));
    return () => { alive = false; };
  }, [address]);

  async function check() {
    if (!isMintAddress(mint)) { setNotice({ ok: false, text: copy.invalid }); setPosition(null); return; }
    setNotice(null);
    setPosition(null);
    const result = await readCollectorPosition(mint, address);
    setPosition(result);
    if (result.kind === "staked") setKind(result.collectorKind);
  }

  async function run(action: "stake" | "unstake") {
    if (!address || !isMintAddress(mint)) { setNotice({ ok: false, text: copy.invalid }); return; }
    setBusy(action);
    setNotice(null);
    try {
      const response: any = action === "stake"
        ? await api.collectors.stake({ user: address, mint: mint.trim(), kind })
        : await api.collectors.unstake({ user: address, mint: mint.trim() });
      const intent = action === "stake"
        ? { kind: "collector" as const, action: "stake" as const, user: address, mint: mint.trim(), collectorKind: kind }
        : { kind: "collector" as const, action: "unstake" as const, user: address, mint: mint.trim() };
      const result = await handleTxResponse(response, intent);
      if (!result.success) {
        setNotice({ ok: false, text: result.error || actionErrorFeedback(result.error, language, copy.uncertain) });
        return;
      }
      setNotice({ ok: true, text: action === "stake" ? copy.stakeDone : copy.unstakeDone });
      await check();
    } catch (e: any) {
      setNotice({ ok: false, text: actionErrorFeedback(e, language, copy.uncertain) });
    } finally {
      setBusy(null);
    }
  }

  const lockedMs = position ? lockRemainingMs(position) : 0;
  const stakedHere = position?.kind === "staked" && position.owner === address;
  const stakedByOther = position?.kind === "staked" && position.owner !== address;

  return (
    <Panel tier="panel" device="cards" id={<Sticker>{copy.sticker}</Sticker>}
      meta={copy.meta} title={copy.title} sub={copy.sub}>
      <Readouts>
        <Readout label={copy.kindHistorian} value={counters ? counters.historian.toLocaleString(language) : undefined}
          dash={!counters} hint={copy.haveHint} />
        <Readout label={copy.kindMedallion} value={counters ? counters.medallion.toLocaleString(language) : undefined}
          dash={!counters} hint={copy.haveHint} />
      </Readouts>

      {!address
        ? <Keys><Key disabled>{copy.noWallet}</Key></Keys>
        : (
          <>
            <Rows>
              <Row k={copy.mint} v={
                <input value={mint} onChange={e => setMint(e.target.value.trim())} spellCheck={false}
                  aria-label={copy.mint} placeholder="…" className="fg-input w-full" />
              } />
              <Row k={copy.kind} v={
                <select value={kind} onChange={e => setKind(e.target.value as CollectorKind)} aria-label={copy.kind}
                  className="fg-input" disabled={stakedHere}>
                  {COLLECTOR_KINDS.map(k => (
                    <option key={k} value={k}>{k === "historian" ? copy.kindHistorian : copy.kindMedallion}</option>
                  ))}
                </select>
              } />
            </Rows>
            <Keys>
              <Key tiny disabled={busy !== null || !mint} onClick={check}>{copy.check}</Key>
              <Key tone="primary" disabled={busy !== null || !mint || stakedHere} onClick={() => run("stake")}>
                {busy === "stake" ? copy.staking : copy.stake}
              </Key>
              <Key disabled={busy !== null || !stakedHere || lockedMs > 0} onClick={() => run("unstake")}>
                {busy === "unstake" ? copy.unstaking : copy.unstake}
              </Key>
            </Keys>

            {position === null && mint && <Note quiet>{copy.checking}</Note>}
            {position?.kind === "none" && <Note quiet>{copy.none}</Note>}
            {position?.kind === "unknown" && <p role="status" className="fg-note break-words">{copy.unknown}</p>}
            {stakedByOther && <p role="status" className="fg-note break-words">{copy.byAnother}</p>}
            {stakedHere && (
              lockedMs > 0
                ? <Lamp tone="wait">{copy.lockedFor(remainingText(lockedMs))}</Lamp>
                : <Lamp tone="ok">{copy.unlocked}</Lamp>
            )}
          </>
        )}

      <Note quiet>{copy.perks}</Note>
      <Note quiet>{copy.lockNote}</Note>
      <Note quiet>{copy.feeNote} · {copy.tankNote}</Note>
      <Note quiet>{`${microsToSol(FEE_PER_NFT_MICROS)} SOL`}</Note>
      {notice && <p role="status" className={notice.ok ? "fg-note break-words" : "fg-note fg-note--err break-words"}>{notice.text}</p>}
    </Panel>
  );
}
