import type { Infer } from "convex/values";
import { v } from "convex/values";

export const ticketingScopeValidator = v.union(
  v.literal("Domestic"),
  v.literal("International"),
  v.literal("Both"),
  v.literal("Not required")
);

export type TicketingScope = Infer<typeof ticketingScopeValidator>;
export type TicketingScopeOutput = TicketingScope | "";

export const queryTypeValidator = v.union(
  v.literal("MICE"),
  v.literal("MICE Bidding"),
  v.literal("Cement"),
  v.literal("Cement Bidding"),
  v.literal("FIT"),
  v.literal("Family Group"),
  v.literal("B2B"),
  v.literal("Spiritual")
);

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

export const leadStageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost")
);

// Storage stays widened until the registry-backed Closed -> Lost migration is
// verified on every deployment. Public writers must use leadStageValidator.
export const leadStageStorageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost"),
  v.literal("Closed")
);

export const querySourceValidator = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral"),
  v.literal("Citius Concierge"),
  v.literal("Sacred Bharat")
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

export type TravelType = "Domestic Travel" | "International Travel";

export type QueryType =
  | "MICE"
  | "MICE Bidding"
  | "Cement"
  | "Cement Bidding"
  | "FIT"
  | "Family Group"
  | "B2B"
  | "Spiritual";

export type SalesStatus =
  | "Proposal in discussion"
  | "Change in destination"
  | "Date/Destination Change Required"
  | "Order Confirmed"
  | "Order Lost";

export type LeadStage = "Inquiry" | "Proposal" | "Negotiation" | "Confirmation" | "Lost";
export type LeadStageStorage = LeadStage | "Closed";

export type ContractingStatus =
  | "Query Received"
  | "Proposal in progress"
  | "Proposal sent"
  | "Change in destination"
  | "Date/Destination Change Required"
  | "Order Confirmed"
  | "Order Lost";

export type LostReason = "Price" | "Competition" | "Not travelling" | "Other";

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
