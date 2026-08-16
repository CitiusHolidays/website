import { describe, expect, test } from "bun:test";
import type { Id } from "../_generated/dataModel";
import type { RuntimeValue } from "../lib/runtimeValues";
import {
  MAX_TICKETS_PER_TRAVELLER_SEAT_PROPAGATION,
  updateTravellerTicketSeats,
} from "./seatCommands";

// SAFETY: This test controls the asserted value at the framework boundary below.
const jobCardId = "jobCards:1" as Id<"jobCards">;
// SAFETY: This test controls the asserted value at the framework boundary below.
const travellerId = "travellers:1" as Id<"travellers">;

function ticket(index: number, owner = jobCardId) {
  return {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    _id: `tickets:${index}` as Id<"tickets">,
    jobCardId: owner,
  };
}

function context(rows: ReturnType<typeof ticket>[]) {
  const indexCalls: string[] = [];
  const patches: Array<{ id: Id<"tickets">; seatNumber: string }> = [];
  const ctx = {
    db: {
      insert: () => Promise.resolve("dirty:1"),
      patch: (table: string, id: Id<"tickets">, value: { seatNumber: string }) => {
        if (table === "tickets") {
          patches.push({ id, seatNumber: value.seatNumber });
        }
        return Promise.resolve();
      },
      query: (table: string) => {
        if (table === "crmMetricDirty") {
          return {
            withIndex: (_name: string, apply?: (query: any) => RuntimeValue) => {
              const query = { eq: () => query };
              apply?.(query);
              return {
                first: () => Promise.resolve(null),
                unique: () => Promise.resolve(null),
              };
            },
          };
        }
        expect(table).toBe("tickets");
        return {
          withIndex: (
            name: string,
            apply: (query: {
              eq: (field: string, value: RuntimeValue) => RuntimeValue;
            }) => RuntimeValue
          ) => {
            indexCalls.push(name);
            apply({ eq: (field, value) => ({ field, value }) });
            return {
              take: (limit: number) => {
                expect(limit).toBe(MAX_TICKETS_PER_TRAVELLER_SEAT_PROPAGATION + 1);
                return Promise.resolve(rows.slice(0, limit));
              },
            };
          },
        };
      },
    },
    scheduler: { runAfter: () => Promise.resolve() },
  };
  return { ctx, indexCalls, patches };
}

describe("traveller-indexed seat propagation", () => {
  test("updates only the bounded traveller index result", async () => {
    const fixture = context([ticket(1), ticket(2)]);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      updateTravellerTicketSeats(fixture.ctx as never, {
        jobCardId,
        seatNumber: "12A",
        travellerId,
        updatedAt: 123,
      })
    ).resolves.toBe(2);
    expect(fixture.indexCalls).toEqual(["by_travellerId"]);
    expect(fixture.patches).toEqual([
      { id: "tickets:1", seatNumber: "12A" },
      { id: "tickets:2", seatNumber: "12A" },
    ]);
  });

  test("fails before writes for a cross-Job-Card ticket", async () => {
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const fixture = context([ticket(1), ticket(2, "jobCards:other" as Id<"jobCards">)]);
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      updateTravellerTicketSeats(fixture.ctx as never, {
        jobCardId,
        seatNumber: "12A",
        travellerId,
        updatedAt: 123,
      })
    ).rejects.toThrow("crosses the selected Job Card");
    expect(fixture.patches).toHaveLength(0);
  });

  test("fails before writes when immediate propagation would exceed the cap", async () => {
    const fixture = context(
      Array.from({ length: MAX_TICKETS_PER_TRAVELLER_SEAT_PROPAGATION + 1 }, (_, index) =>
        ticket(index)
      )
    );
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      updateTravellerTicketSeats(fixture.ctx as never, {
        jobCardId,
        seatNumber: "12A",
        travellerId,
        updatedAt: 123,
      })
    ).rejects.toThrow("too many tickets");
    expect(fixture.patches).toHaveLength(0);
  });
});
