"use node";

import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { resolveAuthOrigin } from "../lib/authOriginPolicy";
import { AUTH_EMAIL_FROM } from "../lib/emailConfig";
import { resolveNotificationResendKey } from "./notificationEmailConfig";
import {
  notificationEmailSummaryDetails,
  renderNotificationEmail,
} from "./notificationEmailContent";
import {
  deliverNotificationEmailsSequentially,
  type NotificationEmailMessage,
} from "./notificationEmailDelivery";
import { normalizeNotificationEmailFailure } from "./notificationEmailLedger";
import {
  NOTIFICATION_PROVIDER_TIMEOUT_MS,
  type NotificationEmailEnvelope,
  notificationEmailEnvelopeFields,
} from "./notificationEmailOutbox";
import { sendNotificationEmailWithResend } from "./notificationEmailProvider";
import { getNotificationHref } from "./notificationPaths";

const TRAILING_SLASH = /\/$/;

const enqueueRef = makeFunctionReference<
  "mutation",
  NotificationEmailEnvelope,
  Id<"notificationEmailOutbox">[]
>("crm/notificationEmailOutbox:enqueueLegacyNotificationEmail");
const claimRef = makeFunctionReference<
  "mutation",
  { jobId: Id<"notificationEmailOutbox"> },
  Doc<"notificationEmailOutbox"> | null
>("crm/notificationEmailOutbox:claimNotificationEmail");
const freezeRef = makeFunctionReference<
  "mutation",
  { attempt: number; jobId: Id<"notificationEmailOutbox">; message: NotificationEmailMessage },
  NotificationEmailMessage | null
>("crm/notificationEmailOutbox:freezeNotificationEmail");
const completeRef = makeFunctionReference<
  "mutation",
  {
    attempt: number;
    failureCode?: string;
    jobId: Id<"notificationEmailOutbox">;
    providerEmailId?: string;
    retryable: boolean;
    ambiguous?: boolean;
    status: "accepted" | "failed" | "skipped";
  },
  null
>("crm/notificationEmailOutbox:completeNotificationEmail");

// Retains the old scheduled function's arguments while routing replays through durable dedupe.
export const sendNotificationEmail = internalAction({
  args: notificationEmailEnvelopeFields,
  handler: async (ctx, args) => ({ queued: (await ctx.runMutation(enqueueRef, args)).length }),
  returns: v.object({ queued: v.number() }),
});

export const dispatchNotificationEmail = internalAction({
  args: { jobId: v.id("notificationEmailOutbox") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runMutation(claimRef, { jobId });
    if (!job) {
      return null;
    }
    const complete = (outcome: {
      failureCode?: string;
      providerEmailId?: string;
      retryable: boolean;
      ambiguous?: boolean;
      status: "accepted" | "failed" | "skipped";
    }) => ctx.runMutation(completeRef, { ...outcome, attempt: job.attempts, jobId });
    const config = resolveNotificationResendKey(process.env);
    if (!config.key) {
      await complete({
        failureCode: "provider_not_configured",
        retryable: false,
        status: "skipped",
      });
      return null;
    }
    if (!job.recipient) {
      throw new Error("NOTIFICATION_EMAIL_RECIPIENT_MISSING");
    }
    let { message } = job;
    if (!message) {
      try {
        const details =
          job.entityType && job.entityId
            ? await ctx.runQuery(
                internal.crm.notificationEmailDetails.getNotificationEmailDetails,
                {
                  jobId,
                }
              )
            : null;
        const href = `${resolveAuthOrigin(process.env).replace(TRAILING_SLASH, "")}${getNotificationHref(job)}`;
        const content = {
          body: job.body,
          details: notificationEmailSummaryDetails(details, job.entityType),
          href,
          title: job.title,
        };
        const rendered = await renderNotificationEmail(content);
        message =
          (await ctx.runMutation(freezeRef, {
            attempt: job.attempts,
            jobId,
            message: {
              from: AUTH_EMAIL_FROM,
              html: rendered.html,
              subject: `Citius Connect: ${job.title}`,
              text: rendered.text,
            },
          })) ?? undefined;
      } catch (error) {
        const accessChanged =
          error instanceof ConvexError &&
          error.data === "NOTIFICATION_EMAIL_RECIPIENT_ACCESS_CHANGED";
        await complete({
          failureCode: accessChanged ? "recipient_access_changed" : "preparation_failed",
          retryable: !accessChanged,
          status: accessChanged ? "skipped" : "failed",
        });
        return null;
      }
    }
    if (!message) {
      return null;
    }
    await deliverNotificationEmailsSequentially({
      config: {
        maxAttempts: 1,
        minIntervalMs: 0,
        requestTimeoutMs: NOTIFICATION_PROVIDER_TIMEOUT_MS,
      },
      eventId: job.eventId,
      message,
      onStatus: async (event) => {
        if (event.status === "sent") {
          await complete({
            providerEmailId: event.providerEmailId,
            retryable: false,
            status: "accepted",
          });
        } else if (event.status === "exhausted") {
          await complete({
            ambiguous: event.ambiguous,
            failureCode: normalizeNotificationEmailFailure(event.error).code,
            retryable: event.retryable ?? false,
            status: "failed",
          });
        }
      },
      recipients: [job.recipient],
      sendEmail: (email, options) => sendNotificationEmailWithResend(config.key, email, options),
    });
    return null;
  },
  returns: v.null(),
});
