import type { Language } from './translations';
import type { DeviceKey } from '../gallery/deviceMap';

type Device = { name: string; tab: string; sub: string; purpose: string };
type Chrome = {
  title: string; slides: string; instruments: string; back: string; previous: string; next: string;
  count: (index: number, total: number) => string; demo: string; device: string; where: string; visible: string;
  behavior: string; navigation: string;
};
export type GalleryCopy = { chrome: Chrome; devices: Record<DeviceKey, Device> };

/** File paths and device IDs stay in deviceMap; only human-readable text is translated here. */
export const galleryCopy: Record<Language, GalleryCopy> = {
  ru: {
    chrome: {
      title: 'Инструментальная палитра', slides: 'слайдов', instruments: 'аппаратов К4–К11', back: '← в игру',
      previous: '← назад', next: 'вперёд →', count: (n, total) => `слайд ${n} из ${total}`,
      demo: 'демо-значения', device: 'Прибор', where: 'Где в игре', visible: 'Что видно',
      behavior: 'Поведение окон', navigation: 'Слайды приборов',
    },
    devices: {
      frame: { name: 'Каркас окна', tab: 'все вкладки', sub: '—', purpose: 'уровни окна, этикетки, считыватели, лампы и клавиши' },
      cryo: { name: 'К4 · криостойка и сосуд N₂', tab: 'Лаборатория', sub: 'первый экран', purpose: 'ресурсы в стойке; сосуд иллюстрирует долю энергии сети, а не измеренный объём азота' },
      mix: { name: 'К5 · пульт мастерской', tab: 'Инструменты', sub: 'первый экран', purpose: 'каналы инструментов: стрелка показывает прочность, фейдер — часы смены' },
      sonar: { name: 'К6 · эхолот и сонар', tab: 'Участок · Рынок', sub: 'журнал участка и обзор рынка', purpose: 'лента участка и схема рыночных лотов; рисунок сам по себе не подтверждает цены или глубину' },
      plate: { name: 'К7 · планшет стойки 6 × 8', tab: 'Участок', sub: 'первый экран', purpose: 'лунки представляют места в стойке инструментов; занятые подсвечены' },
      gel: { name: 'К8 · гель-электрофорез', tab: 'Экономика', sub: 'обзор', purpose: 'полосы склада представляют подтверждённые остатки ресурсов' },
      cross: { name: 'К9 · кросс-панель', tab: 'Инбокс', sub: 'первый экран', purpose: 'письма соединяют пронумерованные порты с портами состояний' },
      cards: { name: 'К10 · перфокарты Жаккарда', tab: 'Задания', sub: 'первый экран', purpose: 'шаги задания на перфокарте; без данных прогресс остаётся неизвестным' },
      baro: { name: 'К11 · барограф', tab: 'Участок', sub: 'станция', purpose: 'лента нагрузки сети по доступным данным погоды' },
    },
  },
  en: {
    chrome: {
      title: 'Instrument gallery', slides: 'slides', instruments: 'K4–K11 devices', back: '← back to game',
      previous: '← previous', next: 'next →', count: (n, total) => `slide ${n} of ${total}`,
      demo: 'sample values', device: 'Device', where: 'Where in the game', visible: 'What it shows',
      behavior: 'How panels behave', navigation: 'Instrument slides',
    },
    devices: {
      frame: { name: 'Panel frame', tab: 'all tabs', sub: '—', purpose: 'panel levels, labels, readouts, lamps and controls' },
      cryo: { name: 'K4 · cryogenic rack and N₂ vessel', tab: 'Laboratory', sub: 'first screen', purpose: 'rack resources; the vessel illustrates network energy share, not a measured nitrogen volume' },
      mix: { name: 'K5 · workshop mixer', tab: 'Tools', sub: 'first screen', purpose: 'tool channels: the needle shows durability and the fader shows shift hours' },
      sonar: { name: 'K6 · echo trace and sonar', tab: 'Plot · Market', sub: 'plot log and market overview', purpose: 'plot trace and market lot diagram; the drawing alone does not verify prices or depth' },
      plate: { name: 'K7 · 6 × 8 rack plate', tab: 'Plot', sub: 'first screen', purpose: 'wells represent spaces on the tool rack; occupied ones light up' },
      gel: { name: 'K8 · gel electrophoresis', tab: 'Economy', sub: 'overview', purpose: 'warehouse bands represent confirmed resource holdings' },
      cross: { name: 'K9 · patch panel', tab: 'Inbox', sub: 'first screen', purpose: 'messages connect numbered ports to status ports' },
      cards: { name: 'K10 · Jacquard punch cards', tab: 'Quests', sub: 'first screen', purpose: 'quest steps on a punch card; progress stays unknown when data is missing' },
      baro: { name: 'K11 · barograph', tab: 'Plot', sub: 'station', purpose: 'network-load trace drawn from available weather data' },
    },
  },
  pt: {
    chrome: {
      title: 'Galeria de instrumentos', slides: 'páginas', instruments: 'aparelhos K4–K11', back: '← voltar ao jogo',
      previous: '← anterior', next: 'próximo →', count: (n, total) => `página ${n} de ${total}`,
      demo: 'valores de exemplo', device: 'Aparelho', where: 'Onde fica no jogo', visible: 'O que mostra',
      behavior: 'Como funcionam os painéis', navigation: 'Páginas dos instrumentos',
    },
    devices: {
      frame: { name: 'Estrutura do painel', tab: 'todas as abas', sub: '—', purpose: 'níveis do painel, etiquetas, visores, lâmpadas e controles' },
      cryo: { name: 'K4 · estante criogênica e vaso de N₂', tab: 'Laboratório', sub: 'primeira tela', purpose: 'recursos na estante; o vaso ilustra a parcela de energia da rede, não o volume de nitrogênio medido' },
      mix: { name: 'K5 · mesa da oficina', tab: 'Ferramentas', sub: 'primeira tela', purpose: 'canais das ferramentas: ponteiro de durabilidade e controle de horas do turno' },
      sonar: { name: 'K6 · registro e sonar', tab: 'Terreno · Mercado', sub: 'registro do terreno e visão do mercado', purpose: 'registro do terreno e esquema de lotes; o desenho não confirma preços nem profundidade' },
      plate: { name: 'K7 · placa de 6 × 8 poços', tab: 'Terreno', sub: 'primeira tela', purpose: 'poços representam lugares na estante; os ocupados acendem' },
      gel: { name: 'K8 · eletroforese em gel', tab: 'Economia', sub: 'visão geral', purpose: 'faixas do depósito representam saldos confirmados de recursos' },
      cross: { name: 'K9 · painel de conexões', tab: 'Caixa de entrada', sub: 'primeira tela', purpose: 'cartas ligam portas numeradas às portas de estado' },
      cards: { name: 'K10 · cartões perfurados Jacquard', tab: 'Missões', sub: 'primeira tela', purpose: 'etapas da missão em um cartão; sem dados, o progresso é desconhecido' },
      baro: { name: 'K11 · barógrafo', tab: 'Terreno', sub: 'estação', purpose: 'registro da carga da rede com dados meteorológicos disponíveis' },
    },
  },
  es: {
    chrome: {
      title: 'Galería de instrumentos', slides: 'láminas', instruments: 'aparatos K4–K11', back: '← volver al juego',
      previous: '← anterior', next: 'siguiente →', count: (n, total) => `lámina ${n} de ${total}`,
      demo: 'valores de ejemplo', device: 'Aparato', where: 'Dónde aparece', visible: 'Qué muestra',
      behavior: 'Cómo funcionan los paneles', navigation: 'Láminas de instrumentos',
    },
    devices: {
      frame: { name: 'Marco del panel', tab: 'todas las pestañas', sub: '—', purpose: 'niveles del panel, etiquetas, lecturas, luces y controles' },
      cryo: { name: 'K4 · soporte criogénico y depósito de N₂', tab: 'Laboratorio', sub: 'primera pantalla', purpose: 'recursos del soporte; el depósito ilustra la proporción de energía de la red, no un volumen medido de nitrógeno' },
      mix: { name: 'K5 · mesa del taller', tab: 'Herramientas', sub: 'primera pantalla', purpose: 'canales de herramientas: aguja de durabilidad y control de horas de turno' },
      sonar: { name: 'K6 · registro y sonar', tab: 'Parcela · Mercado', sub: 'registro de la parcela y vista del mercado', purpose: 'registro de la parcela y esquema de lotes; el dibujo no verifica precios ni profundidad' },
      plate: { name: 'K7 · placa de 6 × 8 pocillos', tab: 'Parcela', sub: 'primera pantalla', purpose: 'pocillos como espacios del soporte de herramientas; los ocupados se iluminan' },
      gel: { name: 'K8 · electroforesis en gel', tab: 'Economía', sub: 'resumen', purpose: 'bandas del almacén que representan saldos de recursos confirmados' },
      cross: { name: 'K9 · panel de conexiones', tab: 'Bandeja de entrada', sub: 'primera pantalla', purpose: 'las cartas unen puertos numerados con puertos de estado' },
      cards: { name: 'K10 · tarjetas perforadas Jacquard', tab: 'Misiones', sub: 'primera pantalla', purpose: 'pasos de la misión en una tarjeta; sin datos, el progreso es desconocido' },
      baro: { name: 'K11 · barógrafo', tab: 'Parcela', sub: 'estación', purpose: 'registro de carga de la red según los datos meteorológicos disponibles' },
    },
  },
  vi: {
    chrome: {
      title: 'Bộ sưu tập thiết bị', slides: 'trang', instruments: 'thiết bị K4–K11', back: '← về trò chơi',
      previous: '← trước', next: 'tiếp →', count: (n, total) => `trang ${n} / ${total}`,
      demo: 'giá trị minh họa', device: 'Thiết bị', where: 'Vị trí trong trò chơi', visible: 'Nội dung hiển thị',
      behavior: 'Cách bảng điều khiển hoạt động', navigation: 'Các trang thiết bị',
    },
    devices: {
      frame: { name: 'Khung bảng điều khiển', tab: 'mọi thẻ', sub: '—', purpose: 'các cấp bảng, nhãn, bộ đọc, đèn và phím điều khiển' },
      cryo: { name: 'K4 · giá lạnh và bình N₂', tab: 'Phòng thí nghiệm', sub: 'màn hình đầu', purpose: 'tài nguyên trên giá; bình minh họa phần năng lượng mạng, không phải thể tích nitơ được đo' },
      mix: { name: 'K5 · bàn điều khiển xưởng', tab: 'Công cụ', sub: 'màn hình đầu', purpose: 'kênh công cụ: kim chỉ độ bền, thanh trượt chỉ giờ của ca' },
      sonar: { name: 'K6 · dải hồi âm và sonar', tab: 'Khu đất · Thị trường', sub: 'nhật ký khu đất và tổng quan thị trường', purpose: 'dải ghi khu đất và sơ đồ lô hàng; hình vẽ không xác nhận giá hay độ sâu' },
      plate: { name: 'K7 · phiến 6 × 8 giếng', tab: 'Khu đất', sub: 'màn hình đầu', purpose: 'mỗi giếng là một chỗ trên giá công cụ; chỗ có công cụ sáng lên' },
      gel: { name: 'K8 · điện di trên gel', tab: 'Kinh tế', sub: 'tổng quan', purpose: 'các dải kho thể hiện số dư tài nguyên đã xác nhận' },
      cross: { name: 'K9 · bảng đấu nối', tab: 'Hộp thư', sub: 'màn hình đầu', purpose: 'thư nối cổng có số với cổng trạng thái' },
      cards: { name: 'K10 · thẻ đục lỗ Jacquard', tab: 'Nhiệm vụ', sub: 'màn hình đầu', purpose: 'các bước nhiệm vụ trên thẻ; thiếu dữ liệu thì tiến độ chưa rõ' },
      baro: { name: 'K11 · máy ghi khí áp', tab: 'Khu đất', sub: 'trạm', purpose: 'dải ghi tải mạng theo dữ liệu thời tiết hiện có' },
    },
  },
  id: {
    chrome: {
      title: 'Galeri instrumen', slides: 'halaman', instruments: 'alat K4–K11', back: '← kembali ke permainan',
      previous: '← sebelumnya', next: 'berikutnya →', count: (n, total) => `halaman ${n} dari ${total}`,
      demo: 'nilai contoh', device: 'Alat', where: 'Letak dalam permainan', visible: 'Yang ditampilkan',
      behavior: 'Cara kerja panel', navigation: 'Halaman instrumen',
    },
    devices: {
      frame: { name: 'Bingkai panel', tab: 'semua tab', sub: '—', purpose: 'tingkat panel, label, pembaca, lampu, dan tombol' },
      cryo: { name: 'K4 · rak kriogenik dan tabung N₂', tab: 'Laboratorium', sub: 'layar pertama', purpose: 'sumber daya di rak; tabung menggambarkan porsi energi jaringan, bukan volume nitrogen yang terukur' },
      mix: { name: 'K5 · konsol bengkel', tab: 'Peralatan', sub: 'layar pertama', purpose: 'saluran peralatan: jarum menunjukkan daya tahan, penggeser menunjukkan jam giliran' },
      sonar: { name: 'K6 · jejak gema dan sonar', tab: 'Lahan · Pasar', sub: 'catatan lahan dan ikhtisar pasar', purpose: 'jejak lahan dan skema lot; gambar ini tidak memverifikasi harga atau kedalaman' },
      plate: { name: 'K7 · pelat 6 × 8 sumur', tab: 'Lahan', sub: 'layar pertama', purpose: 'sumur mewakili tempat di rak peralatan; tempat yang terisi menyala' },
      gel: { name: 'K8 · elektroforesis gel', tab: 'Ekonomi', sub: 'ikhtisar', purpose: 'pita gudang menggambarkan saldo sumber daya yang terkonfirmasi' },
      cross: { name: 'K9 · panel sambungan', tab: 'Kotak masuk', sub: 'layar pertama', purpose: 'surat menghubungkan port bernomor ke port status' },
      cards: { name: 'K10 · kartu berlubang Jacquard', tab: 'Misi', sub: 'layar pertama', purpose: 'langkah misi di kartu; jika data tak tersedia, progres belum diketahui' },
      baro: { name: 'K11 · barograf', tab: 'Lahan', sub: 'stasiun', purpose: 'jejak beban jaringan dari data cuaca yang tersedia' },
    },
  },
  fil: {
    chrome: {
      title: 'Galeriya ng mga instrumento', slides: 'pahina', instruments: 'kagamitang K4–K11', back: '← bumalik sa laro',
      previous: '← nakaraan', next: 'susunod →', count: (n, total) => `pahina ${n} sa ${total}`,
      demo: 'mga halimbawang halaga', device: 'Instrumento', where: 'Saan sa laro', visible: 'Ano ang ipinapakita',
      behavior: 'Paano gumagana ang mga panel', navigation: 'Mga pahina ng instrumento',
    },
    devices: {
      frame: { name: 'Balangkas ng panel', tab: 'lahat ng tab', sub: '—', purpose: 'mga antas ng panel, tatak, reader, ilaw, at kontrol' },
      cryo: { name: 'K4 · cryogenic rack at sisidlang N₂', tab: 'Laboratoryo', sub: 'unang screen', purpose: 'mga yaman sa rack; ang sisidlan ay larawan ng bahagi ng enerhiya ng network, hindi sukat na dami ng nitrogen' },
      mix: { name: 'K5 · console ng pagawaan', tab: 'Mga kagamitan', sub: 'unang screen', purpose: 'mga channel ng kagamitan: tibay sa karayom, oras ng turno sa slider' },
      sonar: { name: 'K6 · echo trace at sonar', tab: 'Lupain · Pamilihan', sub: 'talaan ng lupain at buod ng pamilihan', purpose: 'tala ng lupain at larawan ng mga lot; hindi patunay ng presyo o lalim ang larawan' },
      plate: { name: 'K7 · 6 × 8 well plate', tab: 'Lupain', sub: 'unang screen', purpose: 'mga well bilang puwesto sa rack ng kagamitan; nagliliwanag ang may laman' },
      gel: { name: 'K8 · elektroporesis sa gel', tab: 'Ekonomiya', sub: 'buod', purpose: 'mga guhit sa imbakan para sa nakumpirmang balanse ng yaman' },
      cross: { name: 'K9 · panel ng koneksyon', tab: 'Mga mensahe', sub: 'unang screen', purpose: 'mga liham na nagdurugtong sa may-bilang na port at port ng status' },
      cards: { name: 'K10 · mga kard na butas ni Jacquard', tab: 'Mga gawain', sub: 'unang screen', purpose: 'mga hakbang sa kard; kapag walang datos, hindi alam ang progreso' },
      baro: { name: 'K11 · barograpo', tab: 'Lupain', sub: 'istasyon', purpose: 'tala ng pasan ng network batay sa makukuhang datos ng panahon' },
    },
  },
};
