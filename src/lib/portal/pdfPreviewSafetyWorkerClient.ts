const MAX_PDF_INPUT_BYTES = 15 * 1024 * 1024;
const PDF_SAFETY_TIMEOUT_MS = 10_000;

export async function assertSafePdfPreviewInWorker(input: ArrayBuffer) {
  if (input.byteLength < 1 || input.byteLength > MAX_PDF_INPUT_BYTES) {
    throw new Error("PDF exceeds safe preview input limits");
  }
  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL("./pdfPreviewSafety.worker.ts", import.meta.url), {
      name: "citius-pdf-preview-safety",
      type: "module",
    });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("PDF preview processing timeout"));
    }, PDF_SAFETY_TIMEOUT_MS);
    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };
    worker.addEventListener("error", () => {
      finish();
      reject(new Error("PDF preview safety worker unavailable"));
    });
    worker.addEventListener("message", (event: MessageEvent<{ status: string }>) => {
      finish();
      if (event.data.status !== "ready") {
        reject(new Error("PDF exceeds safe stream processing limits"));
        return;
      }
      resolve();
    });
    const transferable = input.slice(0);
    worker.postMessage(transferable, [transferable]);
  });
}
