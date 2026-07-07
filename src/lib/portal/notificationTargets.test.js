import { describe, expect, test } from "bun:test";
import {
  buildModalInitial,
  getNotificationHref,
  isDeepLinkDataReady,
  resolveDeepLink,
} from "./notificationTargets";

describe("notificationTargets", () => {
  test("maps query notifications to team assignment on queries list", () => {
    expect(
      getNotificationHref({
        entityId: "query123",
        entityType: "query",
        title: "New query received",
      })
    ).toBe("/portal/queries?open=assignQueryTeams&id=query123");
    expect(
      getNotificationHref({
        entityId: "query123",
        entityType: "query",
        title: "Query ready for assignment",
      })
    ).toBe("/portal/queries?open=assignQueryTeams&id=query123");
  });

  test("maps proposal review notifications to sales decision", () => {
    expect(
      getNotificationHref({
        entityId: "query123",
        entityType: "query",
        title: "Proposal ready for review",
      })
    ).toBe("/portal/queries?open=salesDecision&id=query123");
  });

  test("maps confirmed orders to job card creation", () => {
    expect(
      getNotificationHref({
        entityId: "query123",
        entityType: "query",
        title: "Order confirmed",
      })
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query123");
    expect(
      getNotificationHref({
        entityId: "query123",
        entityType: "query",
        title: "Order confirmed — open Job Card",
      })
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query123");
    expect(
      getNotificationHref({
        entityId: "query123",
        entityType: "query",
        title: "Order confirmed — assign owners",
      })
    ).toBe("/portal/job-cards");
  });

  test("maps job card notifications to job card modal", () => {
    expect(
      getNotificationHref({
        entityId: "job123",
        entityType: "jobCard",
        title: "Job Card opened",
      })
    ).toBe("/portal/job-cards?open=jobCard&id=job123");
    expect(
      getNotificationHref({
        entityId: "job123",
        entityType: "jobCard",
        title: "Assign contracting SPOC",
      })
    ).toBe("/portal/job-cards?open=assignContractingOwner&id=job123");
    expect(
      getNotificationHref({
        entityId: "job123",
        entityType: "jobCard",
        title: "Assign operations owner",
      })
    ).toBe("/portal/job-cards?open=assignOperationsOwner&id=job123");
    expect(
      getNotificationHref({
        entityId: "job123",
        entityType: "jobCard",
        title: "Assign ticketing owner",
      })
    ).toBe("/portal/job-cards?open=assignTicketingOwner&id=job123");
  });

  test("resolves approval deep links to expense modal data", () => {
    const resolved = resolveDeepLink(
      { id: "approval123", open: "approval", queryId: null },
      {
        approvals: [
          {
            entityId: "expense456",
            entityType: "expense",
            id: "approval123",
          },
        ],
      }
    );

    expect(resolved).toEqual({
      entityId: "expense456",
      modal: "expense",
      queryId: null,
      status: "resolved",
    });
  });

  test("builds proposal edit prefill with multi-query links", () => {
    const initial = buildModalInitial(
      "proposal",
      { entityId: "prop1", queryId: null },
      {
        proposals: [
          {
            airfarePerPax: 50,
            clientName: "Acme",
            id: "prop1",
            itinerarySummary: "5 days",
            landCostPerPax: 100,
            queries: [
              { id: "q1", paxCount: 4, queryCode: "QY-1" },
              { id: "q2", paxCount: 99, queryCode: "QY-2" },
            ],
            queryId: "q1",
            queryIds: ["q1", "q2"],
            sellingPrice: 200,
          },
        ],
      }
    );

    expect(initial).toMatchObject({
      entityId: "prop1",
      landCostPerPax: "100",
      paxCount: "4",
      queryId: "q1",
      queryIds: ["q1", "q2"],
    });
  });

  test("builds query edit prefill from list rows", () => {
    const initial = buildModalInitial(
      "query",
      { entityId: "query123", queryId: null },
      {
        queries: [
          {
            budgetAmount: 1000,
            clientName: "Acme",
            contactMobile: "999",
            contactPerson: "Jane",
            destination: "Paris",
            id: "query123",
            notes: "VIP",
            paxCount: 12,
            queryType: "MICE",
            salesOwnerName: "Sam",
            source: "Client",
            travelEndDate: "2026-06-10",
            travelStartDate: "2026-06-01",
            travelType: "International Travel",
          },
        ],
      }
    );

    expect(initial).toMatchObject({
      budgetAmount: "1000",
      clientName: "Acme",
      entityId: "query123",
      paxCount: "12",
    });
  });

  test("waits for required collections before opening deep links", () => {
    expect(isDeepLinkDataReady("ticket", { tickets: undefined })).toBe(false);
    expect(isDeepLinkDataReady("ticket", { tickets: [] })).toBe(true);
  });

  test("resolveDeepLink returns missing when approval row is not found", () => {
    expect(
      resolveDeepLink({ id: "gone", open: "approval", queryId: null }, { approvals: [] })
    ).toEqual({ status: "missing" });
  });

  test("buildModalInitial returns null when deep-linked row is missing", () => {
    expect(
      buildModalInitial("query", { entityId: "missing", queryId: null }, { queries: [] })
    ).toBeNull();
  });

  test("falls back to activity when metadata is missing", () => {
    expect(getNotificationHref({ entityId: "", entityType: "", title: "Test" })).toBe(
      "/portal/activity"
    );
  });

  test("resolveDeepLink reports missing targets when id is absent", () => {
    expect(resolveDeepLink({ id: null, open: "approval" }, { approvals: [] })).toEqual({
      status: "missing",
    });
    expect(
      resolveDeepLink({ id: null, open: "jobCard", queryId: "missing" }, { queries: [] })
    ).toEqual({
      status: "missing",
    });
  });
});
