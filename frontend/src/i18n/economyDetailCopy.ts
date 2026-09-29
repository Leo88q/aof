import type { Language } from './translations';

type CategoryKey = 'lab' | 'consumables' | 'cores' | 'quartz' | 'chips' | 'fluids';
type PantryKey = 'raw' | 'materials' | 'flasks' | 'special';
type Copy = {
  connect: string; loading: string; unavailable: string;
  rack: string; analysis: string; gelTitle: string; gelSub: string; noBands: string;
  positions: string; totalPositions: string; fullest: string; noStock: string;
  categories: Record<CategoryKey, string>; lanes: Record<CategoryKey, string>; labHint: string;
  pantry: Record<PantryKey, string>; vialNotice: string;
};
export const economyDetailCopy: Record<Language, Copy> = {
  ru: {
    connect: 'Подключите кошелёк, чтобы увидеть ресурсы', loading: 'Читаем балансы из сети…', unavailable: 'Балансы ресурсов недоступны из сети',
    rack: 'СКЛАД', analysis: 'ГЕЛЬ-АНАЛИЗ', gelTitle: 'Гель склада', gelSub: 'полоса — позиция ресурса', noBands: 'Все позиции пусты — полос нет.',
    positions: 'Позиций с запасом', totalPositions: 'всего позиций: {count}', fullest: 'Полнее всего', noStock: 'запасов нет',
    categories: { lab: 'Производство лаборатории', consumables: 'Расходники и топливо', cores: 'Ядра', quartz: 'Кварц', chips: 'Чипы', fluids: 'Флюиды' },
    lanes: { lab: 'лаб.', consumables: 'топл.', cores: 'ядра', quartz: 'кварц', chips: 'чипы', fluids: 'флю.' },
    labHint: 'Добывается на участке и показано также в обзоре лаборатории',
    pantry: { raw: 'Сырьё', materials: 'Материалы', flasks: 'Флюиды', special: 'Особое' },
    vialNotice: 'Флюиды создаются по рецептам. Применение и эффекты флюидов пока не подтверждены в сети.',
  },
  en: {
    connect: 'Connect a wallet to see your resources', loading: 'Loading on-chain balances…', unavailable: 'Resource balances unavailable from the network',
    rack: 'STORAGE', analysis: 'GEL ANALYSIS', gelTitle: 'Inventory gel', gelSub: 'each band is a resource in stock', noBands: 'Every slot is empty — no bands to show.',
    positions: 'Resources in stock', totalPositions: '{count} resources tracked', fullest: 'Largest holding', noStock: 'no resources in stock',
    categories: { lab: 'Lab production', consumables: 'Materials and fuel', cores: 'Cores', quartz: 'Quartz', chips: 'Chips', fluids: 'Fluids' },
    lanes: { lab: 'lab', consumables: 'fuel', cores: 'cores', quartz: 'quartz', chips: 'chips', fluids: 'fluids' },
    labHint: 'Produced on your plot and also shown in the lab overview',
    pantry: { raw: 'Raw materials', materials: 'Components', flasks: 'Fluids', special: 'Special' },
    vialNotice: 'Fluids are created from recipes. Their use and effects have not been verified on-chain.',
  },
  pt: {
    connect: 'Conecte a carteira para ver seus recursos', loading: 'Carregando saldos da rede…', unavailable: 'Saldos de recursos indisponíveis na rede',
    rack: 'ARMAZÉM', analysis: 'ANÁLISE EM GEL', gelTitle: 'Gel do armazém', gelSub: 'cada faixa representa um recurso', noBands: 'Todas as posições estão vazias — não há faixas.',
    positions: 'Recursos com estoque', totalPositions: '{count} recursos monitorados', fullest: 'Maior estoque', noStock: 'sem recursos no estoque',
    categories: { lab: 'Produção do laboratório', consumables: 'Materiais e combustível', cores: 'Núcleos', quartz: 'Quartzo', chips: 'Chips', fluids: 'Fluidos' },
    lanes: { lab: 'lab.', consumables: 'comb.', cores: 'núcl.', quartz: 'quart.', chips: 'chips', fluids: 'fluid.' },
    labHint: 'Produzido no terreno e exibido também no resumo do laboratório',
    pantry: { raw: 'Matérias-primas', materials: 'Componentes', flasks: 'Fluidos', special: 'Especial' },
    vialNotice: 'Os fluidos são criados por receitas. Seu uso e seus efeitos ainda não foram confirmados na rede.',
  },
  es: {
    connect: 'Conecta una cartera para ver tus recursos', loading: 'Cargando saldos de la red…', unavailable: 'Saldos de recursos no disponibles en la red',
    rack: 'ALMACÉN', analysis: 'ANÁLISIS EN GEL', gelTitle: 'Gel del almacén', gelSub: 'cada banda representa un recurso', noBands: 'Todas las posiciones están vacías — no hay bandas.',
    positions: 'Recursos en reserva', totalPositions: '{count} recursos registrados', fullest: 'Mayor reserva', noStock: 'sin reservas',
    categories: { lab: 'Producción del laboratorio', consumables: 'Materiales y combustible', cores: 'Núcleos', quartz: 'Cuarzo', chips: 'Chips', fluids: 'Fluidos' },
    lanes: { lab: 'lab.', consumables: 'comb.', cores: 'núcl.', quartz: 'cuar.', chips: 'chips', fluids: 'fluid.' },
    labHint: 'Producido en la parcela y mostrado también en el resumen del laboratorio',
    pantry: { raw: 'Materias primas', materials: 'Componentes', flasks: 'Fluidos', special: 'Especial' },
    vialNotice: 'Los fluidos se crean con recetas. Su uso y sus efectos aún no se han verificado en la red.',
  },
  vi: {
    connect: 'Kết nối ví để xem tài nguyên', loading: 'Đang tải số dư trên chuỗi…', unavailable: 'Không thể tải số dư tài nguyên từ mạng',
    rack: 'KHO', analysis: 'PHÂN TÍCH GEL', gelTitle: 'Gel kho tài nguyên', gelSub: 'mỗi vạch là một loại tài nguyên', noBands: 'Tất cả vị trí đều trống — chưa có vạch nào.',
    positions: 'Loại có dự trữ', totalPositions: 'theo dõi {count} loại', fullest: 'Dự trữ lớn nhất', noStock: 'chưa có dự trữ',
    categories: { lab: 'Sản xuất phòng thí nghiệm', consumables: 'Vật liệu và nhiên liệu', cores: 'Lõi', quartz: 'Thạch anh', chips: 'Chip', fluids: 'Dung dịch' },
    lanes: { lab: 'PTN', consumables: 'NL', cores: 'lõi', quartz: 'th.anh', chips: 'chip', fluids: 'dịch' },
    labHint: 'Được tạo trên khu đất và cũng hiển thị trong tổng quan phòng thí nghiệm',
    pantry: { raw: 'Nguyên liệu', materials: 'Linh kiện', flasks: 'Dung dịch', special: 'Đặc biệt' },
    vialNotice: 'Dung dịch được tạo theo công thức. Chưa xác minh cách sử dụng hoặc tác dụng của chúng trên chuỗi.',
  },
  id: {
    connect: 'Hubungkan dompet untuk melihat sumber daya', loading: 'Memuat saldo dari blockchain…', unavailable: 'Saldo sumber daya tidak tersedia dari jaringan',
    rack: 'GUDANG', analysis: 'ANALISIS GEL', gelTitle: 'Gel inventaris', gelSub: 'setiap pita mewakili sumber daya', noBands: 'Semua tempat kosong — tidak ada pita.',
    positions: 'Jenis yang tersedia', totalPositions: '{count} jenis tercatat', fullest: 'Stok terbesar', noStock: 'belum ada persediaan',
    categories: { lab: 'Produksi laboratorium', consumables: 'Bahan dan bahan bakar', cores: 'Inti', quartz: 'Kuarsa', chips: 'Chip', fluids: 'Cairan' },
    lanes: { lab: 'lab', consumables: 'bakar', cores: 'inti', quartz: 'kuarsa', chips: 'chip', fluids: 'cairan' },
    labHint: 'Diproduksi di lahan dan juga ditampilkan di ringkasan laboratorium',
    pantry: { raw: 'Bahan mentah', materials: 'Komponen', flasks: 'Cairan', special: 'Khusus' },
    vialNotice: 'Cairan dibuat dengan resep. Penggunaan dan efeknya belum diverifikasi di blockchain.',
  },
  fil: {
    connect: 'Ikonekta ang wallet para makita ang mga yaman', loading: 'Kinukuha ang mga balanse sa blockchain…', unavailable: 'Hindi makuha sa network ang mga balanse ng yaman',
    rack: 'IMBAKAN', analysis: 'PAGSUSURI SA GEL', gelTitle: 'Gel ng imbakan', gelSub: 'bawat guhit ay isang uri ng yaman', noBands: 'Walang laman ang lahat ng puwesto — walang guhit.',
    positions: 'Mga yamang may natitira', totalPositions: '{count} uri ang sinusubaybayan', fullest: 'Pinakamaraming natitira', noStock: 'walang yamang natitira',
    categories: { lab: 'Produksyon ng laboratoryo', consumables: 'Materyales at panggatong', cores: 'Mga core', quartz: 'Kuwarts', chips: 'Mga chip', fluids: 'Mga fluid' },
    lanes: { lab: 'lab', consumables: 'gatong', cores: 'core', quartz: 'kuwarts', chips: 'chip', fluids: 'fluid' },
    labHint: 'Ginagawa sa lote at ipinapakita rin sa pangkalahatang tala ng laboratoryo',
    pantry: { raw: 'Hilaw na materyales', materials: 'Mga bahagi', flasks: 'Mga fluid', special: 'Natatangi' },
    vialNotice: 'Ginagawa ang mga fluid sa pamamagitan ng resipe. Hindi pa nakukumpirma sa blockchain ang gamit o epekto nito.',
  },
};
