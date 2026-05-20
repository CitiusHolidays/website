const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

/** @type {Map<string, { count: number; resetAt: number }>} */
const buckets = new Map();

/**
 * Simple per-IP rate limiter (best-effort on serverless; pairs with Turnstile).
 *
 * @param {string} key
 * @returns {{ allowed: true } | { allowed: false; retryAfterSec: number }}
 */
export function checkContactRateLimit(key) {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (now > b.resetAt) {
        buckets.delete(k);
      }
    }
  }

  return { allowed: true };
}
