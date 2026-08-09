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

const proposalQueryOutputValidator = v.object({
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
  v.object({ fileName: v.string(), uploadedAt: nullableString })
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
  id: v.id("queries"),
  paxCount: v.number(),
  queryCode: v.string(),
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
  pricingEnteredAt: nullableString,
  proposalCode: v.string(),
  queries: v.array(proposalListQueryValidator),
  query: v.union(v.null(), proposalListQueryValidator),
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

export const proposalListResultValidator = v.array(proposalListOutputValidator);
export const proposalListPageResultValidator = paginationResultValidator(
  proposalListOutputValidator
);
export const proposalListRowResultValidator = v.union(proposalDetailOutputValidator, v.null());
export const proposalCreateResultValidator = v.object({
  id: v.id("proposals"),
  proposalCode: v.string(),
});
export const proposalIdResultValidator = v.object({ id: v.id("proposals") });
