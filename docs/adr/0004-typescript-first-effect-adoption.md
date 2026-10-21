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

- At that migration the dependency was pinned to `4.0.0-rc.109`, the upstream release candidate.
- At that migration, notification email delivery used v4 retry options with a spaced schedule, an explicit attempt bound, and a typed retry predicate.
- Its deterministic timing test uses the v4 `effect/testing` `TestClock` layer.
- `config/release/package-contract.test.ts` checks the exact Effect pin. The earlier claim that an executable import allowlist rejects unlisted seams is stale; no such guard exists in this revision.


## Rat Stack reference and current seams (2026-10-20)

Use [Rat Stack's agent guide](https://ratstack.sh/llms.txt) for discovery and its
[source at `16db4de8`](https://github.com/joelhooks/rat-stack/tree/16db4de8b861c1fd0414b27481294a52769eef9c)
as a reference. Citius now pins stable Effect `4.0.5`. Check
installed `node_modules/effect/src` and `ai-docs` before borrowing APIs. This ADR,
repository instructions, and existing Next.js/Convex architecture remain authoritative.

- Keep recoverable errors concrete and dependencies explicit at real I/O seams.
  Reuse existing validators and contracts across their actual callers; add projections
  only when another interface needs the same capability.
- Own cleanup with finalizers, bound waits, and preserve caller cancellation.
  Keep provider retry identities and attempt bounds intact.
- Follow [test-behaviour](https://ratstack.sh/skills/test-behaviour): supply substitutes,
  use controlled time, assert independent expected results, then plant a violation,
  observe failure, restore it, and rerun. Retain the existing Bun and Convex test lanes.
- Use the existing lint/ratchet and package contract checks. Follow
  [keep-or-cut](https://ratstack.sh/skills/keep-or-cut) when a pattern adds no useful
  behavior. Dependency upgrades, new runtimes, and remote MCP configuration are separate work.

Current production imports are `convex/crm/notificationEmailDelivery.ts`,
`convex/crm/lib/productionTestRecipes.ts`, and `convex/crm/productionTestLab.ts`.
Notification delivery owns pacing, retryable errors, sequential delivery, and
replay identities; its adjacent test covers those behaviors. The recipe runner
owns ordered independent recipes, injected `DryRunProbe`, timeout/cancellation,
cleanup, and elapsed time; `productionTestRecipes.test.ts` covers that lifecycle.
`productionTestLab.ts` supplies the controlled adapter and runs the program;
`operationalControls.convex.integration.ts` covers its in-memory authorization,
recording, and durable run boundary. ADR 0015 owns the Test Lab's product rules.
These tests and the package pin are executable checks, not a general import allowlist.
Payments, provider streams, ordinary Convex validators, and UI state keep the
plain TypeScript decisions above.

## Stable Effect update (2026-10-20)

The user authorized this update separately from the initial reference pass.
`effect` moves from `4.0.0-rc.109` to exact `4.0.5`, with Bun 1.4.0 regenerating
`bun.lock`. No separate `@effect/*` package is installed in Citius. The official
[migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)
requires matching v4 versions for ecosystem packages that remain separate;
`@effect/platform` 0.x belongs to the older ecosystem and is not added here.

The three runtime imports listed above already use v4 core APIs. They need no
import or API changes for 4.0.5. The 25 focused package/delivery/recipe checks
pass with the new runtime. They assert independent retry counts and timing,
provider identities, cancellation, bounded timeout and cleanup outcomes. The complete candidate passes all 225 schema-backed Convex tests, including
operational controls, and all 2,055 Bun tests. Application/Convex types,
zero-warning lint and the existing coverage contract also pass. No provider call or Production
Test Lab execution was used as upgrade evidence.
