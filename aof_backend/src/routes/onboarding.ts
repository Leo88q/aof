import { Router } from "express";
import { db } from "../lib/db";
import { requireWalletProof } from "../security/walletProof";

const r = Router();

const ONBOARDING_STEPS = [
  { step: 0, title: "Добро пожаловать на ферму", action: "welcome" },
  { step: 1, title: "Добудь первый ресурс", action: "first_mining" },
  { step: 2, title: "Получи первый инструмент", action: "first_tool" },
  { step: 3, title: "Ознакомься с рынком", action: "market_overview" },
  { step: 4, title: "Скрафти первый апгрейд", action: "first_craft" },
];

// Получить текущее состояние онбординга
r.get("/:user", async (req, res) => {
  try {
    const user = req.params.user;
    let state = await db.onboardingState.findUnique({ where: { user } });
    if (!state) {
      state = await db.onboardingState.create({ data: { user } });
    }
    const steps = ONBOARDING_STEPS.map((s) => ({
      ...s,
      done: s.step < state!.step,
      current: s.step === state!.step,
    }));
    res.json({ step: state.step, completed: state.completed, steps });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Завершить шаг онбординга
r.post("/step/complete", requireWalletProof("onboarding_step", "user"), async (req, res) => {
  try {
    const { user, step } = req.body;
    const state = await db.onboardingState.findUnique({ where: { user } });
    if (!state) return res.status(404).json({ error: "Onboarding not started" });
    if (step !== state.step) {
      return res.status(400).json({ error: "Steps must be completed in order" });
    }
    const newStep = state.step + 1;
    const completed = newStep >= ONBOARDING_STEPS.length;
    const updated = await db.onboardingState.update({
      where: { user },
      data: { step: newStep, completed },
    });
    res.json({ step: updated.step, completed, reward: completed ? { type: "onboarding_bonus" } : null });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default r;
