"use client";

import { createContext, type ReactNode, use, useEffect, useRef, useState } from "react";

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

interface PortalChromeValue {
  navShortcuts?: PortalNavShortcuts;
  quickAction: PortalChromeQuickAction | null;
  savedViewActions: PortalChromeSavedViewActions | null;
  setQuickAction: (action: PortalChromeQuickAction | null) => void;
  setSavedViewActions: (actions: PortalChromeSavedViewActions | null) => void;
}

interface PortalChromeProviderProps {
  children: ReactNode;
  navShortcuts?: PortalNavShortcuts;
}

interface PortalChromeSavedViewsSyncProps extends PortalChromeSavedViewActions {
  savedViews: PortalSavedView[];
}

interface PortalChromeQuickActionSyncProps {
  label: string;
  onSelect: () => void;
}

const noopSetSavedViewActions = (): void => undefined;
const noopSetQuickAction = (): void => undefined;

const PortalChromeContext = createContext<PortalChromeValue>({
  navShortcuts: undefined,
  quickAction: null,
  savedViewActions: null,
  setQuickAction: noopSetQuickAction,
  setSavedViewActions: noopSetSavedViewActions,
});

export function PortalChromeProvider({ navShortcuts, children }: PortalChromeProviderProps) {
  const [quickAction, setQuickAction] = useState<PortalChromeQuickAction | null>(null);
  const [savedViewActions, setSavedViewActions] = useState<PortalChromeSavedViewActions | null>(
    null
  );
  const value = {
    navShortcuts,
    quickAction,
    savedViewActions,
    setQuickAction,
    setSavedViewActions,
  };
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

export function PortalChromeQuickActionSync({ label, onSelect }: PortalChromeQuickActionSyncProps) {
  const { setQuickAction } = usePortalChrome();
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const action = {
      label,
      run: () => onSelectRef.current(),
    };
    setQuickAction(action);
    return () => setQuickAction(null);
  }, [label, setQuickAction]);

  return null;
}
