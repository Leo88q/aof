/**
 * Квестодатель "Странник Джо"
 * Генерирует уникальные квесты для каждого игрока на основе шаблонов.
 * Готов к подключению LLM (Eliza) для персонализации.
 */

export interface QuestTemplate {
  id: string;
  type: "gather" | "craft" | "trade" | "explore";
  title: string;
  description: string;
  target: {
    resource?: string;
    amount?: number;
    action?: string;
  };
  reward: {
    potato: number;
    xp: number;
    item?: string;
  };
  difficulty: "easy" | "medium" | "hard";
}

// Шаблоны квестов (можно расширять)
const QUEST_TEMPLATES: QuestTemplate[] = [
  // Сбор ресурсов
  {
    id: "gather_food_1",
    type: "gather",
    title: "Урожай пшеницы",
    description: "Соберите 100 единиц пшеницы для деревенской мельницы",
    target: { resource: "WHEAT", amount: 100 },
    reward: { potato: 50, xp: 10 },
    difficulty: "easy",
  },
  {
    id: "gather_stone_1",
    type: "gather",
    title: "Каменоломня",
    description: "Добудьте 50 камня для строительства",
    target: { resource: "STONE", amount: 50 },
    reward: { potato: 75, xp: 15 },
    difficulty: "medium",
  },
  {
    id: "gather_coal_1",
    type: "gather",
    title: "Угольная шахта",
    description: "Найдите 30 угля для кузницы",
    target: { resource: "COAL", amount: 30 },
    reward: { potato: 100, xp: 20 },
    difficulty: "hard",
  },
  
  // Крафт
  {
    id: "craft_flour_1",
    type: "craft",
    title: "Мельник",
    description: "Смелите 50 муки на мельнице",
    target: { resource: "FLOUR", amount: 50 },
    reward: { potato: 120, xp: 25 },
    difficulty: "medium",
  },
  {
    id: "craft_bread_1",
    type: "craft",
    title: "Пекарь",
    description: "Испеките 20 буханок хлеба",
    target: { resource: "BREAD", amount: 20 },
    reward: { potato: 150, xp: 30 },
    difficulty: "hard",
  },
  
  // Торговля
  {
    id: "trade_buy_1",
    type: "trade",
    title: "Закупщик",
    description: "Купите ресурсы на сумму 0.5 SOL",
    target: { action: "buy", amount: 0.5 },
    reward: { potato: 80, xp: 20 },
    difficulty: "easy",
  },
  {
    id: "trade_sell_1",
    type: "trade",
    title: "Торговец",
    description: "Продайте ресурсы на сумму 1 SOL",
    target: { action: "sell", amount: 1 },
    reward: { potato: 100, xp: 25 },
    difficulty: "medium",
  },
  
  // Исследование
  {
    id: "explore_login_1",
    type: "explore",
    title: "Верный друг",
    description: "Заходите в игру 3 дня подряд",
    target: { action: "streak", amount: 3 },
    reward: { potato: 200, xp: 50 },
    difficulty: "easy",
  },
  {
    id: "explore_compendium_1",
    type: "explore",
    title: "Коллекционер",
    description: "Откройте 5 новых записей в компендиуме",
    target: { action: "compendium", amount: 5 },
    reward: { potato: 150, xp: 40 },
    difficulty: "medium",
  },
];

/**
 * Генерирует 3 случайных квеста для игрока
 * В будущем можно подключить LLM для персонализации
 */
export function generateDailyQuests(userId: string, seed?: number): QuestTemplate[] {
  // Детерминированный shuffle на основе userId (каждый день новые квесты)
  const dayOfYear = Math.floor(Date.now() / 86400000);
  const hash = hashString(userId + dayOfYear);
  
  const shuffled = [...QUEST_TEMPLATES].sort((a, b) => {
    const hashA = hashString(a.id + hash);
    const hashB = hashString(b.id + hash);
    return hashA - hashB;
  });
  
  // Берём 3 квеста разной сложности
  const easy = shuffled.find(q => q.difficulty === "easy");
  const medium = shuffled.find(q => q.difficulty === "medium");
  const hard = shuffled.find(q => q.difficulty === "hard");
  
  return [easy, medium, hard].filter(Boolean) as QuestTemplate[];
}

/**
 * Простой хеш для детерминированного shuffle
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Персонализация квестов (заготовка для LLM)
 * TODO: подключить Eliza/OpenAI для генерации уникальных квестов
 */
export async function generatePersonalizedQuest(
  userId: string,
  playerStats: any
): Promise<QuestTemplate | null> {
  // Пример: если игрок много крафтит — даём квест на крафт
  if (playerStats.craftCount > 10) {
    return {
      id: "personal_master_crafter",
      type: "craft",
      title: "Мастер-ремесленник",
      description: `Странник Джо заметил ваше мастерство. Создайте 5 редких предметов.`,
      target: { action: "craft_rare", amount: 5 },
      reward: { potato: 300, xp: 100, item: "rare_blueprint" },
      difficulty: "hard",
    };
  }
  
  return null;
}
