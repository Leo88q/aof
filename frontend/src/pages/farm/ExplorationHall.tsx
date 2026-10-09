import type { Language } from "../../i18n/translations";
import type { explorationCopy } from "../../i18n/explorationCopy";
import { explorationTierRule } from "../../lib/explorationReadings";
import { EXPLORATION_ART } from "../../lib/visualAssets";

type Copy = (typeof explorationCopy)[Language];

/** Depth bay for a trip. Spinning the sonar does not reveal an outcome. */
export function ExplorationHall({
  copy,
  language,
  recorded,
  tier,
  pending,
}: {
  copy: Copy;
  language: string;
  recorded: boolean | null;
  tier: number | null;
  pending: boolean;
}) {
  const rule = recorded && tier !== null ? explorationTierRule(tier) : recorded === false ? explorationTierRule(1) : null;
  const percent = rule ? String(rule.successBps / 100) : null;

  return (
    <section className="exp-hall" aria-label={copy.title}>
      <p className="exp-hall__auto">{copy.auto}</p>
      <figure className="exp-stage">
        <img src={EXPLORATION_ART.bay} alt="" />
      </figure>
      <div className={"exp-sonar" + (pending ? " exp-sonar--spin" : "")} aria-hidden="true">
        <img src={EXPLORATION_ART.sonar} alt="" />
      </div>
      {pending ? <p className="exp-hall__motion">{copy.motion}</p> : null}
      <p className="exp-hall__escrow">{copy.escrow}</p>
      {recorded === null ? <p className="exp-hall__tier" role="status">{copy.tierUnknown}</p> : null}
      {recorded === false ? <p className="exp-hall__tier" role="status">{copy.firstTrip}</p> : null}
      {rule && percent ? (
        <dl className="exp-rules">
          <div><dt>{copy.tierLabel}</dt><dd>{rule.tier.toLocaleString(language)}</dd></div>
          <div><dt>{copy.odds}</dt><dd>{percent}%</dd></div>
          <div><dt>{copy.cooldown}</dt><dd>{rule.cooldownHours.toLocaleString(language)} {copy.hours}</dd></div>
          <div><dt>{copy.daily}</dt><dd>{rule.tripsPerDay.toLocaleString(language)}</dd></div>
          <div><dt>{copy.range}</dt><dd>{rule.rewardMin.toLocaleString(language)}–{rule.rewardMax.toLocaleString(language)}</dd></div>
        </dl>
      ) : null}
      {rule?.upgradeWhole !== null && rule ? (
        <p className="exp-hall__upgrade">{copy.upgradeRule} {copy.upgradeCost}: {rule.upgradeWhole.toLocaleString(language)}</p>
      ) : null}
    </section>
  );
}
