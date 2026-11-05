import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import {
  externalTourManagerFields,
  externalTourManagerOutputValidator,
} from "../lib/teamTravelValidators";
import { getVisibleJob } from "./jobCardVisibility";
import { createActivity } from "./lib/activity";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { PERMISSIONS } from "./lib/rolePolicy";
import {
  isDirectorOrAdmin,
  type PortalAccess,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib/staffAccess";
import { boundedPaginationOptions, mapInBoundedBatches } from "./paginationPolicy";

const profileInputValidator = v.object(externalTourManagerFields);
type ProfileInput = Infer<typeof profileInputValidator>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d\s().-]+$/;
const NON_DIGITS = /\D/g;

function canManage(access: PortalAccess) {
  return isDirectorOrAdmin(access) || access.roles.includes("Operations Head");
}

function profileOutput(record: Doc<"externalTourManagerProfiles">, access: PortalAccess) {
  return {
    active: record.active,
    canManage: canManage(access),
    createdAt: record.createdAt,
    destinations: record.destinations,
    email: record.email,
    experienceSummary: record.experienceSummary,
    experienceYears: record.experienceYears,
    id: record._id,
    name: record.name,
    phone: record.phone,
    reportedPastTours: record.reportedPastTours,
    reportedPastToursNote: record.reportedPastToursNote,
    reportedPastToursSource: record.reportedPastToursSource,
    updatedAt: record.updatedAt,
  };
}

function checkedContacts(input: ProfileInput) {
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() ?? "";
  const phoneNormalized = phone.replace(NON_DIGITS, "");
  if (!name || name.length > 160) {
    throw new ConvexError("Enter a name of 1 to 160 characters");
  }
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
    throw new ConvexError("Enter a valid email address");
  }
  if (
    phone &&
    (!PHONE_PATTERN.test(phone) || phoneNormalized.length < 7 || phoneNormalized.length > 15)
  ) {
    throw new ConvexError("Enter a phone number with 7 to 15 digits and country code");
  }
  if (!(email || phone)) {
    throw new ConvexError(
      "Add an email address or phone number to identify this external tour manager"
    );
  }
  return { email, emailNormalized: email, name, phone, phoneNormalized };
}

function checkedExperience(input: ProfileInput) {
  const experienceSummary = input.experienceSummary?.trim() ?? "";
  const experienceYears = input.experienceYears ?? null;
  const reportedPastTours = input.reportedPastTours ?? null;
  const reportedPastToursNote = input.reportedPastToursNote?.trim() ?? "";
  if (experienceSummary.length > 1500 || reportedPastToursNote.length > 1000) {
    throw new ConvexError(
      "Keep experience under 1500 characters and past-tour evidence under 1000 characters"
    );
  }
  if (
    experienceYears !== null &&
    (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 60)
  ) {
    throw new ConvexError("Experience must be between 0 and 60 years, or left unrecorded");
  }
  if (
    reportedPastTours !== null &&
    (!Number.isInteger(reportedPastTours) || reportedPastTours < 0 || reportedPastTours > 10_000)
  ) {
    throw new ConvexError("Reported past tours must be a whole number from 0 to 10000");
  }
  if (reportedPastTours !== null && !reportedPastToursNote) {
    throw new ConvexError("Record the source or context for the reported past-tour count");
  }
  return {
    experienceSummary,
    experienceYears,
    reportedPastTours,
    reportedPastToursNote,
    reportedPastToursSource: input.reportedPastToursSource ?? ("self_reported" as const),
  };
}

function checkedProfile(input: ProfileInput) {
  if (
    input.destinations.length > 30 ||
    input.destinations.some((destination) => !destination.trim() || destination.trim().length > 100)
  ) {
    throw new ConvexError("Add up to 30 destinations, each 1 to 100 characters");
  }
  const destinations = Array.from(
    new Map(
      input.destinations.map((destination) => [
        destination.trim().toLowerCase(),
        destination.trim(),
      ])
    ).values()
  );
  return {
    ...checkedContacts(input),
    ...checkedExperience(input),
    destinations,
  };
}

async function assertUniqueIdentity(
  ctx: MutationCtx,
  identity: ReturnType<typeof checkedProfile>,
  existingId?: Id<"externalTourManagerProfiles">
) {
  const matches = await Promise.all([
    identity.emailNormalized
      ? ctx.db
          .query("externalTourManagerProfiles")
          .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", identity.emailNormalized))
          .take(2)
      : [],
    identity.phoneNormalized
      ? ctx.db
          .query("externalTourManagerProfiles")
          .withIndex("by_phoneNormalized", (q) => q.eq("phoneNormalized", identity.phoneNormalized))
          .take(2)
      : [],
  ]);
  if (matches.flat().some((profile) => profile._id !== existingId)) {
    throw new ConvexError(
      "An external tour manager with this email or phone already exists. Reuse the existing profile."
    );
  }
  const staffByEmail = identity.emailNormalized
    ? await ctx.db
        .query("staffUsers")
        .withIndex("by_emailNormalized", (q) => q.eq("emailNormalized", identity.emailNormalized))
        .first()
    : null;
  if (staffByEmail) {
    throw new ConvexError(
      "This contact belongs to an existing staff member. Use their staff tour-manager identity."
    );
  }
  if (identity.phoneNormalized) {
    const staff = await ctx.db.query("staffUsers").withIndex("by_active").take(501);
    if (staff.length > 500) {
      throw new ConvexError(
        "Staff phone identity verification exceeded its bound. Use an email or ask an administrator to resolve the identity."
      );
    }
    if (
      staff.some((person) => person.mobile?.replace(NON_DIGITS, "") === identity.phoneNormalized)
    ) {
      throw new ConvexError(
        "This phone belongs to an existing staff member. Use their staff tour-manager identity."
      );
    }
  }
}

export async function getExternalTourManagerProfile(
  ctx: QueryCtx | MutationCtx,
  rawId: string,
  requireActive = false
) {
  const id = ctx.db.normalizeId("externalTourManagerProfiles", rawId);
  const profile = id ? await ctx.db.get("externalTourManagerProfiles", id) : null;
  if (!profile || (requireActive && !profile.active)) {
    throw new ConvexError("Active external tour manager profile not found");
  }
  return profile;
}

export const getAccess = query({
  args: {},
  handler: async (ctx) => ({
    canManage: canManage(await requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS)),
  }),
  returns: v.object({ canManage: v.boolean() }),
});

export const list = query({
  args: { includeInactive: v.optional(v.boolean()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS);
    const source = args.includeInactive
      ? ctx.db.query("externalTourManagerProfiles").withIndex("by_name")
      : ctx.db
          .query("externalTourManagerProfiles")
          .withIndex("by_active_and_name", (q) => q.eq("active", true));
    const result = await source.paginate(boundedPaginationOptions(args.paginationOpts));
    return { ...result, page: result.page.map((record) => profileOutput(record, access)) };
  },
  returns: paginationResultValidator(externalTourManagerOutputValidator),
});

export const get = query({
  args: { profileId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS);
    const id = ctx.db.normalizeId("externalTourManagerProfiles", args.profileId);
    const profile = id ? await ctx.db.get("externalTourManagerProfiles", id) : null;
    return profile ? profileOutput(profile, access) : null;
  },
  returns: v.union(v.null(), externalTourManagerOutputValidator),
});

export const create = mutation({
  args: externalTourManagerFields,
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
    const identity = checkedProfile(args);
    await assertUniqueIdentity(ctx, identity);
    const now = Date.now();
    const actor = access.authUserId ?? "system";
    const id = await insertWithE2eOwnership(
      ctx,
      "externalTourManagerProfiles",
      {
        ...identity,
        active: true,
        createdAt: now,
        createdBy: actor,
        updatedAt: now,
        updatedBy: actor,
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "externalTourManagerProfile",
      message: "External tour manager profile added",
    });
    return { id };
  },
  returns: v.object({ id: v.id("externalTourManagerProfiles") }),
});

export const update = mutation({
  args: { ...externalTourManagerFields, active: v.boolean(), profileId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
    const profile = await getExternalTourManagerProfile(ctx, args.profileId);
    const identity = checkedProfile(args);
    await assertUniqueIdentity(ctx, identity, profile._id);
    await patchWithE2eOwnership(
      ctx,
      "externalTourManagerProfiles",
      profile._id,
      {
        ...identity,
        active: args.active,
        updatedAt: Date.now(),
        updatedBy: access.authUserId ?? "system",
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "updated",
      entityId: profile._id,
      entityType: "externalTourManagerProfile",
      message: "External tour manager profile updated",
    });
    return { id: profile._id };
  },
  returns: v.object({ id: v.id("externalTourManagerProfiles") }),
});

export const listAssignments = query({
  args: { paginationOpts: paginationOptsValidator, profileId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS);
    const profile = await getExternalTourManagerProfile(ctx, args.profileId);
    const result = await ctx.db
      .query("tourManagerAssignments")
      .withIndex("by_externalProfileId", (q) => q.eq("externalProfileId", profile._id))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const rows = await mapInBoundedBatches(result.page, async (assignment) => {
      const job =
        assignment.jobCardId && access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)
          ? await getVisibleJob(ctx, access, assignment.jobCardId)
          : null;
      const linkedBatch =
        job && assignment.travelBatchId
          ? await ctx.db.get("travelBatches", assignment.travelBatchId)
          : null;
      const batch = linkedBatch?.jobCardId === job?._id ? linkedBatch : null;
      return job
        ? {
            clientName: job.clientName,
            destination: batch?.destination ?? job.destination ?? "",
            id: assignment._id,
            jobCardId: job._id,
            jobCode: job.jobCode,
            status: assignment.status,
            travelBatchId: batch?._id ?? null,
            travelBatchLabel: batch?.batchReference || batch?.batchCode || "",
            travelEndDate: batch?.travelEndDate ?? job.travelEndDate ?? "",
            travelStartDate: batch?.travelStartDate ?? job.travelStartDate ?? "",
          }
        : null;
    });
    return { ...result, page: rows.filter((row) => row !== null) };
  },
  returns: paginationResultValidator(
    v.object({
      clientName: v.string(),
      destination: v.string(),
      id: v.id("tourManagerAssignments"),
      jobCardId: v.id("jobCards"),
      jobCode: v.string(),
      status: v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive")),
      travelBatchId: v.union(v.id("travelBatches"), v.null()),
      travelBatchLabel: v.string(),
      travelEndDate: v.string(),
      travelStartDate: v.string(),
    })
  ),
});
