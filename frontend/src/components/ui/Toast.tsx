import { useEffect } from "react";
import { createPortal } from "react-dom";
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
    }, type === "error" ? 12000 : 3000);
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

  // Портал на document.body: .app-shell режет overflow, а framer-motion
  // затирал Tailwind -translate-x-1/2 своим transform — тост уезжал вправо.
  // Позиция только left/right, без translate. Ошибка висит дольше, чтобы её прочитать.
  const node = visible && messageLanguage === language ? (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`nf-toast fixed z-[500] top-3 left-3 right-3 mx-auto max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto min-w-0 [overflow-wrap:anywhere] px-4 py-3 rounded-2xl text-sm font-medium shadow-glow ${typeStyles[type]}`}
    >
      <NoticeMsg text={message} />
    </div>
  ) : null;
  if (!node || typeof document === "undefined") return node;
  return createPortal(node, document.body);
}
