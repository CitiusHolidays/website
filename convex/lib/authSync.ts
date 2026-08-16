import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { normalizeEmail } from "../crm/lib/staffAccess";
import { isRuntimeBoolean, isRuntimeString } from "./runtimeValues";
import { refreshExistingSacredBharatLeaderboardSummaries } from "./sacredBharatLeaderboard";

export interface AuthSyncInput {
  authUserId: string;
  email: string;
  image?: string;
  legacyAuthUserId?: string;
  name?: string;
}

const getIdentityImage = (image?: string) => (isRuntimeString(image) ? image : "");

async function findProfilesByAuthUserId(ctx: MutationCtx, authUserId: string) {
  const profiles = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();
  return profiles.filter((profile) => !profile.archivedAt).sort(compareProfiles);
}

async function findProfilesByEmail(ctx: MutationCtx, emailNormalized: string) {
  const [indexedProfiles, legacyProfiles] = await Promise.all([
    ctx.db
      .query("userProfiles")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", emailNormalized))
      .collect(),
    ctx.db
      .query("userProfiles")
      .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", undefined))
      .collect(),
  ]);
  const matchingLegacyProfiles: Doc<"userProfiles">[] = [];
  const normalizationPatches: Promise<void>[] = [];
  for (const profile of legacyProfiles) {
    if (normalizeEmail(profile.email) !== emailNormalized) {
      continue;
    }
    matchingLegacyProfiles.push(profile);
    if (!profile.archivedAt) {
      normalizationPatches.push(ctx.db.patch("userProfiles", profile._id, { emailNormalized }));
    }
  }
  await Promise.all(normalizationPatches);
  return [...indexedProfiles, ...matchingLegacyProfiles];
}

function compareProfiles(left: Doc<"userProfiles">, right: Doc<"userProfiles">) {
  return left.createdAt - right.createdAt || String(left._id).localeCompare(String(right._id));
}

function dedupeProfiles(profiles: Doc<"userProfiles">[]) {
  return [...new Map(profiles.map((profile) => [String(profile._id), profile])).values()];
}

function firstNonEmpty(
  profiles: Doc<"userProfiles">[],
  field: "image" | "legacyUserId" | "passportDetailsEncrypted" | "phoneNumber"
) {
  return profiles.map((profile) => profile[field]).find((value) => Boolean(value?.trim())) ?? "";
}

function firstPreference(profiles: Doc<"userProfiles">[]) {
  return profiles.find((profile) => profile.sacredBharatLeaderboardOptOut !== undefined)
    ?.sacredBharatLeaderboardOptOut;
}

function mergedProfilePatch(
  canonical: Doc<"userProfiles">,
  profiles: Doc<"userProfiles">[],
  input: AuthSyncInput,
  now: number
): Partial<Doc<"userProfiles">> {
  const ordered = [...profiles].sort(compareProfiles);
  const existingName = ordered.find((profile) => profile.name && profile.name !== "Traveler")?.name;
  return {
    image: getIdentityImage(input.image) || canonical.image || firstNonEmpty(ordered, "image"),
    legacyUserId: canonical.legacyUserId || firstNonEmpty(ordered, "legacyUserId") || undefined,
    name: pickProfileName(input.name, {
      ...canonical,
      name: canonical.name === "Traveler" && existingName ? existingName : canonical.name,
    }),
    passportDetailsEncrypted:
      canonical.passportDetailsEncrypted || firstNonEmpty(ordered, "passportDetailsEncrypted"),
    phoneNumber: canonical.phoneNumber || firstNonEmpty(ordered, "phoneNumber"),
    sacredBharatLeaderboardOptOut:
      canonical.sacredBharatLeaderboardOptOut ?? firstPreference(ordered),
    updatedAt: now,
  };
}

const DURABLE_CONFLICT_FIELDS = [
  "legacyUserId",
  "passportDetailsEncrypted",
  "phoneNumber",
  "sacredBharatLeaderboardOptOut",
] as const;

function conflictFields(duplicate: Doc<"userProfiles">, merged: Partial<Doc<"userProfiles">>) {
  return DURABLE_CONFLICT_FIELDS.filter((field) => {
    const duplicateValue = duplicate[field];
    const mergedValue = merged[field];
    const duplicateHasValue = isRuntimeBoolean(duplicateValue)
      ? true
      : Boolean(duplicateValue?.trim());
    return duplicateHasValue && mergedValue !== undefined && duplicateValue !== mergedValue;
  });
}

async function retireMergedProfiles(
  ctx: MutationCtx,
  canonical: Doc<"userProfiles">,
  profiles: Doc<"userProfiles">[],
  merged: Partial<Doc<"userProfiles">>,
  now: number
) {
  await ctx.db.patch("userProfiles", canonical._id, merged);
  const duplicates = profiles
    .filter((profile) => profile._id !== canonical._id)
    .sort(compareProfiles);
  await Promise.all(
    duplicates.map((duplicate) => {
      const conflicts = conflictFields(duplicate, merged);
      if (conflicts.length > 0) {
        return ctx.db.patch("userProfiles", duplicate._id, {
          archivedAt: now,
          archivedAuthUserId: duplicate.authUserId ?? duplicate.archivedAuthUserId,
          authUserId: undefined,
          mergeConflictFields: conflicts,
          mergedIntoProfileId: canonical._id,
          updatedAt: now,
        });
      }
      return ctx.db.delete("userProfiles", duplicate._id);
    })
  );
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
    return { linkedStaff: false, profileId: null };
  }

  const [profilesByAuth, profilesByEmail] = await Promise.all([
    findProfilesByAuthUserId(ctx, authUserId),
    emailNormalized ? findProfilesByEmail(ctx, emailNormalized) : Promise.resolve([]),
  ]);
  const profileByAuth = profilesByAuth[0] ?? null;
  const matchingProfiles = profilesByEmail.filter((profile) => !profile.archivedAt);
  const retiredIdentity = profilesByEmail.find(
    (profile) => profile.archivedAt && profile.archivedAuthUserId === authUserId
  );
  if (!profileByAuth && retiredIdentity) {
    throw new ConvexError("PROFILE_IDENTITY_CONFLICT");
  }
  const adoptableProfiles = matchingProfiles.filter(
    (profile) =>
      !profile.authUserId ||
      profile.authUserId === authUserId ||
      (input.legacyAuthUserId && profile.authUserId === input.legacyAuthUserId)
  );
  const [orphanedProfile] = adoptableProfiles.sort(compareProfiles);

  if (profileByAuth) {
    const mergeCandidates = dedupeProfiles([
      profileByAuth,
      ...profilesByAuth,
      ...adoptableProfiles,
    ]);
    const patch: Partial<Doc<"userProfiles">> = mergedProfilePatch(
      profileByAuth,
      mergeCandidates,
      input,
      now
    );
    if (email && normalizeEmail(profileByAuth.email) !== emailNormalized) {
      patch.email = email;
    }
    if (emailNormalized && profileByAuth.emailNormalized !== emailNormalized) {
      patch.emailNormalized = emailNormalized;
    }
    await retireMergedProfiles(ctx, profileByAuth, mergeCandidates, patch, now);
    await refreshExistingSacredBharatLeaderboardSummaries(
      ctx,
      [authUserId, input.legacyAuthUserId],
      now
    );

    return { linkedStaff: false, profileId: profileByAuth._id };
  }

  if (orphanedProfile) {
    const patch: Partial<Doc<"userProfiles">> = {
      ...mergedProfilePatch(orphanedProfile, adoptableProfiles, input, now),
      authUserId,
      email: email || orphanedProfile.email,
      emailNormalized,
    };
    await retireMergedProfiles(ctx, orphanedProfile, adoptableProfiles, patch, now);
    await refreshExistingSacredBharatLeaderboardSummaries(
      ctx,
      [authUserId, input.legacyAuthUserId, orphanedProfile.authUserId],
      now
    );

    return { linkedStaff: false, profileId: orphanedProfile._id };
  }

  if (!email) {
    return { linkedStaff: false, profileId: null };
  }

  const profileId = await ctx.db.insert("userProfiles", {
    authUserId,
    createdAt: now,
    email,
    emailNormalized,
    image: getIdentityImage(input.image),
    name: pickProfileName(input.name, undefined),
    passportDetailsEncrypted: "",
    phoneNumber: "",
    updatedAt: now,
  });

  return { linkedStaff: false, profileId };
}
