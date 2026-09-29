import type { Language } from './translations';

// Describes keys and retention policy in legal/consent.ts. Translating these
// labels must not change consent behavior or claim server-side deletion.
const entry = (purposes: readonly string[], periods: readonly string[], categories: readonly string[], walletProvider: string) => {
  if (purposes.length !== 6 || periods.length !== 3 || categories.length !== 3 || [...purposes, ...periods, ...categories, walletProvider].some(v => !v)) throw new Error('Incomplete storage inventory translation');
  return { purposes, periods, categories, walletProvider };
};
export const legalStorageCopy: Record<Language, ReturnType<typeof entry>> = {
  ru: entry([
    'Версия, время, категории и случайный ID записи выбора (не адрес кошелька)',
    'Локальные отметки чтения и значки','Отметка прохождения вводного экрана',
    'Выбранный язык интерфейса (не текст действий и не адрес кошелька)',
    'Звук и анимация интерфейса','Имя выбранного кошелька, не seed и не приватный ключ',
  ], ['180 дней','До отзыва / истечения выбора при следующем посещении','До очистки данных браузера; жизненный цикл проверить с кошельками'],
  ['Необходимая','Функциональная','Функция подключения по запросу'], 'Библиотека кошелька'),
  en: entry([
    'Version, time, categories and random choice record ID (not a wallet address)',
    'Local reading marks and badges','Introductory screen completion flag',
    'Selected interface language (not activity text or wallet address)',
    'Interface sound and animation','Selected wallet name, not a seed phrase or private key',
  ], ['180 days','Until withdrawal or expiry of the choice, on the next visit','Until browser data is cleared; verify the lifecycle with wallet providers'],
  ['Necessary','Functional','Connection feature on request'], 'Wallet library'),
  pt: entry([
    'Versão, horário, categorias e ID aleatório do registro de escolha (não é o endereço da carteira)',
    'Marcas locais de leitura e distintivos','Marca de conclusão da introdução',
    'Idioma de interface escolhido (não é texto de ações nem endereço de carteira)',
    'Som e animação da interface','Nome da carteira escolhida, não a frase de recuperação nem a chave privada',
  ], ['180 dias','Até a revogação ou expiração da escolha, na próxima visita','Até limpar os dados do navegador; verificar o ciclo de vida com as carteiras'],
  ['Necessária','Funcional','Recurso de conexão sob demanda'], 'Biblioteca da carteira'),
  es: entry([
    'Versión, hora, categorías e ID aleatorio del registro de elección (no es una dirección de cartera)',
    'Marcas locales de lectura e insignias','Marca de finalización de la introducción',
    'Idioma elegido para la interfaz (no es texto de actividad ni dirección de cartera)',
    'Sonido y animación de la interfaz','Nombre de la cartera elegida, no la frase semilla ni la clave privada',
  ], ['180 días','Hasta retirar la elección o que venza, en la siguiente visita','Hasta borrar los datos del navegador; verificar el ciclo de vida con las carteras'],
  ['Necesaria','Funcional','Función de conexión a petición'], 'Biblioteca de la cartera'),
  vi: entry([
    'Phiên bản, thời gian, danh mục và ID ngẫu nhiên của bản ghi lựa chọn (không phải địa chỉ ví)',
    'Dấu đã đọc và huy hiệu lưu cục bộ','Dấu hoàn tất màn hình giới thiệu',
    'Ngôn ngữ giao diện đã chọn (không phải nội dung thao tác hay địa chỉ ví)',
    'Âm thanh và hiệu ứng giao diện','Tên ví đã chọn, không phải cụm từ khôi phục hay khóa riêng',
  ], ['180 ngày','Cho đến khi rút lại hoặc lựa chọn hết hạn, vào lần truy cập tiếp theo','Cho đến khi xóa dữ liệu trình duyệt; cần kiểm tra vòng đời với nhà cung cấp ví'],
  ['Cần thiết','Chức năng','Tính năng kết nối theo yêu cầu'], 'Thư viện ví'),
  id: entry([
    'Versi, waktu, kategori, dan ID acak catatan pilihan (bukan alamat dompet)',
    'Tanda bacaan lokal dan lencana','Tanda selesainya layar pengantar',
    'Bahasa antarmuka yang dipilih (bukan teks aktivitas atau alamat dompet)',
    'Suara dan animasi antarmuka','Nama dompet yang dipilih, bukan frasa pemulihan atau kunci privat',
  ], ['180 hari','Sampai pilihan dicabut atau kedaluwarsa, pada kunjungan berikutnya','Sampai data peramban dihapus; periksa siklus hidup dengan penyedia dompet'],
  ['Diperlukan','Fungsional','Fitur koneksi atas permintaan'], 'Pustaka dompet'),
  fil: entry([
    'Bersiyon, oras, mga kategorya, at random ID ng tala ng pagpili (hindi address ng wallet)',
    'Lokal na marka ng pagbasa at mga badge','Tala ng pagkumpleto ng panimulang screen',
    'Napiling wika ng interface (hindi teksto ng gawain o address ng wallet)',
    'Tunog at animation ng interface','Pangalan ng napiling wallet, hindi seed phrase o pribadong susi',
  ], ['180 araw','Hanggang bawiin o mag-expire ang pagpili, sa susunod na pagbisita','Hanggang burahin ang datos ng browser; suriin ang lifecycle sa mga provider ng wallet'],
  ['Kinakailangan','Pang-andar','Feature ng pagkonekta kapag hiniling'], 'Library ng wallet'),
};
