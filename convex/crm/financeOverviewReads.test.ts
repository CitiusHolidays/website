import { describe, expect, test } from "bun:test";
import { collectAllCreatedAtPages } from "./financeOverviewReads";

describe("finance overview pagination", () => {
  test("reads beyond the former 2,000-row cap without an unbounded collect", async () => {
    const rows = Array.from({ length: 2_005 }, (_, index) => ({ id: index }));
    const ctx = {
      db: {
        query: () => ({
          withIndex() {
            return this;
          },
          order() {
            return this;
          },
          paginate({ cursor, numItems }: { cursor: string | null; numItems: number }) {
            const offset = cursor ? Number(cursor) : 0;
            const page = rows.slice(offset, offset + numItems);
            const nextOffset = offset + page.length;
            return Promise.resolve({
              continueCursor: String(nextOffset),
              isDone: nextOffset >= rows.length,
              page,
            });
          },
        }),
      },
    };

    const result = await collectAllCreatedAtPages(ctx, "invoices");

    expect(result).toHaveLength(rows.length);
    expect(result.at(-1)).toEqual({ id: 2_004 });
  });
});
