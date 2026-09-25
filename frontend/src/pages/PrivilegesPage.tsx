import { PrivilegesPanel } from "../components/PrivilegesPanel";
import { UI_ICONS } from "../lib/visualAssets";
import { ResourceGlyph } from "../components/visual/ResourceGlyph";

export function PrivilegesPage() {
  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold text-parchment flex items-center gap-2"><ResourceGlyph icon={UI_ICONS.privileges} alt="" className="w-7 h-7" /> Привилегии</h1>
      </div>
      <p className="text-straw text-xs">
        Все бонусы, которые активны для вашего кошелька. Суммарная скидка применяется автоматически к крафту, ремонту и маркетплейсу.
      </p>
      <PrivilegesPanel />
    </div>
  );
}
