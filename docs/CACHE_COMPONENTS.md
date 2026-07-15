# Cache Components policy

Cache Components is enabled in `next.config.mjs`. Public Sanity content is the only shared
application-data cache in the initial adoption slice.

## Public CMS boundary

`src/sanity/cachedFetch.js` applies a shared five-minute stale/revalidation window, a one-hour
expiry, and Sanity webhook tags. It accepts only the public GROQ query, serializable query
parameters, and public content tags. The `/api/revalidate` webhook expires the allowlisted
`blog`, `gallery`, and `spiritual` tags.

## Request-sensitive boundaries

Authentication callbacks, sign-in redirects, password reset tokens, account data, vendor data,
and portal data remain outside every `use cache` scope. Routes that resolve identity from headers
retain an explicit `instant = false` boundary with a reason comment. Cache Components leaves
uncached work dynamic by default, so the obsolete `unstable_noStore` calls were removed.

## Portal boundary

`src/app/portal/layout.js` is the only portal segment that exports `instant = false`. The layout
runs `requireAuth("/portal")`, `authSync.syncMyAuthIdentity`, and `crm.staff.getMyPortalAccess` on
every request, then redirects unauthorized staff to `/account?portal=unauthorized`. That subtree
covers auth guard, role permissions, user identity, saved views, notifications, and CRM data, so
portal leaf `page.js` files do not repeat the opt-out.

Portal routes must never import `cachedSanityFetch` or declare `"use cache"`. Notification deep
links such as `/portal/queries?open=salesDecision&id=…` and `/portal/job-cards/[jobCardId]` stay
under the layout boundary; only client-side Convex queries hydrate workspace data after the
request-specific shell renders.

Expected production build diagnostics for portal:

- `/portal` and the fixed portal leaves: `ƒ (Dynamic)` — request-time auth and access resolution.
- `/portal/job-cards/[jobCardId]`: `◐ (Partial Prerender)` for its param-independent shell; auth,
  access, and Job Card content remain request-time and outside shared caches.
- No portal route reports a shared revalidation window or puts identity-scoped payload in a shared
  cache boundary.

## Verification

Run:

```bash
bun test src/sanity/cachePolicy.contract.test.ts src/app/portal/portalCachePolicy.contract.test.ts src/app/portal/portalLayoutGuard.test.js src/app/api/revalidate/route.test.ts
bun run typecheck
bun run build
```

The production build route table is the cache diagnostic: public routes should prerender or use a
partial shell, while account, vendor, and portal routes must retain request-time behavior. Browser
verification must exercise a public CMS route, each sign-in variant, password reset, account redirect
behavior without a session, and at least one authenticated portal deep link per role when a dev
session is available.

The 14 July 2026 local production build passed with `/blog`, `/gallery`, `/mice`, and `/pilgrimage`
reporting a five-minute revalidation window and one-hour expiry. `/account`, `/vendor`, the three
sign-in variants and fixed portal routes remained dynamic; `/portal/job-cards/[jobCardId]` reported a
param-independent partial shell with its authenticated content still request-time. Portal adoption
keeps a single layout-level `instant = false` boundary and removes redundant leaf opt-outs plus
`unstable_noStore` from the portal layout. Existing image aspect-ratio and Sanity image-builder
deprecation warnings remain outside this cache-policy slice.
