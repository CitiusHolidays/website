import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import {
  continueEntityCleanup,
  continueEntityGroupCleanup,
  deleteNotificationPage,
  groupNotificationIdentities,
  NOTIFICATION_CLEANUP_MAX_IDENTITIES_PER_REQUEST,
  NOTIFICATION_CLEANUP_PAGE_SIZE,
  NOTIFICATION_ENTITY_GROUP_SIZE,
  queueEntityNotificationCleanup,
} from "./notificationCleanup";

function makeWorkerContext(
  notifications: Array<{ _id: string; entityId: string; entityType: string }>
) {
  const rows = notifications.map((row) => ({ ...row }));
  const scheduled: Array<{ identities?: Array<{ entityId: string; entityType: string }> }> = [];
  const ctx = {
    db: {
      delete: (_table: string, id: string) => {
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) {
          rows.splice(index, 1);
        }
        return Promise.resolve();
      },
      query: (table: string) => ({
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
            collect: async () => [],
            take: (limit: number) =>
              Promise.resolve(
                table === "notifications"
                  ? rows
                      .filter(
                        (row) =>
                          row.entityType === filters.entityType && row.entityId === filters.entityId
                      )
                      .slice(0, limit)
                  : []
              ),
          };
        },
      }),
    },
    scheduler: {
      runAfter: (
        _delay: number,
        _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
        args: any
      ) => {
        scheduled.push(args);
        return Promise.resolve();
      },
    },
  };
  return { ctx, rows, scheduled };
}

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
      // SAFETY: This test controls the asserted value at the framework boundary below.
      {
        scheduler: {
          runAfter: (
            _delay: number,
            _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
            args: any
          ) => {
            scheduled.push(args);
            return Promise.resolve();
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
      queueEntityNotificationCleanup(
        // SAFETY: This test controls the asserted value at the framework boundary below.
        { scheduler: { runAfter: () => Promise.resolve() } } as any,
        identities
      )
    ).rejects.toThrow("must be split");
  });

  test("deletes only one bounded entity page per worker turn", async () => {
    const rows = Array.from({ length: NOTIFICATION_CLEANUP_PAGE_SIZE * 2 + 5 }, (_, index) => ({
      _id: `notification_${index}`,
      entityId: index < NOTIFICATION_CLEANUP_PAGE_SIZE * 2 ? "query_1" : "query_2",
      entityType: "query",
    }));
    const deleted: string[] = [];
    const readRows = [
      { _id: "read_1", notificationId: "notification_0" },
      { _id: "read_2", notificationId: "notification_64" },
    ];
    const takeCalls: number[] = [];
    const ctx = {
      db: {
        delete: (_table: string, ...args: string[]) => {
          // SAFETY: This test controls the asserted value at the framework boundary below.
          const id = args.at(-1) as string;
          deleted.push(id);
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
          }
          const readIndex = readRows.findIndex((row) => row._id === id);
          if (readIndex >= 0) {
            readRows.splice(readIndex, 1);
          }
          return Promise.resolve();
        },
        query: (table: string) => ({
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
              collect: () =>
                table === "notificationReads"
                  ? readRows.filter((row) => row.notificationId === filters.notificationId)
                  : [],
              take: (limit: number) => {
                takeCalls.push(limit);
                return Promise.resolve(
                  rows
                    .filter(
                      (row) =>
                        row.entityType === filters.entityType && row.entityId === filters.entityId
                    )
                    .slice(0, limit)
                );
              },
            };
          },
        }),
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await deleteNotificationPage(ctx as any, "query", "query_1");
    expect(first).toEqual({ deleted: NOTIFICATION_CLEANUP_PAGE_SIZE, hasMore: true });
    expect(takeCalls).toEqual([NOTIFICATION_CLEANUP_PAGE_SIZE]);
    expect(readRows.map((row) => row._id)).toEqual(["read_2"]);
    expect(rows.filter((row) => row.entityId === "query_2")).toHaveLength(5);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const second = await deleteNotificationPage(ctx as any, "query", "query_1");
    expect(second.deleted).toBe(NOTIFICATION_CLEANUP_PAGE_SIZE);
    expect(deleted).toHaveLength(NOTIFICATION_CLEANUP_PAGE_SIZE * 2 + 2);
    expect(readRows).toEqual([]);
  });

  test("reschedules a single entity when another bounded page remains", async () => {
    const { ctx, rows, scheduled } = makeWorkerContext(
      Array.from({ length: NOTIFICATION_CLEANUP_PAGE_SIZE + 1 }, (_, index) => ({
        _id: `notification_${index}`,
        entityId: "query_1",
        entityType: "query",
      }))
    );

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (continueEntityCleanup as any)._handler(ctx, {
        entityId: "query_1",
        entityType: "query",
      })
    ).resolves.toEqual({ deleted: NOTIFICATION_CLEANUP_PAGE_SIZE, hasMore: true });
    expect(rows).toHaveLength(1);
    expect(scheduled).toEqual([{ entityId: "query_1", entityType: "query" }]);
  });

  test("bounds grouped workers and reschedules only unfinished identities", async () => {
    const { ctx, rows, scheduled } = makeWorkerContext([
      ...Array.from({ length: NOTIFICATION_CLEANUP_PAGE_SIZE + 1 }, (_, index) => ({
        _id: `query_notification_${index}`,
        entityId: "query_1",
        entityType: "query",
      })),
      { _id: "proposal_notification", entityId: "proposal_1", entityType: "proposal" },
    ]);
    const identities = [
      { entityId: "query_1", entityType: "query" },
      { entityId: "proposal_1", entityType: "proposal" },
    ];

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (continueEntityGroupCleanup as any)._handler(ctx, { identities })
    ).resolves.toEqual({ deleted: NOTIFICATION_CLEANUP_PAGE_SIZE + 1, remainingEntities: 1 });
    expect(rows).toHaveLength(1);
    expect(scheduled).toEqual([{ identities: [identities[0]] }]);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (continueEntityGroupCleanup as any)._handler(ctx, {
        identities: Array.from({ length: NOTIFICATION_ENTITY_GROUP_SIZE + 1 }, (_, index) => ({
          entityId: `query_${index}`,
          entityType: "query",
        })),
      })
    ).rejects.toThrow("bounded worker size");
  });
});
