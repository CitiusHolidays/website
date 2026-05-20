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
      console.warn(
        "[contact] TURNSTILE_SECRET_KEY is not set; CAPTCHA verification skipped."
      );
    }
    return { ok: true };
  }

  if (!token || typeof token !== "string") {
    return { ok: false, error: "missing_token" };
  }

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteip && remoteip !== "unknown") {
      body.set("remoteip", remoteip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );

    const result = await response.json();

    if (result.success) {
      return { ok: true };
    }

    const codes = Array.isArray(result["error-codes"])
      ? result["error-codes"].join(",")
      : "verification_failed";

    return { ok: false, error: codes };
  } catch (err) {
    console.error("[contact] Turnstile verification error:", err);
    return { ok: false, error: "verification_error" };
  }
}

export function isTurnstileConfigured() {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}
