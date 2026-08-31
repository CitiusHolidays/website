# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

Local `.scratch/` artifacts remain useful for audit evidence, handoffs, and working notes; GitHub Issues are the canonical issue and ticket records.

Before calling work ready for an implementation agent, classify and validate its handoff using the
[specification readiness contract](spec-handoff.md). Use the tracked
[implementation template](../../.github/ISSUE_TEMPLATE/implementation-spec.md) at publication. A
passing structural check does not supply user approval, semantic review, redaction, GitHub dedupe,
or deployment evidence.

UI-affecting tickets also complete the [UI change brief](ui-change-brief.md): owning baseline,
information hierarchy, visible loading/empty/error/success/partial/retry states, viewport and
coarse-pointer behavior, keyboard/focus/screen-reader/reduced-motion behavior, reuse targets,
non-goals, provenance, and proof boundaries. Use `N/A: <reason>` for genuinely backend-only work;
do not force a redesign or mockup for behavior-preserving maintenance.

A local planning, documentation, or evidence request does not by itself
authorize a GitHub write. Publish, edit, label, assign, or close issues only when
the task grants that external authority.

## Local validated rendering

After human review and explicit implementation authorization, run
`bun run spec:render-issue -- <exact-spec.md>` to map one valid local implementation spec to the
tracked GitHub template. The command emits deterministic Markdown to standard output only. It does
not call `gh`, write a file, deduplicate, publish, label, assign, edit, or close an issue. Review the
rendered title/body and current GitHub state before performing any separately authorized write.

## Local handoff synchronization

- Before implementation, read the current GitHub issue, labels, dependencies,
  assignee, and comments. A dated local copy never overrides live status.
- After publication, put the canonical issue URL/number in any retained local
  brief or handoff. Do not copy GitHub checklists back into a maintained mirror.
- Keep red/green output, screenshots, and local review evidence in `.scratch/`.
  Summarize the result on the issue when authorized; do not treat the artifact
  directory as completion state.
- After handoff, delete or archive disposable local ticket drafts. If retained
  for history, label them with the date and “non-authoritative snapshot.”

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
