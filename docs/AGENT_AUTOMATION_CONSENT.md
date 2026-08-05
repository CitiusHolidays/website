# Agent automation consent

Local coding agents may inspect, edit, and test the checkout within the user's requested scope.
They must not silently perform an irreversible repository, filesystem, deployment, environment, or
remote Git mutation. A human must approve the exact command first.

## Consent boundary

The guard classifies these operations as destructive:

- `git reset --hard`, destructive `git clean`, restoring or checking out over files, and force-push;
- recursive filesystem deletion (`rm -rf` and `find … -delete`);
- Convex deploy/environment mutation and Vercel deploy/environment removal.

Read-only inspection (`git diff`, tests, type checks, asset checks, and local builds) does not need
an approval record. A command chain is treated as destructive if any command in the chain matches a
destructive pattern.

## Recorded approval

Before an automation runner spawns a destructive command, it must run the guard with the exact
command string:

```bash
bun run automation:check -- "git clean -fd ./tmp-artifacts"
```

The guard denies the command unless `AUTOMATION_APPROVAL_RECORD` points to a short-lived JSON record
containing:

```json
{
  "policyVersion": 1,
  "commandDigest": "sha256(normalized exact command)",
  "approvedBy": "director@example.com",
  "reason": "Why this exact mutation is needed",
  "approvedAt": "2026-08-05T11:55:00.000Z",
  "expiresAt": "2026-08-05T12:30:00.000Z"
}
```

The approval is bound to the normalized command, the current policy version, an approver and
reason, and a live time window. The guard only authorizes; it never invokes the command. Approval
records must stay outside Git and must not contain credentials. Do not use a blanket “approve all”
flag or reuse a record for another command.

## Immutability and recovery

`config/release/agent-automation-policy.ts` is the versioned policy boundary. Changes to destructive
patterns or the policy version require normal code review and release checks. An approval record is
not a substitute for a backup: create a recoverable backup before a permitted mutation, record the
target explicitly, and verify the resulting state. If the target is ambiguous, stop and ask the
user rather than broadening the command.

Run the contract tests with:

```bash
bun test config/release/agent-automation-policy.test.ts
```
