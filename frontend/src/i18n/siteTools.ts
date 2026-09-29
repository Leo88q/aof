import type { Language } from './translations';

type ToolsArticle = {
  lead: string; paragraphs: readonly [string, string];
  rarityHeading: string; rarityDescriptions: readonly [string, string, string, string, string]; rarityNotice: string;
  galleryHeading: string; galleryIntro: string; galleryNotice: string;
};

/** Illustrations of five tool types and rarities; not a reading of the connected wallet. */
export const siteTools: Record<Language, ToolsArticle> = {
  ru: {
    lead: 'Пять типов, пять редкостей — инструменты мастерской в рисунках.',
    paragraphs: ['Каждый тип показан в пяти исполнениях. Пластины ниже — иллюстрации каталога, не инвентарь подключённого кошелька и не предложение о продаже.', 'Проверяй в игре наличие инструмента, прочность и условия сборки или ремонта. Добыча сейчас приостановлена до проверки правил в сети; картинки не означают, что её можно запустить.'],
    rarityHeading: 'Пять редкостей — пять характеров',
    rarityDescriptions: ['Простая сборка и прямой рабочий край: с неё начинается история мастера.', 'Рукоять и металл обретают свой почерк; мастер учится видеть детали.', 'На стали проступают узоры, будто линии на карте будущей работы.', 'Форма становится сложнее: между привычным ремеслом и легендой остаётся шаг.', 'Редкое исполнение завершает ряд; ценность и свойства всё равно проверяются по конкретному инструменту.'],
    rarityNotice: 'Рисунок редкости не подтверждает свойства, доходность или владение NFT.',
    galleryHeading: 'Пять типов · двадцать пять иллюстраций', galleryIntro: 'Сравни изображения пяти типов в пяти исполнениях. Это галерея, а не список предметов в кошельке.', galleryNotice: 'Наличие NFT, его характеристики и доступность действий проверяй в игре и сети, не по изображению.',
  },
  en: {
    lead: 'Five types, five rarities: a picture guide to the workshop’s tools.',
    paragraphs: ['Each tool type is shown in five styles. The plates below illustrate a catalog, not your connected wallet’s inventory or a sale offer.', 'Check ownership, durability and crafting or repair terms in the game. Mining is currently paused pending verification of the on-chain rules; these pictures do not mean you can start it.'],
    rarityHeading: 'Five rarities, five characters',
    rarityDescriptions: ['A plain build with an honest edge: where a craftsperson’s story begins.', 'Handle and metal find their own voice; the maker learns to notice detail.', 'Patterns emerge in the steel, like paths on a map of work yet to come.', 'The silhouette grows intricate, a step between familiar craft and legend.', 'The rarest style completes the set; always check the actual tool for value and properties.'],
    rarityNotice: 'A rarity illustration does not prove NFT properties, profit or ownership.',
    galleryHeading: 'Five types · twenty-five illustrations', galleryIntro: 'Compare five tool types in five styles. This is a gallery, not a list of items in your wallet.', galleryNotice: 'Check NFT ownership, attributes and available actions in the game and on-chain, not from a picture.',
  },
  pt: {
    lead: 'Cinco tipos, cinco raridades: as ferramentas da oficina em imagens.',
    paragraphs: ['Cada tipo de ferramenta aparece em cinco estilos. As imagens abaixo ilustram um catálogo, não o inventário da tua carteira nem uma oferta de venda.', 'Confere no jogo a posse, a durabilidade e as condições de criação ou reparação. A extração está suspensa até serem verificadas as regras na rede; as imagens não significam que já podes iniciá-la.'],
    rarityHeading: 'Cinco raridades, cinco personalidades',
    rarityDescriptions: ['Uma construção simples e um fio honesto: é aqui que começa o percurso do artesão.', 'O cabo e o metal ganham voz própria; o mestre aprende a reparar nos detalhes.', 'Os padrões surgem no aço como caminhos num mapa do trabalho por vir.', 'A forma torna-se mais elaborada: entre o ofício conhecido e a lenda falta um passo.', 'O estilo mais raro fecha a série; confere sempre o valor e as propriedades da ferramenta real.'],
    rarityNotice: 'Uma imagem de raridade não comprova propriedades, lucro ou posse de um NFT.',
    galleryHeading: 'Cinco tipos · vinte e cinco imagens', galleryIntro: 'Compara os cinco tipos de ferramenta em cinco estilos. É uma galeria, não uma lista de itens da tua carteira.', galleryNotice: 'Confere a posse, os atributos e as ações disponíveis no jogo e na rede, não através de uma imagem.',
  },
  es: {
    lead: 'Cinco tipos, cinco rarezas: las herramientas del taller en imágenes.',
    paragraphs: ['Cada tipo de herramienta aparece en cinco estilos. Las láminas de abajo ilustran un catálogo, no el inventario de tu cartera ni una oferta de venta.', 'Comprueba en el juego la propiedad, la durabilidad y las condiciones de fabricación o reparación. La extracción está suspendida hasta verificar las reglas de la cadena; las imágenes no significan que puedas iniciarla.'],
    rarityHeading: 'Cinco rarezas, cinco caracteres',
    rarityDescriptions: ['Una construcción sencilla y un filo franco: así empieza la historia de quien trabaja el metal.', 'El mango y el metal encuentran su propia voz; el maestro aprende a mirar los detalles.', 'Los patrones asoman en el acero como caminos sobre un mapa del trabajo venidero.', 'La silueta gana complejidad: queda un paso entre el oficio conocido y la leyenda.', 'El estilo más raro cierra la serie; comprueba siempre el valor y las propiedades de la herramienta real.'],
    rarityNotice: 'La ilustración de una rareza no demuestra propiedades, beneficios ni propiedad de un NFT.',
    galleryHeading: 'Cinco tipos · veinticinco imágenes', galleryIntro: 'Compara cinco tipos de herramienta en cinco estilos. Es una galería, no una lista de objetos de tu cartera.', galleryNotice: 'Comprueba la propiedad, los atributos y las acciones disponibles en el juego y en la cadena, no por una imagen.',
  },
  vi: {
    lead: 'Năm loại, năm độ hiếm: khám phá công cụ của xưởng qua hình ảnh.',
    paragraphs: ['Mỗi loại công cụ được minh họa bằng năm kiểu. Những hình bên dưới là danh mục hình ảnh, không phải kho đồ trong ví hay lời chào bán.', 'Hãy kiểm tra quyền sở hữu, độ bền và điều kiện chế tạo hoặc sửa chữa trong trò chơi. Tính năng khai thác hiện tạm dừng để xác minh quy tắc trên chuỗi; các hình này không có nghĩa là bạn có thể bắt đầu khai thác.'],
    rarityHeading: 'Năm độ hiếm, năm dáng vẻ',
    rarityDescriptions: ['Kết cấu giản dị, lưỡi dao mộc mạc: khởi đầu câu chuyện của người thợ.', 'Tay cầm và kim loại dần có dấu ấn riêng; người thợ học cách nhìn vào chi tiết.', 'Hoa văn hiện lên trên thép như những con đường trên bản đồ của công việc phía trước.', 'Dáng hình thêm tinh xảo, đứng giữa nghề quen thuộc và một huyền thoại.', 'Kiểu hiếm nhất khép lại bộ sưu tập; hãy kiểm tra giá trị và thuộc tính của từng công cụ thật.'],
    rarityNotice: 'Hình minh họa độ hiếm không chứng minh thuộc tính, lợi nhuận hay quyền sở hữu NFT.',
    galleryHeading: 'Năm loại · hai mươi lăm hình minh họa', galleryIntro: 'So sánh năm loại công cụ ở năm kiểu. Đây là phòng trưng bày, không phải danh sách vật phẩm trong ví.', galleryNotice: 'Kiểm tra quyền sở hữu NFT, thuộc tính và hành động khả dụng trong trò chơi và trên chuỗi, đừng dựa vào hình ảnh.',
  },
  id: {
    lead: 'Lima jenis, lima kelangkaan: peralatan bengkel dalam gambar.',
    paragraphs: ['Setiap jenis peralatan ditampilkan dalam lima gaya. Gambar di bawah adalah ilustrasi katalog, bukan inventaris dompetmu atau penawaran jual.', 'Periksa kepemilikan, daya tahan, dan ketentuan perakitan atau perbaikan di permainan. Penambangan sedang dihentikan sampai aturan di blockchain diverifikasi; gambar ini bukan tanda bahwa kamu bisa memulainya.'],
    rarityHeading: 'Lima kelangkaan, lima watak',
    rarityDescriptions: ['Rancangan sederhana dan mata yang lugas: awal kisah seorang perajin.', 'Gagang dan logam menemukan cirinya sendiri; pembuatnya belajar memperhatikan detail.', 'Pola muncul di baja bagaikan jalan pada peta pekerjaan yang akan datang.', 'Bentuknya makin rumit, tinggal selangkah antara kerajinan biasa dan legenda.', 'Gaya terlangka menutup rangkaian; selalu periksa nilai dan sifat peralatan aslinya.'],
    rarityNotice: 'Gambar kelangkaan bukan bukti sifat NFT, keuntungan, atau kepemilikan.',
    galleryHeading: 'Lima jenis · dua puluh lima gambar', galleryIntro: 'Bandingkan lima jenis peralatan dalam lima gaya. Ini galeri, bukan daftar barang di dompetmu.', galleryNotice: 'Periksa kepemilikan NFT, atribut, dan tindakan yang tersedia di permainan dan blockchain, bukan dari gambar.',
  },
  fil: {
    lead: 'Limang uri, limang antas ng pambihira: larawan ng kagamitan sa pagawaan.',
    paragraphs: ['May limang estilo ang bawat uri ng kagamitan. Mga larawan ng katalogo ang nasa ibaba, hindi imbentaryo ng iyong wallet o alok na pagbebenta.', 'Suriin sa laro ang pagmamay-ari, tibay, at kundisyon sa paggawa o pagkukumpuni. Nakatigil muna ang pagmimina habang sinusuri ang mga tuntunin sa blockchain; hindi ibig sabihin ng mga larawang ito na maaari na itong simulan.'],
    rarityHeading: 'Limang antas ng pambihira, limang anyo',
    rarityDescriptions: ['Payak na pagkakayari at tuwid na talim: dito nagsisimula ang kuwento ng bihasang kamay.', 'Nagkakaroon ng sariling katangian ang hawakan at metal; natututuhan ng panday ang maliliit na detalye.', 'Lumilitaw ang mga guhit sa bakal na tila mga daan sa mapa ng susunod na gawain.', 'Mas nagiging masalimuot ang anyo, nasa pagitan ng karaniwang likha at alamat.', 'Ang pinakabihirang estilo ang huli sa hanay; suriin pa rin ang halaga at katangian ng tunay na kagamitan.'],
    rarityNotice: 'Hindi patunay ng katangian, kita, o pagmamay-ari ng NFT ang larawan ng antas ng pambihira.',
    galleryHeading: 'Limang uri · dalawampu’t limang larawan', galleryIntro: 'Ihambing ang limang uri ng kagamitan sa limang estilo. Galeriya ito, hindi listahan ng mga gamit sa wallet mo.', galleryNotice: 'Suriin sa laro at blockchain ang pagmamay-ari, katangian, at mga magagamit na aksiyon, hindi sa larawan.',
  },
};
