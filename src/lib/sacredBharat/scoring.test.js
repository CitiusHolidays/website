import { describe, expect, test } from "bun:test";
import { TRAILS } from "@/data/sacredBharat/trails";
import { getTemplePoints } from "@/data/sacredBharat/temples";
import {
  computeProgress,
  computeScore,
  computeTemplePointsTotal,
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

  test("awards weighted temple points and trail bonuses", () => {
    const ids = ["kedarnath", "badrinath", "kailash-mansarovar"];
    const visited = normalizeVisitedSet(ids);
    const templeTotal = computeTemplePointsTotal(visited);
    const score = computeScore(ids);
    expect(templeTotal).toBe(97 + 95 + 100);
    expect(score).toBeGreaterThanOrEqual(templeTotal + 400);
    const himalayan = TRAILS.find((t) => t.slug === "himalayan-awakening-trail");
    expect(isTrailComplete(himalayan, visited)).toBe(true);
  });

  test("tirupati awards 100 temple points", () => {
    expect(getTemplePoints("tirupati")).toBe(100);
    expect(computeScore(["tirupati"])).toBe(100);
  });

  test("shiva trail completes with all five temples", () => {
    const shiva = TRAILS.find((t) => t.slug === "shiva-trail");
    const ids = shiva.templeIds;
    expect(isTrailComplete(shiva, normalizeVisitedSet(ids))).toBe(true);
    const progress = computeProgress(ids);
    expect(progress.badges.some((b) => b.badgeId === "mahadev-explorer")).toBe(true);
    const templeTotal = shiva.templeIds.reduce((sum, id) => sum + getTemplePoints(id), 0);
    expect(progress.templePointsTotal).toBe(templeTotal);
    expect(progress.score).toBe(
      templeTotal + shiva.completionBonus + progress.challengeBonusTotal
    );
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

  test("merges legacy temple ids without double counting", () => {
    const legacy = normalizeVisitedSet(["rameswaram", "ramanathaswamy", "varanasi", "kashi-vishwanath"]);
    expect(legacy.size).toBe(2);
    expect(legacy.has("ramanathaswamy")).toBe(true);
    expect(legacy.has("kashi-vishwanath")).toBe(true);
    expect(computeScore(["rameswaram", "varanasi"])).toBe(98 + 92);
  });

  test("challenge points add to soul score", () => {
    const ids = ["kedarnath", "badrinath", "dwarka", "jagannath", "ramanathaswamy"];
    const progress = computeProgress(ids);
    expect(progress.challengeBonusTotal).toBeGreaterThan(0);
    expect(progress.score).toBe(
      progress.templePointsTotal + progress.trailBonusTotal + progress.challengeBonusTotal
    );
  });
});
