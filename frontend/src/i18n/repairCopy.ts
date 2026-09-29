import type { Language } from './translations';

type Copy = {
  intro: string; readinessUnknown: string; connect: string; loadingTools: string; toolsUnavailable: string; noTools: string;
  disabled: string; choose: string; mintsMissing: string; full: string; repairing: string; repaired: string;
  debited: string; failed: string; durability: string; durabilityUnknown: string; critical: string;
  restore: string; decrease: string; increase: string; cost: string; quoteLoading: string; quoteUnavailable: string;
  repair: string; checking: string;
};

export const repairCopy: Record<Language, Copy> = {
  ru: {
    intro: 'Добыча расходует прочность. Ремонт одним действием списывает Кремний и Схему и восстанавливает инструмент. Чем выше редкость, тем дороже.',
    readinessUnknown: 'Не удалось проверить готовность ремонта: реестр сети не читается. Кнопка пока заблокирована.',
    connect: 'Подключите кошелёк, чтобы чинить инструменты', loadingTools: 'Читаем инструменты…', toolsUnavailable: 'Инструменты недоступны из сети', noTools: 'Инструментов нет — нечего чинить',
    disabled: 'Ремонт недоступен в этой версии сети', choose: 'Выберите инструмент', mintsMissing: 'В реестре сети нет адресов Кремния и Схемы', full: 'Прочность уже полная',
    repairing: 'Ремонтируем…', repaired: 'Восстановлена прочность', debited: 'Списано', failed: 'Операция не выполнена', durability: 'Прочность', durabilityUnknown: 'Прочность неизвестна', critical: ' — скоро сломается!',
    restore: 'Восстановить прочности (макс. {max})', decrease: 'Уменьшить восстановление', increase: 'Увеличить восстановление', cost: 'Стоимость ремонта', quoteLoading: 'Рассчитываем стоимость…', quoteUnavailable: 'Не удалось подтвердить стоимость ремонта в сети. Кнопка заблокирована.',
    repair: 'Починить: +{amount} прочности', checking: 'Проверяем готовность ремонта…',
  },
  en: {
    intro: 'Mining wears tools down. Repair restores durability and consumes Silicon and Circuit in a single action. Rarer tools cost more to repair.',
    readinessUnknown: 'Could not check whether repair is available: the network registry cannot be read. The button is locked.',
    connect: 'Connect your wallet to repair tools', loadingTools: 'Loading tools…', toolsUnavailable: 'Tools could not be loaded from the network', noTools: 'No tools to repair',
    disabled: 'Repair is unavailable on this network', choose: 'Select a tool', mintsMissing: 'Silicon and Circuit addresses are missing from the on-chain registry', full: 'Durability is already full',
    repairing: 'Repairing…', repaired: 'Durability restored', debited: 'Consumed', failed: 'Operation failed', durability: 'Durability', durabilityUnknown: 'Durability unknown', critical: ' — about to break!',
    restore: 'Restore durability (max. {max})', decrease: 'Restore less', increase: 'Restore more', cost: 'Repair cost', quoteLoading: 'Calculating cost…', quoteUnavailable: 'Could not verify the repair cost on the network. The button is locked.',
    repair: 'Repair: +{amount} durability', checking: 'Checking repair availability…',
  },
  pt: {
    intro: 'A extração desgasta as ferramentas. O reparo restaura a durabilidade e consome Silício e Circuito em uma única ação. Quanto mais rara a ferramenta, maior o custo.',
    readinessUnknown: 'Não foi possível verificar se o reparo está disponível: o registro da rede não responde. O botão permanece bloqueado.',
    connect: 'Conecte sua carteira para reparar ferramentas', loadingTools: 'Carregando ferramentas…', toolsUnavailable: 'Não foi possível carregar as ferramentas da rede', noTools: 'Não há ferramentas para reparar',
    disabled: 'Reparo indisponível nesta rede', choose: 'Selecione uma ferramenta', mintsMissing: 'Faltam endereços de Silício e Circuito no registro da rede', full: 'A durabilidade já está completa',
    repairing: 'Reparando…', repaired: 'Durabilidade restaurada', debited: 'Consumido', failed: 'A operação falhou', durability: 'Durabilidade', durabilityUnknown: 'Durabilidade desconhecida', critical: ' — prestes a quebrar!',
    restore: 'Restaurar durabilidade (máx. {max})', decrease: 'Restaurar menos', increase: 'Restaurar mais', cost: 'Custo do reparo', quoteLoading: 'Calculando custo…', quoteUnavailable: 'Não foi possível confirmar o custo do reparo na rede. O botão permanece bloqueado.',
    repair: 'Reparar: +{amount} de durabilidade', checking: 'Verificando disponibilidade do reparo…',
  },
  es: {
    intro: 'La extracción desgasta las herramientas. La reparación restaura la durabilidad y consume Silicio y Circuito en una sola acción. Cuanto más rara sea la herramienta, más costará.',
    readinessUnknown: 'No se pudo verificar si la reparación está disponible: el registro de la red no responde. El botón está bloqueado.',
    connect: 'Conecta tu cartera para reparar herramientas', loadingTools: 'Cargando herramientas…', toolsUnavailable: 'No se pudieron cargar las herramientas de la red', noTools: 'No hay herramientas que reparar',
    disabled: 'La reparación no está disponible en esta red', choose: 'Elige una herramienta', mintsMissing: 'Faltan las direcciones de Silicio y Circuito en el registro de la red', full: 'La durabilidad ya está completa',
    repairing: 'Reparando…', repaired: 'Durabilidad restaurada', debited: 'Consumido', failed: 'La operación falló', durability: 'Durabilidad', durabilityUnknown: 'Durabilidad desconocida', critical: ' — ¡a punto de romperse!',
    restore: 'Restaurar durabilidad (máx. {max})', decrease: 'Restaurar menos', increase: 'Restaurar más', cost: 'Costo de reparación', quoteLoading: 'Calculando costo…', quoteUnavailable: 'No se pudo verificar el costo de reparación en la red. El botón está bloqueado.',
    repair: 'Reparar: +{amount} de durabilidad', checking: 'Verificando disponibilidad de la reparación…',
  },
  vi: {
    intro: 'Khai thác làm hao mòn công cụ. Sửa chữa khôi phục độ bền và tiêu hao Silic cùng Mạch trong một thao tác. Công cụ càng hiếm thì chi phí càng cao.',
    readinessUnknown: 'Không thể kiểm tra điều kiện sửa chữa: chưa đọc được danh mục mạng. Nút vẫn bị khóa.',
    connect: 'Kết nối ví để sửa công cụ', loadingTools: 'Đang tải công cụ…', toolsUnavailable: 'Không thể tải công cụ từ mạng', noTools: 'Không có công cụ để sửa',
    disabled: 'Chưa thể sửa chữa trên mạng này', choose: 'Chọn một công cụ', mintsMissing: 'Chưa có địa chỉ Silic và Mạch trong danh mục mạng', full: 'Độ bền đã đầy',
    repairing: 'Đang sửa chữa…', repaired: 'Đã khôi phục độ bền', debited: 'Đã tiêu hao', failed: 'Thao tác thất bại', durability: 'Độ bền', durabilityUnknown: 'Chưa rõ độ bền', critical: ' — sắp hỏng!',
    restore: 'Khôi phục độ bền (tối đa {max})', decrease: 'Giảm lượng khôi phục', increase: 'Tăng lượng khôi phục', cost: 'Chi phí sửa chữa', quoteLoading: 'Đang tính chi phí…', quoteUnavailable: 'Không thể xác nhận chi phí sửa chữa từ mạng. Nút vẫn bị khóa.',
    repair: 'Sửa chữa: +{amount} độ bền', checking: 'Đang kiểm tra điều kiện sửa chữa…',
  },
  id: {
    intro: 'Penambangan mengurangi daya tahan peralatan. Perbaikan memulihkan daya tahan dan menghabiskan Silikon serta Sirkuit dalam satu tindakan. Peralatan yang lebih langka membutuhkan biaya lebih tinggi.',
    readinessUnknown: 'Tidak dapat memeriksa kesiapan perbaikan: registri jaringan tidak dapat dibaca. Tombol tetap terkunci.',
    connect: 'Hubungkan dompet untuk memperbaiki peralatan', loadingTools: 'Memuat peralatan…', toolsUnavailable: 'Tidak dapat memuat peralatan dari jaringan', noTools: 'Tidak ada peralatan untuk diperbaiki',
    disabled: 'Perbaikan belum tersedia di jaringan ini', choose: 'Pilih peralatan', mintsMissing: 'Alamat Silikon dan Sirkuit tidak ada dalam registri jaringan', full: 'Daya tahan sudah penuh',
    repairing: 'Memperbaiki…', repaired: 'Daya tahan dipulihkan', debited: 'Digunakan', failed: 'Tindakan gagal', durability: 'Daya tahan', durabilityUnknown: 'Daya tahan belum diketahui', critical: ' — hampir rusak!',
    restore: 'Pulihkan daya tahan (maks. {max})', decrease: 'Kurangi pemulihan', increase: 'Tambah pemulihan', cost: 'Biaya perbaikan', quoteLoading: 'Menghitung biaya…', quoteUnavailable: 'Biaya perbaikan tidak dapat diverifikasi dari jaringan. Tombol tetap terkunci.',
    repair: 'Perbaiki: +{amount} daya tahan', checking: 'Memeriksa kesiapan perbaikan…',
  },
  fil: {
    intro: 'Nababawasan ang tibay ng kagamitan sa pagmimina. Ibinabalik ito ng pagkukumpuni habang sabay na ginagamit ang Silikon at Sirkito. Mas mahal kumpunihin ang mas pambihirang kagamitan.',
    readinessUnknown: 'Hindi masuri kung maaari nang magkumpuni: hindi mabasa ang talaan ng network. Naka-lock ang pindutan.',
    connect: 'Ikonekta ang wallet para magkumpuni', loadingTools: 'Kinukuha ang mga kagamitan…', toolsUnavailable: 'Hindi makuha sa network ang mga kagamitan', noTools: 'Walang kagamitang makukumpuni',
    disabled: 'Hindi pa magamit ang pagkukumpuni sa network na ito', choose: 'Pumili ng kagamitan', mintsMissing: 'Wala pa sa talaan ng network ang mga address ng Silikon at Sirkito', full: 'Puno na ang tibay',
    repairing: 'Kinukumpuni…', repaired: 'Naibalik ang tibay', debited: 'Nagamit', failed: 'Nabigo ang gawain', durability: 'Tibay', durabilityUnknown: 'Hindi alam ang tibay', critical: ' — malapit nang masira!',
    restore: 'Ibalik ang tibay (hanggang {max})', decrease: 'Bawasan ang ibabalik na tibay', increase: 'Dagdagan ang ibabalik na tibay', cost: 'Halaga ng pagkukumpuni', quoteLoading: 'Kinukuwenta ang halaga…', quoteUnavailable: 'Hindi makumpirma sa network ang halaga ng pagkukumpuni. Naka-lock ang pindutan.',
    repair: 'Kumpunihin: +{amount} tibay', checking: 'Sinusuri kung maaari nang magkumpuni…',
  },
};
