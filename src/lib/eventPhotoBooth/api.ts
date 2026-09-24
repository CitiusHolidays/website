import { makeFunctionReference } from "convex/server";
import type {
  BoothAccess,
  BoothArtwork,
  BoothAvailability,
  BoothManagementState,
  BoothMetricEntry,
  BoothParticipantState,
  BoothSceneDraft,
  BoothStaffOption,
} from "./contracts";

export const boothApi = {
  getManagementState: makeFunctionReference<"query", Record<string, never>, BoothManagementState>(
    "eventPhotoBooth:getManagementState"
  ),
  getMyAccess: makeFunctionReference<"query", Record<string, never>, BoothAccess>(
    "eventPhotoBooth:getMyAccess"
  ),
  getParticipantState: makeFunctionReference<"query", Record<string, never>, BoothParticipantState>(
    "eventPhotoBooth:getParticipantState"
  ),
  listAssignableStaff: makeFunctionReference<
    "query",
    { paginationOpts: { numItems: number; cursor: string | null } },
    { page: BoothStaffOption[]; isDone: boolean; continueCursor: string }
  >("eventPhotoBooth:listAssignableStaff"),
  publishScenes: makeFunctionReference<"mutation", { expectedRevision: number }, number>(
    "eventPhotoBooth:publishScenes"
  ),
  recordMetricGateway: makeFunctionReference<
    "mutation",
    { events: BoothMetricEntry[]; gatewaySecret: string; rateLimitKeyHash: string },
    null
  >("eventPhotoBooth:recordMetricGateway"),
  saveDraftScenes: makeFunctionReference<
    "mutation",
    { expectedRevision: number; scenes: BoothSceneDraft[] },
    number
  >("eventPhotoBooth:saveDraftScenes"),
  setAvailability: makeFunctionReference<"mutation", { availability: BoothAvailability }, null>(
    "eventPhotoBooth:setAvailability"
  ),
  setStaffAssignment: makeFunctionReference<
    "mutation",
    { staffId: string; assigned: boolean },
    null
  >("eventPhotoBooth:setStaffAssignment"),
  uploadArtwork: makeFunctionReference<
    "action",
    { bytes: ArrayBuffer },
    { artwork: BoothArtwork; artworkUrl: string }
  >("eventPhotoBoothArtwork:uploadArtwork"),
};
