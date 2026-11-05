import { describe, expect, test } from "bun:test";
import { e2eConvexDeployment, e2eConvexRunArguments } from "./convexAssert";

const local = {
  CONVEX_SELF_HOSTED_ADMIN_KEY: "existing-local-key",
  CONVEX_SELF_HOSTED_URL: "http://127.0.0.1:34210",
  E2E_PROVISIONING_TARGET: "development",
  NEXT_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:34211",
  NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:34210",
};

describe("E2eConvexDeployment", () => {
  test("Derives the exact Preview deployment from its approved site origin", () => {
    expect(
      e2eConvexDeployment({
        E2E_PROVISIONING_TARGET: "preview",
        NEXT_PUBLIC_CONVEX_SITE_URL: "https://elegant-bullfrog-454.convex.site",
      })
    ).toBe("elegant-bullfrog-454");
  });

  test("Rejects missing and production-like target classifications", () => {
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
    ).toThrow("explicit local development deployment");
  });

  test("Uses the bound loopback backend without resolving a cloud project", () => {
    expect(e2eConvexRunArguments("true", local)).toEqual([
      "convex",
      "run",
      "--inline-query",
      "true",
    ]);
  });

  test("Retains an explicit managed-local selector", () => {
    expect(
      e2eConvexRunArguments("false", {
        E2E_CONVEX_DEPLOYMENT: "local",
        E2E_PROVISIONING_TARGET: "development",
        NEXT_PUBLIC_CONVEX_SITE_URL: "http://localhost:3211",
      })
    ).toEqual(["convex", "run", "--deployment", "local", "--inline-query", "false"]);
  });

  test("Rejects cloud, mismatched and credential-bearing local targets", () => {
    for (const patch of [
      { NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site" },
      { CONVEX_SELF_HOSTED_URL: "https://example.convex.cloud" },
      { NEXT_PUBLIC_CONVEX_URL: "http://127.0.0.1:34212" },
      { CONVEX_SELF_HOSTED_URL: "http://user:password@localhost:34210" },
      { CONVEX_SELF_HOSTED_ADMIN_KEY: "" },
      { CONVEX_DEPLOY_KEY: "cloud-key" },
      { E2E_CONVEX_DEPLOYMENT: "dev" },
      { E2E_CONVEX_DEPLOYMENT: "shiny-penguin-737" },
      { VERCEL_ENV: "production" },
    ]) {
      expect(() => e2eConvexRunArguments("true", { ...local, ...patch })).toThrow();
    }
  });
});
