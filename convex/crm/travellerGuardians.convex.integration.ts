import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import type { internalPassengerImportRow } from "./importRowValidators";

type ImportRow = Infer<typeof internalPassengerImportRow>;

const ISSUER = "https://guardian-links.test";
const NOW = Date.parse("2026-11-06T09:00:00Z");

const staff = [
  { id: "ops", roles: ["Operations Head"] },
  { id: "viewer", roles: ["Sales"] },
  { id: "outsider", roles: ["Operations"] },
  { id: "tm", roles: ["Tour Manager"] },
] as const;

async function setup() {
  const t = convexTest({ modules, schema });
  const ids = await t.run(async (ctx) => {
    const staffIds: Record<string, Id<"staffUsers">> = {};
    for (const member of staff) {
      staffIds[member.id] = await ctx.db.insert("staffUsers", {
        active: true,
        authUserId: `${ISSUER}|${member.id}`,
        createdAt: NOW,
        email: `${member.id}@guardian-links.test`,
        emailNormalized: `${member.id}@guardian-links.test`,
        name: `Synthetic ${member.id}`,
        roles: [...member.roles],
        updatedAt: NOW,
      });
    }
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic family group",
      confirmedPax: 6,
      createdAt: NOW,
      createdBy: `${ISSUER}|ops`,
      jobCode: "JC/GUARD/001/26-27",
      operationsOwnerId: staffIds.ops,
      status: "Open",
      travelStartDate: "2026-12-01",
      updatedAt: NOW,
    });
    const otherJobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic other group",
      confirmedPax: 1,
      createdAt: NOW,
      createdBy: `${ISSUER}|ops`,
      jobCode: "JC/GUARD/002/26-27",
      status: "Open",
      updatedAt: NOW,
    });
    return { jobCardId, otherJobCardId, staffIds };
  });
  const actor = (id: string) =>
    t.withIdentity({
      email: `${id}@guardian-links.test`,
      issuer: ISSUER,
      subject: id,
      tokenIdentifier: `${ISSUER}|${id}`,
    });
  return { ...ids, actor, ops: actor("ops"), t };
}

type Harness = Awaited<ReturnType<typeof setup>>;

function importRow(index: number, fields: Partial<ImportRow> & { fullName: string }): ImportRow {
  return {
    foodPreference: "Veg",
    guestType: "Client",
    id: `Sheet1:${index + 2}`,
    importKey: `row-${index}`,
    importKind: "passenger",
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: index + 2,
    sourceSheet: "Sheet1",
    visaRequired: false,
    ...fields,
  };
}

/** Commits rows one by one as the import action does, then runs the final-batch sweep. */
async function importSheet(f: Harness, rows: ImportRow[]) {
  const access = await f.ops.query(api.crm.staff.getMyPortalAccess, {});
  if (!access) {
    throw new Error("missing access");
  }
  const travellerIds: Id<"travellers">[] = [];
  for (const row of rows) {
    const result = await f.t.mutation(internal.crm.imports.commitPassengerImportRow, {
      access,
      jobCardId: f.jobCardId,
      row,
    });
    travellerIds.push(result.travellerId);
  }
  const links = await f.t.mutation(internal.crm.imports.resolveImportedGuardianLinks, {
    access,
    jobCardId: f.jobCardId,
  });
  return { links, travellerIds };
}

const row = (f: Harness, id: Id<"travellers">, who = f.ops) =>
  who.query(api.crm.travellers.getListRow, { travellerId: id });

const travellerDetails = {
  foodPreference: "Veg",
  guestType: "Client",
  paymentType: "Company Paid",
  roomType: "Twin",
  visaRequired: false,
} as const;

const named = (name: string, contact?: string) => [contact ? { contact, name } : { name }];

describe("linking minors to guardians on import", () => {
  test("links a minor named before or after their parent in the sheet", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, {
        birthDate: "2014-03-02",
        fullName: "Kavya Iyer",
        guardians: named("Meera Iyer"),
      }),
      importRow(1, { birthDate: "1984-05-10", fullName: "Meera Iyer" }),
      importRow(2, { ageYears: 9, fullName: "Rohan Iyer", guardians: named("meera iyer") }),
    ]);
    const [kavya, meera, rohan] = travellerIds;

    expect(links).toEqual({ linked: 2, warnings: [] });
    expect(await row(f, kavya)).toMatchObject({
      guardianSheetReferences: [],
      guardians: [{ fullName: "Meera Iyer", id: meera }],
      isMinor: true,
    });
    const parent = await row(f, meera);
    expect(parent).toMatchObject({ guardians: [], isMinor: false });
    expect(parent?.guardianOf.map((minor) => minor.id).sort()).toEqual([kavya, rohan].sort());
  });

  test("links both parents, each matched on its own", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, {
        ageYears: 11,
        fullName: "Kavya Iyer",
        guardians: [{ contact: "+91 98765 00001", name: "Meera Iyer" }, { name: "Ravi Iyer" }],
      }),
      importRow(1, { contactNo: "+91 98765 00001", fullName: "Meera Iyer", minorStatus: "adult" }),
      importRow(2, { fullName: "Ravi Iyer", minorStatus: "adult" }),
    ]);
    const [kavya, meera, ravi] = travellerIds;

    expect(links).toEqual({ linked: 2, warnings: [] });
    expect(await row(f, kavya)).toMatchObject({
      guardians: [
        { fullName: "Meera Iyer", id: meera },
        { fullName: "Ravi Iyer", id: ravi },
      ],
    });
    expect((await row(f, ravi))?.guardianOf).toEqual([{ fullName: "Kavya Iyer", id: kavya }]);
  });

  test("links the parent that matches and reports the one that does not", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, {
        ageYears: 11,
        fullName: "Kavya Iyer",
        guardians: [{ name: "Meera Iyer" }, { name: "Nobody Here" }],
      }),
      importRow(1, { fullName: "Meera Iyer", minorStatus: "adult" }),
    ]);
    const [kavya, meera] = travellerIds;

    expect(links.linked).toBe(1);
    expect(links.warnings).toEqual([
      {
        fullName: "Kavya Iyer",
        message: "Guardian Nobody Here not linked: no traveller with that name on this Job Card.",
        sourceRowNumber: 2,
        sourceSheet: "Sheet1",
        travellerId: kavya,
      },
    ]);
    expect(await row(f, kavya)).toMatchObject({
      guardianSheetReferences: ["Nobody Here"],
      guardians: [{ id: meera }],
    });
  });

  test("measures age on the trip start, not the import date", async () => {
    const f = await setup();
    const { travellerIds } = await importSheet(f, [
      // 18 on 2026-11-30, before the 2026-12-01 departure: an adult for this trip.
      importRow(0, { birthDate: "2008-11-30", fullName: "Dev Shah" }),
      importRow(1, { birthDate: "2008-12-02", fullName: "Tara Shah" }),
    ]);
    expect(await row(f, travellerIds[0])).toMatchObject({ isMinor: false });
    expect(await row(f, travellerIds[1])).toMatchObject({ isMinor: true });
  });

  test("reports ambiguous, unknown and ineligible guardians instead of guessing", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, { contactNo: "+91 98765 00001", fullName: "Anil Rao", minorStatus: "adult" }),
      importRow(1, { contactNo: "+91 98765 00002", fullName: "Anil Rao", importKey: "row-1b" }),
      importRow(2, { fullName: "Isha Rao", guardians: named("Anil Rao"), minorStatus: "minor" }),
      importRow(3, { fullName: "Neel Rao", guardians: named("Nobody Here"), minorStatus: "minor" }),
      importRow(4, { fullName: "Asha Rao", guardians: named("Anil Rao") }),
      importRow(5, { fullName: "Mira Rao", guardians: named("Isha Rao"), minorStatus: "minor" }),
      importRow(6, {
        fullName: "Ved Rao",
        guardians: named("Anil Rao", "98765 00002"),
        minorStatus: "minor",
      }),
    ]);
    const [, secondAnil, isha, neel, asha, mira, ved] = travellerIds;

    expect(links.linked).toBe(1);
    expect(await row(f, ved)).toMatchObject({ guardians: [{ id: secondAnil }] });
    const messages = Object.fromEntries(
      links.warnings.map((warning) => [String(warning.travellerId), warning.message])
    );
    expect(messages[String(isha)]).toContain("2 travellers match");
    expect(messages[String(neel)]).toContain("no traveller with that name");
    expect(messages[String(asha)]).toContain("Date of Birth, Age or Minor");
    expect(messages[String(mira)]).toContain("a minor cannot be a guardian");
    expect(await row(f, isha)).toMatchObject({
      guardianSheetReferences: ["Anil Rao"],
      guardians: [],
    });
  });

  test("ignores a companion named on an adult's row", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, {
        birthDate: "1984-05-10",
        fullName: "Meera Iyer",
        guardians: named("Ravi Iyer"),
      }),
      importRow(1, { birthDate: "1982-01-20", fullName: "Ravi Iyer" }),
    ]);
    expect(links).toEqual({ linked: 0, warnings: [] });
    expect(await row(f, travellerIds[0])).toMatchObject({
      guardianSheetReferences: [],
      guardians: [],
      isMinor: false,
    });
  });

  test("keeps existing links when a later sheet has no guardian column", async () => {
    const f = await setup();
    const first = await importSheet(f, [
      importRow(0, { birthDate: "1984-05-10", fullName: "Meera Iyer" }),
      importRow(1, {
        birthDate: "2014-03-02",
        fullName: "Kavya Iyer",
        guardians: named("Meera Iyer"),
      }),
    ]);
    const second = await importSheet(f, [
      importRow(1, { fullName: "Kavya Iyer", importKind: "rooming", roomType: "Triple" }),
    ]);
    expect(second.links).toEqual({ linked: 0, warnings: [] });
    expect(await row(f, first.travellerIds[1])).toMatchObject({
      guardians: [{ id: first.travellerIds[0] }],
      isMinor: true,
    });
  });
});

async function family(f: Harness) {
  const create = (fullName: string, extra = {}) =>
    f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      ...extra,
      fullName,
      jobCardId: f.jobCardId,
    });
  const { id: mother } = await create("Meera Iyer", { isMinor: false });
  const { id: father } = await create("Ravi Iyer");
  const { id: aunt } = await create("Asha Iyer", { isMinor: false });
  const { id: child } = await create("Kavya Iyer", {
    guardianTravellerIds: [mother, father],
    isMinor: true,
  });
  return { aunt, child, create, father, mother };
}

describe("setting guardians manually", () => {
  test("Operations can set, change and clear up to two guardians on the same Job Card", async () => {
    const f = await setup();
    const { aunt, child, father, mother } = await family(f);

    expect(await row(f, child)).toMatchObject({
      guardians: [{ id: mother }, { id: father }],
      isMinor: true,
    });
    expect(
      (await f.ops.query(api.crm.travellers.listGuardianOptions, { travellerId: child })).map(
        (option) => option.fullName
      )
    ).toEqual(["Asha Iyer", "Meera Iyer", "Ravi Iyer"]);

    await f.ops.mutation(api.crm.travellers.update, {
      guardianTravellerIds: [aunt],
      travellerId: child,
    });
    expect(await row(f, child)).toMatchObject({ guardians: [{ id: aunt }] });
    expect((await row(f, mother))?.guardianOf).toEqual([]);

    await f.ops.mutation(api.crm.travellers.update, {
      guardianTravellerIds: [father, aunt],
      travellerId: child,
    });
    expect(await row(f, child)).toMatchObject({ guardians: [{ id: father }, { id: aunt }] });

    await f.ops.mutation(api.crm.travellers.update, {
      guardianTravellerIds: [],
      travellerId: child,
    });
    expect(await row(f, child)).toMatchObject({ guardians: [], isMinor: true });
  });

  test("rejects guardian sets that break the rules", async () => {
    const f = await setup();
    const { aunt, child, create, father, mother } = await family(f);
    const { id: sibling } = await create("Arjun Iyer", { isMinor: true });
    const { id: adult } = await create("Sanjay Iyer", { isMinor: false });
    const { id: elsewhere } = await f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      fullName: "Other Parent",
      jobCardId: f.otherJobCardId,
    });
    const link = (travellerId: Id<"travellers">, guardianTravellerIds: Id<"travellers">[]) =>
      f.ops.mutation(api.crm.travellers.update, { guardianTravellerIds, travellerId });

    await expect(link(child, [child])).rejects.toThrow("own guardian");
    await expect(link(child, [mother, sibling])).rejects.toThrow("A minor cannot be a guardian");
    await expect(link(child, [elsewhere])).rejects.toThrow("same Job Card");
    await expect(link(child, [mother, mother])).rejects.toThrow("twice");
    await expect(link(child, [mother, father, aunt])).rejects.toThrow("at most two");
    await expect(link(adult, [mother])).rejects.toThrow("Mark the traveller as a minor");
    await expect(
      f.ops.mutation(api.crm.travellers.update, { isMinor: true, travellerId: father })
    ).rejects.toThrow("guardian of a minor");
    expect(await row(f, child)).toMatchObject({ guardians: [{ id: mother }, { id: father }] });
  });

  test("a traveller who stops being a minor loses both guardians", async () => {
    const f = await setup();
    const { child } = await family(f);
    await f.ops.mutation(api.crm.travellers.update, { isMinor: false, travellerId: child });
    expect(await row(f, child)).toMatchObject({ guardians: [], isMinor: false });
  });

  test("deleting one guardian keeps the other", async () => {
    const f = await setup();
    const { child, father, mother } = await family(f);
    await f.ops.mutation(api.crm.travellers.remove, { travellerId: mother });
    expect(await row(f, child)).toMatchObject({ guardians: [{ id: father }] });
    const stored = await f.t.run((ctx) => ctx.db.get("travellers", child));
    expect(stored?.firstGuardianTravellerId).toBe(father);
    expect(stored).not.toHaveProperty("secondGuardianTravellerId");

    await f.ops.mutation(api.crm.travellers.remove, { travellerId: father });
    expect(await row(f, child)).toMatchObject({ guardians: [] });
  });
});

describe("guardian link access", () => {
  test("only staff who may edit the traveller can change or list guardians", async () => {
    const f = await setup();
    const { id: parent } = await f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      fullName: "Meera Iyer",
      jobCardId: f.jobCardId,
    });
    const { id: child } = await f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      fullName: "Kavya Iyer",
      isMinor: true,
      jobCardId: f.jobCardId,
    });
    const change = { guardianTravellerIds: [parent], travellerId: child };

    await expect(f.actor("viewer").mutation(api.crm.travellers.update, change)).rejects.toThrow();
    await expect(
      f.actor("viewer").query(api.crm.travellers.listGuardianOptions, { travellerId: child })
    ).rejects.toThrow();
    await expect(f.actor("outsider").mutation(api.crm.travellers.update, change)).rejects.toThrow(
      "FORBIDDEN"
    );
    expect(
      await f.actor("outsider").query(api.crm.travellers.listGuardianOptions, {
        travellerId: child,
      })
    ).toEqual([]);
    await expect(f.t.mutation(api.crm.travellers.update, change)).rejects.toThrow();
    expect(await row(f, child)).toMatchObject({ guardians: [] });
  });

  test("a Tour Manager scoped to one series sees only the linked travellers in it", async () => {
    const f = await setup();
    const [seriesA, seriesB] = await f.t.run(async (ctx) =>
      Promise.all(
        ["A", "B"].map((code) =>
          ctx.db.insert("travelBatches", {
            batchCode: code,
            batchReference: `Series ${code}`,
            confirmedPax: 2,
            createdAt: NOW,
            createdBy: `${ISSUER}|ops`,
            jobCardId: f.jobCardId,
            status: "Open",
            updatedAt: NOW,
          })
        )
      )
    );
    const create = (fullName: string, travelBatchId: Id<"travelBatches">, extra = {}) =>
      f.ops.mutation(api.crm.travellers.create, {
        ...travellerDetails,
        ...extra,
        fullName,
        jobCardId: f.jobCardId,
        travelBatchId,
      });
    const { id: mother } = await create("Meera Iyer", seriesA);
    const { id: father } = await create("Ravi Iyer", seriesB);
    const { id: childInA } = await create("Kavya Iyer", seriesA, {
      guardianTravellerIds: [mother, father],
      isMinor: true,
    });
    const { id: childInB } = await create("Rohan Iyer", seriesB, {
      guardianTravellerIds: [mother],
      isMinor: true,
    });
    await f.ops.mutation(api.crm.ops.createTourManager, {
      jobCardId: f.jobCardId,
      name: "ignored for staff assignments",
      staffId: f.staffIds.tm,
      travelBatchId: seriesA,
    });
    const tm = f.actor("tm");

    expect((await row(f, mother, tm))?.guardianOf).toEqual([
      { fullName: "Kavya Iyer", id: childInA },
    ]);
    // Each guardian is filtered on its own: the father in series B is not named.
    expect((await row(f, childInA, tm))?.guardians).toEqual([
      { fullName: "Meera Iyer", id: mother },
    ]);
    expect(await row(f, childInB, tm)).toBeNull();

    // The office still sees everything.
    expect((await row(f, mother))?.guardianOf).toHaveLength(2);
    expect((await row(f, childInA))?.guardians).toHaveLength(2);
  });
});
