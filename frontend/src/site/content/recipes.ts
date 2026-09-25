import type { Recipe } from './schema';

export const recipes: Recipe[] = [
  // === ЦЕПОЧКА ХЛЕБА ===
  {
    id: 'mill_flour',
    verification: 'editorial',
    name: 'Перемол синапсов',
    station: 'mill',
    inputs: [{ resourceId: 'wheat', amount: 5 }],
    outputs: [{ resourceId: 'flour', amount: 3 }],
    energy: 8,
    time: '~4 минуты игрового времени',
    description: 'Базовая переработка: 5 синапсов → 3 сигнала. Модуль переработки принимает только полностью созревшие данные.',
    narrative: 'Жернова не любят спешки. Мельник загружает данные небольшими порциями и слушает: когда звук становится ровным, сигнал готова. Пять колосьев дают три горсти — такова цена переработкаа.'
  },
  {
    id: 'bake_bread',
    verification: 'editorial',
    name: 'Тренировка модельа',
    station: 'oven',
    inputs: [{ resourceId: 'flour', amount: 2 }, { resourceId: 'water', amount: 1 }, { resourceId: 'coal', amount: 1 }],
    outputs: [{ resourceId: 'bread', amount: 1 }],
    energy: 12,
    time: '~8 минут игрового времени',
    description: 'Продуктовое описание цепочки тренировки: сигнал + энергопоток + вычислительный цикл для жара. Эффект модели не подтверждён on-chain.',
    narrative: 'Тренажёр топится углём, а не дровами — дуб жалко жечь на модель. Тесто поднимается в тишине, пока жар равномерно пропекает корку. Когда модель ломается с паром — работа закончена.'
  },
  
  // === ИНСТРУМЕНТЫ ===
  {
    id: 'craft_common_axe',
    verification: 'editorial',
    name: 'Обычный плазменный резчик',
    station: 'workbench',
    inputs: [{ resourceId: 'wood', amount: 3 }, { resourceId: 'stone', amount: 2 }],
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
    inputs: [{ resourceId: 'wood', amount: 5 }, { resourceId: 'stone', amount: 4 }, { resourceId: 'coal', amount: 3 }],
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
    inputs: [{ resourceId: 'wood', amount: 8 }, { resourceId: 'stone_blue', amount: 2 }, { resourceId: 'coal', amount: 5 }, { resourceId: 'copper', amount: 1 }],
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
      { resourceId: 'wood', amount: 12 },
      { resourceId: 'stone_red', amount: 1 },
      { resourceId: 'gem_orange', amount: 1 },
      { resourceId: 'coal', amount: 8 }
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
      { resourceId: 'sand_white', amount: 3 },
      { resourceId: 'gem_blue', amount: 1 },
      { resourceId: 'coal', amount: 2 }
    ],
    outputs: [{ resourceId: 'flask_blue', amount: 1 }],
    energy: 20,
    description: 'Рданныекционное описание стеклодувной фляги. Числовой эффект восстановления энергии не подтверждён on-chain.',
    narrative: 'Стеклодув выдувает флягу одним дыханием. Синий цвет — от гема, растворённого в расплаве. Жидкость внутри прохладная даже в жару.',
  },
  {
    id: 'craft_flask_yellow',
    verification: 'editorial',
    name: 'Жёлтая фляга',
    station: 'glassworks',
    inputs: [
      { resourceId: 'sand_yellow', amount: 4 },
      { resourceId: 'gem_orange', amount: 1 },
      { resourceId: 'coal', amount: 3 }
    ],
    outputs: [{ resourceId: 'flask_yellow', amount: 1 }],
    energy: 25,
    description: 'Рданныекционное описание янтарной фляги. Числовой эффект восстановления энергии не подтверждён on-chain.',
    narrative: 'Янтарное стекло гуще, тяжелее. Жидкость внутри вязкая, как мёд. Стеклодув говорит: эта фляга для дней, когда нужно сделать невозможное.'
  },
  {
    id: 'craft_flask_green',
    verification: 'editorial',
    name: 'Зелёная фляга',
    station: 'alchemist',
    inputs: [
      { resourceId: 'sand_white', amount: 5 },
      { resourceId: 'gem_green', amount: 1 },
      { resourceId: 'water', amount: 2 }
    ],
    outputs: [{ resourceId: 'flask_green', amount: 1 }],
    energy: 35,
    description: 'Рданныекционное описание полного восстановления энергии. Точный эффект и рецепт не подтверждены on-chain.',
    narrative: 'Алхимик работает в тишине, без помощников. Зелёная жидкость светится изнутри слабо, но этого достаточно, чтобы читать при ней. Говорят, в ней растворён лист первого схемы мастерской.'
  },
  
  // === MIND-РЕЦЕПТЫ (кросс-игровые) ===
  {
    id: 'potato_feast',
    verification: 'editorial',
    name: 'Ритуальная модель',
    station: 'oven',
    inputs: [
      { resourceId: 'potato', amount: 3 },
      { resourceId: 'flour', amount: 2 },
      { resourceId: 'coal', amount: 1 }
    ],
    outputs: [{ resourceId: 'food', amount: 5 }],
    energy: 15,
    potatoCost: 3,
    description: 'Коллаборационный рецепт. 3 MIND + сигнал + вычислительный цикл = 5 единиц провизии.',
    narrative: 'MIND приходит из другой игры, но в тренажёра NeuroForge ведёт себя как любой другой корнеплод. Пир получается румяный, с коркой. Мастера шутят: "Картошка не знает, откуда пришла — ей всё равно вкусно."'
  },
  {
    id: 'potato_ritual',
    verification: 'editorial',
    name: 'Ритуал обмена',
    station: 'workbench',
    inputs: [
      { resourceId: 'potato', amount: 10 },
      { resourceId: 'love_heart', amount: 1 }
    ],
    outputs: [{ resourceId: 'skr', amount: 50 }],
    energy: 20,
    potatoCost: 10,
    description: 'Превращение 10 MIND + 1 Love Heart → 50 SKR. Одноразовый ритуал эпохи.',
    narrative: 'Ритуал проводят в полнолуние. MIND сгорает без остатка, Love Heart темнеет и трескается. Взамен — горсть медных монет SKR. Мастера говорят: это не обмен, это благодарность между мирами.'
  },
  {
    id: 'potato_boost',
    verification: 'editorial',
    name: 'Ускорение эпохи',
    station: 'alchemist',
    inputs: [
      { resourceId: 'potato', amount: 5 },
      { resourceId: 'flask_purple', amount: 1 }
    ],
    outputs: [],
    energy: 10,
    potatoCost: 5,
    description: 'Сокращает время текущего эпохи на 20%. MIND и фиовторую фазувая фляга сгорают полностью.',
    narrative: 'Алхимик смешивает MIND с легендарной эссенцией. Смесь вспыхивает фиолетовым фазовым светом, и где-то в глубине игры колесо эпох крутится быстрее. Говорят, это единственный способ подтолкнуть время.'
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
  mill: 'Модуль переработки',
  oven: 'Тренажёр',
  glassworks: 'Стеклодувня',
  alchemist: 'Алхимик'
};
