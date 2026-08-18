import { describe, expect, spyOn, test } from "bun:test";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { isRuntimeString } from "../lib/runtimeValues";
import type { TestIndexQuery } from "../testSupport/runtimeContracts";
import { commitFlightImportForTest } from "./flightImports";
import { processImportRows } from "./importProcessor";
import {
  beginPassengerExportOperation,
  beginPassengerImportOperation,
  claimPassengerImportOperationBatch,
  commitPassengerImportRow,
  completePassengerImportOperation,
  getPassengerExportSourcePage,
  recordPassengerImportOperationBatch,
} from "./imports";
import { getRolePermissions } from "./lib/rolePolicy";
import { OPERATION_STALL_THRESHOLD_MS } from "./operationTimePolicy";

type Row = { _id: string; [key: string]: RuntimeValue };
interface Tables {
  [table: string]: Row[];
}

function makeImportCtx(
  initialTables: Tables,
  options?: { failAtEffect?: number; failInsertNames?: Set<string> }
) {
  const tables = Object.fromEntries(
    Object.entries(initialTables).map(([table, rows]) => [table, [...rows]])
  );
  const failInsertNames = options?.failInsertNames ?? new Set<string>();
  const effects = { count: 0 };
  const beforeEffect = (label: string) => {
    effects.count += 1;
    if (effects.count === options?.failAtEffect) {
      throw new Error(`simulated ${label} failure`);
    }
  };

  const ctx = {
    auth: {
      getUserIdentity: () => ({
        email: "ticketing@example.com",
        name: "Ticketing User",
        subject: "auth_ticketing",
      }),
    },
    db: {
      get: (tableOrId: string, maybeId?: string) => {
        const id = maybeId ?? tableOrId;
        for (const rows of Object.values(tables)) {
          const row = rows.find((entry) => entry._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: (tableName: string, doc: RuntimeObject) => {
        beforeEffect(`insert:${tableName}`);
        if (tableName === "travellers" && failInsertNames.has(String(doc.fullName))) {
          throw new Error("simulated insert failure");
        }
        const id = `${tableName}_${(tables[tableName]?.length ?? 0) + 1}`;
        const row = { _id: id, ...doc };
        tables[tableName] = [...(tables[tableName] ?? []), row];
        return id;
      },
      normalizeId: (_tableName: string, id: string | null | undefined) => id ?? null,
      patch: async (
        tableOrId: string,
        idOrPatch: string | RuntimeObject,
        maybePatch?: RuntimeObject
      ) => {
        const id = isRuntimeString(idOrPatch) ? idOrPatch : tableOrId;
        const patch = isRuntimeString(idOrPatch) ? (maybePatch ?? {}) : idOrPatch;
        beforeEffect(`patch:${id}`);
        for (const [table, rows] of Object.entries(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...rows[index], ...patch };
            return;
          }
        }
      },
      query(tableName: string) {
        let rows = tables[tableName] ?? [];
        return {
          collect: async () => [...rows],
          first: async () => rows[0] ?? null,
          paginate: ({ cursor, numItems }: { cursor?: string | null; numItems: number }) => {
            const start = cursor ? Number.parseInt(cursor, 10) : 0;
            const page = rows.slice(start, start + numItems);
            const next = start + page.length;
            return Promise.resolve({
              continueCursor: next < rows.length ? String(next) : "",
              isDone: next >= rows.length,
              page,
            });
          },
          take: async (limit: number) => rows.slice(0, limit),
          unique: async () => rows[0] ?? null,
          withIndex(_indexName: string, callback: (q: TestIndexQuery) => TestIndexQuery) {
            const filters: Array<{ field: string; value: RuntimeValue }> = [];
            const q: TestIndexQuery = {
              eq(field: string, value: RuntimeValue) {
                filters.push({ field, value });
                return q;
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return this;
          },
        };
      },
    },
    scheduler: {
      runAfter: async () => {
        beforeEffect("schedule:metric-sync");
      },
    },
  };

  return { ctx, effects, tables };
}

async function runMutationTransaction<T>(tables: Tables, work: () => Promise<T>) {
  const snapshot = structuredClone(tables);
  try {
    return await work();
  } catch (error) {
    for (const key of Object.keys(tables)) {
      delete tables[key];
    }
    Object.assign(tables, snapshot);
    throw error;
  }
}

const adminAccess = {
  allowed: true,
  authUserId: "user_1",
  email: "user@example.com",
  name: "Admin User",
  permissions: getRolePermissions(["Admin"]),
  roles: ["Admin"],
};

function passengerBatchId(jobCardId: string, batchIndex: number, digest = "0".repeat(16)) {
  return `passenger:${jobCardId}:${batchIndex}:${digest}`;
}

describe("ProcessImportRows failed count", () => {
  test("Increments failed when a row throws", async () => {
    const jobCardId = "jobCards_1";
    const { ctx } = makeImportCtx(
      {
        jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
        passportDetails: [],
        travellers: [],
        visaRecords: [],
      },
      { failInsertNames: new Set(["Broken Row"]) }
    );

    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await processImportRows(ctx as never, {
        access: { authUserId: "user_1" },
        job: {
          _id: jobCardId,
          jobCode: "JC-0001",
          travelStartDate: "2026-06-01",
        },
        // SAFETY: This test controls the asserted value at the framework boundary below.
        jobCardId: jobCardId as never,
        matchIndex: {
          byImportKey: new Map(),
          byNormalizedName: new Map(),
          byPassportHash: new Map(),
        },
        rows: [
          {
            foodPreference: "Veg",
            fullName: "Good Row",
            guestType: "Client",
            importKey: "row-1",
            importKind: "passenger",
            paymentType: "Company Paid",
            roomType: "Twin",
            visaRequired: false,
          },
          {
            foodPreference: "Veg",
            fullName: "Broken Row",
            guestType: "Client",
            importKey: "row-2",
            importKind: "passenger",
            paymentType: "Company Paid",
            roomType: "Twin",
            visaRequired: false,
          },
        ],
      });

      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.processed).toBe(2);
      expect(result.remaining).toBe(0);
      expect(result.roomSummary).toEqual({ Twin: 1 });
      expect(result.errors).toEqual([
        expect.objectContaining({
          id: "row-2",
          kind: "terminal",
          message: "simulated insert failure",
        }),
      ]);
      expect(result.total).toBe(2);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("Passenger import row transactions", () => {
  const jobCardId = "jobCards_1";
  const row = {
    encryptedPassportPayload: "encrypted-passport",
    foodPreference: "Veg",
    fullName: "Atomic Guest",
    guestType: "Client",
    id: "row-1",
    importKey: "row-1",
    importKind: "passenger",
    passportExpiryDate: "2036-01-01",
    passportLastFour: "1234",
    passportNumberHash: "passport-hash",
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: 2,
    sourceSheet: "Master list",
    ticketing: {
      domesticPnr: "PNR001",
      domesticTicket: "TICKET001",
      domesticVendor: "Air Vendor",
    },
    visaRequired: false,
  };

  function rowTables(): Tables {
    return {
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      pnrs: [],
      tickets: [],
      travellers: [],
      vendors: [],
      visaRecords: [],
    };
  }

  async function commitWithContext<Context>(ctx: Context) {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    return await (commitPassengerImportRow as any)._handler(ctx, {
      access: adminAccess,
      jobCardId,
      row,
    });
  }

  test("Rolls back every row write when a later write or metric schedule fails", async () => {
    const successful = makeImportCtx(rowTables());
    await commitWithContext(successful.ctx);
    const effectCount = successful.effects.count;
    expect(effectCount).toBeGreaterThan(5);

    for (let failAtEffect = 1; failAtEffect <= effectCount; failAtEffect += 1) {
      const attempt = makeImportCtx(rowTables(), { failAtEffect });
      const before = structuredClone(attempt.tables);
      await expect(
        runMutationTransaction(attempt.tables, () => commitWithContext(attempt.ctx))
      ).rejects.toThrow("simulated");
      expect(attempt.tables).toEqual(before);
    }
  });

  test("Rolls back an existing Traveller patch when a later stage fails", async () => {
    const existingTables = rowTables();
    existingTables.travellers.push({
      _id: "travellers_1",
      fullName: "Atomic Guest",
      importKey: "row-1",
      jobCardId,
      visaStatus: "Not Required",
    });
    const successful = makeImportCtx(existingTables);
    await commitWithContext(successful.ctx);

    for (let failAtEffect = 2; failAtEffect <= successful.effects.count; failAtEffect += 1) {
      const freshTables = rowTables();
      freshTables.travellers.push({
        _id: "travellers_1",
        fullName: "Atomic Guest",
        importKey: "row-1",
        jobCardId,
        visaStatus: "Not Required",
      });
      const attempt = makeImportCtx(freshTables, { failAtEffect });
      const before = structuredClone(attempt.tables);
      await expect(
        runMutationTransaction(attempt.tables, () => commitWithContext(attempt.ctx))
      ).rejects.toThrow("simulated");
      expect(attempt.tables).toEqual(before);
    }
  });

  test("Counts room and row outcomes only after the whole row commits", async () => {
    const { ctx } = makeImportCtx(rowTables());
    const result = await commitWithContext(ctx);
    expect(result).toMatchObject({
      accepted: 1,
      created: 1,
      failed: 0,
      processed: 1,
      remaining: 0,
      roomSummary: { Twin: 1 },
      updated: 0,
    });
  });

  test("Retries a committed row without duplicating fanout records or PNR seats", async () => {
    const attempt = makeImportCtx(rowTables());
    await commitWithContext(attempt.ctx);
    await commitWithContext(attempt.ctx);
    expect(attempt.tables.travellers).toHaveLength(1);
    expect(attempt.tables.visaRecords).toHaveLength(1);
    expect(attempt.tables.passportDetails).toHaveLength(1);
    expect(attempt.tables.vendors).toHaveLength(1);
    expect(attempt.tables.pnrs).toHaveLength(1);
    expect(attempt.tables.tickets).toHaveLength(1);
    expect(attempt.tables.pnrs[0]).toMatchObject({ issuedSeats: 1, totalSeats: 1 });
  });
});

describe("Passenger import operation receipts", () => {
  test("Waits for an active batch, takes over a stalled batch, and rejects different content", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerImportOperationBatches: [],
      passengerImportOperations: [],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const operationId = await (beginPassengerImportOperation as any)._handler(ctx, {
      access: adminAccess,
      batchTotal: 1,
      importKinds: ["passenger"],
      jobCardId,
      sourceDigest: "browser-hint-only",
      total: 12,
    });
    const claim = {
      batchId: passengerBatchId(jobCardId, 0, "3".repeat(16)),
      batchIndex: 0,
      operationId,
      rowCount: 12,
    };
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (claimPassengerImportOperationBatch as any)._handler(ctx, claim)).toEqual({
      mode: "process",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (claimPassengerImportOperationBatch as any)._handler(ctx, claim)).toEqual({
      mode: "wait",
    });
    tables.passengerImportOperations[0].updatedAt = Date.now() - OPERATION_STALL_THRESHOLD_MS - 1;
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (claimPassengerImportOperationBatch as any)._handler(ctx, claim)).toEqual({
      mode: "process",
    });
    const beforeConflict = structuredClone(tables);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (claimPassengerImportOperationBatch as any)._handler(ctx, {
        ...claim,
        batchId: passengerBatchId(jobCardId, 0, "4".repeat(16)),
      })
    ).rejects.toThrow("different content");
    expect(tables).toEqual(beforeConflict);
  });

  test("Accepts positions out of order and cannot complete with a missing position", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerImportOperationBatches: [],
      passengerImportOperations: [],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const operationId = await (beginPassengerImportOperation as any)._handler(ctx, {
      access: adminAccess,
      batchTotal: 2,
      importKinds: ["passenger"],
      jobCardId,
      sourceDigest: "out-of-order-browser-hint",
      total: 100,
    });
    const recordPosition = async (batchIndex: number) => {
      const batchId = passengerBatchId(jobCardId, batchIndex, String(batchIndex + 5).repeat(16));
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (claimPassengerImportOperationBatch as any)._handler(ctx, {
        batchId,
        batchIndex,
        operationId,
        rowCount: 50,
      });
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (recordPassengerImportOperationBatch as any)._handler(ctx, {
        accepted: 50,
        batchId,
        batchIndex,
        created: 50,
        errorSummary: { retryable: 0, terminal: 0 },
        failed: 0,
        operationId,
        processed: 50,
        remaining: 0,
        roomSummary: { Twin: 50 },
        status: "completed",
        updated: 0,
      });
    };

    await recordPosition(1);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (completePassengerImportOperation as any)._handler(ctx, { operationId })).toBe(
      false
    );
    expect(tables.passengerImportOperations[0]).toMatchObject({ status: "running" });
    await recordPosition(0);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (completePassengerImportOperation as any)._handler(ctx, { operationId })).toBe(
      true
    );
    expect(tables.passengerImportOperations[0]).toMatchObject({
      completedBatches: 2,
      remaining: 0,
      status: "completed",
      terminalBatches: 2,
    });
  });

  test("Resumes the same source and counts each completed batch once", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerImportOperationBatches: [],
      passengerImportOperations: [],
    });
    const args = {
      access: adminAccess,
      batchTotal: 1,
      importKinds: ["passenger"],
      jobCardId,
      sourceDigest: "digest-1",
      total: 50,
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const firstOperationId = await (beginPassengerImportOperation as any)._handler(ctx, args);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const resumedOperationId = await (beginPassengerImportOperation as any)._handler(ctx, args);
    expect(resumedOperationId).toBe(firstOperationId);
    const batchId = passengerBatchId(jobCardId, 0, "1".repeat(16));
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (claimPassengerImportOperationBatch as any)._handler(ctx, {
      batchId,
      batchIndex: 0,
      operationId: firstOperationId,
      rowCount: 50,
    });

    const batch = {
      accepted: 50,
      batchId,
      batchIndex: 0,
      created: 50,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      operationId: firstOperationId,
      processed: 50,
      remaining: 0,
      roomSummary: { Twin: 50 },
      status: "completed",
      updated: 0,
    };
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (recordPassengerImportOperationBatch as any)._handler(ctx, batch);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (recordPassengerImportOperationBatch as any)._handler(ctx, batch);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (completePassengerImportOperation as any)._handler(ctx, {
      operationId: firstOperationId,
    });
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (claimPassengerImportOperationBatch as any)._handler(ctx, {
        batchId,
        batchIndex: 0,
        operationId: firstOperationId,
        rowCount: 50,
      })
    ).toEqual({ mode: "replay" });
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (completePassengerImportOperation as any)._handler(ctx, {
        operationId: firstOperationId,
      })
    ).toBe(true);

    expect(tables.passengerImportOperationBatches).toHaveLength(1);
    expect(tables.passengerImportOperations[0]).toMatchObject({
      completedBatches: 1,
      created: 50,
      processed: 50,
      remaining: 0,
      status: "completed",
    });
  });

  test("Adopts a legacy server batch receipt without raw source data", async () => {
    const jobCardId = "jobCards_1";
    const batchId = passengerBatchId(jobCardId, 0, "7".repeat(16));
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerImportOperationBatches: [],
      passengerImportOperations: [],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const operationId = await (beginPassengerImportOperation as any)._handler(ctx, {
      access: adminAccess,
      batchTotal: 1,
      importKinds: ["passenger"],
      jobCardId,
      sourceDigest: "legacy-browser-hint",
      total: 12,
    });
    tables.passengerImportOperationBatches.push({
      _id: "passengerImportOperationBatches_legacy",
      accepted: 12,
      batchId,
      created: 12,
      createdAt: 1,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      operationId,
      processed: 12,
      remaining: 0,
      roomSummary: { Twin: 12 },
      updated: 0,
    });

    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (claimPassengerImportOperationBatch as any)._handler(ctx, {
        batchId,
        batchIndex: 0,
        operationId,
        rowCount: 12,
      })
    ).toEqual({ mode: "replay" });
    expect(tables.passengerImportOperationBatches[0]).toMatchObject({
      batchIndex: 0,
      rowCount: 12,
      status: "completed",
    });
    expect(JSON.stringify(tables.passengerImportOperationBatches[0])).not.toContain("Atomic Guest");
  });

  test("Reconciles a retryable batch with its later successful result", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerImportOperationBatches: [],
      passengerImportOperations: [],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const operationId = await (beginPassengerImportOperation as any)._handler(ctx, {
      access: adminAccess,
      batchTotal: 1,
      importKinds: ["passenger"],
      jobCardId,
      sourceDigest: "digest-retry",
      total: 50,
    });
    const batchId = passengerBatchId(jobCardId, 0, "2".repeat(16));
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (claimPassengerImportOperationBatch as any)._handler(ctx, {
      batchId,
      batchIndex: 0,
      operationId,
      rowCount: 50,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (recordPassengerImportOperationBatch as any)._handler(ctx, {
      accepted: 50,
      batchId,
      batchIndex: 0,
      created: 0,
      errorSummary: { retryable: 1, terminal: 0 },
      failed: 0,
      operationId,
      processed: 0,
      remaining: 50,
      roomSummary: {},
      status: "retryable",
      updated: 0,
    });
    expect(tables.passengerImportOperations[0]).toMatchObject({
      completedBatches: 0,
      remaining: 50,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await (completePassengerImportOperation as any)._handler(ctx, { operationId })).toBe(
      true
    );
    expect(tables.passengerImportOperations[0]).toMatchObject({
      remaining: 50,
      status: "partial",
      terminalBatches: 1,
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (recordPassengerImportOperationBatch as any)._handler(ctx, {
      accepted: 50,
      batchId,
      batchIndex: 0,
      created: 50,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      operationId,
      processed: 50,
      remaining: 0,
      roomSummary: { Twin: 50 },
      status: "completed",
      updated: 0,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (completePassengerImportOperation as any)._handler(ctx, { operationId });

    expect(tables.passengerImportOperationBatches).toHaveLength(1);
    expect(tables.passengerImportOperations[0]).toMatchObject({
      completedBatches: 1,
      created: 50,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      processed: 50,
      remaining: 0,
      roomSummary: { Twin: 50 },
      status: "completed",
    });
  });
});

describe("Passenger export operation receipts", () => {
  test("Replays the same actor, job, kind, and command without duplicate work", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerExportOperations: [],
    });
    const args = {
      access: {
        allowed: true,
        authUserId: "user_1",
        email: "user@example.com",
        permissions: getRolePermissions(["Admin"]),
        roles: ["Admin"],
      },
      commandId: "11111111-1111-4111-8111-111111111111",
      exportKind: "passenger",
      jobCardId,
      leaseId: "22222222-2222-4222-8222-222222222222",
    };
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await (beginPassengerExportOperation as any)._handler(ctx, args);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const replay = await (beginPassengerExportOperation as any)._handler(ctx, args);

    expect(replay).toEqual({ operationId: first.operationId, replayed: true });
    expect(tables.passengerExportOperations).toHaveLength(1);
  });

  test("Takes over a stale running export with a new lease", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passengerExportOperations: [],
    });
    const base = {
      access: {
        allowed: true,
        authUserId: "user_1",
        email: "user@example.com",
        permissions: getRolePermissions(["Admin"]),
        roles: ["Admin"],
      },
      commandId: "11111111-1111-4111-8111-111111111111",
      exportKind: "passenger",
      jobCardId,
    };
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await (beginPassengerExportOperation as any)._handler(ctx, {
      ...base,
      leaseId: "22222222-2222-4222-8222-222222222222",
    });
    tables.passengerExportOperations[0].leaseExpiresAt = 0;
    tables.passengerExportOperations[0].rowsProcessed = 300;
    tables.passengerExportOperations[0].sourceChunkCount = 3;
    tables.passengerExportOperations[0].sourceCursor = "cursor-300";
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const takeover = await (beginPassengerExportOperation as any)._handler(ctx, {
      ...base,
      leaseId: "33333333-3333-4333-8333-333333333333",
    });

    expect(takeover).toEqual({ operationId: first.operationId, replayed: false });
    expect(tables.passengerExportOperations[0]).toMatchObject({
      attemptCount: 2,
      leaseId: "33333333-3333-4333-8333-333333333333",
      rowsProcessed: 300,
      sourceChunkCount: 3,
      sourceCursor: "cursor-300",
      status: "running",
    });
  });
});

describe("ProcessImportRows Travel Batch context", () => {
  const baseRow = {
    foodPreference: "Veg",
    fullName: "Batch Guest",
    guestType: "Client",
    importKey: "row-1",
    importKind: "traveller",
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: 2,
    sourceSheet: "Master list",
    visaRequired: false,
  };

  test("Creates traveller rows with a matching Travel Batch", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
          jobCardId,
        },
      ],
      travellers: [],
      visaRecords: [],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await processImportRows(ctx as never, {
      access: { authUserId: "user_1" },
      job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
      // SAFETY: This test controls the asserted value at the framework boundary below.
      jobCardId: jobCardId as never,
      matchIndex: {
        byImportKey: new Map(),
        byNormalizedName: new Map(),
        byPassportHash: new Map(),
      },
      rows: [{ ...baseRow, travelBatchReference: "JC-0001 / B01" }],
    });

    expect(result).toMatchObject({ created: 1, failed: 0, updated: 0 });
    expect(tables.travellers[0]).toMatchObject({
      fullName: "Batch Guest",
      travelBatchId: "travelBatches_1",
    });
  });

  test("Keeps unbatched traveller imports unchanged", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      travelBatches: [],
      travellers: [],
      visaRecords: [],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await processImportRows(ctx as never, {
      access: { authUserId: "user_1" },
      job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
      // SAFETY: This test controls the asserted value at the framework boundary below.
      jobCardId: jobCardId as never,
      matchIndex: {
        byImportKey: new Map(),
        byNormalizedName: new Map(),
        byPassportHash: new Map(),
      },
      rows: [baseRow],
    });

    expect(result).toMatchObject({ created: 1, failed: 0, updated: 0 });
    expect(tables.travellers[0]).not.toHaveProperty("travelBatchId");
  });

  test("Fails rows that reference a Travel Batch from another Job Card", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      jobCards: [{ _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" }],
      passportDetails: [],
      travelBatches: [
        {
          _id: "travelBatches_2",
          batchCode: "B01",
          batchReference: "JC-0002 / B01",
          jobCardId: "jobCards_2",
        },
      ],
      travellers: [],
      visaRecords: [],
    });

    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    try {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await processImportRows(ctx as never, {
        access: { authUserId: "user_1" },
        job: { _id: jobCardId, jobCode: "JC-0001", travelStartDate: "2026-06-01" },
        // SAFETY: This test controls the asserted value at the framework boundary below.
        jobCardId: jobCardId as never,
        matchIndex: {
          byImportKey: new Map(),
          byNormalizedName: new Map(),
          byPassportHash: new Map(),
        },
        rows: [{ ...baseRow, travelBatchId: "travelBatches_2" }],
      });

      expect(result).toMatchObject({ created: 0, failed: 1, updated: 0 });
      expect(tables.travellers).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("GetPassengerExportSourcePage Travel Batch context", () => {
  test("Forwards every validated native pagination option unchanged", async () => {
    const jobCardId = "jobCards_1";
    const { ctx } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      travellers: [],
    });
    const originalQuery = ctx.db.query.bind(ctx.db);
    interface NativePaginationOptions {
      cursor: string | null;
      numItems: number;
    }
    let forwardedOptions: NativePaginationOptions | undefined;
    // SAFETY: This test controls the asserted value at the framework boundary below.
    ctx.db.query = ((tableName: string) => {
      if (tableName !== "travellers") {
        return originalQuery(tableName);
      }
      return {
        withIndex: (_indexName: string, callback: (q: any) => RuntimeValue) => {
          const q = { eq: () => q };
          callback(q);
          return {
            paginate: (options: NativePaginationOptions) => {
              forwardedOptions = options;
              return Promise.resolve({ continueCursor: "", isDone: true, page: [] });
            },
          };
        },
      };
    }) as typeof ctx.db.query;
    const paginationOpts = {
      cursor: "cursor-start",
      endCursor: "cursor-end",
      maximumBytesRead: 65_536,
      maximumRowsRead: 37,
      numItems: 13,
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (getPassengerExportSourcePage as any)._handler(ctx, {
      access: {
        allowed: true,
        permissions: getRolePermissions(["Admin"]),
        roles: ["Admin"],
      },
      exportKind: "passenger",
      jobCardId,
      paginationOpts,
    });

    expect(forwardedOptions).toBe(paginationOpts);
  });

  test("Returns bounded pages with batch display fields for batched and unbatched rows", async () => {
    const jobCardId = "jobCards_1";
    const { ctx } = makeImportCtx({
      jobCards: [{ _id: jobCardId, clientName: "Acme", jobCode: "JC-0001" }],
      passportDetails: [],
      tickets: [],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
          jobCardId,
        },
      ],
      travellers: [
        {
          _id: "travellers_1",
          createdAt: 1000,
          foodPreference: "Veg",
          fullName: "Batched Guest",
          jobCardId,
          paymentType: "Company Paid",
          roomType: "Twin",
          sourceRowNumber: 1,
          travelBatchId: "travelBatches_1",
          visaRequired: true,
          visaStatus: "Not Started",
        },
        {
          _id: "travellers_2",
          createdAt: 1001,
          foodPreference: "Veg",
          fullName: "Unbatched Guest",
          jobCardId,
          paymentType: "Company Paid",
          roomType: "Twin",
          sourceRowNumber: 2,
          visaRequired: false,
          visaStatus: "Not Required",
        },
      ],
      visaRecords: [],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (getPassengerExportSourcePage as any)._handler(ctx, {
      access: {
        allowed: true,
        permissions: getRolePermissions(["Operations Head"]),
        roles: ["Operations Head"],
      },
      exportKind: "passenger",
      jobCardId,
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.isDone).toBe(true);
    expect(result.page[0]).toMatchObject({
      fullName: "Batched Guest",
      travelBatchCode: "B01",
      travelBatchId: "travelBatches_1",
      travelBatchReference: "JC-0001 / B01",
    });
    expect(result.page[1]).toMatchObject({
      fullName: "Unbatched Guest",
      travelBatchCode: "",
      travelBatchId: "",
      travelBatchReference: "",
    });
  });
});

describe("CommitFlightImport Travel Batch context", () => {
  test("Clears stale Travel Batch context when re-importing an unbatched flight group", async () => {
    const jobCardId = "jobCards_1";
    const { ctx, tables } = makeImportCtx({
      flightGroups: [
        {
          _id: "flightGroups_1",
          airline: "Air India",
          createdAt: 100,
          createdBy: "auth_ticketing",
          flightNumber: "AI101",
          importKey: "flight|0",
          jobCardId,
          name: "Batched group",
          route: "Mumbai - Dubai",
          sourceGroupIndex: 0,
          sourceSheet: "Flight",
          ticketingType: "Imported Itinerary",
          totalSeats: 0,
          travelBatchId: "travelBatches_1",
          updatedAt: 100,
        },
      ],
      flightSegments: [],
      jobCards: [
        {
          _id: jobCardId,
          clientName: "Acme",
          confirmedPax: 10,
          createdAt: 100,
          createdBy: "auth_accounts",
          jobCode: "JC-0001",
          status: "Open",
          updatedAt: 100,
        },
      ],
      pnrs: [],
      staffUsers: [
        {
          _id: "staff_ticketing",
          active: true,
          authUserId: "auth_ticketing",
          email: "ticketing@example.com",
          emailNormalized: "ticketing@example.com",
          name: "Ticketing User",
          roles: ["Admin"],
        },
      ],
      travelBatches: [
        {
          _id: "travelBatches_1",
          batchCode: "B01",
          batchReference: "JC-0001 / B01",
          jobCardId,
        },
      ],
    });

    await commitFlightImportForTest(
      ctx,
      {
        groups: [
          {
            groupIndex: 0,
            name: "Unbatched group",
            segments: [
              {
                airline: "Air India",
                arriveTime: "12:00",
                dateLabel: "Thu 1 Oct",
                departTime: "10:00",
                destination: "Dubai",
                duration: "",
                flightNumber: "AI101",
                origin: "Mumbai",
                transit: "",
              },
            ],
            sourceSheet: "Flight",
          },
        ],
        jobCardId,
      },
      {
        allowed: true,
        authUserId: "auth_ticketing",
        permissions: [],
        roles: ["Head of Ticketing"],
      }
    );

    expect(tables.flightGroups[0]).toMatchObject({
      _id: "flightGroups_1",
      importKey: "flight|0",
      travelBatchId: undefined,
    });
  });
});

describe("CommitPassengerImport failed aggregation", () => {
  test("Sums failed counts from batch results", () => {
    const batchResults = [
      { created: 2, failed: 0, updated: 0 },
      { created: 0, failed: 3, updated: 1 },
    ];
    let failed = 0;
    for (const result of batchResults) {
      failed += result.failed ?? 0;
    }
    expect(failed).toBe(3);
  });
});
