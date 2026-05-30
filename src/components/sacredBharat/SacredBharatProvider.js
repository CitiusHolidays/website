"use client";

import { createContext, useContext } from "react";
import { useSacredBharat } from "@/lib/sacredBharat/useSacredBharat";

const SacredBharatContext = createContext(null);

export function SacredBharatProvider({ children }) {
  const value = useSacredBharat();
  return <SacredBharatContext.Provider value={value}>{children}</SacredBharatContext.Provider>;
}

export function useSacredBharatContext() {
  const ctx = useContext(SacredBharatContext);
  if (!ctx) {
    throw new Error("useSacredBharatContext must be used within SacredBharatProvider");
  }
  return ctx;
}
