/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * @param {string | undefined} token
 * @param {string} [remoteip]
 * @returns {Promise<{ ok: true } | { ok: false; error: string }>}
 */
export async function verifyTurnstileToken(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[contact] TURNSTILE_SECRET_KEY is not set; CAPTCHA verification skipped.");
    }
    return { ok: true };
  }

  if (!token || typeof token !== "string") {
    return { error: "missing_token", ok: false };
  }

  try {
    const body = new URLSearchParams({
      response: token,
      secret,
    });
    if (remoteip && remoteip !== "unknown") {
      body.set("remoteip", remoteip);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    const result = await response.json();

    if (result.success) {
      return { ok: true };
    }

    const codes = Array.isArray(result["error-codes"])
      ? result["error-codes"].join(",")
      : "verification_failed";

    return { error: codes, ok: false };
  } catch (err) {
    console.error("[contact] Turnstile verification error:", err);
    return { error: "verification_error", ok: false };
  }
}

export function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
