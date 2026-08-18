import { describe, expect, test } from "bun:test";
import { getModShortcutLabel } from "./shortcutLabels";

describe("ShortcutLabels", () => {
  test("GetModShortcutLabel returns platform-specific labels", () => {
    expect(getModShortcutLabel({ mac: true })).toBe("⌘K");
    expect(getModShortcutLabel({ mac: false })).toBe("Ctrl+K");
  });
});
