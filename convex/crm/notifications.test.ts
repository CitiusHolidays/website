import { describe, expect, test } from "bun:test";
import { canReceiveNotification } from "./lib";
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
  const access = { authUserId: "user_a", roles: ["Sales", "Operations"] };

  test("allows notifications targeted at the signed-in user", () => {
    expect(canReceiveNotification({ recipientUserId: "user_a" }, access)).toBe(true);
  });

  test("rejects notifications for a different user", () => {
    expect(canReceiveNotification({ recipientUserId: "user_b" }, access)).toBe(false);
  });

  test("allows role-targeted notifications when the user has the role", () => {
    expect(canReceiveNotification({ recipientRole: "Operations" }, access)).toBe(true);
  });

  test("rejects role-targeted notifications without the role", () => {
    expect(canReceiveNotification({ recipientRole: "Finance" }, access)).toBe(false);
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
