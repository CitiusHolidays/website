import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const SOURCE_EXTENSION_PATTERN = /\.(?:js|jsx|ts|tsx)$/;

const retiredSourcePaths = [
  "src/app/(authenticated)/vendor/page.client.js",
  "src/components/sacredBharat/GuestSaveBanner.js",
  "src/components/sacredBharat/JourneyPlannerPanel.js",
  "src/components/sacredBharat/SacredBharatProvider.js",
  "src/components/sacredBharat/TempleChecklist.js",
  "src/components/sacredBharat/TrailCompletionReveal.js",
  "src/components/vendor/VendorSkipLink.js",
  "src/data/sacredBharat/challenges.js",
  "src/data/sacredBharat/levels.js",
  "src/data/sacredBharat/regions.js",
  "src/lib/sacredBharat/challenges.js",
  "src/lib/sacredBharat/guestMergeClient.js",
  "src/lib/sacredBharat/guestStorage.js",
  "src/lib/sacredBharat/journeyPlannerStream.js",
  "src/lib/sacredBharat/scoring.js",
  "src/lib/sacredBharat/yatriPassport.js",
] as const;

const retiredImportFragments = [
  "/sacredBharat/GuestSaveBanner",
  "/sacredBharat/JourneyPlannerPanel",
  "/sacredBharat/SacredBharatProvider",
  "/sacredBharat/TempleChecklist",
  "/sacredBharat/TrailCompletionReveal",
  "/sacredBharat/challenges",
  "/sacredBharat/guestMergeClient",
  "/sacredBharat/guestStorage",
  "/sacredBharat/journeyPlannerStream",
  "/sacredBharat/levels",
  "/sacredBharat/regions",
  "/sacredBharat/scoring",
  "/sacredBharat/yatriPassport",
  "/vendor/VendorSkipLink",
] as const;

function productionSourceFiles(directory = "src"): string[] {
  return readdirSync(join(root, directory)).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(join(root, path)).isDirectory()) {
      return productionSourceFiles(path);
    }
    return SOURCE_EXTENSION_PATTERN.test(entry) && !entry.includes(".test.") ? [path] : [];
  });
}

describe("Retired surface inventory", () => {
  test("keeps the reachability-proven client and Vendor placeholder files absent", () => {
    for (const path of retiredSourcePaths) {
      expect(existsSync(join(root, path))).toBe(false);
    }

    for (const path of productionSourceFiles()) {
      const source = read(path);
      for (const fragment of retiredImportFragments) {
        expect(source).not.toContain(fragment);
      }
    }
  });

  test("keeps the active Sacred edition and removes provider work from the retired API route", () => {
    expect(read("src/app/(public)/sacred-bharat/page.js")).toContain(
      "@/components/sacredBharat/edition/SacredBharatEdition"
    );

    const plannerRoute = read("src/app/api/sacred-bharat/journey-planner/route.js");
    expect(plannerRoute).toContain("status: 410");
    expect(plannerRoute).not.toContain("OPENROUTER_API_KEY");
    expect(plannerRoute).not.toContain("executeAiProviderOrchestration");
    expect(plannerRoute).not.toContain("streamText");
  });
});
