import { describe, expect, test } from "bun:test";
import { attachProof } from "./expenseAttachmentActions";
import { PERMISSIONS } from "./lib";

function uploadContext(blob: Blob) {
  const deletedStorageIds: string[] = [];
  let queryCalls = 0;
  return {
    ctx: {
      runMutation: async () => ({ previousStorageId: null }),
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
          deletedStorageIds.push(storageId);
        },
        get: async () => blob,
      },
    },
    deletedStorageIds,
  };
}

describe("expense attachment upload validation", () => {
  test("rejects storage MIME metadata that differs from the declared type and cleans it up", async () => {
    const { ctx, deletedStorageIds } = uploadContext(new Blob(["proof"], { type: "image/png" }));

    await expect(
      (attachProof as any)._handler(ctx, {
        expenseId: "expense_1",
        fileName: "receipt.png",
        fileSize: 5,
        mimeType: "image/jpeg",
        storageId: "storage_1",
      })
    ).rejects.toThrow("does not match its declared MIME type");
    expect(deletedStorageIds).toEqual(["storage_1"]);
  });

  test("rejects a claimed byte count that differs from storage and cleans it up", async () => {
    const { ctx, deletedStorageIds } = uploadContext(
      new Blob(["proof"], { type: "application/pdf" })
    );

    await expect(
      (attachProof as any)._handler(ctx, {
        expenseId: "expense_1",
        fileName: "receipt.pdf",
        fileSize: 4,
        mimeType: "application/pdf",
        storageId: "storage_2",
      })
    ).rejects.toThrow("between 1 byte and 15 MB");
    expect(deletedStorageIds).toEqual(["storage_2"]);
  });
});
