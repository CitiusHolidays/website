import { beforeEach, describe, expect, test } from "bun:test";
import {
  markPortalNavigationFirstQueryRow,
  markPortalNavigationPending,
  markPortalNavigationRouteReady,
  markPortalNavigationStart,
} from "./navigationPerformance";

const PRIVATE_MARK_NAME_PATTERN = /@|query[_]\w+|token|cookie/i;

beforeEach(() => {
  performance.clearMarks();
});

describe("portal navigation performance marks", () => {
  test("records the authenticated navigation sequence without URL or identity data", () => {
    markPortalNavigationPending();
    expect(performance.getEntriesByType("mark")).toHaveLength(0);

    markPortalNavigationStart();
    markPortalNavigationPending();
    markPortalNavigationRouteReady();
    markPortalNavigationFirstQueryRow();

    expect(performance.getEntriesByType("mark").map((entry) => entry.name)).toEqual([
      "citius-portal-navigation-start",
      "citius-portal-navigation-pending",
      "citius-portal-navigation-route-ready",
      "citius-portal-navigation-first-query-row",
    ]);
    expect(
      performance
        .getEntriesByType("mark")
        .map((entry) => entry.name)
        .join(" ")
    ).not.toMatch(PRIVATE_MARK_NAME_PATTERN);
  });

  test("does not mark a first row for an unrelated initial render", () => {
    markPortalNavigationRouteReady();
    markPortalNavigationFirstQueryRow();

    expect(performance.getEntriesByType("mark")).toHaveLength(0);
  });
});
