import type { Language } from './translations';

type Copy = {
  loading: string; title: string; subtitle: string; snapshot: string; latest: string;
  quality: Record<'complete' | 'partial' | 'unavailable', string>;
  coverage: string; unknownQuality: string; supply: string; mintedBurned: string;
  inflation: string; crafters: string; traders: string; transactions: string; failedTransactions: string;
  updated: string; alerts: string; active: (count: number) => string; noAlerts: string;
  history: string; noSnapshots: string; readFailed: string; retry: string; actionFailed: string;
  resolve: string; severity: Record<'critical' | 'warning' | 'info', string>;
};

/** Admin-only snapshots: off-chain audit activity is not an on-chain economy ledger. */
export const economyAdminCopy: Record<Language, Copy> = {
  ru: {
    loading: 'Читаем данные экономики…', title: 'Монитор экономики', subtitle: 'Снимки и алерты сервера; не полный учёт в сети.', snapshot: 'Создать снимок', latest: 'Последний снимок',
    quality: { complete: 'поля доступны', partial: 'часть данных', unavailable: 'нет данных' },
    coverage: 'Индексатор событий не предоставляет полный учёт выпуска, сжигания и держателей. Активность берётся из серверного журнала; не используйте эти цифры как полный баланс экономики.', unknownQuality: 'Происхождение или полнота этого снимка не подтверждены.',
    supply: 'Выпуск MIND', mintedBurned: 'Выпущено / сожжено за 24 ч', inflation: 'Инфляция за 24 ч', crafters: 'Создатели за 24 ч', traders: 'Трейдеры за 24 ч', transactions: 'Транзакции за 24 ч', failedTransactions: 'Ошибки транзакций',
    updated: 'Обновлено:', alerts: 'Алерты', active: count => `Активных: ${count}`, noAlerts: 'Алертов нет в прочитанном списке', history: 'История снимков', noSnapshots: 'Снимков пока нет', readFailed: 'Не удалось прочитать снимки или алерты. Состояние неизвестно, пустой список не подтверждён.', retry: 'Повторить чтение', actionFailed: 'Запрос не выполнен. Проверьте состояние перед повтором.', resolve: 'Пометить алерт как решённый', severity: { critical: 'Критично', warning: 'Внимание', info: 'Информация' },
  },
  en: {
    loading: 'Loading economy data…', title: 'Economy monitor', subtitle: 'Server snapshots and alerts; not a full on-chain ledger.', snapshot: 'Take snapshot', latest: 'Latest snapshot',
    quality: { complete: 'supported fields available', partial: 'partial data', unavailable: 'no data' },
    coverage: 'The event indexer does not provide a full record of issuance, burns or holders. Activity comes from the server audit log; do not treat these figures as a complete economy ledger.', unknownQuality: 'This snapshot’s provenance and completeness are unverified.',
    supply: 'MIND supply', mintedBurned: 'Minted / burned in 24h', inflation: 'Inflation in 24h', crafters: 'Crafters in 24h', traders: 'Traders in 24h', transactions: 'Transactions in 24h', failedTransactions: 'Failed transactions',
    updated: 'Updated:', alerts: 'Alerts', active: count => `Active: ${count}`, noAlerts: 'No alerts in the retrieved list', history: 'Snapshot history', noSnapshots: 'No snapshots yet', readFailed: 'Could not read snapshots or alerts. Status is unknown; an empty list is not confirmed.', retry: 'Retry read', actionFailed: 'Request failed. Check the current state before trying again.', resolve: 'Mark alert as resolved', severity: { critical: 'Critical', warning: 'Warning', info: 'Information' },
  },
  pt: {
    loading: 'A carregar dados da economia…', title: 'Monitor da economia', subtitle: 'Registos e alertas do servidor; não são um balanço completo na rede.', snapshot: 'Criar registo', latest: 'Registo mais recente',
    quality: { complete: 'campos suportados disponíveis', partial: 'dados parciais', unavailable: 'sem dados' },
    coverage: 'O indexador de eventos não oferece um registo completo de emissões, queimas ou detentores. A atividade vem do registo de auditoria do servidor; não uses estes números como balanço completo da economia.', unknownQuality: 'A origem e a integridade deste registo não foram confirmadas.',
    supply: 'Oferta de MIND', mintedBurned: 'Emitido / queimado em 24 h', inflation: 'Inflação em 24 h', crafters: 'Criadores em 24 h', traders: 'Negociadores em 24 h', transactions: 'Transações em 24 h', failedTransactions: 'Transações falhadas',
    updated: 'Atualizado:', alerts: 'Alertas', active: count => `Ativos: ${count}`, noAlerts: 'Sem alertas na lista obtida', history: 'Histórico de registos', noSnapshots: 'Ainda não há registos', readFailed: 'Não foi possível ler os registos ou alertas. O estado é desconhecido; não está confirmada uma lista vazia.', retry: 'Repetir leitura', actionFailed: 'Pedido falhou. Confere o estado antes de tentares novamente.', resolve: 'Marcar alerta como resolvido', severity: { critical: 'Crítico', warning: 'Aviso', info: 'Informação' },
  },
  es: {
    loading: 'Cargando datos de la economía…', title: 'Monitor económico', subtitle: 'Instantáneas y alertas del servidor; no son un registro completo en la cadena.', snapshot: 'Crear instantánea', latest: 'Última instantánea',
    quality: { complete: 'campos disponibles', partial: 'datos parciales', unavailable: 'sin datos' },
    coverage: 'El indexador de eventos no registra por completo la emisión, la quema ni los titulares. La actividad procede del registro de auditoría del servidor; no tomes estas cifras como un balance completo de la economía.', unknownQuality: 'No se ha confirmado el origen ni la integridad de esta instantánea.',
    supply: 'Oferta de MIND', mintedBurned: 'Emitido / quemado en 24 h', inflation: 'Inflación en 24 h', crafters: 'Creadores en 24 h', traders: 'Operadores en 24 h', transactions: 'Transacciones en 24 h', failedTransactions: 'Transacciones fallidas',
    updated: 'Actualizado:', alerts: 'Alertas', active: count => `Activas: ${count}`, noAlerts: 'Sin alertas en la lista obtenida', history: 'Historial de instantáneas', noSnapshots: 'Aún no hay instantáneas', readFailed: 'No se pudieron leer las instantáneas o alertas. Se desconoce el estado; no se ha confirmado que la lista esté vacía.', retry: 'Reintentar lectura', actionFailed: 'La solicitud falló. Comprueba el estado antes de reintentar.', resolve: 'Marcar alerta como resuelta', severity: { critical: 'Crítica', warning: 'Aviso', info: 'Información' },
  },
  vi: {
    loading: 'Đang tải dữ liệu kinh tế…', title: 'Theo dõi kinh tế', subtitle: 'Bản ghi và cảnh báo của máy chủ; không phải sổ cái đầy đủ trên chuỗi.', snapshot: 'Tạo bản ghi', latest: 'Bản ghi mới nhất',
    quality: { complete: 'các trường được hỗ trợ đã có', partial: 'dữ liệu một phần', unavailable: 'không có dữ liệu' },
    coverage: 'Bộ lập chỉ mục sự kiện không ghi nhận đầy đủ việc phát hành, đốt hoặc người nắm giữ. Hoạt động lấy từ nhật ký máy chủ; đừng coi các số liệu này là toàn bộ sổ cái kinh tế.', unknownQuality: 'Chưa xác minh được nguồn gốc và độ đầy đủ của bản ghi này.',
    supply: 'Nguồn cung MIND', mintedBurned: 'Phát hành / đốt trong 24 giờ', inflation: 'Lạm phát trong 24 giờ', crafters: 'Người chế tạo trong 24 giờ', traders: 'Người giao dịch trong 24 giờ', transactions: 'Giao dịch trong 24 giờ', failedTransactions: 'Giao dịch thất bại',
    updated: 'Cập nhật:', alerts: 'Cảnh báo', active: count => `Đang hoạt động: ${count}`, noAlerts: 'Không có cảnh báo trong danh sách đã tải', history: 'Lịch sử bản ghi', noSnapshots: 'Chưa có bản ghi', readFailed: 'Không thể đọc bản ghi hoặc cảnh báo. Chưa rõ trạng thái; không thể khẳng định danh sách trống.', retry: 'Đọc lại', actionFailed: 'Yêu cầu thất bại. Hãy kiểm tra trạng thái trước khi thử lại.', resolve: 'Đánh dấu cảnh báo đã xử lý', severity: { critical: 'Nghiêm trọng', warning: 'Cảnh báo', info: 'Thông tin' },
  },
  id: {
    loading: 'Memuat data ekonomi…', title: 'Pemantau ekonomi', subtitle: 'Snapshot dan peringatan server; bukan catatan lengkap di blockchain.', snapshot: 'Buat snapshot', latest: 'Snapshot terbaru',
    quality: { complete: 'kolom yang didukung tersedia', partial: 'data sebagian', unavailable: 'data tidak tersedia' },
    coverage: 'Pengindeks peristiwa belum mencatat penerbitan, pembakaran, atau pemegang secara lengkap. Aktivitas berasal dari log audit server; jangan anggap angka ini sebagai catatan ekonomi menyeluruh.', unknownQuality: 'Asal dan kelengkapan snapshot ini belum terverifikasi.',
    supply: 'Pasokan MIND', mintedBurned: 'Dicetak / dibakar dalam 24 jam', inflation: 'Inflasi dalam 24 jam', crafters: 'Perakit dalam 24 jam', traders: 'Pedagang dalam 24 jam', transactions: 'Transaksi dalam 24 jam', failedTransactions: 'Transaksi gagal',
    updated: 'Diperbarui:', alerts: 'Peringatan', active: count => `Aktif: ${count}`, noAlerts: 'Tidak ada peringatan dalam daftar yang dimuat', history: 'Riwayat snapshot', noSnapshots: 'Belum ada snapshot', readFailed: 'Snapshot atau peringatan tidak dapat dibaca. Status belum diketahui; daftar kosong belum terkonfirmasi.', retry: 'Baca lagi', actionFailed: 'Permintaan gagal. Periksa keadaan sebelum mencoba lagi.', resolve: 'Tandai peringatan sebagai selesai', severity: { critical: 'Kritis', warning: 'Peringatan', info: 'Informasi' },
  },
  fil: {
    loading: 'Kinukuha ang datos ng ekonomiya…', title: 'Tagasubaybay ng ekonomiya', subtitle: 'Mga snapshot at alert sa server; hindi kumpletong talaan sa blockchain.', snapshot: 'Kumuha ng snapshot', latest: 'Pinakabagong snapshot',
    quality: { complete: 'may datos ang mga suportadong field', partial: 'bahagyang datos', unavailable: 'walang datos' },
    coverage: 'Hindi kumpleto sa event indexer ang tala ng paglikha at pagsunog ng token o ng mga may hawak nito. Mula sa audit log ng server ang aktibidad; huwag ituring ang mga bilang na ito bilang kumpletong tala ng ekonomiya.', unknownQuality: 'Hindi pa na-verify ang pinagmulan o kabuuan ng snapshot na ito.',
    supply: 'Supply ng MIND', mintedBurned: 'Nilikha / sinunog sa 24 oras', inflation: 'Implasyon sa 24 oras', crafters: 'Mga gumagawa sa 24 oras', traders: 'Mga trader sa 24 oras', transactions: 'Mga transaksiyon sa 24 oras', failedTransactions: 'Mga nabigong transaksiyon',
    updated: 'Na-update:', alerts: 'Mga alert', active: count => `Aktibo: ${count}`, noAlerts: 'Walang alert sa nakuhang listahan', history: 'Kasaysayan ng snapshot', noSnapshots: 'Wala pang snapshot', readFailed: 'Hindi mabasa ang mga snapshot o alert. Hindi alam ang estado; hindi kumpirmadong walang laman ang listahan.', retry: 'Basahin muli', actionFailed: 'Nabigo ang request. Suriin ang estado bago subukang muli.', resolve: 'Markahan ang alert bilang naresolba', severity: { critical: 'Kritikal', warning: 'Babala', info: 'Impormasyon' },
  },
};
