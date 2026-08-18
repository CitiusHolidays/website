import { describe, expect, test } from "bun:test";
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

describe("Sacred Bharat ranking", () => {
  test("Uses one ascending key for score, temples, name, and identity", () => {
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

  test("Keeps opted-out and zero-visit summaries outside the eligible namespace", () => {
    expect(leaderboardSummaryIsEligible(row())).toBe(true);
    expect(leaderboardSummaryIsEligible(row({ optedOut: true }))).toBe(false);
    expect(leaderboardSummaryIsEligible(row({ templeCount: 0 }))).toBe(false);
  });
});
