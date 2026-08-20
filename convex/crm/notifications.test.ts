import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import {
  canReceiveNotification,
  expandNotificationEmailRoles,
  publishWorkflowNotification,
} from "./lib";
import { getNotificationHref } from "./notificationPaths";

const SHA_256_HEX_PATTERN = /^[a-f0-9]{64}$/;

describe("Notification paths", () => {
  test("Matches contracting query titles to team assignment on queries list", () => {
    expect(
      getNotificationHref({
        entityId: "query_1",
        entityType: "query",
        title: "Query submitted to Contracting",
      })
    ).toBe("/portal/queries?open=assignQueryTeams&id=query_1");
  });

  test("Maps sales review notifications to sales decision modal", () => {
    expect(
      getNotificationHref({
        entityId: "query_1",
        entityType: "query",
        title: "Proposal ready for review",
      })
    ).toBe("/portal/queries?open=salesDecision&id=query_1");
  });

  test("Maps accounts job card alerts to accounts workspace", () => {
    expect(
      getNotificationHref({
        entityId: "query_1",
        entityType: "query",
        title: "Order confirmed — open Job Card",
      })
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query_1");
  });

  test("Maps owner assignment titles to job card modals", () => {
    expect(
      getNotificationHref({
        entityId: "job_1",
        entityType: "jobCard",
        title: "Assign operations owner",
      })
    ).toBe("/portal/job-cards?open=assignOperationsOwner&id=job_1");
  });

  test("Falls back to activity when entity is missing", () => {
    expect(getNotificationHref({ entityId: "", entityType: "", title: "Ping" })).toBe(
      "/portal/activity"
    );
  });
});

describe("CanReceiveNotification", () => {
  const access = {
    authUserId: "user_a",
    roles: ["Sales", "Operations"],
    // SAFETY: This test controls the asserted value at the framework boundary below.
    staffId: fromAny<never, unknown>("staff_a"),
  };

  test("Allows notifications targeted at the signed-in user", () => {
    expect(canReceiveNotification({ recipientUserId: "user_a" }, access)).toBe(true);
  });

  test("Rejects notifications for a different user", () => {
    expect(canReceiveNotification({ recipientUserId: "user_b" }, access)).toBe(false);
  });

  test("Allows staff-targeted notifications even when auth user id changed", () => {
    expect(
      canReceiveNotification(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        { recipientStaffId: fromAny<never, unknown>("staff_a"), recipientUserId: "old_user_a" },
        access
      )
    ).toBe(true);
  });

  test("Rejects staff-targeted notifications for another staff record", () => {
    expect(
      canReceiveNotification(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        { recipientStaffId: fromAny<never, unknown>("staff_b"), recipientUserId: "user_a" },
        access
      )
    ).toBe(false);
  });

  test("Allows role-targeted notifications when the user has the role", () => {
    expect(canReceiveNotification({ recipientRole: "Operations" }, access)).toBe(true);
  });

  test("Rejects role-targeted notifications without the role", () => {
    expect(canReceiveNotification({ recipientRole: "Finance" }, access)).toBe(false);
  });
});

describe("ExpandNotificationEmailRoles", () => {
  test("Includes department heads for department-targeted notification emails", () => {
    expect(expandNotificationEmailRoles(["Contracting", "Operations"])).toEqual([
      "Contracting",
      "Contracting Head",
      "Operations",
      "Operations Head",
    ]);
  });

  test("Does not turn head-targeted emails into base department emails", () => {
    expect(expandNotificationEmailRoles(["Contracting Head", "Operations Head"])).toEqual([
      "Contracting Head",
      "Operations Head",
    ]);
  });
});

interface NotificationTestRow extends RuntimeObject {
  _id: string;
}

interface NotificationTestTables {
  [table: string]: NotificationTestRow[];
}

interface ScheduledNotificationCall {
  args: RuntimeObject & { eventId: string; recipients: string[] };
  fn: FunctionReference<"mutation", "internal">;
}

interface NotificationIndexQuery {
  eq: (field: string, value: RuntimeValue) => NotificationIndexQuery;
}

interface NotificationQueryBuilder {
  collect: () => Promise<NotificationTestRow[]>;
  take: (count: number) => Promise<NotificationTestRow[]>;
  unique: () => Promise<NotificationTestRow | null>;
  withIndex: (
    name: string,
    callback: (query: NotificationIndexQuery) => NotificationIndexQuery
  ) => NotificationQueryBuilder;
}

function makePublishNotificationCtx(
  tables: NotificationTestTables,
  scheduled: ScheduledNotificationCall[]
) {
  tables.operationalControlStates ??= [
    {
      _id: "control_bell",
      key: "notifications.crm_bell",
      revision: 1,
      state: "default",
    },
    {
      _id: "control_email",
      key: "email.crm_workflow",
      revision: 1,
      state: "default",
    },
  ];
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const builder: NotificationQueryBuilder = {
      collect: async () => rows,
      take: async (count) => rows.slice(0, count),
      unique: async () => rows[0] ?? null,
      withIndex: (_name: string, callback) => {
        const filters: [string, RuntimeValue][] = [];
        const q: NotificationIndexQuery = {
          eq(field: string, value: RuntimeValue) {
            filters.push([field, value]);
            return q;
          },
        };
        callback(q);
        rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
        return builder;
      },
    };
    return builder;
  };
  return {
    db: {
      insert: (table: string, doc: RuntimeObject) => {
        if (!tables[table]) {
          tables[table] = [];
        }
        const rows = tables[table];
        const row = { _id: `${table}_${rows.length + 1}`, ...doc };
        rows.push(row);
        return row._id;
      },
      patch: (table: string, id: string, value: RuntimeObject) => {
        const row = (tables[table] ?? []).find((candidate) => candidate._id === id);
        Object.assign(row, value);
      },
      query,
    },
    scheduler: {
      runAfter: (
        _delay: number,
        fn: ScheduledNotificationCall["fn"],
        args: ScheduledNotificationCall["args"]
      ) => {
        scheduled.push({ args, fn });
      },
    },
  };
}

describe("PublishWorkflowNotification", () => {
  test("Keeps bell roles exact while expanding role email recipients", async () => {
    const tables = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_accounts",
          active: true,
          email: "accounts@example.com",
          roles: ["Accounts"],
        },
        {
          _id: "staff_accounts_head",
          active: true,
          email: "head@example.com",
          roles: ["Accounts Head"],
        },
      ],
    } satisfies NotificationTestTables;
    const scheduled: ScheduledNotificationCall[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await publishWorkflowNotification(fromAny<never, unknown>(ctx), {
      bellTargets: { kind: "roles", roles: ["Accounts"] },
      content: {
        body: "Check this",
        entityId: "query_1",
        entityType: "query",
        title: "Accounts ping",
      },
      emailTargets: { kind: "roles", roles: ["Accounts"] },
    });

    expect(tables.notifications.map((row) => row.recipientRole)).toEqual(["Accounts"]);
    expect(scheduled[0].args.recipients.sort()).toEqual([
      "accounts@example.com",
      "head@example.com",
    ]);
    expect(scheduled[0].args.eventId).toBe("notifications_1");
  });

  test("Uses portal roles by default and additional alert roles add email-only coverage", async () => {
    const tables = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_ops_head",
          active: true,
          email: "ops-head@example.com",
          roles: ["Operations Head"],
        },
        {
          _id: "staff_email_delegate",
          active: true,
          email: "delegate@example.com",
          emailAlertRoles: ["Operations Head"],
          roles: ["Finance"],
        },
        {
          _id: "staff_other_head",
          active: true,
          email: "other@example.com",
          emailAlertRoles: ["Sales"],
          roles: ["Finance"],
        },
        {
          _id: "staff_admin",
          active: true,
          email: "admin@example.com",
          roles: ["Admin"],
        },
        {
          _id: "staff_director",
          active: true,
          email: "director@example.com",
          roles: ["Directors"],
        },
      ],
    } satisfies NotificationTestTables;
    const scheduled: ScheduledNotificationCall[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await publishWorkflowNotification(fromAny<never, unknown>(ctx), {
      bellTargets: { kind: "roles", roles: ["Operations Head"] },
      content: {
        body: "Review",
        entityId: "query_1",
        entityType: "query",
        title: "Query ready for assignment",
      },
      emailTargets: { kind: "roles", roles: ["Operations Head"] },
    });

    expect(tables.notifications.map((row) => row.recipientRole)).toEqual(["Operations Head"]);
    expect(scheduled[0].args.recipients.sort()).toEqual([
      "delegate@example.com",
      "ops-head@example.com",
    ]);
  });

  test("Keeps Admin and Directors role-default email delivery", async () => {
    const tables = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_admin",
          active: true,
          email: "admin@example.com",
          roles: ["Admin"],
        },
        {
          _id: "staff_director",
          active: true,
          email: "director@example.com",
          roles: ["Directors"],
        },
        {
          _id: "staff_sales",
          active: true,
          email: "sales@example.com",
          roles: ["Sales"],
        },
      ],
    } satisfies NotificationTestTables;
    const scheduled: ScheduledNotificationCall[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await publishWorkflowNotification(fromAny<never, unknown>(ctx), {
      bellTargets: { kind: "roles", roles: ["Admin", "Directors"] },
      content: {
        body: "Review",
        entityId: "query_1",
        entityType: "query",
        title: "Executive alert",
      },
      emailTargets: { kind: "roles", roles: ["Admin", "Directors"] },
    });

    expect(scheduled[0].args.recipients.sort()).toEqual([
      "admin@example.com",
      "director@example.com",
    ]);
  });

  test("Supports an explicit no-email target without suppressing bell delivery", async () => {
    const tables = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_contracting_head",
          active: true,
          email: "contracting-head@example.com",
          roles: ["Contracting Head"],
        },
        {
          _id: "staff_email_delegate",
          active: true,
          email: "delegate@example.com",
          emailAlertRoles: ["Contracting Head"],
          roles: ["Operations"],
        },
        {
          _id: "staff_contracting_member",
          active: true,
          email: "contracting@example.com",
          roles: ["Contracting"],
        },
        {
          _id: "staff_admin",
          active: true,
          email: "admin@example.com",
          roles: ["Admin"],
        },
        {
          _id: "staff_director",
          active: true,
          email: "director@example.com",
          roles: ["Directors"],
        },
      ],
    } satisfies NotificationTestTables;
    const scheduled: ScheduledNotificationCall[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await publishWorkflowNotification(fromAny<never, unknown>(ctx), {
      bellTargets: { kind: "roles", roles: ["Contracting Head"] },
      content: {
        body: "Assignment updated",
        entityId: "query_1",
        entityType: "query",
        title: "Query team assignment updated",
      },
      emailTargets: { kind: "none" },
    });

    expect(tables.notifications.map((row) => row.recipientRole)).toEqual(["Contracting Head"]);
    expect(scheduled).toHaveLength(0);
  });
  test("Uses the same explicit matcher independently for bell and email", async () => {
    const tables = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_sales_one",
          active: true,
          authUserId: "auth_sales_one",
          email: "sales-one@example.com",
          roles: ["Sales"],
        },
        {
          _id: "staff_sales_two",
          active: true,
          authUserId: "auth_sales_two",
          email: "sales-two@example.com",
          roles: ["Sales"],
        },
      ],
    } satisfies NotificationTestTables;
    const scheduled: ScheduledNotificationCall[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    const salesMatcher = (staff: { roles: string[] }) => staff.roles.includes("Sales");
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await publishWorkflowNotification(fromAny<never, unknown>(ctx), {
      bellTargets: { kind: "matching", matches: salesMatcher },
      content: { body: "Decision updated", title: "Approval updated" },
      emailTargets: { kind: "matching", matches: salesMatcher },
    });

    expect(tables.notifications).toHaveLength(2);
    expect(scheduled[0].args.recipients.sort()).toEqual([
      "sales-one@example.com",
      "sales-two@example.com",
    ]);
  });

  test("Claims an explicit effect id before concurrent bell and email side effects", async () => {
    const tables = {
      notifications: [],
      operationalEffectReceipts: [],
      staffUsers: [
        {
          _id: "staff_sales",
          active: true,
          email: "sales@example.com",
          roles: ["Sales"],
        },
      ],
    } satisfies NotificationTestTables;
    const scheduled: ScheduledNotificationCall[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);
    const plan = {
      bellTargets: { kind: "roles" as const, roles: ["Sales"] },
      content: {
        body: "One logical delivery",
        entityId: "query_1",
        entityType: "query",
        title: "Stable workflow event",
      },
      emailTargets: { kind: "roles" as const, roles: ["Sales"] },
      operationalControls: { effectId: "workflow:query_1:stable-event" },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const results = await Promise.all([
      publishWorkflowNotification(fromAny<never, unknown>(ctx), plan),
      publishWorkflowNotification(fromAny<never, unknown>(ctx), plan),
    ]);
    // SAFETY: This test context implements the mutation boundary used by the publisher.
    await expect(
      publishWorkflowNotification(fromAny<never, unknown>(ctx), {
        ...plan,
        content: { ...plan.content, body: "Different logical delivery" },
      })
    ).rejects.toThrow("OPERATIONAL_EFFECT_RECEIPT_CONFLICT");

    expect(results.map((result) => result.bell.disposition)).toEqual(["queued", "queued"]);
    expect(tables.notifications).toHaveLength(1);
    expect(scheduled).toHaveLength(1);
    expect(tables.operationalEffectReceipts).toHaveLength(2);
    expect(tables.operationalEffectReceipts[0]?.payloadFingerprint).toMatch(SHA_256_HEX_PATTERN);
    expect(JSON.stringify(tables.operationalEffectReceipts)).not.toContain("One logical delivery");
  });
});

describe("Query intake notification roles", () => {
  test("Routes query intake to assignment heads without the whole contracting team", async () => {
    const { queryAssignmentHeadRoles } = await import("./queries");

    expect(queryAssignmentHeadRoles({})).toEqual(["Contracting Head", "Operations Head"]);
    expect(queryAssignmentHeadRoles({ ticketingScope: "Not required" })).toEqual([
      "Contracting Head",
      "Operations Head",
    ]);
    expect(queryAssignmentHeadRoles({ ticketingScope: "Domestic" })).toEqual([
      "Contracting Head",
      "Operations Head",
      "Head of Ticketing",
    ]);
    expect(queryAssignmentHeadRoles({ ticketingOwnerId: "staff_ticketing" })).toEqual([
      "Contracting Head",
      "Operations Head",
      "Head of Ticketing",
    ]);
  });
});

describe("NotificationReads bounded fetch", () => {
  function makeNotificationCtx(notifications: NotificationTestRow[]) {
    return {
      db: {
        query: (table: string) => {
          if (table === "notificationReads") {
            return {
              withIndex: () => ({ collect: async () => [], unique: async () => null }),
            };
          }
          if (
            table === "notificationUnreadProjectionReadiness" ||
            table === "notificationTargetCounts" ||
            table === "notificationReadTargetCounts"
          ) {
            return { withIndex: () => ({ unique: async () => null }) };
          }
          if (table !== "notifications") {
            throw new Error(`Unexpected table ${table}`);
          }
          return {
            withIndex: (
              _indexName: string,
              callback: (query: NotificationIndexQuery) => NotificationIndexQuery
            ) => {
              const filters: RuntimeObject = {};
              const builder: NotificationIndexQuery = {
                eq(field: string, value: RuntimeValue) {
                  filters[field] = value;
                  return builder;
                },
              };
              callback(builder);
              const filtered = notifications.filter((row) =>
                Object.entries(filters).every(([field, value]) => row[field] === value)
              );
              return {
                collect: async () => filtered,
                order: () => ({
                  take: async (limit: number) =>
                    [...filtered]
                      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
                      .slice(0, limit),
                }),
              };
            },
          };
        },
      },
    };
  }

  test("FetchNotificationsForAccess dedupes user and role batches", async () => {
    const { fetchNotificationsForAccess } = await import("./notificationReads");
    const rows = [
      {
        _id: "n1",
        body: "",
        createdAt: 3,
        recipientRole: "Operations",
        title: "Ops",
      },
      {
        _id: "n2",
        body: "",
        createdAt: 2,
        recipientUserId: "user_a",
        title: "Mine",
      },
      {
        _id: "n1",
        body: "",
        createdAt: 3,
        recipientUserId: "user_a",
        title: "Dup",
      },
    ];
    const ctx = makeNotificationCtx(rows);
    const result = await fetchNotificationsForAccess(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      {
        authUserId: "user_a",
        roles: ["Operations"],
      },
      10
    );
    expect(result.map((row) => row._id)).toEqual(["n1", "n2"]);
  });

  test("FetchNotificationsForAccess includes stable staff-id notifications", async () => {
    const { fetchNotificationsForAccess } = await import("./notificationReads");
    const rows = [
      {
        _id: "n1",
        body: "",
        createdAt: 4,
        recipientStaffId: "staff_a",
        recipientUserId: "old_user_a",
        title: "Mine by staff",
      },
      {
        _id: "n2",
        body: "",
        createdAt: 3,
        recipientStaffId: "staff_b",
        title: "Other staff",
      },
    ];
    const ctx = makeNotificationCtx(rows);
    const result = await fetchNotificationsForAccess(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<never, unknown>(ctx),
      {
        authUserId: "new_user_a",
        roles: [],
        staffId: "staff_a",
      },
      10
    );
    expect(result.map((row) => row._id)).toEqual(["n1"]);
  });

  test("NotificationSummaryForAccessFromDb sets hasMoreUnread when scan cap is hit", async () => {
    const { notificationSummaryForAccessFromDb } = await import("./notificationReads");
    const rows = Array.from({ length: 500 }, (_, index) => ({
      _id: `n_${index}`,
      body: "",
      createdAt: index,
      recipientUserId: "user_a",
      title: "Ping",
    }));
    const ctx = makeNotificationCtx(rows);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summary = await notificationSummaryForAccessFromDb(fromAny<never, unknown>(ctx), {
      authUserId: "user_a",
      roles: [],
    });
    expect(summary.unreadCount).toBe(500);
    expect(summary).toEqual({ coverage: "partial", hasMoreUnread: true, unreadCount: 500 });
  });
});
