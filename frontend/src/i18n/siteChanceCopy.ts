import type { Language } from './translations';

type Guide = { lead: string; paragraphs: readonly string[]; demoTitle: string; guideTitle: string; steps: readonly [string, string, string]; note: string };
type PackDemo = {
  label: string; hint: string; sizeLegend: string; sizes: readonly [string, string, string]; samples: readonly [string, string, string, string];
  sealed: string; opened: (sample: string) => string; open: string; again: string;
};
type Copy = { packs: Guide; lottery: Guide; packDemo: PackDemo };

/** The site demos do not query a wallet, draw a ticket, or award an item. */
export const siteChanceCopy: Record<Language, Copy> = {
  ru: {
    packs: {
      lead: 'Капсулы: сначала условия в сети, потом решение.',
      paragraphs: ['Ниже можно открыть только иллюстрацию капсулы. Она не покупает предмет, не показывает сетевые шансы и не определяет результат игры.', 'Перед настоящим открытием в игре проверь доступность капсулы, цену, вероятности и данные транзакции в кошельке. Если сеть не отвечает, сайт не может подтвердить эти условия.'],
      demoTitle: 'Иллюстрация капсулы', guideTitle: 'Перед открытием в игре',
      steps: ['Сверь сетевую конфигурацию: размер, цену и вероятности каждого уровня.', 'Прочитай запрос подписи и предельную стоимость. Не подтверждай неожиданный расход.', 'После отправки проверь состояние открытия в игре и запись в сети; анимация не подтверждает получение NFT.'],
      note: 'Выбор размера в иллюстрации меняет лишь подпись. Образцы не отражают шансы или состав капсул в сети.',
    },
    lottery: {
      lead: 'Розыгрыш определяется записью в сети, не анимацией.',
      paragraphs: ['Эта страница не продаёт билет и не проводит розыгрыш. Текст здесь не связан с сетевым результатом.', 'Если собираешься участвовать в игре, сначала проверь текущий раунд, цену билета и условия получения или возврата средств. Если данные сети недоступны, не считай раунд открытым. Новые покупки пока приостановлены: инструкция сети не ограничивает цену перед подписью.'],
      demoTitle: 'Ритм без ставки', guideTitle: 'Перед участием в игре',
      steps: ['Проверь номер раунда, цену билета и доступность покупки в игре и кошельке.', 'Убедись, что транзакция соответствует ожидаемому действию; результат определяется сетью, не картинкой на сайте.', 'После розыгрыша проверяй состояние билета, возможность получения приза или возврата по сетевой записи.'],
      note: 'Надпись здесь не выдаёт билет, не подтверждает выигрыш и не возвращает средства.',
    },
    packDemo: { label: 'Местная иллюстрация · без покупки', sizeLegend: 'Размер на картинке', hint: 'Размеры и образцы здесь условные. Настоящую цену и шансы проверяй в игре перед подписью.', sizes: ['Мешочек', 'Футляр', 'Ящик'], samples: ['Образец для лунок', 'Набор схем', 'Кусочек кремния', 'Медная заготовка'], sealed: 'Иллюстрация закрыта.', opened: sample => `Образец: ${sample}. Это не выигрыш и не предмет в кошельке.`, open: 'Открыть иллюстрацию', again: 'Показать ещё' },
  },
  en: {
    packs: {
      lead: 'Capsules: check the on-chain terms before you decide.',
      paragraphs: ['The capsule below is only an illustration. It does not buy an item, display on-chain odds or determine an in-game result.', 'Before opening a real capsule in the game, check availability, price, odds and the transaction details in your wallet. If the network cannot be reached, this page cannot verify those terms.'],
      demoTitle: 'Capsule illustration', guideTitle: 'Before opening one in the game',
      steps: ['Check the on-chain configuration: capsule size, price and odds for each rarity.', 'Read the signature request and price ceiling. Decline unexpected charges.', 'After submitting, check the opening in the game and on-chain; an animation does not confirm NFT ownership.'],
      note: 'Changing the size here only changes the label. These samples do not represent on-chain odds or capsule contents.',
    },
    lottery: {
      lead: 'The on-chain record decides the draw, not an animation.',
      paragraphs: ['This page does not sell a ticket or run a draw. Nothing shown here is connected to an on-chain result.', 'If you want to join a round in the game, first check the current round, ticket price and claim or refund terms. If network data is unavailable, do not assume a round is open. New purchases are paused because the on-chain instruction has no wallet-bound price limit.'],
      demoTitle: 'A rhythm, not a wager', guideTitle: 'Before joining a game round',
      steps: ['Check the round number, ticket price and whether buying is available in the game and wallet.', 'Make sure the transaction matches the action you intended. The network, not this page, determines the outcome.', 'After the draw, check the ticket, claim or refund status against the on-chain record.'],
      note: 'The text here does not issue a ticket or confirm a win or refund.',
    },
    packDemo: { label: 'Local illustration · no purchase', sizeLegend: 'Illustrated size', hint: 'Sizes and samples are illustrative. Check real prices and odds in the game before signing.', sizes: ['Pouch', 'Case', 'Crate'], samples: ['Sample for a well', 'Bundle of circuits', 'Piece of silicon', 'Copper blank'], sealed: 'The illustration is closed.', opened: sample => `Sample: ${sample}. This is not a win or an item in your wallet.`, open: 'Open the illustration', again: 'Show another' },
  },
  pt: {
    packs: {
      lead: 'Cápsulas: confira as condições na rede antes de decidir.',
      paragraphs: ['A cápsula abaixo é apenas uma ilustração. Ela não compra itens, não mostra probabilidades reais nem determina resultados no jogo.', 'Antes de abrir uma cápsula de verdade no jogo, confira disponibilidade, preço, probabilidades e dados da transação na carteira. Se a rede estiver inacessível, esta página não pode confirmar essas condições.'],
      demoTitle: 'Ilustração de cápsula', guideTitle: 'Antes de abrir no jogo',
      steps: ['Confira a configuração na rede: tamanho, preço e probabilidades de cada raridade.', 'Leia a solicitação de assinatura e o limite do preço. Recuse cobranças inesperadas.', 'Depois do envio, confira a abertura no jogo e na rede; uma animação não comprova a posse do NFT.'],
      note: 'Mudar o tamanho aqui só altera o rótulo. Os exemplos não refletem probabilidades nem conteúdo das cápsulas na rede.',
    },
    lottery: {
      lead: 'O registro na rede, não a animação, decide o sorteio.',
      paragraphs: ['Esta página não vende bilhetes nem realiza sorteios. O texto aqui não está ligado ao resultado na rede.', 'Se quiser participar no jogo, confira primeiro a rodada atual, o preço do bilhete e as condições de resgate ou reembolso. Sem dados da rede, não presuma que a rodada está aberta. As novas compras estão suspensas: a instrução na rede não limita o preço antes da assinatura.'],
      demoTitle: 'Um ritmo sem aposta', guideTitle: 'Antes de participar no jogo',
      steps: ['Confira o número da rodada, o preço do bilhete e a disponibilidade de compra no jogo e na carteira.', 'Verifique se a transação corresponde ao que você deseja fazer. A rede, não esta página, determina o resultado.', 'Depois do sorteio, confira o bilhete e a possibilidade de resgate ou reembolso no registro da rede.'],
      note: 'O texto aqui não emite bilhetes nem confirma vitórias ou reembolsos.',
    },
    packDemo: { label: 'Ilustração local · sem compra', sizeLegend: 'Tamanho ilustrativo', hint: 'Tamanhos e exemplos são ilustrativos. Confira preços e probabilidades no jogo antes de assinar.', sizes: ['Bolsa', 'Estojo', 'Caixa'], samples: ['Amostra para um poço', 'Conjunto de circuitos', 'Pedaço de silício', 'Peça de cobre'], sealed: 'A ilustração está fechada.', opened: sample => `Exemplo: ${sample}. Não é um prêmio nem um item na sua carteira.`, open: 'Abrir a ilustração', again: 'Mostrar outro' },
  },
  es: {
    packs: {
      lead: 'Cápsulas: comprueba las condiciones en la cadena antes de decidir.',
      paragraphs: ['La cápsula de abajo es solo una ilustración. No compra objetos, no muestra probabilidades reales ni determina resultados en el juego.', 'Antes de abrir una cápsula en el juego, comprueba su disponibilidad, precio, probabilidades y datos de la transacción en tu cartera. Si la red no responde, esta página no puede confirmar esas condiciones.'],
      demoTitle: 'Ilustración de una cápsula', guideTitle: 'Antes de abrirla en el juego',
      steps: ['Consulta la configuración en la cadena: tamaño, precio y probabilidades de cada rareza.', 'Lee la solicitud de firma y el precio máximo. Rechaza los cargos inesperados.', 'Tras el envío, comprueba la apertura en el juego y en la cadena; una animación no acredita la posesión del NFT.'],
      note: 'Elegir otro tamaño aquí solo cambia el nombre. Estos ejemplos no reflejan las probabilidades ni el contenido de las cápsulas reales.',
    },
    lottery: {
      lead: 'El resultado lo determina el registro en la cadena, no una animación.',
      paragraphs: ['Esta página no vende billetes ni realiza sorteos. El texto aquí no está vinculado al resultado en la cadena.', 'Si quieres participar en el juego, comprueba antes la ronda actual, el precio del billete y las condiciones de cobro o devolución. Sin datos de la red, no des por hecho que la ronda está abierta. Las nuevas compras están suspendidas: la instrucción en la cadena no limita el precio antes de firmar.'],
      demoTitle: 'Un ritmo sin apuesta', guideTitle: 'Antes de participar en el juego',
      steps: ['Comprueba el número de ronda, el precio del billete y si puedes comprar en el juego y en tu cartera.', 'Asegúrate de que la transacción corresponda a tu intención. El resultado lo determina la red, no esta página.', 'Tras el sorteo, comprueba el billete y el estado de cobro o devolución en el registro de la cadena.'],
      note: 'El texto de aquí no emite billetes ni confirma premios o devoluciones.',
    },
    packDemo: { label: 'Ilustración local · sin compra', sizeLegend: 'Tamaño ilustrativo', hint: 'Tamaños y ejemplos son orientativos. Comprueba precios y probabilidades en el juego antes de firmar.', sizes: ['Bolsa', 'Estuche', 'Caja'], samples: ['Muestra para un pozo', 'Lote de circuitos', 'Pieza de silicio', 'Pieza de cobre'], sealed: 'La ilustración está cerrada.', opened: sample => `Ejemplo: ${sample}. No es un premio ni un objeto en tu cartera.`, open: 'Abrir la ilustración', again: 'Mostrar otro' },
  },
  vi: {
    packs: {
      lead: 'Hộp vật phẩm: kiểm tra điều kiện trên chuỗi trước khi quyết định.',
      paragraphs: ['Hộp bên dưới chỉ là hình minh họa. Nó không mua vật phẩm, không hiển thị xác suất trên chuỗi và không quyết định kết quả trong trò chơi.', 'Trước khi mở hộp thật trong trò chơi, hãy kiểm tra tính khả dụng, giá, xác suất và thông tin giao dịch trong ví. Nếu không kết nối được mạng, trang này không thể xác minh các điều kiện đó.'],
      demoTitle: 'Hình minh họa hộp vật phẩm', guideTitle: 'Trước khi mở trong trò chơi',
      steps: ['Kiểm tra cấu hình trên chuỗi: kích cỡ, giá và xác suất của từng độ hiếm.', 'Đọc yêu cầu ký và giới hạn giá. Từ chối khoản chi ngoài dự kiến.', 'Sau khi gửi, kiểm tra trạng thái mở hộp trong trò chơi và trên chuỗi; hình động không chứng minh bạn sở hữu NFT.'],
      note: 'Đổi kích cỡ ở đây chỉ đổi nhãn. Các ví dụ không phản ánh xác suất hay vật phẩm trong hộp trên chuỗi.',
    },
    lottery: {
      lead: 'Kết quả bốc thăm do bản ghi trên chuỗi quyết định, không phải hình động.',
      paragraphs: ['Trang này không bán vé và không tổ chức bốc thăm. Chữ trên trang không liên quan đến kết quả trên chuỗi.', 'Nếu muốn tham gia trong trò chơi, trước tiên hãy kiểm tra lượt hiện tại, giá vé và điều kiện nhận thưởng hoặc hoàn tiền. Nếu không có dữ liệu mạng, đừng coi lượt bốc thăm là đang mở. Hiện tạm dừng mua vé mới vì lệnh trên chuỗi không giới hạn giá trước khi ký.'],
      demoTitle: 'Không phải vé số', guideTitle: 'Trước khi tham gia trong trò chơi',
      steps: ['Kiểm tra số lượt, giá vé và khả năng mua trong trò chơi và ví.', 'Đảm bảo giao dịch đúng với ý định của bạn. Mạng lưới, không phải trang này, quyết định kết quả.', 'Sau lượt bốc thăm, kiểm tra vé và trạng thái nhận thưởng hoặc hoàn tiền theo bản ghi trên chuỗi.'],
      note: 'Dòng chữ ở đây không phát vé, không xác nhận thắng hay hoàn tiền.',
    },
    packDemo: { label: 'Hình minh họa tại máy · không mua', sizeLegend: 'Kích cỡ minh họa', hint: 'Kích cỡ và ví dụ chỉ để minh họa. Hãy kiểm tra giá và xác suất trong trò chơi trước khi ký.', sizes: ['Túi', 'Hộp nhỏ', 'Thùng'], samples: ['Mẫu cho ô nuôi cấy', 'Bó mạch điện', 'Mảnh silicon', 'Phôi đồng'], sealed: 'Hình minh họa chưa mở.', opened: sample => `Ví dụ: ${sample}. Đây không phải phần thưởng hay vật phẩm trong ví của bạn.`, open: 'Mở hình minh họa', again: 'Xem ví dụ khác' },
  },
  id: {
    packs: {
      lead: 'Kapsul: periksa ketentuan di blockchain sebelum memutuskan.',
      paragraphs: ['Kapsul di bawah ini hanya ilustrasi. Ini tidak membeli barang, tidak menampilkan peluang di blockchain, dan tidak menentukan hasil dalam permainan.', 'Sebelum membuka kapsul sungguhan dalam permainan, periksa ketersediaan, harga, peluang, dan rincian transaksi di dompetmu. Jika jaringan tidak dapat diakses, halaman ini tidak dapat memverifikasi ketentuan tersebut.'],
      demoTitle: 'Ilustrasi kapsul', guideTitle: 'Sebelum membuka kapsul dalam permainan',
      steps: ['Periksa konfigurasi di blockchain: ukuran, harga, dan peluang setiap kelangkaan.', 'Baca permintaan tanda tangan dan batas harga. Tolak biaya yang tidak kamu harapkan.', 'Setelah mengirim, periksa pembukaan di permainan dan di blockchain; animasi tidak membuktikan kepemilikan NFT.'],
      note: 'Mengganti ukuran di sini hanya mengubah label. Contoh-contoh ini tidak mencerminkan peluang atau isi kapsul di blockchain.',
    },
    lottery: {
      lead: 'Hasil undian ditentukan catatan di blockchain, bukan animasi.',
      paragraphs: ['Halaman ini tidak menjual tiket dan tidak menjalankan undian. Teks di sini tidak terkait dengan hasil di blockchain.', 'Jika ingin ikut dalam permainan, periksa dulu putaran saat ini, harga tiket, serta ketentuan klaim atau pengembalian dana. Jika data jaringan tidak tersedia, jangan menganggap putaran sedang dibuka. Pembelian baru dihentikan karena instruksi di blockchain tidak membatasi harga sebelum tanda tangan.'],
      demoTitle: 'Irama tanpa taruhan', guideTitle: 'Sebelum ikut putaran permainan',
      steps: ['Periksa nomor putaran, harga tiket, dan apakah pembelian tersedia dalam permainan dan dompet.', 'Pastikan transaksi sesuai keinginanmu. Jaringan, bukan halaman ini, menentukan hasil.', 'Setelah undian, periksa tiket dan status klaim atau pengembalian dana melalui catatan di blockchain.'],
      note: 'Teks di sini tidak menerbitkan tiket atau memastikan kemenangan maupun pengembalian dana.',
    },
    packDemo: { label: 'Ilustrasi setempat · tanpa pembelian', sizeLegend: 'Ukuran ilustrasi', hint: 'Ukuran dan contoh hanya ilustrasi. Periksa harga dan peluang dalam permainan sebelum menandatangani.', sizes: ['Kantong', 'Kotak', 'Peti'], samples: ['Sampel untuk wadah', 'Paket rangkaian', 'Potongan silikon', 'Bahan tembaga'], sealed: 'Ilustrasi masih tertutup.', opened: sample => `Contoh: ${sample}. Ini bukan kemenangan atau barang dalam dompetmu.`, open: 'Buka ilustrasi', again: 'Tampilkan lagi' },
  },
  fil: {
    packs: {
      lead: 'Mga kapsula: suriin muna ang kundisyon sa blockchain bago magpasya.',
      paragraphs: ['Larawan lamang ang kapsula sa ibaba. Hindi ito bumibili ng kagamitan, nagpapakita ng tunay na tsansa, o nagtatakda ng resulta sa laro.', 'Bago magbukas ng totoong kapsula sa laro, suriin ang availability, presyo, tsansa, at detalye ng transaksyon sa wallet. Kung hindi makuha ang datos sa network, hindi makukumpirma ng pahinang ito ang mga kundisyong iyon.'],
      demoTitle: 'Larawan ng kapsula', guideTitle: 'Bago magbukas sa laro',
      steps: ['Suriin ang kondisyon sa blockchain: laki, presyo, at tsansa ng bawat antas.', 'Basahin ang hinihinging pirma at pinakamataas na presyo. Tanggihan ang hindi inaasahang gastos.', 'Pagkatapos magsumite, tingnan ang pagbubukas sa laro at sa blockchain; hindi patunay ng pagmamay-ari ng NFT ang animation.'],
      note: 'Pangalan lang ang nagbabago kapag pumili ka ng ibang laki rito. Hindi kinakatawan ng mga halimbawa ang tunay na tsansa o laman ng kapsula.',
    },
    lottery: {
      lead: 'Tala sa blockchain, hindi animation, ang nagtatakda ng bunutan.',
      paragraphs: ['Hindi nagbebenta ng tiket o nagpapatakbo ng bunutan ang pahinang ito. Walang kaugnayan ang teksto rito sa resulta sa blockchain.', 'Kung nais mong sumali sa laro, suriin muna ang kasalukuyang round, presyo ng tiket, at mga tuntunin sa pagkuha ng premyo o refund. Kung walang datos mula sa network, huwag ipagpalagay na bukas ang round. Sarado muna ang bagong pagbili: walang limitasyon sa presyo bago pumirma sa on-chain na instruksiyon.'],
      demoTitle: 'Ritmong walang pustahan', guideTitle: 'Bago sumali sa round ng laro',
      steps: ['Suriin ang numero ng round, presyo ng tiket, at kung puwedeng bumili sa laro at wallet.', 'Tiyaking tugma ang transaksyon sa balak mong gawin. Ang network, hindi ang pahinang ito, ang nagtatakda ng resulta.', 'Pagkatapos ng bunutan, tingnan ang tiket at katayuan ng pagkuha ng premyo o refund sa tala sa blockchain.'],
      note: 'Hindi nagbibigay ng tiket o nagpapatunay ng panalo o refund ang teksto rito.',
    },
    packDemo: { label: 'Lokal na larawan · walang pagbili', sizeLegend: 'Laki sa larawan', hint: 'Mga halimbawa lang ang laki at sample. Suriin ang presyo at tsansa sa laro bago pumirma.', sizes: ['Supot', 'Lalagyan', 'Kahon'], samples: ['Sample para sa puwesto', 'Bungkos ng circuit', 'Piraso ng silicon', 'Blangkong tanso'], sealed: 'Sarado pa ang larawan.', opened: sample => `Halimbawa: ${sample}. Hindi ito panalo o kagamitan sa wallet mo.`, open: 'Buksan ang larawan', again: 'Magpakita ng iba' },
  },
};
