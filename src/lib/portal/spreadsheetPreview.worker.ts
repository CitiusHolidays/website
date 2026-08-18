import { prepareSpreadsheetPreview } from "./spreadsheetPreview";

type SpreadsheetWorkerMessage =
  | {
      status: "ready";
      bytes: ArrayBuffer;
      formulaStatuses: Array<{
        cell: string;
        sheetName: string;
        status: "recalculated" | "unsupported";
      }>;
      recalculatedFormulaCount: number;
      unsupportedFormulaCount: number;
    }
  | { status: "unavailable" };

interface SpreadsheetWorkerScope {
  addEventListener: (type: "message", listener: (event: MessageEvent<ArrayBuffer>) => void) => void;
  postMessage: (message: SpreadsheetWorkerMessage, transfer?: Transferable[]) => void;
}

// SAFETY: this module is instantiated only as a dedicated Worker by spreadsheetPreviewWorkerClient.
const workerScope = self as SpreadsheetWorkerScope;

workerScope.addEventListener("message", (event: MessageEvent<ArrayBuffer>) => {
  prepareSpreadsheetPreview(event.data)
    .then((result) => {
      workerScope.postMessage({ status: "ready", ...result }, [result.bytes]);
    })
    .catch(() => {
      workerScope.postMessage({ status: "unavailable" });
    });
});
