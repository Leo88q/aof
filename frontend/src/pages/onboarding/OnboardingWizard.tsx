import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

const steps = [
  { id: 0, npc: "Архивариус", avatar: UI_ICONS.npcOracle, text: "Здравствуй, оператор! Я — Архивариус, хранитель этой нейро-лаборатории. Системы проспали, но ядро помнит всё.", action: "Начать" },
  { id: 1, npc: "Архивариус", avatar: UI_ICONS.npcOracle, text: "Для начала — добудь компоненты. Без DATA далеко не уедешь.", action: "Добыть ресурсы" },
  { id: 2, npc: "Архивариус", avatar: UI_ICONS.npcOracle, text: "Инструменты — это всё. Без плазменного резчика кремния не взять, без дата-харвестера — данных.", action: "Получить инструмент" },
  { id: 3, npc: "Архивариус", avatar: UI_ICONS.npcOracle, text: "Рынок живой — цены дышат. Хочешь купить дешевле — жди, пока нагрузка сети упадёт.", action: "Осмотреть рынок" },
  { id: 4, npc: "Архивариус", avatar: UI_ICONS.npcOracle, text: "Вперёд. Модель твоя — обучай её с умом. А я присмотрю.", action: "Начать игру" },
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
            <ResourceGlyph icon={step.avatar} alt="" className="w-10 h-10" />
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
