import type { Language } from './translations';

type Copy = {
  intro: string; connect: string; toolsLoading: string; toolsUnavailable: string; noTools: string; openCapsules: string;
  select: string; maxRarity: string; unknownRarity: string; prepareFor: string; mintReady: string;
  prepare: string; preparing: string; mintMissing: string; mintPrepared: string; clearMint: string;
  quoteLoading: string; quoteUnavailable: string; quoteChanged: string; mintsLoading: string; mintsUnavailable: string;
  balancesLoading: string; balancesUnavailable: string; missingMint: string;
  insufficient: string; available: string; required: string; maxTier: string;
  forging: string; forged: string; failed: string; price: string; skrNote: string;
  forge: string; lastQuote: string;
};
export const craftCopy: Record<Language, Copy> = {
  ru: {
    intro: 'Путь кузнеца: прежний инструмент сгорает, чтобы создать следующий уровень редкости. Стоимость шести ресурсов растёт с каждой ковкой.',
    connect: 'Подключите кошелёк — кнопка в шапке', toolsLoading: 'Читаем инструменты…', toolsUnavailable: 'Не удалось прочитать инструменты из сети', noTools: 'Нет доступных инструментов для улучшения', openCapsules: 'Открыть капсулы',
    select: '1. Выберите инструмент для переплавки', maxRarity: 'Максимальная редкость', unknownRarity: 'Неизвестная редкость', prepareFor: '2. Подготовьте новый минт для {rarity}', mintReady: 'Минт готов',
    prepare: 'Подготовить новый минт', preparing: 'Готовим новый минт…', mintMissing: 'Новый минт не вернулся из сети', mintPrepared: 'Минт готов', clearMint: 'Сбросить подготовленный минт',
    quoteLoading: 'Рассчитываем стоимость улучшения…', quoteUnavailable: 'Не удалось подтвердить стоимость улучшения в сети. Создание заблокировано.', quoteChanged: 'Стоимость изменилась. Проверьте новую котировку перед подтверждением.', mintsLoading: 'Читаем адреса ресурсов…', mintsUnavailable: 'Адреса ресурсов недоступны из сети. Создание заблокировано.',
    balancesLoading: 'Читаем балансы ресурсов…', balancesUnavailable: 'Балансы ресурсов недоступны из сети. Создание заблокировано.', missingMint: 'Нет подтверждённого адреса ресурса',
    insufficient: 'Недостаточно {resource}', available: 'есть', required: 'нужно', maxTier: 'Максимальный уровень редкости',
    forging: 'Куём инструмент…', forged: 'Выкован инструмент', failed: 'Операция не выполнена', price: '3. Стоимость улучшения',
    skrNote: 'Скидка SKR отключена: ресурс SKR ещё не настроен в сети. Синтез расходует полную стоимость MIND.',
    forge: 'Выковать {rarity}', lastQuote: 'Котировка перед подтверждением (фактическое списание — в транзакции)',
  },
  en: {
    intro: 'The smith’s path: the old tool is burned to forge the next rarity. The cost of six resources rises with each craft.',
    connect: 'Connect your wallet using the button in the header', toolsLoading: 'Loading tools…', toolsUnavailable: 'Could not load tools from the network', noTools: 'No tools available for an upgrade', openCapsules: 'Open capsules',
    select: '1. Select a tool to melt down', maxRarity: 'Maximum rarity', unknownRarity: 'Unknown rarity', prepareFor: '2. Prepare a new mint for {rarity}', mintReady: 'Mint ready',
    prepare: 'Prepare a new mint', preparing: 'Preparing a new mint…', mintMissing: 'No mint was returned by the network', mintPrepared: 'Mint ready', clearMint: 'Clear prepared mint',
    quoteLoading: 'Calculating upgrade cost…', quoteUnavailable: 'Could not verify the upgrade cost on the network. Crafting is locked.', quoteChanged: 'The cost changed. Review the new quote before confirming.', mintsLoading: 'Loading resource addresses…', mintsUnavailable: 'Resource addresses unavailable from the network. Crafting is locked.',
    balancesLoading: 'Loading resource balances…', balancesUnavailable: 'Resource balances unavailable from the network. Crafting is locked.', missingMint: 'No verified resource address for',
    insufficient: 'Not enough {resource}', available: 'available', required: 'required', maxTier: 'Maximum rarity reached',
    forging: 'Forging tool…', forged: 'Tool forged', failed: 'Operation failed', price: '3. Upgrade cost',
    skrNote: 'The SKR discount is disabled: SKR is not configured on-chain. Crafting charges the full MIND cost.',
    forge: 'Forge {rarity}', lastQuote: 'Quote before confirmation (see the transaction for the actual cost)',
  },
  pt: {
    intro: 'O caminho do ferreiro: a ferramenta antiga é consumida para forjar a próxima raridade. O custo de seis recursos aumenta a cada criação.',
    connect: 'Conecte a carteira pelo botão no topo', toolsLoading: 'Carregando ferramentas…', toolsUnavailable: 'Não foi possível carregar as ferramentas da rede', noTools: 'Nenhuma ferramenta disponível para melhoria', openCapsules: 'Abrir cápsulas',
    select: '1. Escolha a ferramenta que será consumida', maxRarity: 'Raridade máxima', unknownRarity: 'Raridade desconhecida', prepareFor: '2. Prepare um novo mint para {rarity}', mintReady: 'Mint pronto',
    prepare: 'Preparar novo mint', preparing: 'Preparando novo mint…', mintMissing: 'A rede não retornou um mint', mintPrepared: 'Mint pronto', clearMint: 'Limpar mint preparado',
    quoteLoading: 'Calculando custo da melhoria…', quoteUnavailable: 'Não foi possível confirmar o custo na rede. A criação está bloqueada.', quoteChanged: 'O custo mudou. Confira a nova cotação antes de confirmar.', mintsLoading: 'Carregando endereços dos recursos…', mintsUnavailable: 'Endereços dos recursos indisponíveis na rede. A criação está bloqueada.',
    balancesLoading: 'Carregando saldos dos recursos…', balancesUnavailable: 'Saldos dos recursos indisponíveis na rede. A criação está bloqueada.', missingMint: 'Sem endereço verificado para',
    insufficient: '{resource} insuficiente', available: 'disponível', required: 'necessário', maxTier: 'Raridade máxima alcançada',
    forging: 'Forjando ferramenta…', forged: 'Ferramenta forjada', failed: 'A operação falhou', price: '3. Custo da melhoria',
    skrNote: 'O desconto SKR está desativado: o recurso ainda não está configurado na rede. A criação consome o custo integral de MIND.',
    forge: 'Forjar {rarity}', lastQuote: 'Cotação antes da confirmação (o consumo real consta na transação)',
  },
  es: {
    intro: 'El camino del herrero: la herramienta anterior se consume para forjar la siguiente rareza. El costo de los seis recursos aumenta con cada fabricación.',
    connect: 'Conecta tu cartera con el botón superior', toolsLoading: 'Cargando herramientas…', toolsUnavailable: 'No se pudieron cargar las herramientas de la red', noTools: 'No hay herramientas disponibles para mejorar', openCapsules: 'Abrir cápsulas',
    select: '1. Elige la herramienta que se consumirá', maxRarity: 'Rareza máxima', unknownRarity: 'Rareza desconocida', prepareFor: '2. Prepara un nuevo mint para {rarity}', mintReady: 'Mint preparado',
    prepare: 'Preparar nuevo mint', preparing: 'Preparando nuevo mint…', mintMissing: 'La red no devolvió ningún mint', mintPrepared: 'Mint preparado', clearMint: 'Borrar mint preparado',
    quoteLoading: 'Calculando el costo de la mejora…', quoteUnavailable: 'No se pudo confirmar el costo en la red. La fabricación está bloqueada.', quoteChanged: 'El costo cambió. Revisa la nueva cotización antes de confirmar.', mintsLoading: 'Cargando direcciones de recursos…', mintsUnavailable: 'Direcciones de recursos no disponibles en la red. La fabricación está bloqueada.',
    balancesLoading: 'Cargando saldos de recursos…', balancesUnavailable: 'Saldos de recursos no disponibles en la red. La fabricación está bloqueada.', missingMint: 'Sin dirección verificada para',
    insufficient: 'Falta {resource}', available: 'disponible', required: 'necesario', maxTier: 'Se alcanzó la rareza máxima',
    forging: 'Forjando herramienta…', forged: 'Herramienta forjada', failed: 'La operación falló', price: '3. Costo de la mejora',
    skrNote: 'El descuento SKR está desactivado: el recurso aún no se ha configurado en la red. La fabricación consume el costo íntegro de MIND.',
    forge: 'Forjar {rarity}', lastQuote: 'Cotización anterior a la confirmación (consulta el consumo real en la transacción)',
  },
  vi: {
    intro: 'Con đường thợ rèn: công cụ cũ bị tiêu hao để tạo ra bậc hiếm tiếp theo. Chi phí sáu tài nguyên tăng theo mỗi lần chế tạo.',
    connect: 'Kết nối ví bằng nút trên đầu trang', toolsLoading: 'Đang tải công cụ…', toolsUnavailable: 'Không thể tải công cụ từ mạng', noTools: 'Không có công cụ để nâng cấp', openCapsules: 'Mở hộp vật phẩm',
    select: '1. Chọn công cụ sẽ bị tiêu hao', maxRarity: 'Độ hiếm tối đa', unknownRarity: 'Chưa rõ độ hiếm', prepareFor: '2. Chuẩn bị mint mới cho bậc {rarity}', mintReady: 'Đã chuẩn bị mint',
    prepare: 'Chuẩn bị mint mới', preparing: 'Đang chuẩn bị mint mới…', mintMissing: 'Mạng không trả về mint mới', mintPrepared: 'Đã chuẩn bị mint', clearMint: 'Xóa mint đã chuẩn bị',
    quoteLoading: 'Đang tính chi phí nâng cấp…', quoteUnavailable: 'Không thể xác nhận chi phí từ mạng. Chưa thể chế tạo.', quoteChanged: 'Chi phí đã thay đổi. Hãy xem giá mới trước khi xác nhận.', mintsLoading: 'Đang tải địa chỉ tài nguyên…', mintsUnavailable: 'Không thể tải địa chỉ tài nguyên từ mạng. Chưa thể chế tạo.',
    balancesLoading: 'Đang tải số dư tài nguyên…', balancesUnavailable: 'Không thể tải số dư tài nguyên từ mạng. Chưa thể chế tạo.', missingMint: 'Chưa có địa chỉ được xác nhận cho',
    insufficient: 'Không đủ {resource}', available: 'hiện có', required: 'cần', maxTier: 'Đã đạt độ hiếm tối đa',
    forging: 'Đang rèn công cụ…', forged: 'Đã rèn công cụ', failed: 'Thao tác thất bại', price: '3. Chi phí nâng cấp',
    skrNote: 'Chưa bật giảm giá SKR: tài nguyên SKR chưa được cấu hình trên mạng. Chế tạo vẫn tiêu hao toàn bộ MIND.',
    forge: 'Rèn bậc {rarity}', lastQuote: 'Giá dự kiến trước khi xác nhận (xem giao dịch để biết số đã trừ)',
  },
  id: {
    intro: 'Jalan pandai besi: peralatan lama dihabiskan untuk membuat tingkat kelangkaan berikutnya. Biaya enam sumber daya meningkat setiap kali merakit.',
    connect: 'Hubungkan dompet dengan tombol di bagian atas', toolsLoading: 'Memuat peralatan…', toolsUnavailable: 'Tidak dapat memuat peralatan dari jaringan', noTools: 'Belum ada peralatan yang dapat ditingkatkan', openCapsules: 'Buka kapsul',
    select: '1. Pilih peralatan yang akan dilebur', maxRarity: 'Kelangkaan maksimum', unknownRarity: 'Kelangkaan belum diketahui', prepareFor: '2. Siapkan mint baru untuk {rarity}', mintReady: 'Mint siap',
    prepare: 'Siapkan mint baru', preparing: 'Menyiapkan mint baru…', mintMissing: 'Jaringan tidak mengembalikan mint', mintPrepared: 'Mint siap', clearMint: 'Hapus mint yang disiapkan',
    quoteLoading: 'Menghitung biaya peningkatan…', quoteUnavailable: 'Biaya tidak dapat diverifikasi dari jaringan. Perakitan terkunci.', quoteChanged: 'Biaya berubah. Tinjau harga baru sebelum mengonfirmasi.', mintsLoading: 'Memuat alamat sumber daya…', mintsUnavailable: 'Alamat sumber daya tidak tersedia dari jaringan. Perakitan terkunci.',
    balancesLoading: 'Memuat saldo sumber daya…', balancesUnavailable: 'Saldo sumber daya tidak tersedia dari jaringan. Perakitan terkunci.', missingMint: 'Alamat sumber daya belum terverifikasi untuk',
    insufficient: '{resource} tidak mencukupi', available: 'tersedia', required: 'dibutuhkan', maxTier: 'Kelangkaan maksimum tercapai',
    forging: 'Merakit peralatan…', forged: 'Peralatan dibuat', failed: 'Tindakan gagal', price: '3. Biaya peningkatan',
    skrNote: 'Diskon SKR dinonaktifkan: SKR belum dikonfigurasi di jaringan. Perakitan memakai biaya MIND penuh.',
    forge: 'Rakit {rarity}', lastQuote: 'Perkiraan sebelum konfirmasi (lihat transaksi untuk biaya sebenarnya)',
  },
  fil: {
    intro: 'Landas ng panday: ginagamit ang lumang kagamitan upang gawin ang susunod na antas ng pambihira. Tumataas ang halaga ng anim na yaman sa bawat paggawa.',
    connect: 'Ikonekta ang wallet gamit ang pindutan sa itaas', toolsLoading: 'Kinukuha ang mga kagamitan…', toolsUnavailable: 'Hindi makuha ang mga kagamitan sa network', noTools: 'Wala pang kagamitang maaaring pahusayin', openCapsules: 'Buksan ang mga kapsula',
    select: '1. Piliin ang kagamitang gagamitin', maxRarity: 'Pinakamataas na antas', unknownRarity: 'Hindi alam ang antas ng pambihira', prepareFor: '2. Maghanda ng bagong mint para sa {rarity}', mintReady: 'Handa na ang mint',
    prepare: 'Maghanda ng bagong mint', preparing: 'Inihahanda ang bagong mint…', mintMissing: 'Walang mint na ibinalik ang network', mintPrepared: 'Handa na ang mint', clearMint: 'Alisin ang inihandang mint',
    quoteLoading: 'Kinukuwenta ang halaga ng pagpapahusay…', quoteUnavailable: 'Hindi makumpirma ang halaga sa network. Naka-lock ang paggawa.', quoteChanged: 'Nagbago ang halaga. Tingnan muna ang bagong tantiya bago kumpirmahin.', mintsLoading: 'Kinukuha ang mga address ng yaman…', mintsUnavailable: 'Hindi makuha sa network ang mga address ng yaman. Naka-lock ang paggawa.',
    balancesLoading: 'Kinukuha ang balanse ng yaman…', balancesUnavailable: 'Hindi makuha sa network ang mga balanse ng yaman. Naka-lock ang paggawa.', missingMint: 'Walang kumpirmadong address para sa',
    insufficient: 'Kulang ang {resource}', available: 'mayroon', required: 'kailangan', maxTier: 'Naabot na ang pinakamataas na antas',
    forging: 'Ginagawa ang kagamitan…', forged: 'Nagawa ang kagamitan', failed: 'Nabigo ang gawain', price: '3. Halaga ng pagpapahusay',
    skrNote: 'Nakasara ang diskuwentong SKR: hindi pa naka-configure ang SKR sa network. Buong halaga ng MIND ang gagamitin sa paggawa.',
    forge: 'Gawin ang {rarity}', lastQuote: 'Tantiyang halaga bago kumpirmahin (tingnan ang transaksyon para sa aktuwal na nagamit)',
  },
};
