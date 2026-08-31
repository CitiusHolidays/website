"use client";

import { createContext, type ReactNode, use, useState } from "react";
import type { SavedViewRecord } from "@/components/portal/workspace/workspaceStateTypes";
import type { PortalTableLayoutCommand } from "@/lib/portal/portalTanStackTableEquivalence";
import {
  normalizePortalTableLayoutState,
  type PortalTableLayoutState,
} from "@/lib/portal/tableLayoutPresets";

interface ScopedLayoutCommandEntry {
  command: PortalTableLayoutCommand | null;
  presetId: null | string;
  view: string;
}

export function usePortalTableLayoutRegistry(view: string) {
  const [entries, setEntries] = useState<Map<string, ScopedLayoutCommandEntry>>(() => new Map());
  const applyLayoutPreset = (preset: SavedViewRecord) => {
    const layout = normalizePortalTableLayoutState(preset.filterState);
    if (!layout) {
      return;
    }
    setEntries((current) => {
      const currentEntry = current.get(layout.scope);
      const next = new Map(current);
      next.set(layout.scope, {
        command: { id: (currentEntry?.command?.id ?? 0) + 1, layout, scope: layout.scope },
        presetId: preset.id,
        view,
      });
      return next;
    });
  };
  const clearActivePreset = (presetId: string) =>
    setEntries((current) => {
      let next: Map<string, ScopedLayoutCommandEntry> | null = null;
      for (const [scope, entry] of current) {
        if (entry.presetId === presetId) {
          next ??= new Map(current);
          next.set(scope, { ...entry, presetId: null });
        }
      }
      return next ?? current;
    });
  const acknowledgeLayoutCommand = (scope: string, commandId: number) =>
    setEntries((current) => {
      const entry = current.get(scope);
      if (entry?.command?.id !== commandId) {
        return current;
      }
      const next = new Map(current);
      next.set(scope, { ...entry, command: null });
      return next;
    });
  const getActivePresetId = (scope: null | string) => {
    const entry = scope ? entries.get(scope) : undefined;
    return entry?.view === view ? entry.presetId : null;
  };
  const getLayoutCommand = (scope: null | string) => {
    const entry = scope ? entries.get(scope) : undefined;
    return entry?.view === view ? entry.command : null;
  };
  const resetLayout = (scope: string) =>
    setEntries((current) => {
      const currentEntry = current.get(scope);
      const next = new Map(current);
      next.set(scope, {
        command: { id: (currentEntry?.command?.id ?? 0) + 1, layout: null, scope },
        presetId: null,
        view,
      });
      return next;
    });
  return {
    acknowledgeLayoutCommand,
    applyLayoutPreset,
    clearActivePreset,
    getActivePresetId,
    getLayoutCommand,
    registryKey: view,
    resetLayout,
  };
}

export interface PortalTableLayoutContextValue {
  acknowledgeLayoutCommand?: (scope: string, commandId: number) => void;
  applyLayoutPreset: (preset: SavedViewRecord) => void;
  deleteLayoutPreset: (
    preset: SavedViewRecord,
    focusOrigin?: HTMLElement | null
  ) => void | Promise<void>;
  getActivePresetId: (scope: null | string) => null | string;
  getLayoutCommand: (scope: null | string) => PortalTableLayoutCommand | null;
  layoutPresets: readonly SavedViewRecord[];
  registryKey?: string;
  requestSaveLayout: (layout: Pick<PortalTableLayoutState, "columns" | "scope" | "sort">) => void;
  resetLayout: (scope: string) => void;
}

const PortalTableLayoutContext = createContext<PortalTableLayoutContextValue | null>(null);

export function PortalTableLayoutProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PortalTableLayoutContextValue;
}) {
  return (
    <PortalTableLayoutContext.Provider value={value}>{children}</PortalTableLayoutContext.Provider>
  );
}

export function usePortalTableLayout(): PortalTableLayoutContextValue | null {
  return use(PortalTableLayoutContext);
}
