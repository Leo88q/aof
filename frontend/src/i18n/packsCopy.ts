import type { Language } from './translations';

type Copy = {
  title: string; intro: string; small: string; medium: string; big: string;
  connect: string; unconfigured: string; configLoading: string; configError: string;
  preparing: string; failed: string; paid: string; refundSent: string; revealed: string;
  waiting: string; seconds: string; revealSelf: string; refunded: string; settledUnknown: string;
  open: string; pendingTitle: string; refundable: string; waitingSlots: string;
  refund: string; reveal: string; pendingLoading: string; pendingError: string;
  commitUnknown: string;
};

export const packsCopy: Record<Language, Copy> = {
  ru: {
    title: 'Капсулы дропа',
    intro: 'Результат определяет оракул Switchboard On-Demand: аккаунт случайности принадлежит игровой программе. Ни игра, ни игрок не могут перебросить или скрыть результат. Раскрыть его может любой; цена уходит в казну только после раскрытия, а если оракул не ответит вовремя, средства вернут.',
    small: 'Малая капсула', medium: 'Средняя капсула', big: 'Большая капсула',
    connect: 'Подключите кошелёк', unconfigured: 'Капсула ещё не настроена в сети', configLoading: 'Читаем цены капсул…', configError: 'Не удалось прочитать цены капсул из сети',
    preparing: 'Готовим транзакцию: оплата в эскроу и запрос оракулу Switchboard…', failed: 'Транзакция не выполнена', paid: 'Оплачено. Оракул раскрывает результат…',
    refundSent: 'Возврат отправлен', revealed: 'Результат раскрыт вашей транзакцией', waiting: 'Ждём раскрытия оракула…', seconds: 'с', revealSelf: 'Раскрыть самостоятельно',
    refunded: 'Оракул не ответил вовремя — цена возвращена.', settledUnknown: 'Результат раскрыт, но данные инструмента ещё не получены. Проверьте инвентарь.',
    open: 'Открыть', pendingTitle: 'Незавершённые открытия', refundable: 'можно вернуть', waitingSlots: 'слотов прошло', refund: 'Вернуть', reveal: 'Раскрыть', pendingLoading: 'Проверяем незавершённые открытия…', pendingError: 'Не удалось проверить незавершённые открытия в сети; отсутствие записей не подтверждено.',
    commitUnknown: 'Оплата отправлена, но идентификатор открытия не пришёл. Проверьте незавершённые открытия перед повторной покупкой.',
  },
  en: {
    title: 'Drop capsules',
    intro: 'The Switchboard On-Demand oracle determines the outcome. The randomness account belongs to the game program, so neither the game nor the player can reroll or hide the result. Anyone may reveal it. Payment reaches the treasury only after reveal; if the oracle never responds in time, you can recover your funds.',
    small: 'Small capsule', medium: 'Medium capsule', big: 'Large capsule',
    connect: 'Connect your wallet', unconfigured: 'This capsule is not configured on-chain yet', configLoading: 'Loading capsule prices…', configError: 'Could not load capsule prices from the network',
    preparing: 'Preparing payment in escrow and a Switchboard oracle request…', failed: 'Transaction failed', paid: 'Paid. Waiting for the oracle to reveal the result…',
    refundSent: 'Refund submitted', revealed: 'Result revealed by your transaction', waiting: 'Waiting for the oracle…', seconds: 's', revealSelf: 'Reveal it yourself',
    refunded: 'The oracle did not respond in time — payment was refunded.', settledUnknown: 'Result revealed, but tool details have not arrived yet. Check your inventory.',
    open: 'Open', pendingTitle: 'Pending openings', refundable: 'refund available', waitingSlots: 'slots elapsed', refund: 'Refund', reveal: 'Reveal', pendingLoading: 'Checking pending openings…', pendingError: 'Could not check pending openings on the network; an empty list is not confirmed.',
    commitUnknown: 'Payment was submitted, but the opening ID was not returned. Check pending openings before buying again.',
  },
  pt: {
    title: 'Cápsulas do drop',
    intro: 'O resultado é determinado pelo oráculo Switchboard On-Demand. A conta de aleatoriedade pertence ao programa do jogo; nem o jogo nem o jogador podem sortear de novo ou esconder o resultado. Qualquer pessoa pode revelá-lo. O pagamento só chega ao tesouro após a revelação; se o oráculo não responder a tempo, você poderá recuperar os fundos.',
    small: 'Cápsula pequena', medium: 'Cápsula média', big: 'Cápsula grande',
    connect: 'Conecte sua carteira', unconfigured: 'Esta cápsula ainda não está configurada na rede', configLoading: 'Carregando preços das cápsulas…', configError: 'Não foi possível carregar os preços das cápsulas da rede',
    preparing: 'Preparando o pagamento em custódia e a solicitação ao oráculo Switchboard…', failed: 'A transação falhou', paid: 'Pagamento realizado. Aguardando o resultado do oráculo…',
    refundSent: 'Reembolso enviado', revealed: 'Resultado revelado pela sua transação', waiting: 'Aguardando o oráculo…', seconds: 's', revealSelf: 'Revelar por conta própria',
    refunded: 'O oráculo não respondeu a tempo — o pagamento foi devolvido.', settledUnknown: 'Resultado revelado, mas os dados da ferramenta ainda não chegaram. Consulte o inventário.',
    open: 'Abrir', pendingTitle: 'Aberturas pendentes', refundable: 'reembolso disponível', waitingSlots: 'slots transcorridos', refund: 'Reembolsar', reveal: 'Revelar', pendingLoading: 'Verificando aberturas pendentes…', pendingError: 'Não foi possível consultar as aberturas pendentes na rede; a ausência de registros não foi confirmada.',
    commitUnknown: 'Pagamento enviado, mas o identificador da abertura não chegou. Confira as aberturas pendentes antes de comprar novamente.',
  },
  es: {
    title: 'Cápsulas del drop',
    intro: 'El oráculo Switchboard On-Demand determina el resultado. La cuenta de aleatoriedad pertenece al programa del juego: ni el juego ni el jugador pueden volver a sortear u ocultar el resultado. Cualquiera puede revelarlo. El pago llega a la tesorería solo tras la revelación; si el oráculo no responde a tiempo, podrás recuperar los fondos.',
    small: 'Cápsula pequeña', medium: 'Cápsula mediana', big: 'Cápsula grande',
    connect: 'Conecta tu cartera', unconfigured: 'Esta cápsula aún no está configurada en la red', configLoading: 'Cargando precios de las cápsulas…', configError: 'No se pudieron cargar los precios de las cápsulas de la red',
    preparing: 'Preparando el pago en custodia y la solicitud al oráculo Switchboard…', failed: 'La transacción falló', paid: 'Pago realizado. Esperando el resultado del oráculo…',
    refundSent: 'Reembolso enviado', revealed: 'Resultado revelado con tu transacción', waiting: 'Esperando al oráculo…', seconds: 's', revealSelf: 'Revelar por tu cuenta',
    refunded: 'El oráculo no respondió a tiempo — se devolvió el pago.', settledUnknown: 'Resultado revelado, pero aún no llegan los datos de la herramienta. Revisa tu inventario.',
    open: 'Abrir', pendingTitle: 'Aperturas pendientes', refundable: 'reembolso disponible', waitingSlots: 'slots transcurridos', refund: 'Reembolsar', reveal: 'Revelar', pendingLoading: 'Consultando aperturas pendientes…', pendingError: 'No se pudieron consultar las aperturas pendientes en la red; no se ha confirmado que la lista esté vacía.',
    commitUnknown: 'El pago se envió, pero no llegó el ID de la apertura. Revisa las aperturas pendientes antes de volver a comprar.',
  },
  vi: {
    title: 'Hộp vật phẩm',
    intro: 'Hệ thống tiên tri Switchboard On-Demand quyết định kết quả. Tài khoản ngẫu nhiên thuộc về chương trình trò chơi, nên cả trò chơi lẫn người chơi không thể quay lại hoặc giấu kết quả. Bất kỳ ai cũng có thể công bố kết quả. Tiền chỉ vào ngân quỹ sau khi công bố; nếu hệ thống không phản hồi kịp, bạn có thể lấy lại tiền.',
    small: 'Hộp nhỏ', medium: 'Hộp vừa', big: 'Hộp lớn',
    connect: 'Kết nối ví', unconfigured: 'Hộp này chưa được cấu hình trên chuỗi', configLoading: 'Đang tải giá hộp…', configError: 'Không thể tải giá hộp từ mạng',
    preparing: 'Đang chuẩn bị thanh toán ký quỹ và yêu cầu đến Switchboard…', failed: 'Giao dịch thất bại', paid: 'Đã thanh toán. Đang chờ kết quả từ hệ thống tiên tri…',
    refundSent: 'Đã gửi yêu cầu hoàn tiền', revealed: 'Giao dịch của bạn đã công bố kết quả', waiting: 'Đang chờ công bố kết quả…', seconds: 'giây', revealSelf: 'Tự công bố kết quả',
    refunded: 'Hệ thống không phản hồi kịp — tiền đã được hoàn lại.', settledUnknown: 'Đã công bố kết quả nhưng chưa có thông tin công cụ. Hãy kiểm tra kho đồ.',
    open: 'Mở', pendingTitle: 'Các lần mở chưa hoàn tất', refundable: 'có thể hoàn tiền', waitingSlots: 'số slot đã qua', refund: 'Hoàn tiền', reveal: 'Công bố', pendingLoading: 'Đang kiểm tra các lần mở chưa hoàn tất…', pendingError: 'Không thể kiểm tra các lần mở chưa hoàn tất từ mạng; chưa thể xác nhận danh sách trống.',
    commitUnknown: 'Đã gửi thanh toán nhưng chưa nhận được mã lần mở. Hãy kiểm tra các lần mở chưa hoàn tất trước khi mua thêm.',
  },
  id: {
    title: 'Kapsul hadiah',
    intro: 'Oracle Switchboard On-Demand menentukan hasilnya. Akun keacakan dimiliki program permainan, sehingga baik permainan maupun pemain tidak dapat mengundi ulang atau menyembunyikan hasil. Siapa saja bisa mengungkap hasilnya. Pembayaran baru masuk ke kas setelah pengungkapan; jika oracle tidak menjawab tepat waktu, danamu dapat dikembalikan.',
    small: 'Kapsul kecil', medium: 'Kapsul sedang', big: 'Kapsul besar',
    connect: 'Hubungkan dompet', unconfigured: 'Kapsul ini belum dikonfigurasi di blockchain', configLoading: 'Memuat harga kapsul…', configError: 'Tidak dapat memuat harga kapsul dari jaringan',
    preparing: 'Menyiapkan pembayaran di escrow dan permintaan ke oracle Switchboard…', failed: 'Transaksi gagal', paid: 'Sudah dibayar. Menunggu oracle mengungkap hasil…',
    refundSent: 'Pengembalian dana diajukan', revealed: 'Hasil diungkap melalui transaksimu', waiting: 'Menunggu oracle…', seconds: 'dtk', revealSelf: 'Ungkap sendiri',
    refunded: 'Oracle tidak menjawab tepat waktu — pembayaran dikembalikan.', settledUnknown: 'Hasil terungkap, tetapi rincian peralatan belum tersedia. Periksa inventaris.',
    open: 'Buka', pendingTitle: 'Pembukaan tertunda', refundable: 'dana dapat dikembalikan', waitingSlots: 'slot berlalu', refund: 'Kembalikan dana', reveal: 'Ungkap', pendingLoading: 'Memeriksa pembukaan tertunda…', pendingError: 'Tidak dapat memeriksa pembukaan tertunda di jaringan; daftar kosong belum terkonfirmasi.',
    commitUnknown: 'Pembayaran diajukan, tetapi ID pembukaan tidak diterima. Periksa pembukaan tertunda sebelum membeli lagi.',
  },
  fil: {
    title: 'Mga kapsula ng gantimpala',
    intro: 'Ang Switchboard On-Demand oracle ang nagpapasya ng resulta. Ang account para sa randomness ay pag-aari ng program ng laro, kaya hindi maaaring ulitin o itago ng laro o manlalaro ang resulta. Kahit sino ay maaaring maghayag nito. Mapupunta lamang sa pondo ang bayad matapos ang paghayag; kung hindi sumagot ang oracle sa oras, maaari mong mabawi ang pera.',
    small: 'Maliit na kapsula', medium: 'Katamtamang kapsula', big: 'Malaking kapsula',
    connect: 'Ikonekta ang wallet', unconfigured: 'Hindi pa naka-configure ang kapsulang ito sa blockchain', configLoading: 'Kinukuha ang presyo ng mga kapsula…', configError: 'Hindi makuha sa network ang presyo ng mga kapsula',
    preparing: 'Inihahanda ang bayad sa escrow at ang hiling sa Switchboard oracle…', failed: 'Nabigo ang transaksyon', paid: 'Nabayaran na. Hinihintay ang resulta mula sa oracle…',
    refundSent: 'Naipadala ang kahilingan sa pagsasauli', revealed: 'Naihayag ang resulta sa iyong transaksyon', waiting: 'Hinihintay ang oracle…', seconds: 'seg', revealSelf: 'Ikaw mismo ang maghayag',
    refunded: 'Hindi sumagot sa oras ang oracle — naibalik ang bayad.', settledUnknown: 'Naihayag ang resulta ngunit hindi pa dumarating ang detalye ng kagamitan. Tingnan ang imbentaryo.',
    open: 'Buksan', pendingTitle: 'Mga hindi pa tapos na pagbubukas', refundable: 'maaari nang bawiin ang bayad', waitingSlots: 'slot na lumipas', refund: 'Bawiin ang bayad', reveal: 'Ihayag', pendingLoading: 'Sinusuri ang mga hindi pa tapos na pagbubukas…', pendingError: 'Hindi masuri sa network ang mga hindi pa tapos na pagbubukas; hindi kumpirmadong walang tala.',
    commitUnknown: 'Naipadala ang bayad ngunit hindi natanggap ang ID ng pagbubukas. Tingnan muna ang mga nakabiting pagbubukas bago bumili ulit.',
  },
};
