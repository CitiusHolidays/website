/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, components } from "./_generated/api";
import betterAuthSchema from "./betterAuth/schema";
import schema from "./schema";
import { modules } from "./test.setup";

const betterAuthModules = import.meta.glob(["./betterAuth/**/*.ts", "!./betterAuth/**/*.test.ts"]);

const ISSUER = "https://account-deletion.test";
const MINUTE = 60_000;

function createHarness() {
  const t = convexTest({ modules, schema });
  t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  return t;
}

type Harness = ReturnType<typeof createHarness>;

interface SeededLogin {
  authUserId: string;
  canonical: string;
  email: string;
  sessionId: string;
}

async function createLogin(
  t: Harness,
  input: { email: string; name: string; signedInAgoMs?: number }
): Promise<SeededLogin> {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: now - 30 * 24 * 60 * MINUTE,
        email: input.email,
        emailVerified: true,
        name: input.name,
        updatedAt: now,
      },
      model: "user",
    },
  });
  const authUserId = String(user._id);
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: now - (input.signedInAgoMs ?? MINUTE),
        expiresAt: now + 30 * 24 * 60 * MINUTE,
        token: `session-token-${authUserId}`,
        updatedAt: now,
        userId: authUserId,
      },
      model: "session",
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        accountId: authUserId,
        createdAt: now,
        password: "synthetic-password-hash",
        providerId: "credential",
        updatedAt: now,
        userId: authUserId,
      },
      model: "account",
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        accountId: `google-${authUserId}`,
        createdAt: now,
        providerId: "google",
        updatedAt: now,
        userId: authUserId,
      },
      model: "account",
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      data: {
        createdAt: now,
        expiresAt: now + 60 * MINUTE,
        identifier: `reset-password:token-${authUserId}`,
        updatedAt: now,
        value: authUserId,
      },
      model: "verification",
    },
  });
  return {
    authUserId,
    canonical: `${ISSUER}|${authUserId}`,
    email: input.email,
    sessionId: String(session._id),
  };
}

function asLogin(t: Harness, login: SeededLogin, name = "Synthetic Customer") {
  return t.withIdentity({
    email: login.email,
    issuer: ISSUER,
    name,
    sessionId: login.sessionId,
    subject: login.authUserId,
    tokenIdentifier: login.canonical,
  });
}

async function seedCustomerData(t: Harness, login: SeededLogin) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const tripId = await ctx.db.insert("trips", {
      availableSeats: 10,
      createdAt: now,
      endDate: "2027-01-10",
      isActive: true,
      name: "Synthetic Char Dham",
      priceInr: 50_000,
      priceUsd: 600,
      slug: "synthetic-char-dham",
      startDate: "2027-01-01",
      totalSeats: 20,
      updatedAt: now,
    });
    const profileId = await ctx.db.insert("userProfiles", {
      authUserId: login.canonical,
      createdAt: now,
      email: login.email,
      emailNormalized: login.email,
      name: "Synthetic Customer",
      passportDetailsEncrypted: "synthetic-encrypted-passport",
      phoneNumber: "+910000000001",
      sacredBharatLeaderboardOptOut: false,
      updatedAt: now,
    });
    const archivedProfileId = await ctx.db.insert("userProfiles", {
      archivedAt: now,
      archivedAuthUserId: login.authUserId,
      createdAt: now - MINUTE,
      email: login.email,
      emailNormalized: login.email,
      mergeConflictFields: ["phoneNumber"],
      mergedIntoProfileId: profileId,
      name: "Synthetic Customer",
      phoneNumber: "+910000000002",
      updatedAt: now,
    });
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId: login.canonical,
      createdAt: now,
      legacyAuthUserId: login.authUserId,
      status: "linked",
      updatedAt: now,
    });
    const bookingId = await ctx.db.insert("bookings", {
      createdAt: now,
      currency: "INR",
      notes: "Synthetic booking note",
      razorpayOrderId: "order_synthetic_deletion",
      razorpayPaymentId: "pay_synthetic_deletion",
      status: "confirmed",
      totalAmount: 100_000,
      travelerDetails: [
        {
          dateOfBirth: "1990-01-01",
          name: "Synthetic Traveller",
          passportExpiry: "2031-01-01",
          passportNumber: "P0000001",
        },
        { name: "Synthetic Companion", nationalId: "SYN-0002" },
      ],
      travelers: 2,
      tripId,
      updatedAt: now,
      userId: login.canonical,
    });
    const paymentEventId = await ctx.db.insert("bookingPaymentEvents", {
      bookingId,
      createdAt: now,
      outcome: "applied",
      paymentId: "pay_synthetic_deletion",
      providerEventId: "evt_synthetic_deletion",
      reason: "payment.captured",
      statusAfter: "confirmed",
      statusBefore: "pending",
      transition: "confirmed",
    });
    const bookingEntitlementId = await ctx.db.insert("customerJourneyEntitlements", {
      accountHolderProfileId: profileId,
      authUserId: login.canonical,
      bookingId,
      capabilities: ["view_booking"],
      createdAt: now,
      role: "purchaser",
      source: "public_booking_owner",
      updatedAt: now,
    });
    const legacyEntitlementId = await ctx.db.insert("customerJourneyEntitlements", {
      authUserId: login.authUserId,
      capabilities: ["view_confirmed_trip"],
      createdAt: now,
      role: "traveller",
      source: "crm_operator_grant",
      updatedAt: now,
    });
    await ctx.db.insert("sacredBharatProfiles", {
      authUserId: login.authUserId,
      bio: "Synthetic yatri bio",
      createdAt: now,
      displayName: "Synthetic Yatri",
      homeCity: "Synthetic City",
      isPublic: true,
      shareRecentVisits: true,
      shareWishlist: true,
      slug: "synthetic-yatri",
      updatedAt: now,
    });
    await ctx.db.insert("sacredBharatLeaderboardSummaries", {
      authUserId: login.canonical,
      completedTrailCount: 1,
      displayName: "Synthetic Yatri",
      levelSlug: "seeker",
      levelTitle: "Seeker",
      optedOut: false,
      passportSlug: "synthetic-yatri",
      score: 120,
      templeCount: 2,
      updatedAt: now,
    });
    for (const templeId of ["kedarnath", "badrinath"]) {
      await ctx.db.insert("sacredBharatVisits", {
        authUserId: login.canonical,
        citiusBookingId: bookingId,
        source: "citius_booking",
        templeId,
        visitedAt: now,
      });
    }
    await ctx.db.insert("sacredBharatWishlist", {
      authUserId: login.authUserId,
      createdAt: now,
      itemId: "char-dham",
      itemType: "trail",
    });
    await ctx.db.insert("sacredBharatInviteAttempts", {
      attemptCount: 1,
      authUserId: login.canonical,
      updatedAt: now,
      windowStartedAt: now,
    });
    const ownedGroupId = await ctx.db.insert("sacredBharatGroups", {
      createdAt: now,
      inviteCode: "OWNED001",
      isArchived: false,
      memberCount: 2,
      name: "Synthetic family circle",
      ownerAuthUserId: login.canonical,
      updatedAt: now,
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId: login.canonical,
      groupId: ownedGroupId,
      joinedAt: now,
      role: "owner",
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId: `${ISSUER}|someone-else`,
      groupId: ownedGroupId,
      joinedAt: now,
      role: "member",
    });
    const joinedGroupId = await ctx.db.insert("sacredBharatGroups", {
      createdAt: now,
      inviteCode: "JOINED01",
      isArchived: false,
      memberCount: 2,
      name: "Synthetic friends",
      ownerAuthUserId: `${ISSUER}|someone-else`,
      updatedAt: now,
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId: `${ISSUER}|someone-else`,
      groupId: joinedGroupId,
      joinedAt: now,
      role: "owner",
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId: login.canonical,
      groupId: joinedGroupId,
      joinedAt: now,
      role: "member",
    });
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic Customer",
      confirmedPax: 1,
      createdAt: now,
      createdBy: `${ISSUER}|ops`,
      jobCode: "JC/DEL/001/26-27",
      status: "Open",
      updatedAt: now,
    });
    const travellerId = await ctx.db.insert("travellers", {
      callingStatus: "Pending",
      createdAt: now,
      createdBy: "synthetic-ops",
      email: login.email,
      foodPreference: "Veg",
      fullName: "Synthetic Customer",
      guestType: "Client",
      jobCardId,
      paymentType: "Company Paid",
      roomType: "Twin",
      ticketStatus: "Pending Issue",
      updatedAt: now,
      visaRequired: false,
      visaStatus: "Not Required",
    });
    return {
      archivedProfileId,
      bookingEntitlementId,
      bookingId,
      joinedGroupId,
      legacyEntitlementId,
      ownedGroupId,
      paymentEventId,
      profileId,
      travellerId,
    };
  });
}

async function betterAuthRows(t: Harness, authUserId: string) {
  return await t.run(async (ctx) => {
    const page = (model: "account" | "session") =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model,
        paginationOpts: { cursor: null, numItems: 50 },
        where: [{ field: "userId", value: authUserId }],
      });
    const [user, sessions, accounts, verifications] = await Promise.all([
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: authUserId }],
      }),
      page("session"),
      page("account"),
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "verification",
        paginationOpts: { cursor: null, numItems: 50 },
        where: [{ field: "value", value: authUserId }],
      }),
    ]);
    return {
      accounts: accounts.page.length,
      sessions: sessions.page.length,
      user,
      verifications: verifications.page.length,
    };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("self-service account deletion", () => {
  test("erases the login and customer data, and keeps bookings detached and anonymised", async () => {
    const t = createHarness();
    const login = await createLogin(t, { email: "deleting@account-deletion.test", name: "A" });
    const other = await createLogin(t, { email: "staying@account-deletion.test", name: "B" });
    const ids = await seedCustomerData(t, login);
    const otherIds = await seedCustomerData(t, other);

    const result = await asLogin(t, login).mutation(api.accountDeletion.deleteMyAccount, {
      confirmation: "DELETE",
    });
    expect(result.status).toBe("deleted");
    expect(result.reference).toMatch(/^[0-9A-F]{16}$/);

    expect(await betterAuthRows(t, login.authUserId)).toEqual({
      accounts: 0,
      sessions: 0,
      user: null,
      verifications: 0,
    });
    expect(await betterAuthRows(t, other.authUserId)).toMatchObject({
      accounts: 2,
      sessions: 1,
      verifications: 1,
    });

    const state = await t.run(async (ctx) => {
      const byOwner = async (
        table:
          | "sacredBharatInviteAttempts"
          | "sacredBharatLeaderboardSummaries"
          | "sacredBharatProfiles"
          | "sacredBharatVisits"
          | "sacredBharatWishlist"
          | "sacredBharatGroupMembers",
        ownerIds: string[]
      ) => {
        let count = 0;
        for (const authUserId of ownerIds) {
          const rows = await ctx.db
            .query(table)
            .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
            .collect();
          count += rows.length;
        }
        return count;
      };
      const owners = [login.canonical, login.authUserId];
      return {
        archivedProfile: await ctx.db.get("userProfiles", ids.archivedProfileId),
        booking: await ctx.db.get("bookings", ids.bookingId),
        bookingEntitlement: await ctx.db.get(
          "customerJourneyEntitlements",
          ids.bookingEntitlementId
        ),
        groupMembers: await byOwner("sacredBharatGroupMembers", owners),
        identityLinks: await ctx.db
          .query("authIdentityLinks")
          .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", login.authUserId))
          .collect(),
        inviteAttempts: await byOwner("sacredBharatInviteAttempts", owners),
        joinedGroup: await ctx.db.get("sacredBharatGroups", ids.joinedGroupId),
        leaderboard: await byOwner("sacredBharatLeaderboardSummaries", owners),
        legacyEntitlement: await ctx.db.get("customerJourneyEntitlements", ids.legacyEntitlementId),
        otherBooking: await ctx.db.get("bookings", otherIds.bookingId),
        otherProfile: await ctx.db.get("userProfiles", otherIds.profileId),
        ownedGroup: await ctx.db.get("sacredBharatGroups", ids.ownedGroupId),
        paymentEvent: await ctx.db.get("bookingPaymentEvents", ids.paymentEventId),
        profile: await ctx.db.get("userProfiles", ids.profileId),
        receipts: await ctx.db.query("accountDeletionReceipts").collect(),
        traveller: await ctx.db.get("travellers", ids.travellerId),
        visits: await byOwner("sacredBharatVisits", owners),
        wishlist: await byOwner("sacredBharatWishlist", owners),
        yatriProfiles: await byOwner("sacredBharatProfiles", owners),
      };
    });

    expect(state.profile).toBeNull();
    expect(state.archivedProfile).toBeNull();
    expect(state.identityLinks).toEqual([]);
    expect(state.yatriProfiles).toBe(0);
    expect(state.leaderboard).toBe(0);
    expect(state.visits).toBe(0);
    expect(state.wishlist).toBe(0);
    expect(state.inviteAttempts).toBe(0);
    expect(state.groupMembers).toBe(0);
    expect(state.joinedGroup).toMatchObject({ isArchived: false, memberCount: 1 });
    expect(state.ownedGroup?.isArchived).toBe(true);
    expect(state.ownedGroup?.ownerAuthUserId).toMatch(/^deleted-account:[0-9a-f]{64}$/);

    const tombstone = state.ownedGroup?.ownerAuthUserId;
    expect(state.booking).toMatchObject({
      currency: "INR",
      razorpayOrderId: "order_synthetic_deletion",
      razorpayPaymentId: "pay_synthetic_deletion",
      status: "confirmed",
      totalAmount: 100_000,
      travelers: 2,
      userId: tombstone,
    });
    expect(state.booking?.notes).toBeUndefined();
    // Names stay for the invoice; identity documents go (owner decision, 7 Nov 2026).
    expect(state.booking?.travelerDetails).toEqual([
      { name: "Synthetic Traveller" },
      { name: "Synthetic Companion" },
    ]);
    expect(state.otherBooking?.travelerDetails).toEqual([
      expect.objectContaining({ passportNumber: "P0000001" }),
      expect.objectContaining({ nationalId: "SYN-0002" }),
    ]);
    expect(state.paymentEvent).not.toBeNull();
    expect(state.bookingEntitlement).toMatchObject({ authUserId: tombstone });
    expect(state.bookingEntitlement?.revokedAt).toEqual(expect.any(Number));
    expect(state.bookingEntitlement?.accountHolderProfileId).toBeUndefined();
    expect(state.legacyEntitlement).toMatchObject({ authUserId: tombstone });
    expect(state.legacyEntitlement?.revokedAt).toEqual(expect.any(Number));

    expect(state.traveller).toMatchObject({ email: login.email, fullName: "Synthetic Customer" });
    expect(state.otherProfile).not.toBeNull();
    expect(state.otherBooking?.userId).toBe(other.canonical);

    expect(state.receipts).toHaveLength(1);
    const [receipt] = state.receipts;
    expect(Object.keys(receipt).sort()).toEqual(
      ["_creationTime", "_id", "confirmationEmail", "deletedAt", "erased", "subjectHash"].sort()
    );
    expect(JSON.stringify(receipt)).not.toContain(login.email);
    expect(JSON.stringify(receipt)).not.toContain(login.authUserId);
    expect(receipt.subjectHash).toBe(tombstone?.replace("deleted-account:", ""));
    expect(receipt.erased).toMatchObject({
      authAccounts: 2,
      authSessions: 1,
      authUser: 1,
      authVerifications: 1,
      bookingDocumentFields: 4,
      bookingsDetached: 1,
      entitlementsRevoked: 2,
      feedbackPhotos: 0,
      profiles: 2,
      sacredBharatRows: 9,
    });
  });

  test("a retry after deletion returns the same receipt and changes nothing", async () => {
    const t = createHarness();
    const login = await createLogin(t, { email: "retry@account-deletion.test", name: "R" });
    await seedCustomerData(t, login);
    const caller = asLogin(t, login);

    const first = await caller.mutation(api.accountDeletion.deleteMyAccount, {
      confirmation: "DELETE",
    });
    const second = await caller.mutation(api.accountDeletion.deleteMyAccount, {
      confirmation: "DELETE",
    });

    expect(second).toEqual(first);
    const receipts = await t.run(async (ctx) => ctx.db.query("accountDeletionReceipts").collect());
    expect(receipts).toHaveLength(1);
  });

  test("the account cannot be recreated by a still-valid token after deletion", async () => {
    const t = createHarness();
    const login = await createLogin(t, { email: "stale@account-deletion.test", name: "S" });
    const caller = asLogin(t, login);
    await caller.mutation(api.accountDeletion.deleteMyAccount, { confirmation: "DELETE" });

    await expect(caller.mutation(api.userProfiles.ensureMyProfile, {})).rejects.toThrow(
      "ACCOUNT_DELETED"
    );
    const profiles = await t.run(async (ctx) => ctx.db.query("userProfiles").collect());
    expect(profiles).toEqual([]);
  });

  test("refuses a staff login, matched by identity or by staff email, with HR guidance", async () => {
    const t = createHarness();
    const linked = await createLogin(t, { email: "linked@citius.test", name: "Linked staff" });
    const unlinked = await createLogin(t, { email: "Unlinked@Citius.test", name: "Unlinked" });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: linked.canonical,
        createdAt: now,
        email: linked.email,
        emailNormalized: linked.email,
        name: "Linked staff",
        roles: ["Sales"],
        updatedAt: now,
      });
      await ctx.db.insert("staffUsers", {
        active: false,
        createdAt: now,
        email: "unlinked@citius.test",
        emailNormalized: "unlinked@citius.test",
        name: "Former staff",
        roles: ["Operations"],
        updatedAt: now,
      });
    });

    for (const login of [linked, unlinked]) {
      const caller = asLogin(t, login);
      expect(
        await caller.query(api.accountDeletion.getMyAccountDeletionEligibility, {
          referenceNow: Date.now(),
        })
      ).toEqual({
        status: "staff_account",
      });
      await expect(
        caller.mutation(api.accountDeletion.deleteMyAccount, { confirmation: "DELETE" })
      ).rejects.toThrow("STAFF_ACCOUNT_DELETION_REFUSED");
      expect((await betterAuthRows(t, login.authUserId)).user).not.toBeNull();
    }
    const receipts = await t.run(async (ctx) => ctx.db.query("accountDeletionReceipts").collect());
    expect(receipts).toEqual([]);
  });

  test("requires a sign-in within the last ten minutes", async () => {
    const t = createHarness();
    const stale = await createLogin(t, {
      email: "old-session@account-deletion.test",
      name: "Old",
      signedInAgoMs: 11 * MINUTE,
    });
    const caller = asLogin(t, stale);

    expect(
      await caller.query(api.accountDeletion.getMyAccountDeletionEligibility, {
        referenceNow: Date.now(),
      })
    ).toEqual({
      status: "reauthentication_required",
    });
    await expect(
      caller.mutation(api.accountDeletion.deleteMyAccount, { confirmation: "DELETE" })
    ).rejects.toThrow("REAUTHENTICATION_REQUIRED");

    expect((await betterAuthRows(t, stale.authUserId)).user).not.toBeNull();
  });

  test("the recent sign-in must be this token's own session", async () => {
    const t = createHarness();
    const fresh = await createLogin(t, { email: "own-session@account-deletion.test", name: "O" });
    const other = await createLogin(t, { email: "other-session@account-deletion.test", name: "X" });
    const identity = {
      email: fresh.email,
      issuer: ISSUER,
      subject: fresh.authUserId,
      tokenIdentifier: fresh.canonical,
    };

    const withoutSession = t.withIdentity(identity);
    const withOthersSession = t.withIdentity({ ...identity, sessionId: other.sessionId });
    for (const caller of [withoutSession, withOthersSession]) {
      expect(
        await caller.query(api.accountDeletion.getMyAccountDeletionEligibility, {
          referenceNow: Date.now(),
        })
      ).toEqual({ status: "reauthentication_required" });
      await expect(
        caller.mutation(api.accountDeletion.deleteMyAccount, { confirmation: "DELETE" })
      ).rejects.toThrow("REAUTHENTICATION_REQUIRED");
    }
    expect((await betterAuthRows(t, fresh.authUserId)).user).not.toBeNull();
    expect((await betterAuthRows(t, other.authUserId)).sessions).toBe(1);

    const eligibility = await asLogin(t, fresh).query(
      api.accountDeletion.getMyAccountDeletionEligibility,
      { referenceNow: Date.now() }
    );
    expect(eligibility?.status).toBe("ready");
  });

  test("requires the typed confirmation and refuses anonymous callers", async () => {
    const t = createHarness();
    const login = await createLogin(t, { email: "typed@account-deletion.test", name: "T" });

    for (const confirmation of ["", "delete me", "DELET"]) {
      await expect(
        asLogin(t, login).mutation(api.accountDeletion.deleteMyAccount, { confirmation })
      ).rejects.toThrow("ACCOUNT_DELETION_CONFIRMATION_REQUIRED");
    }
    await expect(
      t.mutation(api.accountDeletion.deleteMyAccount, { confirmation: "DELETE" })
    ).rejects.toThrow("UNAUTHORIZED");
    expect(
      await t.query(api.accountDeletion.getMyAccountDeletionEligibility, {
        referenceNow: Date.now(),
      })
    ).toBeNull();
    expect((await betterAuthRows(t, login.authUserId)).user).not.toBeNull();
  });

  test("emails the confirmation through the transactional provider and records only its status", async () => {
    vi.useFakeTimers();
    vi.stubEnv("RESEND_API_KEY", "synthetic-resend-key");
    const sent: Array<{ subject: string; to: string[] }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        sent.push({ subject: body.subject, to: body.to });
        return Promise.resolve(new Response("{}", { status: 200 }));
      })
    );
    const t = createHarness();
    const login = await createLogin(t, { email: "mailed@account-deletion.test", name: "M" });

    await asLogin(t, login).mutation(api.accountDeletion.deleteMyAccount, {
      confirmation: "DELETE",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent).toEqual([
      { subject: "Your Citius Holidays account was deleted", to: [login.email] },
    ]);
    const receipt = await t.run(async (ctx) => ctx.db.query("accountDeletionReceipts").unique());
    expect(receipt?.confirmationEmail).toBe("sent");
    const deliveries = await t.run(async (ctx) => ctx.db.query("authEmailDeliveries").collect());
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({ purpose: "account_deleted", status: "sent" });
    expect(JSON.stringify(deliveries[0])).not.toContain(login.email);
  });

  test("fails closed when no email provider is configured", async () => {
    vi.useFakeTimers();
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const t = createHarness();
    const login = await createLogin(t, { email: "unmailed@account-deletion.test", name: "U" });

    await asLogin(t, login).mutation(api.accountDeletion.deleteMyAccount, {
      confirmation: "DELETE",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchSpy).not.toHaveBeenCalled();
    const receipt = await t.run(async (ctx) => ctx.db.query("accountDeletionReceipts").unique());
    expect(receipt?.confirmationEmail).toBe("skipped");
    expect((await betterAuthRows(t, login.authUserId)).user).toBeNull();
  });
});
