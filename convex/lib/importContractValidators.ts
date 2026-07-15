import { v } from "convex/values";

export const portalAccessArgumentValidator = v.object({
  allowed: v.boolean(),
  authUserId: v.optional(v.string()),
  bootstrap: v.optional(v.boolean()),
  email: v.string(),
  name: v.string(),
  permissions: v.array(v.string()),
  reason: v.optional(v.union(v.literal("UNAUTHENTICATED"), v.literal("NOT_STAFF"))),
  roles: v.array(v.string()),
  staffId: v.optional(v.id("staffUsers")),
});

export const importFailureValidator = v.object({
  id: v.string(),
  // Optional only for ledgers written before retryable/terminal classification was introduced.
  kind: v.optional(v.union(v.literal("retryable"), v.literal("terminal"))),
  message: v.string(),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

export const importRoomSummaryValidator = v.record(v.string(), v.number());

const jobCardStatusValidator = v.union(
  v.literal("Open"),
  v.literal("In Operations"),
  v.literal("Ready for Departure"),
  v.literal("On Tour"),
  v.literal("Closed")
);

const canonicalTravelBatchSummaryValidator = v.object({
  _creationTime: v.optional(v.number()),
  _id: v.optional(v.id("travelBatches")),
  batchCode: v.string(),
  batchReference: v.optional(v.string()),
  confirmedPax: v.optional(v.number()),
  contractingOwnerId: v.optional(v.string()),
  contractingOwnerName: v.optional(v.string()),
  createdAt: v.optional(v.number()),
  createdBy: v.optional(v.string()),
  destination: v.optional(v.string()),
  jobCardId: v.optional(v.id("jobCards")),
  lastEditedAt: v.optional(v.number()),
  lastEditedBy: v.optional(v.string()),
  lastEditedByName: v.optional(v.string()),
  operationsOwnerId: v.optional(v.string()),
  operationsOwnerName: v.optional(v.string()),
  roomCount: v.optional(v.number()),
  status: v.optional(jobCardStatusValidator),
  ticketingOwnerId: v.optional(v.string()),
  ticketingOwnerName: v.optional(v.string()),
  tourManagerName: v.optional(v.string()),
  travelEndDate: v.optional(v.string()),
  travelStartDate: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
});

const legacyTravelBatchSummaryValidator = v.object({
  code: v.string(),
  pax: v.optional(v.number()),
  reference: v.optional(v.string()),
});

/** Transitional validator: canonical summary plus the inventoried code/reference/pax aliases. */
export const travelBatchSummaryTransitionValidator = v.union(
  canonicalTravelBatchSummaryValidator,
  legacyTravelBatchSummaryValidator
);
