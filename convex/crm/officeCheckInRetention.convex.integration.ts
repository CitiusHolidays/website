import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import {
  AUDIT_RETENTION_PAGE_SIZE,
  CHECK_IN_RETENTION_BATCH_SIZE,
  OFFICE_CHECK_IN_RETENTION_DAYS,
  RETAINED_CONFIGURATION_AUDIT_KINDS,
  retainedWorkDateFrom,
} from "./officeCheckInRetention";

// Synthetic fixtures only: made-up office and test-domain staff.

// 11:30 IST on 5 November 2026.
const NOW = new Date("2026-11-05T06:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIT_CUTOFF = NOW.getTime() - OFFICE_CHECK_IN_RETENTION_DAYS * DAY_MS;
// 5 November minus 92 days is 5 August; that work date is still retained.
const FIRST_RETAINED_WORK_DATE = "2026-08-05";
const LAST_EXPIRED_WORK_DATE = "2026-08-04";

type AuditKind = Doc<"officeCheckInAudit">["kind"];
type Harness = ReturnType<typeof createHarness>;

const ATTENDANCE_KINDS: AuditKind[] = [
  "clock_in",
  "clock_in_retry",
  "clock_out",
  "review_accepted",
  "review_rejected",
  "times_corrected",
  "manual_entry",
  "office_assigned",
];

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

async function seedOfficeAndStaff(t: Harness) {
  return await t.run(async (ctx) => {
    const officeId = await ctx.db.insert("offices", {
      active: true,
      city: "Delhi",
      code: "DEL",
      createdAt: NOW.getTime(),
      name: "Delhi HQ",
      updatedAt: NOW.getTime(),
    });
    const staffId = await ctx.db.insert("staffUsers", {
      active: true,
      authUserId: "https://auth.citius.test|retention_staff",
      createdAt: NOW.getTime(),
      email: "retention_staff@citius.test",
      emailNormalized: "retention_staff@citius.test",
      name: "Retention Staff",
      officeId,
      roles: ["Sales"],
      updatedAt: NOW.getTime(),
    });
    return { officeId, staffId };
  });
}

function checkInFixture(
  officeId: Id<"offices">,
  staffId: Id<"staffUsers">,
  workDate: string
): Omit<Doc<"officeCheckIns">, "_creationTime" | "_id"> {
  const at = Date.parse(`${workDate}T04:00:00.000Z`);
  return {
    admission: "admitted",
    clockIn: {
      enforcementMode: "report_only",
      evaluatedAt: at,
      outcome: "pass",
      requirement: "not_configured",
      wouldBlock: false,
    },
    clockInAt: at,
    createdAt: at,
    officeId,
    source: "self",
    staffId,
    status: "closed",
    updatedAt: at,
    workDate,
  };
}

function auditFixture(
  officeId: Id<"offices">,
  staffId: Id<"staffUsers">,
  kind: AuditKind,
  at: number
): Omit<Doc<"officeCheckInAudit">, "_creationTime" | "_id"> {
  return {
    actorName: "Retention Staff",
    actorStaffId: staffId,
    at,
    kind,
    officeId,
    subjectStaffId: staffId,
    summary: `Synthetic ${kind} event`,
  };
}

function isoDate(daysBeforeCutoff: number) {
  return new Date(Date.parse(`${LAST_EXPIRED_WORK_DATE}T00:00:00.000Z`) - daysBeforeCutoff * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

async function tableSnapshot(t: Harness) {
  return await t.run(async (ctx) => ({
    audit: await ctx.db.query("officeCheckInAudit").collect(),
    checkIns: await ctx.db.query("officeCheckIns").collect(),
  }));
}

describe("office check-in retention cutoffs", () => {
  test("retains 92 calendar days of work dates in the office default time zone", () => {
    expect(retainedWorkDateFrom(NOW.getTime())).toBe(FIRST_RETAINED_WORK_DATE);
    // 23:59:59.999 IST on 4 November is still the 4 November work date.
    expect(retainedWorkDateFrom(Date.parse("2026-11-04T18:29:59.999Z"))).toBe("2026-08-04");
    // 00:00 IST on 5 November moves the cutoff forward one day.
    expect(retainedWorkDateFrom(Date.parse("2026-11-04T18:30:00.000Z"))).toBe("2026-08-05");
    // Month and leap-year arithmetic stays on calendar dates.
    expect(retainedWorkDateFrom(Date.parse("2028-05-31T06:00:00.000Z"))).toBe("2028-02-29");
  });

  test("keeps only configuration audit kinds", () => {
    expect([...RETAINED_CONFIGURATION_AUDIT_KINDS].sort()).toEqual([
      "office_created",
      "rule_saved",
    ]);
  });
});

describe("office check-in retention purge", () => {
  test("deletes expired attendance data, keeps recent rows and configuration history", async () => {
    const t = createHarness();
    const { officeId, staffId } = await seedOfficeAndStaff(t);
    const ids = await t.run(async (ctx) => {
      const expiredCheckIn = await ctx.db.insert(
        "officeCheckIns",
        checkInFixture(officeId, staffId, LAST_EXPIRED_WORK_DATE)
      );
      const boundaryCheckIn = await ctx.db.insert(
        "officeCheckIns",
        checkInFixture(officeId, staffId, FIRST_RETAINED_WORK_DATE)
      );
      const todayCheckIn = await ctx.db.insert(
        "officeCheckIns",
        checkInFixture(officeId, staffId, "2026-11-05")
      );
      const expiredAttendance = await Promise.all(
        ATTENDANCE_KINDS.map((kind) =>
          ctx.db.insert(
            "officeCheckInAudit",
            auditFixture(officeId, staffId, kind, AUDIT_CUTOFF - 1)
          )
        )
      );
      const expiredConfiguration = await Promise.all(
        (["rule_saved", "office_created"] as const).map((kind) =>
          ctx.db.insert(
            "officeCheckInAudit",
            auditFixture(officeId, staffId, kind, AUDIT_CUTOFF - DAY_MS)
          )
        )
      );
      const boundaryAttendance = await ctx.db.insert(
        "officeCheckInAudit",
        auditFixture(officeId, staffId, "clock_in", AUDIT_CUTOFF)
      );
      return {
        boundaryAttendance,
        boundaryCheckIn,
        expiredAttendance,
        expiredCheckIn,
        expiredConfiguration,
        todayCheckIn,
      };
    });

    const result = await t.mutation(internal.crm.officeCheckInRetention.purgeExpired, {});

    expect(result).toEqual({
      deletedAuditEvents: ATTENDANCE_KINDS.length,
      deletedCheckIns: 1,
      scheduledContinuation: false,
    });
    const after = await tableSnapshot(t);
    expect(after.checkIns.map((row) => row._id).sort()).toEqual(
      [ids.boundaryCheckIn, ids.todayCheckIn].sort()
    );
    expect(after.audit.map((row) => row._id).sort()).toEqual(
      [...ids.expiredConfiguration, ids.boundaryAttendance].sort()
    );
    const expiredAttendance = new Set(ids.expiredAttendance);
    expect(after.audit.some((row) => expiredAttendance.has(row._id))).toBe(false);
    expect(after.checkIns.some((row) => row._id === ids.expiredCheckIn)).toBe(false);
  });

  test("continues across scheduled batches while check-ins happen, then a rerun is a no-op", async () => {
    const t = createHarness();
    const { officeId, staffId } = await seedOfficeAndStaff(t);
    const expiredCheckIns = CHECK_IN_RETENTION_BATCH_SIZE * 2 + 30;
    const expiredAuditEvents = AUDIT_RETENTION_PAGE_SIZE * 2 + 40;
    const retainedConfigurationEvents = 25;
    await t.run(async (ctx) => {
      for (let index = 0; index < expiredCheckIns; index += 1) {
        await ctx.db.insert(
          "officeCheckIns",
          checkInFixture(officeId, staffId, isoDate(index % 60))
        );
      }
      for (let index = 0; index < expiredAuditEvents; index += 1) {
        const kind = ATTENDANCE_KINDS[index % ATTENDANCE_KINDS.length] ?? "clock_in";
        await ctx.db.insert(
          "officeCheckInAudit",
          auditFixture(officeId, staffId, kind, AUDIT_CUTOFF - 1 - index * 60_000)
        );
      }
      // Configuration history sits at the head of the expired range so a
      // cursorless scan would stall on it.
      for (let index = 0; index < retainedConfigurationEvents; index += 1) {
        await ctx.db.insert(
          "officeCheckInAudit",
          auditFixture(
            officeId,
            staffId,
            index % 2 === 0 ? "rule_saved" : "office_created",
            AUDIT_CUTOFF - 200 * DAY_MS + index
          )
        );
      }
    });

    const first = await t.mutation(internal.crm.officeCheckInRetention.purgeExpired, {});
    expect(first.scheduledContinuation).toBe(true);
    expect(first.deletedCheckIns).toBe(CHECK_IN_RETENTION_BATCH_SIZE);
    expect(first.deletedAuditEvents).toBeLessThanOrEqual(AUDIT_RETENTION_PAGE_SIZE);

    // A clock-in landing between batches is outside both cutoffs and survives.
    const liveIds = await t.run(async (ctx) => ({
      audit: await ctx.db.insert(
        "officeCheckInAudit",
        auditFixture(officeId, staffId, "clock_in", NOW.getTime())
      ),
      checkIn: await ctx.db.insert(
        "officeCheckIns",
        checkInFixture(officeId, staffId, "2026-11-05")
      ),
    }));

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const after = await tableSnapshot(t);
    expect(after.checkIns.map((row) => row._id)).toEqual([liveIds.checkIn]);
    expect(after.audit).toHaveLength(retainedConfigurationEvents + 1);
    expect(after.audit.some((row) => row._id === liveIds.audit)).toBe(true);
    expect(
      after.audit
        .filter((row) => row._id !== liveIds.audit)
        .every((row) => RETAINED_CONFIGURATION_AUDIT_KINDS.has(row.kind))
    ).toBe(true);

    const rerun = await t.mutation(internal.crm.officeCheckInRetention.purgeExpired, {});
    expect(rerun).toEqual({
      deletedAuditEvents: 0,
      deletedCheckIns: 0,
      scheduledContinuation: false,
    });
    expect(await tableSnapshot(t)).toEqual(after);
  });
});
