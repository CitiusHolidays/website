import { ConvexError } from "convex/values";

export const CONTRACTING_PIPELINE_BOARD_STAGES = [
  "Query Received",
  "Proposal in progress",
  "Proposal sent",
] as const;

export type ContractingPipelineBoardStage = (typeof CONTRACTING_PIPELINE_BOARD_STAGES)[number];

const LOCKED_CONTRACTING_STATUSES = new Set([
  "Change in destination",
  "Date/Destination Change Required",
  "Order Confirmed",
  "Order Lost",
]);

interface ContractingPipelineQueryRecord {
  contractingStatus?: string | null;
  salesStatus?: string | null;
}

export function resolveContractingPipelineStage(query: ContractingPipelineQueryRecord): string {
  return query.contractingStatus || "Query Received";
}

export function isContractingPipelineBoardStage(
  stage: string
): stage is ContractingPipelineBoardStage {
  return (CONTRACTING_PIPELINE_BOARD_STAGES as readonly string[]).includes(stage);
}

export function isContractingPipelineBoardLocked(query: ContractingPipelineQueryRecord) {
  const stage = resolveContractingPipelineStage(query);
  return (
    LOCKED_CONTRACTING_STATUSES.has(stage) ||
    query.salesStatus === "Order Confirmed" ||
    query.salesStatus === "Order Lost" ||
    query.salesStatus === "Date/Destination Change Required"
  );
}

export function getAllowedContractingPipelineBoardTargets(
  currentStage: string
): ContractingPipelineBoardStage[] {
  return currentStage === "Proposal in progress" ? ["Proposal sent"] : [];
}

export function assertContractingPipelineBoardMove({
  currentStage,
  query,
  targetStage,
}: {
  currentStage: string;
  query: ContractingPipelineQueryRecord;
  targetStage: string;
}) {
  if (isContractingPipelineBoardLocked(query)) {
    throw new ConvexError("Use Sales Decision for revision, confirmed, or lost outcomes.");
  }
  if (!isContractingPipelineBoardStage(targetStage)) {
    throw new ConvexError("That Contracting stage is not available from the pipeline board.");
  }
  if (currentStage === targetStage) {
    throw new ConvexError("Query is already in that pipeline stage.");
  }
  if (!getAllowedContractingPipelineBoardTargets(currentStage).includes(targetStage)) {
    throw new ConvexError(
      currentStage === "Query Received"
        ? "Create the proposal before moving this query."
        : "That Contracting pipeline move is not allowed."
    );
  }
}
