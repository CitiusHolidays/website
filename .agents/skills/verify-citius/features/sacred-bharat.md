# Sacred Bharat

Guests open the Sacred Bharat experience, browse trails, and the page reports anonymous engagement
events through the site's event gateway. Yatri sign-in is optional and separate from Staff and
Customer Account identity.

## Sub-features

- `sacred-bharat` the landing page renders "Sacred Bharat" without page or console errors.
- `sacred-bharat-events` the page's `POST /api/sacred-bharat/events` gateway accepts events.
- `sacred-bharat-trail` a trail page such as `/sacred-bharat/trails/shiva-trail` renders.

## How to get to it (user POV)

- Open `/sacred-bharat` from the site navigation or directly; choose a trail.

## Driving it with agent-browser smoke

Preconditions:

- Doctor exits 0.

- **Landing.** `bun scripts/browser-smoke.ts --profiles public --cases sacred-bharat --strict`. The page
  text matches; with the local env from `.env.local` the case fails only on
  `POST /api/sacred-bharat/events (Ping) 503`.
- **Gateway.** The 503 body is "Event service is temporarily unavailable." because
  `SACRED_BHARAT_EVENT_GATEWAY_SECRET` is not configured locally. Report `sacred-bharat-events` as
  failed for that reason.
- **Trail.** Covered by `bun run test:e2e:public-instant` (`/sacred-bharat/trails/shiva-trail`).
- **Proof.** Keep `.scratch/browser-smoke/sacred-bharat.{json,png}` in the evidence directory.

## Gotchas

- Configuring the gateway secret turns browsing into database writes on the shared dev deployment.
  Only do it on an isolated or explicitly authorized target.
- Guest-to-Yatri merge (`e2e/specs/sacred-bharat-guest-merge.spec.ts`) needs the seeded E2E target.
