/**
 * Economy Sandbox V2 — полная симуляция всех игровых механик
 * 
 * Агенты используют:
 * - Фарминг (посадка, полив, сбор)
 * - Крафт (мука, хлеб, мясо, флаконы, инструменты)
 * - Энергия (расходуется на действия)
 * - Rebirth (перерождение с бонусами)
 * - Quests (выполнение квестов)
 * - Trading (orderbook + NPC)
 * - Guilds (совместные действия)
 */

export type ResourceId = 
  | "SEEDS" | "WHEAT" | "FLOUR" | "BREAD"
  | "WOOD" | "STONE" | "COAL" | "MEAT"
  | "WATER" | "FOOD"
  | "FLASK_ENERGY" | "FLASK_GROWTH" | "FLASK_LUCK"
  | "TOOL_HOE" | "TOOL_AXE" | "TOOL_PICKAXE";

type AgentType = 
  | "farmer" | "crafter" | "trader" | "speculator"
  | "alchemist" | "miner" | "hunter" | "guild_master";

type ActionType =
  | "plant" | "water" | "harvest" | "craft" | "trade"
  | "rebirth" | "quest" | "guild_deposit" | "buy_flask" | "repair_tool";

interface ResourceConfig {
  id: ResourceId;
  basePrice: number;
  supplyPerDay: number;
  demandPerDay: number;
  energyCost: number;      // сколько энергии стоит действие
  craftTime: number;       // сколько дней крафтится
  craftFrom?: { resource: ResourceId; amount: number }[];
}

const RESOURCES: Record<ResourceId, ResourceConfig> = {
  // Базовые ресурсы
  SEEDS:  { id: "SEEDS",  basePrice: 0.0001, supplyPerDay: 10000, demandPerDay: 3000, energyCost: 5, craftTime: 0 },
  WHEAT:  { id: "WHEAT",  basePrice: 0.0005, supplyPerDay: 8000,  demandPerDay: 4000, energyCost: 10, craftTime: 3 },
  FLOUR:  { id: "FLOUR",  basePrice: 0.0015, supplyPerDay: 3000,  demandPerDay: 2500, energyCost: 15, craftTime: 1, craftFrom: [{ resource: "WHEAT", amount: 2 }] },
  BREAD:  { id: "BREAD",  basePrice: 0.003,  supplyPerDay: 1500,  demandPerDay: 2000, energyCost: 20, craftTime: 1, craftFrom: [{ resource: "FLOUR", amount: 2 }] },
  WOOD:   { id: "WOOD",   basePrice: 0.0008, supplyPerDay: 5000,  demandPerDay: 2000, energyCost: 12, craftTime: 0 },
  STONE:  { id: "STONE",  basePrice: 0.001,  supplyPerDay: 4000,  demandPerDay: 1800, energyCost: 15, craftTime: 0 },
  COAL:   { id: "COAL",   basePrice: 0.0012, supplyPerDay: 2500,  demandPerDay: 2200, energyCost: 18, craftTime: 0 },
  MEAT:   { id: "MEAT",   basePrice: 0.002,  supplyPerDay: 2000,  demandPerDay: 2500, energyCost: 25, craftTime: 0 },
  WATER:  { id: "WATER",  basePrice: 0.0002, supplyPerDay: 15000, demandPerDay: 8000, energyCost: 3, craftTime: 0 },
  FOOD:   { id: "FOOD",   basePrice: 0.0025, supplyPerDay: 1000,  demandPerDay: 3000, energyCost: 0, craftTime: 0 },
  
  // Флаконы (зелья)
  FLASK_ENERGY: { id: "FLASK_ENERGY", basePrice: 0.005, supplyPerDay: 500, demandPerDay: 800, energyCost: 30, craftTime: 2, craftFrom: [{ resource: "WATER", amount: 3 }, { resource: "FOOD", amount: 1 }] },
  FLASK_GROWTH: { id: "FLASK_GROWTH", basePrice: 0.008, supplyPerDay: 300, demandPerDay: 400, energyCost: 30, craftTime: 2, craftFrom: [{ resource: "WATER", amount: 2 }, { resource: "SEEDS", amount: 5 }] },
  FLASK_LUCK:   { id: "FLASK_LUCK",   basePrice: 0.01,  supplyPerDay: 200, demandPerDay: 300, energyCost: 30, craftTime: 3, craftFrom: [{ resource: "WATER", amount: 2 }, { resource: "MEAT", amount: 2 }] },
  
  // Инструменты
  TOOL_HOE:     { id: "TOOL_HOE",     basePrice: 0.02,  supplyPerDay: 100, demandPerDay: 150, energyCost: 50, craftTime: 5, craftFrom: [{ resource: "WOOD", amount: 5 }, { resource: "STONE", amount: 3 }] },
  TOOL_AXE:     { id: "TOOL_AXE",     basePrice: 0.025, supplyPerDay: 80,  demandPerDay: 120, energyCost: 50, craftTime: 5, craftFrom: [{ resource: "WOOD", amount: 3 }, { resource: "STONE", amount: 5 }] },
  TOOL_PICKAXE: { id: "TOOL_PICKAXE", basePrice: 0.03,  supplyPerDay: 60,  demandPerDay: 100, energyCost: 50, craftTime: 5, craftFrom: [{ resource: "WOOD", amount: 2 }, { resource: "STONE", amount: 8 }, { resource: "COAL", amount: 2 }] },
};

interface Agent {
  id: number;
  type: AgentType;
  wallet: string;
  potato: number;
  sol: number;
  energy: number;          // текущая энергия (макс 100)
  maxEnergy: number;
  inventory: Partial<Record<ResourceId, number>>;
  tools: Partial<Record<ResourceId, number>>;  // инструменты с прочностью
  profit: number;
  rebirthCount: number;    // сколько раз делал rebirth
  questsCompleted: number;
  actionsLog: ActionType[];
  planted: { resource: ResourceId; dayPlanted: number }[];  // что посажено
}

interface SimulationResult {
  days: number;
  totalAgents: number;
  potatoInflation: number;
  priceChanges: Record<ResourceId, number>;
  resourceImbalance: Record<ResourceId, number>;
  warnings: string[];
  recommendations: string[];
  agentStats: {
    totalProfit: number;
    avgProfitPerAgent: number;
    bankruptAgents: number;
    topAgentType: string;
    avgRebirths: number;
    avgQuestsCompleted: number;
    totalActions: number;
    actionBreakdown: Record<ActionType, number>;
  };
  timeline: Array<{
    day: number;
    potatoSupply: number;
    inflation: number;
    activeAgents: number;
    totalEnergy: number;
    totalRebirths: number;
  }>;
  popularResources: Array<{ resource: ResourceId; trades: number }>;
}

function generateAgents(count: number): Agent[] {
  const agents: Agent[] = [];
  const types: AgentType[] = ["farmer", "crafter", "trader", "speculator", "alchemist", "miner", "hunter", "guild_master"];
  const weights = [0.3, 0.2, 0.15, 0.1, 0.1, 0.08, 0.05, 0.02];
  
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
      potato: 100 + Math.random() * 900,
      sol: 0.05 + Math.random() * 0.45,
      energy: 80 + Math.random() * 20,
      maxEnergy: 100,
      inventory: {},
      tools: {},
      profit: 0,
      rebirthCount: 0,
      questsCompleted: 0,
      actionsLog: [],
      planted: [],
    });
  }
  
  return agents;
}

export function runSimulationV2(
  agentCount: number = 1000,
  days: number = 30,
  dailyPotatoMint: number = 50000
): SimulationResult {
  console.log(`🧪 [Sandbox V2] Запуск: ${agentCount} агентов, ${days} дней`);
  
  const agents = generateAgents(agentCount);
  const prices: Record<ResourceId, number> = {} as any;
  const initialPrices: Record<ResourceId, number> = {} as any;
  const supplies: Record<ResourceId, number> = {} as any;
  const actionCounts: Record<ActionType, number> = {
    plant: 0, water: 0, harvest: 0, craft: 0, trade: 0,
    rebirth: 0, quest: 0, guild_deposit: 0, buy_flask: 0, repair_tool: 0,
  };
  const resourceTrades: Record<ResourceId, number> = {} as any;
  
  for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
    prices[resId] = RESOURCES[resId].basePrice;
    initialPrices[resId] = RESOURCES[resId].basePrice;
    supplies[resId] = RESOURCES[resId].supplyPerDay * 3;
    resourceTrades[resId] = 0;
  }
  
  let potatoSupply = 1_000_000;
  let totalRebirths = 0;
  const timeline: SimulationResult["timeline"] = [];
  
  for (let day = 1; day <= days; day++) {
    const initialPotatoSupply = potatoSupply;
    
    // Производство ресурсов
    for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
      supplies[resId] += RESOURCES[resId].supplyPerDay;
    }
    
    potatoSupply += dailyPotatoMint;
    
    // Восстановление энергии у всех агентов
    for (const agent of agents) {
      agent.energy = Math.min(agent.maxEnergy, agent.energy + 20);
    }
    
    // Действия агентов
    for (const agent of agents) {
      if (agent.sol < 0.01 && agent.potato < 10) continue;
      
      simulateAgentDayV2(agent, supplies, prices, actionCounts, resourceTrades, day);
      
      // Rebirth если накопил достаточно
      if (agent.potato > 1000 && Math.random() < 0.1) {
        agent.rebirthCount++;
        totalRebirths++;
        agent.potato -= 500;
        agent.maxEnergy += 10;
        actionCounts.rebirth++;
        agent.actionsLog.push("rebirth");
      }
      
      // Quest completion
      if (Math.random() < 0.2) {
        agent.questsCompleted++;
        agent.potato += 50;
        actionCounts.quest++;
        agent.actionsLog.push("quest");
      }
    }
    
    // Обновление цен
    for (const resId of Object.keys(RESOURCES) as ResourceId[]) {
      const config = RESOURCES[resId];
      const demand = config.demandPerDay;
      const supply = supplies[resId];
      const ratio = demand / Math.max(supply, 1);
      const priceChange = (ratio - 1) * 0.1;
      
      prices[resId] = Math.max(prices[resId] * (1 + priceChange), config.basePrice * 0.5);
      supplies[resId] = Math.max(0, supply - demand);
    }
    
    const avgPrice = Object.values(prices).reduce((a, b) => a + b, 0) / Object.keys(prices).length;
    const inflation = ((potatoSupply - initialPotatoSupply) / initialPotatoSupply) * 100;
    const activeAgents = agents.filter(a => a.sol >= 0.01 || a.potato >= 10).length;
    const totalEnergy = agents.reduce((sum, a) => sum + a.energy, 0);
    
    timeline.push({
      day,
      potatoSupply: Math.round(potatoSupply),
      inflation: Number(inflation.toFixed(2)),
      activeAgents,
      totalEnergy: Math.round(totalEnergy),
      totalRebirths,
    });
  }
  
  // Финальный анализ
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
  
  if (totalPotatoInflation > 100) {
    warnings.push(`🚨 Критическая инфляция: ${totalPotatoInflation.toFixed(0)}%`);
    recommendations.push("Увеличить стоимость крафта или снизить награды");
  }
  
  for (const resId of Object.keys(resourceImbalance) as ResourceId[]) {
    const imbalance = resourceImbalance[resId];
    if (imbalance > 5) {
      warnings.push(`⚠️ Избыток ${resId}: +${(imbalance * 100).toFixed(0)}%`);
    } else if (imbalance < -0.5) {
      warnings.push(`⚠️ Дефицит ${resId}: ${(imbalance * 100).toFixed(0)}%`);
    }
  }
  
  const bankruptAgents = agents.filter(a => a.sol < 0.01 && a.potato < 10).length;
  const typeProfits: Record<AgentType, number> = {} as any;
  for (const agent of agents) {
    typeProfits[agent.type] = (typeProfits[agent.type] || 0) + agent.profit;
  }
  const topType = Object.entries(typeProfits).sort((a, b) => b[1] - a[1])[0][0];
  
  const totalProfit = agents.reduce((sum, a) => sum + a.profit, 0);
  const avgRebirths = agents.reduce((sum, a) => sum + a.rebirthCount, 0) / agentCount;
  const avgQuests = agents.reduce((sum, a) => sum + a.questsCompleted, 0) / agentCount;
  const totalActions = Object.values(actionCounts).reduce((a, b) => a + b, 0);
  
  const popularResources = Object.entries(resourceTrades)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([resource, trades]) => ({ resource: resource as ResourceId, trades }));
  
  return {
    days,
    totalAgents: agentCount,
    potatoInflation: Number(totalPotatoInflation.toFixed(2)),
    priceChanges,
    resourceImbalance,
    warnings,
    recommendations,
    agentStats: {
      totalProfit: Number(totalProfit.toFixed(2)),
      avgProfitPerAgent: Number((totalProfit / agentCount).toFixed(2)),
      bankruptAgents,
      topAgentType: topType,
      avgRebirths: Number(avgRebirths.toFixed(2)),
      avgQuestsCompleted: Number(avgQuests.toFixed(2)),
      totalActions,
      actionBreakdown: actionCounts,
    },
    timeline,
    popularResources,
  };
}

function simulateAgentDayV2(
  agent: Agent,
  supplies: Record<ResourceId, number>,
  prices: Record<ResourceId, number>,
  actionCounts: Record<ActionType, number>,
  resourceTrades: Record<ResourceId, number>,
  currentDay: number
) {
  switch (agent.type) {
    case "farmer":
      // Фармер: сажает, поливает, собирает
      if (agent.energy >= 15 && Math.random() < 0.4) {
        // Посадка
        const seeds = ["SEEDS", "WHEAT"] as ResourceId[];
        const seed = seeds[Math.floor(Math.random() * seeds.length)];
        if ((agent.inventory[seed] || 0) > 0) {
          agent.inventory[seed]!--;
          agent.planted.push({ resource: seed === "SEEDS" ? "WHEAT" : "FLOUR", dayPlanted: currentDay });
          agent.energy -= 15;
          actionCounts.plant++;
          agent.actionsLog.push("plant");
        }
      }
      
      // Полив
      if (agent.energy >= 10 && agent.planted.length > 0 && Math.random() < 0.3) {
        agent.energy -= 10;
        actionCounts.water++;
        agent.actionsLog.push("water");
      }
      
      // Сбор урожая
      const ready = agent.planted.filter(p => currentDay - p.dayPlanted >= RESOURCES[p.resource].craftTime);
      for (const plant of ready) {
        agent.inventory[plant.resource] = (agent.inventory[plant.resource] || 0) + 5;
        agent.planted = agent.planted.filter(p => p !== plant);
        actionCounts.harvest++;
        agent.actionsLog.push("harvest");
      }
      
      // Продажа излишков
      for (const res of ["WHEAT", "FLOUR"] as ResourceId[]) {
        if ((agent.inventory[res] || 0) > 10) {
          const sellAmount = Math.floor((agent.inventory[res] || 0) * 0.5);
          agent.sol += sellAmount * prices[res];
          agent.profit += sellAmount * prices[res];
          agent.inventory[res] = (agent.inventory[res] || 0) - sellAmount;
          resourceTrades[res] += sellAmount;
          actionCounts.trade++;
          agent.actionsLog.push("trade");
        }
      }
      break;
      
    case "crafter":
      // Крафтер: делает муку, хлеб
      const craftPairs: Array<[ResourceId, ResourceId]> = [["WHEAT", "FLOUR"], ["FLOUR", "BREAD"]];
      const [from, to] = craftPairs[Math.floor(Math.random() * craftPairs.length)];
      
      if ((agent.inventory[from] || 0) >= 2 && agent.energy >= RESOURCES[to].energyCost) {
        agent.inventory[from] = (agent.inventory[from] || 0) - 2;
        agent.inventory[to] = (agent.inventory[to] || 0) + 1;
        agent.energy -= RESOURCES[to].energyCost;
        actionCounts.craft++;
        agent.actionsLog.push("craft");
        
        // Продажа
        if ((agent.inventory[to] || 0) > 5) {
          const sellAmount = Math.floor((agent.inventory[to] || 0) * 0.7);
          agent.sol += sellAmount * prices[to];
          agent.profit += sellAmount * (prices[to] - prices[from] * 2);
          agent.inventory[to] = (agent.inventory[to] || 0) - sellAmount;
          resourceTrades[to] += sellAmount;
          actionCounts.trade++;
          agent.actionsLog.push("trade");
        }
      }
      break;
      
    case "alchemist":
      // Алхимик: делает флаконы
      const flaskTypes: ResourceId[] = ["FLASK_ENERGY", "FLASK_GROWTH", "FLASK_LUCK"];
      const flask = flaskTypes[Math.floor(Math.random() * flaskTypes.length)];
      const recipe = RESOURCES[flask].craftFrom;
      
      if (recipe && agent.energy >= RESOURCES[flask].energyCost) {
        const canCraft = recipe.every(r => (agent.inventory[r.resource] || 0) >= r.amount);
        if (canCraft) {
          for (const r of recipe) {
            agent.inventory[r.resource] = (agent.inventory[r.resource] || 0) - r.amount;
          }
          agent.inventory[flask] = (agent.inventory[flask] || 0) + 1;
          agent.energy -= RESOURCES[flask].energyCost;
          actionCounts.craft++;
          agent.actionsLog.push("craft");
          
          // Продажа флаконов
          if ((agent.inventory[flask] || 0) > 3) {
            const sellAmount = Math.floor((agent.inventory[flask] || 0) * 0.8);
            agent.sol += sellAmount * prices[flask] * 1.2; // премия 20%
            agent.profit += sellAmount * prices[flask] * 0.5;
            agent.inventory[flask] = (agent.inventory[flask] || 0) - sellAmount;
            resourceTrades[flask] += sellAmount;
            actionCounts.trade++;
            agent.actionsLog.push("trade");
          }
        }
      }
      break;
      
    case "miner":
      // Шахтёр: добывает камень, уголь
      const mineResources: ResourceId[] = ["STONE", "COAL"];
      const mined = mineResources[Math.floor(Math.random() * mineResources.length)];
      
      if (agent.energy >= RESOURCES[mined].energyCost) {
        const amount = 3 + Math.floor(Math.random() * 5);
        agent.inventory[mined] = (agent.inventory[mined] || 0) + amount;
        agent.energy -= RESOURCES[mined].energyCost;
        
        // Продажа
        const sellAmount = Math.floor(amount * 0.6);
        agent.sol += sellAmount * prices[mined];
        agent.profit += sellAmount * prices[mined];
        agent.inventory[mined] = (agent.inventory[mined] || 0) - sellAmount;
        resourceTrades[mined] += sellAmount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
      break;
      
    case "hunter":
      // Охотник: добывает мясо
      if (agent.energy >= RESOURCES.MEAT.energyCost) {
        const amount = 2 + Math.floor(Math.random() * 4);
        agent.inventory.MEAT = (agent.inventory.MEAT || 0) + amount;
        agent.energy -= RESOURCES.MEAT.energyCost;
        
        const sellAmount = Math.floor(amount * 0.7);
        agent.sol += sellAmount * prices.MEAT;
        agent.profit += sellAmount * prices.MEAT;
        agent.inventory.MEAT = (agent.inventory.MEAT || 0) - sellAmount;
        resourceTrades.MEAT += sellAmount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
      break;
      
    case "trader":
      // Трейдер: покупает дешёвое, продаёт дорогое
      const resources = Object.keys(prices) as ResourceId[];
      const sorted = [...resources].sort((a, b) => prices[a] - prices[b]);
      const cheapest = sorted[0];
      const expensive = sorted[sorted.length - 1];
      
      if (agent.sol > prices[cheapest] * 10) {
        const buyAmount = Math.min(10, agent.sol / (prices[cheapest] * 1.05));
        agent.sol -= buyAmount * prices[cheapest] * 1.05;
        agent.inventory[cheapest] = (agent.inventory[cheapest] || 0) + buyAmount;
        resourceTrades[cheapest] += buyAmount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
      
      if ((agent.inventory[expensive] || 0) > 5) {
        const sellAmount = agent.inventory[expensive] || 0;
        agent.sol += sellAmount * prices[expensive] * 0.95;
        agent.profit += sellAmount * prices[expensive] * 0.9;
        agent.inventory[expensive] = 0;
        resourceTrades[expensive] += sellAmount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
      break;
      
    case "speculator":
      // Спекулянт: покупает флаконы и инструменты
      const specResources: ResourceId[] = ["FLASK_ENERGY", "FLASK_LUCK", "TOOL_HOE"];
      const specRes = specResources[Math.floor(Math.random() * specResources.length)];
      
      if (agent.sol > prices[specRes] * 5 && Math.random() < 0.4) {
        const buyAmount = 3;
        agent.sol -= buyAmount * prices[specRes];
        agent.inventory[specRes] = (agent.inventory[specRes] || 0) + buyAmount;
        resourceTrades[specRes] += buyAmount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
      
      if ((agent.inventory[specRes] || 0) > 5) {
        const sellAmount = Math.floor((agent.inventory[specRes] || 0) * 0.5);
        agent.sol += sellAmount * prices[specRes] * 1.3;
        agent.profit += sellAmount * prices[specRes] * 0.3;
        agent.inventory[specRes] = (agent.inventory[specRes] || 0) - sellAmount;
        resourceTrades[specRes] += sellAmount;
        actionCounts.trade++;
        agent.actionsLog.push("trade");
      }
      break;
      
    case "guild_master":
      // Мастер гильдии: депозитит ресурсы
      if (Math.random() < 0.3) {
        const depositRes = Object.keys(agent.inventory).find(k => (agent.inventory[k as ResourceId] || 0) > 10) as ResourceId;
        if (depositRes) {
          const depositAmount = Math.floor((agent.inventory[depositRes] || 0) * 0.3);
          agent.inventory[depositRes] = (agent.inventory[depositRes] || 0) - depositAmount;
          agent.potato += depositAmount * 10;
          actionCounts.guild_deposit++;
          agent.actionsLog.push("guild_deposit");
        }
      }
      break;
  }
  
  // Покупка флаконов если мало энергии
  if (agent.energy < 30 && agent.sol > prices.FLASK_ENERGY) {
    agent.sol -= prices.FLASK_ENERGY;
    agent.energy = Math.min(agent.maxEnergy, agent.energy + 50);
    actionCounts.buy_flask++;
    agent.actionsLog.push("buy_flask");
  }
}
