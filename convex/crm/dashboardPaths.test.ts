import { describe, expect, test } from "bun:test";
import { getNotificationHref as getFrontendNotificationHref } from "../../src/lib/portal/notificationPaths.js";
import { getNotificationHref as getConvexNotificationHref } from "./notificationPaths";

describe("dashboard notification path parity", () => {
  const fixtures = [
    {
      entityType: "approval",
      entityId: "approval_1",
      title: "",
      href: "/portal/approvals?open=approval&id=approval_1",
    },
    {
      entityType: "query",
      entityId: "query_1",
      title: "Order confirmed",
      href: "/portal/accounts/job-cards?open=jobCard&queryId=query_1",
    },
    {
      entityType: "ticket",
      entityId: "ticket_1",
      title: "",
      href: "/portal/tickets?open=ticket&id=ticket_1",
    },
  ];

  for (const fixture of fixtures) {
    test(`${fixture.entityType} fixture matches frontend path builder`, () => {
      expect(getConvexNotificationHref(fixture)).toBe(fixture.href);
      expect(getFrontendNotificationHref(fixture)).toBe(fixture.href);
    });
  }
});
