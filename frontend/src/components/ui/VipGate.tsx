import { motion } from "framer-motion";
import { useNav } from "../../nav/NavContext";
import { Card } from "./Card";
import { NavHeader } from "../NavHeader";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../visual/ResourceGlyph";
import { SeasonPassPage } from "../../pages/profile/SeasonPassPage";

interface VipGateProps {
  isVip: boolean;
  feature: string;
  children: React.ReactNode;
}

/**
 * Обёртка для VIP-only фич.
 * Если не VIP — показывает апселл с кнопкой "Buy Premium".
 */
export function VipGate({ isVip, feature, children }: VipGateProps) {
  const { push } = useNav();

  if (isVip) {
    return <>{children}</>;
  }

  return (
    <Card className="bg-gradient-to-r from-gold/5 to-soil-850 border border-gold/20">
      <div className="flex items-start gap-3">
        <ResourceGlyph icon={UI_ICONS.privileges} alt="" className="w-8 h-8" />
        <div className="flex-1">
          <h3 className="text-gold font-semibold text-sm">{feature}</h3>
          <p className="text-straw text-xs mt-1">
            Доступно только с Premium-пассом. Открой автоматизацию, бусты и безлимитные алерты.
          </p>
          <button
            onClick={() => push("profile", "season", (
              <>
                <NavHeader title="Пасс эпохи" icon={UI_ICONS.seasonPass} tabKey="profile" />
                <SeasonPassPage />
              </>
            ))}
            className="mt-3 px-4 py-2 rounded-xl bg-gold text-soil-950 font-semibold text-sm active:scale-95 transition-transform"
          >
            <span className="inline-flex items-center gap-1.5"><ResourceGlyph icon={UI_ICONS.seasonPass} alt="" className="w-4 h-4" /> Buy Premium</span>
          </button>
        </div>
      </div>
    </Card>
  );
}
