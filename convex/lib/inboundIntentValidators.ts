import { v } from "convex/values";

export const inboundSourceValidator = v.union(
  v.literal("Citius Concierge"),
  v.literal("Sacred Bharat"),
  v.literal("Website")
);

export const sacredBharatInboundContextValidator = v.object({
  entryPoint: v.union(v.literal("journey_planner"), v.literal("trail")),
  templeId: v.optional(v.string()),
  trailSlug: v.optional(v.string()),
});

export const inboundEnquiryBriefValidator = v.object({
  contactWindow: v.optional(
    v.union(
      v.literal("morning"),
      v.literal("afternoon"),
      v.literal("evening"),
      v.literal("anytime")
    )
  ),
  dateFlexibility: v.optional(
    v.union(v.literal("fixed"), v.literal("flexible"), v.literal("not_sure"))
  ),
  destination: v.optional(v.string()),
  paxCount: v.optional(v.number()),
  serviceType: v.optional(
    v.union(
      v.literal("leisure_travel"),
      v.literal("meetings_events"),
      v.literal("pilgrimage"),
      v.literal("other")
    )
  ),
  travelStartDate: v.optional(v.string()),
});

export const websiteSourceContextValidator = v.object({
  intent: v.union(
    v.literal("account-deletion"),
    v.literal("mice-proposal"),
    v.literal("pilgrimage-callback"),
    v.literal("pilgrimage-enquiry")
  ),
  label: v.string(),
  trailSlug: v.optional(v.string()),
});
