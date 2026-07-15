import { ConvexError } from "convex/values";
import type { LeadStage } from "./queryValidators";

export const SALES_PIPELINE_BOARD_STAGES = ["Inquiry", "Proposal", "Negotiation"] as const;

export type SalesPipelineBoardStage = (typeof SALES_PIPELINE_BOARD_STAGES)[number];

const TERMINAL_PIPELINE_STAGES = new Set<LeadStage>(["Confirmation", "Lost", "Closed"]);

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

export function isSalesPipelineBoardLocked(query: PipelineQueryRecord) {
  if (query.salesStatus && SALES_PIPELINE_BOARD_LOCKED_STATUSES.has(query.salesStatus)) {
    return true;
  }
  const stage = resolveSalesPipelineStage(query);
  return TERMINAL_PIPELINE_STAGES.has(stage);
}

export function isSalesPipelineBoardStage(stage: string): stage is SalesPipelineBoardStage {
  return (SALES_PIPELINE_BOARD_STAGES as readonly string[]).includes(stage);
}

export function getAllowedSalesPipelineBoardTargets(
  currentStage: LeadStage
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
