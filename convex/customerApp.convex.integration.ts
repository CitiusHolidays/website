import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { passportStatusWord } from "./customerApp";
import { eraseCustomerAccount, isMagicLinkFor } from "./lib/accountErasure";
import { SIGN_IN_LINKS_PER_HOUR, sha256Hex } from "./lib/customerAppSignIn";
import { hashTripInviteToken, TRIP_INVITE_ERRORS } from "./lib/customerTripInvites";
import schema from "./schema";
import { modules } from "./test.setup";

/**
 * Customer app trip invites and reads (ADR 0020): Operations invite an adult Traveller, the
 * traveller accepts with their own account, and the trip shows in the app only while its pilot
 * is on, with their own Traveller row, the minors they guard, their group's tour managers and the
 * announcements sent to them.
 */

const NOW = Date.parse("2026-11-10T06:00:00Z");
const ISSUER = "https://customer-app.test";
const CONSENT_VERSION = "2026-11-07";

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

const staff = {
  "ops-head": { name: "Synthetic Ops Head", roles: ["Operations Head"] },
  tm: { name: "Synthetic Tour Manager", roles: ["Tour Manager"] },
} as const;
type StaffKey = keyof typeof staff;

function makeToken(seedNumber: number) {
  // 43 base64url characters, like the browser's 32 random bytes.
  return `${String(seedNumber).padStart(3, "0")}${"A".repeat(40)}`;
}

const travellerDefaults = {
  callingStatus: "Pending",
  createdBy: "synthetic-ops",
  foodPreference: "Veg",
  guestType: "Employee",
  paymentType: "Company Paid",
  roomType: "Twin",
  ticketStatus: "Pending Issue",
  visaRequired: true,
  visaStatus: "Approved",
} as const;

async function seed(t: ReturnType<typeof harness>) {
  return await t.run(async (ctx) => {
    const insertStaff = async (key: StaffKey) => {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${ISSUER}|${key}`,
        createdAt: NOW,
        legacyAuthUserId: key,
        status: "linked",
        updatedAt: NOW,
      });
      return await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: key,
        createdAt: NOW,
        email: `${key}@customer-app.test`,
        emailNormalized: `${key}@customer-app.test`,
        name: staff[key].name,
        roles: [...staff[key].roles],
        updatedAt: NOW,
      });
    };
    const staffIds = { "ops-head": await insertStaff("ops-head"), tm: await insertStaff("tm") };
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic Dealers Meet",
      confirmedPax: 4,
      createdAt: NOW,
      createdBy: "synthetic",
      destination: "Bali",
      jobCode: "JC-CUST-01",
      queryType: "MICE",
      sellingPricePerPax: 99_999,
      status: "Ready for Departure",
      travelEndDate: "2026-11-20",
      travelStartDate: "2026-11-15",
      updatedAt: NOW,
    });
    const batch = (code: string) =>
      ctx.db.insert("travelBatches", {
        batchCode: code,
        batchReference: `JC-CUST-01-${code}`,
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: "synthetic",
        jobCardId,
        status: "Ready for Departure",
        travelEndDate: "2026-11-20",
        travelStartDate: "2026-11-15",
        updatedAt: NOW,
      });
    const groupA = await batch("B01");
    const groupB = await batch("B02");
    const parent = await ctx.db.insert("travellers", {
      ...travellerDefaults,
      createdAt: NOW,
      fullName: "Asha Testguest",
      isMinor: false,
      jobCardId,
      passportStatus: "Received",
      travelBatchId: groupA,
      updatedAt: NOW,
    });
    const child = await ctx.db.insert("travellers", {
      ...travellerDefaults,
      createdAt: NOW,
      firstGuardianTravellerId: parent,
      fullName: "Kiran Testguest",
      isMinor: true,
      jobCardId,
      passportStatus: "Pending",
      travelBatchId: groupA,
      updatedAt: NOW,
    });
    const stranger = await ctx.db.insert("travellers", {
      ...travellerDefaults,
      createdAt: NOW,
      fullName: "Ravi Othertraveller",
      isMinor: false,
      jobCardId,
      passportStatus: "Received",
      travelBatchId: groupB,
      updatedAt: NOW,
    });
    const assignment = (name: string, travelBatchId?: Id<"travelBatches">) =>
      ctx.db.insert("tourManagerAssignments", {
        callingStatus: "Pending",
        createdAt: NOW,
        createdBy: "synthetic",
        jobCardId,
        name,
        phone: "+910000000001",
        reportingInstructions: "Lobby at 07:30",
        status: "Assigned",
        travelBatchId,
        updatedAt: NOW,
      });
    await assignment("Trip Lead");
    await assignment("Group A Manager", groupA);
    await assignment("Group B Manager", groupB);
    const announce = (body: string, recipientTravellerIds: Id<"travellers">[], sharedAt: number) =>
      ctx.db.insert("fieldAnnouncements", {
        authorName: "Group A Manager",
        authorStaffId: staffIds.tm,
        body,
        clientAnnouncementId: body,
        createdAt: sharedAt,
        jobCardId,
        recipientTravellerIds,
        seenByTravellerIds: [],
        sharedAt,
        updatedAt: sharedAt,
      });
    await announce("Coach at 08:00", [parent, child, stranger], NOW - 2000);
    await announce("Group B dinner moved", [stranger], NOW - 1000);
    await announce("Kids club at 16:00", [child], NOW);
    await ctx.db.insert("itineraries", {
      content: "Day 1: Arrive Denpasar.\nDay 2: Ubud tour.",
      createdAt: NOW,
      createdBy: "synthetic",
      frozen: true,
      jobCardId,
      title: "Bali programme",
      updatedAt: NOW,
      version: 2,
    });
    return { child, groupA, jobCardId, parent, staffIds, stranger };
  });
}

function asStaff(t: ReturnType<typeof harness>, key: StaffKey) {
  return t.withIdentity({
    email: `${key}@customer-app.test`,
    issuer: ISSUER,
    subject: key,
    tokenIdentifier: `${ISSUER}|${key}`,
  });
}

function asCustomer(t: ReturnType<typeof harness>, key: string) {
  return t.withIdentity({
    email: `${key}@example.test`,
    issuer: ISSUER,
    subject: key,
    tokenIdentifier: `${ISSUER}|${key}`,
  });
}

async function startPilot(t: ReturnType<typeof harness>, jobCardId: Id<"jobCards">) {
  await asStaff(t, "ops-head").mutation(api.crm.jobCards.setAppPilot, {
    enabled: true,
    jobCardId,
  });
}

async function invite(
  t: ReturnType<typeof harness>,
  jobCardId: Id<"jobCards">,
  travellerId: Id<"travellers">,
  seedNumber: number
) {
  const raw = makeToken(seedNumber);
  await asStaff(t, "ops-head").mutation(api.customerTripInvites.createInvites, {
    channel: "link",
    invites: [{ tokenHash: await hashTripInviteToken(raw), travellerId }],
    jobCardId,
  });
  return raw;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("customer app trip invites", () => {
  test("Operations invite adults only; tour managers cannot invite", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    await expect(
      asStaff(t, "ops-head").mutation(api.customerTripInvites.createInvites, {
        channel: "link",
        invites: [{ tokenHash: await hashTripInviteToken(makeToken(1)), travellerId: ids.child }],
        jobCardId: ids.jobCardId,
      })
    ).rejects.toThrow(/minor/);
    await expect(
      asStaff(t, "tm").mutation(api.customerTripInvites.createInvites, {
        channel: "link",
        invites: [{ tokenHash: await hashTripInviteToken(makeToken(2)), travellerId: ids.parent }],
        jobCardId: ids.jobCardId,
      })
    ).rejects.toThrow();
    await invite(t, ids.jobCardId, ids.parent, 3);
    const { canInvite, rows } = await asStaff(t, "ops-head").query(
      api.customerTripInvites.listForJobCard,
      { jobCardId: ids.jobCardId, referenceNow: NOW }
    );
    expect(canInvite).toBe(true);
    expect(rows.find((row) => row.travellerId === ids.parent)?.appAccess).toBe("invited");
    expect(rows.find((row) => row.travellerId === ids.child)?.isMinor).toBe(true);
  });

  test("a claimed trip stays hidden until the pilot starts, then shows only the guardian's own view", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 4);
    const asha = asCustomer(t, "asha");

    const preview = await asha.query(api.customerApp.previewInvite, {
      referenceNow: NOW,
      token: raw,
    });
    expect(preview).toMatchObject({ firstName: "Asha", status: "valid", trip: null });
    expect(preview.status === "valid" && preview.minors.map((m) => m.firstName)).toEqual(["Kiran"]);

    const { tripId } = await asha.mutation(api.customerApp.claimInvite, {
      consent: { minorTravellerIds: [ids.child], textVersion: CONSENT_VERSION },
      token: raw,
    });
    expect(await asha.query(api.customerApp.listMyTrips, { referenceNow: NOW })).toEqual([]);
    expect(await asha.query(api.customerApp.getMyTrip, { referenceNow: NOW, tripId })).toBeNull();

    await startPilot(t, ids.jobCardId);
    const trips = await asha.query(api.customerApp.listMyTrips, { referenceNow: NOW });
    expect(trips).toEqual([
      expect.objectContaining({
        cover: expect.objectContaining({ path: "/images/event-photo-booth/bali.webp" }),
        destination: "Bali",
        minorCount: 1,
        phase: "upcoming",
        role: "traveller",
        travellerName: "Asha Testguest",
        tripId,
      }),
    ]);
    const detail = await asha.query(api.customerApp.getMyTrip, { referenceNow: NOW, tripId });
    expect(detail?.me).toMatchObject({ fullName: "Asha Testguest", groupCode: "B01" });
    expect(detail?.minors).toEqual([
      expect.objectContaining({ consent: "granted", fullName: "Kiran Testguest" }),
    ]);
    expect(detail?.documents.map((row) => row.fullName)).toEqual(["Asha Testguest"]);
    expect(detail?.contacts.map((row) => row.name).sort()).toEqual([
      "Group A Manager",
      "Trip Lead",
    ]);
    expect(detail?.announcements.map((row) => row.body)).toEqual([
      "Kids club at 16:00",
      "Coach at 08:00",
    ]);
    expect(detail?.plan).toMatchObject({ title: "Bali programme", version: 2 });
    expect(JSON.stringify(detail)).not.toContain("99999");
    expect(JSON.stringify(detail)).not.toContain("Ravi");
  });

  test("an invite works once, for one account", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 5);
    const first = await asCustomer(t, "asha").mutation(api.customerApp.claimInvite, { token: raw });
    const again = await asCustomer(t, "asha").mutation(api.customerApp.claimInvite, { token: raw });
    expect(again.tripId).toBe(first.tripId);
    await expect(
      asCustomer(t, "mallory").mutation(api.customerApp.claimInvite, { token: raw })
    ).rejects.toThrow(TRIP_INVITE_ERRORS.invalid);
    expect(
      await asCustomer(t, "mallory").query(api.customerApp.previewInvite, {
        referenceNow: NOW,
        token: raw,
      })
    ).toEqual({ status: "used" });
    await startPilot(t, ids.jobCardId);
    expect(
      await asCustomer(t, "mallory").query(api.customerApp.getMyTrip, {
        referenceNow: NOW,
        tripId: first.tripId,
      })
    ).toBeNull();
  });

  test("a newer invite or an expired one cannot be claimed with the old link", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const old = await invite(t, ids.jobCardId, ids.parent, 6);
    await invite(t, ids.jobCardId, ids.parent, 7);
    expect(
      await asCustomer(t, "asha").query(api.customerApp.previewInvite, {
        referenceNow: NOW,
        token: old,
      })
    ).toEqual({ status: "expired" });
    await expect(
      asCustomer(t, "asha").mutation(api.customerApp.claimInvite, { token: old })
    ).rejects.toThrow(TRIP_INVITE_ERRORS.invalid);
    vi.setSystemTime(NOW + 31 * 24 * 60 * 60 * 1000);
    await expect(
      asCustomer(t, "asha").mutation(api.customerApp.claimInvite, { token: makeToken(7) })
    ).rejects.toThrow(TRIP_INVITE_ERRORS.invalid);
  });

  test("consent is recorded only for minors the guardian covers, and withdrawal is a new record", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 8);
    const asha = asCustomer(t, "asha");
    await expect(
      asha.mutation(api.customerApp.claimInvite, {
        consent: { minorTravellerIds: [ids.stranger], textVersion: CONSENT_VERSION },
        token: raw,
      })
    ).rejects.toThrow(TRIP_INVITE_ERRORS.consentNotGuardian);
    const { tripId } = await asha.mutation(api.customerApp.claimInvite, { token: raw });
    await startPilot(t, ids.jobCardId);
    const consent = (action: "granted" | "withdrawn") =>
      asha.mutation(api.customerApp.setParentalConsent, {
        action,
        minorTravellerId: ids.child,
        textVersion: CONSENT_VERSION,
        tripId,
      });
    await consent("granted");
    await consent("withdrawn");
    const detail = await asha.query(api.customerApp.getMyTrip, { referenceNow: NOW, tripId });
    expect(detail?.minors[0]?.consent).toBe("withdrawn");
    const records = await t.run((ctx) => ctx.db.query("customerParentalConsents").collect());
    expect(records.map((row) => row.action)).toEqual(["granted", "withdrawn"]);
    expect(records.every((row) => row.source === "guardian_invite")).toBe(true);
    const marked = await t.run((ctx) => ctx.db.get("travellers", ids.child));
    expect(marked?.isMinor).toBe(true);
  });

  test("deleting the account detaches its invite claim and deletes its consent records", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 9);
    const asha = asCustomer(t, "asha");
    await asha.mutation(api.customerApp.claimInvite, {
      consent: { minorTravellerIds: [ids.child], textVersion: CONSENT_VERSION },
      token: raw,
    });
    const [entitlement] = await t.run((ctx) =>
      ctx.db.query("customerJourneyEntitlements").collect()
    );
    const holder = entitlement?.authUserId ?? "";
    const tombstone = "deleted-account:test";

    await t.run((ctx) =>
      eraseCustomerAccount(ctx, {
        betterAuthUserIds: [],
        entitlements: "revoke",
        identityIds: [holder],
        loginEmails: [],
        now: NOW,
        tombstone,
      })
    );

    const invites = await t.run((ctx) => ctx.db.query("customerTripInvites").collect());
    expect(invites.map((row) => row.claimedByAuthUserId)).toEqual([tombstone]);
    expect(invites[0]?.status).toBe("claimed");
    const consents = await t.run((ctx) => ctx.db.query("customerParentalConsents").collect());
    expect(consents).toEqual([]);
    expect(await asha.query(api.customerApp.listMyTrips, { referenceNow: NOW })).toEqual([]);
  });

  test("ending a traveller's access hides the trip; past trips are listed as past", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 9);
    await asCustomer(t, "asha").mutation(api.customerApp.claimInvite, { token: raw });
    await startPilot(t, ids.jobCardId);
    const later = Date.parse("2026-12-01T06:00:00Z");
    expect(
      (await asCustomer(t, "asha").query(api.customerApp.listMyTrips, { referenceNow: later }))[0]
        ?.phase
    ).toBe("past");
    await asStaff(t, "ops-head").mutation(api.customerTripInvites.revokeTravellerAccess, {
      travellerId: ids.parent,
    });
    expect(
      await asCustomer(t, "asha").query(api.customerApp.listMyTrips, { referenceNow: NOW })
    ).toEqual([]);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedConfirmedQuery(t: ReturnType<typeof harness>, jobCardId: Id<"jobCards">) {
  return await t.run(async (ctx) => {
    const queryId = await ctx.db.insert("queries", {
      clientName: "Synthetic Dealers Meet",
      contractingStatus: "Order Confirmed",
      createdAt: NOW,
      createdBy: "synthetic",
      paxCount: 4,
      queryCode: "Q-CRM-SECRET",
      queryType: "MICE",
      salesStatus: "Order Confirmed",
      source: "Referral",
      travelType: "International Travel",
      updatedAt: NOW,
    });
    const proposalId = await ctx.db.insert("proposals", {
      clientName: "Synthetic Dealers Meet",
      createdAt: NOW,
      createdBy: "synthetic",
      itinerarySummary: "Bali",
      preparedBy: "synthetic",
      proposalCode: "P-1",
      queryId,
      sellingPrice: 99_999,
      status: "Sent",
      updatedAt: NOW,
    });
    const confirmedOfferId = await ctx.db.insert("confirmedOffers", {
      airfarePerPax: 1,
      confirmedPax: 4,
      createdAt: NOW,
      createdBy: "synthetic",
      landCostPerPax: 1,
      profitPerPax: 1,
      proposalId,
      queryId,
      sellingPricePerPax: 99_999,
      travelStartDate: "2026-11-15",
      updatedAt: NOW,
      visaCostPerPax: 1,
    });
    await ctx.db.patch("queries", queryId, { confirmedOfferId });
    await ctx.db.patch("jobCards", jobCardId, { confirmedOfferId, queryId });
    return { confirmedOfferId, queryId };
  });
}

function operatorGrant(
  t: ReturnType<typeof harness>,
  key: string,
  fields: { role: "organizer" | "traveller" } & Partial<{
    confirmedOfferId: Id<"confirmedOffers">;
    jobCardId: Id<"jobCards">;
    queryId: Id<"queries">;
  }>
) {
  return t.run((ctx) =>
    ctx.db.insert("customerJourneyEntitlements", {
      authUserId: `${ISSUER}|${key}`,
      capabilities: ["view_confirmed_trip"],
      createdAt: NOW,
      source: "crm_operator_grant",
      updatedAt: NOW,
      ...fields,
    })
  );
}

describe("customer app privacy and safety (review of PR 315)", () => {
  test("F1: a grant without a Traveller row gets trip-wide contacts and no traveller's messages", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    await startPilot(t, ids.jobCardId);
    const travellerGrant = await operatorGrant(t, "grantee", {
      jobCardId: ids.jobCardId,
      role: "traveller",
    });
    const detail = await asCustomer(t, "grantee").query(api.customerApp.getMyTrip, {
      referenceNow: NOW,
      tripId: travellerGrant,
    });
    expect(detail?.announcements).toEqual([]);
    expect(detail?.contacts.map((row) => row.name)).toEqual(["Trip Lead"]);
    expect(detail?.documents).toEqual([]);

    // An organizer sees only what went to every traveller on the trip, never a group's or a
    // child's message.
    const organizerGrant = await operatorGrant(t, "organizer", {
      jobCardId: ids.jobCardId,
      role: "organizer",
    });
    const organizer = await asCustomer(t, "organizer").query(api.customerApp.getMyTrip, {
      referenceNow: NOW,
      tripId: organizerGrant,
    });
    expect(organizer?.announcements.map((row) => row.body)).toEqual(["Coach at 08:00"]);
    expect(organizer?.contacts.map((row) => row.name)).toEqual(["Trip Lead"]);
  });

  test("F2: a guardian sees their minors by name, and only their own documents", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 20);
    const asha = asCustomer(t, "asha");
    const { tripId } = await asha.mutation(api.customerApp.claimInvite, { token: raw });
    await startPilot(t, ids.jobCardId);
    const detail = await asha.query(api.customerApp.getMyTrip, { referenceNow: NOW, tripId });
    expect(detail?.documents.map((row) => row.travellerId)).toEqual([ids.parent]);
    expect(detail?.minors.map((row) => row.fullName)).toEqual(["Kiran Testguest"]);
  });

  test("F3: a traveller whose age is not recorded cannot be invited, previewed or claimed", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const unknownAge = await t.run((ctx) =>
      ctx.db.insert("travellers", {
        ...travellerDefaults,
        createdAt: NOW,
        fullName: "Child Unknownage",
        jobCardId: ids.jobCardId,
        passportStatus: "Received",
        updatedAt: NOW,
      })
    );
    await expect(invite(t, ids.jobCardId, unknownAge, 21)).rejects.toThrow(
      "Record whether Child Unknownage is an adult"
    );
    const { rows } = await asStaff(t, "ops-head").query(api.customerTripInvites.listForJobCard, {
      jobCardId: ids.jobCardId,
      referenceNow: NOW,
    });
    expect(rows.find((row) => row.travellerId === unknownAge)?.inviteBlockedReason).toBe(
      "age_not_recorded"
    );
    // An invite made before the rule (or by hand) still cannot be used.
    const raw = makeToken(22);
    await t.run(async (ctx) =>
      ctx.db.insert("customerTripInvites", {
        channel: "link",
        createdAt: NOW,
        createdByName: "Synthetic Ops Head",
        createdByStaffId: ids.staffIds["ops-head"],
        expiresAt: NOW + DAY_MS,
        jobCardId: ids.jobCardId,
        status: "pending",
        tokenHash: await hashTripInviteToken(raw),
        travellerId: unknownAge,
        updatedAt: NOW,
      })
    );
    expect(await t.query(api.customerApp.previewInvite, { referenceNow: NOW, token: raw })).toEqual(
      { status: "invalid" }
    );
    await expect(
      asCustomer(t, "child").mutation(api.customerApp.claimInvite, { token: raw })
    ).rejects.toThrow(TRIP_INVITE_ERRORS.minor);
  });

  test("F4: marking a claimed traveller as a minor ends their own app access", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.stranger, 23);
    const ravi = asCustomer(t, "ravi");
    const { tripId } = await ravi.mutation(api.customerApp.claimInvite, { token: raw });
    await startPilot(t, ids.jobCardId);
    await t.run((ctx) => ctx.db.patch("travellers", ids.stranger, { isMinor: true }));
    expect(await ravi.query(api.customerApp.getMyTrip, { referenceNow: NOW, tripId })).toBeNull();
    expect(await ravi.query(api.customerApp.listMyTrips, { referenceNow: NOW })).toEqual([]);
  });

  test("F5: a claimed invite stays off the website packet; a traveller packet carries no CRM facts", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const offer = await seedConfirmedQuery(t, ids.jobCardId);
    const raw = await invite(t, ids.jobCardId, ids.parent, 24);
    const asha = asCustomer(t, "asha");
    await asha.mutation(api.customerApp.claimInvite, { token: raw });
    const packets = (key: string) =>
      asCustomer(t, key).query(api.customerConfirmedTrips.getMyConfirmedTripPackets, {
        paginationOpts: { cursor: null, numItems: 10 },
      });
    expect((await packets("asha")).page).toEqual([]);

    await operatorGrant(t, "grantee", { ...offer, role: "traveller" });
    const [travellerPacket] = (await packets("grantee")).page;
    expect(travellerPacket).toMatchObject({
      destination: expect.any(String),
      jobCode: "JC-CUST-01",
    });
    for (const field of [
      "confirmedPax",
      "jobStatus",
      "queryCode",
      "sellingPricePerPax",
      "source",
      "taxRate",
      "ticketingScope",
    ] as const) {
      expect(travellerPacket).not.toHaveProperty(field);
    }

    await operatorGrant(t, "organizer", { ...offer, role: "organizer" });
    const [organizerPacket] = (await packets("organizer")).page;
    expect(organizerPacket).toMatchObject({
      confirmedPax: 4,
      queryCode: "Q-CRM-SECRET",
      source: "Referral",
    });
  });

  test("F6: an expired link previews as expired whatever clock the caller sends", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 25);
    vi.setSystemTime(NOW + 40 * DAY_MS);
    expect(await t.query(api.customerApp.previewInvite, { referenceNow: 0, token: raw })).toEqual({
      status: "expired",
    });
  });

  test("F7: deleting the parent's account deletes the consents they recorded", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const raw = await invite(t, ids.jobCardId, ids.parent, 26);
    await asCustomer(t, "asha").mutation(api.customerApp.claimInvite, {
      consent: { minorTravellerIds: [ids.child], textVersion: CONSENT_VERSION },
      token: raw,
    });
    const [entitlement] = await t.run((ctx) =>
      ctx.db.query("customerJourneyEntitlements").collect()
    );
    await t.run((ctx) =>
      eraseCustomerAccount(ctx, {
        betterAuthUserIds: [],
        entitlements: "revoke",
        identityIds: [entitlement?.authUserId ?? ""],
        loginEmails: [],
        now: NOW,
        tombstone: "deleted-account:test",
      })
    );
    expect(await t.run((ctx) => ctx.db.query("customerParentalConsents").collect())).toEqual([]);
  });

  test("F8: a Tour Manager for group A lists and invites only group A on the invite panel", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("tourManagerAssignments", {
        callingStatus: "Pending",
        createdAt: NOW,
        createdBy: "synthetic",
        jobCardId: ids.jobCardId,
        name: "Synthetic Tour Manager",
        staffId: ids.staffIds.tm,
        status: "Assigned",
        travelBatchId: ids.groupA,
        updatedAt: NOW,
      });
      await ctx.db.patch("jobCards", ids.jobCardId, {
        assignedTourManagerStaffIds: [ids.staffIds.tm],
      });
    });
    const { rows } = await asStaff(t, "tm").query(api.customerTripInvites.listForJobCard, {
      jobCardId: ids.jobCardId,
      referenceNow: NOW,
    });
    expect(rows.map((row) => row.fullName)).toEqual(["Asha Testguest", "Kiran Testguest"]);
  });

  test("L7: ending app access keeps an operator grant the claim only linked", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const ids = await seed(t);
    const offer = await seedConfirmedQuery(t, ids.jobCardId);
    const grant = await operatorGrant(t, "asha", { ...offer, role: "organizer" });
    const raw = await invite(t, ids.jobCardId, ids.parent, 27);
    const { tripId } = await asCustomer(t, "asha").mutation(api.customerApp.claimInvite, {
      token: raw,
    });
    expect(tripId).toBe(grant);
    await asStaff(t, "ops-head").mutation(api.customerTripInvites.revokeTravellerAccess, {
      travellerId: ids.parent,
    });
    const row = await t.run((ctx) => ctx.db.get("customerJourneyEntitlements", grant));
    expect(row?.revokedAt).toBeUndefined();
    expect(row?.travellerId).toBeUndefined();
    expect(row?.role).toBe("organizer");
  });

  test("L6: passport status reaches the app as one of two words", () => {
    expect(passportStatusWord(" received ")).toBe("Received");
    expect(passportStatusWord("Sent to embassy, call Priya 98xxxx")).toBe("Pending");
    expect(passportStatusWord("")).toBeNull();
    expect(passportStatusWord(undefined)).toBeNull();
  });
});

describe("customer app email sign-in guards", () => {
  test("M7: an address gets a few sign-in links an hour, then none until the hour passes", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const request = (n: number) =>
      t.mutation(internal.customerAppAuth.recordSignInLink, {
        deviceDigest: "d".repeat(64),
        recipientDigest: "r".repeat(64),
        tokenDigest: n.toString(16).padStart(64, "0"),
      });
    const results: boolean[] = [];
    for (let n = 0; n <= SIGN_IN_LINKS_PER_HOUR; n += 1) {
      results.push(await request(n));
    }
    expect(results).toEqual([...new Array(SIGN_IN_LINKS_PER_HOUR).fill(true), false]);
    vi.setSystemTime(NOW + 61 * 60 * 1000);
    expect(await request(99)).toBe(true);
  });

  test("M8: a sign-in link signs in only the device that asked for it, once", async () => {
    vi.useFakeTimers({ now: NOW });
    const t = harness();
    const secret = "S".repeat(43);
    const tokenDigest = await sha256Hex("the-link-token");
    await t.mutation(internal.customerAppAuth.recordSignInLink, {
      deviceDigest: await sha256Hex(secret),
      recipientDigest: "r".repeat(64),
      tokenDigest,
    });
    const consume = (deviceSecret: string) =>
      t.mutation(internal.customerAppAuth.consumeSignInDevice, { deviceSecret, tokenDigest });
    expect(await consume("X".repeat(43))).toBe(false);
    expect(await consume(secret)).toBe(true);
    expect(await consume(secret)).toBe(false);
  });

  test("L3: a bootstrap Admin mailbox is staff, so it gets no customer sign-in link", async () => {
    const t = harness();
    const previous = process.env.PORTAL_BOOTSTRAP_ADMINS;
    process.env.PORTAL_BOOTSTRAP_ADMINS = "Owner@Example.test";
    try {
      expect(
        await t.query(internal.customerAppAuth.isStaffEmail, { email: "owner@example.test" })
      ).toBe(true);
      expect(
        await t.query(internal.customerAppAuth.isStaffEmail, { email: "guest@example.test" })
      ).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.PORTAL_BOOTSTRAP_ADMINS;
      } else {
        process.env.PORTAL_BOOTSTRAP_ADMINS = previous;
      }
    }
  });

  test("L4: account deletion recognises an unused sign-in link by its address", () => {
    const emails = new Set(["asha@example.test"]);
    expect(isMagicLinkFor('{"type":"magic-link","email":"Asha@Example.test"}', emails)).toBe(true);
    expect(isMagicLinkFor('{"type":"magic-link","email":"other@example.test"}', emails)).toBe(
      false
    );
    expect(
      isMagicLinkFor('{"type":"email-verification","email":"asha@example.test"}', emails)
    ).toBe(false);
    expect(isMagicLinkFor("user-id-123", emails)).toBe(false);
    expect(isMagicLinkFor("{not json", emails)).toBe(false);
  });
});
