# Sensitive migration rehearsal

This runbook defines the protected path for rehearsing a Convex data/schema
migration against an explicitly approved snapshot. It never turns an ordinary
Vercel Preview into a production-data environment. Repository planning, target
execution, Production promotion, and restore authority are separate evidence
states.

## Local planning command

Start with a schema-versioned manifest and print the plan locally:

```sh
bun run migration:rehearsal -- \
  --manifest config/release/migration-rehearsal.room-type-v2.json
```

The command parses local JSON and prints blocked command templates. It does not
read environment values, contact Convex, create a Preview, export/import data,
run a migration, or write evidence. There is deliberately no `--execute` flag.
Before approving a rehearsal, replace every symbolic revision with an immutable
40-character Git SHA and record the deployment returned by Preview creation.

The manifest must name:

- the migration and run ID;
- the explicit source deployment class/name and eventual Production target;
- one dedicated Preview name using the `migration-rehearsal-<migration>-`
  prefix, plus ordinary Preview names it must never reuse;
- pre-change, widen, and narrow revisions;
- whether file storage is included or excluded for a reviewed reason;
- `.scratch/migration-rehearsal/<run-id>/snapshot.zip`, a retention owner, and a
  one-to-168-hour retention window;
- bounded backfill, independent verifier, and status functions; and
- separate snapshot-export, rehearsal-import, Production-promotion, and
  rollback-decision authority.

The checked-in room-type manifest is a draft planning fixture. It is not current
target approval or evidence that any deployment has zero residual rows.

## Sensitive snapshot boundary

A source export—even read-only—is a sensitive target action and requires fresh
approval for the named source. Before export, work on an encrypted operator
volume, run `umask 077`, confirm the containing directory is not shared or
synced, and verify `.scratch/migration-rehearsal/.../snapshot.zip` is ignored by
Git. The snapshot never enters a commit, CI artifact, ticket, chat, log, or
browser download location.

`fileStorage.decision` is mandatory. Use `include` when canonical behavior
depends on stored files. `exclude-reviewed` requires a written reason and an
explicit smoke contract proving files are irrelevant to this migration. Never
silently omit storage to make the snapshot smaller.

Record only the snapshot hash and creation timestamp—never rows, file names,
customer data, or snapshot contents. The retention owner deletes the encrypted
artifact at the terminal cleanup step, confirms it is absent, and records only
the completion time. A filesystem delete is not proof that unencrypted blocks
were securely erased; encryption and short retention are the primary controls.

## Ordered dedicated-Preview rehearsal

Each command remains blocked until its exact target/revision authority is
recorded. The installed Convex CLI distinguishes the flags as follows:

1. At the pre-change revision, export from the explicit source using
   `convex export --deployment ... --path ...`; add `--include-file-storage`
   when the manifest says `include`.
2. With a Preview-only deploy key, create the protected target using
   `convex deploy --preview-create <protected-name>`. Record the returned
   deployment identity; do not reuse an ordinary Preview.
3. Import only into that recorded identity using
   `convex import <snapshot> --replace-all --deployment <identity>`. Import has
   no `--preview-name` flag.
4. At the widen revision, reuse the same protected target with
   `convex deploy --preview-name <protected-name>`.
5. Read initial migration status, then run bounded backfill pages. Supply
   protected migration arguments through a separately reviewed operator path;
   secret values must not appear in the planner, evidence, terminal capture, or
   shell history.
6. Run the independent verifier to completion and read status again. Require
   `verified: true`, `stage: complete`, and zero residual rows.
7. At the narrow revision, use `--preview-name` again. A passing deploy is the
   schema-conformance proof for this exact snapshot and revision.
8. Run the least-privilege authenticated write/read smoke named in the approval
   record. Keep credentials and customer data outside evidence.
9. Validate and store content-free evidence, request fresh explicit Production
   approval, and securely delete the snapshot at the end of the retention
   window.

Do not use `--preview-create` after importing, because recreating the Preview
would delete the rehearsal database. Do not run `convex import` without
`--deployment`, and never substitute `--prod` during rehearsal.

## Room-type-v2 pilot and migration ownership

The current `room-type-v2` implementation already has bounded server-owned
cursor state, canonical room writers, an independent verifier, and status in
`convex/migrations.ts`. Do not reset or port that registry on a live target
without first reading and reviewing its state. The repository planner treats
the custom engine as grandfathered for this pilot.

New non-trivial migrations should use the exact reviewed
`@convex-dev/migrations` component once a repository-owned installation
procedure and target-aware generated bindings are available. Mounting that
component, porting an in-flight registry, code generation, snapshot handling,
and deployment are not implied by this planning command.

## Evidence adapter

`validateMigrationRehearsalEvidence` accepts only a content-free schema-version
1 record:

- run/migration IDs, dedicated Preview name, and immutable revision;
- snapshot hash and creation time;
- widen, backfill, verify, narrow, and smoke outcomes; and
- bounded status counters (`processed`, `legacyRemaining`, stage, status, and
  verified).

Unknown fields, row payloads, and secret-like keys fail closed. Local planning
is not deployment proof; a snapshot-seeded Preview result is not Production
proof; and Production evidence is recorded separately after a fresh explicit
Production approval.

## Promotion and rollback

Prefer a reviewed forward repair whenever it is safe. Promotion repeats the
exact proven widen/backfill/zero-residual/narrow/smoke order on the named
Production target only after a fresh explicit Production approval.

A restore is a separate destructive Production decision. In particular,
`convex import <snapshot> --replace-all --prod` can discard every write after
snapshot creation. Put plainly: a replace-all restore loses every write after snapshot creation.
Record the snapshot time, enumerate the affected write
domains, stop promotion, obtain fresh restore authority from the rollback
decision owner, and communicate the loss window before any restore command.
Redeploying older code does not undo migrated data.
