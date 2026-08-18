import { describe, expect, test } from "bun:test";
import { COMMERCIAL_FILE_PURGE_PAGE_SIZE, purgeStorageRecord } from "./commercialFilePurge";

describe("Commercial File purge record semantics", () => {
  test("Keeps the metadata retryable when storage deletion fails", async () => {
    let metadataDeletes = 0;
    const result = await purgeStorageRecord({
      deleteMetadata: () => {
        metadataDeletes += 1;
        return Promise.resolve();
      },
      deleteStorage: () => Promise.reject(new Error("injected storage failure")),
      hasStorage: true,
      isReferenced: () => Promise.resolve(false),
    });

    expect(result).toEqual({
      failureCode: "storage_delete_failed",
      purged: false,
      storageDeleted: false,
    });
    expect(metadataDeletes).toBe(0);
  });

  test("Deletes metadata but preserves a referenced blob", async () => {
    let metadataDeletes = 0;
    let storageDeletes = 0;
    const result = await purgeStorageRecord({
      deleteMetadata: () => {
        metadataDeletes += 1;
        return Promise.resolve();
      },
      deleteStorage: () => {
        storageDeletes += 1;
        return Promise.resolve();
      },
      hasStorage: true,
      isReferenced: () => Promise.resolve(true),
    });

    expect(result).toEqual({ failureCode: null, purged: true, storageDeleted: false });
    expect(metadataDeletes).toBe(1);
    expect(storageDeletes).toBe(0);
  });

  test("Does not swallow metadata failure after storage work", async () => {
    await expect(
      purgeStorageRecord({
        deleteMetadata: () => Promise.reject(new Error("injected metadata failure")),
        deleteStorage: () => Promise.resolve(),
        hasStorage: true,
        isReferenced: () => Promise.resolve(false),
      })
    ).rejects.toThrow("injected metadata failure");
  });

  test("Keeps every continuation page within the reviewed resource reserve", () => {
    expect(COMMERCIAL_FILE_PURGE_PAGE_SIZE).toBeGreaterThan(0);
    expect(COMMERCIAL_FILE_PURGE_PAGE_SIZE).toBeLessThanOrEqual(10);
  });
});
