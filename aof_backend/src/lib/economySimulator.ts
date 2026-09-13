/**
 * Economy Sandbox — симуляция экономики перед апдейтами
 * Запускает виртуальных агентов на 30 игровых дней.
 * 
 * Цель: обнаружить инфляцию, дисбалансы и эксплойты
 * ДО того как изменения попадут на прод.
 */

// === Типы ресурсов ===
export type ResourceId = 
  | "SEEDS" | "WHEAT" | "FLOUR" | "BREAD"
  | "WOOD" | "STONE" | "COAL" | "MEAT"
  | "WATER" | "FOOD";

// === Конфигурация ресурсов ===
interface ResourceConfig {
  id: ResourceId;
  basePrice: number;      // базовая цена в SOL
  supplyPerDay: number;   // производство в день (весь рынок)
  demandPerDay: number;   // потребление в день
  craftFrom?: { resource: ResourceId; amount: number }; // крафт из
  craftTo?: ResourceId;   // во что крафтится
}

const RESOURCES: Record<ResourceId, ResourceConfig> = {
  SEEDS:  { id: "SEEDS",  basePrice: 0.0001, supplyPerDay: 10000, demandPerDay: 3000 },
  WHEAT:  { id: "WHEAT",  basePrice: 0.0005, supplyPerDay: 8000,  demandPerDay: 4000 },
  FLOUR:  { id: "FLOUR",  basePrice: 0.0015, supplyPerDay: 3000,  demandPerDay: 2500, craftFrom: { resource: "WHEAT", amount: 2 }, craftTo: "BREAD" },
  BREAD:  { id: "BREAD",  basePrice: 0.003,  supplyPerDay: 1500,  demandPerDay: 2000, craftFrom: { resource: "FLOUR", amount: 2 } },
  WOOD:   { id: "WOOD",   basePrice: 0.0008, supplyPerDay: 5000,  demandPerDay: 2000 },
  STONE:  { id: "STONE",  basePrice: 0.001,  supplyPerDay: 4000,  demandPerDay: 1800 },
  COAL:   { id: "COAL",   basePrice: 0.0012, supplyPerDay: 2500,  demandPerDay: 2200 },
  MEAT:   { id: "MEAT",   basePrice: 0.002,  supplyPerDay: 2000,  demandPerDay: 2500 },
  WATER:  { id: "WATER",  basePrice: 0.0002, supplyPerDay: 15000, demandPerDay: 8000 },
  FOOD:   { id: "FOOD",   basePrice: 0.0025, supplyPerDay: 1000,  demandPerDay: 3000 },
};

// === Типы агентов ===
type AgentType = "farmer" | "crafter" | "trader" | "speculator";

interface Agent {
  id: number;
  type: AgentType;
  wallet: string;
  potato: number;        // баланс POTATO
  sol: number;           // баланс SOL
  inventory: Partial<Record<ResourceId, number>>;
  profit: number;        // накопленная прибыль
  strategy: string;
}

interface SimulationResult {
  days: number;
  totalAgents: number;
  potatoInflation: number;      // % за период
  solInflation: number;         // % за период
  priceChanges: Record<ResourceId, number>;  // % изменение цен
  resourceImbalance: Record<ResourceId, number>; // дисбаланс спроса/предложения
  warnings: string[];
  recommendations: string[];
  agentStats: {
    totalProfit: number;
    avgProfitPerAgent: number;
    bankruptAgents: number;
    topAgentType: string;
  };
  timeline: Array<{
    day: number;
    potatoSupply: number;
    avgPrice: number;
    inflation: number;
    activeAgents: number;
  }>;
}

// === Генерация агентов ===
function generateAgents(count: number): Agent[] {
  const agents: Agent[] = [];
  
  const types: AgentType[] = ["farmer", "crafter", "trader", "speculator"];
  const weights = [0.4, 0.3, 0.2, 0.1]; // 40% фермеры, 30% крафтеры, 20% трейдеры, 10% спекулянты
  
  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let type: AgentType = "farmer";
    let cumulative = 0;
    
    for (let j = 0; j < types.length; j++) {
      cumulative += weights[j];
      if (rand < cumulative) {
        type = types[j];
        break;
      }
    }
    
    agents.push({
      id: i,
      type,
      wallet: `AGENT_${i.toString().padStart(4, "0")}`,
      potato: 100 + Math.random() * 900,     // 100-1000 POTATO
      sol: 0.05 + Math.random() * 0.45,       // 0.05-0.5 SOL
      inventory: {},
      profit: 0,
      strategy: getStrategyForType(type),
    });
  }
  
  return agents;
}

function getStrategyForType(type: AgentType): string {
  switch (type) {
    case "farmer":
      return "Производит сырьё (семена, пшеница, вода)";
    case "crafter":
      return "Крафтит полуфабрикаты (мука, хлеб)";
    case "trader":
      return "Торгует на спредах";
    case "speculator":
      return "Покупает в дефиците, продаёт в избытке";
    default:
      return "Базовая стратегия";
  }
}

// === Основной симулятор ===
export function runSimulation(
  agentCount: number = 1000,
  days: number = 30,
  dailyPotatoMint: number = 50000  // сколько POTATO минтится в день (награды, квесты)
): SimulationResult {
  console.log(`🧪 [Sandbox] Запуск симуляции: ${agentCount} агентов, ${days} дней`);
  
  const agents = generateAgents(agentCount);
  
  // Инициализация цен
  const prices: Record<ResourceId, number> = {} as any;
  const initialPrices: Record<ResourceId, number> = {} as any;
  const supplies: Record<ResourceId, number> = {} as any;
  
  for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
    prices[resId] = RESOURCES[resId].basePrice;
    initialPrices[resId] = RESOURCES[resId].basePrice;
    supplies[resId] = RESOURCES[resId].supplyPerDay * 3; // начальный запас на 3 дня
  }
  
  let potatoSupply = 1_000_000; // стартовый supply POTATO
  let solSupply = 500; // стартовый SOL в экономике
  
  const timeline: SimulationResult["timeline"] = [];
  
  // Симуляция по дням
  for (let day = 1; day <= days; day++) {
    const initialPotatoSupply = potatoSupply;
    
    // 1. Производство ресурсов
    for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
      supplies[resId] += RESOURCES[resId].supplyPerDay;
    }
    
    // 2. Минт POTATO (награды, квесты, стики)
    potatoSupply += dailyPotatoMint;
    
    // 3. Действия агентов
    for (const agent of agents) {
      if (agent.sol < 0.01 && agent.potato < 10) continue; // банкрот
      
      simulateAgentDay(agent, supplies, prices);
    }
    
    // 4. Обновление цен на основе спроса/предложения
    for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
      const config = RESOURCES[resId];
      const demand = config.demandPerDay;
      const supply = supplies[resId];
      
      // Цена растёт если спрос > предложение, падает если наоборот
      const ratio = demand / Math.max(supply, 1);
      const priceChange = (ratio - 1) * 0.1; // ±10% за день максимум
      
      prices[resId] = Math.max(
        prices[resId] * (1 + priceChange),
        config.basePrice * 0.5 // минимум 50% от базы
      );
      
      // Потребление
      supplies[resId] = Math.max(0, supply - demand);
    }
    
    // 5. Считаем метрики дня
    const avgPrice = Object.values(prices).reduce((a, b) => a + b, 0) / Object.keys(prices).length;
    const inflation = ((potatoSupply - initialPotatoSupply) / initialPotatoSupply) * 100;
    const activeAgents = agents.filter(a => a.sol >= 0.01 || a.potato >= 10).length;
    
    timeline.push({
      day,
      potatoSupply: Math.round(potatoSupply),
      avgPrice: Number(avgPrice.toFixed(6)),
      inflation: Number(inflation.toFixed(2)),
      activeAgents,
    });
  }
  
  // === Финальный анализ ===
  const priceChanges: Record<ResourceId, number> = {} as any;
  const resourceImbalance: Record<ResourceId, number> = {} as any;
  
  for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
    priceChanges[resId] = ((prices[resId] - initialPrices[resId]) / initialPrices[resId]) * 100;
    
    const config = RESOURCES[resId];
    resourceImbalance[resId] = (supplies[resId] - config.demandPerDay) / config.demandPerDay;
  }
  
  const totalPotatoInflation = ((potatoSupply - 1_000_000) / 1_000_000) * 100;
  
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Анализ инфляции
  if (totalPotatoInflation > 100) {
    warnings.push(`🚨 Критическая инфляция: ${totalPotatoInflation.toFixed(0)}% за ${days} дней`);
    recommendations.push("Увеличить стоимость крафта на 50% или снизить награды за квесты");
  } else if (totalPotatoInflation > 50) {
    warnings.push(`⚠️ Высокая инфляция: ${totalPotatoInflation.toFixed(0)}% за ${days} дней`);
    recommendations.push("Добавить механику сжигания POTATO (репит, улучшения)");
  }
  
  // Анализ дисбалансов
  for (const resId of Object.keys(resourceImbalance) as ResourceId[]) {
    const imbalance = resourceImbalance[resId];
    if (imbalance > 5) {
      warnings.push(`⚠️ Избыток ${resId}: +${(imbalance * 100).toFixed(0)}%`);
      recommendations.push(`Увеличить потребление ${resId} или снизить производство`);
    } else if (imbalance < -0.5) {
      warnings.push(`⚠️ Дефицит ${resId}: ${(imbalance * 100).toFixed(0)}%`);
      recommendations.push(`Увеличить производство ${resId} или снизить потребление`);
    }
  }
  
  // Анализ банкротств
  const bankruptAgents = agents.filter(a => a.sol < 0.01 && a.potato < 10).length;
  if (bankruptAgents > agentCount * 0.2) {
    warnings.push(`🚨 ${((bankruptAgents / agentCount) * 100).toFixed(0)}% агентов обанкротились`);
    recommendations.push("Увеличить стартовый капитал или снизить комиссии");
  }
  
  // Топовая стратегия
  const typeProfits: Record<AgentType, number> = { farmer: 0, crafter: 0, trader: 0, speculator: 0 };
  for (const agent of agents) {
    typeProfits[agent.type] += agent.profit;
  }
  const topType = Object.entries(typeProfits).sort((a, b) => b[1] - a[1])[0][0];
  
  const totalProfit = agents.reduce((sum, a) => sum + a.profit, 0);
  
  return {
    days,
    totalAgents: agentCount,
    potatoInflation: Number(totalPotatoInflation.toFixed(2)),
    solInflation: 0, // TODO: посчитать если есть минт/бёрн SOL
    priceChanges,
    resourceImbalance,
    warnings,
    recommendations,
    agentStats: {
      totalProfit: Number(totalProfit.toFixed(2)),
      avgProfitPerAgent: Number((totalProfit / agentCount).toFixed(2)),
      bankruptAgents,
      topAgentType: topType,
    },
    timeline,
  };
}

// === Логика действий агента за день ===
function simulateAgentDay(
  agent: Agent,
  supplies: Record<ResourceId, number>,
  prices: Record<ResourceId, number>
) {
  switch (agent.type) {
    case "farmer":
      // Фермер производит сырьё
      const rawResources: ResourceId[] = ["SEEDS", "WHEAT", "WATER", "WOOD"];
      const produced = rawResources[Math.floor(Math.random() * rawResources.length)];
      const amount = 5 + Math.floor(Math.random() * 20);
      agent.inventory[produced] = (agent.inventory[produced] || 0) + amount;
      
      // Продаёт 50% произведённого
      const toSell = Math.floor(amount * 0.5);
      agent.sol += toSell * prices[produced];
      agent.profit += toSell * prices[produced];
      agent.inventory[produced] = (agent.inventory[produced] || 0) - toSell;
      break;
      
    case "crafter":
      // Крафтер покупает сырьё и крафтит
      const craftPairs: Array<[ResourceId, ResourceId]> = [
        ["WHEAT", "FLOUR"],
        ["FLOUR", "BREAD"],
      ];
      const [from, to] = craftPairs[Math.floor(Math.random() * craftPairs.length)];
      const craftAmount = Math.min(
        10,
        Math.floor(agent.sol / (prices[from] * 2))
      );
      
      if (craftAmount > 0 && supplies[from] > craftAmount * 2) {
        agent.sol -= craftAmount * 2 * prices[from];
        agent.inventory[to] = (agent.inventory[to] || 0) + craftAmount;
        supplies[from] -= craftAmount * 2;
        
        // Продаёт готовый продукт
        agent.sol += craftAmount * prices[to];
        agent.profit += craftAmount * (prices[to] - prices[from] * 2);
        agent.inventory[to] = Math.max(0, (agent.inventory[to] || 0) - craftAmount);
      }
      break;
      
    case "trader":
      // Трейдер покупает дешёвое, продаёт дорогое
      const resources = Object.keys(prices) as ResourceId[];
      const sorted = [...resources].sort((a, b) => prices[a] - prices[b]);
      const cheapest = sorted[0];
      const expensive = sorted[sorted.length - 1];
      
      if (prices[cheapest] > 0 && agent.sol > prices[cheapest] * 10) {
        const buyAmount = Math.min(10, agent.sol / (prices[cheapest] * 1.05));
        agent.sol -= buyAmount * prices[cheapest] * 1.05; // 5% спред
        agent.inventory[cheapest] = (agent.inventory[cheapest] || 0) + buyAmount;
        
        // Продаём дорогой ресурс
        if ((agent.inventory[expensive] || 0) > 0) {
          const sellAmount = agent.inventory[expensive] || 0;
          agent.sol += sellAmount * prices[expensive] * 0.95; // 5% спред
          agent.profit += sellAmount * prices[expensive] * 0.9;
          agent.inventory[expensive] = 0;
        }
      }
      break;
      
    case "speculator":
      // Спекулянт ставит на рост
      const randomRes = Object.keys(prices)[Math.floor(Math.random() * Object.keys(prices).length)] as ResourceId;
      
      if (Math.random() < 0.3 && agent.sol > prices[randomRes] * 20) {
        // Агрессивная покупка
        const buyAmount = 20;
        agent.sol -= buyAmount * prices[randomRes];
        agent.inventory[randomRes] = (agent.inventory[randomRes] || 0) + buyAmount;
      } else if ((agent.inventory[randomRes] || 0) > 10) {
        // Продажа при росте цены
        const sellAmount = Math.floor((agent.inventory[randomRes] || 0) * 0.5);
        agent.sol += sellAmount * prices[randomRes] * 1.1; // продаём с премией
        agent.profit += sellAmount * prices[randomRes] * 0.1;
        agent.inventory[randomRes] = (agent.inventory[randomRes] || 0) - sellAmount;
      }
      break;
  }
}
