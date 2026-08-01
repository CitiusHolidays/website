"use client";

import { createContext, type ReactNode, useContext } from "react";

export interface PortalAccessSnapshot {
  allowed?: boolean;
  email?: string;
  name?: string;
  permissions?: string[];
  roles?: string[];
}

const PortalAccessContext = createContext<PortalAccessSnapshot | undefined>(undefined);

export function PortalAccessProvider({
  access,
  children,
}: {
  access: PortalAccessSnapshot;
  children: ReactNode;
}) {
  return <PortalAccessContext value={access}>{children}</PortalAccessContext>;
}

export function usePortalServerAccess() {
  return useContext(PortalAccessContext);
}
