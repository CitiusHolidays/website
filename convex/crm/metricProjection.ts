import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isCementQueryType } from "./lib";
import type { AggregatePeriodType, MetricSourceType, MetricValues } from "./metricTypes";

interface MetricSourceRecord {
  _creationTime: number;
  amount?: number;
  approvalStatus?: string;
  balanceAmount?: number;
  budgetAmount?: number;
  createdAt?: number;
  dueDate?: string;
  expectedAmount?: number;
  foodPreference?: string;
  fullName?: string;
  hotelAllocation?: string;
  issuedSeats?: number;
  jobCardId?: Id<"jobCards">;
  leadStage?: string;
  passportStatus?: string;
  paxCount?: number;
  queryId?: Id<"queries">;
  queryType?: string;
  receivedAmount?: number;
  reimbursementStatus?: string;
  roomType?: string;
  salesStatus?: string;
  status?: string;
  ticketStatus?: string;
  ticketType?: string;
  totalSeats?: number;
  travelHub?: string;
  visaStatus?: string;
}

function utcDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function monthKey(day: string) {
  return day.slice(0, 7);
}

function addValue(values: MetricValues, key: string, amount: number | undefined) {
  if (amount) {
    values[key] = (values[key] ?? 0) + amount;
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this exhaustive source-to-metric mapping is intentionally centralized
export function buildMetricValues(
  sourceType: MetricSourceType,
  source: MetricSourceRecord,
  context: {
    jobOpen?: boolean;
    minAdvancePercent?: number;
    referenceDate?: string;
    tourManagerAssigned?: boolean;
  } = {}
): MetricValues {
  const values: MetricValues = {};
  if (sourceType === "queries") {
    const status = String(source.salesStatus ?? "");
    const type = String(source.queryType ?? "Unknown");
    const stage = String(source.leadStage || "Inquiry");
    const budget = Number(source.budgetAmount ?? 0);
    const pax = Math.max(Number(source.paxCount ?? 0), 0);
    const opportunityBudget = budget * (pax > 0 ? pax : 1);
    addValue(values, "queries.total", 1);
    addValue(values, `queries.type.${type}.count`, 1);
    addValue(values, `queries.type.${type}.budget`, opportunityBudget);
    addValue(values, `queries.stage.${stage}.count`, 1);
    addValue(values, `queries.stage.${stage}.budget`, opportunityBudget);
    if (status === "Order Confirmed") {
      addValue(values, "queries.confirmed", 1);
      addValue(values, `queries.type.${type}.confirmed`, 1);
      addValue(values, `queries.type.${type}.confirmedBudget`, opportunityBudget);
    } else if (status === "Order Lost") {
      addValue(values, "queries.lost", 1);
      addValue(values, `queries.type.${type}.lost`, 1);
    } else {
      addValue(values, "queries.active", 1);
      addValue(values, `queries.type.${type}.active`, 1);
    }
  } else if (sourceType === "proposals") {
    if (source.status === "Sent") {
      addValue(values, "proposals.sent", 1);
    }
  } else if (sourceType === "jobCards") {
    addValue(values, "jobCards.total", 1);
    if (source.status !== "Closed") {
      addValue(values, "jobCards.open", 1);
    }
  } else if (sourceType === "travellers") {
    addValue(values, "travellers.total", 1);
    if (source.roomType || source.hotelAllocation) {
      const roomType = String(source.roomType || "Unassigned");
      addValue(values, "travellers.roomingAssignments", 1);
      addValue(values, `travellers.roomType.${roomType}.assignments`, 1);
    }
    if (source.ticketStatus === "Issued") {
      addValue(values, "travellers.ticketIssued", 1);
    }
    if (["Approved", "Not Required"].some((status) => status === source.visaStatus)) {
      addValue(values, "travellers.visaApproved", 1);
    }
    if (source.hotelAllocation) {
      addValue(values, "travellers.roomingDone", 1);
    }
    if (source.fullName && source.travelHub && source.foodPreference) {
      addValue(values, "travellers.guestDataDone", 1);
    }
    if (source.passportStatus === "Received") {
      addValue(values, "travellers.passportDone", 1);
    }
    if (context.tourManagerAssigned) {
      addValue(values, "travellers.tourManagerDone", 1);
    }
  } else if (sourceType === "tickets") {
    addValue(values, "tickets.total", 1);
    addValue(values, `tickets.status.${String(source.ticketStatus ?? "Unknown")}`, 1);
    addValue(values, `tickets.type.${String(source.ticketType ?? "Unknown")}`, 1);
    if (source.ticketStatus === "Issued") {
      addValue(values, "tickets.issued", 1);
    }
    if (source.ticketStatus === "Pending Issue") {
      addValue(values, "tickets.pending", 1);
    }
    if (
      ["Name Change Required", "Reissue Required", "Refund Pending"].some(
        (status) => status === source.ticketStatus
      )
    ) {
      addValue(values, "tickets.attention", 1);
    }
  } else if (sourceType === "pnrs") {
    addValue(values, "pnrs.count", 1);
    addValue(values, "pnrs.issuedSeats", Number(source.issuedSeats ?? 0));
    addValue(values, "pnrs.totalSeats", Number(source.totalSeats ?? 0));
  } else if (sourceType === "visaRecords") {
    if (!["Approved", "Not Required"].some((status) => status === source.status)) {
      addValue(values, "visas.blockers", 1);
    }
    if (
      ["Not Started", "Checklist Shared", "Documents Pending", "Awaiting"].some(
        (status) => status === source.status
      )
    ) {
      addValue(values, "visas.pending", 1);
    }
  } else if (sourceType === "invoices") {
    const balanceAmount = Math.max(Number(source.balanceAmount ?? 0), 0);
    const expectedAmount = Number(source.expectedAmount ?? 0);
    addValue(values, "invoices.expected", expectedAmount);
    addValue(values, "invoices.received", Number(source.receivedAmount ?? 0));
    addValue(values, "invoices.outstanding", balanceAmount);
    if (context.jobOpen) {
      addValue(
        values,
        "invoices.advancePipeline",
        (expectedAmount * (context.minAdvancePercent ?? 70)) / 100
      );
    }
    if (balanceAmount > 0) {
      addValue(values, "invoices.pending", 1);
    }
    const referenceDate = context.referenceDate ?? new Date(Date.now()).toISOString().slice(0, 10);
    if (
      balanceAmount > 0 &&
      ((source.dueDate && source.dueDate < referenceDate) || source.status === "Overdue")
    ) {
      addValue(values, "invoices.overdue", 1);
    }
  } else if (sourceType === "expenseEntries") {
    const amount = Number(source.amount ?? 0);
    if (source.approvalStatus === "Approved") {
      addValue(values, "expenseEntries.approved", amount);
      if (source.reimbursementStatus === "Pending") {
        addValue(values, "expenseEntries.pendingReimbursement", amount);
      }
    } else if (source.approvalStatus === "Pending") {
      addValue(values, "expenseEntries.pendingApproval", amount);
    }
  } else if (sourceType === "approvalRequests" && source.status === "Pending") {
    addValue(values, "approvals.pending", 1);
  }
  return values;
}

function stableFingerprint(day: string, scopes: string[], values: MetricValues) {
  return JSON.stringify({
    day,
    scopes: [...scopes].sort(),
    values: Object.fromEntries(
      Object.entries(values).sort(([left], [right]) => left.localeCompare(right))
    ),
  });
}

export function mergeValues(target: MetricValues, source: MetricValues, multiplier = 1) {
  for (const [key, value] of Object.entries(source)) {
    const next = (target[key] ?? 0) + value * multiplier;
    if (Math.abs(next) < 0.000_001) {
      delete target[key];
    } else {
      target[key] = next;
    }
  }
  return target;
}

async function applyBucketDelta(
  ctx: MutationCtx,
  scope: string,
  periodType: AggregatePeriodType,
  periodKey: string,
  values: MetricValues,
  multiplier: number
) {
  if (Object.keys(values).length === 0) {
    return;
  }
  const existing = await ctx.db
    .query("crmMetricBuckets")
    .withIndex("by_scope_period", (q) =>
      q.eq("scope", scope).eq("periodType", periodType).eq("periodKey", periodKey)
    )
    .unique();
  const nextValues = mergeValues({ ...(existing?.values ?? {}) }, values, multiplier);
  if (existing) {
    await ctx.db.patch("crmMetricBuckets", existing._id, {
      updatedAt: Date.now(),
      values: nextValues,
    });
  } else if (Object.keys(nextValues).length > 0) {
    await ctx.db.insert("crmMetricBuckets", {
      periodKey,
      periodType,
      scope,
      updatedAt: Date.now(),
      values: nextValues,
    });
  }
}

async function applyProjectionDelta(
  ctx: MutationCtx,
  projection: { day: string; scopes: string[]; values: MetricValues },
  multiplier: number
) {
  await Promise.all(
    projection.scopes.flatMap((scope) => [
      applyBucketDelta(ctx, scope, "day", projection.day, projection.values, multiplier),
      applyBucketDelta(
        ctx,
        scope,
        "month",
        monthKey(projection.day),
        projection.values,
        multiplier
      ),
    ])
  );
}

export async function loadSourceDocument(
  ctx: QueryCtx | MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string
): Promise<MetricSourceRecord | null> {
  // SAFETY: sourceType and sourceId are a correlated metric-source table and ID pair.
  const normalized = ctx.db.normalizeId(sourceType, sourceId as never);
  // SAFETY: normalized retains the same correlated sourceType relationship for the dynamic get.
  return normalized ? await ctx.db.get(sourceType, normalized as never) : null;
}

async function resolveProjectionContext(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  source: MetricSourceRecord
) {
  // SAFETY: syncProjection pairs this record with the sourceType used to load it.
  let query = sourceType === "queries" ? (source as Doc<"queries">) : null;
  let job: Doc<"jobCards"> | null = null;

  if (sourceType === "jobCards") {
    // SAFETY: syncProjection pairs this record with the sourceType used to load it.
    job = source as Doc<"jobCards">;
  } else if (
    ["travellers", "tickets", "pnrs", "visaRecords", "invoices", "expenseEntries"].includes(
      sourceType
    )
  ) {
    job = source.jobCardId ? await ctx.db.get("jobCards", source.jobCardId) : null;
  }
  if (!query && sourceType === "proposals" && source.queryId) {
    query = await ctx.db.get("queries", source.queryId);
  }
  if (!query && job?.queryId) {
    query = await ctx.db.get("queries", job.queryId);
  }

  return {
    cement: isCementQueryType(query?.queryType ?? job?.queryType),
    jobCardId: job?._id ? String(job._id) : undefined,
    jobOpen: Boolean(job && job.status !== "Closed"),
    minAdvancePercent: Number(job?.paymentTerms?.minAdvancePercent ?? 70),
    referenceDate: new Date(Date.now()).toISOString().slice(0, 10),
    ticketingOwnerId: job?.ticketingOwnerId ? String(job.ticketingOwnerId) : undefined,
    tourManagerAssigned: Boolean(job?.tourManagerName || job?.tourManagerId),
  };
}

export async function removeProjection(ctx: MutationCtx, projection: Doc<"crmMetricProjections">) {
  await applyProjectionDelta(
    ctx,
    { day: projection.day, scopes: projection.scopes, values: projection.values },
    -1
  );
  await ctx.db.delete("crmMetricProjections", projection._id);
}

export async function syncProjection(
  ctx: MutationCtx,
  sourceType: MetricSourceType,
  sourceId: string,
  source: MetricSourceRecord | null
) {
  const existing = await ctx.db
    .query("crmMetricProjections")
    .withIndex("by_source", (q) => q.eq("sourceType", sourceType).eq("sourceId", sourceId))
    .unique();
  if (!source) {
    if (existing) {
      await removeProjection(ctx, existing);
    }
    return { changed: Boolean(existing), deleted: Boolean(existing) };
  }

  const context = await resolveProjectionContext(ctx, sourceType, source);
  const day = utcDay(Number(source.createdAt ?? source._creationTime));
  const scopes = context.cement ? ["all", "cement"] : ["all"];
  if (
    ["expenseEntries", "invoices", "travellers", "tickets", "pnrs"].includes(sourceType) &&
    context.jobCardId
  ) {
    scopes.push(`job:${context.jobCardId}`);
  }
  if (["tickets", "pnrs"].includes(sourceType) && context.ticketingOwnerId) {
    scopes.push(`ticketing:${context.ticketingOwnerId}`);
    if (context.cement) {
      scopes.push(`ticketing-cement:${context.ticketingOwnerId}`);
    }
  }
  const values = buildMetricValues(sourceType, source, context);
  const fingerprint = stableFingerprint(day, scopes, values);
  if (existing?.fingerprint === fingerprint) {
    return { changed: false, deleted: false };
  }
  if (existing) {
    await applyProjectionDelta(
      ctx,
      { day: existing.day, scopes: existing.scopes, values: existing.values },
      -1
    );
  }
  await applyProjectionDelta(ctx, { day, scopes, values }, 1);
  const payload = {
    day,
    fingerprint,
    scopes,
    sourceId,
    sourceType,
    updatedAt: Date.now(),
    values,
  };
  if (existing) {
    await ctx.db.patch("crmMetricProjections", existing._id, payload);
  } else {
    await ctx.db.insert("crmMetricProjections", payload);
  }
  return { changed: true, deleted: false };
}
