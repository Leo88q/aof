import type { Resource } from './schema';

export const resources: Resource[] = [
  // ── Base Resources ──
  { id: 'data', slug: 'data', name: 'Данные', category: 'base', status: 'live',
    lead: 'Фундамент всех операций.',
    description: ['Универсальный ресурс — вход в большинство рецептов и крафтов.', 'Добывается админ-эмиссией, наградами и торговлей.', 'Расходуется в крафте флюидов и общих рецептах.'],
    sources: ['Награды', 'Паки', 'Рынок'], sinks: ['Крафт флюидов', 'Рецепты'],
    relatedMechanics: ['packs', 'quests', 'craft'], relatedResources: ['circuit', 'silicon'],
    narrative: 'Данные — сырая материя цифровой вселенной. Каждый байт, прошедший через нейро-лабораторию, несёт отпечаток оператора. Из данных строятся модели, из моделей — решения, из решений — будущее сети.' },

  { id: 'circuit', slug: 'circuit', name: 'Схема', category: 'base', status: 'live',
    lead: 'Конструкционный материал и топливо.',
    description: ['Добывается Plasma Cutter в режиме mining.', 'Используется для ремонта инструментов и как топливо тренажёра.', 'Участвует в крафте инструментов и флюидов.'],
    sources: ['Plasma Cutter', 'Экспедиции', 'Рынок'], sinks: ['Ремонт', 'Топливо', 'Крафт'],
    relatedMechanics: ['mine', 'tools', 'craft'], relatedResources: ['silicon', 'compute'],
    narrative: 'Схема — нервная система каждого инструмента. Дорожки, слои, микроскопические каналы для сигналов. Мастер хранит схемы на стеллажах: одна чинит резчик, другая питает тренажёр.' },

  { id: 'silicon', slug: 'silicon', name: 'Кремний', category: 'base', status: 'live',
    lead: 'Основа конструкций и чипов.',
    description: ['Добывается Silicon Extractor в режиме mining.', 'Используется в крафте инструментов и флюидов.', 'Не путать с цветными ядрами — серый кремний базовый.'],
    sources: ['Silicon Extractor', 'Паки', 'Рынок'], sinks: ['Крафт', 'Флюиды'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['blueCore', 'purpleCore', 'redCore'],
    narrative: 'Кремний — фундамент всего: кузница, тренажёр, серверные стойки растут из него. Тяжёлый, надёжный, абсолютно необходимый.' },

  { id: 'compute', slug: 'compute', name: 'Вычислительный цикл', category: 'base', status: 'live',
    lead: 'Топливо для тренировки моделей.',
    description: ['Альтернативное топливо тренажёра (вместо Circuit).', 'Добывается наградами и торговлей.', 'Расход определяется рецептом тренировки.'],
    sources: ['Награды', 'Рынок'], sinks: ['Тренировка', 'Рецепты'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['circuit', 'silicon'] },

  { id: 'dataset', slug: 'dataset', name: 'Датасет', category: 'base', status: 'live',
    lead: 'Сырьё для продвинутых операций.',
    description: ['Добывается Data Harvester или Quantum Transmitter.', 'Используется в специальных рецептах и крафте.', 'Связан с экспедициями и событиями.'],
    sources: ['Data Harvester', 'Quantum Transmitter', 'Рынок'], sinks: ['Рецепты', 'Крафт'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['data', 'circuit'] },

  // ── Model Chain ──
  { id: 'neuron', slug: 'neuron', name: 'Нейрон', category: 'chain', status: 'live',
    lead: 'Точка входа в производственный цикл.',
    description: ['Добывается Neural Seeder в режиме mining.', 'Используется для посева на тайлах нейро-лаборатории.', 'Оставляй запас для следующего цикла.'],
    sources: ['Neural Seeder', 'Рынок', 'Награды'], sinks: ['Посев', 'Био-флюид'],
    relatedMechanics: ['farm', 'weather', 'energy'], relatedResources: ['synapse', 'power'],
    narrative: 'Нейрон — семя интеллекта. Каждый нейрон хранит потенциал связи: посей его, и сеть вырастит новый синапс. Мастер сеет не «всё сразу», а по тайлам и срокам.' },

  { id: 'synapse', slug: 'synapse', name: 'Синапс', category: 'chain', status: 'live',
    lead: 'Первый сбор — сырьё для переработки.',
    description: ['Собирается с тайлов после созревания (yield ×1.5 от посева).', 'Перерабатывается в Сигнал через модуль переработки.', 'Зависит от нагрузки сети и эпохи.'],
    sources: ['Сбор с тайлов', 'Рынок'], sinks: ['Модуль переработки'],
    relatedMechanics: ['farm', 'weather', 'seasons'], relatedResources: ['neuron', 'signal'],
    narrative: 'Синапс зреет в сети и зависит от всего сразу: от скачка нагрузки, от эпохи, от того, успел ли ты снять его вовремя. Пять синапсов уходят в переработку, чтобы вернуться сигналом.' },

  { id: 'signal', slug: 'signal', name: 'Сигнал', category: 'chain', status: 'live',
    lead: 'Промежуточный продукт между сбором и моделью.',
    description: ['Получается после завершения переработки синапса.', 'Используется как вход для тренировки модели.', 'Можно продать или продолжить цепочку.'],
    sources: ['Модуль переработки', 'Рынок'], sinks: ['Тренировка модели'],
    relatedMechanics: ['farm', 'energy'], relatedResources: ['synapse', 'model'] },

  { id: 'model', slug: 'model', name: 'Модель', category: 'chain', status: 'live',
    lead: 'Результат полного производственного цикла.',
    description: ['Завершает цепочку: Нейрон → Синапс → Сигнал → Модель.', 'Топливо: Схема или Вычислительный цикл.', 'Конечный продукт оператора — можно использовать или продать.'],
    sources: ['Тренировка', 'Рынок'], sinks: ['Использование', 'Продажа'],
    relatedMechanics: ['farm', 'energy'], relatedResources: ['signal', 'circuit'],
    narrative: 'Модель — единственная награда, которую можно запустить. Инференс стартует ровно, из ядра идёт тепло — значит, цепочка пройдена честно.' },

  { id: 'power', slug: 'power', name: 'Энергопоток', category: 'base', status: 'live',
    lead: 'Ресурс сетевой станции.',
    description: ['Накапливается на Grid Station в зависимости от нагрузки сети.', 'Ставка: 0/5/15/20 юнитов·ч при blackout/nominal/surge/frenzy.', 'Максимальное накопление — 24 часа.'],
    sources: ['Grid Station', 'Рынок'], sinks: ['Посев', 'Крафт'],
    relatedMechanics: ['farm', 'weather'], relatedResources: ['neuron', 'circuit'] },

  // ── Cores ──
  { id: 'blueCore', slug: 'blue-core', name: 'Синее ядро', category: 'rare', status: 'live',
    lead: 'Вход для рецепта Квантового бита.',
    description: ['Редкая находка из добычи и экспедиций.', 'Рецепт 0: 1 Blue Core → 1 Quantum Bit.', 'Не планируй гарантированное количество за эпоху.'],
    sources: ['Добыча', 'Экспедиции', 'Рынок'], sinks: ['Рецепт → Quantum Bit'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['quantumBit'] },

  { id: 'purpleCore', slug: 'purple-core', name: 'Фиолетовое ядро', category: 'rare', status: 'live',
    lead: 'Вход для рецепта Квантового флюида.',
    description: ['Редкая находка продвинутого крафта.', 'Рецепт 7: 1 Purple Core + 1 Bio Chip → Quantum Fluid.', 'Удачу не ставят в план.'],
    sources: ['Добыча', 'Награды', 'Рынок'], sinks: ['Рецепт → Quantum Fluid'],
    relatedMechanics: ['mine', 'craft', 'drum'], relatedResources: ['quantumFluid'] },

  { id: 'redCore', slug: 'red-core', name: 'Красное ядро', category: 'rare', status: 'live',
    lead: 'Вход для рецепта Нейрочипа.',
    description: ['Редкая находка с огненным оттенком.', 'Рецепт 1: 1 Red Core → 1 Neural Chip.', 'Сверяй доступность добычи.'],
    sources: ['Добыча', 'Экспедиции', 'Рынок'], sinks: ['Рецепт → Neural Chip'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['neuralChip'] },

  // ── Quartz ──
  { id: 'clearQuartz', slug: 'clear-quartz', name: 'Чистый кварц', category: 'rare', status: 'live',
    lead: 'Вход для рецепта Фотонного бита.',
    description: ['Прозрачный кристалл из глубинных слоёв.', 'Рецепт 2: 1 Clear Quartz → 1 Photon Bit.'],
    sources: ['Добыча', 'Экспедиции', 'Рынок'], sinks: ['Рецепт → Photon Bit'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['photonBit'] },

  { id: 'roseQuartz', slug: 'rose-quartz', name: 'Розовый кварц', category: 'rare', status: 'live',
    lead: 'Вход для рецепта Нано-флюида.',
    description: ['Розоватый кристалл с внутренним свечением.', 'Рецепт 6: 5 Rose Quartz + 5 Data → 5 Nano Fluid.'],
    sources: ['Добыча', 'Награды', 'Рынок'], sinks: ['Рецепт → Nano Fluid'],
    relatedMechanics: ['mine', 'craft'], relatedResources: ['nanoFluid'] },

  { id: 'amberQuartz', slug: 'amber-quartz', name: 'Янтарный кварц', category: 'rare', status: 'live',
    lead: 'Резервный материал.',
    description: ['Янтарный кристалл. Рецептов пока нет.', 'Коллекционный предмет.'],
    sources: ['Добыча', 'Награды', 'Рынок'], sinks: [],
    relatedMechanics: ['mine'], relatedResources: [] },

  // ── Chips ──
  { id: 'quantumBit', slug: 'quantum-bit', name: 'Квантовый бит', category: 'rare', status: 'live',
    lead: 'Промежуточный чип → Крио-флюид.',
    description: ['Рецепт 0: 1 Blue Core → 1 Quantum Bit.', 'Рецепт 3: 2 Quantum Bit + 5 Data → Cryo Fluid.'],
    sources: ['Крафт (рецепт 0)', 'Рынок'], sinks: ['Рецепт → Cryo Fluid'],
    relatedMechanics: ['craft'], relatedResources: ['blueCore', 'cryoFluid'] },

  { id: 'neuralChip', slug: 'neural-chip', name: 'Нейрочип', category: 'rare', status: 'live',
    lead: 'Промежуточный чип → Вольт-флюид.',
    description: ['Рецепт 1: 1 Red Core → 1 Neural Chip.', 'Рецепт 4: 2 Neural Chip + 3 Silicon → Volt Fluid.'],
    sources: ['Крафт (рецепт 1)', 'Рынок'], sinks: ['Рецепт → Volt Fluid'],
    relatedMechanics: ['craft'], relatedResources: ['redCore', 'voltFluid'] },

  { id: 'photonBit', slug: 'photon-bit', name: 'Фотонный бит', category: 'rare', status: 'live',
    lead: 'Резервный чип.',
    description: ['Рецепт 2: 1 Clear Quartz → 1 Photon Bit.', 'Пока не участвует в дальнейших рецептах.'],
    sources: ['Крафт (рецепт 2)', 'Рынок'], sinks: [],
    relatedMechanics: ['craft'], relatedResources: ['clearQuartz'] },

  { id: 'bioChip', slug: 'bio-chip', name: 'Биочип', category: 'rare', status: 'live',
    lead: 'Вход для рецепта Квантового флюида.',
    description: ['Рецепт 7: 1 Purple Core + 1 Bio Chip → Quantum Fluid.'],
    sources: ['Эмиссия', 'Дропы', 'Рынок'], sinks: ['Рецепт → Quantum Fluid'],
    relatedMechanics: ['craft'], relatedResources: ['purpleCore', 'quantumFluid'] },

  // ── Fluids ──
  { id: 'cryoFluid', slug: 'cryo-fluid', name: 'Крио-флюид', category: 'consumable', status: 'live',
    lead: 'Утилити-ресурс продвинутой прогрессии.',
    description: ['Рецепт 3: 2 Quantum Bit + 5 Data → Cryo Fluid.', 'Используется в утилити и прогрессии.'],
    sources: ['Крафт (рецепт 3)'], sinks: ['Утилити', 'Прогрессия'],
    relatedMechanics: ['craft'], relatedResources: ['quantumBit'] },

  { id: 'voltFluid', slug: 'volt-fluid', name: 'Вольт-флюид', category: 'consumable', status: 'live',
    lead: 'Утилити-ресурс продвинутой прогрессии.',
    description: ['Рецепт 4: 2 Neural Chip + 3 Silicon → Volt Fluid.'],
    sources: ['Крафт (рецепт 4)'], sinks: ['Утилити', 'Прогрессия'],
    relatedMechanics: ['craft'], relatedResources: ['neuralChip'] },

  { id: 'bioFluid', slug: 'bio-fluid', name: 'Био-флюид', category: 'consumable', status: 'live',
    lead: 'Утилити-ресурс из органической цепочки.',
    description: ['Рецепт 5: 5 Circuit + 5 Neuron → Bio Fluid.'],
    sources: ['Крафт (рецепт 5)'], sinks: ['Утилити', 'Прогрессия'],
    relatedMechanics: ['craft'], relatedResources: ['circuit', 'neuron'] },

  { id: 'nanoFluid', slug: 'nano-fluid', name: 'Нано-флюид', category: 'consumable', status: 'live',
    lead: 'Утилити-ресурс из кварцевой цепочки.',
    description: ['Рецепт 6: 5 Rose Quartz + 5 Data → 5 Nano Fluid.'],
    sources: ['Крафт (рецепт 6)'], sinks: ['Утилити', 'Прогрессия'],
    relatedMechanics: ['craft'], relatedResources: ['roseQuartz'] },

  { id: 'quantumFluid', slug: 'quantum-fluid', name: 'Квантовый флюид', category: 'consumable', status: 'live',
    lead: 'Высший утилити-ресурс.',
    description: ['Рецепт 7: 1 Purple Core + 1 Bio Chip → Quantum Fluid.'],
    sources: ['Крафт (рецепт 7)'], sinks: ['Утилити', 'Прогрессия'],
    relatedMechanics: ['craft'], relatedResources: ['purpleCore', 'bioChip'] },

  // ── Special ──
  { id: 'mind', slug: 'mind', name: 'MIND', category: 'collab', status: 'live',
    lead: 'Утилити-валюта для особых операций.',
    description: ['Коллаборационный ресурс из экосистемы.', 'Используется в специальных рецептах и скидках.', 'SKR-скидка 15% при балансе ≥ 3000 SKR (когда настроено).'],
    sources: ['NPC', 'События', 'Рынок'], sinks: ['Специальные рецепты'],
    relatedMechanics: ['npc', 'craft'], relatedResources: ['soulCore'] },

  { id: 'soulCore', slug: 'soul-core', name: 'Ядро-душа', category: 'social', status: 'live',
    lead: 'Особый ресурс специальных событий.',
    description: ['Выпускается только в специальных событиях.', 'Связан с коллекциями и архивами.'],
    sources: ['Специальные события'], sinks: ['Коллекции'],
    relatedMechanics: ['collectors'], relatedResources: ['mind'] },
];

export const resourcesBySlug = new Map(resources.map(r => [r.slug, r]));
export const resourcesById = new Map(resources.map(r => [r.id, r]));
export const categoryNames: Record<string, string> = {
  base: 'Базовые', chain: 'Модельная цепочка', material: 'Материалы',
  rare: 'Ядра и чипы', consumable: 'Флюиды', token: 'Токены',
  collab: 'Коллаборации', social: 'Особые',
} as const;
