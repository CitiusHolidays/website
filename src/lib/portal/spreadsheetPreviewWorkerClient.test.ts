import { describe, expect, test } from "bun:test";
import { prepareSpreadsheetPreviewInWorker } from "./spreadsheetPreviewWorkerClient";

describe("spreadsheet preview worker boundary", () => {
  test("rejects empty and oversized inputs before starting a worker", async () => {
    await expect(prepareSpreadsheetPreviewInWorker(new ArrayBuffer(0))).rejects.toThrow(
      "input limits"
    );
    await expect(
      prepareSpreadsheetPreviewInWorker(new ArrayBuffer(15 * 1024 * 1024 + 1))
    ).rejects.toThrow("input limits");
  });
});
