import type { Language } from './translations';
import type { ResourceId } from './homeDetail';

/** Short editorial descriptions for all 27 catalog cards; not a claim of on-chain availability. */
export const resourceLeads: Record<Language, Record<ResourceId, string>> = {
  ru: {
    data: 'Основа многих операций.', circuit: 'Материал для сборки и топливо.', silicon: 'Основа конструкций и чипов.', compute: 'Топливо для обучения моделей.', dataset: 'Сырьё для сложных операций.',
    neuron: 'Первое звено производственной цепочки.', synapse: 'Урожай лунок для сепарации.', signal: 'Звено между урожаем и моделью.', model: 'Результат производственной цепочки.', power: 'Ресурс сетевой станции.',
    blueCore: 'Материал для квантового бита.', purpleCore: 'Материал для квантового флюида.', redCore: 'Материал для нейрочипа.', clearQuartz: 'Материал для фотонного бита.', roseQuartz: 'Материал для нано-флюида.', amberQuartz: 'Резервный материал без рецепта.',
    quantumBit: 'Чип для крио-флюида.', neuralChip: 'Чип для вольт-флюида.', photonBit: 'Чип без следующего рецепта.', bioChip: 'Материал для квантового флюида.',
    cryoFluid: 'Флюид продвинутого уровня.', voltFluid: 'Флюид продвинутого уровня.', bioFluid: 'Флюид органической цепочки.', nanoFluid: 'Флюид кварцевой цепочки.', quantumFluid: 'Флюид высшего уровня.', mind: 'Ресурс для особых операций.', soulCore: 'Особый ресурс для событий.',
  },
  en: {
    data: 'The foundation of many operations.', circuit: 'Building material and fuel.', silicon: 'The basis of structures and chips.', compute: 'Fuel for training models.', dataset: 'Raw material for complex operations.',
    neuron: 'The first link in the production chain.', synapse: 'A harvest from the wells, ready for separation.', signal: 'The link between harvest and model.', model: 'The result of the production chain.', power: 'A resource from the grid station.',
    blueCore: 'Material for a quantum bit.', purpleCore: 'Material for quantum fluid.', redCore: 'Material for a neural chip.', clearQuartz: 'Material for a photon bit.', roseQuartz: 'Material for nano fluid.', amberQuartz: 'A reserve material with no recipe.',
    quantumBit: 'A chip used in cryo fluid.', neuralChip: 'A chip used in volt fluid.', photonBit: 'A chip with no follow-up recipe.', bioChip: 'Material for quantum fluid.',
    cryoFluid: 'A fluid for advanced stages.', voltFluid: 'A fluid for advanced stages.', bioFluid: 'A fluid from the organic chain.', nanoFluid: 'A fluid from the quartz chain.', quantumFluid: 'A fluid of the highest tier.', mind: 'A resource for special operations.', soulCore: 'A special resource for events.',
  },
  pt: {
    data: 'A base de muitas operações.', circuit: 'Material de construção e combustível.', silicon: 'A base das estruturas e dos chips.', compute: 'Combustível para treinar modelos.', dataset: 'Matéria-prima para operações complexas.',
    neuron: 'O primeiro elo da cadeia de produção.', synapse: 'Colheita dos poços para separação.', signal: 'O elo entre a colheita e o modelo.', model: 'O resultado da cadeia de produção.', power: 'Recurso da estação de rede.',
    blueCore: 'Material para um bit quântico.', purpleCore: 'Material para fluido quântico.', redCore: 'Material para um chip neural.', clearQuartz: 'Material para um bit fotônico.', roseQuartz: 'Material para nanofluido.', amberQuartz: 'Material de reserva, sem receita.',
    quantumBit: 'Chip usado no fluido criogênico.', neuralChip: 'Chip usado no fluido elétrico.', photonBit: 'Chip sem receita posterior.', bioChip: 'Material para fluido quântico.',
    cryoFluid: 'Fluido para fases avançadas.', voltFluid: 'Fluido para fases avançadas.', bioFluid: 'Fluido da cadeia orgânica.', nanoFluid: 'Fluido da cadeia do quartzo.', quantumFluid: 'Fluido do nível mais alto.', mind: 'Recurso para operações especiais.', soulCore: 'Recurso especial para eventos.',
  },
  es: {
    data: 'La base de muchas operaciones.', circuit: 'Material de construcción y combustible.', silicon: 'La base de estructuras y chips.', compute: 'Combustible para entrenar modelos.', dataset: 'Materia prima para operaciones complejas.',
    neuron: 'El primer eslabón de la cadena de producción.', synapse: 'Cosecha de los pozos para separar.', signal: 'El eslabón entre la cosecha y el modelo.', model: 'El resultado de la cadena de producción.', power: 'Recurso de la estación de red.',
    blueCore: 'Material para un bit cuántico.', purpleCore: 'Material para fluido cuántico.', redCore: 'Material para un chip neuronal.', clearQuartz: 'Material para un bit fotónico.', roseQuartz: 'Material para nanofluido.', amberQuartz: 'Material de reserva sin receta.',
    quantumBit: 'Chip empleado en el fluido criogénico.', neuralChip: 'Chip empleado en el fluido eléctrico.', photonBit: 'Chip sin receta posterior.', bioChip: 'Material para fluido cuántico.',
    cryoFluid: 'Fluido para etapas avanzadas.', voltFluid: 'Fluido para etapas avanzadas.', bioFluid: 'Fluido de la cadena orgánica.', nanoFluid: 'Fluido de la cadena del cuarzo.', quantumFluid: 'Fluido del nivel más alto.', mind: 'Recurso para operaciones especiales.', soulCore: 'Recurso especial para eventos.',
  },
  vi: {
    data: 'Nền tảng của nhiều hoạt động.', circuit: 'Vật liệu xây dựng kiêm nhiên liệu.', silicon: 'Nền tảng của kết cấu và vi mạch.', compute: 'Nhiên liệu để huấn luyện mô hình.', dataset: 'Nguyên liệu cho các hoạt động phức tạp.',
    neuron: 'Mắt xích đầu tiên của chuỗi sản xuất.', synapse: 'Sản phẩm thu từ ô nuôi cấy để tách mẫu.', signal: 'Mắt xích giữa thu hoạch và mô hình.', model: 'Thành phẩm của chuỗi sản xuất.', power: 'Tài nguyên từ trạm lưới điện.',
    blueCore: 'Vật liệu tạo bit lượng tử.', purpleCore: 'Vật liệu tạo dung dịch lượng tử.', redCore: 'Vật liệu tạo chip thần kinh.', clearQuartz: 'Vật liệu tạo bit photon.', roseQuartz: 'Vật liệu tạo dung dịch nano.', amberQuartz: 'Vật liệu dự trữ, chưa có công thức.',
    quantumBit: 'Chip dùng cho dung dịch làm lạnh.', neuralChip: 'Chip dùng cho dung dịch điện.', photonBit: 'Chip chưa có công thức tiếp theo.', bioChip: 'Vật liệu tạo dung dịch lượng tử.',
    cryoFluid: 'Dung dịch cho giai đoạn nâng cao.', voltFluid: 'Dung dịch cho giai đoạn nâng cao.', bioFluid: 'Dung dịch từ chuỗi hữu cơ.', nanoFluid: 'Dung dịch từ chuỗi thạch anh.', quantumFluid: 'Dung dịch bậc cao nhất.', mind: 'Tài nguyên cho hoạt động đặc biệt.', soulCore: 'Tài nguyên đặc biệt cho sự kiện.',
  },
  id: {
    data: 'Dasar dari banyak kegiatan.', circuit: 'Bahan bangunan sekaligus bahan bakar.', silicon: 'Dasar bagi struktur dan chip.', compute: 'Bahan bakar untuk melatih model.', dataset: 'Bahan mentah untuk kegiatan rumit.',
    neuron: 'Mata rantai pertama dalam produksi.', synapse: 'Hasil panen wadah untuk pemisahan.', signal: 'Penghubung antara panen dan model.', model: 'Hasil akhir rangkaian produksi.', power: 'Sumber daya dari stasiun jaringan.',
    blueCore: 'Bahan untuk bit kuantum.', purpleCore: 'Bahan untuk cairan kuantum.', redCore: 'Bahan untuk chip saraf.', clearQuartz: 'Bahan untuk bit foton.', roseQuartz: 'Bahan untuk cairan nano.', amberQuartz: 'Bahan cadangan tanpa resep.',
    quantumBit: 'Chip untuk cairan kriogenik.', neuralChip: 'Chip untuk cairan volt.', photonBit: 'Chip tanpa resep lanjutan.', bioChip: 'Bahan untuk cairan kuantum.',
    cryoFluid: 'Cairan untuk tahap lanjut.', voltFluid: 'Cairan untuk tahap lanjut.', bioFluid: 'Cairan dari rangkaian organik.', nanoFluid: 'Cairan dari rangkaian kuarsa.', quantumFluid: 'Cairan pada tingkat tertinggi.', mind: 'Sumber daya untuk kegiatan khusus.', soulCore: 'Sumber daya khusus untuk acara.',
  },
  fil: {
    data: 'Batayan ng maraming gawain.', circuit: 'Materyales sa paggawa at panggatong.', silicon: 'Pundasyon ng mga estruktura at chip.', compute: 'Panggatong sa pagsasanay ng modelo.', dataset: 'Hilaw na sangkap sa masalimuot na gawain.',
    neuron: 'Unang kawing sa daloy ng paggawa.', synapse: 'Ani mula sa mga puwesto para sa paghihiwalay.', signal: 'Kawing sa pagitan ng ani at modelo.', model: 'Bunga ng daloy ng paggawa.', power: 'Yaman mula sa grid station.',
    blueCore: 'Materyales para sa quantum bit.', purpleCore: 'Materyales para sa quantum fluid.', redCore: 'Materyales para sa neural chip.', clearQuartz: 'Materyales para sa photon bit.', roseQuartz: 'Materyales para sa nano fluid.', amberQuartz: 'Reserbang materyales na wala pang resipe.',
    quantumBit: 'Chip na gamit sa cryo fluid.', neuralChip: 'Chip na gamit sa volt fluid.', photonBit: 'Chip na wala pang kasunod na resipe.', bioChip: 'Materyales para sa quantum fluid.',
    cryoFluid: 'Fluid para sa susunod na yugto.', voltFluid: 'Fluid para sa susunod na yugto.', bioFluid: 'Fluid mula sa organikong daloy.', nanoFluid: 'Fluid mula sa daloy ng kuwarts.', quantumFluid: 'Fluid ng pinakamataas na antas.', mind: 'Yaman para sa natatanging gawain.', soulCore: 'Natatanging yaman para sa event.',
  },
};
