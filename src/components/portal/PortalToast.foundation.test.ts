import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const PORTAL_TOAST_PATH = "src/components/portal/PortalToast.js";
const TOAST_FOUNDATION_PATH = "src/components/ui/foundation/toast.ts";
const GLOBAL_STYLES_PATH = "src/app/globals.css";

describe("Portal toast Sonner foundation boundary", () => {
  test("keeps Sonner private behind the code-owned foundation and portal API", () => {
    const portalToast = readFileSync(PORTAL_TOAST_PATH, "utf8");
    const foundation = readFileSync(TOAST_FOUNDATION_PATH, "utf8");

    expect(foundation).toContain(["from", '"sonner"'].join(" "));
    expect(portalToast).toContain('from "@/components/ui/foundation/toast"');
    expect(portalToast).toContain("<Toaster");
    expect(portalToast).toContain("sonnerToast.success");
    expect(portalToast).toContain("sonnerToast.info");
    expect(portalToast).toContain("sonnerToast.error");
    expect(portalToast).not.toContain("motion-ui/toast-stack");
    expect(portalToast).not.toContain("useMotionUITransition");
    expect(portalToast).not.toContain("useReducer");
    expect(portalToast).not.toContain("window.setTimeout");
  });

  test("locks the visible cap, stacking tier, safe-area hook, and reduced-motion styling", () => {
    const portalToast = readFileSync(PORTAL_TOAST_PATH, "utf8");
    const globalStyles = readFileSync(GLOBAL_STYLES_PATH, "utf8");

    expect(portalToast).toContain("visibleToasts={MAX_VISIBLE_TOASTS}");
    expect(portalToast).toContain("zIndex: PORTAL_Z_INDEX.toast");
    expect(portalToast).toContain("portal-toast-safe-area");
    expect(globalStyles).toContain(".portal-sonner-toast");
    expect(globalStyles).toContain('[data-sonner-toast][data-visible="false"]');
    expect(globalStyles).toContain("transform 180ms var(--portal-ease-out)");
    expect(globalStyles).toContain("opacity 180ms var(--portal-ease-out) !important");
    expect(globalStyles).not.toContain("height 180ms var(--portal-ease-out)");
    expect(globalStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
