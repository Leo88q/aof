import type { Language } from './translations';

type Copy = { connect: string; loading: string; unavailable: string; retry: string; preparing: string; pending: string; confirmed: string; unknown: string };
export const inboxReadCopy: Record<Language, Copy> = {
  ru: { connect: 'Подключите кошелёк, чтобы открыть личные сообщения.', loading: 'Подтвердите доступ в кошельке. Загружаем сообщения…', unavailable: 'Не удалось подтвердить доступ или прочитать сообщения. Содержимое ящика неизвестно.', retry: 'Повторить запрос', preparing: 'Проверяем выдачу награды…', pending: 'Выдача награды отложена или требует сверки. Проверьте статус, прежде чем повторять действие.', confirmed: 'Награда подтверждена в сети.', unknown: 'Не удалось подтвердить выдачу награды. Проверьте кошелёк и письмо, прежде чем повторять действие.' },
  en: { connect: 'Connect a wallet to open your private messages.', loading: 'Authorize access in your wallet. Loading messages…', unavailable: 'Could not authorize access or read your messages. Inbox contents are unknown.', retry: 'Try again', preparing: 'Checking the reward claim…', pending: 'Reward issuance is deferred or needs reconciliation. Check its status before trying again.', confirmed: 'Reward confirmed on-chain.', unknown: 'Could not confirm reward issuance. Check your wallet and this message before trying again.' },
  pt: { connect: 'Conecte a carteira para abrir suas mensagens privadas.', loading: 'Autorize o acesso na carteira. Carregando mensagens…', unavailable: 'Não foi possível autorizar o acesso ou ler as mensagens. O conteúdo da caixa é desconhecido.', retry: 'Tentar novamente', preparing: 'Verificando o resgate da recompensa…', pending: 'A emissão da recompensa foi adiada ou precisa de conferência. Verifique o estado antes de tentar novamente.', confirmed: 'Recompensa confirmada na rede.', unknown: 'Não foi possível confirmar a emissão da recompensa. Verifique a carteira e a mensagem antes de tentar novamente.' },
  es: { connect: 'Conecta tu cartera para abrir los mensajes privados.', loading: 'Autoriza el acceso en tu cartera. Cargando mensajes…', unavailable: 'No se pudo autorizar el acceso ni leer los mensajes. Se desconoce el contenido del buzón.', retry: 'Reintentar', preparing: 'Comprobando la entrega de la recompensa…', pending: 'La entrega se ha aplazado o requiere revisión. Comprueba su estado antes de reintentar.', confirmed: 'Recompensa confirmada en la cadena.', unknown: 'No se pudo confirmar la entrega. Comprueba tu cartera y el mensaje antes de reintentar.' },
  vi: { connect: 'Kết nối ví để mở tin nhắn riêng.', loading: 'Cho phép truy cập trong ví. Đang tải tin nhắn…', unavailable: 'Không thể xác minh quyền truy cập hoặc đọc tin nhắn. Chưa rõ nội dung hộp thư.', retry: 'Thử lại', preparing: 'Đang kiểm tra phần thưởng…', pending: 'Đã hoãn phát thưởng hoặc cần đối chiếu. Hãy kiểm tra trạng thái trước khi thử lại.', confirmed: 'Đã xác nhận phần thưởng trên chuỗi.', unknown: 'Không thể xác nhận việc phát thưởng. Hãy kiểm tra ví và tin nhắn trước khi thử lại.' },
  id: { connect: 'Hubungkan dompet untuk membuka pesan pribadi.', loading: 'Izinkan akses melalui dompet. Memuat pesan…', unavailable: 'Akses tidak dapat diverifikasi atau pesan tidak dapat dibaca. Isi kotak masuk belum diketahui.', retry: 'Coba lagi', preparing: 'Memeriksa pengiriman hadiah…', pending: 'Pengiriman hadiah ditunda atau perlu ditinjau. Periksa statusnya sebelum mencoba lagi.', confirmed: 'Hadiah dikonfirmasi di blockchain.', unknown: 'Pengiriman hadiah tidak dapat dikonfirmasi. Periksa dompet dan pesan sebelum mencoba lagi.' },
  fil: { connect: 'Ikonekta ang wallet para buksan ang iyong mga pribadong mensahe.', loading: 'Pahintulutan ang access sa wallet. Kinukuha ang mga mensahe…', unavailable: 'Hindi ma-verify ang access o mabasa ang mga mensahe. Hindi pa alam ang laman ng inbox.', retry: 'Subukan muli', preparing: 'Sinusuri ang gantimpala…', pending: 'Naantala ang pagbibigay ng gantimpala o kailangan pa itong suriin. Tingnan ang status bago subukang muli.', confirmed: 'Kumpirmado sa blockchain ang gantimpala.', unknown: 'Hindi makumpirma ang pagbibigay ng gantimpala. Suriin ang wallet at mensahe bago subukang muli.' },
};

/** UI labels only: sender-authored message bodies remain in their original language. */
type InboxUi = {
  unreadCount: (n: string) => string;
  intro: string; sticker: string; ports: (n: string) => string; panelTitle: string; panelSub: string;
  waiting: string; read: string; fresh: string; empty: string;
  letters: string; inBox: string; unread: string; lamps: string;
  rewardLetters: string; includeReward: string;
  reward: string; claim: string; claimed: string; close: string; original: string;
};
export const inboxUiCopy: Record<Language, InboxUi> = {
  ru: {
    unreadCount: n => `Непрочитанных: ${n}`,
    intro: 'Личные сообщения и сведения о возможных наградах.', sticker: 'ЯЩИК', ports: n => `ПОРТОВ ${n}`, panelTitle: 'Панель сообщений', panelSub: 'один порт — одно письмо',
    waiting: 'ЖДЁТ', read: 'ПРОЧИТАНО', fresh: 'НОВОЕ', empty: 'Ящик пуст — писем пока нет.',
    letters: 'Писем', inBox: 'в ящике', unread: 'Непрочитанных', lamps: 'светятся индикаторы', rewardLetters: 'С наградой', includeReward: 'письма с наградой',
    reward: 'Награда', claim: 'Получить награду', claimed: 'Награда подтверждена', close: 'Закрыть письмо', original: 'Текст письма показан на языке отправителя.',
  },
  en: {
    unreadCount: n => `${n} unread`,
    intro: 'Private messages and details of any rewards.', sticker: 'INBOX', ports: n => `${n} PORTS`, panelTitle: 'Message patch panel', panelSub: 'one port per message',
    waiting: 'PENDING', read: 'READ', fresh: 'NEW', empty: 'Your inbox is empty. No messages yet.',
    letters: 'Messages', inBox: 'in your inbox', unread: 'Unread', lamps: 'indicator lights', rewardLetters: 'With rewards', includeReward: 'messages with rewards',
    reward: 'Reward', claim: 'Claim reward', claimed: 'Reward confirmed', close: 'Close message', original: 'Message text appears in the sender’s original language.',
  },
  pt: {
    unreadCount: n => `${n} não lidas`,
    intro: 'Mensagens privadas e informações sobre possíveis recompensas.', sticker: 'CAIXA', ports: n => `${n} PORTAS`, panelTitle: 'Painel de mensagens', panelSub: 'uma porta por mensagem',
    waiting: 'PENDENTE', read: 'LIDA', fresh: 'NOVA', empty: 'A caixa está vazia. Ainda não há mensagens.',
    letters: 'Mensagens', inBox: 'na caixa', unread: 'Não lidas', lamps: 'indicadores acesos', rewardLetters: 'Com recompensa', includeReward: 'mensagens com recompensa',
    reward: 'Recompensa', claim: 'Receber recompensa', claimed: 'Recompensa confirmada', close: 'Fechar mensagem', original: 'O texto da mensagem aparece no idioma original do remetente.',
  },
  es: {
    unreadCount: n => `${n} sin leer`,
    intro: 'Mensajes privados e información sobre posibles recompensas.', sticker: 'BUZÓN', ports: n => `${n} PUERTOS`, panelTitle: 'Panel de mensajes', panelSub: 'un puerto por mensaje',
    waiting: 'PENDIENTE', read: 'LEÍDO', fresh: 'NUEVO', empty: 'El buzón está vacío. Aún no hay mensajes.',
    letters: 'Mensajes', inBox: 'en el buzón', unread: 'Sin leer', lamps: 'indicadores encendidos', rewardLetters: 'Con recompensa', includeReward: 'mensajes con recompensa',
    reward: 'Recompensa', claim: 'Recibir recompensa', claimed: 'Recompensa confirmada', close: 'Cerrar mensaje', original: 'El texto del mensaje aparece en el idioma original del remitente.',
  },
  vi: {
    unreadCount: n => `${n} tin chưa đọc`,
    intro: 'Tin nhắn riêng và thông tin về phần thưởng nếu có.', sticker: 'HỘP THƯ', ports: n => `${n} CỔNG`, panelTitle: 'Bảng kết nối hộp thư', panelSub: 'mỗi cổng một tin nhắn',
    waiting: 'CHỜ NHẬN', read: 'ĐÃ ĐỌC', fresh: 'MỚI', empty: 'Hộp thư trống. Chưa có tin nhắn.',
    letters: 'Tin nhắn', inBox: 'trong hộp thư', unread: 'Chưa đọc', lamps: 'đèn báo sáng', rewardLetters: 'Có phần thưởng', includeReward: 'tin nhắn có phần thưởng',
    reward: 'Phần thưởng', claim: 'Nhận phần thưởng', claimed: 'Đã xác nhận phần thưởng', close: 'Đóng tin nhắn', original: 'Nội dung tin nhắn được hiển thị bằng ngôn ngữ gốc của người gửi.',
  },
  id: {
    unreadCount: n => `${n} belum dibaca`,
    intro: 'Pesan pribadi dan informasi tentang hadiah jika ada.', sticker: 'KOTAK MASUK', ports: n => `${n} PORT`, panelTitle: 'Panel pesan', panelSub: 'satu port per pesan',
    waiting: 'MENUNGGU', read: 'DIBACA', fresh: 'BARU', empty: 'Kotak masuk kosong. Belum ada pesan.',
    letters: 'Pesan', inBox: 'di kotak masuk', unread: 'Belum dibaca', lamps: 'lampu indikator menyala', rewardLetters: 'Dengan hadiah', includeReward: 'pesan dengan hadiah',
    reward: 'Hadiah', claim: 'Klaim hadiah', claimed: 'Hadiah dikonfirmasi', close: 'Tutup pesan', original: 'Isi pesan ditampilkan dalam bahasa asli pengirim.',
  },
  fil: {
    unreadCount: n => `${n} hindi pa nababasa`,
    intro: 'Mga pribadong mensahe at impormasyon tungkol sa mga gantimpala, kung mayroon.', sticker: 'MGA MENSAHE', ports: n => `${n} PORT`, panelTitle: 'Panel ng mga mensahe', panelSub: 'isang port sa bawat mensahe',
    waiting: 'NAGHIHINTAY', read: 'NABASA', fresh: 'BAGO', empty: 'Walang laman ang inbox. Wala pang mensahe.',
    letters: 'Mga mensahe', inBox: 'sa inbox', unread: 'Hindi pa nababasa', lamps: 'nakailaw ang mga palatandaan', rewardLetters: 'May gantimpala', includeReward: 'mga mensaheng may gantimpala',
    reward: 'Gantimpala', claim: 'Kunin ang gantimpala', claimed: 'Kumpirmado ang gantimpala', close: 'Isara ang mensahe', original: 'Ipinapakita ang mensahe sa orihinal na wika ng nagpadala.',
  },
};
