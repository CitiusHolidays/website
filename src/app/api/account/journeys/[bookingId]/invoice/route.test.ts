import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { JsonValue } from "@/lib/jsonValue";

let authToken: string | null = "account-token";
const queryCalls: Array<{ args: unknown; options: unknown }> = [];
let queryResult: JsonValue = null;
let queryFailure = false;

const INVOICE = {
  amounts: {
    cgstPaise: 2500,
    igstPaise: 0,
    sgstPaise: 2500,
    taxablePaise: 100_000,
    totalPaise: 105_000,
  },
  booking: {
    endDate: "2027-01-18",
    paymentReference: "pay_1",
    reference: "bookings_1",
    startDate: "2027-01-10",
    tripName: "Kailash Mansarovar Yatra",
  },
  currency: "INR",
  financialYear: "2026-27",
  gstRateBasisPoints: 500,
  invoiceDate: "2026-11-07",
  invoiceNumber: "WEB/2627/00001",
  issuedAt: 1,
  line: { description: "Tour package: Kailash Mansarovar Yatra", quantity: 2, sac: "998552" },
  placeOfSupply: { basis: "supplier_location", stateCode: "19", stateName: "West Bengal" },
  recipient: { email: "aria@example.invalid", name: "Aria Sen" },
  reverseCharge: false,
  supplier: {
    addressLines: ["Fixture House"],
    gstin: "19ABCDE1234F1Z5",
    legalName: "Fixture Travels Private Limited",
    stateCode: "19",
    stateName: "West Bengal",
  },
};

mock.module("@/lib/auth-server", () => ({
  fetchAuthQuery: (_query: JsonValue, args: JsonValue, options: JsonValue) => {
    queryCalls.push({ args, options });
    if (queryFailure) {
      throw new Error("private backend details");
    }
    return queryResult;
  },
  getToken: () => authToken,
}));

const { GET } = await import("./route");

function request(bookingId = "bookings_1") {
  return GET(new Request(`http://localhost/api/account/journeys/${bookingId}/invoice`), {
    params: Promise.resolve({ bookingId }),
  });
}

beforeEach(() => {
  authToken = "account-token";
  queryCalls.length = 0;
  queryFailure = false;
  queryResult = null;
});

describe("Customer tax-invoice download", () => {
  test("requires a signed-in Account request and never reaches Convex without one", async () => {
    authToken = null;
    const response = await request();
    expect(response.status).toBe(401);
    expect(queryCalls).toEqual([]);
  });

  test("returns 404 when Convex denies ownership, without revealing whether the booking exists", async () => {
    const response = await request("bookings_of_someone_else");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Invoice not found" });
    expect(queryCalls).toEqual([
      { args: { bookingId: "bookings_of_someone_else" }, options: { token: "account-token" } },
    ]);
  });

  test("explains that an invoice is still being prepared", async () => {
    queryResult = { status: "preparing" };
    const response = await request();
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("streams the owner's issued invoice as a private PDF attachment", async () => {
    queryResult = { invoice: INVOICE, status: "issued" };
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="Citius-Holidays-tax-invoice-WEB-2627-00001.pdf"'
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
  });

  test("hides backend failure details", async () => {
    queryFailure = true;
    const response = await request();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private backend details");
  });
});
