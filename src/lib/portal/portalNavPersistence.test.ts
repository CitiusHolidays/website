import { describe, expect, test } from "bun:test";
import {
  createInitialPortalNavPreferences,
  getPortalNavPreferencesSnapshot,
  getPortalNavServerSnapshot,
  getPortalNavStorage,
  readPortalNavPreferences,
  updatePortalNavPreference,
  writePortalNavPreference,
} from "./portalNavPersistence";

describe("portal navigation persistence", () => {
  test("starts with deterministic empty preferences before client storage is restored", () => {
    expect(createInitialPortalNavPreferences()).toEqual({
      collapsedShortcuts: new Set(),
      expandedGroups: new Set(),
      expandedShortcuts: new Set(),
    });
  });

  test("restores only valid persisted navigation preference entries", () => {
    const storage = new Map<string, string>([
      ["portal-nav-expanded-groups", '["Enquiries", 12, "Job Cards"]'],
      ["portal-nav-expanded-shortcuts", '["/portal/queries", null]'],
      ["portal-nav-collapsed-shortcuts", "not-json"],
    ]);

    expect(
      readPortalNavPreferences({
        getItem: (key) => storage.get(key) ?? null,
      })
    ).toEqual({
      collapsedShortcuts: new Set(),
      expandedGroups: new Set(["Enquiries", "Job Cards"]),
      expandedShortcuts: new Set(["/portal/queries"]),
    });
  });

  test("keeps navigation usable when browser storage access is blocked", () => {
    const unavailableStorage = getPortalNavStorage(() => {
      throw new Error("Storage is disabled");
    });

    expect(unavailableStorage).toBeNull();
    expect(readPortalNavPreferences(unavailableStorage)).toEqual(
      createInitialPortalNavPreferences()
    );
    expect(() => {
      writePortalNavPreference(
        unavailableStorage,
        "portal-nav-expanded-groups",
        new Set(["Sales"])
      );
    }).not.toThrow();
  });

  test("keeps the SSR snapshot deterministic while updating the client navigation snapshot", () => {
    const serverSnapshot = getPortalNavServerSnapshot();
    const nextGroups = new Set(["Enquiries"]);

    updatePortalNavPreference("expandedGroups", nextGroups);

    expect(getPortalNavServerSnapshot()).toBe(serverSnapshot);
    expect(getPortalNavServerSnapshot().expandedGroups).toEqual(new Set());
    expect(getPortalNavPreferencesSnapshot().expandedGroups).toEqual(nextGroups);
  });
});
