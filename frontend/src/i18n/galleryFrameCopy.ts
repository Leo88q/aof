import type { Language } from './translations';

export const frameIds = ['frame-01', 'frame-02', 'frame-03', 'frame-04', 'frame-05', 'frame-06'] as const;
export type FrameId = typeof frameIds[number];
type Meta = { title: string; variant: string; where: string; note: string };
type Sample = {
  hero: { tag: string; mode: string; title: string; subtitle: string; connected: string; noEnergy: string; energy: string; samples: string; noWallet: string; noData: string };
  panel: { tag: string; mode: string; title: string; subtitle: string; note: string };
  quiet: { title: string; note: string };
  readouts: { tag: string; mode: string; title: string; subtitle: string; stocked: string; total: string; fullest: string; archive: string; noArchive: string };
  controls: { tag: string; mode: string; title: string; connected: string; queued: string; error: string; resources: string; quests: string; tabs: string; collect: string; inspect: string; help: string };
  swatches: readonly [string, string, string, string, string, string, string, string];
};
type FrameCopy = { slides: Record<FrameId, Meta>; sample: Sample };

/** The first six slides are illustrative, not live wallet or network readings. */
export const galleryFrameCopy: Record<Language, FrameCopy> = {
  ru: {
    slides: {
      'frame-01': { title: 'Крупное окно', variant: 'уровень «hero» — один прибор на весь экран', where: 'Лаборатория, первый экран · Лабораторное окно стоит первым', note: 'Крупное окно держит заголовок, этикетку и ленту ламп. Всё, что ниже — плитки и приборы на его полке.' },
      'frame-02': { title: 'Рабочее окно', variant: 'уровень «panel» — прибор в потоке страницы', where: 'везде, где прибор не занимает экран целиком', note: 'Основной уровень: окно с бортиком, этикеткой слева и режимом справа.' },
      'frame-03': { title: 'Тихое окно', variant: 'уровень «quiet» — пояснение и справка', where: 'подписи под приборами, справки, пустые состояния', note: 'Тихое окно не спорит с прибором: нет бортика, есть подпись.' },
      'frame-04': { title: 'Этикетки и считыватели', variant: 'штамп + значения с пояснениями', where: 'все приборные окна', note: 'Этикетка слева — имя аппарата; режим справа. Считыватель показывает значение и то, откуда оно взято.' },
      'frame-05': { title: 'Лампы, клавиши, плитки', variant: 'управление без декора', where: 'панели действий, стойки, кошельки', note: 'Лампа горит только от реального источника. Клавиша ведёт себя одинаково во всех окнах.' },
      'frame-06': { title: 'Палитра A', variant: 'морозное стекло: 8 цветов', where: 'src/theme/forge.css — переменные --fg-*', note: 'Цвет в окнах идёт от значений и ламп, а не от рамок: фон почти чёрный, свет — циан.' },
    },
    sample: {
      hero: { tag: 'ЛАБОРАТОРИЯ', mode: 'СТЕНД A · ГЛУБОКИЙ ХОЛОД', title: 'Твоя лаборатория', subtitle: 'стойка образцов и сосуд с азотом', connected: 'связь с сетью', noEnergy: 'энергии в сети нет', energy: 'Энергия', samples: 'Образцов', noWallet: 'кошелёк не подключён', noData: 'нет данных' },
      panel: { tag: 'СТОЙКА', mode: 'В РАБОТЕ', title: 'Микропланшет места', subtitle: 'лунка — место под инструмент', note: 'Рабочее окно редко стоит одно: под ним идут плитки и считыватели.' },
      quiet: { title: 'Зачем это окно', note: 'Тихий уровень нужен там, где прибор молчит: объяснить, чего не хватает, вместо пустоты.' },
      readouts: { tag: 'ОБРАЗЕЦ · 04', mode: 'НОРМА', title: 'Считыватели', subtitle: 'подпись · значение · пояснение', stocked: 'Позиций с запасом', total: 'всего позиций: 27', fullest: 'Полнее всего', archive: 'Архив смены', noArchive: 'архив не ведётся' },
      controls: { tag: 'УПРАВЛЕНИЕ', mode: 'РУЧНОЙ', title: 'Органы управления', connected: 'связь', queued: 'в очереди', error: 'сбой', resources: 'ресурсов', quests: 'заданий', tabs: 'вкладок', collect: 'Забрать', inspect: 'Осмотреть', help: 'Справка' },
      swatches: ['фон', 'текст', 'свет', 'яркий свет', 'норма', 'награда', 'сбой', 'глубина'],
    },
  },
  en: {
    slides: {
      'frame-01': { title: 'Full-screen panel', variant: 'hero level — one device fills the screen', where: 'Laboratory, first screen · the laboratory panel appears first', note: 'The full-screen panel carries a title, an engraved label and a strip of lamps. Tiles and instruments sit below it.' },
      'frame-02': { title: 'Working panel', variant: 'panel level — an instrument in the page flow', where: 'wherever a device does not fill the screen', note: 'The standard level: a rimmed panel, a label on the left and its mode on the right.' },
      'frame-03': { title: 'Quiet panel', variant: 'quiet level — explanation and help', where: 'device captions, help text and empty states', note: 'The quiet panel leaves the instrument room to speak: no rim, just a caption.' },
      'frame-04': { title: 'Labels and readouts', variant: 'engraved label + explained readings', where: 'all instrument panels', note: 'The left label names the apparatus; its mode sits on the right. A readout shows a value and its source.' },
      'frame-05': { title: 'Lamps, keys and tiles', variant: 'controls without decoration', where: 'action panels, racks and wallets', note: 'A live lamp needs a real source. The same key behaves consistently across panels.' },
      'frame-06': { title: 'Palette A', variant: 'frosted glass: eight colors', where: 'src/theme/forge.css — the --fg-* variables', note: 'Colors follow readings and lamps, not borders: an almost black backdrop and cyan light.' },
    },
    sample: {
      hero: { tag: 'LABORATORY', mode: 'STATION A · DEEP COLD', title: 'Your laboratory', subtitle: 'sample rack and nitrogen vessel', connected: 'network connected', noEnergy: 'no network energy', energy: 'Energy', samples: 'Samples', noWallet: 'wallet not connected', noData: 'no data' },
      panel: { tag: 'RACK', mode: 'WORKING', title: 'Well plate', subtitle: 'each well holds a tool', note: 'The working panel rarely stands alone: tiles and readouts sit below it.' },
      quiet: { title: 'Why this panel?', note: 'The quiet level explains what is missing when an instrument has no reading.' },
      readouts: { tag: 'SAMPLE · 04', mode: 'NOMINAL', title: 'Readouts', subtitle: 'label · value · explanation', stocked: 'Stocked positions', total: 'total positions: 27', fullest: 'Most in stock', archive: 'Shift archive', noArchive: 'no archive kept' },
      controls: { tag: 'CONTROLS', mode: 'MANUAL', title: 'Control panel', connected: 'connected', queued: 'queued', error: 'fault', resources: 'resources', quests: 'quests', tabs: 'tabs', collect: 'Collect', inspect: 'Inspect', help: 'Help' },
      swatches: ['background', 'text', 'light', 'bright light', 'normal', 'reward', 'fault', 'depth'],
    },
  },
  pt: {
    slides: {
      'frame-01': { title: 'Painel principal', variant: 'nível «hero» — um aparelho ocupa a tela', where: 'Laboratório, primeira tela · o painel principal vem primeiro', note: 'O painel principal reúne título, etiqueta e faixa de luzes. Abaixo ficam os indicadores e aparelhos.' },
      'frame-02': { title: 'Painel de trabalho', variant: 'nível «panel» — aparelho no fluxo da página', where: 'quando o aparelho não ocupa a tela inteira', note: 'O nível padrão: painel com borda, etiqueta à esquerda e modo à direita.' },
      'frame-03': { title: 'Painel discreto', variant: 'nível «quiet» — explicação e ajuda', where: 'legendas, ajudas e estados sem dados', note: 'O painel discreto não compete com o aparelho: sem borda, apenas legenda.' },
      'frame-04': { title: 'Etiquetas e visores', variant: 'etiqueta gravada + valores explicados', where: 'todos os painéis de aparelhos', note: 'A etiqueta à esquerda nomeia o aparelho; à direita fica o modo. O visor mostra valor e origem.' },
      'frame-05': { title: 'Luzes, teclas e indicadores', variant: 'controles sem decoração', where: 'painéis de ação, estantes e carteiras', note: 'Uma luz ativa precisa de uma fonte real. A tecla funciona da mesma forma em todos os painéis.' },
      'frame-06': { title: 'Paleta A', variant: 'vidro fosco: oito cores', where: 'src/theme/forge.css — variáveis --fg-*', note: 'A cor acompanha valores e luzes, não bordas: fundo quase preto e brilho ciano.' },
    },
    sample: {
      hero: { tag: 'LABORATÓRIO', mode: 'ESTAÇÃO A · FRIO INTENSO', title: 'Seu laboratório', subtitle: 'estante de amostras e vaso de nitrogênio', connected: 'rede conectada', noEnergy: 'sem energia na rede', energy: 'Energia', samples: 'Amostras', noWallet: 'carteira desconectada', noData: 'sem dados' },
      panel: { tag: 'ESTANTE', mode: 'EM USO', title: 'Placa de poços', subtitle: 'cada poço recebe uma ferramenta', note: 'O painel de trabalho raramente aparece sozinho: abaixo ficam indicadores e visores.' },
      quiet: { title: 'Por que este painel?', note: 'O nível discreto explica o que falta quando o aparelho não tem leitura.' },
      readouts: { tag: 'AMOSTRA · 04', mode: 'NORMAL', title: 'Visores', subtitle: 'rótulo · valor · explicação', stocked: 'Posições abastecidas', total: 'total de posições: 27', fullest: 'Maior estoque', archive: 'Arquivo do turno', noArchive: 'sem arquivo' },
      controls: { tag: 'CONTROLES', mode: 'MANUAL', title: 'Painel de controle', connected: 'conectado', queued: 'na fila', error: 'falha', resources: 'recursos', quests: 'missões', tabs: 'abas', collect: 'Coletar', inspect: 'Examinar', help: 'Ajuda' },
      swatches: ['fundo', 'texto', 'luz', 'luz intensa', 'normal', 'recompensa', 'falha', 'profundidade'],
    },
  },
  es: {
    slides: {
      'frame-01': { title: 'Panel principal', variant: 'nivel «hero» — un aparato ocupa la pantalla', where: 'Laboratorio, primera pantalla · el panel principal va primero', note: 'El panel principal reúne título, etiqueta y una fila de luces. Debajo van los indicadores y aparatos.' },
      'frame-02': { title: 'Panel de trabajo', variant: 'nivel «panel» — aparato en la página', where: 'cuando el aparato no ocupa toda la pantalla', note: 'El nivel habitual: panel con borde, etiqueta a la izquierda y modo a la derecha.' },
      'frame-03': { title: 'Panel discreto', variant: 'nivel «quiet» — explicación y ayuda', where: 'leyendas, ayudas y estados sin datos', note: 'El panel discreto no compite con el aparato: sin borde, solo una leyenda.' },
      'frame-04': { title: 'Etiquetas y lecturas', variant: 'etiqueta grabada + valores explicados', where: 'todos los paneles de aparatos', note: 'La etiqueta izquierda nombra el aparato; a la derecha va el modo. La lectura muestra valor y origen.' },
      'frame-05': { title: 'Luces, teclas e indicadores', variant: 'controles sin adornos', where: 'paneles de acción, soportes y carteras', note: 'Una luz encendida necesita una fuente real. La tecla funciona igual en todos los paneles.' },
      'frame-06': { title: 'Paleta A', variant: 'vidrio esmerilado: ocho colores', where: 'src/theme/forge.css — variables --fg-*', note: 'El color acompaña valores y luces, no marcos: fondo casi negro y luz cian.' },
    },
    sample: {
      hero: { tag: 'LABORATORIO', mode: 'ESTACIÓN A · FRÍO INTENSO', title: 'Tu laboratorio', subtitle: 'soporte de muestras y depósito de nitrógeno', connected: 'red conectada', noEnergy: 'sin energía en la red', energy: 'Energía', samples: 'Muestras', noWallet: 'cartera desconectada', noData: 'sin datos' },
      panel: { tag: 'SOPORTE', mode: 'EN USO', title: 'Placa de pocillos', subtitle: 'cada pocillo aloja una herramienta', note: 'El panel de trabajo rara vez aparece solo: debajo van indicadores y lecturas.' },
      quiet: { title: '¿Por qué este panel?', note: 'El nivel discreto explica qué falta cuando el aparato no ofrece lecturas.' },
      readouts: { tag: 'MUESTRA · 04', mode: 'NORMAL', title: 'Lecturas', subtitle: 'rótulo · valor · explicación', stocked: 'Posiciones con existencias', total: 'posiciones totales: 27', fullest: 'Mayor reserva', archive: 'Archivo del turno', noArchive: 'sin archivo' },
      controls: { tag: 'CONTROLES', mode: 'MANUAL', title: 'Panel de control', connected: 'conectado', queued: 'en cola', error: 'fallo', resources: 'recursos', quests: 'misiones', tabs: 'pestañas', collect: 'Recoger', inspect: 'Inspeccionar', help: 'Ayuda' },
      swatches: ['fondo', 'texto', 'luz', 'luz brillante', 'normal', 'recompensa', 'fallo', 'profundidad'],
    },
  },
  vi: {
    slides: {
      'frame-01': { title: 'Bảng chính', variant: 'cấp «hero» — một thiết bị phủ màn hình', where: 'Phòng thí nghiệm, màn hình đầu · bảng chính xuất hiện trước', note: 'Bảng chính có tiêu đề, nhãn và dải đèn. Các ô và thiết bị nằm phía dưới.' },
      'frame-02': { title: 'Bảng làm việc', variant: 'cấp «panel» — thiết bị trong trang', where: 'nơi thiết bị không chiếm hết màn hình', note: 'Cấp thông thường: bảng có viền, nhãn bên trái và chế độ bên phải.' },
      'frame-03': { title: 'Bảng chú thích', variant: 'cấp «quiet» — giải thích và trợ giúp', where: 'chú thích thiết bị, trợ giúp và trạng thái thiếu dữ liệu', note: 'Bảng chú thích không lấn át thiết bị: không viền, chỉ có lời giải thích.' },
      'frame-04': { title: 'Nhãn và bộ đọc', variant: 'nhãn khắc + giá trị có giải thích', where: 'mọi bảng thiết bị', note: 'Nhãn bên trái ghi tên máy; chế độ ở bên phải. Bộ đọc cho biết giá trị và nguồn dữ liệu.' },
      'frame-05': { title: 'Đèn, phím và ô', variant: 'điều khiển không trang trí', where: 'bảng thao tác, giá dụng cụ, ví', note: 'Đèn hoạt động cần nguồn dữ liệu thật. Phím vận hành nhất quán trên mọi bảng.' },
      'frame-06': { title: 'Bảng màu A', variant: 'kính mờ: tám màu', where: 'src/theme/forge.css — biến --fg-*', note: 'Màu đi theo giá trị và đèn, không phải khung: nền gần đen, ánh sáng xanh lam.' },
    },
    sample: {
      hero: { tag: 'PHÒNG THÍ NGHIỆM', mode: 'TRẠM A · LẠNH SÂU', title: 'Phòng thí nghiệm của bạn', subtitle: 'giá mẫu và bình nitơ', connected: 'đã kết nối mạng', noEnergy: 'mạng không có năng lượng', energy: 'Năng lượng', samples: 'Mẫu', noWallet: 'chưa kết nối ví', noData: 'chưa có dữ liệu' },
      panel: { tag: 'GIÁ DỤNG CỤ', mode: 'ĐANG DÙNG', title: 'Phiến nhiều giếng', subtitle: 'mỗi giếng là chỗ của một công cụ', note: 'Bảng làm việc ít khi đứng một mình: bên dưới còn có ô và bộ đọc.' },
      quiet: { title: 'Bảng này dùng để làm gì?', note: 'Bảng chú thích giải thích điều còn thiếu khi thiết bị chưa có số liệu.' },
      readouts: { tag: 'MẪU · 04', mode: 'BÌNH THƯỜNG', title: 'Bộ đọc', subtitle: 'nhãn · giá trị · giải thích', stocked: 'Vị trí có hàng', total: 'tổng vị trí: 27', fullest: 'Nhiều nhất', archive: 'Lưu trữ ca', noArchive: 'chưa lưu trữ' },
      controls: { tag: 'ĐIỀU KHIỂN', mode: 'THỦ CÔNG', title: 'Bảng điều khiển', connected: 'đã kết nối', queued: 'đang chờ', error: 'lỗi', resources: 'tài nguyên', quests: 'nhiệm vụ', tabs: 'thẻ', collect: 'Nhận', inspect: 'Xem', help: 'Trợ giúp' },
      swatches: ['nền', 'chữ', 'ánh sáng', 'ánh sáng mạnh', 'bình thường', 'phần thưởng', 'lỗi', 'độ sâu'],
    },
  },
  id: {
    slides: {
      'frame-01': { title: 'Panel utama', variant: 'tingkat «hero» — satu alat memenuhi layar', where: 'Laboratorium, layar pertama · panel utama tampil di awal', note: 'Panel utama memuat judul, label, dan deretan lampu. Ubin dan alat berada di bawahnya.' },
      'frame-02': { title: 'Panel kerja', variant: 'tingkat «panel» — alat di dalam halaman', where: 'saat alat tidak memenuhi seluruh layar', note: 'Tingkat standar: panel berbingkai, label di kiri dan mode di kanan.' },
      'frame-03': { title: 'Panel keterangan', variant: 'tingkat «quiet» — penjelasan dan bantuan', where: 'keterangan alat, bantuan, dan status tanpa data', note: 'Panel keterangan tidak menyaingi alat: tanpa bingkai, hanya keterangan.' },
      'frame-04': { title: 'Label dan pembacaan', variant: 'label terukir + nilai yang dijelaskan', where: 'semua panel alat', note: 'Label kiri menamai alat; mode di kanan. Pembaca menampilkan nilai dan sumbernya.' },
      'frame-05': { title: 'Lampu, tombol, dan ubin', variant: 'kendali tanpa hiasan', where: 'panel tindakan, rak, dan dompet', note: 'Lampu aktif memerlukan sumber nyata. Tombol bekerja konsisten di semua panel.' },
      'frame-06': { title: 'Palet A', variant: 'kaca buram: delapan warna', where: 'src/theme/forge.css — variabel --fg-*', note: 'Warna mengikuti angka dan lampu, bukan bingkai: latar hampir hitam dan cahaya sian.' },
    },
    sample: {
      hero: { tag: 'LABORATORIUM', mode: 'STASIUN A · DINGIN DALAM', title: 'Laboratoriummu', subtitle: 'rak sampel dan tabung nitrogen', connected: 'jaringan terhubung', noEnergy: 'jaringan tanpa energi', energy: 'Energi', samples: 'Sampel', noWallet: 'dompet belum terhubung', noData: 'tidak ada data' },
      panel: { tag: 'RAK', mode: 'BEROPERASI', title: 'Pelat sumur', subtitle: 'tiap sumur untuk satu peralatan', note: 'Panel kerja jarang berdiri sendiri: ubin dan pembaca ada di bawahnya.' },
      quiet: { title: 'Mengapa ada panel ini?', note: 'Panel keterangan menjelaskan hal yang belum tersedia saat alat tidak memiliki pembacaan.' },
      readouts: { tag: 'SAMPEL · 04', mode: 'NORMAL', title: 'Pembaca', subtitle: 'label · nilai · penjelasan', stocked: 'Posisi terisi', total: 'total posisi: 27', fullest: 'Stok terbanyak', archive: 'Arsip giliran', noArchive: 'tidak ada arsip' },
      controls: { tag: 'KENDALI', mode: 'MANUAL', title: 'Panel kendali', connected: 'terhubung', queued: 'antrean', error: 'gangguan', resources: 'sumber daya', quests: 'misi', tabs: 'tab', collect: 'Ambil', inspect: 'Periksa', help: 'Bantuan' },
      swatches: ['latar', 'teks', 'cahaya', 'cahaya terang', 'normal', 'hadiah', 'gangguan', 'kedalaman'],
    },
  },
  fil: {
    slides: {
      'frame-01': { title: 'Pangunahing panel', variant: 'antas «hero» — isang instrumento ang sakop ng screen', where: 'Laboratoryo, unang screen · nauuna ang pangunahing panel', note: 'Nasa pangunahing panel ang pamagat, tatak, at hanay ng mga ilaw. Nasa ibaba ang mga tile at aparato.' },
      'frame-02': { title: 'Panel ng trabaho', variant: 'antas «panel» — aparato sa loob ng pahina', where: 'kapag hindi sakop ng aparato ang buong screen', note: 'Karaniwang antas: panel na may gilid, tatak sa kaliwa, at mode sa kanan.' },
      'frame-03': { title: 'Tahimik na panel', variant: 'antas «quiet» — paliwanag at tulong', where: 'caption ng aparato, tulong, at estadong walang datos', note: 'Hindi nakikipag-agawan ang tahimik na panel sa aparato: walang gilid, may caption lang.' },
      'frame-04': { title: 'Mga tatak at reader', variant: 'tatak na nakaukit + halagang may paliwanag', where: 'lahat ng panel ng aparato', note: 'Pangalan ng aparato ang tatak sa kaliwa; mode ang nasa kanan. Ipinapakita ng reader ang halaga at pinagmulan nito.' },
      'frame-05': { title: 'Mga ilaw, pindutan, at tile', variant: 'kontrol na walang palamuti', where: 'mga panel ng aksyon, rack, at wallet', note: 'Kailangan ng totoong pinagmulan ang aktibong ilaw. Pare-pareho ang gamit ng pindutan sa bawat panel.' },
      'frame-06': { title: 'Paleta A', variant: 'malabong salamin: walong kulay', where: 'src/theme/forge.css — mga variable na --fg-*', note: 'Ang kulay ay sumusunod sa halaga at ilaw, hindi sa gilid: halos itim na likuran at bughaw na liwanag.' },
    },
    sample: {
      hero: { tag: 'LABORATORYO', mode: 'ESTASYON A · MATINDING LAMIG', title: 'Laboratoryo mo', subtitle: 'rack ng sample at sisidlang nitrogen', connected: 'nakakonekta sa network', noEnergy: 'walang enerhiya sa network', energy: 'Enerhiya', samples: 'Mga sample', noWallet: 'hindi konektado ang wallet', noData: 'walang datos' },
      panel: { tag: 'RACK', mode: 'GUMAGANA', title: 'Plate ng mga well', subtitle: 'bawat well ay puwesto ng kagamitan', note: 'Bihirang mag-isa ang panel ng trabaho: may mga tile at reader sa ibaba.' },
      quiet: { title: 'Bakit may ganitong panel?', note: 'Ipinapaliwanag ng tahimik na panel kung ano ang kulang kapag walang nababasa ang aparato.' },
      readouts: { tag: 'HALIMBAWA · 04', mode: 'NORMAL', title: 'Mga reader', subtitle: 'tatak · halaga · paliwanag', stocked: 'Mga puwestong may laman', total: 'kabuuang puwesto: 27', fullest: 'Pinakamarami', archive: 'Talaan ng turno', noArchive: 'walang talaan' },
      controls: { tag: 'MGA KONTROL', mode: 'MANU-MANO', title: 'Panel ng kontrol', connected: 'konektado', queued: 'nakapila', error: 'aberya', resources: 'mga yaman', quests: 'mga gawain', tabs: 'mga tab', collect: 'Kunin', inspect: 'Suriin', help: 'Tulong' },
      swatches: ['likuran', 'teksto', 'liwanag', 'matingkad na liwanag', 'karaniwan', 'gantimpala', 'aberya', 'lalim'],
    },
  },
};
