import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toCustomerBooking } from "./bookings";

const RAW_TOKEN_ID_PROJECTION = /\bid:\s*(?:identity\.subject|authUserId|canonicalAuthUserId)\b/;

describe("customer booking projection", () => {
  test("keeps payment, auth, notes, and traveler details off the account boundary", () => {
    const result = toCustomerBooking({
      _id: "bookings_customer_1",
      confirmedAt: 1_700_000_000_000,
      createdAt: 1_699_000_000_000,
      currency: "INR",
      notes: "Internal booking note",
      razorpayOrderId: "order_secret",
      razorpayPaymentId: "payment_secret",
      razorpaySignature: "signature_secret",
      status: "confirmed",
      totalAmount: 100_000,
      travelerDetails: [{ passportNumber: "P1234567" }],
      travelers: 2,
      tripId: "trips_1",
      updatedAt: 1_700_000_000_000,
      userId: "auth_user_secret",
    } as never);

    expect(result).toEqual({
      confirmedAt: "2023-11-14T22:13:20.000Z",
      createdAt: "2023-11-03T08:26:40.000Z",
      currency: "INR",
      id: "bookings_customer_1",
      status: "confirmed",
      totalAmount: 100_000,
      travelers: 2,
      tripId: "trips_1",
      updatedAt: "2023-11-14T22:13:20.000Z",
    });
    expect(result).not.toHaveProperty("razorpayPaymentId");
    expect(result).not.toHaveProperty("travelerDetails");
    expect(result).not.toHaveProperty("userId");
  });

  test("public account projections never reuse an auth token as the user id", () => {
    for (const file of ["auth.ts", "bookings.ts", "userProfiles.ts"]) {
      const source = readFileSync(join(import.meta.dir, file), "utf8");
      expect(source, file).not.toMatch(RAW_TOKEN_ID_PROJECTION);
    }
  });
});
