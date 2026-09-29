import type { Language } from './translations';

type Copy = { title: string; section: (label: string) => string; screens: string; hint: string; retry: string; reload: string; loading: string };
export const errorScreenCopy: Record<Language, Copy> = {
  ru: { title: 'Не удалось показать экран', section: s => `Раздел: ${s}.`, screens: 'Экраны игры', hint: 'Попробуйте ещё раз. Если вы только что отправили транзакцию, сначала проверьте её статус в кошельке.', retry: 'Повторить', reload: 'Перезагрузить', loading: 'Загружаем экран…' },
  en: { title: 'Could not display this screen', section: s => `Section: ${s}.`, screens: 'Game screens', hint: 'Try again. If you just submitted a transaction, check its status in your wallet first.', retry: 'Try again', reload: 'Reload', loading: 'Loading screen…' },
  pt: { title: 'Não foi possível abrir esta tela', section: s => `Seção: ${s}.`, screens: 'Telas do jogo', hint: 'Tente novamente. Se acabou de enviar uma transação, confira primeiro o estado dela na carteira.', retry: 'Tentar novamente', reload: 'Recarregar', loading: 'Carregando tela…' },
  es: { title: 'No se pudo mostrar esta pantalla', section: s => `Sección: ${s}.`, screens: 'Pantallas del juego', hint: 'Inténtalo de nuevo. Si acabas de enviar una transacción, comprueba antes su estado en la cartera.', retry: 'Reintentar', reload: 'Recargar', loading: 'Cargando pantalla…' },
  vi: { title: 'Không thể hiển thị màn hình này', section: s => `Mục: ${s}.`, screens: 'Các màn hình trò chơi', hint: 'Hãy thử lại. Nếu bạn vừa gửi giao dịch, hãy kiểm tra trạng thái trong ví trước.', retry: 'Thử lại', reload: 'Tải lại', loading: 'Đang tải màn hình…' },
  id: { title: 'Layar ini tidak dapat ditampilkan', section: s => `Bagian: ${s}.`, screens: 'Layar permainan', hint: 'Coba lagi. Jika kamu baru mengirim transaksi, periksa statusnya di dompet terlebih dahulu.', retry: 'Coba lagi', reload: 'Muat ulang', loading: 'Memuat layar…' },
  fil: { title: 'Hindi maipakita ang screen na ito', section: s => `Bahagi: ${s}.`, screens: 'Mga screen ng laro', hint: 'Subukan muli. Kung kapapadala mo lang ng transaksiyon, tingnan muna ang status nito sa wallet.', retry: 'Subukan muli', reload: 'I-reload', loading: 'Binubuksan ang screen…' },
};
