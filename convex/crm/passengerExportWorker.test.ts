import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import ExcelJS from "exceljs";
import {
  PASSENGER_EXPORT_MAX_ROW_BYTES,
  PASSENGER_EXPORT_MERGE_FAN_IN,
  PASSENGER_EXPORT_WORKER_MEMORY_BUDGET_BYTES,
} from "./passengerExportPolicy";
import type { PassengerExportSortableRow } from "./passengerExportSourceContract";
import {
  mergePassengerExportChunkFiles,
  passengerExportSourceOrder,
  serializePassengerExportChunk,
} from "./passengerExportWorker";

const directories: string[] = [];
const execFileAsync = promisify(execFile);

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

const PASSENGER_EXPORT_MEMORY_PROBE = `
  import { writePassengerExportFile } from "./passengerExportWorkbook.ts";

  const outputPath = process.env.PASSENGER_EXPORT_TEST_OUTPUT;
  if (!outputPath) throw new Error("PASSENGER_EXPORT_TEST_OUTPUT is required");
  const baselineRss = process.memoryUsage().rss;
  let peakRss = baselineRss;
  async function* rows() {
    for (let index = 0; index < 20_000; index += 1) {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
      yield { createdAt: index, fullName: "Traveller " + String(index).padStart(6, "0") };
      if (index % 250 === 0) await Promise.resolve();
    }
  }
  const result = await writePassengerExportFile("passenger", "JC-0042-NS", rows(), outputPath);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  process.stdout.write(JSON.stringify({ memoryDelta: peakRss - baselineRss, result }));
`;

async function runPassengerExportMemoryProbe(outputPath: string) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--eval", PASSENGER_EXPORT_MEMORY_PROBE],
    {
      cwd: import.meta.dir,
      env: { ...process.env, PASSENGER_EXPORT_TEST_OUTPUT: outputPath },
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
    }
  );
  return JSON.parse(stdout) as {
    memoryDelta: number;
    result: { fileName: string; rowCount: number };
  };
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
    // RSS is process-wide. Run the measurement in an isolated process so other
    // concurrently loaded test files cannot inflate the worker's memory delta.
    const { memoryDelta, result } = await runPassengerExportMemoryProbe(outputPath);

    expect(result).toEqual({
      fileName: "JC-0042-NS-ticketing-passengers.xlsx",
      rowCount: 20_000,
    });
    expect(memoryDelta).toBeLessThan(PASSENGER_EXPORT_WORKER_MEMORY_BUDGET_BYTES);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(outputPath);
    expect(workbook.worksheets[0]?.rowCount).toBe(20_001);
    expect(workbook.worksheets[0]?.getRow(20_001).getCell(3).value).toBe("019999");
  }, 30_000);
});
