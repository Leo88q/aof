import { useEffect, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { farmOverviewCopy } from "../i18n/farmOverviewCopy";
import { Card } from "./ui/Card";
import { UI_ICONS } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { api } from "../lib/api";
import { useWalletStr } from "../lib/useWalletStr";

/** Displays only perks that are present in the player's on-chain PDA. */
export function ActiveBuffs() {
  const { language } = useLocale();
  const text = farmOverviewCopy[language];
  const user = useWalletStr();
  const [perks, setPerks] = useState<{ historian: number; medallion: number } | null>(null);

  useEffect(() => {
    setPerks(null);
    if (!user) return;
    api.query.player(user)
      .then((player: any) => setPerks({
        historian: Number(player?.historianCount || 0),
        medallion: Number(player?.medallionCount || 0),
      }))
      .catch(() => setPerks({ historian: 0, medallion: 0 }));
  }, [user]);

  if (!perks || (perks.historian === 0 && perks.medallion === 0)) return null;

  return (
    <Card className="p-3 mb-3">
      <h4 className="text-parchment text-sm font-bold mb-2 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.rewardStar} alt="" className="w-4 h-4" /> {text.buffs}</h4>
      <div className="space-y-2">
        {perks.historian > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent-500/10 border border-accent-500/30">
            <ResourceGlyph icon={UI_ICONS.catalog} alt="" className="w-6 h-6" />
            <div className="flex-1 text-parchment text-xs font-bold">{text.historian}</div>
            <div className="text-straw text-xs">×{perks.historian}</div>
          </div>
        )}
        {perks.medallion > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gold/10 border border-gold/30">
            <ResourceGlyph icon={UI_ICONS.medalService} alt="" className="w-6 h-6" />
            <div className="flex-1 text-parchment text-xs font-bold">{text.medallion}</div>
            <div className="text-straw text-xs">×{perks.medallion}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
