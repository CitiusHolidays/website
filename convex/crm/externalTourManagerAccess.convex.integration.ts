import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

// Synthetic data only. Owner decisions of 7 Nov 2026: the Operations Head (and directors/admins)
// give an external tour manager an app and CRM login from the profile; it reaches only the trips
// they are assigned to; no HR flows; access ends only when someone switches it off.

const NOW = Date.parse("2026-11-07T06:00:00Z");
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
  const assignExternal = (travelBatchId?: Id<"travelBatches">) =>
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
      "view:travellers",
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

  test("a profile assigned after the grant carries the login on the assignment", async () => {
    const t = harness();
    const f = await seed(t);
    await f.grant();
    await f.signInExternal();
    expect(await f.assignedJobCodes()).toEqual([]);
    await f.assignExternal();
    expect(await f.assignedJobCodes()).toEqual(["JC-EXT-01"]);
    expect(await f.travellerNames()).toEqual(["Synthetic A One", "Synthetic B One"]);
  });

  test("no staff directory, leave, queries, dashboard, staff travel or post-tour feedback", async () => {
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
      () => ext.query(api.crm.postTourFeedback.list, { paginationOpts: PAGE }),
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
