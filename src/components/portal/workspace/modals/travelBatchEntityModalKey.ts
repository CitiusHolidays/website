export function travelBatchEntityModalKey(
  modal: string | null,
  form: { entityId?: string; jobCardId?: string }
) {
  if (modal === "travelBatch") {
    return `travel-batch:${form?.entityId ?? form?.jobCardId ?? "new"}`;
  }
  return modal ?? "closed";
}
