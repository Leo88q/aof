import type { Language } from './translations';

export const plateIds = ['plate-01', 'plate-02', 'plate-03', 'plate-04', 'plate-05'] as const;
export type PlateId = typeof plateIds[number];
type Meta = { title: string; variant: string; where: string; note: string };
type Copy = { slides: Record<PlateId, Meta>; sample: { shift: string; batch: string } };

/** Gallery drawings, not a reading of rack ownership or durability. The live plot uses 6 × 8 wells. */
export const galleryPlateCopy: Record<Language, Copy> = {
  ru: {
    slides: {
      'plate-01': { title: 'Планшет стойки', variant: 'пример 6 × 8 лунок', where: 'Участок · первый экран (pages/farm/FarmDashboard.tsx)', note: 'Шесть на восемь — формат планшета на участке. Цветные лунки здесь демонстрационные, они не показывают инструменты кошелька.' },
      'plate-02': { title: 'Пустой пример планшета', variant: '48 лунок без отметок', where: 'Участок · пример пустой стойки', note: 'Пустой рисунок показывает вид планшета без переданных позиций, но не подтверждает отсутствие инструментов у игрока.' },
      'plate-03': { title: 'Одна пробная лунка', variant: 'одна подсвеченная позиция', where: 'Участок · пример занятой позиции', note: 'Одна лунка помогает проверить подсветку. Это не найденный в кошельке инструмент.' },
      'plate-04': { title: 'Формат 96 лунок', variant: '8 × 12 — пробная раскладка', where: 'Участок · проверка другого размера планшета', note: 'Здесь проверяется сетка 8 × 12 с примерными отметками, а не полная стойка. Экран участка сейчас использует 6 × 8.' },
      'plate-05': { title: 'Считыватель планшета', variant: 'пример карточки лунки', where: 'Участок · образец PlateReader', note: 'Прочность и время здесь вымышлены; прочерк для партии означает отсутствие данных, а не подтверждённый номер.' },
    },
    sample: { shift: 'Смена', batch: 'Партия' },
  },
  en: {
    slides: {
      'plate-01': { title: 'Rack plate', variant: '6 × 8-well example', where: 'Plot · first screen (pages/farm/FarmDashboard.tsx)', note: 'Six by eight is the plate size on the plot. Colored wells here are a demonstration, not wallet-owned tools.' },
      'plate-02': { title: 'Empty plate example', variant: '48 wells with no markers', where: 'Plot · empty-rack illustration', note: 'This drawing shows a plate with no supplied positions; it does not prove a player owns no tools.' },
      'plate-03': { title: 'One sample well', variant: 'a single highlighted position', where: 'Plot · occupied-slot illustration', note: 'One well tests the highlight. It is not a tool found in a wallet.' },
      'plate-04': { title: '96-well format', variant: '8 × 12 layout test', where: 'Plot · alternative plate-size test', note: 'This checks an 8 × 12 grid with sample markers, not a full rack. The plot screen currently uses 6 × 8.' },
      'plate-05': { title: 'Plate reader', variant: 'sample well card', where: 'Plot · PlateReader example', note: 'Durability and shift time are fictional; a dash for the batch means data is unavailable, not a verified ID.' },
    },
    sample: { shift: 'Shift', batch: 'Batch' },
  },
  pt: {
    slides: {
      'plate-01': { title: 'Placa da estante', variant: 'exemplo com 6 × 8 poços', where: 'Terreno · primeira tela (pages/farm/FarmDashboard.tsx)', note: 'Seis por oito é o formato no terreno. Os poços coloridos são uma demonstração, não ferramentas da carteira.' },
      'plate-02': { title: 'Exemplo de placa vazia', variant: '48 poços sem marcas', where: 'Terreno · ilustração da estante vazia', note: 'A imagem mostra a placa sem posições fornecidas, não comprova que o jogador não possui ferramentas.' },
      'plate-03': { title: 'Um poço ilustrativo', variant: 'uma posição destacada', where: 'Terreno · ilustração de um lugar ocupado', note: 'Um poço testa o destaque. Não é uma ferramenta encontrada na carteira.' },
      'plate-04': { title: 'Formato de 96 poços', variant: 'teste de layout 8 × 12', where: 'Terreno · teste de outro tamanho de placa', note: 'Uma grade 8 × 12 com marcas de exemplo, não uma estante cheia. O terreno usa atualmente 6 × 8.' },
      'plate-05': { title: 'Leitor da placa', variant: 'cartão de poço ilustrativo', where: 'Terreno · exemplo de PlateReader', note: 'Durabilidade e tempo de turno são fictícios; o traço no lote indica dados indisponíveis, não um ID confirmado.' },
    },
    sample: { shift: 'Turno', batch: 'Lote' },
  },
  es: {
    slides: {
      'plate-01': { title: 'Placa del soporte', variant: 'ejemplo de 6 × 8 pocillos', where: 'Parcela · primera pantalla (pages/farm/FarmDashboard.tsx)', note: 'Seis por ocho es el formato de la parcela. Los pocillos de color son una demostración, no herramientas de la cartera.' },
      'plate-02': { title: 'Ejemplo de placa vacía', variant: '48 pocillos sin marcas', where: 'Parcela · ilustración del soporte vacío', note: 'El dibujo muestra una placa sin posiciones aportadas; no demuestra que el jugador no tenga herramientas.' },
      'plate-03': { title: 'Un pocillo ilustrativo', variant: 'una posición iluminada', where: 'Parcela · ilustración de un lugar ocupado', note: 'Un pocillo sirve para probar la iluminación. No es una herramienta encontrada en la cartera.' },
      'plate-04': { title: 'Formato de 96 pocillos', variant: 'prueba de diseño 8 × 12', where: 'Parcela · prueba de otro tamaño de placa', note: 'Una cuadrícula 8 × 12 con marcas de ejemplo, no un soporte lleno. La parcela usa ahora 6 × 8.' },
      'plate-05': { title: 'Lector de la placa', variant: 'ficha de pocillo ilustrativa', where: 'Parcela · ejemplo de PlateReader', note: 'Durabilidad y turno son ficticios; el guion en el lote indica datos no disponibles, no un ID confirmado.' },
    },
    sample: { shift: 'Turno', batch: 'Lote' },
  },
  vi: {
    slides: {
      'plate-01': { title: 'Phiến giá dụng cụ', variant: 'ví dụ 6 × 8 giếng', where: 'Khu đất · màn hình đầu (pages/farm/FarmDashboard.tsx)', note: 'Sáu nhân tám là kích thước phiến tại khu đất. Giếng có màu chỉ minh họa, không phải công cụ trong ví.' },
      'plate-02': { title: 'Ví dụ phiến trống', variant: '48 giếng không có dấu', where: 'Khu đất · minh họa giá trống', note: 'Hình cho thấy phiến chưa được đưa vị trí vào, không chứng minh người chơi không có công cụ.' },
      'plate-03': { title: 'Một giếng minh họa', variant: 'một vị trí được tô sáng', where: 'Khu đất · minh họa một chỗ có công cụ', note: 'Một giếng dùng để thử hiệu ứng tô sáng. Đây không phải công cụ tìm thấy trong ví.' },
      'plate-04': { title: 'Phiến 96 giếng', variant: 'thử bố cục 8 × 12', where: 'Khu đất · thử kích thước phiến khác', note: 'Lưới 8 × 12 với các dấu giả định, không phải giá đầy. Màn hình khu đất hiện dùng 6 × 8.' },
      'plate-05': { title: 'Bộ đọc phiến', variant: 'ví dụ thẻ giếng', where: 'Khu đất · ví dụ PlateReader', note: 'Độ bền và thời gian ca là giả định; dấu gạch ở lô nghĩa là thiếu dữ liệu, không phải ID đã xác nhận.' },
    },
    sample: { shift: 'Ca', batch: 'Lô' },
  },
  id: {
    slides: {
      'plate-01': { title: 'Pelat rak', variant: 'contoh 6 × 8 sumur', where: 'Lahan · layar pertama (pages/farm/FarmDashboard.tsx)', note: 'Enam kali delapan adalah ukuran pelat di lahan. Sumur berwarna hanya demonstrasi, bukan peralatan milik dompet.' },
      'plate-02': { title: 'Contoh pelat kosong', variant: '48 sumur tanpa penanda', where: 'Lahan · ilustrasi rak kosong', note: 'Gambar ini menampilkan pelat tanpa posisi yang disediakan, bukan bukti pemain tidak punya peralatan.' },
      'plate-03': { title: 'Satu sumur contoh', variant: 'satu posisi disorot', where: 'Lahan · ilustrasi tempat terisi', note: 'Satu sumur menguji sorotan. Ini bukan peralatan yang ditemukan di dompet.' },
      'plate-04': { title: 'Format 96 sumur', variant: 'uji tata letak 8 × 12', where: 'Lahan · uji ukuran pelat lain', note: 'Kisi 8 × 12 dengan penanda contoh, bukan rak penuh. Layar lahan saat ini memakai 6 × 8.' },
      'plate-05': { title: 'Pembaca pelat', variant: 'contoh kartu sumur', where: 'Lahan · contoh PlateReader', note: 'Daya tahan dan waktu giliran hanyalah contoh; tanda pisah pada batch berarti data tidak tersedia, bukan ID terverifikasi.' },
    },
    sample: { shift: 'Giliran', batch: 'Batch' },
  },
  fil: {
    slides: {
      'plate-01': { title: 'Plate ng rack', variant: 'halimbawang 6 × 8 well', where: 'Lupain · unang screen (pages/farm/FarmDashboard.tsx)', note: 'Anim na hanay at walong kolum ang nasa lupain. Halimbawa lang ang may kulay na well, hindi kagamitan sa wallet.' },
      'plate-02': { title: 'Halimbawa ng bakanteng plate', variant: '48 well na walang marka', where: 'Lupain · larawan ng bakanteng rack', note: 'Plate na walang ibinigay na puwesto ang larawan, hindi patunay na walang kagamitan ang manlalaro.' },
      'plate-03': { title: 'Isang halimbawang well', variant: 'isang may kulay na puwesto', where: 'Lupain · larawan ng puwestong may laman', note: 'Isang well ang sumusubok sa kulay. Hindi ito kagamitang nakita sa wallet.' },
      'plate-04': { title: 'Format na 96 well', variant: 'pagsubok ng ayos na 8 × 12', where: 'Lupain · pagsubok ng ibang laki ng plate', note: 'Grid na 8 × 12 na may halimbawang marka ito, hindi punong rack. Kasalukuyang 6 × 8 ang plate ng lupain.' },
      'plate-05': { title: 'Reader ng plate', variant: 'halimbawang kard ng well', where: 'Lupain · halimbawa ng PlateReader', note: 'Gawa-gawa ang tibay at oras ng turno; ang guhit sa batch ay kulang na datos, hindi napatunayang ID.' },
    },
    sample: { shift: 'Turno', batch: 'Pangkat' },
  },
};
