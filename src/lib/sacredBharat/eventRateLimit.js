const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 120;

/** @type {Map<string, { count: number; resetAt: number }>} */
const buckets = new Map();

export function checkSacredBharatEventRateLimit(key) {
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
    for (const [bucketKey, value] of buckets) {
      if (now > value.resetAt) {
        buckets.delete(bucketKey);
      }
    }
  }
  return { allowed: true };
}
