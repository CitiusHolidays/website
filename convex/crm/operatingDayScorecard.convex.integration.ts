import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { METRIC_VERSION } from "./metricAggregates";
import { visibleScorecardMetricIds } from "./operatingDayScorecard";

const AUTH_ISSUER = "https://auth.scorecard.citius.test";
const FIXED_NOW = new Date("2026-08-30T16:00:00.000Z");
const DAY = "2026-08-30";
const PII_SENTINEL = "raw-pii-must-not-leave-scorecard";

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

type Harness = ReturnType<typeof createHarness>;
type HarnessRunContext = Parameters<Parameters<Harness["run"]>[0]>[0];

function actorEmail(actor: string) {
  return `${actor}@citius-e2e.test`;
}

async function seedStaff(
  ctx: HarnessRunContext,
  actor: string,
  roles: Doc<"staffUsers">["roles"],
  lastSeenAt: number | undefined = FIXED_NOW.getTime()
) {
  await ctx.db.insert("authIdentityLinks", {
    canonicalAuthUserId: `${AUTH_ISSUER}|${actor}`,
    createdAt: FIXED_NOW.getTime(),
    legacyAuthUserId: actor,
    status: "linked",
    updatedAt: FIXED_NOW.getTime(),
  });
  return await ctx.db.insert("staffUsers", {
    active: true,
    authUserId: actor,
    createdAt: FIXED_NOW.getTime(),
    email: actorEmail(actor),
    emailNormalized: actorEmail(actor),
    lastSeenAt,
    name: `${actor} scorecard staff`,
    roles,
    updatedAt: FIXED_NOW.getTime(),
  });
}

function asActor(t: Harness, actor: string) {
  return t.withIdentity({
    email: actorEmail(actor),
    issuer: AUTH_ISSUER,
    subject: actor,
    tokenIdentifier: `${AUTH_ISSUER}|${actor}`,
  });
}

async function seedReadyQueryAggregate(ctx: HarnessRunContext, queryTotal: number) {
  await ctx.db.insert("crmMetricBuckets", {
    periodKey: DAY,
    periodType: "day",
    scope: "all",
    updatedAt: FIXED_NOW.getTime() - 2000,
    values: { "queries.total": queryTotal },
  });
  await ctx.db.insert("crmMetricPublications", {
    generation: 7,
    key: "global",
    metricVersion: METRIC_VERSION,
    publishedAt: FIXED_NOW.getTime() - 1000,
  });
}

async function seedQuery(
  ctx: HarnessRunContext,
  actor: string,
  options: {
    contractingOwnerId?: string;
    contractingOwnerName?: string;
    createdAt?: number;
    inboundIntentId?: Doc<"inboundQueryIntents">["_id"];
    salesStatus?: Doc<"queries">["salesStatus"];
    submittedToContractingAt?: number;
  } = {}
) {
  const createdAt = options.createdAt ?? Date.parse(`${DAY}T09:00:00.000Z`);
  return await ctx.db.insert("queries", {
    clientName: PII_SENTINEL,
    contractingOwnerId: options.contractingOwnerId,
    contractingOwnerName: options.contractingOwnerName,
    contractingStatus: "Query Received",
    createdAt,
    createdBy: actor,
    inboundIntentId: options.inboundIntentId,
    paxCount: 2,
    queryCode: "Q-SCORE-1",
    queryType: "FIT",
    salesStatus: options.salesStatus ?? "Proposal in discussion",
    source: "Website",
    submittedToContractingAt: options.submittedToContractingAt,
    travelType: "Domestic Travel",
    updatedAt: createdAt,
  });
}

async function seedCompleteChain(ctx: HarnessRunContext) {
  const actor = "scorecard_admin";
  const adminId = await seedStaff(ctx, actor, ["Admin"]);
  const receivedAt = Date.parse(`${DAY}T08:00:00.000Z`);
  const convertedAt = Date.parse(`${DAY}T09:00:00.000Z`);
  const handedOffAt = Date.parse(`${DAY}T10:00:00.000Z`);
  const decidedAt = Date.parse(`${DAY}T11:00:00.000Z`);
  const revisionRequestedAt = Date.parse(`${DAY}T12:00:00.000Z`);
  const resolvingHandoffAt = Date.parse(`${DAY}T13:00:00.000Z`);

  const intentId = await ctx.db.insert("inboundQueryIntents", {
    clientName: PII_SENTINEL,
    consentAt: receivedAt,
    contactEmail: `${PII_SENTINEL}@example.test`,
    contactMobile: "+15555550123",
    createdAt: receivedAt,
    source: "Website",
    status: "converted",
  });
  const queryId = await seedQuery(ctx, actor, {
    contractingOwnerId: String(adminId),
    contractingOwnerName: PII_SENTINEL,
    createdAt: convertedAt,
    inboundIntentId: intentId,
    salesStatus: "Order Confirmed",
    submittedToContractingAt: convertedAt,
  });
  await ctx.db.patch("inboundQueryIntents", intentId, {
    convertedAt,
    convertedQueryId: String(queryId),
  });
  const proposalId = await ctx.db.insert("proposals", {
    clientName: PII_SENTINEL,
    createdAt: receivedAt,
    createdBy: actor,
    preparedBy: actor,
    preparedByStaffId: adminId,
    proposalCode: "P-SCORE-1",
    proposalRevision: 2,
    status: "Accepted",
    updatedAt: resolvingHandoffAt,
  });
  const handoffId = await ctx.db.insert("proposalQueryHandoffs", {
    airfarePerPax: 100,
    clientName: PII_SENTINEL,
    commandId: "00000000-0000-4000-8000-000000000001",
    costPrice: 300,
    handedOffAt,
    handedOffBy: actor,
    handedOffByName: PII_SENTINEL,
    handedOffByStaffId: adminId,
    itinerarySummary: "Reviewed itinerary",
    landCostPerPax: 150,
    proposalCode: "P-SCORE-1",
    proposalId,
    proposalRevision: 1,
    queryId,
    sellingPrice: 400,
    visaCostPerPax: 50,
  });
  await ctx.db.insert("proposalQueryDecisions", {
    commandId: "00000000-0000-4000-8000-000000000002",
    decidedAt,
    decidedBy: actor,
    decidedByName: PII_SENTINEL,
    decidedByStaffId: adminId,
    decision: "Order Confirmed",
    handoffId,
    payloadDigest: "decision-digest",
    proposalId,
    proposalRevision: 1,
    queryId,
  });
  const resolvingHandoffId = await ctx.db.insert("proposalQueryHandoffs", {
    airfarePerPax: 100,
    clientName: PII_SENTINEL,
    commandId: "00000000-0000-4000-8000-000000000003",
    costPrice: 320,
    handedOffAt: resolvingHandoffAt,
    handedOffBy: actor,
    handedOffByName: PII_SENTINEL,
    handedOffByStaffId: adminId,
    itinerarySummary: "Reviewed revision",
    landCostPerPax: 170,
    proposalCode: "P-SCORE-1",
    proposalId,
    proposalRevision: 2,
    queryId,
    sellingPrice: 420,
    visaCostPerPax: 50,
  });
  await ctx.db.insert("proposalRevisionRequests", {
    commandId: "00000000-0000-4000-8000-000000000004",
    decisionDigest: "revision-digest",
    proposalId,
    queryId,
    reason: "Reviewed changes requested",
    requestedAt: revisionRequestedAt,
    requestedBy: actor,
    requestedByName: PII_SENTINEL,
    requestedByStaffId: adminId,
    requestedChanges: {},
    resolvedAt: resolvingHandoffAt,
    resolvedBy: actor,
    resolvedByName: PII_SENTINEL,
    resolvedByStaffId: adminId,
    resolvingHandoffId,
    resolvingProposalRevision: 2,
    sourceHandoffId: handoffId,
    sourceProposalRevision: 1,
    status: "Resolved",
  });
  const offerId = await ctx.db.insert("confirmedOffers", {
    airfarePerPax: 100,
    confirmedAt: decidedAt,
    confirmedPax: 2,
    createdAt: decidedAt,
    createdBy: actor,
    landCostPerPax: 150,
    profitPerPax: 100,
    proposalId,
    proposalQueryHandoffId: handoffId,
    proposalRevision: 1,
    queryId,
    sellingPricePerPax: 400,
    source: "Website",
    sourceConsentAt: receivedAt,
    sourceInboundIntentId: intentId,
    travelStartDate: "2026-10-01",
    updatedAt: decidedAt,
    visaCostPerPax: 50,
  });
  await ctx.db.patch("queries", queryId, { confirmedAt: decidedAt, confirmedOfferId: offerId });
  await ctx.db.insert("jobCards", {
    clientName: PII_SENTINEL,
    confirmedOfferId: offerId,
    confirmedPax: 2,
    createdAt: revisionRequestedAt,
    createdBy: actor,
    jobCode: "JC-SCORE-1",
    proposalId,
    proposalQueryHandoffId: handoffId,
    proposalRevision: 1,
    queryId,
    status: "Open",
    updatedAt: revisionRequestedAt,
  });
  await seedReadyQueryAggregate(ctx, 1);
  return actor;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PF-SB-02 Operating-Day scorecard", () => {
  test("reconciles complete cohorts and returns only privacy-safe bounded drill-downs", async () => {
    const t = createHarness();
    const actor = await t.run(seedCompleteChain);
    const scorecard = await asActor(t, actor).query(api.crm.operatingDayScorecard.get, {
      dateRange: { from: DAY, to: DAY },
    });

    expect(scorecard.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(scorecard.scope.kind).toBe("organization");
    expect(scorecard.metrics).toHaveLength(10);
    const byId = new Map(scorecard.metrics.map((metric) => [metric.id, metric]));
    expect(byId.get("inbound_received")?.value.count).toBe(1);
    expect(byId.get("inbound_converted")?.value.count).toBe(1);
    expect(byId.get("inbound_confirmed")?.value.count).toBe(1);
    expect(byId.get("inbound_to_query")?.value.medianMs).toBe(3_600_000);
    expect(byId.get("handoff_to_decision")).toMatchObject({
      readiness: "setup_required",
      value: { count: null, medianMs: null, status: "Unknown" },
    });
    expect(byId.get("confirmation_to_job_card")).toMatchObject({
      readiness: "setup_required",
      value: { count: null, medianMs: null, status: "Unknown" },
    });
    expect(byId.get("revision_request_to_handoff")?.value.medianMs).toBe(3_600_000);
    expect(byId.get("unassigned_query_backlog")?.value.status).toBe("No data");

    const setupRequired = new Set(["handoff_to_decision", "confirmation_to_job_card"]);
    for (const metric of scorecard.metrics.filter((row) => !setupRequired.has(row.id))) {
      expect(metric.cohort.timeZone).toBe("UTC");
      expect(metric.cohort.definition.length).toBeGreaterThan(10);
      expect(metric.coverage.limit).toBe(120);
      expect(
        metric.coverage.included +
          metric.coverage.missingClocks +
          metric.coverage.unresolvedRecords +
          metric.coverage.pending
      ).toBe(metric.coverage.total);
      expect(metric.value.status).not.toBe("Unknown");
      expect(metric.lastCompleteAt).not.toBeNull();
      expect(metric.drillDown.total).toBe(metric.value.count);
      expect(metric.drillDown.rows.length).toBeLessThanOrEqual(12);
    }
    const weeklyActivity = byId.get("weekly_active_staff");
    expect(weeklyActivity?.breakdown.reduce((total, item) => total + item.count, 0)).toBe(
      weeklyActivity?.value.count
    );
    const serialized = JSON.stringify(scorecard);
    expect(serialized).not.toContain(PII_SENTINEL);
    expect(serialized).not.toContain("+15555550123");
    expect(serialized).not.toContain("@example.test");
  });

  test("marks a converted cohort Unknown when its durable completion clock is missing", async () => {
    const t = createHarness();
    const actor = "scorecard_sales_head";
    await t.run(async (ctx) => {
      await seedStaff(ctx, actor, ["Sales Head"]);
      const receivedAt = Date.parse(`${DAY}T08:00:00.000Z`);
      const intentId = await ctx.db.insert("inboundQueryIntents", {
        clientName: PII_SENTINEL,
        consentAt: receivedAt,
        createdAt: receivedAt,
        source: "Website",
        status: "converted",
      });
      const queryId = await seedQuery(ctx, actor, {
        createdAt: Date.parse(`${DAY}T09:00:00.000Z`),
        inboundIntentId: intentId,
      });
      await ctx.db.patch("inboundQueryIntents", intentId, {
        convertedQueryId: String(queryId),
      });
      await seedReadyQueryAggregate(ctx, 1);
    });

    const scorecard = await asActor(t, actor).query(api.crm.operatingDayScorecard.get, {
      dateRange: { from: DAY, to: DAY },
    });
    const conversionClock = scorecard.metrics.find((metric) => metric.id === "inbound_to_query");
    expect(conversionClock).toMatchObject({
      coverage: { missingClocks: 1, unresolvedRecords: 0 },
      lastCompleteAt: null,
      readiness: "partial",
      value: { count: null, medianMs: null, status: "Unknown" },
    });
    expect(
      scorecard.metrics.find((metric) => metric.id === "inbound_converted")?.value
    ).toMatchObject({ count: 1, status: "Known" });
  });

  test("fails aggregate/direct parity closed instead of publishing a backlog estimate", async () => {
    const t = createHarness();
    const actor = "scorecard_contracting_parity";
    await t.run(async (ctx) => {
      await seedStaff(ctx, actor, ["Contracting Head"]);
      await seedQuery(ctx, actor, {
        submittedToContractingAt: Date.parse(`${DAY}T10:00:00.000Z`),
      });
      await seedReadyQueryAggregate(ctx, 2);
    });

    const scorecard = await asActor(t, actor).query(api.crm.operatingDayScorecard.get, {
      dateRange: { from: DAY, to: DAY },
    });
    expect(
      scorecard.metrics.find((metric) => metric.id === "unassigned_query_backlog")
    ).toMatchObject({
      coverage: { state: "partial" },
      lastCompleteAt: null,
      readiness: "partial",
      value: { count: null, medianMs: null, status: "Unknown" },
    });
  });

  test("uses the server observation time deterministically for backlog age", async () => {
    const t = createHarness();
    const actor = "scorecard_contracting_clock";
    await t.run(async (ctx) => {
      await seedStaff(ctx, actor, ["Contracting Head"]);
      await seedQuery(ctx, actor, {
        submittedToContractingAt: Date.parse(`${DAY}T10:00:00.000Z`),
      });
      await seedReadyQueryAggregate(ctx, 1);
    });
    const principal = asActor(t, actor);
    const first = await principal.query(api.crm.operatingDayScorecard.get, {
      dateRange: { from: DAY, to: DAY },
    });
    expect(
      first.metrics.find((metric) => metric.id === "unassigned_query_backlog")?.value
    ).toMatchObject({ count: 1, medianMs: 6 * 3_600_000, p90Ms: 6 * 3_600_000, status: "Known" });

    vi.setSystemTime(FIXED_NOW.getTime() + 3_600_000);
    const second = await principal.query(api.crm.operatingDayScorecard.get, {
      dateRange: { from: DAY, to: DAY },
    });
    expect(second.generatedAt).toBe("2026-08-30T17:00:00.000Z");
    expect(
      second.metrics.find((metric) => metric.id === "unassigned_query_backlog")?.value
    ).toMatchObject({ medianMs: 7 * 3_600_000, p90Ms: 7 * 3_600_000 });
  });

  test("rejects non-owner roles and returns only Unknown for an over-wide range", async () => {
    const t = createHarness();
    await t.run(async (ctx) => {
      await seedStaff(ctx, "scorecard_sales", ["Sales"]);
      await seedStaff(ctx, "scorecard_sales_wide", ["Sales Head"]);
    });
    await expect(
      asActor(t, "scorecard_sales").query(api.crm.operatingDayScorecard.get, {
        dateRange: { from: DAY, to: DAY },
      })
    ).rejects.toThrow("FORBIDDEN");

    const wide = await asActor(t, "scorecard_sales_wide").query(api.crm.operatingDayScorecard.get, {
      dateRange: { from: "2026-06-01", to: DAY },
    });
    expect(wide.window.status).toBe("unsupported");
    expect(wide.metrics).toHaveLength(8);
    expect(wide.metrics.every((metric) => metric.value.status === "Unknown")).toBe(true);
    expect(wide.metrics.every((metric) => metric.coverage.limit === 120)).toBe(true);
  });

  test("preserves the existing organization and department-head role matrix", () => {
    expect(visibleScorecardMetricIds({ roles: ["Admin"] })).toHaveLength(10);
    expect(visibleScorecardMetricIds({ roles: ["Directors"] })).toHaveLength(10);
    expect(visibleScorecardMetricIds({ roles: ["Director Cement"] })).toHaveLength(10);
    expect(visibleScorecardMetricIds({ roles: ["Sales Head"] })).toEqual([
      "inbound_received",
      "inbound_converted",
      "inbound_dismissed",
      "inbound_confirmed",
      "inbound_to_query",
      "handoff_to_decision",
      "unassigned_query_backlog",
      "weekly_active_staff",
    ]);
    expect(visibleScorecardMetricIds({ roles: ["Contracting Head"] })).toEqual([
      "handoff_to_decision",
      "revision_request_to_handoff",
      "unassigned_query_backlog",
      "weekly_active_staff",
    ]);
    for (const role of ["Operations Head", "Accounts Head", "Head of Ticketing"]) {
      expect(visibleScorecardMetricIds({ roles: [role] })).toEqual([
        "confirmation_to_job_card",
        "weekly_active_staff",
      ]);
    }
  });
});
