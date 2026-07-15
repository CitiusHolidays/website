export type CursorPaginationStatus =
  | "CanLoadMore"
  | "Exhausted"
  | "LoadingFirstPage"
  | "LoadingMore";

export function shouldContinueCursorPage(input: {
  automaticLoads: number;
  loadedCount: number;
  maxAutomaticLoads: number;
  status: CursorPaginationStatus;
  targetCount: number;
}) {
  return (
    input.status === "CanLoadMore" &&
    input.loadedCount < input.targetCount &&
    input.automaticLoads < input.maxAutomaticLoads
  );
}
