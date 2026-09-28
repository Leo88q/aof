import React, { useEffect, useState } from "react";
import { motion, PanInfo } from "framer-motion";
import { useNav } from "./NavContext";
import { TAB_KEYS } from "./TabBar";
import { prefetchTab } from "./tabChunks";
import { StackView } from "./StackView";

export function TabPager() {
  const { tab, setTab, stacks } = useNav();
  const idx = TAB_KEYS.indexOf(tab);
  const atRoot = stacks[tab].length === 1;

  // Пейджер держит все вкладки в одной ленте, поэтому раньше все шесть экранов
  // монтировались сразу. Теперь экран поднимается, когда вкладка стала
  // текущей или соседней (сосед нужен для свайпа), и больше не размонтируется —
  // состояние и данные страницы не теряются.
  const [live, setLive] = useState<Record<string, boolean>>(() => ({ [tab]: true }));

  useEffect(() => {
    setLive((prev) => {
      const near = [TAB_KEYS[idx - 1], tab, TAB_KEYS[idx + 1]].filter(Boolean) as string[];
      if (near.every((k) => prev[k])) return prev;
      return { ...prev, ...Object.fromEntries(near.map((k) => [k, true])) };
    });
  }, [tab, idx]);

  useEffect(() => {
    // Соседние вкладки подгружаем, когда браузер освободился: первый свайп
    // не должен ждать сеть. Остальные — только по намерению игрока.
    const near = [TAB_KEYS[idx - 1], TAB_KEYS[idx + 1]].filter(Boolean) as string[];
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => near.forEach(prefetchTab), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => near.forEach(prefetchTab), 2000);
    return () => window.clearTimeout(id);
    // Один раз на старте: дальше соседей подтягивает prefetchTab по кнопке.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {live[k] ? <StackView tabKey={k} /> : null}
        </div>
      ))}
    </motion.div>
  );
}
