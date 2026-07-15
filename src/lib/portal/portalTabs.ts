export type PortalTabKey = "ArrowLeft" | "ArrowRight" | "End" | "Home";

export function resolveTabId(
  ids: readonly string[],
  requestedId: string | null | undefined,
  fallbackId: string
): string {
  if (requestedId && ids.includes(requestedId)) {
    return requestedId;
  }
  if (ids.includes(fallbackId)) {
    return fallbackId;
  }
  return ids[0] ?? "";
}

export function nextTabId(ids: readonly string[], currentId: string, key: PortalTabKey): string {
  if (ids.length === 0) {
    return "";
  }
  if (key === "Home") {
    return ids[0] ?? "";
  }
  if (key === "End") {
    return ids.at(-1) ?? "";
  }
  const currentIndex = Math.max(0, ids.indexOf(currentId));
  const delta = key === "ArrowRight" ? 1 : -1;
  return ids[(currentIndex + delta + ids.length) % ids.length] ?? "";
}
