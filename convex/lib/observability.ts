export const CONVEX_ERROR_CATEGORIES = [
  "passenger_import_row_failure",
  "passport_storage_cleanup_failure",
] as const;

export type ConvexErrorCategory = (typeof CONVEX_ERROR_CATEGORIES)[number];

export function buildConvexApplicationErrorLog(
  category: ConvexErrorCategory,
  now: () => Date = () => new Date()
) {
  return {
    category,
    event: "convex.application.error",
    service: "citius-convex",
    timestamp: now().toISOString(),
  };
}

export function logConvexApplicationError(
  category: ConvexErrorCategory,
  logger: Pick<Console, "error"> = console,
  now?: () => Date
) {
  try {
    logger.error(JSON.stringify(buildConvexApplicationErrorLog(category, now)));
  } catch {
    // Observability must not replace the owning workflow's result.
  }
}
