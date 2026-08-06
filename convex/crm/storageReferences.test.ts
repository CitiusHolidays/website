import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { deleteIfUnreferenced, isStorageReferenced } from "./storageReferences";

interface Row {
  _id: string;
  finalizedPdfStorageId?: string;
  storageId?: string;
}

function makeContext(tables: Record<string, Row[]>) {
  return {
    db: {
      query(table: string) {
        let rows = tables[table] ?? [];
        return {
          first: async () => rows[0] ?? null,
          withIndex(
            _name: string,
            callback: (q: { eq: (field: string, value: unknown) => void }) => void
          ) {
            const filters: Array<{ field: string; value: unknown }> = [];
            const q = {
              eq(field: string, value: unknown) {
                filters.push({ field, value });
              },
            };
            callback(q);
            rows = rows.filter((row) =>
              filters.every(
                (filter) => String(row[filter.field as keyof Row]) === String(filter.value)
              )
            );
            return this;
          },
        };
      },
    },
  };
}

describe("storage reference guard", () => {
  test("recognizes every supported attachment owner", async () => {
    const tables = [
      "commercialFiles",
      "commercialFileUploadSessions",
      "queryAttachments",
      "proposalAttachments",
      "passportDetails",
      "attachments",
      "proposals",
    ];
    await Promise.all(
      tables.map((table) => {
        const field = table === "proposals" ? "finalizedPdfStorageId" : "storageId";
        const ctx = makeContext({ [table]: [{ _id: `${table}_1`, [field]: "storage_1" }] });
        return expect(
          (isStorageReferenced as any)._handler(ctx, { storageId: "storage_1" })
        ).resolves.toBe(true);
      })
    );
  });

  test("returns false for an unreferenced temporary blob", async () => {
    await expect(
      (isStorageReferenced as any)._handler(makeContext({}), { storageId: "storage_orphan" })
    ).resolves.toBe(false);
  });

  test("deletes only an unreferenced blob inside the mutation boundary", async () => {
    const deleted: string[] = [];
    const orphanContext = {
      ...makeContext({}),
      storage: { delete: (storageId: string) => deleted.push(storageId) },
    };
    await expect(
      (deleteIfUnreferenced as any)._handler(orphanContext, { storageId: "storage_orphan" })
    ).resolves.toEqual({ deleted: true });
    expect(deleted).toEqual(["storage_orphan"]);

    const referencedContext = {
      ...makeContext({ commercialFiles: [{ _id: "file_1", storageId: "storage_used" }] }),
      storage: { delete: (storageId: string) => deleted.push(storageId) },
    };
    await expect(
      (deleteIfUnreferenced as any)._handler(referencedContext, { storageId: "storage_used" })
    ).resolves.toEqual({ deleted: false });
    expect(deleted).toEqual(["storage_orphan"]);
  });

  test("keeps a reused blob until both expense and non-expense references are gone", async () => {
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
      (deleteIfUnreferenced as any)._handler(ctx, { storageId: "storage_shared" })
    ).resolves.toEqual({ deleted: false });
    tables.attachments.splice(0);
    await expect(
      (deleteIfUnreferenced as any)._handler(ctx, { storageId: "storage_shared" })
    ).resolves.toEqual({ deleted: false });
    tables.queryAttachments.splice(0);
    await expect(
      (deleteIfUnreferenced as any)._handler(ctx, { storageId: "storage_shared" })
    ).resolves.toEqual({ deleted: true });
    expect(deleted).toEqual(["storage_shared"]);
  });

  test("schedules a bounded retry when physical deletion fails after metadata removal", async () => {
    const scheduled: Array<{ args: { attempt?: number; storageId: string }; name: string }> = [];
    let shouldFail = true;
    const ctx = {
      ...makeContext({}),
      scheduler: {
        runAfter: (
          _delay: number,
          reference: unknown,
          args: { attempt?: number; storageId: string }
        ) => {
          scheduled.push({ args, name: getFunctionName(reference as never) });
        },
      },
      storage: {
        delete: () => {
          if (shouldFail) {
            throw new Error("temporary storage outage");
          }
        },
      },
    };

    await expect(
      (deleteIfUnreferenced as any)._handler(ctx, {
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

    shouldFail = false;
    await expect((deleteIfUnreferenced as any)._handler(ctx, scheduled[0]?.args)).resolves.toEqual({
      deleted: true,
    });
  });
});
