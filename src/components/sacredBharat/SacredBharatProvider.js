"use client";

import { createContext, use } from "react";

const SacredBharatContext = createContext(null);

export function useSacredBharatContext() {
  const ctx = use(SacredBharatContext);
  if (!ctx) {
    throw new Error("useSacredBharatContext must be used within SacredBharatProvider");
  }
  return ctx;
}
