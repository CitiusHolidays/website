import { v } from "convex/values";

export const ticketStatusValidator = v.union(
  v.literal("Pending Issue"),
  v.literal("Issued"),
  v.literal("Name Change Required"),
  v.literal("Reissue Required"),
  v.literal("Cancelled"),
  v.literal("Refund Pending"),
  v.literal("Refunded")
);

export const paymentTypeValidator = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid")
);

export const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan")
);

export const ticketTypeValidator = v.union(v.literal("FIT Ticket"), v.literal("Group Ticket"));

export const seatStatusValidator = v.union(
  v.literal("Available"),
  v.literal("Held"),
  v.literal("Assigned"),
  v.literal("Blocked")
);
