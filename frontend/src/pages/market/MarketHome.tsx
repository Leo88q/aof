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
import { UI_ICONS } from "../../lib/visualAssets";
import { DISABLED_MECHANICS, isMechanicDisabled } from "../../components/ui/FeatureDisabledNotice";
import { Note, Panel, Sticker } from "../../ui/forge/kit";
import { SonarPPI } from "../../ui/forge/devices";

const SECTIONS = [
  { id: "listing", icon: UI_ICONS.marketListing, label: "Листинг", sub: "Фикс. цена", el: <ListingPage /> },
  { id: "auction", icon: UI_ICONS.marketAuction, label: "Аукцион", sub: "Кто больше", el: <AuctionPage /> },
  { id: "offer", icon: UI_ICONS.marketOffer, label: "Офферы", sub: "Торг о цене", el: <OfferPage /> },
  { id: "rental", icon: UI_ICONS.marketRental, label: "Аренда", sub: "Доля с добычи", el: <RentalPage /> },
  { id: "orderbook", icon: UI_ICONS.marketOrderbook, label: "Ордербук", sub: "Стакан по ресурсам", el: <OrderbookPage /> },
  { id: "flasks", icon: UI_ICONS.flasks, label: "Флюиды", sub: "Торговля флаконами", el: <FlaskMarketplace /> },
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
      <p className="text-straw text-xs mb-4">Семь торговых площадок — от листингов до квантового розыгрыша</p>

      {/* К6 · эхолот рынка: без данных развёртка пустая и подписана, чтобы
          приборов не приходилось искать по суб-вкладкам. */}
      <div className="mb-3">
        <Panel
          tier="panel"
          device="sonar"
          id={<Sticker>ПРИЛАВКИ</Sticker>}
          meta="НЕТ ДАННЫХ"
          title="Эхолот цен"
          sub="ближе к центру — дешевле"
        >
          <SonarPPI
            blips={[]}
            legend={
              <>
                <span>Витрина: <b>—</b></span>
                <span>Медиана: <b>—</b></span>
              </>
            }
          />
          <Note quiet>Прилавки не читаются: сеть не ответила. Развёртка оживёт, когда листинги придут.</Note>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}>
            <Card onClick={() => go(s.id, s.el, s.label)} className="flex flex-col items-center py-6">
              {s.icon.startsWith("/") ? (
                <img src={s.icon} alt="" className="w-10 h-10 object-contain mb-2" />
              ) : (
                <span className="text-3xl mb-2">{s.icon}</span>
              )}
              <span className="text-sm font-medium text-parchment">{s.label}</span>
              <span className="text-xs text-straw mt-0.5">{s.sub}</span>
            </Card>
          </motion.div>
        ))}
      </div>

      {(() => {
        // Плитка не должна обещать то, что механика не умеет: пока hot_market
        // закрыт на цепи, «Хот-маркет открыт» — ложное обещание.
        const hotDisabled = isMechanicDisabled("hot_market");
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-6">
            <Card
              onClick={() => go("hot", <HotMarket />, "Хот-маркет")}
              className={
                hotDisabled
                  ? "bg-soil-850 border border-straw/15"
                  : "bg-gradient-to-r from-wheat-600/20 to-soil-850 border border-wheat-600/30"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={`font-semibold flex items-center gap-2 ${hotDisabled ? "text-straw" : "text-wheat-500"}`}>
                    <img src={UI_ICONS.marketHot} alt="" className="w-5 h-5 object-contain shrink-0" />
                    <span className="truncate">
                      {hotDisabled ? "Хот-маркет пока недоступен" : "Хот-маркет открыт"}
                    </span>
                  </h3>
                  <p className="text-straw text-xs mt-1">
                    {hotDisabled ? DISABLED_MECHANICS.hot_market.reason : "Цены живут прямо сейчас — успей купить"}
                  </p>
                </div>
                <span className="text-2xl shrink-0">→</span>
              </div>
            </Card>
          </motion.div>
        );
      })()}
    </div>
  );
}
