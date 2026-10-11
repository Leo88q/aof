import type { Language } from './translations';
import type { ResourceId } from './homeDetail';

/** Short editorial descriptions for all 27 catalog cards; not a claim of on-chain availability. */
export const resourceLeads: Record<Language, Record<ResourceId, string>> = {
  ru: {
    data: 'Собирается из набора данных и тратится в операциях.', circuit: 'Материал для сборки и топливо.', silicon: 'Основа конструкций и чипов.', compute: 'Топливо обучения. Собирается из схемы и набора данных.', dataset: 'Сырьё для данных, кварца, разума и вычислений.',
    neuron: 'Первое звено производственной цепочки.', synapse: 'Урожай лунок для сепарации.', signal: 'Звено между урожаем и моделью.', model: 'Результат обучения. Сгорает в печати лаборатории.', power: 'Ресурс сетевой станции.',
    blueCore: 'Собирается из схем и становится квантовым битом.', purpleCore: 'Собирается из нейронов и идёт в квантовый флюид.', redCore: 'Собирается из кремния и становится нейрочипом.', clearQuartz: 'Собирается из схем и набора данных для фотонного бита.', roseQuartz: 'Собирается из нейронов и набора данных для нано-флюида.', amberQuartz: 'Сосуд из фотонного бита. Сгорает в печати лаборатории.',
    quantumBit: 'Чип для крио-флюида.', neuralChip: 'Чип для вольт-флюида.', photonBit: 'Чип, из которого собирают янтарный сосуд.', bioChip: 'Собирается из нейронов и схем для квантового флюида.',
    cryoFluid: '+5 энергии, либо печать.', voltFluid: '+5 энергии, либо печать.', bioFluid: '+8 энергии, либо печать.', nanoFluid: '+10 энергии, либо печать.', quantumFluid: '+20 энергии, либо печать.', mind: 'Собирается из набора данных и тратится на крафт.', soulCore: 'Ядро, которое остаётся у игрока после печати лаборатории.',
  },
  en: {
    data: 'Refined from dataset and spent in operations.', circuit: 'Building material and fuel.', silicon: 'The basis of structures and chips.', compute: 'Training fuel, refined from circuit and dataset.', dataset: 'Raw material for data, quartz, mind and compute.',
    neuron: 'The first link in the production chain.', synapse: 'A harvest from the wells, ready for separation.', signal: 'The link between harvest and model.', model: 'The result of training. It is burned in the laboratory seal.', power: 'A resource from the grid station.',
    blueCore: 'Refined from circuits into a quantum bit.', purpleCore: 'Refined from neurons for quantum fluid.', redCore: 'Refined from silicon into a neural chip.', clearQuartz: 'Refined from circuits and dataset for a photon bit.', roseQuartz: 'Refined from neurons and dataset for nano fluid.', amberQuartz: 'A vessel refined from a photon bit and burned in the laboratory seal.',
    quantumBit: 'A chip used in cryo fluid.', neuralChip: 'A chip used in volt fluid.', photonBit: 'A chip refined into the amber vessel.', bioChip: 'Refined from neurons and circuits for quantum fluid.',
    cryoFluid: '+5 energy, or the seal.', voltFluid: '+5 energy, or the seal.', bioFluid: '+8 energy, or the seal.', nanoFluid: '+10 energy, or the seal.', quantumFluid: '+20 energy, or the seal.', mind: 'Refined from dataset and spent on crafting.', soulCore: 'The core that stays with the player after the laboratory is sealed.',
  },
  pt: {
    data: 'Montado a partir do conjunto de dados e gasto nas operações.', circuit: 'Material de construção e combustível.', silicon: 'A base das estruturas e dos chips.', compute: 'Combustível do treino, montado de circuito e conjunto de dados.', dataset: 'Matéria-prima para dados, quartzo, mente e computação.',
    neuron: 'O primeiro elo da cadeia de produção.', synapse: 'Colheita dos poços para separação.', signal: 'O elo entre a colheita e o modelo.', model: 'Resultado do treino. Queima no selo do laboratório.', power: 'Recurso da estação de rede.',
    blueCore: 'Montado de circuitos e vira um bit quântico.', purpleCore: 'Montado de neurônios para o fluido quântico.', redCore: 'Montado de silício e vira um chip neural.', clearQuartz: 'Montado de circuitos e conjunto de dados para o bit fotônico.', roseQuartz: 'Montado de neurônios e conjunto de dados para o nanofluido.', amberQuartz: 'Recipiente feito de bit fotônico e queimado no selo do laboratório.',
    quantumBit: 'Chip usado no fluido criogênico.', neuralChip: 'Chip usado no fluido elétrico.', photonBit: 'Chip que se torna o recipiente de âmbar.', bioChip: 'Montado de neurônios e circuitos para o fluido quântico.',
    cryoFluid: '+5 de energia, ou o selo.', voltFluid: '+5 de energia, ou o selo.', bioFluid: '+8 de energia, ou o selo.', nanoFluid: '+10 de energia, ou o selo.', quantumFluid: '+20 de energia, ou o selo.', mind: 'Montado a partir do conjunto de dados e gasto na criação.', soulCore: 'Núcleo que se queda con el jugador tras sellar el laboratorio.',
  },
  es: {
    data: 'Se arma con el conjunto de datos y se gasta en operaciones.', circuit: 'Material de construcción y combustible.', silicon: 'La base de estructuras y chips.', compute: 'Combustible del entrenamiento, armado con circuito y conjunto de datos.', dataset: 'Materia prima para datos, cuarzo, mente y cómputo.',
    neuron: 'El primer eslabón de la cadena de producción.', synapse: 'Cosecha de los pozos para separar.', signal: 'El eslabón entre la cosecha y el modelo.', model: 'Resultado del entrenamiento. Se quema en el sello del laboratorio.', power: 'Recurso de la estación de red.',
    blueCore: 'Se arma con circuitos y se vuelve un bit cuántico.', purpleCore: 'Se arma con neuronas para el fluido cuántico.', redCore: 'Se arma con silicio y se vuelve un chip neuronal.', clearQuartz: 'Se arma con circuitos y conjunto de datos para el bit fotónico.', roseQuartz: 'Se arma con neuronas y conjunto de datos para el nanofluido.', amberQuartz: 'Recipiente hecho de bit fotónico y quemado en el sello del laboratorio.',
    quantumBit: 'Chip empleado en el fluido criogénico.', neuralChip: 'Chip empleado en el fluido eléctrico.', photonBit: 'Chip que se convierte en el recipiente de ámbar.', bioChip: 'Se arma con neuronas y circuitos para el fluido cuántico.',
    cryoFluid: '+5 de energía, o el sello.', voltFluid: '+5 de energía, o el sello.', bioFluid: '+8 de energía, o el sello.', nanoFluid: '+10 de energía, o el sello.', quantumFluid: '+20 de energía, o el sello.', mind: 'Se arma con el conjunto de datos y se gasta en fabricación.', soulCore: 'Recurso especial para eventos.',
  },
  vi: {
    data: 'Được tinh chế từ tập dữ liệu và tiêu hao trong các bước chơi.', circuit: 'Vật liệu xây dựng kiêm nhiên liệu.', silicon: 'Nền tảng của kết cấu và vi mạch.', compute: 'Nhiên liệu huấn luyện, tinh chế từ mạch và tập dữ liệu.', dataset: 'Nguyên liệu cho dữ liệu, thạch anh, tâm trí và tính toán.',
    neuron: 'Mắt xích đầu tiên của chuỗi sản xuất.', synapse: 'Sản phẩm thu từ ô nuôi cấy để tách mẫu.', signal: 'Mắt xích giữa thu hoạch và mô hình.', model: 'Kết quả huấn luyện. Bị đốt khi niêm phòng thí nghiệm.', power: 'Tài nguyên từ trạm lưới điện.',
    blueCore: 'Tinh chế từ mạch thành bit lượng tử.', purpleCore: 'Tinh chế từ nơ-ron cho dung dịch lượng tử.', redCore: 'Tinh chế từ silic thành chip thần kinh.', clearQuartz: 'Tinh chế từ mạch và tập dữ liệu cho bit photon.', roseQuartz: 'Tinh chế từ nơ-ron và tập dữ liệu cho dung dịch nano.', amberQuartz: 'Bình làm từ bit photon và bị đốt khi niêm phòng thí nghiệm.',
    quantumBit: 'Chip dùng cho dung dịch làm lạnh.', neuralChip: 'Chip dùng cho dung dịch điện.', photonBit: 'Chip được tinh chế thành bình hổ phách.', bioChip: 'Tinh chế từ nơ-ron và mạch cho dung dịch lượng tử.',
    cryoFluid: '+5 năng lượng, hoặc niêm phong.', voltFluid: '+5 năng lượng, hoặc niêm phong.', bioFluid: '+8 năng lượng, hoặc niêm phong.', nanoFluid: '+10 năng lượng, hoặc niêm phong.', quantumFluid: '+20 năng lượng, hoặc niêm phong.', mind: 'Được tinh chế từ tập dữ liệu và dùng khi chế tạo.', soulCore: 'Lõi ở lại với người chơi sau khi niêm phòng thí nghiệm.',
  },
  id: {
    data: 'Diolah dari dataset dan dipakai dalam langkah permainan.', circuit: 'Bahan bangunan sekaligus bahan bakar.', silicon: 'Dasar bagi struktur dan chip.', compute: 'Bahan bakar pelatihan, diolah dari sirkuit dan dataset.', dataset: 'Bahan mentah untuk data, kuarsa, pikiran, dan komputasi.',
    neuron: 'Mata rantai pertama dalam produksi.', synapse: 'Hasil panen wadah untuk pemisahan.', signal: 'Penghubung antara panen dan model.', model: 'Hasil pelatihan. Dibakar saat menyegel laboratorium.', power: 'Sumber daya dari stasiun jaringan.',
    blueCore: 'Diolah dari sirkuit menjadi bit kuantum.', purpleCore: 'Diolah dari neuron untuk cairan kuantum.', redCore: 'Diolah dari silikon menjadi chip saraf.', clearQuartz: 'Diolah dari sirkuit dan dataset untuk bit foton.', roseQuartz: 'Diolah dari neuron dan dataset untuk cairan nano.', amberQuartz: 'Wadah dari bit foton yang dibakar saat menyegel laboratorium.',
    quantumBit: 'Chip untuk cairan kriogenik.', neuralChip: 'Chip untuk cairan volt.', photonBit: 'Chip yang diolah menjadi wadah amber.', bioChip: 'Diolah dari neuron dan sirkuit untuk cairan kuantum.',
    cryoFluid: '+5 energi, atau segel.', voltFluid: '+5 energi, atau segel.', bioFluid: '+8 energi, atau segel.', nanoFluid: '+10 energi, atau segel.', quantumFluid: '+20 energi, atau segel.', mind: 'Diolah dari dataset dan dipakai saat merakit.', soulCore: 'Inti yang tetap pada pemain setelah laboratorium disegel.',
  },
  fil: {
    data: 'Nililinis mula sa dataset at ginagamit sa mga hakbang ng laro.', circuit: 'Materyales sa paggawa at panggatong.', silicon: 'Pundasyon ng mga estruktura at chip.', compute: 'Panggatong ng pagsasanay, nililinis mula sa circuit at dataset.', dataset: 'Hilaw na sangkap para sa data, quartz, isip, at compute.',
    neuron: 'Unang kawing sa daloy ng paggawa.', synapse: 'Ani mula sa mga puwesto para sa paghihiwalay.', signal: 'Kawing sa pagitan ng ani at modelo.', model: 'Bunga ng pagsasanay. Nasusunog sa tatak ng laboratoryo.', power: 'Yaman mula sa grid station.',
    blueCore: 'Nililinis mula sa circuit tungo sa quantum bit.', purpleCore: 'Nililinis mula sa neuron para sa quantum fluid.', redCore: 'Nililinis mula sa silicon tungo sa neural chip.', clearQuartz: 'Nililinis mula sa circuit at dataset para sa photon bit.', roseQuartz: 'Nililinis mula sa neuron at dataset para sa nano fluid.', amberQuartz: 'Sisidlan mula sa photon bit na nasusunog sa tatak ng laboratoryo.',
    quantumBit: 'Chip na gamit sa cryo fluid.', neuralChip: 'Chip na gamit sa volt fluid.', photonBit: 'Chip na ginagawang sisidlang amber.', bioChip: 'Nililinis mula sa neuron at circuit para sa quantum fluid.',
    cryoFluid: '+5 na enerhiya, o ang tatak.', voltFluid: '+5 na enerhiya, o ang tatak.', bioFluid: '+8 na enerhiya, o ang tatak.', nanoFluid: '+10 na enerhiya, o ang tatak.', quantumFluid: '+20 na enerhiya, o ang tatak.', mind: 'Nililinis mula sa dataset at ginagamit sa paggawa.', soulCore: 'Core na nananatili sa manlalaro pagkatapos tatakan ang laboratoryo.',
  },
};
