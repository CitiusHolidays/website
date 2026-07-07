import { describe, expect, test } from "bun:test";
import { SACRED_BHARAT_CHALLENGES } from "@/data/sacredBharat/challenges";
import {
  getChallengeBadgeAwards,
  getChallengeProgress,
  sortChallengesForUser,
} from "./challenges.js";

describe("sacred bharat challenges", () => {
  test("computes temple-count challenge progress", () => {
    const challenge = SACRED_BHARAT_CHALLENGES.find((item) => item.slug === "first-five-darshans");
    const progress = getChallengeProgress(challenge, {
      trails: [],
      visitedTempleIds: ["kedarnath", "badrinath"],
    });
    expect(progress.percent).toBe(40);
    expect(progress.complete).toBe(false);
  });

  test("awards badges and sorts active challenges first", () => {
    const progress = {
      trails: [{ complete: true, slug: "char-dham-trail" }],
      visitedTempleIds: ["kedarnath", "badrinath", "dwarka", "jagannath", "ramanathaswamy"],
    };
    expect(getChallengeBadgeAwards(progress).length).toBeGreaterThan(0);
    expect(sortChallengesForUser(SACRED_BHARAT_CHALLENGES, progress)[0].progress.complete).toBe(
      false
    );
  });
});
