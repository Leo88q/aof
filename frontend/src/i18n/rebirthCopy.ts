import type { Language } from './translations';

/**
 * [§3.4] Перерождение. Все числа — правила контракта, а не редакционный текст:
 * цена берётся из `rebirth_config`, кулдаун — оттуда же, бюджет ребёртов — до
 * `max_rebirths`, а список сжигаемых излишков подтверждает сама сеть.
 */
export type RebirthReason =
  | 'REBIRTH_PAUSED'
  | 'REBIRTH_AUTHORITY_NOT_BACKEND_KEY'
  | 'CORE_OPERATOR_NOT_BACKEND_KEY'
  | 'SEASON_NOT_INITIALIZED'
  | 'REBIRTH_NO_PLAYER_PROGRESS'
  | 'REBIRTH_SEASON_PASS_NOT_FOUND'
  | 'REBIRTH_MAX_REACHED'
  | 'REBIRTH_COOLDOWN_ACTIVE'
  | 'REBIRTH_SURPLUS_TOO_LARGE';

type Copy = {
  sticker: string; meta: string; title: string; sub: string;
  cost: string; costHint: string; generation: string; generationHint: string;
  bonus: string; bonusHint: string; budget: string; budgetHint: string;
  resets: string; resetVillagers: string; resetTent: string; resetXp: string;
  resetsNote: string; keepsNote: string;
  surplus: string; surplusHint: string; surplusEmpty: string; surplusSum: string;
  surplusVerified: string; surplusMismatch: (mint: string) => string; surplusUnknown: string;
  burnNote: (limit: number) => string;
  cooldown: (left: string) => string; ready: string;
  action: string; acting: string; noWallet: string; readFailed: string;
  confirmNote: string; doneNote: string; uncertain: string;
  reasons: Record<RebirthReason, string>;
};

const REASONS_RU: Record<RebirthReason, string> = {
  REBIRTH_PAUSED: 'Оператор приостановил перерождение — сеть принимает запрос, но платить сейчас нельзя.',
  REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'Ключ управления перерождением сменён: полный сброс должна подтвердить новая сторона, старый ключ не подпишет.',
  CORE_OPERATOR_NOT_BACKEND_KEY: 'Ключ оператора в основной программе сменён — сброс прогресса некому подтвердить.',
  SEASON_NOT_INITIALIZED: 'В сети ещё нет сезона: сбрасывать нечего, потому что прогресс сезона не начат.',
  REBIRTH_NO_PLAYER_PROGRESS: 'Аккаунта игрока в сети нет — значит, и прогресса, который сбрасывается, нет.',
  REBIRTH_SEASON_PASS_NOT_FOUND: 'Пропуска текущего сезона нет: сезон ещё не начат этим кошельком.',
  REBIRTH_MAX_REACHED: 'Достигнут предел перерождений, установленный оператором.',
  REBIRTH_COOLDOWN_ACTIVE: 'Кулдаун между перерождениями ещё не прошёл.',
  REBIRTH_SURPLUS_TOO_LARGE: 'Склада больше, чем перерождение сжигает за одну транзакцию. Сожгите часть излишков обычным сжиганием и вернитесь.',
};

export const rebirthCopy: Record<Language, Copy> = {
  ru: {
    sticker: 'ЭНДГЕЙМ', meta: 'ПОЛНЫЙ СБРОС', title: 'Перерождение', sub: 'весь прогресс сезона сбрасывается одной транзакцией',
    cost: 'Цена', costHint: 'уходит в казну игры', generation: 'Поколение', generationHint: 'из записи в сети',
    bonus: 'Постоянный бонус', bonusHint: 'накапливается за перерождения', budget: 'Ребёртов пройдено', budgetHint: 'предел задаёт оператор',
    resets: 'Что сбрасывается', resetVillagers: 'Жители', resetTent: 'Палатка', resetXp: 'Опыт сезонного пропуска',
    resetsNote: 'Сброс идёт одной инструкцией: если не проходит любая часть, не применяется ничего. Деньги за отменённую транзакцию не списываются.',
    keepsNote: 'Не сбрасывается: застейканные коллекции (историки и медальоны) — их счётчик обязан совпадать с числом NFT в хранилище.',
    surplus: 'Излишки под сжигание', surplusHint: 'остатки всех ресурсов на кошельке', surplusEmpty: 'Подтверждено сетью: излишков нет, сжигать нечего.',
    surplusSum: 'Всего к сжиганию', surplusVerified: 'Список сверен с сетью: остатки совпадают с показанными.',
    surplusMismatch: mint => `Сеть отдаёт другие остатки (${mint}), чем сервер. Перерождение заблокировано до нового чтения.`,
    surplusUnknown: 'Остатки излишков не удалось перечитать из сети — действие заблокировано, пока данные не подтверждены.',
    burnNote: limit => `За одну транзакцию сжигается не больше ${limit} ресурсных аккаунтов — предел контракта, а не настройка интерфейса.`,
    cooldown: left => `Кулдаун: следующее перерождение через ${left}.`, ready: 'Кулдаун пройден — можно перерождаться.',
    action: 'Переродиться', acting: 'Собираем транзакцию…', noWallet: 'Подключите кошелёк.',
    readFailed: 'Состояние перерождения недоступно из сети — ничего не показываем и не включаем.',
    confirmNote: 'В кошельке вы подписываете две инструкции: полный сброс и запись перерождения с оплатой. Отмена любой из них отменяет обе.',
    doneNote: 'Перерождение подтверждено сетью: прогресс сезона сброшен, излишки сожжены.', uncertain: 'Транзакция не подтверждена. Проверьте историю кошелька, прежде чем повторять.',
    reasons: REASONS_RU,
  },
  en: {
    sticker: 'ENDGAME', meta: 'FULL RESET', title: 'Rebirth', sub: 'the whole season progress resets in one transaction',
    cost: 'Price', costHint: 'goes to the game treasury', generation: 'Generation', generationHint: 'read from the on-chain record',
    bonus: 'Permanent bonus', bonusHint: 'accrues with every rebirth', budget: 'Rebirths used', budgetHint: 'the operator sets the limit',
    resets: 'What resets', resetVillagers: 'Residents', resetTent: 'Tent', resetXp: 'Season pass XP',
    resetsNote: 'The reset is a single instruction: if any part fails, nothing is applied. No money is taken for a cancelled transaction.',
    keepsNote: 'Not reset: staked collections (historians and medallions) — their counter must match the number of NFTs in the vault.',
    surplus: 'Surplus to burn', surplusHint: 'every resource balance on the wallet', surplusEmpty: 'Confirmed by the network: no surplus, nothing to burn.',
    surplusSum: 'Total to burn', surplusVerified: 'The list was checked against the network: balances match what is shown.',
    surplusMismatch: mint => `The network reports different balances (${mint}) from the server. Rebirth is blocked until a fresh read.`,
    surplusUnknown: 'Surplus balances could not be re-read from the network — the action stays blocked until the data is confirmed.',
    burnNote: limit => `One transaction burns at most ${limit} resource accounts — a contract limit, not a UI setting.`,
    cooldown: left => `Cooldown: the next rebirth is in ${left}.`, ready: 'The cooldown has passed — rebirth is available.',
    action: 'Rebirth', acting: 'Building the transaction…', noWallet: 'Connect a wallet.',
    readFailed: 'Rebirth state is unavailable from the network — nothing is shown and nothing is enabled.',
    confirmNote: 'In the wallet you sign two instructions: the full reset and the rebirth record with payment. Cancelling either cancels both.',
    doneNote: 'Rebirth confirmed on-chain: season progress reset, surplus burned.', uncertain: 'The transaction is unconfirmed. Check your wallet history before retrying.',
    reasons: {
      REBIRTH_PAUSED: 'The operator paused rebirth — the program would accept the call, but paying now is not allowed.',
      REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'The rebirth authority key changed: the new party must confirm the full reset, the old key cannot sign it.',
      CORE_OPERATOR_NOT_BACKEND_KEY: 'The core program operator key changed — nobody can co-sign the progress reset.',
      SEASON_NOT_INITIALIZED: 'There is no season on-chain yet: there is no season progress to reset.',
      REBIRTH_NO_PLAYER_PROGRESS: 'There is no player account on-chain — so there is no progress to reset.',
      REBIRTH_SEASON_PASS_NOT_FOUND: 'This wallet has no pass for the current season yet.',
      REBIRTH_MAX_REACHED: 'The operator-set rebirth limit has been reached.',
      REBIRTH_COOLDOWN_ACTIVE: 'The cooldown between rebirths has not passed yet.',
      REBIRTH_SURPLUS_TOO_LARGE: 'The stock exceeds what one rebirth transaction burns. Burn part of the surplus with the regular burn and come back.',
    },
  },
  pt: {
    sticker: 'FIM DE JOGO', meta: 'REINÍCIO TOTAL', title: 'Renascimento', sub: 'todo o progresso da temporada reinicia numa transação',
    cost: 'Preço', costHint: 'vai para a tesouraria do jogo', generation: 'Geração', generationHint: 'lida do registro on-chain',
    bonus: 'Bônus permanente', bonusHint: 'acumula a cada renascimento', budget: 'Renascimentos usados', budgetHint: 'o limite é definido pelo operador',
    resets: 'O que reinicia', resetVillagers: 'Moradores', resetTent: 'Tenda', resetXp: 'XP do passe de temporada',
    resetsNote: 'O reinício é uma só instrução: se alguma parte falhar, nada é aplicado. Nenhum valor é cobrado por transação cancelada.',
    keepsNote: 'Não reinicia: coleções em staking (historiadores e medalhões) — o contador precisa bater com o número de NFTs no cofre.',
    surplus: 'Excedente a queimar', surplusHint: 'todos os saldos de recursos da carteira', surplusEmpty: 'Confirmado pela rede: sem excedente, nada a queimar.',
    surplusSum: 'Total a queimar', surplusVerified: 'A lista foi conferida com a rede: os saldos batem com o exibido.',
    surplusMismatch: mint => `A rede informa saldos diferentes (${mint}) dos do servidor. O renascimento fica bloqueado até nova leitura.`,
    surplusUnknown: 'Não foi possível reler os saldos na rede — a ação fica bloqueada até os dados serem confirmados.',
    burnNote: limit => `Uma transação queima no máximo ${limit} contas de recursos — limite do contrato, não do aplicativo.`,
    cooldown: left => `Tempo de espera: o próximo renascimento em ${left}.`, ready: 'O tempo de espera passou — renascimento disponível.',
    action: 'Renascer', acting: 'Montando a transação…', noWallet: 'Conecte uma carteira.',
    readFailed: 'O estado do renascimento não está disponível na rede — nada é exibido nem habilitado.',
    confirmNote: 'Na carteira você assina duas instruções: o reinício total e o registro do renascimento com pagamento. Cancelar uma cancela as duas.',
    doneNote: 'Renascimento confirmado na rede: progresso da temporada reiniciado, excedente queimado.', uncertain: 'Transação não confirmada. Verifique o histórico da carteira antes de repetir.',
    reasons: {
      REBIRTH_PAUSED: 'O operador pausou o renascimento — a rede aceitaria a chamada, mas pagar agora não é permitido.',
      REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'A chave de autoridade do renascimento mudou: a nova parte precisa confirmar o reinício total.',
      CORE_OPERATOR_NOT_BACKEND_KEY: 'A chave de operador do programa principal mudou — ninguém pode coassinar o reinício.',
      SEASON_NOT_INITIALIZED: 'Ainda não há temporada na rede: não existe progresso de temporada para reiniciar.',
      REBIRTH_NO_PLAYER_PROGRESS: 'Não há conta de jogador na rede — logo, não há progresso para reiniciar.',
      REBIRTH_SEASON_PASS_NOT_FOUND: 'Esta carteira ainda não tem passe da temporada atual.',
      REBIRTH_MAX_REACHED: 'O limite de renascimentos definido pelo operador foi atingido.',
      REBIRTH_COOLDOWN_ACTIVE: 'O tempo de espera entre renascimentos ainda não passou.',
      REBIRTH_SURPLUS_TOO_LARGE: 'O estoque excede o que um renascimento queima numa transação. Queime parte do excedente e volte.',
    },
  },
  es: {
    sticker: 'FASE FINAL', meta: 'REINICIO TOTAL', title: 'Renacimiento', sub: 'todo el progreso de la temporada se reinicia en una transacción',
    cost: 'Precio', costHint: 'va a la tesorería del juego', generation: 'Generación', generationHint: 'leída del registro en la red',
    bonus: 'Bono permanente', bonusHint: 'se acumula con cada renacimiento', budget: 'Renacimientos usados', budgetHint: 'el límite lo fija el operador',
    resets: 'Qué se reinicia', resetVillagers: 'Residentes', resetTent: 'Tienda', resetXp: 'XP del pase de temporada',
    resetsNote: 'El reinicio es una sola instrucción: si falla cualquier parte, no se aplica nada. No se cobra por una transacción cancelada.',
    keepsNote: 'No se reinicia: las colecciones en staking (historiadores y medallones) — su contador debe coincidir con los NFT en la bóveda.',
    surplus: 'Excedente a quemar', surplusHint: 'todos los saldos de recursos de la cartera', surplusEmpty: 'Confirmado por la red: no hay excedente que quemar.',
    surplusSum: 'Total a quemar', surplusVerified: 'La lista se verificó contra la red: los saldos coinciden con lo mostrado.',
    surplusMismatch: mint => `La red informa saldos distintos (${mint}) a los del servidor. El renacimiento queda bloqueado hasta una nueva lectura.`,
    surplusUnknown: 'No se pudieron releer los saldos de la red — la acción queda bloqueada hasta confirmar los datos.',
    burnNote: limit => `Una transacción quema como máximo ${limit} cuentas de recursos: límite del contrato, no de la interfaz.`,
    cooldown: left => `Espera: el próximo renacimiento en ${left}.`, ready: 'La espera terminó — el renacimiento está disponible.',
    action: 'Renacer', acting: 'Armando la transacción…', noWallet: 'Conecta una cartera.',
    readFailed: 'El estado del renacimiento no está disponible en la red: no se muestra ni se habilita nada.',
    confirmNote: 'En la cartera firmas dos instrucciones: el reinicio total y el registro del renacimiento con pago. Cancelar una cancela las dos.',
    doneNote: 'Renacimiento confirmado en la red: progreso de temporada reiniciado y excedente quemado.', uncertain: 'Transacción sin confirmar. Revisa el historial de la cartera antes de repetir.',
    reasons: {
      REBIRTH_PAUSED: 'El operador pausó el renacimiento: la red aceptaría la llamada, pero pagar ahora no está permitido.',
      REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'La clave de autoridad del renacimiento cambió: la nueva parte debe confirmar el reinicio total.',
      CORE_OPERATOR_NOT_BACKEND_KEY: 'La clave de operador del programa principal cambió: nadie puede cofirmar el reinicio.',
      SEASON_NOT_INITIALIZED: 'Aún no hay temporada en la red: no existe progreso de temporada que reiniciar.',
      REBIRTH_NO_PLAYER_PROGRESS: 'No hay cuenta de jugador en la red, así que no hay progreso que reiniciar.',
      REBIRTH_SEASON_PASS_NOT_FOUND: 'Esta cartera aún no tiene pase de la temporada actual.',
      REBIRTH_MAX_REACHED: 'Se alcanzó el límite de renacimientos fijado por el operador.',
      REBIRTH_COOLDOWN_ACTIVE: 'La espera entre renacimientos aún no ha pasado.',
      REBIRTH_SURPLUS_TOO_LARGE: 'El almacén supera lo que un renacimiento quema en una transacción. Quema parte del excedente y vuelve.',
    },
  },
  vi: {
    sticker: 'GIAI ĐOẠN CUỐI', meta: 'ĐẶT LẠI TOÀN BỘ', title: 'Tái sinh', sub: 'toàn bộ tiến trình mùa được đặt lại trong một giao dịch',
    cost: 'Giá', costHint: 'chuyển vào quỹ trò chơi', generation: 'Thế hệ', generationHint: 'đọc từ bản ghi trên chuỗi',
    bonus: 'Thưởng vĩnh viễn', bonusHint: 'tích lũy theo mỗi lần tái sinh', budget: 'Số lần tái sinh', budgetHint: 'giới hạn do người vận hành đặt',
    resets: 'Những gì bị đặt lại', resetVillagers: 'Cư dân', resetTent: 'Lều', resetXp: 'XP thẻ mùa',
    resetsNote: 'Việc đặt lại là một lệnh duy nhất: nếu bất kỳ phần nào thất bại, không phần nào được áp dụng. Giao dịch bị hủy không bị trừ tiền.',
    keepsNote: 'Không đặt lại: bộ sưu tập đang gửi (nhà sử học và huy chương) — số đếm phải khớp với số NFT trong kho.',
    surplus: 'Phần dư sẽ đốt', surplusHint: 'mọi số dư tài nguyên trong ví', surplusEmpty: 'Chuỗi xác nhận: không có phần dư để đốt.',
    surplusSum: 'Tổng sẽ đốt', surplusVerified: 'Danh sách đã đối chiếu với chuỗi: số dư khớp với hiển thị.',
    surplusMismatch: mint => `Chuỗi trả về số dư khác (${mint}) so với máy chủ. Tái sinh bị khóa cho đến khi đọc lại.`,
    surplusUnknown: 'Không đọc lại được số dư từ chuỗi — hành động bị khóa cho đến khi dữ liệu được xác nhận.',
    burnNote: limit => `Một giao dịch đốt tối đa ${limit} tài khoản tài nguyên — giới hạn hợp đồng, không phải cài đặt giao diện.`,
    cooldown: left => `Thời gian chờ: lần tái sinh tiếp theo sau ${left}.`, ready: 'Đã hết thời gian chờ — có thể tái sinh.',
    action: 'Tái sinh', acting: 'Đang dựng giao dịch…', noWallet: 'Hãy kết nối ví.',
    readFailed: 'Trạng thái tái sinh không có trên chuỗi — không hiển thị và không bật bất cứ thứ gì.',
    confirmNote: 'Trong ví bạn ký hai lệnh: đặt lại toàn bộ và ghi nhận tái sinh kèm thanh toán. Hủy một lệnh là hủy cả hai.',
    doneNote: 'Tái sinh đã được chuỗi xác nhận: tiến trình mùa được đặt lại, phần dư đã đốt.', uncertain: 'Giao dịch chưa được xác nhận. Kiểm tra lịch sử ví trước khi lặp lại.',
    reasons: {
      REBIRTH_PAUSED: 'Người vận hành đã tạm dừng tái sinh — chuỗi sẽ nhận lệnh, nhưng hiện không được phép thanh toán.',
      REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'Khóa quản trị tái sinh đã đổi: bên mới phải xác nhận việc đặt lại toàn bộ.',
      CORE_OPERATOR_NOT_BACKEND_KEY: 'Khóa vận hành của chương trình chính đã đổi — không ai đồng ký được việc đặt lại.',
      SEASON_NOT_INITIALIZED: 'Chuỗi chưa có mùa: không có tiến trình mùa để đặt lại.',
      REBIRTH_NO_PLAYER_PROGRESS: 'Chuỗi chưa có tài khoản người chơi — nên không có tiến trình để đặt lại.',
      REBIRTH_SEASON_PASS_NOT_FOUND: 'Ví này chưa có thẻ của mùa hiện tại.',
      REBIRTH_MAX_REACHED: 'Đã đạt giới hạn tái sinh do người vận hành đặt.',
      REBIRTH_COOLDOWN_ACTIVE: 'Thời gian chờ giữa các lần tái sinh chưa kết thúc.',
      REBIRTH_SURPLUS_TOO_LARGE: 'Kho vượt quá mức một giao dịch tái sinh đốt được. Hãy đốt bớt phần dư rồi quay lại.',
    },
  },
  id: {
    sticker: 'AKHIR PERMAINAN', meta: 'RESET PENUH', title: 'Kelahiran kembali', sub: 'seluruh kemajuan musim direset dalam satu transaksi',
    cost: 'Harga', costHint: 'masuk ke kas permainan', generation: 'Generasi', generationHint: 'dibaca dari catatan on-chain',
    bonus: 'Bonus permanen', bonusHint: 'terkumpul setiap kelahiran kembali', budget: 'Kelahiran terpakai', budgetHint: 'batas ditetapkan operator',
    resets: 'Yang direset', resetVillagers: 'Penduduk', resetTent: 'Tenda', resetXp: 'XP pas musim',
    resetsNote: 'Reset adalah satu instruksi: bila ada bagian gagal, tidak ada yang diterapkan. Transaksi yang dibatalkan tidak memotong dana.',
    keepsNote: 'Tidak direset: koleksi yang di-stake (sejarawan dan medali) — penghitungnya harus sama dengan jumlah NFT di vault.',
    surplus: 'Kelebihan yang dibakar', surplusHint: 'semua saldo sumber daya di dompet', surplusEmpty: 'Dikonfirmasi jaringan: tidak ada kelebihan untuk dibakar.',
    surplusSum: 'Total yang dibakar', surplusVerified: 'Daftar sudah dicek ke jaringan: saldo sama dengan yang ditampilkan.',
    surplusMismatch: mint => `Jaringan melaporkan saldo berbeda (${mint}) dari server. Kelahiran kembali diblokir sampai pembacaan baru.`,
    surplusUnknown: 'Saldo kelebihan tidak bisa dibaca ulang dari jaringan — aksi diblokir sampai data terkonfirmasi.',
    burnNote: limit => `Satu transaksi membakar paling banyak ${limit} akun sumber daya — batas kontrak, bukan pengaturan antarmuka.`,
    cooldown: left => `Jeda: kelahiran kembali berikutnya dalam ${left}.`, ready: 'Jeda selesai — kelahiran kembali tersedia.',
    action: 'Lahir kembali', acting: 'Menyusun transaksi…', noWallet: 'Hubungkan dompet.',
    readFailed: 'Status kelahiran kembali tidak tersedia dari jaringan — tidak ada yang ditampilkan atau diaktifkan.',
    confirmNote: 'Di dompet Anda menandatangani dua instruksi: reset penuh dan catatan kelahiran kembali beserta pembayaran. Membatalkan satu membatalkan keduanya.',
    doneNote: 'Kelahiran kembali terkonfirmasi di jaringan: kemajuan musim direset, kelebihan dibakar.', uncertain: 'Transaksi belum terkonfirmasi. Periksa riwayat dompet sebelum mengulang.',
    reasons: {
      REBIRTH_PAUSED: 'Operator menjeda kelahiran kembali — program akan menerima panggilan, tetapi pembayaran kini tidak diizinkan.',
      REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'Kunci otoritas kelahiran kembali berubah: pihak baru harus mengonfirmasi reset penuh.',
      CORE_OPERATOR_NOT_BACKEND_KEY: 'Kunci operator program inti berubah — tidak ada yang bisa ikut menandatangani reset.',
      SEASON_NOT_INITIALIZED: 'Belum ada musim di jaringan: tidak ada kemajuan musim untuk direset.',
      REBIRTH_NO_PLAYER_PROGRESS: 'Tidak ada akun pemain di jaringan, jadi tidak ada kemajuan yang direset.',
      REBIRTH_SEASON_PASS_NOT_FOUND: 'Dompet ini belum memiliki pas musim saat ini.',
      REBIRTH_MAX_REACHED: 'Batas kelahiran kembali yang ditetapkan operator sudah tercapai.',
      REBIRTH_COOLDOWN_ACTIVE: 'Jeda antar kelahiran kembali belum selesai.',
      REBIRTH_SURPLUS_TOO_LARGE: 'Stok melebihi yang bisa dibakar satu transaksi kelahiran kembali. Bakar sebagian kelebihan lalu kembali.',
    },
  },
  fil: {
    sticker: 'DULO NG LARO', meta: 'BUONG RESET', title: 'Muling pagsilang', sub: 'buong progres ng panahon ay ni-reset sa isang transaksyon',
    cost: 'Presyo', costHint: 'napupunta sa treasury ng laro', generation: 'Henerasyon', generationHint: 'binasa mula sa on-chain na rekord',
    bonus: 'Permanenteng bonus', bonusHint: 'nadadagdag sa bawat muling pagsilang', budget: 'Nagamit na pagsilang', budgetHint: 'ang limitasyon ay itinakda ng operator',
    resets: 'Ano ang ni-reset', resetVillagers: 'Mamamayan', resetTent: 'Tolda', resetXp: 'XP ng panahon',
    resetsNote: 'Isang instruksyon lamang ang reset: kung may bahaging mabigo, walang naiaaplay. Walang sinisingil sa kanseladong transaksyon.',
    keepsNote: 'Hindi ni-reset: mga naka-stake na koleksyon (historyador at medalyon) — dapat tumugma ang bilang sa mga NFT sa vault.',
    surplus: 'Sobrang bubunutin', surplusHint: 'lahat ng balanse ng resource sa wallet', surplusEmpty: 'Kinumpirma ng network: walang sobra, walang bubunutin.',
    surplusSum: 'Kabuuang bubunutin', surplusVerified: 'Nasuri ang listahan sa network: tugma ang balanse sa ipinakita.',
    surplusMismatch: mint => `Iba ang balanseng iniuulat ng network (${mint}) kaysa sa server. Naka-block ang muling pagsilang hanggang sa bagong pagbasa.`,
    surplusUnknown: 'Hindi mabasa muli ang mga balanse mula sa network — naka-block ang aksyon hanggang makumpirma ang datos.',
    burnNote: limit => `Isang transaksyon ang bumabura ng hindi hihigit sa ${limit} resource account — limitasyon ng kontrata, hindi ng UI.`,
    cooldown: left => `Cooldown: ang susunod na pagsilang sa ${left}.`, ready: 'Tapos na ang cooldown — maaari nang magsilang.',
    action: 'Muling ipanganak', acting: 'Binubuo ang transaksyon…', noWallet: 'Ikonekta ang wallet.',
    readFailed: 'Hindi available sa network ang estado ng muling pagsilang — walang ipinapakita at walang binubuksan.',
    confirmNote: 'Sa wallet, dalawang instruksyon ang pipirmahan mo: ang buong reset at ang rekord ng pagsilang kasama ang bayad. Kanselado ang isa, kanselado ang dalawa.',
    doneNote: 'Kinumpirma ng network ang muling pagsilang: ni-reset ang progreso ng panahon, nasunog ang sobra.', uncertain: 'Hindi kumpirmado ang transaksyon. Tingnan ang history ng wallet bago ulitin.',
    reasons: {
      REBIRTH_PAUSED: 'Inihinto ng operator ang muling pagsilang — tatanggapin ng network ang tawag, ngunit hindi pinapayagan ang bayad ngayon.',
      REBIRTH_AUTHORITY_NOT_BACKEND_KEY: 'Nagbago ang authority key ng pagsilang: ang bagong panig ang dapat kumpirmahin ang buong reset.',
      CORE_OPERATOR_NOT_BACKEND_KEY: 'Nagbago ang operator key ng pangunahing programa — walang makakasamang pumirma sa reset.',
      SEASON_NOT_INITIALIZED: 'Wala pa sa network ang panahon: walang progresong panahon na ni-reset.',
      REBIRTH_NO_PLAYER_PROGRESS: 'Walang player account sa network, kaya walang progresong ni-reset.',
      REBIRTH_SEASON_PASS_NOT_FOUND: 'Wala pang pass ng kasalukuyang panahon ang wallet na ito.',
      REBIRTH_MAX_REACHED: 'Naabot na ang limitasyon ng pagsilang na itinakda ng operator.',
      REBIRTH_COOLDOWN_ACTIVE: 'Hindi pa tapos ang cooldown sa pagitan ng mga pagsilang.',
      REBIRTH_SURPLUS_TOO_LARGE: 'Lumalampas ang imbak sa kayang sunugin ng isang transaksyon. Sunugin ang bahagi ng sobra at bumalik.',
    },
  },
};
