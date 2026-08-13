# Auth origin and domain cutover

This is the single source of truth for the browser origin used by Better Auth,
the Next.js server, and Convex-backed session exchange.

## Origin contract

The browser uses `NEXT_PUBLIC_APP_URL`. Next and the Convex runtime accept the
same reviewed keys in this order:

1. `BETTER_AUTH_URL`
2. `SITE_URL`
3. `NEXT_PUBLIC_APP_URL`
4. Local development fallback: `http://localhost:3000` (never used in production)

The selected values must be absolute `http://` or `https://` URLs and every
configured value must resolve to the same origin. `NEXT_PUBLIC_SITE_URL` is a
deprecated non-authority: authentication never resolves from it, and hosted
preflight fails if a retained value conflicts with the canonical origin. Remove
the alias from Vercel and Convex after confirming no unrelated integration uses
it.

In Preview and Production, set all three supported values to the same origin; a
mismatch can send a session cookie to one host while the Convex token exchange
calls another.
`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` are the matching
Convex data and auth-site endpoints and are intentionally different origins.

First capture a reviewed, names-only Convex runtime evidence file from the exact
selected deployment. The artifact may contain variable names, the normalized
auth origin, and a boolean `BETTER_AUTH_SECRET` minimum-length check; it must
never contain values. Google remains optional, but its two variable names must
appear together. Then run the target-aware preflight:

```sh
bun run env:preflight -- --target preview --convex-env-evidence <preview-evidence.json>
bun run env:preflight -- --target production --convex-env-evidence <production-evidence.json>
```

The preflight binds the evidence target and deployment to `CONVEX_DEPLOYMENT`,
requires the runtime-scoped names from `config/environment.registry.json`, and
reports variable names only. It never prints secret values. Creating the
evidence contacts a deployment and remains a separate target-approved step.

## Domain cutover checklist

1. Create the new Preview or Production origin and confirm its HTTPS certificate.
2. Set `BETTER_AUTH_URL`, `SITE_URL`, and `NEXT_PUBLIC_APP_URL` to that exact
   origin in both the Vercel project and the matching Convex deployment.
3. Confirm `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` point to
   the same Convex deployment in the browser and Convex runtime settings.
4. Capture names-only Convex runtime evidence for the exact deployment, run
   `bun run env:preflight -- --target <target> --convex-env-evidence <path>`,
   and run the auth/browser smoke checks against the new origin.
5. Deploy, then purge or revalidate any cached redirect/shell responses. Private
   authenticated routes must return `Cache-Control: private, no-store` and
   vary on `Cookie`.
6. Verify a fresh staff login, `/portal` CRM data, sign-out, and a second login
   in a new browser context. Keep the old origin available until these checks
   pass.
7. Remove old-domain auth redirects only after DNS propagation and session
   validation are complete.

If login loops or the CRM is empty after cutover, first compare the Convex URL
embedded in the browser bundle with the Convex deployment configured in Vercel;
then inspect the response cache headers before changing auth code.
