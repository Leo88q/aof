import type { Recipe } from './schema';

export const recipes: Recipe[] = [
  // === ЦЕПОЧКА МОДЕЛИ ===
  {
    id: 'mill_flour',
    verification: 'editorial',
    name: 'Сепарация синапсов',
    station: 'mill',
    inputs: [{ resourceId: 'synapse', amount: 5 }],
    outputs: [{ resourceId: 'signal', amount: 3 }],
    energy: 8,
    time: '~4 минуты игрового времени',
    description: 'Базовая сепарация: 5 синапсов → 3 сигнала. Модуль сепарации принимает только полностью созревшие образцы.',
    narrative: 'Модуль сепарации не любит спешки. Оператор подаёт синапсы небольшими партиями и слушает шум шины: когда он становится ровным, сигнал готов. Пять синапсов дают три пакета сигнала — такова цена сепарации.'
  },
  {
    id: 'bake_bread',
    verification: 'editorial',
    name: 'Обучение модели',
    station: 'oven',
    inputs: [{ resourceId: 'signal', amount: 2 }, { resourceId: 'power', amount: 1 }, { resourceId: 'compute', amount: 1 }],
    outputs: [{ resourceId: 'model', amount: 1 }],
    energy: 12,
    time: '~8 минут игрового времени',
    description: 'Продуктовое описание цепочки обучения: сигнал + энергопоток + вычислительный цикл для жара. Эффект модели сетью не подтверждён.',
    narrative: 'Учебный стенд питается вычислительными циклами, а не голым энергопотоком — циклы жалко тратить впустую. Веса сходятся в тишине, пока сигнал равномерно прогоняется через слои. Когда кривая потерь ложится ровно — работа закончена.'
  },
  
  // === ИНСТРУМЕНТЫ ===
  {
    id: 'craft_common_axe',
    verification: 'editorial',
    name: 'Обычный плазменный резчик',
    station: 'workbench',
    inputs: [{ resourceId: 'circuit', amount: 3 }, { resourceId: 'silicon', amount: 2 }],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 15,
    toolRequired: undefined,
    description: 'Базовый инструмент common-редкости. 20 единиц прочности. Подходит для простых работ.',
    narrative: 'Первый резчик ученика: грубая сборка, базовая кромка, проводная обмотка. Он не красив, но работает. Каждый мастер начинал с такого.',
  },
  {
    id: 'craft_uncommon_axe',
    verification: 'editorial',
    name: 'Усиленный плазменный резчик',
    station: 'forge',
    inputs: [{ resourceId: 'circuit', amount: 5 }, { resourceId: 'silicon', amount: 4 }, { resourceId: 'compute', amount: 3 }],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 25,
    description: 'Инструмент enhanced-редкости. Усиленная кромка, композитная рукоять, полимерная обмотка. 20 прочности.',
    narrative: 'Оператор калибрует кромку до номинального свечения, выравнивает контур, охлаждает в потоке. Рукоять пропитана защитным составом — она переживёт три эпохи работы.',
  },
  {
    id: 'craft_rare_axe',
    verification: 'editorial',
    name: 'Квантовый плазменный резчик',
    station: 'forge',
    inputs: [{ resourceId: 'circuit', amount: 8 }, { resourceId: 'blueCore', amount: 2 }, { resourceId: 'compute', amount: 5 }, { resourceId: 'photonBit', amount: 1 }],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 40,
    description: 'Редкий инструмент. Булатная сталь с медным ошейником. 20 прочности + бонус к определённым действиям.',
    narrative: 'Булат виден невооружённым глазом: узор на стали, как волны на воде. Медный ошейник зеленеет со временем — это не дефект, это патина времени.',
  },
  {
    id: 'craft_legendary_axe',
    verification: 'editorial',
    name: 'Трансцендентный плазменный резчик',
    station: 'forge',
    inputs: [
      { resourceId: 'circuit', amount: 12 },
      { resourceId: 'redCore', amount: 1 },
      { resourceId: 'neuralChip', amount: 1 },
      { resourceId: 'compute', amount: 8 }
    ],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 60,
    description: 'Легендарный инструмент. Метеоритное железо с медной инкрустацией. 20 прочности + уникальные свойства.',
    narrative: 'Редкий сплав не куётся — он уговаривается. Оператор работает три смены, не выходя из кузницы. Готовый резчик тёплый на ощупь даже в блэкаут.'
  },
  
  // === ФЛЯГИ ===
  {
    id: 'craft_flask_blue',
    verification: 'editorial',
    name: 'Синяя фляга',
    station: 'glassworks',
    inputs: [
      { resourceId: 'clearQuartz', amount: 3 },
      { resourceId: 'quantumBit', amount: 1 },
      { resourceId: 'compute', amount: 2 }
    ],
    outputs: [{ resourceId: 'cryoFluid', amount: 1 }],
    energy: 20,
    description: 'Редакционное описание стеклодувной фляги. Числовой эффект восстановления энергии сетью не подтверждён.',
    narrative: 'Стеклодув выдувает флягу одним дыханием. Синий цвет — от гема, растворённого в расплаве. Жидкость внутри прохладная даже в жару.',
  },
  {
    id: 'craft_flask_yellow',
    verification: 'editorial',
    name: 'Жёлтая фляга',
    station: 'glassworks',
    inputs: [
      { resourceId: 'amberQuartz', amount: 4 },
      { resourceId: 'neuralChip', amount: 1 },
      { resourceId: 'compute', amount: 3 }
    ],
    outputs: [{ resourceId: 'voltFluid', amount: 1 }],
    energy: 25,
    description: 'Редакционное описание янтарной фляги. Числовой эффект восстановления энергии сетью не подтверждён.',
    narrative: 'Янтарное стекло гуще, тяжелее. Жидкость внутри вязкая, как мёд. Стеклодув говорит: эта фляга для дней, когда нужно сделать невозможное.'
  },
  {
    id: 'craft_flask_green',
    verification: 'editorial',
    name: 'Зелёная фляга',
    station: 'alchemist',
    inputs: [
      { resourceId: 'clearQuartz', amount: 5 },
      { resourceId: 'bioChip', amount: 1 },
      { resourceId: 'power', amount: 2 }
    ],
    outputs: [{ resourceId: 'bioFluid', amount: 1 }],
    energy: 35,
    description: 'Редакционное описание полного восстановления энергии. Точный эффект и рецепт сетью не подтверждены.',
    narrative: 'Алхимик работает в тишине, без помощников. Зелёная жидкость светится изнутри слабо, но этого достаточно, чтобы читать при ней. Говорят, в ней растворён лист первого схемы мастерской.'
  },
  
  // === MIND-РЕЦЕПТЫ (кросс-игровые) ===
  {
    id: 'potato_feast',
    verification: 'editorial',
    name: 'Ритуальная модель',
    station: 'oven',
    inputs: [
      { resourceId: 'mind', amount: 3 },
      { resourceId: 'signal', amount: 2 },
      { resourceId: 'compute', amount: 1 }
    ],
    outputs: [{ resourceId: 'data', amount: 5 }],
    energy: 15,
    potatoCost: 3,
    description: 'Коллаборационный рецепт. 3 MIND + сигнал + вычислительный цикл = 5 единиц провизии.',
    narrative: 'MIND приходит из другой игры, но в учебном стенде NeuroForge ведёт себя как любой другой ресурс. Сборка получается плотной и стабильной. Мастера шутят: "MIND не знает, откуда пришёл — ему всё равно, где работать."'
  },
  {
    id: 'potato_ritual',
    verification: 'editorial',
    name: 'Ритуал обмена',
    station: 'workbench',
    inputs: [
      { resourceId: 'mind', amount: 10 },
      { resourceId: 'soulCore', amount: 1 }
    ],
    outputs: [{ resourceId: 'skr', amount: 50 }],
    energy: 20,
    potatoCost: 10,
    description: 'Превращение 10 MIND + 1 Ядро-душа (Soul Core) → 50 SKR. Одноразовый ритуал эпохи.',
    narrative: 'Ритуал проводят в полнолуние. MIND сгорает без остатка, Ядро-душа темнеет и трескается. Взамен — горсть монет SKR. Мастера говорят: это не обмен, это благодарность между мирами.'
  },
  {
    id: 'potato_boost',
    verification: 'editorial',
    name: 'Ускорение эпохи',
    station: 'alchemist',
    inputs: [
      { resourceId: 'mind', amount: 5 },
      { resourceId: 'quantumFluid', amount: 1 }
    ],
    outputs: [],
    energy: 10,
    potatoCost: 5,
    description: 'Сокращает время текущей эпохи на 20%. MIND и фиолетовая фляга сгорают полностью.',
    narrative: 'Алхимик смешивает MIND с легендарной эссенцией. Смесь вспыхивает фиолетовым светом, и где-то в глубине игры колесо эпох крутится быстрее. Говорят, это единственный способ подтолкнуть время.'
  }
];

export const recipesByStation = new Map<string, Recipe[]>();
for (const r of recipes) {
  const list = recipesByStation.get(r.station) || [];
  list.push(r);
  recipesByStation.set(r.station, list);
}

export const stationNames: Record<string, string> = {
  workbench: 'Квантовая кузница',
  forge: 'Кузница',
  mill: 'Модуль сепарации',
  oven: 'Учебный стенд',
  glassworks: 'Стеклодувня',
  alchemist: 'Алхимик'
};
