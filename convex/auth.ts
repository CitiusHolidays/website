import { query } from "./_generated/server";

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

    const nowIso = new Date().toISOString();
    const createdAtIso = profile?.createdAt
      ? new Date(profile.createdAt).toISOString()
      : nowIso;
    const updatedAtIso = profile?.updatedAt
      ? new Date(profile.updatedAt).toISOString()
      : nowIso;

    return {
      id: identity.subject,
      email: profile?.email ?? identity.email ?? "",
      name: profile?.name ?? identity.name ?? "Traveler",
      phoneNumber: profile?.phoneNumber ?? "",
      image: profile?.image ?? identity.picture ?? null,
      passportDetailsEncrypted: profile?.passportDetailsEncrypted ?? null,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
    };
  },
});
