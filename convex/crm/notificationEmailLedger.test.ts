import { describe, expect, test } from "bun:test";
import { PERMISSIONS } from "./lib/rolePolicy";
import {
  canViewNotificationEmailDeliverySummary,
  hasValidNotificationSummaryProjectionMarker,
  normalizeNotificationEmailFailure,
  notificationEmailFailureAction,
  notificationEmailRecipientHashFromIdempotencyKey,
  notificationEmailTriage,
  notificationSummaryProjectionDeltas,
  shouldApplyDeliveryOutcome,
} from "./notificationEmailLedger";

describe("Notification email outcome ledger", () => {
  test("Limits delivery summaries to HR, heads, directors, and admins", () => {
    const access = (roles: string[], authorized = false) => ({
      allowed: true,
      email: "staff@example.com",
      name: "Staff",
      permissions: authorized ? [PERMISSIONS.VIEW_EMAIL_DELIVERY_STATUS] : [],
      roles,
    });
    expect(canViewNotificationEmailDeliverySummary(access(["HR"], true))).toBe(true);
    expect(canViewNotificationEmailDeliverySummary(access(["Sales Head"], true))).toBe(true);
    expect(canViewNotificationEmailDeliverySummary(access(["Sales"]))).toBe(false);
  });

  test("Normalizes provider failures to privacy-safe categories", () => {
    expect(normalizeNotificationEmailFailure({ statusCode: 429 })).toEqual({
      code: "rate_limited",
      providerStatus: 429,
    });
    expect(normalizeNotificationEmailFailure({ name: "FetchError" })).toEqual({
      code: "network_error",
      providerStatus: undefined,
    });
    expect(normalizeNotificationEmailFailure({ name: "invalid_recipient" })).toEqual({
      code: "provider_rejected",
      providerStatus: undefined,
    });
    expect(normalizeNotificationEmailFailure({ name: "provider_not_configured" })).toEqual({
      code: "provider_not_configured",
      providerStatus: undefined,
    });
    expect(normalizeNotificationEmailFailure({ name: "operator_suppressed" })).toEqual({
      code: "operator_suppressed",
      providerStatus: undefined,
    });
  });

  test("maps intent, effect, and safe failure categories to actionable triage", () => {
    const triage = notificationEmailTriage([
      { attempts: 0, status: "queued" },
      { attempts: 1, status: "sent" },
      { attempts: 2, failureCode: "rate_limited", status: "retrying" },
      { attempts: 4, failureCode: "provider_unavailable", status: "exhausted" },
      { attempts: 0, failureCode: "private-address@example.com", status: "skipped" },
    ]);

    expect(triage).toMatchObject({
      attempts: { maximum: 4, minimum: 0 },
      needsAttention: 2,
      resendEligible: 1,
      statuses: { exhausted: 1, queued: 1, retrying: 1, sent: 1, skipped: 1 },
    });
    expect(triage.causes.map(({ code }) => code)).toEqual([
      "provider_unavailable",
      "rate_limited",
      "unknown",
    ]);
    expect(JSON.stringify(triage)).not.toContain("private-address@example.com");
    expect(notificationEmailFailureAction("operator_suppressed")).toContain("do not retry");
  });

  test("does not offer another manual cycle after the bounded attempt ceiling", () => {
    const triage = notificationEmailTriage([
      { attempts: 8, failureCode: "provider_unavailable", status: "exhausted" },
      { attempts: 8, failureCode: "provider_not_configured", status: "skipped" },
    ]);

    expect(triage).toMatchObject({ needsAttention: 2, resendEligible: 0 });
  });

  test("Extracts only the opaque recipient hash from an idempotency key", () => {
    const hash = notificationEmailRecipientHashFromIdempotencyKey(
      "crm-notification/notifications_1/0123456789abcdef0123456789abcdef"
    );
    expect(hash).toBe("0123456789abcdef0123456789abcdef");
    expect(hash).not.toContain("@");
  });

  test("Does not regress a sent delivery during scheduler replay", () => {
    expect(
      shouldApplyDeliveryOutcome(
        { _id: "delivery_1", attempts: 2, status: "sent" },
        { attempts: 0, status: "queued" }
      )
    ).toBe(false);
    expect(
      shouldApplyDeliveryOutcome(
        { _id: "delivery_1", attempts: 2, status: "retrying" },
        { attempts: 2, status: "sent" }
      )
    ).toBe(true);
  });

  test("Does not regress skipped or exhausted delivery at the same attempt", () => {
    for (const status of ["skipped", "exhausted"] as const) {
      expect(
        shouldApplyDeliveryOutcome(
          { _id: "delivery_1", attempts: 2, status },
          { attempts: 2, status: "retrying" }
        )
      ).toBe(false);
    }
  });

  test("Projects inserts, status transitions, and event moves as exact deltas", () => {
    expect(
      notificationSummaryProjectionDeltas(null, { eventId: "event_1", status: "queued" })
    ).toEqual([
      {
        counts: {
          exhausted: 0,
          queued: 1,
          retrying: 0,
          sending: 0,
          sent: 0,
          skipped: 0,
        },
        eventId: "event_1",
        total: 1,
      },
    ]);
    expect(
      notificationSummaryProjectionDeltas(
        {
          eventId: "event_1",
          status: "queued",
          summaryProjectedEventId: "event_1",
          summaryProjectedStatus: "queued",
        },
        { eventId: "event_1", status: "sent" }
      )
    ).toEqual([
      {
        counts: {
          exhausted: 0,
          queued: -1,
          retrying: 0,
          sending: 0,
          sent: 1,
          skipped: 0,
        },
        eventId: "event_1",
        total: 0,
      },
    ]);
    expect(
      notificationSummaryProjectionDeltas(
        {
          eventId: "event_2",
          status: "sent",
          summaryProjectedEventId: "event_1",
          summaryProjectedStatus: "sent",
        },
        { eventId: "event_2", status: "sent" }
      ).map(({ eventId, total }) => ({ eventId, total }))
    ).toEqual([
      { eventId: "event_1", total: -1 },
      { eventId: "event_2", total: 1 },
    ]);
  });

  test("Rejects half-written projection markers", () => {
    expect(
      hasValidNotificationSummaryProjectionMarker({
        eventId: "event_1",
        status: "queued",
        summaryProjectedEventId: "event_1",
      })
    ).toBe(false);
    expect(() =>
      notificationSummaryProjectionDeltas(
        {
          eventId: "event_1",
          status: "queued",
          summaryProjectedEventId: "event_1",
        },
        { eventId: "event_1", status: "sent" }
      )
    ).toThrow("NOTIFICATION_EMAIL_PROJECTION_INVALID");
  });
});
