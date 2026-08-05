import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const bookingsSource = readFileSync(new URL("./bookings.ts", import.meta.url), "utf8");
const contractsSource = readFileSync(
  new URL("./publicReturnContracts.ts", import.meta.url),
  "utf8"
);
const profileSource = readFileSync(new URL("./userProfiles.ts", import.meta.url), "utf8");
const authSource = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");

function projectionBody(source: string, name: string) {
  const start = source.indexOf(`const ${name} =`);
  const end = source.indexOf("});", start);
  expect(start, `${name} projection should exist`).toBeGreaterThanOrEqual(0);
  return source.slice(start, end);
}

describe("customer Account return contracts", () => {
  test("projects bookings without payment, auth, or traveler payload identifiers", () => {
    const projection = projectionBody(bookingsSource, "toCustomerBooking");

    expect(projection).toContain("confirmedAt");
    expect(projection).toContain("totalAmount");
    expect(projection).not.toContain("razorpayOrderId");
    expect(projection).not.toContain("razorpayPaymentId");
    expect(projection).not.toContain("razorpaySignature");
    expect(projection).not.toContain("userId");
    expect(projection).not.toContain("travelerDetails");
    expect(projection).not.toContain("notes");
  });

  test("uses the narrow projection for getMyBookings and includes itinerary as travel content", () => {
    const queryStart = bookingsSource.indexOf("export const getMyBookings");
    const queryEnd = bookingsSource.indexOf("\n});", queryStart);
    const querySource = bookingsSource.slice(queryStart, queryEnd);

    expect(querySource).toContain("booking: toCustomerBooking(booking)");
    expect(querySource).not.toContain("booking: toApiBooking(booking)");
    expect(bookingsSource).toContain("itinerary: trip.itinerary ?? []");
    expect(contractsSource).toContain("customerBookingOutputValidator");
    expect(contractsSource).toContain("v.object({ booking: customerBookingOutputValidator");
  });

  test("does not expose encrypted passport details through profile or auth reads", () => {
    expect(profileSource).not.toContain("passportDetailsEncrypted:");
    expect(authSource).not.toContain("passportDetailsEncrypted:");
    expect(contractsSource).not.toContain("passportDetailsEncrypted:");
  });
});
