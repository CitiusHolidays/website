import { describe, expect, test } from "bun:test";
import {
  BOOKING_INVOICE_CONFIG_KEYS,
  bookingInvoiceNumber,
  gstSplitFromInclusiveTotal,
  indianFinancialYear,
  invoiceDateInIndia,
  placeOfSupply,
  readBookingInvoiceIssuer,
} from "./bookingInvoicePolicy";

const completeEnv = {
  CITIUS_INVOICE_ADDRESS: "Example House | 1 Example Street | Kolkata 700001",
  CITIUS_INVOICE_GST_RATE_PERCENT: "5",
  CITIUS_INVOICE_GSTIN: "19ABCDE1234F1Z5",
  CITIUS_INVOICE_LEGAL_NAME: "Example Travels Private Limited",
  CITIUS_INVOICE_SAC: "998552",
  CITIUS_INVOICE_SERIES_PREFIX: "WEB",
};

describe("invoice issuer configuration", () => {
  test("reads a complete configuration and derives the supplier state from the GSTIN", () => {
    expect(readBookingInvoiceIssuer(completeEnv)).toEqual({
      issuer: {
        addressLines: ["Example House", "1 Example Street", "Kolkata 700001"],
        gstin: "19ABCDE1234F1Z5",
        gstRateBasisPoints: 500,
        legalName: "Example Travels Private Limited",
        sac: "998552",
        seriesPrefix: "WEB",
        stateCode: "19",
        stateName: "West Bengal",
      },
      ok: true,
    });
  });

  test("fails closed and names every missing key when nothing is configured", () => {
    expect(readBookingInvoiceIssuer({})).toEqual({
      invalid: [],
      missing: [...BOOKING_INVOICE_CONFIG_KEYS],
      ok: false,
    });
  });

  test("treats blank values as missing rather than inventing a default", () => {
    const result = readBookingInvoiceIssuer({ ...completeEnv, CITIUS_INVOICE_GSTIN: "  " });
    expect(result).toEqual({ invalid: [], missing: ["CITIUS_INVOICE_GSTIN"], ok: false });
  });

  test.each([
    ["CITIUS_INVOICE_GSTIN", "19ABCDE1234F1Y5"],
    ["CITIUS_INVOICE_GSTIN", "00ABCDE1234F1Z5"],
    ["CITIUS_INVOICE_SAC", "9985"],
    ["CITIUS_INVOICE_SAC", "123456"],
    ["CITIUS_INVOICE_GST_RATE_PERCENT", "0"],
    ["CITIUS_INVOICE_GST_RATE_PERCENT", "five"],
    ["CITIUS_INVOICE_GST_RATE_PERCENT", "41"],
    ["CITIUS_INVOICE_SERIES_PREFIX", "web"],
    ["CITIUS_INVOICE_SERIES_PREFIX", "TOOLONG"],
  ])("rejects an invalid %s value %s", (key, value) => {
    expect(readBookingInvoiceIssuer({ ...completeEnv, [key]: value })).toEqual({
      invalid: [key],
      missing: [],
      ok: false,
    });
  });
});

describe("financial year and numbering", () => {
  test("uses the Indian April–March year in India Standard Time", () => {
    // 31 March 2027 23:59 IST is 18:29 UTC; 1 April 2027 00:00 IST is 31 March 18:30 UTC.
    expect(indianFinancialYear(Date.UTC(2027, 2, 31, 18, 29))).toEqual({
      label: "2026-27",
      short: "2627",
    });
    expect(indianFinancialYear(Date.UTC(2027, 2, 31, 18, 30))).toEqual({
      label: "2027-28",
      short: "2728",
    });
    expect(indianFinancialYear(Date.UTC(2026, 10, 7, 4, 0))).toEqual({
      label: "2026-27",
      short: "2627",
    });
  });

  test("formats a consecutive serial of at most 16 characters", () => {
    expect(bookingInvoiceNumber("WEB", "2627", 1)).toBe("WEB/2627/00001");
    expect(bookingInvoiceNumber("CHB1", "2627", 123_456)).toBe("CHB1/2627/123456");
    expect(() => bookingInvoiceNumber("CHB1", "2627", 1_234_567)).toThrow(
      "BOOKING_INVOICE_NUMBER_TOO_LONG"
    );
  });

  test("dates the invoice on the Indian calendar day", () => {
    expect(invoiceDateInIndia(Date.UTC(2026, 10, 6, 19, 0))).toBe("2026-11-07");
  });
});

describe("GST split", () => {
  test("splits a tax-inclusive intra-state total into taxable value, CGST and SGST", () => {
    expect(
      gstSplitFromInclusiveTotal({ intraState: true, rateBasisPoints: 500, totalPaise: 105_000 })
    ).toEqual({
      cgstPaise: 2500,
      igstPaise: 0,
      sgstPaise: 2500,
      taxablePaise: 100_000,
      totalPaise: 105_000,
    });
  });

  test("rounds to the paisa and keeps the parts summing to the amount paid", () => {
    expect(
      gstSplitFromInclusiveTotal({ intraState: true, rateBasisPoints: 500, totalPaise: 25_001 })
    ).toEqual({
      cgstPaise: 595,
      igstPaise: 0,
      sgstPaise: 596,
      taxablePaise: 23_810,
      totalPaise: 25_001,
    });
  });

  test("charges IGST for an inter-state supply", () => {
    expect(
      gstSplitFromInclusiveTotal({ intraState: false, rateBasisPoints: 1800, totalPaise: 118_000 })
    ).toEqual({
      cgstPaise: 0,
      igstPaise: 18_000,
      sgstPaise: 0,
      taxablePaise: 100_000,
      totalPaise: 118_000,
    });
  });

  test("rejects a non-integer or non-positive amount", () => {
    expect(() =>
      gstSplitFromInclusiveTotal({ intraState: true, rateBasisPoints: 500, totalPaise: 10.5 })
    ).toThrow("BOOKING_INVOICE_AMOUNT_INVALID");
    expect(() =>
      gstSplitFromInclusiveTotal({ intraState: true, rateBasisPoints: 500, totalPaise: 0 })
    ).toThrow("BOOKING_INVOICE_AMOUNT_INVALID");
  });
});

describe("place of supply", () => {
  test("falls back to the supplier's state when no recipient address is on record", () => {
    expect(placeOfSupply({ supplierStateCode: "19" })).toEqual({
      basis: "supplier_location",
      intraState: true,
      stateCode: "19",
      stateName: "West Bengal",
    });
  });

  test("uses the recipient's recorded state and flags an inter-state supply", () => {
    expect(placeOfSupply({ recipientStateCode: "27", supplierStateCode: "19" })).toEqual({
      basis: "recipient_address",
      intraState: false,
      stateCode: "27",
      stateName: "Maharashtra",
    });
  });
});
