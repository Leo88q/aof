import { Router } from "express";
import { runSimulation } from "../lib/economySimulator";
import { runSimulationV2 } from "../lib/economySimulatorV2";
import { runSimulationV3 } from "../lib/economySimulatorV3";
import { requireAdmin } from "../middleware/adminAuth";

const r = Router();

/**
 * POST /sandbox/run
 * Запуск симуляции экономики
 * 
 * Параметры:
 * - agents: количество агентов (по умолчанию 1000)
 * - days: количество дней (по умолчанию 30)
 * - dailyMint: сколько POTATO минтится в день (по умолчанию 50000)
 */
r.post("/run", requireAdmin, async (req, res) => {
  try {
    const agents = Math.min(Number(req.body.agents) || 1000, 5000); // макс 5000
    const days = Math.min(Number(req.body.days) || 30, 90); // макс 90 дней
    const dailyMint = Math.min(Number(req.body.dailyMint) || 50000, 500000);
    
    console.log(`🧪 [Sandbox] POST /sandbox/run: ${agents} agents, ${days} days, ${dailyMint} daily mint`);
    
    const result = runSimulation(agents, days, dailyMint);
    
    res.json({
      success: true,
      simulation: result,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /sandbox/compare
 * Сравнение двух сценариев (до/после изменения)
 */
r.post("/compare", requireAdmin, async (req, res) => {
  try {
    const scenarioA = {
      agents: Number(req.body.scenarioA?.agents) || 1000,
      days: Number(req.body.scenarioA?.days) || 30,
      dailyMint: Number(req.body.scenarioA?.dailyMint) || 50000,
    };
    
    const scenarioB = {
      agents: Number(req.body.scenarioB?.agents) || 1000,
      days: Number(req.body.scenarioB?.days) || 30,
      dailyMint: Number(req.body.scenarioB?.dailyMint) || 75000,
    };
    
    const resultA = runSimulation(scenarioA.agents, scenarioA.days, scenarioA.dailyMint);
    const resultB = runSimulation(scenarioB.agents, scenarioB.days, scenarioB.dailyMint);
    
    res.json({
      scenarioA: { params: scenarioA, result: resultA },
      scenarioB: { params: scenarioB, result: resultB },
      comparison: {
        inflationDiff: resultB.potatoInflation - resultA.potatoInflation,
        profitDiff: resultB.agentStats.avgProfitPerAgent - resultA.agentStats.avgProfitPerAgent,
        bankruptDiff: resultB.agentStats.bankruptAgents - resultA.agentStats.bankruptAgents,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



/**
 * POST /sandbox/run-v2
 * Расширенная симуляция со всеми игровыми механиками
 */
r.post("/run-v2", requireAdmin, async (req, res) => {
  try {
    const agents = Math.min(Number(req.body.agents) || 1000, 5000);
    const days = Math.min(Number(req.body.days) || 30, 90);
    const dailyMint = Math.min(Number(req.body.dailyMint) || 50000, 500000);
    
    console.log(`🧪 [Sandbox V2] POST /sandbox/run-v2: ${agents} agents, ${days} days`);
    
    const result = runSimulationV2(agents, days, dailyMint);
    
    res.json({
      success: true,
      simulation: result,
      version: "v2",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});



/**
 * POST /sandbox/run-v3
 * ПОЛНАЯ симуляция: 26 ресурсов + инструменты до легендарки + миссии + танки
 */
r.post("/run-v3", requireAdmin, async (req, res) => {
  try {
    const agents = Math.min(Number(req.body.agents) || 1000, 2000);
    const days = Math.min(Number(req.body.days) || 300, 365);
    const dailyMint = Math.min(Number(req.body.dailyMint) || 50000, 500000);
    
    console.log(`🧪 [Sandbox V3] ${agents} agents × ${days} days, mint=${dailyMint}`);
    
    const started = Date.now();
    const result = runSimulationV3(agents, days, dailyMint);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    
    console.log(`🧪 [Sandbox V3] Done in ${elapsed}s`);
    
    res.json({
      success: true,
      simulation: result,
      elapsedSeconds: Number(elapsed),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message, stack: e.stack });
  }
});

export default r;
