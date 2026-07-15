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

## Consequences

- TypeScript migration can proceed independently of Effect adoption.
- Effect use should concentrate around batch imports, notification email delivery, payment/API routes, external service calls, migrations, and other failure-prone workflow edges.
- Code review can reject Effect in modules that do not meet the two-pressure threshold, even if the code is technically valid.
