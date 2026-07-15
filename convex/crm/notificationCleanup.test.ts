import { describe, expect, test } from "bun:test";
import {
  deleteNotificationPage,
  groupNotificationIdentities,
  NOTIFICATION_CLEANUP_MAX_IDENTITIES_PER_REQUEST,
  NOTIFICATION_CLEANUP_PAGE_SIZE,
  NOTIFICATION_ENTITY_GROUP_SIZE,
  queueEntityNotificationCleanup,
} from "./notificationCleanup";

describe("indexed notification cleanup", () => {
  test("deduplicates and bounds many entity cleanups by operation", () => {
    const identities = Array.from(
      { length: NOTIFICATION_ENTITY_GROUP_SIZE * 3 + 2 },
      (_, index) => ({ entityId: `query_${index}`, entityType: "query" })
    );
    identities.push(identities[0], identities[1]);

    const groups = groupNotificationIdentities(identities);
    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.length <= NOTIFICATION_ENTITY_GROUP_SIZE)).toBeTrue();
    expect(groups.flat()).toHaveLength(NOTIFICATION_ENTITY_GROUP_SIZE * 3 + 2);
  });

  test("schedules only bounded identity groups", async () => {
    const scheduled: Array<{ identities: Array<{ entityId: string; entityType: string }> }> = [];
    const identities = Array.from(
      { length: NOTIFICATION_ENTITY_GROUP_SIZE * 3 + 2 },
      (_, index) => ({ entityId: `query_${index}`, entityType: "query" })
    );
    const result = await queueEntityNotificationCleanup(
      {
        scheduler: {
          runAfter: async (_delay: number, _reference: unknown, args: any) => {
            scheduled.push(args);
          },
        },
      } as any,
      [...identities, identities[0]]
    );

    expect(result).toEqual({ groups: 4, identities: identities.length });
    expect(scheduled).toHaveLength(4);
    expect(
      scheduled.every((entry) => entry.identities.length <= NOTIFICATION_ENTITY_GROUP_SIZE)
    ).toBeTrue();
  });

  test("rejects an unbounded originating cleanup request", async () => {
    const identities = Array.from(
      { length: NOTIFICATION_CLEANUP_MAX_IDENTITIES_PER_REQUEST + 1 },
      (_, index) => ({ entityId: `query_${index}`, entityType: "query" })
    );
    await expect(
      queueEntityNotificationCleanup({ scheduler: { runAfter: async () => {} } } as any, identities)
    ).rejects.toThrow("must be split");
  });

  test("deletes only one bounded entity page per worker turn", async () => {
    const rows = Array.from({ length: NOTIFICATION_CLEANUP_PAGE_SIZE * 2 + 5 }, (_, index) => ({
      _id: `notification_${index}`,
      entityId: index < NOTIFICATION_CLEANUP_PAGE_SIZE * 2 ? "query_1" : "query_2",
      entityType: "query",
    }));
    const deleted: string[] = [];
    const takeCalls: number[] = [];
    const ctx = {
      db: {
        delete: async (id: string) => {
          deleted.push(id);
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
          }
        },
        query: () => ({
          withIndex: (_name: string, callback: (builder: any) => any) => {
            const filters: Record<string, string> = {};
            const builder = {
              eq: (field: string, value: string) => {
                filters[field] = value;
                return builder;
              },
            };
            callback(builder);
            return {
              take: async (limit: number) => {
                takeCalls.push(limit);
                return rows
                  .filter(
                    (row) =>
                      row.entityType === filters.entityType && row.entityId === filters.entityId
                  )
                  .slice(0, limit);
              },
            };
          },
        }),
      },
    };

    const first = await deleteNotificationPage(ctx as any, "query", "query_1");
    expect(first).toEqual({ deleted: NOTIFICATION_CLEANUP_PAGE_SIZE, hasMore: true });
    expect(takeCalls).toEqual([NOTIFICATION_CLEANUP_PAGE_SIZE]);
    expect(rows.filter((row) => row.entityId === "query_2")).toHaveLength(5);

    const second = await deleteNotificationPage(ctx as any, "query", "query_1");
    expect(second.deleted).toBe(NOTIFICATION_CLEANUP_PAGE_SIZE);
    expect(deleted).toHaveLength(NOTIFICATION_CLEANUP_PAGE_SIZE * 2);
  });
});
