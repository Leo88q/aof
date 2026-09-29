import type { Language } from './translations';

export const behaviorIds = ['beh-01', 'beh-02', 'beh-03', 'beh-04', 'beh-05'] as const;
export type BehaviorId = typeof behaviorIds[number];
type Meta = { title: string; variant: string; where: string; note: string };
type Sample = {
  rule: string; honesty: string; unknownTitle: string; balance: string; noConnection: string; zeroResponse: string; exampleValue: string;
  quiet: string; unavailable: string; emptyTitle: string;
  rack: string; console: string; noIdTitle: string; batch: string; idUnavailable: string; stand: string; standUnavailable: string;
  demoLevel: string; needle: string;
};

/** Standalone gallery examples: no sample balance, tool ID or motion is a live network reading. */
export const galleryBehaviorCopy: Record<Language, { slides: Record<BehaviorId, Meta>; sample: Sample }> = {
  ru: {
    slides: {
      'beh-01': { title: 'Прочерк вместо нуля', variant: 'нет связи — не значит ноль', where: 'Все приборы · пример значения и отсутствия данных', note: 'Прочерк означает «неизвестно». Ноль здесь лишь проба вида подтверждённого ответа; пример прочности не считан из сети.' },
      'beh-02': { title: 'Подписи разной длины', variant: 'имена инструментов в каналах', where: 'Пульт · проверка переноса подписей', note: 'Каталоговые имена инструментов должны переноситься внутри канала, не сжимая соседние элементы. Часы и шкалы вымышлены.' },
      'beh-03': { title: 'Пояснение вместо догадки', variant: 'тихие заметки в пустом состоянии', where: 'Пустые состояния · примеры причин', note: 'Прибор различает отсутствие кошелька, сбой сети и пустую стойку. Эти три сообщения показаны как образцы, а не как текущий статус.' },
      'beh-04': { title: 'Без выдуманных номеров', variant: 'нет ID — ставим прочерк', where: 'Этикетки · партия и стенд', note: 'Этот пример не содержит настоящего номера объекта: никаких вымышленных ID или номеров партии на этикетке.' },
      'beh-05': { title: 'Движение приборов', variant: 'пример жидкости и шкалы', where: 'Приборы · настройки уменьшения движения', note: 'Здесь движение служит иллюстрацией работы деталей. Системная настройка уменьшения движения отключает анимации; шкалы не читают сеть.' },
    },
    sample: { rule: 'ПРАВИЛО', honesty: 'НЕТ ВЫДУМКИ', unknownTitle: 'Неизвестное и нулевое', balance: 'Баланс', noConnection: 'сеть не ответила', zeroResponse: 'пример ответа: ноль', exampleValue: 'пример, не чтение из сети', quiet: 'ТИХО', unavailable: 'НЕТ ДАННЫХ', emptyTitle: 'Что говорит пустой прибор', rack: 'СТОЙКА', console: 'ПУЛЬТ', noIdTitle: 'Номер — только из данных', batch: 'ID партии', idUnavailable: 'номер неизвестен', stand: 'Стенд', standUnavailable: 'стенд не назван', demoLevel: 'уровень — пример', needle: 'шкала' },
  },
  en: {
    slides: {
      'beh-01': { title: 'A dash, not zero', variant: 'no connection does not mean zero', where: 'All instruments · sample values and missing data', note: 'A dash means unknown. Zero here only demonstrates how a confirmed response might look; sample durability was not read from the network.' },
      'beh-02': { title: 'Labels of different lengths', variant: 'tool names inside channels', where: 'Console · label-wrap test', note: 'Catalog tool names should wrap inside each channel without squeezing the others. Hours and levels are fictional.' },
      'beh-03': { title: 'Explain, do not guess', variant: 'quiet notes in empty states', where: 'Empty states · sample reasons', note: 'The instrument distinguishes a missing wallet, a network error and an empty rack. These messages are examples, not a live status.' },
      'beh-04': { title: 'No invented identifiers', variant: 'no ID means a dash', where: 'Labels · batch and station', note: 'This example has no real object identifier: no fabricated ID or batch number is printed on the label.' },
      'beh-05': { title: 'Instrument motion', variant: 'sample liquid and gauge', where: 'Instruments · reduced-motion settings', note: 'Motion illustrates parts of the instrument. The system reduced-motion setting disables animations; these gauges do not read the network.' },
    },
    sample: { rule: 'RULE', honesty: 'NO GUESSWORK', unknownTitle: 'Unknown versus zero', balance: 'Balance', noConnection: 'network did not respond', zeroResponse: 'sample response: zero', exampleValue: 'example, not a network reading', quiet: 'QUIET', unavailable: 'NO DATA', emptyTitle: 'What an empty instrument says', rack: 'RACK', console: 'CONSOLE', noIdTitle: 'Only data provides an ID', batch: 'Batch ID', idUnavailable: 'ID unavailable', stand: 'Station', standUnavailable: 'station not specified', demoLevel: 'sample level', needle: 'gauge' },
  },
  pt: {
    slides: {
      'beh-01': { title: 'Um traço, não zero', variant: 'sem conexão não significa zero', where: 'Todos os instrumentos · exemplos de valores ausentes', note: 'O traço significa desconhecido. Zero só exemplifica uma resposta confirmada; a durabilidade ilustrativa não foi lida da rede.' },
      'beh-02': { title: 'Rótulos de vários tamanhos', variant: 'nomes de ferramentas nos canais', where: 'Console · teste de quebra de linha', note: 'Os nomes do catálogo devem caber em cada canal sem apertar os vizinhos. Horas e níveis são fictícios.' },
      'beh-03': { title: 'Explicar sem adivinhar', variant: 'notas discretas quando faltam dados', where: 'Estados vazios · exemplos de causas', note: 'O instrumento distingue carteira ausente, falha de rede e estante vazia. As mensagens são exemplos, não o estado atual.' },
      'beh-04': { title: 'Sem números inventados', variant: 'sem ID, usamos um traço', where: 'Etiquetas · lote e estação', note: 'Este exemplo não contém um identificador real: nenhum ID ou número de lote fictício aparece na etiqueta.' },
      'beh-05': { title: 'Movimento do instrumento', variant: 'líquido e medidor ilustrativos', where: 'Instrumentos · preferência por menos movimento', note: 'O movimento ilustra peças do instrumento. A preferência do sistema desativa animações; estes medidores não consultam a rede.' },
    },
    sample: { rule: 'REGRA', honesty: 'SEM PALPITES', unknownTitle: 'Desconhecido ou zero', balance: 'Saldo', noConnection: 'a rede não respondeu', zeroResponse: 'exemplo de resposta: zero', exampleValue: 'exemplo, não leitura da rede', quiet: 'NOTA', unavailable: 'SEM DADOS', emptyTitle: 'O que diz um instrumento vazio', rack: 'ESTANTE', console: 'CONSOLE', noIdTitle: 'Só os dados fornecem o ID', batch: 'ID do lote', idUnavailable: 'ID indisponível', stand: 'Estação', standUnavailable: 'estação não informada', demoLevel: 'nível ilustrativo', needle: 'medidor' },
  },
  es: {
    slides: {
      'beh-01': { title: 'Un guion, no cero', variant: 'sin conexión no equivale a cero', where: 'Todos los instrumentos · ejemplos de datos ausentes', note: 'El guion significa desconocido. El cero solo ejemplifica una respuesta confirmada; la durabilidad ilustrativa no procede de la red.' },
      'beh-02': { title: 'Etiquetas de distinta longitud', variant: 'nombres de herramientas en canales', where: 'Consola · prueba de ajuste del texto', note: 'Los nombres del catálogo deben ajustarse a cada canal sin comprimir los demás. Horas y niveles son ficticios.' },
      'beh-03': { title: 'Explicar sin suponer', variant: 'notas discretas si faltan datos', where: 'Estados vacíos · ejemplos de causas', note: 'El instrumento distingue la falta de cartera, un fallo de red y un soporte vacío. Los mensajes son ejemplos, no tu estado actual.' },
      'beh-04': { title: 'Sin identificadores inventados', variant: 'sin ID, un guion', where: 'Etiquetas · lote y estación', note: 'Este ejemplo no contiene un identificador real: no aparece ningún ID ni número de lote inventado.' },
      'beh-05': { title: 'Movimiento del instrumento', variant: 'líquido y medidor ilustrativos', where: 'Instrumentos · ajuste de movimiento reducido', note: 'El movimiento ilustra piezas del aparato. El ajuste del sistema desactiva las animaciones; estos medidores no consultan la red.' },
    },
    sample: { rule: 'REGLA', honesty: 'SIN SUPOSICIONES', unknownTitle: 'Desconocido frente a cero', balance: 'Saldo', noConnection: 'la red no respondió', zeroResponse: 'ejemplo de respuesta: cero', exampleValue: 'ejemplo, no lectura de red', quiet: 'NOTA', unavailable: 'SIN DATOS', emptyTitle: 'Qué dice un instrumento vacío', rack: 'SOPORTE', console: 'CONSOLA', noIdTitle: 'El ID procede de los datos', batch: 'ID del lote', idUnavailable: 'ID no disponible', stand: 'Estación', standUnavailable: 'estación no indicada', demoLevel: 'nivel ilustrativo', needle: 'medidor' },
  },
  vi: {
    slides: {
      'beh-01': { title: 'Dấu gạch thay cho số không', variant: 'mất kết nối không có nghĩa bằng không', where: 'Mọi thiết bị · ví dụ giá trị và dữ liệu thiếu', note: 'Dấu gạch nghĩa là chưa rõ. Số không chỉ minh họa kết quả đã xác nhận; độ bền ví dụ không được đọc từ mạng.' },
      'beh-02': { title: 'Nhãn dài ngắn khác nhau', variant: 'tên công cụ trong các kênh', where: 'Bảng điều khiển · thử xuống dòng', note: 'Tên công cụ trong danh mục cần xuống dòng ở mỗi kênh mà không ép kênh bên cạnh. Giờ và mức đều giả định.' },
      'beh-03': { title: 'Giải thích, không phỏng đoán', variant: 'ghi chú nhỏ khi thiếu dữ liệu', where: 'Trạng thái trống · ví dụ nguyên nhân', note: 'Thiết bị phân biệt chưa kết nối ví, lỗi mạng và giá trống. Ba thông báo này chỉ là ví dụ, không phải trạng thái hiện tại.' },
      'beh-04': { title: 'Không bịa mã định danh', variant: 'không có ID thì dùng dấu gạch', where: 'Nhãn · lô và trạm', note: 'Ví dụ này không có mã của đối tượng thật: nhãn không in ID hay số lô giả định.' },
      'beh-05': { title: 'Chuyển động của thiết bị', variant: 'ví dụ chất lỏng và thước đo', where: 'Thiết bị · cài đặt giảm chuyển động', note: 'Chuyển động minh họa các bộ phận. Cài đặt giảm chuyển động của hệ thống tắt hiệu ứng; các thước đo không đọc dữ liệu mạng.' },
    },
    sample: { rule: 'QUY TẮC', honesty: 'KHÔNG ĐOÁN', unknownTitle: 'Chưa rõ hay bằng không', balance: 'Số dư', noConnection: 'mạng không phản hồi', zeroResponse: 'ví dụ phản hồi: không', exampleValue: 'ví dụ, không phải dữ liệu mạng', quiet: 'GHI CHÚ', unavailable: 'KHÔNG CÓ DỮ LIỆU', emptyTitle: 'Thiết bị trống thông báo gì', rack: 'GIÁ', console: 'BẢNG ĐIỀU KHIỂN', noIdTitle: 'ID phải lấy từ dữ liệu', batch: 'ID lô', idUnavailable: 'chưa có ID', stand: 'Trạm', standUnavailable: 'chưa rõ trạm', demoLevel: 'mức minh họa', needle: 'thước đo' },
  },
  id: {
    slides: {
      'beh-01': { title: 'Tanda pisah, bukan nol', variant: 'putus jaringan bukan berarti nol', where: 'Semua peralatan · contoh nilai dan data hilang', note: 'Tanda pisah berarti belum diketahui. Nol hanya contoh respons terkonfirmasi; daya tahan ilustratif tidak dibaca dari jaringan.' },
      'beh-02': { title: 'Label dengan beragam panjang', variant: 'nama peralatan dalam kanal', where: 'Konsol · uji pembungkusan teks', note: 'Nama peralatan dari katalog harus terbungkus di dalam kanal tanpa menyempitkan kanal lain. Jam dan tingkat hanyalah contoh.' },
      'beh-03': { title: 'Jelaskan, jangan menduga', variant: 'catatan tenang saat data kosong', where: 'Keadaan kosong · contoh penyebab', note: 'Peralatan membedakan dompet belum terhubung, galat jaringan, dan rak kosong. Pesan ini contoh, bukan status saat ini.' },
      'beh-04': { title: 'Tanpa ID rekaan', variant: 'jika tak ada ID, tampilkan tanda pisah', where: 'Label · batch dan stasiun', note: 'Contoh ini tidak memuat ID objek nyata: label tidak mencantumkan ID atau nomor batch yang dikarang.' },
      'beh-05': { title: 'Gerakan peralatan', variant: 'cairan dan pengukur ilustratif', where: 'Peralatan · pengaturan kurangi gerakan', note: 'Gerakan menggambarkan bagian peralatan. Pengaturan sistem untuk mengurangi gerakan mematikan animasi; pengukur ini tidak membaca jaringan.' },
    },
    sample: { rule: 'ATURAN', honesty: 'TANPA MENEBAK', unknownTitle: 'Belum diketahui atau nol', balance: 'Saldo', noConnection: 'jaringan tidak merespons', zeroResponse: 'contoh respons: nol', exampleValue: 'contoh, bukan bacaan jaringan', quiet: 'CATATAN', unavailable: 'TANPA DATA', emptyTitle: 'Penjelasan peralatan kosong', rack: 'RAK', console: 'KONSOL', noIdTitle: 'ID harus berasal dari data', batch: 'ID batch', idUnavailable: 'ID tidak tersedia', stand: 'Stasiun', standUnavailable: 'stasiun tidak disebutkan', demoLevel: 'tingkat contoh', needle: 'pengukur' },
  },
  fil: {
    slides: {
      'beh-01': { title: 'Guhit, hindi sero', variant: 'walang koneksiyon ay hindi sero', where: 'Lahat ng kagamitan · halimbawa ng halaga at kulang na datos', note: 'Ang guhit ay hindi pa alam. Halimbawa lang ng kumpirmadong sagot ang sero; hindi binasa sa network ang halimbawang tibay.' },
      'beh-02': { title: 'Mahaba at maikling etiketa', variant: 'pangalan ng kagamitan sa bawat channel', where: 'Console · pagsubok ng pagbalot ng teksto', note: 'Dapat magkasya ang pangalan sa channel nang hindi siksikan ang iba. Halimbawa lang ang oras at antas.' },
      'beh-03': { title: 'Magpaliwanag, huwag manghula', variant: 'maliliit na tala kapag walang datos', where: 'Bakanteng kalagayan · halimbawa ng mga dahilan', note: 'Naiiba ang walang wallet, error sa network, at bakanteng rack. Halimbawa lang ang mga mensaheng ito, hindi kasalukuyang status.' },
      'beh-04': { title: 'Walang inimbentong ID', variant: 'kung walang ID, gumamit ng guhit', where: 'Etiketa · batch at istasyon', note: 'Walang tunay na object ID sa halimbawang ito: walang gawa-gawang ID o numero ng batch sa etiketa.' },
      'beh-05': { title: 'Galaw ng kagamitan', variant: 'halimbawang likido at panukat', where: 'Kagamitan · setting para bawasan ang galaw', note: 'Ipinapakita ng galaw ang bahagi ng aparato. Pinatitigil ng setting ng system ang animation; hindi nagbabasa ng network ang mga panukat.' },
    },
    sample: { rule: 'TUNTUNIN', honesty: 'WALANG HULA', unknownTitle: 'Hindi pa alam o sero', balance: 'Balanse', noConnection: 'hindi sumagot ang network', zeroResponse: 'halimbawang sagot: sero', exampleValue: 'halimbawa, hindi basa sa network', quiet: 'TALA', unavailable: 'WALANG DATOS', emptyTitle: 'Sinasabi ng walang laman na aparato', rack: 'RACK', console: 'KONSOL', noIdTitle: 'Sa datos lamang manggagaling ang ID', batch: 'ID ng batch', idUnavailable: 'walang ID', stand: 'Istasyon', standUnavailable: 'hindi tinukoy ang istasyon', demoLevel: 'halimbawang antas', needle: 'panukat' },
  },
};
