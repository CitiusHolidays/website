# 007 — Make portal dashboard motion crisp

- **Status**: TODO
- **Commit**: fe423b1
- **Severity**: HIGH
- **Category**: Purpose, frequency, and performance
- **Estimated scope**: 2 files, medium

## Problem

Routine CRM data repeatedly enters with long decorative motion:

```jsx
// src/components/portal/PortalWorkspace.js:1238-1242 — current
<m.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }}
  transition={{ delay: 0.05, duration: 0.4 }}>

// src/components/portal/dashboard/DashboardPanel.js:78-83 — current
<m.div animate={{ scaleX: pct / 100 }} initial={{ scaleX: 0 }}
  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
```

Mapped rows, KPI cards, and progress fills use 350–800 ms Motion shorthand transforms and stagger, slowing a high-frequency operational surface.

## Target

- Remove decorative mount and hover movement from routine dashboard panels, rows, and KPI cards; render them as ordinary `div`s.
- Preserve color/shadow hover feedback through CSS only.
- Progress fills may explain a changed value, but use a direct `transform: scaleX(...)` target with a 200 ms strong ease-out and no mount delay.

## Repo conventions to follow

- Professional portal motion is crisp and uses `--portal-ease-out`.
- Existing progress fills already use `origin-left` and transform rather than width.

## Steps

1. In `PortalWorkspace.js`, remove the decorative `m.div` entrance/hover wrappers around secondary panels, active-tour rows, urgent-action rows, fund projections, query-type KPI cards, and stat cards.
2. Retain semantic markup, classes, values, and shadow/color hover feedback.
3. Convert both progress implementations to full transform-string targets and 0.2-second strong ease-out transitions, with reduced motion resolving immediately to the target.
4. In `DashboardPanel.js`, apply the same progress behavior.

## Boundaries

- Do NOT change dashboard data, links, filtering, layout, or copy.
- Do NOT introduce permanent `will-change`.
- Do NOT add dependencies.

## Verification

- **Mechanical**: defer until all plans finish; then run the complete final verification batch.
- **Feel check**: navigate repeatedly between portal dashboard views; data should be immediately readable, and progress changes should remain legible without replaying a long fill.
- **Done when**: routine cards and rows do not fly in or lift, and progress settles in at most 200 ms.
