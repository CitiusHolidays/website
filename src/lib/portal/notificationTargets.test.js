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
        entityType: "query",
        entityId: "query123",
        title: "New query received",
      }),
    ).toBe("/portal/queries?open=assignQueryTeams&id=query123");
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query123",
        title: "Query ready for assignment",
      }),
    ).toBe("/portal/queries?open=assignQueryTeams&id=query123");
  });

  test("maps proposal review notifications to sales decision", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query123",
        title: "Proposal ready for review",
      }),
    ).toBe("/portal/queries?open=salesDecision&id=query123");
  });

  test("maps confirmed orders to job card creation", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query123",
        title: "Order confirmed",
      }),
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query123");
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query123",
        title: "Order confirmed — open Job Card",
      }),
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query123");
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query123",
        title: "Order confirmed — assign owners",
      }),
    ).toBe("/portal/job-cards");
  });

  test("maps job card notifications to job card modal", () => {
    expect(
      getNotificationHref({
        entityType: "jobCard",
        entityId: "job123",
        title: "Job Card opened",
      }),
    ).toBe("/portal/job-cards?open=jobCard&id=job123");
    expect(
      getNotificationHref({
        entityType: "jobCard",
        entityId: "job123",
        title: "Assign contracting SPOC",
      }),
    ).toBe("/portal/job-cards?open=assignContractingOwner&id=job123");
    expect(
      getNotificationHref({
        entityType: "jobCard",
        entityId: "job123",
        title: "Assign operations owner",
      }),
    ).toBe("/portal/job-cards?open=assignOperationsOwner&id=job123");
    expect(
      getNotificationHref({
        entityType: "jobCard",
        entityId: "job123",
        title: "Assign ticketing owner",
      }),
    ).toBe("/portal/job-cards?open=assignTicketingOwner&id=job123");
  });

  test("resolves approval deep links to expense modal data", () => {
    const resolved = resolveDeepLink(
      { open: "approval", id: "approval123", queryId: null },
      {
        approvals: [
          {
            id: "approval123",
            entityType: "expense",
            entityId: "expense456",
          },
        ],
      },
    );

    expect(resolved).toEqual({
      status: "resolved",
      modal: "expense",
      entityId: "expense456",
      queryId: null,
    });
  });

  test("builds proposal edit prefill with multi-query links", () => {
    const initial = buildModalInitial(
      "proposal",
      { entityId: "prop1", queryId: null },
      {
        proposals: [
          {
            id: "prop1",
            queryId: "q1",
            queryIds: ["q1", "q2"],
            clientName: "Acme",
            landCostPerPax: 100,
            airfarePerPax: 50,
            sellingPrice: 200,
            itinerarySummary: "5 days",
            queries: [
              { id: "q1", queryCode: "QY-1", paxCount: 4 },
              { id: "q2", queryCode: "QY-2", paxCount: 99 },
            ],
          },
        ],
      },
    );

    expect(initial).toMatchObject({
      entityId: "prop1",
      queryIds: ["q1", "q2"],
      queryId: "q1",
      paxCount: "4",
      landCostPerPax: "100",
    });
  });

  test("builds query edit prefill from list rows", () => {
    const initial = buildModalInitial(
      "query",
      { entityId: "query123", queryId: null },
      {
        queries: [
          {
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
          },
        ],
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

  test("resolveDeepLink returns missing when approval row is not found", () => {
    expect(
      resolveDeepLink({ open: "approval", id: "gone", queryId: null }, { approvals: [] }),
    ).toEqual({ status: "missing" });
  });

  test("buildModalInitial returns null when deep-linked row is missing", () => {
    expect(buildModalInitial("query", { entityId: "missing", queryId: null }, { queries: [] })).toBeNull();
  });

  test("falls back to activity when metadata is missing", () => {
    expect(getNotificationHref({ entityType: "", entityId: "", title: "Test" })).toBe(
      "/portal/activity",
    );
  });

  test("resolveDeepLink reports missing targets when id is absent", () => {
    expect(resolveDeepLink({ open: "approval", id: null }, { approvals: [] })).toEqual({
      status: "missing",
    });
    expect(
      resolveDeepLink({ open: "jobCard", id: null, queryId: "missing" }, { queries: [] }),
    ).toEqual({
      status: "missing",
    });
  });
});
