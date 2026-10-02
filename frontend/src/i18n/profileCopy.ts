import type { Language } from './translations';

type Copy = {
  guest: string; guestSticker: string; operator: string; noWallet: string;
  connect: string; reading: string; unknown: string; source: string;
  playerMissing: string; initPlayer: string; initPlayerNote: string; initPlayerConfirm: string;
  initPlayerPreparing: string; initPlayerPrepared: string; initPlayerFailed: string; initPlayerPending: string;
  initPlayerSuccess: string; refreshQuote: string; retryRead: string;
  quoteRent: (amount: string) => string; quoteNetworkFee: (amount: string) => string; quoteMax: (amount: string) => string;
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
    playerMissing: 'Профиль игрока в сети ещё не создан.', initPlayer: 'Создать профиль игрока', initPlayerNote: 'Профиль создаётся отдельной on-chain инструкцией. Игровых токенов: 0. Сетевые расходы и rent оплачиваете вы.', initPlayerConfirm: 'Проверить и подписать создание профиля',
    initPlayerPreparing: 'Готовим ограниченную смету…', initPlayerPrepared: 'Смета привязана к транзакции. Проверьте расходы, затем подпишите её в кошельке.', initPlayerFailed: 'Не удалось подготовить или отправить создание профиля.', initPlayerPending: 'Транзакция отправлена; проверяем состояние профиля.',
    initPlayerSuccess: 'Профиль игрока создан.', refreshQuote: 'Обновить смету', retryRead: 'Проверить профиль ещё раз',
    quoteRent: (amount) => `Rent сейчас: ${amount}`, quoteNetworkFee: (amount) => `Сетевая комиссия: ${amount}`, quoteMax: (amount) => `Максимальные сетевые расходы и rent: ${amount}`,
    villagers: 'Жители', villagersHint: 'в аккаунте игрока', available: 'Доступны', availableHint: 'жители, готовые к работе',
    historian: 'Историки', historianHint: 'подтверждённый счётчик', medallion: 'Медальоны', medallionHint: 'подтверждённый счётчик',
    tent: 'Палатка', tentYes: 'есть в аккаунте игрока', tentNo: 'нет в аккаунте игрока', trust: 'Доверие', trustHint: 'архив доверия ещё недоступен',
    sectionsSticker: 'РАЗДЕЛЫ', sectionsMeta: 'СТЕЛЛАЖ', sectionsTitle: 'Разделы лаборатории', sectionsSub: 'куда идти дальше',
    friends: 'Друзья и соседи', seasonVip: 'Пасс эпохи и VIP',
    accessSticker: 'ДОСТУП', accessMeta: 'ПАНЕЛЬ', accessTitle: 'Привилегии', accessSub: 'состояние доступа в сети',
    rebirthSticker: 'ЭНДГЕЙМ', rebirthMeta: 'ПАНЕЛЬ', rebirthTitle: 'Перерождение', rebirthSub: 'полный сброс и постоянный бонус',
    rebirthNote: 'Перерождение выполняет одну транзакцию: сброс прогресса сезона, сжигание излишков и запись постоянного бонуса. Цена, кулдаун и список излишков читаются из сети.', rebirthDisabled: 'Перерождение недоступно',
    teamSticker: 'СЛУЖЕБНОЕ', teamMeta: 'ДЛЯ КОМАНДЫ', sandbox: 'Песочница экономики', agent: 'Торговый агент', activity: 'Журнал действий', monitor: 'Монитор экономики', gallery: 'Палитра приборов',
  },
  en: {
    guest: 'Guest', guestSticker: 'GUEST', operator: 'OPERATOR', noWallet: 'NO WALLET',
    connect: 'Connect a wallet to see your on-chain player state.', reading: 'Reading your player state from the network…', unknown: 'Player state is unavailable from the network. Its values are unknown.', source: 'Read from the on-chain player account',
    playerMissing: 'The on-chain player profile has not been created yet.', initPlayer: 'Create player profile', initPlayerNote: 'The profile is created by a separate on-chain instruction. In-game tokens: 0. You pay network fees and rent.', initPlayerConfirm: 'Review and sign profile creation',
    initPlayerPreparing: 'Preparing a bounded cost quote…', initPlayerPrepared: 'The quote is bound to this transaction. Review the costs, then sign in your wallet.', initPlayerFailed: 'Could not prepare or submit profile creation.', initPlayerPending: 'Transaction submitted; checking the player profile.',
    initPlayerSuccess: 'Player profile created.', refreshQuote: 'Refresh quote', retryRead: 'Check profile again',
    quoteRent: (amount) => `Rent due now: ${amount}`, quoteNetworkFee: (amount) => `Network fee: ${amount}`, quoteMax: (amount) => `Maximum network fee and rent: ${amount}`,
    villagers: 'Residents', villagersHint: 'in the player account', available: 'Available', availableHint: 'residents ready to work',
    historian: 'Historians', historianHint: 'verified counter', medallion: 'Medallions', medallionHint: 'verified counter',
    tent: 'Tent', tentYes: 'present in the player account', tentNo: 'not present in the player account', trust: 'Trust', trustHint: 'trust history not yet available',
    sectionsSticker: 'SECTIONS', sectionsMeta: 'RACK', sectionsTitle: 'Laboratory sections', sectionsSub: 'where to go next',
    friends: 'Friends and neighbors', seasonVip: 'Season pass and VIP',
    accessSticker: 'ACCESS', accessMeta: 'PANEL', accessTitle: 'Privileges', accessSub: 'network access status',
    rebirthSticker: 'ENDGAME', rebirthMeta: 'PANEL', rebirthTitle: 'Rebirth', rebirthSub: 'full reset and a permanent bonus',
    rebirthNote: 'Rebirth runs one transaction: it resets season progress, burns the surplus and records the permanent bonus. Price, cooldown and the surplus list are read from the network.', rebirthDisabled: 'Rebirth unavailable',
    teamSticker: 'TEAM TOOLS', teamMeta: 'FOR THE TEAM', sandbox: 'Economy sandbox', agent: 'Trading agent', activity: 'Activity log', monitor: 'Economy monitor', gallery: 'Device gallery',
  },
  pt: {
    guest: 'Visitante', guestSticker: 'VISITANTE', operator: 'OPERADOR', noWallet: 'SEM CARTEIRA',
    connect: 'Conecte uma carteira para ver seu estado de jogador na rede.', reading: 'Consultando seu estado de jogador na rede…', unknown: 'O estado do jogador está indisponível na rede. Seus valores são desconhecidos.', source: 'Dados da conta do jogador na rede',
    playerMissing: 'O perfil de jogador na rede ainda não foi criado.', initPlayer: 'Criar perfil de jogador', initPlayerNote: 'O perfil é criado por uma instrução separada na rede. Tokens do jogo: 0. Você paga as taxas de rede e o rent.', initPlayerConfirm: 'Revisar e assinar a criação do perfil',
    initPlayerPreparing: 'Preparando uma cotação de custo limitada…', initPlayerPrepared: 'A cotação está vinculada a esta transação. Revise os custos e assine na carteira.', initPlayerFailed: 'Não foi possível preparar ou enviar a criação do perfil.', initPlayerPending: 'Transação enviada; verificando o perfil.',
    initPlayerSuccess: 'Perfil de jogador criado.', refreshQuote: 'Atualizar cotação', retryRead: 'Verificar perfil novamente',
    quoteRent: (amount) => `Rent devido agora: ${amount}`, quoteNetworkFee: (amount) => `Taxa de rede: ${amount}`, quoteMax: (amount) => `Taxa de rede e rent máximos: ${amount}`,
    villagers: 'Moradores', villagersHint: 'na conta do jogador', available: 'Disponíveis', availableHint: 'moradores prontos para trabalhar',
    historian: 'Historiadores', historianHint: 'contador verificado', medallion: 'Medalhões', medallionHint: 'contador verificado',
    tent: 'Tenda', tentYes: 'presente na conta do jogador', tentNo: 'não consta na conta do jogador', trust: 'Confiança', trustHint: 'histórico de confiança ainda indisponível',
    sectionsSticker: 'SEÇÕES', sectionsMeta: 'ESTANTE', sectionsTitle: 'Seções do laboratório', sectionsSub: 'para onde ir agora',
    friends: 'Amigos e vizinhos', seasonVip: 'Passe da época e VIP',
    accessSticker: 'ACESSO', accessMeta: 'PAINEL', accessTitle: 'Privilégios', accessSub: 'estado do acesso na rede',
    rebirthSticker: 'ETAPA FINAL', rebirthMeta: 'PAINEL', rebirthTitle: 'Renascimento', rebirthSub: 'reinício total e bônus permanente',
    rebirthNote: 'O renascimento executa uma transação: reinicia o progresso da temporada, queima o excedente e registra o bônus permanente. Preço, espera e lista de excedente vêm da rede.', rebirthDisabled: 'Renascimento indisponível',
    teamSticker: 'FERRAMENTAS', teamMeta: 'PARA A EQUIPE', sandbox: 'Simulador da economia', agent: 'Agente comercial', activity: 'Histórico de ações', monitor: 'Monitor da economia', gallery: 'Galeria de dispositivos',
  },
  es: {
    guest: 'Visitante', guestSticker: 'VISITANTE', operator: 'OPERADOR', noWallet: 'SIN CARTERA',
    connect: 'Conecta una cartera para ver tu estado de jugador en la red.', reading: 'Consultando tu estado de jugador en la red…', unknown: 'El estado del jugador no está disponible en la red. Sus valores son desconocidos.', source: 'Datos de la cuenta del jugador en la red',
    playerMissing: 'El perfil de jugador en la red todavía no está creado.', initPlayer: 'Crear perfil de jugador', initPlayerNote: 'El perfil se crea con una instrucción independiente en la cadena. Tokens del juego: 0. Tú pagas las comisiones de red y el rent.', initPlayerConfirm: 'Revisar y firmar la creación del perfil',
    initPlayerPreparing: 'Preparando una cotización de coste limitada…', initPlayerPrepared: 'La cotización está vinculada a esta transacción. Revisa los costes y firma en tu cartera.', initPlayerFailed: 'No se pudo preparar o enviar la creación del perfil.', initPlayerPending: 'Transacción enviada; comprobando el perfil.',
    initPlayerSuccess: 'Perfil de jugador creado.', refreshQuote: 'Actualizar cotización', retryRead: 'Volver a comprobar el perfil',
    quoteRent: (amount) => `Rent actual: ${amount}`, quoteNetworkFee: (amount) => `Comisión de red: ${amount}`, quoteMax: (amount) => `Máximo de comisión de red y rent: ${amount}`,
    villagers: 'Habitantes', villagersHint: 'en la cuenta del jugador', available: 'Disponibles', availableHint: 'habitantes listos para trabajar',
    historian: 'Historiadores', historianHint: 'contador verificado', medallion: 'Medallones', medallionHint: 'contador verificado',
    tent: 'Tienda', tentYes: 'figura en la cuenta del jugador', tentNo: 'no figura en la cuenta del jugador', trust: 'Confianza', trustHint: 'historial de confianza aún no disponible',
    sectionsSticker: 'SECCIONES', sectionsMeta: 'ESTANTE', sectionsTitle: 'Secciones del laboratorio', sectionsSub: 'adónde ir después',
    friends: 'Amigos y vecinos', seasonVip: 'Pase de temporada y VIP',
    accessSticker: 'ACCESO', accessMeta: 'PANEL', accessTitle: 'Privilegios', accessSub: 'estado del acceso en la red',
    rebirthSticker: 'FASE FINAL', rebirthMeta: 'PANEL', rebirthTitle: 'Renacimiento', rebirthSub: 'reinicio total y bono permanente',
    rebirthNote: 'El renacimiento ejecuta una transacción: reinicia el progreso de la temporada, quema el excedente y registra el bono permanente. El precio, la espera y la lista de excedente se leen de la red.', rebirthDisabled: 'Renacimiento no disponible',
    teamSticker: 'HERRAMIENTAS', teamMeta: 'PARA EL EQUIPO', sandbox: 'Simulador económico', agent: 'Agente comercial', activity: 'Registro de actividad', monitor: 'Monitor económico', gallery: 'Galería de dispositivos',
  },
  vi: {
    guest: 'Khách', guestSticker: 'KHÁCH', operator: 'NGƯỜI VẬN HÀNH', noWallet: 'CHƯA KẾT NỐI VÍ',
    connect: 'Kết nối ví để xem trạng thái người chơi trên chuỗi.', reading: 'Đang đọc trạng thái người chơi từ mạng…', unknown: 'Không thể đọc trạng thái người chơi từ mạng. Chưa xác định được các chỉ số.', source: 'Đọc từ tài khoản người chơi trên chuỗi',
    playerMissing: 'Hồ sơ người chơi trên chuỗi chưa được tạo.', initPlayer: 'Tạo hồ sơ người chơi', initPlayerNote: 'Hồ sơ được tạo bằng một lệnh riêng trên chuỗi. Token trong trò chơi: 0. Bạn trả phí mạng và tiền thuê tài khoản.', initPlayerConfirm: 'Xem lại và ký tạo hồ sơ',
    initPlayerPreparing: 'Đang chuẩn bị báo giá chi phí có giới hạn…', initPlayerPrepared: 'Báo giá được gắn với giao dịch này. Hãy xem chi phí rồi ký trong ví.', initPlayerFailed: 'Không thể chuẩn bị hoặc gửi giao dịch tạo hồ sơ.', initPlayerPending: 'Đã gửi giao dịch; đang kiểm tra hồ sơ.',
    initPlayerSuccess: 'Đã tạo hồ sơ người chơi.', refreshQuote: 'Làm mới báo giá', retryRead: 'Kiểm tra hồ sơ lại',
    quoteRent: (amount) => `Tiền thuê hiện tại: ${amount}`, quoteNetworkFee: (amount) => `Phí mạng: ${amount}`, quoteMax: (amount) => `Tối đa phí mạng và tiền thuê: ${amount}`,
    villagers: 'Cư dân', villagersHint: 'trong tài khoản người chơi', available: 'Sẵn sàng', availableHint: 'cư dân sẵn sàng làm việc',
    historian: 'Sử gia', historianHint: 'số lượng đã xác minh', medallion: 'Huy chương', medallionHint: 'số lượng đã xác minh',
    tent: 'Lều', tentYes: 'có trong tài khoản người chơi', tentNo: 'không có trong tài khoản người chơi', trust: 'Độ tin cậy', trustHint: 'chưa có lịch sử độ tin cậy',
    sectionsSticker: 'CÁC MỤC', sectionsMeta: 'GIÁ ĐỠ', sectionsTitle: 'Các mục của phòng thí nghiệm', sectionsSub: 'tiếp tục từ đâu',
    friends: 'Bạn bè và hàng xóm', seasonVip: 'Vé mùa và VIP',
    accessSticker: 'QUYỀN TRUY CẬP', accessMeta: 'BẢNG', accessTitle: 'Đặc quyền', accessSub: 'trạng thái quyền trên mạng',
    rebirthSticker: 'GIAI ĐOẠN CUỐI', rebirthMeta: 'BẢNG ĐIỀU KHIỂN', rebirthTitle: 'Tái sinh', rebirthSub: 'đặt lại toàn bộ và thưởng vĩnh viễn',
    rebirthNote: 'Chưa thể tái sinh: mạng chưa hỗ trợ đặt lại toàn bộ tiến trình trong một thao tác.', rebirthDisabled: 'Chưa thể tái sinh',
    teamSticker: 'CÔNG CỤ NHÓM', teamMeta: 'DÀNH CHO NHÓM', sandbox: 'Mô phỏng kinh tế', agent: 'Đại lý giao dịch', activity: 'Nhật ký hoạt động', monitor: 'Theo dõi kinh tế', gallery: 'Bộ sưu tập thiết bị',
  },
  id: {
    guest: 'Tamu', guestSticker: 'TAMU', operator: 'OPERATOR', noWallet: 'DOMPET BELUM TERHUBUNG',
    connect: 'Hubungkan dompet untuk melihat keadaan pemain di blockchain.', reading: 'Membaca keadaan pemain dari jaringan…', unknown: 'Keadaan pemain tidak tersedia dari jaringan. Nilainya belum diketahui.', source: 'Dibaca dari akun pemain di blockchain',
    playerMissing: 'Profil pemain on-chain belum dibuat.', initPlayer: 'Buat profil pemain', initPlayerNote: 'Profil dibuat melalui instruksi on-chain terpisah. Token game: 0. Anda membayar biaya jaringan dan sewa akun.', initPlayerConfirm: 'Tinjau dan tanda tangani pembuatan profil',
    initPlayerPreparing: 'Menyiapkan kuotasi biaya berbatas…', initPlayerPrepared: 'Kuotasi terikat pada transaksi ini. Periksa biaya, lalu tanda tangani di dompet.', initPlayerFailed: 'Tidak dapat menyiapkan atau mengirim pembuatan profil.', initPlayerPending: 'Transaksi dikirim; memeriksa profil pemain.',
    initPlayerSuccess: 'Profil pemain berhasil dibuat.', refreshQuote: 'Perbarui kuotasi', retryRead: 'Periksa profil lagi',
    quoteRent: (amount) => `Sewa saat ini: ${amount}`, quoteNetworkFee: (amount) => `Biaya jaringan: ${amount}`, quoteMax: (amount) => `Maksimum biaya jaringan dan sewa: ${amount}`,
    villagers: 'Penduduk', villagersHint: 'di akun pemain', available: 'Tersedia', availableHint: 'penduduk siap bekerja',
    historian: 'Sejarawan', historianHint: 'jumlah terverifikasi', medallion: 'Medali', medallionHint: 'jumlah terverifikasi',
    tent: 'Tenda', tentYes: 'ada di akun pemain', tentNo: 'tidak ada di akun pemain', trust: 'Kepercayaan', trustHint: 'riwayat kepercayaan belum tersedia',
    sectionsSticker: 'BAGIAN', sectionsMeta: 'RAK', sectionsTitle: 'Bagian laboratorium', sectionsSub: 'langkah selanjutnya',
    friends: 'Teman dan tetangga', seasonVip: 'Tiket musim dan VIP',
    accessSticker: 'AKSES', accessMeta: 'PANEL', accessTitle: 'Hak istimewa', accessSub: 'status akses di jaringan',
    rebirthSticker: 'TAHAP AKHIR', rebirthMeta: 'PANEL', rebirthTitle: 'Kelahiran kembali', rebirthSub: 'reset penuh dan bonus permanen',
    rebirthNote: 'Kelahiran kembali berjalan dalam satu transaksi: mengatur ulang kemajuan musim, membakar kelebihan, dan mencatat bonus permanen. Harga, jeda, dan daftar kelebihan dibaca dari jaringan.', rebirthDisabled: 'Kelahiran kembali belum tersedia',
    teamSticker: 'ALAT TIM', teamMeta: 'UNTUK TIM', sandbox: 'Simulasi ekonomi', agent: 'Agen perdagangan', activity: 'Riwayat aktivitas', monitor: 'Pemantau ekonomi', gallery: 'Galeri perangkat',
  },
  fil: {
    guest: 'Bisita', guestSticker: 'BISITA', operator: 'TAGAPAGPATAKBO', noWallet: 'WALANG WALLET',
    connect: 'Ikonekta ang wallet para makita ang kalagayan ng player sa blockchain.', reading: 'Binabasa ang kalagayan ng player sa network…', unknown: 'Hindi makuha sa network ang kalagayan ng player. Hindi pa alam ang mga halaga.', source: 'Binasa mula sa player account sa blockchain',
    playerMissing: 'Hindi pa nagagawa ang on-chain na player profile.', initPlayer: 'Gumawa ng player profile', initPlayerNote: 'Ginagawa ang profile sa hiwalay na on-chain instruction. Game token: 0. Ikaw ang magbabayad ng network fee at rent.', initPlayerConfirm: 'Suriin at pirmahan ang paggawa ng profile',
    initPlayerPreparing: 'Inihahanda ang takdang quote ng gastos…', initPlayerPrepared: 'Nakaugnay ang quote sa transaksyong ito. Suriin ang gastos, saka pumirma sa wallet.', initPlayerFailed: 'Hindi naihanda o naipadala ang paggawa ng profile.', initPlayerPending: 'Naipadala ang transaksyon; sinusuri ang player profile.',
    initPlayerSuccess: 'Nagawa na ang player profile.', refreshQuote: 'I-refresh ang quote', retryRead: 'Suriin muli ang profile',
    quoteRent: (amount) => `Rent na babayaran ngayon: ${amount}`, quoteNetworkFee: (amount) => `Network fee: ${amount}`, quoteMax: (amount) => `Pinakamataas na network fee at rent: ${amount}`,
    villagers: 'Mga residente', villagersHint: 'sa player account', available: 'Magagamit', availableHint: 'mga residenteng handang magtrabaho',
    historian: 'Mga historyador', historianHint: 'nakumpirmang bilang', medallion: 'Mga medalyon', medallionHint: 'nakumpirmang bilang',
    tent: 'Tolda', tentYes: 'nasa player account', tentNo: 'wala sa player account', trust: 'Tiwala', trustHint: 'wala pang kasaysayan ng tiwala',
    sectionsSticker: 'MGA BAHAGI', sectionsMeta: 'ISTANTE', sectionsTitle: 'Mga bahagi ng laboratoryo', sectionsSub: 'saan pupunta ngayon',
    friends: 'Mga kaibigan at kapitbahay', seasonVip: 'Season pass at VIP',
    accessSticker: 'PAGPASOK', accessMeta: 'TALAAN', accessTitle: 'Mga pribilehiyo', accessSub: 'kalagayan ng access sa network',
    rebirthSticker: 'HULING YUGTO', rebirthMeta: 'PANEL', rebirthTitle: 'Muling pagsilang', rebirthSub: 'buong reset at permanenteng bonus',
    rebirthNote: 'Isang transaksyon ang muling pagsilang: ni-reset ang progreso ng panahon, sinusunog ang sobra, at naitala ang permanenteng bonus. Ang presyo, cooldown, at listahan ng sobra ay binabasa mula sa network.', rebirthDisabled: 'Hindi pa maaaring muling pagsilang',
    teamSticker: 'GAMIT NG KOPONAN', teamMeta: 'PARA SA KOPONAN', sandbox: 'Simulasyon ng ekonomiya', agent: 'Ahente sa kalakalan', activity: 'Talaan ng gawain', monitor: 'Tagasubaybay ng ekonomiya', gallery: 'Galeriya ng mga aparato',
  },
};
