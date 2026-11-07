import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { eraseCustomerAccount } from "./lib/accountErasure";
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
    expect(detail?.documents.map((row) => row.fullName)).toEqual([
      "Asha Testguest",
      "Kiran Testguest",
    ]);
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

  test("deleting the account detaches its invite claim and consent records from the login", async () => {
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
    expect(consents.map((row) => [row.action, row.authUserId])).toEqual([["granted", tombstone]]);
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
