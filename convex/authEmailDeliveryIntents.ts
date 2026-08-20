import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const SHA_256_PATTERN = /^[0-9a-f]{64}$/;
const purposeValidator = v.union(v.literal("password_reset"), v.literal("verification"));

function assertDigest(value: string) {
  if (!SHA_256_PATTERN.test(value)) {
    throw new ConvexError("AUTH_EMAIL_INTENT_DIGEST_INVALID");
  }
}

export const prepare = internalMutation({
  args: {
    controlKey: v.literal("email.auth.staff_setup"),
    correlationDigest: v.string(),
    expiresAt: v.number(),
    purpose: purposeValidator,
    recipientDigest: v.string(),
  },
  handler: async (ctx, args) => {
    assertDigest(args.correlationDigest);
    assertDigest(args.recipientDigest);
    if (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= Date.now()) {
      throw new ConvexError("AUTH_EMAIL_INTENT_EXPIRY_INVALID");
    }
    const existing = await ctx.db
      .query("authEmailDeliveryIntents")
      .withIndex("by_correlationDigest", (index) =>
        index.eq("correlationDigest", args.correlationDigest)
      )
      .unique();
    if (existing) {
      if (
        existing.controlKey !== args.controlKey ||
        existing.expiresAt !== args.expiresAt ||
        existing.purpose !== args.purpose ||
        existing.recipientDigest !== args.recipientDigest
      ) {
        throw new ConvexError("AUTH_EMAIL_INTENT_CONFLICT");
      }
      return { prepared: false };
    }
    await ctx.db.insert("authEmailDeliveryIntents", { ...args, createdAt: Date.now() });
    return { prepared: true };
  },
  returns: v.object({ prepared: v.boolean() }),
});

export const resolve = internalQuery({
  args: {
    at: v.number(),
    correlationDigest: v.string(),
    purpose: purposeValidator,
    recipientDigest: v.string(),
  },
  handler: async (ctx, args) => {
    const digestsAreValid =
      SHA_256_PATTERN.test(args.correlationDigest) && SHA_256_PATTERN.test(args.recipientDigest);
    if (!digestsAreValid) {
      return null;
    }
    const intent = await ctx.db
      .query("authEmailDeliveryIntents")
      .withIndex("by_correlationDigest", (index) =>
        index.eq("correlationDigest", args.correlationDigest)
      )
      .unique();
    return intent &&
      intent.expiresAt > args.at &&
      intent.purpose === args.purpose &&
      intent.recipientDigest === args.recipientDigest
      ? intent.controlKey
      : null;
  },
  returns: v.union(v.null(), v.literal("email.auth.staff_setup")),
});
