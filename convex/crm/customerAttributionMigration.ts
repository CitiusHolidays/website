import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { scheduleCrmMetricSync } from "./financeMetricSync";

const PAGE_SIZE = 100;
const stageValidator = v.union(
  v.literal("clients"),
  v.literal("intents"),
  v.literal("queries"),
  v.literal("offers")
);

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

function tableForStage(stage: "clients" | "intents" | "offers" | "queries") {
  switch (stage) {
    case "intents":
      return "inboundQueryIntents";
    case "offers":
      return "confirmedOffers";
    default:
      return stage;
  }
}

type AttributionStage = "clients" | "intents" | "offers" | "queries";
type AttributionRowByStage = {
  clients: Doc<"clients">;
  intents: Doc<"inboundQueryIntents">;
  offers: Doc<"confirmedOffers">;
  queries: Doc<"queries">;
};

function rowForAttributionStage<Stage extends AttributionStage>(
  _stage: Stage,
  row: Doc<"clients"> | Doc<"confirmedOffers"> | Doc<"inboundQueryIntents"> | Doc<"queries">
): AttributionRowByStage[Stage] {
  // SAFETY: The row comes from tableForStage using the same stage discriminant immediately above.
  return row as AttributionRowByStage[Stage];
}

export const backfillCustomerAttribution = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    dryRun: v.boolean(),
    stage: stageValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(tableForStage(args.stage))
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: PAGE_SIZE });
    const changes = await Promise.all(
      page.page.map(async (row) => {
        if (args.stage === "clients") {
          const client = rowForAttributionStage(args.stage, row);
          const emailNormalized = normalizeEmail(client.email);
          if (emailNormalized && emailNormalized !== client.emailNormalized) {
            if (!args.dryRun) {
              const clientId = ctx.db.normalizeId("clients", String(client._id));
              if (!clientId) {
                throw new Error("Invalid client row in attribution migration");
              }
              await ctx.db.patch("clients", clientId, { emailNormalized });
            }
            return 1;
          }
        } else if (args.stage === "intents") {
          const intent = rowForAttributionStage(args.stage, row);
          const contactEmailNormalized = normalizeEmail(intent.contactEmail);
          if (contactEmailNormalized && contactEmailNormalized !== intent.contactEmailNormalized) {
            if (!args.dryRun) {
              const intentId = ctx.db.normalizeId("inboundQueryIntents", String(intent._id));
              if (!intentId) {
                throw new Error("Invalid inbound intent row in attribution migration");
              }
              await ctx.db.patch("inboundQueryIntents", intentId, { contactEmailNormalized });
            }
            return 1;
          }
        } else if (args.stage === "queries") {
          const queryRow = rowForAttributionStage(args.stage, row);
          const intentId = queryRow.inboundIntentId
            ? ctx.db.normalizeId("inboundQueryIntents", queryRow.inboundIntentId)
            : null;
          const intent = intentId ? await ctx.db.get("inboundQueryIntents", intentId) : null;
          if (
            intent &&
            (queryRow.source !== intent.source || queryRow.sourceConsentAt !== intent.consentAt)
          ) {
            if (!args.dryRun) {
              const queryId = ctx.db.normalizeId("queries", String(queryRow._id));
              if (!queryId) {
                throw new Error("Invalid query row in attribution migration");
              }
              await ctx.db.patch("queries", queryId, {
                source: intent.source,
                sourceConsentAt: intent.consentAt,
              });
              await scheduleCrmMetricSync(ctx, "queries", String(queryId));
            }
            return 1;
          }
        } else {
          const offer = rowForAttributionStage(args.stage, row);
          const queryId = ctx.db.normalizeId("queries", offer.queryId);
          const queryRow = queryId ? await ctx.db.get("queries", queryId) : null;
          if (
            queryRow &&
            (offer.source !== queryRow.source ||
              offer.sourceConsentAt !== queryRow.sourceConsentAt ||
              offer.sourceInboundIntentId !== queryRow.inboundIntentId)
          ) {
            if (!args.dryRun) {
              const offerId = ctx.db.normalizeId("confirmedOffers", String(offer._id));
              if (!offerId) {
                throw new Error("Invalid confirmed offer row in attribution migration");
              }
              await ctx.db.patch("confirmedOffers", offerId, {
                source: queryRow.source,
                sourceConsentAt: queryRow.sourceConsentAt,
                sourceInboundIntentId: queryRow.inboundIntentId,
              });
            }
            return 1;
          }
        }
        return 0;
      })
    );
    const changed = changes.reduce<number>((total, value) => total + value, 0);
    return {
      changed,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
      stage: args.stage,
    };
  },
  returns: v.object({
    changed: v.number(),
    continueCursor: v.string(),
    isDone: v.boolean(),
    scanned: v.number(),
    stage: stageValidator,
  }),
});
