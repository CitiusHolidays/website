# Citius Convex backend

This directory owns the database schema, Better Auth component integration,
public/account functions, and Citius Connect CRM authority. Start with the
[backend reference](../docs/BACKEND_INFRASTRUCTURE.md) and
[documentation catalog](../docs/README.md).

## Boundaries

- `schema.ts` owns application tables. Better Auth component tables remain
  component-owned.
- `crm/` owns Staff Workspace business functions. `crm/lib/rolePolicy.ts` owns
  role-permission data; backend guards remain authoritative over client UI.
- Public function return validators and bounded list/detail contracts follow
  [Convex return contracts](../docs/CONVEX_RETURN_CONTRACTS.md).
- Request-bound Next routes own HTTP/provider edges. Server-capability mutations
  fail closed and are not general browser APIs.
- `_generated/` is ignored and target-derived. Read
  `_generated/ai/guidelines.md` before changing Convex code.

## Local work

Run focused tests first:

```bash
bun run test -- convex/crm/example.test.ts
```

Then run `bun run convex:typecheck`. Before `bunx convex codegen`, development,
build, or deploy, identify the exact Convex target and follow
[release operations](../RELEASE.md). Codegen or a build is target-aware evidence;
it is not target-neutral local proof.

Never use a Production target, migration, or database mutation without fresh
explicit authority.
