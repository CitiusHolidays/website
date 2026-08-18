# Documentation catalog

This is the task-oriented entry point for maintained Citius documentation.
Root [README](../README.md) owns product setup; [RELEASE](../RELEASE.md) owns
deployment operations. Historical pages are labelled and never count as current
provider or production proof.

## Start here

- [Local development](LOCAL_DEV.md) - install, doctor, local services, and hooks (how-to).
- [Interface review contract](INTERFACE_REVIEW.md) - cross-surface interaction and accessibility checklist (reference).
- [cnfast benchmark](CNFAST_BENCHMARK.md) - benchmark-only class-merging candidate decision (reference).
- [Verification authority](VERIFICATION.md) - command and evidence vocabulary (reference).
- [Backend infrastructure](BACKEND_INFRASTRUCTURE.md) - runtime and trust boundaries (reference/explanation).
- [Product strategy](PRODUCT_STRATEGY.md) - approved portfolio priority (explanation).
- [Plan and issue handoff map](PLAN_MAP.md) - legacy pointer and authority map (reference).

## Change Citius Connect

- [Portal CRM workflows](PORTAL_CRM_WORKFLOWS.md) - operational flow reference.
- [Portal roles and access](PORTAL_ROLES_AND_ACCESS.md) - policy-led role guide.
- [Portal permissions architecture](PORTAL_PERMISSIONS_ARCHITECTURE.md) - authority design.
- [Staff Workspace performance](STAFF_WORKSPACE_PERFORMANCE.md) - bounded reads, replay safety, and budgets.
- [Convex return contracts](CONVEX_RETURN_CONTRACTS.md) - public function result rules.
- [Role dashboard](ROLE_DASHBOARD.md) - persona and KPI contract.
- [Notification email delivery](NOTIFICATION_EMAIL_DELIVERY.md) - delivery semantics and ledger.
- [Commercial File retention](COMMERCIAL_FILE_RETENTION.md) - bounded purge and retry operations.
- [Spreadsheet operations](SPREADSHEET_OPERATIONS.md) - bounded import/export states, replay, and cleanup.
- [Portal operation-status UX](PORTAL_OPERATION_STATUS_UX.md) - visible state, retry, accessibility, privacy, and evidence matrix.
- [Import validator migration](IMPORT_VALIDATOR_MIGRATION.md) - Travel Batch migration contract.
- [UI transition policy](TRANSITION_POLICY.md) - interaction and Motion constraints.

## Change public, Account, or Sacred Bharat

- [Brand architecture](BRAND_ARCHITECTURE.md) - parent and endorsed-product boundaries.
- [Public visual identity](PUBLIC_VISUAL_IDENTITY.md) - scoped tokens and verification.
- [Citius Connect logo](CITIUS_CONNECT_LOGO.md) - protected mark usage and implementation contract.
- [UI visual baselines](UI_VISUAL_BASELINES.md) - route, viewport, and review ownership.
- [Public runtime performance](PUBLIC_RUNTIME_PERFORMANCE.md) - credential-free runtime scenarios and baseline policy.
- [Public design-taste review](PUBLIC_DESIGN_TASTE_REVIEW.md) - dated baseline and follow-up.
- [Brand visual-world board](BRAND_VISUAL_WORLD_BOARD.md) - composition reference.
- [Sacred Bharat identity kit](SACRED_BHARAT_IDENTITY_KIT.md) - endorsed identity rules.
- [Sacred Bharat context](sacred-bharat/CONTEXT.md) - Yatri domain language.
- [Customer Travel Account context](customer-account/CONTEXT.md) - Account Holder and Journey Entitlement language.
- [Trail modules](TRAIL_MODULES.md) - pilgrimage trail boundaries.
- [Cache Components](CACHE_COMPONENTS.md) - public/request-sensitive caching policy.

## Change Convex, auth, payments, files, or security

- [Auth domain cutover](AUTH_DOMAIN_CUTOVER.md) - origin and callback transition how-to.
- [Auth email delivery](AUTH_EMAIL_DELIVERY.md) - privacy-safe reset and verification outcomes.
- [Booking payment transitions](BOOKING_PAYMENT_TRANSITIONS.md) - server-capability payment policy.
- [Server-secret inventory](SERVER_SECRET_INVENTORY.md) - secret comparison boundaries.
- [API observability](API_OBSERVABILITY.md) - privacy-safe API logging.
- [Error-monitoring readiness](ERROR_MONITORING_READINESS.md) - provider, privacy, Preview, and Production gates.
- [CRM readiness operations](CRM_READINESS_OPERATIONS.md) - search/metric readiness states.
- [Security and WAF runbook](SECURITY_WAF_RUNBOOK.md) - provider activation runbook.
- [Privileged MFA step-up audit](security/privileged-mfa-step-up-audit.md) - security assessment.
- [Agent automation consent](AGENT_AUTOMATION_CONSENT.md) - destructive automation authority.

## AI and runtime operations

- [AI runtime operations](AI_RUNTIME_OPERATIONS.md) - configuration and smoke boundaries.
- [Dead-code inventory](DEAD_CODE_INVENTORY.md) - report-only Knip workflow.
- [Coverage policy](COVERAGE.md) - high-risk LCOV and branch-contract ratchet.

## Test and release

- [E2E testing](E2E_TESTING.md) - Playwright commands, sessions, and matrix.
- [Browser smoke](BROWSER_SMOKE.md) - public/portal navigation smoke.
- [Notification email delivery](NOTIFICATION_EMAIL_DELIVERY.md) - retry and delivery evidence.

## Migrations

- [Sensitive migration rehearsal](migrations/rehearsal.md).
- [Customer attribution source-provenance backfill](migrations/customer-attribution-backfill.md) -
  historical normalization only; not Customer Account authorization.
- [Expense lifecycle normalization](migrations/expense-lifecycle-normalization.md).
- [Query lead-stage Closed-to-Lost migration](migrations/query-lead-stage-closed-to-lost.md).
- [Passenger import receipt positions](migrations/passenger-import-receipt-positions.md).
- [Auth identity ownership migration](migrations/auth-identity-ownership.md).
- [Sacred Bharat private-group counts](migrations/sacred-bharat-group-counts.md).
- [Sacred Bharat ordered leaderboard ranks](migrations/sacred-bharat-leaderboard-ranks.md).
- [Import validator migration](IMPORT_VALIDATOR_MIGRATION.md).

## Architecture decisions

- [ADR 0003: Sacred Bharat weighted scoring](adr/0003-sacred-bharat-weighted-temple-scoring.md).
- [ADR 0004: TypeScript-first Effect adoption](adr/0004-typescript-first-effect-adoption.md).
- [ADR 0005: Playwright CRM interaction tests](adr/0005-playwright-crm-interaction-tests.md).
- [ADR 0006: Shared commercial files](adr/0006-share-commercial-files-through-linked-records.md).
- [ADR 0007: Confirmed Offer snapshot](adr/0007-snapshot-the-confirmed-offer.md).
- [ADR 0008: Team-scoped commercial files](adr/0008-team-scoped-commercial-files.md).
- [ADR 0009: Auth-token identity migration](adr/0009-auth-token-identity-migration.md).
- [ADR 0010: Patched transitive dependency floors](adr/0010-pin-patched-transitive-security-floors.md).
- [ADR 0011: Standalone Sanity Studio security](adr/0011-secure-the-standalone-sanity-studio.md).
- [ADR 0012: Customer document intake security](adr/0012-customer-document-intake-security-contract.md).
- [ADR 0013: Customer Journey Entitlements](adr/0013-explicit-customer-journey-entitlements.md).
- [ADR 0014: First-party document preview](adr/0014-keep-document-preview-first-party.md).

## Agent and contribution references

- [Task routing](agents/task-routing.md) - trigger-to-authority map.
- [Domain docs](agents/domain.md) - glossary/ADR consumption rules.
- [Issue tracker](agents/issue-tracker.md) - canonical GitHub workflow.
- [Specification handoff](agents/spec-handoff.md) - artifact kinds, readiness, authorization, and structural check.
- [Specification template](agents/templates/spec.md) - reusable implementation handoff profile.
- [UI change brief](agents/ui-change-brief.md) - preservation-first visible-state and accessibility extension.
- [Change-program brief](agents/change-program-brief.md) - local multi-ticket brief how-to.
- [Triage labels](agents/triage-labels.md) - repository label vocabulary.
- [React Doctor triage](agents/react-doctor-triage.md) - pinned local frontend analyzer.

## Product requirements and historical records

- [Portal CRM motion-craft PRD](prd/portal-crm-motion-craft.md) - durable requirements.
- [TypeScript/Effect migration PRD](prd/typescript-effect-migration.md) - durable requirements.
- [Portal CRM motion-craft issue snapshot](issues/portal-crm-motion-craft-issues.md) - historical/local snapshot; GitHub owns live status.
- [TypeScript/Effect issue snapshot](issues/typescript-effect-migration-issues.md) - historical/local snapshot; GitHub owns live status.
- [Working-tree change summary](WORKING_TREE_CHANGES.md) - dated historical evidence only.

Add maintained Markdown under `docs/` to this catalog and keep local links current during review.
