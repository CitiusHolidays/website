import { describe, expect, test } from "bun:test";
import { getStats } from "./migrations";

function withMigrationSecret<T>(fn: () => Promise<T>) {
  const previous = process.env.MIGRATION_SECRET;
  process.env.MIGRATION_SECRET = "maintenance-secret";
  return fn().finally(() => {
    if (previous === undefined) {
      delete process.env.MIGRATION_SECRET;
    } else {
      process.env.MIGRATION_SECRET = previous;
    }
  });
}

describe("migration statistics capability", () => {
  test("anonymous and ordinary callers cannot read full-table statistics", async () => {
    await withMigrationSecret(async () => {
      await expect(
        (getStats as any)._handler(
          {
            auth: { getUserIdentity: () => Promise.resolve(null) },
          },
          { secret: "wrong-secret" }
        )
      ).rejects.toThrow("Invalid migration secret");
    });
  });

  test("the deliberately authorized maintenance path remains usable", async () => {
    await withMigrationSecret(async () => {
      const tables = {
        bookings: [{ status: "confirmed" }, { status: "pending" }],
        trips: [
          {
            _id: "trip_1",
            availableSeats: 8,
            legacyTripId: "legacy_1",
            slug: "trip-one",
            totalSeats: 10,
          },
        ],
        userProfiles: [{ _id: "profile_1" }],
      };
      const result = await (getStats as any)._handler(
        {
          db: {
            query: (table: keyof typeof tables) => ({
              collect: () => Promise.resolve(tables[table]),
            }),
          },
        },
        { secret: "maintenance-secret" }
      );

      expect(result.counts).toEqual({ bookings: 2, trips: 1, users: 1 });
      expect(result.bookingsByStatus).toEqual({ confirmed: 1, pending: 1 });
    });
  });
});
