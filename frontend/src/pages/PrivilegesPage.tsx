import { PrivilegesPanel } from "../components/PrivilegesPanel";

export function PrivilegesPage() {
  return (
    <div className="p-4 pt-2 pb-24 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-2xl font-bold text-parchment">🎯 Привилегии</h1>
      </div>
      <p className="text-straw text-xs">
        Все бонусы, которые активны для вашего кошелька. Суммарная скидка применяется автоматически к крафту, ремонту и маркетплейсу.
      </p>
      <PrivilegesPanel />
    </div>
  );
}
