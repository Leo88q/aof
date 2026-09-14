import { Card } from "../../components/ui/Card";

/**
 * The previous screen displayed synthetic candles and a synthetic queue while
 * the deployed aof-market program has no queue/indexer for those values. Keep
 * the route discoverable, but fail closed instead of presenting fake prices or
 * accepting a trade against an unknown tool inventory.
 */
export function HotMarket() {
  return (
    <div className="p-4 pt-6 pb-32">
      <h1 className="text-2xl font-bold text-parchment mb-4">🔥 Хот-маркет</h1>
      <Card>
        <p className="text-parchment font-semibold">Временно недоступно</p>
        <p className="text-straw text-sm mt-2 leading-relaxed">
          On-chain пул и его реальный инвентарь инструментов ещё не проиндексированы.
          Торговля, цены и графики отключены, чтобы не показывать синтетические данные
          и не принимать платежи без подтверждённого лота.
        </p>
      </Card>
    </div>
  );
}
