import { v } from "convex/values";

/** Canonical room labels used in portal UI, schema, and imports. */
export const roomTypeValidator = v.union(
  v.literal("Single"),
  v.literal("Twin"),
  v.literal("Double"),
  v.literal("Triple"),
  v.literal("Child with Bed"),
  v.literal("Family Room")
);
