import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { attachProof, removeProof } from "./expenseAttachmentActions";
import { PERMISSIONS } from "./lib";

function uploadContext(blob: Blob) {
  const guardedStorageIds: string[] = [];
  const directStorageDeletes: string[] = [];
  let queryCalls = 0;
  return {
    ctx: {
      runMutation: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
        args?: { storageId?: string }
      ) => {
        const name = getFunctionName(reference);
        if (name === "crm/expenseAttachments:saveExpenseProof") {
          return { previousStorageId: null };
        }
        if (name === "crm/storageReferences:deleteIfUnreferenced") {
          guardedStorageIds.push(args?.storageId ?? "");
          return { deleted: true };
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
      runQuery: () => {
        queryCalls += 1;
        return queryCalls === 1
          ? {
              allowed: true,
              authUserId: "auth_expense",
              permissions: [PERMISSIONS.CREATE_EXPENSES],
            }
          : { id: "expense_1" };
      },
      storage: {
        delete: (storageId: string) => {
          directStorageDeletes.push(storageId);
        },
        get: async () => blob,
      },
    },
    directStorageDeletes,
    guardedStorageIds,
  };
}

describe("expense attachment upload validation", () => {
  test("rejects storage MIME metadata that differs from the declared type and cleans it up", async () => {
    const { ctx, directStorageDeletes, guardedStorageIds } = uploadContext(
      new Blob(["proof"], { type: "image/png" })
    );

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (attachProof as any)._handler(ctx, {
        expenseId: "expense_1",
        fileName: "receipt.png",
        fileSize: 5,
        mimeType: "image/jpeg",
        storageId: "storage_1",
      })
    ).rejects.toThrow("does not match its declared MIME type");
    expect(guardedStorageIds).toEqual(["storage_1"]);
    expect(directStorageDeletes).toEqual([]);
  });

  test("rejects a claimed byte count that differs from storage and cleans it up", async () => {
    const { ctx, directStorageDeletes, guardedStorageIds } = uploadContext(
      new Blob(["proof"], { type: "application/pdf" })
    );

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (attachProof as any)._handler(ctx, {
        expenseId: "expense_1",
        fileName: "receipt.pdf",
        fileSize: 4,
        mimeType: "application/pdf",
        storageId: "storage_2",
      })
    ).rejects.toThrow("between 1 byte and 15 MB");
    expect(guardedStorageIds).toEqual(["storage_2"]);
    expect(directStorageDeletes).toEqual([]);
  });

  test("replacement delegates previous-blob cleanup to the metadata mutation", async () => {
    const directStorageDeletes: string[] = [];
    let queryCalls = 0;
    const ctx = {
      runMutation: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">
      ) => {
        const name = getFunctionName(reference);
        if (name === "crm/expenseAttachments:saveExpenseProof") {
          return { previousStorageId: "storage_shared" };
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
      runQuery: () => {
        queryCalls += 1;
        return queryCalls === 1
          ? {
              allowed: true,
              authUserId: "auth_expense",
              permissions: [PERMISSIONS.CREATE_EXPENSES],
            }
          : { id: "expense_1" };
      },
      storage: {
        delete: (storageId: string) => directStorageDeletes.push(storageId),
        get: () => new Blob(["replacement"], { type: "application/pdf" }),
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (attachProof as any)._handler(ctx, {
      expenseId: "expense_1",
      fileName: "replacement.pdf",
      fileSize: 11,
      mimeType: "application/pdf",
      storageId: "storage_new",
    });

    expect(directStorageDeletes).toEqual([]);
  });

  test("proof removal delegates physical cleanup to the metadata mutation", async () => {
    const directStorageDeletes: string[] = [];
    let queryCalls = 0;
    const ctx = {
      runMutation: (
        reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">
      ) => {
        const name = getFunctionName(reference);
        if (name === "crm/expenseAttachments:deleteExpenseProof") {
          return { storageId: "storage_shared" };
        }
        throw new Error(`Unexpected mutation: ${name}`);
      },
      runQuery: () => {
        queryCalls += 1;
        return queryCalls === 1
          ? {
              expenseId: "expense_1",
              fileName: "receipt.pdf",
              id: "attachment_1",
              mimeType: "application/pdf",
              storageId: "storage_shared",
            }
          : { id: "expense_1" };
      },
      storage: {
        delete: (storageId: string) => directStorageDeletes.push(storageId),
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (removeProof as any)._handler(ctx, { attachmentId: "attachment_1" });

    expect(directStorageDeletes).toEqual([]);
  });
});
