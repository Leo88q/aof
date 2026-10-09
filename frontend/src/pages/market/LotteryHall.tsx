import type { Language } from "../../i18n/translations";
import type { lotteryCopy } from "../../i18n/lotteryCopy";
import { LOTTERY_ART } from "../../lib/visualAssets";
import {
  LOTTERY_MAX_TICKETS_PER_ROUND,
  lotteryRefundOpensAt,
  lotterySalesMatureAt,
  type LotteryRound,
  type LotteryTicket,
} from "../../lib/lotteryReadings";

type Copy = (typeof lotteryCopy)[Language];
export type LotteryPoolId = "sol" | "skr" | "potato";

const POOLS: LotteryPoolId[] = ["sol", "skr", "potato"];

function parts(targetSec: number, nowMs: number) {
  const left = Math.max(0, targetSec * 1000 - nowMs);
  const minutes = Math.floor(left / 60000);
  return {
    left,
    days: String(Math.floor(minutes / 1440)),
    hours: String(Math.floor((minutes % 1440) / 60)),
    minutes: String(minutes % 60),
  };
}

/** Laboratory raffle hall. Motion is decorative; the chain record is the status. */
export function LotteryHall({
  copy,
  pool,
  onPool,
  round,
  now,
  tickets,
  spinning,
}: {
  copy: Copy;
  pool: LotteryPoolId;
  onPool: (id: LotteryPoolId) => void;
  round: LotteryRound | null;
  now: number;
  tickets: LotteryTicket[] | null;
  spinning: boolean;
}) {
  const sold = round ? Number(round.ticketsSold) : null;
  const shown = sold === null ? [] : Array.from({ length: Math.min(sold, 12) }, (_, index) => String(index));
  const mine = new Set(tickets?.map(ticket => ticket.ticketNumber) ?? []);
  const sales = round ? parts(lotterySalesMatureAt(round), now) : null;
  const refund = round ? parts(lotteryRefundOpensAt(round), now) : null;
  const fill = sold === null ? null : Math.min(1, sold / LOTTERY_MAX_TICKETS_PER_ROUND);
  const names = { sol: copy.sol, skr: copy.skr, potato: copy.potato };
  const level = fill === null ? null : `${Math.round(fill * 100)}%`;

  return (
    <section className="lot-hall" aria-label={copy.chambers}>
      <p className="lot-hall__auto">{copy.auto}</p>
      <figure className={"lot-stage" + (pool === "sol" ? "" : " lot-stage--sealed")}>
        <img src={LOTTERY_ART[pool]} alt="" />
      </figure>
      <div className="lot-vials" role="tablist" aria-label={copy.chambers}>
        {POOLS.map(id => {
          const live = id === "sol";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pool === id}
              className={"lot-vial" + (pool === id ? " lot-vial--on" : "") + (live ? "" : " lot-vial--sealed")}
              data-pool={id}
              onClick={() => onPool(id)}
            >
              <img className="lot-vial__art" src={LOTTERY_ART[id]} alt="" />
              <span className="lot-vial__name">{names[id]}</span>
              <span className="lot-vial__lamp">{live ? copy.live : copy.sealed}</span>
              {live && level !== null ? <span className="lot-meter" style={{ ["--fill" as string]: level }} /> : null}
            </button>
          );
        })}
      </div>

      {pool !== "sol" ? (
        <p className="lot-seal" role="status">{pool === "skr" ? copy.skrSeal : copy.potatoSeal}</p>
      ) : (
        <div className="lot-live">
          <div className={"lot-drum" + (spinning ? " lot-drum--spin" : shown.length > 0 && !round?.drawn ? " lot-drum--idle" : "")} aria-label={copy.drum}>
            <div className="lot-drum__rotor">
              <img className="lot-drum__plate" src={LOTTERY_ART.drum} alt="" />
            </div>
            <div className="lot-drum__well">
              {shown.length === 0 ? <span className="lot-drum__empty">—</span> : shown.map(number => (
                <span
                  key={number}
                  className={"lot-slip" + (mine.has(number) ? " lot-slip--mine" : "") + (round?.winningTicket === number ? " lot-slip--win" : "")}
                >{number}</span>
              ))}
            </div>
          </div>
          <ul className="lot-rules">
            <li>{copy.oneWinner}</li>
            <li>{copy.split}</li>
            <li>{copy.cap}</li>
            {sales && sales.left > 0 ? <li>{copy.salesClock} {copy.clock(sales.days, sales.hours, sales.minutes)}</li> : null}
            {sales && sales.left === 0 && round && !round.drawn && !round.drawCommitted ? <li>{copy.salesMature}</li> : null}
            {refund && refund.left > 0 && round && !round.drawn ? <li>{copy.refundClock} {copy.clock(refund.days, refund.hours, refund.minutes)}</li> : null}
            {refund && refund.left === 0 && round && !round.drawn && !round.drawCommitted ? <li>{copy.refundReady}</li> : null}
          </ul>
        </div>
      )}
    </section>
  );
}
