import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
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
interface AttributionRowByStage {
  clients: Doc<"clients">;
  intents: Doc<"inboundQueryIntents">;
  offers: Doc<"confirmedOffers">;
  queries: Doc<"queries">;
}

function rowForAttributionStage<Stage extends AttributionStage>(
  _stage: Stage,
  row: Doc<"clients"> | Doc<"confirmedOffers"> | Doc<"inboundQueryIntents"> | Doc<"queries">
): AttributionRowByStage[Stage] {
  // SAFETY: The row comes from tableForStage using the same stage discriminant immediately above.
  return row as AttributionRowByStage[Stage];
}

async function backfillClient(ctx: MutationCtx, client: Doc<"clients">, dryRun: boolean) {
  const emailNormalized = normalizeEmail(client.email);
  if (!(emailNormalized && emailNormalized !== client.emailNormalized)) {
    return 0;
  }
  if (!dryRun) {
    await ctx.db.patch("clients", client._id, { emailNormalized });
  }
  return 1;
}

async function backfillIntent(
  ctx: MutationCtx,
  intent: Doc<"inboundQueryIntents">,
  dryRun: boolean
) {
  const contactEmailNormalized = normalizeEmail(intent.contactEmail);
  if (!(contactEmailNormalized && contactEmailNormalized !== intent.contactEmailNormalized)) {
    return 0;
  }
  if (!dryRun) {
    await ctx.db.patch("inboundQueryIntents", intent._id, { contactEmailNormalized });
  }
  return 1;
}

async function backfillQuery(ctx: MutationCtx, queryRow: Doc<"queries">, dryRun: boolean) {
  const intentId = queryRow.inboundIntentId
    ? ctx.db.normalizeId("inboundQueryIntents", queryRow.inboundIntentId)
    : null;
  const intent = intentId ? await ctx.db.get("inboundQueryIntents", intentId) : null;
  if (
    !intent ||
    (queryRow.source === intent.source && queryRow.sourceConsentAt === intent.consentAt)
  ) {
    return 0;
  }
  if (!dryRun) {
    await ctx.db.patch("queries", queryRow._id, {
      source: intent.source,
      sourceConsentAt: intent.consentAt,
    });
    await scheduleCrmMetricSync(ctx, "queries", String(queryRow._id));
  }
  return 1;
}

async function backfillOffer(ctx: MutationCtx, offer: Doc<"confirmedOffers">, dryRun: boolean) {
  const queryId = ctx.db.normalizeId("queries", offer.queryId);
  const queryRow = queryId ? await ctx.db.get("queries", queryId) : null;
  if (
    !queryRow ||
    (offer.source === queryRow.source &&
      offer.sourceConsentAt === queryRow.sourceConsentAt &&
      offer.sourceInboundIntentId === queryRow.inboundIntentId)
  ) {
    return 0;
  }
  if (!dryRun) {
    await ctx.db.patch("confirmedOffers", offer._id, {
      source: queryRow.source,
      sourceConsentAt: queryRow.sourceConsentAt,
      sourceInboundIntentId: queryRow.inboundIntentId,
    });
  }
  return 1;
}

function backfillAttributionRow(
  ctx: MutationCtx,
  stage: AttributionStage,
  row: Doc<"clients"> | Doc<"confirmedOffers"> | Doc<"inboundQueryIntents"> | Doc<"queries">,
  dryRun: boolean
) {
  switch (stage) {
    case "clients":
      return backfillClient(ctx, rowForAttributionStage(stage, row), dryRun);
    case "intents":
      return backfillIntent(ctx, rowForAttributionStage(stage, row), dryRun);
    case "queries":
      return backfillQuery(ctx, rowForAttributionStage(stage, row), dryRun);
    case "offers":
      return backfillOffer(ctx, rowForAttributionStage(stage, row), dryRun);
    default:
      return assertNever(stage);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported attribution stage: ${String(value)}`);
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
      page.page.map((row) => backfillAttributionRow(ctx, args.stage, row, args.dryRun))
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
