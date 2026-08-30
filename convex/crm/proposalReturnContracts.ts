import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { proposalAttachmentOutputValidator } from "./fileReturnContracts";
import {
  contractingStatusValidator,
  querySourceValidator,
  queryTypeValidator,
  salesStatusValidator,
  ticketingScopeValidator,
  travelTypeValidator,
} from "./queryValidators";

const nullableString = v.union(v.null(), v.string());

export const proposalPairStateValidator = v.union(
  v.literal("Confirmed"),
  v.literal("Draft"),
  v.literal("Lost"),
  v.literal("Revision requested"),
  v.literal("Stale"),
  v.literal("Unknown"),
  v.literal("With Sales")
);

const proposalPairClockValidator = v.object({
  elapsedMs: v.union(v.null(), v.number()),
  endedAt: v.union(v.null(), v.number()),
  startedAt: v.union(v.null(), v.number()),
  status: v.union(v.literal("Complete"), v.literal("Running"), v.literal("Unknown")),
});

export const proposalPairTimelineResultValidator = v.object({
  clocks: v.object({
    confirmationToJobCard: proposalPairClockValidator,
    handoffToDecision: proposalPairClockValidator,
    revisionRequestToHandoff: proposalPairClockValidator,
  }),
  commercialPreflight: v.object({
    exactRevisionCurrent: v.boolean(),
    pricingComplete: v.boolean(),
    proposalDocument: v.string(),
  }),
  events: v.array(
    v.object({
      actorName: v.string(),
      at: v.number(),
      digest: nullableString,
      label: v.string(),
      revision: v.union(v.null(), v.number()),
      type: v.union(
        v.literal("Confirmed Offer"),
        v.literal("Handoff"),
        v.literal("Job Card opened"),
        v.literal("Proposal created"),
        v.literal("Revision requested"),
        v.literal("Revision resolved"),
        v.literal("Sales decision")
      ),
    })
  ),
  pairState: proposalPairStateValidator,
  proposalCode: v.string(),
  proposalId: v.id("proposals"),
  queryCode: v.string(),
  queryId: v.id("queries"),
  truncated: v.boolean(),
});

export const proposalQueryOutputValidator = v.object({
  approxMargin: v.union(v.null(), v.number()),
  batchingNotes: v.string(),
  budgetAmount: v.number(),
  clientName: v.string(),
  confirmedAt: nullableString,
  contactMobile: v.string(),
  contactPerson: v.string(),
  contractingAirlinesCost: v.number(),
  contractingLandCost: v.number(),
  contractingOwnerId: v.string(),
  contractingOwnerName: v.string(),
  contractingStatus: contractingStatusValidator,
  contractingVisaCost: v.number(),
  createdAt: v.string(),
  destination: v.string(),
  id: v.id("queries"),
  jobCardCreatorName: v.string(),
  jobCardCreatorStaffId: v.string(),
  leadStage: v.string(),
  lostReason: v.string(),
  notes: v.string(),
  paxCount: v.number(),
  queryCode: v.string(),
  queryType: queryTypeValidator,
  salesOwnerName: v.string(),
  salesStatus: salesStatusValidator,
  source: v.union(querySourceValidator, v.literal("")),
  submittedToContractingAt: nullableString,
  ticketingOwnerId: v.string(),
  ticketingOwnerName: v.string(),
  ticketingScope: v.union(ticketingScopeValidator, v.literal("")),
  travelEndDate: v.string(),
  travelInBatches: v.boolean(),
  travelStartDate: v.string(),
  travelType: travelTypeValidator,
  updatedAt: v.string(),
});

const finalizedPdfOutputValidator = v.union(
  v.null(),
  v.object({ fileName: v.string(), uploadedAt: nullableString, version: v.string() })
);

export const proposalDetailOutputValidator = v.object({
  airfarePerPax: v.number(),
  attachmentCount: v.number(),
  attachments: v.array(proposalAttachmentOutputValidator),
  clientName: v.string(),
  collaboratorStaffIds: v.array(v.id("staffUsers")),
  costPrice: v.number(),
  createdAt: v.string(),
  finalizedPdf: finalizedPdfOutputValidator,
  id: v.id("proposals"),
  itinerarySummary: v.string(),
  landCostPerPax: v.number(),
  lastEditedAt: nullableString,
  lastEditedByName: v.string(),
  preparedBy: v.string(),
  pricingEnteredAt: nullableString,
  proposalCode: v.string(),
  proposalRevision: v.number(),
  queries: v.array(proposalQueryOutputValidator),
  query: v.union(v.null(), proposalQueryOutputValidator),
  queryId: v.union(v.null(), v.id("queries")),
  queryIds: v.array(v.id("queries")),
  sellingPrice: v.number(),
  sentAt: nullableString,
  sentToClientAt: nullableString,
  sentToSalesAt: nullableString,
  status: v.union(
    v.literal("Draft"),
    v.literal("Sent"),
    v.literal("Accepted"),
    v.literal("Rejected")
  ),
  taxRate: v.union(v.null(), v.number()),
  updatedAt: v.string(),
  visaCostPerPax: v.number(),
});

const proposalListQueryValidator = v.object({
  clientName: v.string(),
  contractingOwnerId: v.string(),
  handedOffAt: nullableString,
  handedOffRevision: v.union(v.null(), v.number()),
  id: v.id("queries"),
  pairState: proposalPairStateValidator,
  paxCount: v.number(),
  queryCode: v.string(),
  queryType: queryTypeValidator,
  revisionRequestedAt: nullableString,
});

export const proposalListOutputValidator = v.object({
  airfarePerPax: v.number(),
  attachmentCount: v.number(),
  attachments: v.array(proposalAttachmentOutputValidator),
  clientName: v.string(),
  costPrice: v.number(),
  createdAt: v.string(),
  finalizedPdf: finalizedPdfOutputValidator,
  hasCollaborators: v.boolean(),
  id: v.id("proposals"),
  itinerarySummary: v.string(),
  landCostPerPax: v.number(),
  lastEditedAt: nullableString,
  lastEditedByName: v.string(),
  linkedQueryCount: v.number(),
  preparedBy: v.string(),
  previewQueryIds: v.array(v.id("queries")),
  pricingEnteredAt: nullableString,
  proposalCode: v.string(),
  proposalRevision: v.number(),
  query: v.union(v.null(), proposalListQueryValidator),
  queryId: v.union(v.null(), v.id("queries")),
  queryPreview: v.array(proposalListQueryValidator),
  sellingPrice: v.number(),
  sentAt: nullableString,
  sentToClientAt: nullableString,
  sentToSalesAt: nullableString,
  status: v.union(
    v.literal("Draft"),
    v.literal("Sent"),
    v.literal("Accepted"),
    v.literal("Rejected")
  ),
  taxRate: v.union(v.null(), v.number()),
  updatedAt: v.string(),
  visaCostPerPax: v.number(),
});

export const proposalListResultValidator = v.array(proposalListOutputValidator);
export const proposalListPageResultValidator = paginationResultValidator(
  proposalListOutputValidator
);
export const proposalLinkedQueriesPageResultValidator = paginationResultValidator(
  proposalQueryOutputValidator
);
export const proposalListRowResultValidator = v.union(proposalDetailOutputValidator, v.null());
export const proposalCreateResultValidator = v.object({
  id: v.id("proposals"),
  proposalCode: v.string(),
});
export const proposalIdResultValidator = v.object({ id: v.id("proposals") });
