import type { Infer } from "convex/values";
import { v } from "convex/values";

export const JOB_CARD_STATUS = v.union(
  v.literal("Open"),
  v.literal("In Operations"),
  v.literal("Ready for Departure"),
  v.literal("On Tour"),
  v.literal("Closed")
);

export type JobCardStatus = Infer<typeof JOB_CARD_STATUS>;

export const DEFAULT_CHECKLIST = [
  { done: false, key: "handover", label: "Sales/Contracting handover acknowledged" },
  {
    done: false,
    key: "hotelConfirmation",
    label: "Hotel confirmation",
    owner: "Contracting",
    status: "Pending",
  },
  {
    done: false,
    key: "dmc",
    label: "Destination management company",
    owner: "Contracting",
    status: "Pending",
  },
  {
    done: false,
    key: "landArrangement",
    label: "Land arrangement",
    owner: "Contracting",
    status: "Pending",
  },
  { done: false, key: "masterSheet", label: "Master sheet prepared" },
  { done: false, key: "visaDocs", label: "Visa documents verified" },
  { done: false, key: "flights", label: "Flights and tickets confirmed" },
  {
    done: false,
    key: "roomingList",
    label: "Rooming list prepared",
    owner: "Operations",
    status: "Pending",
  },
  {
    done: false,
    key: "foodMenu",
    label: "Food menu finalized",
    owner: "Operations",
    status: "Pending",
  },
  {
    done: false,
    key: "updates",
    label: "Client and internal updates shared",
    owner: "Operations",
    status: "Pending",
  },
  { done: false, key: "tmBriefing", label: "Tour manager briefing completed" },
  { done: false, key: "finalKit", label: "Final travel kit shared" },
  { done: false, key: "financeClosure", label: "Final invoice and balance closure" },
];
