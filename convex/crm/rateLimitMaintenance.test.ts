import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { cleanupExpired, consumePortalFileDownload } from "./rateLimitMaintenance";

interface Row {
  _id: string;
  [key: string]: unknown;
}

function makeContext(initialTables: Record<string, Row[]>) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  ) as Record<string, Row[]>;
  const scheduled: Array<{ args: Record<string, never>; name: string }> = [];

  const ctx = {
    db: {
      delete: (id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      insert: (table: string, value: Record<string, unknown>) => {
        const rows = tables[table] ?? [];
        tables[table] = rows;
        const id = `${table}_${rows.length + 1}`;
        rows.push({ _id: id, ...value });
        return Promise.resolve(id);
      },
      patch: (id: string, value: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...value };
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query(table: string) {
        let rows = tables[table] ?? [];
        const builder = {
          take: (limit: number) => Promise.resolve(rows.slice(0, limit)),
          unique: () => Promise.resolve(rows[0] ?? null),
          withIndex(
            _indexName: string,
            callback: (query: {
              eq: (field: string, value: unknown) => unknown;
              lt: (field: string, value: number) => unknown;
            }) => unknown
          ) {
            const filters: Array<(row: Row) => boolean> = [];
            const query = {
              eq(field: string, value: unknown) {
                filters.push((row) => row[field] === value);
                return query;
              },
              lt(field: string, value: number) {
                filters.push((row) => Number(row[field]) < value);
                return query;
              },
            };
            callback(query);
            rows = rows.filter((row) => filters.every((filter) => filter(row)));
            return builder;
          },
        };
        return builder;
      },
    },
    scheduler: {
      runAfter: (_delay: number, reference: unknown, args: Record<string, never>) => {
        scheduled.push({ args, name: getFunctionName(reference as never) });
        return Promise.resolve();
      },
    },
  };

  return { ctx, scheduled, tables };
}

describe("portal rate-limit maintenance", () => {
  test("enforces the shared per-identity download window", async () => {
    const { ctx, tables } = makeContext({ portalFileDownloadRateLimits: [] });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: each mutation must observe the prior count.
      await expect(
        (consumePortalFileDownload as any)._handler(ctx, { authUserId: "auth_staff" })
      ).resolves.toMatchObject({ allowed: true, remaining: 29 - attempt });
    }
    await expect(
      (consumePortalFileDownload as any)._handler(ctx, { authUserId: "auth_staff" })
    ).resolves.toMatchObject({ allowed: false, remaining: 0 });
    expect(tables.portalFileDownloadRateLimits).toHaveLength(1);
  });

  test("deletes expired inbound and download windows in bounded continuations", async () => {
    const expiredInbound = Array.from({ length: 101 }, (_, index) => ({
      _id: `inbound_${index}`,
      expiresAt: 1,
    }));
    const { ctx, scheduled, tables } = makeContext({
      inboundIntentRateLimits: [
        ...expiredInbound,
        { _id: "inbound_live", expiresAt: Date.now() + 60_000 },
      ],
      portalFileDownloadRateLimits: [{ _id: "download_expired", expiresAt: 1 }],
    });

    await expect((cleanupExpired as any)._handler(ctx, {})).resolves.toEqual({
      deleted: 101,
      scheduled: true,
    });
    expect(tables.inboundIntentRateLimits).toHaveLength(2);
    expect(tables.portalFileDownloadRateLimits).toHaveLength(0);
    expect(scheduled).toEqual([{ args: {}, name: "crm/rateLimitMaintenance:cleanupExpired" }]);
  });
});
