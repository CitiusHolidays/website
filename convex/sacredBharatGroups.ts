import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
} from "./lib/customerIdentityAccess";
import {
  groupCountProjectionIsVerified,
  MAX_SACRED_BHARAT_GROUP_MEMBERS,
  readBoundedGroupMemberCount,
  verifiedGroupMemberCount,
} from "./lib/sacredBharatGroups";
import {
  consumeInviteAttempt,
  isStrongInviteCode,
  makeInviteCode,
  normalizeInviteCode,
} from "./lib/sacredBharatInvites";
import { computeProgressSummary } from "./lib/sacredBharatScoring";

const now = () => Date.now();

async function getIdentityOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
}

async function readIdentityIds(ctx: QueryCtx | MutationCtx, identity: UserIdentity) {
  return await authorizedCustomerIdentityIds(ctx, identity);
}

async function mutationIdentity(ctx: MutationCtx, identity: UserIdentity) {
  const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
  return { authUserId, identityIds: await authorizedCustomerIdentityIds(ctx, identity) };
}

async function buildGroupMemberSummary(ctx: QueryCtx, authUserId: string) {
  const materialized = await ctx.db
    .query("sacredBharatLeaderboardSummaries")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (materialized) {
    return {
      authUserId,
      badges: [],
      displayName: materialized.displayName,
      levelTitle: materialized.levelTitle,
      score: materialized.score,
      slug: materialized.passportSlug,
      templeCount: materialized.templeCount,
    };
  }
  const [passport, profile, visits] = await Promise.all([
    ctx.db
      .query("sacredBharatProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique(),
    ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique(),
    ctx.db
      .query("sacredBharatVisits")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .collect(),
  ]);
  const progress = computeProgressSummary(visits.map((visit) => visit.templeId));
  return {
    authUserId,
    badges: [],
    displayName: passport?.displayName || profile?.name || "Sacred Yatri",
    levelTitle: progress.levelTitle,
    score: progress.score,
    slug: passport?.isPublic ? passport.slug : null,
    templeCount: progress.templeCount,
  };
}

async function consumeGroupInviteAttempt(ctx: MutationCtx, authUserId: string, at: number) {
  const existing = await ctx.db
    .query("sacredBharatInviteAttempts")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  const result = consumeInviteAttempt(
    existing
      ? { attemptCount: existing.attemptCount, windowStartedAt: existing.windowStartedAt }
      : null,
    at
  );
  const nextRow = {
    attemptCount: result.nextState.attemptCount,
    authUserId,
    updatedAt: at,
    windowStartedAt: result.nextState.windowStartedAt,
  };
  if (existing) {
    await ctx.db.patch("sacredBharatInviteAttempts", existing._id, nextRow);
  } else {
    await ctx.db.insert("sacredBharatInviteAttempts", nextRow);
  }
  return result;
}

async function requireGroupMember(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"sacredBharatGroups">,
  authUserId: string
) {
  const membership = await ctx.db
    .query("sacredBharatGroupMembers")
    .withIndex("by_groupId_authUserId", (q) =>
      q.eq("groupId", groupId).eq("authUserId", authUserId)
    )
    .unique();
  if (!membership) {
    throw new ConvexError("FORBIDDEN");
  }
  return membership;
}

async function requireGroupMemberForIdentityIds(
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"sacredBharatGroups">,
  identityIds: string[]
) {
  const memberships = await Promise.all(
    identityIds.map(async (authUserId) => {
      try {
        return await requireGroupMember(ctx, groupId, authUserId);
      } catch (error) {
        if (error instanceof ConvexError && error.data === "FORBIDDEN") {
          return null;
        }
        throw error;
      }
    })
  );
  const membership = memberships.find((candidate) => candidate !== null);
  if (!membership) {
    throw new ConvexError("FORBIDDEN");
  }
  return membership;
}

async function makeAvailableInviteCode(
  ctx: MutationCtx,
  currentGroupId?: Doc<"sacredBharatGroups">["_id"],
  remainingChecks = 5
): Promise<string> {
  const inviteCode = makeInviteCode();
  const existing = await ctx.db
    .query("sacredBharatGroups")
    .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
    .first();
  if (!existing || existing._id === currentGroupId) {
    return inviteCode;
  }
  return remainingChecks <= 1
    ? makeInviteCode()
    : await makeAvailableInviteCode(ctx, currentGroupId, remainingChecks - 1);
}

export async function createGroupHandler(ctx: MutationCtx, args: { name: string }) {
  const identity = await getIdentityOrThrow(ctx);
  const { authUserId } = await mutationIdentity(ctx, identity);
  const timestamp = now();
  const inviteCode = await makeAvailableInviteCode(ctx);
  const groupId = await ctx.db.insert("sacredBharatGroups", {
    createdAt: timestamp,
    inviteCode,
    isArchived: false,
    memberCount: 1,
    name: args.name.trim() || "Sacred Bharat Group",
    ownerAuthUserId: authUserId,
    updatedAt: timestamp,
  });
  await ctx.db.insert("sacredBharatGroupMembers", {
    authUserId,
    groupId,
    joinedAt: timestamp,
    role: "owner",
  });
  return { id: groupId, inviteCode };
}

export async function rotateGroupInviteCodeHandler(ctx: MutationCtx, args: { groupId: string }) {
  const identity = await getIdentityOrThrow(ctx);
  const { identityIds } = await mutationIdentity(ctx, identity);
  const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
  if (!groupId) {
    throw new ConvexError("Invalid group id");
  }
  const group = await ctx.db.get("sacredBharatGroups", groupId);
  if (!group || group.isArchived) {
    throw new ConvexError("GROUP_NOT_FOUND");
  }
  const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
  if (membership.role !== "owner") {
    throw new ConvexError("FORBIDDEN");
  }
  const inviteCode = await makeAvailableInviteCode(ctx, groupId);
  await ctx.db.patch("sacredBharatGroups", groupId, { inviteCode, updatedAt: now() });
  return { id: groupId, inviteCode };
}

export async function joinGroupByInviteCodeHandler(ctx: MutationCtx, args: { inviteCode: string }) {
  const identity = await getIdentityOrThrow(ctx);
  const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
  const attemptRows = await Promise.all(
    identityIds.map((identityId) =>
      ctx.db
        .query("sacredBharatInviteAttempts")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", identityId))
        .unique()
    )
  );
  const [latestAttempt] = attemptRows
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const attempt = latestAttempt
    ? consumeInviteAttempt(
        {
          attemptCount: latestAttempt.attemptCount,
          windowStartedAt: latestAttempt.windowStartedAt,
        },
        now()
      )
    : await consumeGroupInviteAttempt(ctx, authUserId, now());
  if (latestAttempt) {
    const canonicalAttempt = attemptRows.find((row) => row?.authUserId === authUserId);
    const nextRow = {
      attemptCount: attempt.nextState.attemptCount,
      authUserId,
      updatedAt: now(),
      windowStartedAt: attempt.nextState.windowStartedAt,
    };
    if (canonicalAttempt) {
      await ctx.db.patch("sacredBharatInviteAttempts", canonicalAttempt._id, nextRow);
    } else {
      await ctx.db.insert("sacredBharatInviteAttempts", nextRow);
    }
  }
  if (!attempt.allowed) {
    return { rateLimited: true as const, retryAfterMs: attempt.retryAfterMs };
  }

  const group = await ctx.db
    .query("sacredBharatGroups")
    .withIndex("by_inviteCode", (q) => q.eq("inviteCode", normalizeInviteCode(args.inviteCode)))
    .unique();
  if (!group || group.isArchived) {
    return { notFound: true as const };
  }
  if (!isStrongInviteCode(group.inviteCode)) {
    throw new ConvexError("GROUP_INVITE_REQUIRES_ROTATION");
  }
  const existing = (
    await Promise.all(
      identityIds.map((identityId) =>
        ctx.db
          .query("sacredBharatGroupMembers")
          .withIndex("by_groupId_authUserId", (q) =>
            q.eq("groupId", group._id).eq("authUserId", identityId)
          )
          .unique()
      )
    )
  ).find(Boolean);
  if (!existing) {
    const memberCount = await readBoundedGroupMemberCount(ctx, group._id);
    if (memberCount >= MAX_SACRED_BHARAT_GROUP_MEMBERS) {
      return { full: true as const, memberLimit: MAX_SACRED_BHARAT_GROUP_MEMBERS };
    }
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId,
      groupId: group._id,
      joinedAt: now(),
      role: "member",
    });
    await ctx.db.patch("sacredBharatGroups", group._id, {
      memberCount: memberCount + 1,
      updatedAt: now(),
    });
  }
  return { id: group._id };
}

export async function listMyGroupsHandler(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return [];
  }
  const identityIds = await readIdentityIds(ctx, identity);
  const countProjectionIsVerified = await groupCountProjectionIsVerified(ctx);
  const memberships = (
    await Promise.all(
      identityIds.map((identityId) =>
        ctx.db
          .query("sacredBharatGroupMembers")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", identityId))
          .collect()
      )
    )
  )
    .flat()
    .filter(
      (membership, index, rows) =>
        rows.findIndex((row) => row.groupId === membership.groupId) === index
    );
  const groups = await Promise.all(
    memberships.map((membership) => ctx.db.get("sacredBharatGroups", membership.groupId))
  );
  const memberCounts = await Promise.all(
    groups.map(async (group) => {
      if (!group || group.isArchived) {
        return null;
      }
      return countProjectionIsVerified
        ? verifiedGroupMemberCount(group)
        : await readBoundedGroupMemberCount(ctx, group._id);
    })
  );
  return groups.flatMap((group, index) => {
    const memberCount = memberCounts[index];
    return group && !group.isArchived && memberCount !== null
      ? [
          {
            id: group._id,
            inviteCode: group.inviteCode,
            memberCount,
            name: group.name,
            role: memberships[index].role,
          },
        ]
      : [];
  });
}

export async function getGroupLeaderboardHandler(ctx: QueryCtx, args: { groupId: string }) {
  const identity = await getIdentityOrThrow(ctx);
  const identityIds = await readIdentityIds(ctx, identity);
  const identityIdSet = new Set(identityIds);
  const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
  if (!groupId) {
    throw new ConvexError("Invalid group id");
  }
  const group = await ctx.db.get("sacredBharatGroups", groupId);
  if (!group || group.isArchived) {
    throw new ConvexError("GROUP_NOT_FOUND");
  }
  const [membership, members] = await Promise.all([
    requireGroupMemberForIdentityIds(ctx, groupId, identityIds),
    ctx.db
      .query("sacredBharatGroupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .take(MAX_SACRED_BHARAT_GROUP_MEMBERS + 1),
  ]);
  if (members.length > MAX_SACRED_BHARAT_GROUP_MEMBERS) {
    throw new ConvexError("GROUP_MEMBER_LIMIT_REPAIR_REQUIRED");
  }
  const summaries = await Promise.all(
    members.map((member) => buildGroupMemberSummary(ctx, member.authUserId))
  );
  summaries.sort(
    (left, right) =>
      right.score - left.score ||
      right.templeCount - left.templeCount ||
      left.displayName.localeCompare(right.displayName) ||
      left.authUserId.localeCompare(right.authUserId)
  );
  return {
    entries: summaries.map((summary, index) => ({
      rank: index + 1,
      ...summary,
      isCurrentUser: identityIdSet.has(summary.authUserId),
    })),
    group: {
      id: group._id,
      inviteCode: group.inviteCode,
      memberCount: members.length,
      name: group.name,
      role: membership.role,
    },
  };
}

async function requireOwnedGroup(ctx: MutationCtx, groupIdValue: string) {
  const identity = await getIdentityOrThrow(ctx);
  const { identityIds } = await mutationIdentity(ctx, identity);
  const groupId = ctx.db.normalizeId("sacredBharatGroups", groupIdValue);
  if (!groupId) {
    throw new ConvexError("Invalid group id");
  }
  const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
  if (membership.role !== "owner") {
    throw new ConvexError("FORBIDDEN");
  }
  return groupId;
}

export async function renameGroupHandler(
  ctx: MutationCtx,
  args: { groupId: string; name: string }
) {
  const groupId = await requireOwnedGroup(ctx, args.groupId);
  await ctx.db.patch("sacredBharatGroups", groupId, {
    name: args.name.trim(),
    updatedAt: now(),
  });
  return { id: groupId };
}

export async function archiveGroupHandler(ctx: MutationCtx, args: { groupId: string }) {
  const groupId = await requireOwnedGroup(ctx, args.groupId);
  await ctx.db.patch("sacredBharatGroups", groupId, { isArchived: true, updatedAt: now() });
  return { id: groupId };
}

export async function leaveGroupHandler(ctx: MutationCtx, args: { groupId: string }) {
  const identity = await getIdentityOrThrow(ctx);
  const { identityIds } = await mutationIdentity(ctx, identity);
  const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
  if (!groupId) {
    throw new ConvexError("Invalid group id");
  }
  const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
  if (membership.role === "owner") {
    throw new ConvexError("Archive the group before leaving as owner");
  }
  const memberCount = await readBoundedGroupMemberCount(ctx, groupId);
  await ctx.db.delete("sacredBharatGroupMembers", membership._id);
  await ctx.db.patch("sacredBharatGroups", groupId, {
    memberCount: Math.max(0, memberCount - 1),
    updatedAt: now(),
  });
  return { id: groupId };
}
