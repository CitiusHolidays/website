import { describe, expect, test } from "bun:test";
import manifest from "../config/browser-smoke.json";
import {
  type BrowserSmokeManifest,
  redactBrowserEvidence,
  resolveBrowserSmokeCases,
  validateBrowserSmokeManifest,
} from "./browser-smoke";

describe("browser smoke harness", () => {
  test("the checked-in manifest has unique valid cases and every critical seam", () => {
    const valid = validateBrowserSmokeManifest(manifest as BrowserSmokeManifest);
    const ids = new Set(valid.cases.map((smokeCase) => smokeCase.id));

    for (const id of [
      "public-home",
      "account-redirect",
      "admin-dashboard",
      "sales-pipeline",
      "sales-queries-pagination",
      "notification-deep-link",
      "job-card-deletion",
      "ai-configured",
      "ai-unconfigured",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test("authenticated cases require external session identifiers", () => {
    const resolved = resolveBrowserSmokeCases(
      manifest as BrowserSmokeManifest,
      {},
      new Set(["admin"])
    );
    const dashboard = resolved.find((item) => item.smokeCase.id === "admin-dashboard");

    expect(dashboard?.status).toBe("skipped");
    expect(dashboard?.reason).toBe("missing BROWSER_SMOKE_ADMIN_SESSION");
  });

  test("failure evidence removes credentials and request secrets", () => {
    const sanitized = redactBrowserEvidence(
      "nishit@example.com\nAuthorization: Bearer abc\nCookie: session=abc\n/path?token=abc&code=def"
    );

    expect(sanitized).not.toContain("nishit@example.com");
    expect(sanitized).not.toContain("Bearer abc");
    expect(sanitized).not.toContain("session=abc");
    expect(sanitized).not.toContain("token=abc");
    expect(sanitized).not.toContain("code=def");
  });
});
