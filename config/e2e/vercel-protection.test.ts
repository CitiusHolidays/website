import { describe, expect, test } from "bun:test";
import { vercelProtectionBrowserHeaders, vercelProtectionHeaders } from "./vercel-protection";

describe("Vercel Preview protection headers", () => {
  test("is inert without an automation bypass secret", () => {
    expect(vercelProtectionHeaders({})).toEqual({});
  });

  test("forwards the secret only through protection headers", () => {
    expect(
      vercelProtectionHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: "  preview-secret  " })
    ).toEqual({
      "x-vercel-protection-bypass": "preview-secret",
    });
  });

  test("sets the bypass cookie only for browser contexts", () => {
    expect(vercelProtectionBrowserHeaders({})).toEqual({});
    expect(
      vercelProtectionBrowserHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: "preview-secret" })
    ).toEqual({
      "x-vercel-protection-bypass": "preview-secret",
      "x-vercel-set-bypass-cookie": "true",
    });
  });
});
