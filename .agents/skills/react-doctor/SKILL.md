---
name: react-doctor
description: Use the repository-pinned React Doctor after React changes or for an explicitly requested React health pass. Uses only local reviewed tooling and the checked-in triage playbook.
version: "1.2.0-local"
---

# React Doctor

The executable is pinned in `devDependencies` and installed from `bun.lock`.
Never substitute a global executable, package runner download, mutable tag, or
live remote prompt.

## After React changes

Run:

```bash
bun run doctor -- --verbose --scope changed --include-untracked --no-score
```

Fix new errors first, then warnings attributable to the change. A repository-wide
cleanup is a separate bounded task.

## Full local triage

When the user explicitly asks for a full scan, read and follow
`docs/agents/react-doctor-triage.md`. Run the pinned executable with:

```bash
bun run doctor -- --verbose --scope full --no-score
```

## Rule configuration

Use the same local executable for rule discovery and configuration:

```bash
bun run doctor -- rules explain <rule>
```

Apply the narrowest reviewed `doctor.config.*` change and add a focused contract
when a suppression is necessary.
