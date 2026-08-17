import { assertSafePdfStreams } from "./pdfPreviewSafety";

self.addEventListener("message", (event: MessageEvent<ArrayBuffer>) => {
  assertSafePdfStreams(event.data)
    .then(() => self.postMessage({ status: "ready" }))
    .catch(() => self.postMessage({ status: "unavailable" }));
});
