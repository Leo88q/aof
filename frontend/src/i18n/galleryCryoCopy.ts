import type { Language } from './translations';

export const cryoIds = ['cryo-01', 'cryo-02', 'cryo-03', 'cryo-04'] as const;
export type CryoId = typeof cryoIds[number];
type SlideMeta = { title: string; variant: string; where: string; note: string };
type Demo = {
  baseRack: string; baseMode: string; chainRack: string; chainMode: string;
  unavailable: string; energyDemo: string; energyUnknown: string;
};
type Copy = { slides: Record<CryoId, SlideMeta>; demo: Demo };

/** Descriptions of visual samples only; balances and rewards are not read here. */
export const galleryCryoCopy: Record<Language, Copy> = {
  ru: {
    slides: {
      'cryo-01': { title: 'Стойка с образцами', variant: 'иллюстрация полной полки', where: 'Лаборатория · первый экран (components/farm/LabHero.tsx)', note: 'Соломинка обозначает позицию ресурса, заполнение — пример шкалы. Числа здесь вымышлены, баланс кошелька не прочитан.' },
      'cryo-02': { title: 'Подсвеченная позиция', variant: 'иллюстрация выделенной соломинки', where: 'Лаборатория · пример оформления стойки', note: 'Цветной колпачок показывает визуальное выделение. Он не подтверждает награду сезона или право на получение.' },
      'cryo-03': { title: 'Стойка без показаний', variant: 'нет данных — шкалы пусты', where: 'Лаборатория · нет данных кошелька', note: 'Уровень null означает неизвестный остаток. Прочерк — не нулевой баланс и не подтверждение отсутствия ресурсов.' },
      'cryo-04': { title: 'Сосуд энергии', variant: 'иллюстрация доли энергии сети', where: 'Лаборатория · первый экран, рядом со стойкой', note: 'Первый сосуд показывает пример 62%, второй — неизвестное значение. Это не измерение жидкого азота.' },
    },
    demo: { baseRack: 'Стойка A · базовые', baseMode: 'пример', chainRack: 'Стойка B · выделенная позиция', chainMode: 'пример', unavailable: 'нет данных', energyDemo: 'ЭНЕРГИЯ · ПРИМЕР', energyUnknown: 'ЭНЕРГИЯ · НЕТ ДАННЫХ' },
  },
  en: {
    slides: {
      'cryo-01': { title: 'Sample rack', variant: 'illustration of a full rack', where: 'Laboratory · first screen (components/farm/LabHero.tsx)', note: 'Each straw stands for a resource slot; the fill demonstrates a gauge. Numbers are fictional: no wallet balance was read.' },
      'cryo-02': { title: 'Highlighted slot', variant: 'illustration of a marked straw', where: 'Laboratory · sample rack design', note: 'The colored cap illustrates emphasis. It does not confirm a seasonal reward or eligibility to claim one.' },
      'cryo-03': { title: 'Rack without readings', variant: 'no data — empty gauges', where: 'Laboratory · wallet data unavailable', note: 'A null level means the balance is unknown. A dash is not a zero balance or proof that resources are missing.' },
      'cryo-04': { title: 'Energy vessel', variant: 'illustration of network energy share', where: 'Laboratory · first screen, next to the rack', note: 'The first vessel illustrates 62%; the second shows an unknown value. Neither measures liquid nitrogen.' },
    },
    demo: { baseRack: 'Rack A · base resources', baseMode: 'sample', chainRack: 'Rack B · highlighted slot', chainMode: 'sample', unavailable: 'no data', energyDemo: 'ENERGY · SAMPLE', energyUnknown: 'ENERGY · NO DATA' },
  },
  pt: {
    slides: {
      'cryo-01': { title: 'Estante de amostras', variant: 'ilustração da estante cheia', where: 'Laboratório · primeira tela (components/farm/LabHero.tsx)', note: 'Cada tubo representa um recurso; o preenchimento ilustra a escala. Os números são fictícios: o saldo da carteira não foi consultado.' },
      'cryo-02': { title: 'Posição destacada', variant: 'ilustração de um tubo marcado', where: 'Laboratório · exemplo da estante', note: 'A tampa colorida ilustra um destaque. Não confirma recompensa sazonal nem direito a recebê-la.' },
      'cryo-03': { title: 'Estante sem leituras', variant: 'sem dados — escalas vazias', where: 'Laboratório · dados da carteira indisponíveis', note: 'Um nível nulo significa saldo desconhecido. Um travessão não prova saldo zero nem ausência de recursos.' },
      'cryo-04': { title: 'Vaso de energia', variant: 'ilustração da parcela de energia da rede', where: 'Laboratório · primeira tela, ao lado da estante', note: 'O primeiro vaso ilustra 62%; o segundo, um valor desconhecido. Nenhum mede nitrogênio líquido.' },
    },
    demo: { baseRack: 'Estante A · recursos básicos', baseMode: 'exemplo', chainRack: 'Estante B · posição destacada', chainMode: 'exemplo', unavailable: 'sem dados', energyDemo: 'ENERGIA · EXEMPLO', energyUnknown: 'ENERGIA · SEM DADOS' },
  },
  es: {
    slides: {
      'cryo-01': { title: 'Soporte de muestras', variant: 'ilustración del soporte lleno', where: 'Laboratorio · primera pantalla (components/farm/LabHero.tsx)', note: 'Cada tubo representa un recurso; el nivel ilustra una escala. Las cifras son ficticias: no se ha consultado el saldo de la cartera.' },
      'cryo-02': { title: 'Posición destacada', variant: 'ilustración de un tubo marcado', where: 'Laboratorio · ejemplo del soporte', note: 'La tapa de color ilustra un destaque. No confirma una recompensa de temporada ni derecho a recibirla.' },
      'cryo-03': { title: 'Soporte sin lecturas', variant: 'sin datos — escalas vacías', where: 'Laboratorio · datos de cartera no disponibles', note: 'Un nivel nulo indica saldo desconocido. Un guion no demuestra saldo cero ni ausencia de recursos.' },
      'cryo-04': { title: 'Depósito de energía', variant: 'ilustración de la proporción de energía de la red', where: 'Laboratorio · primera pantalla, junto al soporte', note: 'El primer depósito ilustra un 62%; el segundo, un valor desconocido. Ninguno mide nitrógeno líquido.' },
    },
    demo: { baseRack: 'Soporte A · recursos básicos', baseMode: 'ejemplo', chainRack: 'Soporte B · posición destacada', chainMode: 'ejemplo', unavailable: 'sin datos', energyDemo: 'ENERGÍA · EJEMPLO', energyUnknown: 'ENERGÍA · SIN DATOS' },
  },
  vi: {
    slides: {
      'cryo-01': { title: 'Giá mẫu', variant: 'minh họa giá đầy', where: 'Phòng thí nghiệm · màn hình đầu (components/farm/LabHero.tsx)', note: 'Mỗi ống tượng trưng cho một ô tài nguyên; mức đầy chỉ minh họa thang đo. Các số là giả định, chưa đọc số dư ví.' },
      'cryo-02': { title: 'Ô được đánh dấu', variant: 'minh họa ống có dấu', where: 'Phòng thí nghiệm · ví dụ về giá mẫu', note: 'Nắp màu chỉ minh họa cách làm nổi bật. Nó không xác nhận phần thưởng mùa hay quyền nhận thưởng.' },
      'cryo-03': { title: 'Giá chưa có số liệu', variant: 'không có dữ liệu — thang đo trống', where: 'Phòng thí nghiệm · không có dữ liệu ví', note: 'Mức null nghĩa là chưa biết số dư. Dấu gạch không chứng minh số dư bằng không hay thiếu tài nguyên.' },
      'cryo-04': { title: 'Bình năng lượng', variant: 'minh họa tỷ lệ năng lượng mạng', where: 'Phòng thí nghiệm · màn hình đầu, cạnh giá', note: 'Bình thứ nhất minh họa 62%; bình thứ hai chưa rõ giá trị. Cả hai không đo nitơ lỏng.' },
    },
    demo: { baseRack: 'Giá A · tài nguyên cơ bản', baseMode: 'ví dụ', chainRack: 'Giá B · ô được đánh dấu', chainMode: 'ví dụ', unavailable: 'chưa có dữ liệu', energyDemo: 'NĂNG LƯỢNG · VÍ DỤ', energyUnknown: 'NĂNG LƯỢNG · CHƯA CÓ DỮ LIỆU' },
  },
  id: {
    slides: {
      'cryo-01': { title: 'Rak sampel', variant: 'ilustrasi rak penuh', where: 'Laboratorium · layar pertama (components/farm/LabHero.tsx)', note: 'Setiap tabung mewakili slot sumber daya; isinya menggambarkan skala. Angka bersifat fiktif: saldo dompet tidak dibaca.' },
      'cryo-02': { title: 'Slot yang disorot', variant: 'ilustrasi tabung bertanda', where: 'Laboratorium · contoh tampilan rak', note: 'Tutup berwarna hanya menunjukkan sorotan. Ini bukan bukti hadiah musim atau hak untuk mengklaimnya.' },
      'cryo-03': { title: 'Rak tanpa pembacaan', variant: 'tanpa data — skala kosong', where: 'Laboratorium · data dompet tidak tersedia', note: 'Level null berarti saldo belum diketahui. Tanda pisah bukan bukti saldo nol atau tidak adanya sumber daya.' },
      'cryo-04': { title: 'Tabung energi', variant: 'ilustrasi porsi energi jaringan', where: 'Laboratorium · layar pertama, di samping rak', note: 'Tabung pertama mencontohkan 62%; nilai tabung kedua tidak diketahui. Keduanya tidak mengukur nitrogen cair.' },
    },
    demo: { baseRack: 'Rak A · sumber daya dasar', baseMode: 'contoh', chainRack: 'Rak B · slot yang disorot', chainMode: 'contoh', unavailable: 'tidak ada data', energyDemo: 'ENERGI · CONTOH', energyUnknown: 'ENERGI · TIDAK ADA DATA' },
  },
  fil: {
    slides: {
      'cryo-01': { title: 'Rack ng sample', variant: 'larawan ng punong rack', where: 'Laboratoryo · unang screen (components/farm/LabHero.tsx)', note: 'Bawat tubo ay puwesto ng yaman; halimbawa lang ang antas ng laman. Gawa-gawa ang mga bilang: hindi binasa ang balanse ng wallet.' },
      'cryo-02': { title: 'Binigyang-diin na puwesto', variant: 'larawan ng tubong may tanda', where: 'Laboratoryo · halimbawang rack', note: 'Palatandaan lang ang de-kulay na takip. Hindi nito pinatutunayan ang gantimpala sa panahon o karapatang kunin iyon.' },
      'cryo-03': { title: 'Rack na walang basa', variant: 'walang datos — walang laman ang mga panukat', where: 'Laboratoryo · hindi makuha ang datos ng wallet', note: 'Ang null na antas ay hindi alam na balanse. Ang guhit ay hindi patunay ng serong balanse o kawalan ng yaman.' },
      'cryo-04': { title: 'Sisidlan ng enerhiya', variant: 'larawan ng bahagi ng enerhiya ng network', where: 'Laboratoryo · unang screen, sa tabi ng rack', note: 'Halimbawa lang ang 62% sa unang sisidlan; hindi alam ang halaga sa ikalawa. Hindi nila sinusukat ang likidong nitrogen.' },
    },
    demo: { baseRack: 'Rack A · pangunahing yaman', baseMode: 'halimbawa', chainRack: 'Rack B · puwestong may tanda', chainMode: 'halimbawa', unavailable: 'walang datos', energyDemo: 'ENERHIYA · HALIMBAWA', energyUnknown: 'ENERHIYA · WALANG DATOS' },
  },
};
