"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  type PortalAccessSnapshot,
  usePortalServerAccess,
} from "@/components/portal/PortalAccessContext";
import { PortalCommandPaletteRoot } from "@/components/portal/PortalCommandPalette";
import { usePortalChrome } from "@/components/portal/portalChromeState";
import { getAccessibleNavGroups } from "@/lib/portal/permissions";

/**
 * The sidebar's pages for the command palette. The shell resolves photo booth access separately
 * from staff access, so it is read from the shell here; without it the palette omits the booth
 * even when the sidebar shows it. `access` defaults to the shell's staff access.
 */
export function usePortalPaletteNavGroups(access?: PortalAccessSnapshot) {
  const shellAccess = usePortalServerAccess();
  const staffAccess = access ?? shellAccess;
  return staffAccess ? getAccessibleNavGroups(staffAccess, shellAccess?.eventPhotoBooth) : [];
}

/**
 * The command palette for portal pages that do not render `PortalWorkspace` (Job Card command
 * centre, travel schedule, external tour managers, post-tour feedback, not found). It offers the
 * same navigation and recent records as the workspace palette; create and filter actions belong to
 * workspace views, so they are not offered here.
 */
export default function PortalNavigationPalette({ children }: { children: ReactNode }) {
  const { navShortcuts } = usePortalChrome();
  const pathname = usePathname();
  const navGroups = usePortalPaletteNavGroups();
  return (
    <PortalCommandPaletteRoot
      onSaveView={undefined}
      workspace={{ navGroups, navShortcuts, pathname }}
    >
      {children}
    </PortalCommandPaletteRoot>
  );
}
