import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { applyBookingPaymentTransition } from "../bookings";
import {
  assertPaymentMutationSecret,
  assertPaymentMutationSourceAllowed,
} from "../lib/paymentMutationAuth";
import { requireStaff } from "./lib";
import {
  classifyPaymentMismatch,
  expectedStatusForEvent,
  findProviderEvent,
  fixtureModeAllowed,
  markProviderEventProcessingFailure,
  type PaymentProviderEventOutcome,
  type PaymentProviderEventSource,
  type PaymentReconciliationMismatch,
  paymentReconciliationFixtures,
  transitionForEvent,
  upsertProviderEvent,
} from "./paymentReconciliationDomain";
import {
  paymentProviderEventWriteResultValidator,
  paymentReconciliationDetailResultValidator,
  paymentReconciliationListResultValidator,
  paymentReconciliationRequestResultValidator,
} from "./paymentReconciliationReturnContracts";

const RECONCILIATION_ROW_LIMIT = 100;

type BookingStatus = Doc<"bookings">["status"];
type ReconciliationRow = {
  amount: number | null;
  bookingId: Doc<"bookings">["_id"] | null;
  bookingStatus: BookingStatus | null;
  currency: string;
  errorMessage: string | null;
  eventType: string;
  expectedStatus: BookingStatus | null;
  id: string;
  isFixture: boolean;
  mismatchCategory: PaymentReconciliationMismatch;
  orderId: string;
  outcome: PaymentProviderEventOutcome;
  paymentId: string | null;
  processedAt: string | null;
  provider: string;
  providerEventId: string;
  receivedAt: string;
  retryCount: number;
  source: PaymentProviderEventSource;
  statusAfter: BookingStatus | null;
  statusBefore: BookingStatus | null;
  tripId: Doc<"trips">["_id"] | null;
  updatedAt: string;
};

export function canAccessPaymentReconciliation(access: { roles: string[] }) {
  return (
    access.roles.includes("Admin") ||
    access.roles.includes("Directors") ||
    access.roles.includes("Director Cement") ||
    access.roles.includes("Accounts") ||
    access.roles.includes("Accounts Head")
  );
}

function assertPaymentReconciliationAccess(access: Awaited<ReturnType<typeof requireStaff>>) {
  if (!canAccessPaymentReconciliation(access)) {
    throw new ConvexError("FORBIDDEN");
  }
}

async function requirePaymentReconciliationAccess(ctx: QueryCtx | MutationCtx) {
  const access = await requireStaff(ctx);
  assertPaymentReconciliationAccess(access);
  return access;
}

function isoDate(value?: number | null) {
  return value == null ? null : new Date(value).toISOString();
}

function rowFromProviderEvent(
  event: Doc<"paymentProviderEvents">,
  booking: Doc<"bookings"> | null
): ReconciliationRow {
  return {
    amount: event.amount ?? null,
    bookingId: event.bookingId ?? null,
    bookingStatus: booking?.status ?? event.statusAfter ?? null,
    currency: event.currency ?? booking?.currency ?? "",
    errorMessage: event.errorMessage ?? null,
    eventType: event.eventType,
    expectedStatus: event.expectedStatus ?? expectedStatusForEvent(event.eventType) ?? null,
    id: event.providerEventId,
    isFixture: event.isFixture,
    mismatchCategory: event.mismatchCategory,
    orderId: event.orderId ?? booking?.razorpayOrderId ?? "",
    outcome: event.outcome,
    paymentId: event.paymentId ?? booking?.razorpayPaymentId ?? null,
    processedAt: isoDate(event.processedAt),
    provider: event.provider,
    providerEventId: event.providerEventId,
    receivedAt: new Date(event.receivedAt).toISOString(),
    retryCount: event.retryCount,
    source: event.source,
    statusAfter: event.statusAfter ?? booking?.status ?? null,
    statusBefore: event.statusBefore ?? null,
    tripId: booking?.tripId ?? null,
    updatedAt: new Date(event.updatedAt).toISOString(),
  };
}

function rowFromLegacyPaymentEvent(
  event: Doc<"bookingPaymentEvents">,
  booking: Doc<"bookings"> | null
): ReconciliationRow {
  const eventType =
    event.transition === "confirmed"
      ? "payment.captured"
      : event.transition === "refunded"
        ? "refund.created"
        : event.transition === "authorized"
          ? "payment.authorized"
          : "payment.failed";
  const outcome: PaymentProviderEventOutcome =
    event.outcome === "ignored" ? "ignored" : "processed";
  const mismatchCategory = classifyPaymentMismatch({
    booking,
    duplicateEvent: false,
    eventType,
    outcome,
    statusAfter: event.statusAfter,
  });
  return {
    amount: null,
    bookingId: event.bookingId,
    bookingStatus: booking?.status ?? event.statusAfter,
    currency: booking?.currency ?? "",
    errorMessage: null,
    eventType,
    expectedStatus: expectedStatusForEvent(eventType) ?? null,
    id: `legacy:${event.providerEventId}`,
    isFixture: false,
    mismatchCategory,
    orderId: booking?.razorpayOrderId ?? "",
    outcome,
    paymentId: event.paymentId ?? booking?.razorpayPaymentId ?? null,
    processedAt: new Date(event.createdAt).toISOString(),
    provider: "razorpay",
    providerEventId: event.providerEventId,
    receivedAt: new Date(event.createdAt).toISOString(),
    retryCount: 0,
    source: event.providerEventId.startsWith("checkout:") ? "checkout" : "webhook",
    statusAfter: event.statusAfter,
    statusBefore: event.statusBefore,
    tripId: booking?.tripId ?? null,
    updatedAt: new Date(event.createdAt).toISOString(),
  };
}

function rowFromMissingBooking(booking: Doc<"bookings">): ReconciliationRow {
  const timestamp = new Date(booking.updatedAt || booking.createdAt).toISOString();
  return {
    amount: booking.totalAmount,
    bookingId: booking._id,
    bookingStatus: booking.status,
    currency: booking.currency,
    errorMessage: null,
    eventType: "missing.provider.event",
    expectedStatus: null,
    id: `missing:${booking._id}`,
    isFixture: false,
    mismatchCategory: "missing_provider_event" as const,
    orderId: booking.razorpayOrderId,
    outcome: "unmatched" as const,
    paymentId: booking.razorpayPaymentId || null,
    processedAt: null,
    provider: "razorpay",
    providerEventId: `missing:${booking._id}`,
    receivedAt: timestamp,
    retryCount: 0,
    source: "manual" as const,
    statusAfter: booking.status,
    statusBefore: null,
    tripId: booking.tripId,
    updatedAt: timestamp,
  };
}

function matchesFilters(
  row: ReturnType<typeof rowFromProviderEvent>,
  filters: {
    bookingId?: string;
    eventType?: string;
    fromReceivedAt?: number;
    mismatchCategory?: PaymentReconciliationMismatch;
    search?: string;
    source?: PaymentProviderEventSource;
    status?: PaymentProviderEventOutcome;
    toReceivedAt?: number;
    tripId?: string;
  }
) {
  const receivedAt = Date.parse(row.receivedAt);
  if (filters.bookingId && row.bookingId !== filters.bookingId) {
    return false;
  }
  if (filters.eventType && row.eventType !== filters.eventType) {
    return false;
  }
  if (filters.fromReceivedAt !== undefined && receivedAt < filters.fromReceivedAt) {
    return false;
  }
  if (filters.mismatchCategory && row.mismatchCategory !== filters.mismatchCategory) {
    return false;
  }
  if (filters.source && row.source !== filters.source) {
    return false;
  }
  if (filters.status && row.outcome !== filters.status) {
    return false;
  }
  if (filters.toReceivedAt !== undefined && receivedAt > filters.toReceivedAt) {
    return false;
  }
  if (filters.tripId && row.tripId !== filters.tripId) {
    return false;
  }
  const search = filters.search?.trim().toLowerCase();
  if (
    search &&
    ![row.orderId, row.paymentId ?? "", row.providerEventId, row.bookingId ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(search)
  ) {
    return false;
  }
  return true;
}

async function listProductionRows(ctx: QueryCtx, limit: number): Promise<ReconciliationRow[]> {
  const bookingStatuses = ["pending", "confirmed", "failed", "cancelled", "refunded"] as const;
  const [providerEvents, legacyEvents, bookingPages] = await Promise.all([
    ctx.db
      .query("paymentProviderEvents")
      .withIndex("by_outcome_receivedAt")
      .order("desc")
      .take(limit + 1),
    ctx.db.query("bookingPaymentEvents").take(limit + 1),
    Promise.all(
      bookingStatuses.map((status) =>
        ctx.db
          .query("bookings")
          .withIndex("by_status_createdAt", (q) => q.eq("status", status))
          .order("desc")
          .take(limit + 1)
      )
    ),
  ]);
  const bookings = bookingPages
    .flat()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, limit + 1);
  const providerIds = new Set(providerEvents.map((event) => event.providerEventId));
  const providerRows = await Promise.all(
    providerEvents.map(async (event) =>
      rowFromProviderEvent(event, event.bookingId ? await ctx.db.get(event.bookingId) : null)
    )
  );

  const legacyRows = await Promise.all(
    legacyEvents
      .filter((event) => !providerIds.has(event.providerEventId))
      .map(async (event) => rowFromLegacyPaymentEvent(event, await ctx.db.get(event.bookingId)))
  );

  const orderIds = new Set(
    providerRows
      .concat(legacyRows)
      .map((row) => row.orderId)
      .filter(Boolean)
  );
  const missingRows = bookings
    .filter((booking) => booking.razorpayOrderId && !orderIds.has(booking.razorpayOrderId))
    .map(rowFromMissingBooking);

  return providerRows
    .concat(legacyRows, missingRows)
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));
}

function fixtureRowsIfRequested(includeFixtures: boolean) {
  return includeFixtures && fixtureModeAllowed() ? paymentReconciliationFixtures() : [];
}

export const list = query({
  args: {
    bookingId: v.optional(v.string()),
    eventType: v.optional(v.string()),
    fromReceivedAt: v.optional(v.number()),
    includeFixtures: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    mismatchCategory: v.optional(v.string()),
    search: v.optional(v.string()),
    source: v.optional(v.string()),
    status: v.optional(v.string()),
    toReceivedAt: v.optional(v.number()),
    tripId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePaymentReconciliationAccess(ctx);
    const limit = Math.max(1, Math.min(RECONCILIATION_ROW_LIMIT, Math.floor(args.limit ?? 50)));
    const productionRows = await listProductionRows(ctx, limit);
    const fixtures = fixtureRowsIfRequested(Boolean(args.includeFixtures));
    const filters = {
      bookingId: args.bookingId,
      eventType: args.eventType,
      fromReceivedAt: args.fromReceivedAt,
      mismatchCategory: args.mismatchCategory as PaymentReconciliationMismatch | undefined,
      search: args.search,
      source: args.source as PaymentProviderEventSource | undefined,
      status: args.status as PaymentProviderEventOutcome | undefined,
      toReceivedAt: args.toReceivedAt,
      tripId: args.tripId,
    };
    const filteredProductionRows = productionRows.filter((row) => matchesFilters(row, filters));
    const filteredFixtureRows = fixtures.filter((row) => matchesFilters(row as never, filters));
    const rows = filteredProductionRows.concat(filteredFixtureRows).slice(0, limit);
    return {
      dataMode: fixtures.length > 0 ? ("fixtures" as const) : ("production" as const),
      fixtureModeAllowed: fixtureModeAllowed(),
      fixtureRowCount: filteredFixtureRows.length,
      hasMore: filteredProductionRows.length + filteredFixtureRows.length > rows.length,
      productionRowCount: filteredProductionRows.length,
      rows,
    };
  },
  returns: paymentReconciliationListResultValidator,
});

export const getDetail = query({
  args: { providerEventId: v.string() },
  handler: async (ctx, args) => {
    await requirePaymentReconciliationAccess(ctx);
    const event = await findProviderEvent(ctx, args.providerEventId);
    if (!event) {
      const legacyProviderEventId = args.providerEventId.startsWith("legacy:")
        ? args.providerEventId.slice("legacy:".length)
        : args.providerEventId;
      const legacyEvent = await ctx.db
        .query("bookingPaymentEvents")
        .withIndex("by_providerEventId", (q) => q.eq("providerEventId", legacyProviderEventId))
        .unique();
      if (legacyEvent) {
        const booking = await ctx.db.get(legacyEvent.bookingId);
        const history = await ctx.db
          .query("bookingPaymentEvents")
          .withIndex("by_bookingId_createdAt", (q) => q.eq("bookingId", legacyEvent.bookingId))
          .order("desc")
          .take(RECONCILIATION_ROW_LIMIT);
        return {
          audits: [],
          event: rowFromLegacyPaymentEvent(legacyEvent, booking),
          history: await Promise.all(
            history.map(async (historyEvent) =>
              rowFromLegacyPaymentEvent(
                historyEvent,
                historyEvent.bookingId ? await ctx.db.get(historyEvent.bookingId) : null
              )
            )
          ),
        };
      }
      const fixture = fixtureModeAllowed()
        ? (paymentReconciliationFixtures().find(
            (row) => row.providerEventId === args.providerEventId
          ) ?? null)
        : null;
      return { audits: [], event: fixture ?? null, history: fixture ? [fixture] : [] };
    }
    const booking = event.bookingId ? await ctx.db.get(event.bookingId) : null;
    const history = event.bookingId
      ? await ctx.db
          .query("paymentProviderEvents")
          .withIndex("by_bookingId_receivedAt", (q) => q.eq("bookingId", event.bookingId))
          .order("desc")
          .take(RECONCILIATION_ROW_LIMIT)
      : [];
    const audits = await ctx.db
      .query("paymentReconciliationAudits")
      .withIndex("by_providerEventId_createdAt", (q) =>
        q.eq("providerEventId", event.providerEventId)
      )
      .order("desc")
      .take(100);
    return {
      audits: audits.map((audit) => ({
        action: audit.action,
        actorAuthUserId: audit.actorAuthUserId,
        actorName: audit.actorName,
        afterOutcome: audit.afterOutcome ?? null,
        beforeOutcome: audit.beforeOutcome ?? null,
        createdAt: new Date(audit.createdAt).toISOString(),
        reason: audit.reason,
        result: audit.result ?? null,
      })),
      event: rowFromProviderEvent(event, booking),
      history: await Promise.all(
        history.map(async (historyEvent) =>
          rowFromProviderEvent(
            historyEvent,
            historyEvent.bookingId ? await ctx.db.get(historyEvent.bookingId) : null
          )
        )
      ),
    };
  },
  returns: paymentReconciliationDetailResultValidator,
});

export const recordProviderEvent = mutation({
  args: {
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    eventType: v.string(),
    isFixture: v.optional(v.boolean()),
    orderId: v.optional(v.string()),
    paymentId: v.optional(v.string()),
    provider: v.string(),
    providerEventId: v.string(),
    providerStatus: v.optional(v.string()),
    refundId: v.optional(v.string()),
    serverSecret: v.string(),
    source: v.union(
      v.literal("webhook"),
      v.literal("checkout"),
      v.literal("fixture"),
      v.literal("manual")
    ),
  },
  handler: async (ctx, args) => {
    assertPaymentMutationSecret(args.serverSecret);
    assertPaymentMutationSourceAllowed(args.source, args.isFixture);
    const existing = await findProviderEvent(ctx, args.providerEventId);
    const event = await upsertProviderEvent(ctx, args);
    if (!event) {
      throw new ConvexError("Unable to persist provider event");
    }
    return {
      duplicate: Boolean(existing),
      id: event._id,
      outcome: event.outcome,
    };
  },
  returns: paymentProviderEventWriteResultValidator,
});

export const requestReprocess = mutation({
  args: {
    providerEventId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requirePaymentReconciliationAccess(ctx);
    const reason = args.reason.trim();
    if (reason.length < 5 || reason.length > 500) {
      throw new ConvexError("A reconciliation reason between 5 and 500 characters is required");
    }
    const event = await findProviderEvent(ctx, args.providerEventId);
    if (!event || event.isFixture) {
      throw new ConvexError("Only production provider events can be reprocessed");
    }
    const transition = transitionForEvent(event.eventType);
    if (!transition) {
      throw new ConvexError("This provider event cannot be safely reprocessed");
    }
    const beforeOutcome = event.outcome;
    await ctx.db.insert("paymentReconciliationAudits", {
      action: "reprocess_requested",
      actorAuthUserId: access.authUserId ?? "unknown",
      actorName: access.name,
      beforeOutcome,
      bookingId: event.bookingId,
      createdAt: Date.now(),
      providerEventId: event.providerEventId,
      reason,
    });

    let result: {
      duplicateEvent?: boolean;
      ignored?: boolean;
      status?: BookingStatus;
      success?: boolean;
    };
    try {
      result = (await applyBookingPaymentTransition(ctx, {
        amount: event.amount,
        currency: event.currency,
        eventType: event.eventType,
        orderId: event.orderId,
        paymentId: event.paymentId,
        provider: event.provider,
        providerEventId: event.providerEventId,
        providerStatus: event.providerStatus,
        reason: `Manual reconciliation: ${reason}`,
        source: "manual",
        transition,
      })) as typeof result;
    } catch (error) {
      await markProviderEventProcessingFailure(ctx, event.providerEventId, error);
      const failed = await findProviderEvent(ctx, event.providerEventId);
      await ctx.db.insert("paymentReconciliationAudits", {
        action: "reprocess_failed",
        actorAuthUserId: access.authUserId ?? "unknown",
        actorName: access.name,
        afterOutcome: failed?.outcome,
        beforeOutcome,
        bookingId: event.bookingId,
        createdAt: Date.now(),
        providerEventId: event.providerEventId,
        reason,
        result: error instanceof Error ? error.message.slice(0, 500) : "Processing failed",
      });
      return {
        duplicateEvent: false,
        eventId: event.providerEventId,
        mismatchCategory: failed?.mismatchCategory ?? "processing_failure",
        outcome: (failed?.outcome ?? "failed") as PaymentProviderEventOutcome,
        status: failed?.statusAfter ?? null,
      };
    }

    const refreshed = await findProviderEvent(ctx, event.providerEventId);
    await ctx.db.insert("paymentReconciliationAudits", {
      action: "reprocess_completed",
      actorAuthUserId: access.authUserId ?? "unknown",
      actorName: access.name,
      afterOutcome: refreshed?.outcome,
      beforeOutcome,
      bookingId: refreshed?.bookingId ?? event.bookingId,
      createdAt: Date.now(),
      providerEventId: event.providerEventId,
      reason,
      result: result.success === false ? "Booking not found" : "Transition evaluated",
    });
    return {
      duplicateEvent: Boolean(result.duplicateEvent),
      eventId: event.providerEventId,
      mismatchCategory: refreshed?.mismatchCategory ?? "none",
      outcome: (refreshed?.outcome ??
        (result.ignored ? "ignored" : "processed")) as PaymentProviderEventOutcome,
      status: refreshed?.statusAfter ?? result.status ?? null,
    };
  },
  returns: paymentReconciliationRequestResultValidator,
});
