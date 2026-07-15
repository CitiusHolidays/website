import { describe, expect, test } from "bun:test";
import { preparePassengerRows } from "./importRows";
import {
  classifyImportError,
  IMPORT_WORKER_CONCURRENCY,
  mapWithConcurrency,
  stableImportBatchId,
  summarizeImportBatchResults,
} from "./importWorkerPolicy";

describe("bounded import worker policy", () => {
  test("never exceeds the worker ceiling and preserves batch order at workbook scale", async () => {
    const batches = Array.from({ length: 41 }, (_, index) => index);
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency(batches, IMPORT_WORKER_CONCURRENCY, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
      return item * 2;
    });

    expect(peak).toBe(IMPORT_WORKER_CONCURRENCY);
    expect(results).toEqual(batches.map((item) => item * 2));
  });

  test("uses stable content identities while excluding randomized encrypted payloads", () => {
    const first = stableImportBatchId("jobCards_1", 0, [
      { encryptedPassportPayload: "cipher-one", fullName: "A", importKey: "row-1" },
    ]);
    const retry = stableImportBatchId("jobCards_1", 0, [
      { encryptedPassportPayload: "cipher-two", fullName: "A", importKey: "row-1" },
    ]);
    const corrected = stableImportBatchId("jobCards_1", 0, [
      { encryptedPassportPayload: "cipher-three", fullName: "A corrected", importKey: "row-1" },
    ]);

    expect(retry).toBe(first);
    expect(corrected).not.toBe(first);
  });

  test("changes batch identity when only protected passport content is corrected", () => {
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
    try {
      const baseRow = {
        fullName: "Anshika Agarwal",
        id: "Sheet1:2",
        importKey: "row-1",
        sourceRowNumber: 2,
        sourceSheet: "Sheet1",
      };
      const [first] = preparePassengerRows([
        {
          ...baseRow,
          passport: {
            dateOfBirth: "1987-07-26",
            expiryDate: "2036-02-11",
            issueDate: "2026-02-12",
            nationality: "INDIAN",
            number: "AK429734",
          },
        },
      ]);
      const [retry] = preparePassengerRows([
        {
          ...baseRow,
          passport: {
            dateOfBirth: "1987-07-26",
            expiryDate: "2036-02-11",
            issueDate: "2026-02-12",
            nationality: "INDIAN",
            number: "AK429734",
          },
        },
      ]);
      const [corrected] = preparePassengerRows([
        {
          ...baseRow,
          passport: {
            dateOfBirth: "1987-07-27",
            expiryDate: "2036-02-11",
            issueDate: "2026-02-12",
            nationality: "INDIAN",
            number: "AK429734",
          },
        },
      ]);

      const firstId = stableImportBatchId("jobCards_1", 0, [first]);
      expect(stableImportBatchId("jobCards_1", 0, [retry])).toBe(firstId);
      expect(stableImportBatchId("jobCards_1", 0, [corrected])).not.toBe(firstId);
      expect(retry.encryptedPassportPayload).not.toBe(first.encryptedPassportPayload);
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }
  });

  test("keeps partial retry work visible instead of marking the batch set complete", () => {
    const summary = summarizeImportBatchResults([
      {
        accepted: 50,
        batchId: "batch-1",
        created: 50,
        errors: [],
        failed: 0,
        processed: 50,
        remaining: 0,
        roomSummary: { Twin: 50 },
        status: "completed",
        updated: 0,
      },
      {
        accepted: 50,
        batchId: "batch-2",
        created: 20,
        errors: [{ id: "row-80", kind: "retryable", message: "temporarily unavailable" }],
        failed: 30,
        processed: 20,
        remaining: 30,
        roomSummary: { Single: 50 },
        status: "retryable",
        updated: 0,
      },
    ]);

    expect(summary).toMatchObject({
      accepted: 100,
      completed: false,
      failed: 30,
      processed: 70,
      remaining: 30,
    });
    expect(summary.roomSummary).toEqual({ Single: 50, Twin: 50 });
  });

  test("separates retryable infrastructure failures from terminal row failures", () => {
    expect(classifyImportError(new Error("network temporarily unavailable"))).toBe("retryable");
    expect(
      classifyImportError(new Error("Travel Batch must belong to the selected Job Card"))
    ).toBe("terminal");
  });
});
