import type { Language } from "../../i18n/translations";
import { wellCopy } from "../../i18n/wellCopy";

const STATION = "/assets/well/station.jpg";

export function WellHall({ language, active, lastCollectedAt }: {
  language: Language;
  active: boolean;
  lastCollectedAt: number | null;
}) {
  const copy = wellCopy[language];
  const when = lastCollectedAt == null
    ? copy.notYet
    : new Date(lastCollectedAt * 1000).toLocaleString(language);
  return (
    <section className="well-hall" aria-label={copy.station}>
      <p className="well-hall__auto">{copy.auto}</p>
      <figure className={active ? "well-stage well-stage--live" : "well-stage"}>
        <img src={STATION} alt="" />
      </figure>
      <p className="well-hall__motion">{copy.motion}</p>
      <dl className="well-rules">
        <div>
          <dt>{copy.lastCollection}</dt>
          <dd>{when}</dd>
        </div>
      </dl>
      <p className="well-hall__rule">{copy.firstCall}</p>
      <p className="well-hall__rule">{copy.villagers}</p>
      <p className="well-hall__rule">{copy.emptyWindow}</p>
      <p className="well-hall__rule">{copy.windowHours}</p>
      <p className="well-hall__rule">{copy.rateNote}</p>
    </section>
  );
}
