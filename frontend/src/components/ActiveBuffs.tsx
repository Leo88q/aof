import { useEffect, useState } from "react";
import { Card } from "./ui/Card";
import { UI_ICONS } from "../lib/visualAssets";
import { ResourceGlyph } from "./visual/ResourceGlyph";
import { api } from "../lib/api";
import { useWalletStr } from "../lib/useWalletStr";

/** Displays only perks that are present in the player's on-chain PDA. */
export function ActiveBuffs() {
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
      <h4 className="text-parchment text-sm font-bold mb-2 flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.rewardStar} alt="" className="w-4 h-4" /> Активные перки стейкинга</h4>
      <div className="space-y-2">
        {perks.historian > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-wheat-500/10 border border-wheat-500/30">
            <span className="text-xl">📜</span>
            <div className="flex-1 text-parchment text-xs font-bold">Историк</div>
            <div className="text-straw text-xs">×{perks.historian}</div>
          </div>
        )}
        {perks.medallion > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-gold/10 border border-gold/30">
            <ResourceGlyph icon={UI_ICONS.medalService} alt="" className="w-6 h-6" />
            <div className="flex-1 text-parchment text-xs font-bold">Медальон</div>
            <div className="text-straw text-xs">×{perks.medallion}</div>
          </div>
        )}
      </div>
    </Card>
  );
}
