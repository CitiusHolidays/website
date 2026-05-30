import { describe, expect, test } from "bun:test";
import { TRAILS } from "@/data/sacredBharat/trails";
import {
  computeProgress,
  computeScore,
  getLevelForScore,
  isBharatExplorerComplete,
  isTrailComplete,
  normalizeVisitedSet,
} from "./scoring";

describe("sacred bharat scoring", () => {
  test("normalizes invalid temple ids", () => {
    const set = normalizeVisitedSet(["kedarnath", "not-a-temple"]);
    expect(set.size).toBe(1);
    expect(set.has("kedarnath")).toBe(true);
  });

  test("awards per-temple points and overlapping trail progress", () => {
    const ids = ["kedarnath", "badrinath", "kailash-mansarovar"];
    const score = computeScore(ids);
    expect(score).toBeGreaterThanOrEqual(75 + 400);
    const himalayan = TRAILS.find((t) => t.slug === "himalayan-awakening-trail");
    expect(isTrailComplete(himalayan, normalizeVisitedSet(ids))).toBe(true);
  });

  test("shiva trail completes with all five temples", () => {
    const shiva = TRAILS.find((t) => t.slug === "shiva-trail");
    const ids = shiva.templeIds;
    expect(isTrailComplete(shiva, normalizeVisitedSet(ids))).toBe(true);
    const progress = computeProgress(ids);
    expect(progress.badges.some((b) => b.badgeId === "mahadev-explorer")).toBe(true);
    expect(progress.score).toBe(ids.length * 25 + shiva.completionBonus);
  });

  test("bharat explorer requires all four regions", () => {
    expect(isBharatExplorerComplete(normalizeVisitedSet(["vaishno-devi"]))).toBe(false);
    const complete = normalizeVisitedSet(["vaishno-devi", "meenakshi", "kamakhya", "somnath"]);
    expect(isBharatExplorerComplete(complete)).toBe(true);
    const explorer = TRAILS.find((t) => t.slug === "bharat-explorer-trail");
    expect(isTrailComplete(explorer, complete)).toBe(true);
  });

  test("level boundaries", () => {
    expect(getLevelForScore(0).slug).toBe("seeker");
    expect(getLevelForScore(250).slug).toBe("seeker");
    expect(getLevelForScore(251).slug).toBe("pilgrim");
    expect(getLevelForScore(1000).slug).toBe("yatri");
    expect(getLevelForScore(1001).slug).toBe("dharma-explorer");
    expect(getLevelForScore(2000).slug).toBe("sacred-bharat-ambassador");
    expect(getLevelForScore(2001).slug).toBe("moksha-pathfinder");
  });

  test("char dham bonus stacks with overlapping trail bonuses", () => {
    const ids = ["badrinath", "dwarka", "jagannath", "rameswaram"];
    const progress = computeProgress(ids);
    expect(progress.score).toBeGreaterThanOrEqual(4 * 25 + 500);
    expect(progress.badges.some((b) => b.badgeId === "char-dham-conqueror")).toBe(true);
    expect(progress.badges.some((b) => b.badgeId === "sacred-bharat-explorer")).toBe(true);
  });
});
