# Local development

## Quick start

1. Copy environment variables from your team vault into `.env.local` (Convex URL, Better Auth secrets, `SITE_URL` with `http://` scheme).
2. Install dependencies: `bun install`
3. Run Convex and Next.js together: `bun run dev:all`
4. Open the site at `http://localhost:3000` and the portal at `/auth/connect`.

`dev:all` starts `bunx convex dev` and `bun --bun next dev --turbopack` in parallel. Use separate terminals instead if you prefer isolated logs.

## Common commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Next.js only (assumes Convex already running) |
| `bun run convex:dev` | Convex backend watcher |
| `bun run check` | Lint ratchet + full test suite |
| `bun run check:fast` | Tests only (skip lint) |
| `bun run typecheck` | App TypeScript |
| `bun run convex:typecheck` | Convex TypeScript |
| `bunx convex codegen` | Regenerate `_generated` after schema/API changes |

## Auth and env notes

- Restart Next.js fully after auth env changes (`SITE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`); hot reload does not reload auth module URLs.
- Staff sign in via **Forgot password** on `/auth/connect`, not sign-up.
- Cloud agents may set `CONVEX_AGENT_MODE=anonymous` when running `npx convex dev` to avoid conflicting with your personal deployment.

## Verification before push

```bash
bun run check:fast path/to/changed.test.ts   # focused tests
bun run check                                 # lint + tests before merge
```

After Convex schema or function signature changes, run `bunx convex codegen` (or keep `convex dev` running).
