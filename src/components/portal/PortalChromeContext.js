"use client";

import { createContext, use, useEffect, useState } from "react";

const PortalChromeContext = createContext({
  navShortcuts: undefined,
  savedViewActions: null,
  setSavedViewActions: () => {},
});

export function PortalChromeProvider({ navShortcuts, children }) {
  const [savedViewActions, setSavedViewActions] = useState(null);
  const value = { navShortcuts, savedViewActions, setSavedViewActions };
  return <PortalChromeContext.Provider value={value}>{children}</PortalChromeContext.Provider>;
}

export function usePortalChrome() {
  return use(PortalChromeContext);
}

export function PortalChromeSavedViewsSync({
  savedViews,
  applySavedView,
  saveCurrentView,
  deleteSavedView,
  toggleSavedViewFavorite,
}) {
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
