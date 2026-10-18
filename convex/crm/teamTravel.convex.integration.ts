import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const NOW = Date.parse("2026-10-18T12:00:00.000Z");
const paginationOpts = { cursor: null, numItems: 30 };
const travelPagination = { paginationOpts, referenceDate: "2026-10-18" };
const profileInput = {
  destinations: ["Jaipur", "Goa", "jaipur"],
  email: "external@example.test",
  experienceSummary: "Group travel coordination",
  experienceYears: 4,
  name: "Synthetic External Manager",
  phone: "+91 98123 45678",
  reportedPastTours: 12,
  reportedPastToursNote: "Self-reported during supplier onboarding",
  reportedPastToursSource: "self_reported" as const,
};

function harness() {
  return convexTest({ modules, schema, transactionLimits: true });
}

async function seed(t: ReturnType<typeof harness>) {
  const identities = [
    { id: "employee", role: "Sales" as const },
    { id: "other", role: "Sales" as const },
    { id: "head", role: "Operations Head" as const },
    { id: "operations", role: "Operations" as const },
    { id: "hr", role: "HR" as const },
    { id: "tm", role: "Tour Manager" as const },
  ];
  const staffIds = await t.run(async (ctx) => {
    const result: Record<string, Id<"staffUsers">> = {};
    for (const actor of identities) {
      await ctx.db.insert("authIdentityLinks", {
        canonicalAuthUserId: `https://team-travel.test|${actor.id}`,
        createdAt: NOW,
        legacyAuthUserId: actor.id,
        status: "linked",
        updatedAt: NOW,
      });
      result[actor.id] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: actor.id,
        createdAt: NOW,
        email: `${actor.id}@citius-e2e.test`,
        emailNormalized: `${actor.id}@citius-e2e.test`,
        mobile: actor.id === "tm" ? "+91 99999 11111" : undefined,
        name: `Synthetic ${actor.id}`,
        roles: [actor.role],
        updatedAt: NOW,
      });
    }
    return result;
  });
  const jobCardId = await t.run((ctx) =>
    ctx.db.insert("jobCards", {
      clientName: "Synthetic client",
      confirmedPax: 20,
      createdAt: NOW,
      createdBy: "some-owner",
      destination: "Jaipur",
      jobCode: "JC-TEAM-TRAVEL",
      status: "Open",
      tourManagerName: "Synthetic tm",
      travelEndDate: "2026-10-25",
      travelStartDate: "2026-10-20",
      updatedAt: NOW,
    })
  );
  const actor = (id: string) =>
    t.withIdentity({
      email: `${id}@citius-e2e.test`,
      issuer: "https://team-travel.test",
      subject: id,
      tokenIdentifier: `https://team-travel.test|${id}`,
    });
  return { actor, jobCardId, staffIds };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("employee travel schedule", () => {
  test("staff record, update and cancel their own shared travel without changing leave", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await fixture.actor("employee").mutation(api.crm.staffTravel.create, {
      destination: "Goa",
      endDate: "2026-10-20",
      startDate: "2026-10-18",
    });
    const shared = await fixture.actor("other").query(api.crm.staffTravel.list, travelPagination);
    expect(shared.page).toHaveLength(1);
    expect(shared.page[0]).toMatchObject({
      canManage: false,
      destination: "Goa",
      id,
      isCurrent: true,
      jobCardId: null,
      jobCode: "",
      personName: "Synthetic employee",
    });
    expect(Object.keys(shared.page[0]).sort()).toEqual([
      "canManage",
      "createdAt",
      "destination",
      "endDate",
      "id",
      "isCurrent",
      "jobCardId",
      "jobCode",
      "personName",
      "staffId",
      "startDate",
      "status",
      "updatedAt",
    ]);
    await expect(
      fixture.actor("other").mutation(api.crm.staffTravel.update, {
        destination: "Mumbai",
        endDate: "2026-10-20",
        startDate: "2026-10-18",
        travelId: id,
      })
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      fixture.actor("other").mutation(api.crm.staffTravel.cancel, { travelId: id })
    ).rejects.toThrow("FORBIDDEN");
    await fixture.actor("employee").mutation(api.crm.staffTravel.update, {
      destination: "Mumbai",
      endDate: "2026-10-21",
      startDate: "2026-10-19",
      travelId: id,
    });
    expect(
      (await fixture.actor("other").query(api.crm.staffTravel.list, travelPagination)).page[0]
    ).toMatchObject({ destination: "Mumbai", isCurrent: false });
    await fixture.actor("employee").mutation(api.crm.staffTravel.cancel, { travelId: id });
    await fixture.actor("employee").mutation(api.crm.staffTravel.cancel, { travelId: id });
    expect(
      (await fixture.actor("other").query(api.crm.staffTravel.list, travelPagination)).page
    ).toEqual([]);
    expect(
      (await fixture.actor("employee").query(api.crm.staffTravel.listMine, travelPagination))
        .page[0]
    ).toMatchObject({ status: "cancelled" });
    await t.run(async (ctx) => {
      expect(await ctx.db.query("staffLeaveRecords").collect()).toEqual([]);
    });
  });

  test("management roles can record others' plans while ordinary operations cannot impersonate staff", async () => {
    const t = harness();
    const fixture = await seed(t);
    for (const actor of ["head", "hr"]) {
      expect(await fixture.actor(actor).query(api.crm.staffTravel.getAccess)).toMatchObject({
        canManageOthers: true,
      });
      const { id } = await fixture.actor(actor).mutation(api.crm.staffTravel.create, {
        destination: "Delhi",
        endDate: "2026-10-20",
        staffId: fixture.staffIds.other,
        startDate: "2026-10-20",
      });
      await fixture.actor(actor).mutation(api.crm.staffTravel.cancel, { travelId: id });
    }
    for (const actor of ["employee", "operations"]) {
      expect(await fixture.actor(actor).query(api.crm.staffTravel.getAccess)).toMatchObject({
        canManageOthers: false,
      });
      await expect(
        fixture.actor(actor).mutation(api.crm.staffTravel.create, {
          destination: "Delhi",
          endDate: "2026-10-20",
          staffId: fixture.staffIds.other,
          startDate: "2026-10-20",
        })
      ).rejects.toThrow("FORBIDDEN");
      await expect(
        fixture.actor(actor).query(api.crm.staffTravel.listPeople, { paginationOpts })
      ).rejects.toThrow("FORBIDDEN");
    }
    const people = await fixture
      .actor("hr")
      .query(api.crm.staffTravel.listPeople, { paginationOpts });
    expect(people.page).toHaveLength(6);
    expect(Object.keys(people.page[0]).sort()).toEqual(["id", "name"]);
  });

  test("validates real dates, rejects inactive or customer actors, and excludes past trips", async () => {
    const t = harness();
    const fixture = await seed(t);
    for (const [startDate, endDate] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-10-20", "2026-10-19"],
      ["18/10/2026", "2026-10-20"],
    ]) {
      await expect(
        fixture
          .actor("employee")
          .mutation(api.crm.staffTravel.create, { destination: "Delhi", endDate, startDate })
      ).rejects.toThrow();
    }
    await fixture.actor("employee").mutation(api.crm.staffTravel.create, {
      destination: "Past plan",
      endDate: "2026-09-02",
      startDate: "2026-09-01",
    });
    expect(
      (await fixture.actor("other").query(api.crm.staffTravel.list, travelPagination)).page
    ).toEqual([]);
    expect(
      (await fixture.actor("employee").query(api.crm.staffTravel.listMine, travelPagination)).page
    ).toHaveLength(1);
    await expect(t.query(api.crm.staffTravel.list, travelPagination)).rejects.toThrow("FORBIDDEN");
    await expect(
      fixture.actor("customer").query(api.crm.staffTravel.list, travelPagination)
    ).rejects.toThrow("FORBIDDEN");
    await t.run((ctx) => ctx.db.patch("staffUsers", fixture.staffIds.employee, { active: false }));
    await expect(
      fixture.actor("employee").mutation(api.crm.staffTravel.create, {
        destination: "Delhi",
        endDate: "2026-10-21",
        startDate: "2026-10-20",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  test("shared travel preserves optional JC links only for viewers with ordinary JC access", async () => {
    const t = harness();
    const fixture = await seed(t);
    const values = {
      destination: "Jaipur",
      endDate: "2026-10-25",
      jobCardId: fixture.jobCardId,
      startDate: "2026-10-20",
    };
    expect(
      (await fixture.actor("hr").query(api.crm.staffTravel.listJobOptions, { paginationOpts })).page
    ).toEqual([]);
    expect(
      (await fixture.actor("tm").query(api.crm.staffTravel.listJobOptions, { paginationOpts })).page
    ).toHaveLength(1);
    await expect(
      fixture.actor("employee").mutation(api.crm.staffTravel.create, values)
    ).rejects.toThrow("not assigned");
    const { id } = await fixture.actor("tm").mutation(api.crm.staffTravel.create, values);
    for (const actor of ["hr", "operations", "other"]) {
      expect(
        (await fixture.actor(actor).query(api.crm.staffTravel.list, travelPagination)).page[0]
      ).toMatchObject({ destination: "Jaipur", id, jobCardId: null, jobCode: "" });
    }
    for (const actor of ["tm", "head"]) {
      expect(
        (await fixture.actor(actor).query(api.crm.staffTravel.list, travelPagination)).page[0]
      ).toMatchObject({ jobCardId: fixture.jobCardId, jobCode: "JC-TEAM-TRAVEL" });
    }
    await expect(
      fixture.actor("hr").query(api.crm.jobCards.getDetail, { jobCardId: fixture.jobCardId })
    ).rejects.toThrow("FORBIDDEN");
    await fixture
      .actor("tm")
      .mutation(api.crm.staffTravel.update, { ...values, jobCardId: "", travelId: id });
    expect(
      (await fixture.actor("hr").query(api.crm.staffTravel.list, travelPagination)).page[0]
        .jobCardId
    ).toBeNull();
  });

  test("reference dates update current and upcoming travel without relying on the server clock", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await fixture.actor("employee").mutation(api.crm.staffTravel.create, {
      destination: "Goa",
      endDate: "2026-10-20",
      startDate: "2026-10-19",
    });
    const asEmployee = fixture.actor("employee");
    for (const referenceDate of ["2026-10-18", "2026-10-19"]) {
      const expected = { id, isCurrent: referenceDate === "2026-10-19" };
      expect(
        (await asEmployee.query(api.crm.staffTravel.list, { paginationOpts, referenceDate }))
          .page[0]
      ).toMatchObject(expected);
      expect(
        (await asEmployee.query(api.crm.staffTravel.listMine, { paginationOpts, referenceDate }))
          .page[0]
      ).toMatchObject(expected);
    }
    expect(
      (
        await asEmployee.query(api.crm.staffTravel.list, {
          paginationOpts,
          referenceDate: "2026-10-21",
        })
      ).page
    ).toEqual([]);
    expect(
      (
        await asEmployee.query(api.crm.staffTravel.listMine, {
          paginationOpts,
          referenceDate: "2026-10-21",
        })
      ).page[0]
    ).toMatchObject({ id, isCurrent: false });
    await expect(
      asEmployee.query(api.crm.staffTravel.list, { paginationOpts, referenceDate: "2026-02-30" })
    ).rejects.toThrow("valid travel dates");
  });
});

describe("reusable external tour-manager profiles", () => {
  test("linked assignment history uses its travel-series destination, dates and label", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id: profileId } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, profileInput);
    const travelBatchId = await t.run((ctx) =>
      ctx.db.insert("travelBatches", {
        batchCode: "SERIES-2",
        batchReference: "JC-TEAM-TRAVEL / Series 2",
        confirmedPax: 10,
        createdAt: NOW,
        createdBy: "head",
        destination: "Goa",
        jobCardId: fixture.jobCardId,
        status: "Open",
        travelEndDate: "2026-10-24",
        travelStartDate: "2026-10-22",
        updatedAt: NOW,
      })
    );
    await fixture.actor("head").mutation(api.crm.ops.createTourManager, {
      externalProfileId: profileId,
      jobCardId: fixture.jobCardId,
      name: profileInput.name,
      travelBatchId,
    });
    const history = await fixture
      .actor("head")
      .query(api.crm.externalTourManagerProfiles.listAssignments, { paginationOpts, profileId });
    expect(history.page[0]).toMatchObject({
      destination: "Goa",
      jobCode: "JC-TEAM-TRAVEL",
      travelBatchId,
      travelBatchLabel: "JC-TEAM-TRAVEL / Series 2",
      travelEndDate: "2026-10-24",
      travelStartDate: "2026-10-22",
    });
  });

  test("inactive profiles allow existing assignment maintenance while rejecting new assignment scope", async () => {
    const t = harness();
    const fixture = await seed(t);
    const head = fixture.actor("head");
    const { id: profileId } = await head.mutation(
      api.crm.externalTourManagerProfiles.create,
      profileInput
    );
    const { id: assignmentId } = await head.mutation(api.crm.ops.createTourManager, {
      externalProfileId: profileId,
      jobCardId: fixture.jobCardId,
      name: profileInput.name,
    });
    await head.mutation(api.crm.externalTourManagerProfiles.update, {
      ...profileInput,
      active: false,
      profileId,
    });
    await head.mutation(api.crm.ops.updateTourManager, {
      externalProfileId: profileId,
      jobCardId: fixture.jobCardId,
      notes: "Corrected existing assignment notes",
      tourManagerId: assignmentId,
    });
    expect(await t.run((ctx) => ctx.db.get("tourManagerAssignments", assignmentId))).toMatchObject({
      externalProfileId: profileId,
      notes: "Corrected existing assignment notes",
    });
    const travelBatchId = await t.run((ctx) =>
      ctx.db.insert("travelBatches", {
        batchCode: "SERIES-2",
        batchReference: "JC-TEAM-TRAVEL / Series 2",
        confirmedPax: 10,
        createdAt: NOW,
        createdBy: "head",
        jobCardId: fixture.jobCardId,
        status: "Open",
        updatedAt: NOW,
      })
    );
    await expect(
      head.mutation(api.crm.ops.updateTourManager, {
        tourManagerId: assignmentId,
        travelBatchId,
      })
    ).rejects.toThrow("Active external tour manager profile not found");
    await head.mutation(api.crm.ops.updateTourManager, {
      jobCardId: fixture.jobCardId,
      status: "Inactive",
      tourManagerId: assignmentId,
    });
    await expect(
      head.mutation(api.crm.ops.updateTourManager, {
        status: "Assigned",
        tourManagerId: assignmentId,
      })
    ).rejects.toThrow("Active external tour manager profile not found");
  });

  test("uses existing read/write roles and distinguishes claimed experience from linked assignments", async () => {
    const t = harness();
    const fixture = await seed(t);
    await expect(
      fixture.actor("operations").mutation(api.crm.externalTourManagerProfiles.create, profileInput)
    ).rejects.toThrow("FORBIDDEN");
    const { id } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, profileInput);
    const profile = await fixture
      .actor("operations")
      .query(api.crm.externalTourManagerProfiles.get, { profileId: id });
    expect(profile).toMatchObject({
      canManage: false,
      destinations: ["jaipur", "Goa"],
      name: "Synthetic External Manager",
      reportedPastTours: 12,
      reportedPastToursSource: "self_reported",
    });
    expect(
      await fixture.actor("head").query(api.crm.externalTourManagerProfiles.getAccess)
    ).toEqual({ canManage: true });
    await expect(
      fixture.actor("hr").query(api.crm.externalTourManagerProfiles.list, { paginationOpts })
    ).rejects.toThrow("FORBIDDEN");
    expect(
      (
        await fixture.actor("head").query(api.crm.externalTourManagerProfiles.listAssignments, {
          paginationOpts,
          profileId: id,
        })
      ).page
    ).toEqual([]);
    const assignment = await fixture.actor("head").mutation(api.crm.ops.createTourManager, {
      email: "forged@example.test",
      externalProfileId: id,
      jobCardId: fixture.jobCardId,
      name: "Forged name",
      phone: "fake",
    });
    await expect(
      fixture.actor("head").mutation(api.crm.ops.createTourManager, {
        externalProfileId: id,
        jobCardId: fixture.jobCardId,
        name: "Duplicate profile assignment",
      })
    ).rejects.toThrow("already linked");
    const rows = await fixture
      .actor("head")
      .query(api.crm.ops.listTourManagers, { paginationOpts });
    expect(rows.page.find((row) => row.id === assignment.id)).toMatchObject({
      email: "external@example.test",
      externalProfileId: id,
      name: "Synthetic External Manager",
      phone: "+91 98123 45678",
      staffId: "",
    });
    expect(
      (
        await fixture.actor("head").query(api.crm.externalTourManagerProfiles.listAssignments, {
          paginationOpts,
          profileId: id,
        })
      ).page[0]
    ).toMatchObject({ id: assignment.id, jobCode: "JC-TEAM-TRAVEL" });
    expect(
      (
        await fixture.actor("tm").query(api.crm.externalTourManagerProfiles.listAssignments, {
          paginationOpts,
          profileId: id,
        })
      ).page
    ).toEqual([]);
  });

  test("deduplicates normalized email and phone, including inactive profiles and existing staff identities", async () => {
    const t = harness();
    const fixture = await seed(t);
    const { id } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, profileInput);
    await expect(
      fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, {
        ...profileInput,
        email: " EXTERNAL@EXAMPLE.TEST ",
        phone: "+91 88888 11111",
      })
    ).rejects.toThrow("already exists");
    await expect(
      fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, {
        ...profileInput,
        email: "other@example.test",
        phone: "919812345678",
      })
    ).rejects.toThrow("already exists");
    await fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.update, {
      ...profileInput,
      active: false,
      profileId: id,
    });
    expect(
      (
        await fixture
          .actor("head")
          .query(api.crm.externalTourManagerProfiles.list, { paginationOpts })
      ).page
    ).toEqual([]);
    expect(
      (
        await fixture.actor("head").query(api.crm.externalTourManagerProfiles.list, {
          includeInactive: true,
          paginationOpts,
        })
      ).page
    ).toHaveLength(1);
    await expect(
      fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, profileInput)
    ).rejects.toThrow("already exists");
    await expect(
      fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, {
        ...profileInput,
        email: "tm@citius-e2e.test",
        phone: "",
      })
    ).rejects.toThrow("existing staff");
    await expect(
      fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, {
        ...profileInput,
        email: "new@example.test",
        phone: "919999911111",
      })
    ).rejects.toThrow("existing staff");
    await expect(
      fixture
        .actor("head")
        .mutation(api.crm.ops.createTourManager, { externalProfileId: id, name: "Inactive" })
    ).rejects.toThrow("not found");
  });

  test("validates contact and claimed counts, and links existing assignments without dual identities", async () => {
    const t = harness();
    const fixture = await seed(t);
    for (const input of [
      { ...profileInput, email: "", phone: "" },
      { ...profileInput, email: "bad", phone: "" },
      { ...profileInput, experienceYears: -1 },
      { ...profileInput, reportedPastTours: 1.5 },
      { ...profileInput, reportedPastToursNote: "" },
    ]) {
      await expect(
        fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, input)
      ).rejects.toThrow();
    }
    const { id } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, profileInput);
    await expect(
      fixture.actor("head").mutation(api.crm.ops.createTourManager, {
        externalProfileId: id,
        name: "Both",
        staffId: fixture.staffIds.tm,
      })
    ).rejects.toThrow("either");
    const assignment = await fixture.actor("head").mutation(api.crm.ops.createTourManager, {
      jobCardId: fixture.jobCardId,
      name: "Legacy external",
    });
    await fixture.actor("head").mutation(api.crm.ops.updateTourManager, {
      externalProfileId: id,
      name: "Forged",
      tourManagerId: assignment.id,
    });
    await fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.update, {
      ...profileInput,
      active: true,
      name: "Synthetic tm",
      profileId: id,
    });
    await fixture.actor("head").mutation(api.crm.ops.updateTourManager, {
      externalProfileId: id,
      tourManagerId: assignment.id,
    });
    expect(
      await fixture
        .actor("tm")
        .query(api.crm.postTourFeedback.getJobContext, { jobCardId: fixture.jobCardId })
    ).toMatchObject({ canCompose: false });
    await expect(
      fixture.actor("tm").mutation(api.crm.postTourFeedback.create, {
        category: "overall",
        comment: "Wrong identity",
        jobCardId: fixture.jobCardId,
      })
    ).rejects.toThrow("FORBIDDEN");
    expect(
      (
        await fixture.actor("head").query(api.crm.externalTourManagerProfiles.listAssignments, {
          paginationOpts,
          profileId: id,
        })
      ).page
    ).toHaveLength(1);
    await fixture.actor("head").mutation(api.crm.ops.updateTourManager, {
      staffId: fixture.staffIds.tm,
      tourManagerId: assignment.id,
    });
    expect(
      (
        await fixture.actor("head").query(api.crm.externalTourManagerProfiles.listAssignments, {
          paginationOpts,
          profileId: id,
        })
      ).page
    ).toEqual([]);
  });

  test("fails closed when staff phone identity verification exceeds its bounded directory read", async () => {
    const t = harness();
    const fixture = await seed(t);
    await t.run(async (ctx) => {
      await Promise.all(
        Array.from({ length: 501 }, (_, index) =>
          ctx.db.insert("staffUsers", {
            active: true,
            createdAt: NOW,
            email: `bounded-${index}@example.test`,
            emailNormalized: `bounded-${index}@example.test`,
            name: `Bounded staff ${index}`,
            roles: ["Sales"],
            updatedAt: NOW,
          })
        )
      );
    });
    await expect(
      fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.create, profileInput)
    ).rejects.toThrow("verification exceeded its bound");
    const { id } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, { ...profileInput, phone: "" });
    expect(
      await fixture.actor("head").query(api.crm.externalTourManagerProfiles.get, { profileId: id })
    ).toMatchObject({ phone: "" });
  });

  test("E2E cleanup removes owned travel/profiles/assignments and restores reused JC and profile fixtures", async () => {
    vi.stubEnv("E2E_PROVISIONING_TARGET", "development");
    vi.stubEnv("E2E_SEED_SECRET", "integration-secret");
    vi.stubEnv("E2E_TARGET_ID", "development-integration");
    const t = harness();
    const fixture = await seed(t);
    const { id: reusableId } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, profileInput);
    const original = await fixture
      .actor("head")
      .query(api.crm.externalTourManagerProfiles.get, { profileId: reusableId });
    const originalJob = await t.run((ctx) => ctx.db.get("jobCards", fixture.jobCardId));
    const runId = "018fbe7a-62c8-7f35-9d2f-2d3f53f9e222";
    await t.mutation(internal.crm.e2eRunOwnership.begin, {
      authUserIds: ["https://team-travel.test|head"],
      runId,
      targetId: "development-integration",
    });
    await fixture.actor("head").mutation(api.crm.externalTourManagerProfiles.update, {
      ...profileInput,
      active: true,
      experienceYears: 10,
      profileId: reusableId,
    });
    const { id: profileId } = await fixture
      .actor("head")
      .mutation(api.crm.externalTourManagerProfiles.create, {
        ...profileInput,
        email: "owned@example.test",
        phone: "",
      });
    const { id: assignmentId } = await fixture
      .actor("head")
      .mutation(api.crm.ops.createTourManager, {
        externalProfileId: profileId,
        jobCardId: fixture.jobCardId,
        name: "Owned",
      });
    const { id: travelId } = await fixture.actor("head").mutation(api.crm.staffTravel.create, {
      destination: "Jaipur",
      endDate: "2026-10-25",
      startDate: "2026-10-20",
    });
    const { id: otherTravelId } = await fixture
      .actor("other")
      .mutation(api.crm.staffTravel.create, {
        destination: "Goa",
        endDate: "2026-10-23",
        startDate: "2026-10-22",
      });
    expect(
      await t.mutation(internal.crm.e2eRunOwnership.cleanupPage, {
        pageSize: 50,
        runId,
        targetId: "development-integration",
      })
    ).toMatchObject({ complete: true, residualCount: 0 });
    expect(
      await fixture.actor("head").query(api.crm.externalTourManagerProfiles.get, { profileId })
    ).toBeNull();
    expect(
      await fixture
        .actor("head")
        .query(api.crm.externalTourManagerProfiles.get, { profileId: reusableId })
    ).toEqual(original);
    expect(
      (await fixture.actor("other").query(api.crm.staffTravel.list, travelPagination)).page.map(
        (row) => row.id
      )
    ).toEqual([otherTravelId]);
    await t.run(async (ctx) => {
      expect(await ctx.db.get("staffTravelPlans", travelId)).toBeNull();
      expect(await ctx.db.get("tourManagerAssignments", assignmentId)).toBeNull();
      expect(await ctx.db.get("jobCards", fixture.jobCardId)).toEqual(originalJob);
    });
  });
});
