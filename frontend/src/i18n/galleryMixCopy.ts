import type { Language } from './translations';

export const mixIds = ['mix-01', 'mix-02', 'mix-03', 'mix-04', 'mix-05'] as const;
export type MixId = typeof mixIds[number];
type Meta = { title: string; variant: string; where: string; note: string };
type Samples = { testOne: string; testTwo: string; testThree: string; shiftChannels: string; idle: string };
type Copy = { slides: Record<MixId, Meta>; sample: Samples };

/** Eight-channel view is a layout test, not an inventory or a claim that eight NFT types exist. */
export const galleryMixCopy: Record<Language, Copy> = {
  ru: {
    slides: {
      'mix-01': { title: 'Полный пульт', variant: 'восемь демонстрационных каналов', where: 'Инструменты · первый экран (pages/tools/ToolsHome.tsx)', note: 'Пять названий из каталога и три тестовых канала показывают вёрстку. Стрелки и часы вымышлены; это не инвентарь игрока.' },
      'mix-02': { title: 'Короткая стойка', variant: 'пример трёх каналов', where: 'Инструменты · пример стойки из трёх позиций', note: 'Пульт показывает только переданные каналы. Это пример компоновки, а не число инструментов в кошельке.' },
      'mix-03': { title: 'Пульт без показаний', variant: 'названия типов, шкалы пусты', where: 'Инструменты · нет данных кошелька', note: 'Названия пяти типов остаются видимы, а прочность и часы неизвестны. Прочерк не означает нулевой баланс.' },
      'mix-04': { title: 'Неактивный канал', variant: 'нет часов у первого канала', where: 'Инструменты · пример выключенного M', note: 'Нет часов смены — фейдер первого канала пуст. Это иллюстрация, не доказательство поломки инструмента.' },
      'mix-05': { title: 'Строка считывателя', variant: 'подпись и значение под пультом', where: 'Инструменты · деталь пульта (MixerBus)', note: 'Пример короткого считывателя без отдельной панели. Число 3 — демонстрация, не показание кошелька.' },
    },
    sample: { testOne: 'Тестовый канал A', testTwo: 'Тестовый канал B', testThree: 'Тестовый канал C', shiftChannels: 'Каналов в примере', idle: 'Нет показаний' },
  },
  en: {
    slides: {
      'mix-01': { title: 'Full mixer', variant: 'eight sample channels', where: 'Tools · first screen (pages/tools/ToolsHome.tsx)', note: 'Five catalog tool names and three test channels demonstrate the layout. Needles and hours are fictional, not a player inventory.' },
      'mix-02': { title: 'Compact rack', variant: 'three-channel example', where: 'Tools · example rack with three slots', note: 'The mixer shows only supplied channels. This is a layout example, not a count of wallet-owned tools.' },
      'mix-03': { title: 'Mixer without readings', variant: 'tool types visible, gauges empty', where: 'Tools · wallet data unavailable', note: 'The five tool types remain visible, but durability and hours are unknown. A dash does not mean a zero balance.' },
      'mix-04': { title: 'Inactive channel', variant: 'no hours on the first channel', where: 'Tools · example with M off', note: 'No shift hours means the first fader is empty. This is an illustration, not proof that the tool is broken.' },
      'mix-05': { title: 'Bus readout', variant: 'a label and value below the mixer', where: 'Tools · mixer detail (MixerBus)', note: 'A short readout without another panel. The number 3 is a sample, not a wallet reading.' },
    },
    sample: { testOne: 'Test channel A', testTwo: 'Test channel B', testThree: 'Test channel C', shiftChannels: 'Sample channels', idle: 'No reading' },
  },
  pt: {
    slides: {
      'mix-01': { title: 'Mesa completa', variant: 'oito canais de exemplo', where: 'Ferramentas · primeira tela (pages/tools/ToolsHome.tsx)', note: 'Cinco nomes do catálogo e três canais de teste ilustram o layout. Ponteiros e horas são fictícios, não um inventário.' },
      'mix-02': { title: 'Estante curta', variant: 'exemplo com três canais', where: 'Ferramentas · estante ilustrativa de três posições', note: 'A mesa mostra apenas os canais recebidos. É um exemplo de layout, não o número de ferramentas na carteira.' },
      'mix-03': { title: 'Mesa sem leituras', variant: 'tipos visíveis, escalas vazias', where: 'Ferramentas · dados da carteira indisponíveis', note: 'Os cinco tipos continuam visíveis, mas durabilidade e horas são desconhecidas. O traço não significa saldo zero.' },
      'mix-04': { title: 'Canal inativo', variant: 'sem horas no primeiro canal', where: 'Ferramentas · exemplo com M desligado', note: 'Sem horas de turno, o primeiro controle fica vazio. A imagem não prova que a ferramenta quebrou.' },
      'mix-05': { title: 'Visor da mesa', variant: 'rótulo e valor abaixo da mesa', where: 'Ferramentas · detalhe da mesa (MixerBus)', note: 'Um visor curto sem painel separado. O número 3 é exemplo, não leitura da carteira.' },
    },
    sample: { testOne: 'Canal de teste A', testTwo: 'Canal de teste B', testThree: 'Canal de teste C', shiftChannels: 'Canais do exemplo', idle: 'Sem leitura' },
  },
  es: {
    slides: {
      'mix-01': { title: 'Mesa completa', variant: 'ocho canales de ejemplo', where: 'Herramientas · primera pantalla (pages/tools/ToolsHome.tsx)', note: 'Cinco nombres del catálogo y tres canales de prueba ilustran el diseño. Agujas y horas son ficticias, no un inventario.' },
      'mix-02': { title: 'Soporte corto', variant: 'ejemplo de tres canales', where: 'Herramientas · soporte ilustrativo de tres posiciones', note: 'La mesa solo muestra los canales proporcionados. Es un ejemplo de diseño, no el número de herramientas de la cartera.' },
      'mix-03': { title: 'Mesa sin lecturas', variant: 'tipos visibles, escalas vacías', where: 'Herramientas · datos de cartera no disponibles', note: 'Siguen visibles los cinco tipos, pero se desconocen durabilidad y horas. El guion no significa saldo cero.' },
      'mix-04': { title: 'Canal inactivo', variant: 'sin horas en el primer canal', where: 'Herramientas · ejemplo con M apagada', note: 'Sin horas de turno, el primer control queda vacío. La imagen no prueba que la herramienta esté rota.' },
      'mix-05': { title: 'Lectura de la mesa', variant: 'etiqueta y valor bajo la mesa', where: 'Herramientas · detalle de la mesa (MixerBus)', note: 'Una lectura breve sin panel adicional. El número 3 es un ejemplo, no una lectura de la cartera.' },
    },
    sample: { testOne: 'Canal de prueba A', testTwo: 'Canal de prueba B', testThree: 'Canal de prueba C', shiftChannels: 'Canales del ejemplo', idle: 'Sin lectura' },
  },
  vi: {
    slides: {
      'mix-01': { title: 'Bàn điều khiển đầy đủ', variant: 'tám kênh minh họa', where: 'Công cụ · màn hình đầu (pages/tools/ToolsHome.tsx)', note: 'Năm tên trong danh mục và ba kênh thử minh họa bố cục. Kim chỉ và số giờ là giả định, không phải kho của người chơi.' },
      'mix-02': { title: 'Giá nhỏ', variant: 'ví dụ ba kênh', where: 'Công cụ · giá minh họa có ba chỗ', note: 'Bàn chỉ hiển thị các kênh được truyền vào. Đây là ví dụ bố cục, không phải số công cụ trong ví.' },
      'mix-03': { title: 'Bàn chưa có số liệu', variant: 'thấy loại công cụ, thang đo trống', where: 'Công cụ · không có dữ liệu ví', note: 'Năm loại công cụ vẫn hiển thị nhưng chưa biết độ bền và số giờ. Dấu gạch không có nghĩa số dư bằng không.' },
      'mix-04': { title: 'Kênh không hoạt động', variant: 'kênh đầu không có số giờ', where: 'Công cụ · ví dụ M tắt', note: 'Không có giờ làm việc nên thanh trượt đầu trống. Hình minh họa không chứng minh công cụ bị hỏng.' },
      'mix-05': { title: 'Bộ đọc dưới bàn', variant: 'nhãn và giá trị dưới bàn điều khiển', where: 'Công cụ · chi tiết bàn (MixerBus)', note: 'Bộ đọc ngắn không cần bảng riêng. Số 3 là ví dụ, không phải số liệu từ ví.' },
    },
    sample: { testOne: 'Kênh thử A', testTwo: 'Kênh thử B', testThree: 'Kênh thử C', shiftChannels: 'Số kênh ví dụ', idle: 'Chưa có số liệu' },
  },
  id: {
    slides: {
      'mix-01': { title: 'Konsol lengkap', variant: 'delapan saluran contoh', where: 'Peralatan · layar pertama (pages/tools/ToolsHome.tsx)', note: 'Lima nama dari katalog dan tiga saluran uji menunjukkan tata letak. Jarum dan jam hanyalah contoh, bukan inventaris pemain.' },
      'mix-02': { title: 'Rak pendek', variant: 'contoh tiga saluran', where: 'Peralatan · contoh rak tiga slot', note: 'Konsol hanya menampilkan saluran yang diberikan. Ini contoh tata letak, bukan jumlah peralatan di dompet.' },
      'mix-03': { title: 'Konsol tanpa pembacaan', variant: 'jenis terlihat, skala kosong', where: 'Peralatan · data dompet tidak tersedia', note: 'Kelima jenis peralatan terlihat, tetapi daya tahan dan jam belum diketahui. Tanda pisah tidak berarti saldo nol.' },
      'mix-04': { title: 'Saluran tidak aktif', variant: 'saluran pertama tanpa jam', where: 'Peralatan · contoh M nonaktif', note: 'Tanpa jam giliran, penggeser pertama kosong. Ilustrasi ini bukan bukti peralatan rusak.' },
      'mix-05': { title: 'Pembaca konsol', variant: 'label dan nilai di bawah konsol', where: 'Peralatan · detail konsol (MixerBus)', note: 'Pembaca singkat tanpa panel tambahan. Angka 3 hanya contoh, bukan pembacaan dompet.' },
    },
    sample: { testOne: 'Saluran uji A', testTwo: 'Saluran uji B', testThree: 'Saluran uji C', shiftChannels: 'Saluran contoh', idle: 'Belum ada pembacaan' },
  },
  fil: {
    slides: {
      'mix-01': { title: 'Kumpletong console', variant: 'walong halimbawang channel', where: 'Mga kagamitan · unang screen (pages/tools/ToolsHome.tsx)', note: 'Limang pangalan mula sa katalogo at tatlong test channel ang halimbawa ng ayos. Gawa-gawa ang karayom at oras; hindi ito imbentaryo.' },
      'mix-02': { title: 'Maikling rack', variant: 'halimbawang may tatlong channel', where: 'Mga kagamitan · halimbawang rack na may tatlong puwesto', note: 'Ang ipinapasok na channel lang ang ipinapakita. Halimbawa ito ng ayos, hindi bilang ng kagamitan sa wallet.' },
      'mix-03': { title: 'Console na walang basa', variant: 'nakikita ang mga uri, walang laman ang panukat', where: 'Mga kagamitan · hindi makuha ang datos ng wallet', note: 'Nakikita ang limang uri ngunit hindi alam ang tibay at oras. Hindi nangangahulugang sero ang balanse kapag may guhit.' },
      'mix-04': { title: 'Hindi aktibong channel', variant: 'walang oras sa unang channel', where: 'Mga kagamitan · halimbawang nakapatay ang M', note: 'Walang oras ng turno kaya walang laman ang unang slider. Hindi patunay ng sirang kagamitan ang larawan.' },
      'mix-05': { title: 'Reader ng console', variant: 'tatak at halaga sa ilalim ng console', where: 'Mga kagamitan · detalye ng console (MixerBus)', note: 'Maikling reader na walang hiwalay na panel. Halimbawa lang ang bilang na 3, hindi basa ng wallet.' },
    },
    sample: { testOne: 'Kanal ng pagsubok A', testTwo: 'Kanal ng pagsubok B', testThree: 'Kanal ng pagsubok C', shiftChannels: 'Mga channel sa halimbawa', idle: 'Walang basa' },
  },
};
