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
      className={`nf-chip relative p-4 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {/* Корпус чипа (фаски, кромка, выводы, шелкография) рисует theme/circuit.css */}
      {children}
    </motion.div>
  );
}
