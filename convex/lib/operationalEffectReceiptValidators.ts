import { v } from "convex/values";

/**
 * Stored shape of one operational effect receipt. The schema table and the internal mutation that
 * returns a receipt share it, so the return contract cannot drift from what is stored.
 */
export const operationalEffectReceiptFields = {
  controlKey: v.string(),
  createdAt: v.number(),
  disposition: v.union(
    v.literal("created"),
    v.literal("duplicate"),
    v.literal("failed"),
    v.literal("not_applicable"),
    v.literal("queued"),
    v.literal("suppressed"),
    v.literal("throttled")
  ),
  effectId: v.string(),
  entityId: v.optional(v.string()),
  entityType: v.optional(v.string()),
  payloadFingerprint: v.optional(v.string()),
  reason: v.union(
    v.literal("configured_default"),
    v.literal("corrupt_safe_default"),
    v.literal("explicit_disabled"),
    v.literal("explicit_enabled"),
    v.literal("expired_safe_default"),
    v.literal("missing_safe_default"),
    v.literal("no_recipients"),
    v.literal("pre_activation_standard"),
    v.literal("prerequisite_disabled"),
    v.literal("test_override")
  ),
  recipientCount: v.optional(v.number()),
  synthetic: v.optional(v.boolean()),
  testSessionId: v.optional(v.id("operationalControlTestSessions")),
};
