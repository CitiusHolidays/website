import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import {
  purgePassengerExportSourceChunks,
  stagePassengerExportSourceChunk,
} from "./passengerExportOperations";

interface Row {
  _creationTime?: number;
  _id: string;
  [key: string]: unknown;
}

function makeContext(initial: Record<string, Row[]>) {
  const tables = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, structuredClone(rows)])
  ) as Record<string, Row[]>;
  const scheduled: Array<{ args: unknown; name: string }> = [];
  const deletedStorageIds: string[] = [];
  const ctx = {
    db: {
      delete: (id: string) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows.splice(index, 1);
            return;
          }
        }
      },
      get: async (id: string) =>
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null,
      insert: (table: string, value: Record<string, unknown>) => {
        const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
        tables[table] = [
          ...(tables[table] ?? []),
          { _creationTime: Date.now(), _id: id, ...value },
        ];
        return id;
      },
      patch: (id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query(table: string) {
        let rows = [...(tables[table] ?? [])];
        const query = {
          order(direction: "asc" | "desc") {
            rows.sort((left, right) =>
              direction === "asc"
                ? Number(left.pageIndex ?? 0) - Number(right.pageIndex ?? 0)
                : Number(right.pageIndex ?? 0) - Number(left.pageIndex ?? 0)
            );
            return query;
          },
          take: async (limit: number) => rows.slice(0, limit),
          unique: async () => rows[0] ?? null,
          withIndex(
            _name: string,
            callback: (q: {
              eq: (field: string, value: unknown) => unknown;
              gt: (field: string, value: unknown) => unknown;
            }) => unknown
          ) {
            const filters: Array<(row: Row) => boolean> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push((row) => row[field] === value);
                return q;
              },
              gt(field: string, value: unknown) {
                filters.push((row) => Number(row[field]) > Number(value));
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) => filters.every((filter) => filter(row)));
            return query;
          },
        };
        return query;
      },
    },
    scheduler: {
      runAfter: (_delay: number, reference: unknown, args: unknown) => {
        const name = getFunctionName(reference as never);
        scheduled.push({ args, name });
        if (name === "crm/storageReferences:deleteIfUnreferenced") {
          deletedStorageIds.push(String((args as { storageId: string }).storageId));
        }
      },
    },
  };
  return { ctx, deletedStorageIds, scheduled, tables };
}

function runningOperation() {
  return {
    _id: "passengerExportOperations_1",
    attemptCount: 1,
    commandId: "11111111-1111-4111-8111-111111111111",
    exportKind: "passenger",
    initiatedBy: "auth_1",
    jobCardId: "jobCards_1",
    leaseId: "lease_1",
    rowsProcessed: 0,
    sourceChunkCount: 0,
    sourceCursor: "",
    sourceDone: false,
    startedAt: 1,
    status: "running",
    updatedAt: 1,
  };
}

describe("passenger export source chunk operations", () => {
  test("advances only the exact server-owned page and cursor position", async () => {
    const { ctx, tables } = makeContext({
      passengerExportOperations: [runningOperation()],
      passengerExportSourceChunks: [],
    });
    await (stagePassengerExportSourceChunk as any)._handler(ctx, {
      continueCursor: "cursor-100",
      cursorStart: "",
      isDone: false,
      jobCode: "JC-0001-NS",
      leaseId: "lease_1",
      operationId: "passengerExportOperations_1",
      pageIndex: 0,
      rowCount: 100,
      storageId: "storage_page_0",
    });

    expect(tables.passengerExportOperations[0]).toMatchObject({
      jobCode: "JC-0001-NS",
      rowsProcessed: 100,
      sourceChunkCount: 1,
      sourceCursor: "cursor-100",
      sourceDone: false,
    });
    expect(tables.passengerExportSourceChunks).toHaveLength(1);

    await expect(
      (stagePassengerExportSourceChunk as any)._handler(ctx, {
        continueCursor: "cursor-200",
        cursorStart: "",
        isDone: true,
        jobCode: "JC-0001-NS",
        leaseId: "lease_1",
        operationId: "passengerExportOperations_1",
        pageIndex: 1,
        rowCount: 100,
        storageId: "storage_wrong_position",
      })
    ).rejects.toThrow("position does not match server progress");
    expect(tables.passengerExportSourceChunks).toHaveLength(1);
  });

  test("purges every partial chunk in bounded pages before expiring the failed operation", async () => {
    const chunks = Array.from({ length: 51 }, (_, index) => ({
      _id: `passengerExportSourceChunks_${index}`,
      continueCursor: `cursor-${index + 1}`,
      createdAt: index,
      cursorStart: `cursor-${index}`,
      isDone: index === 50,
      operationId: "passengerExportOperations_1",
      pageIndex: index,
      rowCount: 100,
      storageId: `storage_${index}`,
    }));
    const operation = { ...runningOperation(), status: "failed" };
    const { ctx, deletedStorageIds, scheduled, tables } = makeContext({
      passengerExportOperations: [operation],
      passengerExportSourceChunks: chunks,
    });

    await expect(
      (purgePassengerExportSourceChunks as any)._handler(ctx, {
        expireOperation: true,
        operationId: operation._id,
      })
    ).resolves.toEqual({ deleted: 50, scheduled: true });
    expect(tables.passengerExportSourceChunks).toHaveLength(1);
    expect(deletedStorageIds).toHaveLength(50);
    expect(scheduled).toContainEqual({
      args: { expireOperation: true, operationId: operation._id },
      name: "crm/passengerExportOperations:purgePassengerExportSourceChunks",
    });

    await expect(
      (purgePassengerExportSourceChunks as any)._handler(ctx, {
        expireOperation: true,
        operationId: operation._id,
      })
    ).resolves.toEqual({ deleted: 1, scheduled: false });
    expect(tables.passengerExportSourceChunks).toHaveLength(0);
    expect(deletedStorageIds).toHaveLength(51);
    expect(tables.passengerExportOperations[0]).toMatchObject({
      sourceChunkCount: 0,
      status: "expired",
    });
  });
});
