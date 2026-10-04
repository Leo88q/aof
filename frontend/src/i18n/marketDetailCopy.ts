import type { Language } from './translations';

type Copy = {
  flaskTitle: string; flaskCatalog: string; flaskExplanation: string; flaskRecipe: string; flaskNoPrice: string;
  hotTitle: string; hotExplanation: string;
};
export const marketDetailCopy: Record<Language, Copy> = {
  ru: {
    flaskTitle: 'Фляги', flaskCatalog: 'Каталог фляг',
    flaskExplanation: 'Фляга применяется в сети: одна фляга сжигается и возвращает энергию по тиру — от 5 до 20 единиц, не выше потолка бака. Других эффектов у фляг нет: обещанные раньше баффы в программе не объявлены. Цен и продавцов здесь нет — только каталог продуктов рецептов.',
    flaskRecipe: 'Выпускается рецептом; применение: +5…+20 энергии', flaskNoPrice: 'Цены нет',
    hotTitle: 'Событийный рынок',
    hotExplanation: 'Пул покупает и продаёт инструменты по цене, которую считает программа: спрос поднимает цену, простой её опускает, событие добавляет множитель. Панель показывает только то, что читается из сети.',
  },
  en: {
    flaskTitle: 'Vials', flaskCatalog: 'Vial catalog',
    flaskExplanation: 'A vial is used on-chain: one vial is burned and returns energy by tier — 5 to 20 units, never above the tank cap. There are no other effects: the buffs once promised are not declared in the program. There are no prices or sellers here, only the recipe products.',
    flaskRecipe: 'Crafted from a recipe; use: +5…+20 energy', flaskNoPrice: 'No price',
    hotTitle: 'Event market',
    hotExplanation: 'The pool buys and sells tools at a price the program computes: demand raises it, idle time lowers it, an event adds a multiplier. The panel shows only what it reads from the network.',
  },
  pt: {
    flaskTitle: 'Frascos', flaskCatalog: 'Catálogo de frascos',
    flaskExplanation: 'O frasco é usado na rede: um frasco é queimado e devolve energia por nível — de 5 a 20 unidades, nunca acima do limite do tanque. Não há outros efeitos: os bônus antes prometidos não estão declarados no programa. Aqui não há preços nem vendedores: apenas produtos das receitas.',
    flaskRecipe: 'Produzido por receita; uso: +5…+20 de energia', flaskNoPrice: 'Sem preço',
    hotTitle: 'Mercado de eventos',
    hotExplanation: 'O pool compra e vende ferramentas pelo preço que o programa calcula: a procura sobe o preço, o tempo parado baixa, o evento acrescenta um multiplicador. O painel mostra apenas o que lê da rede.',
  },
  es: {
    flaskTitle: 'Frascos', flaskCatalog: 'Catálogo de frascos',
    flaskExplanation: 'El frasco se usa en la red: se quema un frasco y devuelve energía según el nivel — de 5 a 20 unidades, nunca por encima del límite del tanque. No hay otros efectos: los bonos prometidos antes no están declarados en el programa. Aquí no hay precios ni vendedores: solo productos de recetas.',
    flaskRecipe: 'Se fabrica con una receta; uso: +5…+20 de energía', flaskNoPrice: 'Sin precio',
    hotTitle: 'Mercado de eventos',
    hotExplanation: 'El pool compra y vende herramientas al precio que calcula el programa: la demanda lo sube, el tiempo inactivo lo baja y el evento añade un multiplicador. El panel muestra solo lo que lee de la red.',
  },
  vi: {
    flaskTitle: 'Các lọ', flaskCatalog: 'Danh mục lọ',
    flaskExplanation: 'Lọ được dùng trên mạng: một lọ bị đốt và trả lại năng lượng theo bậc — từ 5 đến 20 đơn vị, không vượt quá giới hạn bình chứa. Không có hiệu ứng nào khác: các buff từng hứa không được khai báo trong chương trình. Ở đây không có giá hay người bán, chỉ có sản phẩm từ công thức.',
    flaskRecipe: 'Chế tạo theo công thức; dùng: +5…+20 năng lượng', flaskNoPrice: 'Chưa có giá',
    hotTitle: 'Chợ sự kiện',
    hotExplanation: 'Pool mua và bán công cụ theo mức giá do chương trình tính: nhu cầu đẩy giá lên, thời gian nhàn rỗi hạ giá xuống, sự kiện thêm hệ số. Bảng chỉ hiển thị những gì đọc được từ mạng.',
  },
  id: {
    flaskTitle: 'Botol', flaskCatalog: 'Katalog botol',
    flaskExplanation: 'Botol dipakai di jaringan: satu botol dibakar dan mengembalikan energi sesuai tingkat — 5 sampai 20 unit, tidak melebihi batas tangki. Tidak ada efek lain: buff yang pernah dijanjikan tidak dinyatakan dalam program. Di sini belum ada harga atau penjual, hanya produk resep.',
    flaskRecipe: 'Dibuat dengan resep; pakai: +5…+20 energi', flaskNoPrice: 'Belum ada harga',
    hotTitle: 'Pasar acara',
    hotExplanation: 'Pool membeli dan menjual peralatan dengan harga yang dihitung program: permintaan menaikkan harga, waktu menganggur menurunkannya, acara menambah pengali. Panel hanya menampilkan apa yang dibaca dari jaringan.',
  },
  fil: {
    flaskTitle: 'Mga bote', flaskCatalog: 'Katalogo ng bote',
    flaskExplanation: 'Ginagamit ang bote sa network: sinusunog ang isang bote at nagbabalik ng enerhiya ayon sa antas — 5 hanggang 20 na yunit, hindi lalampas sa takda ng tangke. Walang ibang epekto: ang mga buff na ipinangako noon ay hindi nakasaad sa programa. Wala pang presyo o nagbebenta rito, mga produktong galing sa resipe lamang.',
    flaskRecipe: 'Ginagawa sa resipe; gamit: +5…+20 enerhiya', flaskNoPrice: 'Wala pang presyo',
    hotTitle: 'Pamilihan ng event',
    hotExplanation: 'Ang pool ay bumibili at nagbebenta ng kagamitan sa presyong kinukuwenta ng programa: pinapataas ng pangangailangan, pinapababa ng walang galaw, may dagdag na multiplier ang event. Ipinapakita ng panel ang nababasa lamang mula sa network.',
  },
};
