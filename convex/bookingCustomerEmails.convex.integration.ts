import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * Customer booking emails and GST invoices, exercised through the real payment
 * transitions, the durable outbox, the real dispatcher and the account query.
 * Every provider request is captured by a stubbed fetch: nothing leaves the test.
 */

const SECRET = "payment-secret-for-tests";
const OWNER = "booking-owner-identity";
const OWNER_EMAIL = "aria.sen@example.invalid";

const dispatch = makeFunctionReference<"action", { jobId: Id<"notificationEmailOutbox"> }, null>(
  "crm/notificationEmails:dispatchNotificationEmail"
);
const issuePending = makeFunctionReference<
  "mutation",
  { limit?: number },
  { issued: number; missingConfiguration: string[]; scanned: number; stillPending: number }
>("bookingInvoices:issuePendingBookingInvoices");

const runScheduledJob = makeFunctionReference<
  "action",
  Record<string, never>,
  { executed: boolean }
>("operationalScheduledJobs:issuePendingBookingInvoices");
const issueWhenConfigured = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { configured: boolean; issued: number; scanned: number }
>("bookingInvoices:issuePendingBookingInvoicesWhenConfigured");

const INVOICE_ENV = {
  CITIUS_INVOICE_ADDRESS: "Fixture House | 1 Fixture Street | Kolkata 700001",
  CITIUS_INVOICE_GST_RATE_PERCENT: "5",
  CITIUS_INVOICE_GSTIN: "19ABCDE1234F1Z5",
  CITIUS_INVOICE_LEGAL_NAME: "Fixture Travels Private Limited",
  CITIUS_INVOICE_SAC: "998552",
  CITIUS_INVOICE_SERIES_PREFIX: "WEB",
};

interface ResendRequest {
  body: {
    from: string;
    html: string;
    reply_to?: string;
    subject: string;
    text: string;
    to: string[];
  };
  idempotencyKey: string;
}

function harness() {
  const t = convexTest({ modules, schema, transactionLimits: true });
  rateLimiterTest.register(t, "rateLimiter");
  return t;
}

type Harness = ReturnType<typeof harness>;

function stubInvoiceConfig() {
  for (const [key, value] of Object.entries(INVOICE_ENV)) {
    vi.stubEnv(key, value);
  }
}

function captureResend() {
  const requests: ResendRequest[] = [];
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    if (url !== "https://api.resend.com/emails") {
      throw new Error(`Unexpected request to ${url}`);
    }
    const headers = new Headers(init.headers);
    requests.push({
      body: JSON.parse(String(init.body)),
      idempotencyKey: headers.get("Idempotency-Key") ?? "",
    });
    return Promise.resolve(Response.json({ id: `resend-${requests.length}` }));
  });
  return requests;
}

async function seedBooking(
  t: Harness,
  options: { amount?: number; currency?: string; orderId?: string; userId?: string } = {}
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const tripId = await ctx.db.insert("trips", {
      availableSeats: 10,
      createdAt: now,
      endDate: "2027-01-18",
      isActive: true,
      name: "Kailash Mansarovar Yatra",
      priceInr: 6_250_000,
      priceUsd: 75_000,
      slug: `kailash-${options.orderId ?? "order_1"}`,
      startDate: "2027-01-10",
      totalSeats: 10,
      updatedAt: now,
    });
    const userId = options.userId ?? OWNER;
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", userId))
      .first();
    if (!existingProfile) {
      await ctx.db.insert("userProfiles", {
        authUserId: userId,
        createdAt: now,
        email: userId === OWNER ? OWNER_EMAIL : `${userId}@example.invalid`,
        name: userId === OWNER ? "Aria Sen" : "Other Customer",
        updatedAt: now,
      });
    }
    return await ctx.db.insert("bookings", {
      createdAt: now,
      currency: options.currency ?? "INR",
      razorpayOrderId: options.orderId ?? "order_1",
      razorpayPaymentId: "",
      status: "pending",
      totalAmount: options.amount ?? 12_500_000,
      travelers: 2,
      tripId,
      updatedAt: now,
      userId,
    });
  });
}

/**
 * Run the follow-up the payment mutation scheduled (invoice and email), the way
 * Convex runs it right after the payment transaction commits.
 */
async function runScheduledFollowUps(t: Harness) {
  vi.advanceTimersByTime(0);
  await t.finishInProgressScheduledFunctions();
}

interface Paid {
  paidAmount: number;
  paidCurrency: string;
}

/** By default the provider reports exactly what the booking owes. */
async function bookingDue(t: Harness, orderId: string): Promise<Paid> {
  const booking = await t.run((ctx) =>
    ctx.db
      .query("bookings")
      .withIndex("by_razorpayOrderId", (q) => q.eq("razorpayOrderId", orderId))
      .first()
  );
  return { paidAmount: booking?.totalAmount ?? 0, paidCurrency: booking?.currency ?? "INR" };
}

async function confirmViaCheckout(
  t: Harness,
  orderId = "order_1",
  paymentId = "pay_1",
  paid?: Paid
) {
  const result = await t.mutation(api.bookings.confirmBookingByOrderId, {
    orderId,
    ...(paid ?? (await bookingDue(t, orderId))),
    paymentId,
    providerEventId: `checkout:payment.confirmed:${orderId}:${paymentId}`,
    reason: "Checkout signature verified",
    serverSecret: SECRET,
    signature: "fixture-signature",
  });
  await runScheduledFollowUps(t);
  return result;
}

async function confirmViaWebhook(
  t: Harness,
  orderId = "order_1",
  paymentId = "pay_1",
  paid?: Paid
) {
  const result = await t.mutation(api.bookings.confirmBookingByOrderId, {
    orderId,
    ...(paid ?? (await bookingDue(t, orderId))),
    paymentId,
    providerEventId: `razorpay:payment.captured:${paymentId}`,
    reason: "Razorpay payment.captured webhook",
    serverSecret: SECRET,
  });
  await runScheduledFollowUps(t);
  return result;
}

async function refundViaWebhook(t: Harness, refundId: string, paymentId = "pay_1") {
  const result = await t.mutation(api.bookings.markRefundedByPaymentId, {
    paymentId,
    providerEventId: `razorpay:refund.created:${refundId}`,
    reason: "Razorpay refund.created webhook",
    refundAmount: 12_500_000,
    refundId,
    serverSecret: SECRET,
  });
  await runScheduledFollowUps(t);
  return result;
}

async function customerJobs(t: Harness) {
  const jobs = await t.run((ctx) => ctx.db.query("notificationEmailOutbox").collect());
  return jobs.filter((job) => job.entityType === "booking");
}

/** Run the real dispatcher for every customer job, past the provider pacing window. */
async function dispatchAll(t: Harness) {
  for (const job of await customerJobs(t)) {
    vi.setSystemTime(Date.now() + 1000);
    await t.action(dispatch, { jobId: job._id });
  }
}

async function pauseBookingEmails(t: Harness) {
  await t.run(async (ctx) => {
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: Date.now(),
      activatedBy: "fixture",
      activatedByName: "Fixture",
      key: "global",
      reason: "Synthetic activation",
      revision: 1,
    });
    await ctx.db.insert("operationalControlStates", {
      key: "email.customer_booking",
      reason: "Synthetic test switch",
      revision: 1,
      state: "disabled",
      updatedAt: Date.now(),
      updatedBy: "fixture",
      updatedByName: "Fixture",
    });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-07T04:00:00Z"));
  vi.stubEnv("PAYMENT_MUTATION_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://fixture.example");
  vi.stubEnv("BETTER_AUTH_URL", "https://fixture.example");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fixture.example");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("RESEND_KEY", "");
  for (const key of Object.keys(INVOICE_ENV)) {
    vi.stubEnv(key, "");
  }
  vi.stubGlobal("fetch", () => {
    throw new Error("Test forbids external requests");
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("booking confirmation email", () => {
  test("is sent exactly once across checkout verification, webhook capture and replays", async () => {
    const t = harness();
    stubInvoiceConfig();
    const requests = captureResend();
    const bookingId = await seedBooking(t);

    await confirmViaCheckout(t);
    await confirmViaWebhook(t);
    await confirmViaWebhook(t);
    await confirmViaCheckout(t);

    const jobs = await customerJobs(t);
    expect(jobs.map((job) => job.eventId)).toEqual([`booking_confirmation/${bookingId}`]);

    await dispatchAll(t);
    await dispatchAll(t);
    expect(requests).toHaveLength(1);
    const [sent] = requests;
    expect(sent?.body.to).toEqual([OWNER_EMAIL]);
    expect(sent?.body.subject).toBe("Booking confirmed: Kailash Mansarovar Yatra");
    expect(sent?.body.reply_to).toBe("info@citiusholidays.com");
    expect(
      sent?.idempotencyKey.startsWith(`crm-notification/booking_confirmation/${bookingId}/`)
    ).toBe(true);
    const text = sent?.body.text.replace(/\s+/g, " ") ?? "";
    expect(text).toContain("Hi Aria Sen,");
    expect(text).toContain(`Booking ID ${bookingId}`);
    expect(text).toContain("Travel dates 10 Jan 2027 – 18 Jan 2027");
    expect(text).toContain("Travellers 2");
    expect(text).toContain("Amount paid ₹1,25,000.00");
    expect(text).toContain("Payment reference pay_1");
    expect(text).toContain("Tax invoice WEB/2627/00001");
    expect(text).toContain("https://fixture.example/account");
  });

  test("sends nothing while the customer booking email control is paused", async () => {
    const t = harness();
    const requests = captureResend();
    await seedBooking(t);
    await pauseBookingEmails(t);

    await confirmViaWebhook(t);
    await dispatchAll(t);

    expect(requests).toHaveLength(0);
    const [job] = await customerJobs(t);
    expect(job).toMatchObject({ failureCode: "delivery_control_disabled", status: "skipped" });
  });

  test("fails closed without sending when the email provider is not configured", async () => {
    const t = harness();
    await seedBooking(t);

    await confirmViaWebhook(t);
    await dispatchAll(t);

    const [job] = await customerJobs(t);
    expect(job).toMatchObject({ failureCode: "provider_not_configured", status: "skipped" });
  });

  test("is never queued when payment confirmation does not happen", async () => {
    const t = harness();
    await seedBooking(t);
    await t.mutation(api.bookings.markPaymentFailedByOrderId, {
      orderId: "order_1",
      paymentId: "pay_failed",
      providerEventId: "razorpay:payment.failed:pay_failed",
      reason: "Razorpay payment.failed webhook",
      serverSecret: SECRET,
    });
    expect(await customerJobs(t)).toEqual([]);
  });
});

describe("a payment that does not match the booking", () => {
  test("an underpayment queues no email and issues no invoice, whichever callback arrives first", async () => {
    for (const webhookFirst of [true, false]) {
      const t = harness();
      stubInvoiceConfig();
      const requests = captureResend();
      const bookingId = await seedBooking(t);
      const short = { paidAmount: 100, paidCurrency: "INR" };

      const confirmations = webhookFirst
        ? [
            () => confirmViaWebhook(t, "order_1", "pay_1", short),
            () => confirmViaCheckout(t, "order_1", "pay_1", short),
          ]
        : [
            () => confirmViaCheckout(t, "order_1", "pay_1", short),
            () => confirmViaWebhook(t, "order_1", "pay_1", short),
          ];
      for (const confirm of [...confirmations, ...confirmations]) {
        expect(await confirm()).toMatchObject({ paymentMismatch: true, success: false });
      }
      await dispatchAll(t);

      expect(requests).toHaveLength(0);
      expect(await customerJobs(t)).toEqual([]);
      expect(await t.run((ctx) => ctx.db.query("bookingInvoices").collect())).toEqual([]);
      const booking = await t.run((ctx) => ctx.db.get("bookings", bookingId));
      expect(booking).toMatchObject({
        paymentMismatch: { expectedAmount: 12_500_000, paidAmount: 100, paymentId: "pay_1" },
        status: "pending",
      });
      const trip = booking ? await t.run((ctx) => ctx.db.get("trips", booking.tripId)) : null;
      expect(trip?.availableSeats).toBe(10);
      const events = await t.run((ctx) => ctx.db.query("bookingPaymentEvents").collect());
      expect(events.map((event) => event.outcome)).toEqual(["amount_mismatch", "amount_mismatch"]);
    }
  });

  test("a payment in another currency queues no email and issues no invoice", async () => {
    const t = harness();
    stubInvoiceConfig();
    await seedBooking(t);

    const result = await confirmViaWebhook(t, "order_1", "pay_1", {
      paidAmount: 12_500_000,
      paidCurrency: "USD",
    });

    expect(result).toMatchObject({ paymentMismatch: true, success: false });
    expect(await customerJobs(t)).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("bookingInvoices").collect())).toEqual([]);
  });
});

describe("payment safety and recipient identity", () => {
  test("a failing invoice or email follow-up never undoes the payment confirmation", async () => {
    const t = harness();
    stubInvoiceConfig();
    const bookingId = await seedBooking(t);
    // Corrupt the invoice series so issuing throws inside the follow-up.
    await t.run(async (ctx) => {
      for (const lastSequence of [1, 2]) {
        await ctx.db.insert("bookingInvoiceSeries", {
          financialYear: "2026-27",
          lastSequence,
          prefix: "WEB",
          updatedAt: Date.now(),
        });
      }
    });

    const result = await t.mutation(api.bookings.confirmBookingByOrderId, {
      orderId: "order_1",
      paidAmount: 12_500_000,
      paidCurrency: "INR",
      paymentId: "pay_1",
      providerEventId: "razorpay:payment.captured:pay_1",
      reason: "Razorpay payment.captured webhook",
      serverSecret: SECRET,
    });
    expect(result).toMatchObject({ alreadyConfirmed: false, success: true });
    await runScheduledFollowUps(t).catch(() => undefined);

    const booking = await t.run((ctx) => ctx.db.get("bookings", bookingId));
    expect(booking).toMatchObject({ razorpayPaymentId: "pay_1", status: "confirmed" });
    const trip = booking ? await t.run((ctx) => ctx.db.get("trips", booking.tripId)) : null;
    expect(trip?.availableSeats).toBe(8);
    // The follow-up really failed: it left no invoice and queued no email.
    expect(await t.run((ctx) => ctx.db.query("bookingInvoices").collect())).toEqual([]);
    expect(await customerJobs(t)).toEqual([]);
  });

  test("a purchaser whose address matches a staff member still gets the customer email, not staff routing", async () => {
    const t = harness();
    const requests = captureResend();
    await t.run((ctx) =>
      ctx.db.insert("staffUsers", {
        active: true,
        createdAt: Date.now(),
        email: OWNER_EMAIL,
        emailNormalized: OWNER_EMAIL,
        name: "Staff With Same Address",
        roles: ["Sales"],
        updatedAt: Date.now(),
      })
    );
    await seedBooking(t);
    await confirmViaWebhook(t);
    const [job] = await customerJobs(t);
    expect(job?.recipientStaffId).toBeUndefined();
    await dispatchAll(t);
    expect(requests.map((request) => request.body.subject)).toEqual([
      "Booking confirmed: Kailash Mansarovar Yatra",
    ]);
  });

  test("ignores archived duplicate profiles when choosing the recipient", async () => {
    const t = harness();
    const requests = captureResend();
    // The archived duplicate is the oldest row for this identity, so a naive
    // first-row lookup would pick its stale address.
    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        archivedAt: Date.now(),
        authUserId: OWNER,
        createdAt: 1,
        email: "stale.address@example.invalid",
        name: "Stale",
        updatedAt: 1,
      });
      await ctx.db.insert("userProfiles", {
        authUserId: OWNER,
        createdAt: 2,
        email: OWNER_EMAIL,
        name: "Aria Sen",
        updatedAt: 2,
      });
    });
    await seedBooking(t);
    await confirmViaWebhook(t);
    await dispatchAll(t);
    expect(requests.map((request) => request.body.to)).toEqual([[OWNER_EMAIL]]);
  });
});

describe("refund email", () => {
  test("is sent once for repeated and later refund events", async () => {
    const t = harness();
    const requests = captureResend();
    const bookingId = await seedBooking(t);
    await confirmViaWebhook(t);

    await refundViaWebhook(t, "rfnd_1");
    await refundViaWebhook(t, "rfnd_1");
    await refundViaWebhook(t, "rfnd_2");

    const refundJobs = (await customerJobs(t)).filter((job) =>
      job.eventId.startsWith("booking_refund/")
    );
    expect(refundJobs.map((job) => job.eventId)).toEqual([`booking_refund/${bookingId}`]);

    await dispatchAll(t);
    await dispatchAll(t);
    const refundRequests = requests.filter((request) =>
      request.body.subject.startsWith("Refund started")
    );
    expect(refundRequests).toHaveLength(1);
    const text = refundRequests[0]?.body.text.replace(/\s+/g, " ") ?? "";
    expect(text).toContain("Refund amount ₹1,25,000.00");
    expect(text).toContain("Refund reference rfnd_1");
  });
});

describe("GST tax invoice", () => {
  test("numbers invoices consecutively with the correct tax split and one invoice per booking", async () => {
    const t = harness();
    stubInvoiceConfig();
    const first = await seedBooking(t, { amount: 105_000, orderId: "order_a" });
    const second = await seedBooking(t, { amount: 25_001, orderId: "order_b" });

    await confirmViaWebhook(t, "order_a", "pay_a");
    await confirmViaCheckout(t, "order_a", "pay_a");
    await confirmViaWebhook(t, "order_b", "pay_b");

    const invoices = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    expect(invoices.map((row) => [row.bookingId, row.invoiceNumber, row.status])).toEqual([
      [first, "WEB/2627/00001", "issued"],
      [second, "WEB/2627/00002", "issued"],
    ]);
    expect(invoices[0]?.snapshot).toMatchObject({
      amounts: {
        cgstPaise: 2500,
        igstPaise: 0,
        sgstPaise: 2500,
        taxablePaise: 100_000,
        totalPaise: 105_000,
      },
      financialYear: "2026-27",
      gstRateBasisPoints: 500,
      invoiceDate: "2026-11-07",
      line: { quantity: 2, sac: "998552" },
      placeOfSupply: { basis: "supplier_location", stateCode: "19", stateName: "West Bengal" },
      recipient: { email: OWNER_EMAIL, name: "Aria Sen" },
      supplier: {
        gstin: "19ABCDE1234F1Z5",
        legalName: "Fixture Travels Private Limited",
        stateCode: "19",
      },
    });
    expect(invoices[1]?.snapshot?.amounts).toEqual({
      cgstPaise: 595,
      igstPaise: 0,
      sgstPaise: 595,
      taxablePaise: 23_811,
      totalPaise: 25_001,
    });
  });

  test("records a not-configured invoice instead of inventing company details, then issues it once configured", async () => {
    const t = harness();
    const requests = captureResend();
    const bookingId = await seedBooking(t);
    await confirmViaWebhook(t);

    const [pending] = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    expect(pending).toMatchObject({
      missingConfiguration: [
        "CITIUS_INVOICE_LEGAL_NAME",
        "CITIUS_INVOICE_GSTIN",
        "CITIUS_INVOICE_ADDRESS",
        "CITIUS_INVOICE_SAC",
        "CITIUS_INVOICE_GST_RATE_PERCENT",
        "CITIUS_INVOICE_SERIES_PREFIX",
      ],
      pendingReason: "company_details_not_configured",
      status: "pending_configuration",
    });
    expect(pending?.invoiceNumber).toBeUndefined();
    expect(await t.mutation(issuePending, {})).toMatchObject({ issued: 0, stillPending: 1 });
    await dispatchAll(t);
    expect(requests[0]?.body.text.replace(/\s+/g, " ")).toContain("Tax invoice Being prepared");

    stubInvoiceConfig();
    expect(await t.mutation(issuePending, {})).toMatchObject({ issued: 1, stillPending: 0 });
    expect(await t.mutation(issuePending, {})).toMatchObject({ issued: 0, scanned: 0 });
    const [issued] = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    expect(issued).toMatchObject({ invoiceNumber: "WEB/2627/00001", status: "issued" });

    await dispatchAll(t);
    expect(requests.map((request) => request.body.subject)).toEqual([
      "Booking confirmed: Kailash Mansarovar Yatra",
      "Your tax invoice WEB/2627/00001",
    ]);
    expect((await customerJobs(t)).map((job) => job.eventId)).toEqual([
      `booking_confirmation/${bookingId}`,
      `booking_invoice_ready/${bookingId}`,
    ]);
  });

  test("holds a foreign-currency booking for manual review rather than issuing a GST invoice", async () => {
    const t = harness();
    stubInvoiceConfig();
    await seedBooking(t, { amount: 150_000, currency: "USD" });
    await confirmViaWebhook(t);
    const [row] = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    expect(row).toMatchObject({ pendingReason: "foreign_currency", status: "manual_review" });
  });

  test("does not promise an emailed invoice for a manual-review booking", async () => {
    const t = harness();
    stubInvoiceConfig();
    const requests = captureResend();
    const bookingId = await seedBooking(t, { amount: 150_000, currency: "USD" });
    await confirmViaWebhook(t);
    await dispatchAll(t);
    const text = requests[0]?.body.text.replace(/\s+/g, " ") ?? "";
    expect(text).toContain(
      "For your tax invoice, contact our accounts team at info@citiusholidays.com"
    );
    expect(text).not.toContain("Tax invoice Being prepared");
    expect(text).toContain("Amount paid USD 1,500.00");
    const owner = t.withIdentity({ subject: OWNER, tokenIdentifier: OWNER });
    const detail = await owner.query(api.bookings.getMyJourneyDetail, {
      bookingId,
      referenceNow: Date.now(),
    });
    expect(detail?.invoice).toBeUndefined();
  });
});

describe("hourly pending-invoice job", () => {
  test("stays silent and writes nothing while the company invoice details are missing", async () => {
    const t = harness();
    await seedBooking(t);
    await confirmViaWebhook(t);
    const before = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");

    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    expect(await t.action(runScheduledJob, {})).toEqual({ executed: true });
    expect(await t.mutation(issueWhenConfigured, {})).toEqual({
      configured: false,
      issued: 0,
      scanned: 0,
    });

    expect(await t.run((ctx) => ctx.db.query("bookingInvoices").collect())).toEqual(before);
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });

  test("issues waiting invoices once configured, then has nothing left to do", async () => {
    const t = harness();
    const requests = captureResend();
    const first = await seedBooking(t, { orderId: "order_a" });
    const second = await seedBooking(t, { orderId: "order_b" });
    await confirmViaWebhook(t, "order_a", "pay_a");
    await confirmViaWebhook(t, "order_b", "pay_b");
    await dispatchAll(t);

    stubInvoiceConfig();
    expect(await t.action(runScheduledJob, {})).toEqual({ executed: true });
    expect(await t.mutation(issueWhenConfigured, {})).toEqual({
      configured: true,
      issued: 0,
      scanned: 0,
    });

    const invoices = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    expect(invoices.map((row) => [row.bookingId, row.invoiceNumber, row.status])).toEqual([
      [first, "WEB/2627/00001", "issued"],
      [second, "WEB/2627/00002", "issued"],
    ]);
    await dispatchAll(t);
    expect(
      requests.filter((request) => request.body.subject.startsWith("Your tax invoice"))
    ).toHaveLength(2);
  });

  test("overlapping job and operator runs never issue a duplicate invoice or number", async () => {
    const t = harness();
    for (const order of ["order_a", "order_b", "order_c"]) {
      await seedBooking(t, { orderId: order });
      await confirmViaWebhook(t, order, `pay_${order}`);
    }
    stubInvoiceConfig();

    await Promise.all([
      t.mutation(issueWhenConfigured, {}),
      t.mutation(issuePending, {}),
      t.mutation(issueWhenConfigured, {}),
    ]);

    const invoices = await t.run((ctx) => ctx.db.query("bookingInvoices").collect());
    expect(invoices).toHaveLength(3);
    expect(invoices.map((row) => row.invoiceNumber).sort()).toEqual([
      "WEB/2627/00001",
      "WEB/2627/00002",
      "WEB/2627/00003",
    ]);
    const readyJobs = (await customerJobs(t)).filter((job) =>
      job.eventId.startsWith("booking_invoice_ready/")
    );
    expect(readyJobs).toHaveLength(3);
  });

  test("runs by default even on a target whose control plane is active and has no stored state", async () => {
    const t = harness();
    await t.run((ctx) =>
      ctx.db.insert("operationalControlPlaneState", {
        activatedAt: Date.now(),
        activatedBy: "fixture",
        activatedByName: "Fixture",
        key: "global",
        reason: "Synthetic activation",
        revision: 1,
      })
    );
    expect(await t.action(runScheduledJob, {})).toEqual({ executed: true });
  });
});

describe("invoice access", () => {
  test("only the booking's purchaser can read the invoice document", async () => {
    const t = harness();
    stubInvoiceConfig();
    const bookingId = await seedBooking(t);
    await seedBooking(t, { orderId: "order_other", userId: "other-identity" });
    await confirmViaWebhook(t);

    const owner = t.withIdentity({ subject: OWNER, tokenIdentifier: OWNER });
    const other = t.withIdentity({ subject: "other-identity", tokenIdentifier: "other-identity" });

    expect(await owner.query(api.bookingInvoices.getMyBookingInvoice, { bookingId })).toMatchObject(
      {
        invoice: { invoiceNumber: "WEB/2627/00001", recipient: { name: "Aria Sen" } },
        status: "issued",
      }
    );
    expect(await other.query(api.bookingInvoices.getMyBookingInvoice, { bookingId })).toBeNull();
    expect(await t.query(api.bookingInvoices.getMyBookingInvoice, { bookingId })).toBeNull();
    expect(
      await owner.query(api.bookingInvoices.getMyBookingInvoice, { bookingId: "not-a-booking" })
    ).toBeNull();

    const detail = await owner.query(api.bookings.getMyJourneyDetail, {
      bookingId,
      referenceNow: Date.now(),
    });
    expect(detail?.invoice).toEqual({
      downloadPath: `/api/account/journeys/${bookingId}/invoice`,
      invoiceNumber: "WEB/2627/00001",
      issuedAt: "2026-11-07T04:00:00.000Z",
      status: "issued",
    });
  });
});
