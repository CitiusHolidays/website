import { describe, expect, test } from "bun:test";
import { getNotificationHref as getFrontendNotificationHref } from "../../src/lib/portal/notificationPaths.js";
import { getNotificationHref as getConvexNotificationHref } from "./notificationPaths";

describe("Dashboard notification path parity", () => {
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
      entityId: "report_1",
      entityType: "postTourReport",
      href: "/portal/post-tour-feedback?reportId=report_1&view=report",
      title: "Post-tour report submitted",
    },
    {
      entityId: "ticket_1",
      entityType: "ticket",
      href: "/portal/tickets?open=ticket&id=ticket_1",
      title: "",
    },
    // The approving manager and the submitter both act from the Expenses page.
    {
      entityId: "expense_1",
      entityType: "expense",
      href: "/portal/expenses",
      title: "Expense manager approval requested",
    },
    // The id is the Tour Manager assignment; that page opens the assignment's Job Card.
    {
      entityId: "assignment_1",
      entityType: "tourManager",
      href: "/portal/job-cards/tour-manager/assignment_1",
      title: "Tour Manager allocated",
    },
  ];

  for (const fixture of fixtures) {
    test(`${fixture.entityType} Fixture matches frontend path builder`, () => {
      expect(getConvexNotificationHref(fixture)).toBe(fixture.href);
      expect(getFrontendNotificationHref(fixture)).toBe(fixture.href);
    });
  }
});
