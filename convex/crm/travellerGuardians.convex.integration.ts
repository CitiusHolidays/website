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

describe("linking minors to a guardian on import", () => {
  test("links a minor named before or after their parent in the sheet", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, { birthDate: "2014-03-02", fullName: "Kavya Iyer", guardianName: "Meera Iyer" }),
      importRow(1, { birthDate: "1984-05-10", fullName: "Meera Iyer" }),
      importRow(2, { ageYears: 9, fullName: "Rohan Iyer", guardianName: "meera iyer" }),
    ]);
    const [kavya, meera, rohan] = travellerIds;

    expect(links).toEqual({ linked: 2, warnings: [] });
    expect(await row(f, kavya)).toMatchObject({
      guardian: { fullName: "Meera Iyer", id: meera },
      guardianSheetReference: "",
      isMinor: true,
    });
    const parent = await row(f, meera);
    expect(parent).toMatchObject({ guardian: null, isMinor: false });
    expect(parent?.guardianOf.map((minor) => minor.id).sort()).toEqual([kavya, rohan].sort());
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
      importRow(2, { fullName: "Isha Rao", guardianName: "Anil Rao", minorStatus: "minor" }),
      importRow(3, { fullName: "Neel Rao", guardianName: "Nobody Here", minorStatus: "minor" }),
      importRow(4, { fullName: "Asha Rao", guardianName: "Anil Rao" }),
      importRow(5, { fullName: "Mira Rao", guardianName: "Isha Rao", minorStatus: "minor" }),
      importRow(6, {
        fullName: "Ved Rao",
        guardianContact: "98765 00002",
        guardianName: "Anil Rao",
        minorStatus: "minor",
      }),
    ]);
    const [, secondAnil, isha, neel, asha, mira, ved] = travellerIds;

    expect(links.linked).toBe(1);
    expect(await row(f, ved)).toMatchObject({ guardian: { id: secondAnil } });
    const messages = Object.fromEntries(
      links.warnings.map((warning) => [String(warning.travellerId), warning.message])
    );
    expect(messages[String(isha)]).toContain("2 travellers match");
    expect(messages[String(neel)]).toContain("no traveller with that name");
    expect(messages[String(asha)]).toContain("Date of Birth, Age or Minor");
    expect(messages[String(mira)]).toContain("a minor cannot be a guardian");
    expect(links.warnings.find((warning) => warning.travellerId === isha)).toMatchObject({
      fullName: "Isha Rao",
      sourceRowNumber: 4,
      sourceSheet: "Sheet1",
    });
    expect(await row(f, isha)).toMatchObject({
      guardian: null,
      guardianSheetReference: "Anil Rao",
    });
  });

  test("ignores a companion named on an adult's row", async () => {
    const f = await setup();
    const { links, travellerIds } = await importSheet(f, [
      importRow(0, { birthDate: "1984-05-10", fullName: "Meera Iyer", guardianName: "Ravi Iyer" }),
      importRow(1, { birthDate: "1982-01-20", fullName: "Ravi Iyer" }),
    ]);
    expect(links).toEqual({ linked: 0, warnings: [] });
    expect(await row(f, travellerIds[0])).toMatchObject({
      guardian: null,
      guardianSheetReference: "",
      isMinor: false,
    });
  });

  test("keeps an existing link when a later sheet has no guardian column", async () => {
    const f = await setup();
    const first = await importSheet(f, [
      importRow(0, { birthDate: "1984-05-10", fullName: "Meera Iyer" }),
      importRow(1, { birthDate: "2014-03-02", fullName: "Kavya Iyer", guardianName: "Meera Iyer" }),
    ]);
    const second = await importSheet(f, [
      importRow(1, { fullName: "Kavya Iyer", importKind: "rooming", roomType: "Triple" }),
    ]);
    expect(second.links).toEqual({ linked: 0, warnings: [] });
    expect(await row(f, first.travellerIds[1])).toMatchObject({
      guardian: { id: first.travellerIds[0] },
      isMinor: true,
    });
  });
});

describe("setting a guardian manually", () => {
  test("Operations can set, change and clear a guardian on the same Job Card", async () => {
    const f = await setup();
    const create = (fullName: string, extra = {}) =>
      f.ops.mutation(api.crm.travellers.create, {
        ...travellerDetails,
        ...extra,
        fullName,
        jobCardId: f.jobCardId,
      });
    const { id: parent } = await create("Meera Iyer", { isMinor: false });
    const { id: otherParent } = await create("Ravi Iyer");
    const { id: child } = await create("Kavya Iyer", {
      guardianTravellerId: parent,
      isMinor: true,
    });

    expect(await row(f, child)).toMatchObject({ guardian: { id: parent }, isMinor: true });
    expect(
      await f.ops.query(api.crm.travellers.listGuardianOptions, { travellerId: child })
    ).toEqual([
      { fullName: "Meera Iyer", id: parent },
      { fullName: "Ravi Iyer", id: otherParent },
    ]);

    await f.ops.mutation(api.crm.travellers.update, {
      guardianTravellerId: otherParent,
      travellerId: child,
    });
    expect(await row(f, child)).toMatchObject({ guardian: { id: otherParent } });

    await f.ops.mutation(api.crm.travellers.update, {
      guardianTravellerId: null,
      travellerId: child,
    });
    expect(await row(f, child)).toMatchObject({ guardian: null, isMinor: true });
  });

  test("rejects links that break the guardian rules", async () => {
    const f = await setup();
    const create = (fullName: string, extra = {}) =>
      f.ops.mutation(api.crm.travellers.create, {
        ...travellerDetails,
        ...extra,
        fullName,
        jobCardId: f.jobCardId,
      });
    const { id: parent } = await create("Meera Iyer");
    const { id: child } = await create("Kavya Iyer", { isMinor: true });
    const { id: sibling } = await create("Arjun Iyer", { isMinor: true });
    const { id: adult } = await create("Sanjay Iyer", { isMinor: false });
    const { id: elsewhere } = await f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      fullName: "Other Parent",
      jobCardId: f.otherJobCardId,
    });
    const link = (travellerId: Id<"travellers">, guardianTravellerId: Id<"travellers">) =>
      f.ops.mutation(api.crm.travellers.update, { guardianTravellerId, travellerId });

    await expect(link(child, child)).rejects.toThrow("own guardian");
    await expect(link(child, sibling)).rejects.toThrow("A minor cannot be a guardian");
    await expect(link(child, elsewhere)).rejects.toThrow("same Job Card");
    await expect(link(adult, parent)).rejects.toThrow("Mark the traveller as a minor");

    await link(child, parent);
    await expect(
      f.ops.mutation(api.crm.travellers.update, { isMinor: true, travellerId: parent })
    ).rejects.toThrow("guardian of a minor");

    // A traveller who is no longer a minor keeps no guardian.
    await f.ops.mutation(api.crm.travellers.update, { isMinor: false, travellerId: child });
    expect(await row(f, child)).toMatchObject({ guardian: null, isMinor: false });
  });

  test("deleting a guardian unlinks their minors", async () => {
    const f = await setup();
    const { id: parent } = await f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      fullName: "Meera Iyer",
      jobCardId: f.jobCardId,
    });
    const { id: child } = await f.ops.mutation(api.crm.travellers.create, {
      ...travellerDetails,
      fullName: "Kavya Iyer",
      guardianTravellerId: parent,
      isMinor: true,
      jobCardId: f.jobCardId,
    });
    await f.ops.mutation(api.crm.travellers.remove, { travellerId: parent });
    expect(await f.t.run((ctx) => ctx.db.get("travellers", child))).not.toHaveProperty(
      "guardianTravellerId"
    );
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

    await expect(
      f.actor("viewer").mutation(api.crm.travellers.update, {
        guardianTravellerId: parent,
        travellerId: child,
      })
    ).rejects.toThrow();
    await expect(
      f.actor("viewer").query(api.crm.travellers.listGuardianOptions, { travellerId: child })
    ).rejects.toThrow();
    await expect(
      f.actor("outsider").mutation(api.crm.travellers.update, {
        guardianTravellerId: parent,
        travellerId: child,
      })
    ).rejects.toThrow("FORBIDDEN");
    expect(
      await f.actor("outsider").query(api.crm.travellers.listGuardianOptions, {
        travellerId: child,
      })
    ).toEqual([]);
    await expect(
      f.t.mutation(api.crm.travellers.update, { guardianTravellerId: parent, travellerId: child })
    ).rejects.toThrow();
    expect(await row(f, child)).toMatchObject({ guardian: null });
  });

  test("a Tour Manager scoped to one series never sees a linked traveller outside it", async () => {
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
    const { id: parent } = await create("Meera Iyer", seriesA);
    const { id: childInA } = await create("Kavya Iyer", seriesA, {
      guardianTravellerId: parent,
      isMinor: true,
    });
    const { id: childInB } = await create("Rohan Iyer", seriesB, {
      guardianTravellerId: parent,
      isMinor: true,
    });
    await f.ops.mutation(api.crm.ops.createTourManager, {
      jobCardId: f.jobCardId,
      name: "ignored for staff assignments",
      staffId: f.staffIds.tm,
      travelBatchId: seriesA,
    });
    const tm = f.actor("tm");

    const parentForTm = await row(f, parent, tm);
    expect(parentForTm?.guardianOf).toEqual([{ fullName: "Kavya Iyer", id: childInA }]);
    expect(await row(f, childInB, tm)).toBeNull();

    // The office still sees both minors on the guardian.
    expect((await row(f, parent))?.guardianOf).toHaveLength(2);
  });
});
