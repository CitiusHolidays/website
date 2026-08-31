import { describe, expect, test } from "bun:test";
import { type ArrivalPackPacket, renderArrivalPackDocument } from "./arrivalPackDocument";

const ACTIVE_CONTENT = /<(?:script|img|link|form|iframe)\b/i;
const EXTERNAL_REFERENCE = /\b(?:src|href)\s*=/i;

function packet(overrides: Partial<ArrivalPackPacket> = {}): ArrivalPackPacket {
  return {
    confirmation: { at: 1_788_000_000_000, status: "confirmed" },
    confirmedOfferId: "confirmedOffers_1",
    entitlement: { role: "organizer", source: "crm_operator_grant" },
    nextAction: {
      kind: "download_arrival_pack",
      label: "Download offline Arrival Pack",
    },
    readOnly: true,
    staySummary: { asOf: null, source: "unknown", status: "unknown", summary: null },
    travel: {
      asOf: 1_788_000_000_000,
      destination: "Kōyasan & Kyoto",
      endDate: "2026-11-10",
      source: "confirmed_offer",
      startDate: "2026-11-01",
    },
    ...overrides,
  };
}

describe("Customer Arrival Pack offline document", () => {
  test("is semantic, self-contained, printable, and ready for browser Save as PDF", () => {
    const document = renderArrivalPackDocument(packet(), 1_788_100_000_000);

    expect(document).toStartWith("<!doctype html>");
    expect(document).toContain('<html lang="en">');
    expect(document).toContain('<meta charset="utf-8">');
    expect(document).toContain('<main id="arrival-pack">');
    expect(document).toContain('aria-labelledby="readiness-heading"');
    expect(document).toContain("Pending — Unknown");
    expect(document).toContain("no approved confirmed stay summary is available");
    expect(document).toContain("self-contained and can be opened without a network connection");
    expect(document).toContain("save a PDF copy");
    expect(document).toContain("@media print");
    expect(document).toContain("@page { size: A4");
    expect(document).toContain("@media (prefers-reduced-motion: reduce)");
    expect(document).not.toContain("eyebrow");
    expect(document.indexOf('<h1 id="arrival-pack-title">')).toBeLessThan(
      document.indexOf("Read-only confirmed journey record")
    );
    expect(document).not.toMatch(ACTIVE_CONTENT);
    expect(document).not.toMatch(EXTERNAL_REFERENCE);
  });

  test("selects only approved packet fields and escapes customer-visible text", () => {
    const privateSentinels = {
      confirmedPax: 9173,
      passportNumber: "P-PRIVATE-123",
      sellingPricePerPax: 250_000,
      staffNote: "Internal blocker: do not expose",
    };
    const document = renderArrivalPackDocument(
      {
        ...packet({
          travel: {
            ...packet().travel,
            destination: '<script>alert("x")</script> Kyoto',
          },
        }),
        ...privateSentinels,
      },
      1_788_100_000_000
    );

    expect(document).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; Kyoto");
    expect(document).not.toContain('<script>alert("x")</script>');
    for (const sentinel of Object.values(privateSentinels)) {
      expect(document).not.toContain(String(sentinel));
    }
  });

  test("uses fluid reflow rules for narrow screens and large text", () => {
    const document = renderArrivalPackDocument(packet(), 1_788_100_000_000);

    expect(document).toContain('content="width=device-width, initial-scale=1"');
    expect(document).toContain("width: min(100% - 2rem, 48rem)");
    expect(document).toContain("font-size: clamp(");
    expect(document).toContain("overflow-wrap: anywhere");
    expect(document).toContain("@media (max-width: 24rem)");
    expect(document).toContain("font-size: 1rem");
    expect(document).toContain("min(100%, 13rem)");
    expect(document).not.toContain("min-width:");
  });
});
