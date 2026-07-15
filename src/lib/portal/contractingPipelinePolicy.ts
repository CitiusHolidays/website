export const CONTRACTING_PIPELINE_BOARD_STAGES = [
  "Query Received",
  "Proposal in progress",
  "Proposal sent",
] as const;

export type ContractingPipelineBoardStage = (typeof CONTRACTING_PIPELINE_BOARD_STAGES)[number];

interface PipelineQuery {
  contractingStatus?: string | null;
  salesStatus?: string | null;
}

export function isContractingPipelineBoardStage(
  stage: string
): stage is ContractingPipelineBoardStage {
  return (CONTRACTING_PIPELINE_BOARD_STAGES as readonly string[]).includes(stage);
}

export function isContractingPipelineBoardLocked(query: PipelineQuery) {
  return (
    [
      "Change in destination",
      "Date/Destination Change Required",
      "Order Confirmed",
      "Order Lost",
    ].includes(query.contractingStatus ?? "") ||
    ["Date/Destination Change Required", "Order Confirmed", "Order Lost"].includes(
      query.salesStatus ?? ""
    )
  );
}

export function getAllowedContractingPipelineBoardTargets(
  currentStage: string
): ContractingPipelineBoardStage[] {
  return currentStage === "Proposal in progress" ? ["Proposal sent"] : [];
}
