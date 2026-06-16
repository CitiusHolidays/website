import { describe, expect, test } from "bun:test";
import { PORTAL_Z, PORTAL_Z_INDEX } from "./zIndex";

describe("portal z-index stack", () => {
  test("toolbar stays below header chrome so header dropdowns are not covered", () => {
    expect(PORTAL_Z_INDEX.toolbar).toBeLessThan(PORTAL_Z_INDEX.chrome);
  });

  test("header dropdowns sit above toolbar chrome layer", () => {
    expect(PORTAL_Z_INDEX.dropdownBackdrop).toBeGreaterThan(PORTAL_Z_INDEX.chrome);
    expect(PORTAL_Z_INDEX.dropdown).toBeGreaterThan(PORTAL_Z_INDEX.dropdownBackdrop);
  });

  test("command palette sits above dropdowns but below mobile drawer and toasts", () => {
    expect(PORTAL_Z_INDEX.commandPalette).toBeGreaterThan(PORTAL_Z_INDEX.dropdown);
    expect(PORTAL_Z_INDEX.mobileDrawer).toBeGreaterThan(PORTAL_Z_INDEX.commandPalette);
    expect(PORTAL_Z_INDEX.toast).toBeGreaterThan(PORTAL_Z_INDEX.mobileDrawer);
  });

  test("modals and confirms stay on top", () => {
    expect(PORTAL_Z_INDEX.importModal).toBeGreaterThan(PORTAL_Z_INDEX.toast);
    expect(PORTAL_Z_INDEX.entityModal).toBeGreaterThan(PORTAL_Z_INDEX.importModal);
    expect(PORTAL_Z_INDEX.nestedModal).toBeGreaterThan(PORTAL_Z_INDEX.entityModal);
    expect(PORTAL_Z_INDEX.confirm).toBeGreaterThan(PORTAL_Z_INDEX.nestedModal);
  });

  test("PORTAL_Z_INDEX keys mirror PORTAL_Z keys", () => {
    expect(Object.keys(PORTAL_Z_INDEX).sort()).toEqual(Object.keys(PORTAL_Z).sort());
  });
});
