import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function Card({ children, onClick, className = "" }: CardProps) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`relative bg-soil-850/95 backdrop-blur-md rounded-2xl border border-wheat-500/10 shadow-card p-4 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {/* Neon top edge */}
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-wheat-500/40 to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
}
