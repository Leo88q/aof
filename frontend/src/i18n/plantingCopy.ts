import type { Language } from './translations';

type PlantingCopy = {
  title: string; loading: string; connectWallet: string; networkUnavailable: string;
  empty: string; ready: string; available: string; seederRequired: string;
  seed: string; cost: string; energy: string; planting: string; error: string;
  networkError: string; missingNeuron: string; missingSynapse: string; missingSeeder: string;
  plantFailed: string; harvestFailed: string;
  well: (index: number) => string;
  plantIn: (index: number) => string;
  plantButton: (count: number) => string;
  planted: (count: number, index: number) => string;
  harvested: (index: number) => string;
};

// Only the client-owned status messages are translated. Errors returned by a
// wallet or RPC remain verbatim: inventing a "successful" translation would
// mask a failed or rejected on-chain operation.
export const plantingCopy: Record<Language, PlantingCopy> = {
  ru: {
    title: 'Культивация образцов', loading: 'Читаем состояние участка…', connectWallet: 'Подключите кошелёк, чтобы засеять образцы', networkUnavailable: 'Состояние участка недоступно из сети. Повторите попытку позже.', empty: 'Сеть не вернула ни одной лунки.', ready: 'Снять', available: 'Свободна', seederRequired: 'Нужен инструмент для съёма', seed: 'Нейрон', cost: 'Стоимость', energy: 'энергия', planting: 'Засеваем…', error: 'Ошибка', networkError: 'Ошибка сети', missingNeuron: 'Ресурс NEURON не найден в реестре сети.', missingSynapse: 'Ресурс SYNAPSE не найден в сети.', missingSeeder: 'Инструмент для съёма не найден в инвентаре.', plantFailed: 'Не удалось засеять образцы', harvestFailed: 'Не удалось снять культуру',
    well: index => `Лунка ${index}`, plantIn: index => `Засев в лунку ${index}`, plantButton: count => `Внести ${count} нейронов`, planted: (count, index) => `Засеяно ${count} образцов в лунке ${index}!`, harvested: index => `Съём из лунки ${index} завершён!`,
  },
  en: {
    title: 'Sample cultivation', loading: 'Loading plot state…', connectWallet: 'Connect your wallet to plant samples', networkUnavailable: 'The plot state is unavailable from the network. Try again later.', empty: 'The network returned no wells.', ready: 'Harvest', available: 'Empty', seederRequired: 'A harvesting tool is required', seed: 'Neuron', cost: 'Cost', energy: 'energy', planting: 'Planting…', error: 'Error', networkError: 'Network error', missingNeuron: 'NEURON was not found in the network registry.', missingSynapse: 'SYNAPSE was not found on the network.', missingSeeder: 'No harvesting tool was found in your inventory.', plantFailed: 'Could not plant the samples', harvestFailed: 'Could not harvest the samples',
    well: index => `Well ${index}`, plantIn: index => `Plant in well ${index}`, plantButton: count => `Plant ${count} neurons`, planted: (count, index) => `Planted ${count} samples in well ${index}!`, harvested: index => `Harvested from well ${index}!`,
  },
  pt: {
    title: 'Cultivo de amostras', loading: 'Carregando estado do terreno…', connectWallet: 'Conecte sua carteira para cultivar amostras', networkUnavailable: 'O estado do terreno está indisponível na rede. Tente novamente mais tarde.', empty: 'A rede não retornou nenhuma cavidade.', ready: 'Coletar', available: 'Livre', seederRequired: 'É preciso uma ferramenta de coleta', seed: 'Neurônio', cost: 'Custo', energy: 'de energia', planting: 'Cultivando…', error: 'Erro', networkError: 'Erro de rede', missingNeuron: 'NEURON não foi encontrado no registro da rede.', missingSynapse: 'SYNAPSE não foi encontrado na rede.', missingSeeder: 'Ferramenta de coleta não encontrada no inventário.', plantFailed: 'Não foi possível cultivar as amostras', harvestFailed: 'Não foi possível coletar as amostras',
    well: index => `Cavidade ${index}`, plantIn: index => `Cultivo na cavidade ${index}`, plantButton: count => `Cultivar ${count} neurônios`, planted: (count, index) => `${count} amostras cultivadas na cavidade ${index}!`, harvested: index => `Coleta da cavidade ${index} concluída!`,
  },
  es: {
    title: 'Cultivo de muestras', loading: 'Cargando el estado de la parcela…', connectWallet: 'Conecta tu cartera para cultivar muestras', networkUnavailable: 'El estado de la parcela no está disponible en la red. Inténtalo de nuevo más tarde.', empty: 'La red no devolvió ninguna cavidad.', ready: 'Recolectar', available: 'Libre', seederRequired: 'Hace falta una herramienta de recolección', seed: 'Neurona', cost: 'Coste', energy: 'de energía', planting: 'Cultivando…', error: 'Error', networkError: 'Error de red', missingNeuron: 'NEURON no se encontró en el registro de la red.', missingSynapse: 'SYNAPSE no se encontró en la red.', missingSeeder: 'No se encontró una herramienta de recolección en el inventario.', plantFailed: 'No se pudieron cultivar las muestras', harvestFailed: 'No se pudieron recolectar las muestras',
    well: index => `Cavidad ${index}`, plantIn: index => `Cultivo en la cavidad ${index}`, plantButton: count => `Cultivar ${count} neuronas`, planted: (count, index) => `¡${count} muestras cultivadas en la cavidad ${index}!`, harvested: index => `¡Recolección completada en la cavidad ${index}!`,
  },
  vi: {
    title: 'Nuôi cấy mẫu', loading: 'Đang tải trạng thái khu đất…', connectWallet: 'Kết nối ví để nuôi cấy mẫu', networkUnavailable: 'Không thể đọc trạng thái khu đất từ mạng. Hãy thử lại sau.', empty: 'Mạng chưa trả về ô nuôi cấy nào.', ready: 'Thu hoạch', available: 'Còn trống', seederRequired: 'Cần công cụ thu hoạch', seed: 'Nơ-ron', cost: 'Chi phí', energy: 'năng lượng', planting: 'Đang nuôi cấy…', error: 'Lỗi', networkError: 'Lỗi mạng', missingNeuron: 'Không tìm thấy NEURON trong danh mục của mạng.', missingSynapse: 'Không tìm thấy SYNAPSE trên mạng.', missingSeeder: 'Không tìm thấy công cụ thu hoạch trong kho.', plantFailed: 'Không thể nuôi cấy mẫu', harvestFailed: 'Không thể thu hoạch mẫu',
    well: index => `Ô ${index}`, plantIn: index => `Nuôi cấy trong ô ${index}`, plantButton: count => `Nuôi cấy ${count} nơ-ron`, planted: (count, index) => `Đã nuôi cấy ${count} mẫu trong ô ${index}!`, harvested: index => `Đã thu hoạch từ ô ${index}!`,
  },
  id: {
    title: 'Kultivasi sampel', loading: 'Memuat keadaan lahan…', connectWallet: 'Hubungkan dompet untuk menanam sampel', networkUnavailable: 'Keadaan lahan tidak tersedia dari jaringan. Coba lagi nanti.', empty: 'Jaringan tidak mengembalikan petak tanam.', ready: 'Panen', available: 'Kosong', seederRequired: 'Perlu alat panen', seed: 'Neuron', cost: 'Biaya', energy: 'energi', planting: 'Menanam…', error: 'Kesalahan', networkError: 'Gangguan jaringan', missingNeuron: 'NEURON tidak ditemukan dalam daftar jaringan.', missingSynapse: 'SYNAPSE tidak ditemukan di jaringan.', missingSeeder: 'Alat panen tidak ditemukan dalam inventaris.', plantFailed: 'Gagal menanam sampel', harvestFailed: 'Gagal memanen sampel',
    well: index => `Petak ${index}`, plantIn: index => `Tanam di petak ${index}`, plantButton: count => `Tanam ${count} neuron`, planted: (count, index) => `${count} sampel ditanam di petak ${index}!`, harvested: index => `Panen dari petak ${index} selesai!`,
  },
  fil: {
    title: 'Pagpapalago ng sample', loading: 'Kinukuha ang kalagayan ng lote…', connectWallet: 'Ikonekta ang wallet para makapagpalago ng sample', networkUnavailable: 'Hindi makuha ang kalagayan ng lote mula sa network. Subukan muli mamaya.', empty: 'Walang ibinalik na taniman ang network.', ready: 'Anihin', available: 'Bakante', seederRequired: 'Kailangan ng kagamitan sa pag-ani', seed: 'Neuron', cost: 'Gastos', energy: 'enerhiya', planting: 'Nagtatanim…', error: 'Aberya', networkError: 'Problema sa network', missingNeuron: 'Hindi makita ang NEURON sa talaan ng network.', missingSynapse: 'Hindi makita ang SYNAPSE sa network.', missingSeeder: 'Walang kagamitan sa pag-ani sa imbentaryo.', plantFailed: 'Hindi naitanim ang mga sample', harvestFailed: 'Hindi naani ang mga sample',
    well: index => `Taniman ${index}`, plantIn: index => `Magtanim sa taniman ${index}`, plantButton: count => `Magtanim ng ${count} neuron`, planted: (count, index) => `Naitanim ang ${count} sample sa taniman ${index}!`, harvested: index => `Natapos ang pag-ani sa taniman ${index}!`,
  },
};
