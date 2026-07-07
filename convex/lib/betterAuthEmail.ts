import type { createAuth } from "../betterAuth/auth";

function getSiteUrl() {
  return process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function sendVerificationEmail(auth: ReturnType<typeof createAuth>, email: string) {
  const siteUrl = getSiteUrl();
  const callbackURL = `${siteUrl}/auth/email-verified`;
  const api = auth.api as {
    sendVerificationEmail?: (input: {
      body: { email: string; callbackURL?: string };
    }) => Promise<{ status?: boolean } | undefined>;
  };
  if (!api.sendVerificationEmail) {
    return { reason: "verification_api_unavailable" as const, sent: false };
  }
  const result = await api.sendVerificationEmail({
    body: { callbackURL, email },
  });
  return { reason: "verification" as const, sent: Boolean(result?.status ?? true) };
}

export async function sendPasswordSetupEmail(auth: ReturnType<typeof createAuth>, email: string) {
  const siteUrl = getSiteUrl();
  const resetResult = await auth.api.requestPasswordReset({
    body: {
      email,
      redirectTo: `${siteUrl}/auth/reset-password`,
    },
  });
  return Boolean(resetResult?.status);
}
