import type { Language } from './translations';

type PackId = 'small' | 'medium' | 'big';
type Copy = {
  title: string; intro: string; small: string; medium: string; big: string;
  /** Подпись витрины: что это за капсула, до покупки. Жалоба 2026-09-30:
   *  на экране были только цена и кнопка — ни картинки, ни описания. */
  about: Record<PackId, string>;
  illustration: string; revealSoon: string;
  connect: string; unconfigured: string; configLoading: string; configError: string;
  preparing: string; failed: string; paid: string; refundSent: string; revealed: string;
  waiting: string; seconds: string; revealSelf: string; hideReveal: string; refunded: string; settledUnknown: string;
  open: string; pendingTitle: string; refundable: string; waitingSlots: string; seedPending: string;
  refund: string; reveal: string; pendingLoading: string; pendingError: string;
  commitUnknown: string;
};

export const packsCopy: Record<Language, Copy> = {
  ru: {
    about: {
      small: 'Малая капсула — ровный шанс на базовый инструмент. Первый вход в мастерскую: цена ниже, редкости выше базовой почти не встречаются.',
      medium: 'Средняя капсула — основной поток. Заметные шансы на усиленный и квантовый инструмент, цена держит баланс между риском и пополнением стойки.',
      big: 'Большая капсула — редкая ставка на сильные редкости. Дешевле собрать инструмент самому, дороже — получить его сразу из капсулы.',
    },
    illustration: 'Витрина капсулы', revealSoon: 'Инструмент из этой капсулы уже показан выше — изображение не выдаёт результат, его считает программа из хеша слота.',
    title: 'Капсулы дропа',
    intro: 'Результат считает программа из хеша будущего слота. Ни игра, ни игрок не выбирают бросок. Раскрыть его может любой; цена уходит в казну только после раскрытия. Если слот не даст хеш в окне, средства вернут.',
    small: 'Малая капсула', medium: 'Средняя капсула', big: 'Большая капсула',
    connect: 'Подключите кошелёк', unconfigured: 'Капсула ещё не настроена в сети', configLoading: 'Читаем цены капсул…', configError: 'Не удалось прочитать цены капсул из сети',
    preparing: 'Готовим транзакцию: оплата в эскроу, исход привязывается к будущему слоту…', failed: 'Транзакция не выполнена', paid: 'Оплачено. Ждём слот, из хеша которого программа посчитает результат…',
    refundSent: 'Возврат отправлен', revealed: 'Результат раскрыт вашей транзакцией', waiting: 'Ждём слот…', seconds: 'с', revealSelf: 'Раскрыть самостоятельно', hideReveal: 'Свернуть',
    refunded: 'Слот не дал хеш в окне — цена возвращена.', settledUnknown: 'Результат раскрыт, но данные инструмента ещё не получены. Проверьте инвентарь.',
    open: 'Открыть', pendingTitle: 'Незавершённые открытия', refundable: 'можно вернуть', waitingSlots: 'слотов прошло', seedPending: 'Слот ещё не наступил', refund: 'Вернуть', reveal: 'Раскрыть', pendingLoading: 'Проверяем незавершённые открытия…', pendingError: 'Не удалось проверить незавершённые открытия в сети; отсутствие записей не подтверждено.',
    commitUnknown: 'Оплата отправлена, но идентификатор открытия не пришёл. Проверьте незавершённые открытия перед повторной покупкой.',
  },
  en: {
    about: {
      small: 'The small capsule gives an even chance at a base tool. It is the entry point into the workshop: lower price, and rarities above base are almost never seen.',
      medium: 'The medium capsule is the main stream. Noticeable odds for an enhanced or quantum tool, with the price keeping the balance between risk and restocking the rack.',
      big: 'The large capsule is a rare bet on high rarities. Crafting a tool yourself is cheaper; opening it here is faster.',
    },
    illustration: 'Capsule display', revealSoon: 'The tool from this capsule is shown above — the artwork does not reveal the result; the program computes it from a slot hash.',
    title: 'Drop capsules',
    intro: 'The program computes the outcome from a future slot hash. Neither the game nor the player chooses the roll. Anyone may reveal it. Payment reaches the treasury only after reveal. If that slot never produces a hash inside the window, the funds come back.',
    small: 'Small capsule', medium: 'Medium capsule', big: 'Large capsule',
    connect: 'Connect your wallet', unconfigured: 'This capsule is not configured on-chain yet', configLoading: 'Loading capsule prices…', configError: 'Could not load capsule prices from the network',
    preparing: 'Preparing payment in escrow and binding the outcome to a future slot…', failed: 'Transaction failed', paid: 'Paid. Waiting for the slot whose hash the program will use…',
    refundSent: 'Refund submitted', revealed: 'Result revealed by your transaction', waiting: 'Waiting for the slot…', seconds: 's', revealSelf: 'Reveal it yourself', hideReveal: 'Hide',
    refunded: 'The slot produced no hash inside the window — payment was refunded.', settledUnknown: 'Result revealed, but tool details have not arrived yet. Check your inventory.',
    open: 'Open', pendingTitle: 'Pending openings', refundable: 'refund available', waitingSlots: 'slots elapsed', seedPending: 'The slot has not arrived yet', refund: 'Refund', reveal: 'Reveal', pendingLoading: 'Checking pending openings…', pendingError: 'Could not check pending openings on the network; an empty list is not confirmed.',
    commitUnknown: 'Payment was submitted, but the opening ID was not returned. Check pending openings before buying again.',
  },
  pt: {
    about: {
      small: 'A cápsula pequena oferece chance equilibrada de uma ferramenta básica. É a entrada na oficina: preço menor, e raridades acima da básica quase não aparecem.',
      medium: 'A cápsula média é o fluxo principal. Chances perceptíveis de ferramenta aprimorada ou quântica; o preço equilibra risco e reposição da estante.',
      big: 'A cápsula grande é uma aposta rara em raridades altas. Criar a ferramenta é mais barato; abri-la aqui é mais rápido.',
    },
    illustration: 'Vitrine da cápsula', revealSoon: 'A ferramenta desta cápsula já aparece acima — a arte não revela o resultado; o programa calcula-o a partir do hash do slot.',
    title: 'Cápsulas do drop',
    intro: 'O programa calcula o resultado a partir do hash de um slot futuro. Nem o jogo nem o jogador escolhem o sorteio. Qualquer pessoa pode revelá-lo. O pagamento só chega ao tesouro após a revelação. Se o slot não produzir hash dentro da janela, os fundos voltam.',
    small: 'Cápsula pequena', medium: 'Cápsula média', big: 'Cápsula grande',
    connect: 'Conecte sua carteira', unconfigured: 'Esta cápsula ainda não está configurada na rede', configLoading: 'Carregando preços das cápsulas…', configError: 'Não foi possível carregar os preços das cápsulas da rede',
    preparing: 'Preparando o pagamento em custódia e vinculando o resultado a um slot futuro…', failed: 'A transação falhou', paid: 'Pagamento realizado. Aguardando o slot cujo hash o programa vai usar…',
    refundSent: 'Reembolso enviado', revealed: 'Resultado revelado pela sua transação', waiting: 'Aguardando o slot…', seconds: 's', revealSelf: 'Revelar por conta própria', hideReveal: 'Ocultar',
    refunded: 'O slot não produziu hash dentro da janela — o pagamento foi devolvido.', settledUnknown: 'Resultado revelado, mas os dados da ferramenta ainda não chegaram. Consulte o inventário.',
    open: 'Abrir', pendingTitle: 'Aberturas pendentes', refundable: 'reembolso disponível', waitingSlots: 'slots transcorridos', seedPending: 'O slot ainda não chegou', refund: 'Reembolsar', reveal: 'Revelar', pendingLoading: 'Verificando aberturas pendentes…', pendingError: 'Não foi possível consultar as aberturas pendentes na rede; a ausência de registros não foi confirmada.',
    commitUnknown: 'Pagamento enviado, mas o identificador da abertura não chegou. Confira as aberturas pendentes antes de comprar novamente.',
  },
  es: {
    about: {
      small: 'La cápsula pequeña da una probabilidad equilibrada de una herramienta básica. Es la entrada al taller: precio menor y las rarezas superiores a la básica casi no aparecen.',
      medium: 'La cápsula mediana es el flujo principal. Probabilidades notables de herramienta mejorada o cuántica; el precio equilibra riesgo y reposición del estante.',
      big: 'La cápsula grande es una apuesta poco frecuente a rarezas altas. Fabricar la herramienta sale más barato; abrirla aquí es más rápido.',
    },
    illustration: 'Vitrina de la cápsula', revealSoon: 'La herramienta de esta cápsula ya aparece arriba: la imagen no revela el resultado; el programa lo calcula con el hash del slot.',
    title: 'Cápsulas del drop',
    intro: 'El programa calcula el resultado con el hash de un slot futuro. Ni el juego ni el jugador eligen el tiro. Cualquiera puede revelarlo. El pago llega a la tesorería solo tras la revelación. Si ese slot no produce hash dentro de la ventana, los fondos vuelven.',
    small: 'Cápsula pequeña', medium: 'Cápsula mediana', big: 'Cápsula grande',
    connect: 'Conecta tu cartera', unconfigured: 'Esta cápsula aún no está configurada en la red', configLoading: 'Cargando precios de las cápsulas…', configError: 'No se pudieron cargar los precios de las cápsulas de la red',
    preparing: 'Preparando el pago en custodia y vinculando el resultado a un slot futuro…', failed: 'La transacción falló', paid: 'Pago realizado. Esperando el slot cuyo hash usará el programa…',
    refundSent: 'Reembolso enviado', revealed: 'Resultado revelado con tu transacción', waiting: 'Esperando el slot…', seconds: 's', revealSelf: 'Revelar por tu cuenta', hideReveal: 'Ocultar',
    refunded: 'El slot no produjo hash dentro de la ventana — se devolvió el pago.', settledUnknown: 'Resultado revelado, pero aún no llegan los datos de la herramienta. Revisa tu inventario.',
    open: 'Abrir', pendingTitle: 'Aperturas pendientes', refundable: 'reembolso disponible', waitingSlots: 'slots transcurridos', seedPending: 'El slot aún no ha llegado', refund: 'Reembolsar', reveal: 'Revelar', pendingLoading: 'Consultando aperturas pendientes…', pendingError: 'No se pudieron consultar las aperturas pendientes en la red; no se ha confirmado que la lista esté vacía.',
    commitUnknown: 'El pago se envió, pero no llegó el ID de la apertura. Revisa las aperturas pendientes antes de volver a comprar.',
  },
  vi: {
    about: {
      small: 'Khoang nhỏ cho cơ hội đồng đều nhận dụng cụ cơ bản. Đây là bước đầu vào xưởng: giá thấp hơn, gần như không gặp độ hiếm cao hơn mức cơ bản.',
      medium: 'Khoang vừa là dòng chính. Cơ hội rõ rệt cho dụng cụ tăng cường hoặc lượng tử; mức giá cân bằng giữa rủi ro và việc bổ sung giá đỡ.',
      big: 'Khoang lớn là canh bạc hiếm cho độ hiếm cao. Tự chế tạo thì rẻ hơn; mở khoang thì nhanh hơn.',
    },
    illustration: 'Trưng bày khoang', revealSoon: 'Dụng cụ từ khoang này đã hiện ở trên — hình ảnh không tiết lộ kết quả; chương trình tính kết quả từ hash của slot.',
    title: 'Hộp vật phẩm',
    intro: 'Chương trình tính kết quả từ hash của một slot tương lai. Cả trò chơi lẫn người chơi đều không chọn lần tung. Bất kỳ ai cũng có thể công bố. Tiền chỉ vào ngân quỹ sau khi công bố. Nếu slot không có hash trong cửa sổ, tiền sẽ được hoàn lại.',
    small: 'Hộp nhỏ', medium: 'Hộp vừa', big: 'Hộp lớn',
    connect: 'Kết nối ví', unconfigured: 'Hộp này chưa được cấu hình trên chuỗi', configLoading: 'Đang tải giá hộp…', configError: 'Không thể tải giá hộp từ mạng',
    preparing: 'Đang chuẩn bị thanh toán ký quỹ và gắn kết quả với một slot tương lai…', failed: 'Giao dịch thất bại', paid: 'Đã thanh toán. Đang chờ slot mà chương trình sẽ dùng hash…',
    refundSent: 'Đã gửi yêu cầu hoàn tiền', revealed: 'Giao dịch của bạn đã công bố kết quả', waiting: 'Đang chờ slot…', seconds: 'giây', revealSelf: 'Tự công bố kết quả', hideReveal: 'Ẩn',
    refunded: 'Slot không có hash trong cửa sổ — tiền đã được hoàn lại.', settledUnknown: 'Đã công bố kết quả nhưng chưa có thông tin công cụ. Hãy kiểm tra kho đồ.',
    open: 'Mở', pendingTitle: 'Các lần mở chưa hoàn tất', refundable: 'có thể hoàn tiền', waitingSlots: 'số slot đã qua', seedPending: 'Slot chưa tới', refund: 'Hoàn tiền', reveal: 'Công bố', pendingLoading: 'Đang kiểm tra các lần mở chưa hoàn tất…', pendingError: 'Không thể kiểm tra các lần mở chưa hoàn tất từ mạng; chưa thể xác nhận danh sách trống.',
    commitUnknown: 'Đã gửi thanh toán nhưng chưa nhận được mã lần mở. Hãy kiểm tra các lần mở chưa hoàn tất trước khi mua thêm.',
  },
  id: {
    about: {
      small: 'Kapsul kecil memberi peluang merata untuk alat dasar. Ini pintu masuk ke bengkel: harga lebih rendah, dan kelangkaan di atas dasar hampir tak muncul.',
      medium: 'Kapsul sedang adalah aliran utama. Peluang jelas untuk alat yang diperkuat atau kuantum; harga menjaga keseimbangan risiko dan pengisian rak.',
      big: 'Kapsul besar adalah taruhan langka untuk kelangkaan tinggi. Merakit sendiri lebih murah; membukanya di sini lebih cepat.',
    },
    illustration: 'Tampilan kapsul', revealSoon: 'Alat dari kapsul ini sudah tampil di atas — gambar tidak membuka hasil; program menghitungnya dari hash slot.',
    title: 'Kapsul hadiah',
    intro: 'Program menghitung hasil dari hash slot yang akan datang. Permainan maupun pemain tidak memilih lemparan. Siapa saja bisa mengungkapnya. Pembayaran masuk ke kas hanya setelah pengungkapan. Jika slot itu tidak menghasilkan hash dalam jendela, dana kembali.',
    small: 'Kapsul kecil', medium: 'Kapsul sedang', big: 'Kapsul besar',
    connect: 'Hubungkan dompet', unconfigured: 'Kapsul ini belum dikonfigurasi di blockchain', configLoading: 'Memuat harga kapsul…', configError: 'Tidak dapat memuat harga kapsul dari jaringan',
    preparing: 'Menyiapkan pembayaran di escrow dan mengikat hasil ke slot yang akan datang…', failed: 'Transaksi gagal', paid: 'Sudah dibayar. Menunggu slot yang hash-nya akan dipakai program…',
    refundSent: 'Pengembalian dana diajukan', revealed: 'Hasil diungkap melalui transaksimu', waiting: 'Menunggu slot…', seconds: 'dtk', revealSelf: 'Ungkap sendiri', hideReveal: 'Sembunyikan',
    refunded: 'Slot tidak menghasilkan hash dalam jendela — pembayaran dikembalikan.', settledUnknown: 'Hasil terungkap, tetapi rincian peralatan belum tersedia. Periksa inventaris.',
    open: 'Buka', pendingTitle: 'Pembukaan tertunda', refundable: 'dana dapat dikembalikan', waitingSlots: 'slot berlalu', seedPending: 'Slot belum tiba', refund: 'Kembalikan dana', reveal: 'Ungkap', pendingLoading: 'Memeriksa pembukaan tertunda…', pendingError: 'Tidak dapat memeriksa pembukaan tertunda di jaringan; daftar kosong belum terkonfirmasi.',
    commitUnknown: 'Pembayaran diajukan, tetapi ID pembukaan tidak diterima. Periksa pembukaan tertunda sebelum membeli lagi.',
  },
  fil: {
    about: {
      small: 'Ang maliit na kapsula ay pantay ang tsansa sa payak na kagamitan. Ito ang pasukan sa pagawaan: mas mababa ang presyo, at halos hindi lumalabas ang mas mataas sa payak.',
      medium: 'Ang katamtamang kapsula ang pangunahing daloy. Kapansin-pansin ang tsansa sa pinahusay o quantum na kagamitan; ang presyo ang nagbabalanse ng panganib at pagpuno ng estante.',
      big: 'Ang malaking kapsula ay bihirang taya sa matataas na kalidad. Mas mura ang gumawa mismo; mas mabilis ang pagbukas dito.',
    },
    illustration: 'Tanawin ng kapsula', revealSoon: 'Nakita na sa itaas ang kagamitan mula sa kapsulang ito — hindi isinisiwalat ng larawan ang resulta; kinukuwenta ito ng program mula sa hash ng slot.',
    title: 'Mga kapsula ng gantimpala',
    intro: 'Kinukuwenta ng program ang resulta mula sa hash ng susunod na slot. Hindi pinipili ng laro o ng manlalaro ang paghagis. Kahit sino ay maaaring maghayag nito. Papasok sa pondo ang bayad pagkatapos lamang ng paghayag. Kung walang hash ang slot sa loob ng bintana, ibabalik ang pera.',
    small: 'Maliit na kapsula', medium: 'Katamtamang kapsula', big: 'Malaking kapsula',
    connect: 'Ikonekta ang wallet', unconfigured: 'Hindi pa naka-configure ang kapsulang ito sa blockchain', configLoading: 'Kinukuha ang presyo ng mga kapsula…', configError: 'Hindi makuha sa network ang presyo ng mga kapsula',
    preparing: 'Inihahanda ang bayad sa escrow at ikinakabit ang resulta sa susunod na slot…', failed: 'Nabigo ang transaksyon', paid: 'Nabayaran na. Hinihintay ang slot na gagamitin ang hash ng program…',
    refundSent: 'Naipadala ang kahilingan sa pagsasauli', revealed: 'Naihayag ang resulta sa iyong transaksyon', waiting: 'Hinihintay ang slot…', seconds: 'seg', revealSelf: 'Ikaw mismo ang maghayag', hideReveal: 'Itago',
    refunded: 'Walang hash ang slot sa loob ng bintana — naibalik ang bayad.', settledUnknown: 'Naihayag ang resulta ngunit hindi pa dumarating ang detalye ng kagamitan. Tingnan ang imbentaryo.',
    open: 'Buksan', pendingTitle: 'Mga hindi pa tapos na pagbubukas', refundable: 'maaari nang bawiin ang bayad', waitingSlots: 'slot na lumipas', seedPending: 'Hindi pa dumarating ang slot', refund: 'Bawiin ang bayad', reveal: 'Ihayag', pendingLoading: 'Sinusuri ang mga hindi pa tapos na pagbubukas…', pendingError: 'Hindi masuri sa network ang mga hindi pa tapos na pagbubukas; hindi kumpirmadong walang tala.',
    commitUnknown: 'Naipadala ang bayad ngunit hindi natanggap ang ID ng pagbubukas. Tingnan muna ang mga nakabiting pagbubukas bago bumili ulit.',
  },
};
