"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  PortalChromeContext,
  type PortalChromeQuickAction,
  type PortalChromeSavedViewActions,
  type PortalNavShortcuts,
  type PortalSavedView,
  usePortalChrome,
} from "./portalChromeState";

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
