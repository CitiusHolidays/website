export const PORTAL_NAV_PERSISTENCE_KEYS = {
  collapsedShortcuts: "portal-nav-collapsed-shortcuts",
  expandedGroups: "portal-nav-expanded-groups",
  expandedShortcuts: "portal-nav-expanded-shortcuts",
} as const;

export interface PortalNavPreferences {
  collapsedShortcuts: Set<string>;
  expandedGroups: Set<string>;
  expandedShortcuts: Set<string>;
}

interface StorageReader {
  getItem: (key: string) => string | null;
}

interface StorageWriter {
  setItem: (key: string, value: string) => void;
}

type PortalNavStorage = StorageReader & StorageWriter;

const SERVER_PORTAL_NAV_PREFERENCES: PortalNavPreferences = {
  collapsedShortcuts: new Set(),
  expandedGroups: new Set(),
  expandedShortcuts: new Set(),
};
const PORTAL_NAV_STORAGE_KEYS = new Set<string>(Object.values(PORTAL_NAV_PERSISTENCE_KEYS));
const portalNavPreferenceListeners = new Set<() => void>();
let portalNavPreferencesSnapshot: PortalNavPreferences | null = null;

function readStoredSet(storage: StorageReader, key: string): Set<string> {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

export function createInitialPortalNavPreferences(): PortalNavPreferences {
  return {
    collapsedShortcuts: new Set(),
    expandedGroups: new Set(),
    expandedShortcuts: new Set(),
  };
}

export function getPortalNavStorage(
  storageAccessor: () => PortalNavStorage | null = () => window.localStorage
): PortalNavStorage | null {
  try {
    return storageAccessor();
  } catch {
    return null;
  }
}

export function readPortalNavPreferences(storage: StorageReader | null): PortalNavPreferences {
  if (!storage) {
    return createInitialPortalNavPreferences();
  }
  return {
    collapsedShortcuts: readStoredSet(storage, PORTAL_NAV_PERSISTENCE_KEYS.collapsedShortcuts),
    expandedGroups: readStoredSet(storage, PORTAL_NAV_PERSISTENCE_KEYS.expandedGroups),
    expandedShortcuts: readStoredSet(storage, PORTAL_NAV_PERSISTENCE_KEYS.expandedShortcuts),
  };
}

export function writePortalNavPreference(
  storage: StorageWriter | null,
  key: (typeof PORTAL_NAV_PERSISTENCE_KEYS)[keyof typeof PORTAL_NAV_PERSISTENCE_KEYS],
  value: Set<string>
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify([...value]));
  } catch {
    // Ignore browser storage failures; navigation remains usable for the current session.
  }
}

export function getPortalNavPreferencesSnapshot(): PortalNavPreferences {
  if (!portalNavPreferencesSnapshot) {
    portalNavPreferencesSnapshot = readPortalNavPreferences(getPortalNavStorage());
  }
  return portalNavPreferencesSnapshot;
}

export function getPortalNavServerSnapshot(): PortalNavPreferences {
  return SERVER_PORTAL_NAV_PREFERENCES;
}

export function subscribePortalNavPreferences(listener: () => void): () => void {
  portalNavPreferenceListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || PORTAL_NAV_STORAGE_KEYS.has(event.key)) {
      portalNavPreferencesSnapshot = readPortalNavPreferences(getPortalNavStorage());
      listener();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    portalNavPreferenceListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function updatePortalNavPreference(
  preference: keyof PortalNavPreferences,
  value: Set<string>
): void {
  portalNavPreferencesSnapshot = {
    ...getPortalNavPreferencesSnapshot(),
    [preference]: new Set(value),
  };
  writePortalNavPreference(getPortalNavStorage(), PORTAL_NAV_PERSISTENCE_KEYS[preference], value);
  for (const listener of portalNavPreferenceListeners) {
    listener();
  }
}
