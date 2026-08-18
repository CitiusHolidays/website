import { describe, expect, test } from "bun:test";
import { withTestEncryptionKeySync } from "../../test-helpers/encryptionKey";
import type { RuntimeObject } from "../lib/runtimeValues";
import { preparePassengerRows } from "./importRows";
import { internalPassengerImportRow, publicPassengerImportRow } from "./importRowValidators";
import { assertMatchesReturnContract, expectReturnContractFailure } from "./validateReturnContract";

function publicRow(overrides: RuntimeObject = {}) {
  return {
    foodPreference: "Veg",
    fullName: "A Traveller",
    guestType: "Client",
    id: "Passenger:2",
    importKey: "passenger:2",
    passport: {},
    paymentType: "Company Paid",
    roomType: "Twin",
    sourceRowNumber: 2,
    sourceSheet: "Passenger",
    visaRequired: true,
    ...overrides,
  };
}

describe("Spreadsheet import normalization", () => {
  test("Accepts and canonicalizes inventoried room and gender aliases", () => {
    const row = publicRow({ gender: "M", roomType: "SGL" });
    assertMatchesReturnContract(publicPassengerImportRow, row);
    const [prepared] = preparePassengerRows([row]);
    expect(prepared).toMatchObject({ gender: "Male", roomType: "Single" });
    assertMatchesReturnContract(internalPassengerImportRow, prepared);
  });

  test("Preserves absent, blank, and present Travel Batch semantics", () => {
    const [absent, blank, present] = preparePassengerRows([
      publicRow({ id: "absent", importKey: "absent" }),
      publicRow({
        id: "blank",
        importKey: "blank",
        travelBatchId: "",
        travelBatchReference: "",
      }),
      publicRow({
        id: "present",
        importKey: "present",
        travelBatchId: "travelBatches_1",
        travelBatchReference: "JC-0001-NS / B01",
      }),
    ]);

    expect("travelBatchId" in absent).toBe(false);
    expect(blank).toMatchObject({ travelBatchId: "", travelBatchReference: "" });
    expect(present).toMatchObject({
      travelBatchId: "travelBatches_1",
      travelBatchReference: "JC-0001-NS / B01",
    });
  });

  test("Retains passport expiry while rejecting unsupported room and gender values", () => {
    withTestEncryptionKeySync(() => {
      const [prepared] = preparePassengerRows([
        publicRow({ passport: { expiryDate: "2032-04-09" } }),
      ]);
      expect(prepared.passportExpiryDate).toBe("2032-04-09");
      expect(
        expectReturnContractFailure(publicPassengerImportRow, publicRow({ gender: "Other" }))
      ).toContain("did not match any union member");
      expect(
        expectReturnContractFailure(publicPassengerImportRow, publicRow({ roomType: "Quad" }))
      ).toContain("did not match any union member");
    });
  });
});
