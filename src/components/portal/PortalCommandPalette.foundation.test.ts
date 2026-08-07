import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const PALETTE_PATH = "src/components/portal/PortalCommandPalette.js";

describe("Portal command palette foundation boundaries", () => {
  test("uses raw cmdk parts inside the shared controlled dialog adapter", () => {
    const source = readFileSync(PALETTE_PATH, "utf8");

    expect(source).toContain('from "@/components/ui/application-dialog"');
    expect(source).toContain('from "@/components/ui/foundation/command"');
    expect(source).toContain("<ControlledDialog");
    expect(source).toContain("popupRender={<Command");
    expect(source).toContain("<Command.Input");
    expect(source).toContain("<Command.List");
    expect(source).toContain("<Command.Group");
    expect(source).toContain("<Command.Item");
    expect(source).toContain("<Command.Empty");
    expect(source).toContain("shouldFilter={false}");
    expect(source).not.toContain("<Command.Dialog");
  });

  test("leaves Base UI as the sole modal behavior owner and cmdk as the keyboard-list owner", () => {
    const source = readFileSync(PALETTE_PATH, "utf8");

    expect(source).not.toContain("createPortal");
    expect(source).not.toContain("useFocusTrap");
    expect(source).not.toContain("lockBodyScroll");
    expect(source).not.toContain("AnimatePresence");
    expect(source).not.toContain('event.key === "Escape"');
    expect(source).not.toContain('event.key === "ArrowDown"');
    expect(source).not.toContain('event.key === "ArrowUp"');
    expect(source).not.toContain('event.key === "Enter"');
  });
});
