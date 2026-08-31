import { describe, expect, test } from "bun:test";
import schema from "../schema";
import { sacredBharatTables } from "./sacredBharat";

const EXPECTED_TABLES = [
  "sacredBharatEditionEvents",
  "sacredBharatGroupMembers",
  "sacredBharatGroups",
  "sacredBharatInviteAttempts",
  "sacredBharatLeaderboardSummaries",
  "sacredBharatProfiles",
  "sacredBharatRateLimitKeys",
  "sacredBharatVisits",
  "sacredBharatWishlist",
] as const;

describe("Sacred Bharat schema module", () => {
  test("composes one bounded context into the canonical schema without another schema owner", () => {
    // SAFETY: Convex owns schema.export(); this test validates the asserted canonical shape below.
    const exported = JSON.parse(schema.export()) as {
      tables: Array<{
        indexes: Array<{ fields: string[]; indexDescriptor: string }>;
        stagedDbIndexes: unknown[];
        tableName: string;
      }>;
    };
    expect(exported.tables).toHaveLength(135);
    expect(Object.keys(sacredBharatTables)).toEqual(EXPECTED_TABLES);
    const sacred = exported.tables.filter((table) => table.tableName.startsWith("sacredBharat"));
    expect(sacred.map((table) => table.tableName)).toEqual(EXPECTED_TABLES);
    expect(sacred.every((table) => table.stagedDbIndexes.length === 0)).toBe(true);
    expect(
      sacred.find((table) => table.tableName === "sacredBharatEditionEvents")?.indexes
    ).toEqual([
      { fields: ["eventId"], indexDescriptor: "by_eventId" },
      {
        fields: ["playerTokenHash", "createdAt"],
        indexDescriptor: "by_playerTokenHash_createdAt",
      },
      { fields: ["shareTokenHash"], indexDescriptor: "by_shareTokenHash" },
      { fields: ["edition", "createdAt"], indexDescriptor: "by_edition_createdAt" },
    ]);
  });
});
