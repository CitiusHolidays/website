# ADR 0015: Separate Production Tests from Live Feature Controls

## Status

Accepted (2026-08-20)

## Context

The previous Staff Workspace panel combined live traffic controls, a one-way release activation,
and one synthetic inbound-lead override. The test created business data, the control language hid
what actions did, expiry did not restore prior state, and historical rollback could be repeated.
Routine verification and live operational change need different authority and effect boundaries.

## Decision

1. Staff Workspace exposes Production Test Lab and Live Feature Controls as separate exact-Admin
   tools with the exact target identity visible in both.
2. Production Test Recipes cover only major capabilities. They reach controlled recording
   adapters and must not create business records or external effects.
3. Effect v4 owns recipe failure typing, ordered execution, independent continuation, controlled
   service layers, timeout/interruption, and cleanup. Durable run lifecycle mutations and ordinary
   React state remain plain TypeScript.
4. Live changes are staged and applied as one atomic Production Change Set after an in-page review.
5. Temporary changes restore the complete preceding state through an audited scheduled mutation.
6. Undo is one-shot and available only for the latest still-current change set. Historical events
   never become arbitrary point-in-time restore commands.
7. The activation marker and catalog migration are release-owned setup operations and do not
   appear as ordinary Admin actions.
8. Exact-Admin authorization, apply/audit paths, restoration, evidence storage, payment completion,
   and payment verification/webhooks form a non-disableable Operational Safety Kernel.
9. A Test Lab run is persisted before action execution, is immutable while Running, rejects
   overlapping recipe scope for the same Admin, and can be resumed after reload using its durable
   run identity.

## Consequences

- Routine tests can be run without email, CRM rows, provider calls, orders, files, publication, or
  scheduled-job writes.
- Live changes take effect immediately after one reviewed Apply action and leave durable target-
  stamped evidence.
- Fine-grained controls and a searchable grouped catalog replace coarse switches and raw keys.
- Production Test Lab is not a replacement for automated CRM tests, Preview browser proof, or
  Production canary evidence.
- Deploying source does not activate controls or authorize a hosted mutation.
