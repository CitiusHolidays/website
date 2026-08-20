import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { getMyConfirmedTripPackets } from "./customerConfirmedTrips";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";

type Row = RuntimeObject;

function makeContext(
  identity = {
    email: "traveller@example.com",
    subject: "legacy-traveller",
    tokenIdentifier: "issuer-a|traveller",
  },
  setup: (tables: Record<string, Row[]>) => void = () => undefined
) {
  const tables = {
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
  } satisfies Record<string, Row[]>;
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
        order: (direction: "asc" | "desc") => {
          rows.sort((left, right) =>
            direction === "desc"
              ? (right.createdAt ?? 0) - (left.createdAt ?? 0)
              : (left.createdAt ?? 0) - (right.createdAt ?? 0)
          );
          return chain;
        },
        paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
          const start = cursor ? Number.parseInt(cursor, 10) : 0;
          const page = rows.slice(start, start + numItems);
          const next = start + page.length;
          return {
            continueCursor: next >= rows.length ? "" : String(next),
            isDone: next >= rows.length,
            page,
          };
        },
        take: async (limit: number) => rows.slice(0, limit),
        withIndex: (_index: string, callback: (q: any) => any) => {
          const q = {
            eq: (field: string, value: RuntimeValue) => {
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

describe("Read-only Customer confirmed trip packets", () => {
  test("Returns only explicitly entitled immutable offer and frozen itinerary facts", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(makeContext(), {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(result).toEqual({
      continueCursor: "",
      isDone: true,
      page: [
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
      ],
    });
    expect(JSON.stringify(result)).not.toContain("profit");
    expect(JSON.stringify(result)).not.toContain("landCost");
  });

  test("Does not expose packets to an identity without an entitlement", async () => {
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(
        makeContext({
          email: "traveller@example.com",
          subject: "other-subject",
          tokenIdentifier: "issuer-a|other",
        }),
        { paginationOpts: { cursor: null, numItems: 20 } }
      )
    ).toEqual({ continueCursor: "", isDone: true, page: [] });
  });

  test("Does not let the same legacy subject under another issuer cross the boundary", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(
      makeContext({
        email: "traveller@example.com",
        subject: "legacy-traveller",
        tokenIdentifier: "issuer-b|traveller",
      }),
      { paginationOpts: { cursor: null, numItems: 20 } }
    );
    expect(result).toEqual({ continueCursor: "", isDone: true, page: [] });
  });

  test("Pages through every indexed entitlement without a hidden result cap", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.customerJourneyEntitlements = [];
      tables.confirmedOffers = [];
      tables.queries = [];
      tables.jobCards = [];
      tables.itineraries = [];
      for (let index = 1; index <= 45; index += 1) {
        const suffix = String(index).padStart(2, "0");
        const confirmedOfferId = `confirmedOffers_${suffix}`;
        const queryId = `queries_${suffix}`;
        tables.customerJourneyEntitlements.push({
          _id: `customerJourneyEntitlements_${suffix}`,
          authUserId: "issuer-a|traveller",
          capabilities: ["view_confirmed_trip"],
          confirmedOfferId,
          createdAt: index,
          queryId,
          role: "traveller",
          source: "identity_migration",
        });
        tables.confirmedOffers.push({
          _id: confirmedOfferId,
          confirmedPax: index,
          destination: `Destination ${suffix}`,
          sellingPricePerPax: 1000 + index,
          taxRate: 5,
          travelEndDate: `2027-12-${suffix}`,
          travelStartDate: `2027-11-${suffix}`,
        });
        tables.queries.push({
          _id: queryId,
          confirmedOfferId,
          queryCode: `Q-${suffix}`,
        });
      }
      for (let index = 1; index <= 2000; index += 1) {
        tables.customerJourneyEntitlements.push({
          _id: `customerJourneyEntitlements_unrelated_${index}`,
          authUserId: "issuer-a|someone-else",
          capabilities: ["view_confirmed_trip"],
          confirmedOfferId: "confirmedOffers_unrelated",
          createdAt: index,
          queryId: "queries_unrelated",
          role: "traveller",
          source: "identity_migration",
        });
      }
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const second = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: first.continueCursor, numItems: 20 },
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const third = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: second.continueCursor, numItems: 20 },
    });
    const pages: Row[][] = [first.page, second.page, third.page];

    expect(pages.map((page) => page.length)).toEqual([20, 20, 5]);
    expect([first.isDone, second.isDone, third.isDone]).toEqual([false, false, true]);
    const packets = pages.flat();
    expect(packets).toHaveLength(45);
    expect(new Set(packets.map((packet) => packet.confirmedOfferId)).size).toBe(45);
    expect(JSON.stringify(packets)).not.toContain("unrelated");
  });
});
