import { describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { Doc } from "./_generated/dataModel";
import { getMyJourneyDetail, getMyJourneySummaries } from "./bookings";
import {
  classifyCustomerJourney,
  normalizeJourneyImages,
  normalizeJourneyItinerary,
} from "./customerJourneyModel";

const REFERENCE_NOW = Date.parse("2026-08-07T18:00:00.000Z");

interface TestIndexRange {
  eq: (field: string, value: string) => TestIndexRange;
}

interface TestEntitlementFilters {
  authUserId?: string;
  bookingId?: string;
}

function booking(overrides: Partial<Doc<"bookings">> = {}) {
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return fromPartial<Doc<"bookings">>({
    _creationTime: 1,
    _id: "bookings_1",
    createdAt: 1,
    currency: "INR",
    razorpayOrderId: "order_1",
    razorpayPaymentId: "payment_1",
    status: "confirmed",
    totalAmount: 100,
    travelers: 2,
    tripId: "trips_1",
    updatedAt: 1,
    userId: "customer_1",
    ...overrides,
  });
}

function trip(overrides: Partial<Doc<"trips">> = {}) {
  // SAFETY: This test controls the asserted value at the framework boundary below.
  return fromPartial<Doc<"trips">>({
    _creationTime: 1,
    _id: "trips_1",
    availableSeats: 4,
    createdAt: 1,
    endDate: "2026-08-10",
    isActive: true,
    name: "Ladakh Journey",
    priceInr: 100,
    priceUsd: 2,
    slug: "ladakh",
    startDate: "2026-08-07",
    totalSeats: 10,
    updatedAt: 1,
    ...overrides,
  });
}

function context({
  identitySubject = "customer_1",
  bookings = [booking()],
  entitlements = [],
  trips = [trip()],
}: {
  identitySubject?: string | null;
  bookings?: Doc<"bookings">[];
  entitlements?: Doc<"customerJourneyEntitlements">[];
  trips?: Doc<"trips">[];
} = {}) {
  let indexedUserId = "";
  const db = {
    get: (tableOrId: string, maybeId?: string) => {
      const id = maybeId ?? tableOrId;
      return bookings.find((row) => row._id === id) ?? trips.find((row) => row._id === id) ?? null;
    },
    query: (table: string) => {
      if (table === "customerJourneyEntitlements") {
        let rows = [...entitlements];
        const chain = {
          order: () => chain,
          take: async (limit: number) => rows.slice(0, limit),
          withIndex: (_index: string, callback: (q: TestIndexRange) => void) => {
            const filters: TestEntitlementFilters = {};
            const range: TestIndexRange = {
              eq: (field: string, value: string) => {
                if (field === "authUserId" || field === "bookingId") {
                  filters[field] = value;
                }
                return range;
              },
            };
            callback(range);
            rows = rows.filter(
              (row) =>
                (filters.authUserId === undefined || row.authUserId === filters.authUserId) &&
                (filters.bookingId === undefined || row.bookingId === filters.bookingId)
            );
            return chain;
          },
        };
        return chain;
      }
      if (table !== "bookings") {
        throw new Error(`Unexpected query: ${table}`);
      }
      const chain = {
        order: () => chain,
        take: async (limit: number) =>
          bookings.filter((row) => row.userId === indexedUserId).slice(0, limit),
        withIndex: (
          _index: string,
          callback: (q: { eq: (_field: string, value: string) => void }) => void
        ) => {
          callback({
            eq: (_field, value) => {
              indexedUserId = value;
            },
          });
          return chain;
        },
      };
      return chain;
    },
  };
  return {
    auth: {
      getUserIdentity: async () =>
        identitySubject
          ? { email: `${identitySubject}@example.com`, subject: identitySubject }
          : null,
    },
    db,
  };
}

describe("Customer Journey model", () => {
  test("Uses cancellation precedence and date-only end boundaries at a fixed clock", () => {
    expect(classifyCustomerJourney(booking(), trip(), REFERENCE_NOW)).toBe("upcoming");
    expect(classifyCustomerJourney(booking(), trip({ endDate: "2026-08-06" }), REFERENCE_NOW)).toBe(
      "past"
    );
    expect(
      classifyCustomerJourney(
        booking({ status: "cancelled" }),
        trip({ endDate: "2099-01-01" }),
        REFERENCE_NOW
      )
    ).toBe("cancelled");
    expect(
      classifyCustomerJourney(booking(), trip({ endDate: "", startDate: "" }), REFERENCE_NOW)
    ).toBe("upcoming");
  });

  test("Normalizes malformed itinerary and de-duplicates images", () => {
    expect(
      normalizeJourneyItinerary([null, "bad", { accommodation: 4 }, { title: "Flight" }])
    ).toEqual([
      {
        accommodation: "",
        day: "Day 3",
        desc: "",
        key: "Day 3-Journey highlight-3",
        location: "",
        meals: "",
        title: "Journey highlight",
      },
      {
        accommodation: "",
        day: "Day 4",
        desc: "",
        key: "Day 4-Flight-4",
        location: "",
        meals: "",
        title: "Flight",
      },
    ]);
    expect(
      normalizeJourneyImages(
        trip({ coverImage: "/cover.jpg", gallery: ["/cover.jpg", { src: "/stay.jpg" }, 42] })
      )
    ).toEqual([
      { alt: "Ladakh Journey", src: "/cover.jpg" },
      { alt: "Ladakh Journey highlight", src: "/stay.jpg" },
    ]);
  });
});

describe("Authenticated Customer Journey queries", () => {
  test("Returns compact, ordered summaries only for the authenticated identity", async () => {
    const ownUpcoming = booking({ _id: "bookings_upcoming", tripId: "trips_upcoming" });
    const ownPast = booking({ _id: "bookings_past", tripId: "trips_past" });
    const other = booking({ _id: "bookings_other", tripId: "trips_other", userId: "other" });
    const ctx = context({
      bookings: [ownPast, other, ownUpcoming],
      trips: [
        trip({
          _id: "trips_upcoming",
          itinerary: Array.from({ length: 9 }, (_, i) => ({ title: `Day ${i}` })),
        }),
        trip({ _id: "trips_past", endDate: "2026-01-01" }),
        trip({ _id: "trips_other" }),
      ],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyJourneySummaries)._handler(ctx, {
      referenceNow: REFERENCE_NOW,
    });
    expect(result.summaries.map((item: any) => item.booking.id)).toEqual([
      "bookings_upcoming",
      "bookings_past",
    ]);
    expect(result.summaries[0].trip.itinerary).toHaveLength(4);
    expect(result.summaries[0].trip).not.toHaveProperty("description");
  });

  test("Keeps a missing Trip visible but blocks another customer's selected detail", async () => {
    const missingTripBooking = booking({ _id: "bookings_missing", tripId: "trips_missing" });
    const otherBooking = booking({ _id: "bookings_other", userId: "other" });
    const ctx = context({ bookings: [missingTripBooking, otherBooking], trips: [] });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const summaries = await fromAny<any, unknown>(getMyJourneySummaries)._handler(ctx, {
      referenceNow: REFERENCE_NOW,
    });
    expect(summaries.summaries[0]).toMatchObject({
      detailAvailable: false,
      trip: { name: "Journey details unavailable" },
    });
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(getMyJourneyDetail)._handler(ctx, {
        bookingId: "bookings_other",
        referenceNow: REFERENCE_NOW,
      })
    ).toBeNull();
  });

  test("Loads authoritative normalized detail only for the selected owned booking", async () => {
    const ctx = context({
      trips: [
        trip({
          exclusions: ["Insurance", 2],
          inclusions: ["Transfers"],
          itinerary: [
            { day: "Day 1", title: "Arrival" },
            { day: "Day 2", title: "Tour" },
          ],
        }),
      ],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const detail = await fromAny<any, unknown>(getMyJourneyDetail)._handler(ctx, {
      bookingId: "bookings_1",
      referenceNow: REFERENCE_NOW,
    });
    expect(detail.trip.itinerary).toHaveLength(2);
    expect(detail.trip.inclusions).toEqual(["Transfers"]);
    expect(detail.trip.exclusions).toEqual(["Insurance"]);
  });

  test("Lets revocation override legacy ownership and an active duplicate in list and detail", async () => {
    const owned = booking();
    // SAFETY: This test fixture supplies the schema-owned entitlement fields used by the handlers.
    const revoked = fromPartial<Doc<"customerJourneyEntitlements">>({
      _creationTime: 1,
      _id: "customerJourneyEntitlements_1",
      authUserId: "customer_1",
      bookingId: owned._id,
      capabilities: ["view_booking"],
      createdAt: 1,
      revokedAt: 2,
      role: "purchaser",
      source: "identity_migration",
      updatedAt: 2,
    });
    // SAFETY: This test fixture supplies the schema-owned entitlement fields used by the handlers.
    const activeDuplicate = fromPartial<Doc<"customerJourneyEntitlements">>({
      ...revoked,
      _id: "customerJourneyEntitlements_active_duplicate",
      revokedAt: undefined,
      updatedAt: 3,
    });
    const ctx = context({ bookings: [owned], entitlements: [activeDuplicate, revoked] });

    // SAFETY: This test controls the asserted values at the framework boundary below.
    const summaries = await fromAny<any, unknown>(getMyJourneySummaries)._handler(ctx, {
      referenceNow: REFERENCE_NOW,
    });
    expect(summaries.summaries).toEqual([]);
    expect(
      // SAFETY: This test controls the asserted values at the framework boundary below.
      await fromAny<any, unknown>(getMyJourneyDetail)._handler(ctx, {
        bookingId: owned._id,
        referenceNow: REFERENCE_NOW,
      })
    ).toBeNull();
  });

  test("Denies a non-owner Booking when active and revoked entitlement siblings conflict", async () => {
    const shared = booking({ userId: "other_customer" });
    // SAFETY: This test fixture supplies the schema-owned entitlement fields used by the handlers.
    const active = fromPartial<Doc<"customerJourneyEntitlements">>({
      _creationTime: 1,
      _id: "customerJourneyEntitlements_active",
      authUserId: "customer_1",
      bookingId: shared._id,
      capabilities: ["view_booking"],
      createdAt: 1,
      role: "organizer",
      source: "crm_operator_grant",
      updatedAt: 1,
    });
    // SAFETY: This test fixture supplies the schema-owned entitlement fields used by the handlers.
    const revoked = fromPartial<Doc<"customerJourneyEntitlements">>({
      ...active,
      _id: "customerJourneyEntitlements_revoked",
      revokedAt: 2,
      updatedAt: 2,
    });
    const ctx = context({ bookings: [shared], entitlements: [active, revoked] });

    // SAFETY: This test controls the asserted values at the framework boundary below.
    const summaries = await fromAny<any, unknown>(getMyJourneySummaries)._handler(ctx, {
      referenceNow: REFERENCE_NOW,
    });
    expect(summaries.summaries).toEqual([]);
    expect(
      // SAFETY: This test controls the asserted values at the framework boundary below.
      await fromAny<any, unknown>(getMyJourneyDetail)._handler(ctx, {
        bookingId: shared._id,
        referenceNow: REFERENCE_NOW,
      })
    ).toBeNull();
  });
});
