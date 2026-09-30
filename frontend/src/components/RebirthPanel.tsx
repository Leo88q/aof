import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { rebirthCopy, type RebirthReason } from "../i18n/rebirthCopy";
import { useWalletStr } from "../lib/useWalletStr";
import { api } from "../lib/api";
import { handleTxResponse } from "../lib/txFlow";
import { actionErrorFeedback } from "../lib/txResponseFeedback";
import { lamportsToSol } from "../lib/amounts";
import { formatResourceUnits } from "../lib/orderbookReadings";
import {
  cooldownRemainingMs, readRebirthStatus, surplusTotalAtoms, verifySurplusOnChain,
  type RebirthStatus,
} from "../lib/rebirthReadings";
import { connection } from "../lib/wallet";
import { Key, Keys, Lamp, Note, Panel, Readout, Readouts, Rows, Row, Sticker } from "../ui/forge/kit";

type Reading =
  | { kind: "idle" }
  | { kind: "ready"; status: RebirthStatus; surplusCheck: "confirmed" | "mismatch" | "unavailable"; burnedAtoms: string }
  | { kind: "blocked"; reason: string };

/** «3 d 4 h» — точность до минут, как в остальных панелях. */
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
 * [§3.4] Перерождение: полный сброс прогресса сезона и сжигание излишков —
 * одна транзакция, которую игрок видит целиком до подписи.
 *
 * Панель не выдумывает ни одного числа: цена, кулдаун, предел ребёртов,
 * поколение и список излишков приходят из сети. Список излишков дополнительно
 * перечитывается из RPC: если сеть показывает другие остатки, кнопка
 * заблокирована (см. `verifySurplusOnChain`).
 */
export function RebirthPanel() {
  const { language } = useLocale();
  const copy = rebirthCopy[language];
  const address = useWalletStr();
  const [reading, setReading] = useState<Reading>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const addressRef = useRef(address);
  addressRef.current = address;

  useEffect(() => {
    let alive = true;
    setNotice(null);
    if (!address) { setReading({ kind: "idle" }); return () => { alive = false; }; }
    setReading({ kind: "idle" });
    api.rebirth.status(address)
      .then(async (raw: unknown) => {
        const status = readRebirthStatus(raw);
        if (!status) { if (alive) setReading({ kind: "blocked", reason: copy.readFailed }); return; }
        const check = status.surplus.accounts.length === 0
          ? { kind: "confirmed" as const, totalAtoms: "0" }
          : await verifySurplusOnChain(connection, status.surplus.accounts);
        if (!alive) return;
        setReading({
          kind: "ready", status,
          surplusCheck: check.kind,
          burnedAtoms: check.kind === "confirmed" ? check.totalAtoms : "0",
        });
      })
      .catch(() => { if (alive) setReading({ kind: "blocked", reason: copy.readFailed }); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, tick]);

  useEffect(() => {
    if (reading.kind !== "ready" || reading.status.nextAllowedAt === null) return;
    const timer = setInterval(() => setTick(value => value + 1), 60_000);
    return () => clearInterval(timer);
  }, [reading]);

  const status = reading.kind === "ready" ? reading.status : null;
  const leftMs = status ? cooldownRemainingMs(status) : 0;
  const blocked = reading.kind === "blocked";
  const checkFailed = reading.kind === "ready" && reading.surplusCheck !== "confirmed";
  const reasons: string[] = useMemo(() => {
    if (!status) return [];
    const list = [...status.reasons];
    if (leftMs > 0 && !list.includes("REBIRTH_COOLDOWN_ACTIVE")) list.push("REBIRTH_COOLDOWN_ACTIVE");
    return list;
  }, [status, leftMs]);
  const canAct = Boolean(address) && Boolean(status) && status!.canRebirth && leftMs === 0 && !checkFailed && !busy;

  async function perform() {
    if (!address || !status) return;
    setBusy(true);
    setNotice(null);
    try {
      const response: any = await api.rebirth.do({ user: address });
      const result = await handleTxResponse(response, {
        kind: "rebirth",
        user: address,
        seasonId: status.seasonId,
        costLamports: status.costLamports,
        treasury: status.treasury,
        surplus: status.surplus.accounts.map(entry => ({
          mint: entry.mint, tokenAccount: entry.tokenAccount, amountAtoms: entry.amountAtoms,
        })),
      });
      if (!result.success) {
        setNotice({ ok: false, text: result.error || actionErrorFeedback(result.error, language, copy.uncertain) });
        return;
      }
      setNotice({ ok: true, text: copy.doneNote });
      setTick(value => value + 1);
    } catch (e: any) {
      setNotice({ ok: false, text: actionErrorFeedback(e, language, copy.uncertain) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel tier="panel" device="cards" id={<Sticker>{copy.sticker}</Sticker>}
      meta={copy.meta} title={copy.title} sub={copy.sub}>
      {!address && <Keys><Key disabled>{copy.noWallet}</Key></Keys>}

      {address && (
        <>
          <Readouts>
            <Readout label={copy.cost} value={status ? `${lamportsToSol(status.costLamports)} SOL` : undefined}
              dash={!status} hint={copy.costHint} />
            <Readout label={copy.generation} value={status && status.generation !== null ? String(status.generation) : undefined}
              dash={!status} hint={copy.generationHint} />
            <Readout label={copy.bonus} value={status ? `+${(status.permanentBonusBps / 100).toFixed(2)}%` : undefined}
              dash={!status} hint={copy.bonusHint} />
            <Readout label={copy.budget} value={status ? `${status.rebirthCount} / ${status.maxRebirths}` : undefined}
              dash={!status} hint={copy.budgetHint} />
          </Readouts>

          <Rows>
            <Row k={copy.resetVillagers} v={status?.progress.villagers ?? "—"} />
            <Row k={copy.resetTent} v={status?.progress.hasTent === null || !status ? "—" : status.progress.hasTent ? "✓" : "—"} />
            <Row k={copy.resetXp} v={status?.progress.xp ?? "—"} />
            <Row k={copy.surplusSum} v={reading.kind === "ready"
              ? formatResourceUnits(reading.burnedAtoms)
              : "—"} />
          </Rows>

          {blocked && <p role="status" className="fg-note break-words">{reading.reason}</p>}

          {status && (
            <>
              <Note quiet>{copy.resetsNote}</Note>
              <Note quiet>{copy.keepsNote}</Note>

              {status.surplus.accounts.length === 0
                ? <Note quiet>{copy.surplusEmpty}</Note>
                : (
                  <>
                    <Note quiet>{reading.kind === "ready" && reading.surplusCheck === "confirmed"
                      ? copy.surplusVerified
                      : reading.kind === "ready" && reading.surplusCheck === "mismatch"
                        ? copy.surplusMismatch(status.surplus.accounts[0].mint)
                        : copy.surplusUnknown}</Note>
                    <Note quiet>{copy.burnNote(status.surplus.limit)}</Note>
                  </>
                )}

              {leftMs > 0 ? <Lamp tone="wait">{copy.cooldown(remainingText(leftMs))}</Lamp> : <Lamp tone="ok">{copy.ready}</Lamp>}

              {reasons.length > 0 && (
                <Note quiet>{reasons
                  .map(reason => copy.reasons[reason as RebirthReason] ?? reason)
                  .join(" ")}</Note>
              )}
            </>
          )}

          <Keys>
            <Key tone="primary" disabled={!canAct} onClick={perform}>
              {busy ? copy.acting : copy.action}
            </Key>
          </Keys>

          <Note quiet>{copy.confirmNote}</Note>
          {notice && <p role="status" className={notice.ok ? "fg-note break-words" : "fg-note fg-note--err break-words"}>{notice.text}</p>}
        </>
      )}
    </Panel>
  );
}
