import type { Language } from './translations';

type Copy = {
  flaskTitle: string; flaskCatalog: string; flaskExplanation: string; flaskRecipe: string; flaskNoPrice: string;
  hotTitle: string; hotExplanation: string;
};
export const marketDetailCopy: Record<Language, Copy> = {
  ru: {
    flaskTitle: 'Фляги', flaskCatalog: 'Каталог фляг',
    flaskExplanation: 'Фляги пока только варят: у сети нет ни книги заявок, ни операции применения. Здесь нет цен и продавцов — только каталог продуктов рецептов.',
    flaskRecipe: 'Выпускается рецептом; применение в сети не объявлено', flaskNoPrice: 'Цены нет',
    hotTitle: 'Событийный рынок',
    hotExplanation: 'Сеть пока не подтверждает инвентарь инструментов для событийного рынка. Торговля, цены и графики закрыты: выдуманных лотов и ставок здесь нет.',
  },
  en: {
    flaskTitle: 'Vials', flaskCatalog: 'Vial catalog',
    flaskExplanation: 'Vials can be crafted, but the network has neither an order book nor a way to use them yet. There are no prices or sellers here, only the recipe products.',
    flaskRecipe: 'Crafted from a recipe; on-chain use is not available', flaskNoPrice: 'No price',
    hotTitle: 'Event market',
    hotExplanation: 'The network does not yet confirm tool inventory for this event market. Trades, prices and charts remain unavailable; no invented listings or bids are shown.',
  },
  pt: {
    flaskTitle: 'Frascos', flaskCatalog: 'Catálogo de frascos',
    flaskExplanation: 'Os frascos podem ser criados, mas a rede ainda não tem livro de ofertas nem operação para usá-los. Não há preços nem vendedores aqui: apenas produtos das receitas.',
    flaskRecipe: 'Produzido por receita; ainda não há uso na rede', flaskNoPrice: 'Sem preço',
    hotTitle: 'Mercado de eventos',
    hotExplanation: 'A rede ainda não confirma o inventário de ferramentas para este mercado. Negociações, preços e gráficos ficam indisponíveis; não são exibidos anúncios ou lances fictícios.',
  },
  es: {
    flaskTitle: 'Frascos', flaskCatalog: 'Catálogo de frascos',
    flaskExplanation: 'Los frascos se pueden fabricar, pero la red aún no cuenta con un libro de órdenes ni con una operación para usarlos. Aquí no hay precios ni vendedores: solo productos de recetas.',
    flaskRecipe: 'Se fabrica con una receta; aún no se puede usar en la red', flaskNoPrice: 'Sin precio',
    hotTitle: 'Mercado de eventos',
    hotExplanation: 'La red aún no confirma el inventario de herramientas para este mercado. El comercio, los precios y los gráficos no están disponibles; no se muestran anuncios ni pujas ficticias.',
  },
  vi: {
    flaskTitle: 'Các lọ', flaskCatalog: 'Danh mục lọ',
    flaskExplanation: 'Có thể chế tạo lọ, nhưng mạng chưa có sổ lệnh hoặc thao tác sử dụng chúng. Vì vậy, ở đây không có giá hay người bán, chỉ có sản phẩm từ công thức.',
    flaskRecipe: 'Được chế tạo theo công thức; chưa thể dùng trên mạng', flaskNoPrice: 'Chưa có giá',
    hotTitle: 'Chợ sự kiện',
    hotExplanation: 'Mạng chưa xác nhận kho công cụ cho chợ sự kiện. Giao dịch, giá và biểu đồ hiện không khả dụng; không hiển thị lô hàng hoặc giá thầu giả.',
  },
  id: {
    flaskTitle: 'Botol', flaskCatalog: 'Katalog botol',
    flaskExplanation: 'Botol dapat dirakit, tetapi jaringan belum memiliki buku pesanan ataupun cara untuk menggunakannya. Di sini belum ada harga atau penjual, hanya produk resep.',
    flaskRecipe: 'Dibuat dengan resep; belum dapat digunakan di jaringan', flaskNoPrice: 'Belum ada harga',
    hotTitle: 'Pasar acara',
    hotExplanation: 'Jaringan belum mengonfirmasi inventaris peralatan untuk pasar acara. Perdagangan, harga, dan grafik belum tersedia; tidak ada lapak atau tawaran rekaan.',
  },
  fil: {
    flaskTitle: 'Mga bote', flaskCatalog: 'Katalogo ng bote',
    flaskExplanation: 'Maaaring gawin ang mga bote, ngunit wala pang talaan ng order o paraan ng paggamit ng mga ito sa network. Wala pang presyo o nagbebenta rito, mga produktong galing sa resipe lamang.',
    flaskRecipe: 'Ginagawa sa resipe; wala pang gamit sa network', flaskNoPrice: 'Wala pang presyo',
    hotTitle: 'Pamilihan ng event',
    hotExplanation: 'Hindi pa nakukumpirma ng network ang imbentaryo ng kagamitan para sa pamilihang ito. Sarado pa ang kalakalan, presyo at mga chart; walang imbentong listahan o tawad.',
  },
};
