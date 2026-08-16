import { query } from "./_generated/server";
import { authorizedCustomerIdentityIds, publicAccountId } from "./lib/customerIdentityAccess";
import { stableProfileTimestamps } from "./lib/profileFallback";
import { isRuntimeString } from "./lib/runtimeValues";
import { nullablePublicUserProfileValidator } from "./publicReturnContracts";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
    const profiles = await Promise.all(
      identityIds.map((authUserId) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
          .unique()
      )
    );
    const profile = profiles.find(Boolean) ?? null;

    const timestamps = stableProfileTimestamps(profile, identity);

    return {
      createdAt: timestamps.createdAt,
      email: profile?.email ?? identity.email ?? "",
      hasPassportDetails: Boolean(profile?.passportDetailsEncrypted),
      id: await publicAccountId(identity, profile?._id),
      image: profile?.image ?? (isRuntimeString(identity.picture) ? identity.picture : null),
      name: profile?.name ?? identity.name ?? "Traveler",
      phoneNumber: profile?.phoneNumber ?? "",
      updatedAt: timestamps.updatedAt,
    };
  },
  returns: nullablePublicUserProfileValidator,
});
