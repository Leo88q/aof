/**
 * Economy Sandbox V3 — ПОЛНАЯ симуляция игры
 * 
 * ✅ Все 26 ресурсов с процентами дропа
 * ✅ Крафт-дерево инструментов: Basic → Iron → Gold → Crystal → LEGENDARY
 * ✅ Флаконы (5 типов) с выпадением
 * ✅ Миссии и квесты
 * ✅ Танки (хранилища) для ресурсов
 * ✅ Полная статистика: кто дошёл до легендарки и за сколько дней
 * ✅ Инфляция по каждому ресурсу
 * 
 * Designed for: 1000 agents × 300 days
 */

// ═══════════════════════════════════════════
// === 26 РЕСУРСОВ ИГРЫ ===
// ═══════════════════════════════════════════

export type ResourceId =
  // Базовые (5)
  | "SEEDS" | "WHEAT" | "WATER" | "WOOD" | "STONE"
  // Переработанные (5)
  | "FLOUR" | "BREAD" | "COAL" | "MEAT" | "FOOD"
  // Пески (3)
  | "SAND_WHITE" | "SAND_PINK" | "SAND_YELLOW"
  // Редкие камни (3)
  | "STONE_BLUE" | "STONE_PURPLE" | "STONE_RED"
  // Гемы (4)
  | "GEM_BLUE" | "GEM_ORANGE" | "GEM_WHITE" | "GEM_GREEN"
  // Флаконы (5)
  | "FLASK_BLUE" | "FLASK_YELLOW" | "FLASK_GREEN" | "FLASK_PINK" | "FLASK_PURPLE"
  // Специальные (1)
  | "POTATO";

interface ResourceConfig {
  id: ResourceId;
  name: string;
  icon: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
  basePrice: number;        // в SOL
  dropChance: number;       // % выпадения при фарминге
  energyCost: number;       // энергия на добычу
  craftFrom?: { resource: ResourceId; amount: number }[];
  category: "raw" | "processed" | "sand" | "gem_stone" | "gem" | "flask" | "currency";
}

export const RESOURCES: Record<ResourceId, ResourceConfig> = {
  // === Базовые ресурсы (часто выпадают) ===
  SEEDS:      { id: "SEEDS",      name: "Семена",         icon: "🌰", tier: "common",    basePrice: 0.0001, dropChance: 25, energyCost: 3,  category: "raw" },
  WHEAT:      { id: "WHEAT",      name: "Пшеница",        icon: "🌾", tier: "common",    basePrice: 0.0005, dropChance: 20, energyCost: 5,  category: "raw" },
  WATER:      { id: "WATER",      name: "Вода",           icon: "💧", tier: "common",    basePrice: 0.0002, dropChance: 30, energyCost: 2,  category: "raw" },
  WOOD:       { id: "WOOD",       name: "Древесина",      icon: "🪵", tier: "common",    basePrice: 0.0008, dropChance: 15, energyCost: 8,  category: "raw" },
  STONE:      { id: "STONE",      name: "Камень",         icon: "🪨", tier: "common",    basePrice: 0.001,  dropChance: 12, energyCost: 10, category: "raw" },

  // === Переработанные (крафт) ===
  FLOUR:      { id: "FLOUR",      name: "Мука",           icon: "🥣", tier: "uncommon",  basePrice: 0.0015, dropChance: 0,  energyCost: 15, category: "processed", craftFrom: [{ resource: "WHEAT", amount: 2 }] },
  BREAD:      { id: "BREAD",      name: "Хлеб",           icon: "🍞", tier: "uncommon",  basePrice: 0.003,  dropChance: 0,  energyCost: 20, category: "processed", craftFrom: [{ resource: "FLOUR", amount: 2 }, { resource: "WATER", amount: 1 }] },
  COAL:       { id: "COAL",       name: "Уголь",          icon: "⬛", tier: "uncommon",  basePrice: 0.0012, dropChance: 8,  energyCost: 15, category: "raw" },
  MEAT:       { id: "MEAT",       name: "Мясо",           icon: "🍖", tier: "uncommon",  basePrice: 0.002,  dropChance: 6,  energyCost: 20, category: "raw" },
  FOOD:       { id: "FOOD",       name: "Еда",            icon: "🍲", tier: "uncommon",  basePrice: 0.0025, dropChance: 0,  energyCost: 25, category: "processed", craftFrom: [{ resource: "BREAD", amount: 1 }, { resource: "MEAT", amount: 1 }] },

  // === Пески (редкие) ===
  SAND_WHITE:  { id: "SAND_WHITE",  name: "Кварцевый песок", icon: "⚪", tier: "rare", basePrice: 0.004,  dropChance: 4,  energyCost: 18, category: "sand" },
  SAND_PINK:   { id: "SAND_PINK",   name: "Розовый песок",   icon: "💗", tier: "rare", basePrice: 0.006,  dropChance: 3,  energyCost: 20, category: "sand" },
  SAND_YELLOW: { id: "SAND_YELLOW", name: "Янтарный песок",  icon: "🟡", tier: "rare", basePrice: 0.005,  dropChance: 3.5, energyCost: 20, category: "sand" },

  // === Редкие камни ===
  STONE_BLUE:   { id: "STONE_BLUE",   name: "Сапфир-камень",  icon: "🔵", tier: "rare",   basePrice: 0.008,  dropChance: 2.5, energyCost: 25, category: "gem_stone" },
  STONE_PURPLE: { id: "STONE_PURPLE", name: "Аметист-камень", icon: "🟣", tier: "rare",   basePrice: 0.01,   dropChance: 2,   energyCost: 25, category: "gem_stone" },
  STONE_RED:    { id: "STONE_RED",    name: "Рубин-камень",   icon: "🔴", tier: "rare",   basePrice: 0.012,  dropChance: 1.8, energyCost: 28, category: "gem_stone" },

  // === Гемы (эпик) ===
  GEM_BLUE:   { id: "GEM_BLUE",   name: "Сапфир",     icon: "💎", tier: "epic", basePrice: 0.025, dropChance: 1.2, energyCost: 35, category: "gem", craftFrom: [{ resource: "STONE_BLUE", amount: 3 }, { resource: "SAND_WHITE", amount: 2 }] },
  GEM_ORANGE: { id: "GEM_ORANGE", name: "Янтарь",     icon: "🟠", tier: "epic", basePrice: 0.03,  dropChance: 1,   energyCost: 35, category: "gem", craftFrom: [{ resource: "SAND_YELLOW", amount: 3 }, { resource: "COAL", amount: 2 }] },
  GEM_WHITE:  { id: "GEM_WHITE",  name: "Кварц",      icon: "🔮", tier: "epic", basePrice: 0.028, dropChance: 1.1, energyCost: 35, category: "gem", craftFrom: [{ resource: "SAND_WHITE", amount: 5 }] },
  GEM_GREEN:  { id: "GEM_GREEN",  name: "Изумруд",    icon: "🟢", tier: "epic", basePrice: 0.035, dropChance: 0.8, energyCost: 40, category: "gem", craftFrom: [{ resource: "STONE_PURPLE", amount: 3 }, { resource: "SAND_PINK", amount: 2 }] },

  // === Флаконы (эпик, разные эффекты) ===
  FLASK_BLUE:   { id: "FLASK_BLUE",   name: "Зелье энергии", icon: "🧪", tier: "epic", basePrice: 0.005, dropChance: 1.5, energyCost: 30, category: "flask", craftFrom: [{ resource: "WATER", amount: 3 }, { resource: "FOOD", amount: 1 }] },
  FLASK_YELLOW: { id: "FLASK_YELLOW", name: "Зелье газа",    icon: "🧪", tier: "epic", basePrice: 0.007, dropChance: 1.2, energyCost: 30, category: "flask", craftFrom: [{ resource: "WATER", amount: 2 }, { resource: "COAL", amount: 2 }] },
  FLASK_GREEN:  { id: "FLASK_GREEN",  name: "Зелье роста",   icon: "🧪", tier: "epic", basePrice: 0.008, dropChance: 1,   energyCost: 30, category: "flask", craftFrom: [{ resource: "WATER", amount: 2 }, { resource: "SEEDS", amount: 5 }] },
  FLASK_PINK:   { id: "FLASK_PINK",   name: "Зелье любви",   icon: "🧪", tier: "epic", basePrice: 0.009, dropChance: 0.9, energyCost: 32, category: "flask", craftFrom: [{ resource: "WATER", amount: 2 }, { resource: "MEAT", amount: 2 }] },
  FLASK_PURPLE: { id: "FLASK_PURPLE", name: "Зелье удачи",   icon: "🧪", tier: "epic", basePrice: 0.012, dropChance: 0.7, energyCost: 35, category: "flask", craftFrom: [{ resource: "WATER", amount: 2 }, { resource: "GEM_WHITE", amount: 1 }] },

  // === Валюта ===
  POTATO: { id: "POTATO", name: "POTATO", icon: "🥔", tier: "legendary", basePrice: 0.0001, dropChance: 0, energyCost: 0, category: "currency" },
};

// ═══════════════════════════════════════════
// === КРАФТ-ДЕРЕВО ИНСТРУМЕНТОВ ===
// ═══════════════════════════════════════════

export type ToolTier = "basic" | "iron" | "gold" | "crystal" | "legendary";
export type ToolType = "hoe" | "axe" | "pickaxe" | "fishing_rod" | "sword";

interface ToolRecipe {
  tier: ToolTier;
  type: ToolType;
  name: string;
  icon: string;
  power: number;          // множитель эффективности
  craftDays: number;      // сколько дней крафтится
  craftFrom: { resource: ResourceId; amount: number }[];
  requiredToolTier?: ToolTier;  // нужен инструмент предыдущего уровня
}

export const TOOL_RECIPES: ToolRecipe[] = [
  // === BASIC (день 1-5) ===
  { tier: "basic", type: "hoe",         name: "Мотыга",            icon: "🔨", power: 1.0, craftDays: 1, craftFrom: [{ resource: "WOOD", amount: 5 }, { resource: "STONE", amount: 3 }] },
  { tier: "basic", type: "axe",         name: "Топор",             icon: "🪓", power: 1.0, craftDays: 1, craftFrom: [{ resource: "WOOD", amount: 3 }, { resource: "STONE", amount: 5 }] },
  { tier: "basic", type: "pickaxe",     name: "Кирка",             icon: "⛏️", power: 1.0, craftDays: 1, craftFrom: [{ resource: "WOOD", amount: 2 }, { resource: "STONE", amount: 8 }] },
  { tier: "basic", type: "fishing_rod", name: "Удочка",            icon: "🎣", power: 1.0, craftDays: 1, craftFrom: [{ resource: "WOOD", amount: 4 }, { resource: "SEEDS", amount: 2 }] },
  { tier: "basic", type: "sword",       name: "Меч",               icon: "🗡️", power: 1.0, craftDays: 1, craftFrom: [{ resource: "WOOD", amount: 1 }, { resource: "STONE", amount: 6 }] },

  // === IRON (день 10-30) ===
  { tier: "iron", type: "hoe",         name: "Железная мотыга",    icon: "🔨", power: 2.0, craftDays: 3, requiredToolTier: "basic", craftFrom: [{ resource: "STONE", amount: 15 }, { resource: "COAL", amount: 10 }, { resource: "WOOD", amount: 5 }] },
  { tier: "iron", type: "axe",         name: "Железный топор",     icon: "🪓", power: 2.0, craftDays: 3, requiredToolTier: "basic", craftFrom: [{ resource: "STONE", amount: 12 }, { resource: "COAL", amount: 12 }, { resource: "WOOD", amount: 5 }] },
  { tier: "iron", type: "pickaxe",     name: "Железная кирка",     icon: "⛏️", power: 2.5, craftDays: 3, requiredToolTier: "basic", craftFrom: [{ resource: "STONE", amount: 20 }, { resource: "COAL", amount: 15 }, { resource: "WOOD", amount: 3 }] },
  { tier: "iron", type: "sword",       name: "Железный меч",       icon: "🗡️", power: 2.0, craftDays: 3, requiredToolTier: "basic", craftFrom: [{ resource: "STONE", amount: 18 }, { resource: "COAL", amount: 10 }] },

  // === GOLD (день 30-90) ===
  { tier: "gold", type: "hoe",         name: "Золотая мотыга",     icon: "🔨", power: 4.0, craftDays: 5, requiredToolTier: "iron", craftFrom: [{ resource: "SAND_YELLOW", amount: 15 }, { resource: "GEM_ORANGE", amount: 3 }, { resource: "COAL", amount: 20 }] },
  { tier: "gold", type: "pickaxe",     name: "Золотая кирка",      icon: "⛏️", power: 5.0, craftDays: 5, requiredToolTier: "iron", craftFrom: [{ resource: "SAND_YELLOW", amount: 20 }, { resource: "GEM_ORANGE", amount: 5 }, { resource: "COAL", amount: 25 }] },
  { tier: "gold", type: "sword",       name: "Золотой меч",        icon: "🗡️", power: 4.5, craftDays: 5, requiredToolTier: "iron", craftFrom: [{ resource: "SAND_YELLOW", amount: 18 }, { resource: "GEM_ORANGE", amount: 4 }] },

  // === CRYSTAL (день 90-200) ===
  { tier: "crystal", type: "pickaxe",   name: "Кристальная кирка",  icon: "⛏️", power: 8.0, craftDays: 10, requiredToolTier: "gold", craftFrom: [{ resource: "GEM_BLUE", amount: 5 }, { resource: "GEM_WHITE", amount: 5 }, { resource: "SAND_WHITE", amount: 30 }] },
  { tier: "crystal", type: "sword",     name: "Кристальный меч",    icon: "🗡️", power: 8.5, craftDays: 10, requiredToolTier: "gold", craftFrom: [{ resource: "GEM_GREEN", amount: 5 }, { resource: "GEM_WHITE", amount: 3 }, { resource: "SAND_PINK", amount: 25 }] },

  // === LEGENDARY (день 200+) ===
  { tier: "legendary", type: "pickaxe", name: "⭐ ЛЕГЕНДАРНАЯ КИРКА", icon: "⛏️", power: 15.0, craftDays: 20, requiredToolTier: "crystal", craftFrom: [{ resource: "GEM_BLUE", amount: 10 }, { resource: "GEM_GREEN", amount: 10 }, { resource: "GEM_ORANGE", amount: 10 }, { resource: "GEM_WHITE", amount: 10 }, { resource: "STONE_RED", amount: 20 }] },
  { tier: "legendary", type: "sword",   name: "⭐ ЛЕГЕНДАРНЫЙ МЕЧ",   icon: "🗡️", power: 20.0, craftDays: 25, requiredToolTier: "crystal", craftFrom: [{ resource: "GEM_BLUE", amount: 15 }, { resource: "GEM_GREEN", amount: 15 }, { resource: "GEM_ORANGE", amount: 15 }, { resource: "GEM_WHITE", amount: 15 }, { resource: "STONE_PURPLE", amount: 25 }, { resource: "STONE_RED", amount: 25 }] },
];

// ═══════════════════════════════════════════
// === МИССИИ ===
// ═══════════════════════════════════════════

interface Mission {
  id: string;
  name: string;
  icon: string;
  requirement: { type: "resource" | "tool" | "rebirth" | "profit"; target?: ResourceId | ToolTier; amount?: number };
  reward: { potato: number; sol: number; resource?: ResourceId; resourceAmount?: number };
  difficulty: "easy" | "medium" | "hard" | "epic";
}

const MISSIONS: Mission[] = [
  { id: "m1",  name: "Первый урожай",        icon: "🌱", requirement: { type: "resource", target: "WHEAT", amount: 50 },   reward: { potato: 100, sol: 0.01 }, difficulty: "easy" },
  { id: "m2",  name: "Пекарь",               icon: "🍞", requirement: { type: "resource", target: "BREAD", amount: 20 },   reward: { potato: 200, sol: 0.02 }, difficulty: "easy" },
  { id: "m3",  name: "Шахтёр",               icon: "⛏️", requirement: { type: "resource", target: "COAL", amount: 100 },  reward: { potato: 300, sol: 0.03 }, difficulty: "medium" },
  { id: "m4",  name: "Охотник",              icon: "🏹", requirement: { type: "resource", target: "MEAT", amount: 50 },   reward: { potato: 400, sol: 0.04 }, difficulty: "medium" },
  { id: "m5",  name: "Коллекционер песков",  icon: "🏖️", requirement: { type: "resource", target: "SAND_PINK", amount: 30 }, reward: { potato: 500, sol: 0.05, resource: "GEM_GREEN", resourceAmount: 1 }, difficulty: "hard" },
  { id: "m6",  name: "Железный век",         icon: "⚙️", requirement: { type: "tool", target: "iron" },                    reward: { potato: 800, sol: 0.1 }, difficulty: "medium" },
  { id: "m7",  name: "Золотая лихорадка",    icon: "🏆", requirement: { type: "tool", target: "gold" },                    reward: { potato: 2000, sol: 0.3, resource: "GEM_ORANGE", resourceAmount: 3 }, difficulty: "hard" },
  { id: "m8",  name: "Кристальная эра",      icon: "💎", requirement: { type: "tool", target: "crystal" },                 reward: { potato: 5000, sol: 0.8, resource: "FLASK_PURPLE", resourceAmount: 5 }, difficulty: "epic" },
  { id: "m9",  name: "Перерождение",         icon: "🔄", requirement: { type: "rebirth", amount: 1 },                      reward: { potato: 1000, sol: 0.15 }, difficulty: "hard" },
  { id: "m10", name: "Магнат",               icon: "💰", requirement: { type: "profit", amount: 5 },                       reward: { potato: 10000, sol: 1.5 }, difficulty: "epic" },
  { id: "m11", name: "⭐ ЛЕГЕНДА",           icon: "⭐", requirement: { type: "tool", target: "legendary" },               reward: { potato: 50000, sol: 10, resource: "FLASK_PURPLE", resourceAmount: 20 }, difficulty: "epic" },
];

// ═══════════════════════════════════════════
// === АГЕНТЫ ===
// ═══════════════════════════════════════════

type AgentType = "farmer" | "crafter" | "trader" | "speculator" | "alchemist" | "miner" | "hunter" | "guild_master";
type ActionType = "plant" | "water" | "harvest" | "mine" | "hunt" | "fish" | "craft" | "craft_tool" | "trade" | "buy_flask" | "use_flask" | "rebirth" | "mission" | "guild_deposit" | "tank_fill" | "tank_drain";

interface Agent {
  id: number;
  type: AgentType;
  wallet: string;
  potato: number;
  sol: number;
  energy: number;
  maxEnergy: number;
  inventory: Partial<Record<ResourceId, number>>;
  tank: Partial<Record<ResourceId, number>>;   // танк-хранилище (безопасное)
  bestToolTier: ToolTier | null;
  tools: Partial<Record<ToolType, ToolTier>>;
  profit: number;
  totalEarned: number;
  rebirthCount: number;
  missionsCompleted: string[];
  actionsLog: ActionType[];
  dayReachedLegendary: number | null;
  dayReachedCrystal: number | null;
  dayReachedGold: number | null;
  dayReachedIron: number | null;
  planted: { resource: ResourceId; dayPlanted: number }[];
  craftingTool: { recipe: ToolRecipe; startedDay: number } | null;
  totalHarvested: Partial<Record<ResourceId, number>>;
}

interface ResourceStats {
  id: ResourceId;
  totalDropped: number;
  totalCrafted: number;
  totalTraded: number;
  totalConsumed: number;
  finalSupply: number;
  initialPrice: number;
  finalPrice: number;
  priceChange: number;
  inflation: number;
  dropPercentage: number;
  rarityAchieved: number;   // сколько игроков добыли
}

interface ToolStats {
  tier: ToolTier;
  totalCrafted: number;
  agentsReached: number;
  avgDayReached: number | null;
  firstAgentDay: number | null;
}

interface MissionStats {
  id: string;
  name: string;
  completedCount: number;
  completionRate: number;
}

export interface SimulationResultV3 {
  version: "v3";
  days: number;
  totalAgents: number;
  totalActions: number;
  
  // Экономика
  potatoInflation: number;
  potatoSupply: number;
  
  // Статистика по всем ресурсам
  resourceStats: ResourceStats[];
  
  // Статистика по инструментам
  toolStats: ToolStats[];
  legendaryAgents: Array<{
    wallet: string;
    type: AgentType;
    dayReached: number;
    toolType: ToolType;
    totalProfit: number;
  }>;
  
  // Статистика по миссиям
  missionStats: MissionStats[];
  
  // Действия
  actionBreakdown: Record<ActionType, number>;
  
  // Агенты
  agentStats: {
    totalProfit: number;
    avgProfitPerAgent: number;
    bankruptAgents: number;
    topAgentType: string;
    avgRebirths: number;
    avgMissionsCompleted: number;
    maxRebirths: number;
    maxMissions: number;
  };
  
  // Timeline
  timeline: Array<{
    day: number;
    potatoSupply: number;
    inflation: number;
    activeAgents: number;
    legendaryCount: number;
    crystalCount: number;
    goldCount: number;
    ironCount: number;
    totalEnergy: number;
  }>;
  
  warnings: string[];
  recommendations: string[];
}

// ═══════════════════════════════════════════
// === ГЕНЕРАЦИЯ АГЕНТОВ ===
// ═══════════════════════════════════════════

function generateAgents(count: number): Agent[] {
  const agents: Agent[] = [];
  const types: AgentType[] = ["farmer", "crafter", "trader", "speculator", "alchemist", "miner", "hunter", "guild_master"];
  const weights = [0.28, 0.2, 0.15, 0.1, 0.1, 0.08, 0.07, 0.02];
  
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let type: AgentType = "farmer";
    let cumulative = 0;
    for (let j = 0; j < types.length; j++) {
      cumulative += weights[j];
      if (rand < cumulative) { type = types[j]; break; }
    }
    
    const inventory: Partial<Record<ResourceId, number>> = {};
    switch (type) {
      case "farmer":     inventory.SEEDS = 30; inventory.WATER = 50; inventory.WOOD = 10; break;
      case "crafter":    inventory.WHEAT = 20; inventory.FLOUR = 5; inventory.WOOD = 15; inventory.STONE = 10; break;
      case "alchemist":  inventory.WATER = 40; inventory.FOOD = 10; inventory.MEAT = 5; inventory.SEEDS = 10; break;
      case "miner":      inventory.WOOD = 5; inventory.STONE = 15; break;
      case "hunter":     inventory.MEAT = 10; inventory.WOOD = 5; break;
      case "guild_master": inventory.WOOD = 30; inventory.STONE = 25; inventory.WHEAT = 20; break;
      default: break;
    }
    
    agents.push({
      id: i,
      type,
      wallet: `AGENT_${i.toString().padStart(4, "0")}`,
      potato: 200 + Math.random() * 800,
      sol: type === "trader" ? 1 + Math.random() : type === "speculator" ? 1.5 + Math.random() * 1.5 : 0.1 + Math.random() * 0.4,
      energy: 80 + Math.random() * 20,
      maxEnergy: 100,
      inventory,
      tank: {},
      bestToolTier: null,
      tools: {},
      profit: 0,
      totalEarned: 0,
      rebirthCount: 0,
      missionsCompleted: [],
      actionsLog: [],
      dayReachedLegendary: null,
      dayReachedCrystal: null,
      dayReachedGold: null,
      dayReachedIron: null,
      planted: [],
      craftingTool: null,
      totalHarvested: {},
    });
  }
  
  return agents;
}

// ═══════════════════════════════════════════
// === ГЛАВНЫЙ СИМУЛЯТОР ===
// ═══════════════════════════════════════════

export function runSimulationV3(
  agentCount: number = 1000,
  days: number = 300,
  dailyPotatoMint: number = 50000
): SimulationResultV3 {
  console.log(`🧪 [Sandbox V3] ${agentCount} agents × ${days} days`);
  
  const agents = generateAgents(agentCount);
  const prices: Record<ResourceId, number> = {} as any;
  const initialPrices: Record<ResourceId, number> = {} as any;
  const supplies: Record<ResourceId, number> = {} as any;
  
  // Статистика ресурсов
  const resStats: Record<ResourceId, {
    totalDropped: number; totalCrafted: number; totalTraded: number;
    totalConsumed: number; rarityAgents: Set<number>;
  }> = {} as any;
  
  for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
    prices[resId] = RESOURCES[resId].basePrice;
    initialPrices[resId] = RESOURCES[resId].basePrice;
    supplies[resId] = RESOURCES[resId].dropChance > 0 ? 1000 : 100;
    resStats[resId] = {
      totalDropped: 0, totalCrafted: 0, totalTraded: 0,
      totalConsumed: 0, rarityAgents: new Set(),
    };
  }
  
  // Статистика действий
  const actionCounts: Record<ActionType, number> = {
    plant: 0, water: 0, harvest: 0, mine: 0, hunt: 0, fish: 0,
    craft: 0, craft_tool: 0, trade: 0, buy_flask: 0, use_flask: 0,
    rebirth: 0, mission: 0, guild_deposit: 0, tank_fill: 0, tank_drain: 0,
  };
  
  // Статистика инструментов
  const toolCraftCounts: Record<ToolTier, number> = { basic: 0, iron: 0, gold: 0, crystal: 0, legendary: 0 };
  const toolReachedDay: Record<ToolTier, number[]> = { basic: [], iron: [], gold: [], crystal: [], legendary: [] };
  
  // Статистика миссий
  const missionCounts: Record<string, number> = {};
  for (const m of MISSIONS) missionCounts[m.id] = 0;
  
  let potatoSupply = 1_000_000;
  const timeline: SimulationResultV3["timeline"] = [];
  
  // === ЦИКЛ ПО ДНЯМ ===
  for (let day = 1; day <= days; day++) {
    const initialSupply = potatoSupply;
    potatoSupply += dailyPotatoMint;
    
    // Восстановление энергии
    for (const agent of agents) {
      agent.energy = Math.min(agent.maxEnergy, agent.energy + 25);
    }
    
    // Действия агентов
    for (const agent of agents) {
      if (agent.sol < 0.005 && agent.potato < 5) continue;
      simulateAgentDayV3(agent, supplies, prices, resStats, actionCounts, toolCraftCounts, toolReachedDay, missionCounts, day);
    }
    
    // Обновление цен
    for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
      const config = RESOURCES[resId];
      if (config.category === "currency") continue;
      
      const demandFactor = config.dropChance > 0 ? config.dropChance * 100 : 500;
      const ratio = demandFactor / Math.max(supplies[resId], 1);
      const priceChange = (ratio - 1) * 0.05;
      prices[resId] = Math.max(prices[resId] * (1 + priceChange), config.basePrice * 0.3);
      supplies[resId] = Math.max(0, supplies[resId] * 0.95);
    }
    
    // Timeline (каждый день для коротких, каждый 5-й для длинных)
    if (days <= 30 || day % 5 === 0 || day === days) {
      const legendaryCount = agents.filter(a => a.dayReachedLegendary !== null).length;
      const crystalCount = agents.filter(a => a.dayReachedCrystal !== null).length;
      const goldCount = agents.filter(a => a.dayReachedGold !== null).length;
      const ironCount = agents.filter(a => a.dayReachedIron !== null).length;
      
      timeline.push({
        day,
        potatoSupply: Math.round(potatoSupply),
        inflation: Number((((potatoSupply - initialSupply) / initialSupply) * 100).toFixed(2)),
        activeAgents: agents.filter(a => a.sol >= 0.005 || a.potato >= 5).length,
        legendaryCount,
        crystalCount,
        goldCount,
        ironCount,
        totalEnergy: Math.round(agents.reduce((s, a) => s + a.energy, 0)),
      });
    }
    
    if (day % 50 === 0) {
      const leg = agents.filter(a => a.dayReachedLegendary).length;
      console.log(`📅 Day ${day}: legendary=${leg}, supply=${(potatoSupply/1000).toFixed(0)}k`);
    }
  }
  
  // === ФИНАЛЬНЫЙ АНАЛИЗ ===
  const resourceStats: ResourceStats[] = (Object.keys(RESOURCES) as ResourceId[]).map(id => {
    const s = resStats[id];
    const totalDropsAll = Object.values(resStats).reduce((sum, x) => sum + x.totalDropped, 0);
    return {
      id,
      totalDropped: s.totalDropped,
      totalCrafted: s.totalCrafted,
      totalTraded: s.totalTraded,
      totalConsumed: s.totalConsumed,
      finalSupply: Math.round(supplies[id]),
      initialPrice: initialPrices[id],
      finalPrice: Number(prices[id].toFixed(6)),
      priceChange: Number((((prices[id] - initialPrices[id]) / initialPrices[id]) * 100).toFixed(2)),
      inflation: Number((((prices[id] - initialPrices[id]) / initialPrices[id]) * 100).toFixed(2)),
      dropPercentage: totalDropsAll > 0 ? Number(((s.totalDropped / totalDropsAll) * 100).toFixed(3)) : 0,
      rarityAchieved: s.rarityAgents.size,
    };
  });
  
  const toolTierOrder: ToolTier[] = ["basic", "iron", "gold", "crystal", "legendary"];
  const toolStats: ToolStats[] = toolTierOrder.map(tier => {
    const days = toolReachedDay[tier];
    return {
      tier,
      totalCrafted: toolCraftCounts[tier],
      agentsReached: days.length,
      avgDayReached: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      firstAgentDay: days.length > 0 ? Math.min(...days) : null,
    };
  });
  
  const legendaryAgents = agents
    .filter(a => a.dayReachedLegendary !== null)
    .sort((a, b) => (a.dayReachedLegendary || 999) - (b.dayReachedLegendary || 999))
    .slice(0, 20)
    .map(a => ({
      wallet: a.wallet,
      type: a.type,
      dayReached: a.dayReachedLegendary!,
      toolType: Object.entries(a.tools).find(([_, t]) => t === "legendary")?.[0] as ToolType || "pickaxe",
      totalProfit: Number(a.totalEarned.toFixed(3)),
    }));
  
  const missionStats: MissionStats[] = MISSIONS.map(m => ({
    id: m.id,
    name: m.name,
    completedCount: missionCounts[m.id],
    completionRate: Number(((missionCounts[m.id] / agentCount) * 100).toFixed(1)),
  }));
  
  const totalPotatoInflation = ((potatoSupply - 1_000_000) / 1_000_000) * 100;
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  if (totalPotatoInflation > 500) {
    warnings.push(`🚨 Гиперинфляция POTATO: ${totalPotatoInflation.toFixed(0)}%`);
    recommendations.push("Срочно: добавить механику сжигания POTATO");
  }
  
  // Топ избыточных ресурсов
  const oversupplied = resourceStats.filter(r => r.finalSupply > 10000 && r.id !== "POTATO").sort((a, b) => b.finalSupply - a.finalSupply).slice(0, 3);
  for (const r of oversupplied) {
    warnings.push(`⚠️ Избыток ${r.id}: ${r.finalSupply} единиц`);
    recommendations.push(`Увеличить потребление ${r.id} в крафте`);
  }
  
  // Редкие ресурсы которые никто не добыл
  const neverDropped = resourceStats.filter(r => r.rarityAchieved === 0 && RESOURCES[r.id].dropChance > 0);
  for (const r of neverDropped) {
    warnings.push(`❌ ${r.id} никто не добыл (dropChance: ${RESOURCES[r.id].dropChance}%)`);
  }
  
  const bankruptAgents = agents.filter(a => a.sol < 0.005 && a.potato < 5).length;
  const typeProfits: Record<string, number> = {};
  for (const a of agents) typeProfits[a.type] = (typeProfits[a.type] || 0) + a.profit;
  const topType = Object.entries(typeProfits).sort((a, b) => b[1] - a[1])[0][0];
  
  const totalProfit = agents.reduce((s, a) => s + a.profit, 0);
  
  return {
    version: "v3",
    days,
    totalAgents: agentCount,
    totalActions: Object.values(actionCounts).reduce((a, b) => a + b, 0),
    potatoInflation: Number(totalPotatoInflation.toFixed(2)),
    potatoSupply: Math.round(potatoSupply),
    resourceStats,
    toolStats,
    legendaryAgents,
    missionStats,
    actionBreakdown: actionCounts,
    agentStats: {
      totalProfit: Number(totalProfit.toFixed(2)),
      avgProfitPerAgent: Number((totalProfit / agentCount).toFixed(3)),
      bankruptAgents,
      topAgentType: topType,
      avgRebirths: Number((agents.reduce((s, a) => s + a.rebirthCount, 0) / agentCount).toFixed(2)),
      avgMissionsCompleted: Number((agents.reduce((s, a) => s + a.missionsCompleted.length, 0) / agentCount).toFixed(2)),
      maxRebirths: Math.max(...agents.map(a => a.rebirthCount)),
      maxMissions: Math.max(...agents.map(a => a.missionsCompleted.length)),
    },
    timeline,
    warnings,
    recommendations,
  };
}

// ═══════════════════════════════════════════
// === ЛОГИКА ДНЯ АГЕНТА ===
// ═══════════════════════════════════════════

function simulateAgentDayV3(
  agent: Agent,
  supplies: Record<ResourceId, number>,
  prices: Record<ResourceId, number>,
  resStats: Record<ResourceId, { totalDropped: number; totalCrafted: number; totalTraded: number; totalConsumed: number; rarityAgents: Set<number> }>,
  actionCounts: Record<ActionType, number>,
  toolCraftCounts: Record<ToolTier, number>,
  toolReachedDay: Record<ToolTier, number[]>,
  missionCounts: Record<string, number>,
  currentDay: number
) {
  const tierPower: Record<ToolTier, number> = {
    basic: 1,
    iron: 2,
    gold: 4,
    crystal: 8,
    legendary: 15,
  };

  const toolPower = agent.bestToolTier ? tierPower[agent.bestToolTier] : 1;

  const tierOrder: ToolTier[] = ["basic", "iron", "gold", "crystal", "legendary"];

  function getNextTier(): ToolTier | null {
    const currentIdx = agent.bestToolTier ? tierOrder.indexOf(agent.bestToolTier) : -1;
    const nextTier = tierOrder[currentIdx + 1];
    return nextTier || null;
  }

  function getCraftableNextTool(): ToolRecipe | null {
    const nextTier = getNextTier();
    if (!nextTier) return null;

    const candidates = TOOL_RECIPES
      .filter(r => r.tier === nextTier)
      .sort((a, b) => {
        const sumA = a.craftFrom.reduce((s, x) => s + x.amount, 0);
        const sumB = b.craftFrom.reduce((s, x) => s + x.amount, 0);
        return sumA - sumB;
      });

    return candidates.find(recipe =>
      recipe.craftFrom.every(req => (agent.inventory[req.resource] || 0) >= req.amount)
    ) || null;
  }

  function completeToolIfReady() {
    if (!agent.craftingTool) return;

    const recipe = agent.craftingTool.recipe;
    if (currentDay - agent.craftingTool.startedDay < recipe.craftDays) return;

    agent.tools[recipe.type] = recipe.tier;
    agent.bestToolTier = recipe.tier;

    toolCraftCounts[recipe.tier]++;
    toolReachedDay[recipe.tier].push(currentDay);

    actionCounts.craft_tool++;
    agent.actionsLog.push("craft_tool");

    if (recipe.tier === "iron" && !agent.dayReachedIron) agent.dayReachedIron = currentDay;
    if (recipe.tier === "gold" && !agent.dayReachedGold) agent.dayReachedGold = currentDay;
    if (recipe.tier === "crystal" && !agent.dayReachedCrystal) agent.dayReachedCrystal = currentDay;
    if (recipe.tier === "legendary" && !agent.dayReachedLegendary) agent.dayReachedLegendary = currentDay;

    agent.craftingTool = null;
  }

  function startToolCraftIfPossible() {
    if (agent.craftingTool) return false;

    const recipe = getCraftableNextTool();
    if (!recipe) return false;

    for (const req of recipe.craftFrom) {
      agent.inventory[req.resource] = (agent.inventory[req.resource] || 0) - req.amount;
      resStats[req.resource].totalConsumed += req.amount;
    }

    agent.craftingTool = {
      recipe,
      startedDay: currentDay,
    };

    actionCounts.craft++;
    agent.actionsLog.push("craft");

    return true;
  }

  function addResource(resource: ResourceId, amount: number, source: "drop" | "craft" = "drop") {
    agent.inventory[resource] = (agent.inventory[resource] || 0) + amount;
    agent.totalHarvested[resource] = (agent.totalHarvested[resource] || 0) + amount;
    supplies[resource] += amount;

    if (source === "drop") {
      resStats[resource].totalDropped += amount;
    } else {
      resStats[resource].totalCrafted += amount;
    }

    resStats[resource].rarityAgents.add(agent.id);
  }

  function consumeResource(resource: ResourceId, amount: number) {
    agent.inventory[resource] = Math.max(0, (agent.inventory[resource] || 0) - amount);
    resStats[resource].totalConsumed += amount;
  }

  // 1. Сначала завершаем инструмент, если он готов
  completeToolIfReady();

  // 2. Сразу пытаемся начать следующий инструмент ДО любого другого крафта
  startToolCraftIfPossible();

  const hasNextTool = getNextTier() !== null;

  // 3. Посадка семян
  if (agent.energy >= 4 && (agent.inventory.SEEDS || 0) > 0 && Math.random() < 0.55) {
    consumeResource("SEEDS", 1);
    agent.planted.push({
      resource: "WHEAT",
      dayPlanted: currentDay,
    });
    agent.energy -= 4;
    actionCounts.plant++;
    agent.actionsLog.push("plant");
  }

  // 4. Полив
  if (agent.energy >= 2 && agent.planted.length > 0 && (agent.inventory.WATER || 0) > 0 && Math.random() < 0.5) {
    consumeResource("WATER", 1);
    agent.energy -= 2;
    actionCounts.water++;
    agent.actionsLog.push("water");
  }

  // 5. Сбор урожая
  const readyPlants = agent.planted.filter(p => currentDay - p.dayPlanted >= 3);
  if (readyPlants.length > 0) {
    for (const plant of readyPlants) {
      const amount = Math.floor(4 + Math.random() * 4 * toolPower);
      addResource(plant.resource, amount, "drop");
      actionCounts.harvest++;
      agent.actionsLog.push("harvest");
    }

    agent.planted = agent.planted.filter(p => currentDay - p.dayPlanted < 3);
  }

  // 6. Добыча ресурсов
  if (agent.energy >= 8 && Math.random() < 0.9) {
    const drops = rollDrops(toolPower);

    for (const d of drops) {
      addResource(d.resource, d.amount, "drop");
    }

    agent.energy -= 8;

    if (agent.type === "miner") actionCounts.mine++;
    else if (agent.type === "hunter") actionCounts.hunt++;
    else actionCounts.harvest++;

    agent.actionsLog.push("harvest");
  }

  // 7. После добычи снова пытаемся начать инструмент
  // Это важно: ресурс мог выпасть только что.
  startToolCraftIfPossible();

  // 8. Мельница: WHEAT -> FLOUR
  // Мука не мешает инструментам, поэтому её можно делать отдельно.
  if (agent.energy >= 5 && (agent.inventory.WHEAT || 0) >= 2 && Math.random() < 0.45) {
    consumeResource("WHEAT", 2);
    addResource("FLOUR", 1, "craft");
    agent.energy -= 5;
    actionCounts.craft++;
    agent.actionsLog.push("craft");
  }

  // 9. Печка: FLOUR + WATER -> BREAD
  if (agent.energy >= 6 && (agent.inventory.FLOUR || 0) >= 2 && (agent.inventory.WATER || 0) >= 1 && Math.random() < 0.45) {
    consumeResource("FLOUR", 2);
    consumeResource("WATER", 1);
    addResource("BREAD", 1, "craft");
    agent.energy -= 6;
    actionCounts.craft++;
    agent.actionsLog.push("craft");
  }

  // 10. Кухня: BREAD + MEAT -> FOOD
  if (agent.energy >= 6 && (agent.inventory.BREAD || 0) >= 1 && (agent.inventory.MEAT || 0) >= 1 && Math.random() < 0.3) {
    consumeResource("BREAD", 1);
    consumeResource("MEAT", 1);
    addResource("FOOD", 1, "craft");
    agent.energy -= 6;
    actionCounts.craft++;
    agent.actionsLog.push("craft");
  }

  // 11. Крафт нужных гемов для следующего инструмента
  // Это не должно съедать всё подряд — только если гем реально нужен для следующего тира.
  const nextTier = getNextTier();
  if (nextTier && agent.energy >= 8) {
    const nextRecipes = TOOL_RECIPES.filter(r => r.tier === nextTier);
    const neededGems = new Set<ResourceId>();

    for (const recipe of nextRecipes) {
      for (const req of recipe.craftFrom) {
        if (RESOURCES[req.resource].category === "gem") {
          neededGems.add(req.resource);
        }
      }
    }

    for (const gem of neededGems) {
      const cfg = RESOURCES[gem];
      const recipe = cfg.craftFrom;
      if (!recipe) continue;

      const canCraftGem = recipe.every(req => (agent.inventory[req.resource] || 0) >= req.amount);
      if (canCraftGem && Math.random() < 0.5) {
        for (const req of recipe) {
          consumeResource(req.resource, req.amount);
        }
        addResource(gem, 1, "craft");
        agent.energy -= 8;
        actionCounts.craft++;
        agent.actionsLog.push("craft");
        break;
      }
    }
  }

  // 12. Ещё раз пробуем инструмент после крафта гемов
  startToolCraftIfPossible();

  // 13. Флаконы энергии
  if (agent.energy < 25 && agent.sol > prices.FLASK_BLUE * 2) {
    agent.sol -= prices.FLASK_BLUE;
    agent.energy = Math.min(agent.maxEnergy, agent.energy + 60);
    actionCounts.buy_flask++;
    actionCounts.use_flask++;
    resStats.FLASK_BLUE.totalConsumed++;
    agent.actionsLog.push("use_flask");
  }

  // 14. Торговля — теперь НЕ продаём ресурсы для инструментов
  if (Math.random() < 0.08) {
    const blocked: ResourceId[] = [
      "WOOD", "STONE", "COAL",
      "SAND_WHITE", "SAND_PINK", "SAND_YELLOW",
      "STONE_BLUE", "STONE_PURPLE", "STONE_RED",
      "GEM_BLUE", "GEM_ORANGE", "GEM_WHITE", "GEM_GREEN",
    ];

    const sellable = (Object.keys(agent.inventory) as ResourceId[]).filter(r => {
      if (blocked.includes(r)) return false;
      return (agent.inventory[r] || 0) > 150;
    });

    if (sellable.length > 0) {
      const res = sellable[Math.floor(Math.random() * sellable.length)];
      const amount = Math.floor((agent.inventory[res] || 0) * 0.15);

      if (amount > 0) {
        const earned = amount * prices[res] * 1.2;
        agent.sol += earned;
        agent.profit += earned;
        agent.totalEarned += earned;
        agent.inventory[res] = (agent.inventory[res] || 0) - amount;
        resStats[res].totalTraded += amount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
    }
  }

  // 15. Rebirth
  if (agent.potato > 1500 + agent.rebirthCount * 500 && Math.random() < 0.12) {
    agent.potato -= 800 + agent.rebirthCount * 200;
    agent.rebirthCount++;
    agent.maxEnergy += 5;
    agent.energy = agent.maxEnergy;
    actionCounts.rebirth++;
    agent.actionsLog.push("rebirth");
  }

  // 16. Миссии
  for (const mission of MISSIONS) {
    if (agent.missionsCompleted.includes(mission.id)) continue;

    if (checkMissionComplete(agent, mission)) {
      agent.missionsCompleted.push(mission.id);
      agent.potato += mission.reward.potato;
      agent.sol += mission.reward.sol;

      if (mission.reward.resource && mission.reward.resourceAmount) {
        addResource(mission.reward.resource, mission.reward.resourceAmount, "craft");
      }

      missionCounts[mission.id]++;
      actionCounts.mission++;
      agent.actionsLog.push("mission");
      break;
    }
  }
}

// === ДРОП РЕСУРСОВ ===
function rollDrops(toolPower: number): { resource: ResourceId; amount: number }[] {
  const drops: { resource: ResourceId; amount: number }[] = [];
  const droppableResources = (Object.keys(RESOURCES) as ResourceId[]).filter(id => RESOURCES[id].dropChance > 0);
  
  for (const resId of droppableResources) {
    const chance = RESOURCES[resId].dropChance * (1 + (toolPower - 1) * 0.1);  // инструменты повышают дроп на 10% за тир
    if (Math.random() * 100 < chance) {
      const amount = 1 + Math.floor(Math.random() * 3 * toolPower);
      drops.push({ resource: resId, amount });
    }
  }
  
  return drops;
}

// === СЛЕДУЮЩИЙ ИНСТРУМЕНТ ===
function getNextToolToCraft(agent: Agent): ToolRecipe | null {
  const tierOrder: ToolTier[] = ["basic", "iron", "gold", "crystal", "legendary"];
  const currentTierIdx = agent.bestToolTier ? tierOrder.indexOf(agent.bestToolTier) : -1;
  const nextTier = tierOrder[currentTierIdx + 1];
  
  if (!nextTier) return null;
  
  // Выбираем тип инструмента который ещё не скрафтили на этом тире
  const available = TOOL_RECIPES.filter(r => r.tier === nextTier && agent.tools[r.type] !== nextTier);
  if (available.length === 0) return null;
  
  return available[Math.floor(Math.random() * available.length)];
}

// === ПРОВЕРКА МИССИИ ===
function checkMissionComplete(agent: Agent, mission: Mission): boolean {
  const req = mission.requirement;

  switch (req.type) {
    case "resource": {
      const target = req.target as ResourceId;
      const required = req.amount || 0;
      const harvested = agent.totalHarvested[target] || 0;
      const current = agent.inventory[target] || 0;
      return harvested + current >= required;
    }

    case "tool": {
      const tierOrder: ToolTier[] = ["basic", "iron", "gold", "crystal", "legendary"];
      const requiredTier = req.target as ToolTier;
      const requiredIdx = tierOrder.indexOf(requiredTier);
      const currentIdx = agent.bestToolTier ? tierOrder.indexOf(agent.bestToolTier) : -1;
      return currentIdx >= requiredIdx;
    }

    case "rebirth":
      return agent.rebirthCount >= (req.amount || 0);

    case "profit":
      return agent.totalEarned >= (req.amount || 0);

    default:
      return false;
  }
}
