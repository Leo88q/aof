import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type PageEntry = { key: string; el: React.ReactNode };
type StackState = Record<string, PageEntry[]>;

interface NavCtx {
  tab: string;
  setTab: (t: string) => void;
  stacks: StackState;
  push: (tab: string, key: string, el: React.ReactNode) => void;
  pop: (tab: string) => void;
  popToRoot: (tab: string) => void;
}

const Ctx = createContext<NavCtx | null>(null);

export function NavProvider({
  tabs,
  roots,
  children,
}: {
  tabs: string[];
  roots: Record<string, PageEntry>;
  children: React.ReactNode;
}) {
  const [tab, setTabState] = useState(tabs[0]);
  const [stacks, setStacks] = useState<StackState>(() => {
    const init: StackState = {};
    tabs.forEach((t) => (init[t] = [roots[t]]));
    return init;
  });

  const push = useCallback((t: string, key: string, el: React.ReactNode) => {
    setStacks((s) => ({ ...s, [t]: [...s[t], { key, el }] }));
  }, []);

  const pop = useCallback((t: string) => {
    setStacks((s) => (s[t].length > 1 ? { ...s, [t]: s[t].slice(0, -1) } : s));
  }, []);

  const popToRoot = useCallback((t: string) => {
    setStacks((s) => ({ ...s, [t]: [s[t][0]] }));
  }, []);

  const setTab = useCallback(
    (t: string) => {
      if (t === tab) {
        popToRoot(t);
      } else {
        setTabState(t);
      }
    },
    [tab, popToRoot]
  );

  const value = useMemo(
    () => ({ tab, setTab, stacks, push, pop, popToRoot }),
    [tab, setTab, stacks, push, pop, popToRoot]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNav outside provider");
  return ctx;
}
