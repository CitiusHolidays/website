import { describe, expect, test } from "bun:test";
import { getNotificationHref as getFrontendNotificationHref } from "../../src/lib/portal/notificationPaths.js";
import { getNotificationHref as getConvexNotificationHref } from "./notificationPaths";

describe("dashboard notification path parity", () => {
  const fixtures = [
    {
      entityId: "approval_1",
      entityType: "approval",
      href: "/portal/approvals?open=approval&id=approval_1",
      title: "",
    },
    {
      entityId: "query_1",
      entityType: "query",
      href: "/portal/accounts/job-cards?open=jobCard&queryId=query_1",
      title: "Order confirmed",
    },
    {
      entityId: "ticket_1",
      entityType: "ticket",
      href: "/portal/tickets?open=ticket&id=ticket_1",
      title: "",
    },
  ];

  for (const fixture of fixtures) {
    test(`${fixture.entityType} fixture matches frontend path builder`, () => {
      expect(getConvexNotificationHref(fixture)).toBe(fixture.href);
      expect(getFrontendNotificationHref(fixture)).toBe(fixture.href);
    });
  }
});
