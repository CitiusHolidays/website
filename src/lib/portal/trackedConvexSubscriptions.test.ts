import { beforeEach, describe, expect, test } from "bun:test";
import { globSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import {
  getPortalSubscriptionSummary,
  registerPortalSubscription,
  resetPortalSubscriptionRegistry,
} from "./trackedConvexSubscriptions";

beforeEach(() => {
  resetPortalSubscriptionRegistry();
});

describe("portal subscription registry", () => {
  test("counts exact duplicate instances without exposing argument signatures", () => {
    const unregisterA = registerPortalSubscription("a", {
      name: "crm.queries.listPage",
      signature: "opaque-one",
    });
    const unregisterB = registerPortalSubscription("b", {
      name: "crm.queries.listPage",
      signature: "opaque-one",
    });
    registerPortalSubscription("c", {
      name: "crm.queries.listPage",
      signature: "opaque-two",
    });

    expect(getPortalSubscriptionSummary()).toEqual({
      duplicateSubscriptions: 1,
      logicalSubscriptions: 3,
      subscriptions: ["crm.queries.listPage", "crm.queries.listPage", "crm.queries.listPage"],
    });
    expect(JSON.stringify(getPortalSubscriptionSummary())).not.toContain("opaque");

    unregisterA();
    expect(getPortalSubscriptionSummary().duplicateSubscriptions).toBe(0);
    unregisterB();
    expect(getPortalSubscriptionSummary().logicalSubscriptions).toBe(1);
  });

  test("treats strict-mode re-registration of one instance as one subscription", () => {
    registerPortalSubscription("strict", {
      name: "crm.dashboard.getPortalSummary",
      signature: "opaque",
    });
    registerPortalSubscription("strict", {
      name: "crm.dashboard.getPortalSummary",
      signature: "opaque",
    });
    expect(getPortalSubscriptionSummary()).toMatchObject({
      duplicateSubscriptions: 0,
      logicalSubscriptions: 1,
    });
  });

  test("owns every Staff portal Convex query hook", () => {
    const root = process.cwd();
    const files = globSync("src/components/portal/**/*.{js,jsx,ts,tsx}", { cwd: root });
    for (const file of files) {
      const source = readFileSync(`${root}/${file}`, "utf8");
      expect(
        /import\s*\{[^}]*\b(?:useQuery|usePaginatedQuery)\b[^}]*\}\s*from\s*["']convex\/react["']/.test(
          source
        ),
        relative(root, file)
      ).toBe(false);
    }
  });
});
