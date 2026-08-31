import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { CommercialFileSourceType } from "./commercialFilePolicy";

export const COMMERCIAL_SOURCE_DELETION_BLOCKED_MESSAGE =
  "This record still owns Commercial Files. Delete them in Commercial Files, then retry after the 14-day recovery window ends.";

function blockSourceDeletion(): never {
  throw new ConvexError(COMMERCIAL_SOURCE_DELETION_BLOCKED_MESSAGE);
}

export async function assertCommercialSourceHasNoFileCustody(
  ctx: Pick<MutationCtx, "db">,
  sourceType: CommercialFileSourceType,
  sourceId: string
) {
  const registry = await ctx.db
    .query("commercialFiles")
    .withIndex("by_source", (queryBuilder) =>
      queryBuilder.eq("sourceType", sourceType).eq("sourceId", sourceId)
    )
    .first();
  if (registry) {
    blockSourceDeletion();
  }

  if (sourceType === "query") {
    const queryId = ctx.db.normalizeId("queries", sourceId);
    const legacy = queryId
      ? await ctx.db
          .query("queryAttachments")
          .withIndex("by_queryId", (queryBuilder) => queryBuilder.eq("queryId", queryId))
          .first()
      : null;
    if (legacy) {
      blockSourceDeletion();
    }
  }

  if (sourceType === "proposal") {
    const proposalId = ctx.db.normalizeId("proposals", sourceId);
    const [legacy, proposal] = proposalId
      ? await Promise.all([
          ctx.db
            .query("proposalAttachments")
            .withIndex("by_proposalId", (queryBuilder) => queryBuilder.eq("proposalId", proposalId))
            .first(),
          ctx.db.get("proposals", proposalId),
        ])
      : [null, null];
    if (legacy || proposal?.finalizedPdfStorageId) {
      blockSourceDeletion();
    }
  }
}
