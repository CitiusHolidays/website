import { describe, expect, test } from "bun:test";
import type { RuntimeObject } from "../lib/runtimeValues";
import {
  type PassengerImportCommitArgs,
  preparePassengerImportCommit,
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
