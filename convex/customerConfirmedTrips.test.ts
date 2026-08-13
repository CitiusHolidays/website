import { describe, expect, test } from "bun:test";
import { getMyConfirmedTripPackets } from "./customerConfirmedTrips";

type Row = Record<string, any>;

function makeContext(
  identity = {
    email: "traveller@example.com",
    subject: "legacy-traveller",
    tokenIdentifier: "issuer-a|traveller",
  },
  setup: (tables: Record<string, Row[]>) => void = () => undefined
) {
  const tables: Record<string, Row[]> = {
    authIdentityLinks: [
      {
        _id: "authIdentityLinks_1",
        canonicalAuthUserId: "issuer-a|traveller",
        legacyAuthUserId: "legacy-traveller",
        status: "linked",
      },
    ],
    confirmedOffers: [
      {
        _id: "confirmedOffers_1",
        confirmedPax: 3,
        destination: "Kyoto",
        sellingPricePerPax: 200_000,
        source: "Citius Concierge",
        taxRate: 5,
        travelEndDate: "2026-11-10",
        travelStartDate: "2026-11-01",
      },
      {
        _id: "confirmedOffers_other",
        confirmedPax: 1,
        destination: "Private",
        sellingPricePerPax: 1,
        taxRate: 5,
        travelStartDate: "2027-01-01",
      },
    ],
    customerJourneyEntitlements: [
      {
        _id: "customerJourneyEntitlements_1",
        authUserId: "issuer-a|traveller",
        capabilities: ["view_confirmed_trip"],
        confirmedOfferId: "confirmedOffers_1",
        createdAt: 10,
        queryId: "queries_1",
        role: "organizer",
        source: "crm_operator_grant",
      },
    ],
    itineraries: [
      {
        _id: "itineraries_1",
        content: "Day 1: Arrival",
        frozen: true,
        jobCardId: "jobCards_1",
        title: "Confirmed Kyoto itinerary",
        updatedAt: 10,
        version: 2,
      },
      {
        _id: "itineraries_draft",
        content: "Draft content",
        frozen: false,
        jobCardId: "jobCards_1",
        title: "Draft",
        updatedAt: 20,
        version: 3,
      },
    ],
    jobCards: [
      {
        _id: "jobCards_1",
        jobCode: "JC-0001-AS",
        queryId: "queries_1",
        status: "In Operations",
      },
    ],
    queries: [
      {
        _id: "queries_1",
        confirmedOfferId: "confirmedOffers_1",
        queryCode: "Q-0001",
        source: "Citius Concierge",
        ticketingScope: "International",
      },
      {
        _id: "queries_other",
        confirmedOfferId: "confirmedOffers_other",
        queryCode: "Q-PRIVATE",
      },
    ],
  };
  setup(tables);
  const allRows = () => Object.values(tables).flat();
  const db = {
    get: async (tableOrId: string, maybeId?: string) =>
      allRows().find((row) => row._id === (maybeId ?? tableOrId)) ?? null,
    normalizeId: (table: string, id: string) =>
      tables[table]?.some((row) => row._id === id) ? id : null,
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const chain = {
        collect: async () => rows,
        first: async () => rows[0] ?? null,
        order: () => chain,
        take: async (limit: number) => rows.slice(0, limit),
        withIndex: (_index: string, callback: (q: any) => any) => {
          const q = {
            eq: (field: string, value: unknown) => {
              rows = rows.filter((row) => row[field] === value);
              return q;
            },
          };
          callback(q);
          return chain;
        },
      };
      return chain;
    },
  };
  return {
    auth: { getUserIdentity: async () => identity },
    db,
  };
}

describe("read-only Customer confirmed trip packets", () => {
  test("returns only explicitly entitled immutable offer and frozen itinerary facts", async () => {
    const result = await (getMyConfirmedTripPackets as any)._handler(makeContext(), {});
    expect(result).toEqual([
      {
        confirmedOfferId: "confirmedOffers_1",
        confirmedPax: 3,
        destination: "Kyoto",
        entitlement: { role: "organizer", source: "crm_operator_grant" },
        itinerary: {
          content: "Day 1: Arrival",
          title: "Confirmed Kyoto itinerary",
          version: 2,
        },
        jobCode: "JC-0001-AS",
        jobStatus: "In Operations",
        queryCode: "Q-0001",
        readOnly: true,
        sellingPricePerPax: 200_000,
        source: "Citius Concierge",
        taxRate: 5,
        ticketingScope: "International",
        travelEndDate: "2026-11-10",
        travelStartDate: "2026-11-01",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("profit");
    expect(JSON.stringify(result)).not.toContain("landCost");
  });

  test("does not expose packets to an identity without an entitlement", async () => {
    expect(
      await (getMyConfirmedTripPackets as any)._handler(
        makeContext({
          email: "traveller@example.com",
          subject: "other-subject",
          tokenIdentifier: "issuer-a|other",
        }),
        {}
      )
    ).toEqual([]);
  });

  test("does not let the same legacy subject under another issuer cross the boundary", async () => {
    const result = await (getMyConfirmedTripPackets as any)._handler(
      makeContext({
        email: "traveller@example.com",
        subject: "legacy-traveller",
        tokenIdentifier: "issuer-b|traveller",
      }),
      {}
    );
    expect(result).toEqual([]);
  });
});
