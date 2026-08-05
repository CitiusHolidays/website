# Privileged MFA and step-up audit

**Scope:** Burn item 41 (`CHG-053`), audited 5 August 2026.

## Outcome

This audit does not enable MFA or change authentication behavior. The current
stack contains the Better Auth two-factor plugin, but the application does not
have the plugin's storage/schema, enrollment flow, or a server-verifiable
recent step-up signal. Adding a partial plugin configuration now would either
fail at the Convex component boundary or give privileged mutations no reliable
way to tell whether a second factor was actually completed. The safe outcome is
to defer the behavior change until the complete slice below can be deployed and
tested together.

## Evidence from the current checkout

- `better-auth` is pinned to `1.6.23`; `@convex-dev/better-auth` is `0.12.5`.
- Better Auth ships `better-auth/plugins/two-factor`, with TOTP, OTP, backup
  codes, verification lockout, and optional trusted-device cookies.
- `convex/betterAuth/auth.ts` currently configures only the Convex plugin. It
  deliberately retains the existing email/password and Google account-linking
  policy. There is no `twoFactor()` plugin entry.
- `convex/betterAuth/schema.ts` is the generated five-table schema (user,
  session, account, verification, and jwks). It has no `user.twoFactorEnabled`
  field and no `twoFactor` table. The checked-in
  `convex/betterAuth/_generated/component.ts` likewise exposes no `twoFactor`
  model.
- CRM authorization is based on the Convex identity subject and staff role
  (`convex/crm/lib/staffAccess.ts`). `ctx.auth.getUserIdentity()` does not carry
  a second-factor result or a recent-auth timestamp that a mutation can verify.
- Better Auth's trusted-device cookie is client-side, long-lived by default,
  and not visible to Convex mutations. It is not an acceptable recent
  step-up proof for destructive or privileged CRM operations.
- No table or mutation records a short-lived, single-use step-up grant bound to
  the authenticated subject, action, and audit event. No sensitive mutation
  currently calls a step-up guard.

## Why this is blocked

Enabling only `twoFactor()` is not enough. The generated Better Auth schema and
Convex component API must be migrated first, and staff need an enrollment and
recovery experience. Separately, the application needs a server-side proof that
can be checked inside a Convex mutation. A browser flag, an unbound cookie, or a
`twoFactorEnabled` profile bit would allow an old or different session to invoke
a privileged mutation and would not satisfy the “recent step-up” requirement.

The existing Google/email autolink behavior must remain unchanged. In
particular, a Google-linked account may not be silently converted into a
password account, and enabling MFA must not make an un-enrolled user appear
authenticated when the second-factor challenge is pending.

## Required implementation slice (future work)

1. **Schema/component migration:** add the Better Auth `twoFactor()` plugin,
   regenerate `convex/betterAuth/schema.ts`, regenerate the Convex Better Auth
   component API, and verify that existing accounts/sessions/autolink rows are
   preserved. Keep secrets and backup codes inside Better Auth's encrypted
   storage; never expose them through CRM/public return contracts.
2. **Enrollment and recovery:** provide a staff-only settings flow for TOTP
   enrollment (QR/URI, confirmation code, one-time backup-code display),
   recovery/reset policy, lockout/rate limits, and explicit audit events. Do
   not enable MFA for an account until the confirmation code is verified.
3. **Server-bound step-up grant:** after a successful second-factor check,
   create a short-lived (for example, 10 minutes), single-use grant keyed to
   the Better Auth subject and a narrow action scope. Consume it atomically in
   the Convex mutation; reject missing, expired, replayed, subject-mismatched,
   and action-mismatched grants. Do not trust client-supplied role, email,
   timestamps, or an unbound local-storage value.
4. **High-risk mutation coverage:** start with destructive query/job-card/staff
   operations and any Admin/Director override path. Call the guard after the
   existing permission check, and record actor, action, target, result, and
   correlation ID without logging passwords, TOTP values, cookies, or tokens.
   A Director/Admin override must be an explicit, separately audited policy;
   it must not become an unconditional bypass.
5. **Tests and rollout:** add unit tests for enrollment, lockout, grant expiry,
   replay/subject/action binding, and every covered mutation's fail-closed
   behavior. Add an authenticated browser test for the challenge and a negative
   test proving a normal session cannot perform a covered mutation. Roll out
   behind an explicit environment/configuration gate, with a documented
   recovery path before requiring it for all privileged staff.

## Current action items

- Keep Burn 41 open; do not mark its acceptance criteria complete based on the
  installed plugin alone.
- Complete the security governance deliverables from Burn 13 (including the
  disclosure path and bootstrap authority policy) before enabling a privileged
  factor requirement.
- Keep the auth-exchange recovery from Burn 18 deployed and verify it in the
  same environment used for the MFA rollout.
- Decide the first required factor (TOTP is the only provider already present
  in the dependency) and the staff recovery/override owner before implementation.
- Inventory and classify every privileged mutation so “sensitive” has an
  enforceable, testable definition rather than an informal UI label.

