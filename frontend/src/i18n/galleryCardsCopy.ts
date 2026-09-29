import type { Language } from './translations';

export const cardsIds = ['cards-01', 'cards-02', 'cards-03', 'cards-04', 'cards-05'] as const;
export type CardsId = typeof cardsIds[number];
type Meta = { title: string; variant: string; where: string; note: string };

/** The quest screen currently has no verified progress archive; punched progress is illustrative only. */
export const galleryCardsCopy: Record<Language, { sampleLabel: string; slides: Record<CardsId, Meta> }> = {
  ru: { sampleLabel: 'ПРОБА', slides: {
    'cards-01': { title: 'Пробная карта прогресса', variant: 'четыре из пяти — пример', where: 'Задания · проба перфокарты (pages/quests/QuestsHome.tsx)', note: 'Столбец — условный шаг, отверстия иллюстрируют зачёт. Архив прогресса пока недоступен: это не ваши выполненные задания.' },
    'cards-02': { title: 'Прогресс неизвестен', variant: 'четыре ряда без данных', where: 'Задания · первый экран', note: 'На экране заданий используется карта с прочерками: прогресс неизвестен даже после подключения кошелька. Ноль вместо отсутствующих данных не ставится.' },
    'cards-03': { title: 'Проба полной карты', variant: 'все пять шагов отмечены — пример', where: 'Задания · проба заполненной карты', note: 'Полная перфорация показывает вид карточки. Она не подтверждает выполненное задание или получение награды.' },
    'cards-04': { title: 'Короткая пробная карта', variant: 'четыре ряда, три шага', where: 'Задания · проба короткого макета', note: 'Этот вариант проверяет короткую карточку и условное число шагов, не настоящий прогресс за день.' },
    'cards-05': { title: 'Карта без ведомости', variant: 'прочерки вместо чисел', where: 'Задания · проба недоступных данных', note: 'Когда шаги неизвестны, цифры нельзя придумывать. Здесь показан другой пробный формат с прочерками; текущий экран использует четыре ряда.' },
  } },
  en: { sampleLabel: 'SAMPLE', slides: {
    'cards-01': { title: 'Sample progress card', variant: 'four of five — an example', where: 'Quests · punched-card test (pages/quests/QuestsHome.tsx)', note: 'A column stands for a sample step; holes illustrate completion. The progress archive is unavailable: these are not your completed quests.' },
    'cards-02': { title: 'Progress unknown', variant: 'four rows without data', where: 'Quests · first screen', note: 'The quest screen uses a card with dashes: progress remains unknown even with a wallet connected. Missing data must not become zero.' },
    'cards-03': { title: 'Full-card example', variant: 'all five steps marked — sample', where: 'Quests · full-card test', note: 'Full perforation demonstrates the card design. It does not confirm a completed quest or a claimed reward.' },
    'cards-04': { title: 'Short sample card', variant: 'four rows, three steps', where: 'Quests · short-layout test', note: 'This checks a shorter card and sample step count, not actual daily progress.' },
    'cards-05': { title: 'Card without a record', variant: 'dashes instead of numbers', where: 'Quests · missing-data test', note: 'Unknown steps must not turn into invented counts. This is another dashed layout example; the current screen uses four rows.' },
  } },
  pt: { sampleLabel: 'EXEMPLO', slides: {
    'cards-01': { title: 'Cartão de progresso ilustrativo', variant: 'quatro de cinco — exemplo', where: 'Missões · teste do cartão (pages/quests/QuestsHome.tsx)', note: 'Uma coluna representa uma etapa ilustrativa; os furos mostram a conclusão. O histórico está indisponível: não são suas missões concluídas.' },
    'cards-02': { title: 'Progresso desconhecido', variant: 'quatro linhas sem dados', where: 'Missões · primeira tela', note: 'A tela de missões usa um cartão com traços: o progresso segue desconhecido mesmo com a carteira conectada. Dados ausentes não viram zero.' },
    'cards-03': { title: 'Exemplo de cartão completo', variant: 'cinco etapas marcadas — exemplo', where: 'Missões · teste do cartão preenchido', note: 'Os furos mostram o desenho do cartão; não confirmam missão concluída nem recompensa recebida.' },
    'cards-04': { title: 'Cartão curto ilustrativo', variant: 'quatro linhas, três etapas', where: 'Missões · teste do formato curto', note: 'Este exemplo testa um cartão menor e etapas fictícias, não o progresso diário real.' },
    'cards-05': { title: 'Cartão sem histórico', variant: 'traços no lugar de números', where: 'Missões · teste de dados ausentes', note: 'Etapas desconhecidas não devem ganhar números inventados. Este é outro formato ilustrativo; a tela atual usa quatro linhas.' },
  } },
  es: { sampleLabel: 'EJEMPLO', slides: {
    'cards-01': { title: 'Tarjeta de progreso ilustrativa', variant: 'cuatro de cinco — ejemplo', where: 'Misiones · prueba de la tarjeta (pages/quests/QuestsHome.tsx)', note: 'Una columna representa un paso de ejemplo y las perforaciones ilustran su cumplimiento. No hay historial disponible: no son tus misiones.' },
    'cards-02': { title: 'Progreso desconocido', variant: 'cuatro filas sin datos', where: 'Misiones · primera pantalla', note: 'La pantalla de misiones usa una tarjeta con guiones: el progreso sigue siendo desconocido aun con la cartera conectada. No se sustituye por cero.' },
    'cards-03': { title: 'Ejemplo de tarjeta completa', variant: 'cinco pasos marcados — muestra', where: 'Misiones · prueba de tarjeta llena', note: 'Las perforaciones ilustran el diseño; no confirman una misión cumplida ni una recompensa cobrada.' },
    'cards-04': { title: 'Tarjeta corta ilustrativa', variant: 'cuatro filas, tres pasos', where: 'Misiones · prueba del formato corto', note: 'Se prueba una tarjeta breve con pasos ficticios, no tu progreso diario real.' },
    'cards-05': { title: 'Tarjeta sin historial', variant: 'guiones en lugar de cifras', where: 'Misiones · prueba de datos ausentes', note: 'Los pasos desconocidos no deben convertirse en cifras inventadas. Este es otro formato ilustrativo; la pantalla actual usa cuatro filas.' },
  } },
  vi: { sampleLabel: 'VÍ DỤ', slides: {
    'cards-01': { title: 'Thẻ tiến độ minh họa', variant: 'bốn trên năm — ví dụ', where: 'Nhiệm vụ · thử thẻ đục lỗ (pages/quests/QuestsHome.tsx)', note: 'Mỗi cột là một bước giả định; lỗ thể hiện cách đánh dấu hoàn thành. Chưa có lịch sử tiến độ: đây không phải nhiệm vụ bạn đã làm.' },
    'cards-02': { title: 'Chưa rõ tiến độ', variant: 'bốn hàng không có dữ liệu', where: 'Nhiệm vụ · màn hình đầu', note: 'Màn hình nhiệm vụ hiện thẻ có dấu gạch: tiến độ vẫn chưa rõ dù đã kết nối ví. Không thay dữ liệu thiếu bằng số không.' },
    'cards-03': { title: 'Ví dụ thẻ hoàn chỉnh', variant: 'năm bước được đánh dấu — mẫu', where: 'Nhiệm vụ · thử thẻ đầy', note: 'Các lỗ minh họa hình thức thẻ; không xác nhận nhiệm vụ đã hoàn thành hay thưởng đã nhận.' },
    'cards-04': { title: 'Thẻ ngắn minh họa', variant: 'bốn hàng, ba bước', where: 'Nhiệm vụ · thử bố cục ngắn', note: 'Ví dụ này thử thẻ ngắn với các bước giả định, không phải tiến độ hằng ngày thực tế.' },
    'cards-05': { title: 'Thẻ không có lịch sử', variant: 'dấu gạch thay vì con số', where: 'Nhiệm vụ · thử dữ liệu thiếu', note: 'Không được gán số liệu bịa đặt cho bước chưa rõ. Đây là bố cục ví dụ khác; màn hình hiện tại dùng bốn hàng.' },
  } },
  id: { sampleLabel: 'CONTOH', slides: {
    'cards-01': { title: 'Kartu kemajuan contoh', variant: 'empat dari lima — contoh', where: 'Misi · uji kartu berlubang (pages/quests/QuestsHome.tsx)', note: 'Satu kolom adalah langkah contoh; lubang menggambarkan penyelesaian. Riwayat kemajuan belum tersedia: ini bukan misi Anda.' },
    'cards-02': { title: 'Kemajuan belum diketahui', variant: 'empat baris tanpa data', where: 'Misi · layar pertama', note: 'Layar misi memakai kartu bertanda pisah: kemajuan tetap belum diketahui walau dompet tersambung. Data hilang bukan angka nol.' },
    'cards-03': { title: 'Contoh kartu penuh', variant: 'lima langkah ditandai — contoh', where: 'Misi · uji kartu penuh', note: 'Lubang memperagakan desain kartu, bukan bukti misi selesai atau hadiah diterima.' },
    'cards-04': { title: 'Kartu pendek contoh', variant: 'empat baris, tiga langkah', where: 'Misi · uji tata letak pendek', note: 'Ini menguji kartu pendek dengan jumlah langkah contoh, bukan kemajuan harian sebenarnya.' },
    'cards-05': { title: 'Kartu tanpa catatan', variant: 'tanda pisah, bukan angka', where: 'Misi · uji data hilang', note: 'Langkah yang belum diketahui tidak boleh diberi jumlah rekaan. Ini contoh tampilan lain; layar saat ini memakai empat baris.' },
  } },
  fil: { sampleLabel: 'HALIMBAWA', slides: {
    'cards-01': { title: 'Halimbawang kard ng progreso', variant: 'apat sa lima — halimbawa', where: 'Mga gawain · pagsubok ng kard (pages/quests/QuestsHome.tsx)', note: 'Bawat kolum ay halimbawang hakbang; ang butas ay larawan ng pagkumpleto. Wala pang talaan ng progreso: hindi ito ang mga gawain mo.' },
    'cards-02': { title: 'Hindi pa alam ang progreso', variant: 'apat na hanay na walang datos', where: 'Mga gawain · unang screen', note: 'Kard na may mga guhit ang nasa screen ng gawain: hindi pa alam ang progreso kahit nakakonekta ang wallet. Hindi gagawing sero ang kulang na datos.' },
    'cards-03': { title: 'Halimbawa ng punong kard', variant: 'limang hakbang na may marka — halimbawa', where: 'Mga gawain · pagsubok ng punong kard', note: 'Ipinapakita ng mga butas ang itsura ng kard, hindi nito kinukumpirma ang natapos na gawain o natanggap na gantimpala.' },
    'cards-04': { title: 'Halimbawang maikling kard', variant: 'apat na hanay, tatlong hakbang', where: 'Mga gawain · pagsubok ng maikling ayos', note: 'Sinusubok nito ang maikling kard at halimbawang bilang ng hakbang, hindi ang totoong progreso mo ngayong araw.' },
    'cards-05': { title: 'Kard na walang tala', variant: 'mga guhit sa halip na bilang', where: 'Mga gawain · pagsubok ng kulang na datos', note: 'Hindi dapat imbentuhan ng bilang ang hindi pa alam na mga hakbang. Ibang halimbawang ayos ito; apat na hanay ang nasa kasalukuyang screen.' },
  } },
};
