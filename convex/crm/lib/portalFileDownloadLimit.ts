import { ConvexError } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";

interface PortalFileAccess {
  authUserId?: string;
}

export function portalFileRateLimitedError(retryAfterSeconds: number | null) {
  return new ConvexError({
    code: "PORTAL_FILE_RATE_LIMITED",
    retryAfterSeconds: retryAfterSeconds ?? 1,
  });
}

export async function enforcePortalFileDownloadLimit(
  ctx: ActionCtx,
  access: PortalFileAccess | null | undefined
) {
  const authUserId = String(access?.authUserId ?? "").trim();
  if (!authUserId) {
    throw new ConvexError("FORBIDDEN");
  }

  const result: { allowed: boolean; retryAfterSeconds: number | null } = await ctx.runMutation(
    internal.crm.rateLimitMaintenance.consumePortalFileDownload,
    { authUserId }
  );
  if (!result.allowed) {
    throw portalFileRateLimitedError(result.retryAfterSeconds);
  }
}
