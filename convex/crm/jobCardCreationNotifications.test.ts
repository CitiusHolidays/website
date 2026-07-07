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
        contractingOwnerId: "staff_contracting",
        contractingOwnerName: "Contracting SPOC",
        contractingStatus: "Order Confirmed",
        createdAt: 100,
        createdBy: "auth_sales",
        destination: "Dubai",
        paxCount: 24,
        queryCode: "Q-0001",
        queryType: "MICE",
        salesOwnerName: "Sales Owner",
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
        emailNormalized: "contracting@citius.in",
        name: "Contracting SPOC",
        roles: ["Contracting"],
      },
      {
        _id: "staff_ticketing",
        active: true,
        authUserId: "auth_ticketing",
        email: "ticketing@citius.in",
        emailNormalized: "ticketing@citius.in",
        name: "Ticketing SPOC",
        roles: ["Ticketing"],
      },
      {
        _id: "staff_finance",
        active: true,
        authUserId: "auth_finance_head",
        email: "finance-head@citius.in",
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
  test("allows any Accounts staff member to create for confirmed queries and uses creator initials", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

    const result = await (createFromQuery as any)._handler(ctx, {
      confirmedPax: 24,
      queryId: "queries_1",
    });

    expect(result).toEqual({
      id: "jobCards_2",
      jobCode: "JC-0004-NS",
    });
    expect(tables.jobCards[1]).toMatchObject({
      createdBy: "auth_accounts",
      jobCode: "JC-0004-NS",
      proposalId: "proposals_1",
      queryId: "queries_1",
    });
  });

  test("notifies downstream roles, assigned SPOCs, and only the Finance Head staff member", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

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
