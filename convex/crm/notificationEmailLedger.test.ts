import { describe, expect, test } from "bun:test";
import {
  normalizeNotificationEmailFailure,
  notificationEmailRecipientHashFromIdempotencyKey,
  shouldApplyDeliveryOutcome,
} from "./notificationEmailLedger";

describe("notification email outcome ledger", () => {
  test("normalizes provider failures to privacy-safe categories", () => {
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
  });

  test("extracts only the opaque recipient hash from an idempotency key", () => {
    const hash = notificationEmailRecipientHashFromIdempotencyKey(
      "crm-notification/notifications_1/0123456789abcdef0123456789abcdef"
    );
    expect(hash).toBe("0123456789abcdef0123456789abcdef");
    expect(hash).not.toContain("@");
  });

  test("does not regress a sent delivery during scheduler replay", () => {
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
});
