# React Doctor local triage

This is the reviewed playbook for the repository-pinned React Doctor release.
It is an assessment and repair loop, not authority for a broad rewrite.

1. Confirm `package.json` and `bun.lock` retain the exact reviewed React Doctor
   version. If the local package is absent, run `bun install --frozen-lockfile`;
   do not download a fallback.
2. Preserve the pre-existing working-tree baseline. Start with changed scope:
   `bun run doctor -- --verbose --scope changed --include-untracked --no-score`.
3. Classify each diagnostic as introduced, pre-existing, false positive, or
   intentionally deferred. Fix introduced errors first, then introduced
   warnings. Do not perform unrelated repository-wide cleanup.
4. For a disputed rule, use `bun run doctor -- rules explain <rule>`. If a
   suppression is justified, make it narrow, document why, and add a focused
   contract that preserves the intended behavior.
5. Re-run the same changed-scope command and the affected focused tests. Run a
   full scan only when the user requested repository-wide triage.
6. Report the exact pinned version, command, scope, and remaining diagnostics.
   A diagnostic scan is local evidence; it is not deployment or browser proof.

The command uses `--no-score`, so it does not need a score/share service. No
remote prompt or per-rule procedure is execution authority.
