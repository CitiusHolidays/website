import { v } from "convex/values";
import { query } from "../_generated/server";
import { assertE2eSecret } from "./lib/e2eAuth";

export function hasTravellerNamed(travellers: Array<{ fullName: string }>, fullName: string) {
  return travellers.some((row) => row.fullName === fullName);
}

export const travellerExists = query({
  args: {
    fullName: v.string(),
    jobCardId: v.optional(v.id("jobCards")),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertE2eSecret(args.secret);

    if (args.jobCardId) {
      const travellers = await ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", args.jobCardId!))
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
