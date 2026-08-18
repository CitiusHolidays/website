export type UiBaselineSurface = "account" | "public" | "staff";
export type UiBaselineMotionPreference = "no-preference" | "reduce";
export type UiBaselineColorPreference = "dark" | "light" | "system";

export interface UiBaselineCapture {
  browser: string;
  capturedAt: string;
  colorPreference: UiBaselineColorPreference;
  dirtyFingerprint: string;
  dpr: number;
  dynamicMasks: string[];
  fixture: string;
  gitRevision: string;
  id: string;
  imagePath: string;
  motionPreference: UiBaselineMotionPreference;
  pageMarkers: string[];
  pairedBaselineId: string | null;
  role: string;
  rootFontSizePx: number;
  route: string;
  state: string;
  surface: UiBaselineSurface;
  viewport: { height: number; width: number };
}

export interface UiBaselineManifest {
  captures: UiBaselineCapture[];
  schemaVersion: 1;
}

export interface UiBaselineValidationResult {
  errors: string[];
  warnings: string[];
}

const GIT_REVISION_PATTERN = /^[a-f0-9]{40}$/;
const DIRTY_FINGERPRINT_PATTERN = /^sha256:[a-f0-9]+$/;

function captureCell(capture: UiBaselineCapture) {
  return [
    capture.surface,
    capture.route,
    capture.role,
    capture.fixture,
    capture.state,
    `${capture.viewport.width}x${capture.viewport.height}`,
    capture.colorPreference,
  ].join("|");
}

function comparisonFields(capture: UiBaselineCapture) {
  return [
    capture.surface,
    capture.route,
    capture.role,
    capture.fixture,
    capture.state,
    capture.viewport.width,
    capture.viewport.height,
    capture.dpr,
    capture.rootFontSizePx,
    capture.motionPreference,
    capture.colorPreference,
  ];
}

function validateCaptureContract(capture: UiBaselineCapture, errors: string[]) {
  const prefix = `capture ${capture.id || "<missing-id>"}`;
  if (!capture.id.trim()) {
    errors.push(`${prefix} is missing an id`);
  }
  if (!GIT_REVISION_PATTERN.test(capture.gitRevision)) {
    errors.push(`${prefix} has an invalid gitRevision`);
  }
  if (!DIRTY_FINGERPRINT_PATTERN.test(capture.dirtyFingerprint)) {
    errors.push(`${prefix} has an invalid dirtyFingerprint`);
  }
  if (!capture.imagePath.startsWith(".scratch/ui-baselines/")) {
    errors.push(`${prefix} imagePath must stay under .scratch/ui-baselines/`);
  }
  if (!(capture.viewport.width > 0 && capture.viewport.height > 0 && capture.dpr > 0)) {
    errors.push(`${prefix} has invalid viewport or DPR geometry`);
  }
  if (!(capture.rootFontSizePx >= 16)) {
    errors.push(`${prefix} rootFontSizePx must be at least 16`);
  }
  if (capture.route.includes("tab=profile") && !capture.pageMarkers.includes("Profile")) {
    errors.push(`${prefix} profile capture is missing a Profile marker`);
  }
  if (capture.route.includes("tab=settings") && !capture.pageMarkers.includes("Settings")) {
    errors.push(`${prefix} settings capture is missing a Settings marker`);
  }
}

function validateComparisonPairs(
  captures: UiBaselineCapture[],
  byId: Map<string, UiBaselineCapture>,
  errors: string[]
) {
  for (const capture of captures) {
    if (!capture.pairedBaselineId) {
      continue;
    }
    const paired = byId.get(capture.pairedBaselineId);
    if (!paired) {
      errors.push(`capture ${capture.id} references missing pair ${capture.pairedBaselineId}`);
      continue;
    }
    if (
      comparisonFields(capture).some((field, index) => field !== comparisonFields(paired)[index])
    ) {
      const mismatch = capture.fixture === paired.fixture ? "comparison state" : "fixture";
      errors.push(`capture ${capture.id} uses an incompatible ${mismatch} with ${paired.id}`);
    }
  }
}

function validateAccessibilityPairs(captures: UiBaselineCapture[], errors: string[]) {
  for (const capture of captures) {
    if (capture.motionPreference !== "no-preference" || capture.rootFontSizePx !== 16) {
      continue;
    }
    const cell = captureCell(capture);
    const hasReducedMotion = captures.some(
      (candidate) => captureCell(candidate) === cell && candidate.motionPreference === "reduce"
    );
    const hasLargeText = captures.some(
      (candidate) => captureCell(candidate) === cell && candidate.rootFontSizePx === 20
    );
    if (!hasReducedMotion) {
      errors.push(`capture ${capture.id} is missing a reduced-motion companion`);
    }
    if (!hasLargeText) {
      errors.push(`capture ${capture.id} is missing a 20px-root companion`);
    }
  }
}

export function validateUiBaselineManifest(
  manifest: UiBaselineManifest,
  options: { requireAccessibilityPairs?: boolean } = {}
): UiBaselineValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (manifest.schemaVersion !== 1) {
    errors.push("manifest schemaVersion must be 1");
    return { errors, warnings };
  }

  const byId = new Map<string, UiBaselineCapture>();
  for (const capture of manifest.captures) {
    validateCaptureContract(capture, errors);
    if (byId.has(capture.id)) {
      errors.push(`capture id ${capture.id} is duplicated`);
    } else {
      byId.set(capture.id, capture);
    }
  }

  validateComparisonPairs(manifest.captures, byId, errors);

  if (options.requireAccessibilityPairs) {
    validateAccessibilityPairs(manifest.captures, errors);
  }

  return { errors, warnings };
}
