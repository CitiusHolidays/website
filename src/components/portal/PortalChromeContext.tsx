"use client";

import { createContext, type ReactNode, use, useEffect, useState } from "react";

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

interface PortalChromeValue {
  navShortcuts?: PortalNavShortcuts;
  savedViewActions: PortalChromeSavedViewActions | null;
  setSavedViewActions: (actions: PortalChromeSavedViewActions | null) => void;
}

interface PortalChromeProviderProps {
  children: ReactNode;
  navShortcuts?: PortalNavShortcuts;
}

interface PortalChromeSavedViewsSyncProps extends PortalChromeSavedViewActions {
  savedViews: PortalSavedView[];
}

const noopSetSavedViewActions = (): void => undefined;

const PortalChromeContext = createContext<PortalChromeValue>({
  navShortcuts: undefined,
  savedViewActions: null,
  setSavedViewActions: noopSetSavedViewActions,
});

export function PortalChromeProvider({ navShortcuts, children }: PortalChromeProviderProps) {
  const [savedViewActions, setSavedViewActions] = useState<PortalChromeSavedViewActions | null>(
    null
  );
  const value = { navShortcuts, savedViewActions, setSavedViewActions };
  return <PortalChromeContext.Provider value={value}>{children}</PortalChromeContext.Provider>;
}

export function usePortalChrome(): PortalChromeValue {
  return use(PortalChromeContext);
}

export function PortalChromeSavedViewsSync({
  savedViews,
  applySavedView,
  saveCurrentView,
  deleteSavedView,
  toggleSavedViewFavorite,
}: PortalChromeSavedViewsSyncProps) {
  const { setSavedViewActions } = usePortalChrome();

  useEffect(() => {
    setSavedViewActions({
      applySavedView,
      deleteSavedView,
      saveCurrentView,
      savedViews,
      toggleSavedViewFavorite,
    });
    return () => setSavedViewActions(null);
  }, [
    savedViews,
    applySavedView,
    saveCurrentView,
    deleteSavedView,
    toggleSavedViewFavorite,
    setSavedViewActions,
  ]);

  return null;
}
