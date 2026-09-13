import { ReactNode } from "react";
import { useNav } from "../../nav/NavContext";
import { NavHeader } from "../../components/NavHeader";
import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { HotMarket } from "./HotMarket";
import { ListingPage } from "./ListingPage";
import { AuctionPage } from "./AuctionPage";
import { OfferPage } from "./OfferPage";
import { RentalPage } from "./RentalPage";
import { OrderbookPage } from "./OrderbookPage";
import { FlaskMarketplace } from "./FlaskMarketplace";

const SECTIONS = [
  { id: "listing", icon: "🏷️", label: "Листинг", sub: "Фикс. цена", el: <ListingPage /> },
  { id: "auction", icon: "🔨", label: "Аукцион", sub: "Кто больше", el: <AuctionPage /> },
  { id: "offer", icon: "🤝", label: "Офферы", sub: "Торг о цене", el: <OfferPage /> },
  { id: "rental", icon: "🔑", label: "Аренда", sub: "Доля с добычи", el: <RentalPage /> },
  { id: "orderbook", icon: "📊", label: "Ордербук", sub: "Еда/Дерево/Камень", el: <OrderbookPage /> },
  { id: "flasks", icon: "🧪", label: "Зелья", sub: "Торговля флаконами", el: <FlaskMarketplace /> },
];

export function MarketHome() {
  const { push } = useNav();

  // [ФИКС] Каждая подстраница получает шапку с кнопкой «Назад»
  const go = (id: string, el: ReactNode, title: string) =>
    push("market", id, (
      <>
        <NavHeader title={title} tabKey="market" />
        {el}
      </>
    ));

  return (
    <div className="p-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold mb-1 text-parchment">Рынок</h1>
      <p className="text-straw text-xs mb-4">Семь торговых площадок — от прилавка до барабана урожая</p>

      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}>
            <Card onClick={() => go(s.id, s.el, s.label)} className="flex flex-col items-center py-6">
              <span className="text-3xl mb-2">{s.icon}</span>
              <span className="text-sm font-medium text-parchment">{s.label}</span>
              <span className="text-xs text-straw mt-0.5">{s.sub}</span>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-6">
        <Card onClick={() => go("hot", <HotMarket />, "Хот-маркет")}
          className="bg-gradient-to-r from-wheat-600/20 to-soil-850 border border-wheat-600/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-wheat-500 font-semibold">🔥 Хот-маркет открыт</h3>
              <p className="text-straw text-xs mt-1">Цены живут прямо сейчас — успей купить</p>
            </div>
            <span className="text-2xl">→</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
