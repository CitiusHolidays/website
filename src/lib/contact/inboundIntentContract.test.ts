import { describe, expect, test } from "bun:test";
import {
  buildInboundReceiptReference,
  isInboundReceiptReference,
  normalizeInboundEnquiryBrief,
} from "./inboundIntentContract";

describe("Inbound enquiry brief contract", () => {
  test("normalizes the bounded optional Sales brief without adding claims", () => {
    expect(
      normalizeInboundEnquiryBrief({
        contactWindow: "afternoon",
        dateFlexibility: "flexible",
        destination: "  Kerala  ",
        paxCount: 12,
        serviceType: "meetings_events",
        travelStartDate: "2026-10-12",
      })
    ).toEqual({
      ok: true,
      value: {
        contactWindow: "afternoon",
        dateFlexibility: "flexible",
        destination: "Kerala",
        paxCount: 12,
        serviceType: "meetings_events",
        travelStartDate: "2026-10-12",
      },
    });
    expect(normalizeInboundEnquiryBrief({})).toEqual({ ok: true });
  });

  test("rejects unknown, sensitive, malformed, and oversized fields", () => {
    for (const value of [
      "not-an-object",
      { attendeePassportNumber: "P123" },
      { contactWindow: "overnight" },
      { dateFlexibility: "guaranteed" },
      { destination: "x".repeat(241) },
      { paxCount: 0 },
      { paxCount: 1.5 },
      { serviceType: "medical_clearance" },
      { travelStartDate: "2026-02-31" },
    ]) {
      expect(normalizeInboundEnquiryBrief(value).ok).toBe(false);
    }
  });

  test("builds a deterministic opaque receipt without an internal record id", () => {
    const reference = buildInboundReceiptReference("a".repeat(64), 1_788_000_000_000);

    expect(reference).toBe(buildInboundReceiptReference("a".repeat(64), 1_788_000_000_000));
    expect(isInboundReceiptReference(reference)).toBe(true);
    expect(reference).not.toContain("inboundQueryIntents");
  });
});
