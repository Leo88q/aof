import { ReactNode } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { tradeNavigationCopy } from "../../i18n/tradeNavigationCopy";
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
import { Note, Panel, Sticker } from "../../ui/forge/kit";
import { SonarPPI } from "../../ui/forge/devices";

type MarketDetailId = 'listing' | 'auction' | 'offer' | 'rental' | 'orderbook' | 'flasks' | 'hot';

// Navigation stores the screen as a React element. Read the current locale
// inside that element so an open nested header changes with the selector.
function MarketDetailScreen({ id, children }: { id: MarketDetailId; children: ReactNode }) {
  const { language } = useLocale();
  const market = tradeNavigationCopy[language].market;
  const title = id === 'hot' ? market.hotOpen : market[id];
  return <>
    <NavHeader title={title} tabKey="market" />
    {children}
  </>;
}

const SECTIONS = [
  { id: "listing", icon: UI_ICONS.marketListing, el: <ListingPage /> },
  { id: "auction", icon: UI_ICONS.marketAuction, el: <AuctionPage /> },
  { id: "offer", icon: UI_ICONS.marketOffer, el: <OfferPage /> },
  { id: "rental", icon: UI_ICONS.marketRental, el: <RentalPage /> },
  { id: "orderbook", icon: UI_ICONS.marketOrderbook, el: <OrderbookPage /> },
  { id: "flasks", icon: UI_ICONS.flasks, el: <FlaskMarketplace /> },
] as const;

export function MarketHome() {
  const { language } = useLocale();
  const copy = tradeNavigationCopy[language].market;
  const { push } = useNav();

  // [ФИКС] Каждая подстраница получает шапку с кнопкой «Назад»
  const go = (id: MarketDetailId, el: ReactNode) =>
    push("market", id, <MarketDetailScreen id={id}>{el}</MarketDetailScreen>);

  return (
    <div lang={language} className="p-4 pt-6 pb-24 min-w-0">
      <h1 className="text-2xl font-bold mb-1 text-parchment">{copy.title}</h1>
      <p className="text-straw text-xs mb-4">{copy.intro}</p>

      {/* The sonar is decorative until this screen loads listings. */}
      <div className="mb-3">
        <Panel
          tier="panel"
          device="sonar"
          id={<Sticker>{copy.sticker}</Sticker>}
          meta={copy.notLoaded}
          title={copy.sonar}
          sub={copy.sonarSub}
        >
          <SonarPPI
            ariaLabel={copy.sonar}
            blips={[]}
            legend={
              <>
                <span>{copy.listings}: <b>—</b></span>
                <span>{copy.median}: <b>—</b></span>
              </>
            }
          />
          <Note quiet>{copy.sonarHint}</Note>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {SECTIONS.map((s, i) => (
          <motion.div key={s.id} className="min-w-0" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}>
            <Card onClick={() => go(s.id, s.el)} className="flex flex-col items-center py-6 min-w-0 text-center">
              {s.icon.startsWith("/") ? (
                <img src={s.icon} alt="" className="w-10 h-10 object-contain mb-2" />
              ) : (
                <span className="text-3xl mb-2">{s.icon}</span>
              )}
              <span className="text-sm font-medium text-parchment w-full break-words">{copy[s.id]}</span>
              <span className="text-xs text-straw mt-0.5 w-full break-words">{copy[`${s.id}Sub`]}</span>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-6">
        <Card
          onClick={() => go("hot", <HotMarket />)}
          className="bg-gradient-to-r from-accent-600/20 to-soil-850 border border-accent-600/30"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold flex items-start gap-2 text-accent-500">
                <img src={UI_ICONS.marketHot} alt="" className="w-5 h-5 object-contain shrink-0" />
                <span className="min-w-0 break-words">{copy.hotOpen}</span>
              </h3>
              <p className="text-straw text-xs mt-1">{copy.hotIntro}</p>
            </div>
            <span className="text-2xl shrink-0">→</span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
