import { describe, expect, test } from "bun:test";
import { collectAllTicketingPages } from "./ticketingDashboardReads";

describe("ticketing dashboard pagination", () => {
  test("keeps totals complete when ticket rows exceed a single page", async () => {
    const rows = Array.from({ length: 2_001 }, (_, index) => ({ id: index }));
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

    const result = await collectAllTicketingPages(ctx, "tickets");

    expect(result).toHaveLength(rows.length);
    expect(result.at(-1)).toEqual({ id: 2_000 });
  });
});
