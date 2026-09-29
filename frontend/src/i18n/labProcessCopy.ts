import type { Language } from './translations';

type ProcessCopy = {
  sizes: { small: string; medium: string; large: string };
  connectWallet: string; loading: string; unavailable: string; missingMints: string;
  missingResultMint: string; failed: string; networkError: string;
  output: string; duration: string; energy: string; hours: (count: number) => string;
  mill: { title: string; starting: string; start: string; running: string; ready: string; collect: string; started: (input: number, output: number) => string; collected: (amount: number) => string };
  oven: { title: string; fuel: string; start: string; starting: string; running: string; ready: string; collect: string; started: (input: number, output: number) => string; collected: (amount: number) => string };
};

// The selected batch/fuel and numbers come from the on-chain recipe, not this
// catalog. Only UI copy is translated; wallet/RPC errors stay verbatim.
export const labProcessCopy: Record<Language, ProcessCopy> = {
  ru: {
    sizes: { small: 'Малая', medium: 'Средняя', large: 'Большая' }, connectWallet: 'Подключите кошелёк', loading: 'Читаем состояние из сети…', unavailable: 'Не удалось прочитать состояние из сети. Повторите попытку позже.', missingMints: 'Ресурсы не найдены в реестре сети.', missingResultMint: 'Выходной ресурс не найден в сети.', failed: 'Операция отклонена программой.', networkError: 'Ошибка сети.', output: 'На выходе', duration: 'Время', energy: 'Энергия', hours: count => `${count} ч`,
    mill: { title: 'Сепарация', starting: 'Запуск…', start: 'Запустить сепарацию', running: 'Сепарация идёт…', ready: 'Сигнал получен', collect: 'Собрать сигнал', started: (input, output) => `Сепарация запущена: ${input} синапсов → ${output} сигнала`, collected: amount => `Собрано ${amount} сигнала!` },
    oven: { title: 'Обучение моделей', fuel: 'Топливо', start: 'Начать обучение', starting: 'Запуск…', running: 'Модель обучается…', ready: 'Модель обучена', collect: 'Собрать модель', started: (input, output) => `Обучение запущено: ${input} сигнала → ${output} модели`, collected: amount => `Собрано ${amount} модели!` },
  },
  en: {
    sizes: { small: 'Small', medium: 'Medium', large: 'Large' }, connectWallet: 'Connect your wallet', loading: 'Reading on-chain state…', unavailable: 'Could not read the on-chain state. Try again later.', missingMints: 'Resources were not found in the network registry.', missingResultMint: 'The output resource was not found on the network.', failed: 'The operation was rejected.', networkError: 'Network error.', output: 'Output', duration: 'Duration', energy: 'Energy', hours: count => `${count} h`,
    mill: { title: 'Separation', starting: 'Starting…', start: 'Start separation', running: 'Separating…', ready: 'Signal ready', collect: 'Collect signal', started: (input, output) => `Separation started: ${input} synapses → ${output} signals`, collected: amount => `Collected ${amount} signals!` },
    oven: { title: 'Model training', fuel: 'Fuel', start: 'Start training', starting: 'Starting…', running: 'Training model…', ready: 'Model trained', collect: 'Collect model', started: (input, output) => `Training started: ${input} signals → ${output} models`, collected: amount => `Collected ${amount} models!` },
  },
  pt: {
    sizes: { small: 'Pequena', medium: 'Média', large: 'Grande' }, connectWallet: 'Conecte sua carteira', loading: 'Consultando a rede…', unavailable: 'Não foi possível consultar o estado na rede. Tente novamente mais tarde.', missingMints: 'Recursos não encontrados no registro da rede.', missingResultMint: 'O recurso de saída não foi encontrado na rede.', failed: 'A operação foi recusada.', networkError: 'Erro de rede.', output: 'Resultado', duration: 'Duração', energy: 'Energia', hours: count => `${count} h`,
    mill: { title: 'Separação', starting: 'Iniciando…', start: 'Iniciar separação', running: 'Separando…', ready: 'Sinal pronto', collect: 'Coletar sinal', started: (input, output) => `Separação iniciada: ${input} sinapses → ${output} sinais`, collected: amount => `${amount} sinais coletados!` },
    oven: { title: 'Treinamento de modelos', fuel: 'Combustível', start: 'Iniciar treinamento', starting: 'Iniciando…', running: 'Treinando modelo…', ready: 'Modelo treinado', collect: 'Coletar modelo', started: (input, output) => `Treinamento iniciado: ${input} sinais → ${output} modelos`, collected: amount => `${amount} modelos coletados!` },
  },
  es: {
    sizes: { small: 'Pequeña', medium: 'Mediana', large: 'Grande' }, connectWallet: 'Conecta tu cartera', loading: 'Consultando la red…', unavailable: 'No se pudo consultar el estado de la red. Inténtalo de nuevo más tarde.', missingMints: 'No se encontraron los recursos en el registro de la red.', missingResultMint: 'No se encontró el recurso de salida en la red.', failed: 'La operación fue rechazada.', networkError: 'Error de red.', output: 'Resultado', duration: 'Duración', energy: 'Energía', hours: count => `${count} h`,
    mill: { title: 'Separación', starting: 'Iniciando…', start: 'Iniciar separación', running: 'Separando…', ready: 'Señal lista', collect: 'Recoger señal', started: (input, output) => `Separación iniciada: ${input} sinapsis → ${output} señales`, collected: amount => `¡Recogidas ${amount} señales!` },
    oven: { title: 'Entrenamiento de modelos', fuel: 'Combustible', start: 'Iniciar entrenamiento', starting: 'Iniciando…', running: 'Entrenando modelo…', ready: 'Modelo entrenado', collect: 'Recoger modelo', started: (input, output) => `Entrenamiento iniciado: ${input} señales → ${output} modelos`, collected: amount => `¡Recogidos ${amount} modelos!` },
  },
  vi: {
    sizes: { small: 'Nhỏ', medium: 'Vừa', large: 'Lớn' }, connectWallet: 'Kết nối ví', loading: 'Đang đọc trạng thái trên chuỗi…', unavailable: 'Không thể đọc trạng thái từ mạng. Hãy thử lại sau.', missingMints: 'Không tìm thấy tài nguyên trong danh mục của mạng.', missingResultMint: 'Không tìm thấy tài nguyên đầu ra trên mạng.', failed: 'Thao tác bị từ chối.', networkError: 'Lỗi mạng.', output: 'Đầu ra', duration: 'Thời gian', energy: 'Năng lượng', hours: count => `${count} giờ`,
    mill: { title: 'Tách mẫu', starting: 'Đang bắt đầu…', start: 'Bắt đầu tách', running: 'Đang tách mẫu…', ready: 'Tín hiệu đã sẵn sàng', collect: 'Nhận tín hiệu', started: (input, output) => `Đã bắt đầu tách: ${input} khớp thần kinh → ${output} tín hiệu`, collected: amount => `Đã nhận ${amount} tín hiệu!` },
    oven: { title: 'Huấn luyện mô hình', fuel: 'Nhiên liệu', start: 'Bắt đầu huấn luyện', starting: 'Đang bắt đầu…', running: 'Đang huấn luyện…', ready: 'Mô hình đã hoàn tất', collect: 'Nhận mô hình', started: (input, output) => `Đã bắt đầu huấn luyện: ${input} tín hiệu → ${output} mô hình`, collected: amount => `Đã nhận ${amount} mô hình!` },
  },
  id: {
    sizes: { small: 'Kecil', medium: 'Sedang', large: 'Besar' }, connectWallet: 'Hubungkan dompet', loading: 'Membaca keadaan di blockchain…', unavailable: 'Tidak dapat membaca keadaan dari jaringan. Coba lagi nanti.', missingMints: 'Sumber daya tidak ditemukan dalam daftar jaringan.', missingResultMint: 'Sumber daya hasil tidak ditemukan di jaringan.', failed: 'Tindakan ditolak.', networkError: 'Gangguan jaringan.', output: 'Hasil', duration: 'Durasi', energy: 'Energi', hours: count => `${count} jam`,
    mill: { title: 'Pemisahan', starting: 'Memulai…', start: 'Mulai pemisahan', running: 'Sedang memisahkan…', ready: 'Sinyal siap', collect: 'Ambil sinyal', started: (input, output) => `Pemisahan dimulai: ${input} sinapsis → ${output} sinyal`, collected: amount => `${amount} sinyal diambil!` },
    oven: { title: 'Pelatihan model', fuel: 'Bahan bakar', start: 'Mulai pelatihan', starting: 'Memulai…', running: 'Sedang melatih…', ready: 'Model selesai dilatih', collect: 'Ambil model', started: (input, output) => `Pelatihan dimulai: ${input} sinyal → ${output} model`, collected: amount => `${amount} model diambil!` },
  },
  fil: {
    sizes: { small: 'Maliit', medium: 'Katamtaman', large: 'Malaki' }, connectWallet: 'Ikonekta ang wallet', loading: 'Binabasa ang kalagayan sa blockchain…', unavailable: 'Hindi mabasa ang kalagayan mula sa network. Subukan muli mamaya.', missingMints: 'Wala ang mga yaman sa talaan ng network.', missingResultMint: 'Hindi makita sa network ang yaman na dapat makuha.', failed: 'Tinanggihan ang gawain.', networkError: 'Problema sa network.', output: 'Resulta', duration: 'Tagal', energy: 'Enerhiya', hours: count => `${count} oras`,
    mill: { title: 'Paghihiwalay', starting: 'Sinisimulan…', start: 'Simulan ang paghihiwalay', running: 'Isinasagawa ang paghihiwalay…', ready: 'Handa na ang senyales', collect: 'Kunin ang senyales', started: (input, output) => `Sinimulan ang paghihiwalay: ${input} sinapsis → ${output} Signal`, collected: amount => `Nakuha ang ${amount} Signal!` },
    oven: { title: 'Pagsasanay ng modelo', fuel: 'Panggatong', start: 'Simulan ang pagsasanay', starting: 'Sinisimulan…', running: 'Sinasanay ang modelo…', ready: 'Tapos na ang modelo', collect: 'Kunin ang modelo', started: (input, output) => `Sinimulan ang pagsasanay: ${input} Signal → ${output} modelo`, collected: amount => `Nakuha ang ${amount} modelo!` },
  },
};
