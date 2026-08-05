import { query } from "./_generated/server";
import { stableProfileTimestamps } from "./lib/profileFallback";
import { nullablePublicUserProfileValidator } from "./publicReturnContracts";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();

    const timestamps = stableProfileTimestamps(profile, identity);

    return {
      createdAt: timestamps.createdAt,
      email: profile?.email ?? identity.email ?? "",
      hasPassportDetails: Boolean(profile?.passportDetailsEncrypted),
      id: identity.subject,
      image: profile?.image ?? (typeof identity.picture === "string" ? identity.picture : null),
      name: profile?.name ?? identity.name ?? "Traveler",
      phoneNumber: profile?.phoneNumber ?? "",
      updatedAt: timestamps.updatedAt,
    };
  },
  returns: nullablePublicUserProfileValidator,
});
