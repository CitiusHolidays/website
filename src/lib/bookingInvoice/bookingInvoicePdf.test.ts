import { describe, expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { type BookingInvoiceDocument, renderBookingInvoicePdf } from "./bookingInvoicePdf";

const SAMPLE_INVOICE: BookingInvoiceDocument = {
  amounts: {
    cgstPaise: 297_619,
    igstPaise: 0,
    sgstPaise: 297_619,
    taxablePaise: 11_904_762,
    totalPaise: 12_500_000,
  },
  booking: {
    endDate: "2027-01-18",
    paidDate: "2026-11-06",
    paymentReference: "pay_Fixture123",
    reference: "k57booking0001",
    startDate: "2027-01-10",
    tripName: "Kailash Mansarovar Yatra",
  },
  currency: "INR",
  financialYear: "2026-27",
  gstRateBasisPoints: 500,
  invoiceDate: "2026-11-07",
  invoiceNumber: "WEB/2627/00007",
  issuedAt: Date.UTC(2026, 10, 7, 4, 0),
  line: {
    description: "Tour package: Kailash Mansarovar Yatra (2027-01-10 to 2027-01-18)",
    quantity: 2,
    sac: "998552",
  },
  placeOfSupply: { basis: "supplier_location", stateCode: "19", stateName: "West Bengal" },
  recipient: { email: "aria.sen@example.invalid", name: "Aria Sen" },
  reverseCharge: false,
  supplier: {
    addressLines: ["Fixture House", "1 Fixture Street", "Kolkata 700001"],
    gstin: "19ABCDE1234F1Z5",
    legalName: "Fixture Travels Private Limited",
    stateCode: "19",
    stateName: "West Bengal",
  },
};

const WHITESPACE = /\s+/g;
const STANDARD_FONTS = `${join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")}/`;

async function extractText(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = pdfjs.getDocument({
    data: bytes.slice(),
    standardFontDataUrl: STANDARD_FONTS,
    useSystemFonts: false,
  });
  const document = await loading.promise;
  expect(document.numPages).toBe(1);
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(WHITESPACE, " ");
  await loading.destroy();
  return text;
}

describe("booking tax invoice PDF", () => {
  test("is a valid one-page PDF carrying every legally required fact", async () => {
    const bytes = renderBookingInvoicePdf(SAMPLE_INVOICE);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    const text = await extractText(bytes);
    for (const fact of [
      "Tax Invoice",
      "Fixture Travels Private Limited",
      "Fixture House",
      "Kolkata 700001",
      "GSTIN: 19ABCDE1234F1Z5",
      "Invoice number WEB/2627/00007",
      "Invoice date 07 Nov 2026",
      "Place of supply West Bengal (19)",
      "Reverse charge No",
      "Aria Sen",
      "SAC",
      "998552",
      "Taxable value 1,19,047.62",
      "CGST @ 2.5% 2,976.19",
      "SGST @ 2.5% 2,976.19",
      "Invoice total (INR) 1,25,000.00",
      "Booking ID k57booking0001",
      "Payment reference pay_Fixture123",
      "Amount received in full through the Citius Holidays website on 06 Nov 2026",
    ]) {
      expect(text).toContain(fact);
    }
    expect(text).not.toContain("IGST");
  });

  test("shows IGST instead of CGST and SGST for an inter-state supply", async () => {
    const text = await extractText(
      renderBookingInvoicePdf({
        ...SAMPLE_INVOICE,
        amounts: { ...SAMPLE_INVOICE.amounts, cgstPaise: 0, igstPaise: 595_238, sgstPaise: 0 },
        placeOfSupply: { basis: "recipient_address", stateCode: "27", stateName: "Maharashtra" },
      })
    );
    expect(text).toContain("IGST @ 5% 5,952.38");
    expect(text).not.toContain("CGST");
  });

  test("keeps supplied text inert and survives characters outside the PDF font", async () => {
    const text = await extractText(
      renderBookingInvoicePdf({
        ...SAMPLE_INVOICE,
        recipient: { email: "x@example.invalid", name: "Zoë (QA) \\ अरिया" },
      })
    );
    expect(text).toContain("Zoë (QA) \\ ?????");
  });

  test("is byte-for-byte deterministic for the same invoice", () => {
    expect(renderBookingInvoicePdf(SAMPLE_INVOICE)).toEqual(
      renderBookingInvoicePdf(SAMPLE_INVOICE)
    );
  });
});
