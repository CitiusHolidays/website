import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { isRuntimeString } from "../lib/runtimeValues";
import { ALL_ROLES, isStaffRole, PERMISSIONS } from "./lib/rolePolicy";
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

function canManageSharedViews(access: { permissions: string[] }) {
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

async function getOwnedSavedView(ctx: any, access: any, savedViewId: string) {
  const id = ctx.db.normalizeId("portalSavedViews", savedViewId);
  if (!id) {
    throw new ConvexError("Invalid saved view id");
  }
  const savedView = await ctx.db.get("portalSavedViews", id);
  if (!savedView) {
    throw new ConvexError("Saved view not found");
  }
  const ownsPrivate =
    savedView.ownerAuthUserId &&
    access.authUserId &&
    savedView.ownerAuthUserId === access.authUserId;
  const managesShared = savedView.sharedRole && canManageSharedViews(access);
  if (!(ownsPrivate || managesShared)) {
    throw new ConvexError("FORBIDDEN");
  }
  return { id, savedView };
}

function toApi(row: any, access: any) {
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
    const [privateRows, sharedBuckets] = await Promise.all([
      access.authUserId
        ? ctx.db
            .query("portalSavedViews")
            .withIndex("by_ownerAuthUserId", (q) => q.eq("ownerAuthUserId", access.authUserId))
            .collect()
        : [],
      Promise.all(
        access.roles.filter(isStaffRole).map((role) =>
          ctx.db
            .query("portalSavedViews")
            .withIndex("by_sharedRole", (q) => q.eq("sharedRole", role))
            .collect()
        )
      ),
    ]);
    const rowsById = new Map();
    for (const row of [...privateRows, ...sharedBuckets.flat()]) {
      if (!args.view || row.view === args.view) {
        rowsById.set(String(row._id), row);
      }
    }
    return Array.from(rowsById.values())
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || b.updatedAt - a.updatedAt)
      .map((row) => toApi(row, access));
  },
  returns: v.array(savedViewApiValidator),
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
    if (args.sharedRole !== undefined && !canManageSharedViews(access)) {
      throw new ConvexError("FORBIDDEN");
    }
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
    if (args.sharedRole !== undefined) {
      patch.sharedRole = args.sharedRole || undefined;
      patch.ownerAuthUserId = args.sharedRole
        ? undefined
        : (savedView.ownerAuthUserId ?? access.authUserId);
      patch.ownerStaffId = args.sharedRole ? undefined : (savedView.ownerStaffId ?? access.staffId);
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
