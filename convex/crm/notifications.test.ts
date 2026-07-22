import { describe, expect, test } from "bun:test";
import {
  canReceiveNotification,
  expandNotificationEmailRoles,
  notifyRoles,
  notifyStaffMatching,
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

describe("notifyRoles", () => {
  test("uses expanded role recipients for bell rows and email recipients", async () => {
    const tables: Record<string, any[]> = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_accounts",
          active: true,
          email: "accounts@example.com",
          emailAlertRoles: ["Accounts"],
          roles: ["Accounts"],
        },
        {
          _id: "staff_accounts_head",
          active: true,
          email: "head@example.com",
          emailAlertRoles: ["Accounts Head"],
          roles: ["Accounts Head"],
        },
      ],
    };
    const scheduled: any[] = [];
    const ctx = {
      db: {
        insert: async (table: string, doc: Record<string, unknown>) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => ({
          collect: async () => tables[table] ?? [],
        }),
      },
      scheduler: {
        runAfter: async (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ args, fn });
        },
      },
    };

    await notifyRoles(ctx as never, ["Accounts"], {
      body: "Check this",
      entityId: "query_1",
      entityType: "query",
      title: "Accounts ping",
    });

    expect(tables.notifications.map((row) => row.recipientRole).sort()).toEqual([
      "Accounts",
      "Accounts Head",
    ]);
    expect(scheduled[0].args.recipients.sort()).toEqual([
      "accounts@example.com",
      "head@example.com",
    ]);
    expect(scheduled[0].args.eventId).toBe("notifications_1");
  });

  test("uses only staff email alert roles, never assigned portal roles", async () => {
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
          _id: "staff_email_optout",
          active: true,
          email: "optout@example.com",
          emailAlertRoles: ["Sales"],
          roles: ["Operations Head"],
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
    const ctx = {
      db: {
        insert: async (table: string, doc: Record<string, unknown>) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => ({
          collect: async () => tables[table] ?? [],
        }),
      },
      scheduler: {
        runAfter: async (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ args, fn });
        },
      },
    };

    await notifyRoles(
      ctx as never,
      ["Operations Head"],
      {
        body: "Review",
        entityId: "query_1",
        entityType: "query",
        title: "Query ready for assignment",
      },
      { emailRoles: ["Operations Head"] }
    );

    expect(tables.notifications.map((row) => row.recipientRole)).toEqual(["Operations Head"]);
    expect(scheduled[0].args.recipients).toEqual(["delegate@example.com"]);
  });

  test("does not send Admin or Directors emails without per-person settings opt-in", async () => {
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
    const ctx = {
      db: {
        insert: async (table: string, doc: Record<string, unknown>) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => ({
          collect: async () => tables[table] ?? [],
        }),
      },
      scheduler: {
        runAfter: async (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ args, fn });
        },
      },
    };

    await notifyRoles(ctx as never, ["Admin", "Directors"], {
      body: "Review",
      entityId: "query_1",
      entityType: "query",
      title: "Executive alert",
    });

    expect(scheduled).toHaveLength(0);
  });

  test("can keep oversight bell rows without sending role emails", async () => {
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
    const ctx = {
      db: {
        insert: (table: string, doc: Record<string, unknown>) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return Promise.resolve(row._id);
        },
        query: (table: string) => ({
          collect: () => Promise.resolve(tables[table] ?? []),
        }),
      },
      scheduler: {
        runAfter: (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ args, fn });
          return Promise.resolve();
        },
      },
    };

    await notifyRoles(
      ctx as never,
      ["Contracting Head"],
      {
        body: "Assignment updated",
        entityId: "query_1",
        entityType: "query",
        title: "Query team assignment updated",
      },
      { emailRoles: [] }
    );

    expect(tables.notifications.map((row) => row.recipientRole)).toEqual(["Contracting Head"]);
    expect(scheduled).toHaveLength(0);
  });
});

describe("notifyStaffMatching", () => {
  test("keeps bell delivery but requires per-person email opt-in", async () => {
    const tables: Record<string, any[]> = {
      notifications: [],
      staffUsers: [
        {
          _id: "staff_no_email",
          active: true,
          authUserId: "auth_no_email",
          email: "no-email@example.com",
          roles: ["Sales"],
        },
        {
          _id: "staff_opted_in",
          active: true,
          authUserId: "auth_opted_in",
          email: "opted-in@example.com",
          emailAlertRoles: ["Sales"],
          roles: ["Sales"],
        },
      ],
    };
    const scheduled: any[] = [];
    const ctx = {
      db: {
        insert: async (table: string, doc: Record<string, unknown>) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
        query: (table: string) => ({
          collect: async () => tables[table] ?? [],
        }),
      },
      scheduler: {
        runAfter: async (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ args, fn });
        },
      },
    };

    await notifyStaffMatching(
      ctx as never,
      (staff) => staff.roles.includes("Sales"),
      { body: "Decision updated", title: "Approval updated" },
      { emailRoles: ["Sales"] }
    );

    expect(tables.notifications).toHaveLength(2);
    expect(scheduled[0].args.recipients).toEqual(["opted-in@example.com"]);
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
    expect(summary).toEqual({ hasMoreUnread: true, unreadCount: 500 });
  });
});
