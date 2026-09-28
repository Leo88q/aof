import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { useNav } from "./NavContext";
import { ErrorBoundary } from "../components/ErrorBoundary";

export function StackView({ tabKey }: { tabKey: string }) {
  const { stacks, pop } = useNav();
  const stack = stacks[tabKey];
  const top = stack[stack.length - 1];
  const canPop = stack.length > 1;

  // Каждая страница стека — своя прокрутка. Если браузер сохранил позицию
  // (возврат назад, восстановление сеанса), новый экран открывался бы своей
  // серединой: открываем страницу сверху.
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [top.key]);

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
          ref={pageRef}
          drag={canPop ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={onDragEnd}
        >
          {/* Сбой одного экрана не должен размонтировать весь шелл. */}
          <ErrorBoundary label={tabKey}>{top.el}</ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
