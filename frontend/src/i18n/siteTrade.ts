import type { Language } from './translations';

export type TradeGuide = {
  lead: string; paragraphs: readonly [string, string]; heading: string;
  checksHeading: string; checks: readonly [string, string, string, string]; note: string;
};

/** Editorial due diligence, not a quote, a trading interface or a return estimate. */
export const siteTrade: Record<Language, TradeGuide> = {
  ru: {
    lead: 'Сначала условия и доступность — потом решение о сделке.',
    paragraphs: ['Шесть форматов ниже — справочник, а не предложение купить или продать. Сайт не читает текущие котировки, остатки и состояние отдельных лотов.', 'Новые заявки и сведение в книге заявок приостановлены. Событийный рынок инструментов закрыт; описание аукциона, предложения или аренды не доказывает, что там сейчас можно торговать.'],
    heading: 'Шесть форматов · что проверять', checksHeading: 'Перед подписью',
    checks: ['Проверь сеть, адрес сайта, владельца предмета и свой кошелёк.', 'Сравни предмет, получателя, точную сумму и комиссии с запросом кошелька.', 'При сбое чтения не считай рынок пустым или стоимость нулевой.', 'Отправка транзакции не означает её подтверждения или возврата средств.'],
    note: 'Нет гарантии дохода, выгодной цены, исполнения или возврата. Не используй старые инструкции по размещению заявок и обещания пассивного дохода.',
  },
  en: {
    lead: 'Check the terms and availability before deciding whether to trade.',
    paragraphs: ['The six formats below are a guide, not an invitation to buy or sell. This site does not read live quotes, balances or individual listings.', 'New order-book orders and matching are paused. Tool trading on the event market is closed; an auction, offer or rental described here is not proof that you can trade there now.'],
    heading: 'Six formats · what to check', checksHeading: 'Before signing',
    checks: ['Check the network, site address, item owner and your wallet.', 'Compare the item, recipient, exact amount and fees with the wallet request.', 'A failed read does not mean an empty market or a zero price.', 'Submitting a transaction is not confirmation or a refund.'],
    note: 'No return, good price, execution or refund is guaranteed. Do not follow old order-placement instructions or promises of passive income.',
  },
  pt: {
    lead: 'Confere as condições e a disponibilidade antes de decidir negociar.',
    paragraphs: ['As seis formas abaixo são um guia, não um convite para comprar ou vender. O site não consulta cotações, saldos ou anúncios individuais em tempo real.', 'Novas ordens e cruzamentos no livro de ordens estão suspensos. A negociação de ferramentas no mercado de eventos está fechada; descrever leilões, propostas ou locações não prova que estejam disponíveis agora.'],
    heading: 'Seis formas · o que verificar', checksHeading: 'Antes de assinar',
    checks: ['Confere a rede, o endereço do site, o dono do item e a tua carteira.', 'Compara o item, destinatário, valor exato e taxas com o pedido da carteira.', 'Falha na leitura não significa mercado vazio nem preço zero.', 'Enviar uma transação não é confirmação nem reembolso.'],
    note: 'Não há garantia de rendimento, preço favorável, execução ou reembolso. Não sigas instruções antigas para criar ordens nem promessas de rendimento passivo.',
  },
  es: {
    lead: 'Comprueba las condiciones y la disponibilidad antes de decidir comerciar.',
    paragraphs: ['Las seis formas siguientes son una guía, no una invitación a comprar o vender. Esta web no consulta precios, saldos ni anuncios concretos en tiempo real.', 'Se han suspendido las nuevas órdenes y los cruces del libro. El comercio de herramientas en el mercado de eventos está cerrado; describir subastas, ofertas o alquileres no demuestra que estén disponibles ahora.'],
    heading: 'Seis formas · qué comprobar', checksHeading: 'Antes de firmar',
    checks: ['Comprueba la red, la dirección web, el propietario del objeto y tu cartera.', 'Compara el objeto, destinatario, importe exacto y comisiones con la solicitud de la cartera.', 'Un fallo de lectura no equivale a un mercado vacío ni a un precio cero.', 'Enviar una transacción no equivale a confirmarla ni a recibir un reembolso.'],
    note: 'No se garantizan ganancias, buenos precios, ejecución ni reembolsos. No sigas instrucciones antiguas para colocar órdenes ni promesas de ingresos pasivos.',
  },
  vi: {
    lead: 'Kiểm tra điều kiện và tính khả dụng trước khi quyết định giao dịch.',
    paragraphs: ['Sáu hình thức dưới đây là tài liệu hướng dẫn, không phải lời mời mua bán. Trang web không đọc giá, số dư hay tin rao cụ thể theo thời gian thực.', 'Lệnh mới và khớp lệnh trong sổ lệnh đang tạm dừng. Chợ sự kiện đóng giao dịch công cụ; việc mô tả đấu giá, đề nghị hay cho thuê không chứng minh chúng hiện có thể dùng.'],
    heading: 'Sáu hình thức · cần kiểm tra gì', checksHeading: 'Trước khi ký',
    checks: ['Kiểm tra mạng, địa chỉ trang web, chủ sở hữu vật phẩm và ví của bạn.', 'Đối chiếu vật phẩm, người nhận, số tiền chính xác và phí với yêu cầu của ví.', 'Lỗi đọc dữ liệu không có nghĩa chợ trống hay giá bằng không.', 'Gửi giao dịch chưa phải là xác nhận hoặc hoàn tiền.'],
    note: 'Không bảo đảm lợi nhuận, giá tốt, khớp lệnh hay hoàn tiền. Đừng theo hướng dẫn đặt lệnh cũ hoặc lời hứa thu nhập thụ động.',
  },
  id: {
    lead: 'Periksa ketentuan dan ketersediaan sebelum memutuskan berdagang.',
    paragraphs: ['Enam cara di bawah ini adalah panduan, bukan ajakan membeli atau menjual. Situs ini tidak membaca harga, saldo, atau lapak tertentu secara langsung.', 'Pesanan baru dan pencocokan buku pesanan ditunda. Perdagangan peralatan di pasar acara ditutup; uraian tentang lelang, penawaran, atau sewa bukan bukti bahwa semuanya dapat digunakan sekarang.'],
    heading: 'Enam cara · yang perlu diperiksa', checksHeading: 'Sebelum tanda tangan',
    checks: ['Periksa jaringan, alamat situs, pemilik barang, dan dompetmu.', 'Bandingkan barang, penerima, jumlah pasti, dan biaya dengan permintaan dompet.', 'Gagal membaca data bukan berarti pasar kosong atau harga nol.', 'Mengirim transaksi bukan bukti konfirmasi atau pengembalian dana.'],
    note: 'Keuntungan, harga baik, eksekusi, dan pengembalian dana tidak dijamin. Jangan ikuti petunjuk lama untuk membuat pesanan atau janji penghasilan pasif.',
  },
  fil: {
    lead: 'Suriin muna ang mga kondisyon at kung available bago magpasya sa kalakalan.',
    paragraphs: ['Gabay ang anim na paraan sa ibaba, hindi paanyayang bumili o magbenta. Hindi kumukuha ang site ng kasalukuyang presyo, balanse, o partikular na listahan.', 'Nakatigil ang mga bagong order at pagtutugma sa talaan. Sarado ang kalakalan ng kagamitan sa pamilihan ng event; hindi patunay ng kasalukuyang availability ang paglalarawan ng subasta, alok, o upa.'],
    heading: 'Anim na paraan · mga dapat suriin', checksHeading: 'Bago lumagda',
    checks: ['Suriin ang network, address ng site, may-ari ng item, at iyong wallet.', 'Ihambing ang item, tatanggap, eksaktong halaga, at bayarin sa kahilingan ng wallet.', 'Hindi ibig sabihin ng bigong pagbasa na walang alok o sero ang presyo.', 'Ang pagpapadala ng transaksyon ay hindi kumpirmasyon o refund.'],
    note: 'Hindi garantisado ang kita, magandang presyo, katuparan, o refund. Huwag sundin ang lumang gabay sa paglalagay ng order o pangako ng pasibong kita.',
  },
};
