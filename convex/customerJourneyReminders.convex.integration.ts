import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const NOW = new Date("2026-08-29T12:00:00.000Z").getTime();
const AUTH_USER_ID = "https://auth.citius.test|journey-reminder-customer";
const VERIFIED_PHONE = "+15555550123";
const WHATSAPP_MESSAGE_ID = "8ba7b830-9dad-11d1-80b4-00c04fd430c8";
const REVOKED_WHATSAPP_MESSAGE_ID = "8ba7b830-9dad-11d1-80b4-00c04fd430c9";
const EARLY_WHATSAPP_MESSAGE_ID = "8ba7b830-9dad-11d1-80b4-00c04fd430ca";

function createHarness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seedJourney(t: ReturnType<typeof createHarness>) {
  return await t.run(async (ctx) => {
    const queryId = await ctx.db.insert("queries", {
      clientName: "Private fixture name",
      contractingStatus: "Query Received",
      createdAt: NOW,
      createdBy: "fixture",
      destination: "Private destination",
      paxCount: 2,
      queryCode: "Q-REMINDER-1",
      queryType: "FIT",
      salesStatus: "Proposal in discussion",
      travelType: "Domestic Travel",
      updatedAt: NOW,
    });
    const proposalId = await ctx.db.insert("proposals", {
      clientName: "Private fixture name",
      createdAt: NOW,
      createdBy: "fixture",
      preparedBy: "fixture",
      proposalCode: "P-REMINDER-1",
      status: "Accepted",
      updatedAt: NOW,
    });
    const proposalQueryHandoffId = await ctx.db.insert("proposalQueryHandoffs", {
      airfarePerPax: 20_000,
      clientName: "Private fixture name",
      commandId: "fixture-confirmed-handoff",
      costPrice: 70_000,
      handedOffAt: NOW,
      handedOffBy: "fixture",
      itinerarySummary: "Private itinerary",
      landCostPerPax: 50_000,
      proposalCode: "P-REMINDER-1",
      proposalId,
      proposalRevision: 1,
      queryId,
      sellingPrice: 80_000,
      visaCostPerPax: 0,
    });
    const confirmedOfferId = await ctx.db.insert("confirmedOffers", {
      airfarePerPax: 20_000,
      confirmedAt: NOW,
      confirmedPax: 2,
      createdAt: NOW,
      createdBy: "fixture",
      destination: "Private destination",
      landCostPerPax: 50_000,
      profitPerPax: 10_000,
      proposalId,
      proposalQueryHandoffId,
      proposalRevision: 1,
      queryId,
      sellingPricePerPax: 80_000,
      travelEndDate: "2026-11-10",
      travelStartDate: "2026-11-01",
      updatedAt: NOW,
      visaCostPerPax: 0,
    });
    await ctx.db.patch("queries", queryId, { confirmedOfferId, updatedAt: NOW });
    const profileId = await ctx.db.insert("userProfiles", {
      authUserId: AUTH_USER_ID,
      createdAt: NOW,
      email: "private-customer@example.com",
      name: "Private Customer",
      phoneNumber: "+1 555 555 9999",
      updatedAt: NOW,
    });
    const entitlementId = await ctx.db.insert("customerJourneyEntitlements", {
      accountHolderProfileId: profileId,
      authUserId: AUTH_USER_ID,
      capabilities: ["view_confirmed_trip"],
      confirmedOfferId,
      createdAt: NOW,
      queryId,
      role: "organizer",
      source: "crm_operator_grant",
      updatedAt: NOW,
    });
    return { confirmedOfferId, entitlementId, queryId };
  });
}

function account(t: ReturnType<typeof createHarness>, subject = "journey-reminder-customer") {
  return t.withIdentity({
    email: "private-customer@example.com",
    issuer: "https://auth.citius.test",
    subject,
    tokenIdentifier: `https://auth.citius.test|${subject}`,
  });
}

async function addVerifiedPhone(t: ReturnType<typeof createHarness>, phoneE164 = VERIFIED_PHONE) {
  return await t.run(async (ctx) =>
    ctx.db.insert("customerPhoneVerifications", {
      authUserId: AUTH_USER_ID,
      createdAt: NOW,
      phoneE164,
      updatedAt: NOW,
      verifiedAt: NOW,
    })
  );
}

async function optIn(t: ReturnType<typeof createHarness>, confirmedOfferId: Id<"confirmedOffers">) {
  return await account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
    confirmedOfferId,
    milestones: ["arrival_pack_ready", "confirmed_travel_summary_ready"],
  });
}

describe("registered journey reminder policy", () => {
  test("derives Account authorization and requires a separate normalized verified phone", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);

    await expect(
      t.mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
        confirmedOfferId: fixture.confirmedOfferId,
        milestones: ["arrival_pack_ready"],
      })
    ).rejects.toThrow("UNAUTHORIZED");
    await expect(
      account(t, "someone-else").mutation(
        api.customerJourneyReminders.setMyJourneyReminderPreferences,
        {
          confirmedOfferId: fixture.confirmedOfferId,
          milestones: ["arrival_pack_ready"],
        }
      )
    ).rejects.toThrow("Journey not found");
    await t.run((ctx) =>
      ctx.db.patch("queries", fixture.queryId, {
        confirmedOfferId: undefined,
        updatedAt: NOW + 1,
      })
    );
    await expect(
      account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
        confirmedOfferId: fixture.confirmedOfferId,
        milestones: ["arrival_pack_ready"],
      })
    ).rejects.toThrow("Journey not found");
    await t.run((ctx) =>
      ctx.db.patch("queries", fixture.queryId, {
        confirmedOfferId: fixture.confirmedOfferId,
        updatedAt: NOW + 2,
      })
    );
    await expect(
      account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
        confirmedOfferId: fixture.confirmedOfferId,
        milestones: ["arrival_pack_ready"],
      })
    ).rejects.toThrow("VERIFIED_PHONE_REQUIRED");

    const phoneId = await addVerifiedPhone(t, "+1 555 555 0123");
    await expect(
      account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
        confirmedOfferId: fixture.confirmedOfferId,
        milestones: ["arrival_pack_ready"],
      })
    ).rejects.toThrow("VERIFIED_PHONE_REQUIRED");
    await t.run((ctx) =>
      ctx.db.patch("customerPhoneVerifications", phoneId, {
        phoneE164: VERIFIED_PHONE,
        updatedAt: NOW + 1,
        verifiedAt: -1,
      })
    );
    await expect(
      account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
        confirmedOfferId: fixture.confirmedOfferId,
        milestones: ["arrival_pack_ready"],
      })
    ).rejects.toThrow("VERIFIED_PHONE_REQUIRED");
    await t.run((ctx) =>
      ctx.db.patch("customerPhoneVerifications", phoneId, {
        updatedAt: NOW + 2,
        verifiedAt: NOW,
      })
    );

    const preference = await optIn(t, fixture.confirmedOfferId);
    expect(preference).toMatchObject({
      active: true,
      available: true,
      maskedPhone: "••••0123",
      milestones: ["arrival_pack_ready", "confirmed_travel_summary_ready"],
    });
    expect(JSON.stringify(preference)).not.toContain(VERIFIED_PHONE);

    await t.run(async (ctx) => {
      const [row] = await ctx.db.query("customerJourneyReminderPreferences").collect();
      const revisions = await ctx.db.query("customerJourneyReminderConsentRevisions").collect();
      const deliveries = await ctx.db.query("customerJourneyReminderDeliveries").collect();
      expect(row?.currentConsentRevisionId).toBe(revisions[0]?._id);
      expect(revisions).toHaveLength(1);
      expect(revisions[0]).toMatchObject({
        active: true,
        milestones: ["arrival_pack_ready", "confirmed_travel_summary_ready"],
      });
      expect(deliveries).toHaveLength(2);
      expect(deliveries.map((delivery) => delivery.milestone).sort()).toEqual([
        "arrival_pack_ready",
        "confirmed_travel_summary_ready",
      ]);
      expect(
        deliveries.every(
          (delivery) =>
            delivery.channel === "whatsapp" &&
            delivery.consentRevisionId === revisions[0]?._id &&
            delivery.status === "queued"
        )
      ).toBe(true);
      expect(JSON.stringify({ deliveries, revisions, row })).not.toMatch(
        /private-customer|Private Customer|Private destination|15555550123|sellingPrice|amount/i
      );
    });
  });

  test("queues travel-summary reminders only when the shared confirmed projection is ready", async () => {
    const projections = await Promise.all(
      [
        { travelEndDate: undefined },
        { travelEndDate: "invalid-date" },
        { destination: "" },
        { travelEndDate: "2026-11-10", travelStartDate: "2026-12-01" },
      ].map(async (offerPatch) => {
        const t = createHarness();
        const fixture = await seedJourney(t);
        await t.run((ctx) => ctx.db.patch("confirmedOffers", fixture.confirmedOfferId, offerPatch));
        await addVerifiedPhone(t);
        await optIn(t, fixture.confirmedOfferId);
        return await t.run(async (ctx) =>
          (await ctx.db.query("customerJourneyReminderDeliveries").collect()).map(
            (delivery) => delivery.milestone
          )
        );
      })
    );

    expect(projections).toEqual([
      ["arrival_pack_ready"],
      ["arrival_pack_ready"],
      ["arrival_pack_ready"],
      ["arrival_pack_ready"],
    ]);
  });

  test("deduplicates logical events and suppresses at queue or claim after opt-out/revocation", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);

    const first = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:version-1",
    });
    const duplicate = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:version-1",
    });
    expect(duplicate.deliveryId).toBe(first.deliveryId);

    await account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
      confirmedOfferId: fixture.confirmedOfferId,
      milestones: [],
    });
    expect(
      await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
        deliveryId: first.deliveryId,
      })
    ).toBeNull();
    const afterOptOut = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:version-2",
    });
    expect(afterOptOut.status).toBe("suppressed");

    await optIn(t, fixture.confirmedOfferId);
    const beforeRevocation = await t.mutation(
      internal.customerJourneyReminders.queueJourneyReminder,
      {
        entitlementId: fixture.entitlementId,
        milestone: "arrival_pack_ready",
        sourceEventId: "arrival-pack:version-3",
      }
    );
    await t.run((ctx) =>
      ctx.db.patch("customerJourneyEntitlements", fixture.entitlementId, {
        revokedAt: NOW + 10,
        updatedAt: NOW + 10,
      })
    );
    expect(
      await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
        deliveryId: beforeRevocation.deliveryId,
      })
    ).toBeNull();

    await t.run(async (ctx) => {
      const deliveries = await ctx.db.query("customerJourneyReminderDeliveries").collect();
      const revisions = await ctx.db.query("customerJourneyReminderConsentRevisions").collect();
      expect(deliveries.filter((row) => row.channel === "whatsapp")).toHaveLength(5);
      expect(deliveries.every((row) => row.status === "suppressed")).toBe(true);
      expect(revisions).toHaveLength(3);
      expect(revisions.map((row) => row.active)).toEqual([true, false, true]);
      expect(revisions[0]?.milestones).toEqual([
        "arrival_pack_ready",
        "confirmed_travel_summary_ready",
      ]);
      expect(revisions[1]?.previousRevisionId).toBe(revisions[0]?._id);
      expect(revisions[2]?.previousRevisionId).toBe(revisions[1]?._id);
    });
  });

  test("queues RCS once only after an allowlisted WhatsApp permanent-failure event", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);

    const queued = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:permanent-failure",
    });
    expect(
      await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
        deliveryId: queued.deliveryId,
      })
    ).toMatchObject({ channel: "whatsapp", phoneE164: VERIFIED_PHONE });
    await t.mutation(internal.customerJourneyReminders.recordJourneyReminderSendOutcome, {
      deliveryId: queued.deliveryId,
      outcome: "accepted",
      providerMessageId: WHATSAPP_MESSAGE_ID,
    });

    const scheduled = await t.mutation(
      internal.customerJourneyReminders.applySentJourneyReminderWebhook,
      {
        channel: "whatsapp",
        eventAt: NOW + 100,
        eventKey: "sent-wa-message-1-scheduled",
        eventType: "message.scheduled",
        messageId: WHATSAPP_MESSAGE_ID,
        status: "scheduled",
      }
    );
    expect(scheduled).toEqual({ fallbackQueued: false, outcome: "applied" });
    await t.run(async (ctx) => {
      expect(
        (await ctx.db.query("customerJourneyReminderDeliveries").collect()).filter(
          (row) => row.channel === "rcs"
        )
      ).toHaveLength(0);
    });

    const failed = await t.mutation(
      internal.customerJourneyReminders.applySentJourneyReminderWebhook,
      {
        channel: "whatsapp",
        eventAt: NOW + 200,
        eventKey: "sent-wa-message-1-failed",
        eventType: "message.failed",
        messageId: WHATSAPP_MESSAGE_ID,
        status: "failed",
      }
    );
    expect(failed).toEqual({ fallbackQueued: true, outcome: "applied" });
    expect(
      await t.mutation(internal.customerJourneyReminders.applySentJourneyReminderWebhook, {
        channel: "whatsapp",
        eventAt: NOW + 200,
        eventKey: "sent-wa-message-1-failed",
        eventType: "message.failed",
        messageId: WHATSAPP_MESSAGE_ID,
        status: "failed",
      })
    ).toEqual({ fallbackQueued: false, outcome: "duplicate" });
    expect(
      await t.mutation(internal.customerJourneyReminders.applySentJourneyReminderWebhook, {
        channel: "whatsapp",
        eventAt: NOW + 300,
        eventKey: "sent-wa-message-1-delivered-after-failure",
        eventType: "message.delivered",
        messageId: WHATSAPP_MESSAGE_ID,
        status: "delivered",
      })
    ).toEqual({ fallbackQueued: false, outcome: "stale" });

    await t.run(async (ctx) => {
      const deliveries = await ctx.db.query("customerJourneyReminderDeliveries").collect();
      const [rcs] = deliveries.filter((row) => row.channel === "rcs");
      expect(deliveries.filter((row) => row.channel === "rcs")).toHaveLength(1);
      expect(rcs).toMatchObject({
        fallbackOfDeliveryId: queued.deliveryId,
        status: "queued",
      });
      const receipt = rcs?.fallbackAuthorizedByReceiptId
        ? await ctx.db.get(
            "customerJourneyReminderWebhookReceipts",
            rcs.fallbackAuthorizedByReceiptId
          )
        : null;
      expect(receipt).toMatchObject({ applied: true, eventType: "message.failed" });
      expect(JSON.stringify(deliveries)).not.toMatch(
        /private-customer|Private Customer|Private destination|15555550123|sellingPrice|amount/i
      );
    });
  });

  test("reconciles a signed terminal webhook that races the accepted response", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);

    const queued = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:early-provider-failure",
    });
    await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: queued.deliveryId,
    });
    const earlyFailure = {
      channel: "whatsapp" as const,
      eventAt: NOW + 100,
      eventKey: "sent-wa-message-early-failed",
      eventType: "message.failed",
      messageId: EARLY_WHATSAPP_MESSAGE_ID,
      status: "failed" as const,
    };
    expect(
      await t.mutation(
        internal.customerJourneyReminders.applySentJourneyReminderWebhook,
        earlyFailure
      )
    ).toEqual({ fallbackQueued: false, outcome: "pending" });

    await t.mutation(internal.customerJourneyReminders.recordJourneyReminderSendOutcome, {
      deliveryId: queued.deliveryId,
      outcome: "accepted",
      providerMessageId: EARLY_WHATSAPP_MESSAGE_ID,
    });

    await t.run(async (ctx) => {
      const delivery = await ctx.db.get("customerJourneyReminderDeliveries", queued.deliveryId);
      const receipts = await ctx.db
        .query("customerJourneyReminderWebhookReceipts")
        .withIndex("by_eventKey", (q) => q.eq("eventKey", earlyFailure.eventKey))
        .collect();
      const fallbacks = (await ctx.db.query("customerJourneyReminderDeliveries").collect()).filter(
        (row) => row.channel === "rcs"
      );
      expect(delivery?.status).toBe("failed");
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({ applied: true, deliveryId: queued.deliveryId });
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]?.fallbackAuthorizedByReceiptId).toBe(receipts[0]?._id);
    });
    expect(
      await t.mutation(
        internal.customerJourneyReminders.applySentJourneyReminderWebhook,
        earlyFailure
      )
    ).toEqual({ fallbackQueued: false, outcome: "duplicate" });
  });

  test("never rebinds an authorized RCS fallback to a later phone revision", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    const firstPhoneId = await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);
    const queued = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:phone-rotation",
    });
    await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: queued.deliveryId,
    });
    await t.mutation(internal.customerJourneyReminders.recordJourneyReminderSendOutcome, {
      deliveryId: queued.deliveryId,
      outcome: "accepted",
      providerMessageId: WHATSAPP_MESSAGE_ID,
    });
    await t.mutation(internal.customerJourneyReminders.applySentJourneyReminderWebhook, {
      channel: "whatsapp",
      eventAt: NOW + 100,
      eventKey: "sent-wa-phone-rotation-failed",
      eventType: "message.failed",
      messageId: WHATSAPP_MESSAGE_ID,
      status: "failed",
    });
    const rcs = await t.run(async (ctx) =>
      (await ctx.db.query("customerJourneyReminderDeliveries").collect()).find(
        (delivery) => delivery.channel === "rcs"
      )
    );
    expect(rcs).toBeDefined();
    if (!rcs) {
      throw new Error("Expected the signed WhatsApp failure to authorize one RCS fallback");
    }

    await t.run(async (ctx) => {
      await ctx.db.patch("customerPhoneVerifications", firstPhoneId, {
        revokedAt: NOW + 200,
        updatedAt: NOW + 200,
      });
      await ctx.db.insert("customerPhoneVerifications", {
        authUserId: AUTH_USER_ID,
        createdAt: NOW + 200,
        phoneE164: "+15555550124",
        updatedAt: NOW + 200,
        verifiedAt: NOW + 200,
      });
    });
    await optIn(t, fixture.confirmedOfferId);

    expect(
      await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
        deliveryId: rcs._id,
      })
    ).toBeNull();
    await t.run(async (ctx) => {
      const fallback = await ctx.db.get("customerJourneyReminderDeliveries", rcs._id);
      expect(fallback?.status).toBe("suppressed");
      expect(fallback?.suppressionReason).toBe("fallback_not_authorized");
    });
  });

  test("revalidates consent at the final provider boundary without recording an effect", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);
    const queued = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:operator-suppressed",
    });
    await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: queued.deliveryId,
    });
    await account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
      confirmedOfferId: fixture.confirmedOfferId,
      milestones: [],
    });
    const send = await t.mutation(internal.customerJourneyReminders.beginJourneyReminderSend, {
      deliveryId: queued.deliveryId,
    });
    expect(send).toBeNull();

    await t.run(async (ctx) => {
      const deliveries = await ctx.db.query("customerJourneyReminderDeliveries").collect();
      const target = deliveries.find((delivery) => delivery._id === queued.deliveryId);
      expect(target).toMatchObject({
        channel: "whatsapp",
        status: "suppressed",
        suppressionReason: "consent_withdrawn",
      });
      expect(await ctx.db.query("operationalEffectReceipts").collect()).toEqual([]);
    });
  });

  test("records a suppressed effect when the journey-reminder control changes before send", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);
    const queued = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:control-disabled-before-send",
    });
    const claim = await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: queued.deliveryId,
    });
    expect(claim).toMatchObject({ channel: "whatsapp" });
    if (!claim) {
      throw new Error("Expected an eligible WhatsApp reminder claim");
    }
    await t.run(async (ctx) => {
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: NOW,
        activatedBy: "fixture",
        activatedByName: "Fixture",
        key: "global",
        reason: "Journey reminder integration fixture",
        revision: 1,
      });
      await ctx.db.insert("operationalControlStates", {
        key: "messaging.customer_journey_reminders",
        reason: "Pause provider requests in the integration fixture",
        revision: 1,
        state: "disabled",
        updatedAt: NOW,
        updatedBy: "fixture",
        updatedByName: "Fixture",
      });
    });

    expect(
      await t.mutation(internal.customerJourneyReminders.beginJourneyReminderSend, {
        deliveryId: queued.deliveryId,
      })
    ).toBeNull();

    await t.run(async (ctx) => {
      expect(
        await ctx.db.get("customerJourneyReminderDeliveries", queued.deliveryId)
      ).toMatchObject({
        channel: "whatsapp",
        status: "suppressed",
        suppressionReason: "operator_suppressed",
      });
      const receipts = await ctx.db.query("operationalEffectReceipts").collect();
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({
        controlKey: "messaging.customer_journey_reminders",
        disposition: "suppressed",
        effectId: `customer-journey-reminder:${claim.idempotencyKey}`,
        reason: "explicit_disabled",
      });
    });
  });

  test("revalidates RCS consent after claim and before the final provider boundary", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);
    const queued = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:rcs-consent-race",
    });
    await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: queued.deliveryId,
    });
    await t.mutation(internal.customerJourneyReminders.recordJourneyReminderSendOutcome, {
      deliveryId: queued.deliveryId,
      outcome: "accepted",
      providerMessageId: WHATSAPP_MESSAGE_ID,
    });
    await t.mutation(internal.customerJourneyReminders.applySentJourneyReminderWebhook, {
      channel: "whatsapp",
      eventAt: NOW + 400,
      eventKey: "sent-wa-rcs-consent-race-failed",
      eventType: "message.failed",
      messageId: WHATSAPP_MESSAGE_ID,
      status: "failed",
    });
    const rcs = await t.run(async (ctx) =>
      (await ctx.db.query("customerJourneyReminderDeliveries").collect()).find(
        (delivery) => delivery.channel === "rcs"
      )
    );
    if (!rcs) {
      throw new Error("Expected a signed WhatsApp failure to authorize one RCS fallback");
    }
    expect(
      await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
        deliveryId: rcs._id,
      })
    ).toMatchObject({ channel: "rcs", phoneE164: VERIFIED_PHONE });

    await account(t).mutation(api.customerJourneyReminders.setMyJourneyReminderPreferences, {
      confirmedOfferId: fixture.confirmedOfferId,
      milestones: [],
    });
    expect(
      await t.mutation(internal.customerJourneyReminders.beginJourneyReminderSend, {
        deliveryId: rcs._id,
      })
    ).toBeNull();

    await t.run(async (ctx) => {
      expect(await ctx.db.get("customerJourneyReminderDeliveries", rcs._id)).toMatchObject({
        channel: "rcs",
        status: "suppressed",
        suppressionReason: "consent_withdrawn",
      });
      expect(await ctx.db.query("operationalEffectReceipts").collect()).toEqual([]);
    });
  });

  test("never creates fallback for ambiguous transport state or after revocation", async () => {
    const t = createHarness();
    const fixture = await seedJourney(t);
    await addVerifiedPhone(t);
    await optIn(t, fixture.confirmedOfferId);

    const ambiguous = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:ambiguous",
    });
    await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: ambiguous.deliveryId,
    });
    await t.mutation(internal.customerJourneyReminders.recordJourneyReminderSendOutcome, {
      deliveryId: ambiguous.deliveryId,
      outcome: "ambiguous",
    });

    const accepted = await t.mutation(internal.customerJourneyReminders.queueJourneyReminder, {
      entitlementId: fixture.entitlementId,
      milestone: "arrival_pack_ready",
      sourceEventId: "arrival-pack:revoked-before-failure",
    });
    await t.mutation(internal.customerJourneyReminders.claimJourneyReminderDelivery, {
      deliveryId: accepted.deliveryId,
    });
    await t.mutation(internal.customerJourneyReminders.recordJourneyReminderSendOutcome, {
      deliveryId: accepted.deliveryId,
      outcome: "accepted",
      providerMessageId: REVOKED_WHATSAPP_MESSAGE_ID,
    });
    await t.run((ctx) =>
      ctx.db.patch("customerJourneyEntitlements", fixture.entitlementId, {
        revokedAt: NOW + 1,
        updatedAt: NOW + 1,
      })
    );
    expect(
      await t.mutation(internal.customerJourneyReminders.applySentJourneyReminderWebhook, {
        channel: "whatsapp",
        eventAt: NOW + 2,
        eventKey: "sent-wa-message-revoked-failed",
        eventType: "message.failed",
        messageId: REVOKED_WHATSAPP_MESSAGE_ID,
        status: "failed",
      })
    ).toEqual({ fallbackQueued: false, outcome: "applied" });

    await t.run(async (ctx) => {
      const deliveries = await ctx.db.query("customerJourneyReminderDeliveries").collect();
      expect(deliveries.filter((row) => row.channel === "rcs")).toHaveLength(0);
      expect(deliveries.find((row) => row._id === ambiguous.deliveryId)?.status).toBe("ambiguous");
    });
  });
});
