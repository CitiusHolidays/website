import { describe, expect, test } from "bun:test";
import { getModShortcutLabel } from "./shortcutLabels.js";

describe("shortcutLabels", () => {
  test("getModShortcutLabel returns platform-specific labels", () => {
    expect(getModShortcutLabel({ mac: true })).toBe("⌘K");
    expect(getModShortcutLabel({ mac: false })).toBe("Ctrl+K");
  });
});
