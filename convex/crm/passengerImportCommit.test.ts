import { describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import type { PortalAccess } from "./lib";
import {
  type GuardianImportLinkResult,
  type PassengerImportCommitArgs,
  preparePassengerImportCommit,
  resolveGuardianLinksAfterFinalBatch,
} from "./passengerImportCommit";

function importRow(overrides: RuntimeObject = {}) {
  return {
    foodPreference: "Veg",
    fullName: "Import Guest",
    guestType: "Client",
    id: "Master list:2",
    importKey: "guest-key-1",
    importKind: "passenger",
    passport: {},
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: 2,
    sourceSheet: "Master list",
    visaRequired: false,
    ...overrides,
  };
}

function manifest(overrides: Partial<NonNullable<PassengerImportCommitArgs["operation"]>> = {}) {
  return {
    batchIndex: 0,
    batchTotal: 1,
    complete: true,
    importKinds: ["passenger"],
    sourceDigest: "a".repeat(64),
    total: 1,
    ...overrides,
  };
}

describe("Passenger import server request verification", () => {
  test("Accepts a batch whose kinds are a subset of a mixed-kind manifest", () => {
    const result = preparePassengerImportCommit({
      jobCardId: "jobCards_1",
      operation: manifest({ importKinds: ["passenger", "visa"] }),
      rows: [importRow()],
    });
    expect(result.kinds).toEqual(["passenger"]);
    expect(result.preparedRows).toHaveLength(1);
  });

  test("Rejects duplicate stable import identities before operation writes", () => {
    expect(() =>
      preparePassengerImportCommit({
        jobCardId: "jobCards_1",
        operation: manifest({ total: 2 }),
        rows: [importRow(), importRow({ id: "Master list:3", sourceRowNumber: 3 })],
      })
    ).toThrow("unique row and source identities");
  });

  test("Rejects a malformed browser manifest before operation writes", () => {
    expect(() =>
      preparePassengerImportCommit({
        jobCardId: "jobCards_1",
        operation: manifest({ batchIndex: 1, sourceDigest: "browser-controlled" }),
        rows: [importRow()],
      })
    ).toThrow("Invalid passenger import operation manifest");
  });
});

describe("Guardian links after the final import batch", () => {
  const access = fromPartial<PortalAccess>({ allowed: true, permissions: [], roles: [] });
  const jobCardId = fromAny<Id<"jobCards">, string>("job");

  function fakeCtx(sweep: () => Promise<GuardianImportLinkResult>) {
    const calls: RuntimeObject[] = [];
    const runMutation = async (_reference: FunctionReference<"mutation">, args: RuntimeObject) => {
      calls.push(args);
      return await sweep();
    };
    // SAFETY: resolveGuardianLinksAfterFinalBatch only calls runMutation with the sweep reference.
    const ctx = fromPartial<ActionCtx>({ runMutation: fromAny(runMutation) });
    return { calls, ctx };
  }

  test("Waits for the final batch before resolving guardians", async () => {
    const { calls, ctx } = fakeCtx(() => Promise.resolve({ linked: 1, warnings: [] }));
    const notFinal = await resolveGuardianLinksAfterFinalBatch(ctx, access, {
      jobCardId,
      operation: manifest({ batchIndex: 0, batchTotal: 2, complete: false, total: 60 }),
      rows: [],
    });
    expect(notFinal).toEqual({ linked: 0, warnings: [] });
    expect(calls).toHaveLength(0);

    const final = await resolveGuardianLinksAfterFinalBatch(ctx, access, {
      jobCardId,
      operation: manifest(),
      rows: [],
    });
    expect(final).toEqual({ linked: 1, warnings: [] });
    expect(calls).toEqual([{ access, jobCardId }]);
  });

  test("Reports a failed guardian sweep without failing the committed import", async () => {
    const { ctx } = fakeCtx(() =>
      Promise.reject(new Error("Job Card has more than 2000 travellers; link guardians manually"))
    );
    const result = await resolveGuardianLinksAfterFinalBatch(ctx, access, { jobCardId, rows: [] });
    expect(result.linked).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toStartWith("Guardians were not linked");
  });
});
