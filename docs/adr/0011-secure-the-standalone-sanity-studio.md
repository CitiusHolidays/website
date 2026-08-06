# ADR 0011: Secure the standalone Sanity Studio

## Status

Accepted on 2026-08-05.

## Context

`citius-blog` is an independently locked Sanity Studio rather than a root Bun
workspace. Required Quality previously installed, built, and audited only the
Next.js application, so the Studio's production-capable dependency graph was
outside the release gate. Its Sanity 4 graph reported one critical and 43 high
advisories.

Sanity Studio 6 requires Node 22.12 or newer. Forcing its CLI through Bun also
changed redirect handling for the auto-update version probe and made a valid
build fail before compilation. Bun 1.3.14 retained vulnerable nested lock
entries even when patched versions satisfied their consumers' declared ranges,
and one Vercel CLI helper pinned an older compatible `js-yaml` release.

## Decision

- Keep `citius-blog` independently locked and upgrade it to Sanity and Vision
  6.9.0 with React 19.2.8.
- Run the Sanity CLI with its Node runtime, not `bun --bun`, and require Node
  22.12.0 in Required Quality.
- Keep explicit same-major security floors in the Studio manifest and patched
  compatible resolutions in its lockfile. Do not use global Bun overrides;
  the graph legitimately contains multiple major versions whose export shapes
  differ.
- In Required Quality, perform a frozen Studio install, a static Studio build,
  and a separate high/critical audit. None of these steps deploys the Studio.

## Consequences

The root application and standalone Studio now fail the same pull-request gate
when either dependency graph gains a high or critical advisory. The frozen
Studio graph and build are reproducible locally. Security-floor pins can be
removed only when a regenerated frozen lockfile remains audit-clean and the
Studio build still passes.
