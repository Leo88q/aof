import type { Language } from './translations';

type Copy = {
  intro: string; title: string; unverified: string; verifying: string; unavailable: string; connect: string;
  active: string; expired: string; notActive: string; notOwned: string;
  progress: string; season: string; xp: string; claimed: string; track: string;
  paid: string; free: string; purchase: string; preparing: string; submitted: string;
  pending: string; failed: string; missingTreasury: string;
  themeTitle: string; themeNote: string; copper: string; orchid: string;
};

export const seasonPassCopy: Record<Language, Copy> = {
  ru: {
    intro: 'Состояние пропуска и активность сезона проверяются по аккаунтам в сети.', title: 'Пропуск эпохи',
    unverified: 'Покупка пропуска закрыта до проверки наград и преимуществ в devnet. Статус уже купленного пропуска читается из сети.',
    verifying: 'Проверяем сезон и пропуск в сети…', unavailable: 'Не удалось проверить сезон и пропуск. Статус и возможность покупки неизвестны.', connect: 'Подключите кошелёк для проверки пропуска.',
    active: 'VIP подтверждён для текущего сезона.', expired: 'Премиум-пропуск был куплен, но сезон уже завершён.', notActive: 'Этот сезон сейчас не активен. Покупка недоступна.', notOwned: 'Премиум-пропуск для этого сезона ещё не куплен.',
    progress: 'Прогресс сезона', season: 'Эпоха', xp: 'Опыт', claimed: 'Получено наград', track: 'Премиум-ветка', paid: 'куплена', free: 'не куплена',
    purchase: 'Купить Premium за 0,15 SOL', preparing: 'Подготавливаем покупку…', submitted: 'Покупка подтверждена. Обновляем статус…',
    pending: 'Статус платежа неизвестен. Не оплачивайте повторно до проверки транзакции.', failed: 'Покупку не удалось подтвердить. Проверьте кошелёк и попробуйте позже.', missingTreasury: 'Адрес казны недоступен. Покупка заблокирована.',
    themeTitle: 'Внешний вид VIP', themeNote: 'Два варианта оформления только на время активного сезона. Выбор сохраняется в этом браузере; награды и доходность не меняются.', copper: 'Медь', orchid: 'Орхидея',
  },
  en: {
    intro: 'Pass status and season activity are verified against on-chain accounts.', title: 'Season pass',
    unverified: 'Pass purchases are closed until rewards and benefits pass devnet verification. Existing pass status is read on-chain.',
    verifying: 'Checking the season and your pass on-chain…', unavailable: 'Unable to verify the season or pass. Status and purchase availability are unknown.', connect: 'Connect your wallet to check your pass.',
    active: 'VIP is confirmed for this season.', expired: 'You bought Premium, but this season has ended.', notActive: 'This season is not active. Purchases are unavailable.', notOwned: 'You have not bought Premium for this season.',
    progress: 'Season progress', season: 'Season', xp: 'Experience', claimed: 'Rewards claimed', track: 'Premium track', paid: 'purchased', free: 'not purchased',
    purchase: 'Buy Premium for 0.15 SOL', preparing: 'Preparing your purchase…', submitted: 'Purchase confirmed. Refreshing your status…',
    pending: 'Payment status is unknown. Do not pay again until you verify the transaction.', failed: 'Could not confirm the purchase. Check your wallet and try again later.', missingTreasury: 'Treasury address unavailable. Purchasing is disabled.',
    themeTitle: 'VIP appearance', themeNote: 'Two visual styles while the season is active. This browser remembers your choice; rewards and yields do not change.', copper: 'Copper', orchid: 'Orchid',
  },
  pt: {
    intro: 'O estado do passe e a atividade da temporada são confirmados nas contas da rede.', title: 'Passe da temporada',
    unverified: 'Compras do passe fechadas até verificar prémios e vantagens na devnet. O estado dos passes existentes é lido na rede.',
    verifying: 'A verificar a temporada e o passe na rede…', unavailable: 'Não foi possível verificar a temporada ou o passe. O estado e a possibilidade de compra são desconhecidos.', connect: 'Liga a carteira para verificar o passe.',
    active: 'VIP confirmado para esta temporada.', expired: 'Compraste o Premium, mas a temporada terminou.', notActive: 'Esta temporada não está ativa. As compras estão indisponíveis.', notOwned: 'Ainda não compraste o Premium desta temporada.',
    progress: 'Progresso da temporada', season: 'Temporada', xp: 'Experiência', claimed: 'Recompensas recebidas', track: 'Trilho Premium', paid: 'comprado', free: 'não comprado',
    purchase: 'Comprar Premium por 0,15 SOL', preparing: 'A preparar a compra…', submitted: 'Compra confirmada. A atualizar o estado…',
    pending: 'O estado do pagamento é desconhecido. Não pagues novamente antes de verificar a transação.', failed: 'Não foi possível confirmar a compra. Verifica a carteira e tenta mais tarde.', missingTreasury: 'Endereço da tesouraria indisponível. Compra bloqueada.',
    themeTitle: 'Aparência VIP', themeNote: 'Dois estilos visuais durante a temporada ativa. A escolha fica neste navegador; prémios e rendimentos não mudam.', copper: 'Cobre', orchid: 'Orquídea',
  },
  es: {
    intro: 'El estado del pase y la actividad de la temporada se verifican en las cuentas de la cadena.', title: 'Pase de temporada',
    unverified: 'Las compras del pase están cerradas hasta verificar premios y ventajas en devnet. El estado de los pases existentes se consulta en la red.',
    verifying: 'Verificando la temporada y tu pase en la cadena…', unavailable: 'No se pudo verificar la temporada ni el pase. Se desconocen el estado y la disponibilidad de compra.', connect: 'Conecta tu cartera para comprobar el pase.',
    active: 'VIP confirmado para esta temporada.', expired: 'Compraste Premium, pero la temporada ya terminó.', notActive: 'Esta temporada no está activa. No se puede comprar.', notOwned: 'Aún no has comprado Premium para esta temporada.',
    progress: 'Progreso de temporada', season: 'Temporada', xp: 'Experiencia', claimed: 'Recompensas recibidas', track: 'Ruta Premium', paid: 'comprada', free: 'sin comprar',
    purchase: 'Comprar Premium por 0,15 SOL', preparing: 'Preparando la compra…', submitted: 'Compra confirmada. Actualizando el estado…',
    pending: 'Se desconoce el estado del pago. No vuelvas a pagar sin verificar la transacción.', failed: 'No se pudo confirmar la compra. Revisa tu cartera e inténtalo más tarde.', missingTreasury: 'La dirección de tesorería no está disponible. Compra bloqueada.',
    themeTitle: 'Aspecto VIP', themeNote: 'Dos estilos visuales durante la temporada activa. La elección se guarda en este navegador; los premios y rendimientos no cambian.', copper: 'Cobre', orchid: 'Orquídea',
  },
  vi: {
    intro: 'Trạng thái thẻ và hoạt động của mùa giải được xác minh từ các tài khoản trên chuỗi.', title: 'Thẻ mùa giải',
    unverified: 'Chưa bán thẻ mùa cho đến khi phần thưởng và quyền lợi được kiểm chứng trên devnet. Trạng thái thẻ cũ được đọc từ mạng.',
    verifying: 'Đang kiểm tra mùa giải và thẻ trên chuỗi…', unavailable: 'Không thể xác minh mùa giải hoặc thẻ. Chưa rõ trạng thái và khả năng mua.', connect: 'Kết nối ví để kiểm tra thẻ.',
    active: 'Đã xác nhận VIP cho mùa giải này.', expired: 'Bạn đã mua Premium nhưng mùa giải đã kết thúc.', notActive: 'Mùa giải này hiện không hoạt động. Không thể mua.', notOwned: 'Bạn chưa mua Premium cho mùa giải này.',
    progress: 'Tiến độ mùa giải', season: 'Mùa giải', xp: 'Kinh nghiệm', claimed: 'Phần thưởng đã nhận', track: 'Nhánh Premium', paid: 'đã mua', free: 'chưa mua',
    purchase: 'Mua Premium với giá 0,15 SOL', preparing: 'Đang chuẩn bị giao dịch…', submitted: 'Đã xác nhận mua. Đang cập nhật trạng thái…',
    pending: 'Chưa rõ trạng thái thanh toán. Đừng trả tiền lần nữa trước khi kiểm tra giao dịch.', failed: 'Không thể xác nhận giao dịch. Kiểm tra ví và thử lại sau.', missingTreasury: 'Không có địa chỉ ngân quỹ. Đã khóa chức năng mua.',
    themeTitle: 'Giao diện VIP', themeNote: 'Hai kiểu hiển thị khi mùa giải đang hoạt động. Lựa chọn lưu trên trình duyệt này; phần thưởng và lợi nhuận không đổi.', copper: 'Đồng', orchid: 'Hoa lan',
  },
  id: {
    intro: 'Status pass dan musim aktif diverifikasi melalui akun di blockchain.', title: 'Pass musim',
    unverified: 'Pembelian pass ditutup hingga hadiah dan manfaat diverifikasi di devnet. Status pass lama dibaca dari jaringan.',
    verifying: 'Memeriksa musim dan pass di blockchain…', unavailable: 'Musim atau pass tidak dapat diverifikasi. Status dan ketersediaan pembelian belum diketahui.', connect: 'Hubungkan dompet untuk memeriksa pass.',
    active: 'VIP terkonfirmasi untuk musim ini.', expired: 'Kamu telah membeli Premium, tetapi musim ini telah berakhir.', notActive: 'Musim ini tidak aktif. Pembelian tidak tersedia.', notOwned: 'Kamu belum membeli Premium untuk musim ini.',
    progress: 'Progres musim', season: 'Musim', xp: 'Pengalaman', claimed: 'Hadiah yang diambil', track: 'Jalur Premium', paid: 'sudah dibeli', free: 'belum dibeli',
    purchase: 'Beli Premium seharga 0,15 SOL', preparing: 'Menyiapkan pembelian…', submitted: 'Pembelian dikonfirmasi. Memperbarui status…',
    pending: 'Status pembayaran belum diketahui. Jangan membayar lagi sebelum memeriksa transaksi.', failed: 'Pembelian tidak dapat dikonfirmasi. Periksa dompet dan coba lagi nanti.', missingTreasury: 'Alamat kas tidak tersedia. Pembelian dinonaktifkan.',
    themeTitle: 'Tampilan VIP', themeNote: 'Dua gaya tampilan selama musim aktif. Pilihan disimpan di peramban ini; hadiah dan hasil tidak berubah.', copper: 'Tembaga', orchid: 'Anggrek',
  },
  fil: {
    intro: 'Sinusuri sa mga on-chain account ang status ng pass at kung aktibo ang season.', title: 'Pass ng season',
    unverified: 'Sarado ang pagbili ng pass hanggang masuri sa devnet ang mga premyo at benepisyo. Binabasa sa network ang status ng lumang pass.',
    verifying: 'Sinusuri ang season at pass sa blockchain…', unavailable: 'Hindi ma-verify ang season o pass. Hindi pa tiyak ang status at kung puwedeng bumili.', connect: 'Ikonekta ang wallet para masuri ang pass.',
    active: 'Kumpirmado ang VIP para sa season na ito.', expired: 'Nabili mo na ang Premium, pero tapos na ang season.', notActive: 'Hindi aktibo ang season na ito. Hindi maaaring bumili.', notOwned: 'Hindi mo pa nabibili ang Premium para sa season na ito.',
    progress: 'Progreso sa season', season: 'Panahon', xp: 'Karanasan', claimed: 'Nakuha nang gantimpala', track: 'Premium na landas', paid: 'nabili na', free: 'hindi pa nabibili',
    purchase: 'Bilhin ang Premium sa halagang 0.15 SOL', preparing: 'Inihahanda ang pagbili…', submitted: 'Kumpirmado ang pagbili. Ina-update ang status…',
    pending: 'Hindi pa tiyak ang bayad. Huwag magbayad muli hangga’t hindi nasusuri ang transaksiyon.', failed: 'Hindi makumpirma ang pagbili. Tingnan ang wallet at subukan muli mamaya.', missingTreasury: 'Hindi makuha ang address ng kaban. Hindi maaaring bumili.',
    themeTitle: 'VIP na hitsura', themeNote: 'Dalawang anyo habang aktibo ang season. Nasa browser na ito ang iyong pagpili; hindi nagbabago ang gantimpala o kita.', copper: 'Tanso', orchid: 'Orkidyas',
  },
};
