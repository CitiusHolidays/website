import { afterEach, describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import type { Id } from "../_generated/dataModel";
import { encryptBuffer } from "../lib/encryption";
import { getFieldPassportFile } from "./fieldPassportActions";
import { fieldPassportWindow } from "./fieldPassports";
import { jobCardRecordGrant } from "./lib/recordScope";
import { getRolePermissions } from "./lib/rolePolicy";
import type { PortalAccess } from "./lib/staffAccess";
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
    expect(result).toMatchObject({ fileName: "a1.pdf", mimeType: "application/pdf" });
    expect(calls).toEqual([
      "crm/staff:getMyPortalAccess",
      "crm/rateLimitMaintenance:consumePortalFileDownload",
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
