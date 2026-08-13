import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  compareLeaderboardRows,
  leaderboardRankKey,
  leaderboardSummaryIsEligible,
} from "./lib/sacredBharatLeaderboardRank";

interface RankRow {
  authUserId: string;
  displayName: string;
  optedOut: boolean;
  score: number;
  templeCount: number;
}

const row = (overrides: Partial<RankRow> = {}): RankRow => ({
  authUserId: "auth_default",
  displayName: "Yatri",
  optedOut: false,
  score: 100,
  templeCount: 2,
  ...overrides,
});

describe("Sacred Bharat ordered rank contract", () => {
  test("uses one ascending key for score, temples, name, and identity", () => {
    const highScore = row({ authUserId: "high", score: 200 });
    const moreTemples = row({ authUserId: "temples", templeCount: 3 });
    const nameFirst = row({ authUserId: "name", displayName: "A Yatri" });
    const identityFirst = row({ authUserId: "auth_a" });
    const identitySecond = row({ authUserId: "auth_b" });

    const sorted = [identitySecond, nameFirst, moreTemples, identityFirst, highScore].sort(
      compareLeaderboardRows
    );
    expect(sorted.map(({ authUserId }) => authUserId)).toEqual([
      "high",
      "temples",
      "name",
      "auth_a",
      "auth_b",
    ]);
    expect(leaderboardRankKey(highScore)[0]).toBe(-200);
  });

  test("keeps opted-out and zero-visit summaries outside the eligible namespace", () => {
    expect(leaderboardSummaryIsEligible(row())).toBe(true);
    expect(leaderboardSummaryIsEligible(row({ optedOut: true }))).toBe(false);
    expect(leaderboardSummaryIsEligible(row({ templeCount: 0 }))).toBe(false);
  });

  test("routes every direct summary writer through the transactional aggregate seam", () => {
    const root = import.meta.dir;
    const authSyncSource = readFileSync(resolve(root, "lib/authSync.ts"), "utf8");
    const refreshSource = readFileSync(resolve(root, "lib/sacredBharatLeaderboard.ts"), "utf8");
    const identityMigrationSource = readFileSync(resolve(root, "authIdentityMigration.ts"), "utf8");
    const sacredSource = readFileSync(resolve(root, "sacredBharat.ts"), "utf8");
    const userProfileSource = readFileSync(resolve(root, "userProfiles.ts"), "utf8");

    expect(refreshSource).toContain("sacredBharatLeaderboardRanks.replaceOrInsert");
    expect(refreshSource).toContain("sacredBharatLeaderboardRanks.insertIfDoesNotExist");
    expect(identityMigrationSource).toContain("sacredBharatLeaderboardRanks.replaceOrInsert");
    expect(authSyncSource).toContain("refreshExistingSacredBharatLeaderboardSummaries");
    expect(userProfileSource).toContain("refreshExistingSacredBharatLeaderboardSummaries");
    for (const mutationName of [
      "markTempleVisited",
      "upsertMyPassportProfile",
      "unmarkTempleVisited",
      "mergeGuestProgress",
      "setLeaderboardOptOut",
    ]) {
      const start = sacredSource.indexOf(`export const ${mutationName}`);
      const next = sacredSource.indexOf("export const ", start + 20);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(sacredSource.slice(start, next < 0 ? undefined : next)).toContain(
        "refreshSacredBharatLeaderboardSummary"
      );
    }
  });
});
