import type { PreparedSpreadsheetPreview } from "./spreadsheetPreview";

const MAX_SPREADSHEET_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_SPREADSHEET_OUTPUT_BYTES = 30 * 1024 * 1024;
const SPREADSHEET_PREPARATION_TIMEOUT_MS = 15_000;

interface WorkerReadyResult extends PreparedSpreadsheetPreview {
  status: "ready";
}

type WorkerResult = WorkerReadyResult | { status: "unavailable" };

export async function prepareSpreadsheetPreviewInWorker(
  input: ArrayBuffer
): Promise<PreparedSpreadsheetPreview> {
  if (input.byteLength < 1 || input.byteLength > MAX_SPREADSHEET_INPUT_BYTES) {
    throw new Error("Spreadsheet exceeds safe preview input limits");
  }
  return await new Promise<PreparedSpreadsheetPreview>((resolve, reject) => {
    const worker = new Worker(new URL("./spreadsheetPreview.worker.ts", import.meta.url), {
      name: "citius-spreadsheet-preview",
      type: "module",
    });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("Spreadsheet preview processing timeout"));
    }, SPREADSHEET_PREPARATION_TIMEOUT_MS);
    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    worker.addEventListener("error", () => {
      finish();
      reject(new Error("Spreadsheet preview worker unavailable"));
    });
    worker.addEventListener("message", (event: MessageEvent<WorkerResult>) => {
      const result = event.data;
      finish();
      if (result.status !== "ready") {
        reject(new Error("Spreadsheet preview could not be prepared"));
        return;
      }
      if (result.bytes.byteLength < 1 || result.bytes.byteLength > MAX_SPREADSHEET_OUTPUT_BYTES) {
        reject(new Error("Spreadsheet exceeds safe preview output limits"));
        return;
      }
      resolve({
        bytes: result.bytes,
        formulaStatuses: result.formulaStatuses,
        recalculatedFormulaCount: result.recalculatedFormulaCount,
        unsupportedFormulaCount: result.unsupportedFormulaCount,
      });
    });
    const transferable = input.slice(0);
    worker.postMessage(transferable, [transferable]);
  });
}
