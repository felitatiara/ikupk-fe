"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type ViewType = "beranda" | "monitoring";

interface ViewContextType {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ViewType>("beranda");

  return (
    <ViewContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error("useView must be used within ViewProvider");
  }
  return context;
}
