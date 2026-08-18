import { describe, expect, test } from "bun:test";
import {
  chunkPassengerImportRows,
  combinePassengerImportBatchResults,
  digestPassengerImportSource,
  runPassengerImportBatchSequence,
} from "./passengerImportClient";

describe("Passenger import client batching", () => {
  test("Keeps every row while bounding each request", () => {
    const rows = Array.from({ length: 123 }, (_, index) => ({ id: `row-${index}` }));
    const batches = chunkPassengerImportRows(rows);
    expect(batches.map((batch) => batch.length)).toEqual([50, 50, 23]);
    expect(batches.flat()).toEqual(rows);
  });

  test("Creates a stable source digest independent of object key order", async () => {
    const left = await digestPassengerImportSource("job-1", [{ a: 1, b: 2 }]);
    const reversedKeys = Object.fromEntries([
      ["b", 2],
      ["a", 1],
    ]);
    const right = await digestPassengerImportSource("job-1", [reversedKeys]);
    expect(right).toBe(left);
  });

  test("Reports each committed batch before starting the next one", async () => {
    const events: string[] = [];
    const results = await runPassengerImportBatchSequence(
      [["a"], ["b"], ["c"]],
      (rows, batchIndex) => {
        events.push(`commit:${batchIndex}:${rows[0]}`);
        return Promise.resolve(rows[0]);
      },
      ({ batchTotal, completedBatches }) => {
        events.push(`progress:${completedBatches}/${batchTotal}`);
      }
    );
    expect(results).toEqual(["a", "b", "c"]);
    expect(events).toEqual([
      "commit:0:a",
      "progress:1/3",
      "commit:1:b",
      "progress:2/3",
      "commit:2:c",
      "progress:3/3",
    ]);
  });

  test("Combines bounded batch results into the existing modal contract", () => {
    const result = combinePassengerImportBatchResults(
      [
        {
          accepted: 50,
          batches: [{ batchId: "batch-1", errors: [], status: "completed" }],
          completed: true,
          created: 40,
          failed: 0,
          operationId: "operation-1",
          processed: 50,
          remaining: 0,
          roomSummary: { Twin: 40 },
          rowResults: [],
          total: 50,
          updated: 10,
        },
        {
          accepted: 23,
          batches: [{ batchId: "batch-2", errors: [], status: "completed" }],
          completed: true,
          created: 20,
          failed: 0,
          operationId: "operation-1",
          processed: 23,
          remaining: 0,
          roomSummary: { Single: 3, Twin: 20 },
          rowResults: [],
          total: 23,
          updated: 3,
        },
      ],
      73
    );
    expect(result).toMatchObject({
      accepted: 73,
      created: 60,
      operationId: "operation-1",
      processed: 73,
      roomSummary: { Single: 3, Twin: 60 },
      total: 73,
      updated: 13,
    });
  });
});
