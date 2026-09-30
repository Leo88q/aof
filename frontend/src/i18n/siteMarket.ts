import type { Language } from './translations';

export const marketVenueIds = ['listing', 'orderbook', 'auction', 'offer', 'rental', 'hotMarket'] as const;
export type MarketVenueId = typeof marketVenueIds[number];
type MarketArticle = {
  lead: string; paragraphs: readonly [string, string]; heading: string;
  venues: Record<MarketVenueId, string>; note: string;
};

/** Static venue guide, never a live quotation, order book or trade confirmation. */
export const siteMarket: Record<Language, MarketArticle> = {
  ru: {
    lead: 'У каждого прилавка свой риск; цену и условия подтверждает сеть.',
    paragraphs: ['Здесь — карта торговых форматов, а не витрина действующих предложений. Сайт не читает цены и не отправляет сделки: перед подписью проверяй данные игры и кошелька.', 'Новые заявки и сведение книги заявок приостановлены из-за ошибки единиц цены; событийный рынок закрыт до безопасной передачи инструмента. Остальные площадки не следует считать открытыми только потому, что они описаны здесь.'],
    heading: 'Торговые форматы и ограничения',
    venues: {
      listing: 'Фиксированная цена указана в конкретном листинге. Сверь инструмент, владельца и точную сумму в игре и кошельке — описание здесь не продаёт предмет.',
      orderbook: 'Новые заявки и их сведение отключены. Старые сетевые заявки можно просмотреть и отменить в игре; не подписывай размещение по старой форме цены.',
      auction: 'Ставки и расчёт зависят от состояния конкретного аукциона. Эта статья не подтверждает открытый лот, победу или возврат проигравшей ставки.',
      offer: 'Предложенная цена не означает состоявшуюся сделку. Прежде чем что-либо подписать, проверь инструмент, получателя и полную стоимость.',
      rental: 'Аренда зависит от условий отдельного соглашения: срока, платы и доли владельца. Иллюстрация не подтверждает доступность инструмента.',
      hotClosed: 'Событийный рынок работает внутри приложения: пул покупает и продаёт инструменты по цене, которую считает программа. Эта страница не принимает ордера.',
    },
    note: 'Нет живых котировок, гарантий дохода или автоматического возврата. Ошибку чтения сети нельзя принимать за пустой рынок.',
  },
  en: {
    lead: 'Each market stall carries its own risk; the network establishes the price and terms.',
    paragraphs: ['This is a map of trading formats, not a live order feed. The site neither reads prices nor submits trades: check the game and your wallet before signing.', 'New order-book orders and matching are paused due to a price-unit mismatch; the event market is closed pending safe tool transfer. Other venues are not necessarily open just because they appear here.'],
    heading: 'Trading formats and limits',
    venues: {
      listing: 'A fixed price belongs to a specific listing. Check the tool, owner and exact amount in the game and wallet; this description does not sell an item.',
      orderbook: 'New orders and matching are disabled. You can inspect and cancel existing on-chain orders in the game; do not sign a placement using the old price form.',
      auction: 'Bids and settlement depend on the particular auction’s status. This article does not confirm an open lot, a win or a losing-bid refund.',
      offer: 'A proposed price is not a completed deal. Before signing anything, check the tool, recipient and full cost.',
      rental: 'A rental depends on its own agreement: duration, fee and owner’s share. An illustration does not confirm that a tool is available.',
      hotClosed: 'The event market runs inside the app: the pool buys and sells tools at a price the program computes. This page does not take orders.',
    },
    note: 'No live quotes, guaranteed returns or automatic refunds are shown. A network read failure is not an empty market.',
  },
  pt: {
    lead: 'Cada banca tem o seu risco; a rede é que confirma o preço e as condições.',
    paragraphs: ['Este é um mapa das formas de negociar, não uma lista de ofertas em tempo real. O site não consulta preços nem envia transações: verifica o jogo e a carteira antes de assinar.', 'As novas ordens e o cruzamento do livro de ordens estão suspensos devido a uma divergência nas unidades de preço; o mercado de eventos aguarda a transferência segura de ferramentas. Os outros espaços não estão necessariamente abertos só porque aparecem aqui.'],
    heading: 'Formas de negociar e seus limites',
    venues: {
      listing: 'O preço fixo pertence a um anúncio específico. Confere a ferramenta, o proprietário e o valor exato no jogo e na carteira; este texto não vende objetos.',
      orderbook: 'Novas ordens e cruzamentos estão desativados. Podes consultar e cancelar ordens existentes no jogo; não assines um envio com o formulário de preços antigo.',
      auction: 'Lances e liquidação dependem do estado de cada leilão. Este artigo não confirma um lote aberto, uma vitória ou o reembolso de um lance perdido.',
      offer: 'Propor um preço não conclui uma venda. Antes de assinar, verifica a ferramenta, o destinatário e o custo total.',
      rental: 'Uma locação depende do acordo: duração, custo e parte do proprietário. Uma imagem não comprova que a ferramenta está disponível.',
      hotClosed: 'O mercado de eventos funciona dentro do aplicativo: o pool compra e vende ferramentas pelo preço que o programa calcula. Esta página não recebe ordens.',
    },
    note: 'Não há preços em tempo real, rendimento garantido nem reembolsos automáticos. Falha na leitura da rede não significa mercado vazio.',
  },
  es: {
    lead: 'Cada puesto tiene su riesgo; la red confirma el precio y las condiciones.',
    paragraphs: ['Este es un mapa de formas de comerciar, no un listado de ofertas en tiempo real. La web no consulta precios ni envía operaciones: comprueba el juego y tu cartera antes de firmar.', 'Las nuevas órdenes y los cruces del libro están suspendidos por una discrepancia en las unidades del precio; el mercado de eventos espera una transferencia segura de herramientas. Los demás espacios no están necesariamente abiertos por aparecer aquí.'],
    heading: 'Formas de comerciar y sus límites',
    venues: {
      listing: 'El precio fijo pertenece a un anuncio concreto. Revisa la herramienta, el dueño y el importe exacto en el juego y en tu cartera; esta descripción no vende objetos.',
      orderbook: 'Las nuevas órdenes y su cruce están desactivados. Puedes consultar y cancelar órdenes existentes en el juego; no firmes una orden mediante el antiguo formulario de precios.',
      auction: 'Pujas y liquidaciones dependen del estado de cada subasta. Este artículo no confirma que haya un lote abierto, una victoria o el reembolso de una puja perdedora.',
      offer: 'Proponer un precio no cierra una operación. Antes de firmar, comprueba la herramienta, el destinatario y el coste total.',
      rental: 'Un alquiler depende de su propio acuerdo: plazo, coste y parte del propietario. Una imagen no confirma que la herramienta esté disponible.',
      hotClosed: 'El mercado de eventos funciona dentro de la aplicación: el pool compra y vende herramientas al precio que calcula el programa. Esta página no acepta órdenes.',
    },
    note: 'No hay cotizaciones en directo, ganancias garantizadas ni reembolsos automáticos. Un fallo al leer la red no equivale a un mercado vacío.',
  },
  vi: {
    lead: 'Mỗi gian hàng đều có rủi ro riêng; giá và điều kiện do dữ liệu mạng xác nhận.',
    paragraphs: ['Đây là bản đồ các hình thức giao dịch, không phải danh sách lệnh trực tiếp. Trang web không đọc giá hay gửi giao dịch: hãy kiểm tra trò chơi và ví trước khi ký.', 'Lệnh mới và khớp lệnh trong sổ lệnh bị tạm dừng do sai lệch đơn vị giá; chợ sự kiện đóng cho đến khi công cụ được chuyển an toàn. Các khu khác không nhất thiết đang mở chỉ vì được giới thiệu ở đây.'],
    heading: 'Hình thức giao dịch và giới hạn',
    venues: {
      listing: 'Giá cố định thuộc về một tin rao cụ thể. Kiểm tra công cụ, chủ sở hữu và số tiền chính xác trong trò chơi và ví; bài viết này không bán vật phẩm.',
      orderbook: 'Đã tắt lệnh mới và khớp lệnh. Bạn có thể xem và hủy lệnh cũ trên chuỗi trong trò chơi; đừng ký lệnh qua biểu mẫu giá cũ.',
      auction: 'Trả giá và quyết toán tùy thuộc trạng thái của từng phiên đấu giá. Bài viết này không xác nhận lô hàng đang mở, chiến thắng hay hoàn tiền cho giá thầu thua.',
      offer: 'Đưa ra giá không có nghĩa là giao dịch đã hoàn tất. Trước khi ký, hãy kiểm tra công cụ, người nhận và toàn bộ chi phí.',
      rental: 'Việc thuê phụ thuộc vào từng thỏa thuận: thời hạn, phí và phần của chủ sở hữu. Hình minh họa không chứng minh công cụ đang cho thuê.',
      hotClosed: 'Chợ sự kiện hoạt động trong ứng dụng: pool mua và bán công cụ theo giá do chương trình tính. Trang này không nhận lệnh.',
    },
    note: 'Không có giá trực tiếp, lợi nhuận bảo đảm hay hoàn tiền tự động. Lỗi đọc mạng không có nghĩa chợ trống.',
  },
  id: {
    lead: 'Setiap lapak punya risiko sendiri; jaringanlah yang memastikan harga dan ketentuan.',
    paragraphs: ['Ini peta cara berdagang, bukan daftar penawaran langsung. Situs tidak membaca harga atau mengirim transaksi: periksa permainan dan dompet sebelum menandatangani.', 'Pesanan baru dan pencocokan buku pesanan ditunda karena ketidaksesuaian satuan harga; pasar acara ditutup sampai peralatan dapat dipindahkan dengan aman. Tempat lain belum tentu buka hanya karena disebut di sini.'],
    heading: 'Cara berdagang dan batasannya',
    venues: {
      listing: 'Harga tetap berlaku untuk sebuah lapak tertentu. Periksa peralatan, pemilik, dan jumlah persis di permainan dan dompet; uraian ini tidak menjual barang.',
      orderbook: 'Pesanan baru dan pencocokannya dimatikan. Kamu dapat melihat dan membatalkan pesanan lama di permainan; jangan tanda tangani pesanan melalui formulir harga lama.',
      auction: 'Tawaran dan penyelesaian bergantung pada status lelang tertentu. Artikel ini tidak mengonfirmasi lelang terbuka, kemenangan, atau pengembalian tawaran yang kalah.',
      offer: 'Mengajukan harga tidak berarti transaksi selesai. Sebelum menandatangani, periksa peralatan, penerima, dan seluruh biayanya.',
      rental: 'Sewa bergantung pada perjanjian masing-masing: durasi, biaya, dan bagian pemilik. Gambar tidak membuktikan peralatan sedang tersedia.',
      hotClosed: 'Pasar acara berjalan di dalam aplikasi: pool membeli dan menjual peralatan dengan harga yang dihitung program. Halaman ini tidak menerima pesanan.',
    },
    note: 'Tidak ada harga langsung, keuntungan terjamin, atau pengembalian dana otomatis. Gagal membaca jaringan bukan berarti pasar kosong.',
  },
  fil: {
    lead: 'May sariling panganib ang bawat puwesto; network ang nagpapatunay sa presyo at kondisyon.',
    paragraphs: ['Mapa ito ng mga paraan ng kalakalan, hindi listahan ng mga kasalukuyang alok. Hindi nagbabasa ng presyo o nagpapadala ng transaksyon ang site: tingnan ang laro at wallet bago pumirma.', 'Nakatigil ang bagong order at pagtutugma sa talaan dahil hindi nagtugma ang yunit ng presyo; sarado ang pamilihan ng event habang hindi pa ligtas ang paglipat ng kagamitan. Hindi ibig sabihin na bukas ang ibang pamilihan dahil lamang nakalista rito.'],
    heading: 'Mga paraan at hangganan ng kalakalan',
    venues: {
      listing: 'Para sa isang partikular na listahan ang takdang presyo. Suriin sa laro at wallet ang kagamitan, may-ari, at eksaktong halaga; hindi nagbebenta ng kagamitan ang artikulong ito.',
      orderbook: 'Nakatigil ang bagong order at pagtutugma. Maaari mong tingnan at kanselahin ang lumang on-chain order sa laro; huwag pumirma gamit ang dating pormularyo ng presyo.',
      auction: 'Nakadepende sa estado ng bawat subasta ang bid at pag-areglo. Hindi kinukumpirma ng artikulong ito ang bukas na lot, panalo, o refund ng natalong bid.',
      offer: 'Hindi pa tapos na kalakalan ang pag-alok ng presyo. Bago pumirma, suriin ang kagamitan, tatanggap, at kabuuang halaga.',
      rental: 'Nakabatay ang paupahan sa sariling kasunduan: tagal, bayad, at bahagi ng may-ari. Hindi patunay ng availability ang larawan.',
      hotClosed: 'Nasa loob ng app tumatakbo ang pamilihan ng event: bumibili at nagbebenta ang pool ng kagamitan sa presyong kinukuwenta ng programa. Hindi tumatanggap ng order ang pahinang ito.',
    },
    note: 'Walang live na presyo, garantisadong kita, o awtomatikong refund. Ang bigong pagbasa sa network ay hindi nangangahulugang walang alok.',
  },
};
