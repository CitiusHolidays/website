import { v } from "convex/values";
import { internal } from "./_generated/api";
import { type ActionCtx, internalAction } from "./_generated/server";
import { deliverTransactionalAuthEmail } from "./lib/authEmailDelivery";
import { prepareAccountDeletedEmailMessage } from "./lib/authEmailHtml";
import { resolveAuthOrigin } from "./lib/authOriginPolicy";

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

async function deliverConfirmation(
  ctx: ActionCtx,
  recipient: string,
  correlationSecret: string
): Promise<"failed" | "sent" | "skipped"> {
  try {
    const message = await prepareAccountDeletedEmailMessage({
      contactHref: `${resolveAuthOrigin(process.env)}/contact`,
    });
    const { status } = await deliverTransactionalAuthEmail(ctx, {
      controlKey: "email.auth.account_deleted",
      correlationSecret,
      expiresAt: Date.now() + CONFIRMATION_TTL_MS,
      html: message.html,
      purpose: "account_deleted",
      recipient,
      subject: message.subject,
      text: message.text,
    });
    return status === "sent" || status === "skipped" ? status : "failed";
  } catch {
    console.error(JSON.stringify({ event: "account_deleted_email_failed" }));
    return "failed";
  }
}

/**
 * Sends "your account was deleted" through the transactional auth email path, which records a
 * content-free outcome and fails closed when the operational control or the provider is off.
 */
export const sendConfirmation = internalAction({
  args: { receiptId: v.id("accountDeletionReceipts"), recipient: v.string() },
  handler: async (ctx, args) => {
    const status = await deliverConfirmation(ctx, args.recipient, String(args.receiptId));
    await ctx.runMutation(internal.accountDeletion.recordConfirmationEmail, {
      receiptId: args.receiptId,
      status,
    });
    return null;
  },
  returns: v.null(),
});
