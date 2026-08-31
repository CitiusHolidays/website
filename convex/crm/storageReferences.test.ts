import { describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import type { RuntimeValue } from "../lib/runtimeValues";
import { deleteIfUnreferenced, isStorageReferenced } from "./storageReferences";

interface Row {
  _id: string;
  claimedStorageId?: string;
  cleanupCompletedAt?: number;
  finalizedPdfStorageId?: string;
  status?: string;
  storageId?: string;
}

function makeContext(
  tables: Record<string, Row[]>,
  options: { rejectCollectFor?: Set<string> } = {}
) {
  return {
    db: {
      query(table: string) {
        let rows = tables[table] ?? [];
        return {
          collect: () => {
            if (options.rejectCollectFor?.has(table)) {
              throw new Error(`${table} must use a bounded existence read`);
            }
            return rows;
          },
          first: async () => rows[0] ?? null,
          take: async (limit: number) => rows.slice(0, limit),
          withIndex(
            _name: string,
            callback: (q: { eq: (field: string, value: RuntimeValue) => void }) => void
          ) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: RuntimeValue) {
                filters.push({ field, value });
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every(
                // SAFETY: This test controls the asserted value at the framework boundary below.
                (filter) =>
                  String(row[fromPartial<keyof Row>(filter.field)]) === String(filter.value)
              )
            );
            return this;
          },
        };
      },
    },
  };
}

describe("Storage reference guard", () => {
  test("Recognizes every supported attachment owner", async () => {
    const tables = [
      "commercialFiles",
      "commercialFileUploadSessions",
      "queryAttachments",
      "proposalAttachments",
      "passportDetails",
      "attachments",
      "proposals",
      "passengerExportOperations",
      "passengerExportSourceChunks",
      "documentPreviewOperations",
      "passportUploadTickets",
    ];
    await Promise.all(
      tables.map((table) => {
        let field = "storageId";
        if (table === "proposals") {
          field = "finalizedPdfStorageId";
        } else if (table === "documentPreviewOperations") {
          field = "artifactStorageId";
        } else if (table === "passportUploadTickets") {
          field = "claimedStorageId";
        }
        const ctx = makeContext({ [table]: [{ _id: `${table}_1`, [field]: "storage_1" }] });
        return expect(
          // SAFETY: This test controls the asserted value at the framework boundary below.
          fromAny<any, unknown>(isStorageReferenced)._handler(ctx, { storageId: "storage_1" })
        ).resolves.toBe(true);
      })
    );
  });

  test("Returns false for an unreferenced temporary blob", async () => {
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(isStorageReferenced)._handler(makeContext({}), {
        storageId: "storage_orphan",
      })
    ).resolves.toBe(false);
  });

  test("bounds passport existence checks while preserving active siblings and fail-closed overflow", async () => {
    const boundedOnly = new Set(["passportUploadCleanupRecords", "passportUploadTickets"]);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(isStorageReferenced)._handler(
        makeContext(
          {
            passportUploadCleanupRecords: [
              { _id: "cleanup_done", status: "completed", storageId: "storage_active" },
              { _id: "cleanup_active", status: "cleanup_failed", storageId: "storage_active" },
            ],
          },
          { rejectCollectFor: boundedOnly }
        ),
        { storageId: "storage_active" }
      )
    ).resolves.toBe(true);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(isStorageReferenced)._handler(
        makeContext(
          {
            passportUploadTickets: [
              {
                _id: "ignored_ticket",
                claimedStorageId: "storage_sibling",
                cleanupCompletedAt: 1,
              },
              { _id: "active_ticket", claimedStorageId: "storage_sibling" },
            ],
          },
          { rejectCollectFor: boundedOnly }
        ),
        { ignorePassportUploadTicketId: "ignored_ticket", storageId: "storage_sibling" }
      )
    ).resolves.toBe(true);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(isStorageReferenced)._handler(
        makeContext(
          {
            passportUploadCleanupRecords: [
              { _id: "cleanup_1", status: "completed", storageId: "storage_overflow" },
              { _id: "cleanup_2", status: "released", storageId: "storage_overflow" },
              { _id: "cleanup_3", status: "completed", storageId: "storage_overflow" },
            ],
          },
          { rejectCollectFor: boundedOnly }
        ),
        { storageId: "storage_overflow" }
      )
    ).resolves.toBe(true);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(isStorageReferenced)._handler(
        makeContext({}, { rejectCollectFor: boundedOnly }),
        { storageId: "storage_clear" }
      )
    ).resolves.toBe(false);
  });

  test("Deletes only an unreferenced blob inside the mutation boundary", async () => {
    const deleted: string[] = [];
    const orphanContext = {
      ...makeContext({}),
      storage: { delete: (storageId: string) => deleted.push(storageId) },
    };
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(orphanContext, {
        storageId: "storage_orphan",
      })
    ).resolves.toEqual({ deleted: true });
    expect(deleted).toEqual(["storage_orphan"]);

    const referencedContext = {
      ...makeContext({ commercialFiles: [{ _id: "file_1", storageId: "storage_used" }] }),
      storage: { delete: (storageId: string) => deleted.push(storageId) },
    };
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(referencedContext, {
        storageId: "storage_used",
      })
    ).resolves.toEqual({ deleted: false });
    expect(deleted).toEqual(["storage_orphan"]);
  });

  test("Keeps a reused blob until both expense and non-expense references are gone", async () => {
    const deleted: string[] = [];
    const tables = {
      attachments: [{ _id: "expense_proof", storageId: "storage_shared" }],
      queryAttachments: [{ _id: "query_file", storageId: "storage_shared" }],
    };
    const ctx = {
      ...makeContext(tables),
      storage: { delete: (storageId: string) => deleted.push(storageId) },
    };

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(ctx, { storageId: "storage_shared" })
    ).resolves.toEqual({ deleted: false });
    tables.attachments.splice(0);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(ctx, { storageId: "storage_shared" })
    ).resolves.toEqual({ deleted: false });
    tables.queryAttachments.splice(0);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(ctx, { storageId: "storage_shared" })
    ).resolves.toEqual({ deleted: true });
    expect(deleted).toEqual(["storage_shared"]);
  });

  test("Schedules a bounded retry when physical deletion fails after metadata removal", async () => {
    const scheduled: Array<{ args: { attempt?: number; storageId: string }; name: string }> = [];
    let deleteAttempt = 0;
    const ctx = {
      ...makeContext({}),
      scheduler: {
        runAfter: (
          _delay: number,
          reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
          args: { attempt?: number; storageId: string }
        ) => {
          scheduled.push({ args, name: getFunctionName(reference) });
        },
      },
      storage: {
        delete: () => {
          deleteAttempt += 1;
          if (deleteAttempt === 1) {
            throw new Error("temporary storage outage");
          }
        },
      },
    };

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(ctx, {
        attempt: 0,
        storageId: "storage_retry",
      })
    ).resolves.toEqual({ deleted: false });
    expect(scheduled).toEqual([
      {
        args: { attempt: 1, storageId: "storage_retry" },
        name: "crm/storageReferences:deleteIfUnreferenced",
      },
    ]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await expect(
      fromAny<any, unknown>(deleteIfUnreferenced)._handler(ctx, scheduled[0]?.args)
    ).resolves.toEqual({
      deleted: true,
    });
  });
});
