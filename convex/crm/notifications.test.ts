import { describe, expect, test } from "bun:test";
import { canReceiveNotification, expandNotificationEmailRoles, notifyRoles } from "./lib";
import { getNotificationHref } from "./notificationPaths";

describe("notification paths", () => {
  test("matches contracting query titles to team assignment on queries list", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query_1",
        title: "Query submitted to Contracting",
      }),
    ).toBe("/portal/queries?open=assignQueryTeams&id=query_1");
  });

  test("maps sales review notifications to sales decision modal", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query_1",
        title: "Proposal ready for review",
      }),
    ).toBe("/portal/queries?open=salesDecision&id=query_1");
  });

  test("maps accounts job card alerts to accounts workspace", () => {
    expect(
      getNotificationHref({
        entityType: "query",
        entityId: "query_1",
        title: "Order confirmed — open Job Card",
      }),
    ).toBe("/portal/accounts/job-cards?open=jobCard&queryId=query_1");
  });

  test("maps owner assignment titles to job card modals", () => {
    expect(
      getNotificationHref({
        entityType: "jobCard",
        entityId: "job_1",
        title: "Assign operations owner",
      }),
    ).toBe("/portal/job-cards?open=assignOperationsOwner&id=job_1");
  });

  test("falls back to activity when entity is missing", () => {
    expect(getNotificationHref({ entityType: "", entityId: "", title: "Ping" })).toBe(
      "/portal/activity",
    );
  });
});

describe("canReceiveNotification", () => {
  const access = {
    staffId: "staff_a" as never,
    authUserId: "user_a",
    roles: ["Sales", "Operations"],
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
        access,
      ),
    ).toBe(true);
  });

  test("rejects staff-targeted notifications for another staff record", () => {
    expect(
      canReceiveNotification(
        { recipientStaffId: "staff_b" as never, recipientUserId: "user_a" },
        access,
      ),
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
      staffUsers: [
        {
          _id: "staff_accounts",
          email: "accounts@example.com",
          roles: ["Accounts"],
          active: true,
        },
        {
          _id: "staff_accounts_head",
          email: "head@example.com",
          roles: ["Accounts Head"],
          active: true,
        },
      ],
      notifications: [],
    };
    const scheduled: any[] = [];
    const ctx = {
      scheduler: {
        runAfter: async (_delay: number, fn: unknown, args: unknown) => {
          scheduled.push({ fn, args });
        },
      },
      db: {
        query: (table: string) => ({
          collect: async () => tables[table] ?? [],
        }),
        insert: async (table: string, doc: Record<string, unknown>) => {
          const row = { _id: `${table}_${tables[table].length + 1}`, ...doc };
          tables[table].push(row);
          return row._id;
        },
      },
    };

    await notifyRoles(ctx as never, ["Accounts"], {
      title: "Accounts ping",
      body: "Check this",
      entityType: "query",
      entityId: "query_1",
    });

    expect(tables.notifications.map((row) => row.recipientRole).sort()).toEqual([
      "Accounts",
      "Accounts Head",
    ]);
    expect(scheduled[0].args.recipients.sort()).toEqual([
      "accounts@example.com",
      "head@example.com",
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
              callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
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
                Object.entries(filters).every(([field, value]) => row[field] === value),
              );
              return {
                order: () => ({
                  take: async (limit: number) =>
                    [...filtered]
                      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
                      .slice(0, limit),
                }),
                collect: async () => filtered,
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
        title: "Ops",
        body: "",
        recipientRole: "Operations",
        createdAt: 3,
      },
      {
        _id: "n2",
        title: "Mine",
        body: "",
        recipientUserId: "user_a",
        createdAt: 2,
      },
      {
        _id: "n1",
        title: "Dup",
        body: "",
        recipientUserId: "user_a",
        createdAt: 3,
      },
    ];
    const ctx = makeNotificationCtx(rows);
    const result = await fetchNotificationsForAccess(
      ctx as never,
      {
        authUserId: "user_a",
        roles: ["Operations"],
      },
      10,
    );
    expect(result.map((row) => row._id)).toEqual(["n1", "n2"]);
  });

  test("fetchNotificationsForAccess includes stable staff-id notifications", async () => {
    const { fetchNotificationsForAccess } = await import("./notificationReads");
    const rows = [
      {
        _id: "n1",
        title: "Mine by staff",
        body: "",
        recipientStaffId: "staff_a",
        recipientUserId: "old_user_a",
        createdAt: 4,
      },
      {
        _id: "n2",
        title: "Other staff",
        body: "",
        recipientStaffId: "staff_b",
        createdAt: 3,
      },
    ];
    const ctx = makeNotificationCtx(rows);
    const result = await fetchNotificationsForAccess(
      ctx as never,
      {
        staffId: "staff_a",
        authUserId: "new_user_a",
        roles: [],
      },
      10,
    );
    expect(result.map((row) => row._id)).toEqual(["n1"]);
  });

  test("notificationSummaryForAccessFromDb sets hasMoreUnread when scan cap is hit", async () => {
    const { notificationSummaryForAccessFromDb } = await import("./notificationReads");
    const rows = Array.from({ length: 500 }, (_, index) => ({
      _id: `n_${index}`,
      title: "Ping",
      body: "",
      recipientUserId: "user_a",
      createdAt: index,
    }));
    const ctx = makeNotificationCtx(rows);
    const summary = await notificationSummaryForAccessFromDb(ctx as never, {
      authUserId: "user_a",
      roles: [],
    });
    expect(summary.unreadCount).toBe(500);
    expect(summary).toEqual({ unreadCount: 500, hasMoreUnread: true });
  });
});
