import { NextResponse } from "next/server";
import { fetchAuthAction, getServerUser, getToken } from "@/lib/auth-server";
import { portalFileErrorResponse, portalFileResponse } from "@/lib/portal/file-response";

/**
 * File downloads return the complete bytes in one authenticated action. Keep
 * accidental retries (and a compromised staff session) from turning that
 * endpoint into an unbounded storage egress path.
 *
 * This is deliberately a small, process-local guard. Convex actions still
 * enforce the record-level permission checks; a distributed limit should be
 * added at the edge when the deployment has a shared rate-limit service.
 */
export const PORTAL_FILE_DOWNLOAD_LIMIT = 30;
export const PORTAL_FILE_DOWNLOAD_WINDOW_MS = 60_000;

const downloadWindows = new Map();

function pruneExpiredWindows(now) {
  for (const [key, window] of downloadWindows) {
    if (now - window.startedAt >= PORTAL_FILE_DOWNLOAD_WINDOW_MS) {
      downloadWindows.delete(key);
    }
  }
}

/**
 * Consume one download slot for a stable authenticated identity.
 *
 * Exported separately so the policy can be tested without importing a route
 * (and without making a real auth or storage request).
 */
export function consumePortalFileDownload(userId, now = Date.now()) {
  const key = String(userId || "").trim();
  if (!key) {
    return {
      allowed: true,
      remaining: null,
      retryAfterSeconds: null,
    };
  }

  pruneExpiredWindows(now);
  const existing = downloadWindows.get(key);
  if (!existing || now - existing.startedAt >= PORTAL_FILE_DOWNLOAD_WINDOW_MS) {
    downloadWindows.set(key, { count: 1, startedAt: now });
    return {
      allowed: true,
      remaining: PORTAL_FILE_DOWNLOAD_LIMIT - 1,
      retryAfterSeconds: null,
    };
  }

  if (existing.count >= PORTAL_FILE_DOWNLOAD_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.startedAt + PORTAL_FILE_DOWNLOAD_WINDOW_MS - now) / 1000)
      ),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: PORTAL_FILE_DOWNLOAD_LIMIT - existing.count,
    retryAfterSeconds: null,
  };
}

function rateLimitResponse(rateLimit) {
  return NextResponse.json(
    { error: "Too many file downloads. Please wait a minute and try again." },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Retry-After": String(rateLimit.retryAfterSeconds),
        "X-RateLimit-Limit": String(PORTAL_FILE_DOWNLOAD_LIMIT),
        "X-RateLimit-Remaining": "0",
      },
      status: 429,
    }
  );
}

/**
 * Shared route handler for portal file downloads.
 *
 * Passing the request token through avoids performing token exchange twice.
 * `getServerUser` is only used to identify an authenticated principal for the
 * limiter; the Convex action remains the source of truth for file access.
 */
export async function downloadPortalFile({ action, args }) {
  let token;
  let user = null;
  try {
    token = await getToken();
    if (token) {
      user = await getServerUser({ token });
    }
  } catch {
    // Let the authenticated Convex action produce the canonical auth error.
    // A transient identity lookup must not turn a valid action into a bypass
    // of its record-level permission checks.
    user = null;
  }

  const userId = user?.id ?? user?.email ?? null;
  if (userId) {
    const rateLimit = consumePortalFileDownload(userId);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }
  }

  try {
    const file = await fetchAuthAction(action, args, { token });
    return portalFileResponse(file);
  } catch (error) {
    return portalFileErrorResponse(error);
  }
}
