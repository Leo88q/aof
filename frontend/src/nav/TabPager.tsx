import React from "react";
import { motion, PanInfo } from "framer-motion";
import { useNav } from "./NavContext";
import { TAB_KEYS } from "./TabBar";
import { StackView } from "./StackView";

export function TabPager() {
  const { tab, setTab, stacks } = useNav();
  const idx = TAB_KEYS.indexOf(tab);
  const atRoot = stacks[tab].length === 1;

  const onDragEnd = (_: any, info: PanInfo) => {
    if (!atRoot) return;
    if (info.offset.x < -70 && idx < TAB_KEYS.length - 1) {
      setTab(TAB_KEYS[idx + 1]);
    } else if (info.offset.x > 70 && idx > 0) {
      setTab(TAB_KEYS[idx - 1]);
    }
  };

  return (
    <motion.div
      style={{ display: "flex", width: "100%", height: "100%" }}
      animate={{ x: `-${idx * 100}%` }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      drag={atRoot ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={onDragEnd}
    >
      {TAB_KEYS.map((k) => (
        <div key={k} style={{ width: "100%", flexShrink: 0, height: "100%" }}>
          <StackView tabKey={k} />
        </div>
      ))}
    </motion.div>
  );
}
