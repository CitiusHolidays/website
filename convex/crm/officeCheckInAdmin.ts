import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, query } from "../_generated/server";
import { PERMISSIONS } from "./lib/rolePolicy";
import { type PortalAccess, requireStaff } from "./lib/staffAccess";
import { requireReason, ruleForOffice } from "./officeCheckInAccess";
import {
  checkInRequirementValidator,
  enforcementModeValidator,
  geofenceRuleValidator,
  networkEntryValidator,
  officeCheckInTables,
} from "./officeCheckInValidators";
import { DEFAULT_OFFICE_TIME_ZONE, validateBranchRule } from "./officeCheckInVerification";

const OFFICE_LIMIT = 100;
const STAFF_SCAN_LIMIT = 1000;
const OBSERVATION_SCAN_LIMIT = 500;
const OFFICE_CODE_PATTERN = /^[A-Z0-9-]{2,12}$/;

const ruleDocValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("officeCheckInRules"),
  ...officeCheckInTables.officeCheckInRules,
});

function actorFields(access: PortalAccess) {
  return {
    actorName: access.name,
    actorStaffId: access.staffId,
  };
}

async function audit(
  ctx: MutationCtx,
  entry: Omit<Doc<"officeCheckInAudit">, "_creationTime" | "_id">
) {
  await ctx.db.insert("officeCheckInAudit", entry);
}

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Admin view of every office's rule, staff assignment and the network
 * prefixes seen during the pilot that did not match an office range.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const [offices, rules, staff, recentCheckIns, recentAudit] = await Promise.all([
      ctx.db.query("offices").take(OFFICE_LIMIT),
      ctx.db.query("officeCheckInRules").take(OFFICE_LIMIT),
      ctx.db
        .query("staffUsers")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(STAFF_SCAN_LIMIT),
      ctx.db
        .query("officeCheckIns")
        .withIndex("by_workDate")
        .order("desc")
        .take(OBSERVATION_SCAN_LIMIT),
      ctx.db.query("officeCheckInAudit").withIndex("by_at").order("desc").take(25),
    ]);
    const rulesByOffice = new Map(rules.map((rule) => [rule.officeId, rule]));
    const assignedCounts = new Map<Id<"offices">, number>();
    for (const member of staff) {
      if (member.officeId) {
        assignedCounts.set(member.officeId, (assignedCounts.get(member.officeId) ?? 0) + 1);
      }
    }
    const observations = new Map<
      string,
      {
        count: number;
        lastWorkDate: string;
        officeId: Id<"offices">;
        prefix: string;
        reasons: Set<string>;
      }
    >();
    for (const record of recentCheckIns) {
      for (const signal of [record.clockIn.network, record.clockOut?.network]) {
        if (!signal?.observedPrefix || signal.reason === "matched_office") {
          continue;
        }
        const key = `${record.officeId}|${signal.observedPrefix}`;
        const current = observations.get(key) ?? {
          count: 0,
          lastWorkDate: record.workDate,
          officeId: record.officeId,
          prefix: signal.observedPrefix,
          reasons: new Set<string>(),
        };
        current.count += 1;
        current.reasons.add(signal.reason);
        if (record.workDate > current.lastWorkDate) {
          current.lastWorkDate = record.workDate;
        }
        observations.set(key, current);
      }
    }
    return {
      offices: offices
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((office) => ({
          active: office.active,
          assignedStaff: assignedCounts.get(office._id) ?? 0,
          city: office.city ?? null,
          code: office.code,
          id: office._id,
          name: office.name,
          rule: rulesByOffice.get(office._id) ?? null,
        })),
      recentAudit: recentAudit.map((event) => ({
        actorName: event.actorName,
        at: event.at,
        id: event._id,
        kind: event.kind,
        reason: event.reason ?? null,
        summary: event.summary,
      })),
      staff: staff
        .map((member) => ({
          freeTextLocation: member.location ?? null,
          id: member._id,
          name: member.name,
          officeId: member.officeId ?? null,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      unmatchedNetworks: [...observations.values()]
        .map(({ reasons, ...observation }) => ({ ...observation, reasons: [...reasons].sort() }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 30),
    };
  },
  returns: v.object({
    offices: v.array(
      v.object({
        active: v.boolean(),
        assignedStaff: v.number(),
        city: v.union(v.string(), v.null()),
        code: v.string(),
        id: v.id("offices"),
        name: v.string(),
        rule: v.union(ruleDocValidator, v.null()),
      })
    ),
    recentAudit: v.array(
      v.object({
        actorName: v.string(),
        at: v.number(),
        id: v.id("officeCheckInAudit"),
        kind: officeCheckInTables.officeCheckInAudit.kind,
        reason: v.union(v.string(), v.null()),
        summary: v.string(),
      })
    ),
    staff: v.array(
      v.object({
        freeTextLocation: v.union(v.string(), v.null()),
        id: v.id("staffUsers"),
        name: v.string(),
        officeId: v.union(v.id("offices"), v.null()),
      })
    ),
    unmatchedNetworks: v.array(
      v.object({
        count: v.number(),
        lastWorkDate: v.string(),
        officeId: v.id("offices"),
        prefix: v.string(),
        reasons: v.array(v.string()),
      })
    ),
  }),
});

export const createOffice = mutation({
  args: { city: v.optional(v.string()), code: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const code = args.code.trim().toUpperCase();
    const name = args.name.trim();
    const city = args.city?.trim();
    if (!(OFFICE_CODE_PATTERN.test(code) && name.length >= 2 && name.length <= 80)) {
      throw new ConvexError("Use a 2-12 character code (letters, digits, dashes) and a name.");
    }
    const duplicate = await ctx.db
      .query("offices")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (duplicate) {
      throw new ConvexError("An office with this code already exists.");
    }
    const now = Date.now();
    const officeId = await ctx.db.insert("offices", {
      active: true,
      city: city || undefined,
      code,
      createdAt: now,
      name,
      updatedAt: now,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      kind: "office_created",
      officeId,
      summary: `created office ${code} ${name}`,
    });
    return officeId;
  },
  returns: v.id("offices"),
});

function describeRule(rule: {
  enforcementMode: string;
  geofence?: { maxAccuracyMeters: number; radiusMeters: number } | null;
  networks: unknown[];
  requirement: string;
  timeZone: string;
}) {
  const geofence = rule.geofence
    ? `geofence ${rule.geofence.radiusMeters}m, accuracy <= ${rule.geofence.maxAccuracyMeters}m`
    : "no geofence";
  return `${rule.requirement}, ${rule.enforcementMode}, ${rule.networks.length} network ranges, ${geofence}, ${rule.timeZone}`;
}

/**
 * Save an office's verification rule. Switching to blocking requires an
 * explicit confirmation; every save is audited with its reason.
 */
export const saveRule = mutation({
  args: {
    confirmEnforcement: v.boolean(),
    enforcementMode: enforcementModeValidator,
    expectedVersion: v.union(v.number(), v.null()),
    geofence: v.union(geofenceRuleValidator, v.null()),
    networks: v.array(networkEntryValidator),
    officeId: v.id("offices"),
    reason: v.string(),
    requirement: checkInRequirementValidator,
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const reason = requireReason(args.reason);
    const office = await ctx.db.get("offices", args.officeId);
    if (!office) {
      throw new ConvexError("Office not found.");
    }
    const timeZone = args.timeZone.trim() || DEFAULT_OFFICE_TIME_ZONE;
    if (!isTimeZone(timeZone)) {
      throw new ConvexError("Unknown time zone.");
    }
    const networks = args.networks.map((entry) => ({
      cidr: entry.cidr.trim(),
      kind: entry.kind,
      label: entry.label.trim(),
    }));
    const problems = validateBranchRule({
      enforcementMode: args.enforcementMode,
      geofence: args.geofence,
      networks,
      requirement: args.requirement,
    });
    if (problems.length > 0) {
      throw new ConvexError(problems.join(" "));
    }
    const existing = await ruleForOffice(ctx, office._id);
    if ((existing?.version ?? null) !== args.expectedVersion) {
      throw new ConvexError("This rule changed since you opened it. Reload and try again.");
    }
    // Any save that leaves an office blocking (turning it on, or changing an
    // already-enforcing rule) needs explicit confirmation.
    if (args.enforcementMode === "enforce" && !args.confirmEnforcement) {
      throw new ConvexError("ENFORCEMENT_CONFIRMATION_REQUIRED");
    }
    const now = Date.now();
    const next = {
      enforcementMode: args.enforcementMode,
      geofence: args.geofence ?? undefined,
      networks,
      officeId: office._id,
      requirement: args.requirement,
      timeZone,
      updatedAt: now,
      updatedByStaffId: access.staffId,
      version: (existing?.version ?? 0) + 1,
    };
    if (existing) {
      await ctx.db.replace("officeCheckInRules", existing._id, next);
    } else {
      await ctx.db.insert("officeCheckInRules", next);
    }
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      kind: "rule_saved",
      officeId: office._id,
      reason,
      summary: `${office.code} v${next.version}: ${existing ? `${describeRule(existing)} -> ` : ""}${describeRule(next)}`,
    });
    return next.version;
  },
  returns: v.number(),
});

/** Assign a staff member to the office whose rule applies when they clock in. */
export const assignStaffOffice = mutation({
  args: {
    officeId: v.union(v.id("offices"), v.null()),
    reason: v.string(),
    staffId: v.id("staffUsers"),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    const reason = requireReason(args.reason);
    const member = await ctx.db.get("staffUsers", args.staffId);
    if (!member) {
      throw new ConvexError("Staff member not found.");
    }
    const office = args.officeId ? await ctx.db.get("offices", args.officeId) : null;
    if (args.officeId && !office) {
      throw new ConvexError("Office not found.");
    }
    const previous = member.officeId ? await ctx.db.get("offices", member.officeId) : null;
    const now = Date.now();
    await ctx.db.patch("staffUsers", member._id, {
      officeId: office?._id,
      updatedAt: now,
    });
    await audit(ctx, {
      ...actorFields(access),
      at: now,
      kind: "office_assigned",
      officeId: office?._id,
      reason,
      subjectStaffId: member._id,
      summary: `${member.name}: ${previous?.code ?? "none"} -> ${office?.code ?? "none"}`,
    });
    return null;
  },
  returns: v.null(),
});
