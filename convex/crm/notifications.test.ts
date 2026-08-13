import { describe, expect, test } from "bun:test";
import {
  canReceiveNotification,
  expandNotificationEmailRoles,
  publishWorkflowNotification,
} from "./lib";
import { getNotificationHref } from "./notificationPaths";

describe("notification paths", () => {
  test("matches contracting query titles to team assignment on queries list", () => {
    expect(
      getNotificationHref({
        entityId: "query_1",
        entityType: "query",
        title: "Query submitted to Contracting",
      })
    ).toBe("/portal/queries?open=assignQueryTeams&id=query_1");
  });

  test("maps sales review notifications to sales decision modal", () => {
    expect(
      getNotificationHref({
        entityId: "query_1",
        entityType: "query",
        title: "Proposal ready for review",
      })
    ).toBe("/portal/queries?open=salesDecision&id=query_1");
  });

  test("maps accounts job card alerts to accounts workspace", () => {
    expect(
      getNotificationHref({
        entityId: "query_1",
        entityType: "query",
        title: "Order confirmed — open Job Card",
      })
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query_1");
  });

  test("maps owner assignment titles to job card modals", () => {
    expect(
      getNotificationHref({
        entityId: "job_1",
        entityType: "jobCard",
        title: "Assign operations owner",
      })
    ).toBe("/portal/job-cards?open=assignOperationsOwner&id=job_1");
  });

  test("falls back to activity when entity is missing", () => {
    expect(getNotificationHref({ entityId: "", entityType: "", title: "Ping" })).toBe(
      "/portal/activity"
    );
  });
});

describe("canReceiveNotification", () => {
  const access = {
    authUserId: "user_a",
    roles: ["Sales", "Operations"],
    staffId: "staff_a" as never,
  };

  test("allows notifications targeted at the signed-in user", () => {
    expect(canReceiveNotification({ recipientUserId: "user_a" }, access)).toBe(true);
  });

  test("rejects notifications for a different user", () => {
    expect(canReceiveNotification({ recipientUserId: "user_b" }, access)).toBe(false);
  });

  test("allows staff-targeted notifications even when auth user id changed", () => {
    expect(
      canReceiveNotification(
        { recipientStaffId: "staff_a" as never, recipientUserId: "old_user_a" },
        access
      )
    ).toBe(true);
  });

  test("rejects staff-targeted notifications for another staff record", () => {
    expect(
      canReceiveNotification(
        { recipientStaffId: "staff_b" as never, recipientUserId: "user_a" },
        access
      )
    ).toBe(false);
  });

  test("allows role-targeted notifications when the user has the role", () => {
    expect(canReceiveNotification({ recipientRole: "Operations" }, access)).toBe(true);
  });

  test("rejects role-targeted notifications without the role", () => {
    expect(canReceiveNotification({ recipientRole: "Finance" }, access)).toBe(false);
  });
});

describe("expandNotificationEmailRoles", () => {
  test("includes department heads for department-targeted notification emails", () => {
    expect(expandNotificationEmailRoles(["Contracting", "Operations"])).toEqual([
      "Contracting",
      "Contracting Head",
      "Operations",
      "Operations Head",
    ]);
  });

  test("does not turn head-targeted emails into base department emails", () => {
    expect(expandNotificationEmailRoles(["Contracting Head", "Operations Head"])).toEqual([
      "Contracting Head",
      "Operations Head",
    ]);
  });
});

function makePublishNotificationCtx(tables: Record<string, any[]>, scheduled: any[]) {
  const query = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const builder: any = {
      collect: async () => rows,
      unique: async () => rows[0] ?? null,
      withIndex: (_name: string, callback: (q: any) => unknown) => {
        const filters: [string, unknown][] = [];
        const q = {
          eq(field: string, value: unknown) {
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
      insert: (table: string, doc: Record<string, unknown>) => {
        if (!tables[table]) {
          tables[table] = [];
        }
        const rows = tables[table];
        const row = { _id: `${table}_${rows.length + 1}`, ...doc };
        rows.push(row);
        return row._id;
      },
      patch: (table: string, id: string, value: Record<string, unknown>) => {
        const row = (tables[table] ?? []).find((candidate) => candidate._id === id);
        Object.assign(row, value);
      },
      query,
    },
    scheduler: {
      runAfter: (_delay: number, fn: unknown, args: unknown) => {
        scheduled.push({ args, fn });
      },
    },
  };
}

describe("publishWorkflowNotification", () => {
  test("keeps bell roles exact while expanding role email recipients", async () => {
    const tables: Record<string, any[]> = {
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
    };
    const scheduled: any[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    await publishWorkflowNotification(ctx as never, {
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

  test("uses portal roles by default and additional alert roles add email-only coverage", async () => {
    const tables: Record<string, any[]> = {
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
    };
    const scheduled: any[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    await publishWorkflowNotification(ctx as never, {
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

  test("keeps Admin and Directors role-default email delivery", async () => {
    const tables: Record<string, any[]> = {
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
    };
    const scheduled: any[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    await publishWorkflowNotification(ctx as never, {
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

  test("supports an explicit no-email target without suppressing bell delivery", async () => {
    const tables: Record<string, any[]> = {
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
    };
    const scheduled: any[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    await publishWorkflowNotification(ctx as never, {
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
  test("uses the same explicit matcher independently for bell and email", async () => {
    const tables: Record<string, any[]> = {
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
    };
    const scheduled: any[] = [];
    const ctx = makePublishNotificationCtx(tables, scheduled);

    const salesMatcher = (staff: { roles: string[] }) => staff.roles.includes("Sales");
    await publishWorkflowNotification(ctx as never, {
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
});

describe("query intake notification roles", () => {
  test("routes query intake to assignment heads without the whole contracting team", async () => {
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

describe("notificationReads bounded fetch", () => {
  function makeNotificationCtx(notifications: Record<string, unknown>[]) {
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
              callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
            ) => {
              const filters: Record<string, unknown> = {};
              const builder = {
                eq(field: string, value: unknown) {
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

  test("fetchNotificationsForAccess dedupes user and role batches", async () => {
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
      ctx as never,
      {
        authUserId: "user_a",
        roles: ["Operations"],
      },
      10
    );
    expect(result.map((row) => row._id)).toEqual(["n1", "n2"]);
  });

  test("fetchNotificationsForAccess includes stable staff-id notifications", async () => {
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
      ctx as never,
      {
        authUserId: "new_user_a",
        roles: [],
        staffId: "staff_a",
      },
      10
    );
    expect(result.map((row) => row._id)).toEqual(["n1"]);
  });

  test("notificationSummaryForAccessFromDb sets hasMoreUnread when scan cap is hit", async () => {
    const { notificationSummaryForAccessFromDb } = await import("./notificationReads");
    const rows = Array.from({ length: 500 }, (_, index) => ({
      _id: `n_${index}`,
      body: "",
      createdAt: index,
      recipientUserId: "user_a",
      title: "Ping",
    }));
    const ctx = makeNotificationCtx(rows);
    const summary = await notificationSummaryForAccessFromDb(ctx as never, {
      authUserId: "user_a",
      roles: [],
    });
    expect(summary.unreadCount).toBe(500);
    expect(summary).toEqual({ coverage: "partial", hasMoreUnread: true, unreadCount: 500 });
  });
});
