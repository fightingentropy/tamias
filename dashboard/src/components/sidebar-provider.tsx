"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const SidebarContext = createContext({ expanded: true, toggle: () => {} });
const STORAGE_KEY = "tamias.sidebar.collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(STORAGE_KEY) !== "true");
    } catch {
      // Keep labelled navigation when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", expanded ? "232px" : "70px");
  }, [expanded]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(!next));
    } catch {
      // The preference still applies for this visit.
    }
  };

  return <SidebarContext.Provider value={{ expanded, toggle }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  return useContext(SidebarContext);
}
