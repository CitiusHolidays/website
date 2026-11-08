import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { emptyPostTourReport } from "../lib/postTourReportContent";
import schema from "../schema";
import { modules } from "../test.setup";

// Synthetic data only. Owner decisions of 7 Nov 2026: the Operations Head (and directors/admins)
// give an external tour manager an app and CRM login from the profile; it reaches only the trips
// they are assigned to; no HR flows; access ends only when someone switches it off.

const NOW = Date.parse("2026-11-07T06:00:00Z");
// These trips are in the tour manager app pilot; appPilot.convex.integration.ts covers the off state.
const APP_PILOT_ON = {
  appPilot: {
    changedAt: NOW,
    changedBy: "synthetic-ops",
    changedByName: "Synthetic Ops",
    enabled: true,
  },
};
const ISSUER = "https://external-tm.test";
const EXTERNAL_SUBJECT = "external-meera";

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

const STAFF_KEYS = ["director", "ops-exec", "ops-head", "tm-namesake"] as const;
const STAFF = {
  director: { name: "Synthetic Director", roles: ["Directors"] },
  "ops-exec": { name: "Synthetic Ops Exec", roles: ["Operations"] },
  "ops-head": { name: "Synthetic Ops Head", roles: ["Operations Head"] },
  "tm-namesake": { name: "Meera Iyer", roles: ["Tour Manager"] },
} as const satisfies Record<(typeof STAFF_KEYS)[number], { name: string; roles: string[] }>;
type StaffKey = (typeof STAFF_KEYS)[number];

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

async function linkIdentity(
  t: ReturnType<typeof harness>,
  subject: string,
  staffId?: Id<"staffUsers">
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("authIdentityLinks", {
      canonicalAuthUserId: `${ISSUER}|${subject}`,
      createdAt: NOW,
      legacyAuthUserId: subject,
      status: "linked",
      updatedAt: NOW,
    });
    if (staffId) {
      // What onboarding does once the person verifies their email and sets a password.
      await ctx.db.patch("staffUsers", staffId, {
        authUserId: subject,
        pendingPasswordSetup: false,
      });
    }
  });
}

function actorFor(t: ReturnType<typeof harness>, subject: string) {
  return t.withIdentity({
    email: `${subject}@external-tm.test`,
    issuer: ISSUER,
    subject,
    tokenIdentifier: `${ISSUER}|${subject}`,
  });
}

async function seed(t: ReturnType<typeof harness>) {
  const staffIds = new Map<StaffKey, Id<"staffUsers">>();
  for (const key of STAFF_KEYS) {
    const id = await t.run(async (ctx) =>
      ctx.db.insert("staffUsers", {
        active: true,
        createdAt: NOW,
        email: `${key}@external-tm.test`,
        emailNormalized: `${key}@external-tm.test`,
        name: STAFF[key].name,
        roles: [...STAFF[key].roles],
        updatedAt: NOW,
      })
    );
    staffIds.set(key, id);
    await linkIdentity(t, key, id);
  }
  const ids = await t.run(async (ctx) => {
    // Owned by name by someone called Meera Iyer: a namesake trap for the external login.
    const queryId = await ctx.db.insert("queries", {
      batchingNotes: "",
      clientName: "Synthetic incentive group",
      contractingStatus: "Proposal in progress",
      createdAt: NOW,
      createdBy: "sales-owner",
      destination: "Bali",
      leadStage: "Confirmation",
      listSearchText: "synthetic incentive group bali",
      paxCount: 3,
      queryCode: "Q-EXT-01",
      queryType: "MICE",
      salesOwnerName: "Meera Iyer",
      salesStatus: "Order Confirmed",
      source: "Client",
      ticketingScope: "Not required",
      travelEndDate: "2026-11-15",
      travelInBatches: true,
      travelStartDate: "2026-11-10",
      travelType: "International Travel",
      updatedAt: NOW,
    });
    const jobCardId = await ctx.db.insert("jobCards", {
      ...APP_PILOT_ON,
      clientName: "Synthetic incentive group",
      confirmedPax: 3,
      createdAt: NOW,
      createdBy: "accounts-owner",
      destination: "Bali",
      jobCode: "JC-EXT-01",
      operationsOwnerId: String(staffIds.get("ops-exec")),
      operationsOwnerName: STAFF["ops-exec"].name,
      queryType: "MICE",
      status: "Ready for Departure",
      travelEndDate: "2026-11-15",
      travelStartDate: "2026-11-10",
      updatedAt: NOW,
    });
    const otherJobCardId = await ctx.db.insert("jobCards", {
      ...APP_PILOT_ON,
      clientName: "Synthetic other group",
      confirmedPax: 1,
      createdAt: NOW + 1,
      createdBy: "accounts-owner",
      jobCode: "JC-EXT-02",
      // An unsynced legacy Job Card whose free-text Tour Manager name and linked query owner
      // name both match the external tour manager.
      queryId,
      queryType: "MICE",
      status: "Open",
      tourManagerName: "Meera Iyer",
      updatedAt: NOW + 1,
    });
    const batch = (code: string) =>
      ctx.db.insert("travelBatches", {
        batchCode: code,
        batchReference: `JC-EXT-01 / ${code}`,
        confirmedPax: 1,
        createdAt: NOW,
        createdBy: "synthetic-ops",
        jobCardId,
        status: "Open",
        travelEndDate: "2026-11-15",
        travelStartDate: "2026-11-10",
        updatedAt: NOW,
      });
    const batchA = await batch("B01");
    const batchB = await batch("B02");
    const traveller = (fullName: string, travelBatchId: Id<"travelBatches">) =>
      ctx.db.insert("travellers", {
        ...SYNTHETIC_TRAVELLER,
        contactNo: "+910000000000",
        createdAt: NOW,
        fullName,
        jobCardId,
        travelBatchId,
        updatedAt: NOW,
      });
    await traveller("Synthetic A One", batchA);
    await traveller("Synthetic B One", batchB);
    const profileId = await ctx.db.insert("externalTourManagerProfiles", {
      active: true,
      createdAt: NOW,
      createdBy: "ops-head",
      destinations: ["Bali"],
      email: "meera.external@external-tm.test",
      emailNormalized: "meera.external@external-tm.test",
      experienceSummary: "",
      experienceYears: null,
      name: "Meera Iyer",
      phone: "+91 98000 00001",
      phoneNormalized: "919800000001",
      reportedPastTours: null,
      reportedPastToursNote: "",
      reportedPastToursSource: "staff_recorded",
      updatedAt: NOW,
      updatedBy: "ops-head",
    });
    return { batchA, batchB, jobCardId, otherJobCardId, profileId };
  });
  const actor = (key: StaffKey) => actorFor(t, key);
  const opsHead = actor("ops-head");
  const external = actorFor(t, EXTERNAL_SUBJECT);
  // The seeded Job Card travels in series, so an external assignment always names its batch.
  const assignExternal = (travelBatchId: Id<"travelBatches"> = ids.batchA) =>
    opsHead.mutation(api.crm.ops.createTourManager, {
      externalProfileId: ids.profileId,
      jobCardId: ids.jobCardId,
      name: "ignored for profile assignments",
      travelBatchId,
    });
  const grant = async () => {
    await opsHead.mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
      enabled: true,
      profileId: ids.profileId,
    });
    const profile = await opsHead.query(api.crm.externalTourManagerProfiles.get, {
      profileId: ids.profileId,
    });
    return profile;
  };
  const externalStaffId = () =>
    t.run(async (ctx) => {
      const [row] = await ctx.db
        .query("staffUsers")
        .withIndex("by_emailNormalized", (q) =>
          q.eq("emailNormalized", "meera.external@external-tm.test")
        )
        .take(1);
      return row?._id ?? null;
    });
  const signInExternal = async () => {
    const staffId = await externalStaffId();
    if (!staffId) {
      throw new Error("no external staff record");
    }
    await linkIdentity(t, EXTERNAL_SUBJECT, staffId);
    return staffId;
  };
  const travellerNames = async () => {
    const page = await external.query(api.crm.travellers.listPage, {
      jobCardId: ids.jobCardId,
      paginationOpts: { cursor: null, numItems: 50 },
    });
    return page.page.map((row) => row.fullName).sort();
  };
  const assignedJobCodes = async () => {
    const page = await external.query(api.crm.jobCards.listMyAssignedPage, {
      paginationOpts: { cursor: null, numItems: 20 },
    });
    return page.page.map((row) => row.jobCode);
  };
  return {
    actor,
    assignExternal,
    assignedJobCodes,
    external,
    externalStaffId,
    grant,
    ids,
    opsHead,
    signInExternal,
    staffIds,
    travellerNames,
  };
}

const PAGE = { cursor: null, numItems: 20 };

describe("granting app and CRM access from an external profile", () => {
  test("the Operations Head grants a narrowed Tour Manager login; an Operations exec cannot", async () => {
    const t = harness();
    const f = await seed(t);

    await expect(
      f.actor("ops-exec").mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
        enabled: true,
        profileId: f.ids.profileId,
      })
    ).rejects.toThrow("FORBIDDEN");

    const profile = await f.grant();
    expect(profile?.appAccess).toEqual({ onboarding: "not_started", status: "enabled" });

    await f.signInExternal();
    const access = await f.external.query(api.crm.staff.getMyPortalAccess, {});
    expect(access.allowed).toBe(true);
    expect(access.externalTourManager).toBe(true);
    expect(access.roles).toEqual(["Tour Manager"]);
    expect([...access.permissions].sort()).toEqual([
      "create:expenses",
      "view:expenses",
      "view:jobCards",
      "view:ticketing",
      "view:travellers",
      "view:visa",
    ]);
  });

  test("a director can also grant, and granting needs an email on the profile", async () => {
    const t = harness();
    const f = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("externalTourManagerProfiles", f.ids.profileId, {
        email: "",
        emailNormalized: "",
      });
    });
    await expect(
      f.actor("director").mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
        enabled: true,
        profileId: f.ids.profileId,
      })
    ).rejects.toThrow("email");
  });

  test("a staff member's email can never become an external login", async () => {
    const t = harness();
    const f = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch("externalTourManagerProfiles", f.ids.profileId, {
        email: "ops-exec@external-tm.test",
        emailNormalized: "ops-exec@external-tm.test",
      });
    });
    await expect(f.grant()).rejects.toThrow("staff member");
    // The staff record keeps its full access.
    const access = await f.actor("ops-exec").query(api.crm.staff.getMyPortalAccess, {});
    expect(access.externalTourManager).toBe(false);
    expect(access.permissions).toContain("view:operations");
  });
});

describe("what an external tour manager with access can reach", () => {
  test("only their assigned Job Card and their own group's travellers", async () => {
    const t = harness();
    const f = await seed(t);
    // Assigned before the login exists: granting links the assignment to the login.
    await f.assignExternal(f.ids.batchA);
    await f.grant();
    await f.signInExternal();

    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);
    expect(await f.travellerNames()).toEqual(["Synthetic A One"]);
    const center = await f.external.query(api.crm.jobCards.getCommandCenter, {
      jobCardId: f.ids.jobCardId,
    });
    expect(center.jobCard.jobCode).toBe("JC-EXT-01");
    expect(center.invoices).toEqual([]);
    expect(center.commercialFiles).toEqual([]);
    expect(center.query).toBeNull();
    // The trip's destination photo is the trip, not the commercial chain: it stays.
    expect(center.destinationCover?.path).toBe("/images/event-photo-booth/bali.webp");

    // The legacy name match never applies to an external login.
    await expect(
      f.external.query(api.crm.jobCards.getCommandCenter, { jobCardId: f.ids.otherJobCardId })
    ).rejects.toThrow("FORBIDDEN");
    const list = await f.external.query(api.crm.jobCards.listPage, { paginationOpts: PAGE });
    expect(list.page.map((row) => row.jobCode)).toEqual(["JC-EXT-01"]);

    // Co-assigned tour managers on the same trip are visible, the unassigned pool is not.
    const onTrip = await f.external.query(api.crm.ops.listTourManagers, {
      jobCardId: f.ids.jobCardId,
      paginationOpts: PAGE,
    });
    expect(onTrip.page.map((row) => row.name)).toEqual(["Meera Iyer"]);
    await expect(
      f.external.query(api.crm.ops.listTourManagers, { paginationOpts: PAGE })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("with the trip's app pilot off: the CRM view is unchanged and the app paths refuse", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(Date.parse("2026-11-10T06:00:00Z"));
    const t = harness();
    const f = await seed(t);
    await f.assignExternal(f.ids.batchA);
    await f.grant();
    await f.signInExternal();
    await f.opsHead.mutation(api.crm.jobCards.setAppPilot, {
      enabled: false,
      jobCardId: f.ids.jobCardId,
    });
    const { jobCardId } = f.ids;

    // Staff Workspace reads, called without the app surface, are exactly as before.
    expect(await f.travellerNames()).toEqual(["Synthetic A One"]);
    expect(
      (await f.external.query(api.crm.jobCards.getCommandCenter, { jobCardId })).jobCard.jobCode
    ).toBe("JC-EXT-01");
    expect(
      (await f.external.query(api.crm.ops.listTourManagers, { jobCardId, paginationOpts: PAGE }))
        .page
    ).toHaveLength(1);

    // App paths.
    expect(await f.assignedJobCodes()).toEqual([]);
    const travellerId = await t.run(async (ctx) => {
      const [row] = await ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .take(1);
      return row._id;
    });
    const refusals = [
      () => f.external.query(api.crm.jobCards.getCommandCenter, { jobCardId, surface: "connect" }),
      () =>
        f.external.query(api.crm.travellers.listPage, {
          jobCardId,
          paginationOpts: PAGE,
          surface: "connect",
        }),
      () =>
        f.external.query(api.crm.ops.listTourManagers, {
          jobCardId,
          paginationOpts: PAGE,
          surface: "connect",
        }),
      () =>
        f.external.query(api.crm.fieldPassports.listFieldPassports, {
          jobCardId,
          referenceNow: Date.parse("2026-11-10T06:00:00Z"),
        }),
      () =>
        f.external.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, {
          travellerId,
        }),
      () =>
        f.external.mutation(api.crm.fieldSync.pushHeadcountStop, {
          clientStopId: "ext-stop-1",
          day: "2026-11-10",
          jobCardId,
          label: "Lobby",
          presentTravellerIds: [],
          startedAt: NOW,
        }),
      () =>
        f.external.mutation(api.crm.finance.createExpense, {
          amount: 400,
          category: "Meals",
          clientRef: "ext-pilot-off-1",
          currency: "INR",
          expenseDate: "2026-11-10",
          jobCardId,
          paidBy: "Tour manager",
        }),
    ];
    for (const call of refusals) {
      await expect(call()).rejects.toThrow("APP_PILOT_OFF");
    }
  });

  test("a profile assigned after the grant carries the login on the assignment", async () => {
    const t = harness();
    const f = await seed(t);
    await f.grant();
    await f.signInExternal();
    expect(await f.assignedJobCodes()).toEqual([]);
    await f.assignExternal(f.ids.batchB);
    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);
    expect(await f.travellerNames()).toEqual(["Synthetic B One"]);
  });

  test("no staff directory, leave, queries, dashboard or staff travel", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    const ext = f.external;
    const refusals = [
      () => ext.query(api.crm.staff.listDirectory, { paginationOpts: PAGE }),
      () => ext.query(api.crm.staff.listTeamOptions, {}),
      () => ext.query(api.crm.leave.list, { paginationOpts: PAGE }),
      () => ext.query(api.crm.proposals.listPage, { paginationOpts: PAGE }),
      () =>
        ext.query(api.crm.staffTravel.list, { paginationOpts: PAGE, referenceDate: "2026-11-07" }),
      () => ext.query(api.crm.officeCheckIns.myStatus, { referenceNow: NOW }),
      () => ext.query(api.crm.externalTourManagerProfiles.list, { paginationOpts: PAGE }),
    ];
    for (const [index, refusal] of refusals.entries()) {
      await expect(refusal(), `refusal ${index}`).rejects.toThrow("FORBIDDEN");
    }
    // The Job Card permission lists linked queries elsewhere, but none is visible to the login.
    const queries = await ext.query(api.crm.queries.listPage, { paginationOpts: PAGE });
    expect(queries.page).toEqual([]);
    // Their own notifications still load.
    await expect(ext.query(api.crm.activity.listNotifications, {})).resolves.toBeDefined();
  });

  test("expenses: own trip expenses only, approved by the trip's Operations owner", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();

    await expect(
      f.external.mutation(api.crm.finance.createExpense, {
        amount: 100,
        category: "Meals",
        paidBy: "Tour Manager",
      })
    ).rejects.toThrow("Job Card");
    const { id } = await f.external.mutation(api.crm.finance.createExpense, {
      amount: 250,
      category: "Meals",
      clientRef: "ext-meal-1",
      jobCardId: f.ids.jobCardId,
      paidBy: "Tour Manager",
    });
    // Someone else's expense on the same Job Card stays hidden.
    const { id: officeExpense } = await f.opsHead.mutation(api.crm.finance.createExpense, {
      amount: 999,
      category: "Hotel",
      jobCardId: f.ids.jobCardId,
      paidBy: "Company",
    });
    const mine = await f.external.query(api.crm.finance.listExpenses, { paginationOpts: PAGE });
    expect(mine.page.map((row) => row.id)).toEqual([id]);
    expect(
      await f.external.query(api.crm.finance.getExpenseListRow, { expenseId: officeExpense })
    ).toBeNull();

    await f.external.mutation(api.crm.finance.submitExpenseForApproval, { expenseId: id });
    const approver = await t.run(
      async (ctx) => (await ctx.db.get("expenseEntries", id))?.managerApproverStaffId
    );
    expect(approver).toBe(f.staffIds.get("ops-exec"));
  });
  test("the commercial chain behind the Job Card stays closed, unlike for a staff Tour Manager", async () => {
    const t = harness();
    const f = await seed(t);
    const chain = await t.run(async (ctx) => {
      const queryId = await ctx.db.insert("queries", {
        batchingNotes: "",
        clientName: "Synthetic incentive group",
        contractingStatus: "Proposal in progress",
        createdAt: NOW,
        createdBy: "sales-owner",
        leadStage: "Confirmation",
        listSearchText: "synthetic incentive group",
        paxCount: 3,
        queryCode: "Q-EXT-CHAIN",
        queryType: "MICE",
        salesStatus: "Order Confirmed",
        source: "Client",
        ticketingScope: "Not required",
        travelInBatches: true,
        travelType: "International Travel",
        updatedAt: NOW,
      });
      const proposalId = await ctx.db.insert("proposals", {
        clientName: "Synthetic incentive group",
        createdAt: NOW,
        createdBy: "contracting-owner",
        itinerarySummary: "Day 1 arrival, Day 2 temples",
        preparedBy: "contracting",
        proposalCode: "P-EXT-CHAIN",
        queryId,
        status: "Draft",
        updatedAt: NOW,
      });
      const storageId = await ctx.storage.store(new Blob(["synthetic pricing sheet"]));
      await ctx.db.insert("queryAttachments", {
        createdAt: NOW,
        createdBy: "sales-owner",
        fileName: "pricing.xlsx",
        fileSize: 23,
        mimeType: "application/vnd.ms-excel",
        queryId,
        storageId,
      });
      await ctx.db.patch("jobCards", f.ids.jobCardId, { proposalId, queryId });
      return { proposalId, queryId };
    });
    await f.assignExternal();
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId: f.ids.jobCardId,
      name: "ignored for staff assignments",
      staffId: f.staffIds.get("tm-namesake"),
    });
    await f.grant();
    await f.signInExternal();

    const staffTm = f.actor("tm-namesake");
    const staffAttachments = await staffTm.query(api.crm.queryAttachments.listForQuery, {
      paginationOpts: PAGE,
      queryId: chain.queryId,
    });
    expect(staffAttachments.page).toHaveLength(1);
    await expect(
      staffTm.query(api.crm.proposalAttachments.listForProposal, { proposalId: chain.proposalId })
    ).resolves.toEqual([]);

    const externalAttachments = await f.external.query(api.crm.queryAttachments.listForQuery, {
      paginationOpts: PAGE,
      queryId: chain.queryId,
    });
    expect(externalAttachments.page).toEqual([]);
    await expect(
      f.external.query(api.crm.proposalAttachments.listForProposal, {
        proposalId: chain.proposalId,
      })
    ).rejects.toThrow("FORBIDDEN");
    // The itinerary summary still reaches the trip pack.
    const center = await f.external.query(api.crm.jobCards.getCommandCenter, {
      jobCardId: f.ids.jobCardId,
    });
    expect(center.proposal?.itinerarySummary).toBe("Day 1 arrival, Day 2 temples");
    expect(center.query).toBeNull();
  });
});

describe("switching access off", () => {
  test("refuses CRM and app queries at once, and switching on restores them", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);

    await f.opsHead.mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
      enabled: false,
      profileId: f.ids.profileId,
    });
    const access = await f.external.query(api.crm.staff.getMyPortalAccess, {});
    expect(access.allowed).toBe(false);
    await expect(f.assignedJobCodes()).rejects.toThrow("FORBIDDEN");
    await expect(f.travellerNames()).rejects.toThrow("FORBIDDEN");
    const profile = await f.opsHead.query(api.crm.externalTourManagerProfiles.get, {
      profileId: f.ids.profileId,
    });
    expect(profile?.appAccess.status).toBe("disabled");

    // Only the same authority switches it off; an Operations exec cannot.
    await expect(
      f.actor("ops-exec").mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
        enabled: true,
        profileId: f.ids.profileId,
      })
    ).rejects.toThrow("FORBIDDEN");

    await f.opsHead.mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
      enabled: true,
      profileId: f.ids.profileId,
    });
    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);
  });

  test("deactivating the profile for new assignments does not end access", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    const profile = await f.opsHead.query(api.crm.externalTourManagerProfiles.get, {
      profileId: f.ids.profileId,
    });
    if (!profile) {
      throw new Error("profile missing");
    }
    await f.opsHead.mutation(api.crm.externalTourManagerProfiles.update, {
      active: false,
      destinations: profile.destinations,
      email: profile.email,
      experienceSummary: profile.experienceSummary,
      experienceYears: profile.experienceYears,
      name: profile.name,
      phone: profile.phone,
      profileId: f.ids.profileId,
      reportedPastTours: profile.reportedPastTours,
      reportedPastToursNote: profile.reportedPastToursNote,
      reportedPastToursSource: profile.reportedPastToursSource,
    });
    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);
  });
});

describe("identity rules", () => {
  test("an external profile's name never grants a same-named staff Tour Manager scope", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    const namesake = f.actor("tm-namesake");
    await expect(
      namesake.query(api.crm.jobCards.getCommandCenter, { jobCardId: f.ids.jobCardId })
    ).rejects.toThrow("FORBIDDEN");
    const page = await namesake.query(api.crm.jobCards.listMyAssignedPage, {
      paginationOpts: PAGE,
    });
    expect(page.page).toEqual([]);
  });

  test("the external login stays out of staff administration and pickers", async () => {
    const t = harness();
    const f = await seed(t);
    await f.grant();
    const staffId = await f.externalStaffId();
    const director = f.actor("director");
    const options = await director.query(api.crm.staff.listTeamOptions, {});
    expect(options.map((row) => row.email)).not.toContain("meera.external@external-tm.test");
    expect(options.map((row) => row.email)).toContain("tm-namesake@external-tm.test");
    const directory = await director.query(api.crm.staff.listDirectory, { paginationOpts: PAGE });
    expect(directory.page.map((row) => row.email)).not.toContain("meera.external@external-tm.test");
    // Staff administration cannot turn the login into a full staff record or remove it.
    await expect(
      director.mutation(api.crm.staff.upsertStaff, {
        active: true,
        email: "meera.external@external-tm.test",
        name: "Meera Iyer",
        roles: ["Operations"],
      })
    ).rejects.toThrow("External tour managers");
    await expect(
      director.mutation(api.crm.staff.removeStaff, { staffId: String(staffId) })
    ).rejects.toThrow("External tour managers");
    // Nor can it be assigned as if it were a staff Tour Manager.
    await expect(
      f.opsHead.mutation(api.crm.ops.createTourManager, {
        jobCardId: f.ids.jobCardId,
        name: "Meera Iyer",
        staffId: String(staffId),
      })
    ).rejects.toThrow("profile");
  });

  test("the profile keeps refusing a staff contact but accepts its own linked login", async () => {
    const t = harness();
    const f = await seed(t);
    await f.grant();
    const profile = await f.opsHead.query(api.crm.externalTourManagerProfiles.get, {
      profileId: f.ids.profileId,
    });
    if (!profile) {
      throw new Error("profile missing");
    }
    const edit = {
      active: true,
      destinations: profile.destinations,
      email: profile.email,
      experienceSummary: "Updated notes",
      experienceYears: profile.experienceYears,
      name: profile.name,
      phone: profile.phone,
      profileId: f.ids.profileId,
      reportedPastTours: profile.reportedPastTours,
      reportedPastToursNote: profile.reportedPastToursNote,
      reportedPastToursSource: profile.reportedPastToursSource,
    };
    await f.opsHead.mutation(api.crm.externalTourManagerProfiles.update, edit);
    await expect(
      f.opsHead.mutation(api.crm.externalTourManagerProfiles.update, {
        ...edit,
        email: "someone.else@external-tm.test",
      })
    ).rejects.toThrow("sign-in");
    await expect(
      f.opsHead.mutation(api.crm.externalTourManagerProfiles.create, {
        destinations: [],
        email: "ops-exec@external-tm.test",
        name: "Impersonator",
      })
    ).rejects.toThrow("staff member");
  });
});

/** Seeds visa, ticket, seat and PNR rows: one per batch on the external's Job Card, one elsewhere. */
async function seedTravelRows(t: ReturnType<typeof harness>, f: Awaited<ReturnType<typeof seed>>) {
  return await t.run(async (ctx) => {
    const travellers = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", f.ids.jobCardId))
      .collect();
    const byName = new Map(travellers.map((row) => [row.fullName, row._id]));
    const a1 = byName.get("Synthetic A One");
    const b1 = byName.get("Synthetic B One");
    if (!(a1 && b1)) {
      throw new Error("seed travellers missing");
    }
    const other = await ctx.db.insert("travellers", {
      ...SYNTHETIC_TRAVELLER,
      contactNo: "+910000000009",
      createdAt: NOW,
      fullName: "Synthetic Other Trip",
      jobCardId: f.ids.otherJobCardId,
      updatedAt: NOW,
    });
    for (const [travellerId, jobCardId] of [
      [a1, f.ids.jobCardId],
      [b1, f.ids.jobCardId],
      [other, f.ids.otherJobCardId],
    ] as const) {
      await ctx.db.insert("visaRecords", {
        createdAt: NOW,
        jobCardId,
        status: "Documents Pending",
        travellerId,
        updatedAt: NOW,
        updatedBy: "ops-head",
      });
      await ctx.db.insert("tickets", {
        createdAt: NOW,
        createdBy: "ops-head",
        jobCardId,
        paymentType: "Company Paid",
        ticketStatus: "Pending Issue",
        travellerId,
        updatedAt: NOW,
      });
      await ctx.db.insert("seatAllocations", {
        createdAt: NOW,
        createdBy: "ops-head",
        jobCardId,
        seatNumber: `S-${String(travellerId).slice(-3)}`,
        status: "Assigned",
        travellerId,
        updatedAt: NOW,
      });
      // A scan exists for every traveller, so a leak would show up as a flag or expiry.
      const storageId = await ctx.storage.store(new Blob(["synthetic-encrypted"]));
      await ctx.db.insert("passportDetails", {
        createdAt: NOW,
        createdBy: "ops-head",
        encryptedPayload: "synthetic",
        expiryDate: "2031-01-01",
        fileName: "passport.pdf",
        mimeType: "application/pdf",
        status: "Received",
        storageId,
        travellerId,
        updatedAt: NOW,
      });
      await ctx.db.patch("travellers", travellerId, {
        hasPassportScan: true,
        passportExpiryDate: "2031-01-01",
        passportStatus: "Received",
        visaRequired: true,
      });
    }
    for (const [pnrCode, jobCardId] of [
      ["PNR-OWN", f.ids.jobCardId],
      ["PNR-OTHER", f.ids.otherJobCardId],
    ] as const) {
      await ctx.db.insert("pnrs", {
        airline: "Synthetic Air",
        createdAt: NOW,
        createdBy: "ops-head",
        issuedSeats: 0,
        jobCardId,
        pnrCode,
        route: "BOM-DPS",
        totalSeats: 2,
        updatedAt: NOW,
      });
    }
    return { a1, b1, other };
  });
}

const PASSPORT_KEY = /passport/i;

/** Every entry of a row whose key names passport data. Only the status word may remain. */
function passportFields(entries: [string, unknown][]) {
  return entries.filter(([key]) => PASSPORT_KEY.test(key));
}

describe("visa, ticket and seat rows for an external tour manager", () => {
  test("their own group's rows only, with no passport data on any of them", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal(f.ids.batchA);
    await f.grant();
    await f.signInExternal();
    const rows = await seedTravelRows(t, f);
    const ext = f.external;

    const access = await ext.query(api.crm.staff.getMyPortalAccess, {});
    expect(access.permissions).toEqual(expect.arrayContaining(["view:ticketing", "view:visa"]));

    const visas = await ext.query(api.crm.visa.list, { paginationOpts: PAGE });
    expect(visas.page.map((row) => row.travellerId)).toEqual([rows.a1]);
    const withoutVisa = await ext.query(api.crm.visa.listTravellersWithoutVisa, {});
    expect(withoutVisa).toEqual([]);
    const tickets = await ext.query(api.crm.ticketing.listTickets, { paginationOpts: PAGE });
    expect(tickets.page.map((row) => row.travellerId)).toEqual([rows.a1]);
    const seats = await ext.query(api.crm.ticketing.listSeatAllocations, { paginationOpts: PAGE });
    expect(seats.page.map((row) => row.travellerId)).toEqual([rows.a1]);
    const pnrs = await ext.query(api.crm.ticketing.listPnrs, { paginationOpts: PAGE });
    expect(pnrs.page.map((row) => row.pnrCode)).toEqual(["PNR-OWN"]);
    // Another batch's row and another Job Card's row stay out, one at a time too.
    expect(
      await ext.query(api.crm.ticketing.getTicketListRow, {
        ticketId: String(tickets.page[0]?.id),
      })
    ).not.toBeNull();
    const otherTicket = await t.run(async (ctx) =>
      ctx.db
        .query("tickets")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", rows.other))
        .first()
    );
    expect(
      await ext.query(api.crm.ticketing.getTicketListRow, { ticketId: String(otherTicket?._id) })
    ).toBeNull();

    for (const row of [...visas.page, ...tickets.page, ...seats.page, ...pnrs.page]) {
      expect(passportFields(Object.entries(row))).toEqual([]);
    }
    const traveller = await ext.query(api.crm.travellers.getListRow, { travellerId: rows.a1 });
    expect(passportFields(Object.entries(traveller ?? {}))).toEqual([
      ["hasPassportScan", false],
      ["passportExpiryDate", ""],
      ["passportStatus", "Received"],
    ]);
    await expect(
      ext.query(api.crm.passport.getPassportMetadata, { travellerId: rows.a1 })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      ext.query(api.crm.fieldPassports.listFieldPassportAccess, {
        jobCardId: f.ids.jobCardId,
        paginationOpts: PAGE,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      ext.query(api.crm.travellers.listPage, {
        jobCardId: f.ids.jobCardId,
        paginationOpts: PAGE,
        passportExpiryUrgency: "ok",
        passportReferenceDate: "2026-11-07",
      })
    ).rejects.toThrow("FORBIDDEN");
    const center = await ext.query(api.crm.jobCards.getCommandCenter, {
      jobCardId: f.ids.jobCardId,
    });
    expect(center.visaRecords).toEqual([{ status: "Documents Pending" }]);
    expect(center.tickets).toEqual([{ ticketStatus: "Pending Issue" }]);
  });

  test("passenger, passport, visa and traveller exports stay refused", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    await seedTravelRows(t, f);
    const access = await f.external.query(api.crm.staff.getMyPortalAccess, {});
    for (const exportKind of ["passenger", "passport", "visa", "traveller"] as const) {
      await expect(
        t.query(internal.crm.imports.getPassengerExportSourcePage, {
          access,
          exportKind,
          jobCardId: f.ids.jobCardId,
          paginationOpts: PAGE,
        })
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        t.mutation(internal.crm.imports.beginPassengerExportOperation, {
          access,
          commandId: `export-${exportKind}`,
          exportKind,
          jobCardId: f.ids.jobCardId,
          leaseId: `lease-${exportKind}`,
        })
      ).rejects.toThrow("FORBIDDEN");
    }
  });
});

function completeReport() {
  const content = emptyPostTourReport({
    client: "Synthetic incentive group",
    destination: "Bali",
    endDate: "2026-11-15",
    guests: 3,
    programme: "MICE / Corporate",
    startDate: "2026-11-10",
    tourManager: "Meera Iyer",
  });
  content.performance = { handling: 5, itinerary: 4, overall: 4, satisfaction: 5, services: 3 };
  content.highlights = "Arrival support, temple visit, beach dinner.";
  content.suppliers = content.suppliers.map((supplier) => ({ ...supplier, rating: "na" }));
  content.closure = {
    additionalCost: "No",
    billing: "Completed",
    budgetVariation: "No",
    pendingDetails: "",
    refundPending: "No",
  };
  content.assessment = {
    learnings: "Allow transfer time and brief hosts early.",
    rating: 8,
    repeat: "Yes, with changes",
    status: "Good",
  };
  return content;
}

describe("post-tour feedback and the internal tour report", () => {
  async function withOtherTrip(t: ReturnType<typeof harness>) {
    const f = await seed(t);
    await f.assignExternal();
    // A staff Tour Manager runs the other trip and writes feedback, a report and gets responses.
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId: f.ids.otherJobCardId,
      name: "ignored for staff assignments",
      staffId: f.staffIds.get("tm-namesake"),
    });
    const staffTm = f.actor("tm-namesake");
    await staffTm.mutation(api.crm.postTourFeedback.create, {
      category: "overall",
      comment: "Other trip note",
      jobCardId: f.ids.otherJobCardId,
    });
    const saved = await staffTm.mutation(api.crm.postTourReports.saveDraft, {
      content: completeReport(),
      expectedRevision: 0,
      jobCardId: f.ids.otherJobCardId,
    });
    await staffTm.mutation(api.crm.postTourReports.submit, {
      expectedRevision: saved.revision,
      reportId: saved.id,
    });
    await t.run(async (ctx) => {
      for (const [jobCardId, respondentName] of [
        [f.ids.jobCardId, "Own trip guest"],
        [f.ids.otherJobCardId, "Other trip guest"],
      ] as const) {
        const requestId = await ctx.db.insert("travelerFeedbackRequests", {
          createdAt: NOW,
          createdBy: "ops-head",
          expiresAt: NOW + 86_400_000,
          jobCardId,
          publicTripLabel: "Synthetic trip",
          responseCount: 1,
          tokenHash: `${"a".repeat(63)}${respondentName.length % 10}`,
        });
        await ctx.db.insert("travelerFeedbackResponses", {
          comments: {
            food: "",
            hotel: "",
            improvements: "",
            itinerary: "",
            overall: "Lovely trip",
            whatWentWell: "",
          },
          createdAt: NOW,
          jobCardId,
          payloadHash: `payload-${respondentName}`,
          photoCount: 0,
          requestId,
          respondentEmail: "",
          respondentName,
          responseTokenHash: `token-${respondentName}`,
        });
      }
    });
    await f.grant();
    await f.signInExternal();
    return f;
  }

  test("written and read for their own trip only", async () => {
    const t = harness();
    const f = await withOtherTrip(t);
    const ext = f.external;

    const jobs = await ext.query(api.crm.postTourFeedback.listJobs, { paginationOpts: PAGE });
    expect(jobs.page.map((job) => [job.jobCode, job.canCompose])).toEqual([["JC-EXT-01", true]]);
    await ext.mutation(api.crm.postTourFeedback.create, {
      category: "overall",
      comment: "Group arrived on time",
      jobCardId: f.ids.jobCardId,
    });
    await expect(
      ext.mutation(api.crm.postTourFeedback.create, {
        category: "overall",
        comment: "Not my trip",
        jobCardId: f.ids.otherJobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");
    const notes = await ext.query(api.crm.postTourFeedback.list, { paginationOpts: PAGE });
    expect(notes.page.map((row) => [row.comment, row.canEdit])).toEqual([
      ["Group arrived on time", true],
    ]);
    const otherNotes = await ext.query(api.crm.postTourFeedback.list, {
      jobCardId: String(f.ids.otherJobCardId),
      paginationOpts: PAGE,
    });
    expect(otherNotes.page).toEqual([]);
    expect(
      await ext.query(api.crm.postTourFeedback.getJobContext, {
        jobCardId: String(f.ids.otherJobCardId),
      })
    ).toBeNull();

    const saved = await ext.mutation(api.crm.postTourReports.saveDraft, {
      content: completeReport(),
      expectedRevision: 0,
      jobCardId: f.ids.jobCardId,
    });
    await ext.mutation(api.crm.postTourReports.submit, {
      expectedRevision: saved.revision,
      reportId: saved.id,
    });
    const own = await ext.query(api.crm.postTourReports.workspace, {
      jobCardId: String(f.ids.jobCardId),
    });
    expect(own?.report?.status).toBe("submitted");
    // Submitted reports are a staff-wide read, but not for an external login.
    expect(
      await ext.query(api.crm.postTourReports.workspace, {
        jobCardId: String(f.ids.otherJobCardId),
      })
    ).toBeNull();
    await expect(
      ext.mutation(api.crm.postTourReports.saveDraft, {
        content: completeReport(),
        expectedRevision: 0,
        jobCardId: f.ids.otherJobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");

    const responses = await ext.query(api.crm.travelerFeedback.listResponses, {
      paginationOpts: PAGE,
    });
    expect(responses.page.map((row) => row.respondentName)).toEqual(["Own trip guest"]);
    const otherResponses = await ext.query(api.crm.travelerFeedback.listResponses, {
      jobCardId: String(f.ids.otherJobCardId),
      paginationOpts: PAGE,
    });
    expect(otherResponses.page).toEqual([]);
    // Issuing traveller feedback links stays with office staff.
    expect(
      await ext.query(api.crm.travelerFeedback.getRequestAccess, {
        jobCardId: String(f.ids.jobCardId),
      })
    ).toEqual({ canManage: false });
  });

  test("refused once access is switched off", async () => {
    const t = harness();
    const f = await withOtherTrip(t);
    await f.opsHead.mutation(api.crm.externalTourManagerProfiles.setAppAccess, {
      enabled: false,
      profileId: f.ids.profileId,
    });
    const ext = f.external;
    await expect(
      ext.mutation(api.crm.postTourFeedback.create, {
        category: "overall",
        comment: "After switch-off",
        jobCardId: f.ids.jobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      ext.mutation(api.crm.postTourReports.saveDraft, {
        content: completeReport(),
        expectedRevision: 0,
        jobCardId: f.ids.jobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      ext.query(api.crm.postTourReports.workspace, { jobCardId: String(f.ids.jobCardId) })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      ext.query(api.crm.travelerFeedback.listResponses, { paginationOpts: PAGE })
    ).rejects.toThrow("FORBIDDEN");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

/** Every ticket number on the shortcut list the caller sees. */
async function shortcutTicketLabels(actor: ReturnType<typeof actorFor>) {
  const shortcuts = await actor.query(api.crm.navShortcuts.list, {});
  return shortcuts.tickets.map((row) => row.label);
}

describe("security review of #307: batch scope for external assignments (M1)", () => {
  test("an external assignment on a Job Card in series must name its batch", async () => {
    const t = harness();
    const f = await seed(t);
    await expect(
      f.opsHead.mutation(api.crm.ops.createTourManager, {
        externalProfileId: f.ids.profileId,
        jobCardId: f.ids.jobCardId,
        name: "ignored",
      })
    ).rejects.toThrow("travel series");
    const { id } = await f.assignExternal(f.ids.batchA);
    // Clearing the batch, or re-assigning without one, is refused the same way.
    await expect(
      f.opsHead.mutation(api.crm.ops.updateTourManager, { tourManagerId: id, travelBatchId: "" })
    ).rejects.toThrow("travel series");
    // A Job Card without series still takes a batchless external assignment.
    await expect(
      f.opsHead.mutation(api.crm.ops.createTourManager, {
        externalProfileId: f.ids.profileId,
        jobCardId: f.ids.otherJobCardId,
        name: "ignored",
      })
    ).resolves.toBeDefined();
  });

  test("an existing batchless row on a Job Card in series opens no group until a batch is set", async () => {
    const t = harness();
    const f = await seed(t);
    // A row written before this rule (or by another path): no batch, linked to the profile.
    const rowId = await t.run(async (ctx) =>
      ctx.db.insert("tourManagerAssignments", {
        callingStatus: "Pending",
        createdAt: NOW,
        createdBy: "ops-head",
        externalProfileId: f.ids.profileId,
        jobCardId: f.ids.jobCardId,
        name: "Meera Iyer",
        status: "Assigned",
        updatedAt: NOW,
      })
    );
    await f.grant();
    await f.signInExternal();
    const rows = await seedTravelRows(t, f);
    const ext = f.external;
    // The Job Card itself is visible; no group inside it is.
    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);
    expect(await f.travellerNames()).toEqual([]);
    expect((await ext.query(api.crm.visa.list, { paginationOpts: PAGE })).page).toEqual([]);
    expect((await ext.query(api.crm.ticketing.listTickets, { paginationOpts: PAGE })).page).toEqual(
      []
    );
    await expect(
      ext.query(api.crm.fieldPassports.listFieldPassports, {
        jobCardId: f.ids.jobCardId,
        referenceNow: NOW,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      ext.mutation(internal.crm.fieldPassports.authorizeFieldPassportRead, { travellerId: rows.b1 })
    ).rejects.toThrow("FORBIDDEN");

    await f.opsHead.mutation(api.crm.ops.updateTourManager, {
      tourManagerId: String(rowId),
      travelBatchId: String(f.ids.batchA),
    });
    expect(await f.travellerNames()).toEqual(["Synthetic A One"]);
    const narrowed = await ext.query(api.crm.fieldPassports.listFieldPassports, {
      jobCardId: f.ids.jobCardId,
      referenceNow: NOW,
    });
    expect(narrowed.travellers.map((row) => row.travellerId)).toEqual([rows.a1]);
  });

  test("on a Job Card without series a batchless external assignment keeps the whole Job Card", async () => {
    const t = harness();
    const f = await seed(t);
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      externalProfileId: f.ids.profileId,
      jobCardId: f.ids.otherJobCardId,
      name: "ignored",
    });
    await f.grant();
    await f.signInExternal();
    const rows = await seedTravelRows(t, f);
    const page = await f.external.query(api.crm.travellers.listPage, {
      jobCardId: f.ids.otherJobCardId,
      paginationOpts: PAGE,
    });
    expect(page.page.map((row) => row.id)).toEqual([rows.other]);
  });
});

describe("security review of #307: employees keep their legacy name route (M2)", () => {
  test("granting an external login never ends a staff Tour Manager's name-only access", async () => {
    const t = harness();
    const f = await seed(t);
    // A plain Job Card (no series, no linked query) run on a name-only staff assignment.
    const { jobCardId, travellerId } = await t.run(async (ctx) => {
      const id = await ctx.db.insert("jobCards", {
        ...APP_PILOT_ON,
        clientName: "Synthetic legacy group",
        confirmedPax: 1,
        createdAt: NOW,
        createdBy: "accounts-owner",
        jobCode: "JC-EXT-LEGACY",
        queryType: "MICE",
        status: "Open",
        updatedAt: NOW,
      });
      const traveller = await ctx.db.insert("travellers", {
        ...SYNTHETIC_TRAVELLER,
        createdAt: NOW,
        fullName: "Synthetic Legacy Traveller",
        jobCardId: id,
        updatedAt: NOW,
      });
      return { jobCardId: id, travellerId: traveller };
    });
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId,
      name: STAFF["tm-namesake"].name,
    });
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      externalProfileId: f.ids.profileId,
      jobCardId,
      name: "ignored",
    });
    const staffTm = f.actor("tm-namesake");
    const travellerIds = async () =>
      (
        await staffTm.query(api.crm.travellers.listPage, { jobCardId, paginationOpts: PAGE })
      ).page.map((row) => row.id);
    expect(await travellerIds()).toEqual([travellerId]);

    await f.grant();
    const loginId = await f.externalStaffId();
    const job = await t.run((ctx) => ctx.db.get("jobCards", jobCardId));
    expect(job?.assignedTourManagerStaffIds).toEqual([]);
    expect(job?.externalTourManagerStaffIds).toEqual([loginId]);
    expect(job?.legacyTourManagerNames).toEqual(["meera iyer"]);
    // The employee keeps the Job Card and its travellers; the external login gets it too.
    expect(await travellerIds()).toEqual([travellerId]);
    expect(await staffTm.query(api.crm.jobCards.getDetail, { jobCardId })).not.toBeNull();
    await f.signInExternal();
    const external = await f.external.query(api.crm.travellers.listPage, {
      jobCardId,
      paginationOpts: PAGE,
    });
    expect(external.page.map((row) => row.id)).toEqual([travellerId]);
  });
});

describe("security review of #307: low findings", () => {
  test("L1: the ticket dashboard is refused to an external login", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    await seedTravelRows(t, f);
    await expect(
      f.external.query(api.crm.ticketing.dashboard, { referenceNow: NOW + 60_000 })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      f.opsHead.query(api.crm.ticketing.dashboard, { referenceNow: NOW + 60_000 })
    ).resolves.toBeDefined();
  });

  test("L2: the Accounts staff list needs Job Card management, so an external login gets none", async () => {
    const t = harness();
    const f = await seed(t);
    await t.run((ctx) =>
      ctx.db.insert("staffUsers", {
        active: true,
        createdAt: NOW,
        email: "accounts-head@external-tm.test",
        emailNormalized: "accounts-head@external-tm.test",
        name: "Synthetic Accounts Head",
        roles: ["Accounts Head"],
        updatedAt: NOW,
      })
    );
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    await expect(f.external.query(api.crm.staff.listAccountsForJobCards, {})).rejects.toThrow(
      "FORBIDDEN"
    );
    const forOps = await f.opsHead.query(api.crm.staff.listAccountsForJobCards, {});
    expect(forOps.map((row) => row.email)).toEqual(["accounts-head@external-tm.test"]);
  });

  test("L3: ticket shortcuts follow the caller's group", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal(f.ids.batchA);
    await f.opsHead.mutation(api.crm.ops.createTourManager, {
      jobCardId: f.ids.jobCardId,
      name: "ignored for staff assignments",
      staffId: f.staffIds.get("tm-namesake"),
      travelBatchId: f.ids.batchB,
    });
    await f.grant();
    await f.signInExternal();
    await t.run(async (ctx) => {
      const travellers = await ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", f.ids.jobCardId))
        .collect();
      for (const row of travellers) {
        await ctx.db.insert("tickets", {
          createdAt: NOW,
          createdBy: "ops-head",
          jobCardId: f.ids.jobCardId,
          paymentType: "Company Paid",
          ticketNumber: row.travelBatchId === f.ids.batchA ? "TKT-GROUP-A" : "TKT-GROUP-B",
          ticketStatus: "Pending Issue",
          travellerId: row._id,
          updatedAt: NOW,
        });
      }
    });
    const external = (await shortcutTicketLabels(f.external)).join(" | ");
    expect(external).toContain("TKT-GROUP-A");
    expect(external).not.toContain("TKT-GROUP-B");
    // The same narrowing applies to a staff Tour Manager on the other batch.
    const staff = (await shortcutTicketLabels(f.actor("tm-namesake"))).join(" | ");
    expect(staff).toContain("TKT-GROUP-B");
    expect(staff).not.toContain("TKT-GROUP-A");
    const office = (await shortcutTicketLabels(f.opsHead)).join(" | ");
    expect(office).toContain("TKT-GROUP-A");
    expect(office).toContain("TKT-GROUP-B");
  });

  test("L4: a break-glass Admin email is refused as an external sign-in", async () => {
    vi.stubEnv("PORTAL_BOOTSTRAP_ADMINS", "someone@else.test, MEERA.external@external-tm.test");
    const t = harness();
    const f = await seed(t);
    await expect(f.grant()).rejects.toThrow("reserved for an administrator");
    expect(await f.externalStaffId()).toBeNull();
  });

  test("L4: an external login never takes a sign-in account another staff record holds", async () => {
    const t = harness();
    const f = await seed(t);
    await f.grant();
    const loginId = await f.externalStaffId();
    if (!loginId) {
      throw new Error("no login");
    }
    // ops-exec's account id; provisioning would find it by email if the addresses matched.
    await expect(
      t.mutation(internal.crm.staff.linkAuthUserId, { authUserId: "ops-exec", staffId: loginId })
    ).rejects.toThrow("belongs to another staff record");
    expect(
      await t.query(internal.crm.staff.isAuthUserLinkedElsewhere, {
        authUserId: "ops-exec",
        staffId: loginId,
      })
    ).toBe(true);
    const login = await t.run((ctx) => ctx.db.get("staffUsers", loginId));
    expect(login?.authUserId).toBeUndefined();
  });
});

describe("security review of #307: informational fixes", () => {
  test("an external login previews its own expense receipt and no other document", async () => {
    const t = harness();
    const f = await seed(t);
    await f.assignExternal();
    await f.grant();
    await f.signInExternal();
    const rows = await seedTravelRows(t, f);
    const { id: ownExpense } = await f.external.mutation(api.crm.finance.createExpense, {
      amount: 100,
      category: "Meals",
      jobCardId: f.ids.jobCardId,
      paidBy: "Tour Manager",
    });
    const { id: officeExpense } = await f.opsHead.mutation(api.crm.finance.createExpense, {
      amount: 200,
      category: "Hotel",
      jobCardId: f.ids.jobCardId,
      paidBy: "Company",
    });
    const receipt = async (expenseId: Id<"expenseEntries">, createdBy: string) =>
      await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(
          new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })
        );
        const attachmentId = await ctx.db.insert("attachments", {
          createdAt: NOW,
          createdBy,
          entityId: String(expenseId),
          entityType: "expense",
          fileName: "receipt.jpg",
          mimeType: "image/jpeg",
          storageId,
        });
        await ctx.db.patch("expenseEntries", expenseId, { proofAttachmentId: attachmentId });
        return attachmentId;
      });
    const own = await receipt(ownExpense, EXTERNAL_SUBJECT);
    const office = await receipt(officeExpense, "ops-head");
    const status = await f.external.query(api.crm.documentPreview.getStatus, {
      sourceId: String(own),
      sourceType: "expenseAttachment",
    });
    expect(status.fileName).toBe("receipt.jpg");
    await expect(
      f.external.query(api.crm.documentPreview.getStatus, {
        sourceId: String(office),
        sourceType: "expenseAttachment",
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      f.external.query(api.crm.documentPreview.getStatus, {
        sourceId: String(rows.a1),
        sourceType: "passport",
      })
    ).rejects.toThrow("FORBIDDEN");
  });
});
