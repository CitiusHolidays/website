# Citius Sanity Content Studio

This separately locked workspace manages blog and gallery content consumed by
the Citius Holidays public site. It is not part of the root Next/Convex runtime,
does not own CRM data, and has its own dependency and deployment boundary.

## Local development

Use Node 22.12 or newer for the Sanity CLI while keeping Bun as the package
manager:

```bash
cd citius-blog
bun install --frozen-lockfile
bun run dev
```

## Verification

```bash
cd citius-blog
bun install --frozen-lockfile
bun run build
bun audit --audit-level=high
```

These commands prove only the Studio workspace. Root application verification
uses `bun run verify:local`; see the root [documentation catalog](../docs/README.md)
and [release operations](../RELEASE.md).

## Ownership

The Studio's configured Sanity project/dataset owns CMS content. The public
Next.js app reads that content through its Sanity integration. A Studio build
does not deploy the public site, change Convex, or prove provider configuration.
Follow
[ADR 0011](../docs/adr/0011-secure-the-standalone-sanity-studio.md) before
dependency or deployment changes.
