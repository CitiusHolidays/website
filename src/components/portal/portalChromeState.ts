"use client";

import { createContext, use } from "react";

export interface PortalNavShortcut {
  href: string;
  id: string;
  label: string;
}

export type PortalNavShortcuts = Record<string, PortalNavShortcut[]>;

export interface PortalSavedView {
  id: string;
  isFavorite?: boolean;
  name: string;
}

export interface PortalChromeSavedViewActions {
  applySavedView?: (view: PortalSavedView) => void;
  deleteSavedView?: (view: PortalSavedView) => void | Promise<void>;
  saveCurrentView?: (name: string, options?: Record<string, unknown>) => Promise<void>;
  savedViews?: PortalSavedView[];
  toggleSavedViewFavorite?: (view: PortalSavedView) => void | Promise<void>;
}

export interface PortalChromeQuickAction {
  label: string;
  run: () => void;
}

export interface PortalChromeValue {
  navShortcuts?: PortalNavShortcuts;
  quickAction: PortalChromeQuickAction | null;
  savedViewActions: PortalChromeSavedViewActions | null;
  setQuickAction: (action: PortalChromeQuickAction | null) => void;
  setSavedViewActions: (actions: PortalChromeSavedViewActions | null) => void;
}

const noopSetSavedViewActions = (): void => undefined;
const noopSetQuickAction = (): void => undefined;

export const PortalChromeContext = createContext<PortalChromeValue>({
  navShortcuts: undefined,
  quickAction: null,
  savedViewActions: null,
  setQuickAction: noopSetQuickAction,
  setSavedViewActions: noopSetSavedViewActions,
});

export function usePortalChrome(): PortalChromeValue {
  return use(PortalChromeContext);
}
