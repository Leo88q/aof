import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocale, LanguageSwitcher } from "../../i18n/LocaleProvider";
import { onboardingCopy } from "../../i18n/onboardingCopy";
import { gameNotices } from "../../i18n/gameNotices";
import { UI_ICONS } from "../../lib/visualAssets";
import { ResourceGlyph } from "../../components/visual/ResourceGlyph";

interface Props { onComplete: () => void; }

export function OnboardingWizard({ onComplete }: Props) {
  const { language } = useLocale();
  const copy = onboardingCopy[language];
  const [currentStep, setCurrentStep] = useState(0);
  const step = copy.steps[currentStep];

  function next() {
    if (currentStep < copy.steps.length - 1) setCurrentStep(currentStep + 1);
    else onComplete();
  }

  return (
    <motion.div lang={language} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-soil-950 z-[100] flex flex-col items-center overflow-y-auto px-4 pb-6 pt-20">
      {/* The first-run overlay covers the game's header, so it must expose its
          own language control. The choice stays shared with the entire app. */}
      <div className="absolute right-4 top-4"><LanguageSwitcher compact /></div>
      <div className="my-auto flex w-full max-w-sm flex-col items-center">
        <span className="sr-only" aria-live="polite">{copy.progress(currentStep + 1, copy.steps.length)}</span>
        <div className="flex gap-2 mb-8" aria-hidden="true">
          {copy.steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i <= currentStep ? "w-8 bg-accent-500" : "w-4 bg-soil-700"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="text-center w-full" aria-live="polite">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mb-6 flex justify-center">
              <ResourceGlyph icon={UI_ICONS.npcOracle} alt="" className="w-10 h-10" />
            </motion.div>
            <h2 className="text-accent-500 font-semibold mb-3">{copy.speaker}</h2>
            <p className="text-parchment text-lg leading-relaxed [overflow-wrap:anywhere]">{step.text}</p>
          </motion.div>
        </AnimatePresence>

        <button type="button" onClick={next} className="mt-10 max-w-full px-8 py-4 rounded-3xl bg-accent-600 text-soil-950 font-bold text-lg active:scale-95 transition-transform shadow-glow [overflow-wrap:anywhere]">
          {step.action}
        </button>
        <button type="button" onClick={onComplete} className="mt-4 text-straw text-sm">{copy.skip}</button>
        {gameNotices[language] && <p className="mt-6 max-w-sm text-center text-xs text-straw [overflow-wrap:anywhere]">{gameNotices[language]}</p>}
      </div>
    </motion.div>
  );
}
