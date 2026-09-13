import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
}

// Число плавно тикает от старого к новому значению
export function AnimatedCounter({ value, duration = 800, suffix = "" }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;

    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    prevValue.current = end;
  }, [value, duration]);

  return (
    <motion.span
      key={display}
      initial={{ scale: 1.05 }}
      animate={{ scale: 1 }}
      className="tabular-nums"
    >
      {display.toLocaleString()}{suffix}
    </motion.span>
  );
}
