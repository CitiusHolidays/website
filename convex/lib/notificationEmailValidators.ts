import { v } from "convex/values";
import { operationalControlKeyValidator } from "../crm/lib/operationalControls";

export const notificationEmailMessageValidator = v.object({
  from: v.string(),
  html: v.string(),
  subject: v.string(),
  text: v.string(),
});

export const notificationEmailOutboxFields = {
  attempts: v.number(),
  body: v.string(),

  controlKeys: v.optional(v.array(operationalControlKeyValidator)),
  createdAt: v.number(),
  entityId: v.optional(v.string()),
  entityType: v.optional(v.string()),
  eventId: v.string(),
  failureCode: v.optional(v.string()),
  firstAttemptAt: v.optional(v.number()),
  idempotencyKey: v.string(),
  leaseExpiresAt: v.optional(v.number()),
  message: v.optional(notificationEmailMessageValidator),
  nextAttemptAt: v.number(),
  providerEmailId: v.optional(v.string()),
  recipient: v.optional(v.string()),
  recipientStaffId: v.optional(v.id("staffUsers")),
  status: v.union(
    v.literal("pending"),
    v.literal("sending"),
    v.literal("accepted"),
    v.literal("skipped"),
    v.literal("failed"),
    v.literal("uncertain")
  ),
  title: v.string(),
  updatedAt: v.number(),
};
