import { afterEach, describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import type { Id } from "../_generated/dataModel";
import { encryptBuffer } from "../lib/encryption";
import { getFieldPassportFile } from "./fieldPassportActions";
import {
  FIELD_PASSPORT_OPEN_WINDOW_MS,
  fieldPassportOpenCutoff,
  joinsFieldPassportOpen,
} from "./fieldPassportOpenPolicy";
import { fieldPassportWindow } from "./fieldPassports";
import { legacyTourManagerNamesFrom } from "./jobCardVisibility";
import { jobCardRecordGrant, ownsTourManagerJobCard, personNameKey } from "./lib/recordScope";
import { getRolePermissions } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
import { canViewPassengerKinds } from "./passengerKindPolicy";
import { canReadPassportInStaffWorkspace } from "./passportPolicy";
import { tourManagerGroupScopeFrom } from "./tourManagerGroupScope";

const staffId = (value: string) => fromAny<Id<"staffUsers">, string>(value);
const batchId = (value: string) => fromAny<Id<"travelBatches">, string>(value);
const profileId = (value: string) => fromAny<Id<"externalTourManagerProfiles">, string>(value);

function access(roles: string[], id = "staff_tm", name = "Asha Rao"): PortalAccess {
  return {
    allowed: true,
    authUserId: `auth_${id}`,
    email: `${id}@connect-policy.test`,
    name,
    permissions: getRolePermissions(roles),
    roles,
    staffId: staffId(id),
  };
}

const tm = access(["Tour Manager"]);

describe("tour manager group scope", () => {
  const assigned = (
    overrides: Partial<{
      externalProfileId: Id<"externalTourManagerProfiles">;
      staffId: Id<"staffUsers">;
      status: "Assigned" | "Available" | "Inactive";
      travelBatchId: Id<"travelBatches">;
    }>
  ) => ({
    externalProfileId: undefined,
    name: "Asha Rao",
    staffId: staffId("staff_tm"),
    status: "Assigned" as const,
    travelBatchId: undefined,
    ...overrides,
  });

  test("an own batch assignment scopes to that batch; a Job Card assignment opens all", () => {
    const batchScope = tourManagerGroupScopeFrom({
      access: tm,
      assignments: [assigned({ travelBatchId: batchId("batch_a") })],
      batches: [],
      job: {},
    });
    expect(batchScope).toEqual({ kind: "batches", travelBatchIds: new Set(["batch_a"]) });
    expect(
      tourManagerGroupScopeFrom({
        access: tm,
        assignments: [assigned({ travelBatchId: batchId("batch_a") }), assigned({})],
        batches: [],
        job: {},
      })
    ).toEqual({ kind: "jobCard" });
  });

  test("other people, inactive rows and external profiles never widen the group", () => {
    const scope = tourManagerGroupScopeFrom({
      access: tm,
      assignments: [
        assigned({ staffId: staffId("staff_other") }),
        assigned({ status: "Inactive" }),
        assigned({ externalProfileId: profileId("profile_1"), staffId: undefined }),
      ],
      batches: [],
      job: {},
    });
    expect(scope).toEqual({ kind: "batches", travelBatchIds: new Set() });
  });

  test("legacy name-only rows fall back to batch, then Job Card, names", () => {
    expect(
      tourManagerGroupScopeFrom({
        access: tm,
        assignments: [assigned({ staffId: undefined, travelBatchId: batchId("batch_b") })],
        batches: [],
        job: {},
      })
    ).toEqual({ kind: "batches", travelBatchIds: new Set(["batch_b"]) });
    expect(
      tourManagerGroupScopeFrom({
        access: tm,
        assignments: [],
        batches: [
          { _id: batchId("batch_c"), tourManagerName: "asha rao" },
          { _id: batchId("batch_d"), tourManagerName: "Someone Else" },
        ],
        job: { tourManagerName: "Asha Rao" },
      })
    ).toEqual({ kind: "batches", travelBatchIds: new Set(["batch_c"]) });
    expect(
      tourManagerGroupScopeFrom({
        access: tm,
        assignments: [],
        batches: [],
        job: { tourManagerName: "Asha Rao" },
      })
    ).toEqual({ kind: "jobCard" });
  });
});

describe("review fixes: name fallbacks", () => {
  const assignment = (
    overrides: Partial<{
      externalProfileId: Id<"externalTourManagerProfiles">;
      name: string;
      staffId: Id<"staffUsers">;
      travelBatchId: Id<"travelBatches">;
    }>
  ) => ({
    externalProfileId: undefined,
    name: "Asha Rao",
    staffId: undefined,
    status: "Assigned" as const,
    travelBatchId: undefined,
    ...overrides,
  });

  test("names compare after Unicode and whitespace normalization", () => {
    expect(personNameKey("  Asha\u00a0 RAO ")).toBe("asha rao");
    expect(personNameKey("")).toBe("");
  });

  test("any staff assignment on the Job Card ends every name route", () => {
    expect(
      tourManagerGroupScopeFrom({
        access: tm,
        assignments: [assignment({}), assignment({ name: "Other", staffId: staffId("staff_x") })],
        batches: [],
        job: { tourManagerName: "Asha Rao" },
      })
    ).toEqual({ kind: "batches", travelBatchIds: new Set() });
    expect(
      ownsTourManagerJobCard(tm, {
        assignedTourManagerStaffIds: [staffId("staff_x")],
        tourManagerName: "Asha Rao",
      })
    ).toBe(false);
  });

  test("external names are never legacy names, and field reads ignore names entirely", () => {
    expect(
      legacyTourManagerNamesFrom([
        assignment({ externalProfileId: profileId("profile_1"), name: "Asha Rao" }),
        assignment({ name: " Meera  Iyer " }),
      ])
    ).toEqual(["meera iyer"]);
    expect(
      ownsTourManagerJobCard(tm, { legacyTourManagerNames: [], tourManagerName: "Asha Rao" })
    ).toBe(false);
    expect(ownsTourManagerJobCard(tm, { legacyTourManagerNames: ["asha rao"] })).toBe(true);
    expect(
      tourManagerGroupScopeFrom({
        access: tm,
        assignments: [assignment({})],
        batches: [],
        job: {},
        legacyNames: false,
      })
    ).toEqual({ kind: "batches", travelBatchIds: new Set() });
    // The legacy match needs the Tour Manager role.
    expect(ownsTourManagerJobCard(access(["Sales"]), { tourManagerName: "Asha Rao" })).toBe(false);
  });

  test("passenger exports never count Tour Manager permissions", () => {
    for (const kind of ["passenger", "passport", "visa", "traveller"]) {
      expect(canViewPassengerKinds(tm, [kind])).toBe(false);
      expect(canViewPassengerKinds(access(["Operations Head"], "staff_head"), [kind])).toBe(true);
    }
  });
});

describe("Job Card grant and CRM passport access", () => {
  const job = {
    assignedTourManagerStaffIds: [staffId("staff_tm")],
    createdBy: "accounts-owner",
    queryType: "MICE",
  };

  test("office and Tour Manager routes are told apart", () => {
    expect(jobCardRecordGrant(tm, job)).toBe("tourManager");
    expect(jobCardRecordGrant(access(["Operations Head"], "staff_head"), job)).toBe("office");
    expect(jobCardRecordGrant(access(["Tour Manager"], "staff_other", "Other"), job)).toBeNull();
    expect(jobCardRecordGrant(tm, { ...job, collaboratorStaffIds: [staffId("staff_tm")] })).toBe(
      "office"
    );
  });

  test("the Tour Manager role alone never reads passports in the CRM", () => {
    expect(canReadPassportInStaffWorkspace(tm, "tourManager")).toBe(false);
    // Even with office scope (for example as a collaborator), Tour Manager visa read is not enough.
    expect(canReadPassportInStaffWorkspace(tm, "office")).toBe(false);
    expect(canReadPassportInStaffWorkspace(access(["Tour Manager", "Operations"]), "office")).toBe(
      true
    );
    expect(
      canReadPassportInStaffWorkspace(access(["Tour Manager", "Operations"]), "tourManager")
    ).toBe(false);
    expect(canReadPassportInStaffWorkspace(access(["Operations Head"]), "office")).toBe(true);
    expect(canReadPassportInStaffWorkspace(access(["Operations Head"]), null)).toBe(false);
  });
});

describe("field passport trip window", () => {
  test("opens 00:00 IST the day before and closes 24:00 IST the day after", () => {
    expect(
      fieldPassportWindow({ travelEndDate: "2026-11-12", travelStartDate: "2026-11-10" })
    ).toEqual({
      closesAt: Date.parse("2026-11-13T18:30:00Z"),
      opensAt: Date.parse("2026-11-08T18:30:00Z"),
    });
    expect(fieldPassportWindow({ travelStartDate: "2026-11-10" })).toEqual({
      closesAt: Date.parse("2026-11-11T18:30:00Z"),
      opensAt: Date.parse("2026-11-08T18:30:00Z"),
    });
  });

  test("stays closed without valid, ordered dates", () => {
    expect(fieldPassportWindow({})).toBeNull();
    expect(fieldPassportWindow({ travelStartDate: "10/11/2026" })).toBeNull();
    expect(fieldPassportWindow({ travelStartDate: "2026-02-30" })).toBeNull();
    expect(
      fieldPassportWindow({ travelEndDate: "2026-11-01", travelStartDate: "2026-11-10" })
    ).toBeNull();
  });
});

describe("field passport open window", () => {
  const openedAt = Date.parse("2026-11-10T06:00:00Z");

  test("joins under ten minutes after the first call and starts a new open at ten", () => {
    expect(FIELD_PASSPORT_OPEN_WINDOW_MS).toBe(600_000);
    expect(joinsFieldPassportOpen(openedAt, openedAt)).toBe(true);
    expect(joinsFieldPassportOpen(openedAt, openedAt + 599_999)).toBe(true);
    expect(joinsFieldPassportOpen(openedAt, openedAt + 600_000)).toBe(false);
    expect(joinsFieldPassportOpen(openedAt, openedAt + 600_001)).toBe(false);
    // A row stamped after `now` (another clock) is never joined.
    expect(joinsFieldPassportOpen(openedAt, openedAt - 1)).toBe(false);
  });

  test("the index cutoff admits exactly the joinable rows", () => {
    const now = openedAt + 600_000;
    expect(fieldPassportOpenCutoff(now)).toBe(openedAt);
    // The lookup reads `accessedAt > cutoff`, so the row opened exactly ten minutes ago is out.
    expect(openedAt > fieldPassportOpenCutoff(now)).toBe(false);
    expect(openedAt + 1 > fieldPassportOpenCutoff(now)).toBe(true);
  });
});

describe("getFieldPassportFile action", () => {
  const previousKey = process.env.ENCRYPTION_KEY;
  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = previousKey;
    }
  });

  function actionCtx(portalAccess: PortalAccess, blob: Blob | null) {
    const calls: string[] = [];
    const ctx = {
      runMutation: (reference: FunctionReference<"mutation", "public" | "internal">) => {
        const name = getFunctionName(reference);
        calls.push(name);
        if (name === "crm/rateLimitMaintenance:consumePortalFileDownload") {
          return Promise.resolve({ allowed: true, retryAfterSeconds: null });
        }
        if (name === "crm/fieldPassports:authorizeFieldPassportRead") {
          return Promise.resolve({
            fileName: "a1.pdf",
            mimeType: "application/pdf",
            serve: "full",
            storageId: "storage_a1",
          });
        }
        return Promise.reject(new Error(`Unexpected mutation ${name}`));
      },
      runQuery: (reference: FunctionReference<"query", "public" | "internal">) => {
        const name = getFunctionName(reference);
        calls.push(name);
        if (name === "crm/staff:getMyPortalAccess") {
          return Promise.resolve(portalAccess);
        }
        return Promise.reject(new Error(`Unexpected query ${name}`));
      },
      storage: { get: () => Promise.resolve(blob) },
    };
    return { calls, ctx };
  }

  test("returns the decrypted scan after the audited authorization", async () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const encrypted = encryptBuffer(Buffer.from("synthetic passport bytes"));
    const { calls, ctx } = actionCtx(tm, new Blob([new Uint8Array(encrypted)]));
    // SAFETY: the registered action's handler is exercised with a controlled test context.
    const result = await fromAny<any, unknown>(getFieldPassportFile)._handler(ctx, {
      travellerId: "travellers_a1",
    });
    expect(Buffer.from(result.bytes).toString()).toBe("synthetic passport bytes");
    expect(Object.keys(result).sort()).toEqual(["bytes", "fileName", "mimeType"]);
    expect(result).toMatchObject({ fileName: "a1.pdf", mimeType: "application/pdf" });
    // The authorization mutation counts the open against the rate limit in its own transaction.
    expect(calls).toEqual([
      "crm/staff:getMyPortalAccess",
      "crm/fieldPassports:authorizeFieldPassportRead",
    ]);
  });

  test("refuses callers without the Tour Manager role before any read", async () => {
    const { calls, ctx } = actionCtx(access(["Operations Head"], "staff_head"), null);
    await expect(
      // SAFETY: the registered action's handler is exercised with a controlled test context.
      fromAny<any, unknown>(getFieldPassportFile)._handler(ctx, { travellerId: "travellers_a1" })
    ).rejects.toThrow("FORBIDDEN");
    expect(calls).toEqual(["crm/staff:getMyPortalAccess"]);
  });
});
