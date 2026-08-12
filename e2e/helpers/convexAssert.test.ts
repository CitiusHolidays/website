import { describe, expect, test } from "bun:test";
import { e2eConvexDeployment } from "./convexAssert";

describe("e2eConvexDeployment", () => {
  test("derives the exact Preview deployment from its approved site origin", () => {
    expect(
      e2eConvexDeployment({
        E2E_PROVISIONING_TARGET: "preview",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://elegant-bullfrog-454.convex.site",
      })
    ).toBe("elegant-bullfrog-454");
  });

  test("rejects missing and production-like target classifications", () => {
    expect(() =>
      e2eConvexDeployment({
        E2E_PROVISIONING_TARGET: "preview",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.com",
      })
    ).toThrow("approved .convex.site origin");
    expect(() =>
      e2eConvexDeployment({
        E2E_CONVEX_DEPLOYMENT: "prod",
        E2E_PROVISIONING_TARGET: "development",
      })
    ).toThrow("explicit development deployment");
  });
});
