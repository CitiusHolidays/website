# ADR 0004: TypeScript-First Effect Adoption

## Status

Accepted (2026-07-07)

## Context

Citius Travel is moving toward a broad TypeScript migration across the Next.js, React, Convex, and local tooling codebase. Effect is viable for improving complex async orchestration, but adopting it as the default style would make simple code more abstract and give agents too much freedom to invent inconsistent patterns.

## Decision

1. Source files should migrate to TypeScript broadly, using plain TypeScript as the default implementation style.
2. Effect is approved only where it materially simplifies orchestration and a module has at least two of these pressures: external I/O, retry or throttle behavior, concurrency control, typed recoverable errors, rollback or cleanup, and test-time dependency substitution.
3. Business workflow state, Convex schema validators, and straightforward React state remain plain TypeScript unless Effect clearly reduces orchestration complexity.
4. Agents should copy local Effect examples and project conventions instead of inventing ad hoc Effect style.
5. The installed Effect v4 API is the current repository convention. Major upgrades require a separately reviewed dependency update and migration evidence for every retained seam.
6. Each retained Effect seam must have direct behavior tests for the orchestration pressures it owns. Source inventories are not substitutes for those tests.

## Recorded AI evaluation (2026-08-12)

- `src/lib/ai/runtimeService.ts` returned to plain TypeScript: it is injected external I/O plus one
  untrusted-result decoder, and an immediate generic Effect runner did not simplify the boundary.
- `src/lib/ai/providerStream.ts` remains plain TypeScript after the provider-attempt pilot review.
  The AI SDK `ReadableStream` boundary owns cancellation, backpressure, chunk ordering, and commit
  state; wrapping only attempt startup would create a second lifecycle without owning those
  pressures. A shared typed attempt planner and deterministic cleanup tests provide the useful
  simplification without an Effect Stream conversion.
- `src/app/api/create-order/route.ts`, `src/lib/paymentVerification.ts`, and
  `src/lib/razorpayWebhook.ts` returned to plain TypeScript. Their prior generic wrapper was
  immediately collapsed back into Promise/Exit handling and did not own retry, concurrency,
  rollback, or a shared lifecycle. Module-owned discriminated errors now provide exhaustive safe
  HTTP mapping while retaining original causes only for server diagnostics.

## Consequences

- TypeScript migration can proceed independently of Effect adoption.
- Effect use should concentrate around seams such as paced notification delivery, batch imports,
  migrations, or external workflows where at least two pressures are present and one program owns
  their lifecycle. External I/O alone, including a payment API call, is insufficient.
- Code review can reject Effect in modules that do not meet the two-pressure threshold, even if the code is technically valid.

## TypeScript 7 compiler boundary

The repository runs the TypeScript 7 native compiler through the
`@typescript/native` package alias. Local release tooling and Next.js import the
conventional side-by-side TypeScript 6 JavaScript API because TypeScript 7 does
not expose that stable API. This split keeps the
application compiler on TypeScript 7 without breaking the reviewed AST-based
release scanners and codemods.

## Effect v4 migration evidence (2026-08-15)

- The dependency is pinned to `4.0.0-rc.109` while v4 remains on the upstream release-candidate tag.
- The sole inventoried production seam, notification email delivery, now uses v4 retry options with a spaced schedule, an explicit attempt bound, and a typed retry predicate.
- Its deterministic timing test uses the v4 `effect/testing` `TestClock` layer.
- The executable adoption inventory records Effect major 4 and still rejects unlisted production imports.
