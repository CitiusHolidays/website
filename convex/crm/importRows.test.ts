import { describe, expect, test } from "bun:test";
import { chunkRows, mergeRoomSummaries, preparePassengerRows } from "./importRows";

describe("importRows", () => {
  test("prepares public action rows for internal import without leaking sourceStatus", () => {
    const [prepared] = preparePassengerRows([
      {
        id: "Sheet1:2",
        sourceSheet: "Sheet1",
        sourceRowNumber: 2,
        sourceStatus: "CONFIRMED",
        importKind: "passenger",
        importKey: "row-1",
        fullName: "ANSHIKA AGARWAL",
        foodPreference: "Veg",
        guestType: "Client",
        paymentType: "Company Paid",
        roomType: "Twin",
        visaRequired: true,
        passport: {
          number: "AK429734",
          dateOfBirth: "1987-07-26",
          issueDate: "2026-02-12",
          expiryDate: "2036-02-11",
          nationality: "INDIAN",
        },
      },
    ]);

    expect(prepared).not.toHaveProperty("sourceStatus");
    expect(prepared).not.toHaveProperty("passport");
    expect(prepared).toMatchObject({
      passportLastFour: "9734",
      passportExpiryDate: "2036-02-11",
    });
    expect(prepared.passportNumberHash).toBeString();
    expect(prepared.encryptedPassportPayload).toBeString();
  });

  test("chunks rows and merges room summaries", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(mergeRoomSummaries({ Twin: 1 }, { Twin: 2, SGL: 1 })).toEqual({
      Twin: 3,
      SGL: 1,
    });
  });
});
