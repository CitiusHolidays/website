import { getSalesPipelineStage } from "./workflow";

export const SALES_PIPELINE_BOARD_STAGES = ["Inquiry", "Proposal", "Negotiation"] as const;

export type SalesPipelineBoardStage = (typeof SALES_PIPELINE_BOARD_STAGES)[number];

const TERMINAL_PIPELINE_STAGES = new Set(["Confirmation", "Lost", "Closed"]);

const SALES_PIPELINE_BOARD_LOCKED_STATUSES = new Set([
  "Order Confirmed",
  "Order Lost",
  "Date/Destination Change Required",
]);

export const SALES_PIPELINE_BOARD_TRANSITIONS: Record<
  SalesPipelineBoardStage,
  readonly SalesPipelineBoardStage[]
> = {
  Inquiry: ["Proposal"],
  Negotiation: ["Proposal"],
  Proposal: ["Inquiry", "Negotiation"],
};

interface PipelineQueryRecord {
  contractingStatus?: string;
  leadStage?: string;
  salesStatus?: string;
}

export function getPipelineCardStage(query: PipelineQueryRecord) {
  return getSalesPipelineStage(query);
}

export function isSalesPipelineBoardLocked(query: PipelineQueryRecord) {
  if (query.salesStatus && SALES_PIPELINE_BOARD_LOCKED_STATUSES.has(query.salesStatus)) {
    return true;
  }
  const stage = getPipelineCardStage(query);
  return TERMINAL_PIPELINE_STAGES.has(stage);
}

export function isSalesPipelineBoardStage(stage: string): stage is SalesPipelineBoardStage {
  return (SALES_PIPELINE_BOARD_STAGES as readonly string[]).includes(stage);
}

export function getAllowedSalesPipelineBoardTargets(
  currentStage: string
): SalesPipelineBoardStage[] {
  if (!isSalesPipelineBoardStage(currentStage)) {
    return [];
  }
  return [...SALES_PIPELINE_BOARD_TRANSITIONS[currentStage]];
}

export function canMovePipelineCard(query: PipelineQueryRecord, targetStage: string) {
  if (isSalesPipelineBoardLocked(query)) {
    return false;
  }
  if (!isSalesPipelineBoardStage(targetStage)) {
    return false;
  }
  const currentStage = getPipelineCardStage(query);
  if (currentStage === targetStage) {
    return false;
  }
  return getAllowedSalesPipelineBoardTargets(currentStage).includes(targetStage);
}
