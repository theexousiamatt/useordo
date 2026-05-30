import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface SidebarCollapseValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseValue | null>(null);

const STORAGE_KEY = "ordo:sidebar-collapsed";

/** Provides persisted collapse/expand state for the application sidebar. */
export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore persistence errors */
    }
  }, []);

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(() => ({ collapsed, toggle, setCollapsed }), [collapsed, toggle, setCollapsed]);

  return <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>;
}

/** Read sidebar collapse state. Falls back to expanded when no provider is present. */
export function useSidebarCollapse(): SidebarCollapseValue {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) return { collapsed: false, toggle: () => {}, setCollapsed: () => {} };
  return ctx;
}
