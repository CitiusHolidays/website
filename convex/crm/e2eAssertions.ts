import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export function hasTravellerNamed(travellers: Array<{ fullName: string }>, fullName: string) {
  return travellers.some((row) => row.fullName === fullName);
}

// This is intentionally internal. The E2E harness uses a developer-authenticated
// Convex inline query instead of exposing a public traveller-existence oracle.
export const travellerExists = internalQuery({
  args: {
    fullName: v.string(),
    jobCardId: v.optional(v.id("jobCards")),
  },
  handler: async (ctx, args) => {
    const { jobCardId } = args;
    if (jobCardId) {
      const travellers = await ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect();
      return hasTravellerNamed(travellers, args.fullName);
    }

    const travellers = await ctx.db
      .query("travellers")
      .withSearchIndex("search_list", (q) => q.search("listSearchText", args.fullName))
      .take(20);
    return hasTravellerNamed(travellers, args.fullName);
  },
  returns: v.boolean(),
});
