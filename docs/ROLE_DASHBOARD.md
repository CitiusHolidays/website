# Citius Connect role dashboard

The portal home is an action-first morning workspace. `DashboardView` keeps urgent and owned work ahead of supporting KPIs and reporting, while `dashboardPersona.js` decides which sections each permission set can see.

## Primary metric contract

`dashboardMetrics.js` is the single registry for the Sales, Contracting, Operations, Ticketing, Finance, HR, and Director/Admin KPI sets. Each set:

- contains no more than six primary metrics;
- is filtered again through the signed-in user's permissions;
- uses stable metric IDs rather than display labels;
- resolves to a filtered portal drill-down that preserves the selected date range; and
- excludes query-type reporting, which remains a secondary reporting surface.

The metric grid rejects more than six entries instead of silently truncating them.

## Freshness and dates

`DashboardCoverageNotice` remains visible whenever aggregate coverage is incomplete or stale. It states that values may be partial and shows the last successful completion when available. The shared period controls retain the portal's DD/MM/YYYY display rules, and the action/period row uses a stable grid layout so changing the range does not reposition quick actions at desktop widths.

## Verification

The dashboard contract is covered by:

- pure persona and permission tests;
- mounted KPI-grid tests for every major persona family;
- mounted partial/stale aggregate-notice tests;
- Convex summary and drill-down path parity tests; and
- signed-in desktop and 390px browser checks when least-privilege role sessions are available.
