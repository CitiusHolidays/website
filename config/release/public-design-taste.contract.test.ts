import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

describe("public design-taste review contract", () => {
  test("keeps the public review bounded and explicit about follow-up", () => {
    const review = readFileSync(join(ROOT, "docs/PUBLIC_DESIGN_TASTE_REVIEW.md"), "utf8");

    for (const requiredTerm of [
      "HomeHeroClient.js",
      "publicVisualIdentity.contract.test.ts",
      "public-media-edge",
      "MP4-only",
      "390px",
      "reduced-motion",
      "Commercial-files is also",
      "entire public site has been redesigned",
    ]) {
      expect(review).toContain(requiredTerm);
    }
    expect(review).toContain("baseline captured");
    expect(review).toContain("Intentional exception");
  });
});
