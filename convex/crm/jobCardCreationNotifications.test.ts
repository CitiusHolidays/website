import { describe, expect, test } from "bun:test";
import { createFromQuery, isFinanceHeadStaff, queryRequiresTicketingWork } from "./jobCards";
import { getNotificationHref } from "./notificationPaths";
import { isJobCardCreatorNotificationTarget } from "./queries";

type Row = { _id: string; [key: string]: any };
type Tables = Record<string, Row[]>;

function makeCreateJobCardCtx() {
  const tables: Tables = {
    activityLogs: [],
    checklistTasks: [],
    confirmedOffers: [
      {
        _id: "confirmedOffers_1",
        airfarePerPax: 20_000,
        approxMargin: 10_000,
        confirmedPax: 24,
        createdAt: 140,
        createdBy: "auth_sales",
        destination: "Dubai",
        landCostPerPax: 45_000,
        profitPerPax: 30_000,
        proposalId: "proposals_1",
        queryId: "queries_1",
        sellingPricePerPax: 100_000,
        taxRate: 5,
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
        updatedAt: 140,
        visaCostPerPax: 5000,
      },
    ],
    jobCards: [
      {
        _id: "jobCards_existing",
        clientName: "Existing",
        confirmedPax: 1,
        createdAt: 1,
        createdBy: "auth_accounts",
        jobCode: "JC-0003-ZZ",
        status: "Open",
        updatedAt: 1,
      },
    ],
    notifications: [],
    proposalQueryLinks: [],
    proposals: [
      {
        _id: "proposals_1",
        clientName: "Acme Ltd",
        costPrice: 70_000,
        createdAt: 120,
        createdBy: "auth_contracting",
        preparedBy: "Contracting SPOC",
        proposalCode: "P-0001",
        queryId: "queries_1",
        sellingPrice: 100_000,
        status: "Accepted",
        updatedAt: 130,
      },
    ],
    queries: [
      {
        _id: "queries_1",
        clientName: "Acme Ltd",
        confirmedOfferId: "confirmedOffers_1",
        contractingOwnerId: "staff_contracting",
        contractingOwnerName: "Contracting SPOC",
        contractingStatus: "Order Confirmed",
        createdAt: 100,
        createdBy: "auth_sales",
        destination: "Dubai",
        jobCardCreatorName: "Nina Shah",
        jobCardCreatorStaffId: "staff_accounts",
        paxCount: 24,
        queryCode: "Q-0001",
        queryType: "MICE",
        salesOwnerId: "auth_sales",
        salesOwnerName: "Maya Kapoor",
        salesStatus: "Order Confirmed",
        ticketingOwnerId: "staff_ticketing",
        ticketingOwnerName: "Ticketing SPOC",
        ticketingScope: "Both",
        travelEndDate: "2026-08-05",
        travelStartDate: "2026-08-01",
        travelType: "Domestic",
        updatedAt: 100,
      },
    ],
    staffUsers: [
      {
        _id: "staff_sales",
        active: true,
        authUserId: "auth_sales",
        email: "sales@citius.in",
        emailNormalized: "sales@citius.in",
        name: "Maya Kapoor",
        roles: ["Sales"],
      },
      {
        _id: "staff_accounts",
        active: true,
        authUserId: "auth_accounts",
        email: "accounts@citius.in",
        emailNormalized: "accounts@citius.in",
        jobCardCreatorEnabled: false,
        name: "Nina Shah",
        roles: ["Accounts"],
      },
      {
        _id: "staff_contracting",
        active: true,
        authUserId: "auth_contracting",
        email: "contracting@citius.in",
        emailAlertRoles: ["Contracting"],
        emailNormalized: "contracting@citius.in",
        name: "Contracting SPOC",
        roles: ["Contracting"],
      },
      {
        _id: "staff_ticketing",
        active: true,
        authUserId: "auth_ticketing",
        email: "ticketing@citius.in",
        emailAlertRoles: ["Ticketing"],
        emailNormalized: "ticketing@citius.in",
        name: "Ticketing SPOC",
        roles: ["Ticketing"],
      },
      {
        _id: "staff_contracting_unassigned",
        active: true,
        authUserId: "auth_contracting_unassigned",
        email: "contracting-unassigned@citius.in",
        emailNormalized: "contracting-unassigned@citius.in",
        name: "Unassigned Contracting User",
        roles: ["Contracting"],
      },
      {
        _id: "staff_operations",
        active: true,
        authUserId: "auth_operations",
        email: "operations@citius.in",
        emailNormalized: "operations@citius.in",
        name: "Operations User",
        roles: ["Operations"],
      },
      {
        _id: "staff_operations_head",
        active: true,
        authUserId: "auth_operations_head",
        email: "operations-head@citius.in",
        emailAlertRoles: ["Operations Head"],
        emailNormalized: "operations-head@citius.in",
        name: "Operations Head",
        roles: ["Operations Head"],
      },
      {
        _id: "staff_finance",
        active: true,
        authUserId: "auth_finance_head",
        email: "finance-head@citius.in",
        emailAlertRoles: ["Finance"],
        emailNormalized: "finance-head@citius.in",
        function: "Finance Head",
        name: "Finance Head",
        roles: ["Finance"],
      },
      {
        _id: "staff_finance_user",
        active: true,
        authUserId: "auth_finance_user",
        email: "finance-user@citius.in",
        emailNormalized: "finance-user@citius.in",
        function: "Finance",
        name: "Finance User",
        roles: ["Finance"],
      },
    ],
  };
  const scheduledEmails: any[] = [];

  const getRows = (table: string) => tables[table] ?? [];
  const findById = async (id: string) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((entry) => entry._id === id);
      if (row) {
        return row;
      }
    }
    return null;
  };
  const queryBuilder = (table: string) => {
    let rows = getRows(table);
    const builder = {
      collect: async () => rows.map((row) => ({ ...row })),
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
      withIndex(_indexName: string, callback: (q: any) => unknown) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push({ field, value });
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value));
        return builder;
      },
    };
    return builder;
  };

  const ctx = {
    auth: {
      getUserIdentity: async () => ({
        email: "accounts@citius.in",
        name: "Nina Shah",
        subject: "auth_accounts",
      }),
    },
    db: {
      get: findById,
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return id;
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: async (id: string, patch: Record<string, unknown>) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query: (table: string) => queryBuilder(table),
    },
    scheduler: {
      runAfter: async (_delay: number, fn: unknown, args: unknown) => {
        scheduledEmails.push({ args, fn });
      },
    },
  };

  return { ctx, scheduledEmails, tables };
}

describe("Job Card creation notifications", () => {
  test("allows Accounts to create from a Confirmed Offer and uses Assigned Sales Rep initials", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

    const result = await (createFromQuery as any)._handler(ctx, {
      confirmedPax: 24,
      queryId: "queries_1",
    });

    expect(result).toEqual({
      id: "jobCards_2",
      jobCode: "JC-0004-MK",
    });
    expect(tables.jobCards[1]).toMatchObject({
      confirmedOfferId: "confirmedOffers_1",
      createdBy: "auth_accounts",
      jobCode: "JC-0004-MK",
      landCostPerPax: 45_000,
      proposalId: "proposals_1",
      queryId: "queries_1",
      sellingPricePerPax: 100_000,
    });
  });

  test("notifies downstream roles, emails assigned SPOCs and Operations Head, and emails only the Finance Head staff member", async () => {
    const { ctx, scheduledEmails, tables } = makeCreateJobCardCtx();

    await (createFromQuery as any)._handler(ctx, {
      confirmedPax: 24,
      queryId: "queries_1",
    });

    const notifications = tables.notifications;
    expect(notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: "jobCards_2",
          entityType: "jobCard",
          recipientRole: "Contracting",
          title: "Job Card opened — start operations",
        }),
        expect.objectContaining({
          entityId: "jobCards_2",
          entityType: "jobCard",
          recipientRole: "Operations",
          title: "Job Card opened — start operations",
        }),
        expect.objectContaining({
          entityId: "jobCards_2",
          entityType: "jobCard",
          recipientRole: "Ticketing",
          title: "Job Card opened — start operations",
        }),
        expect.objectContaining({
          entityId: "jobCards_2",
          entityType: "jobCard",
          recipientUserId: "auth_contracting",
          title: "Job Card opened on your query",
        }),
        expect.objectContaining({
          entityId: "jobCards_2",
          entityType: "jobCard",
          recipientUserId: "auth_ticketing",
          title: "Job Card opened on your query",
        }),
        expect.objectContaining({
          entityId: "jobCards_2",
          entityType: "jobCard",
          recipientUserId: "auth_finance_head",
          title: "Job Card opened",
        }),
      ])
    );
    expect(notifications.some((row) => row.recipientRole === "Finance")).toBe(false);
    expect(notifications.some((row) => row.recipientUserId === "auth_finance_user")).toBe(false);

    const operationsEmail = scheduledEmails.find(
      ({ args }) => args.title === "Job Card opened — start operations"
    );
    expect(operationsEmail?.args.recipients).toEqual(["operations-head@citius.in"]);
    expect(
      scheduledEmails.some(({ args }) => args.recipients.includes("operations@citius.in"))
    ).toBe(false);
    expect(
      scheduledEmails.some(({ args }) =>
        args.recipients.includes("contracting-unassigned@citius.in")
      )
    ).toBe(false);
    expect(
      scheduledEmails.some(({ args }) => args.recipients.includes("contracting@citius.in"))
    ).toBe(true);
    expect(
      scheduledEmails.some(({ args }) => args.recipients.includes("ticketing@citius.in"))
    ).toBe(true);
  });

  test("sends no Job Card emails when every staff member has email alerts disabled", async () => {
    const { ctx, scheduledEmails, tables } = makeCreateJobCardCtx();
    for (const staff of tables.staffUsers) {
      staff.emailAlertRoles = [];
    }

    await (createFromQuery as any)._handler(ctx, {
      confirmedPax: 24,
      queryId: "queries_1",
    });

    expect(tables.notifications.length).toBeGreaterThan(0);
    expect(scheduledEmails).toHaveLength(0);
  });

  test("skips Ticketing notifications when the confirmed query scope says ticketing is not required", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();
    tables.queries[0].ticketingScope = "Not required";

    await (createFromQuery as any)._handler(ctx, {
      confirmedPax: 24,
      queryId: "queries_1",
    });

    const notifications = tables.notifications;
    expect(notifications.some((row) => row.recipientRole === "Ticketing")).toBe(false);
    expect(notifications.some((row) => row.recipientRole === "Head of Ticketing")).toBe(false);
    expect(notifications.some((row) => row.recipientUserId === "auth_ticketing")).toBe(false);
    expect(notifications.some((row) => row.recipientRole === "Operations")).toBe(true);
    expect(notifications.some((row) => row.recipientRole === "Contracting")).toBe(true);
  });

  test("job card creation notifications deep-link to the Job Card operating surface", () => {
    for (const title of [
      "Job Card opened",
      "Job Card opened — start operations",
      "Job Card opened on your query",
    ]) {
      expect(getNotificationHref({ entityId: "jobCards_2", entityType: "jobCard", title })).toBe(
        "/portal/job-cards?open=jobCard&id=jobCards_2"
      );
    }
  });

  test("identifies Finance Head from the canonical staff function", () => {
    expect(
      isFinanceHeadStaff({ _id: "staff_finance", active: true, function: "Finance Head" })
    ).toBe(true);
    expect(isFinanceHeadStaff({ _id: "staff_finance", active: true, function: "Finance" })).toBe(
      false
    );
  });

  test("identifies all active Accounts staff as Job Card creator handoff recipients", () => {
    expect(
      isJobCardCreatorNotificationTarget({
        active: true,
        roles: ["Accounts"],
      })
    ).toBe(true);
    expect(
      isJobCardCreatorNotificationTarget({
        active: true,
        roles: ["Accounts Head"],
      })
    ).toBe(true);
    expect(
      isJobCardCreatorNotificationTarget({
        active: true,
        roles: ["Finance"],
      })
    ).toBe(false);
  });

  test("detects Ticketing work from Ticketing Scope or assigned Ticketing SPOC", () => {
    expect(queryRequiresTicketingWork({ ticketingScope: "Both" })).toBe(true);
    expect(queryRequiresTicketingWork({ ticketingScope: "Not required" })).toBe(false);
    expect(queryRequiresTicketingWork({ ticketingOwnerId: "staff_ticketing" })).toBe(true);
    expect(queryRequiresTicketingWork({})).toBe(false);
  });
});
