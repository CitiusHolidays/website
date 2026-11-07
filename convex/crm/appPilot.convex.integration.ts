import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

/**
 * Per-trip app pilot (owner decision, 7 Nov 2026): nothing about a Job Card reaches the tour
 * manager app until someone starts its pilot; stopping it hides the trip again. The Staff
 * Workspace keeps today's access throughout.
 */

const NOW = Date.parse("2026-11-10T06:00:00Z");
const ISSUER = "https://app-pilot.test";

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

const identities = {
  admin: { name: "Synthetic Admin", roles: ["Admin"] },
  director: { name: "Synthetic Director", roles: ["Directors"] },
  "director-cement": { name: "Synthetic Director Cement", roles: ["Director Cement"] },
  "ops-head": { name: "Synthetic Ops Head", roles: ["Operations Head"] },
  "ops-other": { name: "Synthetic Other Ops", roles: ["Operations"] },
  "ops-owner": { name: "Synthetic Ops Owner", roles: ["Operations"] },
  tm: { name: "Synthetic Tour Manager", roles: ["Tour Manager"] },
  "tm-outsider": { name: "Synthetic Outsider", roles: ["Tour Manager"] },
} as const;
type StaffKey = keyof typeof identities;
// SAFETY: identities is a literal object, so its own keys are exactly StaffKey.
const STAFF_KEYS = Object.keys(identities) as StaffKey[];

async function seed(t: ReturnType<typeof harness>) {
  const staffIds = new Map<StaffKey, Id<"staffUsers">>();
  await t.run(async (ctx) => {
    for (const key of STAFF_KEYS) {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `${ISSUER}|${key}`,
        createdAt: NOW,
        legacyAuthUserId: key,
        status: "linked",
        updatedAt: NOW,
      });
      staffIds.set(
        key,
        await ctx.db.insert("staffUsers", {
          active: true,
          authUserId: key,
          createdAt: NOW,
          email: `${key}@app-pilot.test`,
          emailNormalized: `${key}@app-pilot.test`,
          name: identities[key].name,
          roles: [...identities[key].roles],
          updatedAt: NOW,
        })
      );
    }
  });
  const ids = await t.run(async (ctx) => {
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic pilot group",
      confirmedPax: 2,
      createdAt: NOW,
      createdBy: "accounts-owner",
      destination: "Goa",
      jobCode: "JC-PILOT-01",
      operationsOwnerId: String(staffIds.get("ops-owner")),
      operationsOwnerName: identities["ops-owner"].name,
      queryType: "MICE",
      status: "On Tour",
      travelEndDate: "2026-11-12",
      travelStartDate: "2026-11-09",
      updatedAt: NOW,
    });
    const traveller = await ctx.db.insert("travellers", {
      callingStatus: "Pending",
      contactNo: "+910000000000",
      createdAt: NOW,
      createdBy: "synthetic-ops",
      foodPreference: "Veg",
      fullName: "Synthetic Traveller One",
      guestType: "Employee",
      hasPassportScan: true,
      jobCardId,
      passportStatus: "Received",
      paymentType: "Company Paid",
      roomType: "Twin",
      ticketStatus: "Pending Issue",
      updatedAt: NOW,
      visaRequired: false,
      visaStatus: "Not Required",
    });
    const storageId = await ctx.storage.store(new Blob(["synthetic-encrypted"]));
    await ctx.db.insert("passportDetails", {
      createdAt: NOW,
      createdBy: "ops-head",
      encryptedPayload: "synthetic",
      expiryDate: "2031-01-01",
      fileName: "synthetic-passport.pdf",
      mimeType: "application/pdf",
      status: "Received",
      storageId,
      travellerId: traveller,
      updatedAt: NOW,
    });
    return { jobCardId, traveller };
  });
  const actor = (key: StaffKey) =>
    t.withIdentity({
      email: `${key}@app-pilot.test`,
      issuer: ISSUER,
      subject: key,
      tokenIdentifier: `${ISSUER}|${key}`,
    });
  await actor("ops-head").mutation(api.crm.ops.createTourManager, {
    jobCardId: ids.jobCardId,
    name: "ignored for staff assignments",
    staffId: staffIds.get("tm"),
  });
  const setPilot = (key: StaffKey, enabled: boolean) =>
    actor(key).mutation(api.crm.jobCards.setAppPilot, { enabled, jobCardId: ids.jobCardId });
  return { actor, ids, setPilot, staffIds };
}

type Fixture = Awaited<ReturnType<typeof seed>>;

/** Every Connect surface the tour manager app calls for one trip, as the app calls it. */
function connectCalls(f: Fixture) {
  const tm = f.actor("tm");
  const { jobCardId } = f.ids;
  const page = { cursor: null, numItems: 20 };
  let sequence = 0;
  const nextId = (prefix: string) => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
  return {
    assignedJobCodes: async () =>
      (await tm.query(api.crm.jobCards.listMyAssignedPage, { paginationOpts: page })).page.map(
        (row) => row.jobCode
      ),
    refusing: {
      announcement: () =>
        tm.mutation(api.crm.fieldSync.recordAnnouncement, {
          body: "Coach leaves at 08:00.",
          clientAnnouncementId: nextId("ann"),
          jobCardId,
          recipientTravellerIds: [f.ids.traveller],
          seenByTravellerIds: [],
          sharedAt: NOW,
        }),
      commandCenter: () =>
        tm.query(api.crm.jobCards.getCommandCenter, { jobCardId, surface: "connect" }),
      createExpense: () =>
        tm.mutation(api.crm.finance.createExpense, {
          amount: 500,
          category: "Transport",
          clientRef: nextId("pilot-exp"),
          currency: "INR",
          expenseDate: "2026-11-10",
          jobCardId,
          paidBy: "Tour manager",
        }),
      detail: () => tm.query(api.crm.jobCards.getDetail, { jobCardId, surface: "connect" }),
      fieldPassportFile: () =>
        tm.action(api.crm.fieldPassportActions.getFieldPassportFile, {
          travellerId: f.ids.traveller,
        }),
      fieldPassportGrant: () =>
        tm.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
          travellerId: f.ids.traveller,
        }),
      fieldPassports: () =>
        tm.query(api.crm.fieldPassports.listFieldPassports, { jobCardId, referenceNow: NOW }),
      headcount: () =>
        tm.mutation(api.crm.fieldSync.pushHeadcountStop, {
          clientStopId: nextId("stop"),
          day: "2026-11-10",
          jobCardId,
          label: "Hotel lobby",
          presentTravellerIds: [f.ids.traveller],
          startedAt: NOW,
        }),
      tourManagers: () =>
        tm.query(api.crm.ops.listTourManagers, {
          jobCardId,
          paginationOpts: page,
          surface: "connect",
        }),
      travelBatches: () =>
        tm.query(api.crm.jobCards.listTravelBatches, {
          jobCardId,
          paginationOpts: page,
          surface: "connect",
        }),
      travellers: () =>
        tm.query(api.crm.travellers.listPage, {
          jobCardId,
          paginationOpts: page,
          surface: "connect",
        }),
    },
  };
}

async function expectAppClosed(f: Fixture) {
  const calls = connectCalls(f);
  expect(await calls.assignedJobCodes()).toEqual([]);
  for (const [name, call] of Object.entries(calls.refusing)) {
    await expect(call(), name).rejects.toThrow("APP_PILOT_OFF");
  }
}

async function expectAppOpen(f: Fixture) {
  const calls = connectCalls(f);
  expect(await calls.assignedJobCodes()).toEqual(["JC-PILOT-01"]);
  const { refusing } = calls;
  expect((await refusing.commandCenter()).jobCard.jobCode).toBe("JC-PILOT-01");
  expect(await refusing.createExpense()).toHaveProperty("id");
  expect((await refusing.detail())?.jobCode).toBe("JC-PILOT-01");
  expect((await refusing.fieldPassportGrant()).fileName).toBe("synthetic-passport.pdf");
  expect((await refusing.fieldPassports()).travellers).toHaveLength(1);
  expect(await refusing.headcount()).toMatchObject({ applied: true });
  expect(await refusing.announcement()).toMatchObject({ applied: true });
  expect((await refusing.tourManagers()).page).toHaveLength(1);
  expect((await refusing.travelBatches()).page).toEqual([]);
  expect((await refusing.travellers()).page.map((row) => row.fullName)).toEqual([
    "Synthetic Traveller One",
  ]);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("per-trip app pilot", () => {
  test("a trip reaches the app only while its pilot is on", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    const t = harness();
    const f = await seed(t);

    // Field absent: the pilot is off.
    expect(
      await f.actor("ops-head").query(api.crm.jobCards.getAppPilot, { jobCardId: f.ids.jobCardId })
    ).toMatchObject({ changedAt: null, enabled: false });
    await expectAppClosed(f);

    await f.setPilot("ops-owner", true);
    await expectAppOpen(f);

    await f.setPilot("ops-owner", false);
    await expectAppClosed(f);
  });

  test("the Staff Workspace keeps working while the pilot is off", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    const t = harness();
    const f = await seed(t);
    const { jobCardId } = f.ids;
    const page = { cursor: null, numItems: 20 };
    const tm = f.actor("tm");

    // The tour manager's CRM reads, called without the app surface.
    expect((await tm.query(api.crm.jobCards.getCommandCenter, { jobCardId })).jobCard.jobCode).toBe(
      "JC-PILOT-01"
    );
    expect((await tm.query(api.crm.jobCards.getDetail, { jobCardId }))?.jobCode).toBe(
      "JC-PILOT-01"
    );
    expect(
      (await tm.query(api.crm.travellers.listPage, { jobCardId, paginationOpts: page })).page
    ).toHaveLength(1);
    expect(
      (await tm.query(api.crm.ops.listTourManagers, { jobCardId, paginationOpts: page })).page
    ).toHaveLength(1);
    expect(
      (await tm.query(api.crm.jobCards.listTravelBatches, { jobCardId, paginationOpts: page })).page
    ).toEqual([]);
    expect(
      await tm.mutation(api.crm.finance.createExpense, {
        amount: 300,
        category: "Meals",
        currency: "INR",
        expenseDate: "2026-11-10",
        jobCardId,
        paidBy: "Tour manager",
      })
    ).toHaveProperty("id");

    // Office readers.
    const opsHead = f.actor("ops-head");
    expect(
      (await opsHead.query(api.crm.jobCards.getCommandCenter, { jobCardId })).jobCard.jobCode
    ).toBe("JC-PILOT-01");
    expect(await opsHead.query(api.crm.fieldSync.listLatestHeadcounts, { jobCardId })).toEqual([]);
    expect(
      (
        await opsHead.query(api.crm.fieldSync.listAnnouncements, {
          jobCardId,
          paginationOpts: page,
        })
      ).page
    ).toEqual([]);
    expect(
      (
        await opsHead.query(api.crm.fieldPassports.listFieldPassportAccess, {
          jobCardId,
          paginationOpts: page,
        })
      ).page
    ).toEqual([]);
  });

  test("the Operations Head, directors, admins and the Operations owner may switch it", async () => {
    const t = harness();
    const f = await seed(t);
    const allowed: StaffKey[] = ["ops-head", "director", "director-cement", "admin", "ops-owner"];
    let enabled = false;
    for (const key of allowed) {
      enabled = !enabled;
      expect(await f.setPilot(key, enabled), key).toMatchObject({
        changedByName: identities[key].name,
        enabled,
      });
    }
    for (const key of ["ops-other", "tm"] as const) {
      await expect(f.setPilot(key, !enabled), key).rejects.toThrow("FORBIDDEN");
    }
    const view = (key: StaffKey) =>
      f.actor(key).query(api.crm.jobCards.getAppPilot, { jobCardId: f.ids.jobCardId });
    expect(await view("ops-owner")).toMatchObject({ canManage: true, enabled });
    expect(await view("tm")).toMatchObject({ canManage: false, enabled });
  });

  test("every change writes a Job Card activity row; repeating the same state writes none", async () => {
    const t = harness();
    const f = await seed(t);
    await f.setPilot("ops-head", true);
    await f.setPilot("ops-head", true);
    await f.setPilot("ops-owner", false);
    const rows = await t.run((ctx) =>
      ctx.db
        .query("activityLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "jobCard").eq("entityId", String(f.ids.jobCardId))
        )
        .collect()
    );
    const pilotRows = rows.filter((row) => row.action.startsWith("app_pilot_"));
    expect(pilotRows.map((row) => [row.action, row.actorName])).toEqual([
      ["app_pilot_started", "Synthetic Ops Head"],
      ["app_pilot_stopped", "Synthetic Ops Owner"],
    ]);
    const stored = await t.run((ctx) => ctx.db.get("jobCards", f.ids.jobCardId));
    expect(stored?.appPilot).toMatchObject({
      changedBy: `${ISSUER}|ops-owner`,
      changedByName: "Synthetic Ops Owner",
      enabled: false,
    });
    expect(stored?.appPilot?.changedAt).toBeGreaterThan(0);
  });
  test("a caller who cannot see the Job Card gets no pilot state and cannot switch it", async () => {
    const f = await seed(harness());
    expect(
      await f
        .actor("tm-outsider")
        .query(api.crm.jobCards.getAppPilot, { jobCardId: f.ids.jobCardId })
    ).toBeNull();
    await expect(f.setPilot("tm-outsider", true)).rejects.toThrow("FORBIDDEN");
  });

  test("an app expense retried after the pilot stops returns the expense already recorded", async () => {
    const f = await seed(harness());
    await f.setPilot("ops-head", true);
    const create = () =>
      f.actor("tm").mutation(api.crm.finance.createExpense, {
        amount: 500,
        category: "Transport",
        clientRef: "pilot-retry-1",
        currency: "INR",
        expenseDate: "2026-11-10",
        jobCardId: f.ids.jobCardId,
        paidBy: "Tour manager",
      });
    const first = await create();
    await f.setPilot("ops-head", false);
    expect((await create()).id).toBe(first.id);
  });

  test("the assigned-trips list keeps paging past a trip whose pilot is off", async () => {
    const t = harness();
    const f = await seed(t);
    const second = await t.run((ctx) =>
      ctx.db.insert("jobCards", {
        appPilot: { changedAt: NOW, changedBy: "seed", changedByName: "Seed", enabled: true },
        clientName: "Synthetic second group",
        confirmedPax: 1,
        createdAt: NOW,
        createdBy: "accounts-owner",
        jobCode: "JC-PILOT-02",
        queryType: "MICE",
        status: "Open",
        updatedAt: NOW,
      })
    );
    await f.actor("ops-head").mutation(api.crm.ops.createTourManager, {
      jobCardId: second,
      name: "ignored for staff assignments",
      staffId: f.staffIds.get("tm"),
    });
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let index = 0; index < 5; index += 1) {
      const result: { continueCursor: string; isDone: boolean; page: { jobCode: string }[] } =
        await f.actor("tm").query(api.crm.jobCards.listMyAssignedPage, {
          paginationOpts: { cursor, numItems: 1 },
        });
      seen.push(...result.page.map((row) => row.jobCode));
      if (result.isDone) {
        break;
      }
      cursor = result.continueCursor;
    }
    expect(seen).toEqual(["JC-PILOT-02"]);
  });
});
