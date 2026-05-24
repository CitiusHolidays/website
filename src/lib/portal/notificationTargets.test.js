import { describe, expect, test } from "bun:test";
import {
  buildModalInitial,
  getNotificationHref,
  isDeepLinkDataReady,
  resolveDeepLink,
} from "./notificationTargets";

describe("notificationTargets", () => {
  test("maps query notifications to contracting status modal", () => {
    expect(getNotificationHref({
      entityType: "query",
      entityId: "query123",
      title: "New query received",
    })).toBe("/portal/contracting?open=queryStatus&id=query123");
  });

  test("maps confirmed orders to job card creation", () => {
    expect(getNotificationHref({
      entityType: "query",
      entityId: "query123",
      title: "Order confirmed",
    })).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query123");
  });

  test("maps job card notifications to job card modal", () => {
    expect(getNotificationHref({
      entityType: "jobCard",
      entityId: "job123",
      title: "Job Card opened",
    })).toBe("/portal/job-cards?open=jobCard&id=job123");
  });

  test("resolves approval deep links to expense modal data", () => {
    const resolved = resolveDeepLink(
      { open: "approval", id: "approval123", queryId: null },
      {
        approvals: [{
          id: "approval123",
          entityType: "expense",
          entityId: "expense456",
        }],
      },
    );

    expect(resolved).toEqual({
      status: "resolved",
      modal: "expense",
      entityId: "expense456",
      queryId: null,
    });
  });

  test("builds query edit prefill from list rows", () => {
    const initial = buildModalInitial(
      "query",
      { entityId: "query123", queryId: null },
      {
        queries: [{
          id: "query123",
          clientName: "Acme",
          contactPerson: "Jane",
          contactMobile: "999",
          destination: "Paris",
          paxCount: 12,
          travelStartDate: "2026-06-01",
          travelEndDate: "2026-06-10",
          queryType: "MICE",
          travelType: "International Travel",
          budgetAmount: 1000,
          source: "Client",
          salesOwnerName: "Sam",
          notes: "VIP",
        }],
      },
    );

    expect(initial).toMatchObject({
      entityId: "query123",
      clientName: "Acme",
      paxCount: "12",
      budgetAmount: "1000",
    });
  });

  test("waits for required collections before opening deep links", () => {
    expect(isDeepLinkDataReady("ticket", { tickets: undefined })).toBe(false);
    expect(isDeepLinkDataReady("ticket", { tickets: [] })).toBe(true);
  });

  test("falls back to activity when metadata is missing", () => {
    expect(getNotificationHref({ entityType: "", entityId: "", title: "Test" }))
      .toBe("/portal/activity");
  });
});
