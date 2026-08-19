import type { ActionCtx } from "../_generated/server";
import type { createAuth } from "../betterAuth/auth";
import {
  type AuthEmailPurpose,
  createAuthEmailCorrelation,
  getAuthEmailDeliveryOutcome,
} from "./authEmailDelivery";
import { resolveAuthOrigin } from "./authOriginPolicy";

function getSiteUrl() {
  return resolveAuthOrigin(process.env);
}

function outcomeReason(
  purpose: AuthEmailPurpose,
  outcome: Awaited<ReturnType<typeof getAuthEmailDeliveryOutcome>>
) {
  if (outcome?.status === "sent") {
    return purpose === "verification" ? ("verification" as const) : ("password_reset" as const);
  }
  return outcome?.failureCode ?? ("delivery_not_observed" as const);
}

export async function sendVerificationEmail(
  ctx: ActionCtx,
  auth: ReturnType<typeof createAuth>,
  email: string
) {
  const siteUrl = getSiteUrl();
  const correlation = await createAuthEmailCorrelation(
    "verification",
    `${siteUrl}/auth/email-verified`
  );
  const { api } = auth;
  if (!api.sendVerificationEmail) {
    return { reason: "verification_api_unavailable" as const, sent: false };
  }
  await api.sendVerificationEmail({
    body: { callbackURL: correlation.callbackUrl, email },
  });
  const outcome = await getAuthEmailDeliveryOutcome(ctx, correlation.correlationDigest);
  return {
    reason: outcomeReason("verification", outcome),
    sent: outcome?.status === "sent",
  };
}

export async function sendPasswordSetupEmail(
  ctx: ActionCtx,
  auth: ReturnType<typeof createAuth>,
  email: string
) {
  const siteUrl = getSiteUrl();
  const correlation = await createAuthEmailCorrelation(
    "password_reset",
    `${siteUrl}/auth/reset-password`
  );
  await auth.api.requestPasswordReset({
    body: {
      email,
      redirectTo: correlation.callbackUrl,
    },
  });
  const outcome = await getAuthEmailDeliveryOutcome(ctx, correlation.correlationDigest);
  return {
    reason: outcomeReason("password_reset", outcome),
    sent: outcome?.status === "sent",
  };
}
