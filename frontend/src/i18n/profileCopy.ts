import type { Language } from './translations';

type Copy = {
  guest: string; guestSticker: string; operator: string; noWallet: string;
  connect: string; reading: string; unknown: string; source: string;
  villagers: string; villagersHint: string; available: string; availableHint: string;
  historian: string; historianHint: string; medallion: string; medallionHint: string;
  tent: string; tentYes: string; tentNo: string; trust: string; trustHint: string;
  sectionsSticker: string; sectionsMeta: string; sectionsTitle: string; sectionsSub: string;
  friends: string; seasonVip: string;
  accessSticker: string; accessMeta: string; accessTitle: string; accessSub: string;
  rebirthSticker: string; rebirthMeta: string; rebirthTitle: string; rebirthSub: string;
  rebirthNote: string; rebirthDisabled: string;
  teamSticker: string; teamMeta: string; sandbox: string; agent: string;
  activity: string; monitor: string; gallery: string;
};
export const profileCopy: Record<Language, Copy> = {
  ru: {
    guest: 'Гость', guestSticker: 'ГОСТЬ', operator: 'ОПЕРАТОР', noWallet: 'БЕЗ КОШЕЛЬКА',
    connect: 'Подключите кошелёк, чтобы увидеть состояние игрока в сети.', reading: 'Читаем состояние игрока из сети…', unknown: 'Состояние игрока недоступно из сети. Показатели неизвестны.', source: 'Данные из аккаунта игрока в сети',
    villagers: 'Жители', villagersHint: 'в аккаунте игрока', available: 'Доступны', availableHint: 'жители, готовые к работе',
    historian: 'Историки', historianHint: 'подтверждённый счётчик', medallion: 'Медальоны', medallionHint: 'подтверждённый счётчик',
    tent: 'Палатка', tentYes: 'есть в аккаунте игрока', tentNo: 'нет в аккаунте игрока', trust: 'Доверие', trustHint: 'архив доверия ещё недоступен',
    sectionsSticker: 'РАЗДЕЛЫ', sectionsMeta: 'СТЕЛЛАЖ', sectionsTitle: 'Разделы лаборатории', sectionsSub: 'куда идти дальше',
    friends: 'Друзья и соседи', seasonVip: 'Пасс эпохи и VIP',
    accessSticker: 'ДОСТУП', accessMeta: 'ПАНЕЛЬ', accessTitle: 'Привилегии', accessSub: 'состояние доступа в сети',
    rebirthSticker: 'ЭНДГЕЙМ', rebirthMeta: 'ОТКЛЮЧЕНО', rebirthTitle: 'Перерождение', rebirthSub: 'сброс прогресса пока закрыт',
    rebirthNote: 'Перерождение пока невозможно: сеть не умеет сбрасывать весь прогресс одним действием.', rebirthDisabled: 'Перерождение недоступно',
    teamSticker: 'СЛУЖЕБНОЕ', teamMeta: 'ДЛЯ КОМАНДЫ', sandbox: 'Песочница экономики', agent: 'Торговый агент', activity: 'Журнал действий', monitor: 'Монитор экономики', gallery: 'Палитра приборов',
  },
  en: {
    guest: 'Guest', guestSticker: 'GUEST', operator: 'OPERATOR', noWallet: 'NO WALLET',
    connect: 'Connect a wallet to see your on-chain player state.', reading: 'Reading your player state from the network…', unknown: 'Player state is unavailable from the network. Its values are unknown.', source: 'Read from the on-chain player account',
    villagers: 'Residents', villagersHint: 'in the player account', available: 'Available', availableHint: 'residents ready to work',
    historian: 'Historians', historianHint: 'verified counter', medallion: 'Medallions', medallionHint: 'verified counter',
    tent: 'Tent', tentYes: 'present in the player account', tentNo: 'not present in the player account', trust: 'Trust', trustHint: 'trust history not yet available',
    sectionsSticker: 'SECTIONS', sectionsMeta: 'RACK', sectionsTitle: 'Laboratory sections', sectionsSub: 'where to go next',
    friends: 'Friends and neighbors', seasonVip: 'Season pass and VIP',
    accessSticker: 'ACCESS', accessMeta: 'PANEL', accessTitle: 'Privileges', accessSub: 'network access status',
    rebirthSticker: 'ENDGAME', rebirthMeta: 'DISABLED', rebirthTitle: 'Rebirth', rebirthSub: 'progress reset is not yet available',
    rebirthNote: 'Rebirth is unavailable: the network cannot reset all progress in one action yet.', rebirthDisabled: 'Rebirth unavailable',
    teamSticker: 'TEAM TOOLS', teamMeta: 'FOR THE TEAM', sandbox: 'Economy sandbox', agent: 'Trading agent', activity: 'Activity log', monitor: 'Economy monitor', gallery: 'Device gallery',
  },
  pt: {
    guest: 'Visitante', guestSticker: 'VISITANTE', operator: 'OPERADOR', noWallet: 'SEM CARTEIRA',
    connect: 'Conecte uma carteira para ver seu estado de jogador na rede.', reading: 'Consultando seu estado de jogador na rede…', unknown: 'O estado do jogador está indisponível na rede. Seus valores são desconhecidos.', source: 'Dados da conta do jogador na rede',
    villagers: 'Moradores', villagersHint: 'na conta do jogador', available: 'Disponíveis', availableHint: 'moradores prontos para trabalhar',
    historian: 'Historiadores', historianHint: 'contador verificado', medallion: 'Medalhões', medallionHint: 'contador verificado',
    tent: 'Tenda', tentYes: 'presente na conta do jogador', tentNo: 'não consta na conta do jogador', trust: 'Confiança', trustHint: 'histórico de confiança ainda indisponível',
    sectionsSticker: 'SEÇÕES', sectionsMeta: 'ESTANTE', sectionsTitle: 'Seções do laboratório', sectionsSub: 'para onde ir agora',
    friends: 'Amigos e vizinhos', seasonVip: 'Passe da época e VIP',
    accessSticker: 'ACESSO', accessMeta: 'PAINEL', accessTitle: 'Privilégios', accessSub: 'estado do acesso na rede',
    rebirthSticker: 'ETAPA FINAL', rebirthMeta: 'DESATIVADO', rebirthTitle: 'Renascimento', rebirthSub: 'a redefinição do progresso ainda não está disponível',
    rebirthNote: 'O renascimento está indisponível: a rede ainda não consegue redefinir todo o progresso de uma vez.', rebirthDisabled: 'Renascimento indisponível',
    teamSticker: 'FERRAMENTAS', teamMeta: 'PARA A EQUIPE', sandbox: 'Simulador da economia', agent: 'Agente comercial', activity: 'Histórico de ações', monitor: 'Monitor da economia', gallery: 'Galeria de dispositivos',
  },
  es: {
    guest: 'Visitante', guestSticker: 'VISITANTE', operator: 'OPERADOR', noWallet: 'SIN CARTERA',
    connect: 'Conecta una cartera para ver tu estado de jugador en la red.', reading: 'Consultando tu estado de jugador en la red…', unknown: 'El estado del jugador no está disponible en la red. Sus valores son desconocidos.', source: 'Datos de la cuenta del jugador en la red',
    villagers: 'Habitantes', villagersHint: 'en la cuenta del jugador', available: 'Disponibles', availableHint: 'habitantes listos para trabajar',
    historian: 'Historiadores', historianHint: 'contador verificado', medallion: 'Medallones', medallionHint: 'contador verificado',
    tent: 'Tienda', tentYes: 'figura en la cuenta del jugador', tentNo: 'no figura en la cuenta del jugador', trust: 'Confianza', trustHint: 'historial de confianza aún no disponible',
    sectionsSticker: 'SECCIONES', sectionsMeta: 'ESTANTE', sectionsTitle: 'Secciones del laboratorio', sectionsSub: 'adónde ir después',
    friends: 'Amigos y vecinos', seasonVip: 'Pase de temporada y VIP',
    accessSticker: 'ACCESO', accessMeta: 'PANEL', accessTitle: 'Privilegios', accessSub: 'estado del acceso en la red',
    rebirthSticker: 'FASE FINAL', rebirthMeta: 'DESACTIVADO', rebirthTitle: 'Renacimiento', rebirthSub: 'el reinicio del progreso aún no está disponible',
    rebirthNote: 'El renacimiento no está disponible: la red aún no puede reiniciar todo el progreso en una sola acción.', rebirthDisabled: 'Renacimiento no disponible',
    teamSticker: 'HERRAMIENTAS', teamMeta: 'PARA EL EQUIPO', sandbox: 'Simulador económico', agent: 'Agente comercial', activity: 'Registro de actividad', monitor: 'Monitor económico', gallery: 'Galería de dispositivos',
  },
  vi: {
    guest: 'Khách', guestSticker: 'KHÁCH', operator: 'NGƯỜI VẬN HÀNH', noWallet: 'CHƯA KẾT NỐI VÍ',
    connect: 'Kết nối ví để xem trạng thái người chơi trên chuỗi.', reading: 'Đang đọc trạng thái người chơi từ mạng…', unknown: 'Không thể đọc trạng thái người chơi từ mạng. Chưa xác định được các chỉ số.', source: 'Đọc từ tài khoản người chơi trên chuỗi',
    villagers: 'Cư dân', villagersHint: 'trong tài khoản người chơi', available: 'Sẵn sàng', availableHint: 'cư dân sẵn sàng làm việc',
    historian: 'Sử gia', historianHint: 'số lượng đã xác minh', medallion: 'Huy chương', medallionHint: 'số lượng đã xác minh',
    tent: 'Lều', tentYes: 'có trong tài khoản người chơi', tentNo: 'không có trong tài khoản người chơi', trust: 'Độ tin cậy', trustHint: 'chưa có lịch sử độ tin cậy',
    sectionsSticker: 'CÁC MỤC', sectionsMeta: 'GIÁ ĐỠ', sectionsTitle: 'Các mục của phòng thí nghiệm', sectionsSub: 'tiếp tục từ đâu',
    friends: 'Bạn bè và hàng xóm', seasonVip: 'Vé mùa và VIP',
    accessSticker: 'QUYỀN TRUY CẬP', accessMeta: 'BẢNG', accessTitle: 'Đặc quyền', accessSub: 'trạng thái quyền trên mạng',
    rebirthSticker: 'GIAI ĐOẠN CUỐI', rebirthMeta: 'CHƯA MỞ', rebirthTitle: 'Tái sinh', rebirthSub: 'chưa thể đặt lại tiến trình',
    rebirthNote: 'Chưa thể tái sinh: mạng chưa hỗ trợ đặt lại toàn bộ tiến trình trong một thao tác.', rebirthDisabled: 'Chưa thể tái sinh',
    teamSticker: 'CÔNG CỤ NHÓM', teamMeta: 'DÀNH CHO NHÓM', sandbox: 'Mô phỏng kinh tế', agent: 'Đại lý giao dịch', activity: 'Nhật ký hoạt động', monitor: 'Theo dõi kinh tế', gallery: 'Bộ sưu tập thiết bị',
  },
  id: {
    guest: 'Tamu', guestSticker: 'TAMU', operator: 'OPERATOR', noWallet: 'DOMPET BELUM TERHUBUNG',
    connect: 'Hubungkan dompet untuk melihat keadaan pemain di blockchain.', reading: 'Membaca keadaan pemain dari jaringan…', unknown: 'Keadaan pemain tidak tersedia dari jaringan. Nilainya belum diketahui.', source: 'Dibaca dari akun pemain di blockchain',
    villagers: 'Penduduk', villagersHint: 'di akun pemain', available: 'Tersedia', availableHint: 'penduduk siap bekerja',
    historian: 'Sejarawan', historianHint: 'jumlah terverifikasi', medallion: 'Medali', medallionHint: 'jumlah terverifikasi',
    tent: 'Tenda', tentYes: 'ada di akun pemain', tentNo: 'tidak ada di akun pemain', trust: 'Kepercayaan', trustHint: 'riwayat kepercayaan belum tersedia',
    sectionsSticker: 'BAGIAN', sectionsMeta: 'RAK', sectionsTitle: 'Bagian laboratorium', sectionsSub: 'langkah selanjutnya',
    friends: 'Teman dan tetangga', seasonVip: 'Tiket musim dan VIP',
    accessSticker: 'AKSES', accessMeta: 'PANEL', accessTitle: 'Hak istimewa', accessSub: 'status akses di jaringan',
    rebirthSticker: 'TAHAP AKHIR', rebirthMeta: 'DINONAKTIFKAN', rebirthTitle: 'Kelahiran kembali', rebirthSub: 'pengaturan ulang progres belum tersedia',
    rebirthNote: 'Kelahiran kembali belum tersedia: jaringan belum dapat mengatur ulang semua progres dalam satu tindakan.', rebirthDisabled: 'Kelahiran kembali belum tersedia',
    teamSticker: 'ALAT TIM', teamMeta: 'UNTUK TIM', sandbox: 'Simulasi ekonomi', agent: 'Agen perdagangan', activity: 'Riwayat aktivitas', monitor: 'Pemantau ekonomi', gallery: 'Galeri perangkat',
  },
  fil: {
    guest: 'Bisita', guestSticker: 'BISITA', operator: 'TAGAPAGPATAKBO', noWallet: 'WALANG WALLET',
    connect: 'Ikonekta ang wallet para makita ang kalagayan ng player sa blockchain.', reading: 'Binabasa ang kalagayan ng player sa network…', unknown: 'Hindi makuha sa network ang kalagayan ng player. Hindi pa alam ang mga halaga.', source: 'Binasa mula sa player account sa blockchain',
    villagers: 'Mga residente', villagersHint: 'sa player account', available: 'Magagamit', availableHint: 'mga residenteng handang magtrabaho',
    historian: 'Mga historyador', historianHint: 'nakumpirmang bilang', medallion: 'Mga medalyon', medallionHint: 'nakumpirmang bilang',
    tent: 'Tolda', tentYes: 'nasa player account', tentNo: 'wala sa player account', trust: 'Tiwala', trustHint: 'wala pang kasaysayan ng tiwala',
    sectionsSticker: 'MGA BAHAGI', sectionsMeta: 'ISTANTE', sectionsTitle: 'Mga bahagi ng laboratoryo', sectionsSub: 'saan pupunta ngayon',
    friends: 'Mga kaibigan at kapitbahay', seasonVip: 'Season pass at VIP',
    accessSticker: 'PAGPASOK', accessMeta: 'TALAAN', accessTitle: 'Mga pribilehiyo', accessSub: 'kalagayan ng access sa network',
    rebirthSticker: 'HULING YUGTO', rebirthMeta: 'NAKASARA', rebirthTitle: 'Muling pagsilang', rebirthSub: 'hindi pa maaaring i-reset ang pag-usad',
    rebirthNote: 'Hindi pa maaaring muling magsilang: hindi pa kayang i-reset ng network ang buong pag-usad sa isang hakbang.', rebirthDisabled: 'Hindi pa maaaring muling pagsilang',
    teamSticker: 'GAMIT NG KOPONAN', teamMeta: 'PARA SA KOPONAN', sandbox: 'Simulasyon ng ekonomiya', agent: 'Ahente sa kalakalan', activity: 'Talaan ng gawain', monitor: 'Tagasubaybay ng ekonomiya', gallery: 'Galeriya ng mga aparato',
  },
};
