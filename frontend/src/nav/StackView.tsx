import React from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { useNav } from "./NavContext";

export function StackView({ tabKey }: { tabKey: string }) {
  const { stacks, pop } = useNav();
  const stack = stacks[tabKey];
  const top = stack[stack.length - 1];
  const canPop = stack.length > 1;

  const onDragEnd = (_: any, info: PanInfo) => {
    if (canPop && (info.offset.x > 90 || info.velocity.x > 500)) {
      pop(tabKey);
    }
  };

  return (
    <div className="page-stack">
      <AnimatePresence initial={false}>
        <motion.div
          key={top.key}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="page"
          drag={canPop ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={onDragEnd}
        >
          {top.el}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
