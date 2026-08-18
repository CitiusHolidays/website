import { beforeEach, describe, expect, test } from "bun:test";
import {
  getPortalSubscriptionSummary,
  registerPortalSubscription,
  resetPortalSubscriptionRegistry,
} from "./trackedConvexSubscriptions";

beforeEach(() => {
  resetPortalSubscriptionRegistry();
});

describe("Portal subscription registry", () => {
  test("Counts exact duplicate instances without exposing argument signatures", () => {
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

  test("Treats strict-mode re-registration of one instance as one subscription", () => {
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
});
