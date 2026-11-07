import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import betterAuthSchema from "../betterAuth/schema";
import schema from "../schema";
import { modules } from "../test.setup";

const betterAuthModules = import.meta.glob("../betterAuth/**/*.ts");

// Synthetic fixtures only: made-up people, test-domain emails and placeholder ids.

// 11:30 IST on 7 November 2026.
const NOW = Date.parse("2026-11-07T06:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const SECRET = "synthetic-retention-secret";

type Harness = ReturnType<typeof harness>;

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

/** 00:00 IST on an office date. */
function istMidnight(date: string) {
  return Date.parse(`${date}T00:00:00+05:30`);
}

/** Switches a retention job on the way an Admin change set would leave it. */
async function setJobControl(t: Harness, key: string, state: "disabled" | "enabled") {
  await t.run(async (ctx) => {
    if (!(await ctx.db.query("operationalControlPlaneState").first())) {
      await ctx.db.insert("operationalControlPlaneState", {
        activatedAt: NOW,
        activatedBy: "synthetic-admin",
        activatedByName: "Synthetic Admin",
        key: "global",
        reason: "Synthetic activation for retention tests.",
        revision: 1,
      });
    }
    const existing = await ctx.db
      .query("operationalControlStates")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch("operationalControlStates", existing._id, { state });
      return;
    }
    await ctx.db.insert("operationalControlStates", {
      key,
      reason: "Synthetic owner decision for retention tests.",
      revision: 2,
      state,
      updatedAt: NOW,
      updatedBy: "synthetic-admin",
      updatedByName: "Synthetic Admin",
    });
  });
}

const runScheduled = (t: Harness) => t.finishAllScheduledFunctions(() => vi.runAllTimers());

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.MIGRATION_SECRET = SECRET;
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(process.env, "MIGRATION_SECRET");
});

describe("activity log retention (1 year)", () => {
  async function seedLogs(t: Harness) {
    await t.run(async (ctx) => {
      const log = (createdAt: number, message: string) =>
        ctx.db.insert("activityLogs", {
          action: "updated",
          actorId: "synthetic-actor",
          actorName: "Synthetic Actor",
          createdAt,
          entityType: "traveller",
          message,
        });
      // 7 Nov 2026 minus 365 days is 7 Nov 2025: that office date is still kept.
      await log(istMidnight("2025-11-07"), "first kept day");
      await log(istMidnight("2025-11-07") - 1, "last expired moment");
      await log(istMidnight("2024-01-01"), "long expired");
      await log(NOW - DAY, "recent");
    });
  }
  const messages = (t: Harness) =>
    t.run(async (ctx) =>
      (await ctx.db.query("activityLogs").collect()).map((row) => row.message).sort()
    );

  test("deletes logs older than a year and keeps the last year", async () => {
    const t = harness();
    await seedLogs(t);
    const result = await t.mutation(internal.crm.retention.activityLogs.purgeExpired, {});
    expect(result).toEqual({ counts: { deleted: 2 }, scheduledContinuation: false });
    expect(await messages(t)).toEqual(["first kept day", "recent"]);
  });

  test("the dry run counts without deleting and needs the secret", async () => {
    const t = harness();
    await seedLogs(t);
    await expect(
      t.query(internal.crm.retention.activityLogs.dryRun, {
        asOf: NOW,
        cursor: null,
        secret: "wrong",
      })
    ).rejects.toThrow("Invalid migration secret");
    expect(
      await t.query(internal.crm.retention.activityLogs.dryRun, {
        asOf: NOW,
        cursor: null,
        secret: SECRET,
      })
    ).toEqual({ continueCursor: null, counts: { deleted: 2 }, isDone: true });
    expect(await messages(t)).toHaveLength(4);
  });
});

describe("unconverted enquiry retention (2 years)", () => {
  async function seedIntents(t: Harness) {
    return await t.run(async (ctx) => {
      const intent = async (
        createdAt: number,
        clientName: string,
        status: "converted" | "dismissed" | "pending"
      ) => {
        const record: WithoutSystemFields<Doc<"inboundQueryIntents">> = {
          clientName,
          consentAt: createdAt,
          contactEmail: `${clientName.toLowerCase().replaceAll(" ", ".")}@enquiry.test`,
          createdAt,
          source: "Website",
          status,
        };
        if (status === "converted") {
          record.convertedAt = createdAt;
          record.convertedQueryId = "q1";
        }
        const id = await ctx.db.insert("inboundQueryIntents", record);
        const handoffEventId = await ctx.db.insert("crmHandoffEvents", {
          createdAt,
          inboundIntentId: id,
          source: "Website",
        });
        await ctx.db.patch("inboundQueryIntents", id, { handoffEventId });
        await ctx.db.insert("notifications", {
          body: `New enquiry from ${clientName}`,
          createdAt,
          entityId: String(id),
          entityType: "inboundQueryIntent",
          recipientRole: "Sales",
          title: "New enquiry",
        });
        return id;
      };
      // 7 Nov 2026 minus 2 years is 7 Nov 2024: that office date is still kept.
      return {
        convertedOld: await intent(istMidnight("2023-03-01"), "Old Converted", "converted"),
        dismissedOld: await intent(istMidnight("2024-11-07") - 1, "Old Dismissed", "dismissed"),
        pendingKept: await intent(istMidnight("2024-11-07"), "Kept Pending", "pending"),
        pendingOld: await intent(istMidnight("2023-06-01"), "Old Pending", "pending"),
      };
    });
  }

  test("deletes pending and dismissed enquiries after 2 years; keeps converted ones", async () => {
    const t = harness();
    await seedIntents(t);
    await setJobControl(t, "jobs.purge_unconverted_enquiries", "enabled");
    const result = await t.mutation(internal.crm.retention.enquiries.purgeExpired, {});
    // Each status range is its own page.
    await runScheduled(t);
    expect(result.counts).toEqual({ deleted: 1 });
    const remaining = await t.run(async (ctx) => ({
      handoffEvents: (await ctx.db.query("crmHandoffEvents").collect()).length,
      intents: (await ctx.db.query("inboundQueryIntents").collect()).map((row) => row.clientName),
      notifications: (await ctx.db.query("notifications").collect()).map((row) => row.body),
    }));
    expect(remaining.intents.sort()).toEqual(["Kept Pending", "Old Converted"]);
    // Handoff events are content-free counts and stay for the conversion statistics.
    expect(remaining.handoffEvents).toBe(4);
    expect(remaining.notifications.sort()).toEqual([
      "New enquiry from Kept Pending",
      "New enquiry from Old Converted",
    ]);
  });

  test("pausing the job stops a run that is already in progress", async () => {
    const t = harness();
    await seedIntents(t);
    await setJobControl(t, "jobs.purge_unconverted_enquiries", "enabled");
    const first = await t.mutation(internal.crm.retention.enquiries.purgeExpired, {});
    expect(first).toEqual({ counts: { deleted: 1 }, scheduledContinuation: true });
    await setJobControl(t, "jobs.purge_unconverted_enquiries", "disabled");
    await runScheduled(t);
    const names = await t.run(async (ctx) =>
      (await ctx.db.query("inboundQueryIntents").collect()).map((row) => row.clientName).sort()
    );
    expect(names).toEqual(["Kept Pending", "Old Converted", "Old Dismissed"]);
  });

  test("the dry run walks both status ranges without deleting", async () => {
    const t = harness();
    await seedIntents(t);
    const totals: Record<string, number> = {};
    let cursor: string | null = null;
    let pages = 0;
    do {
      const report: { continueCursor: string | null; counts: Record<string, number> } =
        await t.query(internal.crm.retention.enquiries.dryRun, {
          asOf: NOW,
          cursor,
          secret: SECRET,
        });
      for (const [outcome, count] of Object.entries(report.counts)) {
        totals[outcome] = (totals[outcome] ?? 0) + count;
      }
      cursor = report.continueCursor;
      pages += 1;
    } while (cursor !== null && pages < 10);
    expect(totals).toEqual({ deleted: 2 });
    expect(
      await t.run(async (ctx) => (await ctx.db.query("inboundQueryIntents").collect()).length)
    ).toBe(4);
  });
});

const SYNTHETIC_TRAVELLER = {
  callingStatus: "Pending",
  createdBy: "synthetic-ops",
  foodPreference: "Veg",
  guestType: "Employee",
  paymentType: "Company Paid",
  roomType: "Twin",
  ticketStatus: "Pending Issue",
  visaRequired: false,
  visaStatus: "Not Required",
} as const;

async function insertJobCard(
  t: Harness,
  jobCode: string,
  dates: { travelEndDate?: string; travelStartDate?: string }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("jobCards", {
      clientName: `Synthetic client ${jobCode}`,
      confirmedPax: 2,
      createdAt: istMidnight("2020-01-01"),
      createdBy: "synthetic-accounts",
      jobCode,
      status: "Closed",
      updatedAt: istMidnight("2020-01-01"),
      ...dates,
    })
  );
}

describe("feedback retention (3 years)", () => {
  async function seedFeedback(t: Harness) {
    const jobCardId = await insertJobCard(t, "JC-FEEDBACK", {
      travelEndDate: "2023-05-05",
      travelStartDate: "2023-05-01",
    });
    return await t.run(async (ctx) => {
      const requestId = await ctx.db.insert("travelerFeedbackRequests", {
        createdAt: istMidnight("2023-05-06"),
        createdBy: "synthetic-ops",
        expiresAt: istMidnight("2023-06-06"),
        jobCardId,
        publicTripLabel: "Synthetic trip",
        responseCount: 2,
        tokenHash: "synthetic-token-hash",
      });
      const response = async (createdAt: number, respondentName: string) => {
        const responseId = await ctx.db.insert("travelerFeedbackResponses", {
          comments: {
            food: "Synthetic food comment",
            hotel: "",
            improvements: "",
            itinerary: "",
            overall: "Synthetic overall comment",
            whatWentWell: "",
          },
          createdAt,
          jobCardId,
          payloadHash: `payload-${respondentName}`,
          photoCount: 1,
          requestId,
          respondentEmail: `${respondentName.toLowerCase()}@feedback.test`,
          respondentName,
          responseTokenHash: `response-${respondentName}`,
        });
        const storageId = await ctx.storage.store(new Blob(["synthetic-photo"]));
        const thumbnailStorageId = await ctx.storage.store(new Blob(["synthetic-thumb"]));
        await ctx.db.insert("travelerFeedbackPhotos", {
          category: "hotel",
          createdAt,
          fileName: "photo.jpg",
          fileSize: 15,
          jobCardId,
          mimeType: "image/jpeg",
          requestId,
          responseId,
          storageId,
          thumbnailStorageId,
        });
        return { responseId, storageId, thumbnailStorageId };
      };
      // 7 Nov 2026 minus 3 years is 7 Nov 2023: that office date is still kept.
      return {
        kept: await response(istMidnight("2023-11-07"), "Kept"),
        old: await response(istMidnight("2023-11-07") - 1, "Old"),
        requestId,
      };
    });
  }

  test("deletes feedback older than 3 years with its photos; keeps newer feedback", async () => {
    const t = harness();
    const f = await seedFeedback(t);
    const result = await t.mutation(internal.crm.retention.feedback.purgeExpired, {});
    expect(result).toEqual({
      counts: { deleted_traveller_feedback: 1 },
      scheduledContinuation: false,
    });
    // Files go once nothing references them, in their own transaction.
    await runScheduled(t);
    const state = await t.run(async (ctx) => ({
      keptFile: (await ctx.storage.get(f.kept.storageId)) !== null,
      oldFile: (await ctx.storage.get(f.old.storageId)) !== null,
      oldThumb: (await ctx.storage.get(f.old.thumbnailStorageId)) !== null,
      photos: (await ctx.db.query("travelerFeedbackPhotos").collect()).map((row) => row.responseId),
      request: await ctx.db.get("travelerFeedbackRequests", f.requestId),
      responses: (await ctx.db.query("travelerFeedbackResponses").collect()).map(
        (row) => row.respondentName
      ),
    }));
    expect(state.responses).toEqual(["Kept"]);
    expect(state.photos).toEqual([f.kept.responseId]);
    expect(state).toMatchObject({ keptFile: true, oldFile: false, oldThumb: false });
    // The request holds no personal data and stays with the Job Card.
    expect(state.request).not.toBeNull();
  });

  test("the dry run counts without deleting", async () => {
    const t = harness();
    await seedFeedback(t);
    expect(
      await t.query(internal.crm.retention.feedback.dryRun, {
        asOf: NOW,
        cursor: null,
        secret: SECRET,
      })
    ).toEqual({ continueCursor: null, counts: { deleted_traveller_feedback: 1 }, isDone: true });
    expect(
      await t.run(async (ctx) => (await ctx.db.query("travelerFeedbackPhotos").collect()).length)
    ).toBe(2);
  });
});

async function insertTraveller(
  t: Harness,
  jobCardId: Id<"jobCards">,
  fullName: string,
  extra: Partial<Doc<"travellers">> = {}
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("travellers", {
      ...SYNTHETIC_TRAVELLER,
      contactNo: "+910000000000",
      createdAt: istMidnight("2020-01-01"),
      email: `${fullName.toLowerCase().replaceAll(" ", ".")}@traveller.test`,
      fullName,
      jobCardId,
      updatedAt: istMidnight("2020-01-01"),
      ...extra,
    })
  );
}

async function insertBatch(
  t: Harness,
  jobCardId: Id<"jobCards">,
  batchCode: string,
  dates: { travelEndDate?: string; travelStartDate?: string }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("travelBatches", {
      batchCode,
      batchReference: `Synthetic / ${batchCode}`,
      confirmedPax: 1,
      createdAt: istMidnight("2020-01-01"),
      createdBy: "synthetic-ops",
      jobCardId,
      status: "Closed",
      updatedAt: istMidnight("2020-01-01"),
      ...dates,
    })
  );
}

async function withPassport(t: Harness, travellerId: Id<"travellers">) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["synthetic-encrypted-scan"]));
    await ctx.db.insert("passportDetails", {
      createdAt: istMidnight("2026-01-01"),
      createdBy: "synthetic-ops",
      encryptedPayload: "synthetic-encrypted-payload",
      expiryDate: "2031-01-01",
      fileName: "passport.pdf",
      lastFour: "0000",
      mimeType: "application/pdf",
      passportNumberHash: `hash-${String(travellerId)}`,
      status: "Received",
      storageId,
      travellerId,
      updatedAt: istMidnight("2026-01-01"),
    });
    await ctx.db.patch("travellers", travellerId, {
      hasPassportScan: true,
      passportExpiryDate: "2031-01-01",
      passportStatus: "Received",
    });
    return storageId;
  });
}

describe("passport scan retention (90 days after the trip)", () => {
  async function seedTrips(t: Harness) {
    // 7 Nov 2026 minus 90 days is 9 Aug 2026: a trip ending that day is still kept.
    const jobCardId = await insertJobCard(t, "JC-PASSPORT", {
      travelEndDate: "2026-07-20",
      travelStartDate: "2026-07-10",
    });
    const endedBatch = await insertBatch(t, jobCardId, "B01", {
      travelEndDate: "2026-08-08",
      travelStartDate: "2026-08-01",
    });
    const recentBatch = await insertBatch(t, jobCardId, "B02", {
      travelEndDate: "2026-08-09",
      travelStartDate: "2026-08-02",
    });
    // Without a start date the batch uses the Job Card's dates.
    const fallbackBatch = await insertBatch(t, jobCardId, "B03", { travelEndDate: "2026-11-30" });
    const undatedJob = await insertJobCard(t, "JC-UNDATED", {});
    const startOnlyJob = await insertJobCard(t, "JC-START-ONLY", { travelStartDate: "2026-08-08" });
    const ids = {
      ended: await insertTraveller(t, jobCardId, "Ended Batch", { travelBatchId: endedBatch }),
      fallback: await insertTraveller(t, jobCardId, "Fallback Batch", {
        travelBatchId: fallbackBatch,
      }),
      recent: await insertTraveller(t, jobCardId, "Recent Batch", { travelBatchId: recentBatch }),
      startOnly: await insertTraveller(t, startOnlyJob, "Start Only"),
      undated: await insertTraveller(t, undatedJob, "Undated Trip"),
    };
    const storage = {
      ended: await withPassport(t, ids.ended),
      fallback: await withPassport(t, ids.fallback),
      recent: await withPassport(t, ids.recent),
      startOnly: await withPassport(t, ids.startOnly),
      undated: await withPassport(t, ids.undated),
    };
    return { ids, storage };
  }

  test("deletes the scan and encrypted details; keeps the status word and the traveller", async () => {
    const t = harness();
    const f = await seedTrips(t);
    const result = await t.mutation(internal.crm.retention.passportScans.purgeExpired, {});
    expect(result).toEqual({
      counts: { deleted: 3, kept_trip_recent: 1, kept_undated: 1 },
      scheduledContinuation: false,
    });
    await runScheduled(t);
    const state = await t.run(async (ctx) => {
      const passports = await ctx.db.query("passportDetails").collect();
      const travellers = await ctx.db.query("travellers").collect();
      const files = Object.fromEntries(
        await Promise.all(
          Object.entries(f.storage).map(
            async ([key, id]) => [key, (await ctx.storage.get(id)) !== null] as const
          )
        )
      );
      return { files, passports, travellers };
    });
    expect(state.passports.map((row) => row.travellerId).sort()).toEqual(
      [f.ids.recent, f.ids.undated].sort()
    );
    expect(state.files).toEqual({
      ended: false,
      fallback: false,
      recent: true,
      startOnly: false,
      undated: true,
    });
    const ended = state.travellers.find((row) => row._id === f.ids.ended);
    expect(ended).toMatchObject({ fullName: "Ended Batch", passportStatus: "Received" });
    expect(ended?.hasPassportScan).toBe(false);
    expect(ended?.passportExpiryDate).toBeUndefined();
    const recent = state.travellers.find((row) => row._id === f.ids.recent);
    expect(recent).toMatchObject({ hasPassportScan: true, passportExpiryDate: "2031-01-01" });
  });

  test("the dry run counts without deleting", async () => {
    const t = harness();
    await seedTrips(t);
    expect(
      await t.query(internal.crm.retention.passportScans.dryRun, {
        asOf: NOW,
        cursor: null,
        secret: SECRET,
      })
    ).toEqual({
      continueCursor: null,
      counts: { deleted: 3, kept_trip_recent: 1, kept_undated: 1 },
      isDone: true,
    });
    expect(
      await t.run(async (ctx) => (await ctx.db.query("passportDetails").collect()).length)
    ).toBe(5);
  });
});

describe("traveller retention (anonymise 3 years after the trip)", () => {
  async function seedTravellers(t: Harness) {
    // 7 Nov 2026 minus 3 years is 7 Nov 2023: a trip ending that day is still kept.
    const endedJob = await insertJobCard(t, "JC-ENDED", {
      travelEndDate: "2023-11-06",
      travelStartDate: "2023-11-01",
    });
    const recentJob = await insertJobCard(t, "JC-RECENT", {
      travelEndDate: "2023-11-07",
      travelStartDate: "2023-11-01",
    });
    const undatedJob = await insertJobCard(t, "JC-NO-DATES", {});
    const guardian = await insertTraveller(t, endedJob, "Synthetic Guardian", {
      gender: "F",
      givenName: "Synthetic",
      hotelAllocation: "Synthetic Hotel",
      specialRequests: "Synthetic request",
      surname: "Guardian",
    });
    const minor = await insertTraveller(t, endedJob, "Synthetic Minor", {
      firstGuardianTravellerId: guardian,
      guardianImportReferences: [{ name: "Synthetic Parent" }],
      isMinor: true,
    });
    const recent = await insertTraveller(t, recentJob, "Synthetic Recent");
    // Same Job Card, a later Travel Batch: kept, and keeps its link to the guardian.
    const laterBatch = await insertBatch(t, endedJob, "B-LATER", {
      travelEndDate: "2026-01-10",
      travelStartDate: "2026-01-01",
    });
    const laterMinor = await insertTraveller(t, endedJob, "Synthetic Later Minor", {
      firstGuardianTravellerId: guardian,
      isMinor: true,
      travelBatchId: laterBatch,
    });
    const undated = await insertTraveller(t, undatedJob, "Synthetic Undated");
    const scan = await withPassport(t, guardian);
    const ids = await t.run(async (ctx) => {
      const ticketId = await ctx.db.insert("tickets", {
        createdAt: NOW,
        createdBy: "synthetic-ticketing",
        jobCardId: endedJob,
        paymentType: "Company Paid",
        ticketNumber: "000-0000000000",
        ticketStatus: "Issued",
        travellerId: guardian,
        updatedAt: NOW,
      });
      await ctx.db.insert("mealPreferences", {
        createdAt: NOW,
        foodPreference: "Veg",
        notes: "Synthetic allergy note",
        travellerId: guardian,
        updatedAt: NOW,
      });
      const roomingId = await ctx.db.insert("roomingListEntries", {
        createdAt: NOW,
        createdBy: "synthetic-ops",
        jobCardId: endedJob,
        notes: "Synthetic rooming note",
        roomType: "Twin",
        sharingWith: "Synthetic Minor",
        travellerId: guardian,
        updatedAt: NOW,
      });
      const visaId = await ctx.db.insert("visaRecords", {
        createdAt: NOW,
        jobCardId: endedJob,
        notes: "Synthetic visa note",
        status: "Approved",
        travellerId: guardian,
        updatedAt: NOW,
        updatedBy: "synthetic-visa",
      });
      const invoiceId = await ctx.db.insert("invoices", {
        balanceAmount: 0,
        createdAt: NOW,
        createdBy: "synthetic-accounts",
        expectedAmount: 1000,
        invoiceNumber: "INV-SYNTHETIC-1",
        jobCardId: endedJob,
        receivedAmount: 1000,
        status: "Paid",
        updatedAt: NOW,
      });
      await ctx.db.insert("notifications", {
        body: "Synthetic Guardian updated",
        createdAt: NOW,
        entityId: String(guardian),
        entityType: "traveller",
        recipientRole: "Operations",
        title: "Traveller updated",
      });
      return { invoiceId, roomingId, ticketId, visaId };
    });
    return { endedJob, guardian, ids, laterMinor, minor, recent, scan, undated };
  }

  test("strips personal fields but keeps the row, the counts and the financial links", async () => {
    const t = harness();
    const f = await seedTravellers(t);
    const result = await t.mutation(internal.crm.retention.travellers.purgeExpired, {});
    expect(result).toEqual({
      counts: { anonymised: 2, kept_trip_recent: 2, kept_undated: 1 },
      scheduledContinuation: false,
    });
    await runScheduled(t);
    const state = await t.run(async (ctx) => ({
      guardian: await ctx.db.get("travellers", f.guardian),
      invoice: await ctx.db.get("invoices", f.ids.invoiceId),
      job: await ctx.db.get("jobCards", f.endedJob),
      laterMinor: await ctx.db.get("travellers", f.laterMinor),
      meals: await ctx.db.query("mealPreferences").collect(),
      minor: await ctx.db.get("travellers", f.minor),
      notifications: await ctx.db.query("notifications").collect(),
      passports: await ctx.db.query("passportDetails").collect(),
      recent: await ctx.db.get("travellers", f.recent),
      rooming: await ctx.db.get("roomingListEntries", f.ids.roomingId),
      scan: (await ctx.storage.get(f.scan)) !== null,
      ticket: await ctx.db.get("tickets", f.ids.ticketId),
      visa: await ctx.db.get("visaRecords", f.ids.visaId),
    }));
    expect(state.guardian).toMatchObject({
      foodPreference: "Veg",
      fullName: "Anonymised traveller",
      jobCardId: f.endedJob,
      passportStatus: "Received",
      paymentType: "Company Paid",
      roomType: "Twin",
    });
    for (const field of [
      "contactNo",
      "email",
      "gender",
      "givenName",
      "hotelAllocation",
      "passportExpiryDate",
      "specialRequests",
      "surname",
    ] as const) {
      expect(state.guardian?.[field]).toBeUndefined();
    }
    expect(state.guardian?.listSearchText).not.toContain("synthetic guardian");
    expect(state.guardian?.retentionAnonymisedAt).toBe(NOW);
    expect(state.minor).toMatchObject({ fullName: "Anonymised traveller" });
    expect(state.minor?.firstGuardianTravellerId).toBeUndefined();
    expect(state.minor?.guardianImportReferences).toBeUndefined();
    expect(state.minor?.isMinor).toBeUndefined();
    expect(state.recent).toMatchObject({ fullName: "Synthetic Recent" });
    expect(state.laterMinor).toMatchObject({
      firstGuardianTravellerId: f.guardian,
      fullName: "Synthetic Later Minor",
    });
    expect(state.passports).toEqual([]);
    expect(state.scan).toBe(false);
    expect(state.meals).toEqual([]);
    expect(state.rooming).toMatchObject({ roomType: "Twin", travellerId: f.guardian });
    expect(state.rooming?.sharingWith).toBeUndefined();
    expect(state.rooming?.notes).toBeUndefined();
    expect(state.visa).toMatchObject({ status: "Approved" });
    expect(state.visa?.notes).toBeUndefined();
    expect(state.ticket).toMatchObject({ ticketNumber: "000-0000000000", travellerId: f.guardian });
    expect(state.invoice).toMatchObject({ jobCardId: f.endedJob, receivedAmount: 1000 });
    expect(state.job).toMatchObject({ confirmedPax: 2 });
    expect(state.notifications).toEqual([]);

    const second = await t.mutation(internal.crm.retention.travellers.purgeExpired, {});
    expect(second.counts).toEqual({ already_anonymised: 2, kept_trip_recent: 2, kept_undated: 1 });
  });

  test("the dry run counts without changing a traveller", async () => {
    const t = harness();
    const f = await seedTravellers(t);
    expect(
      await t.query(internal.crm.retention.travellers.dryRun, {
        asOf: NOW,
        cursor: null,
        secret: SECRET,
      })
    ).toEqual({
      continueCursor: null,
      counts: { anonymised: 2, kept_trip_recent: 2, kept_undated: 1 },
      isDone: true,
    });
    expect(await t.run((ctx) => ctx.db.get("travellers", f.guardian))).toMatchObject({
      fullName: "Synthetic Guardian",
    });
  });
});

describe("booking and invoice retention (8 years)", () => {
  async function seedFinance(t: Harness) {
    // 7 Nov 2026 minus 8 years is 7 Nov 2018: records from that day on are kept.
    const oldJob = await insertJobCard(t, "JC-2018", {
      travelEndDate: "2018-01-20",
      travelStartDate: "2018-01-10",
    });
    const laterTripJob = await insertJobCard(t, "JC-2018-LATE", {
      travelEndDate: "2019-02-01",
      travelStartDate: "2019-01-20",
    });
    const undatedJob = await insertJobCard(t, "JC-UNDATED-INVOICE", {});
    const goneJob = await insertJobCard(t, "JC-GONE", {
      travelEndDate: "2017-01-10",
      travelStartDate: "2017-01-01",
    });
    return await t.run(async (ctx) => {
      const trip = (slug: string, startDate: string, endDate: string) =>
        ctx.db.insert("trips", {
          availableSeats: 10,
          createdAt: istMidnight("2017-01-01"),
          endDate,
          isActive: false,
          name: `Synthetic ${slug}`,
          priceInr: 1000,
          priceUsd: 12,
          slug,
          startDate,
          totalSeats: 10,
          updatedAt: istMidnight("2017-01-01"),
        });
      const oldTrip = await trip("old-trip", "2018-02-01", "2018-02-05");
      const lateTrip = await trip("late-trip", "2018-12-01", "2018-12-05");
      const goneTrip = await trip("gone-trip", "2017-02-01", "2017-02-05");
      const booking = async (createdAt: number, tripId: Id<"trips">, userId: string) => {
        const id = await ctx.db.insert("bookings", {
          createdAt,
          currency: "INR",
          notes: "Synthetic booking note",
          razorpayOrderId: `order_${userId}`,
          razorpayPaymentId: `pay_${userId}`,
          razorpaySignature: "synthetic-signature",
          status: "confirmed",
          totalAmount: 2000,
          travelerDetails: [{ name: "Synthetic Booker" }],
          travelers: 2,
          tripId,
          updatedAt: createdAt,
          userId,
        });
        await ctx.db.insert("customerJourneyEntitlements", {
          authUserId: userId,
          bookingId: id,
          capabilities: ["view_booking"],
          createdAt,
          role: "purchaser",
          source: "public_booking_owner",
          updatedAt: createdAt,
        });
        await ctx.db.insert("bookingPaymentEvents", {
          bookingId: id,
          createdAt,
          outcome: "applied",
          providerEventId: `event_${userId}`,
          reason: "captured",
          statusAfter: "confirmed",
          statusBefore: "pending",
          transition: "confirmed",
        });
        return id;
      };
      const invoice = (jobCardId: Id<"jobCards">, invoiceNumber: string, createdAt: number) =>
        ctx.db.insert("invoices", {
          balanceAmount: 0,
          createdAt,
          createdBy: "synthetic-accounts",
          expectedAmount: 1000,
          invoiceNumber,
          jobCardId,
          receivedAmount: 1000,
          status: "Paid",
          updatedAt: createdAt,
        });
      const goneBooking = await booking(istMidnight("2017-01-05"), goneTrip, "synthetic-user-gone");
      const goneInvoice = await invoice(goneJob, "INV-GONE", istMidnight("2017-01-05"));
      // A trip or Job Card that no longer exists has unknown dates: its records stay.
      await ctx.db.delete("trips", goneTrip);
      await ctx.db.delete("jobCards", goneJob);
      return {
        bookings: {
          gone: goneBooking,
          late: await booking(istMidnight("2018-06-01"), lateTrip, "synthetic-user-late"),
          old: await booking(istMidnight("2018-01-05"), oldTrip, "synthetic-user-old"),
          recent: await booking(istMidnight("2018-11-07"), oldTrip, "synthetic-user-recent"),
        },
        invoices: {
          gone: goneInvoice,
          lateTrip: await invoice(laterTripJob, "INV-LATE-TRIP", istMidnight("2018-01-05")),
          old: await invoice(oldJob, "INV-OLD", istMidnight("2018-01-05")),
          recent: await invoice(oldJob, "INV-RECENT", istMidnight("2018-11-07")),
          undated: await invoice(undatedJob, "INV-UNDATED", istMidnight("2018-01-05")),
        },
      };
    });
  }

  async function runAll(t: Harness) {
    await setJobControl(t, "jobs.retire_financial_records", "enabled");
    const first = await t.mutation(internal.crm.retention.financialRecords.purgeExpired, {});
    await runScheduled(t);
    return first;
  }

  test("anonymises old bookings, deletes old invoices, keeps amounts and anything newer", async () => {
    const t = harness();
    const f = await seedFinance(t);
    await runAll(t);
    const state = await t.run(async (ctx) => ({
      entitlements: (await ctx.db.query("customerJourneyEntitlements").collect()).map(
        (row) => row.authUserId
      ),
      gone: await ctx.db.get("bookings", f.bookings.gone),
      invoices: (await ctx.db.query("invoices").collect()).map((row) => row.invoiceNumber),
      late: await ctx.db.get("bookings", f.bookings.late),
      old: await ctx.db.get("bookings", f.bookings.old),
      paymentEvents: (await ctx.db.query("bookingPaymentEvents").collect()).length,
      recent: await ctx.db.get("bookings", f.bookings.recent),
    }));
    expect(state.old).toMatchObject({
      razorpayPaymentId: "pay_synthetic-user-old",
      status: "confirmed",
      totalAmount: 2000,
      travelers: 2,
      userId: "retention:anonymised",
    });
    expect(state.old?.travelerDetails).toBeUndefined();
    expect(state.old?.notes).toBeUndefined();
    expect(state.old?.razorpaySignature).toBeUndefined();
    expect(state.old?.retentionAnonymisedAt).toBe(NOW);
    // The trip ended after the cutoff, and the booking was made on the first kept day.
    expect(state.late).toMatchObject({ userId: "synthetic-user-late" });
    expect(state.recent).toMatchObject({ userId: "synthetic-user-recent" });
    expect(state.gone).toMatchObject({ userId: "synthetic-user-gone" });
    expect(state.entitlements.sort()).toEqual([
      "synthetic-user-gone",
      "synthetic-user-late",
      "synthetic-user-recent",
    ]);
    expect(state.paymentEvents).toBe(4);
    expect(state.invoices.sort()).toEqual([
      "INV-GONE",
      "INV-LATE-TRIP",
      "INV-RECENT",
      "INV-UNDATED",
    ]);
  });

  test("the dry run reports both record kinds without writing", async () => {
    const t = harness();
    await seedFinance(t);
    const totals: Record<string, number> = {};
    let cursor: string | null = null;
    let pages = 0;
    do {
      const report: { continueCursor: string | null; counts: Record<string, number> } =
        await t.query(internal.crm.retention.financialRecords.dryRun, {
          asOf: NOW,
          cursor,
          secret: SECRET,
        });
      for (const [outcome, count] of Object.entries(report.counts)) {
        totals[outcome] = (totals[outcome] ?? 0) + count;
      }
      cursor = report.continueCursor;
      pages += 1;
    } while (cursor !== null && pages < 10);
    expect(totals).toEqual({
      anonymised_booking: 1,
      deleted_invoice: 1,
      kept_booking_no_trip: 1,
      kept_booking_recent: 2,
      kept_invoice_no_job_card: 1,
      kept_invoice_trip_recent: 1,
      kept_invoice_undated: 1,
    });
    expect(await t.run(async (ctx) => (await ctx.db.query("invoices").collect()).length)).toBe(5);
  });
});

describe("inactive customer account retention (3 years)", () => {
  const ISSUER = "https://auth.citius.test";
  // 7 Nov 2026 minus 3 years is 7 Nov 2023.
  const OLD = istMidnight("2022-03-01");
  const STILL_OLD = istMidnight("2023-11-07") - 1;
  const RECENT = istMidnight("2026-10-01");

  function accountHarness() {
    const t = harness();
    t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
    return t;
  }

  async function seedAccount(
    t: Harness,
    key: string,
    options: {
      booking?: number;
      profileUpdatedAt?: number;
      sacredBharat?: boolean;
      sessionUpdatedAt?: number;
      staff?: boolean;
    } = {}
  ) {
    const email = `${key}@customer.test`;
    const user = await t.mutation(components.betterAuth.adapter.create, {
      input: {
        data: { createdAt: OLD, email, emailVerified: true, name: key, updatedAt: OLD },
        model: "user",
      },
    });
    const subject = String(user._id);
    const canonical = `${ISSUER}|${subject}`;
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        data: {
          accountId: subject,
          createdAt: OLD,
          password: "synthetic-hash",
          providerId: "credential",
          updatedAt: OLD,
          userId: subject,
        },
        model: "account",
      },
    });
    await t.mutation(components.betterAuth.adapter.create, {
      input: {
        data: {
          createdAt: OLD,
          expiresAt: (options.sessionUpdatedAt ?? STILL_OLD) + 30 * DAY,
          token: `token-${key}`,
          updatedAt: options.sessionUpdatedAt ?? STILL_OLD,
          userId: subject,
        },
        model: "session",
      },
    });
    // Profiles are scanned by creation time, so they are written "back then".
    vi.setSystemTime(OLD);
    const ids = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("userProfiles", {
        authUserId: canonical,
        createdAt: OLD,
        email,
        emailNormalized: email,
        name: `Synthetic ${key}`,
        phoneNumber: "+910000000000",
        updatedAt: options.profileUpdatedAt ?? OLD,
      });
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: canonical,
        createdAt: OLD,
        legacyAuthUserId: subject,
        status: "linked",
        updatedAt: OLD,
      });
      const tripId = await ctx.db.insert("trips", {
        availableSeats: 1,
        createdAt: OLD,
        endDate: "2022-04-05",
        isActive: false,
        name: `Synthetic trip ${key}`,
        priceInr: 1000,
        priceUsd: 12,
        slug: `trip-${key}`,
        startDate: "2022-04-01",
        totalSeats: 1,
        updatedAt: OLD,
      });
      const bookingAt = options.booking ?? OLD;
      const bookingId = await ctx.db.insert("bookings", {
        createdAt: bookingAt,
        currency: "INR",
        razorpayOrderId: `order_${key}`,
        razorpayPaymentId: `pay_${key}`,
        status: "confirmed",
        totalAmount: 1000,
        travelerDetails: [{ name: `Synthetic ${key}` }],
        travelers: 1,
        tripId,
        updatedAt: bookingAt,
        userId: canonical,
      });
      await ctx.db.insert("customerJourneyEntitlements", {
        accountHolderProfileId: profileId,
        authUserId: canonical,
        bookingId,
        capabilities: ["view_booking"],
        createdAt: bookingAt,
        role: "purchaser",
        source: "public_booking_owner",
        updatedAt: bookingAt,
      });
      if (options.staff) {
        await ctx.db.insert("staffUsers", {
          active: true,
          authUserId: canonical,
          createdAt: OLD,
          email,
          emailNormalized: email,
          name: `Synthetic staff ${key}`,
          roles: ["Sales"],
          updatedAt: OLD,
        });
      }
      if (options.sacredBharat) {
        await ctx.db.insert("sacredBharatProfiles", {
          authUserId: canonical,
          createdAt: OLD,
          displayName: `Yatri ${key}`,
          isPublic: false,
          shareRecentVisits: false,
          shareWishlist: false,
          slug: `yatri-${key}`,
          updatedAt: OLD,
        });
      }
      return { bookingId, profileId };
    });
    vi.setSystemTime(NOW);
    return { ...ids, canonical, subject };
  }

  async function authRows(t: Harness, subject: string) {
    return await t.run(async (ctx) => {
      const many = async (model: "account" | "session") => {
        const result = await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model,
          paginationOpts: { cursor: null, numItems: 10 },
          where: [{ field: "userId", value: subject }],
        });
        return result.page.length;
      };
      const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: subject }],
      });
      return {
        accounts: await many("account"),
        sessions: await many("session"),
        user: user !== null,
      };
    });
  }

  async function seedAll(t: Harness) {
    return {
      inactive: await seedAccount(t, "inactive"),
      recentBooking: await seedAccount(t, "recent-booking", { booking: RECENT }),
      recentProfile: await seedAccount(t, "recent-profile", { profileUpdatedAt: RECENT }),
      recentSession: await seedAccount(t, "recent-session", { sessionUpdatedAt: RECENT }),
      sacredBharat: await seedAccount(t, "yatri", { sacredBharat: true }),
      staff: await seedAccount(t, "staff", { staff: true }),
    };
  }

  test("deletes an account idle for 3 years; keeps active, staff and Sacred Bharat accounts", async () => {
    const t = accountHarness();
    const f = await seedAll(t);
    const result = await t.mutation(internal.crm.retention.customerAccounts.purgeExpired, {});
    expect(result).toEqual({
      counts: {
        deleted_account: 1,
        kept_active: 3,
        kept_sacred_bharat: 1,
        kept_staff: 1,
      },
      scheduledContinuation: false,
    });
    const state = await t.run(async (ctx) => ({
      booking: await ctx.db.get("bookings", f.inactive.bookingId),
      entitlements: (await ctx.db.query("customerJourneyEntitlements").collect()).map(
        (row) => row.authUserId
      ),
      links: (await ctx.db.query("authIdentityLinks").collect()).map(
        (row) => row.canonicalAuthUserId
      ),
      profiles: (await ctx.db.query("userProfiles").collect()).map((row) => row.authUserId),
    }));
    expect(state.profiles).not.toContain(f.inactive.canonical);
    expect(state.profiles).toHaveLength(5);
    expect(state.entitlements).not.toContain(f.inactive.canonical);
    expect(state.links).not.toContain(f.inactive.canonical);
    // The booking stays for the 8-year tax rule; only its link to the account goes.
    expect(state.booking).toMatchObject({
      razorpayPaymentId: "pay_inactive",
      totalAmount: 1000,
      travelerDetails: [{ name: "Synthetic inactive" }],
      userId: "retention:deleted-account",
    });
    expect(await authRows(t, f.inactive.subject)).toEqual({
      accounts: 0,
      sessions: 0,
      user: false,
    });
    for (const kept of [f.recentSession, f.staff, f.sacredBharat]) {
      expect(await authRows(t, kept.subject)).toEqual({ accounts: 1, sessions: 1, user: true });
    }
  });

  test("leaves an account with too many bookings to review for a person", async () => {
    const t = accountHarness();
    const f = await seedAccount(t, "many-bookings");
    await t.run(async (ctx) => {
      const booking = await ctx.db.get("bookings", f.bookingId);
      if (!booking) {
        throw new Error("seeded booking missing");
      }
      const { _creationTime, _id, ...copy } = booking;
      for (let index = 0; index < 50; index += 1) {
        await ctx.db.insert("bookings", { ...copy, razorpayOrderId: `order_many_${index}` });
      }
    });
    expect(
      (await t.mutation(internal.crm.retention.customerAccounts.purgeExpired, {})).counts
    ).toEqual({ kept_too_many_links: 1 });
    expect(await authRows(t, f.subject)).toEqual({ accounts: 1, sessions: 1, user: true });
  });

  test("the dry run counts without deleting", async () => {
    const t = accountHarness();
    const f = await seedAll(t);
    expect(
      await t.query(internal.crm.retention.customerAccounts.dryRun, {
        asOf: NOW,
        cursor: null,
        secret: SECRET,
      })
    ).toEqual({
      continueCursor: null,
      counts: { deleted_account: 1, kept_active: 3, kept_sacred_bharat: 1, kept_staff: 1 },
      isDone: true,
    });
    expect(await authRows(t, f.inactive.subject)).toEqual({
      accounts: 1,
      sessions: 1,
      user: true,
    });
  });
});

describe("dry-run summary", () => {
  test("sums a rule's report pages within the page budget, behind the secret", async () => {
    const t = harness();
    await t.run(async (ctx) => {
      for (const [status, createdAt] of [
        ["pending", istMidnight("2023-01-01")],
        ["dismissed", istMidnight("2023-01-02")],
      ] as const) {
        await ctx.db.insert("inboundQueryIntents", {
          clientName: `Synthetic ${status}`,
          consentAt: createdAt,
          createdAt,
          source: "Website",
          status,
        });
      }
    });
    await expect(
      t.action(internal.crm.retention.reports.summarize, {
        job: "purge_unconverted_enquiries",
        secret: "wrong",
      })
    ).rejects.toThrow("Invalid migration secret");
    const partial = await t.action(internal.crm.retention.reports.summarize, {
      asOf: NOW,
      job: "purge_unconverted_enquiries",
      maxPages: 1,
      secret: SECRET,
    });
    expect(partial).toMatchObject({ counts: { deleted: 1 }, isDone: false, pagesRead: 1 });
    const rest = await t.action(internal.crm.retention.reports.summarize, {
      asOf: NOW,
      cursor: partial.continueCursor,
      job: "purge_unconverted_enquiries",
      secret: SECRET,
    });
    expect(rest).toMatchObject({ continueCursor: null, counts: { deleted: 1 }, isDone: true });
    const whole = await t.action(internal.crm.retention.reports.summarize, {
      asOf: NOW,
      job: "purge_unconverted_enquiries",
      secret: SECRET,
    });
    expect(whole).toEqual({
      asOf: NOW,
      continueCursor: null,
      counts: { deleted: 2 },
      isDone: true,
      pagesRead: 2,
    });
  });
});
