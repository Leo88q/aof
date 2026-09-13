import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const steps = [
  { id: 0, npc: "Старый Ферма Джо", avatar: "👴", text: "Здравствуй, сосед! Давно тут никого не было. Ферма заросла, но земля-то помнит руки.", action: "Начать" },
  { id: 1, npc: "Старый Ферма Джо", avatar: "👴", text: "Для начала — добудь немного ресурсов. Без FOOD далеко не уедешь.", action: "Добыть ресурсы" },
  { id: 2, npc: "Старый Ферма Джо", avatar: "👴", text: "Инструменты тут — всё. Без кирки камня не взять, без топора леса.", action: "Получить инструмент" },
  { id: 3, npc: "Старый Ферма Джо", avatar: "👴", text: "Рынок живой — цены дышат. Хочешь купить дешевле — жди пока колос никнет.", action: "Осмотреть рынок" },
  { id: 4, npc: "Старый Ферма Джо", avatar: "👴", text: "Ну, с богом. Ферма твоя — расти её с умом. А я присмотрю.", action: "Начать игру" },
];

interface Props { onComplete: () => void; }

export function OnboardingWizard({ onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];

  function next() {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else onComplete();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-soil-950 z-[100] flex flex-col items-center justify-center p-6">
      <div className="flex gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className={`h-1.5 rounded-full transition-all ${i <= currentStep ? "w-8 bg-wheat-500" : "w-4 bg-soil-700"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="text-center max-w-sm">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-7xl mb-6">
            {step.avatar}
          </motion.div>
          <h2 className="text-wheat-500 font-semibold mb-3">{step.npc}</h2>
          <p className="text-parchment text-lg leading-relaxed">{step.text}</p>
        </motion.div>
      </AnimatePresence>

      <button onClick={next} className="mt-12 px-8 py-4 rounded-3xl bg-wheat-600 text-soil-950 font-bold text-lg active:scale-95 transition-transform shadow-glow">
        {step.action}
      </button>
      <button onClick={onComplete} className="mt-4 text-straw text-sm">Пропустить</button>
    </motion.div>
  );
}
