import { expect, test } from "@playwright/test";
import {
  type ArrivalPackPacket,
  renderArrivalPackDocument,
} from "../../src/lib/account/arrivalPackDocument";
import { ARRIVAL_PACK_DOCUMENT_VIEWPORT } from "../arrival-pack-document.config";

const PACKET: ArrivalPackPacket = {
  confirmation: { at: 1_788_000_000_000, status: "confirmed" },
  confirmedOfferId: "confirmedOffers_browser",
  entitlement: { role: "traveller", source: "identity_migration" },
  nextAction: {
    kind: "download_arrival_pack",
    label: "Download offline Arrival Pack",
  },
  readOnly: true,
  staySummary: { asOf: null, source: "unknown", status: "unknown", summary: null },
  travel: {
    asOf: 1_788_000_000_000,
    destination: `Kōyasan ${"and-a-very-long-destination-name-".repeat(8)}`,
    endDate: "2026-11-10",
    source: "confirmed_offer",
    startDate: "2026-11-01",
  },
};

test.describe("target-neutral Customer Arrival Pack document", () => {
  test("works offline, reflows at 200% text, and prints to PDF", async ({ context, page }) => {
    const document = renderArrivalPackDocument(PACKET, 1_788_100_000_000);
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await context.setOffline(true);
    await page.setViewportSize(ARRIVAL_PACK_DOCUMENT_VIEWPORT);
    await page.setContent(document, { waitUntil: "load" });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    await expect(page.getByRole("heading", { level: 1, name: "Arrival Pack" })).toBeVisible();
    await expect(page.getByText("Pending — Unknown")).toBeVisible();
    expect(requests).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);

    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    const pdf = await page.pdf({ preferCSSPageSize: true, tagged: true });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(pdf.includes(Buffer.from("/StructTreeRoot"))).toBe(true);
  });
});
