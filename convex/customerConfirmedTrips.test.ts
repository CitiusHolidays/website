import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import { getMyConfirmedTripPacket, getMyConfirmedTripPackets } from "./customerConfirmedTrips";
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
  const customerJourneyReminderPreferences: Row[] = [];
  const customerJourneyReminderConsentRevisions: Row[] = [];
  const customerJourneyReminderDeliveries: Row[] = [];
  const customerPhoneVerifications: Row[] = [];
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
        confirmedAt: 1_788_000_000_000,
        confirmedPax: 3,
        destination: "Kyoto",
        proposalId: "proposals_1",
        proposalQueryHandoffId: "proposalQueryHandoffs_1",
        proposalRevision: 4,
        queryId: "queries_1",
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
        proposalId: "proposals_other",
        queryId: "queries_other",
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
    customerJourneyReminderConsentRevisions,
    customerJourneyReminderDeliveries,
    customerJourneyReminderPreferences,
    customerPhoneVerifications,
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
    proposalQueryHandoffs: [
      {
        _id: "proposalQueryHandoffs_1",
        airfarePerPax: 25_000,
        clientName: "Private client name",
        handedOffAt: 1_787_900_000_000,
        itinerarySummary: "Day 1: Arrive in Kyoto\nDays 2–4: Confirmed temple stay",
        landCostPerPax: 80_000,
        proposalId: "proposals_1",
        proposalRevision: 4,
        queryId: "queries_1",
        sellingPrice: 200_000,
        visaCostPerPax: 5000,
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
  test("Returns only entitled customer-safe Confirmed Offer facts", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(makeContext(), {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(result).toEqual({
      continueCursor: "",
      isDone: true,
      page: [
        {
          confirmation: { at: 1_788_000_000_000, status: "confirmed" },
          confirmedOfferId: "confirmedOffers_1",
          entitlement: { role: "organizer", source: "crm_operator_grant" },
          nextAction: {
            kind: "download_arrival_pack",
            label: "Download offline Arrival Pack",
          },
          readOnly: true,
          reminders: {
            active: false,
            available: false,
            deliveryStates: [],
            maskedPhone: null,
            milestones: [],
            optedInAt: null,
            optedOutAt: null,
          },
          staySummary: {
            asOf: null,
            source: "unknown",
            status: "unknown",
            summary: null,
          },
          travel: {
            asOf: 1_788_000_000_000,
            destination: "Kyoto",
            endDate: "2026-11-10",
            source: "confirmed_offer",
            startDate: "2026-11-01",
          },
        },
      ],
    });
    const serialized = JSON.stringify(result);
    for (const privateValue of [
      "confirmedPax",
      "sellingPrice",
      "taxRate",
      "Private client name",
      "JC-0001-AS",
      "In Operations",
      "International",
      "Draft content",
      "Confirmed temple stay",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  test("Projects the same safe journey facts for organizer and traveller roles", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.customerJourneyEntitlements[0].role = "traveller";
      tables.customerJourneyEntitlements[0].source = "identity_migration";
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: null, numItems: 20 },
    });

    expect(result.page[0].entitlement).toEqual({
      role: "traveller",
      source: "identity_migration",
    });
    expect(result.page[0].travel.destination).toBe("Kyoto");
    expect(result.page[0].staySummary).toEqual({
      asOf: null,
      source: "unknown",
      status: "unknown",
      summary: null,
    });
  });

  test("Projects only masked verified-phone reminder consent into the Account packet", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.customerPhoneVerifications.push({
        _id: "customerPhoneVerifications_1",
        authUserId: "issuer-a|traveller",
        phoneE164: "+15555550123",
        verifiedAt: 100,
      });
      tables.customerJourneyReminderPreferences.push({
        _id: "customerJourneyReminderPreferences_1",
        authUserId: "issuer-a|traveller",
        currentConsentRevisionId: "customerJourneyReminderConsentRevisions_1",
        entitlementId: "customerJourneyEntitlements_1",
      });
      tables.customerJourneyReminderConsentRevisions.push({
        _id: "customerJourneyReminderConsentRevisions_1",
        active: true,
        authUserId: "issuer-a|traveller",
        consentVersion: "journey-reminders-v1",
        createdAt: 110,
        entitlementId: "customerJourneyEntitlements_1",
        milestones: ["arrival_pack_ready"],
        verifiedPhoneId: "customerPhoneVerifications_1",
      });
      tables.customerJourneyReminderDeliveries.push({
        _id: "customerJourneyReminderDeliveries_1",
        channel: "whatsapp",
        entitlementId: "customerJourneyEntitlements_1",
        logicalKey: "private-logical-key",
        milestone: "arrival_pack_ready",
        providerMessageId: "8ba7b830-9dad-11d1-80b4-00c04fd430c8",
        requestKey: "private-request-key",
        status: "accepted",
        updatedAt: 120,
      });
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: null, numItems: 20 },
    });

    expect(result.page[0].reminders).toEqual({
      active: true,
      available: true,
      deliveryStates: [
        {
          channel: "whatsapp",
          milestone: "arrival_pack_ready",
          status: "accepted",
          updatedAt: 120,
        },
      ],
      maskedPhone: "••••0123",
      milestones: ["arrival_pack_ready"],
      optedInAt: 110,
      optedOutAt: null,
    });
    expect(JSON.stringify(result.page[0].reminders)).not.toContain("+15555550123");
    expect(JSON.stringify(result.page[0].reminders)).not.toContain(
      "8ba7b830-9dad-11d1-80b4-00c04fd430c8"
    );
  });

  test("Keeps missing clocks and unproven handoffs pending as Unknown", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.confirmedOffers[0].confirmedAt = undefined;
      tables.confirmedOffers[0].proposalQueryHandoffId = undefined;
      tables.confirmedOffers[0].proposalRevision = undefined;
      tables.confirmedOffers[0].travelEndDate = "invalid-date";
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: null, numItems: 20 },
    });

    expect(result.page[0]).toMatchObject({
      confirmation: { at: null, status: "unknown" },
      staySummary: {
        asOf: null,
        source: "unknown",
        status: "unknown",
        summary: null,
      },
      travel: { asOf: null, endDate: null },
    });
  });

  test("Keeps travel readiness pending without an exact immutable handoff", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.confirmedOffers[0].proposalQueryHandoffId = undefined;
      tables.confirmedOffers[0].proposalRevision = undefined;
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: null, numItems: 20 },
    });

    expect(result.page[0]).toMatchObject({
      confirmation: { at: 1_788_000_000_000, status: "confirmed" },
      travel: {
        asOf: null,
        destination: "Kyoto",
        endDate: "2026-11-10",
        startDate: "2026-11-01",
      },
    });
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

  test("Fails closed when an active grant has a revoked duplicate", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.customerJourneyEntitlements.push({
        ...tables.customerJourneyEntitlements[0],
        _id: "customerJourneyEntitlements_revoked_duplicate",
        createdAt: 11,
        revokedAt: 12,
      });
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(result).toEqual({ continueCursor: "", isDone: true, page: [] });
  });

  test("Immediately denies detail after the entitlement is revoked", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.customerJourneyEntitlements[0].revokedAt = 1_788_100_000_000;
    });

    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(getMyConfirmedTripPacket)._handler(context, {
        confirmedOfferId: "confirmedOffers_1",
      })
    ).toBeNull();
  });

  test("Rechecks the exact entitled journey for each detail read", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const packet = await fromAny<any, unknown>(getMyConfirmedTripPacket)._handler(makeContext(), {
      confirmedOfferId: "confirmedOffers_1",
    });

    expect(packet?.travel.destination).toBe("Kyoto");
    expect(packet?.confirmedOfferId).toBe("confirmedOffers_1");
  });

  test("Fails closed when the Query, entitlement, and Confirmed Offer links disagree", async () => {
    const context = makeContext(undefined, (tables) => {
      tables.confirmedOffers[0].queryId = "queries_other";
    });

    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(getMyConfirmedTripPacket)._handler(context, {
        confirmedOfferId: "confirmedOffers_1",
      })
    ).toBeNull();
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(getMyConfirmedTripPackets)._handler(context, {
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).toEqual({ continueCursor: "", isDone: true, page: [] });
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
          proposalId: `proposals_${suffix}`,
          queryId,
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
