import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const adapter = readFileSync("src/components/ui/application-dialog.tsx", "utf8");
const confirm = readFileSync("src/components/portal/PortalConfirmDialog.js", "utf8");
const entity = readFileSync("src/components/portal/entityModal/EntityModalShell.js", "utf8");
const RENDER_TIME_INITIAL_FOCUS_ASSIGNMENT = /^\s*initialFocusRef\.current\s*=\s*initialFocus;/m;
const TRY_WRAPPED_EXTERNAL_SYNC = /syncingExternalStateRef\.current = true;\s*try/;

describe("primary portal dialog foundation boundary", () => {
  test("provides shared Base UI Dialog and AlertDialog controlled adapters", () => {
    expect(adapter).toContain("Dialog as BaseDialog");
    expect(adapter).toContain("AlertDialog as BaseAlertDialog");
    expect(adapter).toContain("export function ControlledDialog");
    expect(adapter).toContain("modal={modal}");
    expect(adapter).toContain("<BaseDialog.Trigger");
    expect(adapter).toContain("<BaseAlertDialog.Trigger");
    expect(adapter).toContain("triggerRef.current?.click()");
    expect(adapter).toContain("export function ControlledAlertDialog");
    expect(adapter).toContain("<BaseAlertDialog.Root");
    expect(adapter).toContain("<BaseAlertDialog.Portal");
    expect(adapter).toContain("<BaseAlertDialog.Backdrop");
    expect(adapter).toContain("<BaseAlertDialog.Viewport");
    expect(adapter).toContain("<BaseAlertDialog.Popup");
  });

  test("reads changing focus inputs without mutating refs during render", () => {
    expect(adapter).toContain("useEffectEvent");
    expect(adapter).not.toMatch(RENDER_TIME_INITIAL_FOCUS_ASSIGNMENT);
    expect(adapter).not.toMatch(TRY_WRAPPED_EXTERNAL_SYNC);
  });

  test("leaves Base UI as the confirmation shell's sole modal behavior owner", () => {
    expect(confirm).toContain('from "@/components/ui/application-dialog"');
    expect(confirm).not.toContain("useFocusTrap");
    expect(confirm).not.toContain("useScrollLock");
    expect(confirm).not.toContain('<div role="alertdialog"');
    expect(confirm).not.toContain('aria-modal="true"');
    expect(confirm).not.toContain("transitionStatus");
    expect(confirm).not.toContain("popupStyle=");
    expect(confirm).not.toContain("backdropStyle=");
  });

  test("leaves Base UI as the entity shell's sole modal behavior owner", () => {
    expect(entity).toContain('from "@/components/ui/application-dialog"');
    expect(entity).not.toContain("useScrollLock");
    expect(entity).not.toContain("restoreFocusAfterOverlayTeardown");
    expect(entity).not.toContain("handleDialogKeyDown");
    expect(entity).not.toContain('role="dialog"');
    expect(entity).not.toContain('aria-modal="true"');
    expect(entity).not.toContain("?? true");
    expect(entity).toContain("tabIndex={-1}");
    expect(entity).not.toContain("transitionStatus");
    expect(entity).not.toContain("popupStyle=");
    expect(entity).not.toContain("backdropStyle=");
    expect(entity).toContain("closeDisabled={confirmActive}");
    expect(entity).toContain("modal={!confirmActive}");
    expect(entity).toContain("triggerless");
  });
});
