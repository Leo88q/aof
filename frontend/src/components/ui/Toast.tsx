import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NoticeMsg } from "../visual/NoticeMsg";
import { create } from "zustand";
import { useLocale } from "../../i18n/LocaleProvider";
import type { Language } from "../../i18n/translations";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
  messageLanguage: Language | null;
  show: (message: string, type: "success" | "error" | "info", language: Language) => void;
  hide: () => void;
}

let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: "",
  type: "info",
  visible: false,
  messageLanguage: null,
  show: (message, type, language) => {
    if (dismissTimer) clearTimeout(dismissTimer);
    set({ message, type, visible: true, messageLanguage: language });
    dismissTimer = setTimeout(() => {
      dismissTimer = undefined;
      set({ visible: false, messageLanguage: null });
    }, 3000);
  },
  hide: () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    dismissTimer = undefined;
    set({ visible: false, messageLanguage: null });
  },
}));

const typeStyles = {
  success: "bg-sprout-600 text-white",
  error: "bg-ember text-white",
  info: "bg-soil-800 text-parchment",
};

export function Toast() {
  const { message, type, visible, messageLanguage } = useToast();
  const { language } = useLocale();

  useEffect(() => {
    // Discard a previous-language message, including on a rapid switch back.
    if (useToast.getState().messageLanguage !== language) useToast.getState().hide();
  }, [language]);

  return (
    <AnimatePresence>
      {visible && messageLanguage === language && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          role={type === "error" ? "alert" : "status"}
          className={`fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto min-w-0 [overflow-wrap:anywhere] px-5 py-3 rounded-2xl text-center text-sm font-medium shadow-glow z-[200] ${typeStyles[type]}`}
        >
          <NoticeMsg text={message} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
