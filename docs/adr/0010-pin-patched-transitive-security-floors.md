# ADR 0010: Pin patched transitive security floors

## Status

Accepted on 2026-08-05.

## Context

The root application used `next-sanity` only for Sanity client creation, GROQ
query tagging, and Portable Text rendering. Its required `sanity` peer pulled
the full Studio and CLI toolchain into the production dependency graph. That
graph carried critical and high advisories unrelated to the deployed reader.

After replacing the umbrella package with `@sanity/client` and
`@portabletext/react`, two high-advisory families remained across multiple
major versions. The static GROQ queries remain plain strings, avoiding the
standalone `groq` package's Node 22.12 runtime floor. Bun 1.3.14 retained vulnerable nested lock entries
even when patched versions satisfied the consumers' declared ranges. A single
global override was unsafe because old and current `brace-expansion` consumers
use different export shapes, and the graph legitimately contains Undici 7 and
8.

## Decision

- Pin `brace-expansion@1.1.18` and `undici@7.29.0` as explicit security floors
  in the root manifest.
- Keep the compatible patched lock resolutions for every installed major:
  `brace-expansion` 1.1.18, 2.1.4, and 5.0.9; Undici 7.29.0 and 8.10.0.
- Verify reproducibility with `bun install --frozen-lockfile` and enforce the
  result with `bun audit --audit-level=high`.
- Keep the separate `citius-blog` Sanity Studio independent; this decision
  applies only to the root Next.js application.

## Consequences

The production application no longer installs the Sanity Studio/CLI through a
reader-only dependency, and high or critical advisories fail the release gate.
When Bun can refresh compatible nested versions reliably, the direct security
floors may be removed only after a frozen install and audit remain clean.
