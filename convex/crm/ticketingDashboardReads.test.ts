import { describe, expect, test } from "bun:test";
import { collectTicketingDashboardRows } from "./ticketingDashboardReads";

describe("ticketing dashboard pagination", () => {
  test("reads complete ticket and PNR totals without running multiple paginated queries", async () => {
    const rowsByTable = {
      pnrs: Array.from({ length: 7 }, (_, index) => ({ id: `pnr-${index}` })),
      tickets: Array.from({ length: 2001 }, (_, index) => ({ id: `ticket-${index}` })),
    };
    let paginateCalls = 0;
    const ctx = {
      db: {
        query: (table: keyof typeof rowsByTable) => ({
          async *[Symbol.asyncIterator]() {
            yield* rowsByTable[table];
          },
          order() {
            return this;
          },
          paginate({ cursor, numItems }: { cursor: string | null; numItems: number }) {
            paginateCalls += 1;
            if (paginateCalls > 1) {
              throw new Error(
                "This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function."
              );
            }
            const offset = cursor ? Number(cursor) : 0;
            const page = rowsByTable[table].slice(offset, offset + numItems);
            const nextOffset = offset + page.length;
            return Promise.resolve({
              continueCursor: String(nextOffset),
              isDone: nextOffset >= rowsByTable[table].length,
              page,
            });
          },
          withIndex() {
            return this;
          },
        }),
      },
    };

    const { pnrs, tickets } = await collectTicketingDashboardRows(ctx as never);

    expect(tickets).toHaveLength(rowsByTable.tickets.length);
    expect(tickets.at(-1)).toEqual({ id: "ticket-2000" });
    expect(pnrs).toHaveLength(rowsByTable.pnrs.length);
    expect(paginateCalls).toBe(0);
  });
});
