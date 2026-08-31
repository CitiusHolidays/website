import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, query } from "../_generated/server";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { isRuntimeString } from "../lib/runtimeValues";
import { ALL_ROLES, isStaffRole, PERMISSIONS, type StaffRole } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
import { requireStaff } from "./lib/staffAccess";

const savedViewPatchValidator = {
  filterState: v.optional(v.any()),
  isFavorite: v.optional(v.boolean()),
  isPinnedToDashboard: v.optional(v.boolean()),
  name: v.optional(v.string()),
  pathname: v.optional(v.string()),
  sharedRole: v.optional(v.union(v.string(), v.null())),
  view: v.optional(v.string()),
};

const savedViewApiValidator = v.object({
  canMutate: v.boolean(),
  createdAt: v.string(),
  filterState: v.any(),
  id: v.id("portalSavedViews"),
  isFavorite: v.boolean(),
  isPinnedToDashboard: v.boolean(),
  name: v.string(),
  pathname: v.string(),
  sharedRole: v.union(v.string(), v.null()),
  updatedAt: v.string(),
  view: v.string(),
});

const savedViewIdResultValidator = v.object({
  id: v.id("portalSavedViews"),
});

const savedViewOverflowBucketValidator = v.object({
  canDelete: v.boolean(),
  kind: v.union(v.literal("private"), v.literal("shared")),
  label: v.string(),
  sharedRole: v.union(v.string(), v.null()),
});

const savedViewListResultValidator = v.object({
  overflowBuckets: v.array(savedViewOverflowBucketValidator),
  rows: v.array(savedViewApiValidator),
});

const SAVED_VIEW_BUCKET_LIMIT = 100;

function canManageSharedViews(access: { permissions: readonly string[] }) {
  return access.permissions.includes(PERMISSIONS.MANAGE_STAFF);
}

function normalizeName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ConvexError("Saved view name is required");
  }
  if (trimmed.length > 80) {
    throw new ConvexError("Saved view name must be 80 characters or fewer");
  }
  return trimmed;
}

async function requireSavedViewCapacity(
  ctx: MutationCtx,
  bucket: { ownerAuthUserId: string } | { sharedRole: StaffRole },
  excludeId?: Id<"portalSavedViews">
) {
  const rows =
    "sharedRole" in bucket
      ? await ctx.db
          .query("portalSavedViews")
          .withIndex("by_sharedRole", (q) => q.eq("sharedRole", bucket.sharedRole))
          .take(SAVED_VIEW_BUCKET_LIMIT + 1)
      : await ctx.db
          .query("portalSavedViews")
          .withIndex("by_ownerAuthUserId", (q) => q.eq("ownerAuthUserId", bucket.ownerAuthUserId))
          .filter((q) => q.eq(q.field("sharedRole"), undefined))
          .take(SAVED_VIEW_BUCKET_LIMIT + 1);
  const used = excludeId ? rows.filter((row) => row._id !== excludeId).length : rows.length;
  if (used >= SAVED_VIEW_BUCKET_LIMIT) {
    const label = "sharedRole" in bucket ? `${bucket.sharedRole} role` : "your account";
    throw new ConvexError(
      `Saved view limit reached for ${label}. Delete an existing saved view before creating another.`
    );
  }
}

const PORTAL_PATH_RE = /^\/portal(?:\/|$)/;

function hasUnsafePathCharacters(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code < 32 || code === 127;
  });
}

function hasUnsafePathSegments(value: string) {
  return value.split("/").some((segment) => {
    let decoded = segment;
    for (let pass = 0; pass < 3; pass += 1) {
      let next: string;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        return true;
      }
      if (next === decoded) {
        break;
      }
      decoded = next;
    }
    return (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\u0000")
    );
  });
}

function isSafePortalPathname(pathname: string) {
  return (
    pathname.length > 0 &&
    PORTAL_PATH_RE.test(pathname) &&
    !hasUnsafePathCharacters(pathname) &&
    !hasUnsafePathSegments(pathname) &&
    !pathname.includes("?") &&
    !pathname.includes("#")
  );
}

function requireSafePortalPathname(pathname: string) {
  const normalized = pathname.trim();
  if (!isSafePortalPathname(normalized)) {
    throw new ConvexError("Saved view must point to an internal portal path");
  }
  return normalized;
}

function safeStoredPortalPathname(pathname: RuntimeValue) {
  const normalized = isRuntimeString(pathname) ? pathname.trim() : "";
  return isSafePortalPathname(normalized) ? normalized : "/portal";
}

async function getOwnedSavedView(ctx: MutationCtx, access: PortalAccess, savedViewId: string) {
  const id = ctx.db.normalizeId("portalSavedViews", savedViewId);
  if (!id) {
    throw new ConvexError("Invalid saved view id");
  }
  const savedView = await ctx.db.get("portalSavedViews", id);
  if (!savedView) {
    throw new ConvexError("Saved view not found");
  }
  const ownsPrivate =
    !savedView.sharedRole &&
    savedView.ownerAuthUserId &&
    access.authUserId &&
    savedView.ownerAuthUserId === access.authUserId;
  const managesShared = savedView.sharedRole && canManageSharedViews(access);
  if (!(ownsPrivate || managesShared)) {
    throw new ConvexError("FORBIDDEN");
  }
  return { id, savedView };
}

async function buildSavedViewSharingPatch(
  ctx: MutationCtx,
  access: PortalAccess,
  id: Id<"portalSavedViews">,
  savedView: Doc<"portalSavedViews">,
  requestedSharedRole: null | string
): Promise<RuntimeObject> {
  if (!canManageSharedViews(access)) {
    throw new ConvexError("FORBIDDEN");
  }
  const nextSharedRole = requestedSharedRole
    ? ALL_ROLES.find((role) => role === requestedSharedRole)
    : undefined;
  if (requestedSharedRole && !nextSharedRole) {
    throw new ConvexError("Unknown shared role");
  }
  const nextPrivateOwnerAuthUserId = savedView.ownerAuthUserId ?? access.authUserId ?? undefined;
  if (!(nextSharedRole || nextPrivateOwnerAuthUserId)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (nextSharedRole !== savedView.sharedRole) {
    if (nextSharedRole) {
      await requireSavedViewCapacity(ctx, { sharedRole: nextSharedRole }, id);
    } else if (nextPrivateOwnerAuthUserId) {
      await requireSavedViewCapacity(ctx, { ownerAuthUserId: nextPrivateOwnerAuthUserId }, id);
    }
  }
  return {
    ownerAuthUserId: nextSharedRole ? undefined : nextPrivateOwnerAuthUserId,
    ownerStaffId: nextSharedRole ? undefined : (savedView.ownerStaffId ?? access.staffId),
    sharedRole: nextSharedRole,
  };
}

function toApi(row: Doc<"portalSavedViews">, access: PortalAccess) {
  const isShared = Boolean(row.sharedRole);
  const canMutate =
    (!isShared && row.ownerAuthUserId === access.authUserId) ||
    (isShared && canManageSharedViews(access));
  return {
    canMutate,
    createdAt: new Date(row.createdAt).toISOString(),
    filterState: row.filterState,
    id: row._id,
    isFavorite: row.isFavorite,
    isPinnedToDashboard: row.isPinnedToDashboard,
    name: row.name,
    pathname: safeStoredPortalPathname(row.pathname),
    sharedRole: row.sharedRole ?? null,
    updatedAt: new Date(row.updatedAt).toISOString(),
    view: row.view,
  };
}

export const listForPortal = query({
  args: { view: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const collectSharedRoleBuckets = (roles: readonly string[]) =>
      Promise.all(
        roles.flatMap((role) =>
          isStaffRole(role)
            ? [
                (async () => ({
                  role,
                  rows: await ctx.db
                    .query("portalSavedViews")
                    .withIndex("by_sharedRole", (q) => q.eq("sharedRole", role))
                    .take(SAVED_VIEW_BUCKET_LIMIT + 1),
                }))(),
              ]
            : []
        )
      );
    const ownerAuthUserId = access.authUserId;
    const [ownerRows, sharedBuckets] = await Promise.all([
      ownerAuthUserId
        ? ctx.db
            .query("portalSavedViews")
            .withIndex("by_ownerAuthUserId", (q) => q.eq("ownerAuthUserId", ownerAuthUserId))
            .filter((q) => q.eq(q.field("sharedRole"), undefined))
            .take(SAVED_VIEW_BUCKET_LIMIT + 1)
        : [],
      collectSharedRoleBuckets(canManageSharedViews(access) ? ALL_ROLES : access.roles),
    ]);
    const privateRows = ownerRows;
    const overflowBuckets = [
      ...(ownerRows.length > SAVED_VIEW_BUCKET_LIMIT
        ? [
            {
              canDelete: true,
              kind: "private" as const,
              label: "your account",
              sharedRole: null,
            },
          ]
        : []),
      ...sharedBuckets.flatMap(({ role, rows }) =>
        rows.length > SAVED_VIEW_BUCKET_LIMIT
          ? [
              {
                canDelete: canManageSharedViews(access),
                kind: "shared" as const,
                label: `${role} role`,
                sharedRole: role,
              },
            ]
          : []
      ),
    ];
    const rowsById = new Map<string, Doc<"portalSavedViews">>();
    const visibleRows = [
      ...privateRows.slice(0, SAVED_VIEW_BUCKET_LIMIT),
      ...sharedBuckets.flatMap(({ rows }) => rows.slice(0, SAVED_VIEW_BUCKET_LIMIT)),
    ];
    for (const row of visibleRows) {
      if (!args.view || row.view === args.view) {
        rowsById.set(String(row._id), row);
      }
    }
    return {
      overflowBuckets,
      rows: Array.from(rowsById.values())
        .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt - a.updatedAt)
        .map((row) => toApi(row, access)),
    };
  },
  returns: savedViewListResultValidator,
});

export const create = mutation({
  args: {
    filterState: v.any(),
    isFavorite: v.optional(v.boolean()),
    isPinnedToDashboard: v.optional(v.boolean()),
    name: v.string(),
    pathname: v.string(),
    sharedRole: v.optional(v.string()),
    view: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    if (!access.authUserId) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.sharedRole && !canManageSharedViews(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const sharedRole = args.sharedRole
      ? ALL_ROLES.find((role) => role === args.sharedRole)
      : undefined;
    if (args.sharedRole && !sharedRole) {
      throw new ConvexError("Unknown shared role");
    }
    await requireSavedViewCapacity(
      ctx,
      sharedRole ? { sharedRole } : { ownerAuthUserId: access.authUserId }
    );
    const timestamp = Date.now();
    const id = await ctx.db.insert("portalSavedViews", {
      createdAt: timestamp,
      createdBy: access.authUserId,
      filterState: args.filterState,
      isFavorite: args.isFavorite ?? false,
      isPinnedToDashboard: args.isPinnedToDashboard ?? false,
      name: normalizeName(args.name),
      ownerAuthUserId: args.sharedRole ? undefined : access.authUserId,
      ownerStaffId: args.sharedRole ? undefined : access.staffId,
      pathname: requireSafePortalPathname(args.pathname),
      sharedRole,
      updatedAt: timestamp,
      view: args.view,
    });
    return { id };
  },
  returns: savedViewIdResultValidator,
});

export const update = mutation({
  args: {
    savedViewId: v.string(),
    ...savedViewPatchValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const { id, savedView } = await getOwnedSavedView(ctx, access, args.savedViewId);
    const sharingPatch =
      args.sharedRole === undefined
        ? null
        : await buildSavedViewSharingPatch(ctx, access, id, savedView, args.sharedRole);
    const patch: RuntimeObject = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = normalizeName(args.name);
    }
    if (args.view !== undefined) {
      patch.view = args.view;
    }
    if (args.pathname !== undefined) {
      patch.pathname = requireSafePortalPathname(args.pathname);
    }
    if (args.filterState !== undefined) {
      patch.filterState = args.filterState;
    }
    if (args.isFavorite !== undefined) {
      patch.isFavorite = args.isFavorite;
    }
    if (args.isPinnedToDashboard !== undefined) {
      patch.isPinnedToDashboard = args.isPinnedToDashboard;
    }
    if (sharingPatch) {
      Object.assign(patch, sharingPatch);
    }
    await ctx.db.patch("portalSavedViews", id, patch);
    return { id };
  },
  returns: savedViewIdResultValidator,
});

export const remove = mutation({
  args: { savedViewId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const { id } = await getOwnedSavedView(ctx, access, args.savedViewId);
    await ctx.db.delete("portalSavedViews", id);
    return { id };
  },
  returns: savedViewIdResultValidator,
});
