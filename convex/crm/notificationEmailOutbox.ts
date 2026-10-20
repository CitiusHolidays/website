import { RateLimiter } from "@convex-dev/rate-limiter";
import { makeFunctionReference } from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  notificationEmailMessageValidator,
  notificationEmailOutboxFields,
} from "../lib/notificationEmailValidators";
import { rateLimiterComponent } from "../lib/rateLimiterComponent";
import {
  operationalControlKeyValidator,
  resolveOperationalControls,
} from "./lib/operationalControls";
import { normalizeEmail } from "./lib/staffAccess";
import { notificationRecipientCanAccess } from "./notificationEmailAudience";
import {
  notificationEmailIdempotencyKey,
  RESEND_DELIVERY_MAX_ATTEMPTS,
  RESEND_DELIVERY_MIN_INTERVAL_MS,
} from "./notificationEmailDelivery";
import { type DeliveryStatus, recordNotificationDeliveryOutcome } from "./notificationEmailLedger";

export const NOTIFICATION_PROVIDER_TIMEOUT_MS = 10_000;
export const NOTIFICATION_LEASE_MS = 30_000;
export const NOTIFICATION_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
const pacing = new RateLimiter(rateLimiterComponent, {
  crmNotificationEmail: {
    capacity: 1,
    kind: "token bucket",
    period: RESEND_DELIVERY_MIN_INTERVAL_MS,
    rate: 1,
  },
});

export const notificationEmailEnvelopeFields = {
  body: v.string(),
  controlKeys: v.optional(v.array(operationalControlKeyValidator)),
  entityId: v.optional(v.string()),
  entityType: v.optional(v.string()),
  eventId: v.string(),
  recipients: v.array(v.string()),
  title: v.string(),
};

const envelopeValidator = v.object(notificationEmailEnvelopeFields);
export type NotificationEmailEnvelope = Infer<typeof envelopeValidator>;

const dispatchRef = makeFunctionReference<"action", { jobId: Id<"notificationEmailOutbox"> }, null>(
  "crm/notificationEmails:dispatchNotificationEmail"
);
const recoverRef = makeFunctionReference<
  "mutation",
  { jobId: Id<"notificationEmailOutbox"> },
  null
>("crm/notificationEmailOutbox:recoverNotificationEmail");

type Job = Doc<"notificationEmailOutbox">;

function terminal(job: Job) {
  return !["pending", "sending"].includes(job.status);
}

async function recordJobStatus(
  ctx: MutationCtx,
  job: Pick<Job, "attempts" | "eventId" | "idempotencyKey">,
  status: DeliveryStatus,
  failureCode?: string
) {
  const recipientHash = job.idempotencyKey.slice(job.idempotencyKey.lastIndexOf("/") + 1);
  await recordNotificationDeliveryOutcome(ctx, {
    attempts: job.attempts,
    eventId: job.eventId,
    failureCode,
    idempotencyKey: job.idempotencyKey,
    recipientHash,
    status,
  });
}

async function stopJob(
  ctx: MutationCtx,
  job: Job,
  status: "failed" | "skipped" | "uncertain",
  reason: string
) {
  await ctx.db.patch("notificationEmailOutbox", job._id, {
    failureCode: reason,
    leaseExpiresAt: undefined,
    message: undefined,
    recipient: undefined,
    status,
    updatedAt: Date.now(),
  });
  await recordJobStatus(ctx, job, status === "skipped" ? "skipped" : "exhausted", reason);
}

function sameEnvelope(job: Job, envelope: NotificationEmailEnvelope) {
  return (
    job.eventId === envelope.eventId &&
    job.title === envelope.title &&
    job.body === envelope.body &&
    job.entityId === envelope.entityId &&
    job.entityType === envelope.entityType
  );
}

function previousJobStatus(previous: Doc<"notificationEmailDeliveries"> | null): Job["status"] {
  if (!previous) {
    return "pending";
  }
  if (previous.status === "sent") {
    return "accepted";
  }
  if (previous.status === "skipped") {
    return "skipped";
  }
  if (previous.status === "exhausted" || previous.attempts > 0) {
    return "uncertain";
  }
  return "pending";
}

export async function enqueueNotificationEmailOutbox(
  ctx: MutationCtx,
  envelope: NotificationEmailEnvelope,
  delayMs = 0
) {
  const now = Date.now();
  const recipients = Array.from(new Set(envelope.recipients.map(normalizeEmail).filter(Boolean)));
  const staff = await ctx.db.query("staffUsers").collect();
  return await Promise.all(
    recipients.map(async (recipient) => {
      const idempotencyKey = await notificationEmailIdempotencyKey(envelope.eventId, recipient);
      const existing = await ctx.db
        .query("notificationEmailOutbox")
        .withIndex("by_deliveryKey", (q) => q.eq("idempotencyKey", idempotencyKey))
        .unique();
      if (existing) {
        if (!sameEnvelope(existing, envelope)) {
          throw new ConvexError("NOTIFICATION_EMAIL_PAYLOAD_CONFLICT");
        }
        const controlKeys = Array.from(
          new Set([
            ...(existing.controlKeys ?? ["email.crm_workflow"]),
            ...(envelope.controlKeys ?? ["email.crm_workflow"]),
          ])
        );
        await ctx.db.patch("notificationEmailOutbox", existing._id, { controlKeys });
        return existing._id;
      }
      const previous = await ctx.db
        .query("notificationEmailDeliveries")
        .withIndex("by_deliveryKey", (q) => q.eq("idempotencyKey", idempotencyKey))
        .unique();
      const member = staff.find((row) => normalizeEmail(row.email) === recipient);
      const status = previousJobStatus(previous);
      const jobId = await ctx.db.insert("notificationEmailOutbox", {
        attempts: previous?.attempts ?? 0,
        body: envelope.body,
        controlKeys: envelope.controlKeys ?? ["email.crm_workflow"],
        createdAt: now,
        entityId: envelope.entityId,
        entityType: envelope.entityType,
        eventId: envelope.eventId,
        failureCode: status === "uncertain" ? "legacy_attempt_outcome_unknown" : undefined,
        idempotencyKey,
        nextAttemptAt: now + delayMs,
        recipient: status === "pending" ? recipient : undefined,
        recipientStaffId: member?._id,
        status,
        title: envelope.title,
        updatedAt: now,
      });
      if (status === "uncertain") {
        await recordJobStatus(
          ctx,
          { attempts: previous?.attempts ?? 0, eventId: envelope.eventId, idempotencyKey },
          "exhausted",
          "legacy_attempt_outcome_unknown"
        );
      }
      if (status === "pending") {
        await recordJobStatus(
          ctx,
          { attempts: 0, eventId: envelope.eventId, idempotencyKey },
          "queued"
        );
        await ctx.scheduler.runAfter(delayMs, dispatchRef, { jobId });
        await ctx.scheduler.runAfter(delayMs + NOTIFICATION_LEASE_MS, recoverRef, { jobId });
      }
      return jobId;
    })
  );
}

export const enqueueLegacyNotificationEmail = internalMutation({
  args: notificationEmailEnvelopeFields,
  handler: (ctx, args) => enqueueNotificationEmailOutbox(ctx, args),
  returns: v.array(v.id("notificationEmailOutbox")),
});

async function recipientEligibilityFailure(ctx: MutationCtx, job: Job): Promise<string | null> {
  const mailboxCopy =
    job.entityType === "inboundQueryIntent" &&
    job.controlKeys?.includes("inbound.info_mailbox_email");
  if (job.entityType && job.entityId && !job.recipientStaffId && !mailboxCopy) {
    return "recipient_no_longer_identified";
  }
  if (!job.recipientStaffId) {
    return null;
  }
  const member = await ctx.db.get("staffUsers", job.recipientStaffId);
  if (!member?.active || normalizeEmail(member.email) !== job.recipient) {
    return "recipient_no_longer_active";
  }
  if (!(await notificationRecipientCanAccess(ctx, member, job))) {
    return "recipient_access_changed";
  }
  return null;
}

export const claimNotificationEmail = internalMutation({
  args: { jobId: v.id("notificationEmailOutbox") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("notificationEmailOutbox", jobId);
    if (!job || terminal(job)) {
      return null;
    }
    const now = Date.now();
    if (job.leaseExpiresAt && job.leaseExpiresAt > now) {
      return null;
    }
    if (job.nextAttemptAt > now) {
      return null;
    }
    if (
      job.firstAttemptAt !== undefined &&
      now + NOTIFICATION_PROVIDER_TIMEOUT_MS >=
        job.firstAttemptAt + NOTIFICATION_IDEMPOTENCY_WINDOW_MS
    ) {
      await stopJob(ctx, job, "uncertain", "idempotency_window_expired");
      return null;
    }
    if (job.attempts >= RESEND_DELIVERY_MAX_ATTEMPTS) {
      await stopJob(ctx, job, "uncertain", "attempts_exhausted");
      return null;
    }
    const controls = await resolveOperationalControls(
      ctx,
      job.controlKeys ?? ["email.crm_workflow"],
      { at: now }
    );
    if (!controls.some((control) => control.enabled)) {
      await stopJob(ctx, job, "skipped", "delivery_control_disabled");
      return null;
    }
    const recipientFailure = await recipientEligibilityFailure(ctx, job);
    if (recipientFailure) {
      await stopJob(ctx, job, "skipped", recipientFailure);
      return null;
    }
    const slot = await pacing.limit(ctx, "crmNotificationEmail");
    if (!slot.ok) {
      const delayMs = Math.max(1, Math.ceil(slot.retryAfter));
      await ctx.db.patch("notificationEmailOutbox", jobId, { nextAttemptAt: now + delayMs });
      await ctx.scheduler.runAfter(delayMs, dispatchRef, { jobId });
      return null;
    }
    const patch = {
      attempts: job.attempts + 1,
      firstAttemptAt: job.firstAttemptAt ?? now,
      leaseExpiresAt: now + NOTIFICATION_LEASE_MS,
      status: "sending" as const,
      updatedAt: now,
    };
    await ctx.db.patch("notificationEmailOutbox", jobId, patch);
    await recordJobStatus(ctx, { ...job, ...patch }, "sending");
    return { ...job, ...patch };
  },
  returns: v.union(
    v.object({
      ...notificationEmailOutboxFields,
      _creationTime: v.number(),
      _id: v.id("notificationEmailOutbox"),
    }),
    v.null()
  ),
});

export const recoverNotificationEmail = internalMutation({
  args: { jobId: v.id("notificationEmailOutbox") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get("notificationEmailOutbox", jobId);
    if (!job || terminal(job)) {
      return null;
    }
    const now = Date.now();
    if (now >= (job.firstAttemptAt ?? job.createdAt) + NOTIFICATION_IDEMPOTENCY_WINDOW_MS) {
      await stopJob(ctx, job, "uncertain", "idempotency_window_expired");
      return null;
    }
    const due = Math.max(job.nextAttemptAt, job.leaseExpiresAt ?? 0);
    if (due <= now) {
      await ctx.scheduler.runAfter(0, dispatchRef, { jobId });
    }
    await ctx.scheduler.runAfter(NOTIFICATION_LEASE_MS, recoverRef, { jobId });
    return null;
  },
  returns: v.null(),
});

export const freezeNotificationEmail = internalMutation({
  args: {
    attempt: v.number(),
    jobId: v.id("notificationEmailOutbox"),
    message: notificationEmailMessageValidator,
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get("notificationEmailOutbox", args.jobId);
    if (job?.status !== "sending" || job.attempts !== args.attempt) {
      return null;
    }
    if (job.message) {
      return job.message;
    }
    await ctx.db.patch("notificationEmailOutbox", job._id, { message: args.message });
    return args.message;
  },
  returns: v.union(notificationEmailMessageValidator, v.null()),
});

async function acceptJob(ctx: MutationCtx, job: Job, providerEmailId?: string) {
  if (!providerEmailId?.trim()) {
    throw new ConvexError("NOTIFICATION_EMAIL_RECEIPT_REQUIRED");
  }
  if (job.status === "accepted") {
    return;
  }
  await ctx.db.patch("notificationEmailOutbox", job._id, {
    failureCode: undefined,
    leaseExpiresAt: undefined,
    message: undefined,
    providerEmailId,
    recipient: undefined,
    status: "accepted",
    updatedAt: Date.now(),
  });
  await recordJobStatus(ctx, job, "sent");
}

export const completeNotificationEmail = internalMutation({
  args: {
    ambiguous: v.optional(v.boolean()),
    attempt: v.number(),
    failureCode: v.optional(v.string()),
    jobId: v.id("notificationEmailOutbox"),
    providerEmailId: v.optional(v.string()),
    retryable: v.boolean(),
    status: v.union(v.literal("accepted"), v.literal("failed"), v.literal("skipped")),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get("notificationEmailOutbox", args.jobId);
    if (
      !(job && Number.isInteger(args.attempt)) ||
      args.attempt < 1 ||
      args.attempt > job.attempts
    ) {
      return null;
    }
    // A real receipt for this fixed event-recipient key remains evidence even
    // after recovery claimed a newer attempt. Stale failures never undo it.
    if (args.status === "accepted") {
      await acceptJob(ctx, job, args.providerEmailId);
      return null;
    }
    if (terminal(job) || job.attempts !== args.attempt || job.status !== "sending") {
      return null;
    }
    if (args.retryable && job.attempts < RESEND_DELIVERY_MAX_ATTEMPTS) {
      const delayMs = Math.max(RESEND_DELIVERY_MIN_INTERVAL_MS, 2 ** job.attempts * 1000);
      await ctx.db.patch("notificationEmailOutbox", job._id, {
        failureCode: args.failureCode,
        leaseExpiresAt: undefined,
        nextAttemptAt: Date.now() + delayMs,
        status: "pending",
        updatedAt: Date.now(),
      });
      await recordJobStatus(ctx, job, "retrying", args.failureCode);
      await ctx.scheduler.runAfter(delayMs, dispatchRef, { jobId: job._id });
    } else {
      let status: "failed" | "skipped" | "uncertain" = args.ambiguous ? "uncertain" : "failed";
      if (args.status === "skipped") {
        status = "skipped";
      }
      await stopJob(ctx, job, status, args.failureCode ?? "provider_error");
    }
    return null;
  },
  returns: v.null(),
});
