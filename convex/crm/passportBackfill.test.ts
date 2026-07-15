import { describe, expect, test } from "bun:test";
import { listPassportDetailsForBackfill } from "./passport";

describe("passport expiry backfill paging", () => {
  test("reads one bounded cursor page without collecting the passport table", async () => {
    const calls: Array<{ cursor: string | null; numItems: number }> = [];
    const result = await (listPassportDetailsForBackfill as any)._handler(
      {
        db: {
          query: () => ({
            collect: () => {
              throw new Error("backfill must not collect the full passport table");
            },
            order: () => ({
              paginate: (options: { cursor: string | null; numItems: number }) => {
                calls.push(options);
                return {
                  continueCursor: "next-page",
                  isDone: false,
                  page: [
                    { _id: "passport_1", encryptedPayload: "ciphertext" },
                    {
                      _id: "passport_2",
                      encryptedPayload: "already-done",
                      expiryDate: "2030-01-01",
                    },
                  ],
                };
              },
            }),
          }),
        },
      },
      { cursor: "current-page", limit: 1000 }
    );

    expect(calls).toEqual([{ cursor: "current-page", numItems: 100 }]);
    expect(result).toEqual({
      continueCursor: "next-page",
      isDone: false,
      page: [{ encryptedPayload: "ciphertext", id: "passport_1" }],
      scanned: 2,
    });
  });
});
