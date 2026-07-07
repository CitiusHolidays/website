import { describe, expect, test } from "bun:test";
import { chunkRows, mergeRoomSummaries, preparePassengerRows } from "./importRows";

describe("importRows", () => {
  test("prepares public action rows for internal import without leaking sourceStatus", () => {
    const previousKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const [prepared] = preparePassengerRows([
        {
          foodPreference: "Veg",
          fullName: "ANSHIKA AGARWAL",
          guestType: "Client",
          id: "Sheet1:2",
          importKey: "row-1",
          importKind: "passenger",
          passport: {
            dateOfBirth: "1987-07-26",
            expiryDate: "2036-02-11",
            issueDate: "2026-02-12",
            nationality: "INDIAN",
            number: "AK429734",
          },
          paymentType: "Company Paid",
          roomType: "Twin",
          sourceRowNumber: 2,
          sourceSheet: "Sheet1",
          sourceStatus: "CONFIRMED",
          visaRequired: true,
        },
      ]);

      expect(prepared).not.toHaveProperty("sourceStatus");
      expect(prepared).not.toHaveProperty("passport");
      expect(prepared).toMatchObject({
        passportExpiryDate: "2036-02-11",
        passportLastFour: "9734",
      });
      expect(prepared.passportNumberHash).toBeString();
      expect(prepared.encryptedPassportPayload).toBeString();
    } finally {
      if (previousKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousKey;
      }
    }
  });

  test("chunks rows and merges room summaries", () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(mergeRoomSummaries({ Twin: 1 }, { Single: 1, Twin: 2 })).toEqual({
      Single: 1,
      Twin: 3,
    });
  });
});
