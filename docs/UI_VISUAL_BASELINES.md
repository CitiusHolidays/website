# Revision-bound UI visual baselines

Visual baselines are read-only evidence tied to one exact revision and fixture state. They do not
authorize a redesign, prove deployment, or permit Staff/Account data mutation. Keep all captures and
manifests under ignored `.scratch/ui-baselines/<revision>/`; only the validator and this recipe are
tracked.

## Capture record

Each `design-baseline.json` uses schema version 1 and records, per image: the Git revision and dirty
fingerprint, route, product surface, authenticated role and fixture, viewport and DPR, root font
size, color and motion preferences, open UI state, browser/runtime, semantic page markers, capture
time, image path, dynamic-mask allowlist, and optional paired-baseline ID.

Validate a loaded manifest with `validateUiBaselineManifest` from
`config/release/ui-baseline-manifest.ts`. Enable `requireAccessibilityPairs` for a complete capture
set; it requires reduced-motion and 20px-root companions for each ordinary 16px/no-preference cell.
The validator also rejects Profile/Settings filenames whose page markers identify a different
Account tab, missing comparison targets, duplicate IDs, and comparisons across incompatible role,
fixture, route, viewport, preference, or UI state.

## Required matrix

- Staff: shell/dashboard, Sales Queries desktop/mobile, notification, command palette, and New
  Query states at 1440×1000, 1024×900, 768×1024, and 390×844.
- Customer Account: Journeys, Profile, Settings, and menu at the same responsive boundaries.
- Accessibility companions: 20px root text and reduced motion for every canonical default cell.
- Every run records document overflow and focus restoration separately from pixel comparison.

Use a dedicated non-production local target and least-privilege fixtures. Do not click notification
rows (clicking is the read authority), submit forms, upload files, or invoke mutations. If the
required authenticated sessions or target are absent, record the cell as unavailable; never replace
it with production or a different role and never relabel an old screenshot as current proof.
