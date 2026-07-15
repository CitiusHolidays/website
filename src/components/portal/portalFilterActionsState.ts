"use client";

import { createContext, use } from "react";

export interface PortalFilterActionsValue {
  clearAllFilters?: () => void;
}

export const PortalFilterActionsContext = createContext<PortalFilterActionsValue>({});

export function usePortalFilterActions(): PortalFilterActionsValue {
  return use(PortalFilterActionsContext);
}
