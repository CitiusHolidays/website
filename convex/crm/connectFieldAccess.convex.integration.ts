import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { syncJobCardTourManagerVisibility } from "./jobCardVisibility";

const NOW = Date.parse("2026-11-06T06:00:00Z");
const ISSUER = "https://connect-field.test";

const byText = (left: string, right: string) => left.localeCompare(right);

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

const identities = {
  "ops-head": { name: "Synthetic Ops Head", roles: ["Operations Head"] },
  "tm-batch": { name: "Asha Rao", roles: ["Tour Manager"] },
  "tm-ops": { name: "Kiran Das", roles: ["Tour Manager", "Operations"] },
  "tm-outsider": { name: "Meera Iyer", roles: ["Tour Manager"] },
  "tm-whole": { name: "Vikram Singh", roles: ["Tour Manager"] },
} as const;
type StaffKey = keyof typeof identities;
const STAFF_KEYS = [
  "ops-head",
  "tm-batch",
  "tm-ops",
  "tm-outsider",
  "tm-whole",
] as const satisfies readonly StaffKey[];

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

async function seed(t: ReturnType<typeof harness>) {
  const staffIdRecord = await t.run(async (ctx) => {
    const ids = new Map<StaffKey, Id<"staffUsers">>();
    for (const key of STAFF_KEYS) {
      const identity = identities[key];
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${ISSUER}|${key}`,
        createdAt: NOW,
        legacyAuthUserId: key,
        status: "linked",
        updatedAt: NOW,
      });
      ids.set(
        key,
        await ctx.db.insert("staffUsers", {
          active: true,
          authUserId: key,
          createdAt: NOW,
          email: `${key}@connect-field.test`,
          emailNormalized: `${key}@connect-field.test`,
          name: identity.name,
          roles: [...identity.roles],
          updatedAt: NOW,
        })
      );
    }
    return Object.fromEntries(ids);
  });
  const staffIds = new Map(Object.entries(staffIdRecord));
  const ids = await t.run(async (ctx) => {
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic incentive group",
      confirmedPax: 4,
      createdAt: NOW,
      createdBy: "accounts-owner",
      destination: "Bali",
      jobCode: "JC-CONNECT-01",
      queryType: "MICE",
      status: "Ready for Departure",
      travelEndDate: "2026-11-15",
      travelStartDate: "2026-11-10",
      updatedAt: NOW,
    });
    const otherJobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic second group",
      confirmedPax: 1,
      createdAt: NOW + 1,
      createdBy: "accounts-owner",
      jobCode: "JC-CONNECT-02",
      queryType: "MICE",
      status: "Open",
      updatedAt: NOW + 1,
    });
    const batch = (code: string, travelStartDate: string, travelEndDate: string) =>
      ctx.db.insert("travelBatches", {
        batchCode: code,
        batchReference: `JC-CONNECT-01 / ${code}`,
        confirmedPax: 2,
        createdAt: NOW,
        createdBy: "synthetic-ops",
        jobCardId,
        status: "Open",
        travelEndDate,
        travelStartDate,
        updatedAt: NOW,
      });
    const batchA = await batch("B01", "2026-11-10", "2026-11-12");
    const batchB = await batch("B02", "2026-11-13", "2026-11-15");
    const traveller = (
      fullName: string,
      travelBatchId?: Id<"travelBatches">,
      extra: { cancellation?: boolean } = {}
    ) =>
      ctx.db.insert("travellers", {
        ...SYNTHETIC_TRAVELLER,
        ...extra,
        contactNo: "+910000000000",
        createdAt: NOW,
        fullName,
        jobCardId,
        travelBatchId,
        updatedAt: NOW,
      });
    return {
      a1: await traveller("Synthetic A One", batchA),
      a2: await traveller("Synthetic A Two", batchA, { cancellation: true }),
      a3: await traveller("Synthetic A Three", batchA),
      b1: await traveller("Synthetic B One", batchB),
      batchA,
      batchB,
      jobCardId,
      otherJobCardId,
      u1: await traveller("Synthetic Unbatched"),
    };
  });
  const actor = (key: StaffKey) =>
    t.withIdentity({
      email: `${key}@connect-field.test`,
      issuer: ISSUER,
      subject: key,
      tokenIdentifier: `${ISSUER}|${key}`,
    });
  const opsHead = actor("ops-head");
  const assign = (
    key: StaffKey,
    travelBatchId?: Id<"travelBatches">,
    jobCardId: Id<"jobCards"> = ids.jobCardId
  ) =>
    opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId,
      name: "ignored for staff assignments",
      staffId: staffIds.get(key),
      travelBatchId,
    });
  const travellerNames = async (key: StaffKey) => {
    const page = await actor(key).query(api.crm.travellers.listPage, {
      jobCardId: ids.jobCardId,
      paginationOpts: { cursor: null, numItems: 50 },
    });
    return page.page.map((row) => row.fullName).sort(byText);
  };
  return { actor, assign, ids, opsHead, staffIds, travellerNames };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("group-scoped travellers for tour managers", () => {
  test("a batch Tour Manager sees only their batch; a Job Card Tour Manager sees everyone", async () => {
    const f = await seed(harness());
    await f.assign("tm-batch", f.ids.batchA);
    await f.assign("tm-whole");
    await f.assign("tm-ops", f.ids.batchB);

    expect(await f.travellerNames("tm-batch")).toEqual([
      "Synthetic A One",
      "Synthetic A Three",
      "Synthetic A Two",
    ]);
    expect(await f.travellerNames("tm-whole")).toHaveLength(5);
    expect(await f.travellerNames("ops-head")).toHaveLength(5);
    // An Operations role does not widen a Job Card reached only through a TM assignment.
    expect(await f.travellerNames("tm-ops")).toEqual(["Synthetic B One"]);
    expect(await f.travellerNames("tm-outsider")).toEqual([]);

    const tmBatch = f.actor("tm-batch");
    expect(
      await tmBatch.query(api.crm.travellers.getListRow, { travellerId: f.ids.b1 })
    ).toBeNull();
    expect(
      (await tmBatch.query(api.crm.travellers.getListRow, { travellerId: f.ids.a1 }))?.contactNo
    ).toBe("+910000000000");
  });

  test("two batch assignments on one Job Card see both batches", async () => {
    const f = await seed(harness());
    await f.assign("tm-batch", f.ids.batchA);
    await f.assign("tm-batch", f.ids.batchB);
    expect(await f.travellerNames("tm-batch")).toHaveLength(4);
  });

  test("an external profile assignment grants no staff access, even with a matching name", async () => {
    const t = harness();
    const f = await seed(t);
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("externalTourManagerProfiles", {
        active: true,
        createdAt: NOW,
        createdBy: "ops-head",
        destinations: ["Bali"],
        email: "external@connect-field.test",
        emailNormalized: "external@connect-field.test",
        experienceSummary: "",
        experienceYears: null,
        name: "Meera Iyer",
        phone: "",
        phoneNormalized: "",
        reportedPastTours: null,
        reportedPastToursNote: "",
        reportedPastToursSource: "staff_recorded",
        updatedAt: NOW,
        updatedBy: "ops-head",
      });
      await ctx.db.insert("tourManagerAssignments", {
        callingStatus: "Pending",
        createdAt: NOW,
        createdBy: "ops-head",
        externalProfileId: profileId,
        jobCardId: f.ids.jobCardId,
        name: "Meera Iyer",
        status: "Assigned",
        travelBatchId: f.ids.batchA,
        updatedAt: NOW,
      });
      await syncJobCardTourManagerVisibility(ctx, f.ids.jobCardId);
    });
    expect(await f.travellerNames("tm-outsider")).toEqual([]);
  });
});

describe("passports in the Staff Workspace", () => {
  test("a Tour Manager no longer reads passports in the CRM; office roles still do", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-whole");
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["synthetic-encrypted"]));
      await ctx.db.insert("passportDetails", {
        createdAt: NOW,
        createdBy: "ops-head",
        encryptedPayload: "synthetic",
        fileName: "passport.pdf",
        mimeType: "application/pdf",
        status: "Received",
        storageId,
        travellerId: f.ids.a1,
        updatedAt: NOW,
      });
    });
    await expect(
      f.actor("tm-whole").query(api.crm.passport.getPassportMetadata, { travellerId: f.ids.a1 })
    ).rejects.toThrow("FORBIDDEN");
    const metadata = await f.opsHead.query(api.crm.passport.getPassportMetadata, {
      travellerId: f.ids.a1,
    });
    expect(metadata?.fileName).toBe("passport.pdf");
  });
});

describe("field passports", () => {
  async function withPassport(t: ReturnType<typeof harness>, travellerId: Id<"travellers">) {
    await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["synthetic-encrypted"]));
      await ctx.db.insert("passportDetails", {
        createdAt: NOW,
        createdBy: "ops-head",
        encryptedPayload: "synthetic",
        fileName: "a1-passport.pdf",
        mimeType: "application/pdf",
        status: "Received",
        storageId,
        travellerId,
        updatedAt: NOW,
      });
      await ctx.db.patch("travellers", travellerId, { hasPassportScan: true });
    });
  }

  test("own group, inside the trip window, writes one audit row per read", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-batch", f.ids.batchA);
    await withPassport(t, f.ids.a1);
    await withPassport(t, f.ids.b1);
    const tm = f.actor("tm-batch");

    // Batch A travels 10-12 Nov, so the window is 9 Nov 00:00 IST to 13 Nov 24:00 IST.
    vi.setSystemTime(Date.parse("2026-11-08T18:29:00Z"));
    await expect(
      tm.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
        travellerId: f.ids.a1,
      })
    ).rejects.toThrow("day before the trip starts");

    vi.setSystemTime(Date.parse("2026-11-08T18:31:00Z"));
    const grant = await tm.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
      travellerId: f.ids.a1,
    });
    expect(grant.fileName).toBe("a1-passport.pdf");

    await expect(
      tm.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
        travellerId: f.ids.b1,
      })
    ).rejects.toThrow("FORBIDDEN");

    vi.setSystemTime(Date.parse("2026-11-13T18:29:00Z"));
    await tm.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
      travellerId: f.ids.a1,
    });
    vi.setSystemTime(Date.parse("2026-11-13T18:31:00Z"));
    await expect(
      tm.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
        travellerId: f.ids.a1,
      })
    ).rejects.toThrow("day after it ends");

    const audit = await t.run((ctx) => ctx.db.query("fieldPassportAccessAudit").collect());
    expect(audit).toHaveLength(2);
    expect(audit.every((row) => row.actorStaffId === f.staffIds.get("tm-batch"))).toBe(true);
    expect(audit.every((row) => row.travellerId === f.ids.a1)).toBe(true);

    const office = await f.opsHead.query(api.crm.fieldPassports.listFieldPassportAccess, {
      jobCardId: f.ids.jobCardId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(office.page.map((row) => row.actorName)).toEqual(["Asha Rao", "Asha Rao"]);
    await expect(
      tm.query(api.crm.fieldPassports.listFieldPassportAccess, {
        jobCardId: f.ids.jobCardId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).rejects.toThrow("FORBIDDEN");

    const listing = await tm.query(api.crm.fieldPassports.listFieldPassports, {
      jobCardId: f.ids.jobCardId,
      referenceNow: Date.parse("2026-11-10T06:00:00Z"),
    });
    expect(listing.travellers.map((row) => [row.travellerId, row.available])).toEqual(
      expect.arrayContaining([
        [f.ids.a1, true],
        [f.ids.a3, false],
      ])
    );
    expect(listing.travellers.some((row) => row.travellerId === f.ids.b1)).toBe(false);
  });

  test("office roles use the Staff Workspace, not the field path", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(Date.parse("2026-11-10T06:00:00Z"));
    const t = harness();
    const f = await seed(t);
    await withPassport(t, f.ids.a1);
    await expect(
      f.opsHead.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
        travellerId: f.ids.a1,
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("a traveller with no scan is reported, not audited", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(Date.parse("2026-11-10T06:00:00Z"));
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-whole");
    await expect(
      f.actor("tm-whole").mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
        travellerId: f.ids.u1,
      })
    ).rejects.toThrow("Passport document not found");
    expect(await t.run((ctx) => ctx.db.query("fieldPassportAccessAudit").collect())).toEqual([]);
  });
});

describe("headcount sync", () => {
  test("pushes upsert by client id and the office reads the latest stop per recorder and day", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-batch", f.ids.batchA);
    await f.assign("tm-whole");
    const tm = f.actor("tm-batch");
    const push = (args: {
      clientStopId: string;
      clientUpdatedAt?: number;
      label: string;
      presentTravellerIds: string[];
      startedAt: number;
    }) =>
      tm.mutation(api.crm.fieldSync.pushHeadcountStop, {
        ...args,
        day: "2026-11-10",
        jobCardId: f.ids.jobCardId,
      });

    const first = await push({
      clientStopId: "stop-1",
      clientUpdatedAt: 10,
      label: "Start of day",
      presentTravellerIds: [f.ids.a1, f.ids.b1, "not-an-id"],
      startedAt: NOW,
    });
    expect(first).toMatchObject({ applied: true, ignoredTravellerIds: 2 });
    const retry = await push({
      clientStopId: "stop-1",
      clientUpdatedAt: 10,
      label: "Start of day",
      presentTravellerIds: [f.ids.a1, f.ids.b1, "not-an-id"],
      startedAt: NOW,
    });
    expect(retry.id).toBe(first.id);
    const stale = await push({
      clientStopId: "stop-1",
      clientUpdatedAt: 5,
      label: "Older edit",
      presentTravellerIds: [],
      startedAt: NOW,
    });
    expect(stale).toMatchObject({ applied: false, id: first.id });
    await push({
      clientStopId: "stop-2",
      clientUpdatedAt: 20,
      label: "Temple gate",
      presentTravellerIds: [f.ids.a1, f.ids.a3],
      startedAt: NOW + 60_000,
    });
    await f.actor("tm-whole").mutation(api.crm.fieldSync.pushHeadcountStop, {
      clientStopId: "stop-1",
      day: "2026-11-10",
      jobCardId: f.ids.jobCardId,
      label: "Hotel lobby",
      presentTravellerIds: [f.ids.b1],
      startedAt: NOW + 30_000,
    });

    expect(await t.run((ctx) => ctx.db.query("fieldHeadcountStops").collect())).toHaveLength(3);

    const days = await f.opsHead.query(api.crm.fieldSync.listLatestHeadcounts, {
      jobCardId: f.ids.jobCardId,
    });
    expect(days).toHaveLength(1);
    expect(days?.[0]?.stopCount).toBe(3);
    const latest = days?.[0]?.latest ?? [];
    expect(latest.map((stop) => [stop.recordedByName, stop.label])).toEqual([
      ["Asha Rao", "Temple gate"],
      ["Vikram Singh", "Hotel lobby"],
    ]);
    // Batch A has two travelling travellers (A Two is cancelled): both present.
    expect(latest[0]).toMatchObject({ expectedCount: 2, missing: [], presentCount: 2 });
    // The whole Job Card has four travelling travellers; only B One was counted.
    expect(latest[1]).toMatchObject({ expectedCount: 4, presentCount: 1 });
    expect(latest[1]?.missing.map((row) => row.fullName).sort(byText)).toEqual([
      "Synthetic A One",
      "Synthetic A Three",
      "Synthetic Unbatched",
    ]);

    expect(
      await tm.query(api.crm.fieldSync.listLatestHeadcounts, { jobCardId: f.ids.jobCardId })
    ).toBeNull();
  });

  test("rejects other batches, other Job Cards and malformed days", async () => {
    const f = await seed(harness());
    await f.assign("tm-batch", f.ids.batchA);
    const tm = f.actor("tm-batch");
    const base = {
      clientStopId: "stop-x",
      day: "2026-11-10",
      jobCardId: f.ids.jobCardId,
      label: "Stop",
      presentTravellerIds: [],
      startedAt: NOW,
    };
    await expect(
      tm.mutation(api.crm.fieldSync.pushHeadcountStop, { ...base, travelBatchId: f.ids.batchB })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      tm.mutation(api.crm.fieldSync.pushHeadcountStop, {
        ...base,
        jobCardId: f.ids.otherJobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      tm.mutation(api.crm.fieldSync.pushHeadcountStop, { ...base, day: "2026-02-30" })
    ).rejects.toThrow("real calendar date");
  });
});

describe("announcement sync", () => {
  test("records once per client id, updates seen-by, and lists for the office", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-batch", f.ids.batchA);
    const tm = f.actor("tm-batch");
    const record = (seenByTravellerIds: string[], clientUpdatedAt: number) =>
      tm.mutation(api.crm.fieldSync.recordAnnouncement, {
        body: "Coach leaves at 08:00 from the lobby.",
        clientAnnouncementId: "ann-1",
        clientUpdatedAt,
        jobCardId: f.ids.jobCardId,
        recipientTravellerIds: [f.ids.a1, f.ids.a3, f.ids.b1],
        seenByTravellerIds,
        sharedAt: NOW,
        travelBatchId: f.ids.batchA,
      });
    const first = await record([], 1);
    expect(first.ignoredTravellerIds).toBe(1);
    const second = await record([f.ids.a1, f.ids.b1], 2);
    expect(second).toMatchObject({ applied: true, id: first.id, ignoredTravellerIds: 1 });

    await expect(
      tm.mutation(api.crm.fieldSync.recordAnnouncement, {
        body: "Edited text",
        clientAnnouncementId: "ann-1",
        jobCardId: f.ids.jobCardId,
        recipientTravellerIds: [],
        seenByTravellerIds: [],
        sharedAt: NOW,
        travelBatchId: f.ids.batchA,
      })
    ).rejects.toThrow("cannot change");
    await expect(
      tm.mutation(api.crm.fieldSync.recordAnnouncement, {
        body: "Other batch",
        clientAnnouncementId: "ann-2",
        jobCardId: f.ids.jobCardId,
        recipientTravellerIds: [],
        seenByTravellerIds: [],
        sharedAt: NOW,
        travelBatchId: f.ids.batchB,
      })
    ).rejects.toThrow("FORBIDDEN");

    const list = await f.opsHead.query(api.crm.fieldSync.listAnnouncements, {
      jobCardId: f.ids.jobCardId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(list.page).toEqual([
      expect.objectContaining({
        authorName: "Asha Rao",
        batchLabel: "JC-CONNECT-01 / B01",
        body: "Coach leaves at 08:00 from the lobby.",
        recipientCount: 2,
        seenCount: 1,
      }),
    ]);
    await expect(
      tm.query(api.crm.fieldSync.listAnnouncements, {
        jobCardId: f.ids.jobCardId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("tour manager job list", () => {
  test("lists the caller's assigned Job Cards once each", async () => {
    const f = await seed(harness());
    await f.assign("tm-batch", f.ids.batchA);
    await f.assign("tm-batch", f.ids.batchB);
    const { id: otherAssignment } = await f.assign("tm-batch", undefined, f.ids.otherJobCardId);
    const list = async (key: StaffKey, numItems = 10) =>
      (
        await f.actor(key).query(api.crm.jobCards.listMyAssignedPage, {
          paginationOpts: { cursor: null, numItems },
        })
      ).page.map((row) => row.jobCode);

    expect((await list("tm-batch")).sort(byText)).toEqual(["JC-CONNECT-01", "JC-CONNECT-02"]);
    expect(await list("tm-outsider")).toEqual([]);
    expect(await list("ops-head")).toEqual([]);

    // Walk one assignment at a time: the Job Card with two batch assignments still appears once.
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let index = 0; index < 5; index += 1) {
      const page: { continueCursor: string; isDone: boolean; page: { jobCode: string }[] } = await f
        .actor("tm-batch")
        .query(api.crm.jobCards.listMyAssignedPage, {
          paginationOpts: { cursor, numItems: 1 },
        });
      seen.push(...page.page.map((row) => row.jobCode));
      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }
    expect(seen.sort(byText)).toEqual(["JC-CONNECT-01", "JC-CONNECT-02"]);

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      status: "Inactive",
      tourManagerId: otherAssignment,
    });
    expect(await list("tm-batch")).toEqual(["JC-CONNECT-01"]);
    const filtered = await f.actor("tm-batch").query(api.crm.jobCards.listMyAssignedPage, {
      paginationOpts: { cursor: null, numItems: 10 },
      status: "Open",
    });
    expect(filtered.page).toEqual([]);
  });
});

describe("expense idempotency", () => {
  test("a retried create with the same clientRef returns the first expense", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assign("tm-whole");
    const tm = f.actor("tm-whole");
    const create = (clientRef?: string, jobCardId: Id<"jobCards"> = f.ids.jobCardId) =>
      tm.mutation(api.crm.finance.createExpense, {
        amount: 1200,
        category: "Transport",
        clientRef,
        currency: "INR",
        expenseDate: "2026-11-10",
        jobCardId,
        paidBy: "Tour manager",
      });
    const first = await create("connect-exp-1");
    expect((await create("connect-exp-1")).id).toBe(first.id);
    expect((await create()).id).not.toBe(first.id);
    expect((await create()).id).not.toBe(first.id);
    await expect(create("bad ref with spaces")).rejects.toThrow("expense reference");

    await f.assign("tm-whole", undefined, f.ids.otherJobCardId);
    await expect(create("connect-exp-1", f.ids.otherJobCardId)).rejects.toThrow(
      "already used for another Job Card"
    );
    expect(await t.run((ctx) => ctx.db.query("expenseEntries").collect())).toHaveLength(3);
  });
});
