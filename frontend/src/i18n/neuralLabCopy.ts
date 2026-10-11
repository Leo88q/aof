import type { Language } from './translations';

type NeuralLabCopy = {
  title: string; loading: string; connectWallet: string; networkUnavailable: string; retry: string;
  empty: string; ready: string; available: string; seederRequired: string;
  neuron: string; cost: string; energy: string; starting: string; error: string;
  networkError: string; missingNeuron: string; missingSynapse: string; missingSeeder: string;
  startFailed: string; collectFailed: string;
  tile: (index: number) => string;
  activateIn: (index: number) => string;
  startButton: (count: number) => string;
  started: (count: number, index: number) => string;
  collected: (index: number) => string;
};

// The product copy describes canonical NeuroForge resources and lab cells; no
// historical farming labels or resource aliases are accepted as UI identifiers.
export const neuralLabCopy: Record<Language, NeuralLabCopy> = {
  ru: {
    title: 'Нейронная лаборатория', loading: 'Читаем состояние лаборатории…', connectWallet: 'Подключите кошелёк, чтобы запустить синтез образцов', networkUnavailable: 'Состояние лаборатории недоступно в сети. Повторите попытку позже.', retry: 'Прочитать ячейки снова', empty: 'Сеть не вернула лабораторные ячейки.', ready: 'Получить', available: 'Свободна', seederRequired: 'Нужен инструмент для сбора', neuron: 'Нейрон', cost: 'Стоимость', energy: 'энергия', starting: 'Запускаем…', error: 'Ошибка', networkError: 'Ошибка сети', missingNeuron: 'Ресурс NEURON не найден в реестре сети.', missingSynapse: 'Ресурс SYNAPSE не найден в сети.', missingSeeder: 'Инструмент для сбора не найден в инвентаре.', startFailed: 'Не удалось запустить синтез образцов', collectFailed: 'Не удалось получить образцы',
    tile: index => `Лабораторная ячейка ${index}`, activateIn: index => `Активировать ячейку ${index}`, startButton: count => `Запустить синтез ${count} нейронов`, started: (count, index) => `Синтез ${count} нейронов запущен в ячейке ${index}!`, collected: index => `Получение образца из ячейки ${index} завершено!`,
  },
  en: {
    title: 'Neural laboratory', loading: 'Loading laboratory state…', connectWallet: 'Connect your wallet to start a sample run', networkUnavailable: 'Laboratory state is unavailable from the network. Try again later.', retry: 'Read the cells again', empty: 'The network returned no laboratory cells.', ready: 'Collect', available: 'Available', seederRequired: 'A collection tool is required', neuron: 'Neuron', cost: 'Cost', energy: 'energy', starting: 'Starting…', error: 'Error', networkError: 'Network error', missingNeuron: 'NEURON was not found in the network registry.', missingSynapse: 'SYNAPSE was not found on the network.', missingSeeder: 'No collection tool was found in your inventory.', startFailed: 'Could not start the sample run', collectFailed: 'Could not collect the sample',
    tile: index => `Laboratory cell ${index}`, activateIn: index => `Activate cell ${index}`, startButton: count => `Start a run with ${count} neurons`, started: (count, index) => `A run with ${count} neurons started in cell ${index}!`, collected: index => `Sample collection from cell ${index} is complete!`,
  },
  pt: {
    title: 'Laboratório neural', loading: 'Carregando o estado do laboratório…', connectWallet: 'Conecte sua carteira para iniciar uma execução de amostras', networkUnavailable: 'O estado do laboratório está indisponível na rede. Tente novamente mais tarde.', retry: 'Ler as células novamente', empty: 'A rede não retornou células de laboratório.', ready: 'Coletar', available: 'Disponível', seederRequired: 'É necessária uma ferramenta de coleta', neuron: 'Neurônio', cost: 'Custo', energy: 'de energia', starting: 'Iniciando…', error: 'Erro', networkError: 'Erro de rede', missingNeuron: 'NEURON não foi encontrado no registro da rede.', missingSynapse: 'SYNAPSE não foi encontrado na rede.', missingSeeder: 'Ferramenta de coleta não encontrada no inventário.', startFailed: 'Não foi possível iniciar a execução', collectFailed: 'Não foi possível coletar a amostra',
    tile: index => `Célula de laboratório ${index}`, activateIn: index => `Ativar célula ${index}`, startButton: count => `Iniciar execução com ${count} neurônios`, started: (count, index) => `Execução com ${count} neurônios iniciada na célula ${index}!`, collected: index => `Coleta da amostra na célula ${index} concluída!`,
  },
  es: {
    title: 'Laboratorio neuronal', loading: 'Cargando el estado del laboratorio…', connectWallet: 'Conecta tu cartera para iniciar una ejecución de muestras', networkUnavailable: 'El estado del laboratorio no está disponible en la red. Inténtalo de nuevo más tarde.', retry: 'Leer las celdas de nuevo', empty: 'La red no devolvió celdas de laboratorio.', ready: 'Recoger', available: 'Disponible', seederRequired: 'Hace falta una herramienta de recolección', neuron: 'Neurona', cost: 'Coste', energy: 'de energía', starting: 'Iniciando…', error: 'Error', networkError: 'Error de red', missingNeuron: 'NEURON no se encontró en el registro de la red.', missingSynapse: 'SYNAPSE no se encontró en la red.', missingSeeder: 'No se encontró una herramienta de recolección en el inventario.', startFailed: 'No se pudo iniciar la ejecución', collectFailed: 'No se pudo recoger la muestra',
    tile: index => `Célula de laboratorio ${index}`, activateIn: index => `Activar célula ${index}`, startButton: count => `Iniciar ejecución con ${count} neuronas`, started: (count, index) => `¡Ejecución de ${count} neuronas iniciada en la célula ${index}!`, collected: index => `¡Recogida de la muestra en la célula ${index} completada!`,
  },
  vi: {
    title: 'Phòng thí nghiệm nơ-ron', loading: 'Đang tải trạng thái phòng thí nghiệm…', connectWallet: 'Kết nối ví để bắt đầu một lượt xử lý mẫu', networkUnavailable: 'Không thể đọc trạng thái phòng thí nghiệm từ mạng. Hãy thử lại sau.', retry: 'Đọc lại các ô', empty: 'Mạng chưa trả về ô phòng thí nghiệm nào.', ready: 'Thu nhận', available: 'Sẵn sàng', seederRequired: 'Cần công cụ thu nhận', neuron: 'Nơ-ron', cost: 'Chi phí', energy: 'năng lượng', starting: 'Đang bắt đầu…', error: 'Lỗi', networkError: 'Lỗi mạng', missingNeuron: 'Không tìm thấy NEURON trong danh mục của mạng.', missingSynapse: 'Không tìm thấy SYNAPSE trên mạng.', missingSeeder: 'Không tìm thấy công cụ thu nhận trong kho.', startFailed: 'Không thể bắt đầu lượt xử lý mẫu', collectFailed: 'Không thể thu nhận mẫu',
    tile: index => `Ô phòng thí nghiệm ${index}`, activateIn: index => `Kích hoạt ô ${index}`, startButton: count => `Bắt đầu xử lý ${count} nơ-ron`, started: (count, index) => `Đã bắt đầu xử lý ${count} nơ-ron tại ô ${index}!`, collected: index => `Đã thu nhận mẫu từ ô ${index}!`,
  },
  id: {
    title: 'Laboratorium neural', loading: 'Memuat keadaan laboratorium…', connectWallet: 'Hubungkan dompet untuk memulai pemrosesan sampel', networkUnavailable: 'Keadaan laboratorium tidak tersedia dari jaringan. Coba lagi nanti.', retry: 'Baca ulang sel', empty: 'Jaringan tidak mengembalikan sel laboratorium.', ready: 'Kumpulkan', available: 'Tersedia', seederRequired: 'Perlu alat pengumpulan', neuron: 'Neuron', cost: 'Biaya', energy: 'energi', starting: 'Memulai…', error: 'Kesalahan', networkError: 'Gangguan jaringan', missingNeuron: 'NEURON tidak ditemukan dalam daftar jaringan.', missingSynapse: 'SYNAPSE tidak ditemukan di jaringan.', missingSeeder: 'Alat pengumpulan tidak ditemukan dalam inventaris.', startFailed: 'Gagal memulai pemrosesan sampel', collectFailed: 'Gagal mengumpulkan sampel',
    tile: index => `Sel laboratorium ${index}`, activateIn: index => `Aktifkan sel ${index}`, startButton: count => `Mulai pemrosesan ${count} neuron`, started: (count, index) => `Pemrosesan ${count} neuron dimulai di sel ${index}!`, collected: index => `Pengumpulan sampel dari sel ${index} selesai!`,
  },
  fil: {
    title: 'Neural laboratory', loading: 'Kinukuha ang kalagayan ng laboratoryo…', connectWallet: 'Ikonekta ang wallet para simulan ang pagproseso ng sample', networkUnavailable: 'Hindi makuha ang kalagayan ng laboratoryo mula sa network. Subukan muli mamaya.', retry: 'Basahin muli ang mga cell', empty: 'Walang ibinalik na laboratory cell ang network.', ready: 'Kunin', available: 'Handa', seederRequired: 'Kailangan ng kagamitan sa pagkuha', neuron: 'Neuron', cost: 'Gastos', energy: 'enerhiya', starting: 'Sinisimulan…', error: 'Aberya', networkError: 'Problema sa network', missingNeuron: 'Hindi makita ang NEURON sa talaan ng network.', missingSynapse: 'Hindi makita ang SYNAPSE sa network.', missingSeeder: 'Walang kagamitan sa pagkuha sa imbentaryo.', startFailed: 'Hindi nasimulan ang pagproseso ng sample', collectFailed: 'Hindi nakuha ang sample',
    tile: index => `Laboratory cell ${index}`, activateIn: index => `I-activate ang cell ${index}`, startButton: count => `Simulan ang pagproseso ng ${count} neuron`, started: (count, index) => `Sinimulan ang pagproseso ng ${count} neuron sa cell ${index}!`, collected: index => `Tapos na ang pagkuha ng sample mula sa cell ${index}!`,
  },
};
