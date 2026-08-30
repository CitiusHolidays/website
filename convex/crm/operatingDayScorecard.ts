import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import {
  isDirectorOrAdmin,
  type PortalAccess,
  type PortalDateRange,
  portalDateRangeValidator,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import { aggregateMetric, loadMetricTotals } from "./metricAggregates";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_DAYS = 31;
const SOURCE_ROW_LIMIT = 120;
const DRILL_DOWN_LIMIT = 12;
const UTC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const LEADER_ROLES = [
  "Admin",
  "Directors",
  "Director Cement",
  "Sales Head",
  "Contracting Head",
  "Operations Head",
  "Accounts Head",
  "Head of Ticketing",
] as const;

const SCORECARD_METRIC_IDS = [
  "inbound_received",
  "inbound_converted",
  "inbound_dismissed",
  "inbound_confirmed",
  "inbound_to_query",
  "handoff_to_decision",
  "confirmation_to_job_card",
  "revision_request_to_handoff",
  "unassigned_query_backlog",
  "weekly_active_staff",
] as const;

type ScorecardMetricId = (typeof SCORECARD_METRIC_IDS)[number];
type MetricReadiness = "partial" | "pending" | "ready" | "reconciling" | "stale";
type MetricValueStatus = "Known" | "No data" | "Unknown";

function scorecardMetricIds<Ids extends ScorecardMetricId[]>(...ids: Ids) {
  return ids;
}

const INBOUND_METRIC_IDS = scorecardMetricIds(
  "inbound_received",
  "inbound_converted",
  "inbound_dismissed",
  "inbound_confirmed",
  "inbound_to_query"
);

interface ScorecardWindow {
  from: string;
  sinceMs: number;
  status: "bounded" | "unsupported";
  to: string;
  untilMs: number;
}

interface DrillDownRow {
  at: string;
  durationMs: number | null;
  href: string | null;
  label: string;
  status: string;
}

interface ScorecardMetric {
  breakdown: Array<{ count: number; label: string }>;
  cohort: {
    definition: string;
    from: string;
    timeZone: "UTC";
    to: string;
  };
  coverage: {
    included: number;
    limit: number;
    missingClocks: number;
    pending: number;
    state: "complete" | "partial";
    total: number;
    unresolvedRecords: number;
  };
  drillDown: {
    rows: DrillDownRow[];
    total: number;
    truncated: boolean;
  };
  id: ScorecardMetricId;
  label: string;
  lastCompleteAt: string | null;
  readiness: MetricReadiness;
  unit: "count" | "milliseconds";
  value: {
    count: number | null;
    medianMs: number | null;
    p90Ms: number | null;
    status: MetricValueStatus;
  };
}

interface InboundCohortRow {
  intent: Doc<"inboundQueryIntents">;
  offer: Doc<"confirmedOffers"> | null;
  query: Doc<"queries"> | null;
}

interface HandoffCohortRow {
  decisions: Doc<"proposalQueryDecisions">[];
  handoff: Doc<"proposalQueryHandoffs">;
}

interface ConfirmationCohortRow {
  jobCards: Doc<"jobCards">[];
  offer: Doc<"confirmedOffers">;
}

interface RevisionCohortRow {
  handoff: Doc<"proposalQueryHandoffs"> | null;
  request: Doc<"proposalRevisionRequests">;
}

interface ScorecardSnapshot {
  aggregate: Awaited<ReturnType<typeof loadMetricTotals>> | null;
  confirmations: {
    complete: boolean;
    rows: ConfirmationCohortRow[];
  };
  handoffs: {
    complete: boolean;
    rows: HandoffCohortRow[];
  };
  inbound: {
    complete: boolean;
    rows: InboundCohortRow[];
  };
  queries: {
    complete: boolean;
    rows: Doc<"queries">[];
  };
  revisionRequests: {
    complete: boolean;
    rows: RevisionCohortRow[];
  };
  staff: {
    complete: boolean;
    rows: Doc<"staffUsers">[];
  };
}

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const metricReadinessValidator = v.union(
  v.literal("partial"),
  v.literal("pending"),
  v.literal("ready"),
  v.literal("reconciling"),
  v.literal("stale")
);
const metricValueStatusValidator = v.union(
  v.literal("Known"),
  v.literal("No data"),
  v.literal("Unknown")
);
const scorecardMetricIdValidator = v.union(
  v.literal("inbound_received"),
  v.literal("inbound_converted"),
  v.literal("inbound_dismissed"),
  v.literal("inbound_confirmed"),
  v.literal("inbound_to_query"),
  v.literal("handoff_to_decision"),
  v.literal("confirmation_to_job_card"),
  v.literal("revision_request_to_handoff"),
  v.literal("unassigned_query_backlog"),
  v.literal("weekly_active_staff")
);

const scorecardMetricValidator = v.object({
  breakdown: v.array(v.object({ count: v.number(), label: v.string() })),
  cohort: v.object({
    definition: v.string(),
    from: v.string(),
    timeZone: v.literal("UTC"),
    to: v.string(),
  }),
  coverage: v.object({
    included: v.number(),
    limit: v.number(),
    missingClocks: v.number(),
    pending: v.number(),
    state: v.union(v.literal("complete"), v.literal("partial")),
    total: v.number(),
    unresolvedRecords: v.number(),
  }),
  drillDown: v.object({
    rows: v.array(
      v.object({
        at: v.string(),
        durationMs: nullableNumber,
        href: nullableString,
        label: v.string(),
        status: v.string(),
      })
    ),
    total: v.number(),
    truncated: v.boolean(),
  }),
  id: scorecardMetricIdValidator,
  label: v.string(),
  lastCompleteAt: nullableString,
  readiness: metricReadinessValidator,
  unit: v.union(v.literal("count"), v.literal("milliseconds")),
  value: v.object({
    count: nullableNumber,
    medianMs: nullableNumber,
    p90Ms: nullableNumber,
    status: metricValueStatusValidator,
  }),
});

const operatingDayScorecardValidator = v.object({
  generatedAt: v.string(),
  metrics: v.array(scorecardMetricValidator),
  scope: v.object({
    kind: v.union(v.literal("organization"), v.literal("role")),
    roles: v.array(v.string()),
  }),
  window: v.object({
    from: v.string(),
    maxDays: v.number(),
    status: v.union(v.literal("bounded"), v.literal("unsupported")),
    timeZone: v.literal("UTC"),
    to: v.string(),
  }),
});

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function startOfUtcDay(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseUtcDay(value: string | undefined, label: string) {
  if (!value) {
    return null;
  }
  if (!UTC_DATE_PATTERN.test(value)) {
    throw new ConvexError(`${label} must use YYYY-MM-DD.`);
  }
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || utcDay(timestamp) !== value) {
    throw new ConvexError(`${label} must be a valid calendar date.`);
  }
  return timestamp;
}

export function resolveOperatingDayWindow(
  range: PortalDateRange | null | undefined,
  referenceNow: number
): ScorecardWindow {
  const explicitFrom = parseUtcDay(range?.from, "From");
  const explicitTo = parseUtcDay(range?.to, "To");
  const referenceDay = startOfUtcDay(referenceNow);
  const sinceMs = explicitFrom ?? (explicitTo ?? referenceDay) - (MAX_WINDOW_DAYS - 1) * DAY_MS;
  const selectedTo = explicitTo ?? referenceDay;
  const untilMs = Math.min(selectedTo + DAY_MS - 1, referenceNow);
  if (sinceMs > untilMs) {
    throw new ConvexError("From must be on or before To.");
  }
  const days = Math.floor((startOfUtcDay(untilMs) - startOfUtcDay(sinceMs)) / DAY_MS) + 1;
  return {
    from: utcDay(sinceMs),
    sinceMs,
    status: days > MAX_WINDOW_DAYS ? "unsupported" : "bounded",
    to: utcDay(untilMs),
    untilMs,
  };
}

function canViewScorecard(access: PortalAccess) {
  return Boolean(access.staffId && LEADER_ROLES.some((role) => access.roles.includes(role)));
}

function isOrganizationLeader(access: PortalAccess) {
  return isDirectorOrAdmin(access);
}

function hasAnyRole(access: Pick<PortalAccess, "roles">, roles: readonly string[]) {
  return roles.some((role) => access.roles.includes(role));
}

export function visibleScorecardMetricIds(access: Pick<PortalAccess, "roles">) {
  if (isDirectorOrAdmin(access)) {
    return [...SCORECARD_METRIC_IDS];
  }
  const visible = new Set<ScorecardMetricId>(["weekly_active_staff"]);
  if (hasAnyRole(access, ["Sales Head"])) {
    for (const id of [
      "inbound_received",
      "inbound_converted",
      "inbound_dismissed",
      "inbound_confirmed",
      "inbound_to_query",
      "handoff_to_decision",
      "unassigned_query_backlog",
    ] as const) {
      visible.add(id);
    }
  }
  if (hasAnyRole(access, ["Contracting Head"])) {
    visible.add("handoff_to_decision");
    visible.add("revision_request_to_handoff");
    visible.add("unassigned_query_backlog");
  }
  if (hasAnyRole(access, ["Accounts Head", "Operations Head", "Head of Ticketing"])) {
    visible.add("confirmation_to_job_card");
  }
  return SCORECARD_METRIC_IDS.filter((id) => visible.has(id));
}

function ownedActivityRoles(access: PortalAccess) {
  if (isOrganizationLeader(access)) {
    return [];
  }
  const owned = new Set<string>();
  if (access.roles.includes("Sales Head")) {
    owned.add("Sales");
    owned.add("Sales Head");
    owned.add("Sales Cement");
  }
  if (access.roles.includes("Contracting Head")) {
    owned.add("Contracting");
    owned.add("Contracting Head");
    owned.add("Contracting Cement");
  }
  if (access.roles.includes("Operations Head")) {
    owned.add("Operations");
    owned.add("Operations Head");
    owned.add("Operations Cement");
  }
  if (access.roles.includes("Accounts Head")) {
    owned.add("Accounts");
    owned.add("Accounts Head");
    owned.add("Finance");
  }
  if (access.roles.includes("Head of Ticketing")) {
    owned.add("Ticketing");
    owned.add("Head of Ticketing");
  }
  return [...owned].sort();
}

function capped<Row>(rows: Row[]) {
  return {
    complete: rows.length <= SOURCE_ROW_LIMIT,
    rows: rows.slice(0, SOURCE_ROW_LIMIT),
  };
}

async function loadInboundRows(ctx: QueryCtx, window: ScorecardWindow) {
  const loaded = capped(
    await ctx.db
      .query("inboundQueryIntents")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", window.sinceMs).lte("createdAt", window.untilMs)
      )
      .order("asc")
      .take(SOURCE_ROW_LIMIT + 1)
  );
  const intents = loaded.rows.filter(
    (intent) => !(intent.isSynthetic || intent.syntheticTestSessionId)
  );
  const rows = await Promise.all(
    intents.map(async (intent): Promise<InboundCohortRow> => {
      const queryId = intent.convertedQueryId
        ? ctx.db.normalizeId("queries", intent.convertedQueryId)
        : null;
      const queryRow = queryId ? await ctx.db.get("queries", queryId) : null;
      const offer = queryRow?.confirmedOfferId
        ? await ctx.db.get("confirmedOffers", queryRow.confirmedOfferId)
        : null;
      return { intent, offer, query: queryRow };
    })
  );
  return { complete: loaded.complete, rows };
}

async function loadHandoffRows(ctx: QueryCtx, window: ScorecardWindow) {
  const loaded = capped(
    await ctx.db
      .query("proposalQueryHandoffs")
      .withIndex("by_handedOffAt", (q) =>
        q.gte("handedOffAt", window.sinceMs).lte("handedOffAt", window.untilMs)
      )
      .order("asc")
      .take(SOURCE_ROW_LIMIT + 1)
  );
  const rows = await Promise.all(
    loaded.rows.map(async (handoff): Promise<HandoffCohortRow> => {
      const decisions = await ctx.db
        .query("proposalQueryDecisions")
        .withIndex("by_handoffId", (q) => q.eq("handoffId", handoff._id))
        .take(2);
      return { decisions, handoff };
    })
  );
  return { complete: loaded.complete, rows };
}

async function loadConfirmationRows(ctx: QueryCtx, window: ScorecardWindow) {
  const loaded = capped(
    await ctx.db
      .query("confirmedOffers")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", window.sinceMs).lte("createdAt", window.untilMs)
      )
      .order("asc")
      .take(SOURCE_ROW_LIMIT + 1)
  );
  const rows = await Promise.all(
    loaded.rows.map(async (offer): Promise<ConfirmationCohortRow> => {
      const jobCards = await ctx.db
        .query("jobCards")
        .withIndex("by_queryId", (q) => q.eq("queryId", offer.queryId))
        .take(2);
      return { jobCards, offer };
    })
  );
  return { complete: loaded.complete, rows };
}

async function loadRevisionRequestRows(ctx: QueryCtx, window: ScorecardWindow) {
  const loaded = capped(
    await ctx.db
      .query("proposalRevisionRequests")
      .withIndex("by_requestedAt", (q) =>
        q.gte("requestedAt", window.sinceMs).lte("requestedAt", window.untilMs)
      )
      .order("asc")
      .take(SOURCE_ROW_LIMIT + 1)
  );
  const rows = await Promise.all(
    loaded.rows.map(
      async (request): Promise<RevisionCohortRow> => ({
        handoff: request.resolvingHandoffId
          ? await ctx.db.get("proposalQueryHandoffs", request.resolvingHandoffId)
          : null,
        request,
      })
    )
  );
  return { complete: loaded.complete, rows };
}

async function loadQueryRows(ctx: QueryCtx, access: PortalAccess, window: ScorecardWindow) {
  const loaded = capped(
    await ctx.db
      .query("queries")
      .withIndex("by_createdAt", (q) =>
        q.gte("createdAt", window.sinceMs).lte("createdAt", window.untilMs)
      )
      .order("asc")
      .take(SOURCE_ROW_LIMIT + 1)
  );
  return {
    complete: loaded.complete,
    rows: shouldApplyCementScope(access)
      ? loaded.rows.filter((row) => ["Cement", "Cement Bidding"].includes(row.queryType))
      : loaded.rows,
  };
}

async function loadStaffRows(ctx: QueryCtx) {
  return capped(
    await ctx.db
      .query("staffUsers")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(SOURCE_ROW_LIMIT + 1)
  );
}

async function loadScorecardSnapshot(
  ctx: QueryCtx,
  access: PortalAccess,
  window: ScorecardWindow,
  visible: Set<ScorecardMetricId>,
  referenceNow: number
): Promise<ScorecardSnapshot> {
  const needsInbound = INBOUND_METRIC_IDS.some((id) => visible.has(id));
  const needsHandoffs = visible.has("handoff_to_decision");
  const needsConfirmations = visible.has("confirmation_to_job_card");
  const needsRevisions = visible.has("revision_request_to_handoff");
  const needsQueries = visible.has("unassigned_query_backlog");
  const range = { from: window.from, to: window.to };
  const [aggregate, inbound, handoffs, confirmations, revisionRequests, queries, staff] =
    await Promise.all([
      needsQueries
        ? loadMetricTotals(
            ctx,
            shouldApplyCementScope(access) ? "cement" : "all",
            range,
            referenceNow
          )
        : Promise.resolve(null),
      needsInbound ? loadInboundRows(ctx, window) : Promise.resolve({ complete: true, rows: [] }),
      needsHandoffs ? loadHandoffRows(ctx, window) : Promise.resolve({ complete: true, rows: [] }),
      needsConfirmations
        ? loadConfirmationRows(ctx, window)
        : Promise.resolve({ complete: true, rows: [] }),
      needsRevisions
        ? loadRevisionRequestRows(ctx, window)
        : Promise.resolve({ complete: true, rows: [] }),
      needsQueries
        ? loadQueryRows(ctx, access, window)
        : Promise.resolve({ complete: true, rows: [] }),
      visible.has("weekly_active_staff")
        ? loadStaffRows(ctx)
        : Promise.resolve({ complete: true, rows: [] }),
    ]);
  return { aggregate, confirmations, handoffs, inbound, queries, revisionRequests, staff };
}

function iso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function metricCohort(window: ScorecardWindow, definition: string) {
  return { definition, from: window.from, timeZone: "UTC" as const, to: window.to };
}

function metricCoverage(input: {
  complete: boolean;
  included: number;
  missingClocks?: number;
  pending?: number;
  total: number;
  unresolvedRecords?: number;
}) {
  const missingClocks = input.missingClocks ?? 0;
  const unresolvedRecords = input.unresolvedRecords ?? 0;
  return {
    included: input.included,
    limit: SOURCE_ROW_LIMIT,
    missingClocks,
    pending: input.pending ?? 0,
    state:
      input.complete && missingClocks === 0 && unresolvedRecords === 0
        ? ("complete" as const)
        : ("partial" as const),
    total: input.total,
    unresolvedRecords,
  };
}

function metricDrillDown(rows: DrillDownRow[], total: number) {
  return {
    rows: rows.slice(0, DRILL_DOWN_LIMIT),
    total,
    truncated: rows.length > DRILL_DOWN_LIMIT,
  };
}

function metricValueStatus(known: boolean, count: number): MetricValueStatus {
  if (!known) {
    return "Unknown";
  }
  return count > 0 ? "Known" : "No data";
}

function baseMetric(
  id: ScorecardMetricId,
  label: string,
  window: ScorecardWindow,
  definition: string
) {
  return {
    breakdown: [],
    cohort: metricCohort(window, definition),
    id,
    label,
  };
}

function countMetric(input: {
  breakdown?: Array<{ count: number; label: string }>;
  complete: boolean;
  definition: string;
  drillDownTotal?: number;
  id: ScorecardMetricId;
  label: string;
  lastCompleteAt: string | null;
  missingClocks?: number;
  pending?: number;
  readiness?: MetricReadiness;
  rows: DrillDownRow[];
  total: number;
  unresolvedRecords?: number;
  value: number;
  window: ScorecardWindow;
}): ScorecardMetric {
  const coverage = metricCoverage({
    complete: input.complete,
    included: Math.max(
      0,
      input.total - (input.missingClocks ?? 0) - (input.unresolvedRecords ?? 0)
    ),
    missingClocks: input.missingClocks,
    pending: input.pending,
    total: input.total,
    unresolvedRecords: input.unresolvedRecords,
  });
  const requestedReadiness = input.readiness ?? "ready";
  const known = coverage.state === "complete" && requestedReadiness === "ready";
  const readiness = coverage.state === "complete" ? requestedReadiness : "partial";
  return {
    ...baseMetric(input.id, input.label, input.window, input.definition),
    breakdown: input.breakdown ?? [],
    coverage,
    drillDown: metricDrillDown(input.rows, input.drillDownTotal ?? input.rows.length),
    lastCompleteAt:
      known || requestedReadiness === "reconciling" || requestedReadiness === "stale"
        ? input.lastCompleteAt
        : null,
    readiness,
    unit: "count",
    value: {
      count: known ? input.value : null,
      medianMs: null,
      p90Ms: null,
      status: metricValueStatus(known, input.value),
    },
  };
}

function durationMetric(input: {
  complete: boolean;
  definition: string;
  durations: Array<{ row: DrillDownRow; value: number }>;
  id: ScorecardMetricId;
  label: string;
  lastCompleteAt: string | null;
  missingClocks: number;
  pending: number;
  readiness?: MetricReadiness;
  total: number;
  unresolvedRecords?: number;
  window: ScorecardWindow;
}): ScorecardMetric {
  const coverage = metricCoverage({
    complete: input.complete,
    included: input.durations.length,
    missingClocks: input.missingClocks,
    pending: input.pending,
    total: input.total,
    unresolvedRecords: input.unresolvedRecords,
  });
  const requestedReadiness = input.readiness ?? "ready";
  const known = coverage.state === "complete" && requestedReadiness === "ready";
  const readiness = coverage.state === "complete" ? requestedReadiness : "partial";
  const values = input.durations.map((duration) => duration.value);
  return {
    ...baseMetric(input.id, input.label, input.window, input.definition),
    coverage,
    drillDown: metricDrillDown(
      input.durations.map((duration) => duration.row),
      input.durations.length
    ),
    lastCompleteAt:
      known || requestedReadiness === "reconciling" || requestedReadiness === "stale"
        ? input.lastCompleteAt
        : null,
    readiness,
    unit: "milliseconds",
    value: {
      count: known ? input.durations.length : null,
      medianMs: known ? percentile(values, 0.5) : null,
      p90Ms: known ? percentile(values, 0.9) : null,
      status: metricValueStatus(known, values.length),
    },
  };
}

function unknownMetric(
  id: ScorecardMetricId,
  window: ScorecardWindow,
  definition: string
): ScorecardMetric {
  return {
    ...baseMetric(id, METRIC_LABELS[id], window, definition),
    coverage: metricCoverage({ complete: false, included: 0, total: 0 }),
    drillDown: metricDrillDown([], 0),
    lastCompleteAt: null,
    readiness: "partial",
    unit: DURATION_METRIC_IDS.has(id) ? "milliseconds" : "count",
    value: { count: null, medianMs: null, p90Ms: null, status: "Unknown" },
  };
}

function inboundHref(intentId: Id<"inboundQueryIntents">) {
  return `/portal/inbound-leads?inboundIntentId=${encodeURIComponent(String(intentId))}`;
}

function queryHref(queryId: Id<"queries">) {
  return `/portal/queries?open=query&id=${encodeURIComponent(String(queryId))}`;
}

function proposalHref(proposalId: Id<"proposals">, queryId: Id<"queries">) {
  return `/portal/proposals?open=proposal&id=${encodeURIComponent(String(proposalId))}&queryId=${encodeURIComponent(String(queryId))}`;
}

function jobCardHref(jobCardId: Id<"jobCards">) {
  return `/portal/job-cards?open=jobCard&id=${encodeURIComponent(String(jobCardId))}`;
}

function inboundRow(row: InboundCohortRow, status: string): DrillDownRow {
  return {
    at: iso(row.intent.createdAt),
    durationMs: null,
    href: inboundHref(row.intent._id),
    label: `${row.intent.source} enquiry`,
    status,
  };
}

function hasStableInboundQuery(row: InboundCohortRow) {
  return Boolean(
    row.query &&
      row.query.inboundIntentId === row.intent._id &&
      String(row.query._id) === row.intent.convertedQueryId
  );
}

function stableInboundConfirmation(row: InboundCohortRow) {
  return Boolean(
    hasStableInboundQuery(row) &&
      row.query &&
      row.offer?.confirmedAt !== undefined &&
      row.offer.confirmedAt >= row.intent.createdAt &&
      row.offer.queryId === row.query._id &&
      row.offer.sourceInboundIntentId === row.intent._id
  );
}

function buildInboundMetrics(
  snapshot: ScorecardSnapshot["inbound"],
  window: ScorecardWindow,
  generatedAt: string
) {
  const received = snapshot.rows;
  const converted = received.filter((row) => row.intent.status === "converted");
  const linkedConverted = converted.filter(hasStableInboundQuery);
  const unresolvedConversions = converted.length - linkedConverted.length;
  const dismissed = received.filter((row) => row.intent.status === "dismissed");
  const exactConfirmed = linkedConverted.filter(stableInboundConfirmation);
  const invalidConfirmationClocks = linkedConverted.filter(
    (row) =>
      row.offer &&
      row.offer.queryId === row.query?._id &&
      row.offer.sourceInboundIntentId === row.intent._id &&
      (row.offer.confirmedAt === undefined || row.offer.confirmedAt < row.intent.createdAt)
  ).length;
  const unresolvedConfirmations =
    unresolvedConversions +
    linkedConverted.filter((row) => row.query?.salesStatus === "Order Confirmed" && !row.offer)
      .length +
    linkedConverted.filter(
      (row) =>
        row.offer &&
        (row.offer.queryId !== row.query?._id || row.offer.sourceInboundIntentId !== row.intent._id)
    ).length;
  const pendingConfirmations = Math.max(
    0,
    converted.length - exactConfirmed.length - invalidConfirmationClocks - unresolvedConfirmations
  );
  const dismissalCounts = new Map<string, number>();
  for (const row of dismissed) {
    const reason = row.intent.dismissalReason ?? "Unknown reason";
    dismissalCounts.set(reason, (dismissalCounts.get(reason) ?? 0) + 1);
  }
  const durationRows = linkedConverted.flatMap((row) => {
    if (row.intent.convertedAt === undefined || row.intent.convertedAt < row.intent.createdAt) {
      return [];
    }
    const durationMs = row.intent.convertedAt - row.intent.createdAt;
    return [
      {
        row: {
          ...inboundRow(row, "Converted to Query"),
          durationMs,
        },
        value: durationMs,
      },
    ];
  });
  return [
    countMetric({
      complete: snapshot.complete,
      definition: "Non-synthetic consented enquiries received in the selected UTC window.",
      id: "inbound_received",
      label: METRIC_LABELS.inbound_received,
      lastCompleteAt: generatedAt,
      rows: received.map((row) => inboundRow(row, row.intent.status)),
      total: received.length,
      value: received.length,
      window,
    }),
    countMetric({
      complete: snapshot.complete,
      definition: "Received enquiries durably converted to a Query; replay does not add a row.",
      id: "inbound_converted",
      label: METRIC_LABELS.inbound_converted,
      lastCompleteAt: generatedAt,
      rows: linkedConverted.map((row) => inboundRow(row, "Converted to Query")),
      total: converted.length,
      unresolvedRecords: unresolvedConversions,
      value: linkedConverted.length,
      window,
    }),
    countMetric({
      breakdown: [...dismissalCounts.entries()]
        .map(([label, count]) => ({ count, label }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      complete: snapshot.complete,
      definition:
        "Received enquiries durably dismissed by Sales, grouped only by the safe reason taxonomy.",
      id: "inbound_dismissed",
      label: METRIC_LABELS.inbound_dismissed,
      lastCompleteAt: generatedAt,
      rows: dismissed.map((row) => inboundRow(row, "Dismissed")),
      total: dismissed.length,
      value: dismissed.length,
      window,
    }),
    countMetric({
      complete: snapshot.complete,
      definition:
        "Converted enquiries with an exact source-bound Confirmed Offer; attribution is observed, not causal.",
      id: "inbound_confirmed",
      label: METRIC_LABELS.inbound_confirmed,
      lastCompleteAt: generatedAt,
      missingClocks: invalidConfirmationClocks,
      pending: pendingConfirmations,
      rows: exactConfirmed.map((row) => ({
        ...inboundRow(row, "Confirmed Offer"),
        at: iso(row.offer?.confirmedAt ?? row.intent.createdAt),
        href: row.query ? queryHref(row.query._id) : inboundHref(row.intent._id),
      })),
      total: converted.length,
      unresolvedRecords: unresolvedConfirmations,
      value: exactConfirmed.length,
      window,
    }),
    durationMetric({
      complete: snapshot.complete,
      definition:
        "Completed received-to-Query clocks for enquiries marked converted in the selected received cohort.",
      durations: durationRows,
      id: "inbound_to_query",
      label: METRIC_LABELS.inbound_to_query,
      lastCompleteAt: generatedAt,
      missingClocks: linkedConverted.length - durationRows.length,
      pending: 0,
      total: converted.length,
      unresolvedRecords: unresolvedConversions,
      window,
    }),
  ];
}

function buildHandoffMetric(
  snapshot: ScorecardSnapshot["handoffs"],
  window: ScorecardWindow,
  generatedAt: string
) {
  let missingClocks = 0;
  let pending = 0;
  let unresolvedRecords = 0;
  const durations: Array<{ row: DrillDownRow; value: number }> = [];
  for (const { decisions, handoff } of snapshot.rows) {
    if (decisions.length === 0) {
      pending += 1;
      continue;
    }
    if (decisions.length !== 1) {
      unresolvedRecords += 1;
      continue;
    }
    const [decision] = decisions;
    if (
      decision.proposalId !== handoff.proposalId ||
      decision.queryId !== handoff.queryId ||
      decision.proposalRevision !== handoff.proposalRevision
    ) {
      unresolvedRecords += 1;
      continue;
    }
    if (decision.decidedAt < handoff.handedOffAt) {
      missingClocks += 1;
      continue;
    }
    const durationMs = decision.decidedAt - handoff.handedOffAt;
    durations.push({
      row: {
        at: iso(handoff.handedOffAt),
        durationMs,
        href: proposalHref(handoff.proposalId, handoff.queryId),
        label: `${handoff.proposalCode} · revision ${handoff.proposalRevision}`,
        status: decision.decision,
      },
      value: durationMs,
    });
  }
  return durationMetric({
    complete: snapshot.complete,
    definition:
      "Exact Proposal Handoffs in the window through their one immutable Sales Decision; open handoffs stay pending.",
    durations,
    id: "handoff_to_decision",
    label: METRIC_LABELS.handoff_to_decision,
    lastCompleteAt: generatedAt,
    missingClocks,
    pending,
    total: snapshot.rows.length,
    unresolvedRecords,
    window,
  });
}

function exactConfirmationJobCard(row: ConfirmationCohortRow) {
  if (row.offer.confirmedAt === undefined) {
    return { kind: "missing_clock" as const };
  }
  if (!row.offer.proposalQueryHandoffId || row.offer.proposalRevision === undefined) {
    return { kind: "unresolved" as const };
  }
  if (row.jobCards.length === 0) {
    return { kind: "pending" as const };
  }
  if (row.jobCards.length !== 1) {
    return { kind: "unresolved" as const };
  }
  const [jobCard] = row.jobCards;
  if (
    jobCard.confirmedOfferId !== row.offer._id ||
    jobCard.proposalId !== row.offer.proposalId ||
    jobCard.queryId !== row.offer.queryId ||
    jobCard.proposalQueryHandoffId !== row.offer.proposalQueryHandoffId ||
    jobCard.proposalRevision !== row.offer.proposalRevision ||
    jobCard.createdAt < row.offer.confirmedAt
  ) {
    return jobCard.createdAt < row.offer.confirmedAt
      ? { kind: "missing_clock" as const }
      : { kind: "unresolved" as const };
  }
  return {
    durationMs: jobCard.createdAt - row.offer.confirmedAt,
    jobCard,
    kind: "complete" as const,
  };
}

function buildConfirmationMetric(
  snapshot: ScorecardSnapshot["confirmations"],
  window: ScorecardWindow,
  generatedAt: string
) {
  let missingClocks = 0;
  let pending = 0;
  let unresolvedRecords = 0;
  const durations: Array<{ row: DrillDownRow; value: number }> = [];
  for (const row of snapshot.rows) {
    const exact = exactConfirmationJobCard(row);
    if (exact.kind === "pending") {
      pending += 1;
    } else if (exact.kind === "missing_clock") {
      missingClocks += 1;
    } else if (exact.kind === "unresolved") {
      unresolvedRecords += 1;
    } else {
      durations.push({
        row: {
          at: iso(row.offer.confirmedAt ?? row.offer.createdAt),
          durationMs: exact.durationMs,
          href: jobCardHref(exact.jobCard._id),
          label: `Confirmed revision ${row.offer.proposalRevision}`,
          status: "Job Card opened",
        },
        value: exact.durationMs,
      });
    }
  }
  return durationMetric({
    complete: snapshot.complete,
    definition:
      "Confirmed Offers created in the window through an exact revision-bound Job Card opening; unopened offers stay pending.",
    durations,
    id: "confirmation_to_job_card",
    label: METRIC_LABELS.confirmation_to_job_card,
    lastCompleteAt: generatedAt,
    missingClocks,
    pending,
    total: snapshot.rows.length,
    unresolvedRecords,
    window,
  });
}

function buildRevisionMetric(
  snapshot: ScorecardSnapshot["revisionRequests"],
  window: ScorecardWindow,
  generatedAt: string
) {
  let missingClocks = 0;
  let pending = 0;
  let unresolvedRecords = 0;
  const durations: Array<{ row: DrillDownRow; value: number }> = [];
  for (const { handoff, request } of snapshot.rows) {
    if (request.status === "Open") {
      pending += 1;
      continue;
    }
    if (request.resolvedAt === undefined || request.resolvedAt < request.requestedAt) {
      missingClocks += 1;
      continue;
    }
    if (
      !handoff ||
      request.resolvingHandoffId !== handoff._id ||
      request.proposalId !== handoff.proposalId ||
      request.queryId !== handoff.queryId ||
      request.resolvingProposalRevision !== handoff.proposalRevision ||
      handoff.proposalRevision <= request.sourceProposalRevision
    ) {
      unresolvedRecords += 1;
      continue;
    }
    if (handoff.handedOffAt !== request.resolvedAt) {
      missingClocks += 1;
      continue;
    }
    const durationMs = request.resolvedAt - request.requestedAt;
    durations.push({
      row: {
        at: iso(request.requestedAt),
        durationMs,
        href: proposalHref(request.proposalId, request.queryId),
        label: `Revision request · revision ${request.sourceProposalRevision}`,
        status: "Resolved by newer handoff",
      },
      value: durationMs,
    });
  }
  return durationMetric({
    complete: snapshot.complete,
    definition:
      "Revision Requests opened in the window through the qualifying newer Proposal Handoff; open requests stay pending.",
    durations,
    id: "revision_request_to_handoff",
    label: METRIC_LABELS.revision_request_to_handoff,
    lastCompleteAt: generatedAt,
    missingClocks,
    pending,
    total: snapshot.rows.length,
    unresolvedRecords,
    window,
  });
}

function aggregateReadiness(snapshot: ScorecardSnapshot) {
  const { aggregate } = snapshot;
  if (!aggregate?.complete) {
    return { lastCompleteAt: null, readiness: "pending" as const };
  }
  if (aggregate.readiness.state === "stale") {
    return {
      lastCompleteAt: aggregate.readiness.lastCompletedAt
        ? iso(aggregate.readiness.lastCompletedAt)
        : null,
      readiness: "stale" as const,
    };
  }
  if (aggregate.readiness.dirty.hasPending) {
    return {
      lastCompleteAt: aggregate.readiness.lastCompletedAt
        ? iso(aggregate.readiness.lastCompletedAt)
        : null,
      readiness: "reconciling" as const,
    };
  }
  return {
    lastCompleteAt: aggregate.readiness.lastCompletedAt
      ? iso(aggregate.readiness.lastCompletedAt)
      : null,
    readiness: "ready" as const,
  };
}

function buildBacklogMetric(
  snapshot: ScorecardSnapshot,
  window: ScorecardWindow,
  referenceNow: number
) {
  const aggregateState = aggregateReadiness(snapshot);
  const aggregateTotal = aggregateMetric(snapshot.aggregate?.values ?? {}, "queries.total");
  const parity = snapshot.queries.complete && aggregateTotal === snapshot.queries.rows.length;
  const ambiguous = snapshot.queries.rows.filter(
    (row) => !row.contractingOwnerId?.trim() && Boolean(row.contractingOwnerName?.trim())
  );
  const backlog = snapshot.queries.rows.filter(
    (row) =>
      row.submittedToContractingAt !== undefined &&
      !row.contractingOwnerId?.trim() &&
      !row.contractingOwnerName?.trim()
  );
  const rows = backlog.map((row) => {
    const durationMs = Math.max(0, referenceNow - (row.submittedToContractingAt ?? row.createdAt));
    return {
      row: {
        at: iso(row.submittedToContractingAt ?? row.createdAt),
        durationMs,
        href: queryHref(row._id),
        label: row.queryCode,
        status: "Awaiting stable Contracting owner",
      },
      value: durationMs,
    };
  });
  return durationMetric({
    complete: parity,
    definition:
      "Queries created in the window, submitted to Contracting, and still lacking a stable Contracting Staff assignment at the observation time.",
    durations: rows,
    id: "unassigned_query_backlog",
    label: METRIC_LABELS.unassigned_query_backlog,
    lastCompleteAt: aggregateState.lastCompleteAt,
    missingClocks: 0,
    pending: 0,
    readiness: parity ? aggregateState.readiness : "partial",
    total: backlog.length + ambiguous.length,
    unresolvedRecords: ambiguous.length,
    window,
  });
}

function buildWeeklyActivityMetric(
  snapshot: ScorecardSnapshot["staff"],
  access: PortalAccess,
  window: ScorecardWindow,
  referenceNow: number,
  generatedAt: string
) {
  const roles = ownedActivityRoles(access);
  const scoped = roles.length
    ? snapshot.rows.filter((staff) => staff.roles.some((role) => roles.includes(role)))
    : snapshot.rows;
  const missingClocks = scoped.filter((staff) => staff.lastSeenAt === undefined).length;
  const activeCutoff = referenceNow - 7 * DAY_MS;
  const active = scoped.filter((staff) => (staff.lastSeenAt ?? 0) >= activeCutoff);
  const breakdown = new Map<string, number>();
  for (const staff of active) {
    const matchingRoles = [...staff.roles]
      .filter((role) => roles.length === 0 || roles.includes(role))
      .sort((left, right) => left.localeCompare(right));
    const [primaryRole] = matchingRoles;
    const roleLabel = primaryRole ?? "Unassigned role";
    breakdown.set(roleLabel, (breakdown.get(roleLabel) ?? 0) + 1);
  }
  const breakdownRows = [...breakdown.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
  return countMetric({
    breakdown: breakdownRows,
    complete: snapshot.complete,
    definition:
      "Active Staff observed in the trailing seven days, aggregated only by the viewer's owned roles; no individual activity is exposed.",
    drillDownTotal: active.length,
    id: "weekly_active_staff",
    label: METRIC_LABELS.weekly_active_staff,
    lastCompleteAt: generatedAt,
    missingClocks,
    rows: breakdownRows.map((row) => ({
      at: generatedAt,
      durationMs: null,
      href: null,
      label: row.label,
      status: `${row.count} active`,
    })),
    total: scoped.length,
    value: active.length,
    window,
  });
}

const METRIC_LABELS = {
  confirmation_to_job_card: "Confirmation to Job Card",
  handoff_to_decision: "Proposal Handoff to Sales Decision",
  inbound_confirmed: "Confirmed from consented enquiries",
  inbound_converted: "Converted to Query",
  inbound_dismissed: "Dismissed enquiries",
  inbound_received: "Consented enquiries received",
  inbound_to_query: "Enquiry received to Query",
  revision_request_to_handoff: "Revision request recovery",
  unassigned_query_backlog: "Unassigned Contracting backlog age",
  weekly_active_staff: "Weekly active Staff by role",
} satisfies Record<ScorecardMetricId, string>;

const DURATION_METRIC_IDS = new Set<ScorecardMetricId>([
  "inbound_to_query",
  "handoff_to_decision",
  "confirmation_to_job_card",
  "revision_request_to_handoff",
  "unassigned_query_backlog",
]);

function unsupportedDefinition() {
  return `Select at most ${MAX_WINDOW_DAYS} UTC days to compute this bounded cohort.`;
}

function buildScorecardMetrics(
  snapshot: ScorecardSnapshot,
  access: PortalAccess,
  visibleIds: ScorecardMetricId[],
  window: ScorecardWindow,
  referenceNow: number
) {
  if (window.status === "unsupported") {
    return visibleIds.map((id) => unknownMetric(id, window, unsupportedDefinition()));
  }
  const generatedAt = iso(referenceNow);
  const metrics = new Map<ScorecardMetricId, ScorecardMetric>();
  for (const metric of buildInboundMetrics(snapshot.inbound, window, generatedAt)) {
    metrics.set(metric.id, metric);
  }
  metrics.set("handoff_to_decision", buildHandoffMetric(snapshot.handoffs, window, generatedAt));
  metrics.set(
    "confirmation_to_job_card",
    buildConfirmationMetric(snapshot.confirmations, window, generatedAt)
  );
  metrics.set(
    "revision_request_to_handoff",
    buildRevisionMetric(snapshot.revisionRequests, window, generatedAt)
  );
  metrics.set("unassigned_query_backlog", buildBacklogMetric(snapshot, window, referenceNow));
  metrics.set(
    "weekly_active_staff",
    buildWeeklyActivityMetric(snapshot.staff, access, window, referenceNow, generatedAt)
  );
  return visibleIds.flatMap((id) => {
    const metric = metrics.get(id);
    return metric ? [metric] : [];
  });
}

function emptySnapshot(): ScorecardSnapshot {
  return {
    aggregate: null,
    confirmations: { complete: false, rows: [] },
    handoffs: { complete: false, rows: [] },
    inbound: { complete: false, rows: [] },
    queries: { complete: false, rows: [] },
    revisionRequests: { complete: false, rows: [] },
    staff: { complete: false, rows: [] },
  };
}

export const get = query({
  args: { dateRange: portalDateRangeValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    if (!canViewScorecard(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const referenceNow = Date.now();
    const window = resolveOperatingDayWindow(args.dateRange, referenceNow);
    const visibleIds = visibleScorecardMetricIds(access);
    const snapshot =
      window.status === "bounded"
        ? await loadScorecardSnapshot(ctx, access, window, new Set(visibleIds), referenceNow)
        : emptySnapshot();
    return {
      generatedAt: iso(referenceNow),
      metrics: buildScorecardMetrics(snapshot, access, visibleIds, window, referenceNow),
      scope: {
        kind: isOrganizationLeader(access) ? ("organization" as const) : ("role" as const),
        roles: isOrganizationLeader(access) ? access.roles : ownedActivityRoles(access),
      },
      window: {
        from: window.from,
        maxDays: MAX_WINDOW_DAYS,
        status: window.status,
        timeZone: "UTC" as const,
        to: window.to,
      },
    };
  },
  returns: operatingDayScorecardValidator,
});
