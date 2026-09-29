import type { Language } from './translations';

export const crossIds = ['cross-01', 'cross-02', 'cross-03', 'cross-04', 'cross-05'] as const;
export type CrossId = typeof crossIds[number];
type Meta = { title: string; variant: string; where: string; note: string };

/** Sample cables do not stand for real messages; top labels are not rendered by CrossPanel. */
export const galleryCrossCopy: Record<Language, { slides: Record<CrossId, Meta> }> = {
  ru: { slides: {
    'cross-01': { title: 'Линии входящих', variant: 'пример портов и кордов', where: 'Инбокс · первый экран (pages/inbox/InboxHome.tsx)', note: 'В игре верхние пронумерованные порты соответствуют письмам, нижние — состояниям. Эти корды демонстрационные, не сообщения вашего ящика.' },
    'cross-02': { title: 'Панель без кордов', variant: 'нет соединений в примере', where: 'Инбокс · пустое состояние', note: 'Здесь показана пустая схема. В настоящем ящике при отсутствии писем вместо схемы появляется сообщение; ошибка чтения — отдельное состояние.' },
    'cross-03': { title: 'Один корд', variant: 'пример одного соединения', where: 'Инбокс · иллюстрация одного письма', note: 'Один корд соединяет условные порты. Это не письмо из вашего ящика.' },
    'cross-04': { title: 'Проба сигнала порта', variant: 'флаг ошибки в примере', where: 'Инбокс · проверка схемы порта', note: 'Флаг ошибки здесь задан, но компонент пока не отличает его цветом от обычного сигнала. Это не подтверждение сбоя отправителя.' },
    'cross-05': { title: 'Пульс на корде', variant: 'пример непрочитанной линии', where: 'Инбокс · иллюстрация непрочитанного письма', note: 'В ящике пульс ставится для непрочитанных писем. Движение здесь демонстрационное, не индикатор доставки или обработки.' },
  } },
  en: { slides: {
    'cross-01': { title: 'Incoming lines', variant: 'sample ports and cables', where: 'Inbox · first screen (pages/inbox/InboxHome.tsx)', note: 'In the game, numbered upper ports represent messages and lower ports represent statuses. These cables are examples, not messages in your inbox.' },
    'cross-02': { title: 'Panel without cables', variant: 'no connections in this example', where: 'Inbox · empty state', note: 'This is an empty diagram. The real inbox shows a message rather than a panel when there are no letters; a read error is separate.' },
    'cross-03': { title: 'A single cable', variant: 'one sample connection', where: 'Inbox · one-message illustration', note: 'One cable joins sample ports. It is not a message from your inbox.' },
    'cross-04': { title: 'Port signal test', variant: 'sample error flag', where: 'Inbox · port diagram test', note: 'An error flag is set here, but the component does not yet give it a distinct color. This is not evidence of a sender outage.' },
    'cross-05': { title: 'Pulse along a cable', variant: 'unread-line illustration', where: 'Inbox · unread-message illustration', note: 'The inbox pulses for unread messages. Motion here is illustrative, not a delivery or processing indicator.' },
  } },
  pt: { slides: {
    'cross-01': { title: 'Linhas de entrada', variant: 'portas e cabos — exemplo', where: 'Caixa de entrada · primeira tela (pages/inbox/InboxHome.tsx)', note: 'No jogo, as portas numeradas de cima são mensagens; as de baixo, estados. Estes cabos são exemplos, não mensagens da sua caixa.' },
    'cross-02': { title: 'Painel sem cabos', variant: 'sem conexões neste exemplo', where: 'Caixa de entrada · estado vazio', note: 'Este é um diagrama vazio. A caixa real mostra uma mensagem quando não há cartas; uma falha de leitura é um estado distinto.' },
    'cross-03': { title: 'Um cabo', variant: 'exemplo de uma conexão', where: 'Caixa de entrada · ilustração de uma carta', note: 'Um cabo liga portas ilustrativas. Não é uma mensagem da sua caixa.' },
    'cross-04': { title: 'Teste do sinal da porta', variant: 'marcador de erro ilustrativo', where: 'Caixa de entrada · teste do diagrama', note: 'Há um marcador de erro, mas o componente ainda não lhe dá uma cor diferente. Isso não comprova falha do remetente.' },
    'cross-05': { title: 'Pulso no cabo', variant: 'exemplo de linha não lida', where: 'Caixa de entrada · ilustração de carta não lida', note: 'Na caixa real, cartas não lidas recebem um pulso. Aqui o movimento é ilustrativo, não indica entrega ou processamento.' },
  } },
  es: { slides: {
    'cross-01': { title: 'Líneas entrantes', variant: 'puertos y cables — ejemplo', where: 'Buzón · primera pantalla (pages/inbox/InboxHome.tsx)', note: 'En el juego, los puertos superiores numerados son mensajes; los inferiores, estados. Estos cables son ejemplos, no mensajes de tu buzón.' },
    'cross-02': { title: 'Panel sin cables', variant: 'sin conexiones en el ejemplo', where: 'Buzón · estado vacío', note: 'Este es un diagrama vacío. El buzón real muestra un mensaje si no hay cartas; un error de lectura es otro estado.' },
    'cross-03': { title: 'Un cable', variant: 'ejemplo de una conexión', where: 'Buzón · ilustración de una carta', note: 'Un cable une puertos ilustrativos. No es un mensaje de tu buzón.' },
    'cross-04': { title: 'Prueba de señal del puerto', variant: 'indicador de error de ejemplo', where: 'Buzón · prueba del diagrama', note: 'Se ha fijado un indicador de error, pero el componente aún no lo distingue por color. Esto no demuestra que falle un remitente.' },
    'cross-05': { title: 'Pulso en el cable', variant: 'ejemplo de línea no leída', where: 'Buzón · ilustración de carta no leída', note: 'En el buzón, las cartas no leídas tienen pulso. Aquí el movimiento es ilustrativo, no indica entrega ni procesamiento.' },
  } },
  vi: { slides: {
    'cross-01': { title: 'Đường thư đến', variant: 'ví dụ cổng và dây nối', where: 'Hộp thư · màn hình đầu (pages/inbox/InboxHome.tsx)', note: 'Trong trò chơi, cổng có số ở trên là thư, cổng dưới là trạng thái. Dây nối ở đây chỉ minh họa, không phải thư của bạn.' },
    'cross-02': { title: 'Bảng không có dây', variant: 'ví dụ không có kết nối', where: 'Hộp thư · trạng thái trống', note: 'Đây là sơ đồ trống. Hộp thư thật hiển thị thông báo thay cho bảng khi không có thư; lỗi đọc là trạng thái riêng.' },
    'cross-03': { title: 'Một dây nối', variant: 'ví dụ một kết nối', where: 'Hộp thư · minh họa một lá thư', note: 'Một dây nối các cổng giả định, không phải thư trong hộp thư của bạn.' },
    'cross-04': { title: 'Thử tín hiệu cổng', variant: 'ví dụ cờ báo lỗi', where: 'Hộp thư · thử sơ đồ cổng', note: 'Cờ báo lỗi đã được đặt nhưng thành phần chưa tô màu riêng cho nó. Đây không phải bằng chứng người gửi gặp sự cố.' },
    'cross-05': { title: 'Xung trên dây', variant: 'minh họa thư chưa đọc', where: 'Hộp thư · minh họa thư chưa đọc', note: 'Trong hộp thư, thư chưa đọc có xung. Chuyển động ở đây chỉ minh họa, không báo đã giao hay đang xử lý.' },
  } },
  id: { slides: {
    'cross-01': { title: 'Jalur masuk', variant: 'contoh port dan kabel', where: 'Kotak masuk · layar pertama (pages/inbox/InboxHome.tsx)', note: 'Dalam gim, port atas bernomor mewakili pesan dan port bawah mewakili status. Kabel ini hanya contoh, bukan pesan di kotak masuk Anda.' },
    'cross-02': { title: 'Panel tanpa kabel', variant: 'contoh tanpa sambungan', where: 'Kotak masuk · keadaan kosong', note: 'Ini diagram kosong. Kotak masuk asli menampilkan pesan alih-alih panel saat tidak ada surat; kesalahan baca adalah keadaan lain.' },
    'cross-03': { title: 'Satu kabel', variant: 'contoh satu sambungan', where: 'Kotak masuk · ilustrasi satu surat', note: 'Satu kabel menghubungkan port contoh, bukan surat dari kotak masuk Anda.' },
    'cross-04': { title: 'Uji sinyal port', variant: 'contoh tanda galat', where: 'Kotak masuk · uji diagram port', note: 'Tanda galat disetel, tetapi komponen belum memberi warna berbeda. Ini bukan bukti pengirim mengalami gangguan.' },
    'cross-05': { title: 'Denyut di kabel', variant: 'contoh jalur belum dibaca', where: 'Kotak masuk · ilustrasi surat belum dibaca', note: 'Di kotak masuk, surat belum dibaca diberi denyut. Gerakan ini ilustratif, bukan penanda pengiriman atau pemrosesan.' },
  } },
  fil: { slides: {
    'cross-01': { title: 'Mga papasok na linya', variant: 'halimbawang port at kable', where: 'Inbox · unang screen (pages/inbox/InboxHome.tsx)', note: 'Sa laro, ang may bilang na port sa itaas ay mga liham at ang nasa ibaba ay mga status. Halimbawa lang ang mga kable, hindi mga liham mo.' },
    'cross-02': { title: 'Panel na walang kable', variant: 'halimbawang walang koneksiyon', where: 'Inbox · bakanteng kalagayan', note: 'Bakanteng diagram ito. Mensahe ang ipinapakita ng tunay na inbox kung walang liham; ibang kalagayan ang error sa pagbasa.' },
    'cross-03': { title: 'Isang kable', variant: 'halimbawa ng isang koneksiyon', where: 'Inbox · larawan ng isang liham', note: 'Nagdurugtong ang kable ng mga halimbawang port, hindi ito liham mula sa inbox mo.' },
    'cross-04': { title: 'Pagsubok ng senyas ng port', variant: 'halimbawang tanda ng error', where: 'Inbox · pagsubok ng diagram ng port', note: 'May tanda ng error ngunit hindi pa ito naiiba ng kulay sa karaniwang senyas. Hindi ito patunay na may aberya ang nagpadala.' },
    'cross-05': { title: 'Pintig sa kable', variant: 'larawan ng linyang hindi pa nabasa', where: 'Inbox · larawan ng liham na hindi pa nabasa', note: 'Pumipintig ang hindi pa nabasang liham sa inbox. Halimbawa lang ang galaw, hindi tanda ng paghahatid o pagproseso.' },
  } },
};
