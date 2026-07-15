import { ConvexError } from "convex/values";

export function assertBulkDeleteLimit(count: number) {
  if (count === 0) {
    throw new ConvexError("No records selected");
  }
}

export const BULK_DELETE_MUTATION_BATCH_SIZE = 32;

export function assertBulkDeleteMutationBatch(count: number) {
  assertBulkDeleteLimit(count);
  if (count > BULK_DELETE_MUTATION_BATCH_SIZE) {
    throw new ConvexError(
      `Bulk delete requests must be split into batches of ${BULK_DELETE_MUTATION_BATCH_SIZE}`
    );
  }
}

export function requestedProposalQueryIds(args: { queryId?: string; queryIds?: string[] }) {
  if (args.queryIds !== undefined) {
    return args.queryIds;
  }
  if (args.queryId !== undefined) {
    return args.queryId ? [args.queryId] : [];
  }
  return null;
}
