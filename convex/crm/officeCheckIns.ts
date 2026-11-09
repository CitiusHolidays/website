import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { insertWithE2eOwnership } from "./lib/e2eOwnership";
import { hasRole, isAdmin, type PortalAccess, requireStaff } from "./lib/staffAccess";
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
  awayReasonValidator,
  checkInRequirementValidator,
  enforcementModeValidator,
  locationReadingValidator,
  officeCheckInTables,
} from "./officeCheckInValidators";
import {
  type AwayReason,
  awayLocationFrom,
  awayReasonNeedsLocation,
  type CheckInEvaluation,
  type CheckInRequirement,
  DEFAULT_OFFICE_TIME_ZONE,
  evaluateCheckIn,
  type LocationReading,
  needsAwayReason,
  requiresLocation,
  workDateFor,
} from "./officeCheckInVerification";
import { assertReferenceDate, assertReferenceNow } from "./referenceTimePolicy";

const STAFF_SCAN_LIMIT = 1000;
const DAY_RECORD_LIMIT = 2000;
const MAX_IP_TEXT_LENGTH = 64;
/** Sessions read per person per work date. Clock-in refuses a new session past this. */
const SESSIONS_PER_DAY_LIMIT = 20;
/** Audit rows erased per batch when an Admin hard-deletes a session. */
const ERASE_AUDIT_BATCH = 200;
const ERASE_AUDIT_MAX_BATCHES = 10;

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

type CheckInDoc = Doc<"officeCheckIns">;

/** Newest session first: by clock-in time, then by creation. */
function newestFirst(left: CheckInDoc, right: CheckInDoc) {
  return right.clockInAt - left.clockInAt || right._creationTime - left._creationTime;
}

/**
 * One person's sessions on one work date, newest first. A person may clock
 * out and clock in again, so a day can hold several sessions; the read is
 * bounded by SESSIONS_PER_DAY_LIMIT.
 */
async function sessionsOn(ctx: Pick<QueryCtx, "db">, staffId: Id<"staffUsers">, workDate: string) {
  const sessions = await ctx.db
    .query("officeCheckIns")
    .withIndex("by_staffId_and_workDate", (q) => q.eq("staffId", staffId).eq("workDate", workDate))
    .order("desc")
    .take(SESSIONS_PER_DAY_LIMIT);
  return sessions.sort(newestFirst);
}

/** The newest open session from a work date before `workDate`, if any. */
async function openBefore(ctx: Pick<QueryCtx, "db">, staffId: Id<"staffUsers">, workDate: string) {
  const earlier = await ctx.db
    .query("officeCheckIns")
    .withIndex("by_staffId_and_workDate", (q) => q.eq("staffId", staffId).lt("workDate", workDate))
    .order("desc")
    .take(SESSIONS_PER_DAY_LIMIT);
  return earlier.find((record) => record.status === "open") ?? null;
}

function sessionEnd(session: CheckInDoc) {
  return session.clockOutAt ?? session.clockInAt;
}

function latestClosed(sessions: readonly CheckInDoc[]) {
  let latest: CheckInDoc | null = null;
  for (const session of sessions) {
    if (session.status === "closed" && (!latest || sessionEnd(session) > sessionEnd(latest))) {
      latest = session;
    }
  }
  return latest;
}

/**
 * Which session a clock-out closes. Today's open session first. If every
 * session today is closed the call is a replay (double submit, second tab,
 * retry) of the latest one, so an older forgotten session is never closed by
 * accident. An earlier open session is closed only when today has none.
 */
async function clockOutTarget(
  ctx: MutationCtx,
  staff: Doc<"staffUsers">,
  now: number
): Promise<{ record: CheckInDoc; replayed: boolean } | null> {
  const timeZone = staff.officeId
    ? ((await ruleForOffice(ctx, staff.officeId))?.timeZone ?? DEFAULT_OFFICE_TIME_ZONE)
    : DEFAULT_OFFICE_TIME_ZONE;
  const today = workDateFor(now, timeZone);
  const todays = await sessionsOn(ctx, staff._id, today);
  const open = todays.find((record) => record.status === "open");
  if (open) {
    return { record: open, replayed: false };
  }
  const closed = latestClosed(todays);
  if (closed) {
    return { record: closed, replayed: true };
  }
  const earlierOpen = await openBefore(ctx, staff._id, today);
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
    // One session is open at a time. While it is open a repeat press replays
    // it (or retries its evidence); once it is closed a press starts a new
    // session on the same work date, evaluated like any clock-in.
    const todays = await sessionsOn(ctx, staff._id, workDate);
    const existing = todays.find((record) => record.status === "open") ?? null;
    if (existing && !canRetryClockIn(existing)) {
      return { checkIn: existing, replayed: true };
    }
    if (!existing && todays.length >= SESSIONS_PER_DAY_LIMIT) {
      throw new ConvexError("SESSION_LIMIT_REACHED");
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
      // time stands; each attempt's evidence stays in the audit trail. A retry
      // that passes places the person at the office, so any away reason goes.
      const retry: Partial<CheckInDoc> = {
        admission: evaluation.admitted ? "admitted" : existing.admission,
        clockIn,
        updatedAt: now,
      };
      if (clockIn.outcome === "pass") {
        // Patching a field to undefined removes it from the document.
        retry.awayReason = undefined;
        retry.awayLocation = undefined;
      }
      await ctx.db.patch("officeCheckIns", existing._id, retry);
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

const AWAY_REASON_WORDS = {
  market_visit: "on a sales call",
  on_tour: "working on tour",
  out_of_office: "working from home",
} satisfies Record<AwayReason, string>;

/**
 * The person says where they are working when their own clock-in check didn't
 * pass: on tour, on a sales call, or working from home. It is their statement,
 * recorded beside the evidence, and it never changes admission: a pending
 * check-in still waits for a manager. They may change it while clocked in, until
 * a manager has reviewed the session.
 */
export const chooseAwayReason = mutation({
  args: {
    checkInId: v.id("officeCheckIns"),
    /** Required for On tour and Sales call: the device's reading when the person answered. */
    location: v.optional(locationReadingValidator),
    reason: awayReasonValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    const checkIn = await ctx.db.get("officeCheckIns", args.checkInId);
    // Someone else's session reads as missing, so ids can't be probed.
    if (!checkIn || checkIn.staffId !== access.staffId) {
      throw new ConvexError("CHECK_IN_NOT_FOUND");
    }
    if (!needsAwayReason(checkIn)) {
      throw new ConvexError("AWAY_REASON_NOT_NEEDED");
    }
    if (checkIn.review) {
      throw new ConvexError("ALREADY_REVIEWED");
    }
    // The answer is about where they are while clocked in; after clock-out it can't change.
    if (checkIn.status === "closed") {
      throw new ConvexError("SESSION_CLOSED");
    }
    if (checkIn.awayReason === args.reason) {
      return null;
    }
    const now = Date.now();
    const answer: Partial<CheckInDoc> = { awayReason: args.reason, updatedAt: now };
    if (awayReasonNeedsLocation(args.reason)) {
      const located = awayLocationFrom(args.location ?? { kind: "not_requested" }, now);
      if ("problem" in located) {
        throw new ConvexError(
          located.problem === "missing" ? "AWAY_LOCATION_REQUIRED" : "AWAY_LOCATION_INVALID"
        );
      }
      answer.awayLocation = located.location;
    } else {
      // Work from home carries no location; drop any point from an earlier answer.
      answer.awayLocation = undefined;
    }
    await ctx.db.patch("officeCheckIns", checkIn._id, answer);
    const previous = checkIn.awayReason;
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      checkInId: checkIn._id,
      kind: "away_reason_set",
      officeId: checkIn.officeId,
      subjectStaffId: checkIn.staffId,
      // The audit line says a location was shared, never where.
      summary: [
        AWAY_REASON_WORDS[args.reason],
        answer.awayLocation ? ", location shared" : "",
        previous ? ` (was ${AWAY_REASON_WORDS[previous]})` : "",
      ].join(""),
    });
    return null;
  },
  returns: v.null(),
});

const ruleSummaryValidator = v.object({
  configured: v.boolean(),
  enforcementMode: enforcementModeValidator,
  needsLocation: v.boolean(),
  requirement: v.union(checkInRequirementValidator, v.literal("not_configured")),
});

/**
 * How this caller may delete a session (owner decision 2026-11-06):
 * - "erase": the Admin role hard-deletes a session and its history, including
 *   their own, so test data can be wiped. A reason is optional.
 * - "trail": the Directors role deletes a session they oversee (never their
 *   own) with a required reason, and a `record_deleted` audit row stays.
 * - null: everyone else, including Director Cement, HR and heads.
 *
 * Both need a staff profile, like every other check-in record change, so a
 * break-glass bootstrap Admin session (no staffId) cannot erase attendance.
 */
type DeletionMode = "erase" | "trail";

function deletionModeFor(access: PortalAccess): DeletionMode | null {
  if (!access.staffId) {
    return null;
  }
  if (isAdmin(access)) {
    return "erase";
  }
  return hasRole(access, "Directors") ? "trail" : null;
}

const deletionModeValidator = v.union(v.literal("erase"), v.literal("trail"), v.null());

/** The signed-in person's office, rule summary and today's sessions. */
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
    const [sessions, openFromEarlierDay] = staff
      ? await Promise.all([
          sessionsOn(ctx, staff._id, workDate),
          openBefore(ctx, staff._id, workDate),
        ])
      : [[], null];
    return {
      canOversee: isOverseer(access) || (staff ? await hasDirectReports(ctx, staff._id) : false),
      deletion: deletionModeFor(access),
      hasOpenSession: sessions.some((session) => session.status === "open"),
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
      sessions,
      timeZone,
      today: sessions[0] ?? null,
      workDate,
    };
  },
  returns: v.object({
    canOversee: v.boolean(),
    deletion: deletionModeValidator,
    hasOpenSession: v.boolean(),
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
    /** Today's sessions, newest first. */
    sessions: v.array(checkInDocValidator),
    timeZone: v.string(),
    /** The latest of today's sessions. */
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
  /** The day's sessions, newest first; `checkIn` is the first of them. */
  sessions: v.array(checkInDocValidator),
  staffId: v.id("staffUsers"),
  timeZone: v.string(),
});

/**
 * Managers see each signal's outcome and reason, not the person's network
 * prefix. Prefixes are only aggregated for Admins in the pilot overview.
 */
function withoutNetworkPrefixes(checkIn: CheckInDoc) {
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
    const [actor, staff, offices, rules, records] = await Promise.all([
      actorStaff(ctx, access),
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
    const sessionsByStaff = new Map<Id<"staffUsers">, CheckInDoc[]>();
    for (const record of records) {
      const sessions = sessionsByStaff.get(record.staffId);
      if (sessions) {
        sessions.push(record);
      } else {
        sessionsByStaff.set(record.staffId, [record]);
      }
    }
    const overseen = staff.filter((member) => canOversee(access, actor, member));
    // Someone who oversees others also sees their own row, read-only: nobody reviews or
    // corrects their own record, so it never gets canReview.
    const self =
      (isOverseer(access) || overseen.length > 0) && actor?.active
        ? [{ canReview: false, member: actor }]
        : [];
    const listed = [...overseen.map((member) => ({ canReview: true, member })), ...self];
    const visibleOfficeIds = new Set(
      canOverseeAllOffices(access)
        ? offices.map((office) => office._id)
        : listed.flatMap(({ member }) => (member.officeId ? [member.officeId] : []))
    );
    const rows = listed
      .flatMap(({ canReview, member }) => {
        if (args.officeId && member.officeId !== args.officeId) {
          return [];
        }
        const sessions = (sessionsByStaff.get(member._id) ?? [])
          .sort(newestFirst)
          .slice(0, SESSIONS_PER_DAY_LIMIT)
          .map(withoutNetworkPrefixes);
        const checkIn = sessions[0] ?? null;
        const officeId = checkIn?.officeId ?? member.officeId ?? null;
        return [
          {
            canReview,
            checkIn,
            department: member.department ?? null,
            name: member.name,
            officeId,
            officeName: officeId ? (officeNames.get(officeId) ?? null) : null,
            sessions,
            staffId: member._id,
            timeZone: (officeId && timeZones.get(officeId)) || DEFAULT_OFFICE_TIME_ZONE,
          },
        ];
      })
      .sort((left, right) => left.name.localeCompare(right.name));
    return {
      offices: offices.flatMap((office) =>
        visibleOfficeIds.has(office._id)
          ? [
              {
                id: office._id,
                name: office.name,
                timeZone: timeZones.get(office._id) ?? DEFAULT_OFFICE_TIME_ZONE,
              },
            ]
          : []
      ),
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
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    const checkIn = await requireOverseenCheckIn(ctx, access, args.checkInId);
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

/**
 * A session's times may not overlap another session of the same person on
 * the same work date. An open session runs until it is closed.
 */
function assertNoOverlap(
  others: readonly CheckInDoc[],
  times: { clockInAt: number; clockOutAt: number | null }
) {
  const end = times.clockOutAt ?? Number.POSITIVE_INFINITY;
  const overlaps = others.some((other) => {
    const otherEnd = other.clockOutAt ?? Number.POSITIVE_INFINITY;
    return times.clockInAt < otherEnd && other.clockInAt < end;
  });
  if (overlaps) {
    throw new ConvexError("These times overlap another session on this day.");
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
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    const checkIn = await requireOverseenCheckIn(ctx, access, args.checkInId);
    if (args.clockOutAt === null && checkIn.status === "closed") {
      const otherOpen = await ctx.db
        .query("officeCheckIns")
        .withIndex("by_staffId_and_workDate", (q) => q.eq("staffId", checkIn.staffId))
        .order("desc")
        .take(SESSIONS_PER_DAY_LIMIT);
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
    const sameDay = await sessionsOn(ctx, checkIn.staffId, checkIn.workDate);
    assertNoOverlap(
      sameDay.filter((record) => record._id !== checkIn._id),
      { clockInAt: args.clockInAt, clockOutAt: args.clockOutAt }
    );
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
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    const { subject } = await requireOverseenStaff(ctx, access, args.staffId);
    if (!subject.active) {
      throw new ConvexError("This staff member is inactive.");
    }
    if (!subject.officeId) {
      throw new ConvexError("NO_OFFICE_ASSIGNED");
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
    // A day may already hold sessions; the entry must fit around them.
    const existing = await sessionsOn(ctx, subject._id, workDate);
    if (existing.length >= SESSIONS_PER_DAY_LIMIT) {
      throw new ConvexError("This day already has the most sessions one day can hold.");
    }
    assertNoOverlap(existing, { clockInAt: args.clockInAt, clockOutAt: args.clockOutAt });
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

/** Removes every audit row for one session, in bounded batches. */
async function eraseSessionHistory(ctx: MutationCtx, checkInId: Id<"officeCheckIns">) {
  for (let batch = 0; batch < ERASE_AUDIT_MAX_BATCHES; batch += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each batch reads what the previous one left.
    const rows = await ctx.db
      .query("officeCheckInAudit")
      .withIndex("by_checkInId", (q) => q.eq("checkInId", checkInId))
      .take(ERASE_AUDIT_BATCH);
    if (rows.length === 0) {
      return;
    }
    await Promise.all(rows.map((row) => ctx.db.delete("officeCheckInAudit", row._id)));
  }
  // Leaving part of the history would break "nothing remains"; abort instead.
  throw new ConvexError("This session has too much history to delete in one step.");
}

/**
 * Delete one session (owner decision 2026-11-06). Admin erases the session and
 * its history completely, their own sessions included. Directors delete a
 * session they oversee, never their own, with a reason; a `record_deleted`
 * audit row and the session's earlier history stay. Everyone else is refused.
 */
export const deleteCheckIn = mutation({
  args: { checkInId: v.id("officeCheckIns"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const mode = deletionModeFor(access);
    if (!access.staffId) {
      throw new ConvexError("NO_STAFF_PROFILE");
    }
    if (!mode) {
      throw new ConvexError("FORBIDDEN");
    }
    const reason = mode === "trail" ? requireReason(args.reason ?? "") : null;
    const checkIn = await ctx.db.get("officeCheckIns", args.checkInId);
    if (!checkIn) {
      throw new ConvexError("CHECK_IN_NOT_FOUND");
    }
    if (mode === "erase") {
      await eraseSessionHistory(ctx, checkIn._id);
      await ctx.db.delete("officeCheckIns", checkIn._id);
      return { mode };
    }
    // canOversee refuses the caller's own record, so Directors never delete their own.
    const { subject } = await requireOverseenStaff(ctx, access, checkIn.staffId, checkIn.officeId);
    const timeZone = await timeZoneForOffice(ctx, checkIn.officeId);
    await ctx.db.delete("officeCheckIns", checkIn._id);
    await audit(ctx, {
      ...actorFields(access),
      at: Date.now(),
      checkInId: checkIn._id,
      kind: "record_deleted",
      officeId: checkIn.officeId,
      reason: reason ?? undefined,
      subjectStaffId: checkIn.staffId,
      summary: `deleted ${subject.name}'s session on ${checkIn.workDate}: in ${formatTime(checkIn.clockInAt, timeZone)}, out ${formatTime(checkIn.clockOutAt, timeZone)}`,
    });
    return { mode };
  },
  returns: v.object({ mode: v.union(v.literal("erase"), v.literal("trail")) }),
});

/**
 * Audit trail for one record, visible to its overseers and to its owner. A
 * deleted record's trail stays readable from its audit rows.
 */
export const history = query({
  args: { checkInId: v.id("officeCheckIns") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const [checkIn, events] = await Promise.all([
      ctx.db.get("officeCheckIns", args.checkInId),
      ctx.db
        .query("officeCheckInAudit")
        .withIndex("by_checkInId", (q) => q.eq("checkInId", args.checkInId))
        .order("desc")
        .take(50),
    ]);
    const subjectStaffId =
      checkIn?.staffId ?? events.find((event) => event.subjectStaffId)?.subjectStaffId;
    if (!subjectStaffId) {
      return [];
    }
    if (access.staffId !== subjectStaffId) {
      const [actor, subject] = await Promise.all([
        actorStaff(ctx, access),
        ctx.db.get("staffUsers", subjectStaffId),
      ]);
      const officeId = checkIn?.officeId ?? events.find((event) => event.officeId)?.officeId;
      if (!(subject && canOversee(access, actor, subject, officeId ?? subject.officeId))) {
        throw new ConvexError("FORBIDDEN");
      }
    }
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
