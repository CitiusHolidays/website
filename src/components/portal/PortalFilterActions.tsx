"use client";

import type { ReactNode } from "react";
import { PortalFilterActionsContext } from "./portalFilterActionsState";

export function PortalFilterActionsProvider({
  children,
  clearAllFilters,
}: {
  children: ReactNode;
  clearAllFilters: () => void;
}) {
  return (
    <PortalFilterActionsContext value={{ clearAllFilters }}>{children}</PortalFilterActionsContext>
  );
}
