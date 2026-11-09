# Public site

Anonymous visitors browse the Citius Holidays marketing site: the home page, pilgrimage listings, and
individual trail/tour pages, on desktop and mobile, without errors or failed same-origin requests.

## Sub-features

- `public-home` home page renders the hero heading on desktop.
- `public-home-mobile` the same page at 390x844.
- `pilgrimage` the pilgrimage listing (Sanity-backed) renders.
- `kailash-trail-mobile` a tour detail page renders on mobile.
- `public-instant` instant (prefetched) and final content for `/`, a pilgrimage tour, and a Sacred
  Bharat trail.

## How to get to it (user POV)

- Open `/` directly or via "Back to website" on any sign-in page.
- Open `/pilgrimage`, then a tour such as `/pilgrimage/kailash-mansarovar-14day`.

## Driving it with agent-browser smoke and Playwright

Preconditions:

- Doctor exits 0; `.env.local` names both `NEXT_PUBLIC_SANITY_*` keys.

- **Desktop routes.** Warm, then run: `agent-browser --session citius-browser-smoke-public open
  $BROWSER_SMOKE_BASE_URL/` then `bun scripts/browser-smoke.ts --profiles public --cases
  public-home,pilgrimage,kailash-trail-mobile --strict`. Each line reads `passed  <id>`; `public-home`
  sees "Your next great journey", `pilgrimage` sees "Seek Stillness", the trail sees "Kailash
  Mansarovar Yatra 2026".
- **Mobile home.** Fresh session: `agent-browser --session citius-browser-smoke-public close`, then
  `bun scripts/browser-smoke.ts --profiles public --cases public-home-mobile --strict`. Reads `passed`.
- **Instant navigation (Playwright).** `bun run test:e2e:public-instant`. All three routes pass. Needs
  the pinned Playwright browser installed.
- **Proof.** `… | tee .scratch/verify-citius/evidence/public-smoke.txt`; copy `.scratch/browser-smoke/`
  into the evidence directory when anything failed.

## Gotchas

- Missing Sanity keys → `/pilgrimage*` 500 with `Configuration must contain projectId`, and the stale
  error keeps surfacing as page errors in later cases until `next dev` restarts.
- Same-URL viewport switch in one agent-browser session drops the page (`assertion failed at blank`);
  that is tooling. Use a fresh session for the mobile home case.
- agent-browser prefixes network rows with request IDs like `[78649.589]`; the smoke harness strips
  them before reading the status. If an older harness reports a failure on a row whose trailing status
  is 2xx, that is the ID being read as a status, not an app failure.
