import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { Doc } from "../_generated/dataModel";
import {
  buildJobCardActions,
  buildJobCardReadiness,
  projectJobCardMoney,
  projectJobCardOpeningEvidence,
} from "./jobCardCommandCenter";
import { PERMISSIONS } from "./lib";

function invoice(overrides: Partial<Doc<"invoices">> = {}) {
  return fromAny<Doc<"invoices">, unknown>({
    _creationTime: 1,
    _id: "invoices_sensitive",
    balanceAmount: 80_000,
    createdAt: 1,
    createdBy: "auth_finance",
    expectedAmount: 100_000,
    invoiceNumber: "INV-SENSITIVE-001",
    jobCardId: "jobCards_1",
    receivedAmount: 20_000,
    status: "Part Paid",
    updatedAt: 2,
    ...overrides,
  });
}

function jobCard(overrides: Partial<Doc<"jobCards">> = {}) {
  return fromAny<Doc<"jobCards">, unknown>({
    _creationTime: 1,
    _id: "jobCards_1",
    clientName: "Acme Snapshot",
    confirmedPax: 20,
    createdAt: 100,
    createdBy: "auth_accounts",
    destination: "Almaty",
    jobCode: "JC-0001-NS",
    openingSnapshot: {
      authority: {
        confirmedOfferId: "confirmedOffers_1",
        proposalId: "proposals_1",
        proposalQueryHandoffId: "proposalQueryHandoffs_1",
        proposalRevision: 2,
        queryId: "queries_1",
      },
      commercial: {
        airfarePerPax: 20_000,
        landCostPerPax: 45_000,
        profitPerPax: 12_000,
        sellingPricePerPax: 80_000,
        visaCostPerPax: 3000,
      },
      effective: {
        clientName: "Acme Snapshot",
        confirmedPax: 20,
        destination: "Baku",
        roomCount: 10,
        travelEndDate: "2026-10-08",
        travelStartDate: "2026-10-02",
      },
      openedAt: 100,
      openedByStaffId: "staff_accounts",
      source: {
        clientName: "Acme Snapshot",
        confirmedPax: 18,
        destination: "Baku",
        travelEndDate: "2026-10-08",
        travelStartDate: "2026-10-02",
      },
      variances: [
        {
          field: "confirmedPax",
          fromValue: "18",
          reason: "Client added two attendees",
          recordedAt: 100,
          recordedByStaffId: "staff_accounts",
          toValue: "20",
        },
      ],
      version: 1,
    },
    roomCount: 10,
    status: "Open",
    travelEndDate: "2026-10-08",
    travelStartDate: "2026-10-02",
    updatedAt: 200,
    ...overrides,
  });
}

describe("Job Card command center projections", () => {
  test("returns only coarse provider-neutral readiness without VIEW_FINANCE", () => {
    const projected = projectJobCardMoney([invoice()], false);
    const serialized = JSON.stringify(projected);

    expect(projected).toEqual({ exact: null, readiness: "partially_outstanding" });
    expect(serialized).not.toContain("INV-SENSITIVE-001");
    expect(serialized).not.toContain("invoices_sensitive");
    expect(serialized).not.toContain("80000");
    expect(serialized).not.toContain("100000");
  });

  test("returns exact invoice rows only with VIEW_FINANCE and fails closed on invalid totals", () => {
    expect(projectJobCardMoney([invoice()], true)).toMatchObject({
      exact: {
        invoices: [
          {
            balanceAmount: 80_000,
            expectedAmount: 100_000,
            id: "invoices_sensitive",
            invoiceNumber: "INV-SENSITIVE-001",
            receivedAmount: 20_000,
          },
        ],
        truncated: false,
      },
      readiness: "partially_outstanding",
    });
    expect(
      projectJobCardMoney([invoice({ balanceAmount: 120_000, expectedAmount: 100_000 })], false)
    ).toEqual({ exact: null, readiness: "review_required" });
    expect(
      projectJobCardMoney(
        [invoice({ balanceAmount: 0, expectedAmount: 100_000, receivedAmount: 0 })],
        false
      )
    ).toEqual({ exact: null, readiness: "review_required" });
    expect(projectJobCardMoney([invoice()], false, true)).toEqual({
      exact: null,
      readiness: "review_required",
    });
  });

  test("keeps opening evidence immutable while auditing current operational variance", () => {
    const nonFinance = projectJobCardOpeningEvidence(jobCard(), false);

    expect(nonFinance).toMatchObject({
      commercial: null,
      current: {
        observedAt: 200,
        variances: [{ currentValue: "Almaty", field: "destination", openingValue: "Baku" }],
      },
      effective: { confirmedPax: 20, destination: "Baku" },
      source: { confirmedPax: 18, destination: "Baku" },
      status: "recorded",
      variances: [
        expect.objectContaining({
          field: "confirmedPax",
          fromValue: "18",
          reason: "Client added two attendees",
          toValue: "20",
        }),
      ],
      version: 1,
    });
    expect(projectJobCardOpeningEvidence(jobCard(), true).commercial).toMatchObject({
      sellingPricePerPax: 80_000,
    });
    expect(projectJobCardOpeningEvidence(jobCard({ openingSnapshot: undefined }), false)).toEqual({
      authority: null,
      commercial: null,
      current: { observedAt: 200, variances: [] },
      effective: null,
      openedAt: null,
      openedByStaffId: null,
      source: null,
      status: "unknown",
      variances: [],
      version: null,
    });
  });

  test("publishes only permission-authorized existing action destinations", () => {
    const sections = fromAny<ReturnType<typeof buildJobCardReadiness>, unknown>([
      { complete: false, key: "tickets", label: "Tickets" },
      { complete: false, key: "finance", label: "Finance/payment" },
      { complete: false, key: "checklist", label: "Checklist tasks" },
    ]);
    const operationsOwner = {
      kind: "staff" as const,
      label: "Ops Owner",
      staffId: "staff_ops",
    };
    const ticketingOwner = {
      kind: "staff" as const,
      label: "Ticket Owner",
      staffId: "staff_ticketing",
    };
    const owners = {
      checklist: operationsOwner,
      finance: { kind: "role" as const, label: "Finance", staffId: null },
      hotels: operationsOwner,
      passports: operationsOwner,
      tickets: ticketingOwner,
      tourManager: { kind: "role" as const, label: "Operations", staffId: null },
      travellers: operationsOwner,
      visas: operationsOwner,
    };

    const operationsActions = buildJobCardActions({
      jobCardId: "jobCards_1",
      owners,
      permissions: [PERMISSIONS.VIEW_JOB_CARDS, PERMISSIONS.VIEW_TICKETING],
      sections,
    });
    expect(operationsActions).toEqual([
      expect.objectContaining({
        href: "/portal/tickets?jc=jobCards_1",
        owner: ticketingOwner,
        sectionKey: "tickets",
        status: "available",
      }),
      expect.objectContaining({
        href: null,
        sectionKey: "finance",
        status: "owned_elsewhere",
      }),
      expect.objectContaining({
        href: "/portal/job-cards/jobCards_1#checklist-tasks",
        sectionKey: "checklist",
        status: "available",
      }),
    ]);

    const financeActions = buildJobCardActions({
      jobCardId: "jobCards_1",
      owners,
      permissions: [PERMISSIONS.VIEW_FINANCE, PERMISSIONS.VIEW_JOB_CARDS],
      sections,
    });
    expect(financeActions.find(({ sectionKey }) => sectionKey === "finance")?.href).toBe(
      "/portal/finance?jc=jobCards_1"
    );
    expect(financeActions.find(({ sectionKey }) => sectionKey === "tickets")?.href).toBeNull();
    expect(
      financeActions
        .filter(({ href }) => href !== null)
        .every(({ href }) => href?.includes("jobCards_1"))
    ).toBe(true);

    const everySection = fromAny<ReturnType<typeof buildJobCardReadiness>, unknown>(
      [
        "checklist",
        "finance",
        "hotels",
        "passports",
        "tickets",
        "tourManager",
        "travellers",
        "visas",
      ].map((key) => ({ complete: false, key, label: key }))
    );
    const everyAction = buildJobCardActions({
      jobCardId: "jobCards_1",
      owners,
      permissions: [
        PERMISSIONS.VIEW_FINANCE,
        PERMISSIONS.VIEW_JOB_CARDS,
        PERMISSIONS.VIEW_OPERATIONS,
        PERMISSIONS.VIEW_TICKETING,
        PERMISSIONS.VIEW_TOUR_MANAGERS,
        PERMISSIONS.VIEW_TRAVELLERS,
        PERMISSIONS.VIEW_VISA,
      ],
      sections: everySection,
    });
    expect(
      Object.fromEntries(everyAction.map(({ href, sectionKey }) => [sectionKey, href]))
    ).toEqual({
      checklist: "/portal/job-cards/jobCards_1#checklist-tasks",
      finance: "/portal/finance?jc=jobCards_1",
      hotels: "/portal/hotels?jc=jobCards_1",
      passports: "/portal/passport?jc=jobCards_1",
      tickets: "/portal/tickets?jc=jobCards_1",
      tourManager: "/portal/tour-managers?jc=jobCards_1",
      travellers: "/portal/travellers?jc=jobCards_1",
      visas: "/portal/visa?jc=jobCards_1",
    });
  });

  test("marks bounded readiness projections partial instead of overstating completion", () => {
    const readiness = buildJobCardReadiness({
      checklistTasks: [
        { _id: "checklistTasks_1", category: "Operations", completed: true, title: "Briefing" },
      ],
      hotels: [],
      job: jobCard({ confirmedPax: 2, tourManagerName: "" }),
      moneyReadiness: "review_required",
      rooming: [],
      tickets: [{ ticketStatus: "Issued" }],
      tourManagerAssigned: false,
      travellers: [{ passportStatus: "Received" }],
      truncated: {
        checklist: false,
        hotels: false,
        passports: true,
        tickets: false,
        travellers: false,
        visas: false,
      },
      visaRecords: [{ status: "Approved" }],
    });

    expect(readiness.find(({ key }) => key === "travellers")).toMatchObject({
      complete: false,
      coverage: "complete",
      done: 1,
      percent: 50,
      total: 2,
    });
    expect(readiness.find(({ key }) => key === "passports")).toMatchObject({
      complete: false,
      coverage: "partial",
      percent: 0,
    });
    expect(readiness.find(({ key }) => key === "finance")).toMatchObject({
      complete: false,
      done: 0,
      total: 1,
    });
    expect(readiness.find(({ key }) => key === "tourManager")).toMatchObject({
      complete: false,
      done: 0,
    });

    const assignedTourManager = buildJobCardReadiness({
      checklistTasks: [],
      hotels: [],
      job: jobCard({ tourManagerName: "Free text is not authority" }),
      moneyReadiness: "not_started",
      rooming: [],
      tickets: [],
      tourManagerAssigned: true,
      travellers: [],
      truncated: {
        checklist: false,
        hotels: false,
        passports: false,
        tickets: false,
        travellers: false,
        visas: false,
      },
      visaRecords: [],
    });
    expect(assignedTourManager.find(({ key }) => key === "tourManager")).toMatchObject({
      complete: true,
      done: 1,
    });

    const noTicketing = buildJobCardReadiness({
      checklistTasks: [],
      hotels: [],
      job: jobCard({ confirmedPax: 2, ticketingRequired: false }),
      moneyReadiness: "not_started",
      rooming: [],
      tickets: [],
      tourManagerAssigned: false,
      travellers: [],
      truncated: {
        checklist: false,
        hotels: false,
        passports: false,
        tickets: false,
        travellers: false,
        visas: false,
      },
      visaRecords: [],
    });
    expect(noTicketing.find(({ key }) => key === "tickets")).toMatchObject({
      complete: true,
      label: "Tickets — not required",
      percent: 100,
      total: 0,
    });
  });
});
