import { describe, expect, test } from "bun:test";
import { getMyConfirmedTripPackets } from "./customerConfirmedTrips";

type Row = Record<string, any>;

function makeContext(
  email = "traveller@example.com",
  setup: (tables: Record<string, Row[]>) => void = () => undefined
) {
  const tables: Record<string, Row[]> = {
    clients: [
      { _id: "clients_1", emailNormalized: "traveller@example.com" },
      { _id: "clients_2", emailNormalized: "other@example.com" },
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
    inboundQueryIntents: [],
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
        clientId: "clients_1",
        confirmedOfferId: "confirmedOffers_1",
        queryCode: "Q-0001",
        source: "Citius Concierge",
        ticketingScope: "International",
      },
      {
        _id: "queries_other",
        clientId: "clients_2",
        confirmedOfferId: "confirmedOffers_other",
        queryCode: "Q-PRIVATE",
      },
    ],
  };
  setup(tables);
  const allRows = () => Object.values(tables).flat();
  const db = {
    get: async (id: string) => allRows().find((row) => row._id === id) ?? null,
    normalizeId: (table: string, id: string) =>
      tables[table]?.some((row) => row._id === id) ? id : null,
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const chain = {
        collect: async () => rows,
        first: async () => rows[0] ?? null,
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
    auth: { getUserIdentity: async () => ({ email, subject: "auth_traveller" }) },
    db,
  };
}

describe("read-only Customer confirmed trip packets", () => {
  test("returns only email-owned immutable offer and frozen itinerary facts", async () => {
    const result = await (getMyConfirmedTripPackets as any)._handler(makeContext(), {});
    expect(result).toEqual([
      {
        confirmedOfferId: "confirmedOffers_1",
        confirmedPax: 3,
        destination: "Kyoto",
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

  test("does not expose packets to a different customer email", async () => {
    expect(
      await (getMyConfirmedTripPackets as any)._handler(makeContext("unknown@example.com"), {})
    ).toEqual([]);
  });

  test("does not silently drop a confirmed trip behind arbitrary customer lookup caps", async () => {
    const ctx = makeContext("traveller@example.com", (tables) => {
      tables.clients.unshift(
        ...Array.from({ length: 20 }, (_, index) => ({
          _id: `clients_shared_${index}`,
          emailNormalized: "traveller@example.com",
        }))
      );
    });

    const result = await (getMyConfirmedTripPackets as any)._handler(ctx, {});
    expect(result.map((packet: Row) => packet.queryCode)).toEqual(["Q-0001"]);
  });
});
