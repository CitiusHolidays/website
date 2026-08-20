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

interface PortalChromeSavedViewsSyncProps {
  applySavedView: NonNullable<PortalChromeSavedViewActions["applySavedView"]>;
  deleteSavedView: NonNullable<PortalChromeSavedViewActions["deleteSavedView"]>;
  saveCurrentView: NonNullable<PortalChromeSavedViewActions["saveCurrentView"]>;
  savedViews: PortalSavedView[];
  toggleSavedViewFavorite: NonNullable<PortalChromeSavedViewActions["toggleSavedViewFavorite"]>;
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
  const handlersRef = useRef({
    applySavedView,
    deleteSavedView,
    saveCurrentView,
    toggleSavedViewFavorite,
  });
  useEffect(() => {
    handlersRef.current = {
      applySavedView,
      deleteSavedView,
      saveCurrentView,
      toggleSavedViewFavorite,
    };
  }, [applySavedView, deleteSavedView, saveCurrentView, toggleSavedViewFavorite]);
  const [stableActions] = useState<Omit<PortalChromeSavedViewActions, "savedViews">>(() => ({
    applySavedView: (...args) => handlersRef.current.applySavedView(...args),
    deleteSavedView: (...args) => handlersRef.current.deleteSavedView(...args),
    saveCurrentView: (...args) => handlersRef.current.saveCurrentView(...args),
    toggleSavedViewFavorite: (...args) => handlersRef.current.toggleSavedViewFavorite(...args),
  }));

  useEffect(() => {
    setSavedViewActions({
      savedViews,
      ...stableActions,
    });
    return () => setSavedViewActions(null);
  }, [savedViews, setSavedViewActions, stableActions]);

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
