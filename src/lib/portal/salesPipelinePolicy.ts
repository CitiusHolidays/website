import {
  getAllowedSalesPipelineBoardTargets,
  isSalesPipelineBoardLocked as isSalesPipelineBoardLockedAtStage,
  isSalesPipelineBoardStage,
} from "@convex/crm/salesPipelinePolicy";
import { getSalesPipelineStage } from "./workflow";

interface PipelineQueryRecord {
  contractingStatus?: string;
  leadStage?: string;
  salesStatus?: string;
}

export function getPipelineCardStage(query: PipelineQueryRecord) {
  return getSalesPipelineStage(query);
}

export function isSalesPipelineBoardLocked(query: PipelineQueryRecord) {
  return isSalesPipelineBoardLockedAtStage(query, getPipelineCardStage(query));
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
