import type { Recipe } from './schema';

export const recipes: Recipe[] = [
  // === ЦЕПОЧКА ХЛЕБА ===
  {
    id: 'mill_flour',
    name: 'Перемол пшеницы',
    station: 'mill',
    inputs: [{ resourceId: 'wheat', amount: 5 }],
    outputs: [{ resourceId: 'flour', amount: 3 }],
    energy: 8,
    time: '~4 минуты игрового времени',
    description: 'Базовый перемол: 5 пшеницы → 3 муки. Мельница принимает только полностью созревшее зерно.',
    narrative: 'Жернова не любят спешки. Мельник загружает зерно небольшими порциями и слушает: когда звук становится ровным, мука готова. Пять колосьев дают три горсти — такова цена помола.'
  },
  {
    id: 'bake_bread',
    name: 'Выпечка хлеба',
    station: 'oven',
    inputs: [{ resourceId: 'flour', amount: 2 }, { resourceId: 'water', amount: 1 }, { resourceId: 'coal', amount: 1 }],
    outputs: [{ resourceId: 'bread', amount: 1 }],
    energy: 12,
    time: '~8 минут игрового времени',
    description: 'Полная цепочка выпечки: мука + вода + уголь для жара. Один хлеб восстанавливает ~25 энергии.',
    narrative: 'Печь топится углём, а не дровами — дуб жалко жечь на хлеб. Тесто поднимается в тишине, пока жар равномерно пропекает корку. Когда хлеб ломается с паром — работа закончена.'
  },
  
  // === ИНСТРУМЕНТЫ ===
  {
    id: 'craft_common_axe',
    name: 'Обычный топор',
    station: 'workbench',
    inputs: [{ resourceId: 'wood', amount: 3 }, { resourceId: 'stone', amount: 2 }],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 15,
    toolRequired: undefined,
    description: 'Базовый инструмент common-редкости. 20 единиц прочности. Подходит для простых работ.',
    narrative: 'Первый топор ученика: грубое железо, берёзовая рукоять, проволочная обмотка. Он не красив, но работает. Каждый мастер начинал с такого.',
    skrDiscount: true
  },
  {
    id: 'craft_uncommon_axe',
    name: 'Необычный топор',
    station: 'forge',
    inputs: [{ resourceId: 'wood', amount: 5 }, { resourceId: 'stone', amount: 4 }, { resourceId: 'coal', amount: 3 }],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 25,
    description: 'Инструмент uncommon-редкости. Кованая сталь, дубовая рукоять, кожаная обмотка. 20 прочности.',
    narrative: 'Кузнец нагревает сталь до соломенного цвета, бьёт ровно, закаляет в масле. Рукоять пропитана льняным маслом — она переживёт три сезона работы.',
    skrDiscount: true
  },
  {
    id: 'craft_rare_axe',
    name: 'Редкий топор',
    station: 'forge',
    inputs: [{ resourceId: 'wood', amount: 8 }, { resourceId: 'stone_blue', amount: 2 }, { resourceId: 'coal', amount: 5 }, { resourceId: 'copper', amount: 1 }],
    outputs: [{ resourceId: 'tools', amount: 1 }],
    energy: 40,
    description: 'Редкий инструмент. Булатная сталь с медным ошейником. 20 прочности + бонус к определённым действиям.',
    narrative: 'Булат виден невооружённым глазом: узор на стали, как волны на воде. Медный ошейник зеленеет со временем — это не дефект, это патина времени.',
    skrDiscount: true
  },
  {
    id: 'craft_legendary_axe',
    name: 'Легендарный топор',
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
    narrative: 'Метеоритное железо не куётся — оно уговаривается. Кузнец работает три смены, не выходя из кузницы. Готовый топор тёплый на ощупь даже зимой.'
  },
  
  // === ФЛЯГИ ===
  {
    id: 'craft_flask_blue',
    name: 'Синяя фляга',
    station: 'glassworks',
    inputs: [
      { resourceId: 'sand_white', amount: 3 },
      { resourceId: 'gem_blue', amount: 1 },
      { resourceId: 'coal', amount: 2 }
    ],
    outputs: [{ resourceId: 'flask_blue', amount: 1 }],
    energy: 20,
    description: 'Стеклодувная фляга, +30 энергии. Одна доза.',
    narrative: 'Стеклодув выдувает флягу одним дыханием. Синий цвет — от гема, растворённого в расплаве. Жидкость внутри прохладная даже в жару.',
    skrDiscount: true
  },
  {
    id: 'craft_flask_yellow',
    name: 'Жёлтая фляга',
    station: 'glassworks',
    inputs: [
      { resourceId: 'sand_yellow', amount: 4 },
      { resourceId: 'gem_orange', amount: 1 },
      { resourceId: 'coal', amount: 3 }
    ],
    outputs: [{ resourceId: 'flask_yellow', amount: 1 }],
    energy: 25,
    description: 'Янтарная фляга, +50 энергии. Одна доза.',
    narrative: 'Янтарное стекло гуще, тяжелее. Жидкость внутри вязкая, как мёд. Стеклодув говорит: эта фляга для дней, когда нужно сделать невозможное.'
  },
  {
    id: 'craft_flask_green',
    name: 'Зелёная фляга',
    station: 'alchemist',
    inputs: [
      { resourceId: 'sand_white', amount: 5 },
      { resourceId: 'gem_green', amount: 1 },
      { resourceId: 'water', amount: 2 }
    ],
    outputs: [{ resourceId: 'flask_green', amount: 1 }],
    energy: 35,
    description: 'Полное восстановление энергии до 100. Одна доза. Редкий рецепт.',
    narrative: 'Алхимик работает в тишине, без помощников. Зелёная жидкость светится изнутри слабо, но этого достаточно, чтобы читать при ней. Говорят, в ней растворён лист первого дерева мастерской.'
  },
  
  // === POTATO-РЕЦЕПТЫ (кросс-игровые) ===
  {
    id: 'potato_feast',
    name: 'Картофельный пир',
    station: 'oven',
    inputs: [
      { resourceId: 'potato', amount: 3 },
      { resourceId: 'flour', amount: 2 },
      { resourceId: 'coal', amount: 1 }
    ],
    outputs: [{ resourceId: 'food', amount: 5 }],
    energy: 15,
    potatoCost: 3,
    description: 'Коллаборационный рецепт. 3 POTATO + мука + уголь = 5 единиц провизии.',
    narrative: 'POTATO приходит из другой игры, но в печи AOF ведёт себя как любой другой корнеплод. Пир получается румяный, с коркой. Мастера шутят: "Картошка не знает, откуда пришла — ей всё равно вкусно."'
  },
  {
    id: 'potato_ritual',
    name: 'Ритуал обмена',
    station: 'workbench',
    inputs: [
      { resourceId: 'potato', amount: 10 },
      { resourceId: 'love_heart', amount: 1 }
    ],
    outputs: [{ resourceId: 'skr', amount: 50 }],
    energy: 20,
    potatoCost: 10,
    description: 'Превращение 10 POTATO + 1 Love Heart → 50 SKR. Одноразовый ритуал сезона.',
    narrative: 'Ритуал проводят в полнолуние. POTATO сгорает без остатка, Love Heart темнеет и трескается. Взамен — горсть медных монет SKR. Мастера говорят: это не обмен, это благодарность между мирами.'
  },
  {
    id: 'potato_boost',
    name: 'Ускорение сезона',
    station: 'alchemist',
    inputs: [
      { resourceId: 'potato', amount: 5 },
      { resourceId: 'flask_purple', amount: 1 }
    ],
    outputs: [],
    energy: 10,
    potatoCost: 5,
    description: 'Сокращает время текущего сезона на 20%. POTATO и фиолетовая фляга сгорают полностью.',
    narrative: 'Алхимик смешивает POTATO с легендарной эссенцией. Смесь вспыхивает фиолетовым, и где-то в глубине игры колесо сезонов крутится быстрее. Говорят, это единственный способ подтолкнуть время.'
  }
];

export const recipesByStation = new Map<string, Recipe[]>();
for (const r of recipes) {
  const list = recipesByStation.get(r.station) || [];
  list.push(r);
  recipesByStation.set(r.station, list);
}

export const stationNames: Record<string, string> = {
  workbench: 'Верстак',
  forge: 'Кузница',
  mill: 'Мельница',
  oven: 'Печь',
  glassworks: 'Стеклодувня',
  alchemist: 'Алхимик'
};
