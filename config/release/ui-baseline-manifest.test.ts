import { describe, expect, test } from "bun:test";
import { validateUiBaselineManifest } from "./ui-baseline-manifest";

const baseCapture = {
  browser: "Chromium 140",
  capturedAt: "2026-08-12T12:00:00.000Z",
  colorPreference: "light" as const,
  dirtyFingerprint: "sha256:abc123",
  dpr: 1,
  dynamicMasks: [] as string[],
  fixture: "sales-empty",
  gitRevision: "a045fd1b87689b6283a379422be5808148eb90bb",
  id: "staff-dashboard-desktop",
  imagePath: ".scratch/ui-baselines/a045fd1/staff-dashboard-desktop.png",
  motionPreference: "no-preference" as const,
  pageMarkers: ["Dashboard", "My work today"],
  pairedBaselineId: null,
  role: "Sales",
  rootFontSizePx: 16,
  route: "/portal",
  state: "default",
  surface: "staff" as const,
  viewport: { height: 1000, width: 1440 },
};

describe("UI baseline manifest", () => {
  test("accepts attributable captures with compatible comparison pairs", () => {
    const result = validateUiBaselineManifest({
      captures: [
        baseCapture,
        {
          ...baseCapture,
          id: "staff-dashboard-desktop-reference",
          imagePath: ".scratch/ui-baselines/reference/staff-dashboard-desktop.png",
          pairedBaselineId: "staff-dashboard-desktop",
        },
      ],
      schemaVersion: 1,
    });
    expect(result.errors).toEqual([]);
  });

  test("rejects mislabeled Account state and incompatible comparison fixtures", () => {
    const result = validateUiBaselineManifest({
      captures: [
        baseCapture,
        {
          ...baseCapture,
          fixture: "account-journeys",
          id: "account-profile-mobile",
          imagePath: ".scratch/ui-baselines/a045fd1/account-profile-mobile.png",
          pageMarkers: ["Journeys"],
          role: "Customer",
          route: "/account?tab=profile",
          surface: "account",
          viewport: { height: 844, width: 390 },
        },
        {
          ...baseCapture,
          fixture: "sales-populated",
          id: "staff-dashboard-other-fixture",
          pairedBaselineId: "staff-dashboard-desktop",
        },
      ],
      schemaVersion: 1,
    });
    expect(result.errors.join("\n")).toContain("profile capture is missing a Profile marker");
    expect(result.errors.join("\n")).toContain("uses an incompatible fixture");
  });

  test("reports missing reduced-motion and 20px-root companion cells", () => {
    const result = validateUiBaselineManifest(
      { captures: [baseCapture], schemaVersion: 1 },
      { requireAccessibilityPairs: true }
    );
    expect(result.errors.join("\n")).toContain("reduced-motion companion");
    expect(result.errors.join("\n")).toContain("20px-root companion");
  });
});
