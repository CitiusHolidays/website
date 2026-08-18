/** Captures one request-owned clock value before deterministic query projection. */
export function captureRequestReferenceNow() {
  return Date.now();
}
