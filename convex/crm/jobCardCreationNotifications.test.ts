import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { isRuntimeObject } from "../lib/runtimeValues";
import { createFromQuery, isFinanceHeadStaff, queryRequiresTicketingWork } from "./jobCards";
import { getNotificationHref } from "./notificationPaths";
import { isJobCardCreatorNotificationTarget } from "./queries";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}
type Tables = Record<string, Row[]>;

function makeCreateJobCardCtx() {
  const tables = {
    activityLogs: [],
    checklistTasks: [],
    commandReceipts: [],
    confirmedOffers: [
      {
        _id: "confirmedOffers_1",
        airfarePerPax: 20_000,
        approxMargin: 10_000,
        confirmedAt: 140,
        confirmedPax: 24,
        createdAt: 140,
        createdBy: "auth_sales",
        destination: "Dubai",
        landCostPerPax: 45_000,
        profitPerPax: 30_000,
        proposalId: "proposals_1",
        proposalQueryHandoffId: "proposalQueryHandoffs_1",
        proposalRevision: 1,
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
    operationalControlStates: [
      { _id: "control_bell", key: "notifications.crm_bell", state: "default" },
      { _id: "control_email", key: "email.crm_workflow", state: "default" },
    ],
    operationalEffectReceipts: [],
    proposalQueryHandoffs: [
      {
        _id: "proposalQueryHandoffs_1",
        clientName: "Acme Ltd",
        proposalId: "proposals_1",
        proposalRevision: 1,
        queryId: "queries_1",
      },
    ],
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
  } satisfies Tables;
  const scheduledEmails: any[] = [];
  let identity = {
    email: "accounts@citius.in",
    name: "Nina Shah",
    subject: "auth_accounts",
  };

  const getRows = (table: string) => tables[table] ?? [];
  const findById = async (table: string, id: string) =>
    getRows(table).find((entry) => entry._id === id) ?? null;
  const queryBuilder = (table: string) => {
    let rows = getRows(table);
    const builder = {
      collect: async () => rows.map((row) => ({ ...row })),
      first: async () => rows[0] ?? null,
      take: async (limit: number) => rows.slice(0, limit),
      unique: async () => rows[0] ?? null,
      withIndex(_indexName: string, callback: (q: any) => RuntimeValue) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: RuntimeValue) {
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
      getUserIdentity: async () => identity,
    },
    db: {
      get: findById,
      insert: (table: string, doc: RuntimeObject) => {
        const id = `${table}_${getRows(table).length + 1}`;
        const row = { _id: id, ...doc };
        tables[table] = [...getRows(table), row];
        return Promise.resolve(id);
      },
      normalizeId: (_table: string, id: string | null | undefined) => id ?? null,
      patch: (_table: string, id: string, patch: RuntimeObject) => {
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return Promise.resolve();
          }
        }
      },
      query: (table: string) => queryBuilder(table),
    },
    scheduler: {
      runAfter: (
        _delay: number,
        fn: FunctionReference<"mutation", "internal">,
        args: RuntimeObject
      ) => {
        if (args && isRuntimeObject(args) && "recipients" in args) {
          scheduledEmails.push({ args, fn });
        }
        return Promise.resolve();
      },
    },
  };

  return {
    ctx,
    scheduledEmails,
    setIdentity: (nextIdentity: typeof identity) => {
      identity = nextIdentity;
    },
    tables,
  };
}

const CREATE_JOB_CARD_ARGS = {
  commandId: "88888888-8888-4888-8888-888888888888",
  confirmedOfferId: "confirmedOffers_1",
  confirmedPax: 24,
  proposalId: "proposals_1",
  proposalQueryHandoffId: "proposalQueryHandoffs_1",
  proposalRevision: 1,
  queryId: "queries_1",
};

describe("Job Card creation notifications", () => {
  test("Allows Accounts to create from a Confirmed Offer and uses Assigned Sales Rep initials", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);

    expect(result).toEqual({
      id: "jobCards_2",
      jobCode: "JC-0004-MK",
    });
    expect(tables.jobCards[1]).toMatchObject({
      confirmedOfferId: "confirmedOffers_1",
      createdBy: "auth_accounts",
      jobCode: "JC-0004-MK",
      landCostPerPax: 45_000,
      openingSnapshot: {
        authority: {
          confirmedOfferId: "confirmedOffers_1",
          proposalId: "proposals_1",
          proposalQueryHandoffId: "proposalQueryHandoffs_1",
          proposalRevision: 1,
          queryId: "queries_1",
        },
        effective: {
          clientName: "Acme Ltd",
          confirmedPax: 24,
          destination: "Dubai",
          roomCount: 0,
          travelEndDate: "2026-08-05",
          travelStartDate: "2026-08-01",
        },
        source: {
          clientName: "Acme Ltd",
          confirmedPax: 24,
          destination: "Dubai",
          travelEndDate: "2026-08-05",
          travelStartDate: "2026-08-01",
        },
        variances: [],
        version: 1,
      },
      proposalId: "proposals_1",
      proposalQueryHandoffId: "proposalQueryHandoffs_1",
      proposalRevision: 1,
      queryId: "queries_1",
      sellingPricePerPax: 100_000,
    });
    expect(tables.activityLogs[0]).toMatchObject({
      metadata: {
        openingSnapshot: {
          effective: { confirmedPax: 24, destination: "Dubai" },
          source: { confirmedPax: 24, destination: "Dubai" },
          variances: [],
          version: 1,
        },
      },
    });
  });

  test("Records per-field opening variances from immutable offer evidence, not mutable Query values", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();
    tables.queries[0].clientName = "Stale Query Client";
    tables.queries[0].destination = "Stale Query Destination";
    tables.queries[0].paxCount = 999;
    tables.queries[0].travelStartDate = "2030-01-01";
    tables.queries[0].travelEndDate = "2030-01-31";

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(createFromQuery)._handler(ctx, {
      ...CREATE_JOB_CARD_ARGS,
      confirmedPax: 26,
      destination: "Abu Dhabi",
      openingVarianceReasons: {
        confirmedPax: "Two additional attendees were confirmed",
        destination: "The operated arrival city changed",
      },
    });

    expect(tables.jobCards[1]).toMatchObject({
      clientName: "Acme Ltd",
      confirmedPax: 26,
      destination: "Abu Dhabi",
      openingSnapshot: {
        effective: {
          clientName: "Acme Ltd",
          confirmedPax: 26,
          destination: "Abu Dhabi",
          travelEndDate: "2026-08-05",
          travelStartDate: "2026-08-01",
        },
        source: {
          clientName: "Acme Ltd",
          confirmedPax: 24,
          destination: "Dubai",
          travelEndDate: "2026-08-05",
          travelStartDate: "2026-08-01",
        },
        variances: [
          {
            field: "confirmedPax",
            fromValue: "24",
            reason: "Two additional attendees were confirmed",
            toValue: "26",
          },
          {
            field: "destination",
            fromValue: "Dubai",
            reason: "The operated arrival city changed",
            toValue: "Abu Dhabi",
          },
        ],
      },
    });
    expect(
      tables.notifications.some(
        (row) =>
          row.title === "Job Card opened — start operations" &&
          String(row.body).includes("Acme Ltd, Abu Dhabi, 26 pax")
      )
    ).toBe(true);
  });

  test("Rejects an opening override without its own reason or a reason without a change", async () => {
    const first = makeCreateJobCardCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(first.ctx, {
        ...CREATE_JOB_CARD_ARGS,
        confirmedPax: 26,
      })
    ).rejects.toThrow("Explain why confirmedPax differs");
    expect(first.tables.jobCards).toHaveLength(1);
    expect(first.tables.commandReceipts).toHaveLength(0);

    const second = makeCreateJobCardCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(second.ctx, {
        ...CREATE_JOB_CARD_ARGS,
        openingVarianceReasons: { destination: "No actual destination change" },
      })
    ).rejects.toThrow("Remove the destination variance reason");
    expect(second.tables.jobCards).toHaveLength(1);
  });

  test("Records an explicitly cleared optional opening value instead of silently restoring source", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(createFromQuery)._handler(ctx, {
      ...CREATE_JOB_CARD_ARGS,
      destination: "",
      openingVarianceReasons: { destination: "Destination will be finalized by Operations" },
    });

    expect(tables.jobCards[1]).toMatchObject({
      destination: "",
      openingSnapshot: {
        effective: { destination: "" },
        variances: [
          {
            field: "destination",
            fromValue: "Dubai",
            reason: "Destination will be finalized by Operations",
            toValue: "",
          },
        ],
      },
    });
  });

  test("Validates effective dates and numeric opening facts at the server boundary", async () => {
    const inverted = makeCreateJobCardCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(inverted.ctx, {
        ...CREATE_JOB_CARD_ARGS,
        openingVarianceReasons: { travelEndDate: "The operating window changed" },
        travelEndDate: "2026-07-31",
      })
    ).rejects.toThrow("Travel start date must be on or before Travel end date");
    expect(inverted.tables.jobCards).toHaveLength(1);

    const fractionalPax = makeCreateJobCardCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(fractionalPax.ctx, {
        ...CREATE_JOB_CARD_ARGS,
        confirmedPax: 1.5,
      })
    ).rejects.toThrow("whole number greater than zero");

    const negativeRooms = makeCreateJobCardCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(negativeRooms.ctx, {
        ...CREATE_JOB_CARD_ARGS,
        roomCount: -1,
      })
    ).rejects.toThrow("Room count must be a non-negative number");
  });

  test("Never promotes a caller client into immutable opening evidence", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();
    tables.proposalQueryHandoffs[0].clientName = "";

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(ctx, {
        ...CREATE_JOB_CARD_ARGS,
        clientName: "Caller supplied client",
      })
    ).rejects.toThrow("immutable Proposal handoff must identify the Job Card client");
    expect(tables.jobCards).toHaveLength(1);
    expect(tables.commandReceipts).toHaveLength(0);
  });

  test("Notifies downstream roles, emails assigned SPOCs and Operations Head, and emails only the Finance Head staff member", async () => {
    const { ctx, scheduledEmails, tables } = makeCreateJobCardCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);

    const { notifications } = tables;
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

  test("Keeps role-default Job Card emails when additional alert roles are empty", async () => {
    const { ctx, scheduledEmails, tables } = makeCreateJobCardCtx();
    for (const staff of tables.staffUsers) {
      staff.emailAlertRoles = [];
    }

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);

    expect(tables.notifications.length).toBeGreaterThan(0);
    expect(scheduledEmails).toHaveLength(5);
    expect(scheduledEmails.flatMap(({ args }) => args.recipients).sort()).toEqual([
      "contracting@citius.in",
      "finance-head@citius.in",
      "operations-head@citius.in",
      "sales@citius.in",
      "ticketing@citius.in",
    ]);
  });

  test("Skips Ticketing notifications when the confirmed query scope says ticketing is not required", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();
    tables.queries[0].ticketingScope = "Not required";

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);

    const { notifications } = tables;
    expect(notifications.some((row) => row.recipientRole === "Ticketing")).toBe(false);
    expect(notifications.some((row) => row.recipientRole === "Head of Ticketing")).toBe(false);
    expect(notifications.some((row) => row.recipientUserId === "auth_ticketing")).toBe(false);
    expect(notifications.some((row) => row.recipientRole === "Operations")).toBe(true);
    expect(notifications.some((row) => row.recipientRole === "Contracting")).toBe(true);
  });

  test("Replays the same exact Confirmed Offer command without duplicate Job Cards", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const replay = await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);

    expect(replay).toEqual(first);
    expect(tables.jobCards).toHaveLength(2);
    expect(tables.commandReceipts).toHaveLength(1);
    expect(tables.activityLogs.filter((row) => row.action === "created")).toHaveLength(1);
  });

  test("Rejects a changed opening payload when a command id is replayed", async () => {
    const { ctx, tables } = makeCreateJobCardCtx();

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(ctx, {
        ...CREATE_JOB_CARD_ARGS,
        roomCount: 12,
      })
    ).rejects.toThrow("Command ID was already used with different input");

    expect(tables.jobCards).toHaveLength(2);
    expect(tables.commandReceipts).toHaveLength(1);
  });

  test("Rejects mismatched exact revision authority and non-Accounts actors", async () => {
    const { ctx, setIdentity, tables } = makeCreateJobCardCtx();

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(ctx, {
        ...CREATE_JOB_CARD_ARGS,
        proposalRevision: 2,
      })
    ).rejects.toThrow("exact Proposal revision");
    setIdentity({
      email: "sales@citius.in",
      name: "Maya Kapoor",
      subject: "auth_sales",
    });
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(createFromQuery)._handler(ctx, CREATE_JOB_CARD_ARGS)
    ).rejects.toThrow();
    expect(tables.jobCards).toHaveLength(1);
    expect(tables.commandReceipts).toHaveLength(0);
  });

  test("Job card creation notifications deep-link to the Job Card operating surface", () => {
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

  test("Identifies Finance Head from the canonical staff function", () => {
    expect(
      isFinanceHeadStaff({ _id: "staff_finance", active: true, function: "Finance Head" })
    ).toBe(true);
    expect(isFinanceHeadStaff({ _id: "staff_finance", active: true, function: "Finance" })).toBe(
      false
    );
  });

  test("Identifies all active Accounts staff as Job Card creator handoff recipients", () => {
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

  test("Detects Ticketing work from Ticketing Scope or assigned Ticketing SPOC", () => {
    expect(queryRequiresTicketingWork({ ticketingScope: "Both" })).toBe(true);
    expect(queryRequiresTicketingWork({ ticketingScope: "Not required" })).toBe(false);
    expect(queryRequiresTicketingWork({ ticketingOwnerId: "staff_ticketing" })).toBe(true);
    expect(queryRequiresTicketingWork({})).toBe(false);
  });
});
