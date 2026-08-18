import { describe, expect, test } from "bun:test";
import { PORTAL_Z, PORTAL_Z_INDEX } from "./zIndex";

describe("Portal z-index stack", () => {
  test("Toolbar stays below header chrome so header dropdowns are not covered", () => {
    expect(PORTAL_Z_INDEX.toolbar).toBeLessThan(PORTAL_Z_INDEX.chrome);
  });

  test("Header dropdowns sit above toolbar chrome layer", () => {
    expect(PORTAL_Z_INDEX.dropdownBackdrop).toBeGreaterThan(PORTAL_Z_INDEX.chrome);
    expect(PORTAL_Z_INDEX.dropdown).toBeGreaterThan(PORTAL_Z_INDEX.dropdownBackdrop);
  });

  test("Command palette sits above dropdowns but below mobile drawer", () => {
    expect(PORTAL_Z_INDEX.commandPalette).toBeGreaterThan(PORTAL_Z_INDEX.dropdown);
    expect(PORTAL_Z_INDEX.mobileDrawer).toBeGreaterThan(PORTAL_Z_INDEX.commandPalette);
  });

  test("Toasts sit above modals so validation feedback is visible", () => {
    expect(PORTAL_Z_INDEX.importModal).toBeGreaterThan(PORTAL_Z_INDEX.mobileDrawer);
    expect(PORTAL_Z_INDEX.entityModal).toBeGreaterThan(PORTAL_Z_INDEX.importModal);
    expect(PORTAL_Z_INDEX.nestedModal).toBeGreaterThan(PORTAL_Z_INDEX.entityModal);
    expect(PORTAL_Z_INDEX.toast).toBeGreaterThan(PORTAL_Z_INDEX.nestedModal);
  });

  test("Confirm dialogs stay above toasts", () => {
    expect(PORTAL_Z_INDEX.confirm).toBeGreaterThan(PORTAL_Z_INDEX.toast);
  });

  test("PORTAL_Z_INDEX keys mirror PORTAL_Z keys", () => {
    expect(Object.keys(PORTAL_Z_INDEX).sort()).toEqual(Object.keys(PORTAL_Z).sort());
  });
});
