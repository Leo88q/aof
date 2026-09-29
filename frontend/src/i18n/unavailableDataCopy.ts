import type { Language } from './translations';

type Reason = { title: string; reason: string };
type Id = 'resource_balances' | 'quest_progress' | 'daily_rewards' | 'trust_profile' | 'privileges' | 'neighbors' | 'portfolio';
export const unavailableDataCopy: Record<Language, Record<Id, Reason>> = {
  ru: {
    resource_balances: { title: 'Балансы ресурсов недоступны', reason: 'Реестр ресурсов не читается из сети. Прочерк означает «неизвестно»; ноль означал бы «пусто».' },
    quest_progress: { title: 'Прогресс заданий недоступен', reason: 'Сеть ещё не ведёт архив заданий. Вместо выдуманного нулевого прогресса этот раздел остаётся пустым.' },
    daily_rewards: { title: 'Ежедневные награды отключены', reason: 'Сеть ещё не выдаёт ежедневные награды. Запросы закрыты: ничего не отправляется и не списывается.' },
    trust_profile: { title: 'Индекс доверия недоступен', reason: 'Сеть ещё не ведёт архив доверия. Оценка не показывается, чтобы не выдумывать вашу репутацию.' },
    privileges: { title: 'Привилегии недоступны', reason: 'Сеть пока не ведёт подтверждённый список привилегий. Никакие права доступа и скидки не показаны как действующие.' },
    neighbors: { title: 'Друзья и визиты недоступны', reason: 'Архив соседских связей и лимит визитов пока недоступны. Мы не показываем выдуманный пустой список и не отправляем визиты.' },
    portfolio: { title: 'Оценка портфеля недоступна', reason: 'Сеть пока не предоставляет проверенные балансы всех активов и цены для оценки. Стоимость, графики и статистика неизвестны — не показываем выдуманные нули.' },
  },
  en: {
    resource_balances: { title: 'Resource balances unavailable', reason: 'The network cannot read the resource registry. A dash means “unknown”; zero would mean “empty”.' },
    quest_progress: { title: 'Quest progress unavailable', reason: 'The network does not yet maintain a quest history. This section stays empty rather than showing made-up zero progress.' },
    daily_rewards: { title: 'Daily rewards are disabled', reason: 'The network does not yet issue daily rewards. Requests are blocked; nothing is submitted or deducted.' },
    trust_profile: { title: 'Trust score unavailable', reason: 'The network does not yet maintain a trust record. No score is shown rather than inventing your reputation.' },
    privileges: { title: 'Privileges unavailable', reason: 'The network does not yet maintain a verified privilege list. No access rights or discounts are shown as active.' },
    neighbors: { title: 'Friends and visits unavailable', reason: 'The neighbor index and visit limit are not available yet. We will not show a made-up empty list or submit visits.' },
    portfolio: { title: 'Portfolio valuation unavailable', reason: 'Verified balances and prices for every asset are not yet available. Value, charts and statistics are unknown; we will not show made-up zeros.' },
  },
  pt: {
    resource_balances: { title: 'Saldos de recursos indisponíveis', reason: 'A rede não consegue ler o registro de recursos. Um traço significa «desconhecido»; zero significaria «vazio».' },
    quest_progress: { title: 'Progresso das missões indisponível', reason: 'A rede ainda não mantém um histórico de missões. Esta seção fica vazia, em vez de mostrar um progresso zero inventado.' },
    daily_rewards: { title: 'Recompensas diárias desativadas', reason: 'A rede ainda não distribui recompensas diárias. As solicitações estão bloqueadas; nada é enviado nem descontado.' },
    trust_profile: { title: 'Índice de confiança indisponível', reason: 'A rede ainda não mantém um histórico de confiança. Não exibimos uma pontuação inventada para sua reputação.' },
    privileges: { title: 'Privilégios indisponíveis', reason: 'A rede ainda não mantém uma lista verificada de privilégios. Nenhum acesso ou desconto é apresentado como ativo.' },
    neighbors: { title: 'Amigos e visitas indisponíveis', reason: 'O registo de vizinhos e o limite de visitas ainda não estão disponíveis. Não mostramos uma lista vazia inventada nem enviamos visitas.' },
    portfolio: { title: 'Avaliação do portfólio indisponível', reason: 'Ainda não há saldos e preços verificados para todos os ativos. O valor, os gráficos e as estatísticas são desconhecidos; não mostramos zeros inventados.' },
  },
  es: {
    resource_balances: { title: 'Saldos de recursos no disponibles', reason: 'La red no puede leer el registro de recursos. Un guion significa «desconocido»; cero significaría «vacío».' },
    quest_progress: { title: 'Progreso de misiones no disponible', reason: 'La red aún no conserva el historial de misiones. Esta sección queda vacía en lugar de mostrar un progreso cero inventado.' },
    daily_rewards: { title: 'Recompensas diarias desactivadas', reason: 'La red aún no entrega recompensas diarias. Las solicitudes están bloqueadas; no se envía ni se descuenta nada.' },
    trust_profile: { title: 'Índice de confianza no disponible', reason: 'La red aún no mantiene un historial de confianza. No mostramos una puntuación que invente tu reputación.' },
    privileges: { title: 'Privilegios no disponibles', reason: 'La red aún no conserva una lista verificada de privilegios. No se muestran permisos ni descuentos como activos.' },
    neighbors: { title: 'Amigos y visitas no disponibles', reason: 'El registro de vecinos y el límite de visitas aún no están disponibles. No mostramos una lista vacía inventada ni enviamos visitas.' },
    portfolio: { title: 'Valoración de cartera no disponible', reason: 'Aún no hay saldos ni precios verificados para todos los activos. El valor, los gráficos y las estadísticas son desconocidos; no mostramos ceros inventados.' },
  },
  vi: {
    resource_balances: { title: 'Chưa có số dư tài nguyên', reason: 'Mạng không thể đọc danh mục tài nguyên. Dấu gạch ngang nghĩa là «chưa rõ»; số không mới có nghĩa là «trống».' },
    quest_progress: { title: 'Chưa có tiến độ nhiệm vụ', reason: 'Mạng chưa lưu lịch sử nhiệm vụ. Mục này được để trống thay vì hiển thị tiến độ bằng không giả.' },
    daily_rewards: { title: 'Phần thưởng hằng ngày chưa mở', reason: 'Mạng chưa phát phần thưởng hằng ngày. Các yêu cầu đều bị chặn; không có gì được gửi đi hoặc trừ đi.' },
    trust_profile: { title: 'Chưa có điểm tin cậy', reason: 'Mạng chưa lưu hồ sơ tin cậy. Không hiển thị điểm số để tránh bịa ra danh tiếng của bạn.' },
    privileges: { title: 'Chưa có đặc quyền', reason: 'Mạng chưa lưu danh sách đặc quyền đã xác minh. Không có quyền truy cập hay ưu đãi nào được hiển thị là đang hoạt động.' },
    neighbors: { title: 'Chưa có dữ liệu bạn bè và lượt ghé thăm', reason: 'Chưa có dữ liệu hàng xóm hoặc giới hạn lượt ghé thăm. Không hiển thị danh sách trống giả định hay gửi yêu cầu ghé thăm.' },
    portfolio: { title: 'Chưa thể định giá danh mục', reason: 'Chưa có số dư và giá đã xác minh cho mọi tài sản. Giá trị, biểu đồ và thống kê hiện chưa rõ; chúng tôi không hiển thị số không giả định.' },
  },
  id: {
    resource_balances: { title: 'Saldo sumber daya tidak tersedia', reason: 'Jaringan tidak dapat membaca daftar sumber daya. Tanda pisah berarti «tidak diketahui»; nol berarti «kosong».' },
    quest_progress: { title: 'Kemajuan misi tidak tersedia', reason: 'Jaringan belum menyimpan riwayat misi. Bagian ini dibiarkan kosong, bukan menampilkan kemajuan nol yang dibuat-buat.' },
    daily_rewards: { title: 'Hadiah harian dinonaktifkan', reason: 'Jaringan belum membagikan hadiah harian. Permintaan diblokir; tidak ada yang dikirim atau dipotong.' },
    trust_profile: { title: 'Skor kepercayaan tidak tersedia', reason: 'Jaringan belum menyimpan catatan kepercayaan. Skor tidak ditampilkan agar reputasimu tidak dibuat-buat.' },
    privileges: { title: 'Hak istimewa tidak tersedia', reason: 'Jaringan belum menyimpan daftar hak istimewa terverifikasi. Tidak ada akses atau diskon yang ditampilkan sebagai aktif.' },
    neighbors: { title: 'Teman dan kunjungan belum tersedia', reason: 'Daftar tetangga dan batas kunjungan belum tersedia. Kami tidak menampilkan daftar kosong rekaan atau mengirim kunjungan.' },
    portfolio: { title: 'Penilaian portofolio belum tersedia', reason: 'Saldo dan harga terverifikasi untuk seluruh aset belum tersedia. Nilai, grafik, dan statistik belum diketahui; kami tidak menampilkan angka nol rekaan.' },
  },
  fil: {
    resource_balances: { title: 'Hindi makuha ang balanse ng yaman', reason: 'Hindi mabasa ng network ang talaan ng yaman. Ang gitling ay «hindi pa alam»; ang sero ay «walang laman».' },
    quest_progress: { title: 'Hindi makuha ang pag-usad ng mga gawain', reason: 'Hindi pa nagtatala ng kasaysayan ng gawain ang network. Iniiwang walang laman ang bahaging ito sa halip na magpakita ng inimbentong serong pag-usad.' },
    daily_rewards: { title: 'Nakasara ang pang-araw-araw na gantimpala', reason: 'Hindi pa nagbibigay ng pang-araw-araw na gantimpala ang network. Naka-block ang mga kahilingan; walang ipinapadala o ibinabawas.' },
    trust_profile: { title: 'Hindi makuha ang antas ng tiwala', reason: 'Hindi pa nagtatala ng kasaysayan ng tiwala ang network. Walang markang ipinapakita para hindi maimbento ang iyong reputasyon.' },
    privileges: { title: 'Hindi makuha ang mga pribilehiyo', reason: 'Hindi pa nagtatala ang network ng nakumpirmang pribilehiyo. Walang karapatan o diskuwentong ipinapakitang aktibo.' },
    neighbors: { title: 'Hindi pa makuha ang mga kaibigan at pagbisita', reason: 'Hindi pa available ang talaan ng kapitbahay at limitasyon sa pagbisita. Hindi kami magpapakita ng inimbentong listahang walang laman o magpapadala ng pagbisita.' },
    portfolio: { title: 'Hindi pa matantiya ang halaga ng portfolio', reason: 'Wala pang na-verify na balanse at presyo para sa lahat ng asset. Hindi pa alam ang halaga, mga graph, at estadistika; hindi kami magpapakita ng inimbentong sero.' },
  },
};
