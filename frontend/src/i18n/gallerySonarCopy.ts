import type { Language } from './translations';

export const sonarIds = ['sonar-01', 'sonar-02', 'sonar-03', 'sonar-04', 'sonar-05', 'sonar-06'] as const;
export type SonarId = typeof sonarIds[number];
type Meta = { title: string; variant: string; where: string; note: string };
type Copy = { slides: Record<SonarId, Meta>; sample: { lots: string; layout: string; listings: string; prices: string } };

/** Gallery-only examples. The farm journal has no depth archive; the market home does not load prices. */
export const gallerySonarCopy: Record<Language, Copy> = {
  ru: {
    slides: {
      'sonar-01': { title: 'Пробная лента эхолота', variant: 'четыре вымышленные отметки', where: 'Участок · журнал смены (pages/farm/FarmDashboard.tsx)', note: 'Лента демонстрирует рисунок прибора. Журнал участка сейчас не получает архив глубины: точки и шкала не являются измерениями.' },
      'sonar-02': { title: 'Эхолот без данных', variant: 'нет точек и кривой', where: 'Участок · журнал смены', note: 'Без данных кривая и отметки не рисуются. Разметка шкалы сама по себе не доказывает измеренную глубину.' },
      'sonar-03': { title: 'Одна пробная отметка', variant: 'пример крупного сигнала', where: 'Участок · демонстрация эхолота', note: 'Положение и размер точки вымышлены для проверки шкалы, а не взяты из архива добычи.' },
      'sonar-04': { title: 'Пробная развёртка лотов', variant: 'пять вымышленных отметок', where: 'Рынок · пример для витрины (pages/market/ListingPage.tsx)', note: 'Позиции проверяют рисунок сонара, а не показывают цены сети. Настоящая витрина читает листинги отдельно.' },
      'sonar-05': { title: 'Развёртка без показаний', variant: 'домашний экран рынка не загружает лоты', where: 'Рынок · первый экран (pages/market/MarketHome.tsx)', note: 'Пустой круг здесь означает «данные ещё не запрашивались», а не пустой рынок или сбой сети.' },
      'sonar-06': { title: 'Плотная пробная развёртка', variant: '24 вымышленные отметки', where: 'Рынок · пример плотной витрины', note: 'Двадцать четыре точки проверяют читаемость макета. Это не 24 подтверждённых лота или котировки.' },
    },
    sample: { lots: 'Лотов в примере', layout: 'Только схема', listings: 'Листинги', prices: 'Цены' },
  },
  en: {
    slides: {
      'sonar-01': { title: 'Sample echo trace', variant: 'four fictional markers', where: 'Plot · shift log (pages/farm/FarmDashboard.tsx)', note: 'This trace demonstrates the instrument drawing. The plot log has no depth archive yet: points and scale are not measurements.' },
      'sonar-02': { title: 'Echo trace without data', variant: 'no points or curve', where: 'Plot · shift log', note: 'Without data, there is no curve or marker. A scale grid alone does not prove any measured depth.' },
      'sonar-03': { title: 'One sample marker', variant: 'large signal example', where: 'Plot · echo-trace demonstration', note: 'The point’s size and position are invented to test the display, not drawn from a mining archive.' },
      'sonar-04': { title: 'Sample lot sweep', variant: 'five fictional markers', where: 'Market · listing display example (pages/market/ListingPage.tsx)', note: 'Positions test the sonar drawing; they do not show on-chain prices. The live listing screen reads its own listings.' },
      'sonar-05': { title: 'Sweep without readings', variant: 'market home does not load lots', where: 'Market · first screen (pages/market/MarketHome.tsx)', note: 'The empty circle means “not fetched here”, not an empty market or a network failure.' },
      'sonar-06': { title: 'Dense sample sweep', variant: '24 fictional markers', where: 'Market · dense listing demonstration', note: 'Twenty-four points test how readable the layout is. They are not 24 confirmed lots or live quotes.' },
    },
    sample: { lots: 'Sample lots', layout: 'Layout only', listings: 'Listings', prices: 'Prices' },
  },
  pt: {
    slides: {
      'sonar-01': { title: 'Registro de eco ilustrativo', variant: 'quatro marcas fictícias', where: 'Terreno · diário do turno (pages/farm/FarmDashboard.tsx)', note: 'A faixa mostra o desenho do aparelho. O diário ainda não tem histórico de profundidade: pontos e escala não são medições.' },
      'sonar-02': { title: 'Registro sem dados', variant: 'sem pontos nem curva', where: 'Terreno · diário do turno', note: 'Sem dados, não há curva nem marcas. A grade sozinha não comprova uma profundidade medida.' },
      'sonar-03': { title: 'Uma marca ilustrativa', variant: 'exemplo de sinal amplo', where: 'Terreno · demonstração do registro', note: 'O tamanho e a posição do ponto foram inventados para testar o visor, não vieram do histórico de extração.' },
      'sonar-04': { title: 'Varredura ilustrativa de lotes', variant: 'cinco marcas fictícias', where: 'Mercado · exemplo da vitrine (pages/market/ListingPage.tsx)', note: 'As posições testam o desenho do sonar, não mostram preços da rede. A vitrine real consulta os anúncios separadamente.' },
      'sonar-05': { title: 'Varredura sem leituras', variant: 'início do mercado não carrega lotes', where: 'Mercado · primeira tela (pages/market/MarketHome.tsx)', note: 'O círculo vazio significa “não consultado aqui”, não mercado vazio nem falha da rede.' },
      'sonar-06': { title: 'Varredura densa ilustrativa', variant: '24 marcas fictícias', where: 'Mercado · demonstração da vitrine cheia', note: 'Vinte e quatro pontos testam a legibilidade. Não são 24 lotes confirmados nem cotações ao vivo.' },
    },
    sample: { lots: 'Lotes no exemplo', layout: 'Só o esquema', listings: 'Anúncios', prices: 'Preços' },
  },
  es: {
    slides: {
      'sonar-01': { title: 'Registro de eco ilustrativo', variant: 'cuatro marcas ficticias', where: 'Parcela · diario del turno (pages/farm/FarmDashboard.tsx)', note: 'La cinta muestra el diseño del aparato. El diario aún no tiene archivo de profundidad: puntos y escala no son mediciones.' },
      'sonar-02': { title: 'Registro sin datos', variant: 'sin puntos ni curva', where: 'Parcela · diario del turno', note: 'Sin datos no hay curva ni marcas. La cuadrícula por sí sola no demuestra una profundidad medida.' },
      'sonar-03': { title: 'Una marca de ejemplo', variant: 'ejemplo de señal grande', where: 'Parcela · demostración del registro', note: 'El tamaño y la posición son inventados para probar el visor, no proceden de un historial de extracción.' },
      'sonar-04': { title: 'Barrido de lotes ilustrativo', variant: 'cinco marcas ficticias', where: 'Mercado · ejemplo de anuncios (pages/market/ListingPage.tsx)', note: 'Las posiciones prueban el diseño del sonar; no muestran precios de la red. La vista real consulta los anuncios aparte.' },
      'sonar-05': { title: 'Barrido sin lecturas', variant: 'la portada del mercado no carga lotes', where: 'Mercado · primera pantalla (pages/market/MarketHome.tsx)', note: 'El círculo vacío significa «no consultado aquí», no un mercado vacío ni un fallo de red.' },
      'sonar-06': { title: 'Barrido denso ilustrativo', variant: '24 marcas ficticias', where: 'Mercado · demostración de muchos anuncios', note: 'Veinticuatro puntos prueban la legibilidad. No son 24 lotes confirmados ni cotizaciones reales.' },
    },
    sample: { lots: 'Lotes del ejemplo', layout: 'Solo diseño', listings: 'Anuncios', prices: 'Precios' },
  },
  vi: {
    slides: {
      'sonar-01': { title: 'Dải hồi âm minh họa', variant: 'bốn dấu giả định', where: 'Khu đất · nhật ký ca (pages/farm/FarmDashboard.tsx)', note: 'Dải này trình bày hình vẽ thiết bị. Nhật ký chưa có dữ liệu độ sâu: điểm và thang đo không phải phép đo.' },
      'sonar-02': { title: 'Dải hồi âm thiếu dữ liệu', variant: 'không có điểm hay đường cong', where: 'Khu đất · nhật ký ca', note: 'Không có dữ liệu thì không vẽ đường hay điểm. Lưới thang đo không chứng minh độ sâu đã được đo.' },
      'sonar-03': { title: 'Một dấu minh họa', variant: 'ví dụ tín hiệu lớn', where: 'Khu đất · bản minh họa dải hồi âm', note: 'Kích cỡ và vị trí điểm do chúng tôi đặt để thử màn hình, không lấy từ lịch sử khai thác.' },
      'sonar-04': { title: 'Vòng quét lô hàng minh họa', variant: 'năm dấu giả định', where: 'Thị trường · ví dụ trang niêm yết (pages/market/ListingPage.tsx)', note: 'Vị trí các điểm chỉ thử hình vẽ sonar, không thể hiện giá trên mạng. Trang niêm yết thật đọc dữ liệu riêng.' },
      'sonar-05': { title: 'Vòng quét chưa có số liệu', variant: 'trang đầu thị trường không tải lô hàng', where: 'Thị trường · màn hình đầu (pages/market/MarketHome.tsx)', note: 'Vòng tròn trống nghĩa là “chưa truy vấn ở đây”, không phải thị trường trống hay lỗi mạng.' },
      'sonar-06': { title: 'Vòng quét dày minh họa', variant: '24 dấu giả định', where: 'Thị trường · ví dụ nhiều tin rao', note: 'Hai mươi bốn điểm chỉ thử độ dễ đọc. Đó không phải 24 lô đã xác nhận hay báo giá hiện thời.' },
    },
    sample: { lots: 'Lô trong ví dụ', layout: 'Chỉ minh họa', listings: 'Tin rao', prices: 'Giá' },
  },
  id: {
    slides: {
      'sonar-01': { title: 'Jejak gema contoh', variant: 'empat penanda rekaan', where: 'Lahan · catatan giliran (pages/farm/FarmDashboard.tsx)', note: 'Jejak ini menampilkan desain alat. Catatan lahan belum memiliki arsip kedalaman: titik dan skala bukan hasil pengukuran.' },
      'sonar-02': { title: 'Jejak gema tanpa data', variant: 'tanpa titik atau kurva', where: 'Lahan · catatan giliran', note: 'Tanpa data, tidak ada kurva atau penanda. Kisi skala saja bukan bukti kedalaman terukur.' },
      'sonar-03': { title: 'Satu penanda contoh', variant: 'contoh sinyal besar', where: 'Lahan · contoh tampilan gema', note: 'Ukuran dan posisi titik dibuat untuk menguji tampilan, bukan diambil dari arsip penambangan.' },
      'sonar-04': { title: 'Sapuan lot contoh', variant: 'lima penanda rekaan', where: 'Pasar · contoh lapak (pages/market/ListingPage.tsx)', note: 'Posisinya menguji gambar sonar, bukan harga jaringan. Layar lapak asli membaca datanya sendiri.' },
      'sonar-05': { title: 'Sapuan tanpa pembacaan', variant: 'beranda pasar tidak memuat lot', where: 'Pasar · layar pertama (pages/market/MarketHome.tsx)', note: 'Lingkaran kosong berarti “belum diambil di sini”, bukan pasar kosong atau gangguan jaringan.' },
      'sonar-06': { title: 'Sapuan padat contoh', variant: '24 penanda rekaan', where: 'Pasar · contoh banyak lapak', note: 'Dua puluh empat titik menguji keterbacaan. Ini bukan 24 lot terkonfirmasi atau harga terkini.' },
    },
    sample: { lots: 'Lot contoh', layout: 'Hanya tata letak', listings: 'Lapak', prices: 'Harga' },
  },
  fil: {
    slides: {
      'sonar-01': { title: 'Halimbawang echo trace', variant: 'apat na gawang-gawang marka', where: 'Lupain · tala ng turno (pages/farm/FarmDashboard.tsx)', note: 'Larawan lang ng aparato ang trace. Wala pang tala ng lalim ang lupain: hindi sukat ang mga marka o iskala.' },
      'sonar-02': { title: 'Echo trace na walang datos', variant: 'walang marka o kurba', where: 'Lupain · tala ng turno', note: 'Kung walang datos, walang kurba o marka. Hindi patunay ng nasukat na lalim ang grid ng iskala.' },
      'sonar-03': { title: 'Isang halimbawang marka', variant: 'halimbawa ng malaking signal', where: 'Lupain · demonstrasyon ng echo trace', note: 'Inimbento ang laki at puwesto ng tuldok para subukan ang display, hindi galing sa tala ng pagmimina.' },
      'sonar-04': { title: 'Halimbawang sweep ng lot', variant: 'limang gawang-gawang marka', where: 'Pamilihan · halimbawa ng listahan (pages/market/ListingPage.tsx)', note: 'Pagsubok lang sa larawan ng sonar ang mga puwesto, hindi presyo sa network. Hiwalay na binabasa ng totoong listahan ang datos.' },
      'sonar-05': { title: 'Sweep na walang basa', variant: 'hindi naglo-load ng lot ang unang pahina ng pamilihan', where: 'Pamilihan · unang screen (pages/market/MarketHome.tsx)', note: 'Ang walang lamang bilog ay “hindi pa kinukuha rito”, hindi patunay ng walang laman na pamilihan o sira ang network.' },
      'sonar-06': { title: 'Masinsing halimbawang sweep', variant: '24 na gawang-gawang marka', where: 'Pamilihan · halimbawa ng maraming listahan', note: 'Sinusubok ng 24 na tuldok kung nababasa ang ayos. Hindi ito 24 nakumpirmang lot o live na presyo.' },
    },
    sample: { lots: 'Mga lot sa halimbawa', layout: 'Ayos lamang', listings: 'Mga listahan', prices: 'Mga presyo' },
  },
};
