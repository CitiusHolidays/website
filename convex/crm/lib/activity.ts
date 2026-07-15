import type { MutationCtx } from "../../_generated/server";
import type { PortalAccess } from "./staffAccess";

export async function createActivity(
  ctx: MutationCtx,
  access: PortalAccess,
  input: {
    entityType: string;
    entityId?: string;
    action: string;
    message: string;
    metadata?: unknown;
  }
) {
  await ctx.db.insert("activityLogs", {
    action: input.action,
    actorId: access.authUserId ?? "system",
    actorName: access.name || access.email || "System",
    createdAt: Date.now(),
    entityId: input.entityId,
    entityType: input.entityType,
    message: input.message,
    metadata: input.metadata ?? null,
  });
}
