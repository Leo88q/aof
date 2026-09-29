import type { Language } from './translations';

export const gelIds = ['gel-01', 'gel-02', 'gel-03', 'gel-04', 'gel-05'] as const;
export type GelId = typeof gelIds[number];
type Meta = { title: string; variant: string; where: string; note: string };

/** The gallery bands are synthetic; live inventory lanes represent resource categories. */
export const galleryGelCopy: Record<Language, { slides: Record<GelId, Meta> }> = {
  ru: { slides: {
    'gel-01': { title: 'Дорожки склада', variant: 'пример полос по категориям', where: 'Экономика · обзор (pages/economy/ResourceOverview.tsx)', note: 'Каждая дорожка — категория ресурсов, каждая полоса — позиция с запасом. Здесь полосы нарисованы для примера, а не по балансам игрока.' },
    'gel-02': { title: 'Гель без полос', variant: 'нет позиций с запасом', where: 'Экономика · обзор, нет подтверждённого запаса', note: 'Здесь пустая сетка без полос. На экране экономики вместо неё выводится сообщение, если прочитанные балансы пусты; сбой чтения показывается отдельно.' },
    'gel-03': { title: 'Одна дорожка', variant: 'пример одной категории', where: 'Экономика · обзор, одна категория с запасом', note: 'Гель может показать одну категорию. Полосы здесь условные и не говорят о количестве ресурсов на вашем складе.' },
    'gel-04': { title: 'Слабые полосы', variant: 'пример слабых следов', where: 'Экономика · обзор, малые запасы', note: 'Слабые полосы показывают вариант оформления: в игре их интенсивность зависит от проверенных балансов, здесь балансы не считываются.' },
    'gel-05': { title: 'Шесть дорожек', variant: 'пример всех категорий', where: 'Экономика · обзор, шесть категорий', note: 'На складе шесть категорий ресурсов. Полосы и их число здесь примерные; не принимайте рисунок за полный склад игрока.' },
  } },
  en: { slides: {
    'gel-01': { title: 'Inventory lanes', variant: 'sample bands by category', where: 'Economy · overview (pages/economy/ResourceOverview.tsx)', note: 'Each lane is a resource category; each band marks an in-stock resource. These bands illustrate the display, not your balances.' },
    'gel-02': { title: 'Gel without bands', variant: 'no resources in stock', where: 'Economy · overview, no verified stock', note: 'This is an empty grid. The economy screen shows a message instead when confirmed balances are empty; a read error is a separate state.' },
    'gel-03': { title: 'One lane', variant: 'single-category example', where: 'Economy · overview, one category in stock', note: 'The gel can show one category. Its bands here are illustrative and do not report how much you own.' },
    'gel-04': { title: 'Faint bands', variant: 'sample faint traces', where: 'Economy · overview, low stock', note: 'Faint bands demonstrate the style: in the game their intensity depends on verified balances, which this drawing does not read.' },
    'gel-05': { title: 'Six lanes', variant: 'all-category example', where: 'Economy · overview, six categories', note: 'Inventory tracks six resource categories. These bands and their count are examples, not proof your inventory is full.' },
  } },
  pt: { slides: {
    'gel-01': { title: 'Pistas do estoque', variant: 'faixas por categoria — exemplo', where: 'Economia · visão geral (pages/economy/ResourceOverview.tsx)', note: 'Cada pista é uma categoria de recursos; cada faixa representa um recurso em estoque. As faixas ilustram a tela, não os seus saldos.' },
    'gel-02': { title: 'Gel sem faixas', variant: 'nenhum recurso em estoque', where: 'Economia · visão geral, sem estoque confirmado', note: 'Esta é uma grade vazia. A tela de economia mostra uma mensagem quando os saldos confirmados estão vazios; uma falha de leitura é outro estado.' },
    'gel-03': { title: 'Uma pista', variant: 'exemplo de uma categoria', where: 'Economia · visão geral, uma categoria com estoque', note: 'O gel pode mostrar uma única categoria. As faixas são ilustrativas e não indicam quanto você possui.' },
    'gel-04': { title: 'Faixas tênues', variant: 'exemplo de traços fracos', where: 'Economia · visão geral, pouco estoque', note: 'As faixas tênues demonstram o estilo; no jogo, a intensidade depende de saldos confirmados que esta imagem não consulta.' },
    'gel-05': { title: 'Seis pistas', variant: 'exemplo de todas as categorias', where: 'Economia · visão geral, seis categorias', note: 'O estoque tem seis categorias de recursos. As faixas e sua quantidade são exemplos, não prova de que seu estoque esteja cheio.' },
  } },
  es: { slides: {
    'gel-01': { title: 'Carriles del almacén', variant: 'bandas por categoría — ejemplo', where: 'Economía · resumen (pages/economy/ResourceOverview.tsx)', note: 'Cada carril es una categoría de recursos; cada banda representa un recurso disponible. Estas bandas ilustran la vista, no tus saldos.' },
    'gel-02': { title: 'Gel sin bandas', variant: 'sin recursos almacenados', where: 'Economía · resumen, sin existencias confirmadas', note: 'Esta es una cuadrícula vacía. La pantalla de economía muestra un mensaje si los saldos confirmados están vacíos; un error de lectura es otro estado.' },
    'gel-03': { title: 'Un carril', variant: 'ejemplo de una categoría', where: 'Economía · resumen, una categoría con recursos', note: 'El gel puede mostrar una sola categoría. Aquí las bandas son ilustrativas y no indican cuánto tienes.' },
    'gel-04': { title: 'Bandas tenues', variant: 'ejemplo de huellas débiles', where: 'Economía · resumen, pocas existencias', note: 'Las bandas tenues ilustran el diseño; en el juego su intensidad depende de saldos confirmados que este dibujo no consulta.' },
    'gel-05': { title: 'Seis carriles', variant: 'ejemplo de todas las categorías', where: 'Economía · resumen, seis categorías', note: 'El almacén tiene seis categorías de recursos. Las bandas y su número son ejemplos, no prueba de que tu almacén esté lleno.' },
  } },
  vi: { slides: {
    'gel-01': { title: 'Rãnh kho', variant: 'ví dụ vạch theo nhóm', where: 'Kinh tế · tổng quan (pages/economy/ResourceOverview.tsx)', note: 'Mỗi rãnh là một nhóm tài nguyên; mỗi vạch đại diện cho tài nguyên còn trong kho. Các vạch minh họa giao diện, không phải số dư của bạn.' },
    'gel-02': { title: 'Gel không có vạch', variant: 'không có tài nguyên trong kho', where: 'Kinh tế · tổng quan, chưa xác nhận có hàng', note: 'Đây là lưới trống. Màn hình kinh tế hiện thông báo khi số dư đã xác nhận trống; lỗi đọc là một trạng thái khác.' },
    'gel-03': { title: 'Một rãnh', variant: 'ví dụ một nhóm', where: 'Kinh tế · tổng quan, một nhóm có hàng', note: 'Gel có thể hiển thị một nhóm. Các vạch ở đây chỉ minh họa, không báo lượng tài nguyên bạn sở hữu.' },
    'gel-04': { title: 'Vạch mờ', variant: 'ví dụ dấu vết yếu', where: 'Kinh tế · tổng quan, lượng hàng ít', note: 'Vạch mờ minh họa cách hiển thị; trong trò chơi, độ đậm dựa vào số dư đã xác nhận, không được đọc trong hình này.' },
    'gel-05': { title: 'Sáu rãnh', variant: 'ví dụ đủ sáu nhóm', where: 'Kinh tế · tổng quan, sáu nhóm', note: 'Kho theo dõi sáu nhóm tài nguyên. Các vạch và số lượng ở đây chỉ là ví dụ, không chứng minh kho của bạn đã đầy.' },
  } },
  id: { slides: {
    'gel-01': { title: 'Lajur gudang', variant: 'contoh pita per kategori', where: 'Ekonomi · ringkasan (pages/economy/ResourceOverview.tsx)', note: 'Setiap lajur mewakili kategori sumber daya; tiap pita menandai sumber daya yang tersedia. Pita ini hanya ilustrasi, bukan saldo Anda.' },
    'gel-02': { title: 'Gel tanpa pita', variant: 'tidak ada persediaan', where: 'Ekonomi · ringkasan, tanpa stok terverifikasi', note: 'Ini kisi kosong. Layar ekonomi menampilkan pesan jika saldo terverifikasi kosong; kegagalan membaca merupakan keadaan lain.' },
    'gel-03': { title: 'Satu lajur', variant: 'contoh satu kategori', where: 'Ekonomi · ringkasan, satu kategori tersedia', note: 'Gel bisa menampilkan satu kategori. Pita di sini hanya ilustrasi, bukan laporan jumlah milik Anda.' },
    'gel-04': { title: 'Pita samar', variant: 'contoh jejak lemah', where: 'Ekonomi · ringkasan, stok sedikit', note: 'Pita samar memperagakan tampilannya; dalam gim, intensitasnya bergantung pada saldo terverifikasi yang tidak dibaca oleh gambar ini.' },
    'gel-05': { title: 'Enam lajur', variant: 'contoh semua kategori', where: 'Ekonomi · ringkasan, enam kategori', note: 'Gudang mencakup enam kategori sumber daya. Pita dan jumlahnya hanyalah contoh, bukan bukti gudang Anda penuh.' },
  } },
  fil: { slides: {
    'gel-01': { title: 'Mga linya ng imbakan', variant: 'halimbawang banda ayon sa kategorya', where: 'Ekonomiya · buod (pages/economy/ResourceOverview.tsx)', note: 'Bawat linya ay kategorya ng yaman; bawat banda ay yamang may imbentaryo. Larawan lamang ang mga banda, hindi ang balanse mo.' },
    'gel-02': { title: 'Gel na walang banda', variant: 'walang yamang nakaimbak', where: 'Ekonomiya · buod, walang napatunayang imbentaryo', note: 'Bakanteng grid ito. Mensahe ang ipinapakita ng ekonomiya kung walang nakumpirmang balanse; ibang kalagayan ang error sa pagbasa.' },
    'gel-03': { title: 'Isang linya', variant: 'halimbawa ng iisang kategorya', where: 'Ekonomiya · buod, may laman ang isang kategorya', note: 'Puwedeng ipakita ng gel ang isang kategorya. Halimbawa lamang ang mga banda at hindi nagsasabi kung gaano karami ang pag-aari mo.' },
    'gel-04': { title: 'Mahihinang banda', variant: 'halimbawa ng mapupusyaw na marka', where: 'Ekonomiya · buod, kaunting imbentaryo', note: 'Ipinapakita ng mahihinang banda ang hitsura; sa laro, batay ang tingkad sa napatunayang balanse na hindi binabasa ng larawang ito.' },
    'gel-05': { title: 'Anim na linya', variant: 'halimbawa ng lahat ng kategorya', where: 'Ekonomiya · buod, anim na kategorya', note: 'Anim ang kategorya ng yaman sa imbakan. Halimbawa lang ang mga banda at bilang nito, hindi patunay na puno ang imbentaryo mo.' },
  } },
};
