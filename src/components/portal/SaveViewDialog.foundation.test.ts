import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const ADAPTER_PATH = "src/components/ui/application-dialog.tsx";
const SAVE_VIEW_PATH = "src/components/portal/SaveViewDialog.js";

describe("Save View controlled dialog foundation boundary", () => {
  test("routes modal behavior through one shared Base UI dialog adapter", () => {
    expect(existsSync(ADAPTER_PATH)).toBe(true);

    const adapter = readFileSync(ADAPTER_PATH, "utf8");
    expect(adapter).toContain("Dialog as BaseDialog");
    expect(adapter).toContain("<BaseDialog.Root");
    expect(adapter).toContain("<BaseDialog.Portal");
    expect(adapter).toContain("<BaseDialog.Backdrop");
    expect(adapter).toContain("<BaseDialog.Viewport");
    expect(adapter).toContain("<BaseDialog.Popup");
  });

  test("leaves Base UI as Save View's sole modal behavior owner", () => {
    const saveView = readFileSync(SAVE_VIEW_PATH, "utf8");
    expect(saveView).toContain('from "@/components/ui/application-dialog"');
    expect(saveView).not.toContain("createPortal");
    expect(saveView).not.toContain("useFocusTrap");
    expect(saveView).not.toContain("lockBodyScroll");
    expect(saveView).not.toContain('role="dialog"');
    expect(saveView).not.toContain('aria-modal="true"');
  });
});
