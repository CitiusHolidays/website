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

/**
 * Transitional validator used only by storage tables while the room-type
 * backfill is running.  Writers and public return contracts remain
 * canonical (`roomTypeValidator`); accepting the legacy codes here keeps an
 * expand deploy compatible with rows written by the previous release.
 */
export const roomTypeMigrationValidator = v.union(
  roomTypeValidator,
  v.literal("SGL"),
  v.literal("DBL"),
  v.literal("TPL")
);
