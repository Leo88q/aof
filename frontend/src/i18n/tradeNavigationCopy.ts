import type { Language } from './translations';

type MarketCopy = {
  title: string; intro: string; sticker: string; notLoaded: string; sonar: string; sonarSub: string;
  listings: string; median: string; sonarHint: string;
  listing: string; listingSub: string; auction: string; auctionSub: string;
  offer: string; offerSub: string; rental: string; rentalSub: string;
  orderbook: string; orderbookSub: string; flasks: string; flasksSub: string;
  hotOpen: string; hotIntro: string;
};
type EconomyCopy = { overview: string; pantry: string; workshop: string; calendar: string };
export const tradeNavigationCopy: Record<Language, { market: MarketCopy; economy: EconomyCopy }> = {
  ru: {
    market: { title: 'Рынок', intro: 'Семь торговых площадок — от листингов до событийного рынка', sticker: 'ПРИЛАВКИ', notLoaded: 'НЕ ЗАГРУЖЕНО', sonar: 'Эхолот цен', sonarSub: 'ближе к центру — дешевле', listings: 'Витрина', median: 'Медиана', sonarHint: 'Цены не загружаются на этом экране. Откройте торговую площадку, чтобы проверить предложения.', listing: 'Листинг', listingSub: 'Фиксированная цена', auction: 'Аукцион', auctionSub: 'Лучшая ставка', offer: 'Предложения', offerSub: 'Торг о цене', rental: 'Аренда', rentalSub: 'Доля с добычи', orderbook: 'Книга заявок', orderbookSub: 'Просмотр и отмена заявок', flasks: 'Флюиды', flasksSub: 'Торговля флаконами', hotOpen: 'Событийный рынок открыт', hotIntro: 'Цены меняются прямо сейчас — успей купить.' },
    economy: { overview: 'Обзор', pantry: 'Кладовая', workshop: 'Мастерская', calendar: 'Эпохи' },
  },
  en: {
    market: { title: 'Market', intro: 'Seven trading venues, from listings to the event market', sticker: 'STALLS', notLoaded: 'NOT LOADED', sonar: 'Price sonar', sonarSub: 'closer to the center means cheaper', listings: 'Listings', median: 'Median', sonarHint: 'Prices are not loaded on this screen. Open a trading venue to check offers.', listing: 'Listings', listingSub: 'Fixed price', auction: 'Auction', auctionSub: 'Highest bid', offer: 'Offers', offerSub: 'Negotiate a price', rental: 'Rentals', rentalSub: 'Share of mining output', orderbook: 'Order book', orderbookSub: 'View and cancel orders', flasks: 'Fluids', flasksSub: 'Trade vials', hotOpen: 'Event market open', hotIntro: 'Prices are changing right now — buy while you can.' },
    economy: { overview: 'Overview', pantry: 'Storage', workshop: 'Workshop', calendar: 'Eras' },
  },
  pt: {
    market: { title: 'Mercado', intro: 'Sete espaços de negociação, dos anúncios ao mercado de eventos', sticker: 'BANCAS', notLoaded: 'NÃO CARREGADO', sonar: 'Radar de preços', sonarSub: 'mais perto do centro significa mais barato', listings: 'Anúncios', median: 'Mediana', sonarHint: 'Os preços não são carregados nesta tela. Abra um espaço de negociação para consultar as ofertas.', listing: 'Anúncios', listingSub: 'Preço fixo', auction: 'Leilão', auctionSub: 'Maior lance', offer: 'Propostas', offerSub: 'Negocie o preço', rental: 'Aluguel', rentalSub: 'Parte da produção', orderbook: 'Livro de ofertas', orderbookSub: 'Consultar e cancelar ordens', flasks: 'Fluidos', flasksSub: 'Troca de frascos', hotOpen: 'Mercado de eventos aberto', hotIntro: 'Os preços estão mudando agora — aproveite para comprar.' },
    economy: { overview: 'Visão geral', pantry: 'Armazém', workshop: 'Oficina', calendar: 'Eras' },
  },
  es: {
    market: { title: 'Mercado', intro: 'Siete espacios comerciales, desde anuncios hasta el mercado de eventos', sticker: 'PUESTOS', notLoaded: 'SIN CARGAR', sonar: 'Radar de precios', sonarSub: 'más cerca del centro significa más barato', listings: 'Anuncios', median: 'Mediana', sonarHint: 'Los precios no se cargan en esta pantalla. Abre un espacio comercial para consultar las ofertas.', listing: 'Anuncios', listingSub: 'Precio fijo', auction: 'Subasta', auctionSub: 'Mejor puja', offer: 'Ofertas', offerSub: 'Negocia el precio', rental: 'Alquiler', rentalSub: 'Parte de la producción', orderbook: 'Libro de órdenes', orderbookSub: 'Consultar y cancelar órdenes', flasks: 'Fluidos', flasksSub: 'Comercio de frascos', hotOpen: 'Mercado de eventos abierto', hotIntro: 'Los precios cambian ahora mismo — aprovecha para comprar.' },
    economy: { overview: 'Resumen', pantry: 'Almacén', workshop: 'Taller', calendar: 'Eras' },
  },
  vi: {
    market: { title: 'Chợ', intro: 'Bảy khu giao dịch, từ rao bán đến chợ sự kiện', sticker: 'GIAN HÀNG', notLoaded: 'CHƯA TẢI', sonar: 'Ra-đa giá', sonarSub: 'càng gần tâm, giá càng rẻ', listings: 'Rao bán', median: 'Trung vị', sonarHint: 'Màn hình này không tải giá. Hãy mở một khu giao dịch để xem các đề nghị.', listing: 'Rao bán', listingSub: 'Giá cố định', auction: 'Đấu giá', auctionSub: 'Giá thầu cao nhất', offer: 'Đề nghị', offerSub: 'Thương lượng giá', rental: 'Cho thuê', rentalSub: 'Chia sẻ sản lượng', orderbook: 'Sổ lệnh', orderbookSub: 'Xem và hủy lệnh', flasks: 'Dung dịch', flasksSub: 'Giao dịch lọ', hotOpen: 'Chợ sự kiện đã mở', hotIntro: 'Giá đang thay đổi — hãy tranh thủ mua.' },
    economy: { overview: 'Tổng quan', pantry: 'Kho', workshop: 'Xưởng chế tạo', calendar: 'Các kỷ nguyên' },
  },
  id: {
    market: { title: 'Pasar', intro: 'Tujuh tempat perdagangan, dari lapak hingga pasar acara', sticker: 'LAPAK', notLoaded: 'BELUM DIMUAT', sonar: 'Radar harga', sonarSub: 'makin dekat ke pusat, makin murah', listings: 'Lapak', median: 'Median', sonarHint: 'Harga tidak dimuat di layar ini. Buka tempat perdagangan untuk melihat penawaran.', listing: 'Lapak', listingSub: 'Harga tetap', auction: 'Lelang', auctionSub: 'Tawaran tertinggi', offer: 'Penawaran', offerSub: 'Tawar harga', rental: 'Sewa', rentalSub: 'Bagian hasil tambang', orderbook: 'Buku pesanan', orderbookSub: 'Lihat dan batalkan pesanan', flasks: 'Cairan', flasksSub: 'Jual beli botol', hotOpen: 'Pasar acara dibuka', hotIntro: 'Harga sedang berubah — segera beli.' },
    economy: { overview: 'Ringkasan', pantry: 'Gudang', workshop: 'Bengkel', calendar: 'Era' },
  },
  fil: {
    market: { title: 'Pamilihan', intro: 'Pitong pamilihan, mula sa mga listahan hanggang sa pamilihan ng event', sticker: 'MGA PUWESTO', notLoaded: 'HINDI PA NALOLOAD', sonar: 'Radar ng presyo', sonarSub: 'mas malapit sa gitna, mas mura', listings: 'Mga listahan', median: 'Medyan', sonarHint: 'Hindi kinukuha ang mga presyo sa pahinang ito. Buksan ang pamilihan upang tingnan ang mga alok.', listing: 'Listahan', listingSub: 'Nakatakdang presyo', auction: 'Subasta', auctionSub: 'Pinakamataas na tawad', offer: 'Mga alok', offerSub: 'Tawaran ang presyo', rental: 'Paupahan', rentalSub: 'Bahagi sa ani ng mina', orderbook: 'Talaan ng order', orderbookSub: 'Tingnan at kanselahin ang order', flasks: 'Mga fluid', flasksSub: 'Kalakalan ng mga bote', hotOpen: 'Bukas ang pamilihan ng event', hotIntro: 'Nagbabago ang mga presyo ngayon — bumili habang maaari.' },
    economy: { overview: 'Pangkalahatan', pantry: 'Imbakan', workshop: 'Pagawaan', calendar: 'Mga panahon' },
  },
};
