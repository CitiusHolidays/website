import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literalUnion } from "../lib/literalValidators";

export const TICKETING_SCOPES = ["Domestic", "International", "Both", "Not required"] as const;

export const ticketingScopeValidator = literalUnion(TICKETING_SCOPES);

export type TicketingScope = Infer<typeof ticketingScopeValidator>;
export type TicketingScopeOutput = TicketingScope | "";

export const QUERY_TYPES = [
  "MICE",
  "MICE Bidding",
  "Cement",
  "Cement Bidding",
  "FIT",
  "Family Group",
  "B2B",
  "Spiritual",
] as const;

export const queryTypeValidator = literalUnion(QUERY_TYPES);

export const travelTypeValidator = v.union(
  v.literal("Domestic Travel"),
  v.literal("International Travel")
);

export const salesStatusValidator = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

export const salesDecisionValidator = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

export const LEAD_STAGES = ["Inquiry", "Proposal", "Negotiation", "Confirmation", "Lost"] as const;

export const leadStageValidator = literalUnion(LEAD_STAGES);

// Storage stays widened until the registry-backed Closed -> Lost migration is
// verified on every deployment. Public writers must use leadStageValidator.
export const leadStageStorageValidator = literalUnion([...LEAD_STAGES, "Closed"]);

export const querySourceValidator = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral"),
  v.literal("Citius Concierge"),
  v.literal("Sacred Bharat")
);

export const inboundSourceValidator = v.union(
  v.literal("Citius Concierge"),
  v.literal("Sacred Bharat"),
  v.literal("Website")
);

export const contractingStatusValidator = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent"),
  v.literal("Change in destination"),
  v.literal("Date/Destination Change Required"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost")
);

export const contractingProgressValidator = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent")
);

export const lostReasonValidator = v.union(
  v.literal("Price"),
  v.literal("Competition"),
  v.literal("Not travelling"),
  v.literal("Other")
);

export type QuerySource = Infer<typeof querySourceValidator>;
export type QuerySourceOutput = QuerySource | "";

export type TravelType = Infer<typeof travelTypeValidator>;
export type QueryType = Infer<typeof queryTypeValidator>;
export type SalesStatus = Infer<typeof salesStatusValidator>;
export type LeadStage = Infer<typeof leadStageValidator>;
export type LeadStageStorage = Infer<typeof leadStageStorageValidator>;
export type ContractingStatus = Infer<typeof contractingStatusValidator>;
export type LostReason = Infer<typeof lostReasonValidator>;

export type SalesDecision = Infer<typeof salesDecisionValidator>;
export type ContractingProgress = Infer<typeof contractingProgressValidator>;

export interface QueryStatusArgs {
  airfarePerPax?: number;
  approxMargin?: number;
  confirmedPax?: number;
  contractingAirlinesCost?: number;
  contractingLandCost?: number;
  contractingStatus?: ContractingStatus;
  contractingVisaCost?: number;
  destination?: string;
  landCostPerPax?: number;
  leadStage?: LeadStage;
  lostReason?: LostReason;
  lostReasonOther?: string;
  proposalId?: string;
  proposalRevision?: number;
  queryId: string;
  salesStatus?: SalesStatus;
  sellingPricePerPax?: number;
  travelEndDate?: string;
  travelStartDate?: string;
  visaCostPerPax?: number;
}
