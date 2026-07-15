import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../crm/lib/staffAccess";

export type AuthSyncInput = {
  authUserId: string;
  email: string;
  name?: string;
  image?: string;
};

const getIdentityImage = (image?: string) => (typeof image === "string" ? image : "");

async function findStaffByEmail(ctx: MutationCtx, emailNormalized: string) {
  return await ctx.db
    .query("staffUsers")
    .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
    .unique();
}

async function findProfileByAuthUserId(ctx: MutationCtx, authUserId: string) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

async function findProfilesByEmail(ctx: MutationCtx, emailNormalized: string) {
  const profiles = await ctx.db.query("userProfiles").collect();
  return profiles.filter((profile) => normalizeEmail(profile.email) === emailNormalized);
}

function pickProfileName(preferred: string | undefined, existing: Doc<"userProfiles"> | undefined) {
  const trimmed = preferred?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (existing?.name && existing.name !== "Traveler") {
    return existing.name;
  }
  return "Traveler";
}

export async function syncAuthRecords(ctx: MutationCtx, input: AuthSyncInput) {
  const authUserId = input.authUserId.trim();
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  const now = Date.now();

  if (!authUserId) {
    return { linkedStaff: false, profileId: null as Doc<"userProfiles">["_id"] | null };
  }

  let linkedStaff = false;
  if (emailNormalized) {
    const staff = await findStaffByEmail(ctx, emailNormalized);
    if (staff && staff.authUserId !== authUserId) {
      await ctx.db.patch(staff._id, {
        authUserId,
        updatedAt: now,
      });
      linkedStaff = true;
    }
  }

  const profileByAuth = await findProfileByAuthUserId(ctx, authUserId);
  const matchingProfiles = emailNormalized ? await findProfilesByEmail(ctx, emailNormalized) : [];
  const orphanedProfile = matchingProfiles.find((profile) => profile.authUserId !== authUserId);

  if (profileByAuth) {
    const patch: Partial<Doc<"userProfiles">> = { updatedAt: now };
    if (email && normalizeEmail(profileByAuth.email) !== emailNormalized) {
      patch.email = email;
    }
    const nextName = pickProfileName(input.name, profileByAuth);
    if (nextName !== profileByAuth.name) {
      patch.name = nextName;
    }
    const nextImage = getIdentityImage(input.image);
    if (nextImage && !profileByAuth.image) {
      patch.image = nextImage;
    }
    if (Object.keys(patch).length > 1) {
      await ctx.db.patch(profileByAuth._id, patch);
    }

    await Promise.all(
      matchingProfiles.flatMap((duplicate) =>
        duplicate._id === profileByAuth._id ? [] : [ctx.db.delete(duplicate._id)]
      )
    );

    return { linkedStaff, profileId: profileByAuth._id };
  }

  if (orphanedProfile) {
    await ctx.db.patch(orphanedProfile._id, {
      authUserId,
      email: email || orphanedProfile.email,
      image: getIdentityImage(input.image) || orphanedProfile.image || "",
      name: pickProfileName(input.name, orphanedProfile),
      updatedAt: now,
    });

    await Promise.all(
      matchingProfiles.flatMap((duplicate) =>
        duplicate._id === orphanedProfile._id ? [] : [ctx.db.delete(duplicate._id)]
      )
    );

    return { linkedStaff, profileId: orphanedProfile._id };
  }

  if (!email) {
    return { linkedStaff, profileId: null };
  }

  const profileId = await ctx.db.insert("userProfiles", {
    authUserId,
    createdAt: now,
    email,
    image: getIdentityImage(input.image),
    name: pickProfileName(input.name, undefined),
    passportDetailsEncrypted: "",
    phoneNumber: "",
    updatedAt: now,
  });

  return { linkedStaff, profileId };
}
