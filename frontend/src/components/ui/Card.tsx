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
      className={`bg-soil-850 rounded-3xl shadow-card p-4 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}
