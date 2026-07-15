export const LEGACY_RESEND_ENV_NAME = "RESEND_KEY";
export const LEGACY_RESEND_ENV_SUNSET = "2026-09-30";

export function resolveNotificationResendKey(env: Record<string, string | undefined>) {
  const canonical = env.RESEND_API_KEY?.trim();
  if (canonical) {
    return { key: canonical, source: "RESEND_API_KEY" as const };
  }
  const legacy = env[LEGACY_RESEND_ENV_NAME]?.trim();
  if (legacy) {
    return { key: legacy, source: LEGACY_RESEND_ENV_NAME };
  }
  return { key: null, source: null };
}
