import { beforeEach, describe, expect, test } from "bun:test";
import {
  getPortalNavigationSnapshot,
  markPortalNavigationFirstContent,
  markPortalNavigationPending,
  markPortalNavigationRouteReady,
  markPortalNavigationStart,
  measurePortalNavigationWorkload,
  recordPortalNavigationWorkload,
  resetPortalNavigationPerformance,
} from "./navigationPerformance";

const PRIVATE_MARK_NAME_PATTERN = /@|query[_]\w+|token|cookie/i;

beforeEach(() => {
  performance.clearMarks();
  resetPortalNavigationPerformance();
});

describe("portal navigation performance marks", () => {
  test("records the authenticated navigation sequence without URL or identity data", () => {
    markPortalNavigationPending("queries");
    expect(performance.getEntriesByType("mark")).toHaveLength(0);

    markPortalNavigationStart("queries");
    markPortalNavigationPending("queries");
    markPortalNavigationRouteReady("queries");
    recordPortalNavigationWorkload({
      applicationPayloadBytes: 840,
      subscriptions: ["crm.queries.listPage", "crm.queries.listPage"],
      target: "queries",
    });
    markPortalNavigationFirstContent("queries", "row");

    expect(performance.getEntriesByType("mark").map((entry) => entry.name)).toEqual([
      "citius-portal-navigation-start",
      "citius-portal-navigation-pending",
      "citius-portal-navigation-route-ready",
      "citius-portal-navigation-first-content",
    ]);
    expect(
      performance
        .getEntriesByType("mark")
        .map((entry) => entry.name)
        .join(" ")
    ).not.toMatch(PRIVATE_MARK_NAME_PATTERN);

    expect(getPortalNavigationSnapshot()).toMatchObject({
      applicationPayloadBytes: 840,
      duplicateSubscriptions: 1,
      firstContent: "row",
      logicalSubscriptions: 2,
      target: "queries",
    });
  });

  test("does not mark a first row for an unrelated initial render", () => {
    markPortalNavigationRouteReady("queries");
    markPortalNavigationFirstContent("queries", "empty");

    expect(performance.getEntriesByType("mark")).toHaveLength(0);
    expect(getPortalNavigationSnapshot()).toBeNull();
  });

  test.each([
    "queries",
    "proposals",
    "job-cards",
  ] as const)("records a privacy-safe lifecycle for %s", (target) => {
    markPortalNavigationStart(target);
    markPortalNavigationPending(target);
    markPortalNavigationRouteReady(target);
    markPortalNavigationFirstContent(target, "empty");

    expect(getPortalNavigationSnapshot()).toMatchObject({
      firstContent: "empty",
      target,
    });
  });

  test("rejects raw subscription arguments from the performance snapshot", () => {
    markPortalNavigationStart("proposals");

    expect(() =>
      recordPortalNavigationWorkload({
        applicationPayloadBytes: 10,
        subscriptions: ["crm.proposals.listPage:{userEmail:'staff@example.com'}"],
        target: "proposals",
      })
    ).toThrow("privacy-safe subscription names");
  });

  test("measures actual subscription payloads and exposes duplicate subscriptions", () => {
    const workload = measurePortalNavigationWorkload([
      {
        active: true,
        name: "crm.proposals.listPage",
        payload: [{ id: "proposal-1", status: "Draft" }],
        ready: true,
      },
      {
        active: true,
        name: "crm.proposals.listPage",
        payload: [{ id: "proposal-1", status: "Draft" }],
        ready: true,
      },
      {
        active: false,
        name: "crm.queries.listPage",
        payload: [{ private: "not transferred" }],
        ready: true,
      },
    ]);

    expect(workload).toEqual({
      applicationPayloadBytes:
        new TextEncoder().encode(JSON.stringify([{ id: "proposal-1", status: "Draft" }]))
          .byteLength * 2,
      subscriptions: ["crm.proposals.listPage", "crm.proposals.listPage"],
    });

    markPortalNavigationStart("proposals");
    markPortalNavigationFirstContent("proposals", "row");
    recordPortalNavigationWorkload({ ...workload!, target: "proposals" });
    expect(getPortalNavigationSnapshot()).toMatchObject({
      duplicateSubscriptions: 1,
      firstContent: "row",
      logicalSubscriptions: 2,
    });
  });

  test("waits for every active subscription before publishing a workload", () => {
    expect(
      measurePortalNavigationWorkload([
        { active: true, name: "crm.queries.listPage", payload: undefined, ready: false },
      ])
    ).toBeNull();
  });
});
