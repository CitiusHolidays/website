import { describe, expect, test } from "bun:test";
import {
  PORTAL_COMMAND_PALETTE_PANEL_TOP,
  PORTAL_MAIN_BELOW_TOOLBAR,
} from "./portalOverlayLayout";

describe("portal overlay layout", () => {
  test("command palette clears sticky toolbar before backdrop and panel", () => {
    expect(PORTAL_MAIN_BELOW_TOOLBAR).toBe("calc(4rem + 4.5rem)");
    expect(PORTAL_COMMAND_PALETTE_PANEL_TOP).toContain(PORTAL_MAIN_BELOW_TOOLBAR);
  });
});
