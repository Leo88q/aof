import { motion, AnimatePresence } from "framer-motion";
import { NoticeMsg } from "../visual/NoticeMsg";
import { create } from "zustand";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
  show: (message: string, type?: "success" | "error" | "info") => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: "",
  type: "info",
  visible: false,
  show: (message, type = "info") => {
    set({ message, type, visible: true });
    setTimeout(() => set({ visible: false }), 3000);
  },
  hide: () => set({ visible: false }),
}));

const typeStyles = {
  success: "bg-sprout-600 text-white",
  error: "bg-ember text-white",
  info: "bg-soil-800 text-parchment",
};

export function Toast() {
  const { message, type, visible } = useToast();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-medium shadow-glow z-[200] ${typeStyles[type]}`}
        >
          <NoticeMsg text={message} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
