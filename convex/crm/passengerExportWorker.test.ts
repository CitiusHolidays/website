import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import type { PassengerExportRow } from "../../src/lib/portal/passengerExportContract";
import {
  PASSENGER_EXPORT_MAX_ROW_BYTES,
  PASSENGER_EXPORT_MERGE_FAN_IN,
  PASSENGER_EXPORT_WORKER_MEMORY_BUDGET_BYTES,
} from "./passengerExportPolicy";
import type { PassengerExportSortableRow } from "./passengerExportSourceContract";
import { writePassengerExportFile } from "./passengerExportWorkbook";
import {
  mergePassengerExportChunkFiles,
  passengerExportSourceOrder,
  serializePassengerExportChunk,
} from "./passengerExportWorker";

const directories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "passenger-export-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

function sortableRow(createdAt: number): PassengerExportSortableRow {
  return { createdAt, fullName: `Traveller ${String(createdAt).padStart(6, "0")}` };
}

describe("bounded passenger export worker", () => {
  test("externally merges more than one fan-in of sorted chunks without gaps or duplicates", async () => {
    const directory = await temporaryDirectory();
    const chunkCount = PASSENGER_EXPORT_MERGE_FAN_IN + 4;
    const paths: string[] = [];
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const rows = Array.from({ length: 10 }, (_, offset) =>
        sortableRow(offset * chunkCount + chunkIndex)
      ).sort(passengerExportSourceOrder);
      const path = join(directory, `chunk-${chunkIndex}.jsonl`);
      // biome-ignore lint/performance/noAwaitInLoops: fixtures are written in deterministic page order.
      await writeFile(path, serializePassengerExportChunk(rows));
      paths.push(path);
    }

    const mergedPath = await mergePassengerExportChunkFiles(paths, directory);
    const merged = (await readFile(mergedPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as PassengerExportSortableRow);

    expect(merged).toHaveLength(chunkCount * 10);
    expect(merged.map((row) => row.createdAt)).toEqual(
      Array.from({ length: chunkCount * 10 }, (_, index) => index)
    );
  });

  test("rejects a source row above the explicit per-row byte budget", () => {
    expect(() =>
      serializePassengerExportChunk([
        {
          createdAt: 1,
          fullName: "x".repeat(PASSENGER_EXPORT_MAX_ROW_BYTES + 1),
        },
      ])
    ).toThrow("row above the safe worker byte budget");
  });

  test("streams a representative 20,000-row workbook within the worker memory budget", async () => {
    const directory = await temporaryDirectory();
    const outputPath = join(directory, "large-passenger-export.xlsx");
    const baselineRss = process.memoryUsage().rss;
    let peakRss = baselineRss;
    async function* rows(): AsyncGenerator<PassengerExportRow> {
      for (let index = 0; index < 20_000; index += 1) {
        peakRss = Math.max(peakRss, process.memoryUsage().rss);
        yield sortableRow(index);
        if (index % 250 === 0) {
          // biome-ignore lint/performance/noAwaitInLoops: emulate cooperative worker yielding.
          await Promise.resolve();
        }
      }
    }

    const result = await writePassengerExportFile("passenger", "JC-0042-NS", rows(), outputPath);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);

    expect(result).toEqual({
      fileName: "JC-0042-NS-ticketing-passengers.xlsx",
      rowCount: 20_000,
    });
    expect(peakRss - baselineRss).toBeLessThan(PASSENGER_EXPORT_WORKER_MEMORY_BUDGET_BYTES);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputPath);
    expect(workbook.worksheets[0]?.rowCount).toBe(20_001);
    expect(workbook.worksheets[0]?.getRow(20_001).getCell(3).value).toBe("019999");
  }, 30_000);
});
