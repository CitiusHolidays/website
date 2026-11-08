import type { FunctionArgs, WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

// Synthetic fixtures only: documentation IP ranges (RFC 5737 / RFC 3849),
// made-up office coordinates and test-domain staff.

const ISSUER = "https://auth.citius.test";
const GATEWAY_SECRET = "office-check-in-integration-secret";
// 11:30 IST on 30 March 2026.
const NOW = new Date("2026-03-30T06:00:00.000Z");
const WORK_DATE = "2026-03-30";
const DELHI_GEOFENCE = {
  latitude: 28.6139,
  longitude: 77.209,
  maxAccuracyMeters: 50,
  radiusMeters: 100,
};
const IN_OFFICE_IP = "203.0.113.42";
const HOME_IP = "100.64.3.77";
const VPN_IP = "192.0.2.15";
const IN_FENCE = {
  accuracyMeters: 12,
  capturedAt: NOW.getTime() - 4000,
  kind: "position" as const,
  latitude: 28.613_92,
  longitude: 77.209_03,
};
const NO_LOCATION = { kind: "not_requested" as const };
const LOCATION_DENIED = { code: "permission_denied" as const, kind: "error" as const };
const BOOTSTRAP_EMAIL = "bootstrap@citius.test";

type LocationArg = FunctionArgs<typeof api.crm.officeCheckIns.clockInViaGateway>["location"];

type Harness = ReturnType<typeof createHarness>;

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

function identity(subject: string) {
  return {
    email: `${subject}@citius.test`,
    issuer: ISSUER,
    subject,
    tokenIdentifier: `${ISSUER}|${subject}`,
  };
}

interface StaffFixture {
  active?: boolean;
  department?: string;
  officeId?: Id<"offices">;
  reportsTo?: Id<"staffUsers">;
  roles: Doc<"staffUsers">["roles"];
  subject: string;
}

async function insertStaff(t: Harness, fixture: StaffFixture) {
  const member: WithoutSystemFields<Doc<"staffUsers">> = {
    active: fixture.active ?? true,
    authUserId: `${ISSUER}|${fixture.subject}`,
    createdAt: NOW.getTime(),
    email: `${fixture.subject}@citius.test`,
    emailNormalized: `${fixture.subject}@citius.test`,
    name: fixture.subject,
    roles: fixture.roles,
    updatedAt: NOW.getTime(),
  };
  if (fixture.department) {
    member.department = fixture.department;
  }
  if (fixture.officeId) {
    member.officeId = fixture.officeId;
  }
  if (fixture.reportsTo) {
    member.reportingManagerStaffId = fixture.reportsTo;
  }
  return await t.run(async (ctx) => ctx.db.insert("staffUsers", member));
}

/**
 * Two offices and a cast that covers every oversight path:
 * - hr: HR, sees every office.
 * - admin: Admin, sees every office and manages rules.
 * - delhiHead / mumbaiHead: view:team holders scoped to their own office.
 * - mumbaiManager: plain Sales in Mumbai who manages one Delhi report.
 * - delhiReport: Delhi Sales reporting to mumbaiManager.
 * - delhiRep: Delhi Sales with no manager (also the "plain Sales" overseer).
 * - mumbaiRep: Mumbai Sales.
 * - unassigned: Sales with no office.
 */
async function seed(t: Harness) {
  const [delhi, mumbai] = await t.run(async (ctx) => {
    const base = { active: true, createdAt: NOW.getTime(), updatedAt: NOW.getTime() };
    return [
      await ctx.db.insert("offices", { ...base, city: "Delhi", code: "DEL", name: "Delhi HQ" }),
      await ctx.db.insert("offices", { ...base, city: "Mumbai", code: "BOM", name: "Mumbai" }),
    ];
  });
  const hr = await insertStaff(t, { officeId: delhi, roles: ["HR"], subject: "hr" });
  const admin = await insertStaff(t, { officeId: delhi, roles: ["Admin"], subject: "admin" });
  const delhiHead = await insertStaff(t, {
    officeId: delhi,
    roles: ["Sales Head"],
    subject: "delhi_head",
  });
  const mumbaiHead = await insertStaff(t, {
    officeId: mumbai,
    roles: ["Operations Head"],
    subject: "mumbai_head",
  });
  const mumbaiManager = await insertStaff(t, {
    officeId: mumbai,
    roles: ["Sales"],
    subject: "mumbai_manager",
  });
  const delhiReport = await insertStaff(t, {
    officeId: delhi,
    reportsTo: mumbaiManager,
    roles: ["Sales"],
    subject: "delhi_report",
  });
  const delhiRep = await insertStaff(t, {
    officeId: delhi,
    roles: ["Sales"],
    subject: "delhi_rep",
  });
  const mumbaiRep = await insertStaff(t, {
    officeId: mumbai,
    roles: ["Sales"],
    subject: "mumbai_rep",
  });
  const unassigned = await insertStaff(t, { roles: ["Sales"], subject: "unassigned" });
  return {
    offices: { delhi, mumbai },
    staff: {
      admin,
      delhiHead,
      delhiRep,
      delhiReport,
      hr,
      mumbaiHead,
      mumbaiManager,
      mumbaiRep,
      unassigned,
    },
  };
}

async function seedRule(
  t: Harness,
  officeId: Id<"offices">,
  overrides: Partial<Doc<"officeCheckInRules">> = {}
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("officeCheckInRules", {
      enforcementMode: "report_only",
      geofence: DELHI_GEOFENCE,
      networks: [
        { cidr: "203.0.113.0/24", kind: "office", label: "Delhi LAN" },
        { cidr: "192.0.2.0/24", kind: "vpn_or_proxy_exit", label: "Corp VPN" },
      ],
      officeId,
      requirement: "network",
      timeZone: "Asia/Kolkata",
      updatedAt: NOW.getTime(),
      version: 1,
      ...overrides,
    });
  });
}

function as(t: Harness, subject: string) {
  return t.withIdentity(identity(subject));
}

function clockIn(
  t: Harness,
  subject: string,
  observedIp: string | null = IN_OFFICE_IP,
  location: LocationArg = NO_LOCATION
) {
  return as(t, subject).mutation(api.crm.officeCheckIns.clockInViaGateway, {
    gatewaySecret: GATEWAY_SECRET,
    location,
    observedIp,
  });
}

function clockOut(t: Harness, subject: string, observedIp: string | null = IN_OFFICE_IP) {
  return as(t, subject).mutation(api.crm.officeCheckIns.clockOutViaGateway, {
    gatewaySecret: GATEWAY_SECRET,
    location: NO_LOCATION,
    observedIp,
  });
}

async function allCheckIns(t: Harness) {
  return await t.run(async (ctx) => ctx.db.query("officeCheckIns").collect());
}

async function auditFor(t: Harness, kind: Doc<"officeCheckInAudit">["kind"]) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("officeCheckInAudit").collect()).filter((event) => event.kind === kind)
  );
}

function teamDay(t: Harness, subject: string, officeId?: Id<"offices">) {
  const args: FunctionArgs<typeof api.crm.officeCheckIns.teamDay> = { workDate: WORK_DATE };
  if (officeId) {
    args.officeId = officeId;
  }
  return as(t, subject).query(api.crm.officeCheckIns.teamDay, args);
}

function sorted<Value extends string>(values: Value[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function namesIn(result: { rows: Array<{ name: string }> }) {
  return sorted(result.rows.map((row) => row.name));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.OFFICE_CHECK_IN_GATEWAY_SECRET = GATEWAY_SECRET;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.OFFICE_CHECK_IN_GATEWAY_SECRET;
  delete process.env.PORTAL_BOOTSTRAP_ADMINS;
  delete process.env.PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT;
});

describe("Gateway and caller authorization", () => {
  test("Refuses a wrong secret, a missing server secret, anonymous and non-staff callers", async () => {
    const t = createHarness();
    await seed(t);
    const args = { location: NO_LOCATION, observedIp: IN_OFFICE_IP };

    await expect(
      as(t, "delhi_rep").mutation(api.crm.officeCheckIns.clockInViaGateway, {
        ...args,
        gatewaySecret: "not-the-secret",
      })
    ).rejects.toThrow("GATEWAY_MISCONFIGURED");
    await expect(
      as(t, "delhi_rep").mutation(api.crm.officeCheckIns.clockInViaGateway, {
        ...args,
        gatewaySecret: `${GATEWAY_SECRET}x`,
      })
    ).rejects.toThrow("GATEWAY_MISCONFIGURED");
    await expect(
      as(t, "delhi_rep").mutation(api.crm.officeCheckIns.clockOutViaGateway, {
        ...args,
        gatewaySecret: "",
      })
    ).rejects.toThrow("GATEWAY_MISCONFIGURED");

    // The browser cannot reach the mutation without the server's secret, and a
    // deployment without the secret configured fails closed.
    delete process.env.OFFICE_CHECK_IN_GATEWAY_SECRET;
    for (const gatewaySecret of ["", GATEWAY_SECRET]) {
      await expect(
        as(t, "delhi_rep").mutation(api.crm.officeCheckIns.clockInViaGateway, {
          ...args,
          gatewaySecret,
        })
      ).rejects.toThrow("GATEWAY_MISCONFIGURED");
    }
    process.env.OFFICE_CHECK_IN_GATEWAY_SECRET = GATEWAY_SECRET;

    await expect(
      t.mutation(api.crm.officeCheckIns.clockInViaGateway, {
        ...args,
        gatewaySecret: GATEWAY_SECRET,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(clockIn(t, "not_a_staff_member")).rejects.toThrow("FORBIDDEN");
    await expect(t.query(api.crm.officeCheckIns.teamDay, { workDate: WORK_DATE })).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(
      t.query(api.crm.officeCheckIns.myStatus, { referenceNow: NOW.getTime() })
    ).rejects.toThrow("FORBIDDEN");

    expect(await allCheckIns(t)).toEqual([]);
  });

  test("Refuses staff with no office and staff whose office is inactive", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await expect(clockIn(t, "unassigned")).rejects.toThrow("NO_OFFICE_ASSIGNED");
    await t.run(async (ctx) => ctx.db.patch("offices", offices.mumbai, { active: false }));
    await expect(clockIn(t, "mumbai_rep")).rejects.toThrow("OFFICE_INACTIVE");
    expect(await allCheckIns(t)).toEqual([]);
  });
});

describe("Clock-in evidence", () => {
  test("Records server time, branch, rule and outcome; no rule is uncertain but admitted", async () => {
    const t = createHarness();
    const { offices, staff } = await seed(t);
    const { checkIn, replayed } = await clockIn(t, "mumbai_rep", HOME_IP);
    expect(replayed).toBe(false);
    expect(checkIn).toMatchObject({
      admission: "admitted",
      clockIn: {
        enforcementMode: "report_only",
        evaluatedAt: NOW.getTime(),
        outcome: "uncertain",
        requirement: "not_configured",
        wouldBlock: false,
      },
      clockInAt: NOW.getTime(),
      officeId: offices.mumbai,
      source: "self",
      staffId: staff.mumbaiRep,
      status: "open",
      workDate: WORK_DATE,
    });
    expect(checkIn.clockIn.network).toBeUndefined();
    expect(checkIn.clockIn.ruleVersion).toBeUndefined();
    const [event] = await auditFor(t, "clock_in");
    expect(event).toMatchObject({
      actorStaffId: staff.mumbaiRep,
      at: NOW.getTime(),
      checkInId: checkIn._id,
      officeId: offices.mumbai,
      subjectStaffId: staff.mumbaiRep,
    });
  });

  test("Report-only admits a failing network but records that it would block", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    expect(checkIn.admission).toBe("admitted");
    expect(checkIn.clockIn).toEqual({
      enforcementMode: "report_only",
      evaluatedAt: NOW.getTime(),
      network: {
        ipVersion: 4,
        observedPrefix: "100.64.3.0/24",
        outcome: "fail",
        reason: "outside_allowlist",
      },
      outcome: "fail",
      requirement: "network",
      ruleVersion: 1,
      wouldBlock: true,
    });
  });

  test("Enforce holds a failing or uncertain clock-in for review and admits a pass", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce" });
    const failed = await clockIn(t, "delhi_rep", HOME_IP);
    expect(failed.checkIn).toMatchObject({
      admission: "pending_review",
      clockIn: { enforcementMode: "enforce", outcome: "fail", wouldBlock: true },
    });
    const vpn = await clockIn(t, "delhi_report", VPN_IP);
    expect(vpn.checkIn).toMatchObject({
      admission: "pending_review",
      clockIn: {
        network: { matchedLabel: "Corp VPN", outcome: "uncertain", reason: "vpn_or_proxy_exit" },
        outcome: "uncertain",
      },
    });
    const missingIp = await clockIn(t, "delhi_head", null);
    expect(missingIp.checkIn).toMatchObject({
      admission: "pending_review",
      clockIn: { network: { outcome: "uncertain", reason: "ip_unavailable" } },
    });
    const passed = await clockIn(t, "hr", IN_OFFICE_IP);
    expect(passed.checkIn).toMatchObject({
      admission: "admitted",
      clockIn: {
        network: { matchedLabel: "Delhi LAN", outcome: "pass", reason: "matched_office" },
        outcome: "pass",
        wouldBlock: false,
      },
    });
  });

  test("Both-signals enforcement keeps a network pass without location pending", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, {
      enforcementMode: "enforce",
      requirement: "network_and_geofence",
    });
    const networkOnly = await clockIn(t, "delhi_rep", IN_OFFICE_IP, NO_LOCATION);
    expect(networkOnly.checkIn).toMatchObject({
      admission: "pending_review",
      clockIn: {
        geofence: { outcome: "uncertain", reason: "not_provided" },
        network: { outcome: "pass" },
        outcome: "uncertain",
      },
    });
    const both = await clockIn(t, "delhi_report", IN_OFFICE_IP, IN_FENCE);
    expect(both.checkIn).toMatchObject({
      admission: "admitted",
      clockIn: {
        geofence: { accuracyMeters: 10, distanceBand: "inside", outcome: "pass", reason: "inside" },
        outcome: "pass",
      },
    });
  });

  test("A reported accuracy of 0 m is an invalid reading, so the clock-in is uncertain", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { requirement: "geofence" });
    const { checkIn } = await clockIn(t, "delhi_rep", IN_OFFICE_IP, {
      ...IN_FENCE,
      accuracyMeters: 0,
    });
    expect(checkIn.clockIn).toEqual({
      enforcementMode: "report_only",
      evaluatedAt: NOW.getTime(),
      geofence: { outcome: "uncertain", reason: "invalid_reading" },
      outcome: "uncertain",
      requirement: "geofence",
      ruleVersion: 1,
      wouldBlock: true,
    });
  });

  test("Stored records and audit never contain raw coordinates or the full IP", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { requirement: "network_and_geofence" });
    await clockIn(t, "delhi_rep", HOME_IP, IN_FENCE);
    await clockOut(t, "delhi_rep", "2001:db8:abcd:12::99");
    const [record] = await allCheckIns(t);
    if (!record) {
      throw new Error("expected a check-in");
    }
    expect(sorted(Object.keys(record.clockIn.geofence ?? {}))).toEqual([
      "accuracyMeters",
      "distanceBand",
      "outcome",
      "reason",
    ]);
    expect(sorted(Object.keys(record.clockIn.network ?? {}))).toEqual([
      "ipVersion",
      "observedPrefix",
      "outcome",
      "reason",
    ]);
    expect(record.clockOut?.network).toMatchObject({
      ipVersion: 6,
      observedPrefix: "2001:db8:abcd::/48",
    });
    const audit = await t.run(async (ctx) => ctx.db.query("officeCheckInAudit").collect());
    const stored = JSON.stringify({ audit, record });
    for (const secret of [
      HOME_IP,
      "2001:db8:abcd:12::99",
      String(IN_FENCE.latitude),
      String(IN_FENCE.longitude),
      "latitude",
      "longitude",
    ]) {
      expect(stored).not.toContain(secret);
    }
  });
});

describe("Duplicate, concurrent and closing calls", () => {
  test("A repeated clock-in replays a passing record without re-evaluating", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce" });
    const first = await clockIn(t, "delhi_rep", IN_OFFICE_IP);
    expect(first.checkIn.clockIn.outcome).toBe("pass");
    vi.setSystemTime(NOW.getTime() + 60_000);
    // A worse signal on the repeat cannot downgrade a passing record.
    const second = await clockIn(t, "delhi_rep", HOME_IP);
    expect(second.replayed).toBe(true);
    expect(second.checkIn).toEqual(first.checkIn);
    expect(await allCheckIns(t)).toHaveLength(1);
    expect(await auditFor(t, "clock_in")).toHaveLength(1);
    expect(await auditFor(t, "clock_in_retry")).toEqual([]);
  });

  test("A repeated clock-in replays a reviewed record even when it did not pass", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce" });
    const first = await clockIn(t, "delhi_rep", HOME_IP);
    await as(t, "delhi_head").mutation(api.crm.officeCheckIns.review, {
      checkInId: first.checkIn._id,
      decision: "rejected",
      reason: "Not in the office",
    });
    const reviewed = await t.run(async (ctx) => ctx.db.get("officeCheckIns", first.checkIn._id));
    vi.setSystemTime(NOW.getTime() + 60_000);
    const second = await clockIn(t, "delhi_rep", IN_OFFICE_IP);
    expect(second.replayed).toBe(true);
    expect(second.checkIn).toEqual(reviewed);
    expect(second.checkIn).toMatchObject({ admission: "rejected", clockIn: { outcome: "fail" } });
    expect(await auditFor(t, "clock_in_retry")).toEqual([]);
  });

  test("An enforced clock-in denied location access is re-evaluated on retry and admitted", async () => {
    const t = createHarness();
    const { offices, staff } = await seed(t);
    await seedRule(t, offices.delhi, {
      enforcementMode: "enforce",
      requirement: "network_and_geofence",
    });
    const first = await clockIn(t, "delhi_rep", IN_OFFICE_IP, LOCATION_DENIED);
    expect(first.checkIn).toMatchObject({
      admission: "pending_review",
      clockIn: { geofence: { outcome: "uncertain", reason: "permission_denied" } },
    });

    // A second failed attempt replaces the evidence but stays held.
    vi.setSystemTime(NOW.getTime() + 30_000);
    const stillDenied = await clockIn(t, "delhi_rep", IN_OFFICE_IP, {
      code: "timeout",
      kind: "error",
    });
    expect(stillDenied.replayed).toBe(false);
    expect(stillDenied.checkIn).toMatchObject({
      admission: "pending_review",
      clockIn: { evaluatedAt: NOW.getTime() + 30_000, geofence: { reason: "timeout" } },
      clockInAt: NOW.getTime(),
    });

    vi.setSystemTime(NOW.getTime() + 60_000);
    const retried = await clockIn(t, "delhi_rep", IN_OFFICE_IP, IN_FENCE);
    expect(retried.replayed).toBe(false);
    expect(retried.checkIn).toMatchObject({
      _id: first.checkIn._id,
      admission: "admitted",
      clockIn: {
        enforcementMode: "enforce",
        evaluatedAt: NOW.getTime() + 60_000,
        geofence: { outcome: "pass", reason: "inside" },
        outcome: "pass",
        wouldBlock: false,
      },
      clockInAt: NOW.getTime(),
      status: "open",
    });
    expect(await allCheckIns(t)).toHaveLength(1);
    expect(await auditFor(t, "clock_in")).toHaveLength(1);
    const retries = await auditFor(t, "clock_in_retry");
    expect(retries).toHaveLength(2);
    const [, latestRetry] = retries;
    expect(latestRetry).toMatchObject({
      actorStaffId: staff.delhiRep,
      at: NOW.getTime() + 60_000,
      checkInId: first.checkIn._id,
      officeId: offices.delhi,
      subjectStaffId: staff.delhiRep,
    });

    // Once passing, a further clock-in is a replay with no new audit.
    const replay = await clockIn(t, "delhi_rep", HOME_IP);
    expect(replay.replayed).toBe(true);
    expect(await auditFor(t, "clock_in_retry")).toHaveLength(2);
  });

  test("Retry after a permission-denied first attempt leaves exactly two audit rows", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce", requirement: "geofence" });
    const first = await clockIn(t, "delhi_rep", null, LOCATION_DENIED);
    expect(first.checkIn.admission).toBe("pending_review");
    vi.setSystemTime(NOW.getTime() + 60_000);
    const retried = await clockIn(t, "delhi_rep", null, IN_FENCE);
    expect(retried).toMatchObject({
      checkIn: { admission: "admitted", clockIn: { outcome: "pass" }, clockInAt: NOW.getTime() },
      replayed: false,
    });
    const history = await as(t, "delhi_rep").query(api.crm.officeCheckIns.history, {
      checkInId: first.checkIn._id,
    });
    expect(sorted(history.map((event) => event.kind))).toEqual(["clock_in", "clock_in_retry"]);
  });

  test("Two concurrent clock-ins produce exactly one record", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const results = await Promise.all([clockIn(t, "delhi_rep"), clockIn(t, "delhi_rep")]);
    expect(results.filter((result) => result.replayed)).toHaveLength(1);
    expect(results[0]?.checkIn._id).toBe(results[1]?.checkIn._id);
    expect(await allCheckIns(t)).toHaveLength(1);
    expect(await auditFor(t, "clock_in")).toHaveLength(1);
    expect(await auditFor(t, "clock_in_retry")).toEqual([]);
  });

  test("Without a rule a repeated clock-in replays: there is nothing to re-check", async () => {
    const t = createHarness();
    await seed(t);
    const results = await Promise.all([clockIn(t, "delhi_rep"), clockIn(t, "delhi_rep")]);
    expect(results.map((result) => result.replayed)).toEqual([false, true]);
    expect(results[0]?.checkIn._id).toBe(results[1]?.checkIn._id);
    expect(await allCheckIns(t)).toHaveLength(1);
    expect(await auditFor(t, "clock_in")).toHaveLength(1);
    expect(await auditFor(t, "clock_in_retry")).toHaveLength(0);
  });

  test("Clock-out is never blocked: a failing signal still closes the session", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce" });
    const { checkIn } = await clockIn(t, "delhi_rep", IN_OFFICE_IP);
    vi.setSystemTime(NOW.getTime() + 8 * 60 * 60 * 1000);
    const closed = await clockOut(t, "delhi_rep", HOME_IP);
    expect(closed.replayed).toBe(false);
    expect(closed.checkIn).toMatchObject({
      _id: checkIn._id,
      admission: "admitted",
      clockOut: {
        enforcementMode: "report_only",
        network: { outcome: "fail", reason: "outside_allowlist" },
        outcome: "fail",
        wouldBlock: true,
      },
      clockOutAt: NOW.getTime() + 8 * 60 * 60 * 1000,
      status: "closed",
    });
    expect(await auditFor(t, "clock_out")).toHaveLength(1);

    // A second clock-out (double submit, second tab) replays the closed record.
    vi.setSystemTime(NOW.getTime() + 8 * 60 * 60 * 1000 + 5000);
    const again = await clockOut(t, "delhi_rep", IN_OFFICE_IP);
    expect(again.replayed).toBe(true);
    expect(again.checkIn).toEqual(closed.checkIn);
    expect(await auditFor(t, "clock_out")).toHaveLength(1);
    expect(await t.run(async (ctx) => ctx.db.get("officeCheckIns", checkIn._id))).toEqual(
      closed.checkIn
    );
  });

  test("A double clock-out today never closes an earlier forgotten session", async () => {
    const t = createHarness();
    await seed(t);
    vi.setSystemTime(new Date("2026-03-29T04:00:00.000Z"));
    const forgotten = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(NOW);
    const today = (await clockIn(t, "delhi_rep")).checkIn;
    expect([forgotten.workDate, today.workDate]).toEqual(["2026-03-29", WORK_DATE]);

    vi.setSystemTime(NOW.getTime() + 60 * 60 * 1000);
    const first = await clockOut(t, "delhi_rep");
    expect(first).toMatchObject({ checkIn: { _id: today._id, status: "closed" }, replayed: false });
    const second = await clockOut(t, "delhi_rep");
    expect(second).toMatchObject({ checkIn: { _id: today._id }, replayed: true });

    const earlier = await t.run(async (ctx) => ctx.db.get("officeCheckIns", forgotten._id));
    expect(earlier).toMatchObject({ status: "open" });
    expect(earlier?.clockOutAt).toBeUndefined();
    expect(await auditFor(t, "clock_out")).toHaveLength(1);
  });

  test("An earlier open session is closed only when today has no record", async () => {
    const t = createHarness();
    await seed(t);
    vi.setSystemTime(new Date("2026-03-29T04:00:00.000Z"));
    const forgotten = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(NOW);
    const closed = await clockOut(t, "delhi_rep");
    expect(closed).toMatchObject({
      checkIn: { _id: forgotten._id, clockOutAt: NOW.getTime(), status: "closed" },
      replayed: false,
    });
    expect(await allCheckIns(t)).toHaveLength(1);
    // Nothing is open any more and today has no record.
    await expect(clockOut(t, "delhi_rep")).rejects.toThrow("NOT_CLOCKED_IN");
    expect(await auditFor(t, "clock_out")).toHaveLength(1);
  });

  test("Clock-out without an open record is refused and writes nothing", async () => {
    const t = createHarness();
    await seed(t);
    await expect(clockOut(t, "delhi_rep")).rejects.toThrow("NOT_CLOCKED_IN");
    expect(await auditFor(t, "clock_out")).toEqual([]);
  });

  test("A clock-in after IST midnight starts a new work date", async () => {
    const t = createHarness();
    await seed(t);
    vi.setSystemTime(new Date("2026-03-30T18:29:00.000Z"));
    const late = await clockIn(t, "delhi_rep");
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(new Date("2026-03-30T18:31:00.000Z"));
    const next = await clockIn(t, "delhi_rep");
    expect([late.checkIn.workDate, next.checkIn.workDate]).toEqual(["2026-03-30", "2026-03-31"]);
  });
});

describe("Team day scoping", () => {
  async function seedDay(t: Harness, { withDelhiRule = false } = {}) {
    const seeded = await seed(t);
    if (withDelhiRule) {
      await seedRule(t, seeded.offices.delhi);
    }
    for (const subject of ["delhi_rep", "delhi_report", "mumbai_rep", "delhi_head", "hr"]) {
      await clockIn(t, subject);
    }
    return seeded;
  }

  test("HR and Admin see every active staff member in every office", async () => {
    const t = createHarness();
    const { offices } = await seedDay(t, { withDelhiRule: true });
    const everyone = [
      "admin",
      "delhi_head",
      "delhi_report",
      "delhi_rep",
      "hr",
      "mumbai_head",
      "mumbai_manager",
      "mumbai_rep",
      "unassigned",
    ];
    const hrView = await teamDay(t, "hr");
    // Their own row is listed too, read-only: nobody reviews their own record.
    expect(namesIn(hrView)).toEqual(sorted(everyone));
    expect(
      hrView.rows.map((row) => [row.name, row.canReview]).filter(([, canReview]) => !canReview)
    ).toEqual([["hr", false]]);
    expect(sorted(hrView.offices.map((office) => office.id))).toEqual(
      sorted([offices.delhi, offices.mumbai])
    );
    expect(hrView.rows.find((row) => row.name === "mumbai_rep")?.checkIn?.status).toBe("open");
    const managerSignals = hrView.rows.flatMap((row) =>
      row.checkIn?.clockIn.network ? [row.checkIn.clockIn.network] : []
    );
    expect(managerSignals.length).toBeGreaterThan(0);
    expect(managerSignals.some((signal) => "observedPrefix" in signal)).toBe(false);
    const adminView = await teamDay(t, "admin");
    expect(namesIn(adminView)).toEqual(sorted(everyone));
    expect(adminView.rows.find((row) => row.name === "admin")?.canReview).toBe(false);
  });

  test("Admin sees other Admins and can review them, but not themselves", async () => {
    const t = createHarness();
    const { offices, staff } = await seedDay(t);
    await insertStaff(t, { officeId: offices.mumbai, roles: ["Admin"], subject: "admin_two" });
    const rows = new Map((await teamDay(t, "admin")).rows.map((row) => [row.name, row]));
    expect(rows.get("admin_two")?.canReview).toBe(true);
    expect(rows.get("admin")?.canReview).toBe(false);
    const fromOther = new Map((await teamDay(t, "admin_two")).rows.map((row) => [row.name, row]));
    expect(fromOther.get("admin")?.canReview).toBe(true);
    // Listing your own row never lets you change it.
    await expect(
      as(t, "admin").mutation(api.crm.officeCheckIns.recordManualEntry, {
        clockInAt: NOW.getTime() - 3_600_000,
        clockOutAt: null,
        reason: "Testing self entry",
        staffId: staff.admin,
        workDate: WORK_DATE,
      })
    ).rejects.toThrow();
  });

  test("A view:team head sees only same-office staff in their own department", async () => {
    const t = createHarness();
    const { offices } = await seedDay(t);
    await insertStaff(t, { officeId: offices.delhi, roles: ["Operations"], subject: "delhi_ops" });
    await insertStaff(t, {
      officeId: offices.mumbai,
      roles: ["Operations"],
      subject: "mumbai_ops",
    });
    await insertStaff(t, {
      department: "Sales",
      officeId: offices.delhi,
      roles: ["Accounts"],
      subject: "delhi_sales_dept",
    });
    await insertStaff(t, {
      officeId: offices.delhi,
      roles: ["Sales", "HR"],
      subject: "delhi_sales_hr",
    });
    await insertStaff(t, {
      officeId: offices.delhi,
      roles: ["Sales", "Directors"],
      subject: "delhi_sales_director",
    });
    const delhiView = await teamDay(t, "delhi_head");
    // Sales by role or department; never Admin/HR/Directors, other departments or offices.
    expect(namesIn(delhiView)).toEqual([
      "delhi_head",
      "delhi_rep",
      "delhi_report",
      "delhi_sales_dept",
    ]);
    expect(delhiView.offices).toEqual([
      { id: offices.delhi, name: "Delhi HQ", timeZone: "Asia/Kolkata" },
    ]);
    const mumbaiView = await teamDay(t, "mumbai_head");
    expect(namesIn(mumbaiView)).toEqual(["mumbai_head", "mumbai_ops"]);
    // Filtering by another office cannot widen the scope.
    expect((await teamDay(t, "mumbai_head", offices.delhi)).rows).toEqual([]);
  });

  test("A reporting manager sees direct reports across offices and nobody else", async () => {
    const t = createHarness();
    const { offices } = await seedDay(t);
    const view = await teamDay(t, "mumbai_manager");
    expect(namesIn(view)).toEqual(["delhi_report", "mumbai_manager"]);
    expect(sorted(view.offices.map((office) => office.id))).toEqual(
      sorted([offices.delhi, offices.mumbai])
    );
  });

  test("A head in another office still sees a Sales direct report via the manager path", async () => {
    const t = createHarness();
    const { offices } = await seedDay(t);
    const mumbaiSalesHead = await insertStaff(t, {
      officeId: offices.mumbai,
      roles: ["Sales Head"],
      subject: "mumbai_sales_head",
    });
    await insertStaff(t, {
      officeId: offices.delhi,
      reportsTo: mumbaiSalesHead,
      roles: ["Sales"],
      subject: "delhi_report_of_mumbai_head",
    });
    const view = await teamDay(t, "mumbai_sales_head");
    expect(namesIn(view)).toEqual([
      "delhi_report_of_mumbai_head",
      "mumbai_manager",
      "mumbai_rep",
      "mumbai_sales_head",
    ]);
    expect(sorted(view.offices.map((office) => office.id))).toEqual(
      sorted([offices.delhi, offices.mumbai])
    );
  });

  test("A plain staff member without reports sees nobody", async () => {
    const t = createHarness();
    await seedDay(t);
    expect(await teamDay(t, "delhi_rep")).toMatchObject({ offices: [], rows: [] });
    expect(await teamDay(t, "unassigned")).toMatchObject({ offices: [], rows: [] });
  });

  test("Status shows the caller's own record and whether they oversee anyone", async () => {
    const t = createHarness();
    const { offices } = await seedDay(t);
    const status = await as(t, "delhi_rep").query(api.crm.officeCheckIns.myStatus, {
      referenceNow: NOW.getTime(),
    });
    expect(status).toMatchObject({
      canOversee: false,
      hasStaffProfile: true,
      office: { id: offices.delhi, name: "Delhi HQ" },
      rule: { configured: false, requirement: "not_configured" },
      today: { status: "open", workDate: WORK_DATE },
      workDate: WORK_DATE,
    });
    expect(
      (
        await as(t, "delhi_head").query(api.crm.officeCheckIns.myStatus, {
          referenceNow: NOW.getTime(),
        })
      ).canOversee
    ).toBe(true);
    // A line manager without view:team still oversees their direct reports.
    expect(
      (
        await as(t, "mumbai_manager").query(api.crm.officeCheckIns.myStatus, {
          referenceNow: NOW.getTime(),
        })
      ).canOversee
    ).toBe(true);
  });
});

describe("Manager review, correction and manual entry", () => {
  async function pendingDay(t: Harness) {
    const seeded = await seed(t);
    await seedRule(t, seeded.offices.delhi, { enforcementMode: "enforce" });
    const pending = (await clockIn(t, "delhi_rep", HOME_IP)).checkIn;
    const reportPending = (await clockIn(t, "delhi_report", HOME_IP)).checkIn;
    const headPending = (await clockIn(t, "delhi_head", HOME_IP)).checkIn;
    const hrPending = (await clockIn(t, "hr", HOME_IP)).checkIn;
    const adminPending = (await clockIn(t, "admin", HOME_IP)).checkIn;
    return { ...seeded, adminPending, headPending, hrPending, pending, reportPending };
  }

  function review(
    t: Harness,
    subject: string,
    checkInId: Id<"officeCheckIns">,
    reason = "Confirmed at the front desk"
  ) {
    return as(t, subject).mutation(api.crm.officeCheckIns.review, {
      checkInId,
      decision: "accepted",
      reason,
    });
  }

  test("An office head accepts a held check-in and the decision is audited", async () => {
    const t = createHarness();
    const { pending, staff } = await pendingDay(t);
    expect(pending.admission).toBe("pending_review");
    await review(t, "delhi_head", pending._id, "  Confirmed at the front desk  ");
    const [record] = await t.run(async (ctx) => [await ctx.db.get("officeCheckIns", pending._id)]);
    expect(record).toMatchObject({
      admission: "admitted",
      clockIn: { outcome: "fail" },
      review: {
        decision: "accepted",
        reason: "Confirmed at the front desk",
        reviewedAt: NOW.getTime(),
        reviewerName: "delhi_head",
        reviewerStaffId: staff.delhiHead,
      },
    });
    expect(await auditFor(t, "review_accepted")).toEqual([
      expect.objectContaining({
        actorStaffId: staff.delhiHead,
        checkInId: pending._id,
        reason: "Confirmed at the front desk",
        subjectStaffId: staff.delhiRep,
        summary: "admission pending_review -> admitted",
      }),
    ]);
    const history = await as(t, "delhi_rep").query(api.crm.officeCheckIns.history, {
      checkInId: pending._id,
    });
    expect(history.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["clock_in", "review_accepted"])
    );
  });

  test("HR rejects across offices and a reporting manager reviews a direct report", async () => {
    const t = createHarness();
    const { pending, reportPending } = await pendingDay(t);
    await as(t, "hr").mutation(api.crm.officeCheckIns.review, {
      checkInId: pending._id,
      decision: "rejected",
      reason: "Was on leave",
    });
    await review(t, "mumbai_manager", reportPending._id);
    const records = await t.run(async (ctx) =>
      Promise.all([
        ctx.db.get("officeCheckIns", pending._id),
        ctx.db.get("officeCheckIns", reportPending._id),
      ])
    );
    expect(records.map((record) => record?.admission)).toEqual(["rejected", "admitted"]);
    expect(await auditFor(t, "review_rejected")).toHaveLength(1);
  });

  test("Nobody reviews their own record, outside their scope, or without a reason", async () => {
    const t = createHarness();
    const { headPending, hrPending, pending, reportPending } = await pendingDay(t);
    // Self-review is refused even for all-office overseers.
    await expect(review(t, "delhi_head", headPending._id)).rejects.toThrow("FORBIDDEN");
    await expect(review(t, "hr", hrPending._id)).rejects.toThrow("FORBIDDEN");
    await expect(review(t, "delhi_rep", pending._id)).rejects.toThrow("FORBIDDEN");
    // Other-office head, plain staff and a manager of someone else.
    await expect(review(t, "mumbai_head", pending._id)).rejects.toThrow("FORBIDDEN");
    await expect(review(t, "mumbai_rep", pending._id)).rejects.toThrow("FORBIDDEN");
    await expect(review(t, "delhi_rep", reportPending._id)).rejects.toThrow("FORBIDDEN");
    await expect(review(t, "mumbai_manager", pending._id)).rejects.toThrow("FORBIDDEN");
    for (const reason of ["", "  ", "ok", "x".repeat(501)]) {
      await expect(review(t, "delhi_head", pending._id, reason)).rejects.toThrow(
        "A reason between 3 and 500 characters is required."
      );
    }
    await expect(
      as(t, "mumbai_head").query(api.crm.officeCheckIns.history, { checkInId: pending._id })
    ).rejects.toThrow("FORBIDDEN");
    const records = await allCheckIns(t);
    expect(records.every((record) => record.admission === "pending_review")).toBe(true);
    expect(records.every((record) => record.review === undefined)).toBe(true);
    expect(await auditFor(t, "review_accepted")).toEqual([]);
  });

  test("A Sales Head reviews and corrects only same-office Sales staff", async () => {
    const t = createHarness();
    const { adminPending, hrPending, offices, pending } = await pendingDay(t);
    await insertStaff(t, { officeId: offices.delhi, roles: ["Operations"], subject: "delhi_ops" });
    const opsPending = (await clockIn(t, "delhi_ops", HOME_IP)).checkIn;
    const correct = (checkInId: Id<"officeCheckIns">) =>
      as(t, "delhi_head").mutation(api.crm.officeCheckIns.correctTimes, {
        checkInId,
        clockInAt: Date.parse("2026-03-30T03:45:00.000Z"),
        clockOutAt: Date.parse("2026-03-30T05:45:00.000Z"),
        reason: "Front desk log",
      });
    for (const record of [adminPending, hrPending, opsPending]) {
      await expect(review(t, "delhi_head", record._id)).rejects.toThrow("FORBIDDEN");
      await expect(correct(record._id)).rejects.toThrow("FORBIDDEN");
    }
    expect(await auditFor(t, "review_accepted")).toEqual([]);
    expect(await auditFor(t, "times_corrected")).toEqual([]);

    await review(t, "delhi_head", pending._id);
    await correct(pending._id);
    const record = await t.run(async (ctx) => ctx.db.get("officeCheckIns", pending._id));
    expect(record).toMatchObject({ admission: "admitted", status: "closed" });
  });

  test("Review and correction use the record's office, not the person's current office", async () => {
    const t = createHarness();
    const { offices, pending } = await pendingDay(t);
    await insertStaff(t, {
      officeId: offices.mumbai,
      roles: ["Sales Head"],
      subject: "mumbai_sales_head",
    });
    // delhi_rep moves to Mumbai after clocking in at Delhi.
    await t.run(async (ctx) =>
      ctx.db.patch("staffUsers", pending.staffId, { officeId: offices.mumbai })
    );
    await expect(review(t, "mumbai_sales_head", pending._id)).rejects.toThrow("FORBIDDEN");
    await expect(
      as(t, "mumbai_sales_head").mutation(api.crm.officeCheckIns.correctTimes, {
        checkInId: pending._id,
        clockInAt: pending.clockInAt,
        clockOutAt: pending.clockInAt + 60_000,
        reason: "Moved office",
      })
    ).rejects.toThrow("FORBIDDEN");
    await review(t, "delhi_head", pending._id);
    expect(
      (await t.run(async (ctx) => ctx.db.get("officeCheckIns", pending._id)))?.review
    ).toMatchObject({ reviewerName: "delhi_head" });
  });

  test("Correcting times requires the caller to have a staff record", async () => {
    const t = createHarness();
    const { pending } = await pendingDay(t);
    process.env.PORTAL_BOOTSTRAP_ADMINS = BOOTSTRAP_EMAIL;
    process.env.PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT = String(NOW.getTime() + 86_400_000);
    const bootstrap = t.withIdentity({
      email: BOOTSTRAP_EMAIL,
      issuer: ISSUER,
      subject: "bootstrap",
      tokenIdentifier: `${ISSUER}|bootstrap`,
    });
    await expect(
      bootstrap.mutation(api.crm.officeCheckIns.correctTimes, {
        checkInId: pending._id,
        clockInAt: pending.clockInAt,
        clockOutAt: pending.clockInAt + 60_000,
        reason: "Break-glass fix",
      })
    ).rejects.toThrow("NO_STAFF_PROFILE");
    expect(await auditFor(t, "times_corrected")).toEqual([]);
    expect((await t.run(async (ctx) => ctx.db.get("officeCheckIns", pending._id)))?.status).toBe(
      "open"
    );
  });

  test("Review and manual entry refuse a caller without a staff record before any lookup", async () => {
    const t = createHarness();
    const { pending, staff } = await pendingDay(t);
    process.env.PORTAL_BOOTSTRAP_ADMINS = BOOTSTRAP_EMAIL;
    process.env.PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT = String(NOW.getTime() + 86_400_000);
    const bootstrap = t.withIdentity({
      email: BOOTSTRAP_EMAIL,
      issuer: ISSUER,
      subject: "bootstrap",
      tokenIdentifier: `${ISSUER}|bootstrap`,
    });
    // Ids that were valid once, so a lookup would report "not found" or "forbidden".
    const goneCheckIn = (await clockIn(t, "mumbai_rep", HOME_IP)).checkIn._id;
    const goneStaff = await insertStaff(t, { roles: ["Sales"], subject: "gone" });
    await t.run(async (ctx) => {
      await ctx.db.delete("officeCheckIns", goneCheckIn);
      await ctx.db.delete("staffUsers", goneStaff);
    });
    for (const checkInId of [pending._id, goneCheckIn]) {
      await expect(
        bootstrap.mutation(api.crm.officeCheckIns.review, {
          checkInId,
          decision: "accepted",
          reason: "Break-glass review",
        })
      ).rejects.toThrow("NO_STAFF_PROFILE");
    }
    for (const staffId of [staff.delhiRep, goneStaff]) {
      await expect(
        bootstrap.mutation(api.crm.officeCheckIns.recordManualEntry, {
          clockInAt: Date.parse("2026-03-29T03:30:00.000Z"),
          clockOutAt: Date.parse("2026-03-29T12:30:00.000Z"),
          reason: "Break-glass entry",
          staffId,
          workDate: "2026-03-29",
        })
      ).rejects.toThrow("NO_STAFF_PROFILE");
    }
    expect(await auditFor(t, "review_accepted")).toEqual([]);
    expect(await auditFor(t, "manual_entry")).toEqual([]);
    expect((await t.run(async (ctx) => ctx.db.get("officeCheckIns", pending._id)))?.review).toBe(
      undefined
    );
  });

  test("Reopening a closed record is refused while the person has another open session", async () => {
    const t = createHarness();
    const { staff } = await seed(t);
    vi.setSystemTime(new Date("2026-03-29T04:00:00.000Z"));
    const yesterday = (await clockIn(t, "delhi_rep")).checkIn;
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(NOW);
    const today = (await clockIn(t, "delhi_rep")).checkIn;
    const reopen = () =>
      as(t, "hr").mutation(api.crm.officeCheckIns.correctTimes, {
        checkInId: yesterday._id,
        clockInAt: yesterday.clockInAt,
        clockOutAt: null,
        reason: "Clock-out was recorded by mistake",
      });
    await expect(reopen()).rejects.toThrow(
      "Close this person's other open session before reopening this one."
    );
    expect((await t.run(async (ctx) => ctx.db.get("officeCheckIns", yesterday._id)))?.status).toBe(
      "closed"
    );
    expect(await auditFor(t, "times_corrected")).toEqual([]);

    vi.setSystemTime(NOW.getTime() + 60_000);
    await clockOut(t, "delhi_rep");
    expect((await t.run(async (ctx) => ctx.db.get("officeCheckIns", today._id)))?.status).toBe(
      "closed"
    );
    await reopen();
    const reopened = await t.run(async (ctx) => ctx.db.get("officeCheckIns", yesterday._id));
    expect(reopened).toMatchObject({ status: "open" });
    expect(reopened?.clockOutAt).toBeUndefined();
    expect(await auditFor(t, "times_corrected")).toEqual([
      expect.objectContaining({ actorStaffId: staff.hr, subjectStaffId: staff.delhiRep }),
    ]);
  });

  test("Corrects missed checkout times on the record's work date with an audited reason", async () => {
    const t = createHarness();
    const { pending, staff } = await pendingDay(t);
    vi.setSystemTime(new Date("2026-04-02T06:00:00.000Z"));
    const clockInAt = Date.parse("2026-03-30T03:45:00.000Z"); // 09:15 IST
    const clockOutAt = Date.parse("2026-03-30T12:30:00.000Z"); // 18:00 IST
    const correct = (
      subject: string,
      times: { clockInAt: number; clockOutAt: number | null },
      reason = "Forgot to clock out"
    ) =>
      as(t, subject).mutation(api.crm.officeCheckIns.correctTimes, {
        checkInId: pending._id,
        reason,
        ...times,
      });

    await expect(correct("delhi_rep", { clockInAt, clockOutAt })).rejects.toThrow("FORBIDDEN");
    await expect(correct("mumbai_head", { clockInAt, clockOutAt })).rejects.toThrow("FORBIDDEN");
    await expect(correct("delhi_head", { clockInAt, clockOutAt }, "")).rejects.toThrow(
      "A reason between 3 and 500 characters is required."
    );
    await expect(
      correct("delhi_head", { clockInAt: clockOutAt, clockOutAt: clockInAt })
    ).rejects.toThrow("Clock-out time must be after clock-in and not in the future.");
    await expect(
      correct("delhi_head", { clockInAt: Date.parse("2026-03-30T18:31:00.000Z"), clockOutAt: null })
    ).rejects.toThrow("Clock-in time must fall on the record's work date.");
    await expect(
      correct("delhi_head", { clockInAt, clockOutAt: Date.parse("2026-04-03T00:00:00.000Z") })
    ).rejects.toThrow("Clock-out time must be after clock-in and not in the future.");
    await expect(
      correct("delhi_head", { clockInAt: Date.parse("2026-04-03T00:00:00.000Z"), clockOutAt: null })
    ).rejects.toThrow("Clock-in time must be a past time.");
    // 00:10 IST to 00:20 IST the next day is 24h10m.
    await expect(
      correct("delhi_head", {
        clockInAt: Date.parse("2026-03-29T18:40:00.000Z"),
        clockOutAt: Date.parse("2026-03-30T18:50:00.000Z"),
      })
    ).rejects.toThrow("A corrected session cannot exceed 24 hours.");
    expect(await auditFor(t, "times_corrected")).toEqual([]);

    await correct("delhi_head", { clockInAt, clockOutAt });
    const record = await t.run(async (ctx) => ctx.db.get("officeCheckIns", pending._id));
    expect(record).toMatchObject({
      clockInAt,
      clockOutAt,
      correctedAt: Date.parse("2026-04-02T06:00:00.000Z"),
      status: "closed",
    });
    expect(await auditFor(t, "times_corrected")).toEqual([
      expect.objectContaining({
        actorStaffId: staff.delhiHead,
        reason: "Forgot to clock out",
        subjectStaffId: staff.delhiRep,
        summary: "in 30 Mar 2026, 11:30 -> 30 Mar 2026, 09:15, out none -> 30 Mar 2026, 18:00",
      }),
    ]);
  });

  test("Records an audited manual entry only for overseen staff, never over another session", async () => {
    const t = createHarness();
    const { staff } = await seed(t);
    const entry = (subject: string, staffId: Id<"staffUsers">, overrides = {}) =>
      as(t, subject).mutation(api.crm.officeCheckIns.recordManualEntry, {
        clockInAt: Date.parse("2026-03-29T03:30:00.000Z"),
        clockOutAt: Date.parse("2026-03-29T12:30:00.000Z"),
        reason: "Phone battery died",
        staffId,
        workDate: "2026-03-29",
        ...overrides,
      });

    await expect(entry("delhi_head", staff.delhiHead)).rejects.toThrow("FORBIDDEN");
    await expect(entry("hr", staff.hr)).rejects.toThrow("FORBIDDEN");
    await expect(entry("mumbai_head", staff.delhiRep)).rejects.toThrow("FORBIDDEN");
    await expect(entry("delhi_rep", staff.delhiReport)).rejects.toThrow("FORBIDDEN");
    await expect(entry("hr", staff.unassigned)).rejects.toThrow("NO_OFFICE_ASSIGNED");
    const inactive = await insertStaff(t, {
      active: false,
      officeId: (await t.run(async (ctx) => ctx.db.get("staffUsers", staff.delhiRep)))?.officeId,
      roles: ["Sales"],
      subject: "former_rep",
    });
    await expect(entry("hr", inactive)).rejects.toThrow("This staff member is inactive.");
    await expect(entry("hr", staff.delhiRep, { reason: " " })).rejects.toThrow(
      "A reason between 3 and 500 characters is required."
    );
    await expect(entry("hr", staff.delhiRep, { workDate: "2026-02-30" })).rejects.toThrow(
      "A valid reference date is required"
    );
    await expect(
      entry("hr", staff.delhiRep, { clockInAt: Date.parse("2026-03-30T03:30:00.000Z") })
    ).rejects.toThrow("Clock-in time must fall on the record's work date.");
    expect(await allCheckIns(t)).toEqual([]);

    const checkInId = await entry("delhi_head", staff.delhiRep);
    const record = await t.run(async (ctx) => ctx.db.get("officeCheckIns", checkInId));
    expect(record).toMatchObject({
      admission: "admitted",
      clockIn: { enforcementMode: "report_only", requirement: "not_configured" },
      review: {
        decision: "accepted",
        reason: "Phone battery died",
        reviewerStaffId: staff.delhiHead,
      },
      source: "manager_entry",
      staffId: staff.delhiRep,
      status: "closed",
      workDate: "2026-03-29",
    });
    expect(await auditFor(t, "manual_entry")).toEqual([
      expect.objectContaining({
        actorStaffId: staff.delhiHead,
        checkInId,
        reason: "Phone battery died",
        subjectStaffId: staff.delhiRep,
      }),
    ]);
    await expect(entry("hr", staff.delhiRep)).rejects.toThrow(
      "These times overlap another session on this day."
    );
  });
});

describe("Several sessions a day", () => {
  const HOUR = 60 * 60 * 1000;
  const at = (hours: number) => NOW.getTime() + hours * HOUR;

  async function myStatus(t: Harness, subject: string) {
    return await as(t, subject).query(api.crm.officeCheckIns.myStatus, {
      referenceNow: Date.now(),
    });
  }

  test("Clock in, out, in and out again gives two closed sessions with their own times", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    vi.setSystemTime(at(-2));
    const morning = (await clockIn(t, "delhi_rep", IN_OFFICE_IP)).checkIn;
    vi.setSystemTime(at(-1));
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(at(0));
    const again = await clockIn(t, "delhi_rep", HOME_IP);
    expect(again.replayed).toBe(false);
    expect(again.checkIn._id).not.toBe(morning._id);
    // The new session is evaluated against the rule on its own request.
    expect(again.checkIn).toMatchObject({
      clockIn: { network: { reason: "outside_allowlist" }, outcome: "fail" },
      clockInAt: at(0),
      status: "open",
      workDate: WORK_DATE,
    });
    const open = await myStatus(t, "delhi_rep");
    expect(open.hasOpenSession).toBe(true);
    expect(open.sessions.map((session) => session._id)).toEqual([again.checkIn._id, morning._id]);
    expect(open.today?._id).toBe(again.checkIn._id);

    vi.setSystemTime(at(1));
    const closed = await clockOut(t, "delhi_rep");
    expect(closed).toMatchObject({ checkIn: { _id: again.checkIn._id }, replayed: false });

    const sessions = sorted(
      (await allCheckIns(t)).map((row) => `${row.clockInAt}-${row.clockOutAt}`)
    );
    expect(sessions).toEqual(sorted([`${at(-2)}-${at(-1)}`, `${at(0)}-${at(1)}`]));
    expect((await allCheckIns(t)).every((row) => row.status === "closed")).toBe(true);
    expect(await auditFor(t, "clock_in")).toHaveLength(2);
    expect(await auditFor(t, "clock_out")).toHaveLength(2);
    const done = await myStatus(t, "delhi_rep");
    expect(done).toMatchObject({ hasOpenSession: false, today: { _id: again.checkIn._id } });
    expect(done.sessions).toHaveLength(2);
  });

  test("A repeated clock-in while the second session is open replays it", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    vi.setSystemTime(at(-2));
    await clockIn(t, "delhi_rep");
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(at(0));
    const second = await clockIn(t, "delhi_rep");
    vi.setSystemTime(at(0.01));
    const repeat = await clockIn(t, "delhi_rep", HOME_IP);
    expect(repeat.replayed).toBe(true);
    expect(repeat.checkIn).toEqual(second.checkIn);
    expect(await allCheckIns(t)).toHaveLength(2);
    expect(await auditFor(t, "clock_in")).toHaveLength(2);
  });

  test("A second clock-out with nothing open replays today's latest and leaves earlier days", async () => {
    const t = createHarness();
    await seed(t);
    vi.setSystemTime(new Date("2026-03-29T04:00:00.000Z"));
    const forgotten = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(at(-3));
    await clockIn(t, "delhi_rep");
    vi.setSystemTime(at(-2));
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(at(-1));
    const latest = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(at(0));
    await clockOut(t, "delhi_rep");

    vi.setSystemTime(at(0.01));
    const replay = await clockOut(t, "delhi_rep");
    expect(replay).toMatchObject({
      checkIn: { _id: latest._id, clockOutAt: at(0), status: "closed" },
      replayed: true,
    });
    const earlier = await t.run(async (ctx) => ctx.db.get("officeCheckIns", forgotten._id));
    expect(earlier).toMatchObject({ status: "open" });
    expect(earlier?.clockOutAt).toBeUndefined();
    expect(await auditFor(t, "clock_out")).toHaveLength(2);
  });

  test("The team day shows every session, newest first, scoped and without network prefixes", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    vi.setSystemTime(at(-2));
    const first = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(at(-1));
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(at(0));
    const second = (await clockIn(t, "delhi_rep", HOME_IP)).checkIn;
    // The stored record keeps the prefix that managers must not see.
    expect(second.clockIn.network?.observedPrefix).toBeTruthy();

    for (const subject of ["hr", "delhi_head"]) {
      const row = (await teamDay(t, subject)).rows.find((entry) => entry.name === "delhi_rep");
      expect(row?.sessions.map((session) => session._id)).toEqual([second._id, first._id]);
      expect(row?.checkIn?._id).toBe(second._id);
      for (const session of row?.sessions ?? []) {
        expect(session.clockIn.network && "observedPrefix" in session.clockIn.network).toBe(false);
        expect(session.clockOut?.network && "observedPrefix" in session.clockOut.network).not.toBe(
          true
        );
      }
    }
    expect(namesIn(await teamDay(t, "mumbai_head"))).not.toContain("delhi_rep");
    expect((await teamDay(t, "delhi_rep")).rows).toEqual([]);
  });

  test("A manual entry fits around existing sessions and is refused when it overlaps", async () => {
    const t = createHarness();
    const { staff } = await seed(t);
    vi.setSystemTime(at(-2)); // 09:30 IST
    const session = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(at(-1)); // 10:30 IST
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(NOW);
    const entry = (clockInAt: number, clockOutAt: number | null) =>
      as(t, "hr").mutation(api.crm.officeCheckIns.recordManualEntry, {
        clockInAt,
        clockOutAt,
        reason: "Badge reader was down",
        staffId: staff.delhiRep,
        workDate: WORK_DATE,
      });

    await expect(entry(at(-2.5), at(-1.5))).rejects.toThrow(
      "These times overlap another session on this day."
    );
    await expect(entry(at(-1.5), null)).rejects.toThrow(
      "These times overlap another session on this day."
    );
    expect(await auditFor(t, "manual_entry")).toEqual([]);

    // 07:30 to 09:30 IST ends as the clocked session starts; touching ends are fine.
    const manualId = await entry(at(-4), at(-2));
    expect(await allCheckIns(t)).toHaveLength(2);
    expect(await auditFor(t, "manual_entry")).toHaveLength(1);

    // A correction cannot move a session onto another one either.
    await expect(
      as(t, "hr").mutation(api.crm.officeCheckIns.correctTimes, {
        checkInId: manualId,
        clockInAt: at(-4),
        clockOutAt: at(-1.5),
        reason: "Wrong times",
      })
    ).rejects.toThrow("These times overlap another session on this day.");
    expect((await t.run(async (ctx) => ctx.db.get("officeCheckIns", session._id)))?.clockInAt).toBe(
      at(-2)
    );
  });
});

describe("Where someone says they are working", () => {
  type ChooseArgs = FunctionArgs<typeof api.crm.officeCheckIns.chooseAwayReason>;

  /** A synthetic reading from a client site, taken a second before the answer. */
  function onTheRoad(overrides: Partial<Extract<LocationArg, { kind: "position" }>> = {}) {
    return {
      accuracyMeters: 18.4,
      capturedAt: Date.now() - 1000,
      kind: "position" as const,
      latitude: 19.076_001_234_5,
      longitude: 72.877_655_987_6,
      ...overrides,
    };
  }

  /**
   * Tour and market visit send a fresh reading unless the test passes its own `location`
   * (`null` sends none); Out of office sends none.
   */
  function choose(
    t: Harness,
    subject: string,
    checkInId: Id<"officeCheckIns">,
    reason: ChooseArgs["reason"],
    location?: LocationArg | null
  ) {
    const args: ChooseArgs = { checkInId, reason };
    const reading = location === undefined && reason !== "out_of_office" ? onTheRoad() : location;
    if (reading) {
      args.location = reading;
    }
    return as(t, subject).mutation(api.crm.officeCheckIns.chooseAwayReason, args);
  }

  async function storedRecord(t: Harness, checkInId: Id<"officeCheckIns">) {
    return await t.run(async (ctx) => ctx.db.get("officeCheckIns", checkInId));
  }

  test("A failed clock-in records the person's answer, can change it, and audits each change", async () => {
    const t = createHarness();
    const { offices, staff } = await seed(t);
    await seedRule(t, offices.delhi);
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    expect(checkIn.awayReason).toBeUndefined();

    await choose(t, "delhi_rep", checkIn._id, "on_tour");
    expect(await storedRecord(t, checkIn._id)).toMatchObject({
      admission: "admitted",
      awayReason: "on_tour",
      clockIn: { outcome: "fail" },
    });
    // Choosing the same answer again changes nothing and writes no audit.
    await choose(t, "delhi_rep", checkIn._id, "on_tour");
    await choose(t, "delhi_rep", checkIn._id, "market_visit");
    expect((await storedRecord(t, checkIn._id))?.awayReason).toBe("market_visit");
    expect(await auditFor(t, "away_reason_set")).toEqual([
      expect.objectContaining({
        actorStaffId: staff.delhiRep,
        checkInId: checkIn._id,
        subjectStaffId: staff.delhiRep,
        summary: "working on tour, location shared",
      }),
      expect.objectContaining({
        summary: "working on market visit, location shared (was on tour)",
      }),
    ]);
    const [row] = (await teamDay(t, "hr")).rows.filter((entry) => entry.name === "delhi_rep");
    expect(row?.checkIn?.awayReason).toBe("market_visit");
  });

  test("An answer never admits a held check-in: it still waits for a manager", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce" });
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    await choose(t, "delhi_rep", checkIn._id, "out_of_office");
    expect(await storedRecord(t, checkIn._id)).toMatchObject({
      admission: "pending_review",
      awayReason: "out_of_office",
    });
  });

  test("Nothing is asked when the check passed or the office has no rule", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const passed = (await clockIn(t, "delhi_rep", IN_OFFICE_IP)).checkIn;
    await expect(choose(t, "delhi_rep", passed._id, "on_tour")).rejects.toThrow(
      "AWAY_REASON_NOT_NEEDED"
    );
    const noRule = (await clockIn(t, "mumbai_rep", HOME_IP)).checkIn;
    expect(noRule.clockIn.requirement).toBe("not_configured");
    await expect(choose(t, "mumbai_rep", noRule._id, "on_tour")).rejects.toThrow(
      "AWAY_REASON_NOT_NEEDED"
    );
    expect(await auditFor(t, "away_reason_set")).toHaveLength(0);
  });

  test("Only the person answers for their own session, and not after a review", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { enforcementMode: "enforce" });
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    // Not even HR or Admin can answer for someone else.
    for (const subject of ["hr", "admin", "delhi_head", "mumbai_rep"]) {
      await expect(choose(t, subject, checkIn._id, "on_tour")).rejects.toThrow(
        "CHECK_IN_NOT_FOUND"
      );
    }
    await as(t, "delhi_head").mutation(api.crm.officeCheckIns.review, {
      checkInId: checkIn._id,
      decision: "accepted",
      reason: "Confirmed with the client",
    });
    await expect(choose(t, "delhi_rep", checkIn._id, "on_tour")).rejects.toThrow(
      "ALREADY_REVIEWED"
    );
    expect((await storedRecord(t, checkIn._id))?.awayReason).toBeUndefined();
    expect(await auditFor(t, "away_reason_set")).toHaveLength(0);
  });

  test("A retried clock-in that passes clears the answer; one that fails keeps it", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi, { requirement: "network_and_geofence" });
    const { checkIn } = await clockIn(t, "delhi_rep", IN_OFFICE_IP, LOCATION_DENIED);
    await choose(t, "delhi_rep", checkIn._id, "market_visit");

    vi.setSystemTime(NOW.getTime() + 30_000);
    const stillDenied = await clockIn(t, "delhi_rep", IN_OFFICE_IP, {
      code: "timeout",
      kind: "error",
    });
    expect(stillDenied.checkIn.awayReason).toBe("market_visit");
    expect(stillDenied.checkIn.awayLocation).toBeDefined();

    vi.setSystemTime(NOW.getTime() + 60_000);
    const passed = await clockIn(t, "delhi_rep", IN_OFFICE_IP, IN_FENCE);
    expect(passed.checkIn.clockIn.outcome).toBe("pass");
    expect(passed.checkIn.awayReason).toBeUndefined();
    expect(passed.checkIn.awayLocation).toBeUndefined();
  });

  test("Tour and market visit keep the exact point shared, for the person's overseers only", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    await choose(t, "delhi_rep", checkIn._id, "on_tour");
    const expected = {
      accuracyMeters: 18,
      capturedAt: NOW.getTime() - 1000,
      latitude: 19.076_001,
      longitude: 72.877_656,
    };
    expect((await storedRecord(t, checkIn._id))?.awayLocation).toEqual(expected);
    const forHr = (await teamDay(t, "hr")).rows.find((row) => row.name === "delhi_rep");
    expect(forHr?.checkIn?.awayLocation).toEqual(expected);
    // Someone who doesn't oversee them never sees the row, so never sees the point.
    expect(namesIn(await teamDay(t, "mumbai_rep"))).not.toContain("delhi_rep");
    // The audit trail says a location was shared, never where.
    const trail = JSON.stringify(await auditFor(t, "away_reason_set"));
    expect(trail).toContain("location shared");
    expect(trail).not.toContain("19.07");
    expect(trail).not.toContain("72.87");
  });

  test("Tour and market visit aren't saved without a usable, fresh location", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    await expect(choose(t, "delhi_rep", checkIn._id, "on_tour", null)).rejects.toThrow(
      "AWAY_LOCATION_REQUIRED"
    );
    await expect(
      choose(t, "delhi_rep", checkIn._id, "market_visit", LOCATION_DENIED)
    ).rejects.toThrow("AWAY_LOCATION_REQUIRED");
    // A reading from ten minutes ago can't stand in for where they are now.
    await expect(
      choose(
        t,
        "delhi_rep",
        checkIn._id,
        "on_tour",
        onTheRoad({ capturedAt: NOW.getTime() - 600_000 })
      )
    ).rejects.toThrow("AWAY_LOCATION_INVALID");
    await expect(
      choose(t, "delhi_rep", checkIn._id, "on_tour", onTheRoad({ latitude: 123 }))
    ).rejects.toThrow("AWAY_LOCATION_INVALID");
    await expect(
      choose(t, "delhi_rep", checkIn._id, "on_tour", onTheRoad({ accuracyMeters: 0 }))
    ).rejects.toThrow("AWAY_LOCATION_INVALID");
    const record = await storedRecord(t, checkIn._id);
    expect(record?.awayReason).toBeUndefined();
    expect(record?.awayLocation).toBeUndefined();
    expect(await auditFor(t, "away_reason_set")).toHaveLength(0);
  });

  test("The answer can't be given or changed after clocking out", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    await choose(t, "delhi_rep", checkIn._id, "on_tour");
    await clockOut(t, "delhi_rep", HOME_IP);
    await expect(choose(t, "delhi_rep", checkIn._id, "out_of_office")).rejects.toThrow(
      "SESSION_CLOSED"
    );
    expect((await storedRecord(t, checkIn._id))?.awayReason).toBe("on_tour");
    expect(await auditFor(t, "away_reason_set")).toHaveLength(1);
  });

  test("Out of office keeps no location and drops an earlier one", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    const { checkIn } = await clockIn(t, "delhi_rep", HOME_IP);
    await choose(t, "delhi_rep", checkIn._id, "on_tour");
    expect((await storedRecord(t, checkIn._id))?.awayLocation).toBeDefined();
    await choose(t, "delhi_rep", checkIn._id, "out_of_office");
    const record = await storedRecord(t, checkIn._id);
    expect(record?.awayReason).toBe("out_of_office");
    expect(record?.awayLocation).toBeUndefined();
    const [, latest] = await auditFor(t, "away_reason_set");
    expect(latest?.summary).toBe("working out of office (was on tour)");
  });
});

describe("Deleting a session", () => {
  async function seedDeletion(t: Harness) {
    const seeded = await seed(t);
    const director = await insertStaff(t, {
      officeId: seeded.offices.delhi,
      roles: ["Directors"],
      subject: "director",
    });
    const cementDirector = await insertStaff(t, {
      officeId: seeded.offices.delhi,
      roles: ["Director Cement"],
      subject: "cement_director",
    });
    vi.setSystemTime(NOW.getTime() - 2 * 60 * 60 * 1000);
    const repSession = (await clockIn(t, "delhi_rep")).checkIn;
    vi.setSystemTime(NOW.getTime() - 60 * 60 * 1000);
    await clockOut(t, "delhi_rep");
    vi.setSystemTime(NOW);
    return { ...seeded, cementDirector, director, repSession };
  }

  function deleteAs(t: Harness, subject: string, checkInId: Id<"officeCheckIns">, reason?: string) {
    const args: FunctionArgs<typeof api.crm.officeCheckIns.deleteCheckIn> = { checkInId };
    if (reason !== undefined) {
      args.reason = reason;
    }
    return as(t, subject).mutation(api.crm.officeCheckIns.deleteCheckIn, args);
  }

  async function auditForCheckIn(t: Harness, checkInId: Id<"officeCheckIns">) {
    return await t.run(async (ctx) =>
      ctx.db
        .query("officeCheckInAudit")
        .withIndex("by_checkInId", (q) => q.eq("checkInId", checkInId))
        .collect()
    );
  }

  test("Admin erases a session and its whole history, without a reason", async () => {
    const t = createHarness();
    const { repSession } = await seedDeletion(t);
    expect(await auditForCheckIn(t, repSession._id)).toHaveLength(2);

    expect(await deleteAs(t, "admin", repSession._id)).toEqual({ mode: "erase" });

    expect(await t.run(async (ctx) => ctx.db.get("officeCheckIns", repSession._id))).toBeNull();
    expect(await auditForCheckIn(t, repSession._id)).toEqual([]);
    expect(await auditFor(t, "record_deleted")).toEqual([]);
    expect(
      await as(t, "hr").query(api.crm.officeCheckIns.history, { checkInId: repSession._id })
    ).toEqual([]);
    await expect(deleteAs(t, "admin", repSession._id)).rejects.toThrow("CHECK_IN_NOT_FOUND");
  });

  test("Admin may erase their own session, and then clock in afresh", async () => {
    const t = createHarness();
    await seedDeletion(t);
    const own = (await clockIn(t, "admin")).checkIn;
    expect(await deleteAs(t, "admin", own._id, "Test data")).toEqual({ mode: "erase" });
    expect(await auditForCheckIn(t, own._id)).toEqual([]);
    expect((await allCheckIns(t)).some((row) => row._id === own._id)).toBe(false);
    const fresh = await clockIn(t, "admin");
    expect(fresh).toMatchObject({ checkIn: { status: "open" }, replayed: false });
  });

  test("A Director deletes an overseen session with a reason and leaves a trail", async () => {
    const t = createHarness();
    const { director, offices, repSession, staff } = await seedDeletion(t);

    expect(await deleteAs(t, "director", repSession._id, "Duplicate from a test run")).toEqual({
      mode: "trail",
    });

    expect(await t.run(async (ctx) => ctx.db.get("officeCheckIns", repSession._id))).toBeNull();
    const trail = await auditForCheckIn(t, repSession._id);
    expect(sorted(trail.map((event) => event.kind))).toEqual([
      "clock_in",
      "clock_out",
      "record_deleted",
    ]);
    expect(trail.find((event) => event.kind === "record_deleted")).toMatchObject({
      actorName: "director",
      actorStaffId: director,
      at: NOW.getTime(),
      checkInId: repSession._id,
      officeId: offices.delhi,
      reason: "Duplicate from a test run",
      subjectStaffId: staff.delhiRep,
      summary:
        "deleted delhi_rep's session on 2026-03-30: in 30 Mar 2026, 09:30, out 30 Mar 2026, 10:30",
    });
    // The trail of a deleted record stays readable to its overseers and its owner.
    for (const subject of ["director", "hr", "delhi_rep"]) {
      const history = await as(t, subject).query(api.crm.officeCheckIns.history, {
        checkInId: repSession._id,
      });
      expect(history.map((event) => event.kind)).toContain("record_deleted");
    }
    await expect(
      as(t, "mumbai_head").query(api.crm.officeCheckIns.history, { checkInId: repSession._id })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("A Director cannot delete their own session or delete without a reason", async () => {
    const t = createHarness();
    const { repSession } = await seedDeletion(t);
    const own = (await clockIn(t, "director")).checkIn;
    await expect(deleteAs(t, "director", own._id, "My own test")).rejects.toThrow("FORBIDDEN");
    await expect(deleteAs(t, "director", repSession._id)).rejects.toThrow(
      "A reason between 3 and 500 characters is required."
    );
    await expect(deleteAs(t, "director", repSession._id, " ")).rejects.toThrow(
      "A reason between 3 and 500 characters is required."
    );
    expect(await allCheckIns(t)).toHaveLength(2);
    expect(await auditFor(t, "record_deleted")).toEqual([]);
  });

  test("Director Cement, HR, heads, managers, staff and break-glass Admin are refused", async () => {
    const t = createHarness();
    const { repSession } = await seedDeletion(t);
    const reportSession = (await clockIn(t, "delhi_report")).checkIn;
    for (const subject of ["cement_director", "hr", "delhi_head", "delhi_rep"]) {
      await expect(deleteAs(t, subject, repSession._id, "Should not delete")).rejects.toThrow(
        "FORBIDDEN"
      );
    }
    // A reporting manager oversees the session but still cannot delete it.
    await expect(
      deleteAs(t, "mumbai_manager", reportSession._id, "Should not delete")
    ).rejects.toThrow("FORBIDDEN");
    process.env.PORTAL_BOOTSTRAP_ADMINS = BOOTSTRAP_EMAIL;
    process.env.PORTAL_BOOTSTRAP_ADMINS_EXPIRES_AT = String(NOW.getTime() + 86_400_000);
    const bootstrap = t.withIdentity({
      email: BOOTSTRAP_EMAIL,
      issuer: ISSUER,
      subject: "bootstrap",
      tokenIdentifier: `${ISSUER}|bootstrap`,
    });
    await expect(
      bootstrap.mutation(api.crm.officeCheckIns.deleteCheckIn, { checkInId: repSession._id })
    ).rejects.toThrow("NO_STAFF_PROFILE");
    expect(await allCheckIns(t)).toHaveLength(2);
    expect(await auditForCheckIn(t, repSession._id)).toHaveLength(2);
    for (const subject of ["admin", "director", "cement_director", "hr", "delhi_rep"]) {
      const status = await as(t, subject).query(api.crm.officeCheckIns.myStatus, {
        referenceNow: NOW.getTime(),
      });
      const expected = { admin: "erase", director: "trail" }[subject] ?? null;
      expect(status.deletion).toBe(expected);
    }
  });
});

describe("Admin rules and office assignment", () => {
  const RULE = {
    confirmEnforcement: false,
    enforcementMode: "report_only" as const,
    expectedVersion: null,
    geofence: DELHI_GEOFENCE,
    networks: [{ cidr: " 203.0.113.0/24 ", kind: "office" as const, label: " Delhi LAN " }],
    reason: "Pilot start",
    requirement: "network" as const,
    timeZone: "Asia/Kolkata",
  };

  function saveRule(t: Harness, subject: string, officeId: Id<"offices">, overrides = {}) {
    return as(t, subject).mutation(api.crm.officeCheckInAdmin.saveRule, {
      ...RULE,
      officeId,
      ...overrides,
    });
  }

  test("Only manage:staff holders save rules, and every save is versioned and audited", async () => {
    const t = createHarness();
    const { offices, staff } = await seed(t);
    for (const subject of ["hr", "delhi_head", "delhi_rep"]) {
      await expect(saveRule(t, subject, offices.delhi)).rejects.toThrow("FORBIDDEN");
      await expect(as(t, subject).query(api.crm.officeCheckInAdmin.overview, {})).rejects.toThrow(
        "FORBIDDEN"
      );
    }
    await expect(
      t.mutation(api.crm.officeCheckInAdmin.saveRule, { ...RULE, officeId: offices.delhi })
    ).rejects.toThrow("FORBIDDEN");
    await expect(saveRule(t, "admin", offices.delhi, { reason: "" })).rejects.toThrow(
      "A reason between 3 and 500 characters is required."
    );
    await expect(saveRule(t, "admin", offices.delhi, { timeZone: "Mars/Olympus" })).rejects.toThrow(
      "Unknown time zone."
    );

    expect(await saveRule(t, "admin", offices.delhi)).toBe(1);
    const stored = await t.run(async (ctx) => ctx.db.query("officeCheckInRules").unique());
    expect(stored).toMatchObject({
      enforcementMode: "report_only",
      networks: [{ cidr: "203.0.113.0/24", kind: "office", label: "Delhi LAN" }],
      updatedByStaffId: staff.admin,
      version: 1,
    });
    expect(await auditFor(t, "rule_saved")).toEqual([
      expect.objectContaining({
        actorStaffId: staff.admin,
        officeId: offices.delhi,
        reason: "Pilot start",
      }),
    ]);

    // The saved rule applies to the next clock-in.
    expect((await clockIn(t, "delhi_rep", HOME_IP)).checkIn.clockIn).toMatchObject({
      outcome: "fail",
      ruleVersion: 1,
    });
  });

  test("Rejects invalid or too-broad ranges and stale versions", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await expect(
      saveRule(t, "admin", offices.delhi, {
        networks: [{ cidr: "203.0.113.0/33", kind: "office", label: "Typo" }],
      })
    ).rejects.toThrow('"203.0.113.0/33" is not a valid IPv4 or IPv6 address or CIDR range.');
    await expect(
      saveRule(t, "admin", offices.delhi, {
        networks: [{ cidr: "0.0.0.0/0", kind: "office", label: "Everything" }],
      })
    ).rejects.toThrow("is too broad");
    await expect(
      saveRule(t, "admin", offices.delhi, {
        networks: [{ cidr: "2001:db8::/16", kind: "office", label: "Too wide" }],
      })
    ).rejects.toThrow("is too broad");
    await expect(
      saveRule(t, "admin", offices.delhi, {
        networks: [{ cidr: "203.0.112.0/21", kind: "office", label: "ISP block" }],
      })
    ).rejects.toThrow("is too broad");
    await expect(
      saveRule(t, "admin", offices.delhi, {
        networks: [{ cidr: "2001:db8::/40", kind: "office", label: "ISP v6 block" }],
      })
    ).rejects.toThrow("is too broad");
    await expect(
      saveRule(t, "admin", offices.delhi, {
        networks: [{ cidr: "203.0.113.0/24", kind: "office", label: "x".repeat(61) }],
      })
    ).rejects.toThrow("needs a label of 1 to 60 characters");
    await expect(
      saveRule(t, "admin", offices.delhi, {
        geofence: { ...DELHI_GEOFENCE, maxAccuracyMeters: 100, radiusMeters: 100 },
      })
    ).rejects.toThrow("Accuracy limit must be smaller than the radius");
    await expect(
      saveRule(t, "admin", offices.delhi, { geofence: null, requirement: "geofence" })
    ).rejects.toThrow("This rule checks location, so set office coordinates and a radius.");
    expect(await t.run(async (ctx) => ctx.db.query("officeCheckInRules").collect())).toEqual([]);

    expect(await saveRule(t, "admin", offices.delhi)).toBe(1);
    // A second editor still holding "no rule yet" or a stale version is refused.
    for (const expectedVersion of [null, 0, 2]) {
      await expect(saveRule(t, "admin", offices.delhi, { expectedVersion })).rejects.toThrow(
        "This rule changed since you opened it. Reload and try again."
      );
    }
    expect(await saveRule(t, "admin", offices.delhi, { expectedVersion: 1 })).toBe(2);
    expect(
      await saveRule(t, "admin", offices.delhi, {
        expectedVersion: 2,
        networks: [
          { cidr: "203.0.113.0/24", kind: "office", label: "Delhi LAN" },
          { cidr: "2001:db8:10::/56", kind: "office", label: "Delhi v6" },
        ],
      })
    ).toBe(3);
  });

  test("Switching to enforcement needs explicit confirmation", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    expect(await saveRule(t, "admin", offices.delhi)).toBe(1);
    await expect(
      saveRule(t, "admin", offices.delhi, { enforcementMode: "enforce", expectedVersion: 1 })
    ).rejects.toThrow("ENFORCEMENT_CONFIRMATION_REQUIRED");
    // A brand-new rule cannot start in enforce without confirmation either.
    await expect(
      saveRule(t, "admin", offices.mumbai, { enforcementMode: "enforce" })
    ).rejects.toThrow("ENFORCEMENT_CONFIRMATION_REQUIRED");
    expect(
      await saveRule(t, "admin", offices.delhi, {
        confirmEnforcement: true,
        enforcementMode: "enforce",
        expectedVersion: 1,
      })
    ).toBe(2);
    // Already enforcing: every later enforce save asks again.
    await expect(
      saveRule(t, "admin", offices.delhi, { enforcementMode: "enforce", expectedVersion: 2 })
    ).rejects.toThrow("ENFORCEMENT_CONFIRMATION_REQUIRED");
    expect(
      await saveRule(t, "admin", offices.delhi, {
        confirmEnforcement: true,
        enforcementMode: "enforce",
        expectedVersion: 2,
      })
    ).toBe(3);
    expect(await auditFor(t, "rule_saved")).toHaveLength(3);
    expect((await clockIn(t, "delhi_rep", HOME_IP)).checkIn.admission).toBe("pending_review");
  });

  test("Office assignment needs manage:staff and a reason, and is audited", async () => {
    const t = createHarness();
    const { offices, staff } = await seed(t);
    const assign = (subject: string, reason = "Joined Delhi team") =>
      as(t, subject).mutation(api.crm.officeCheckInAdmin.assignStaffOffice, {
        officeId: offices.delhi,
        reason,
        staffId: staff.unassigned,
      });
    await expect(assign("hr")).rejects.toThrow("FORBIDDEN");
    await expect(assign("delhi_head")).rejects.toThrow("FORBIDDEN");
    await expect(assign("admin", "")).rejects.toThrow(
      "A reason between 3 and 500 characters is required."
    );
    await assign("admin");
    const member = await t.run(async (ctx) => ctx.db.get("staffUsers", staff.unassigned));
    expect(member?.officeId).toBe(offices.delhi);
    expect(await auditFor(t, "office_assigned")).toEqual([
      expect.objectContaining({
        actorStaffId: staff.admin,
        officeId: offices.delhi,
        reason: "Joined Delhi team",
        subjectStaffId: staff.unassigned,
        summary: "unassigned: none -> DEL",
      }),
    ]);
    expect((await clockIn(t, "unassigned")).checkIn.officeId).toBe(offices.delhi);
  });

  test("The admin overview lists pilot prefixes that did not match an office range", async () => {
    const t = createHarness();
    const { offices } = await seed(t);
    await seedRule(t, offices.delhi);
    await clockIn(t, "delhi_rep", HOME_IP);
    await clockIn(t, "delhi_report", IN_OFFICE_IP);
    await clockIn(t, "delhi_head", VPN_IP);
    const overview = await as(t, "admin").query(api.crm.officeCheckInAdmin.overview, {});
    expect(overview.unmatchedNetworks).toEqual(
      expect.arrayContaining([
        {
          count: 1,
          lastWorkDate: WORK_DATE,
          officeId: offices.delhi,
          prefix: "100.64.3.0/24",
          reasons: ["outside_allowlist"],
        },
        {
          count: 1,
          lastWorkDate: WORK_DATE,
          officeId: offices.delhi,
          prefix: "192.0.2.0/24",
          reasons: ["vpn_or_proxy_exit"],
        },
      ])
    );
    expect(overview.unmatchedNetworks.map((entry) => entry.prefix)).not.toContain("203.0.113.0/24");
    expect(JSON.stringify(overview)).not.toContain(HOME_IP);
  });
});
