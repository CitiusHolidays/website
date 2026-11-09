import { ConvexError } from "convex/values";
import { literalUnion } from "../lib/literalValidators";
import type { LeadStage } from "./queryValidators";

export const SALES_PIPELINE_BOARD_STAGES = ["Inquiry", "Proposal", "Negotiation"] as const;

export type SalesPipelineBoardStage = (typeof SALES_PIPELINE_BOARD_STAGES)[number];

export const salesPipelineBoardStageValidator = literalUnion(SALES_PIPELINE_BOARD_STAGES);

const TERMINAL_PIPELINE_STAGES = new Set<string>(["Confirmation", "Lost", "Closed"]);

const SALES_PIPELINE_BOARD_LOCKED_STATUSES = new Set([
  "Order Confirmed",
  "Order Lost",
  "Date/Destination Change Required",
]);

export const SALES_PIPELINE_BOARD_TRANSITIONS = {
  Inquiry: ["Proposal"],
  Negotiation: ["Proposal"],
  Proposal: ["Inquiry", "Negotiation"],
} satisfies Record<SalesPipelineBoardStage, readonly SalesPipelineBoardStage[]>;

interface PipelineQueryRecord {
  contractingStatus?: string | null;
  leadStage?: string | null;
  salesStatus?: string | null;
}

export function normalizeSalesPipelineLeadStage(leadStage?: string | null): LeadStage | null {
  if (!leadStage) {
    return null;
  }
  if (leadStage === "Closed") {
    return "Lost";
  }
  if (
    leadStage === "Inquiry" ||
    leadStage === "Proposal" ||
    leadStage === "Negotiation" ||
    leadStage === "Confirmation" ||
    leadStage === "Lost"
  ) {
    return leadStage;
  }
  return null;
}

export function resolveSalesPipelineStage(query: PipelineQueryRecord): LeadStage {
  const normalizedLeadStage = normalizeSalesPipelineLeadStage(query.leadStage);
  if (normalizedLeadStage) {
    return normalizedLeadStage;
  }
  if (query.salesStatus === "Order Lost" || query.contractingStatus === "Order Lost") {
    return "Lost";
  }
  if (query.salesStatus === "Order Confirmed" || query.contractingStatus === "Order Confirmed") {
    return "Confirmation";
  }
  if (query.contractingStatus === "Proposal sent") {
    return "Proposal";
  }
  if (
    query.contractingStatus === "Proposal in progress" ||
    query.contractingStatus === "Change in destination" ||
    query.contractingStatus === "Date/Destination Change Required"
  ) {
    return "Negotiation";
  }
  return "Inquiry";
}

/**
 * `stage` defaults to the server's resolved stage; the Staff Workspace board
 * passes the stage it displays so its affordances match what it shows.
 */
export function isSalesPipelineBoardLocked(
  query: PipelineQueryRecord,
  stage: string = resolveSalesPipelineStage(query)
) {
  if (query.salesStatus && SALES_PIPELINE_BOARD_LOCKED_STATUSES.has(query.salesStatus)) {
    return true;
  }
  return TERMINAL_PIPELINE_STAGES.has(stage);
}

export function isSalesPipelineBoardStage(stage: string): stage is SalesPipelineBoardStage {
  return SALES_PIPELINE_BOARD_STAGES.some((candidate) => candidate === stage);
}

export function getAllowedSalesPipelineBoardTargets(
  currentStage: string
): SalesPipelineBoardStage[] {
  if (!isSalesPipelineBoardStage(currentStage)) {
    return [];
  }
  return [...SALES_PIPELINE_BOARD_TRANSITIONS[currentStage]];
}

export function assertSalesPipelineBoardMove({
  currentStage,
  query,
  targetStage,
}: {
  currentStage: LeadStage;
  query: PipelineQueryRecord;
  targetStage: string;
}) {
  if (isSalesPipelineBoardLocked(query)) {
    throw new ConvexError("Use Sales Decision for confirmed, lost, or revision outcomes.");
  }
  if (!isSalesPipelineBoardStage(targetStage)) {
    throw new ConvexError("That pipeline stage must be set through Sales Decision.");
  }
  if (targetStage === currentStage) {
    throw new ConvexError("Query is already in that pipeline stage.");
  }
  const allowedTargets = getAllowedSalesPipelineBoardTargets(currentStage);
  if (!allowedTargets.includes(targetStage)) {
    throw new ConvexError("That pipeline move is not allowed.");
  }
}
