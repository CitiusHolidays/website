import type { FunctionArgs } from "convex/server";
import type { Infer } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import type { internalPassengerImportRow } from "./importRowValidators";

type ImportRow = Infer<typeof internalPassengerImportRow>;

const ISSUER = "https://parental-consent.test";
const NOW = Date.parse("2026-11-07T09:00:00Z");
const RECORDED = "Recorded parental consent for Kavya Iyer";
const CLEARED = "Cleared parental consent for Kavya Iyer";
const CLEARED_NOT_MINOR = "Cleared parental consent for Kavya Iyer: no longer a minor";

const staff = [
  { id: "ops", name: "Synthetic Ops Lead", roles: ["Operations Head"] },
  { id: "ops2", name: "Synthetic Ops Two", roles: ["Operations Head"] },
  { id: "viewer", name: "Synthetic Viewer", roles: ["Sales"] },
  { id: "outsider", name: "Synthetic Outsider", roles: ["Operations"] },
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
        email: `${member.id}@parental-consent.test`,
        emailNormalized: `${member.id}@parental-consent.test`,
        name: member.name,
        roles: [...member.roles],
        updatedAt: NOW,
      });
    }
    const jobCardId = await ctx.db.insert("jobCards", {
      clientName: "Synthetic family group",
      confirmedPax: 4,
      createdAt: NOW,
      createdBy: `${ISSUER}|ops`,
      jobCode: "JC/CONSENT/001/26-27",
      operationsOwnerId: staffIds.ops,
      status: "Open",
      travelStartDate: "2026-12-01",
      updatedAt: NOW,
    });
    return { jobCardId, staffIds };
  });
  const actor = (id: string) =>
    t.withIdentity({
      email: `${id}@parental-consent.test`,
      issuer: ISSUER,
      subject: id,
      tokenIdentifier: `${ISSUER}|${id}`,
    });
  return { ...ids, actor, ops: actor("ops"), t };
}

type Harness = Awaited<ReturnType<typeof setup>>;

const travellerDetails = {
  foodPreference: "Veg",
  guestType: "Client",
  paymentType: "Company Paid",
  roomType: "Twin",
  visaRequired: false,
} as const;

type CreateArgs = FunctionArgs<typeof api.crm.travellers.create>;

function createTraveller(f: Harness, fullName: string, extra: Partial<CreateArgs> = {}) {
  return f.ops.mutation(api.crm.travellers.create, {
    ...travellerDetails,
    ...extra,
    fullName,
    jobCardId: f.jobCardId,
  });
}

const row = (f: Harness, id: Id<"travellers">) =>
  f.ops.query(api.crm.travellers.getListRow, { travellerId: id });

const stored = (f: Harness, id: Id<"travellers">) => f.t.run((ctx) => ctx.db.get("travellers", id));

async function activityMessages(f: Harness, id: Id<"travellers">) {
  const logs = await f.t.run((ctx) =>
    ctx.db
      .query("activityLogs")
      .withIndex("by_entity", (q) => q.eq("entityType", "traveller").eq("entityId", id))
      .collect()
  );
  return logs.map((log) => log.message);
}

const consentMessages = async (f: Harness, id: Id<"travellers">) =>
  (await activityMessages(f, id)).filter((message) => message.includes("parental consent"));

function importRow(fields: Partial<ImportRow> & { fullName: string }): ImportRow {
  return {
    foodPreference: "Veg",
    guestType: "Client",
    id: "Sheet1:2",
    importKey: `row-${fields.fullName}`,
    importKind: "passenger",
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: 2,
    sourceSheet: "Sheet1",
    visaRequired: false,
    ...fields,
  };
}

async function importAs(f: Harness, who: string, rowFields: Parameters<typeof importRow>[0]) {
  const access = await f.actor(who).query(api.crm.staff.getMyPortalAccess, {});
  if (!access) {
    throw new Error("missing access");
  }
  return await f.t.mutation(internal.crm.imports.commitPassengerImportRow, {
    access,
    jobCardId: f.jobCardId,
    row: importRow(rowFields),
  });
}

describe("parental consent mark set by Operations", () => {
  test("records consent on a minor with the server time and the recording staff member", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", { isMinor: true });
    expect(await row(f, kavya)).toMatchObject({ parentalConsent: null });

    const before = Date.now();
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentNote: "  Signed form from Meera Iyer, 7 Nov  ",
      parentalConsentReceived: true,
      travellerId: kavya,
    });
    const after = Date.now();

    const recorded = (await row(f, kavya))?.parentalConsent;
    expect(recorded).toMatchObject({
      note: "Signed form from Meera Iyer, 7 Nov",
      recordedByName: "Synthetic Ops Lead",
    });
    expect(recorded?.receivedAt).toBeGreaterThanOrEqual(before);
    expect(recorded?.receivedAt).toBeLessThanOrEqual(after);
    expect((await stored(f, kavya))?.parentalConsent?.recordedByStaffId).toBe(f.staffIds.ops);
    expect(await consentMessages(f, kavya)).toEqual([RECORDED]);
  });

  test("saving the traveller again keeps who recorded consent and when", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", { isMinor: true });
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentReceived: true,
      travellerId: kavya,
    });
    const first = (await row(f, kavya))?.parentalConsent;

    await f.actor("ops2").mutation(api.crm.travellers.update, {
      parentalConsentReceived: true,
      travelHub: "Mumbai",
      travellerId: kavya,
    });
    expect((await row(f, kavya))?.parentalConsent).toEqual(first);
    expect(await consentMessages(f, kavya)).toEqual([RECORDED]);
  });

  test("clears consent and logs the clearing without the note text", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", { isMinor: true });
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentNote: "Private note about the family",
      parentalConsentReceived: true,
      travellerId: kavya,
    });
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentReceived: false,
      travellerId: kavya,
    });

    expect(await row(f, kavya)).toMatchObject({ isMinor: true, parentalConsent: null });
    expect(await stored(f, kavya)).not.toHaveProperty("parentalConsent");
    expect(await consentMessages(f, kavya)).toEqual([RECORDED, CLEARED]);
    const logs = await f.t.run((ctx) => ctx.db.query("activityLogs").collect());
    expect(JSON.stringify(logs)).not.toContain("Private note");
  });

  test("records consent when Operations add a minor", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", {
      isMinor: true,
      parentalConsentReceived: true,
    });
    expect((await row(f, kavya))?.parentalConsent).toMatchObject({
      note: "",
      recordedByName: "Synthetic Ops Lead",
    });
    expect(await consentMessages(f, kavya)).toEqual([RECORDED]);
  });

  test("bounds the note: trimmed, empty means absent, longer than 500 characters is refused", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", { isMinor: true });
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentNote: "   ",
      parentalConsentReceived: true,
      travellerId: kavya,
    });
    expect((await stored(f, kavya))?.parentalConsent).not.toHaveProperty("note");

    await expect(
      f.ops.mutation(api.crm.travellers.update, {
        parentalConsentNote: "x".repeat(501),
        parentalConsentReceived: true,
        travellerId: kavya,
      })
    ).rejects.toThrow("500 characters");
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentNote: "y".repeat(500),
      parentalConsentReceived: true,
      travellerId: kavya,
    });
    expect((await row(f, kavya))?.parentalConsent?.note).toHaveLength(500);
  });

  test("refuses consent for an adult or a traveller whose age is not recorded", async () => {
    const f = await setup();
    const { id: adult } = await createTraveller(f, "Meera Iyer", { isMinor: false });
    const { id: unknownAge } = await createTraveller(f, "Ravi Iyer");

    for (const travellerId of [adult, unknownAge]) {
      await expect(
        f.ops.mutation(api.crm.travellers.update, { parentalConsentReceived: true, travellerId })
      ).rejects.toThrow("only for a minor");
      expect(await row(f, travellerId)).toMatchObject({ parentalConsent: null });
    }
    await expect(
      createTraveller(f, "Asha Iyer", { isMinor: false, parentalConsentReceived: true })
    ).rejects.toThrow("only for a minor");
    await expect(
      f.ops.mutation(api.crm.travellers.update, {
        isMinor: false,
        parentalConsentReceived: true,
        travellerId: adult,
      })
    ).rejects.toThrow("only for a minor");
  });

  test("only staff who may edit the traveller can set or clear consent", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", { isMinor: true });
    const change = { parentalConsentReceived: true, travellerId: kavya };

    await expect(f.actor("viewer").mutation(api.crm.travellers.update, change)).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(f.actor("outsider").mutation(api.crm.travellers.update, change)).rejects.toThrow(
      "FORBIDDEN"
    );
    await expect(f.t.mutation(api.crm.travellers.update, change)).rejects.toThrow();
    expect(await row(f, kavya)).toMatchObject({ parentalConsent: null });

    await f.ops.mutation(api.crm.travellers.update, change);
    await expect(
      f.actor("outsider").mutation(api.crm.travellers.update, {
        parentalConsentReceived: false,
        travellerId: kavya,
      })
    ).rejects.toThrow("FORBIDDEN");
    expect((await row(f, kavya))?.parentalConsent).not.toBeNull();
  });
});

describe("parental consent follows minor status", () => {
  test("is cleared when the editor marks the traveller as an adult or unrecorded", async () => {
    const f = await setup();
    for (const isMinor of [false, null]) {
      const { id: kavya } = await createTraveller(f, "Kavya Iyer", {
        isMinor: true,
        parentalConsentReceived: true,
      });
      await f.ops.mutation(api.crm.travellers.update, { isMinor, travellerId: kavya });
      expect(await row(f, kavya)).toMatchObject({ parentalConsent: null });
      expect(await stored(f, kavya)).not.toHaveProperty("parentalConsent");
      expect(await consentMessages(f, kavya)).toEqual([RECORDED, CLEARED_NOT_MINOR]);
    }
  });

  test("is cleared when an import records the traveller as an adult", async () => {
    const f = await setup();
    const created = await importAs(f, "ops", { fullName: "Kavya Iyer", minorStatus: "minor" });
    const kavya = created.travellerId;
    await f.ops.mutation(api.crm.travellers.update, {
      parentalConsentReceived: true,
      travellerId: kavya,
    });

    await importAs(f, "ops", { fullName: "Kavya Iyer", minorStatus: "adult" });
    expect(await row(f, kavya)).toMatchObject({ isMinor: false, parentalConsent: null });
    expect(await consentMessages(f, kavya)).toEqual([RECORDED, CLEARED_NOT_MINOR]);
  });

  test("survives an import that has no age or consent columns", async () => {
    const f = await setup();
    const { id: kavya } = await createTraveller(f, "Kavya Iyer", {
      isMinor: true,
      parentalConsentReceived: true,
    });
    const before = (await row(f, kavya))?.parentalConsent;
    await importAs(f, "ops2", {
      fullName: "Kavya Iyer",
      importKind: "rooming",
      roomType: "Triple",
    });
    expect((await row(f, kavya))?.parentalConsent).toEqual(before);
  });
});

describe("parental consent column on import", () => {
  test("Yes records consent once, by the importing staff member; No clears; blank leaves it", async () => {
    const f = await setup();
    const first = await importAs(f, "ops2", {
      fullName: "Kavya Iyer",
      minorStatus: "minor",
      parentalConsentReceived: true,
    });
    const kavya = first.travellerId;
    const recorded = (await row(f, kavya))?.parentalConsent;
    expect(recorded).toMatchObject({ note: "", recordedByName: "Synthetic Ops Two" });
    expect((await stored(f, kavya))?.parentalConsent?.recordedByStaffId).toBe(f.staffIds.ops2);

    await importAs(f, "ops", { fullName: "Kavya Iyer", parentalConsentReceived: true });
    expect((await row(f, kavya))?.parentalConsent).toEqual(recorded);

    await importAs(f, "ops", { fullName: "Kavya Iyer" });
    expect((await row(f, kavya))?.parentalConsent).toEqual(recorded);

    await importAs(f, "ops", { fullName: "Kavya Iyer", parentalConsentReceived: false });
    expect(await row(f, kavya)).toMatchObject({ isMinor: true, parentalConsent: null });
    expect(await consentMessages(f, kavya)).toEqual([RECORDED, CLEARED]);
  });

  test("ignores Yes on an adult or unknown-age row and says so on the row", async () => {
    const f = await setup();
    const adultRow: Parameters<typeof importRow>[0] = {
      fullName: "Meera Iyer",
      minorStatus: "adult",
      parentalConsentReceived: true,
    };
    const unknownAgeRow = { fullName: "Ravi Iyer", parentalConsentReceived: true };
    for (const rowFields of [adultRow, unknownAgeRow]) {
      const result = await importAs(f, "ops", rowFields);
      expect(result.rowResults[0]?.message).toBe(
        "Parental consent ignored: the traveller is not recorded as a minor."
      );
      expect(await row(f, result.travellerId)).toMatchObject({ parentalConsent: null });
      expect(await consentMessages(f, result.travellerId)).toEqual([]);
    }
  });
});

describe("parental consent on the traveller master export", () => {
  test("the export source says received or pending for minors and nothing for others", async () => {
    const f = await setup();
    const { id: withConsent } = await createTraveller(f, "Kavya Iyer", {
      isMinor: true,
      parentalConsentReceived: true,
    });
    const { id: pending } = await createTraveller(f, "Rohan Iyer", { isMinor: true });
    const { id: adult } = await createTraveller(f, "Meera Iyer", { isMinor: false });
    const { id: unknownAge } = await createTraveller(f, "Ravi Iyer");
    const access = await f.ops.query(api.crm.staff.getMyPortalAccess, {});
    const page = await f.t.query(internal.crm.imports.getPassengerExportSourcePage, {
      access,
      exportKind: "traveller",
      jobCardId: f.jobCardId,
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const consentById = Object.fromEntries(
      page.page.map((source) => [String(source.travellerId), source.parentalConsentReceived])
    );
    expect(consentById).toEqual({
      [String(adult)]: null,
      [String(pending)]: false,
      [String(unknownAge)]: null,
      [String(withConsent)]: true,
    });
  });
});
