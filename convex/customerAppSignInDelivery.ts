import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import {
  APP_SIGN_IN_LINK_TTL_SECONDS,
  appSignInLinkUrl,
  reportAuthEmailFailure,
} from "./betterAuth/auth";
import { deliverTransactionalAuthEmail } from "./lib/authEmailDelivery";
import { prepareAppSignInEmailMessage } from "./lib/authEmailHtml";
import { resolveAuthOrigin } from "./lib/authOriginPolicy";
import {
  deviceDigestFrom,
  inviteTokenHashFrom,
  type SignInLinkMetadata,
  sha256Hex,
  signInDomainDigest,
  signInRecipientDigest,
} from "./lib/customerAppSignIn";
import { openSignInRequest, sealSignInRequest } from "./lib/customerAppSignInSeal";
import { isRuntimeObject } from "./lib/runtimeValues";

/**
 * The customer app's email sign-in link (ADR 0020), in two steps so the request answers at once
 * and the same way whatever happens: `scheduleAppSignInLink` (inside Better Auth's
 * `sendMagicLink`) seals the request and hands it to `processSignInLink`, which checks the device
 * binding, staff addresses and limits, then sends the email. Nothing is held open while it works.
 */

/** The background step `scheduleAppSignInLink` hands each sealed request to. */
export type SignInProcessorReference = FunctionReference<"action", "internal", { sealed: string }>;

/** What `scheduleAppSignInLink` needs from a Convex action context. */
export interface SchedulingCtx {
  scheduler: {
    runAfter: (
      delayMs: number,
      reference: SignInProcessorReference,
      args: { sealed: string }
    ) => Promise<string | null>;
  };
}

export async function scheduleAppSignInLink(
  ctx: SchedulingCtx,
  secret: string,
  request: { email: string; metadata: SignInLinkMetadata | undefined; token: string }
) {
  const sealed = await sealSignInRequest(
    {
      deviceDigest: deviceDigestFrom(request.metadata),
      email: request.email,
      inviteTokenHash: inviteTokenHashFrom(request.metadata) ?? null,
      token: request.token,
    },
    secret
  );
  await ctx.scheduler.runAfter(0, internal.customerAppSignInDelivery.processSignInLink, {
    sealed,
  });
}

async function hasLogin(ctx: ActionCtx, email: string) {
  const row = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: email.trim().toLowerCase() }],
  });
  return Boolean(row && isRuntimeObject(row));
}

async function deliverSignInEmail(ctx: ActionCtx, email: string, token: string) {
  try {
    const message = await prepareAppSignInEmailMessage({
      ctaHref: appSignInLinkUrl(resolveAuthOrigin(process.env), token),
    });
    // A sign-in link proves the mailbox, like email verification, so it shares that delivery
    // ledger purpose and its Live Feature Control.
    const outcome = await deliverTransactionalAuthEmail(ctx, {
      controlKey: "email.auth.verification",
      correlationSecret: token,
      expiresAt: Date.now() + APP_SIGN_IN_LINK_TTL_SECONDS * 1000,
      html: message.html,
      purpose: "verification",
      recipient: email,
      subject: message.subject,
      text: message.text,
    });
    if (outcome.status !== "sent") {
      reportAuthEmailFailure(outcome);
    }
  } catch {
    reportAuthEmailFailure({ purpose: "verification" });
  }
}

/**
 * Checks one sealed sign-in request and sends its email when every limit allows it. Each refusal
 * forgets the link Better Auth already stored, which holds the address.
 */
export const processSignInLink = internalAction({
  args: { sealed: v.string() },
  handler: async (ctx, args) => {
    const request = await openSignInRequest(args.sealed, process.env.BETTER_AUTH_SECRET ?? "");
    const tokenDigest = await sha256Hex(request.token);
    // Only the app asks for these links, and it always binds them to its device; staff sign in
    // with their password.
    if (
      !request.deviceDigest ||
      (await ctx.runQuery(internal.customerAppAuth.isStaffEmail, { email: request.email }))
    ) {
      await ctx.runMutation(internal.customerAppAuth.discardSignInLink, { tokenDigest });
      return "refused" as const;
    }
    const recorded = await ctx.runMutation(internal.customerAppAuth.recordSignInLink, {
      deviceDigest: request.deviceDigest,
      domainDigest: await signInDomainDigest(request.email),
      inviteTokenHash: request.inviteTokenHash ?? undefined,
      knownAccount: await hasLogin(ctx, request.email),
      recipientDigest: await signInRecipientDigest(request.email),
      tokenDigest,
    });
    if (recorded !== "recorded") {
      return "refused" as const;
    }
    await deliverSignInEmail(ctx, request.email, request.token);
    return "sent" as const;
  },
  returns: v.union(v.literal("sent"), v.literal("refused")),
});
