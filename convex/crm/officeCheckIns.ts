import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { insertWithE2eOwnership } from "./lib/e2eOwnership";
import { type PortalAccess, requireStaff } from "./lib/staffAccess";
import {
  actorStaff,
  assertCheckInGateway,
  canOversee,
  canOverseeAllOffices,
  isOverseer,
  requireOverseenStaff,
  requireReason,
  ruleForOffice,
  toBranchRule,
} from "./officeCheckInAccess";
import { retainedWorkDateFrom } from "./officeCheckInRetention";
import {
  checkInRequirementValidator,
  enforcementModeValidator,
  locationReadingValidator,
  officeCheckInTables,
} from "./officeCheckInValidators";
import {
  type CheckInEvaluation,
  type CheckInRequirement,
  DEFAULT_OFFICE_TIME_ZONE,
  evaluateCheckIn,
  type LocationReading,
  requiresLocation,
  workDateFor,
} from "./officeCheckInVerification";
import { assertReferenceDate, assertReferenceNow } from "./referenceTimePolicy";

const STAFF_SCAN_LIMIT = 1000;
const DAY_RECORD_LIMIT = 2000;
const MAX_IP_TEXT_LENGTH = 64;

const checkInDocValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("officeCheckIns"),
  ...officeCheckInTables.officeCheckIns,
});

type VerificationRecord = Doc<"officeCheckIns">["clockIn"];

function verificationRecord(
  evaluation: CheckInEvaluation,
  evaluatedAt: number,
  ruleVersion?: number
) {
  const record: VerificationRecord = {
    enforcementMode: evaluation.enforcementMode,
    evaluatedAt,
    outcome: evaluation.outcome,
    requirement: evaluation.requirement,
    wouldBlock: evaluation.wouldBlock,
  };
  if (ruleVersion !== undefined) {
    record.ruleVersion = ruleVersion;
  }
  if (evaluation.network) {
    const { network } = evaluation;
    record.network = { outcome: network.outcome, reason: network.reason };
    if (network.ipVersion !== null) {
      record.network.ipVersion = network.ipVersion;
    }
    if (network.observedPrefix !== null) {
      record.network.observedPrefix = network.observedPrefix;
    }
    if (network.matchedLabel !== null) {
      record.network.matchedLabel = network.matchedLabel;
    }
  }
  if (evaluation.geofence) {
    const { geofence } = evaluation;
    record.geofence = { outcome: geofence.outcome, reason: geofence.reason };
    if (geofence.accuracyMeters !== null) {
      record.geofence.accuracyMeters = geofence.accuracyMeters;
    }
    if (geofence.distanceBand !== null) {
      record.geofence.distanceBand = geofence.distanceBand;
    }
  }
  return record;
}

async function requireOwnStaffRecord(ctx: MutationCtx, access: PortalAccess) {
  const staff = access.staffId ? await ctx.db.get("staffUsers", access.staffId) : null;
  if (!staff?.active) {
    throw new ConvexError("NO_STAFF_PROFILE");
  }
  if (!staff.officeId) {
    throw new ConvexError("NO_OFFICE_ASSIGNED");
  }
  const office = await ctx.db.get("offices", staff.officeId);
  if (!office?.active) {
    throw new ConvexError("OFFICE_INACTIVE");
  }
  return { office, staff };
}

async function audit(
  ctx: MutationCtx,
  entry: Omit<Doc<"officeCheckInAudit">, "_creationTime" | "_id">
) {
  await insertWithE2eOwnership(ctx, "officeCheckInAudit", entry);
}

function actorFields(access: PortalAccess) {
  return {
    actorName: access.name,
    actorStaffId: access.staffId,
  };
}

function signalSummary(record: VerificationRecord) {
  const parts = [`outcome ${record.outcome}`, `rule ${record.requirement}`, record.enforcementMode];
  if (record.network) {
    parts.push(`network ${record.network.outcome} (${record.network.reason})`);
  }
  if (record.geofence) {
    parts.push(`location ${record.geofence.outcome} (${record.geofence.reason})`);
  }
  return parts.join(", ");
}

/**
 * A self check-in whose evidence did not pass and has not been reviewed can
 * be re-evaluated, so a denied prompt or GPS timeout is recoverable.
 */
function canRetryClockIn(record: Doc<"officeCheckIns">) {
  return (
    record.source === "self" &&
    !record.review &&
    record.clockIn.requirement !== "not_configured" &&
    record.clockIn.outcome !== "pass"
  );
}

/**
 * Which record a clock-out closes. Today's open record first. If today's is
 * already closed the call is a replay (double submit, second tab, retry), so
 * an older forgotten session is never closed by accident. An earlier open
 * record is closed only when today has no record at all.
 */
async function clockOutTarget(
  ctx: MutationCtx,
  staff: Doc<"staffUsers">,
  now: number
): Promise<{ record: Doc<"officeCheckIns">; replayed: boolean } | null> {
  const timeZone = staff.officeId
    ? ((await ruleForOffice(ctx, staff.officeId))?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE)
    : DEFAULT_OFFICE_TIME_ZONE;
  const today = workDateFor(now, timeZone);
  const recent = await ctx.db
    .query("officeCheckIns")
    .withIndex("by_staffId_and_workDate", (q) => q.eq("staffId", staff._id))
    .order("desc")
    .take(3);
  const todays = recent.find((record) => record.workDate === today);
  if (todays) {
    return { record: todays, replayed: todays.status === "closed" };
  }
  const earlierOpen = recent.find((record) => record.status === "open");
  return earlierOpen ? { record: earlierOpen, replayed: false } : null;
}

const gatewayArgs = {
  gatewaySecret: v.string(),
  location: locationReadingValidator,
  observedIp: v.union(v.string(), v.null()),
};

function networkObservation(observedIp: string | null) {
  return observedIp && observedIp.length <= MAX_IP_TEXT_LENGTH
    ? { ip: observedIp, kind: "observed" as const }
    : { kind: "unavailable" as const };
}

/**
 * Clock in. Called only by the Next.js check-in route, which supplies the
 * edge-observed client IP. The server evaluates the office rule on this
 * request; nothing the browser decided is trusted.
 */
export const clockInViaGateway = mutation({
  args: gatewayArgs,
  handler: async (ctx, args) => {
    assertCheckInGateway(args.gatewaySecret);
    const access = await requireStaff(ctx);
    const { office, staff } = await requireOwnStaffRecord(ctx, access);
    const rule = await ruleForOffice(ctx, office._id);
    const now = Date.now();
    const workDate = workDateFor(now, rule?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE);
    const existing = await ctx.db
      .query("officeCheckIns")
      .withIndex("by_staffId_and_workDate", (q) =>
        q.eq("staffId", staff._id).eq("workDate", workDate)
      )
      .unique();
    if (existing && existing.status !== "open") {
      throw new ConvexError("ALREADY_CLOCKED_OUT");
    }
    if (existing && !canRetryClockIn(existing)) {
      return { checkIn: existing, replayed: true };
    }
    const evaluation = evaluateCheckIn({
      location: args.location,
      network: networkObservation(args.observedIp),
      rule: toBranchRule(rule),
      serverNow: now,
    });
    const clockIn = verificationRecord(evaluation, now, rule?.version);
    if (existing) {
      // A retry re-evaluates the open record's evidence. The original clock-in
      // time stands; each attempt's evidence stays in the audit trail.
      await ctx.db.patch("officeCheckIns", existing._id, {
        admission: evaluation.admitted ? "admitted" : existing.admission,
        clockIn,
        updatedAt: now,
      });
      await audit(ctx, {
        ...actorFields(access),
        at: now,
        checkInId: existing._id,
        kind: "clock_in_retry",
        officeId: existing.officeId,
        subjectStaffId: staff._id,
        summary: signalSummary(clockIn),
      });
      const retried = await ctx.db.get("officeCheckIns", existing._id);
      if (!retried) {
        throw new ConvexError("CHECK_IN_NOT_FOUND");
      }
      return { checkIn: retried, replayed: false };
    }
    const checkInId = await insertWithE2eOwnership(ctx, "officeCheckIns", {
      admission: evaluation.admitted ? "admitted" : "pending_review",
      clockIn,
      clockInAt: now,
      createdAt: now,
      officeId: office._id,
      source: "self",
      staffId: staff._id,
      status: "open",
      updatedAt: now,
      workDate,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      checkInId,
      kind: "clock_in",
      officeId: office._id,
      subjectStaffId: staff._id,
      summary: signalSummary(clockIn),
    });
    const checkIn = await ctx.db.get("officeCheckIns", checkInId);
    if (!checkIn) {
      throw new ConvexError("CHECK_IN_NOT_FOUND");
    }
    return { checkIn, replayed: false };
  },
  returns: v.object({ checkIn: checkInDocValidator, replayed: v.boolean() }),
});

/**
 * Clock out. Never blocked by verification: the signals are recorded as
 * report-only evidence so a lost signal cannot trap someone in a session.
 */
export const clockOutViaGateway = mutation({
  args: gatewayArgs,
  handler: async (ctx, args) => {
    assertCheckInGateway(args.gatewaySecret);
    const access = await requireStaff(ctx);
    const staff = access.staffId ? await ctx.db.get("staffUsers", access.staffId) : null;
    if (!staff) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    const now = Date.now();
    const target = await clockOutTarget(ctx, staff, now);
    if (!target) {
      throw new ConvexError("NOT_CLOCKED_IN");
    }
    if (target.replayed) {
      return { checkIn: target.record, replayed: true };
    }
    const open = target.record;
    const rule = await ruleForOffice(ctx, open.officeId);
    const branchRule = toBranchRule(rule);
    const evaluation = evaluateCheckIn({
      location: args.location,
      network: networkObservation(args.observedIp),
      rule: branchRule ? { ...branchRule, enforcementMode: "report_only" } : null,
      serverNow: now,
    });
    const clockOut = verificationRecord(evaluation, now, rule?.version);
    await ctx.db.patch("officeCheckIns", open._id, {
      clockOut,
      clockOutAt: now,
      status: "closed",
      updatedAt: now,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      checkInId: open._id,
      kind: "clock_out",
      officeId: open.officeId,
      subjectStaffId: staff._id,
      summary: signalSummary(clockOut),
    });
    const checkIn = await ctx.db.get("officeCheckIns", open._id);
    if (!checkIn) {
      throw new ConvexError("CHECK_IN_NOT_FOUND");
    }
    return { checkIn, replayed: false };
  },
  returns: v.object({ checkIn: checkInDocValidator, replayed: v.boolean() }),
});

const ruleSummaryValidator = v.object({
  configured: v.boolean(),
  enforcementMode: enforcementModeValidator,
  needsLocation: v.boolean(),
  requirement: v.union(checkInRequirementValidator, v.literal("not_configured")),
});

/** The signed-in person's office, rule summary and today's record. */
export const myStatus = query({
  args: { referenceNow: v.number() },
  handler: async (ctx, args) => {
    const referenceNow = assertReferenceNow(args.referenceNow);
    const access = await requireStaff(ctx);
    const staff = access.staffId ? await ctx.db.get("staffUsers", access.staffId) : null;
    const office = staff?.officeId ? await ctx.db.get("offices", staff.officeId) : null;
    const rule = office ? await ruleForOffice(ctx, office._id) : null;
    const timeZone = rule?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE;
    const workDate = workDateFor(referenceNow, timeZone);
    const requirement: CheckInRequirement | "not_configured" =
      rule?.requirement ?? "not_configured";
    const recent = staff
      ? await ctx.db
          .query("officeCheckIns")
          .withIndex("by_staffId_and_workDate", (q) => q.eq("staffId", staff._id))
          .order("desc")
          .take(3)
      : [];
    const today = recent.find((record) => record.workDate === workDate) ?? null;
    const openFromEarlierDay =
      recent.find((record) => record.status === "open" && record.workDate !== workDate) ?? null;
    return {
      canOversee: isOverseer(access) || (staff ? await hasDirectReports(ctx, staff._id) : false),
      hasStaffProfile: Boolean(staff?.active),
      office: office
        ? { active: office.active, city: office.city ?? null, id: office._id, name: office.name }
        : null,
      openFromEarlierDay,
      rule: {
        configured: Boolean(rule),
        enforcementMode: rule?.enforcementMode ?? "report_only",
        needsLocation: rule ? requiresLocation(rule.requirement) : false,
        requirement,
      },
      timeZone,
      today,
      workDate,
    };
  },
  returns: v.object({
    canOversee: v.boolean(),
    hasStaffProfile: v.boolean(),
    office: v.union(
      v.object({
        active: v.boolean(),
        city: v.union(v.string(), v.null()),
        id: v.id("offices"),
        name: v.string(),
      }),
      v.null()
    ),
    openFromEarlierDay: v.union(checkInDocValidator, v.null()),
    rule: ruleSummaryValidator,
    timeZone: v.string(),
    today: v.union(checkInDocValidator, v.null()),
    workDate: v.string(),
  }),
});

/** A reporting manager oversees direct reports even without view:team. */
async function hasDirectReports(ctx: QueryCtx, staffId: Id<"staffUsers">) {
  const staff = await ctx.db
    .query("staffUsers")
    .withIndex("by_active", (q) => q.eq("active", true))
    .take(STAFF_SCAN_LIMIT);
  return staff.some((member) => member.reportingManagerStaffId === staffId);
}

const teamRowValidator = v.object({
  canReview: v.boolean(),
  checkIn: v.union(checkInDocValidator, v.null()),
  department: v.union(v.string(), v.null()),
  name: v.string(),
  officeId: v.union(v.id("offices"), v.null()),
  officeName: v.union(v.string(), v.null()),
  staffId: v.id("staffUsers"),
  timeZone: v.string(),
});

/**
 * Managers see each signal's outcome and reason, not the person's network
 * prefix. Prefixes are only aggregated for Admins in the pilot overview.
 */
function withoutNetworkPrefixes(checkIn: Doc<"officeCheckIns"> | null) {
  if (!checkIn) {
    return null;
  }
  const strip = (record: VerificationRecord | undefined) => {
    if (!record?.network) {
      return record;
    }
    const { observedPrefix: _omitted, ...network } = record.network;
    return { ...record, network };
  };
  return {
    ...checkIn,
    clockIn: strip(checkIn.clockIn) ?? checkIn.clockIn,
    clockOut: strip(checkIn.clockOut),
  };
}

/**
 * Who has checked in on one work date, scoped to the people this manager
 * oversees. Staff outside the scope are never returned.
 */
export const teamDay = query({
  args: { officeId: v.optional(v.id("offices")), workDate: v.string() },
  handler: async (ctx, args) => {
    const workDate = assertReferenceDate(args.workDate);
    const access = await requireStaff(ctx);
    const actor = await actorStaff(ctx, access);
    const [staff, offices, rules, records] = await Promise.all([
      ctx.db
        .query("staffUsers")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(STAFF_SCAN_LIMIT),
      ctx.db.query("offices").take(100),
      ctx.db.query("officeCheckInRules").take(100),
      ctx.db
        .query("officeCheckIns")
        .withIndex("by_workDate", (q) => q.eq("workDate", workDate))
        .take(DAY_RECORD_LIMIT),
    ]);
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));
    const timeZones = new Map(rules.map((rule) => [rule.officeId, rule.timeZone]));
    const recordsByStaff = new Map(records.map((record) => [record.staffId, record]));
    const overseen = staff.filter((member) => canOversee(access, actor, member));
    const visibleOfficeIds = new Set(
      canOverseeAllOffices(access)
        ? offices.map((office) => office._id)
        : overseen.flatMap((member) => (member.officeId ? [member.officeId] : []))
    );
    const rows = overseen
      .filter((member) => !args.officeId || member.officeId === args.officeId)
      .map((member) => {
        const checkIn = withoutNetworkPrefixes(recordsByStaff.get(member._id) ?? null);
        const officeId = checkIn?.officeId ?? member.officeId ?? null;
        return {
          canReview: true,
          checkIn,
          department: member.department ?? null,
          name: member.name,
          officeId,
          officeName: officeId ? (officeNames.get(officeId) ?? null) : null,
          staffId: member._id,
          timeZone: (officeId && timeZones.get(officeId)) || DEFAULT_OFFICE_TIME_ZONE,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    return {
      offices: offices
        .filter((office) => visibleOfficeIds.has(office._id))
        .map((office) => ({
          id: office._id,
          name: office.name,
          timeZone: timeZones.get(office._id) ?? DEFAULT_OFFICE_TIME_ZONE,
        })),
      rows,
      truncated: staff.length === STAFF_SCAN_LIMIT || records.length === DAY_RECORD_LIMIT,
      workDate,
    };
  },
  returns: v.object({
    offices: v.array(v.object({ id: v.id("offices"), name: v.string(), timeZone: v.string() })),
    rows: v.array(teamRowValidator),
    truncated: v.boolean(),
    workDate: v.string(),
  }),
});

async function requireOverseenCheckIn(
  ctx: MutationCtx,
  access: PortalAccess,
  checkInId: Id<"officeCheckIns">
) {
  const checkIn = await ctx.db.get("officeCheckIns", checkInId);
  if (!checkIn) {
    throw new ConvexError("CHECK_IN_NOT_FOUND");
  }
  await requireOverseenStaff(ctx, access, checkIn.staffId, checkIn.officeId);
  return checkIn;
}

/** Accept or reject a check-in after manager review. */
export const review = mutation({
  args: {
    checkInId: v.id("officeCheckIns"),
    decision: v.union(v.literal("accepted"), v.literal("rejected")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const reason = requireReason(args.reason);
    const checkIn = await requireOverseenCheckIn(ctx, access, args.checkInId);
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    const now = Date.now();
    await ctx.db.patch("officeCheckIns", checkIn._id, {
      admission: args.decision === "accepted" ? "admitted" : "rejected",
      review: {
        decision: args.decision,
        reason,
        reviewedAt: now,
        reviewerName: access.name,
        reviewerStaffId: access.staffId,
      },
      updatedAt: now,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      checkInId: checkIn._id,
      kind: args.decision === "accepted" ? "review_accepted" : "review_rejected",
      officeId: checkIn.officeId,
      reason,
      subjectStaffId: checkIn.staffId,
      summary: `admission ${checkIn.admission} -> ${args.decision === "accepted" ? "admitted" : "rejected"}`,
    });
    return null;
  },
  returns: v.null(),
});

async function timeZoneForOffice(ctx: MutationCtx, officeId: Id<"offices">) {
  return (await ruleForOffice(ctx, officeId))?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE;
}

function assertTimesOnWorkDate(input: {
  clockInAt: number;
  clockOutAt: number | null;
  now: number;
  timeZone: string;
  workDate: string;
}) {
  const { clockInAt, clockOutAt, now, timeZone, workDate } = input;
  if (!(Number.isSafeInteger(clockInAt) && clockInAt > 0 && clockInAt <= now)) {
    throw new ConvexError("Clock-in time must be a past time.");
  }
  if (workDateFor(clockInAt, timeZone) !== workDate) {
    throw new ConvexError("Clock-in time must fall on the record's work date.");
  }
  if (
    clockOutAt !== null &&
    !(Number.isSafeInteger(clockOutAt) && clockOutAt > clockInAt && clockOutAt <= now)
  ) {
    throw new ConvexError("Clock-out time must be after clock-in and not in the future.");
  }
  if (clockOutAt !== null && clockOutAt - clockInAt > 24 * 60 * 60 * 1000) {
    throw new ConvexError("A corrected session cannot exceed 24 hours.");
  }
}

function formatTime(timestamp: number | undefined, timeZone: string) {
  if (timestamp === undefined) {
    return "none";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone,
    year: "numeric",
  }).format(new Date(timestamp));
}

/** Correct clock-in or clock-out times, for example after a missed checkout. */
export const correctTimes = mutation({
  args: {
    checkInId: v.id("officeCheckIns"),
    clockInAt: v.number(),
    clockOutAt: v.union(v.number(), v.null()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const reason = requireReason(args.reason);
    const checkIn = await requireOverseenCheckIn(ctx, access, args.checkInId);
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    if (args.clockOutAt === null && checkIn.status === "closed") {
      const otherOpen = await ctx.db
        .query("officeCheckIns")
        .withIndex("by_staffId_and_workDate", (q) => q.eq("staffId", checkIn.staffId))
        .order("desc")
        .take(5);
      if (otherOpen.some((record) => record._id !== checkIn._id && record.status === "open")) {
        throw new ConvexError("Close this person's other open session before reopening this one.");
      }
    }
    const now = Date.now();
    const timeZone = await timeZoneForOffice(ctx, checkIn.officeId);
    assertTimesOnWorkDate({
      clockInAt: args.clockInAt,
      clockOutAt: args.clockOutAt,
      now,
      timeZone,
      workDate: checkIn.workDate,
    });
    await ctx.db.patch("officeCheckIns", checkIn._id, {
      clockInAt: args.clockInAt,
      clockOut: args.clockOutAt === null ? undefined : checkIn.clockOut,
      clockOutAt: args.clockOutAt ?? undefined,
      correctedAt: now,
      status: args.clockOutAt === null ? "open" : "closed",
      updatedAt: now,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      checkInId: checkIn._id,
      kind: "times_corrected",
      officeId: checkIn.officeId,
      reason,
      subjectStaffId: checkIn.staffId,
      summary: `in ${formatTime(checkIn.clockInAt, timeZone)} -> ${formatTime(args.clockInAt, timeZone)}, out ${formatTime(checkIn.clockOutAt, timeZone)} -> ${formatTime(args.clockOutAt ?? undefined, timeZone)}`,
    });
    return null;
  },
  returns: v.null(),
});

const MANUAL_ENTRY_LOCATION: LocationReading = { kind: "not_requested" };

/**
 * Record attendance for someone whose device or network could not check in.
 * The entry carries no device evidence and is marked as a manager entry.
 */
export const recordManualEntry = mutation({
  args: {
    clockInAt: v.number(),
    clockOutAt: v.union(v.number(), v.null()),
    reason: v.string(),
    staffId: v.id("staffUsers"),
    workDate: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const reason = requireReason(args.reason);
    const workDate = assertReferenceDate(args.workDate);
    if (workDate < retainedWorkDateFrom(Date.now())) {
      throw new ConvexError("That date is outside the 3-month check-in retention window.");
    }
    const { subject } = await requireOverseenStaff(ctx, access, args.staffId);
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    if (!subject.active) {
      throw new ConvexError("This staff member is inactive.");
    }
    if (!subject.officeId) {
      throw new ConvexError("NO_OFFICE_ASSIGNED");
    }
    const existing = await ctx.db
      .query("officeCheckIns")
      .withIndex("by_staffId_and_workDate", (q) =>
        q.eq("staffId", subject._id).eq("workDate", workDate)
      )
      .unique();
    if (existing) {
      throw new ConvexError("A record already exists for this date. Correct it instead.");
    }
    const now = Date.now();
    const rule = await ruleForOffice(ctx, subject.officeId);
    const timeZone = rule?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE;
    assertTimesOnWorkDate({
      clockInAt: args.clockInAt,
      clockOutAt: args.clockOutAt,
      now,
      timeZone,
      workDate,
    });
    const branchRule = toBranchRule(rule);
    const evaluation = evaluateCheckIn({
      location: MANUAL_ENTRY_LOCATION,
      network: { kind: "unavailable" },
      rule: branchRule ? { ...branchRule, enforcementMode: "report_only" } : null,
      serverNow: now,
    });
    const checkInId = await insertWithE2eOwnership(ctx, "officeCheckIns", {
      admission: "admitted",
      clockIn: verificationRecord(evaluation, now, rule?.version),
      clockInAt: args.clockInAt,
      clockOutAt: args.clockOutAt ?? undefined,
      createdAt: now,
      officeId: subject.officeId,
      review: {
        decision: "accepted",
        reason,
        reviewedAt: now,
        reviewerName: access.name,
        reviewerStaffId: access.staffId,
      },
      source: "manager_entry",
      staffId: subject._id,
      status: args.clockOutAt === null ? "open" : "closed",
      updatedAt: now,
      workDate,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      checkInId,
      kind: "manual_entry",
      officeId: subject.officeId,
      reason,
      subjectStaffId: subject._id,
      summary: `manual entry in ${formatTime(args.clockInAt, timeZone)}, out ${formatTime(args.clockOutAt ?? undefined, timeZone)}`,
    });
    return checkInId;
  },
  returns: v.id("officeCheckIns"),
});

/** Audit trail for one record, visible to its overseers and to its owner. */
export const history = query({
  args: { checkInId: v.id("officeCheckIns") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const checkIn = await ctx.db.get("officeCheckIns", args.checkInId);
    if (!checkIn) {
      return [];
    }
    if (access.staffId !== checkIn.staffId) {
      const [actor, subject] = await Promise.all([
        actorStaff(ctx, access),
        ctx.db.get("staffUsers", checkIn.staffId),
      ]);
      if (!(subject && canOversee(access, actor, subject, checkIn.officeId))) {
        throw new ConvexError("FORBIDDEN");
      }
    }
    const events = await ctx.db
      .query("officeCheckInAudit")
      .withIndex("by_checkInId", (q) => q.eq("checkInId", checkIn._id))
      .order("desc")
      .take(50);
    return events.map((event) => ({
      actorName: event.actorName,
      at: event.at,
      id: event._id,
      kind: event.kind,
      reason: event.reason ?? null,
      summary: event.summary,
    }));
  },
  returns: v.array(
    v.object({
      actorName: v.string(),
      at: v.number(),
      id: v.id("officeCheckInAudit"),
      kind: officeCheckInTables.officeCheckInAudit.kind,
      reason: v.union(v.string(), v.null()),
      summary: v.string(),
    })
  ),
});
